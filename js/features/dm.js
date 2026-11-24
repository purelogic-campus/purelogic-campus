// js/features/dm.js - Direct Messaging (DM) Modul mit Konversationsliste für PURE LOGIC
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { notifyDirectMessage } from './notifications.js';

let activeRecipientEmail = null;
let dmRealtimeChannel = null;
let dmRealtimeEmail = '';

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMessageTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ensureInboxLayout() {
    const inboxTab = document.getElementById('tab-inbox');
    if (!inboxTab) return null;

    const chatList = document.getElementById('dm-chat-list');
    const recipientInput = document.getElementById('dm-recipient');
    if (!chatList || !recipientInput) return null;

    let shell = document.getElementById('dm-inbox-shell');
    let convList = document.getElementById('dm-conversations-list');

    if (!shell) {
        const parentContainer = chatList.parentElement;
        if (!parentContainer) return null;

        shell = document.createElement('div');
        shell.id = 'dm-inbox-shell';
        shell.style.cssText = [
            'display: grid',
            'grid-template-columns: minmax(210px, 280px) minmax(0, 1fr)',
            'gap: 12px',
            'flex: 1',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const sidebar = document.createElement('div');
        sidebar.id = 'dm-conversations-sidebar';
        sidebar.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'background: rgba(255, 255, 255, 0.02)',
            'border: 1px solid var(--border)',
            'border-radius: 12px',
            'overflow: hidden',
            'min-height: 0'
        ].join(';');

        sidebar.innerHTML = `
            <div style="padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-shrink: 0;">
                <span style="font-size: 12px; font-weight: 800; color: #fff;">💬 Konversationen</span>
                <button type="button" onclick="window.loadConversationsList()" aria-label="Konversationen aktualisieren" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted); border-radius: 8px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">↻</button>
            </div>
            <div id="dm-conversations-list" style="flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                <p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Lade Chats...</p>
            </div>
        `;

        const threadPane = document.createElement('div');
        threadPane.id = 'dm-thread-pane';
        threadPane.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'min-width: 0',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const recipientLabel = inboxTab.querySelector('label[for="dm-recipient"]');
        const inputArea = inboxTab.querySelector('.chat-input-area');

        if (recipientLabel && recipientLabel.parentElement === parentContainer) {
            threadPane.appendChild(recipientLabel);
        }
        if (recipientInput.parentElement === parentContainer) {
            threadPane.appendChild(recipientInput);
        }
        if (chatList.parentElement === parentContainer) {
            threadPane.appendChild(chatList);
        }
        if (inputArea && inputArea.parentElement === parentContainer) {
            threadPane.appendChild(inputArea);
        }

        shell.appendChild(sidebar);
        shell.appendChild(threadPane);
        parentContainer.insertBefore(shell, parentContainer.firstChild);

        convList = document.getElementById('dm-conversations-list');
    }

    const applyResponsiveColumns = () => {
        if (!shell) return;
        if (window.innerWidth <= 720) {
            shell.style.gridTemplateColumns = '1fr';
            shell.style.gridTemplateRows = 'minmax(115px, 165px) minmax(0, 1fr)';
        } else {
            shell.style.gridTemplateColumns = 'minmax(210px, 280px) minmax(0, 1fr)';
            shell.style.gridTemplateRows = '1fr';
        }
    };

    if (!shell.dataset.resizeBound) {
        shell.dataset.resizeBound = '1';
        window.addEventListener('resize', applyResponsiveColumns);
    }
    applyResponsiveColumns();

    return { shell, convList };
}

async function fetchProfilesMap(emails) {
    const map = new Map();
    const uniqueEmails = [...new Set((emails || []).map(e => String(e || '').trim().toLowerCase()).filter(Boolean))];
    if (uniqueEmails.length === 0) return map;

    try {
        const { data, error } = await _supabase
            .from('users')
            .select('email, full_name, username, avatar_url')
            .in('email', uniqueEmails);

        if (!error && Array.isArray(data)) {
            data.forEach(u => {
                if (u?.email) {
                    map.set(String(u.email).toLowerCase(), u);
                }
            });
        }
    } catch (_err) {}

    return map;
}

/**
 * Lädt alle Konversationen des aktuellen Nutzers und stellt sie als Liste bereit
 */
