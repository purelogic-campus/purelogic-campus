// js/network.js - Zentrales Fehlerhandling, Offline-Status & Fallback-Anzeigen für PURE LOGIC

const OFFLINE_BANNER_ID = 'pure-logic-offline-banner';
const OFFLINE_FALLBACK_BOX_ID = 'pure-logic-offline-fallback-box';

/**
 * Erzeugt oder aktualisiert das sichtbare Offline-Banner und Zustandsklassen im DOM
 */
export function renderOfflineBanner(isOffline) {
    const offline = Boolean(isOffline);
    let banner = document.getElementById(OFFLINE_BANNER_ID);

    if (!banner) {
        banner = document.createElement('div');
        banner.id = OFFLINE_BANNER_ID;
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML = `
            <span class="offline-banner-text">⚠️ Keine Internetverbindung – Offline-Modus aktiv. Zwischengespeicherte Daten bleiben verfügbar, Live-Aktionen sind pausiert.</span>
            <button type="button" class="offline-banner-retry-btn" onclick="window.retryNetworkSync && window.retryNetworkSync()">Neu verbinden</button>
        `;
        document.body.prepend(banner);
    }

    banner.classList.toggle('hidden', !offline);
    banner.style.display = offline ? 'flex' : 'none';
    document.body.classList.toggle('is-offline', offline);

    if (offline) {
        renderOfflineFallbackNotice();
    } else {
        removeOfflineFallbackNotice();
    }
}

/**
 * Zeigt einen kompakten Fallback-Hinweis in aktiven Inhaltsbereichen, falls noch keine Daten geladen wurden
 */
export function renderOfflineFallbackNotice(customMessage = '') {
    const wrapper = document.querySelector('.tab-content-wrapper') || document.getElementById('main-app');
    if (!wrapper) return;

    let box = document.getElementById(OFFLINE_FALLBACK_BOX_ID);
    if (!box) {
        box = document.createElement('div');
        box.id = OFFLINE_FALLBACK_BOX_ID;
        box.className = 'offline-fallback-box';
        wrapper.prepend(box);
    }

    const msg = customMessage || 'Du bist aktuell offline. Sobald wieder eine Internetverbindung besteht, werden Feeds, Chats und Live-Streams automatisch aktualisiert.';
    box.innerHTML = `
        <div class="offline-fallback-title">📡 Verbindung unterbrochen – Fallback aktiv</div>
        <div class="offline-fallback-desc">${msg}</div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.retryNetworkSync && window.retryNetworkSync()">Erneut versuchen 🔄</button>
    `;
}

/**
 * Entfernt den Offline-Fallback-Hinweis, sobald wieder Verbindung besteht
 */
export function removeOfflineFallbackNotice() {
    const box = document.getElementById(OFFLINE_FALLBACK_BOX_ID);
    if (box) {
        box.remove();
    }
}

/**
 * Prüft, ob ein Fehler durch Netzwerkverlust oder fehlende Verbindung verursacht wurde
 */
export function isNetworkError(error) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return true;
    }

    const message = String(
        error?.message ||
        error?.details ||
        error?.hint ||
        error ||
        ''
    ).toLowerCase();

    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network request failed') ||
        message.includes('load failed') ||
        message.includes('fetch failed') ||
        message.includes('err_internet_disconnected') ||
        message.includes('err_network_changed') ||
        message.includes('timeout') ||
        message.includes('offline')
    );
}

/**
 * Kapselt asynchrone Operationen (z. B. Supabase-Abfragen & Writes) mit einheitlichem Fehler-Fallback
 */
export async function safeAsyncAction(fn, options = {}) {
    const {
        fallbackValue = null,
        offlineMessage = 'Keine Internetverbindung. Bitte prüfe dein Netz und versuche es erneut.',
        errorPrefix = 'Fehler',
        silent = false,
        onError = null
    } = options;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        renderOfflineBanner(true);
        if (!silent) {
            alert(offlineMessage);
        }
        if (typeof onError === 'function') {
            onError(new Error(offlineMessage), { offline: true });
        }
        return { data: fallbackValue, error: new Error(offlineMessage), offline: true };
    }

    try {
        const result = await fn();

        if (result && typeof result === 'object' && 'error' in result && result.error) {
            throw result.error;
        }

        renderOfflineBanner(false);
        const resolvedData = result && typeof result === 'object' && 'data' in result
            ? result.data
            : result;

        return { data: resolvedData, error: null, offline: false };
    } catch (err) {
        const offline = isNetworkError(err);
        if (offline) {
            renderOfflineBanner(true);
            if (!silent) {
                alert(offlineMessage);
            }
        } else if (!silent) {
            alert(`${errorPrefix}: ${err?.message || 'Unbekannter Fehler'}`);
        }

        if (typeof onError === 'function') {
            onError(err, { offline });
        }

        return { data: fallbackValue, error: err, offline };
    }
}

/**
 * Startet die Überwachung von Online- und Offline-Events sowie automatische Wiederherstellung
 */
export function initNetworkMonitor(onReconnect = null) {
    renderOfflineBanner(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    window.addEventListener('offline', () => {
        renderOfflineBanner(true);
    });

    window.addEventListener('online', async () => {
        renderOfflineBanner(false);
        if (typeof onReconnect === 'function') {
            await onReconnect();
        }
    });
}

window.renderOfflineBanner = renderOfflineBanner;
window.renderOfflineFallbackNotice = renderOfflineFallbackNotice;
window.removeOfflineFallbackNotice = removeOfflineFallbackNotice;
window.isNetworkError = isNetworkError;
window.safeAsyncAction = safeAsyncAction;
window.initNetworkMonitor = initNetworkMonitor;