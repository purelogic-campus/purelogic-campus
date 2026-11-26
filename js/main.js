// js/main.js - Vollständiges Hauptskript für PURE LOGIC
import { _supabase } from './config.js';
import { state } from './state.js';
import { checkPasswordRecoveryFlow } from './auth.js';
import { initNetworkMonitor, safeAsyncAction, renderOfflineBanner, removeOfflineFallbackNotice } from './network.js';
import { requestPushPermission, initRealtimePushListeners, updatePushStatusUi } from './features/notifications.js';
import { loadCampusFeed, loadMyProfilePosts, setReelFilter, setFilter, claimActiveDrop } from './features/feed.js';
import { loadLiveStreams, setLiveFilter, handlePreLiveCheck, closeLiveFullscreen, sendLiveChatMessage } from './features/live.js';
import { toggleLectureMode, saveLectureNotesToFile } from './features/lecture.js';
import { openCampusQuizModal, closeCampusQuizModal } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal, toggleProfForm, submitProfReview, filterProfReviews } from './features/profguide.js';
import { openCrushModal, closeCrushModal, submitCrush } from './features/crush.js';
import { openBlackboardModal, closeBlackboardModal } from './features/board.js';
import { loadRankingData } from './features/ranking.js';
import { initMatchMittwochTheme } from './features/match-mittwoch.js';
import { openCampusCalendar, loadCampusEvents } from './features/calendar.js';
import { changeLanguage } from './i18n.js';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

let adminMapInstance = null;
let adminMarkerInstance = null;
let deferredPrompt = null;

// Punkt 23: Zentrale Wiederherstellung & Synchronisierung bei Netzwerk-Reconnect
window.retryNetworkSync = async function() {
    if (!navigator.onLine) {
        renderOfflineBanner(true);
        alert('Es besteht weiterhin keine Internetverbindung.');
        return;
    }

    renderOfflineBanner(false);
    removeOfflineFallbackNotice();

    if (state.currentUserEmail) {
        await safeAsyncAction(
            () => _supabase.from('users').select('*').eq('email', state.currentUserEmail).maybeSingle(),
            {
                silent: true,
                onError: () => {}
            }
        );

        loadCampusFeed(state.currentReelFilter || 'foryou');
        loadLiveStreams();
        loadMyProfilePosts();
        loadCampusEvents(true);

        const rankingTab = document.getElementById('tab-ranking');
        if (rankingTab && !rankingTab.classList.contains('hidden') && typeof window.loadRankingData === 'function') {
            window.loadRankingData();
        }
    }
};

// Punkt 21: Datenbank-Integritätsprüfung für Benutzer- und Test-Profile
window.runTestProfileIntegrityCheck = async function() {
    const { data: users, error } = await safeAsyncAction(
        () => _supabase
            .from('users')
            .select('id, email, username, full_name, university, avatar_url, logic_score, is_verified_student'),
        {
            fallbackValue: [],
            errorPrefix: 'Abfrage auf users fehlgeschlagen'
        }
    );

    if (error) {
        console.error('Fehler bei Punkt 21 Integritätsprüfung:', error);
        return null;
    }

    const list = Array.isArray(users) ? users : [];
    const issues = [];
    const seenEmails = new Set();
    const seenUsernames = new Set();

    for (const u of list) {
        const label = u.email || u.username || u.id || 'Unbekanntes Profil';
        const emailNorm = (u.email || '').trim().toLowerCase();
        const userNorm = (u.username || '').trim().toLowerCase();

        if (!emailNorm) {
            issues.push(`${label}: E-Mail fehlt`);
        } else if (seenEmails.has(emailNorm)) {
            issues.push(`${label}: Doppelte E-Mail-Adresse`);
        } else {
            seenEmails.add(emailNorm);
        }

        if (!userNorm) {
            issues.push(`${label}: Benutzername fehlt`);
        } else if (seenUsernames.has(userNorm)) {
            issues.push(`${label}: Doppelter Benutzername (${u.username})`);
        } else {
            seenUsernames.add(userNorm);
        }

        if (!u.full_name || !u.full_name.trim()) {
            issues.push(`${label}: Vollständiger Name fehlt`);
        }

        if (typeof u.logic_score !== 'number' || Number.isNaN(u.logic_score)) {
            issues.push(`${label}: logic_score ist ungültig oder leer`);
        }
    }

    const report = {
        checkedAt: new Date().toISOString(),
        totalProfiles: list.length,
        issuesCount: issues.length,
        issues
    };

    window.lastProfileIntegrityReport = report;
    console.log('Punkt 21 • Profil-Integritätsbericht:', report);

    if (issues.length === 0) {
        alert(`Integritätsprüfung erfolgreich! ✅\nGeprüfte Profile: ${list.length}\nGefundene Probleme: 0`);
    } else {
        alert(
            `Integritätsprüfung abgeschlossen ⚠️\nGeprüfte Profile: ${list.length}\nProbleme (${issues.length}):\n- ` +
            issues.slice(0, 12).join('\n- ')
        );
    }

    return report;
};

