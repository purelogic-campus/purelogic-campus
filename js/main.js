// js/main.js - Vollständiges Hauptskript für PURE LOGIC
import { _supabase } from './config.js';
import { state } from './state.js';
import { checkPasswordRecoveryFlow } from './auth.js';
import { initPushNotifications, subscribeToRealtimeNotifications } from './features/notifications.js';
import { loadCampusFeed, loadMyProfilePosts, setReelFilter, setFilter, claimActiveDrop } from './features/feed.js';
import { loadLiveStreams, setLiveFilter, handlePreLiveCheck, closeLiveFullscreen, sendLiveChatMessage } from './features/live.js';
import { toggleLectureMode, saveLectureNotesToFile } from './features/lecture.js';
import { openCampusQuizModal, closeCampusQuizModal } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal, toggleProfForm, submitProfReview, filterProfReviews } from './features/profguide.js';
import { openCrushModal, closeCrushModal, submitCrush } from './features/crush.js';
import { openBlackboardModal, closeBlackboardModal } from './features/board.js';
import { loadRankingData } from './features/ranking.js';
import { initMatchMittwochTheme } from './features/match-mittwoch.js';
import { changeLanguage } from './i18n.js';

let adminMapInstance = null;
let adminMarkerInstance = null;
let deferredPrompt = null;

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

    // Match-Mittwoch Theme beim Start vollautomatisch prüfen
    initMatchMittwochTheme();

    setupGlobalWindowHandlers();
    setupAuthFormHandlers();
    checkPasswordRecoveryFlow();

    window.resetUser = async function() {
        try {
            await _supabase.auth.signOut();
        } catch (err) {
            console.warn('Supabase SignOut Fehler:', err);
        }
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
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session && session.user) {
            state.currentUserEmail = session.user.email;
            await initMainAppSession();
        }
    } catch (err) {
        console.warn('Session Check fehlgeschlagen:', err);
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

    try {
        const { data, error } = await _supabase.auth.signUp({
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

        try {
            const { data, error } = await _supabase.auth.signInWithPassword({
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

    // Push-Benachrichtigungen und Realtime-Subscriptions starten
    await initPushNotifications();
    subscribeToRealtimeNotifications();

    let isMasterAdmin = (
        state.currentUserEmail?.toLowerCase() === 'office@pure-logic.at' ||
        state.currentUserEmail?.toLowerCase().includes('admin')
    );

    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('*')
            .eq('email', state.currentUserEmail)
            .maybeSingle();

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
    } catch (err) {
        console.error('Fehler beim Laden der User-Daten:', err);
    }

    if (isMasterAdmin) {
        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.classList.add('admin-badge');
        if (adminTabBtn) adminTabBtn.classList.remove('hidden');
    }

    loadCampusFeed('foryou');
    loadLiveStreams();
    loadMyProfilePosts();
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

        if (tabName === 'admin') {
            initAdminMap();
        } else if (tabName === 'ranking') {
            if (typeof window.loadRankingData === 'function') {
                window.loadRankingData();
            }
        }
    };

    window.adminSetTestPoints = async function() {
        const input = document.getElementById('admin-test-points-input');
        const points = parseInt(input?.value, 10);
        if (isNaN(points) || !state.currentUserEmail) {
            alert('Bitte gib eine gültige Punktzahl ein.');
            return;
        }

        try {
            const { error } = await _supabase
                .from('users')
                .update({ logic_score: points })
                .eq('email', state.currentUserEmail);

            if (error) throw error;

            const scoreBadge = document.getElementById('score');
            if (scoreBadge) scoreBadge.textContent = `${points} P`;
            alert(`Test-Punktestand erfolgreich auf ${points} P gesetzt! ⚡`);
        } catch (err) {
            alert('Fehler beim Setzen der Punkte: ' + err.message);
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

        try {
            const { error } = await _supabase.from('campus_drops').insert([{
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
            }]);

            if (error) throw error;

            const banner = document.getElementById('campus-drop-banner');
            if (banner) banner.style.display = 'block';

            alert('Campus-Drop erfolgreich mit GPS-Bindung freigegeben! 🚀');
        } catch (err) {
            alert('Fehler beim Erstellen des Drops: ' + err.message);
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
        const newUrl = prompt('Bitte gib die Bild-URL für dein neues Profilbild ein:');
        if (newUrl) {
            document.getElementById('profile-avatar').value = newUrl;
            document.getElementById('my-profile-avatar-preview').src = newUrl;
            document.getElementById('header-avatar-preview').src = newUrl;
        }
    };

    window.saveMyProfile = async function() {
        const username = document.getElementById('profile-username')?.value.trim();
        const fullName = document.getElementById('profile-fullname')?.value.trim();
        const bio = document.getElementById('profile-bio')?.value.trim();
        const avatarUrl = document.getElementById('profile-avatar')?.value.trim();
        const university = document.getElementById('profile-university')?.value;

        if (!state.currentUserEmail) return;

        try {
            const { error } = await _supabase
                .from('users')
                .update({
                    username: username,
                    full_name: fullName,
                    bio: bio,
                    avatar_url: avatarUrl,
                    university: university
                })
                .eq('email', state.currentUserEmail);

            if (error) throw error;
            alert('Profil erfolgreich gespeichert! (+10 P)');

            const { data: userData } = await _supabase
                .from('users')
                .select('logic_score')
                .eq('email', state.currentUserEmail)
                .maybeSingle();

            if (userData) {
                const newScore = (userData.logic_score || 0) + 10;
                await _supabase.from('users').update({ logic_score: newScore }).eq('email', state.currentUserEmail);
                const scoreBadge = document.getElementById('score');
                if (scoreBadge) scoreBadge.textContent = `${newScore} P`;
            }
        } catch (err) {
            alert('Fehler beim Speichern des Profils: ' + err.message);
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

    window.changeLanguage = changeLanguage;
}

// Dropdown Menü bei Klick außerhalb schließen
document.addEventListener('click', () => {
    const menu = document.getElementById('points-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});