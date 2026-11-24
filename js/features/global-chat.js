// js/features/global-chat.js - Campus-Chat mit klappbaren Uni-Dropdowns, Allgemein-Kanal & 4 Campus-Bereichen pro Uni
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

const CHANNEL_PREFIX_REGEX = /^\[channel:([^\]]+)\]\s*/i;
const DEFAULT_CHANNEL_KEY = 'general:all';
const CHAT_TABLE = 'global_messages';

const UNIVERSITIES = [
    { id: 'uni-wien', label: 'Universität Wien', short: 'Uni Wien' },
    { id: 'tu-wien', label: 'TU Wien', short: 'TU Wien' },
    { id: 'wu-wien', label: 'WU Wien', short: 'WU Wien' },
    { id: 'meduni-wien', label: 'MedUni Wien', short: 'MedUni Wien' },
    { id: 'boku', label: 'BOKU Wien', short: 'BOKU Wien' },
    { id: 'fh-wien', label: 'FH Wien', short: 'FH Wien' }
];

const CAMPUS_CATEGORIES = [
    { id: 'plaudern', label: '💬 Plaudern & Treffen' },
    { id: 'lernen', label: '📚 Lernen & Skripten' },
    { id: 'brett', label: '📌 Schwarzes Brett' },
    { id: 'events', label: '🎉 Campus-Events' }
];

let activeChannelKey = DEFAULT_CHANNEL_KEY;
let globalChatChannel = null;
let supportsChannelColumn = true;
let isSendingGlobalMsg = false;
let isLoadingGlobalMsgs = false;
let cachedAllMessages = [];

// Standardmäßig alle Uni-Dropdowns eingeklappt; beim Klick auf eine Uni klappt nur diese auf/zu
const expandedUniversities = new Set();

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

function getChannelMeta(channelKey) {
    const key = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    if (key === DEFAULT_CHANNEL_KEY) {
        return {
            key: DEFAULT_CHANNEL_KEY,
            title: '🌐 Allgemein (Alle Unis)',
            subtitle: 'Offener Raum für Studierende aller Universitäten'
        };
    }

    const parts = key.split(':');
    const uniId = parts[0] || '';
    const catId = parts[1] || 'plaudern';

    const uni = UNIVERSITIES.find(u => u.id === uniId) || {
        id: uniId,
        label: uniId || 'Universität',
        short: uniId || 'Uni'
    };
    const cat = CAMPUS_CATEGORIES.find(c => c.id === catId) || {
        id: catId,
        label: '💬 Plaudern & Treffen'
    };

    return {
        key,
        title: `${uni.short} · ${cat.label}`,
        subtitle: `${uni.label} — Bereich: ${cat.label}`
    };
}

function encodeMessageWithChannel(text, channelKey) {
    const cleanText = String(text || '').trim();
    const key = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    return `[channel:${key}] ${cleanText}`;
}

function decodeMessageRow(row) {
    if (!row) return null;
    const rawText = String(row.message_text || row.content || row.text || row.message || '');
    const match = rawText.match(CHANNEL_PREFIX_REGEX);

    let channelKey = DEFAULT_CHANNEL_KEY;
    let cleanText = rawText;

    if (row.channel_key) {
        channelKey = String(row.channel_key).trim().toLowerCase();
        if (match) {
            cleanText = rawText.replace(CHANNEL_PREFIX_REGEX, '').trim();
        }
    } else if (match) {
        channelKey = String(match[1] || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
        cleanText = rawText.replace(CHANNEL_PREFIX_REGEX, '').trim();
    }

    return {
        id: row.id,
        senderEmail: String(row.sender_email || row.user_email || row.email || '').trim().toLowerCase(),
        senderName: String(row.sender_name || row.full_name || row.username || '').trim(),
        channelKey,
        text: cleanText,
        createdAt: row.created_at || ''
    };
}

function getChannelCountsMap() {
    const counts = new Map();
    (cachedAllMessages || []).forEach(msg => {
        if (!msg?.channelKey) return;
        counts.set(msg.channelKey, (counts.get(msg.channelKey) || 0) + 1);
    });
    return counts;
}

async function fetchGlobalRowsWithRetry() {
    let attempt = 0;
    while (attempt < 2) {
        attempt += 1;
        const { data, error } = await _supabase
            .from(CHAT_TABLE)
            .select('*')
            .order('created_at', { ascending: true })
            .limit(400);

        if (!error) {
            return Array.isArray(data) ? data : [];
        }

        const errMsg = String(error.message || '').toLowerCase();
        const isFetchErr = errMsg.includes('failed to fetch');
        if (!isFetchErr || attempt >= 2) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 350));
    }
    return [];
}

