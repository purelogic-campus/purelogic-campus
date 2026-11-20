// js/state.js - Zentrales App-State-Management & Theme-Persistenz (Dark / Light)

export const THEME_STORAGE_KEY = 'pure_logic_theme';

function getInitialTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
    } catch (e) {
        console.warn('Theme konnte nicht aus localStorage gelesen werden:', e);
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
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

export function applyTheme(theme, persist = true) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    state.currentTheme = normalized;

    document.documentElement.setAttribute('data-theme', normalized);
    document.body.classList.toggle('light-mode', normalized === 'light');

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', normalized === 'light' ? '#ffffff' : '#1a0512');
    }

    const isLight = normalized === 'light';
    const nextIcon = isLight ? '🌙' : '☀️';
    const nextLabel = isLight ? 'Dark' : 'Light';

    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(isLight));
        btn.setAttribute(
            'title',
            isLight ? 'Zum Dark-Mode wechseln' : 'Zum Light-Mode wechseln'
        );
        const iconEl = btn.querySelector('.theme-toggle-icon');
        const labelEl = btn.querySelector('.theme-toggle-label');
        if (iconEl) iconEl.textContent = nextIcon;
        if (labelEl) labelEl.textContent = nextLabel;
    });

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, normalized);
        } catch (e) {
            console.warn('Theme konnte nicht in localStorage gespeichert werden:', e);
        }
    }
}

export function toggleTheme() {
    const nextTheme = state.currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);
    return nextTheme;
}

// Initiales Theme anwenden und global bereitstellen
applyTheme(state.currentTheme, false);
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;