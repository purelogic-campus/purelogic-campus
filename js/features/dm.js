// js/features/dm.js - Direct Messaging (DM) Modul mit Konversationsliste, Ungelesen-Zähler, Gesprächs-Header & Lesebestätigung
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { notifyDirectMessage } from './notifications.js';

const DM_READ_STORAGE_PREFIX = 'pure_logic_dm_last_read_v1:';
const DM_PARTNER_READ_STORAGE_PREFIX = 'pure_logic_dm_partner_read_v1:';

let activeRecipientEmail = null;
let dmRealtimeChannel = null;
let dmRealtimeEmail = '';
let supportsDbReadColumn = true;

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

function formatReadDateTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('de-AT', {
        hour: '2-digit',
        minute: '2-digit'
    });
    return `${datePart}, ${timePart}`;
}

function parseTimestamp(isoDate) {
    if (!isoDate) return 0;
    const ts = new Date(isoDate).getTime();
    return Number.isNaN(ts) ? 0 : ts;
}

function getReadMapStorageKey(currentEmail) {
    return `${DM_READ_STORAGE_PREFIX}${String(currentEmail || '').trim().toLowerCase()}`;
}

function getReadTimestampsMap(currentEmail) {
    const normalizedCurrent = String(currentEmail || '').trim().toLowerCase();
    if (!normalizedCurrent) return {};
    try {
        const raw = localStorage.getItem(getReadMapStorageKey(normalizedCurrent));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
        return {};
    }
}

function saveReadTimestampsMap(currentEmail, mapObj) {
    const normalizedCurrent = String(currentEmail || '').trim().toLowerCase();
    if (!normalizedCurrent) return;
    try {
        localStorage.setItem(getReadMapStorageKey(normalizedCurrent), JSON.stringify(mapObj || {}));
    } catch (_err) {}
}

function getPartnerReadStorageKey(senderEmail, recipientEmail) {
    const s = String(senderEmail || '').trim().toLowerCase();
    const r = String(recipientEmail || '').trim().toLowerCase();
    return `${DM_PARTNER_READ_STORAGE_PREFIX}${s}__to__${r}`;
}

function getLocalPartnerReadIso(senderEmail, recipientEmail) {
    try {
        return localStorage.getItem(getPartnerReadStorageKey(senderEmail, recipientEmail)) || '';
    } catch (_err) {
        return '';
    }
}

function setLocalPartnerReadIso(senderEmail, recipientEmail, isoString) {
    try {
        const prev = getLocalPartnerReadIso(senderEmail, recipientEmail);
        const nextTs = Math.max(parseTimestamp(prev), parseTimestamp(isoString), Date.now());
        localStorage.setItem(getPartnerReadStorageKey(senderEmail, recipientEmail), new Date(nextTs).toISOString());
    } catch (_err) {}
}

