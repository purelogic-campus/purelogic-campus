// js/features/polls.js - Umfragen-Feature in Beiträgen und Stories (Punkt 33 • PURE LOGIC)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { renderOfflineBanner, isNetworkError } from '../network.js';

const LOCAL_POLLS_KEY = 'pure_logic_campus_polls_v1';
const LOCAL_VOTES_KEY = 'pure_logic_campus_poll_votes_v1';

const DEFAULT_SAMPLE_POLLS = [
    {
        id: 'poll-default-1',
        context_type: 'post',
        target_id: 'feed-general',
        question: 'Wo starten wir heute die Lernsession vor den Prüfungen?',
        options: [
            { id: 'opt-1', text: 'Hauptbibliothek / Lesesaal' },
            { id: 'opt-2', text: 'Campus-Café mit Kaffee' },
            { id: 'opt-3', text: 'Online / Discord Lerngruppe' }
        ],
        creator_email: 'office@pure-logic.at',
        created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
        id: 'poll-default-2',
        context_type: 'story',
        target_id: 'story-general',
        question: 'Story-Check: Welches Thema soll im nächsten Campus-Reel kommen?',
        options: [
            { id: 'opt-a', text: 'Survival-Tipps für Erstsemestrige' },
            { id: 'opt-b', text: 'Günstige Mensa- & Spot-Geheimtipps' },
            { id: 'opt-c', text: 'Lern-Hacks & Zeitplan-Routinen' }
        ],
        creator_email: 'office@pure-logic.at',
        created_at: new Date(Date.now() - 3600000).toISOString()
    }
];

let pollsCache = [];
let votesMap = {};
let activeCreateContext = 'post';
let activeCreateTargetId = 'feed-general';
let pollRealtimeChannel = null;

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
    if (!email) return 'Campus';
    return String(email).split('@')[0];
}

function getLocalPolls() {
    try {
        const raw = localStorage.getItem(LOCAL_POLLS_KEY);
        if (!raw) {
            localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(DEFAULT_SAMPLE_POLLS));
            return [...DEFAULT_SAMPLE_POLLS];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_SAMPLE_POLLS];
    } catch (_e) {
        return [...DEFAULT_SAMPLE_POLLS];
    }
}

function saveLocalPolls(polls) {
    try {
        localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(polls));
    } catch (_e) {}
}

function getLocalVotes() {
    try {
        const raw = localStorage.getItem(LOCAL_VOTES_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
        return {};
    }
}

function saveLocalVotes(map) {
    try {
        localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(map));
    } catch (_e) {}
}

function getPollResults(pollId) {
    const pollVotes = votesMap[pollId] && typeof votesMap[pollId] === 'object' ? votesMap[pollId] : {};
    const countsByOption = {};
    let totalVotes = 0;

    Object.values(pollVotes).forEach((optionId) => {
        if (!optionId) return;
        countsByOption[optionId] = (countsByOption[optionId] || 0) + 1;
        totalVotes += 1;
    });

    const myEmail = getCurrentEmail();
    const myChoice = myEmail ? (pollVotes[myEmail] || null) : (pollVotes['__guest__'] || null);

    return { countsByOption, totalVotes, myChoice };
}