export async function loadConversationsList() {
    const layout = ensureInboxLayout();
    const convList = layout?.convList || document.getElementById('dm-conversations-list');
    if (!convList) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) {
        convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Bitte logge dich ein, um Chats zu sehen.</p>';
        return;
    }

    convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Lade Konversationen...</p>';

    try {
        const { data: messages, error } = await _supabase
            .from('direct_messages')
            .select('*')
            .or(`sender_email.eq.${currentEmail},recipient_email.eq.${currentEmail}`)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const conversationsMap = new Map();

        (messages || []).forEach(msg => {
            const sender = String(msg.sender_email || '').trim().toLowerCase();
            const recipient = String(msg.recipient_email || '').trim().toLowerCase();
            if (!sender || !recipient) return;

            const partnerEmail = sender === currentEmail ? recipient : sender;
            if (!partnerEmail || partnerEmail === currentEmail) return;

            if (!conversationsMap.has(partnerEmail)) {
                conversationsMap.set(partnerEmail, {
                    partnerEmail,
                    lastMessage: msg.message_text || '',
                    lastTime: msg.created_at || '',
                    lastSender: sender
                });
            }
        });

        const activeFromInput = String(document.getElementById('dm-recipient')?.value || '').trim().toLowerCase();
        const selectedPartner = activeFromInput || activeRecipientEmail || '';

        if (selectedPartner && selectedPartner !== currentEmail && !conversationsMap.has(selectedPartner)) {
            conversationsMap.set(selectedPartner, {
                partnerEmail: selectedPartner,
                lastMessage: 'Neue Konversation starten',
                lastTime: '',
                lastSender: ''
            });
        }

        const conversations = [...conversationsMap.values()];

        if (conversations.length === 0) {
            convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Noch keine Konversationen vorhanden. Trage rechts eine E-Mail ein, um zu starten.</p>';
            return;
        }

        const profilesMap = await fetchProfilesMap(conversations.map(c => c.partnerEmail));

        convList.innerHTML = '';
        conversations.forEach(conv => {
            const profile = profilesMap.get(conv.partnerEmail);
            const displayName = profile?.full_name || profile?.username || conv.partnerEmail.split('@')[0];
            const isSelected = selectedPartner === conv.partnerEmail;
            const timeLabel = formatMessageTime(conv.lastTime);
            const prefix = conv.lastSender === currentEmail ? 'Du: ' : '';
            const previewText = `${prefix}${conv.lastMessage || ''}`;

            const itemBtn = document.createElement('button');
            itemBtn.type = 'button';
            itemBtn.setAttribute('aria-pressed', String(isSelected));
            itemBtn.style.cssText = [
                'width: 100%',
                'text-align: left',
                'padding: 9px 10px',
                'border-radius: 10px',
                'cursor: pointer',
                'display: flex',
                'flex-direction: column',
                'gap: 3px',
                'transition: background 0.15s ease, border-color 0.15s ease',
                isSelected
                    ? 'background: rgba(99, 102, 241, 0.22); border: 1px solid rgba(129, 140, 248, 0.65); color: #fff;'
                    : 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--text);'
            ].join(';');

            itemBtn.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                    <span style="font-size: 9px; color: var(--text-muted); flex-shrink: 0;">${escapeHtml(timeLabel)}</span>
                </div>
                <div style="font-size: 10px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(conv.partnerEmail)}</div>
                <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(previewText)}</div>
            `;

            itemBtn.addEventListener('click', () => {
                activeRecipientEmail = conv.partnerEmail;
                const recipientInput = document.getElementById('dm-recipient');
                if (recipientInput) {
                    recipientInput.value = conv.partnerEmail;
                }
                loadConversationsList();
                loadDirectMessages();
            });

            convList.appendChild(itemBtn);
        });
    } catch (err) {
        console.error('Fehler beim Laden der Konversationen:', err);
        convList.innerHTML = '<p style="color: #ef4444; font-size: 11px; text-align: center; padding: 14px;">Konversationen konnten nicht geladen werden.</p>';
    }
}

function ensureDmRealtimeSubscription() {
    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) return;
    if (dmRealtimeChannel && dmRealtimeEmail === currentEmail) return;

    if (dmRealtimeChannel && typeof _supabase.removeChannel === 'function') {
        _supabase.removeChannel(dmRealtimeChannel);
        dmRealtimeChannel = null;
    }

    dmRealtimeEmail = currentEmail;

    try {
        dmRealtimeChannel = _supabase
            .channel(`pl-dm-inbox-${currentEmail}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'direct_messages' },
                (payload) => {
                    const row = payload?.new;
                    if (!row) return;
                    const sender = String(row.sender_email || '').trim().toLowerCase();
                    const recipient = String(row.recipient_email || '').trim().toLowerCase();
                    if (sender !== currentEmail && recipient !== currentEmail) return;

                    const partner = sender === currentEmail ? recipient : sender;
                    if (!activeRecipientEmail && partner) {
                        activeRecipientEmail = partner;
                        const recipientInput = document.getElementById('dm-recipient');
                        if (recipientInput && !recipientInput.value.trim()) {
                            recipientInput.value = partner;
                        }
                    }

                    loadConversationsList();
                    const currentTarget = String(document.getElementById('dm-recipient')?.value || activeRecipientEmail || '').trim().toLowerCase();
                    if (currentTarget && (sender === currentTarget || recipient === currentTarget)) {
                        loadDirectMessages();
                    }
                }
            )
            .subscribe();
    } catch (_err) {}
}

/**
 * Öffnet das Postfach für eine bestimmte Empfänger-E-Mail
 */
