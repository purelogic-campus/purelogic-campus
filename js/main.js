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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('PURE LOGIC • App initialisiert & Module geladen 🚀');

    // Globale Fallbacks und Event-Listener initialisieren
    setupGlobalWindowHandlers();

    // 1. Globale Logout- & Reset-Funktion mit sofortiger Neuladung
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

    // 2. Expliziter Event-Listener für den Desktop/PC Logout-Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            window.resetUser();
        });
    }

    // Punkt 8: Auto-Logout & Auto-Cache leeren beim Verlassen / Schließen der Seite
    window.addEventListener('beforeunload', async () => {
        try {
            await _supabase.auth.signOut();
        } catch (err) {
            console.warn('Auto-Logout Fehler beim Verlassen:', err);
        }
        localStorage.clear();
        sessionStorage.clear();
    });

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
});

// Hauptanwendungs-Session initialisieren
async function initMainAppSession() {
    const authGate = document.getElementById('auth-gate');
    const mainApp = document.getElementById('main-app');
    const logoutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('header-profile-btn');
    const adminBtn = document.getElementById('header-admin-tab-btn');

    if (authGate) authGate.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (profileBtn) profileBtn.classList.remove('hidden');

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

            // Master Admin Erkennung (über Datenbank-Flag ODER E-Mail-Adresse)
            const isMasterAdmin = (state.currentUserEmail === 'office@pure-logic.at') || 
                                  userData.is_admin || 
                                  userData.role === 'admin' ||
                                  state.currentUserEmail?.includes('admin');

            if (isMasterAdmin) {
                if (adminBtn) adminBtn.classList.remove('hidden');
                if (scoreBadge) scoreBadge.classList.add('admin-badge');
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

    // Fallback für Master Admin, falls der DB-Abruf fehlschlägt
    if (state.currentUserEmail === 'office@pure-logic.at') {
        if (adminBtn) adminBtn.classList.remove('hidden');
        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.classList.add('admin-badge');
    }

    loadCampusFeed('foryou');
    loadLiveStreams();
    loadMyProfilePosts();
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

            // Punkte gutschreiben (+10)
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
```[cite: 9]