function ensureGlobalChatLayout() {
    const globalTab = document.getElementById('tab-global');
    if (!globalTab) return null;

    const chatContainer = globalTab.querySelector('.chat-container');
    const messagesList = document.getElementById('global-chat-list');
    const inputArea = globalTab.querySelector('.chat-input-area');
    if (!chatContainer || !messagesList || !inputArea) return null;

    chatContainer.style.padding = '12px';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.overflow = 'hidden';

    let shell = document.getElementById('global-chat-shell');
    let sidebarList = document.getElementById('global-channels-list');

    if (!shell) {
        shell = document.createElement('div');
        shell.id = 'global-chat-shell';
        shell.style.cssText = [
            'display: grid',
            'grid-template-columns: minmax(225px, 300px) minmax(0, 1fr)',
            'gap: 12px',
            'flex: 1',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const sidebar = document.createElement('div');
        sidebar.id = 'global-channels-sidebar';
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
                <span style="font-size: 12px; font-weight: 800; color: #fff;">🧭 Campus-Kanäle</span>
                <button type="button" onclick="window.loadGlobalMessages(false)" aria-label="Chat aktualisieren" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted); border-radius: 8px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">↻</button>
            </div>
            <div id="global-channels-list" style="flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px;"></div>
        `;

        const threadPane = document.createElement('div');
        threadPane.id = 'global-thread-pane';
        threadPane.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'min-width: 0',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const channelHeader = document.createElement('div');
        channelHeader.id = 'global-active-channel-header';
        channelHeader.style.cssText = [
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
        channelHeader.innerHTML = `
            <div style="min-width: 0;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px;">Aktiver Kanal</div>
                <div id="global-active-channel-title" style="font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🌐 Allgemein (Alle Unis)</div>
                <div id="global-active-channel-sub" style="font-size: 11px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Offener Raum für Studierende aller Universitäten</div>
            </div>
        `;

        threadPane.appendChild(channelHeader);
        if (messagesList.parentElement === chatContainer) {
            threadPane.appendChild(messagesList);
        }
        if (inputArea.parentElement === chatContainer) {
            threadPane.appendChild(inputArea);
        }

        shell.appendChild(sidebar);
        shell.appendChild(threadPane);
        chatContainer.appendChild(shell);

        sidebarList = document.getElementById('global-channels-list');
    }

    const applyResponsiveColumns = () => {
        if (!shell) return;
        if (window.innerWidth <= 720) {
            shell.style.gridTemplateColumns = '1fr';
            shell.style.gridTemplateRows = 'minmax(135px, 190px) minmax(0, 1fr)';
        } else {
            shell.style.gridTemplateColumns = 'minmax(225px, 300px) minmax(0, 1fr)';
            shell.style.gridTemplateRows = '1fr';
        }
    };

    if (!shell.dataset.resizeBound) {
        shell.dataset.resizeBound = '1';
        window.addEventListener('resize', applyResponsiveColumns);
    }
    applyResponsiveColumns();

    if (sidebarList) {
        buildChannelsSidebar(sidebarList);
    }

    updateActiveChannelHeader();
    return { shell, sidebarList };
}

function toggleUniversityDropdown(uniId) {
    if (!uniId) return;
    if (expandedUniversities.has(uniId)) {
        expandedUniversities.delete(uniId);
    } else {
        expandedUniversities.add(uniId);
    }
    const sidebarList = document.getElementById('global-channels-list');
    if (sidebarList) {
        buildChannelsSidebar(sidebarList);
    }
}

function buildChannelsSidebar(sidebarList) {
    sidebarList.innerHTML = '';
    const counts = getChannelCountsMap();

    // 1. Allgemein-Punkt für Studierende aller Unis
    const generalCount = counts.get(DEFAULT_CHANNEL_KEY) || 0;
    const generalBtn = document.createElement('button');
    generalBtn.type = 'button';
    generalBtn.dataset.channelKey = DEFAULT_CHANNEL_KEY;
    generalBtn.style.cssText = [
        'width: 100%',
        'text-align: left',
        'padding: 10px 12px',
        'border-radius: 10px',
        'cursor: pointer',
        'display: flex',
        'flex-direction: column',
        'gap: 2px',
        'flex-shrink: 0',
        'transition: background 0.15s ease, border-color 0.15s ease'
    ].join(';');
    generalBtn.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 800; color: #fff;">🌐 Allgemein</span>
            ${generalCount > 0 ? `<span style="font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 999px; background: rgba(129, 140, 248, 0.22); color: #c7d2fe;">${generalCount}</span>` : ''}
        </div>
        <span style="font-size: 10px; color: var(--text-muted);">Alle Studierenden · Alle Unis</span>
    `;
    generalBtn.addEventListener('click', () => selectGlobalChannel(DEFAULT_CHANNEL_KEY));
    sidebarList.appendChild(generalBtn);

    // 2. Je Universität ein klappbares Dropdown-Menü mit den 4 Campus-Bereichen
    UNIVERSITIES.forEach(uni => {
        const isOpen = expandedUniversities.has(uni.id);
        const hasActiveChild = activeChannelKey.startsWith(`${uni.id}:`);

        let uniTotalCount = 0;
        CAMPUS_CATEGORIES.forEach(cat => {
            uniTotalCount += counts.get(`${uni.id}:${cat.id}`) || 0;
        });

        const groupBox = document.createElement('div');
        groupBox.style.cssText = [
            'border: 1px solid var(--border)',
            'border-radius: 10px',
            hasActiveChild ? 'background: rgba(99, 102, 241, 0.07);' : 'background: rgba(255, 255, 255, 0.015);',
            'padding: 6px',
            'display: flex',
            'flex-direction: column',
            'gap: 4px',
            'flex-shrink: 0'
        ].join(';');

        const uniHeaderBtn = document.createElement('button');
        uniHeaderBtn.type = 'button';
        uniHeaderBtn.setAttribute('aria-expanded', String(isOpen));
        uniHeaderBtn.style.cssText = [
            'width: 100%',
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 8px',
            'padding: 7px 8px',
            'border-radius: 8px',
            'border: none',
            'background: transparent',
            'cursor: pointer',
            'text-align: left',
            'color: #a5b4fc',
            'font-size: 11px',
            'font-weight: 800'
        ].join(';');
        uniHeaderBtn.innerHTML = `
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🎓 ${escapeHtml(uni.label)}</span>
            <span style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${uniTotalCount > 0 ? `<span style="font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 999px; background: rgba(129, 140, 248, 0.16); color: #a5b4fc;">${uniTotalCount}</span>` : ''}
                <span style="font-size: 10px; opacity: 0.85;">${isOpen ? '▾' : '▸'}</span>
            </span>
        `;
        uniHeaderBtn.addEventListener('click', () => toggleUniversityDropdown(uni.id));
        groupBox.appendChild(uniHeaderBtn);

        if (isOpen) {
            const subMenu = document.createElement('div');
            subMenu.style.cssText = [
                'display: flex',
                'flex-direction: column',
                'gap: 4px',
                'padding: 2px 2px 2px 6px'
            ].join(';');

            CAMPUS_CATEGORIES.forEach(cat => {
                const key = `${uni.id}:${cat.id}`;
                const catCount = counts.get(key) || 0;
                const catBtn = document.createElement('button');
                catBtn.type = 'button';
                catBtn.dataset.channelKey = key;
                catBtn.style.cssText = [
                    'width: 100%',
                    'text-align: left',
                    'padding: 6px 8px',
                    'border-radius: 8px',
                    'cursor: pointer',
                    'font-size: 11px',
                    'font-weight: 700',
                    'display: flex',
                    'justify-content: space-between',
                    'align-items: center',
                    'gap: 6px',
                    'transition: background 0.15s ease, border-color 0.15s ease'
                ].join(';');
                catBtn.innerHTML = `
                    <span>${escapeHtml(cat.label)}</span>
                    ${catCount > 0 ? `<span style="font-size: 9px; font-weight: 800; opacity: 0.85;">${catCount}</span>` : ''}
                `;
                catBtn.addEventListener('click', () => selectGlobalChannel(key));
                subMenu.appendChild(catBtn);
            });

            groupBox.appendChild(subMenu);
        }

        sidebarList.appendChild(groupBox);
    });

    highlightActiveChannelButtons();
}

function highlightActiveChannelButtons() {
    const sidebarList = document.getElementById('global-channels-list');
    if (!sidebarList) return;

    sidebarList.querySelectorAll('button[data-channel-key]').forEach(btn => {
        const key = btn.getAttribute('data-channel-key');
        const isActive = key === activeChannelKey;
        btn.setAttribute('aria-pressed', String(isActive));

        if (isActive) {
            btn.style.background = 'rgba(99, 102, 241, 0.24)';
            btn.style.border = '1px solid rgba(129, 140, 248, 0.7)';
            btn.style.color = '#fff';
        } else {
            btn.style.background = key === DEFAULT_CHANNEL_KEY ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)';
            btn.style.border = '1px solid var(--border)';
            btn.style.color = 'var(--text)';
        }
    });
}

