// js/features/group-chats.js - Gruppenchats für Vorlesungen und Studiengänge (Punkt 32 • PURE LOGIC)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { renderOfflineBanner, isNetworkError } from '../network.js';

const LOCAL_GROUPS_KEY = 'pure_logic_lecture_groups_v1';
const LOCAL_GROUP_MSGS_PREFIX = 'pure_logic_lecture_group_msgs_v1_';
const GROUP_POLL_MS = 3000;

const DEFAULT_SAMPLE_GROUPS = [
    {
        id: 'default-steop-inf',
        title: 'STEOP Informatik & Programmierung',
        course_code: 'VO-INF-101',
        study_program: 'Informatik (Uni Wien / TU)',
        university: 'Universität Wien',
        description: 'Austausch zu Übungsblättern, Altfragen und Tutorien.',
        creator_email: 'office@pure-logic.at',
        members: ['office@pure-logic.at'],
        created_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
        id: 'default-wu-bwl',
        title: 'BWL & Mikroökonomie Lerngruppe',
        course_code: 'STEOP-BWL',
        study_program: 'Wirtschafts- und Sozialwissenschaften',
        university: 'Wirtschaftsuniversität Wien (WU)',
        description: 'Zusammenfassungen, Prüfungstermine und Lernsessions im LC.',
        creator_email: 'office@pure-logic.at',
        members: ['office@pure-logic.at'],
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 'default-med-sip',
        title: 'SIP 1 Vorbereitung & Anatomie',
        course_code: 'MED-SIP1',
        study_program: 'Humanmedizin',
        university: 'MedUni Wien',
        description: 'Klinik-Tipps, Sezierkurs-Orga und Lernkarten-Tausch.',
        creator_email: 'office@pure-logic.at',
        members: ['office@pure-logic.at'],
        created_at: new Date(Date.now() - 86400000).toISOString()
    }
];

