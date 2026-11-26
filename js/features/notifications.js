// js/features/notifications.js - Push-, In-App-Benachrichtigungen & lokale Activity-Historie (PURE LOGIC)
import { _supabase } from '../config.js';
import { state } from '../state.js';

const NOTIF_PREF_KEY = 'pure_logic_push_enabled_v1';
const ACTIVITY_HISTORY_KEY_PREFIX = 'pure_logic_activity_history_v1_';
const MAX_ACTIVITY_HISTORY_ITEMS = 100;

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

function getActiveHistoryUserKey() {
    const email = (state?.currentUserEmail || 'guest').trim().toLowerCase();
    return `${ACTIVITY_HISTORY_KEY_PREFIX}${encodeURIComponent(email)}`;
}

export function getActivityHistory() {
    try {
        const raw = localStorage.getItem(getActiveHistoryUserKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
        return [];
    }
}

function saveActivityHistory(items) {
    try {
        const trimmed = Array.isArray(items) ? items.slice(0, MAX_ACTIVITY_HISTORY_ITEMS) : [];
        localStorage.setItem(getActiveHistoryUserKey(), JSON.stringify(trimmed));
    } catch (_e) {}
}

export function recordActivityHistoryEntry({
    type = 'info',
    title = 'Aktivität',
    body = '',
    actorEmail = '',
    postId = null
}) {
    const cleanTitle = String(title || 'Aktivität').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanTitle && !cleanBody) return null;

    const existing = getActivityHistory();
    const entry = {
        id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        title: cleanTitle,
        body: cleanBody,
        actorEmail: actorEmail || '',
        postId: postId || null,
        read: false,
        createdAt: new Date().toISOString()
    };

    const updated = [entry, ...existing];
    saveActivityHistory(updated);
    renderActivityHistoryFeed();
    return entry;
}

export function markAllActivityAsRead() {
    const updated = getActivityHistory().map((item) => ({ ...item, read: true }));
    saveActivityHistory(updated);
    renderActivityHistoryFeed();
}

export function clearActivityHistory() {
    saveActivityHistory([]);
    renderActivityHistoryFeed();
}

export function setActivityHistoryFilter(filter = 'all') {
    currentActivityFilter = filter || 'all';
    renderActivityHistoryFeed();
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
        { key: 'all', label: 'Alle' },
        { key: 'like', label: 'Likes' },
        { key: 'comment', label: 'Kommentare' },
        { key: 'follow', label: 'Follower' },
        { key: 'dm', label: 'DMs' }
    ];

    container.innerHTML = `
        <div style="background: rgba(19, 27, 46, 0.72); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
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
                    return `<button type="button" onclick="setActivityHistoryFilter('${f.key}')" style="padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid ${active ? '#818cf8' : 'rgba(255,255,255,0.12)'}; background: ${active ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.04)'}; color: ${active ? '#fff' : '#94a3b8'};">${f.label}</button>`;
                }).join('')}
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;">
                ${filteredItems.length === 0
                    ? `<div style="text-align: center; padding: 18px 10px; font-size: 12px; color: #94a3b8;">Noch keine Aktivitäten in dieser Ansicht vorhanden.</div>`
                    : filteredItems.map((item) => `
                        <div style="padding: 10px 12px; border-radius: 12px; background: ${item.read ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.10)'}; border: 1px solid ${item.read ? 'rgba(255,255,255,0.06)' : 'rgba(129,140,248,0.35)'}; display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <span style="font-size: 11px; font-weight: 800; color: #a5b4fc;">${escapeHtml(getActivityBadgeLabel(item.type))}</span>
                                <span style="font-size: 10px; color: #94a3b8;">${escapeHtml(formatActivityTime(item.createdAt))}</span>
                            </div>
                            <div style="font-size: 12px; font-weight: 800; color: #f8fafc;">${escapeHtml(item.title)}</div>
                            ${item.body ? `<div style="font-size: 11px; color: #cbd5e1; line-height: 1.35; word-break: break-word;">${escapeHtml(item.body)}</div>` : ''}
                        </div>
                    `).join('')
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

    recordActivityHistoryEntry({
        type,
        title,
        body,
        actorEmail,
        postId
    });

    // Eigene ausgelöste Aktion lokal bestätigen, falls der Empfänger derselbe Browser-Kontext ist
    if (state.currentUserEmail && state.currentUserEmail.toLowerCase() === recipientEmail.toLowerCase()) {
        await triggerSystemNotification(title, body, `pl-${type}`, onClick);
    }

    // Optionaler Insert in eine 'notifications'-Tabelle, falls vorhanden (Fehler werden still abgefangen)
    try {
        await _supabase.from('notifications').insert([
            {
                id: crypto.randomUUID(),
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

export function initRealtimePushListeners(currentEmail) {
    const targetEmail = (currentEmail || state.currentUserEmail || '').trim().toLowerCase();
    if (!targetEmail) return;
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
                (payload) => {
                    const row = payload?.new;
                    if (!row) return;
                    if (String(row.following_email || '').toLowerCase() === targetEmail) {
                        const follower = row.follower_email || '';
                        if (follower.toLowerCase() !== targetEmail) {
                            sendInteractionPush({
                                type: 'follow',
                                recipientEmail: row.following_email,
                                actorEmail: follower
                            });
                        }
                    }
                }
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
window.markAllActivityAsRead = markAllActivityAsRead;
window.clearActivityHistory = clearActivityHistory;
window.setActivityHistoryFilter = setActivityHistoryFilter;
window.renderActivityHistoryFeed = renderActivityHistoryFeed;