export async function markConversationAsRead(partnerEmail, referenceIsoDate = null) {
    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const partner = String(partnerEmail || '').trim().toLowerCase();
    if (!currentEmail || !partner) return;

    const mapObj = getReadTimestampsMap(currentEmail);
    const prevTs = parseTimestamp(mapObj[partner]);
    const refTs = parseTimestamp(referenceIsoDate);
    const nextTs = Math.max(Date.now(), prevTs, refTs);
    const nextIso = new Date(nextTs).toISOString();

    mapObj[partner] = nextIso;
    saveReadTimestampsMap(currentEmail, mapObj);

    // Speichert für den Absender (partner), dass der aktuelle Nutzer (currentEmail) dessen Nachrichten gelesen hat
    setLocalPartnerReadIso(partner, currentEmail, nextIso);

    if (!supportsDbReadColumn) return;

    try {
        const { error } = await _supabase
            .from('direct_messages')
            .update({ recipient_last_read_at: nextIso })
            .eq('sender_email', partner)
            .eq('recipient_email', currentEmail);

        if (error) {
            const msgText = String(error.message || '').toLowerCase();
            if (msgText.includes('recipient_last_read_at') || msgText.includes('column')) {
                supportsDbReadColumn = false;
            }
        }
    } catch (_err) {}
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

        const activePartnerHeader = document.createElement('div');
        activePartnerHeader.id = 'dm-active-partner-header';
        activePartnerHeader.style.cssText = [
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 10px',
            'padding: 10px 14px',
            'margin-bottom: 8px',
            'background: rgba(255, 255, 255, 0.03)',
            'border: 1px solid var(--border)',
            'border-radius: 12px',
            'flex-shrink: 0'
        ].join(';');
        activePartnerHeader.innerHTML = `
            <div style="min-width: 0;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px;">Konversation mit</div>
                <div id="dm-active-partner-name" style="font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Kein Gesprächspartner gewählt</div>
                <div id="dm-active-partner-email" style="font-size: 11px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">–</div>
            </div>
        `;

        const recipientLabel = inboxTab.querySelector('label[for="dm-recipient"]');
        const inputArea = inboxTab.querySelector('.chat-input-area');

        threadPane.appendChild(activePartnerHeader);

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

async function updateActivePartnerHeader(partnerEmail) {
    ensureInboxLayout();
    const nameEl = document.getElementById('dm-active-partner-name');
    const emailEl = document.getElementById('dm-active-partner-email');
    if (!nameEl || !emailEl) return;

    const normalizedPartner = String(partnerEmail || '').trim().toLowerCase();
    if (!normalizedPartner) {
        nameEl.textContent = 'Kein Gesprächspartner gewählt';
        emailEl.textContent = 'Links wählen oder E-Mail eingeben';
        return;
    }

    emailEl.textContent = normalizedPartner;
    const fallbackName = normalizedPartner.split('@')[0];
    nameEl.textContent = fallbackName;

    const profilesMap = await fetchProfilesMap([normalizedPartner]);
    const profile = profilesMap.get(normalizedPartner);
    if (profile) {
        const displayName = profile.full_name || profile.username || fallbackName;
        const handleSuffix = profile.username ? ` (@${profile.username.replace(/^@+/, '')})` : '';
        nameEl.textContent = `${displayName}${handleSuffix}`;
    }
}

function updateInboxTabBadge(totalUnread) {
    const inboxBtn = document.getElementById('btn-tab-inbox');
    if (!inboxBtn) return;

    let badge = document.getElementById('dm-inbox-tab-badge');
    if (totalUnread > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'dm-inbox-tab-badge';
            badge.style.cssText = [
                'display: inline-flex',
                'align-items: center',
                'justify-content: center',
                'min-width: 16px',
                'height: 16px',
                'padding: 0 4px',
                'margin-left: 5px',
                'border-radius: 999px',
                'background: #ec4899',
                'color: #fff',
                'font-size: 9px',
                'font-weight: 900',
                'line-height: 1'
            ].join(';');
            inboxBtn.appendChild(badge);
        }
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    } else if (badge) {
        badge.remove();
    }
}

function resolveMessageReadAt(msg, currentEmail) {
    const recipient = String(msg.recipient_email || '').trim().toLowerCase();
    const dbReadIso = msg.recipient_last_read_at || '';
    const localReadIso = getLocalPartnerReadIso(currentEmail, recipient);

    const dbTs = parseTimestamp(dbReadIso);
    const localTs = parseTimestamp(localReadIso);
    const bestReadTs = Math.max(dbTs, localTs);
    if (!bestReadTs) return '';

    const msgTs = parseTimestamp(msg.created_at);
    if (msgTs > 0 && bestReadTs >= msgTs) {
        return new Date(bestReadTs).toISOString();
    }
    return '';
}

/**
 * Lädt alle Konversationen des aktuellen Nutzers inklusive Ungelesen-Zähler
 */