function ensureCreatePollModal() {
    let modal = document.getElementById('campus-poll-create-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'campus-poll-create-modal';
    modal.className = 'hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Neue Umfrage erstellen');
    modal.style.cssText = [
        'position: fixed',
        'inset: 0',
        'z-index: 10045',
        'background: rgba(7, 11, 20, 0.9)',
        'backdrop-filter: blur(8px)',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 14px',
        'box-sizing: border-box'
    ].join(';');

    modal.innerHTML = `
        <div style="width: 100%; max-width: 460px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 18px; padding: 18px; color: #f8fafc; box-shadow: 0 24px 60px rgba(0,0,0,0.75);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px;">
                <div>
                    <h3 id="poll-modal-heading" style="margin: 0; font-size: 16px; font-weight: 900; color: #f8fafc;">📊 Neue Umfrage erstellen</h3>
                    <div id="poll-modal-subtext" style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Für Beiträge & Stories</div>
                </div>
                <button type="button" onclick="closeCreatePollModal()" aria-label="Umfrage-Dialog schließen" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #fff; width: 32px; height: 32px; border-radius: 10px; font-size: 18px; line-height: 1; cursor: pointer;">×</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label for="poll-context-select" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Bereich:</label>
                <select id="poll-context-select" style="padding: 9px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: #1e293b; color: #fff; font-size: 12px;">
                    <option value="post">📝 Beitrag / Feed</option>
                    <option value="story">⚡ Story</option>
                </select>

                <label for="poll-question-input" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Frage *</label>
                <input type="text" id="poll-question-input" placeholder="z. B. Wann passt die Lernrunde am besten?" style="padding: 9px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">

                <div id="poll-options-inputs" style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px;">
                    <input type="text" class="poll-option-field" placeholder="Antwortoption 1 *" style="padding: 8px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <input type="text" class="poll-option-field" placeholder="Antwortoption 2 *" style="padding: 8px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <input type="text" class="poll-option-field" placeholder="Antwortoption 3 (optional)" style="padding: 8px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                    <input type="text" class="poll-option-field" placeholder="Antwortoption 4 (optional)" style="padding: 8px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;">
                </div>

                <button type="button" onclick="addPollOptionInput()" style="align-self: flex-start; background: rgba(99, 102, 241, 0.16); border: 1px solid rgba(129, 140, 248, 0.35); color: #c7d2fe; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; cursor: pointer; margin-top: 2px;">
                    + Weitere Option
                </button>

                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button type="button" onclick="submitNewPoll()" style="flex: 1; background: linear-gradient(135deg, #6366f1, #ec4899); border: none; color: #fff; font-size: 12px; font-weight: 900; padding: 10px 14px; border-radius: 10px; cursor: pointer;">
                        Umfrage veröffentlichen 📊
                    </button>
                    <button type="button" onclick="closeCreatePollModal()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 10px 12px; border-radius: 10px; cursor: pointer;">
                        Abbrechen
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeCreatePollModal();
        }
    });

    document.body.appendChild(modal);
    return modal;
}

export function addPollOptionInput() {
    const container = document.getElementById('poll-options-inputs');
    if (!container) return;
    const count = container.querySelectorAll('.poll-option-field').length;
    if (count >= 6) {
        alert('Maximal 6 Antwortoptionen pro Umfrage möglich.');
        return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option-field';
    input.placeholder = `Antwortoption ${count + 1} (optional)`;
    input.style.cssText = 'padding: 8px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15,23,42,0.85); color: #fff; font-size: 12px;';
    container.appendChild(input);
    input.focus();
}

export function openCreatePollModal(contextType = 'post', targetId = null) {
    activeCreateContext = contextType === 'story' ? 'story' : 'post';
    activeCreateTargetId = targetId || (activeCreateContext === 'story' ? 'story-general' : 'feed-general');

    const modal = ensureCreatePollModal();
    modal.classList.remove('hidden');

    const contextSelect = document.getElementById('poll-context-select');
    const subtext = document.getElementById('poll-modal-subtext');
    if (contextSelect) contextSelect.value = activeCreateContext;
    if (subtext) {
        subtext.textContent = activeCreateContext === 'story'
            ? 'Erscheint direkt im Story-Umfragen-Bereich'
            : 'Erscheint direkt im Beitrags-Umfragen-Bereich';
    }

    const qInput = document.getElementById('poll-question-input');
    if (qInput) {
        qInput.value = '';
        qInput.focus();
    }
    modal.querySelectorAll('.poll-option-field').forEach((field) => {
        field.value = '';
    });
}

export function closeCreatePollModal() {
    const modal = document.getElementById('campus-poll-create-modal');
    if (modal) modal.classList.add('hidden');
}

export async function submitNewPoll() {
    const myEmail = getCurrentEmail();
    if (!myEmail) {
        alert('Bitte logge dich zuerst ein, um eine Umfrage zu erstellen.');
        return;
    }

    const contextSelect = document.getElementById('poll-context-select');
    const qInput = document.getElementById('poll-question-input');
    const optionInputs = Array.from(document.querySelectorAll('#campus-poll-create-modal .poll-option-field'));

    const contextType = contextSelect?.value === 'story' ? 'story' : 'post';
    const question = (qInput?.value || '').trim();
    const rawOptions = optionInputs
        .map((el) => (el.value || '').trim())
        .filter(Boolean);

    if (!question) {
        alert('Bitte gib eine Umfragefrage ein.');
        return;
    }
    if (rawOptions.length < 2) {
        alert('Bitte gib mindestens zwei Antwortoptionen an.');
        return;
    }

    if (!validateInputOrAlert(question)) return;
    for (const optText of rawOptions) {
        if (!validateInputOrAlert(optText)) return;
    }

    const newPoll = {
        id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `poll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        context_type: contextType,
        target_id: activeCreateTargetId || (contextType === 'story' ? 'story-general' : 'feed-general'),
        question,
        options: rawOptions.map((text, idx) => ({
            id: `opt_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
            text
        })),
        creator_email: myEmail,
        created_at: new Date().toISOString()
    };

    if (canUseNetwork()) {
        try {
            const { error } = await _supabase
                .from('campus_polls')
                .insert([newPoll]);
            if (error && isNetworkError(error)) {
                renderOfflineBanner(true);
            }
        } catch (_e) {}
    }

    pollsCache = [newPoll, ...pollsCache];
    saveLocalPolls(pollsCache);
    closeCreatePollModal();
    renderAllPollWidgets();
}

export async function voteInPoll(pollId, optionId) {
    if (!pollId || !optionId) return;
    const myEmail = getCurrentEmail();
    if (!myEmail) {
        alert('Bitte logge dich ein, um bei Umfragen abzustimmen.');
        return;
    }

    if (!votesMap[pollId] || typeof votesMap[pollId] !== 'object') {
        votesMap[pollId] = {};
    }
    votesMap[pollId][myEmail] = optionId;
    saveLocalVotes(votesMap);
    renderAllPollWidgets();

    if (canUseNetwork()) {
        try {
            const voteRow = {
                poll_id: pollId,
                voter_email: myEmail,
                option_id: optionId,
                updated_at: new Date().toISOString()
            };
            const { error } = await _supabase
                .from('campus_poll_votes')
                .upsert([voteRow], { onConflict: 'poll_id,voter_email' });
            if (error && isNetworkError(error)) {
                renderOfflineBanner(true);
            }
        } catch (_e) {}
    }
}

function buildPollCardHtml(poll) {
    const options = Array.isArray(poll.options) ? poll.options : [];
    const { countsByOption, totalVotes, myChoice } = getPollResults(poll.id);
    const badgeLabel = poll.context_type === 'story' ? '⚡ Story-Umfrage' : '📝 Beitrags-Umfrage';

    const optionsHtml = options.map((opt) => {
        const count = countsByOption[opt.id] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isPicked = myChoice === opt.id;

        return `
            <button type="button" onclick="voteInPoll('${escapeHtml(poll.id)}', '${escapeHtml(opt.id)}')" style="position: relative; overflow: hidden; width: 100%; text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid ${isPicked ? 'rgba(129, 140, 248, 0.85)' : 'rgba(148, 163, 184, 0.22)'}; background: rgba(15, 23, 42, 0.72); color: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px;">
                <span style="position: absolute; inset: 0 auto 0 0; width: ${pct}%; background: ${isPicked ? 'rgba(99, 102, 241, 0.34)' : 'rgba(148, 163, 184, 0.14)'}; pointer-events: none; transition: width 0.25s ease;"></span>
                <span style="position: relative; z-index: 1; font-weight: ${isPicked ? '800' : '600'};">
                    ${isPicked ? '✓ ' : ''}${escapeHtml(opt.text)}
                </span>
                <span style="position: relative; z-index: 1; font-size: 11px; font-weight: 800; color: ${isPicked ? '#c7d2fe' : '#cbd5e1'}; white-space: nowrap;">
                    ${pct}% (${count})
                </span>
            </button>
        `;
    }).join('');

    return `
        <div style="background: rgba(19, 27, 46, 0.88); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 10px; color: #94a3b8;">
                <span style="background: rgba(99, 102, 241, 0.18); color: #a5b4fc; font-weight: 800; padding: 2px 8px; border-radius: 999px;">
                    ${badgeLabel}
                </span>
                <span>von ${escapeHtml(getShortName(poll.creator_email))} • ${totalVotes} ${totalVotes === 1 ? 'Stimme' : 'Stimmen'}</span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #f8fafc; line-height: 1.35;">
                ${escapeHtml(poll.question)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${optionsHtml}
            </div>
        </div>
    `;
}

function renderPollsIntoContainer(container, contextType) {
    if (!container) return;
    const matching = pollsCache.filter((p) => p.context_type === contextType);
    const label = contextType === 'story' ? 'Story-Umfragen' : 'Beitrags-Umfragen';
    const ctxArg = contextType === 'story' ? 'story' : 'post';

    const headerHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 900; color: #e2e8f0;">📊 ${label}</span>
            <button type="button" onclick="openCreatePollModal('${ctxArg}')" style="background: linear-gradient(135deg, #6366f1, #ec4899); border: none; color: #fff; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 8px; cursor: pointer;">
                + Umfrage
            </button>
        </div>
    `;

    const bodyHtml = matching.length > 0
        ? `<div style="display: flex; flex-direction: column; gap: 8px;">${matching.map(buildPollCardHtml).join('')}</div>`
        : `<div style="font-size: 11px; color: #94a3b8; padding: 8px 4px;">Noch keine ${label} vorhanden. Starte die erste!</div>`;

    container.innerHTML = headerHtml + bodyHtml;
}

export function injectPollWidgets() {
    if (typeof document === 'undefined' || !document.body) return;

    const reelsTab = document.getElementById('tab-reels');
    if (reelsTab && !document.getElementById('campus-story-polls-box')) {
        const storyBox = document.createElement('div');
        storyBox.id = 'campus-story-polls-box';
        storyBox.style.cssText = 'margin: 0 12px 10px 12px; padding: 10px 12px; border-radius: 14px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16); flex-shrink: 0;';
        reelsTab.appendChild(storyBox);
    }

    const feedTab = document.getElementById('tab-feed');
    if (feedTab && !document.getElementById('campus-post-polls-box')) {
        const postBox = document.createElement('div');
        postBox.id = 'campus-post-polls-box';
        postBox.style.cssText = 'margin: 8px 0 12px 0; padding: 10px 12px; border-radius: 14px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16); flex-shrink: 0;';
        const feedList = document.getElementById('feed-list');
        if (feedList && feedList.parentElement === feedTab) {
            feedTab.insertBefore(postBox, feedList);
        } else {
            feedTab.appendChild(postBox);
        }
    }
}

export function renderAllPollWidgets() {
    injectPollWidgets();
    renderPollsIntoContainer(document.getElementById('campus-story-polls-box'), 'story');
    renderPollsIntoContainer(document.getElementById('campus-post-polls-box'), 'post');
}

export async function loadCampusPolls() {
    pollsCache = getLocalPolls();
    votesMap = getLocalVotes();
    renderAllPollWidgets();

    if (!canUseNetwork()) return;

    try {
        const { data: pollsData, error: pollsError } = await _supabase
            .from('campus_polls')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!pollsError && Array.isArray(pollsData) && pollsData.length > 0) {
            pollsCache = pollsData.map((row) => ({
                ...row,
                context_type: row.context_type === 'story' ? 'story' : 'post',
                options: Array.isArray(row.options) ? row.options : []
            }));
            saveLocalPolls(pollsCache);
        }

        const { data: votesData, error: votesError } = await _supabase
            .from('campus_poll_votes')
            .select('poll_id, voter_email, option_id')
            .limit(500);

        if (!votesError && Array.isArray(votesData)) {
            const merged = { ...votesMap };
            votesData.forEach((v) => {
                if (!v?.poll_id || !v?.voter_email || !v?.option_id) return;
                if (!merged[v.poll_id]) merged[v.poll_id] = {};
                merged[v.poll_id][String(v.voter_email).toLowerCase()] = v.option_id;
            });
            votesMap = merged;
            saveLocalVotes(votesMap);
        }
    } catch (err) {
        if (isNetworkError(err)) renderOfflineBanner(true);
    }

    renderAllPollWidgets();
}

function startPollRealtimeSync() {
    if (!canUseNetwork() || typeof _supabase?.channel !== 'function') return;
    if (pollRealtimeChannel) return;

    try {
        pollRealtimeChannel = _supabase
            .channel('campus-polls-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'campus_polls' },
                () => {
                    loadCampusPolls();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'campus_poll_votes' },
                () => {
                    loadCampusPolls();
                }
            )
            .subscribe();
    } catch (_e) {}
}

window.openCreatePollModal = openCreatePollModal;
window.closeCreatePollModal = closeCreatePollModal;
window.addPollOptionInput = addPollOptionInput;
window.submitNewPoll = submitNewPoll;
window.voteInPoll = voteInPoll;
window.loadCampusPolls = loadCampusPolls;
window.injectPollWidgets = injectPollWidgets;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadCampusPolls();
        startPollRealtimeSync();
    });
} else {
    loadCampusPolls();
    startPollRealtimeSync();
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modal = document.getElementById('campus-poll-create-modal');
    if (modal && !modal.classList.contains('hidden')) {
        closeCreatePollModal();
    }
});