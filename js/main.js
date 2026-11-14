// ============================================================================
// PURE LOGIC • js/main.js (Vollständige & Ungekürzte Version)
// ============================================================================

import { _supabase } from './config.js';
import { state } from './state.js';
import { loadCampusFeed, loadMyProfilePosts, setReelFilter, setFilter, claimActiveDrop } from './features/feed.js';
import { loadLiveStreams, setLiveFilter, handlePreLiveCheck, closeLiveFullscreen, sendLiveChatMessage } from './features/live.js';
import { toggleLectureMode, saveLectureNotesToFile } from './features/lecture.js';
import { openCampusQuizModal, closeCampusQuizModal } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal, toggleProfForm, submitProfReview, filterProfReviews } from './features/profguide.js';
import { openCrushModal, closeCrushModal, submitCrush } from './features/crush.js';
import { changeLanguage } from './i18n.js';

let adminMapInstance = null;
let adminMarkerInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('PURE LOGIC • App initialisiert & Module geladen 🚀');

    setupGlobalWindowHandlers();
    setupAuthFormHandlers();

    // 1. Globale Logout- & Reset-Funktion
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

    // 2. Expliziter Event-Listener für den Logout-Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            window.resetUser();
        });
    }

    // 3. Session-Prüfung beim Start
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session && session.user) {
            state.currentUserEmail = session.user.email;
            await initMainAppSession();
        }
    } catch (err) {
        console.warn('Session Check fehlgeschlagen:', err);
    }

    // 4. Permanenter Admin-Watcher (entfernt zuverlässig 'hidden' vom Header-Button)
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

// Authentifizierungs-Handler für Login & Registrierung mit .ac.at Prüfung
function setupAuthFormHandlers() {
    window.handleUserSignup = async function(email, password) {
        // STRENGER SICHERHEITS-CHECK: Nur offizielle Uni-E-Mail-Adressen (.ac.at) erlauben
        if (!email || !email.toLowerCase().endsWith('.ac.at')) {
            window.showAuthMsg('Registrierung nur mit offizieller Universitäts-E-Mail-Adresse (.ac.at) möglich!', 'error');
            return;
        }

        try {
            const { data, error } = await _supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            window.showAuthMsg('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.', 'success');
        } catch (err) {
            window.showAuthMsg('Registrierungs-Fehler: ' + err.message, 'error');
        }
    };

    window.handleUserLogin = async function(email, password) {
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

    // Event-Listener für den Button "Account erstellen"
    const signupBtn = document.getElementById('signup-btn') || document.querySelector('.btn-signup');
    if (signupBtn) {
        signupBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value || document.querySelector('input[type="email"]')?.value;
            const password = document.getElementById('password')?.value || document.querySelector('input[type="password"]')?.value;
            
            if (email && password) {
                await window.handleUserSignup(email, password);
            } else {
                window.showAuthMsg('Bitte E-Mail und Passwort eingeben.', 'error');
            }
        });
    }
}

// Hauptanwendungs-Session initialisieren
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

    let isMasterAdmin = (
        state.currentUserEmail?.toLowerCase() === 'office@pure-logic.at' ||
        state.currentUserEmail?.toLowerCase().includes('admin')
    );

    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('*')
            .eq('email', state.currentUserEmail)
            .single();

        if (userData) {
            const scoreBadge = document.getElementById('score');
            if (scoreBadge) scoreBadge.textContent = `${userData.logic_score || 0} P`;
            state.isVerifiedStudent = userData.is_verified_student || false;

            if (isMasterAdmin || userData.is_admin || userData.role === 'admin') {
                isMasterAdmin = true;
            }

            // Profilfelder im Profil-Tab vorbefüllen
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

            // Verified Student Badge im Profil rendern
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

// Initialisiert die Leaflet-Karte im Admin-Tab
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

// Tab-Switching und globale Handler
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
        }
    };

    // Admin Test-Modus: Punkte direkt setzen
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

    // Admin: Neuen Campus-Drop mit GPS-Bindung erstellen
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

    // Dropdown-Menü für Punkte & Extras
    window.togglePointsDropdown = function(event) {
        event.stopPropagation();
        const menu = document.getElementById('points-dropdown-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    };

    // Hilfsfunktion für Fehlermeldungen im Auth-Bereich
    window.showAuthMsg = function(text, type) {
        const msgBox = document.getElementById('auth-msg');
        if (!msgBox) return;
        msgBox.textContent = text;
        msgBox.classList.remove('hidden', 'msg-error', 'msg-success');
        msgBox.classList.add(type === 'error' ? 'msg-error' : 'msg-success');
    };

    // Modals öffnen & schließen
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
                .single();

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
        if (navigator.share) {
            navigator.share({
                title: 'PURE LOGIC • Campus Profil',
                text: `Check mal mein Profil und Uni-Level auf PURE LOGIC ab! 🚀`,
                url: window.location.href
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Profil-Link in die Zwischenablage kopiert! 📋');
        }
    };

    window.changeLanguage = changeLanguage;
}

// Globales Schließen des Dropdowns bei Klick außerhalb
document.addEventListener('click', () => {
    const menu = document.getElementById('points-dropdown-menu');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});