function updateActiveChannelHeader() {
    const meta = getChannelMeta(activeChannelKey);
    const titleEl = document.getElementById('global-active-channel-title');
    const subEl = document.getElementById('global-active-channel-sub');
    const inputEl = document.getElementById('global-chat-input');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;
    if (inputEl) inputEl.placeholder = `Nachricht in ${meta.title}...`;
}

export async function selectGlobalChannel(channelKey) {
    activeChannelKey = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    const parts = activeChannelKey.split(':');
    if (parts.length === 2 && parts[0] !== 'general') {
        expandedUniversities.add(parts[0]);
    }
    ensureGlobalChatLayout();
    highlightActiveChannelButtons();
    updateActiveChannelHeader();
    await loadGlobalMessages(false);
}

function ensureGlobalChatRealtime() {
    if (globalChatChannel) return;

    try {
        globalChatChannel = _supabase
            .channel('pl-campus-channels-chat')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: CHAT_TABLE },
                (payload) => {
                    const decoded = decodeMessageRow(payload?.new);
                    if (!decoded) return;
                    cachedAllMessages = [...cachedAllMessages, decoded];
                    const sidebarList = document.getElementById('global-channels-list');
                    if (sidebarList) buildChannelsSidebar(sidebarList);
                    if (decoded.channelKey === activeChannelKey) {
                        loadGlobalMessages(true);
                    }
                }
            )
            .subscribe();
    } catch (_err) {}
}