export function openDirectMessageWith(recipientEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um Direktnachrichten zu schreiben.');
        return;
    }

    const normalizedRecipient = String(recipientEmail || '').trim().toLowerCase();
    const normalizedCurrent = String(state.currentUserEmail || '').trim().toLowerCase();

    if (normalizedRecipient === normalizedCurrent) {
        alert('Du kannst dir nicht selbst Nachrichten schreiben.');
        return;
    }

    activeRecipientEmail = normalizedRecipient;
    ensureInboxLayout();

    // Zum Postfach-Tab wechseln
    if (typeof window.switchTab === 'function') {
        window.switchTab('inbox');
    }

    const recipientInput = document.getElementById('dm-recipient');
    if (recipientInput) {
        recipientInput.value = normalizedRecipient;
    }

    loadConversationsList();
    loadDirectMessages();
}

/**
 * Lädt die Direktnachrichten zwischen dem aktuellen Nutzer und dem Empfänger
 */
export async function loadDirectMessages() {
    ensureInboxLayout();
    ensureDmRealtimeSubscription();

    const recipientInput = document.getElementById('dm-recipient');
    const chatList = document.getElementById('dm-chat-list');

    if (!recipientInput || !chatList) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const recipientEmail = recipientInput.value.trim().toLowerCase();
    activeRecipientEmail = recipientEmail;

    if (!currentEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Bitte logge dich ein.</p>';
        return;
    }

    loadConversationsList();

    if (!recipientEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Wähle links eine Konversation aus oder gib oben eine E-Mail ein.</p>';
        return;
    }

    chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Nachrichten...</p>';

    try {
        const { data: messages, error } = await _supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_email.eq.${currentEmail},recipient_email.eq.${recipientEmail}),and(sender_email.eq.${recipientEmail},recipient_email.eq.${currentEmail})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            chatList.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Noch keine Nachrichten mit ${escapeHtml(recipientEmail)}. Starte die Konversation! 💬</p>`;
            return;
        }

        chatList.innerHTML = '';
        messages.forEach(msg => {
            const isMe = String(msg.sender_email || '').toLowerCase() === currentEmail;
            const bubble = document.createElement('div');

            bubble.style.cssText = `
                max-width: 75%;
                padding: 10px 14px;
                border-radius: 14px;
                font-size: 12px;
                line-height: 1.4;
                word-break: break-word;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? 'var(--primary)' : 'var(--card)'};
                color: #fff;
                border: 1px solid ${isMe ? 'transparent' : 'var(--border)'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                margin-bottom: 4px;
            `;

            const timeStr = formatMessageTime(msg.created_at);
            bubble.innerHTML = `
                <div>${escapeHtml(msg.message_text)}</div>
                <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 2px;">${escapeHtml(timeStr)}</div>
            `;
            chatList.appendChild(bubble);
        });

        chatList.scrollTop = chatList.scrollHeight;

    } catch (err) {
        console.error('Fehler beim Laden der DMs:', err);
        chatList.innerHTML = '<p style="color: #ef4444; font-size: 12px; text-align:center; padding: 20px;">Fehler beim Laden der Nachrichten.</p>';
    }
}

/**
 * Sendet eine Direktnachricht an den Empfänger (inkl. Moderations-Check)
 */
export async function sendDirectMessage() {
    const recipientInput = document.getElementById('dm-recipient');
    const input = document.getElementById('dm-input');

    if (!recipientInput || !input) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const recipientEmail = recipientInput.value.trim().toLowerCase();
    const text = input.value.trim();

    if (!recipientEmail) {
        alert('Bitte gib zuerst eine Empfänger-E-Mail ein.');
        return;
    }

    if (!text) return;

    if (!validateInputOrAlert(text)) {
        return;
    }

    if (!currentEmail) {
        alert('Du musst eingeloggt sein.');
        return;
    }

    try {
        const { error } = await _supabase
            .from('direct_messages')
            .insert([
                {
                    id: crypto.randomUUID(),
                    sender_email: currentEmail,
                    recipient_email: recipientEmail,
                    message_text: text,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        try {
            await notifyDirectMessage(recipientEmail, currentEmail, text);
        } catch (_notifErr) {}

        activeRecipientEmail = recipientEmail;
        input.value = '';
        await loadConversationsList();
        await loadDirectMessages();

    } catch (err) {
        console.error('Fehler beim Senden der DM:', err);
        alert('Fehler beim Senden: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureInboxLayout();

    const inboxBtn = document.getElementById('btn-tab-inbox');
    if (inboxBtn) {
        inboxBtn.addEventListener('click', () => {
            setTimeout(() => {
                loadConversationsList();
                loadDirectMessages();
            }, 50);
        });
    }

    setInterval(() => {
        const inboxTab = document.getElementById('tab-inbox');
        if (inboxTab && !inboxTab.classList.contains('hidden') && state.currentUserEmail) {
            ensureDmRealtimeSubscription();
        }
    }, 1500);
});

// Global für HTML-Events verfügbar machen
window.openDirectMessageWith = openDirectMessageWith;
window.loadDirectMessages = loadDirectMessages;
window.sendDirectMessage = sendDirectMessage;
window.loadConversationsList = loadConversationsList;