// Hilfsfunktion: Bilddatei als Data-URL einlesen (Fallback bei Storage-Problemen)
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Bilddatei konnte nicht gelesen werden.'));
        reader.readAsDataURL(file);
    });
}

// Hilfsfunktion: Avatar-Vorschau im Profil und Header aktualisieren
function applyAvatarPreview(url) {
    if (!url) return;
    const avatarInput = document.getElementById('profile-avatar');
    const profilePreview = document.getElementById('my-profile-avatar-preview');
    const headerPreview = document.getElementById('header-avatar-preview');

    if (avatarInput) avatarInput.value = url;
    if (profilePreview) profilePreview.src = url;
    if (headerPreview) headerPreview.src = url;
}

// Hilfsfunktion: Verstecktes Datei-Input-Feld für Smartphone & PC sicherstellen
function ensureDeviceAvatarInput(onFileChosen) {
    let fileInput = document.getElementById('pure-logic-avatar-file-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'pure-logic-avatar-file-input';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    fileInput.onchange = async (event) => {
        const file = event.target?.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Bitte wähle eine gültige Bilddatei aus (JPG, PNG, WebP usw.).');
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            alert('Das Bild ist zu groß. Maximal 5 MB sind erlaubt.');
            return;
        }

        if (typeof onFileChosen === 'function') {
            await onFileChosen(file);
        }
    };

    return fileInput;
}