function renderFilteredMessages(listEl, currentEmail, meta) {
    const filtered = (cachedAllMessages || []).filter(item => item && item.channelKey === activeChannelKey);

    if (filtered.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Noch keine Nachrichten in <strong>${escapeHtml(meta.title)}</strong>. Schreib als Erste/r! 💬</p>`;
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach(msg => {
        const isMe = currentEmail && msg.senderEmail === currentEmail;
        const senderLabel = msg.senderName || (msg.senderEmail ? msg.senderEmail.split('@')[0] : 'Student');

        const item = document.createElement('div');
        item.className = 'campus-chat-msg';
        item.style.cssText = [
            'max-width: 82%',
            'padding: 12px 16px',
            'border-radius: 14px',
            'font-size: 13px',
            'line-height: 1.45',
            'word-break: break-word',
            'margin-bottom: 8px',
            `align-self: ${isMe ? 'flex-end' : 'flex-start'}`,
            `background: ${isMe ? 'var(--primary)' : 'var(--card)'}`,
            'color: #fff',
            `border: 1px solid ${isMe ? 'transparent' : 'var(--border)'}`
        ].join(';');

        const timeStr = formatMessageTime(msg.createdAt);
        item.innerHTML = `
            <div style="font-size: 10px; font-weight: 800; opacity: 0.85; margin-bottom: 4px; color: ${isMe ? '#fff' : '#818cf8'};">${escapeHtml(senderLabel)}</div>
            <div>${escapeHtml(msg.text)}</div>
            <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 6px;">${escapeHtml(timeStr)}</div>
        `;
        listEl.appendChild(item);
    });

    listEl.scrollTop = listEl.scrollHeight;
}

export async function loadGlobalMessages(silent = false) {
    if (isLoadingGlobalMsgs) return;
    ensureGlobalChatLayout();
    ensureGlobalChatRealtime();

    const listEl = document.getElementById('global-chat-list');
    if (!listEl) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const meta = getChannelMeta(activeChannelKey);

    const hasExisting = listEl.querySelectorAll('.campus-chat-msg').length > 0;
    if (!silent && !hasExisting) {
        listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Lade ${escapeHtml(meta.title)}...</p>`;
    }

    isLoadingGlobalMsgs = true;
    try {
        const rows = await fetchGlobalRowsWithRetry();
        cachedAllMessages = rows.map(decodeMessageRow).filter(Boolean);

        const sidebarList = document.getElementById('global-channels-list');
        if (sidebarList) {
            buildChannelsSidebar(sidebarList);
        }

        renderFilteredMessages(listEl, currentEmail, meta);
    } catch (err) {
        console.error('Fehler beim Laden des Campus-Chats:', err);
        if (!hasExisting) {
            const reason = escapeHtml(err?.message || 'Netzwerk- oder Tabellenfehler');
            listEl.innerHTML = `
                <div style="color: #ef4444; font-size: 12px; text-align:center; padding: 20px;">
                    <div>Nachrichten konnten nicht geladen werden.</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${reason}</div>
                    <button type="button" onclick="window.loadGlobalMessages(false)" style="margin-top: 10px; background: rgba(255,255,255,0.08); border: 1px solid var(--border); color: #fff; border-radius: 8px; padding: 5px 12px; font-size: 11px; cursor: pointer;">Erneut versuchen</button>
                </div>
            `;
        }
    } finally {
        isLoadingGlobalMsgs = false;
    }
}

