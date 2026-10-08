// js/main.js
import './config.js'; // <-- WICHTIG: Initialisiert Supabase als Erstes
import { state } from './state.js';
import { changeLanguage } from './i18n.js';
import { handleLogin, handleSignup, resetUser, handleForgotPassword, togglePasswordVisibility } from './auth.js';
import { toggleLectureMode } from './features/lecture.js';
import { initQuiz } from './features/quiz.js';
import { openProfGuideModal, closeProfGuideModal } from './features/profguide.js';

// Funktionen global verfügbar machen (für HTML onclick-Attribute)
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.resetUser = resetUser;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleLectureMode = toggleLectureMode;
window.openProfGuideModal = openProfGuideModal;
window.closeProfGuideModal = closeProfGuideModal;

document.addEventListener('DOMContentLoaded', () => {
    console.log("PURE LOGIC • GenZ Campus erfolgreich modular geladen.");
    
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