// Lädt ein Profilbild aus dem Gerätespeicher (Smartphone/PC) hoch und speichert es in users.avatar_url
window.uploadAvatarFromDevice = async function(targetAvatarEl = null) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um dein Profilbild zu ändern.');
        return;
    }

    if (!navigator.onLine) {
        renderOfflineBanner(true);
        alert('Du bist aktuell offline. Bitte verbinde dich mit dem Internet, um ein Profilbild hochzuladen.');
        return;
    }

    const previewEl = targetAvatarEl || document.getElementById('my-profile-avatar-preview');

    const fileInput = ensureDeviceAvatarInput(async (file) => {
        const prevOpacity = previewEl ? previewEl.style.opacity : '';
        if (previewEl) {
            previewEl.style.opacity = '0.5';
        }

        try {
            const extFromName = file.name.includes('.')
                ? file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
                : '';
            const extFromMime = file.type.split('/')[1]?.split('+')[0]?.toLowerCase() || 'jpg';
            const extension = extFromName || extFromMime || 'jpg';

            const safeUserKey = state.currentUserEmail
                .toLowerCase()
                .replace(/[^a-z0-9._-]/g, '_');
            const storagePath = `${safeUserKey}/avatar_${Date.now()}.${extension}`;

            let finalAvatarUrl = '';

            // Versuch 1: Upload in den öffentlichen Supabase Storage Bucket 'avatars'
            const { error: uploadError } = await _supabase.storage
                .from(AVATAR_BUCKET)
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: file.type
                });

            if (!uploadError) {
                const { data: publicUrlData } = _supabase.storage
                    .from(AVATAR_BUCKET)
                    .getPublicUrl(storagePath);

                if (publicUrlData?.publicUrl) {
                    finalAvatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
                }
            }

            // Versuch 2: Fallback über Data-URL, falls Storage-Upload nicht greift
            if (!finalAvatarUrl) {
                finalAvatarUrl = await readFileAsDataUrl(file);
            }

            if (!finalAvatarUrl) {
                throw new Error('Bild konnte nicht verarbeitet werden.');
            }

            const { error: dbError } = await _supabase
                .from('users')
                .update({ avatar_url: finalAvatarUrl })
                .eq('email', state.currentUserEmail);

            if (dbError) {
                throw new Error('Speichern im Profil fehlgeschlagen: ' + dbError.message);
            }

            applyAvatarPreview(finalAvatarUrl);
            alert('Profilbild erfolgreich aus dem Gerätespeicher hochgeladen! 🎉');
        } catch (err) {
            console.error('Avatar-Upload Fehler:', err);
            if (!navigator.onLine) renderOfflineBanner(true);
            alert(err.message || 'Fehler beim Hochladen des Profilbilds.');
        } finally {
            if (previewEl) {
                previewEl.style.opacity = prevOpacity || '1';
            }
        }
    });

    fileInput.click();
};

// Macht das Profilbild-Symbol im Profil direkt anklickbar (ohne zusätzlichen Button)
function bindProfileAvatarClick() {
    const profileAvatar = document.getElementById('my-profile-avatar-preview');
    if (!profileAvatar) return;

    profileAvatar.style.cursor = 'pointer';
    if (profileAvatar.getAttribute('data-avatar-click-bound') === '1') return;
    profileAvatar.setAttribute('data-avatar-click-bound', '1');

    profileAvatar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.uploadAvatarFromDevice(profileAvatar);
    });
}

// Service Worker Registrierung für PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('PWA Service Worker aktiv:', reg.scope))
            .catch((err) => console.warn('Service Worker Registrierung fehlgeschlagen:', err));
    });
}

// PWA Install Prompt abfangen
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const authInstallBtn = document.getElementById('install-app-auth-btn');
    const dropdownInstallBtn = document.getElementById('install-app-dropdown-btn');

    if (authInstallBtn) authInstallBtn.classList.remove('hidden');
    if (dropdownInstallBtn) dropdownInstallBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('install-app-auth-btn')?.classList.add('hidden');
    document.getElementById('install-app-dropdown-btn')?.classList.add('hidden');
    console.log('PURE LOGIC wurde erfolgreich als App installiert! 📲');
});

window.installPWA = async function() {
    if (!deferredPrompt) {
        alert('Tippe im Browser-Menü auf „Zum Startbildschirm hinzufügen“, um PURE LOGIC als App zu installieren! 📲');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        deferredPrompt = null;
        document.getElementById('install-app-auth-btn')?.classList.add('hidden');
        document.getElementById('install-app-dropdown-btn')?.classList.add('hidden');
    }
};

