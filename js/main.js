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

    // Wenn der Profil-Tab geöffnet wird, eigene Beiträge laden
    if (tabId === 'profile' && typeof window.loadMyProfilePosts === 'function') {
        window.loadMyProfilePosts();
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

window.openActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.remove('hidden');
window.closeActiveSpotsModal = () => document.getElementById('active-spots-modal')?.classList.add('hidden');
window.openMorePointsModal = () => document.getElementById('more-points-modal')?.classList.remove('hidden');
window.closeMorePointsModal = () => document.getElementById('more-points-modal')?.classList.add('hidden');
window.openCrushModal = () => document.getElementById('crush-modal')?.classList.remove('hidden');
window.closeCrushModal = () => document.getElementById('crush-modal')?.classList.add('hidden');
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

// ==========================================
// PWA INSTALLATION (DOWNLOAD BUTTON LOGIK)
// ==========================================
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

window.addEventListener('appinstalled', () => {
    console.log('App wurde erfolgreich auf dem Gerät installiert!');
});

// ==========================================
// PUNKT 17: DIREKTER MEDIEN-UPLOAD & VIDEO-PRÜFUNG
// ==========================================
let selectedMediaFile = null;

window.openUploadModal = function() {
    document.getElementById('media-upload-modal')?.classList.remove('hidden');
};

window.closeMediaUploadModal = function() {
    document.getElementById('media-upload-modal')?.classList.add('hidden');
    selectedMediaFile = null;
    const preview = document.getElementById('trim-video-preview');
    if (preview) preview.src = '';
    document.getElementById('trimmer-container')?.classList.add('hidden');
    const fileInput = document.getElementById('media-file-input');
    if (fileInput) fileInput.value = '';
    const captionInput = document.getElementById('media-caption-input');
    if (captionInput) captionInput.value = '';
};

window.handleMediaSelection = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedMediaFile = file;
    const trimmerContainer = document.getElementById('trimmer-container');
    const videoPreview = document.getElementById('trim-video-preview');
    const infoText = document.getElementById('video-duration-info');
    
    if (file.type.startsWith('video/')) {
        trimmerContainer.classList.remove('hidden');
        const fileURL = URL.createObjectURL(file);
        videoPreview.src = fileURL;
        
        videoPreview.onloadedmetadata = function() {
            const duration = Math.round(videoPreview.duration);
            if (duration > 30) {
                infoText.textContent = `⚠️ Achtung: Das Video ist ${duration}s lang (Empfohlen: max. 30s).`;
                infoText.style.color = '#ef4444';
            } else {
                infoText.textContent = `Dauer: ${duration}s (Perfekte Länge 🚀)`;
                infoText.style.color = '#10b981';
            }
        };
    } else {
        trimmerContainer.classList.add('hidden');
    }
};

window.uploadTrimmedMedia = async function() {
    if (!selectedMediaFile) {
        alert('Bitte wähle zuerst eine Mediendatei aus.');
        return;
    }
    
    const caption = document.getElementById('media-caption-input')?.value || '';
    const fileExt = selectedMediaFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `campus-uploads/${fileName}`;

    try {
        // 1. Datei in Supabase Storage hochladen
        const { error: uploadError } = await _supabase.storage
            .from('media')
            .upload(filePath, selectedMediaFile);

        if (uploadError) {
            console.error('Upload-Fehler:', uploadError.message);
            alert('Fehler beim Hochladen der Datei.');
            return;
        }

        // 2. Öffentliche URL der Datei abrufen
        const { data: publicURLData } = _supabase.storage
            .from('media')
            .getPublicUrl(filePath);

        const mediaUrl = publicURLData.publicUrl;

        // 3. Beitrag in der Datenbank speichern
        const { error: dbError } = await _supabase
            .from('posts')
            .insert([
                { 
                    email: state.currentUserEmail, 
                    caption: caption, 
                    media_url: mediaUrl, 
                    media_type: selectedMediaFile.type.startsWith('video/') ? 'video' : 'image',
                    created_at: new Date()
                }
            ]);

        if (dbError) {
            console.error('Datenbank-Fehler:', dbError.message);
        }

        alert('Erfolgreich hochgeladen! Du kannst deinen Beitrag jetzt im Profil sehen 🚀');
        window.closeMediaUploadModal();
        
        // Profil-Beiträge aktualisieren
        if (typeof window.loadMyProfilePosts === 'function') {
            window.loadMyProfilePosts();
        }

    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
};

// Eigene Beiträge im Profil laden und anzeigen
window.loadMyProfilePosts = async function() {
    const grid = document.getElementById('my-profile-posts-grid');
    if (!grid || !state.currentUserEmail) return;

    grid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Lade deine Beiträge...</p>';

    const { data: posts, error } = await _supabase
        .from('posts')
        .select('*')
        .eq('email', state.currentUserEmail)
        .order('created_at', { ascending: false });

    if (error || !posts || posts.length === 0) {
        grid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Noch keine eigenen Beiträge vorhanden.</p>';
        return;
    }

    grid.innerHTML = '';
    posts.forEach(post => {
        const item = document.createElement('div');
        item.style.cssText = 'background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;';
        
        if (post.media_type === 'video') {
            item.innerHTML = `<video src="${post.media_url}" controls style="width: 100%; height: 100px; object-fit: cover; background: #000;"></video>`;
        } else {
            item.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 100px; object-fit: cover;" alt="Post">`;
        }
        
        if (post.caption) {
            item.innerHTML += `<div style="padding: 6px; font-size: 10px; color: var(--text);">${post.caption}</div>`;
        }
        
        grid.appendChild(item);
    });
};