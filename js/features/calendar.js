// js/features/calendar.js - Integrierter Event-Kalender für Campus-Partys & Vorlesungen
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

const LOCAL_STORAGE_EVENTS_KEY = 'pure_logic_campus_events_v1';
const LOCAL_STORAGE_RSVP_KEY = 'pure_logic_campus_event_rsvps_v1';

const EVENT_CATEGORIES = [
    { key: 'Alle', label: 'Alle Events' },
    { key: 'Campus-Party', label: '🎉 Campus-Party' },
    { key: 'Vorlesung', label: '🎓 Vorlesung' },
    { key: 'Lerngruppe', label: '📚 Lerngruppe' },
    { key: 'Treffen', label: '🍻 Campus-Treff' }
];

let cachedEvents = [];
let activeCategoryFilter = 'Alle';
let activeUniFilter = 'Alle';
let selectedDateKey = '';
let calendarMonthCursor = new Date();
calendarMonthCursor.setDate(1);
calendarMonthCursor.setHours(0, 0, 0, 0);

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function toLocalDateKey(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatGermanDateTime(isoStr) {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return 'Datum offen';
    return d.toLocaleString('de-AT', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCategoryBadgeStyle(category) {
    switch (category) {
        case 'Campus-Party':
            return 'campus-badge accent';
        case 'Vorlesung':
            return 'campus-badge success';
        case 'Lerngruppe':
            return 'campus-badge warning';
        default:
            return 'campus-badge';
    }
}

function getCategoryEmoji(category) {
    switch (category) {
        case 'Campus-Party': return '🎉';
        case 'Vorlesung': return '🎓';
        case 'Lerngruppe': return '📚';
        case 'Treffen': return '🍻';
        default: return '📅';
    }
}

function readLocalEvents() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function writeLocalEvents(events) {
    try {
        localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(events.slice(0, 150)));
    } catch (e) {}
}

function readLocalRsvps() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_RSVP_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

function writeLocalRsvps(rsvps) {
    try {
        localStorage.setItem(LOCAL_STORAGE_RSVP_KEY, JSON.stringify(rsvps));
    } catch (e) {}
}

function getDefaultStarterEvents() {
    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    inTwoDays.setHours(10, 0, 0, 0);

    const inFourDays = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    inFourDays.setHours(20, 30, 0, 0);

    return [
        {
            id: 'starter-vorlesung-1',
            title: 'Algorithmen & Datenstrukturen – Übungsbesprechung',
            category: 'Vorlesung',
            university: 'TU Wien',
            location: 'HS 1 / Campus Gußhaus',
            start_time: inTwoDays.toISOString(),
            description: 'Gemeinsame Vorbereitung auf das nächste Übungsblatt & Tipps aus den letzten Semestern.',
            creator_email: 'campus@pure-logic.at',
            attendees_count: 14
        },
        {
            id: 'starter-party-1',
            title: 'Semester-Warmup & Beats am Campus',
            category: 'Campus-Party',
            university: 'Universität Wien',
            location: 'Arkadenhof / Schottentor',
            start_time: inFourDays.toISOString(),
            description: 'Lockerer Abend zum Netzwerken, Quatschen und Feiern mit Studis aller Wiener Unis.',
            creator_email: 'events@pure-logic.at',
            attendees_count: 38
        }
    ];
}

export function ensureCalendarViewInDom() {
    const wrapper = document.querySelector('.tab-content-wrapper');
    if (!wrapper) return null;

    let tab = document.getElementById('tab-calendar');
    if (tab) return tab;

    tab = document.createElement('div');
    tab.id = 'tab-calendar';
    tab.className = 'tab-content hidden';
    tab.innerHTML = `
        <div class="campus-calendar-shell">
            <div class="campus-calendar-topbar">
                <div>
                    <h3 class="campus-calendar-heading">📅 Campus-Event-Kalender</h3>
                    <p class="campus-calendar-sub">Vorlesungen, Lerngruppen & Campus-Partys in Wien</p>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" class="btn btn-sm" id="toggle-create-event-btn" onclick="window.toggleEventCreateForm()">+ Event</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.loadCampusEvents(true)">↻</button>
                </div>
            </div>

            <form id="campus-event-create-form" class="container-box campus-event-form hidden" onsubmit="event.preventDefault(); window.submitCampusEvent();">
                <div class="campus-card-header" style="margin-bottom: 8px;">
                    <span class="campus-card-title">✨ Neues Campus-Event erstellen</span>
                    <button type="button" class="footer-link-btn" onclick="window.toggleEventCreateForm(false)">Schließen ✕</button>
                </div>

                <label for="cal-event-title" class="campus-field-label">Titel:</label>
                <input type="text" id="cal-event-title" placeholder="z. B. Semester-Opening Party oder VO Einführung BWL" required>

                <div class="campus-form-grid-2">
                    <div>
                        <label for="cal-event-category" class="campus-field-label">Kategorie:</label>
                        <select id="cal-event-category">
                            <option value="Campus-Party">🎉 Campus-Party</option>
                            <option value="Vorlesung">🎓 Vorlesung</option>
                            <option value="Lerngruppe">📚 Lerngruppe</option>
                            <option value="Treffen">🍻 Campus-Treff</option>
                        </select>
                    </div>
                    <div>
                        <label for="cal-event-uni" class="campus-field-label">Universität / Ort-Typ:</label>
                        <select id="cal-event-uni">
                            <option value="Alle Unis">Alle Wiener Unis</option>
                            <option value="Universität Wien">Universität Wien</option>
                            <option value="TU Wien">TU Wien</option>
                            <option value="Wirtschaftsuniversität Wien (WU)">WU Wien</option>
                            <option value="MedUni Wien">MedUni Wien</option>
                            <option value="BOKU Wien">BOKU Wien</option>
                            <option value="FH Wien">FH Wien</option>
                        </select>
                    </div>
                </div>

                <div class="campus-form-grid-2">
                    <div>
                        <label for="cal-event-datetime" class="campus-field-label">Datum & Uhrzeit:</label>
                        <input type="datetime-local" id="cal-event-datetime" required>
                    </div>
                    <div>
                        <label for="cal-event-location" class="campus-field-label">Ort / Hörsaal / Location:</label>
                        <input type="text" id="cal-event-location" placeholder="z. B. Audimax, Hörsaal 3, Club...">
                    </div>
                </div>

                <label for="cal-event-desc" class="campus-field-label">Beschreibung & Infos:</label>
                <textarea id="cal-event-desc" rows="2" placeholder="Uhrzeit-Details, Raumnummer, Dresscode oder Skript-Infos..."></textarea>

                <button type="submit" class="btn" style="margin-top: 2px;">Event im Kalender veröffentlichen 🚀</button>
            </form>

            <div class="container-box campus-month-card">
                <div class="campus-month-header">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.shiftCalendarMonth(-1)" aria-label="Vorheriger Monat">◀</button>
                    <div style="text-align: center;">
                        <div id="calendar-month-title" class="campus-month-title">Monat</div>
                        <button type="button" id="calendar-clear-day-btn" class="footer-link-btn hidden" onclick="window.clearSelectedCalendarDay()">Tagesfilter aufheben ✕</button>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.shiftCalendarMonth(1)" aria-label="Nächster Monat">▶</button>
                </div>

                <div class="campus-weekdays-grid" aria-hidden="true">
                    <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
                </div>
                <div id="calendar-days-grid" class="campus-days-grid"></div>
            </div>

            <div class="category-group" id="calendar-category-filters" style="margin-bottom: 6px;"></div>

            <div class="campus-uni-filter-row">
                <label for="calendar-uni-filter" class="campus-field-label" style="margin: 0;">Uni:</label>
                <select id="calendar-uni-filter" onchange="window.setCalendarUniFilter(this.value)" style="margin: 0; padding: 6px 10px; font-size: 11px;">
                    <option value="Alle">Alle Hochschulen</option>
                    <option value="Universität Wien">Universität Wien</option>
                    <option value="TU Wien">TU Wien</option>
                    <option value="Wirtschaftsuniversität Wien (WU)">WU Wien</option>
                    <option value="MedUni Wien">MedUni Wien</option>
                    <option value="BOKU Wien">BOKU Wien</option>
                    <option value="FH Wien">FH Wien</option>
                </select>
            </div>

            <div id="campus-events-list" class="section-stack" style="padding-bottom: 18px;">
                <p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 16px;">Lade Campus-Events...</p>
            </div>
        </div>
    `;

    wrapper.appendChild(tab);
    renderCategoryPills();
    return tab;
}

function renderCategoryPills() {
    const container = document.getElementById('calendar-category-filters');
    if (!container) return;

    container.innerHTML = '';
    EVENT_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cat-pill ${activeCategoryFilter === cat.key ? 'active' : ''}`;
        btn.textContent = cat.label;
        btn.onclick = () => {
            activeCategoryFilter = cat.key;
            renderCategoryPills();
            renderCalendarAndEvents();
        };
        container.appendChild(btn);
    });
}

function getFilteredEvents() {
    return cachedEvents
        .filter(ev => {
            if (activeCategoryFilter !== 'Alle' && ev.category !== activeCategoryFilter) {
                return false;
            }
            if (activeUniFilter !== 'Alle') {
                const evUni = String(ev.university || '').toLowerCase();
                if (!evUni.includes(activeUniFilter.toLowerCase()) && evUni !== 'alle unis') {
                    return false;
                }
            }
            if (selectedDateKey) {
                if (toLocalDateKey(ev.start_time) !== selectedDateKey) {
                    return false;
                }
            }
            return true;
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

function renderMonthGrid() {
    const titleEl = document.getElementById('calendar-month-title');
    const gridEl = document.getElementById('calendar-days-grid');
    const clearDayBtn = document.getElementById('calendar-clear-day-btn');
    if (!titleEl || !gridEl) return;

    titleEl.textContent = calendarMonthCursor.toLocaleDateString('de-AT', {
        month: 'long',
        year: 'numeric'
    });

    if (clearDayBtn) {
        clearDayBtn.classList.toggle('hidden', !selectedDateKey);
    }

    const year = calendarMonthCursor.getFullYear();
    const month = calendarMonthCursor.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const eventCountByDay = {};
    cachedEvents.forEach(ev => {
        if (activeCategoryFilter !== 'Alle' && ev.category !== activeCategoryFilter) return;
        const key = toLocalDateKey(ev.start_time);
        if (key) {
            eventCountByDay[key] = (eventCountByDay[key] || 0) + 1;
        }
    });

    const todayKey = toLocalDateKey(new Date());
    gridEl.innerHTML = '';

    for (let i = 0; i < startOffset; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'campus-day-cell is-empty';
        gridEl.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const key = toLocalDateKey(dateObj);
        const count = eventCountByDay[key] || 0;
        const isSelected = selectedDateKey === key;
        const isToday = todayKey === key;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = [
            'campus-day-cell',
            isToday ? 'is-today' : '',
            isSelected ? 'is-selected' : '',
            count > 0 ? 'has-events' : ''
        ].filter(Boolean).join(' ');

        btn.innerHTML = `
            <span>${day}</span>
            ${count > 0 ? `<span class="campus-day-dot">${count}</span>` : ''}
        `;

        btn.onclick = () => {
            selectedDateKey = selectedDateKey === key ? '' : key;
            renderCalendarAndEvents();
        };

        gridEl.appendChild(btn);
    }
}

function renderEventsList() {
    const listEl = document.getElementById('campus-events-list');
    if (!listEl) return;

    const rsvps = readLocalRsvps();
    const userKey = (state.currentUserEmail || 'guest').toLowerCase();
    const events = getFilteredEvents();

    if (events.length === 0) {
        listEl.innerHTML = `
            <div class="container-box" style="text-align: center; padding: 18px;">
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                    ${selectedDateKey
                        ? `Keine Events am ${escapeHtml(selectedDateKey)} für diesen Filter gefunden.`
                        : 'Keine passenden Campus-Events in dieser Auswahl.'}
                </p>
                <button type="button" class="btn btn-sm" onclick="window.toggleEventCreateForm(true)">+ Erstes Event anlegen</button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    events.forEach(ev => {
        const eventId = String(ev.id);
        const myRsvps = Array.isArray(rsvps[userKey]) ? rsvps[userKey] : [];
        const isGoing = myRsvps.includes(eventId);
        const baseCount = Number(ev.attendees_count) || 0;
        const displayCount = Math.max(0, baseCount + (isGoing ? 1 : 0));

        const card = document.createElement('div');
        card.className = 'campus-card';
        card.innerHTML = `
            <div class="campus-card-header">
                <span class="${getCategoryBadgeStyle(ev.category)}">${getCategoryEmoji(ev.category)} ${escapeHtml(ev.category || 'Event')}</span>
                <span class="campus-card-meta">🕒 ${escapeHtml(formatGermanDateTime(ev.start_time))}</span>
            </div>
            <h4 class="campus-card-title" style="margin-bottom: 4px;">${escapeHtml(ev.title)}</h4>
            <div class="campus-card-meta" style="margin-bottom: 6px;">
                🏛️ ${escapeHtml(ev.university || 'Alle Wiener Unis')}${ev.location ? ` • 📍 ${escapeHtml(ev.location)}` : ''}
            </div>
            ${ev.description ? `<p class="campus-card-meta" style="color: var(--text); margin-bottom: 8px; line-height: 1.4;">${escapeHtml(ev.description)}</p>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 8px;">
                <span class="campus-card-meta" style="font-weight: 700;">👥 ${displayCount} dabei</span>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-sm ${isGoing ? 'btn-secondary' : ''}" onclick="window.toggleEventRsvp('${escapeAttr(eventId)}')">
                        ${isGoing ? '✓ Zusage aktiv' : '✋ Bin dabei'}
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.downloadEventIcs('${escapeAttr(eventId)}')" title="In Kalender exportieren (.ics)">
                        📆 .ics
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function renderCalendarAndEvents() {
    renderMonthGrid();
    renderEventsList();
}

export async function loadCampusEvents(forceRefresh = false) {
    ensureCalendarViewInDom();

    let remoteEvents = [];
    try {
        const { data, error } = await _supabase
            .from('campus_events')
            .select('*')
            .order('start_time', { ascending: true })
            .limit(100);

        if (!error && Array.isArray(data)) {
            remoteEvents = data;
        }
    } catch (e) {}

    const localEvents = readLocalEvents();
    const mergedMap = new Map();

    if (!forceRefresh || remoteEvents.length === 0) {
        getDefaultStarterEvents().forEach(ev => mergedMap.set(String(ev.id), ev));
    }

    localEvents.forEach(ev => {
        if (ev && ev.id) mergedMap.set(String(ev.id), ev);
    });

    remoteEvents.forEach(ev => {
        if (ev && ev.id) mergedMap.set(String(ev.id), ev);
    });

    cachedEvents = Array.from(mergedMap.values());
    renderCalendarAndEvents();
}

export function openCampusCalendar() {
    ensureCalendarViewInDom();
    if (typeof window.switchTab === 'function') {
        window.switchTab('calendar');
    } else {
        document.querySelectorAll('.tab-content').forEach(el => {
            if (!el.id.includes('modal') && el.id !== 'auth-gate' && el.id !== 'main-app') {
                el.classList.add('hidden');
            }
        });
        document.getElementById('tab-calendar')?.classList.remove('hidden');
    }
    loadCampusEvents();
}

export function toggleEventCreateForm(forceState = null) {
    ensureCalendarViewInDom();
    const form = document.getElementById('campus-event-create-form');
    if (!form) return;

    const shouldOpen = typeof forceState === 'boolean' ? forceState : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);

    if (shouldOpen) {
        const dtInput = document.getElementById('cal-event-datetime');
        if (dtInput && !dtInput.value) {
            const base = selectedDateKey ? new Date(`${selectedDateKey}T18:00`) : new Date(Date.now() + 3600 * 1000);
            const pad = n => String(n).padStart(2, '0');
            dtInput.value = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
        }
        document.getElementById('cal-event-title')?.focus();
    }
}

export async function submitCampusEvent() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um ein Campus-Event einzutragen.');
        return;
    }

    const title = document.getElementById('cal-event-title')?.value.trim() || '';
    const category = document.getElementById('cal-event-category')?.value || 'Campus-Party';
    const university = document.getElementById('cal-event-uni')?.value || 'Alle Wiener Unis';
    const dateTimeRaw = document.getElementById('cal-event-datetime')?.value || '';
    const location = document.getElementById('cal-event-location')?.value.trim() || '';
    const description = document.getElementById('cal-event-desc')?.value.trim() || '';

    if (!title || !dateTimeRaw) {
        alert('Bitte Titel sowie Datum und Uhrzeit angeben.');
        return;
    }

    const parsedDate = new Date(dateTimeRaw);
    if (Number.isNaN(parsedDate.getTime())) {
        alert('Bitte ein gültiges Datum und eine gültige Uhrzeit wählen.');
        return;
    }

    if (!validateInputOrAlert(`${title} ${location} ${description}`)) {
        return;
    }

    const newEvent = {
        id: crypto.randomUUID ? crypto.randomUUID() : `ev_${Date.now()}`,
        title,
        category,
        university,
        location,
        start_time: parsedDate.toISOString(),
        description,
        creator_email: state.currentUserEmail,
        attendees_count: 1,
        created_at: new Date().toISOString()
    };

    try {
        await _supabase.from('campus_events').insert([newEvent]);
    } catch (e) {}

    const localEvents = readLocalEvents();
    localEvents.unshift(newEvent);
    writeLocalEvents(localEvents);

    cachedEvents.unshift(newEvent);
    calendarMonthCursor = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
    selectedDateKey = toLocalDateKey(parsedDate);

    ['cal-event-title', 'cal-event-location', 'cal-event-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    toggleEventCreateForm(false);
    renderCalendarAndEvents();
    alert('Campus-Event wurde im Kalender eingetragen! 📅');
}

export function toggleEventRsvp(eventId) {
    const userKey = (state.currentUserEmail || 'guest').toLowerCase();
    const rsvps = readLocalRsvps();
    const currentList = Array.isArray(rsvps[userKey]) ? [...rsvps[userKey]] : [];
    const idx = currentList.indexOf(String(eventId));

    if (idx >= 0) {
        currentList.splice(idx, 1);
    } else {
        currentList.push(String(eventId));
    }

    rsvps[userKey] = currentList;
    writeLocalRsvps(rsvps);
    renderEventsList();
}

export function downloadEventIcs(eventId) {
    const ev = cachedEvents.find(item => String(item.id) === String(eventId));
    if (!ev) return;

    const start = new Date(ev.start_time);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmtUtc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const escapeIcs = text => String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PURE LOGIC//Campus Event Calendar//DE',
        'BEGIN:VEVENT',
        `UID:${escapeIcs(ev.id)}@pure-logic.at`,
        `DTSTAMP:${fmtUtc(new Date())}`,
        `DTSTART:${fmtUtc(start)}`,
        `DTEND:${fmtUtc(end)}`,
        `SUMMARY:${escapeIcs(ev.title)}`,
        `LOCATION:${escapeIcs(ev.location || ev.university || 'Wien')}`,
        `DESCRIPTION:${escapeIcs(`${ev.category || ''} - ${ev.description || ''}`)}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(ev.title || 'campus-event').toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function shiftCalendarMonth(deltaMonths) {
    calendarMonthCursor = new Date(
        calendarMonthCursor.getFullYear(),
        calendarMonthCursor.getMonth() + Number(deltaMonths || 0),
        1
    );
    renderMonthGrid();
}

export function clearSelectedCalendarDay() {
    selectedDateKey = '';
    renderCalendarAndEvents();
}

export function setCalendarUniFilter(uni) {
    activeUniFilter = uni || 'Alle';
    renderCalendarAndEvents();
}

window.openCampusCalendar = openCampusCalendar;
window.loadCampusEvents = loadCampusEvents;
window.toggleEventCreateForm = toggleEventCreateForm;
window.submitCampusEvent = submitCampusEvent;
window.toggleEventRsvp = toggleEventRsvp;
window.downloadEventIcs = downloadEventIcs;
window.shiftCalendarMonth = shiftCalendarMonth;
window.clearSelectedCalendarDay = clearSelectedCalendarDay;
window.setCalendarUniFilter = setCalendarUniFilter;