// Haupt-Initialisierung beim Laden des DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('PURE LOGIC • App initialisiert & Module geladen 🚀');

    // Netzwerk-Monitor mit automatischem Reconnect-Sync starten
    initNetworkMonitor(() => {
        if (typeof window.retryNetworkSync === 'function') {
            return window.retryNetworkSync();
        }
    });

    // Match-Mittwoch Theme beim Start vollautomatisch prüfen
    initMatchMittwochTheme();

    setupGlobalWindowHandlers();
    setupAuthFormHandlers();
    checkPasswordRecoveryFlow();
    bindProfileAvatarClick();

    window.resetUser = async function() {
        await safeAsyncAction(() => _supabase.auth.signOut(), { silent: true });
        state.currentUserEmail = null;
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = window.location.pathname;
    };

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            window.resetUser();
        });
    }

    // Session prüfen
    const { data: sessionData } = await safeAsyncAction(
        () => _supabase.auth.getSession(),
        { silent: true }
    );

    const session = sessionData?.session;
    if (session && session.user) {
        state.currentUserEmail = session.user.email;
        await initMainAppSession();
    }

    // Master-Admin Erkennung im Intervall prüfen
    setInterval(() => {
        const email = state.currentUserEmail?.toLowerCase();
        const adminTabBtn = document.getElementById('header-admin-tab-btn');
        const scoreBadge = document.getElementById('score');

        if (adminTabBtn && (email === 'office@pure-logic.at' || email?.includes('admin'))) {
            adminTabBtn.classList.remove('hidden');
            if (scoreBadge) scoreBadge.classList.add('admin-badge');
        }
    }, 500);
});

// Registrierungs-Modale Steuerung
window.openRegisterModal = function() {
    document.getElementById('register-modal')?.classList.remove('hidden');
};

window.closeRegisterModal = function() {
    document.getElementById('register-modal')?.classList.add('hidden');
};

window.toggleRegisterPasswordVisibility = function() {
    const passwordInput = document.getElementById('reg-password');
    const toggleBtn = document.getElementById('reg-toggle-pw-btn');
    if (!passwordInput || !toggleBtn) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🔒';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
};

window.submitRegistration = async function() {
    const fullNameInput = document.getElementById('reg-fullname');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');

    if (!fullNameInput || !emailInput || !passwordInput) return;

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!fullName || !email || !password) {
        showRegMsg('Bitte alle Felder ausfüllen.', 'error');
        return;
    }

    if (!email.toLowerCase().endsWith('.ac.at')) {
        showRegMsg('Registrierung nur mit offizieller Universitäts-E-Mail-Adresse (.ac.at) möglich!', 'error');
        return;
    }

    const missingCriteria = [];
    if (password.length < 8) {
        missingCriteria.push('mindestens 8 Zeichen');
    }
    if (!/\d/.test(password)) {
        missingCriteria.push('mindestens eine Zahl');
    }
    if (!/[!@#$%^&*(),.?":{}|<>-]/.test(password)) {
        missingCriteria.push('mindestens ein Sonderzeichen');
    }

    if (missingCriteria.length > 0) {
        showRegMsg('Dein Passwort erfüllt nicht alle Kriterien. Es fehlt: ' + missingCriteria.join(', ') + '.', 'error');
        return;
    }

    if (!navigator.onLine) {
        renderOfflineBanner(true);
        showRegMsg('Keine Internetverbindung. Bitte verbinde dich erneut, um dich zu registrieren.', 'error');
        return;
    }

    try {
        const { error } = await _supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        showRegMsg('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse im Postfach.', 'success');
        setTimeout(() => {
            closeRegisterModal();
        }, 3000);
    } catch (err) {
        showRegMsg('Registrierungs-Fehler: ' + err.message, 'error');
    }
};

function showRegMsg(text, type) {
    const msgBox = document.getElementById('reg-msg');
    if (!msgBox) return;
    msgBox.textContent = text;
    msgBox.classList.remove('hidden');
    if (type === 'error') {
        msgBox.style.background = 'rgba(255, 77, 77, 0.1)';
        msgBox.style.color = '#ff4d4d';
        msgBox.style.border = '1px solid rgba(255, 77, 77, 0.2)';
    } else {
        msgBox.style.background = 'rgba(16, 185, 129, 0.1)';
        msgBox.style.color = '#10b981';
        msgBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    }
}

