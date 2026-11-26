// js/features/notifications.js - Push-, In-App-Benachrichtigungen & vollständige Activity-Historie (PURE LOGIC)
import { _supabase } from '../config.js';
import { state } from '../state.js';

const NOTIF_PREF_KEY = 'pure_logic_push_enabled_v1';
const ACTIVITY_HISTORY_KEY_PREFIX = 'pure_logic_activity_history_v1_';
const MAX_ACTIVITY_HISTORY_ITEMS = 120;

let realtimeChannel = null;
let activeChannelEmail = '';
let currentActivityFilter = 'all';
const recentEventKeys = new Set();

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, ''');
}

function getDisplayNameFromEmail(email) {
    if (!email) return 'Jemand';
    return String(email).split('@')[0];
}

function isDuplicateEvent(key) {
    if (!key) return false;
    if (recentEventKeys.has(key)) return true;
    recentEventKeys.add(key);
    setTimeout(() => {
        recentEventKeys.delete(key);
    }, 4000);
    return false;
}

function getCurrentUserEmailNormalized() {
    return (state?.currentUserEmail || '').trim().toLowerCase();
}

function getActiveHistoryUserKey(emailOverride = '') {
    const email = (emailOverride || getCurrentUserEmailNormalized() || 'guest').trim().toLowerCase();
    return `${ACTIVITY_HISTORY_KEY_PREFIX}${encodeURIComponent(email)}`;
}

export function getActivityHistory(emailOverride = '') {
    try {
        const raw = localStorage.getItem(getActiveHistoryUserKey(emailOverride));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function saveActivityHistory(items, emailOverride = '') {
    try {
        const trimmed = Array.isArray(items) ? items.slice(0, MAX_ACTIVITY_HISTORY_ITEMS) : [];
        localStorage.setItem(getActiveHistoryUserKey(emailOverride), JSON.stringify(trimmed));
    } catch (_e) {}
}

export function recordActivityHistoryEntry({
    id = null,
    type = 'info',
    title = 'Aktivität',
    body = '',
    actorEmail = '',
    postId = null,
    read = false,
    createdAt = null
}) {
    const cleanTitle = String(title || 'Aktivität').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanTitle && !cleanBody) return null;

    const existing = getActivityHistory();
    if (id && existing.some((item) => String(item.id) === String(id))) {
        return existing.find((item) => String(item.id) === String(id)) || null;
    }

    const entry = {
        id: id
            ? String(id)
            : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                ? crypto.randomUUID()
                : `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: type || 'info',
        title: cleanTitle,
        body: cleanBody,
        actorEmail: actorEmail || '',
        postId: postId || null,
        read: Boolean(read),
        createdAt: createdAt || new Date().toISOString()
    };

    const updated = [entry, ...existing];
    saveActivityHistory(updated);
    updateUnreadActivityBadges();
    renderActivityHistoryFeed();
    return entry;
}

export function markActivityItemAsRead(itemId) {
    if (!itemId) return;
    const updated = getActivityHistory().map((item) =>
        String(item.id) === String(itemId) ? { ...item, read: true } : item
    );
    saveActivityHistory(updated);
    updateUnreadActivityBadges();
    renderActivityHistoryFeed();
}

export async function markAllActivityAsRead() {
    const updated = getActivityHistory().map((item) => ({ ...item, read: true }));
    saveActivityHistory(updated);
    updateUnreadActivityBadges();
    renderActivityHistoryFeed();

    const currentEmail = getCurrentUserEmailNormalized();
    if (currentEmail) {
        try {
            await _supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('recipient_email', currentEmail)
                .eq('is_read', false);
        } catch (_e) {}
    }
}

export function clearActivityHistory() {
    saveActivityHistory([]);
    updateUnreadActivityBadges();
    renderActivityHistoryFeed();
}

export function setActivityHistoryFilter(filter = 'all') {
    currentActivityFilter = filter || 'all';
    renderActivityHistoryFeed();
}

export function handleActivityItemClick(itemId) {
    const item = getActivityHistory().find((entry) => String(entry.id) === String(itemId));
    if (!item) return;

    markActivityItemAsRead(itemId);

    if ((item.type === 'like' || item.type === 'comment') && item.postId && typeof window.openCommentsModal === 'function') {
        window.openCommentsModal(item.postId);
        return;
    }

    if (item.type === 'dm') {
        if (typeof window.openDmTab === 'function') {
            window.openDmTab(item.actorEmail || undefined);
            return;
        }
        const dmTabTrigger = document.querySelector('[data-tab="dm"], [onclick*="dm"], #nav-dm');
        if (dmTabTrigger instanceof HTMLElement) {
            dmTabTrigger.click();
            return;
        }
    }

    if (item.actorEmail && typeof window.openPublicProfile === 'function') {
        window.openPublicProfile(item.actorEmail);
    }
}

export function getUnreadActivityCount() {
    return getActivityHistory().filter((item) => !item.read).length;
}

export function updateUnreadActivityBadges() {
    const count = getUnreadActivityCount();
    const badges = document.querySelectorAll('[data-activity-unread-badge], #profile-activity-unread-badge');
    badges.forEach((badge) => {
        badge.textContent = count > 99 ? '99+' : String(count);
        if (badge instanceof HTMLElement) {
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    });
}

export async function syncActivityHistoryFromBackend(emailOverride = '') {
    const targetEmail = (emailOverride || getCurrentUserEmailNormalized()).trim().toLowerCase();
    if (!targetEmail) return;

    try {
        const { data: rows, error } = await _supabase
            .from('notifications')
            .select('id, actor_email, type, post_id, message, is_read, created_at')
            .eq('recipient_email', targetEmail)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error || !Array.isArray(rows) || rows.length === 0) return;

        const existing = getActivityHistory(targetEmail);
        const existingMap = new Map(existing.map((item) => [String(item.id), item]));

        rows.forEach((row) => {
            const rowId = String(row.id);
            const actorName = getDisplayNameFromEmail(row.actor_email);
            const fallbackTitle =
                row.type === 'like' ? 'Neuer Like ❤️' :
                row.type === 'comment' ? 'Neuer Kommentar 💬' :
                row.type === 'follow' ? 'Neuer Follower 🚀' :
                row.type === 'dm' ? `Neue Nachricht von ${actorName} ✉️` :
                'Neue Aktivität 🔔';

            const prev = existingMap.get(rowId);
            existingMap.set(rowId, {
                id: rowId,
                type: row.type || prev?.type || 'info',
                title: prev?.title || fallbackTitle,
                body: row.message || prev?.body || '',
                actorEmail: row.actor_email || prev?.actorEmail || '',
                postId: row.post_id || prev?.postId || null,
                read: Boolean(prev?.read || row.is_read),
                createdAt: row.created_at || prev?.createdAt || new Date().toISOString()
            });
        });

        const merged = Array.from(existingMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        saveActivityHistory(merged, targetEmail);
        updateUnreadActivityBadges();
        renderActivityHistoryFeed();
    } catch (_err) {
        // Backend-Tabelle 'notifications' ist optional
    }
}

function formatActivityTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getActivityBadgeLabel(type) {
    switch (type) {
        case 'like': return '❤️ Like';
        case 'comment': return '💬 Kommentar';
        case 'follow': return '🚀 Follower';
        case 'dm': return '✉️ DM';
        case 'success': return '✅ Erfolg';
        case 'warning': return '⚠️ Hinweis';
        default: return '🔔 Info';
    }
}

function getActivityActionHint(item) {
    if ((item.type === 'like' || item.type === 'comment') && item.postId) return 'Beitrag öffnen →';
    if (item.type === 'dm') return 'Nachrichten öffnen →';
    if (item.actorEmail) return 'Profil ansehen →';
    return '';
}

function findProfileActivityContainer() {
    return (
        document.getElementById('profile-activity-feed') ||
        document.getElementById('activity-history-container') ||
        document.querySelector('[data-activity-feed]') ||
        null
    );
}

export function renderActivityHistoryFeed(targetContainer = null) {
    const container = targetContainer || findProfileActivityContainer();
    if (!container) return;

    const allItems = getActivityHistory();
    const unreadCount = allItems.filter((i) => !i.read).length;
    const filteredItems = currentActivityFilter === 'all'
        ? allItems
        : allItems.filter((i) => i.type === currentActivityFilter);

    const filters = [
        { key: 'all', label: 'Alle', count: allItems.length },
        { key: 'like', label: 'Likes', count: allItems.filter((i) => i.type === 'like').length },
        { key: 'comment', label: 'Kommentare', count: allItems.filter((i) => i.type === 'comment').length },
        { key: 'follow', label: 'Follower', count: allItems.filter((i) => i.type === 'follow').length },
        { key: 'dm', label: 'DMs', count: allItems.filter((i) => i.type === 'dm').length }
    ];

    container.innerHTML = `
        <div style="background: rgba(19, 27, 46, 0.78); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #f8fafc;">🕒 Aktivitäten-Verlauf</h3>
                    <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(129, 140, 248, 0.18); color: #c7d2fe;">
                        ${unreadCount} neu
                    </span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" onclick="markAllActivityAsRead()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e2e8f0; border-radius: 8px; padding: 4px 9px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        Alle gelesen
                    </button>
                    <button type="button" onclick="clearActivityHistory()" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; border-radius: 8px; padding: 4px 9px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        Leeren
                    </button>
                </div>
            </div>

            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${filters.map((f) => {
                    const active = currentActivityFilter === f.key;
                    return `<button type="button" onclick="setActivityHistoryFilter('${f.key}')" style="padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid ${active ? '#818cf8' : 'rgba(255,255,255,0.12)'}; background: ${active ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.04)'}; color: ${active ? '#fff' : '#94a3b8'};">${f.label} (${f.count})</button>`;
                }).join('')}
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto;">
                ${filteredItems.length === 0
                    ? `<div style="text-align: center; padding: 18px 10px; font-size: 12px; color: #94a3b8;">Noch keine Aktivitäten in dieser Ansicht vorhanden.</div>`
                    : filteredItems.map((item) => {
                        const actionHint = getActivityActionHint(item);
                        const isInteractive = Boolean(actionHint);
                        return `
                            <div
                                role="${isInteractive ? 'button' : 'article'}"
                                tabindex="${isInteractive ? '0' : '-1'}"
                                onclick="handleActivityItemClick('${escapeHtml(item.id)}')"
                                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleActivityItemClick('${escapeHtml(item.id)}');}"
                                style="padding: 10px 12px; border-radius: 12px; background: ${item.read ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.11)'}; border: 1px solid ${item.read ? 'rgba(255,255,255,0.06)' : 'rgba(129,140,248,0.38)'}; display: flex; flex-direction: column; gap: 4px; cursor: ${isInteractive ? 'pointer' : 'default'};"
                            >
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; font-weight: 800; color: #a5b4fc;">${escapeHtml(getActivityBadgeLabel(item.type))}</span>
                                    <span style="font-size: 10px; color: #94a3b8;">${escapeHtml(formatActivityTime(item.createdAt))}</span>
                                </div>
                                <div style="font-size: 12px; font-weight: 800; color: #f8fafc;">${escapeHtml(item.title)}</div>
                                ${item.body ? `<div style="font-size: 11px; color: #cbd5e1; line-height: 1.35; word-break: break-word;">${escapeHtml(item.body)}</div>` : ''}
                                ${actionHint ? `<div style="font-size: 10px; font-weight: 700; color: #818cf8; margin-top: 2px;">${escapeHtml(actionHint)}</div>` : ''}
                            </div>
                        `;
                    }).join('')
                }
            </div>
        </div>
    `;
}

export function isPushEnabledByUser() {
    try {
        const stored = localStorage.getItem(NOTIF_PREF_KEY);
        return stored === null ? true : stored === 'true';
    } catch (_e) {
        return true;
    }
}

export function setPushEnabledByUser(enabled) {
    try {
        localStorage.setItem(NOTIF_PREF_KEY, String(Boolean(enabled)));
    } catch (_e) {}
    updatePushStatusUi();
}

export function getNotificationPermissionState() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

export async function requestPushPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        showInAppNotification('Benachrichtigungen', 'Dein Browser unterstützt keine System-Push-Benachrichtigungen. In-App-Hinweise sind aktiv.', 'info');
        setPushEnabledByUser(true);
        return 'unsupported';
    }

    if (Notification.permission === 'granted') {
        setPushEnabledByUser(true);
        showInAppNotification('Push aktiv', 'System-Benachrichtigungen sind für PURE LOGIC aktiviert.', 'success');
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        setPushEnabledByUser(true);
        showInAppNotification('Browser blockiert Push', 'Bitte erlaube Benachrichtigungen in den Browser-Einstellungen. In-App-Hinweise laufen weiter.', 'warning');
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        setPushEnabledByUser(permission !== 'denied');
        if (permission === 'granted') {
            showInAppNotification('Push aktiviert 🔔', 'Du erhältst ab sofort Benachrichtigungen für Likes, Kommentare, Follower und DMs.', 'success');
        } else {
            showInAppNotification('In-App-Modus aktiv', 'Du bekommst Benachrichtigungen direkt als Banner in der App.', 'info');
        }
        return permission;
    } catch (err) {
        console.warn('Fehler beim Anfordern der Push-Berechtigung:', err);
        return Notification.permission;
    }
}

function ensureToastContainer() {
    let container = document.getElementById('pl-toast-container');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'pl-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    container.style.cssText = [
        'position: fixed',
        'top: 14px',
        'right: 14px',
        'z-index: 10050',
        'display: flex',
        'flex-direction: column',
        'gap: 8px',
        'max-width: min(360px, calc(100vw - 28px))',
        'pointer-events: none'
    ].join(';');

    document.body.appendChild(container);
    return container;
}

export function showInAppNotification(title, body, type = 'info', onClickAction = null) {
    recordActivityHistoryEntry({ type, title, body });

    if (typeof document === 'undefined' || !document.body) return;
    const container = ensureToastContainer();

    const accentBorder =
        type === 'success' ? 'rgba(16, 185, 129, 0.55)' :
        type === 'warning' ? 'rgba(245, 158, 11, 0.55)' :
        'rgba(129, 140, 248, 0.55)';

    const toast = document.createElement('div');
    toast.role = 'status';
    toast.style.cssText = [
        'pointer-events: auto',
        'background: rgba(19, 27, 46, 0.96)',
        `border: 1px solid ${accentBorder}`,
        'color: #f8fafc',
        'border-radius: 14px',
        'padding: 11px 14px',
        'box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45)',
        'backdrop-filter: blur(8px)',
        'display: flex',
        'align-items: flex-start',
        'justify-content: space-between',
        'gap: 10px',
        'cursor: pointer',
        'transition: opacity 0.2s ease, transform 0.2s ease'
    ].join(';');

    toast.innerHTML = `
        <div style="min-width: 0; flex: 1;">
            <div style="font-size: 12px; font-weight: 800; color: #fff; margin-bottom: 2px;">${escapeHtml(title)}</div>
            <div style="font-size: 11px; color: #cbd5e1; line-height: 1.35; word-break: break-word;">${escapeHtml(body)}</div>
        </div>
        <button type="button" aria-label="Benachrichtigung schließen" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; line-height: 1; padding: 0 2px; cursor: pointer; flex-shrink: 0;">✕</button>
    `;

    const dismiss = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-4px)';
        setTimeout(() => toast.remove(), 200);
    };

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
    }

    toast.addEventListener('click', () => {
        if (typeof onClickAction === 'function') {
            try { onClickAction(); } catch (_e) {}
        }
        dismiss();
    });

    container.appendChild(toast);
    setTimeout(dismiss, 4500);
}

async function triggerSystemNotification(title, body, tag = 'pure-logic-event', onClickAction = null) {
    if (!isPushEnabledByUser()) return;

    const canUseSystemPush =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted';

    if (canUseSystemPush && (document.hidden || !document.hasFocus())) {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && typeof reg.showNotification === 'function') {
                    await reg.showNotification(title, {
                        body,
                        tag,
                        icon: 'icons/icon-192.png',
                        badge: 'icons/icon-192.png'
                    });
                    return;
                }
            }

            const n = new Notification(title, {
                body,
                tag,
                icon: 'icons/icon-192.png'
            });
            n.onclick = () => {
                window.focus();
                if (typeof onClickAction === 'function') onClickAction();
                n.close();
            };
            return;
        } catch (_err) {
            // Fallback auf In-App-Toast bei blockierten System-Notifications
        }
    }

    showInAppNotification(title, body, 'info', onClickAction);
}

export async function sendInteractionPush({
    type,
    recipientEmail,
    actorEmail,
    postId = null,
    previewText = ''
}) {
    if (!recipientEmail || !actorEmail) return;
    if (recipientEmail.toLowerCase() === actorEmail.toLowerCase()) return;

    const actorName = getDisplayNameFromEmail(actorEmail);
    const dedupeKey = `${type}:${actorEmail}:${recipientEmail}:${postId || previewText.slice(0, 30)}`;
    if (isDuplicateEvent(dedupeKey)) return;

    let title = 'Neue Aktivität auf PURE LOGIC';
    let body = `${actorName} hat mit dir interagiert.`;
    let onClick = null;

    if (type === 'like') {
        title = 'Neuer Like ❤️';
        body = `${actorName} gefällt dein Beitrag.`;
        if (postId && typeof window.openCommentsModal === 'function') {
            onClick = () => window.openCommentsModal(postId);
        }
    } else if (type === 'comment') {
        title = 'Neuer Kommentar 💬';
        const snippet = previewText ? `: „${previewText.slice(0, 80)}“` : ' hat deinen Beitrag kommentiert.';
        body = previewText ? `${actorName}${snippet}` : `${actorName}${snippet}`;
        if (postId && typeof window.openCommentsModal === 'function') {
            onClick = () => window.openCommentsModal(postId);
        }
    } else if (type === 'follow') {
        title = 'Neuer Follower 🚀';
        body = `${actorName} folgt dir jetzt.`;
        if (typeof window.openPublicProfile === 'function') {
            onClick = () => window.openPublicProfile(actorEmail);
        }
    } else if (type === 'dm') {
        title = `Neue Nachricht von ${actorName} ✉️`;
        body = previewText ? previewText.slice(0, 100) : 'Dir wurde eine neue Direktnachricht gesendet.';
    }

    const eventId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    recordActivityHistoryEntry({
        id: eventId,
        type,
        title,
        body,
        actorEmail,
        postId
    });

    if (state.currentUserEmail && state.currentUserEmail.toLowerCase() === recipientEmail.toLowerCase()) {
        await triggerSystemNotification(title, body, `pl-${type}`, onClick);
    }

    try {
        await _supabase.from('notifications').insert([
            {
                id: eventId,
                recipient_email: recipientEmail,
                actor_email: actorEmail,
                type,
                post_id: postId,
                message: body,
                is_read: false,
                created_at: new Date().toISOString()
            }
        ]);
    } catch (_dbErr) {
        // Tabelle 'notifications' ist optional und blockiert den Client-Flow nicht
    }
}

export async function notifyDirectMessage(recipientEmail, senderEmail, messageText) {
    await sendInteractionPush({
        type: 'dm',
        recipientEmail,
        actorEmail: senderEmail,
        previewText: messageText
    });
}

function handleFollowInsertPayload(payload, targetEmail) {
    const row = payload?.new;
    if (!row) return;
    if (String(row.following_email || '').toLowerCase() === targetEmail) {
        const follower = row.follower_email || '';
        if (follower && follower.toLowerCase() !== targetEmail) {
            sendInteractionPush({
                type: 'follow',
                recipientEmail: row.following_email,
                actorEmail: follower
            });
        }
    }
}

export function initRealtimePushListeners(currentEmail) {
    const targetEmail = (currentEmail || state.currentUserEmail || '').trim().toLowerCase();
    if (!targetEmail) return;

    updateUnreadActivityBadges();
    renderActivityHistoryFeed();
    syncActivityHistoryFromBackend(targetEmail);

    if (realtimeChannel && activeChannelEmail === targetEmail) return;

    if (realtimeChannel && typeof _supabase.removeChannel === 'function') {
        _supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    activeChannelEmail = targetEmail;

    try {
        realtimeChannel = _supabase
            .channel(`pl-push-${targetEmail}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'follows' },
                (payload) => handleFollowInsertPayload(payload, targetEmail)
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'user_follows' },
                (payload) => handleFollowInsertPayload(payload, targetEmail)
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments' },
                async (payload) => {
                    const row = payload?.new;
                    if (!row || !row.post_id) return;
                    const commenter = row.author_email || '';
                    if (commenter.toLowerCase() === targetEmail) return;

                    try {
                        const { data: post } = await _supabase
                            .from('media_posts')
                            .select('author_email')
                            .eq('id', row.post_id)
                            .maybeSingle();

                        if (post && String(post.author_email || '').toLowerCase() === targetEmail) {
                            sendInteractionPush({
                                type: 'comment',
                                recipientEmail: post.author_email,
                                actorEmail: commenter,
                                postId: row.post_id,
                                previewText: row.comment_text || ''
                            });
                        }
                    } catch (_e) {}
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'media_posts' },
                (payload) => {
                    const newRow = payload?.new;
                    const oldRow = payload?.old;
                    if (!newRow) return;
                    if (String(newRow.author_email || '').toLowerCase() !== targetEmail) return;

                    const newLikes = Array.isArray(newRow.liked_by) ? newRow.liked_by : [];
                    const oldLikes = Array.isArray(oldRow?.liked_by) ? oldRow.liked_by : [];

                    const addedLiker = newLikes.find(
                        (email) => !oldLikes.includes(email) && String(email).toLowerCase() !== targetEmail
                    );

                    if (addedLiker) {
                        sendInteractionPush({
                            type: 'like',
                            recipientEmail: newRow.author_email,
                            actorEmail: addedLiker,
                            postId: newRow.id
                        });
                    }
                }
            )
            .subscribe();
    } catch (_subErr) {
        // Realtime optional, falls nicht aktiviert
    }
}

export function updatePushStatusUi() {
    const btn = document.getElementById('push-permission-btn');
    if (!btn) return;
    const perm = getNotificationPermissionState();
    const enabled = isPushEnabledByUser();

    if (perm === 'granted' && enabled) {
        btn.textContent = '🔔 Push aktiv';
        btn.setAttribute('aria-pressed', 'true');
    } else if (perm === 'denied') {
        btn.textContent = '🔕 Push im Browser blockiert';
        btn.setAttribute('aria-pressed', 'false');
    } else {
        btn.textContent = '🔔 Push aktivieren';
        btn.setAttribute('aria-pressed', 'false');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updatePushStatusUi();
    updateUnreadActivityBadges();
    renderActivityHistoryFeed();
    if (state.currentUserEmail) {
        initRealtimePushListeners(state.currentUserEmail);
    }
});

window.requestPushPermission = requestPushPermission;
window.showInAppNotification = showInAppNotification;
window.sendInteractionPush = sendInteractionPush;
window.notifyDirectMessage = notifyDirectMessage;
window.initRealtimePushListeners = initRealtimePushListeners;
window.getActivityHistory = getActivityHistory;
window.recordActivityHistoryEntry = recordActivityHistoryEntry;
window.markActivityItemAsRead = markActivityItemAsRead;
window.markAllActivityAsRead = markAllActivityAsRead;
window.clearActivityHistory = clearActivityHistory;
window.setActivityHistoryFilter = setActivityHistoryFilter;
window.handleActivityItemClick = handleActivityItemClick;
window.getUnreadActivityCount = getUnreadActivityCount;
window.updateUnreadActivityBadges = updateUnreadActivityBadges;
window.syncActivityHistoryFromBackend = syncActivityHistoryFromBackend;
window.renderActivityHistoryFeed = renderActivityHistoryFeed;