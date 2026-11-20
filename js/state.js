// js/state.js - Zentrales App-State-Management & Theme-Persistenz (4 Modes: dark, light-dark, soft-light, light)

export const THEME_STORAGE_KEY = 'pure_logic_theme';
export const THEME_MODES = ['dark', 'light-dark', 'soft-light', 'light'];

const THEME_META = {
    'dark': {
        icon: '🌑',
        label: 'Dark',
        statusColor: '#1a0512',
        isLight: false
    },
    'light-dark': {
        icon: '🌒',
        label: 'Light Dark',
        statusColor: '#121b2e',
        isLight: false
    },
    'soft-light': {
        icon: '🌤️',
        label: 'Soft Light',
        statusColor: '#1e2d4a',
        isLight: false
    },
    'light': {
        icon: '☀️',
        label: 'Light',
        statusColor: '#eef2f6',
        isLight: true
    }
};

function normalizeTheme(theme) {
    if (theme === 'strong-light') {
        return 'soft-light';
    }
    return THEME_MODES.includes(theme) ? theme : 'dark';
}

function getInitialTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved) {
            return normalizeTheme(saved);
        }
    } catch (e) {
        console.warn('Theme konnte nicht aus localStorage gelesen werden:', e);
    }
    return 'dark';
}

export const state = {
    currentUserEmail: null,
    currentLanguage: 'de',
    currentReelFilter: 'foryou',
    currentFilter: 'Alle',
    currentLiveFilter: 'Alle',
    currentTheme: getInitialTheme(),
    isAdminUser: false,
    userPoints: 0,
    activeDrop: null,
    activeDropId: null,
    leafletMap: null,
    leafletMarker: null,
    activeLiveStream: null,
    liveChatChannel: null,
    liveStreamTimer: null,
    liveStreamStartTime: null,
    liveWarningShown: false,
    isStreamMuted: false,
    isLiveChatOpen: false,
    isStreamingBroadcaster: false,
    broadcasterStream: null,
    peerConnection: null,
    liveLikesCount: 0,
    liveViewersCount: 1,
    activePeerStreamId: null,
    liveSignalChannel: null,
    liveSignalingUnsubscribe: null
};

export function setThemeMode(theme, persist = true) {
    const normalized = normalizeTheme(theme);
    const meta = THEME_META[normalized];
    state.currentTheme = normalized;

    document.documentElement.setAttribute('data-theme', normalized);
    document.documentElement.classList.remove('theme-dark', 'theme-light-dark', 'theme-soft-light', 'theme-strong-light', 'theme-light');
    document.documentElement.classList.add(`theme-${normalized}`);

    if (document.body) {
        document.body.classList.remove('theme-dark', 'theme-light-dark', 'theme-soft-light', 'theme-strong-light', 'theme-light', 'light-mode');
        document.body.classList.add(`theme-${normalized}`);
        if (meta.isLight) {
            document.body.classList.add('light-mode');
        }
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', meta.statusColor);
    }

    const currentIndex = THEME_MODES.indexOf(normalized);
    const nextTheme = THEME_MODES[(currentIndex + 1) % THEME_MODES.length];
    const nextMeta = THEME_META[nextTheme];

    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
        btn.setAttribute('data-theme-mode', normalized);
        btn.setAttribute(
            'title',
            `Aktuell: ${meta.label} • Nächster Mode: ${nextMeta.label}`
        );
        const iconEl = btn.querySelector('.theme-toggle-icon');
        const labelEl = btn.querySelector('.theme-toggle-label');
        if (iconEl) iconEl.textContent = meta.icon;
        if (labelEl) labelEl.textContent = meta.label;
    });

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalized);
        } catch (e) {
            console.warn('Theme konnte nicht in localStorage gespeichert werden:', e);
        }
    }

    return normalized;
}

export function cycleTheme() {
    const idx = THEME_MODES.indexOf(normalizeTheme(state.currentTheme));
    const nextTheme = THEME_MODES[(idx + 1) % THEME_MODES.length];
    return setThemeMode(nextTheme, true);
}

// Rückwärtskompatibilität für bestehende Aufrufe
export const applyTheme = setThemeMode;
export const toggleTheme = cycleTheme;

setThemeMode(state.currentTheme, false);
window.setThemeMode = setThemeMode;
window.cycleTheme = cycleTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;