let allGroupsCache = [];
let activeGroupId = null;
let groupRealtimeChannel = null;
let groupPollTimer = null;
let currentSearchQuery = '';
let currentUniFilter = 'Alle';
let showOnlyMyGroups = false;
let previousFocusElement = null;

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, ''');
}

function canUseNetwork() {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function getCurrentEmail() {
    return (state?.currentUserEmail || '').trim().toLowerCase();
}

function getShortName(email) {
    if (!email) return 'Gast';
    return String(email).split('@')[0];
}

function formatTimeShort(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function getLocalGroups() {
    try {
        const raw = localStorage.getItem(LOCAL_GROUPS_KEY);
        if (!raw) {
            localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(DEFAULT_SAMPLE_GROUPS));
            return [...DEFAULT_SAMPLE_GROUPS];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_SAMPLE_GROUPS];
    } catch (_e) {
        return [...DEFAULT_SAMPLE_GROUPS];
    }
}

function saveLocalGroups(groups) {
    try {
        localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
    } catch (_e) {}
}

function getLocalMessages(groupId) {
    try {
        const raw = localStorage.getItem(`${LOCAL_GROUP_MSGS_PREFIX}${groupId}`);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (_e) {}

    return [
        {
            id: `welcome-${groupId}`,
            group_id: groupId,
            sender_email: 'office@pure-logic.at',
            message_text: 'Willkommen im Vorlesungs-Gruppenchat! Teilt hier Skripte, Fragen und Lerntreffen.',
            created_at: new Date(Date.now() - 3600000).toISOString()
        }
    ];
}

function saveLocalMessages(groupId, messages) {
    try {
        const trimmed = Array.isArray(messages) ? messages.slice(-200) : [];
        localStorage.setItem(`${LOCAL_GROUP_MSGS_PREFIX}${groupId}`, JSON.stringify(trimmed));
    } catch (_e) {}
}

function setModalVisible(modal, visible) {
    if (!modal) return;
    if (visible) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } else {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

export function injectGroupChatsAccessPoints() {
    if (typeof document === 'undefined' || !document.body) return;

    const existingFab = document.getElementById('pl-floating-group-chats-btn');
    if (existingFab) existingFab.remove();

    const dmHost =
        document.getElementById('tab-dm') ||
        document.getElementById('dm-section') ||
        document.getElementById('dm-view') ||
        document.querySelector('[data-dm-view]');

    if (dmHost && !document.getElementById('dm-group-chats-banner')) {
        const banner = document.createElement('div');
        banner.id = 'dm-group-chats-banner';
        banner.style.cssText = [
            'margin: 0 0 12px 0',
            'padding: 10px 14px',
            'border-radius: 14px',
            'background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(236, 72, 153, 0.16))',
            'border: 1px solid rgba(129, 140, 248, 0.45)',
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 10px',
            'flex-wrap: wrap'
        ].join(';');
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">🎓</span>
                <div>
                    <div style="font-size: 12px; font-weight: 900; color: #f8fafc;">Vorlesungs- & Studiengang-Gruppenchats</div>
                    <div style="font-size: 11px; color: #cbd5e1;">Lern-Räume nach LV-Kürzel & Universität</div>
                </div>
            </div>
            <button type="button" onclick="openLectureGroupChatsModal()" style="background: linear-gradient(135deg, #6366f1, #ec4899); border: none; color: #fff; font-size: 11px; font-weight: 900; padding: 7px 12px; border-radius: 10px; cursor: pointer;">
                Gruppen öffnen →
            </button>
        `;
        dmHost.prepend(banner);
    }
}

function ensureGroupChatModal() {
    let modal = document.getElementById('lecture-group-chats-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'lecture-group-chats-modal';
    modal.className = 'hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Gruppenchats für Vorlesungen und Studiengänge');
    modal.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 10040',
        'background: rgba(7, 11, 20, 0.92)',
        'backdrop-filter: blur(8px)',
        'display: none',
        'align-items: center',
        'justify-content: center',
        'padding: 12px',
        'box-sizing: border-box'
    ].join(';');

    modal.innerHTML = `
        <div style="width: 100%; max-width: 980px; height: min(88vh, 760px); background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75);">
            <div style="padding: 14px 18px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(15, 23, 42, 0.96); flex-shrink: 0;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <span style="font-size: 20px;">🎓</span>
                    <div style="min-width: 0;">
                        <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            Vorlesungs- & Studiengang-Gruppenchats
                        </h2>
                        <div style="font-size: 11px; color: #94a3b8;">Vernetze dich mit Kommiliton:innen aus deiner LV</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <button type="button" onclick="toggleCreateGroupChatForm()" style="background: linear-gradient(135deg, #6366f1, #ec4899); border: none; color: #fff; font-size: 11px; font-weight: 900; padding: 7px 12px; border-radius: 10px; cursor: pointer; white-space: nowrap;">
                        + Neue Gruppe
                    </button>
                    <button type="button" onclick="closeLectureGroupChatsModal()" aria-label="Gruppenchats schließen" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #f8fafc; width: 32px; height: 32px; border-radius: 10px; font-size: 18px; line-height: 1; cursor: pointer;">
                        ×
                    </button>
                </div>
            </div>

            <div id="create-group-chat-panel" class="hidden" style="padding: 14px 18px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); background: rgba(30, 41, 59, 0.65); flex-shrink: 0;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="new-group-title-input" placeholder="Vorlesung / Gruppenname *" style="margin: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <input type="text" id="new-group-code-input" placeholder="LV-Kürzel (z. B. VO-101)" style="margin: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <input type="text" id="new-group-program-input" placeholder="Studiengang (z. B. Informatik)" style="margin: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <select id="new-group-uni-select" style="margin: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: #0f172a; color: #fff; font-size: 12px;">
                        <option value="Universität Wien">Universität Wien</option>
                        <option value="TU Wien">TU Wien</option>
                        <option value="Wirtschaftsuniversität Wien (WU)">WU Wien</option>
                        <option value="MedUni Wien">MedUni Wien</option>
                        <option value="BOKU Wien">BOKU Wien</option>
                        <option value="FH Wien">FH Wien</option>
                        <option value="Hochschulübergreifend">Hochschulübergreifend</option>
                    </select>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <input type="text" id="new-group-desc-input" placeholder="Kurze Beschreibung (Prüfungstermin, Tutorium, etc.)" style="flex: 1; min-width: 200px; margin: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <button type="button" onclick="createNewLectureGroup()" style="background: #10b981; border: none; color: #fff; font-size: 12px; font-weight: 900; padding: 8px 14px; border-radius: 10px; cursor: pointer;">
                        Gruppe erstellen 🚀
                    </button>
                    <button type="button" onclick="toggleCreateGroupChatForm(false)" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 12px; border-radius: 10px; cursor: pointer;">
                        Abbrechen
                    </button>
                </div>
            </div>

            <div id="group-chats-workspace" style="flex: 1; display: grid; grid-template-columns: minmax(260px, 340px) 1fr; min-height: 0; overflow: hidden;">
                <div id="group-chats-sidebar" style="border-right: 1px solid rgba(148, 163, 184, 0.16); display: flex; flex-direction: column; min-height: 0; background: rgba(11, 17, 32, 0.7);">
                    <div style="padding: 10px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.14); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
                        <input type="text" id="group-chats-search-input" oninput="filterLectureGroups(this.value)" placeholder="🔍 Vorlesung, Kürzel oder Studiengang..." style="margin: 0; width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; font-size: 12px;">
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <select id="group-chats-uni-filter" onchange="setLectureGroupUniFilter(this.value)" style="flex: 1; margin: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); background: #0f172a; color: #e2e8f0; font-size: 11px;">
                                <option value="Alle">Alle Hochschulen</option>
                                <option value="Universität Wien">Uni Wien</option>
                                <option value="TU Wien">TU Wien</option>
                                <option value="Wirtschaftsuniversität Wien (WU)">WU Wien</option>
                                <option value="MedUni Wien">MedUni Wien</option>
                                <option value="BOKU Wien">BOKU Wien</option>
                                <option value="FH Wien">FH Wien</option>
                            </select>
                            <button type="button" id="group-chats-mine-toggle" onclick="toggleMyGroupsOnly()" style="padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #cbd5e1; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                                Meine
                            </button>
                        </div>
                    </div>
                    <div id="lecture-groups-list" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;"></div>
                </div>

                <div id="group-chat-room-pane" style="display: flex; flex-direction: column; min-height: 0; background: rgba(15, 23, 42, 0.45);">
                    <div id="group-chat-room-header" style="padding: 12px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.16); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0;">
                        <div style="font-size: 12px; color: #94a3b8;">Wähle links eine Vorlesungsgruppe aus oder erstelle eine neue.</div>
                    </div>

                    <div id="group-chat-messages-list" style="flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="margin: auto; text-align: center; max-width: 320px; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                            📚 Hier erscheinen alle Nachrichten deiner Vorlesungs- und Studiengang-Gruppe in Echtzeit.
                        </div>
                    </div>

                    <div id="group-chat-input-bar" style="padding: 12px 14px; border-top: 1px solid rgba(148, 163, 184, 0.16); background: rgba(11, 17, 32, 0.85); display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        <input type="text" id="group-chat-message-input" placeholder="Nachricht an die Vorlesungsgruppe schreiben..." disabled onkeydown="if(event.key==='Enter') sendGroupChatMessage()" style="flex: 1; margin: 0; padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: #fff; font-size: 12px;">
                        <button type="button" id="group-chat-send-btn" onclick="sendGroupChatMessage()" disabled style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: #fff; font-size: 12px; font-weight: 800; padding: 9px 14px; border-radius: 10px; cursor: pointer;">
                            Senden
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeLectureGroupChatsModal();
        }
    });

    document.body.appendChild(modal);
    syncGroupChatResponsiveLayout();
    return modal;
}

function syncGroupChatResponsiveLayout() {
    const workspace = document.getElementById('group-chats-workspace');
    const sidebar = document.getElementById('group-chats-sidebar');
    const roomPane = document.getElementById('group-chat-room-pane');
    if (!workspace || !sidebar || !roomPane) return;

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        workspace.style.gridTemplateColumns = '1fr';
        if (activeGroupId) {
            sidebar.style.display = 'none';
            roomPane.style.display = 'flex';
        } else {
            sidebar.style.display = 'flex';
            roomPane.style.display = 'none';
        }
    } else {
        workspace.style.gridTemplateColumns = 'minmax(260px, 340px) 1fr';
        sidebar.style.display = 'flex';
        roomPane.style.display = 'flex';
    }
}

export async function openLectureGroupChatsModal(preselectGroupId = null) {
    previousFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    injectGroupChatsAccessPoints();
    const modal = ensureGroupChatModal();
    setModalVisible(modal, true);

    await loadLectureGroups();

    if (preselectGroupId) {
        await selectLectureGroup(preselectGroupId);
    } else if (!activeGroupId && allGroupsCache.length > 0 && window.innerWidth >= 768) {
        await selectLectureGroup(allGroupsCache[0].id);
    } else {
        syncGroupChatResponsiveLayout();
    }
}

export function closeLectureGroupChatsModal() {
    const modal = document.getElementById('lecture-group-chats-modal');
    setModalVisible(modal, false);
    stopGroupRealtimeSync();
    if (previousFocusElement && previousFocusElement.isConnected) {
        previousFocusElement.focus();
    }
    previousFocusElement = null;
}

export function toggleCreateGroupChatForm(forceState = null) {
    const panel = document.getElementById('create-group-chat-panel');
    if (!panel) return;
    if (typeof forceState === 'boolean') {
        panel.classList.toggle('hidden', !forceState);
    } else {
        panel.classList.toggle('hidden');
    }
    if (!panel.classList.contains('hidden')) {
        const titleInput = document.getElementById('new-group-title-input');
        if (titleInput) titleInput.focus();
    }
}

export async function loadLectureGroups() {
    const listEl = document.getElementById('lecture-groups-list');
    if (listEl) {
        listEl.innerHTML = '<div style="text-align: center; padding: 18px; color: #94a3b8; font-size: 12px;">Lade Vorlesungsgruppen...</div>';
    }

    let groups = [];
    if (canUseNetwork()) {
        try {
            const { data, error } = await _supabase
                .from('lecture_group_chats')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data) && data.length > 0) {
                groups = data.map((row) => ({
                    ...row,
                    members: Array.isArray(row.members) ? row.members : [row.creator_email].filter(Boolean)
                }));
                saveLocalGroups(groups);
            } else {
                groups = getLocalGroups();
            }
        } catch (err) {
            if (isNetworkError(err)) renderOfflineBanner(true);
            groups = getLocalGroups();
        }
    } else {
        groups = getLocalGroups();
    }

    allGroupsCache = groups;
    renderLectureGroupsList();
}

function renderLectureGroupsList() {
    const listEl = document.getElementById('lecture-groups-list');
    if (!listEl) return;

    const myEmail = getCurrentEmail();
    const q = currentSearchQuery.trim().toLowerCase();

    const filtered = allGroupsCache.filter((g) => {
        const members = Array.isArray(g.members) ? g.members.map((m) => String(m).toLowerCase()) : [];
        if (showOnlyMyGroups && (!myEmail || !members.includes(myEmail))) {
            return false;
        }
        if (currentUniFilter !== 'Alle' && String(g.university || '').toLowerCase() !== currentUniFilter.toLowerCase()) {
            return false;
        }
        if (!q) return true;
        const haystack = [
            g.title || '',
            g.course_code || '',
            g.study_program || '',
            g.university || '',
            g.description || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 24px 12px; color: #94a3b8; font-size: 12px;">
                Keine passenden Gruppen gefunden.<br>
                <span style="font-size: 11px;">Erstelle oben über „+ Neue Gruppe“ deinen eigenen Vorlesungschat!</span>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach((group) => {
        const isSelected = String(group.id) === String(activeGroupId);
        const members = Array.isArray(group.members) ? group.members : [];
        const isMember = myEmail && members.some((m) => String(m).toLowerCase() === myEmail);

        const card = document.createElement('div');
        card.style.cssText = [
            'padding: 10px 12px',
            'border-radius: 12px',
            `background: ${isSelected ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.035)'}`,
            `border: 1px solid ${isSelected ? 'rgba(129, 140, 248, 0.65)' : 'rgba(255, 255, 255, 0.08)'}`,
            'cursor: pointer',
            'display: flex',
            'flex-direction: column',
            'gap: 4px',
            'transition: border-color 0.15s ease, background 0.15s ease'
        ].join(';');

        card.onclick = () => selectLectureGroup(group.id);

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                <span style="font-size: 10px; font-weight: 800; color: #a5b4fc; background: rgba(99,102,241,0.18); padding: 2px 7px; border-radius: 999px;">
                    ${escapeHtml(group.course_code || 'LV-CHAT')}
                </span>
                <span style="font-size: 10px; color: ${isMember ? '#34d399' : '#94a3b8'}; font-weight: 700;">
                    ${isMember ? '✓ Mitglied' : `👥 ${members.length}`}
                </span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #f8fafc; line-height: 1.3;">
                ${escapeHtml(group.title)}
            </div>
            <div style="font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(group.study_program || 'Studiengang')} • ${escapeHtml(group.university || 'Campus')}
            </div>
        `;
        listEl.appendChild(card);
    });
}

export function filterLectureGroups(query) {
    currentSearchQuery = String(query || '');
    renderLectureGroupsList();
}

export function setLectureGroupUniFilter(uni) {
    currentUniFilter = uni || 'Alle';
    renderLectureGroupsList();
}

export function toggleMyGroupsOnly() {
    showOnlyMyGroups = !showOnlyMyGroups;
    const btn = document.getElementById('group-chats-mine-toggle');
    if (btn) {
        btn.style.background = showOnlyMyGroups ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = showOnlyMyGroups ? '#818cf8' : 'rgba(255, 255, 255, 0.14)';
        btn.style.color = showOnlyMyGroups ? '#fff' : '#cbd5e1';
    }
    renderLectureGroupsList();
}

export async function createNewLectureGroup() {
    const myEmail = getCurrentEmail();
    if (!myEmail) {
        alert('Bitte logge dich zuerst ein, um einen Gruppenchat zu erstellen.');
        return;
    }

    const title = document.getElementById('new-group-title-input')?.value.trim() || '';
    const courseCode = document.getElementById('new-group-code-input')?.value.trim() || 'LV-GRUPPE';
    const studyProgram = document.getElementById('new-group-program-input')?.value.trim() || 'Allgemeines Studium';
    const university = document.getElementById('new-group-uni-select')?.value || 'Universität Wien';
    const description = document.getElementById('new-group-desc-input')?.value.trim() || 'Gemeinsame Vorlesungsgruppe';

    if (!title) {
        alert('Bitte gib einen Namen für die Vorlesung oder den Studiengang ein.');
        return;
    }

    if (!validateInputOrAlert(title) || !validateInputOrAlert(courseCode) || !validateInputOrAlert(studyProgram) || !validateInputOrAlert(description)) {
        return;
    }

    const newGroup = {
        id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        course_code: courseCode.toUpperCase(),
        study_program: studyProgram,
        university,
        description,
        creator_email: myEmail,
        members: [myEmail],
        created_at: new Date().toISOString()
    };

    if (canUseNetwork()) {
        try {
            const { error } = await _supabase
                .from('lecture_group_chats')
                .insert([newGroup]);
            if (error && isNetworkError(error)) {
                renderOfflineBanner(true);
            }
        } catch (_e) {}
    }

    const updatedGroups = [newGroup, ...allGroupsCache];
    allGroupsCache = updatedGroups;
    saveLocalGroups(updatedGroups);

    ['new-group-title-input', 'new-group-code-input', 'new-group-program-input', 'new-group-desc-input'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    toggleCreateGroupChatForm(false);
    renderLectureGroupsList();
    await selectLectureGroup(newGroup.id);
}

export async function selectLectureGroup(groupId) {
    activeGroupId = String(groupId);
    const group = allGroupsCache.find((g) => String(g.id) === activeGroupId);
    renderLectureGroupsList();
    syncGroupChatResponsiveLayout();

    const headerEl = document.getElementById('group-chat-room-header');
    const inputEl = document.getElementById('group-chat-message-input');
    const sendBtn = document.getElementById('group-chat-send-btn');

    if (!group || !headerEl) return;

    const myEmail = getCurrentEmail();
    const members = Array.isArray(group.members) ? group.members : [];
    const isMember = myEmail && members.some((m) => String(m).toLowerCase() === myEmail);

    headerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <button type="button" onclick="backToLectureGroupsList()" style="display: ${window.innerWidth < 768 ? 'inline-flex' : 'none'}; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #fff; border-radius: 8px; padding: 5px 9px; font-size: 11px; font-weight: 800; cursor: pointer;">
                ← Zurück
            </button>
            <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <strong style="font-size: 14px; color: #f8fafc;">${escapeHtml(group.title)}</strong>
                    <span style="font-size: 10px; font-weight: 800; color: #a5b4fc; background: rgba(99,102,241,0.2); padding: 2px 7px; border-radius: 999px;">
                        ${escapeHtml(group.course_code || 'LV')}
                    </span>
                </div>
                <div style="font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(group.study_program || '')} • ${members.length} Mitglieder
                </div>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button type="button" onclick="copyLectureGroupInvite('${escapeHtml(group.id)}')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e2e8f0; border-radius: 8px; padding: 6px 9px; font-size: 11px; font-weight: 700; cursor: pointer;">
                🔗 Einladen
            </button>
            ${isMember
                ? `<button type="button" onclick="leaveLectureGroup('${escapeHtml(group.id)}')" style="background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 800; cursor: pointer;">Verlassen</button>`
                : `<button type="button" onclick="joinLectureGroup('${escapeHtml(group.id)}')" style="background: #10b981; border: none; color: #fff; border-radius: 8px; padding: 6px 11px; font-size: 11px; font-weight: 900; cursor: pointer;">Beitreten +</button>`
            }
        </div>
    `;

    if (inputEl && sendBtn) {
        inputEl.disabled = !isMember;
        sendBtn.disabled = !isMember;
        inputEl.placeholder = isMember
            ? `Nachricht in ${group.title} schreiben...`
            : 'Tritt der Gruppe oben rechts bei, um mitzuschreiben...';
    }

    await loadGroupMessages(group.id);
    startGroupRealtimeSync(group.id);
}

export function backToLectureGroupsList() {
    activeGroupId = null;
    stopGroupRealtimeSync();
    syncGroupChatResponsiveLayout();
    renderLectureGroupsList();
}

export async function joinLectureGroup(groupId) {
    const myEmail = getCurrentEmail();
    if (!myEmail) {
        alert('Bitte logge dich zuerst ein, um der Gruppe beizutreten.');
        return;
    }

    const group = allGroupsCache.find((g) => String(g.id) === String(groupId));
    if (!group) return;

    const currentMembers = Array.isArray(group.members) ? [...group.members] : [];
    if (!currentMembers.some((m) => String(m).toLowerCase() === myEmail)) {
        currentMembers.push(myEmail);
    }
    group.members = currentMembers;
    saveLocalGroups(allGroupsCache);

    if (canUseNetwork()) {
        try {
            await _supabase
                .from('lecture_group_chats')
                .update({ members: currentMembers })
                .eq('id', groupId);
        } catch (_e) {}
    }

    await selectLectureGroup(groupId);
}

export async function leaveLectureGroup(groupId) {
    const myEmail = getCurrentEmail();
    if (!myEmail) return;

    const group = allGroupsCache.find((g) => String(g.id) === String(groupId));
    if (!group) return;

    const updatedMembers = (Array.isArray(group.members) ? group.members : []).filter(
        (m) => String(m).toLowerCase() !== myEmail
    );
    group.members = updatedMembers;
    saveLocalGroups(allGroupsCache);

    if (canUseNetwork()) {
        try {
            await _supabase
                .from('lecture_group_chats')
                .update({ members: updatedMembers })
                .eq('id', groupId);
        } catch (_e) {}
    }

    await selectLectureGroup(groupId);
}

export async function copyLectureGroupInvite(groupId) {
    const group = allGroupsCache.find((g) => String(g.id) === String(groupId));
    if (!group) return;

    const shareText = `Komm in unsere PURE LOGIC Vorlesungsgruppe „${group.title}“ (${group.course_code || 'LV'}) – ${group.university || 'Campus'}!`;
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(shareText);
            alert('Einladungstext in die Zwischenablage kopiert! 📋');
            return;
        }
    } catch (_e) {}
    prompt('Einladungstext kopieren:', shareText);
}

async function loadGroupMessages(groupId) {
    const listEl = document.getElementById('group-chat-messages-list');
    if (!listEl) return;

    let messages = getLocalMessages(groupId);

    if (canUseNetwork()) {
        try {
            const { data, error } = await _supabase
                .from('lecture_group_messages')
                .select('*')
                .eq('group_id', groupId)
                .order('created_at', { ascending: true })
                .limit(150);

            if (!error && Array.isArray(data) && data.length > 0) {
                messages = data;
                saveLocalMessages(groupId, data);
            }
        } catch (_e) {}
    }

    renderGroupMessages(messages);
}

function renderGroupMessages(messages) {
    const listEl = document.getElementById('group-chat-messages-list');
    if (!listEl) return;

    const myEmail = getCurrentEmail();
    listEl.innerHTML = '';

    messages.forEach((msg) => {
        const sender = String(msg.sender_email || 'student@uni.at');
        const isMe = myEmail && sender.toLowerCase() === myEmail;
        const bubble = document.createElement('div');
        bubble.style.cssText = [
            'max-width: 82%',
            `align-self: ${isMe ? 'flex-end' : 'flex-start'}`,
            `background: ${isMe ? 'linear-gradient(135deg, rgba(99,102,241,0.34), rgba(139,92,246,0.28))' : 'rgba(255,255,255,0.06)'}`,
            `border: 1px solid ${isMe ? 'rgba(129,140,248,0.45)' : 'rgba(255,255,255,0.09)'}`,
            'border-radius: 14px',
            'padding: 8px 12px',
            'display: flex',
            'flex-direction: column',
            'gap: 3px'
        ].join(';');

        bubble.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 10px;">
                <strong style="color: ${isMe ? '#a5b4fc' : '#34d399'}; cursor: pointer;" onclick="if(typeof openPublicProfile==='function') openPublicProfile('${escapeHtml(sender)}')">
                    ${escapeHtml(isMe ? 'Du' : getShortName(sender))}
                </strong>
                <span style="color: #94a3b8;">${escapeHtml(formatTimeShort(msg.created_at))}</span>
            </div>
            <div style="font-size: 12px; color: #f8fafc; line-height: 1.4; word-break: break-word;">
                ${escapeHtml(msg.message_text)}
            </div>
        `;
        listEl.appendChild(bubble);
    });

    listEl.scrollTop = listEl.scrollHeight;
}

export async function sendGroupChatMessage() {
    if (!activeGroupId) return;
    const myEmail = getCurrentEmail();
    if (!myEmail) {
        alert('Bitte logge dich ein, um im Gruppenchat zu schreiben.');
        return;
    }

    const inputEl = document.getElementById('group-chat-message-input');
    if (!inputEl) return;

    const text = inputEl.value.trim();
    if (!text) return;

    if (!validateInputOrAlert(text)) return;

    const newMsg = {
        id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        group_id: activeGroupId,
        sender_email: myEmail,
        message_text: text,
        created_at: new Date().toISOString()
    };

    inputEl.value = '';

    const currentMsgs = [...getLocalMessages(activeGroupId), newMsg];
    saveLocalMessages(activeGroupId, currentMsgs);
    renderGroupMessages(currentMsgs);

    if (canUseNetwork()) {
        try {
            const { error } = await _supabase
                .from('lecture_group_messages')
                .insert([newMsg]);
            if (error && isNetworkError(error)) {
                renderOfflineBanner(true);
            }
        } catch (_e) {}
    }
}

function stopGroupRealtimeSync() {
    if (groupPollTimer) {
        clearInterval(groupPollTimer);
        groupPollTimer = null;
    }
    if (groupRealtimeChannel && typeof _supabase.removeChannel === 'function') {
        _supabase.removeChannel(groupRealtimeChannel);
        groupRealtimeChannel = null;
    }
}

function startGroupRealtimeSync(groupId) {
    stopGroupRealtimeSync();

    if (canUseNetwork()) {
        try {
            groupRealtimeChannel = _supabase
                .channel(`lecture-group-${groupId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'lecture_group_messages',
                        filter: `group_id=eq.${groupId}`
                    },
                    (payload) => {
                        const row = payload?.new;
                        if (!row) return;
                        const existing = getLocalMessages(groupId);
                        if (!existing.some((m) => String(m.id) === String(row.id))) {
                            const updated = [...existing, row];
                            saveLocalMessages(groupId, updated);
                            if (String(activeGroupId) === String(groupId)) {
                                renderGroupMessages(updated);
                            }
                        }
                    }
                )
                .subscribe();
        } catch (_e) {}
    }

    groupPollTimer = setInterval(() => {
        if (activeGroupId && String(activeGroupId) === String(groupId)) {
            loadGroupMessages(groupId);
        }
    }, GROUP_POLL_MS);
}

window.injectGroupChatsAccessPoints = injectGroupChatsAccessPoints;
window.openLectureGroupChatsModal = openLectureGroupChatsModal;
window.closeLectureGroupChatsModal = closeLectureGroupChatsModal;
window.toggleCreateGroupChatForm = toggleCreateGroupChatForm;
window.createNewLectureGroup = createNewLectureGroup;
window.loadLectureGroups = loadLectureGroups;
window.filterLectureGroups = filterLectureGroups;
window.setLectureGroupUniFilter = setLectureGroupUniFilter;
window.toggleMyGroupsOnly = toggleMyGroupsOnly;
window.selectLectureGroup = selectLectureGroup;
window.backToLectureGroupsList = backToLectureGroupsList;
window.joinLectureGroup = joinLectureGroup;
window.leaveLectureGroup = leaveLectureGroup;
window.copyLectureGroupInvite = copyLectureGroupInvite;
window.sendGroupChatMessage = sendGroupChatMessage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectGroupChatsAccessPoints();
    });
} else {
    injectGroupChatsAccessPoints();
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modal = document.getElementById('lecture-group-chats-modal');
    if (modal && !modal.classList.contains('hidden')) {
        closeLectureGroupChatsModal();
    }
});

window.addEventListener('resize', () => {
    const modal = document.getElementById('lecture-group-chats-modal');
    if (modal && !modal.classList.contains('hidden')) {
        syncGroupChatResponsiveLayout();
    }
});

document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element
        ? event.target.closest('[data-open-group-chats], [onclick*="openLectureGroupChatsModal"]')
        : null;
    if (trigger) {
        event.preventDefault();
        openLectureGroupChatsModal();
    }
});