export async function loadConversationsList() {
    const layout = ensureInboxLayout();
    const convList = layout?.convList || document.getElementById('dm-conversations-list');
    if (!convList) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) {
        updateInboxTabBadge(0);
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
            .limit(300);

        if (error) throw error;

        const readMap = getReadTimestampsMap(currentEmail);
        const activeFromInput = String(document.getElementById('dm-recipient')?.value || '').trim().toLowerCase();
        const selectedPartner = activeFromInput || activeRecipientEmail || '';
        const inboxTab = document.getElementById('tab-inbox');
        const isInboxVisible = Boolean(inboxTab && !inboxTab.classList.contains('hidden'));

        if (isInboxVisible && selectedPartner) {
            await markConversationAsRead(selectedPartner);
        }

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
                    lastSender: sender,
                    unreadCount: 0
                });
            }

            const convEntry = conversationsMap.get(partnerEmail);
            const isIncoming = sender === partnerEmail && recipient === currentEmail;
            const isCurrentlyOpen = isInboxVisible && selectedPartner === partnerEmail;

            if (isIncoming && !isCurrentlyOpen) {
                const msgTs = parseTimestamp(msg.created_at);
                const lastReadTs = parseTimestamp(readMap[partnerEmail]);
                if (msgTs > lastReadTs) {
                    convEntry.unreadCount += 1;
                }
            }
        });

        if (selectedPartner && selectedPartner !== currentEmail && !conversationsMap.has(selectedPartner)) {
            conversationsMap.set(selectedPartner, {
                partnerEmail: selectedPartner,
                lastMessage: 'Neue Konversation starten',
                lastTime: '',
                lastSender: '',
                unreadCount: 0
            });
        }

        const conversations = [...conversationsMap.values()];
        const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        updateInboxTabBadge(totalUnread);

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
            const hasUnread = conv.unreadCount > 0;
            const unreadLabel = conv.unreadCount > 99 ? '99+' : String(conv.unreadCount);

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
                    : hasUnread
                        ? 'background: rgba(236, 72, 153, 0.10); border: 1px solid rgba(236, 72, 153, 0.45); color: var(--text);'
                        : 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--text);'
            ].join(';');

            itemBtn.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                    <div style="display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;">
                        ${hasUnread ? `<span aria-label="${escapeHtml(unreadLabel)} ungelesene Nachrichten" style="display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ec4899; color: #fff; font-size: 10px; font-weight: 900; line-height: 1;">${escapeHtml(unreadLabel)}</span>` : ''}
                        <span style="font-size: 9px; color: ${hasUnread ? '#f472b6' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '700' : '400'};">${escapeHtml(timeLabel)}</span>
                    </div>
                </div>
                <div style="font-size: 10px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(conv.partnerEmail)}</div>
                <div style="font-size: 11px; color: ${hasUnread ? '#f8fafc' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '700' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(previewText)}</div>
            `;

            itemBtn.addEventListener('click', async () => {
                activeRecipientEmail = conv.partnerEmail;
                const recipientInput = document.getElementById('dm-recipient');
                if (recipientInput) {
                    recipientInput.value = conv.partnerEmail;
                }
                await markConversationAsRead(conv.partnerEmail, conv.lastTime);
                await updateActivePartnerHeader(conv.partnerEmail);
                await loadConversationsList();
                await loadDirectMessages();
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
                { event: '*', schema: 'public', table: 'direct_messages' },
                async (payload) => {
                    const row = payload?.new || payload?.old;
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

                    const inboxTab = document.getElementById('tab-inbox');
                    const isInboxVisible = Boolean(inboxTab && !inboxTab.classList.contains('hidden'));
                    const currentTarget = String(document.getElementById('dm-recipient')?.value || activeRecipientEmail || '').trim().toLowerCase();
                    const isOpenWithPartner = Boolean(isInboxVisible && currentTarget && (sender === currentTarget || recipient === currentTarget));

                    if (isOpenWithPartner && partner && sender === partner) {
                        await markConversationAsRead(partner, row.created_at);
                    }

                    await updateActivePartnerHeader(currentTarget || activeRecipientEmail || '');
                    await loadConversationsList();
                    if (isOpenWithPartner) {
                        await loadDirectMessages();
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

    updateActivePartnerHeader(normalizedRecipient);
    markConversationAsRead(normalizedRecipient).then(() => {
        loadConversationsList();
        loadDirectMessages();
    });
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

    await updateActivePartnerHeader(recipientEmail);

    if (!currentEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Bitte logge dich ein.</p>';
        return;
    }

    if (recipientEmail) {
        await markConversationAsRead(recipientEmail);
    }

    await loadConversationsList();

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

        const latestMsgTime = messages[messages.length - 1]?.created_at || null;
        await markConversationAsRead(recipientEmail, latestMsgTime);
        await loadConversationsList();

        chatList.innerHTML = '';
        messages.forEach(msg => {
            const isMe = String(msg.sender_email || '').toLowerCase() === currentEmail;
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: ${isMe ? 'flex-end' : 'flex-start'};
                margin-bottom: 10px;
                max-width: 82%;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
            `;

            const bubble = document.createElement('div');
            // Um die Hälfte dicker/voluminöser als Standardblasen (20px 24px Padding, 14px Text, 1.55 Line-Height)
            bubble.style.cssText = `
                width: 100%;
                padding: 20px 24px;
                border-radius: 20px;
                font-size: 14px;
                line-height: 1.55;
                word-break: break-word;
                background: ${isMe ? 'var(--primary)' : 'var(--card)'};
                color: #fff;
                border: 1px solid ${isMe ? 'transparent' : 'var(--border)'};
                box-shadow: 0 4px 14px rgba(0,0,0,0.28);
            `;

            const timeStr = formatMessageTime(msg.created_at);
            bubble.innerHTML = `
                <div>${escapeHtml(msg.message_text)}</div>
                <div style="font-size: 10px; opacity: 0.75; text-align: right; margin-top: 8px;">${escapeHtml(timeStr)}</div>
            `;
            wrapper.appendChild(bubble);

            if (isMe) {
                const readIso = resolveMessageReadAt(msg, currentEmail);
                const statusRow = document.createElement('div');
                statusRow.style.cssText = `
                    font-size: 10px;
                    margin-top: 4px;
                    padding-right: 4px;
                    font-weight: 700;
                    color: ${readIso ? '#34d399' : 'var(--text-muted)'};
                `;

                if (readIso) {
                    statusRow.textContent = `✓✓ Gelesen · ${formatReadDateTime(readIso)}`;
                } else {
                    statusRow.textContent = '✓ Ungelesen';
                }

                wrapper.appendChild(statusRow);
            }

            chatList.appendChild(wrapper);
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
        const nowIso = new Date().toISOString();
        const { error } = await _supabase
            .from('direct_messages')
            .insert([
                {
                    id: crypto.randomUUID(),
                    sender_email: currentEmail,
                    recipient_email: recipientEmail,
                    message_text: text,
                    created_at: nowIso
                }
            ]);

        if (error) throw error;

        await markConversationAsRead(recipientEmail, nowIso);

        try {
            await notifyDirectMessage(recipientEmail, currentEmail, text);
        } catch (_notifErr) {}

        activeRecipientEmail = recipientEmail;
        input.value = '';
        await updateActivePartnerHeader(recipientEmail);
        await loadConversationsList();
        await loadDirectMessages();

    } catch (err) {
        console.error('Fehler beim Senden der DM:', err);
        alert('Fehler beim Senden: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureInboxLayout();
    updateActivePartnerHeader('');

    const recipientInput = document.getElementById('dm-recipient');
    if (recipientInput) {
        recipientInput.addEventListener('input', () => {
            updateActivePartnerHeader(recipientInput.value.trim().toLowerCase());
        });
    }

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
        if (!state.currentUserEmail) return;
        ensureDmRealtimeSubscription();
        const inboxTab = document.getElementById('tab-inbox');
        if (inboxTab && !inboxTab.classList.contains('hidden')) {
            loadConversationsList();
        }
    }, 2500);
});

// Global für HTML-Events verfügbar machen
window.openDirectMessageWith = openDirectMessageWith;
window.loadDirectMessages = loadDirectMessages;
window.sendDirectMessage = sendDirectMessage;
window.loadConversationsList = loadConversationsList;
window.markConversationAsRead = markConversationAsRead;