export async function sendGlobalMessage() {
    if (isSendingGlobalMsg) return;

    const input = document.getElementById('global-chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    if (!validateInputOrAlert(text)) {
        return;
    }

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) {
        alert('Bitte logge dich ein, um im Chat zu schreiben.');
        return;
    }

    isSendingGlobalMsg = true;
    try {
        const basePayload = {
            id: crypto.randomUUID(),
            sender_email: currentEmail,
            message_text: encodeMessageWithChannel(text, activeChannelKey),
            created_at: new Date().toISOString()
        };

        if (supportsChannelColumn) {
            const withColPayload = {
                ...basePayload,
                channel_key: activeChannelKey,
                message_text: text
            };
            const { error } = await _supabase
                .from(CHAT_TABLE)
                .insert([withColPayload]);

            if (error) {
                const msg = String(error.message || '').toLowerCase();
                if (msg.includes('channel_key') || msg.includes('column')) {
                    supportsChannelColumn = false;
                } else {
                    throw error;
                }
            }
        }

        if (!supportsChannelColumn) {
            const { error: fallbackError } = await _supabase
                .from(CHAT_TABLE)
                .insert([basePayload]);

            if (fallbackError) throw fallbackError;
        }

        input.value = '';
        await loadGlobalMessages(true);
    } catch (err) {
        console.error('Fehler beim Senden der Chat-Nachricht:', err);
        alert('Fehler beim Senden: ' + (err?.message || String(err)));
    } finally {
        isSendingGlobalMsg = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureGlobalChatLayout();

    const globalTabBtn = document.getElementById('btn-tab-global');
    if (globalTabBtn) {
        globalTabBtn.addEventListener('click', () => {
            setTimeout(() => {
                ensureGlobalChatLayout();
                loadGlobalMessages(false);
            }, 50);
        });
    }
});

window.selectGlobalChannel = selectGlobalChannel;
window.loadGlobalMessages = loadGlobalMessages;
window.sendGlobalMessage = sendGlobalMessage;