function setupAuthFormHandlers() {
    window.handleLogin = async function() {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            window.showAuthMsg('Bitte E-Mail und Passwort eingeben.', 'error');
            return;
        }

        if (!navigator.onLine) {
            renderOfflineBanner(true);
            window.showAuthMsg('Keine Internetverbindung. Login aktuell nicht möglich.', 'error');
            return;
        }

        try {
            const { error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;
            window.location.reload();
        } catch (err) {
            window.showAuthMsg('Login-Fehler: ' + err.message, 'error');
        }
    };
}

// Initialisierung der Haupt-App nach erfolgreichem Login
async function initMainAppSession() {
    const authGate = document.getElementById('auth-gate');
    const mainApp = document.getElementById('main-app');
    const logoutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('header-profile-btn');
    const adminTabBtn = document.getElementById('header-admin-tab-btn');

    if (authGate) authGate.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (profileBtn) profileBtn.classList.remove('hidden');

    bindProfileAvatarClick();

    // Push-Benachrichtigungen und Realtime-Subscriptions starten
    updatePushStatusUi();
    initRealtimePushListeners(state.currentUserEmail);

    let isMasterAdmin = (
        state.currentUserEmail?.toLowerCase() === 'office@pure-logic.at' ||
        state.currentUserEmail?.toLowerCase().includes('admin')
    );

    const { data: userData } = await safeAsyncAction(
        () => _supabase
            .from('users')
            .select('*')
            .eq('email', state.currentUserEmail)
            .maybeSingle(),
        {
            silent: true,
            onError: (err) => console.error('Fehler beim Laden der User-Daten:', err)
        }
    );

    if (userData) {
        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.textContent = `${userData.logic_score || 0} P`;
        state.isVerifiedStudent = userData.is_verified_student || false;

        if (isMasterAdmin || userData.is_admin || userData.role === 'admin') {
            isMasterAdmin = true;
        }

        const userHandleInput = document.getElementById('profile-username');
        const userFullNameInput = document.getElementById('profile-fullname');
        const userBioInput = document.getElementById('profile-bio');
        const userAvatarInput = document.getElementById('profile-avatar');
        const userAvatarPreview = document.getElementById('my-profile-avatar-preview');
        const headerAvatarPreview = document.getElementById('header-avatar-preview');
        const displayNameDisplay = document.getElementById('my-profile-display-name');
        const handleDisplay = document.getElementById('my-profile-handle-preview');
        const uniSelect = document.getElementById('profile-university');

        if (userHandleInput) userHandleInput.value = userData.username || '';
        if (userFullNameInput) userFullNameInput.value = userData.full_name || '';
        if (userBioInput) userBioInput.value = userData.bio || '';
        if (userAvatarInput) userAvatarInput.value = userData.avatar_url || '';
        if (userAvatarPreview && userData.avatar_url) userAvatarPreview.src = userData.avatar_url;
        if (headerAvatarPreview && userData.avatar_url) headerAvatarPreview.src = userData.avatar_url;
        if (displayNameDisplay) displayNameDisplay.textContent = userData.full_name || 'Dein Name';
        if (handleDisplay) handleDisplay.textContent = '@' + (userData.username || 'benutzername');
        if (uniSelect && userData.university) uniSelect.value = userData.university;

        const badgeContainer = document.getElementById('verified-student-badge-container');
        if (badgeContainer) {
            if (userData.is_verified_student) {
                badgeContainer.innerHTML = `<span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; margin-top: 2px;">🎓 Verified Student (.ac.at)</span>`;
            } else {
                badgeContainer.innerHTML = '';
            }
        }
    }

    bindProfileAvatarClick();

    if (isMasterAdmin) {
        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.classList.add('admin-badge');
        if (adminTabBtn) adminTabBtn.classList.remove('hidden');
    }

    loadCampusFeed('foryou');
    loadLiveStreams();
    loadMyProfilePosts();
    loadCampusEvents();
    updatePushStatusUi();
}

