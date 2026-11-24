// js/features/notifications.js - Push- & In-App-Benachrichtigungen für Interaktionen & DMs (PURE LOGIC)
import { _supabase } from '../config.js';
import { state } from '../state.js';

const NOTIF_PREF_KEY = 'pure_logic_push_enabled_v1';
let realtimeChannel = null;
let activeChannelEmail = '';
const recentEventKeys = new Set();

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    if (state.currentUserEmail) {
        initRealtimePushListeners(state.currentUserEmail);
    }
});

window.requestPushPermission = requestPushPermission;
window.showInAppNotification = showInAppNotification;
window.sendInteractionPush = sendInteractionPush;
window.notifyDirectMessage = notifyDirectMessage;
window.initRealtimePushListeners = initRealtimePushListeners;