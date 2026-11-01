// js/main.js - Schlanker Hauptcontroller
import { _supabase } from './config.js';
import { state } from './state.js';
import { changeLanguage } from './i18n.js';
import { handleLogin, handleSignup, resetUser, handleForgotPassword, togglePasswordVisibility } from './auth.js';
import { toggleLectureMode } from './features/lecture.js';
import { initQuiz } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal } from './features/profguide.js';
import { loadLiveStreams } from './features/live.js';
import { loadCampusFeed, loadMyProfilePosts } from './features/feed.js';

// Global verfügbar machen für HTML onclick-Attribute
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.resetUser = resetUser;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleLectureMode = toggleLectureMode;
window.openProfGuideModal = openProfGuideModal;
window.closeProfGuideModal = closeProfGuideModal;

// UI Hilfsfunktionen & Tab-Steuerung
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        if (!['more-points-modal', 'prof-guide-modal', 'quiz-modal', 'active-spots-modal', 'crush-modal', 'media-upload-modal', 'impressum-modal', 'agb-modal', 'report-modal', 'live-fullscreen-modal'].includes(el.id)) {
            el.classList.add('hidden');
        }
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.remove('hidden');
        // Lädt beim Wechsel in den Live-Tab exklusiv die echten Streams
        if (tabId === 'live') {
            loadLiveStreams();
        }
    }

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-tab-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'profile') {
        loadMyProfilePosts();
    }
    if (tabId === 'reels') {
        loadCampusFeed(state.currentReelFilter || 'foryou');
    }
};

window.togglePointsDropdown = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('points-dropdown-menu');
    if (dropdown) dropdown.classList.toggle('hidden');
};

document.addEventListener('click', () => {
    const dropdown = document.getElementById('points-dropdown-menu');
    if (dropdown) dropdown.classList.add('hidden');
});

// Modals
window.openActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.remove('hidden');
window.closeActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.add('hidden');
window.openMorePointsModal = () => document.getElementById('more-points-modal')?.classList.remove('hidden');
window.closeMorePointsModal = () => document.getElementById('more-points-modal')?.classList.add('hidden');
window.openCrushModal = () => document.getElementById('crush-modal')?.classList.remove('hidden');
window.closeCrushModal = () => document.getElementById('crush-modal')?.classList.add('hidden');

// Rechtliche & Melde-Modals
window.openReportModal = () => document.getElementById('report-modal')?.classList.remove('hidden');
window.openImpressumModal = () => document.getElementById('impressum-modal')?.classList.remove('hidden');
window.openAgbModal = () => document.getElementById('agb-modal')?.classList.remove('hidden');

window.submitReportWithEvidence = async () => {
    const reason = document.getElementById('report-reason')?.value;
    const details = document.getElementById('report-details')?.value;
    const fileInput = document.getElementById('report-screenshot-input');
    
    alert(`Meldung eingereicht!\nGrund: ${reason}\nDetails: ${details || 'Keine'}\nScreenshot: ${fileInput?.files[0]?.name || 'Keiner angehängt'}`);
    
    document.getElementById('report-modal')?.classList.add('hidden');
    if(document.getElementById('report-details')) document.getElementById('report-details').value = '';
    if(fileInput) fileInput.value = '';
};

window.openCampusQuizModal = () => document.getElementById('quiz-modal')?.classList.remove('hidden');
window.closeCampusQuizModal = () => document.getElementById('quiz-modal')?.classList.add('hidden');

// Auth-Prüfung
async function checkAuthSession() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        const authGate = document.getElementById('auth-gate');
        const mainApp = document.getElementById('main-app');
        const profileBtn = document.getElementById('header-profile-btn');
        const logoutBtn = document.getElementById('logout-btn');

        if (session) {
            state.currentUserEmail = session.user.email;
            if (authGate) authGate.classList.add('hidden');
            if (mainApp) mainApp.classList.remove('hidden');
            if (profileBtn) profileBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            const { data: userData } = await _supabase
                .from('users')
                .select('is_admin, logic_score')
                .eq('email', session.user.email)
                .single();

            if (userData && userData.is_admin) {
                const badge = document.getElementById('score');
                if (badge) {
                    badge.classList.add('admin-badge');
                    badge.textContent = '👑 Admin';
                    badge.onclick = () => window.switchTab('admin');
                }
            }
        } else {
            state.currentUserEmail = null;
            if (authGate) authGate.classList.remove('hidden');
            if (mainApp) mainApp.classList.add('hidden');
            if (profileBtn) profileBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error('Session-Check Fehler:', err);
    }
}

// Event-Listener beim Laden der Seite
document.addEventListener('DOMContentLoaded', () => {
    checkAuthSession();

    const savedLang = localStorage.getItem('preferred_lang') || 'de';
    changeLanguage(savedLang);

    initQuiz();
    
    loadCampusFeed('foryou');

    const langSelector = document.getElementById('languageSelect');
    if (langSelector) {
        langSelector.value = savedLang;
        langSelector.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }

    const feedWrapper = document.getElementById('reels-list');
    if (feedWrapper) {
        let isScrolling = false;
        feedWrapper.addEventListener('wheel', (e) => {
            if (window.innerWidth < 768) return;
            e.preventDefault();
            if (isScrolling) return;

            const items = feedWrapper.querySelectorAll('.reel-item');
            if (!items.length) return;

            let currentIndex = 0;
            let minDistance = Infinity;
            items.forEach((item, index) => {
                const rect = item.getBoundingClientRect();
                const distance = Math.abs(rect.top);
                if (distance < minDistance) {
                    minDistance = distance;
                    currentIndex = index;
                }
            });

            if (e.deltaY > 0 && currentIndex < items.length - 1) {
                currentIndex++;
            } else if (e.deltaY < 0 && currentIndex > 0) {
                currentIndex--;
            }

            isScrolling = true;
            items[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { isScrolling = false; }, 400);
        }, { passive: false });
    }
});

// PWA Install Prompt Logik
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installAuthBtn = document.getElementById('install-app-auth-btn');
    const installDropdownBtn = document.getElementById('install-app-dropdown-btn');
    
    if (installAuthBtn) installAuthBtn.classList.remove('hidden');
    if (installDropdownBtn) installDropdownBtn.classList.remove('hidden');
});

window.installPWA = async function() {
    if (!deferredPrompt) {
        alert('Die App kann in diesem Browser nicht direkt installiert werden oder ist bereits installiert.');
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Installation Ergebnis: ${outcome}`);
    
    deferredPrompt = null;
    
    const installAuthBtn = document.getElementById('install-app-auth-btn');
    const installDropdownBtn = document.getElementById('install-app-dropdown-btn');
    
    if (installAuthBtn) installAuthBtn.classList.add('hidden');
    if (installDropdownBtn) installDropdownBtn.classList.add('hidden');
};