// Leaflet Admin Karte initialisieren
function initAdminMap() {
    const mapContainer = document.getElementById('admin-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!adminMapInstance) {
        const defaultLat = 48.2082;
        const defaultLng = 16.3738;

        adminMapInstance = L.map('admin-map').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(adminMapInstance);

        adminMarkerInstance = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(adminMapInstance);

        adminMapInstance.on('click', (e) => {
            const { lat, lng } = e.latlng;
            adminMarkerInstance.setLatLng([lat, lng]);
            const latInput = document.getElementById('admin-drop-lat');
            const lngInput = document.getElementById('admin-drop-lng');
            if (latInput) latInput.value = lat.toFixed(6);
            if (lngInput) lngInput.value = lng.toFixed(6);
        });
    }

    setTimeout(() => {
        adminMapInstance.invalidateSize();
    }, 200);
}

// Globale Fenster-Handler und Admin-Tools
function setupGlobalWindowHandlers() {
    window.switchTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => {
            if (!el.id.includes('modal') && el.id !== 'auth-gate' && el.id !== 'main-app') {
                el.classList.add('hidden');
            }
        });

        const targetTab = document.getElementById('tab-' + tabName);
        if (targetTab) {
            targetTab.classList.remove('hidden');
        }

        if (tabName === 'profile') {
            bindProfileAvatarClick();
        } else if (tabName === 'admin') {
            initAdminMap();
        } else if (tabName === 'ranking') {
            if (typeof window.loadRankingData === 'function') {
                window.loadRankingData();
            }
        } else if (tabName === 'calendar') {
            loadCampusEvents();
        }
    };

    window.adminSetTestPoints = async function() {
        const input = document.getElementById('admin-test-points-input');
        const points = parseInt(input?.value, 10);
        if (isNaN(points) || !state.currentUserEmail) {
            alert('Bitte gib eine gültige Punktzahl ein.');
            return;
        }

        const { error } = await safeAsyncAction(
            () => _supabase
                .from('users')
                .update({ logic_score: points })
                .eq('email', state.currentUserEmail),
            { errorPrefix: 'Fehler beim Setzen der Punkte' }
        );

        if (!error) {
            const scoreBadge = document.getElementById('score');
            if (scoreBadge) scoreBadge.textContent = `${points} P`;
            alert(`Test-Punktestand erfolgreich auf ${points} P gesetzt! ⚡`);
        }
    };

    window.handleCreateCampusDrop = async function() {
        const title = document.getElementById('admin-drop-title')?.value.trim();
        const rewardType = document.getElementById('admin-drop-reward-type')?.value;
        const rewardValue = document.getElementById('admin-drop-reward-value')?.value.trim();
        const startTime = document.getElementById('admin-drop-start-time')?.value;
        const lat = parseFloat(document.getElementById('admin-drop-lat')?.value);
        const lng = parseFloat(document.getElementById('admin-drop-lng')?.value);
        const radius = parseInt(document.getElementById('admin-drop-radius')?.value || '100', 10);

        if (!title || !rewardValue || isNaN(lat) || isNaN(lng)) {
            alert('Bitte Titel, Belohnungswert und GPS-Koordinaten angeben.');
            return;
        }

        const { error } = await safeAsyncAction(
            () => _supabase.from('campus_drops').insert([{
                id: crypto.randomUUID(),
                title,
                reward_type: rewardType,
                reward_value: rewardValue,
                start_time: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
                lat,
                lng,
                radius,
                created_by: state.currentUserEmail,
                created_at: new Date().toISOString()
            }]),
            { errorPrefix: 'Fehler beim Erstellen des Drops' }
        );

        if (!error) {
            const banner = document.getElementById('campus-drop-banner');
            if (banner) banner.style.display = 'block';

            alert('Campus-Drop erfolgreich mit GPS-Bindung freigegeben! 🚀');
        }
    };

    window.togglePointsDropdown = function(event) {
        event.stopPropagation();
        const menu = document.getElementById('points-dropdown-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    };

    window.showAuthMsg = function(text, type) {
        const msgBox = document.getElementById('auth-msg');
        if (!msgBox) return;
        msgBox.textContent = text;
        msgBox.classList.remove('hidden');
        if (type === 'error') {
            msgBox.style.background = 'rgba(255, 77, 77, 0.1)';
            msgBox.style.color = '#ff4d4d';
            msgBox.style.border = '1px solid rgba(255, 77, 77, 0.2)';
        } else {
            msgBox.style.background = 'rgba(16, 185, 129, 0.1)';
            msgBox.style.color = '#10b981';
            msgBox.style.border = '1px solid rgba(16, 185, 129, 0.2)';
        }
    };

    window.openMorePointsModal = function() {
        document.getElementById('more-points-modal')?.classList.remove('hidden');
    };
    window.closeMorePointsModal = function() {
        document.getElementById('more-points-modal')?.classList.add('hidden');
    };

    window.openActiveSpotsModal = function() {
        document.getElementById('active-spots-modal')?.classList.remove('hidden');
    };
    window.closeActiveSpotsModal = function() {
        document.getElementById('active-spots-modal')?.classList.add('hidden');
    };

    window.openImpressumModal = function() {
        document.getElementById('impressum-modal')?.classList.remove('hidden');
    };
    window.openAgbModal = function() {
        document.getElementById('agb-modal')?.classList.remove('hidden');
    };

    window.openUploadModal = function() {
        document.getElementById('media-upload-modal')?.classList.remove('hidden');
    };
    window.closeMediaUploadModal = function() {
        document.getElementById('media-upload-modal')?.classList.add('hidden');
    };

    window.changeAvatarDirectly = function() {
        window.uploadAvatarFromDevice(document.getElementById('my-profile-avatar-preview'));
    };

    window.saveMyProfile = async function() {
        const username = document.getElementById('profile-username')?.value.trim();
        const fullName = document.getElementById('profile-fullname')?.value.trim();
        const bio = document.getElementById('profile-bio')?.value.trim();
        const avatarUrl = document.getElementById('profile-avatar')?.value.trim();
        const university = document.getElementById('profile-university')?.value;

        if (!state.currentUserEmail) return;

        const { error } = await safeAsyncAction(
            () => _supabase
                .from('users')
                .update({
                    username: username,
                    full_name: fullName,
                    bio: bio,
                    avatar_url: avatarUrl,
                    university: university
                })
                .eq('email', state.currentUserEmail),
            { errorPrefix: 'Fehler beim Speichern des Profils' }
        );

        if (!error) {
            applyAvatarPreview(avatarUrl);
            alert('Profil erfolgreich gespeichert! (+10 P)');

            const { data: userData } = await safeAsyncAction(
                () => _supabase
                    .from('users')
                    .select('logic_score')
                    .eq('email', state.currentUserEmail)
                    .maybeSingle(),
                { silent: true }
            );

            if (userData) {
                const newScore = (userData.logic_score || 0) + 10;
                await safeAsyncAction(
                    () => _supabase.from('users').update({ logic_score: newScore }).eq('email', state.currentUserEmail),
                    { silent: true }
                );
                const scoreBadge = document.getElementById('score');
                if (scoreBadge) scoreBadge.textContent = `${newScore} P`;
            }
        }
    };

    window.shareProfileCard = function() {
        const shareText = `🚀 Check mal mein Campus-Profil und Uni-Level auf PURE LOGIC ab!`;
        const shareUrl = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: 'PURE LOGIC • Campus Profil',
                text: shareText,
                url: shareUrl
            }).catch(() => {});
        } else {
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            window.open(waUrl, '_blank');
        }
    };

    window.openCampusCalendar = openCampusCalendar;
    window.changeLanguage = changeLanguage;
}

// Dropdown Menü bei Klick außerhalb schließen
document.addEventListener('click', () => {
    const menu = document.getElementById('points-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});