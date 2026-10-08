// js/main.js
import { _supabase } from './config.js';
import { state } from './state.js';
import { changeLanguage } from './i18n.js';
import { handleLogin, handleSignup, resetUser, handleForgotPassword, togglePasswordVisibility } from './auth.js';
import { toggleLectureMode } from './features/lecture.js';
import { initQuiz } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal } from './features/profguide.js';

// Global verfügbar machen für HTML onclick-Attribute
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.resetUser = resetUser;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleLectureMode = toggleLectureMode;
window.openProfGuideModal = openProfGuideModal;
window.closeProfGuideModal = closeProfGuideModal;

// UI Hilfsfunktionen
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab-' + tabId);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-tab-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');
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

window.openActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.remove('hidden');
window.closeActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.add('hidden');
window.openMorePointsModal = () => document.getElementById('more-points-modal')?.classList.remove('hidden');
window.closeMorePointsModal = () => document.getElementById('more-points-modal')?.classList.add('hidden');
window.openCrushModal = () => document.getElementById('crush-modal')?.classList.remove('hidden');
window.closeCrushModal = () => document.getElementById('crush-modal')?.classList.add('hidden');
window.openUploadModal = () => alert('Upload-Funktion wird geöffnet...');
window.openReportModal = () => alert('Inhalt melden Modal');
window.openImpressumModal = () => alert('Impressum: Pure Logic Campus');
window.openAgbModal = () => alert('AGB: Pure Logic Campus');

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

document.addEventListener('DOMContentLoaded', () => {
    checkAuthSession();

    const savedLang = localStorage.getItem('preferred_lang') || 'de';
    changeLanguage(savedLang);

    initQuiz();

    const langSelector = document.getElementById('languageSelect');
    if (langSelector) {
        langSelector.value = savedLang;
        langSelector.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }
});