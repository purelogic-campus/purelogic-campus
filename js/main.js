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

// Prüft beim Start, ob der Nutzer eingeloggt ist
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
    console.log("PURE LOGIC • GenZ Campus erfolgreich modular geladen.");
    
    // Session prüfen
    checkAuthSession();

    // Gespeicherte Sprache beim Start laden
    const savedLang = localStorage.getItem('preferred_lang') || 'de';
    changeLanguage(savedLang);

    // Quiz initialisieren
    initQuiz();

    // Event-Listener für Sprachauswahl
    const langSelector = document.getElementById('languageSelect');
    if (langSelector) {
        langSelector.value = savedLang;
        langSelector.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }
});