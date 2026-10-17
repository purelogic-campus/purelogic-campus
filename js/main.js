// js/main.js - Vollständige angepasste Datei mit Canvas-Standardizer & PC-Mausrad-Snap-Scroll
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

    if (tabId === 'profile' && typeof window.loadMyProfilePosts === 'function') {
        window.loadMyProfilePosts();
    }
    if (tabId === 'reels' && typeof window.loadCampusFeed === 'function') {
        window.loadCampusFeed();
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
window.openCampusQuizModal = () => document.getElementById('quiz-modal')?.classList.remove('hidden');
window.closeCampusQuizModal = () => document.getElementById('quiz-modal')?.classList.add('hidden');

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
    
    if (typeof window.loadCampusFeed === 'function') {
        window.loadCampusFeed();
    }

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

let selectedMediaFile = null;

function processAndResizeImage(file, maxDimension = 1080) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const resizedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(resizedFile);
                    } else {
                        reject(new Error('Canvas conversion failed'));
                    }
                }, 'image/jpeg', 0.88);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

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
    
    let fileToUpload = selectedMediaFile;

    if (selectedMediaFile.type.startsWith('image/')) {
        try {
            fileToUpload = await processAndResizeImage(selectedMediaFile, 1080);
        } catch (resizeErr) {
            console.warn('Bild-Skalierung fehlgeschlagen, benutze Originaldatei:', resizeErr);
        }
    }

    const caption = document.getElementById('media-caption-input')?.value || '';
    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `campus-uploads/${fileName}`;

    try {
        const { error: uploadError } = await _supabase.storage
            .from('media')
            .upload(filePath, fileToUpload);

        if (uploadError) {
            console.error('Upload-Fehler:', uploadError.message);
            alert('Fehler beim Hochladen der Datei in den Speicher.');
            return;
        }

        const { data: publicURLData } = _supabase.storage
            .from('media')
            .getPublicUrl(filePath);

        const mediaUrl = publicURLData.publicUrl;

        const { error: dbError } = await _supabase
            .from('media_posts')
            .insert([
                { 
                    id: crypto.randomUUID(),
                    author_email: state.currentUserEmail || 'student@uni.at', 
                    caption: caption, 
                    media_url: mediaUrl, 
                    media_type: selectedMediaFile.type.startsWith('video/') ? 'video' : 'image',
                    created_at: new Date().toISOString()
                }
            ]);

        if (dbError) {
            console.error('Datenbank-Fehler:', dbError.message);
            alert('Fehler beim Speichern in der Datenbank: ' + dbError.message);
            return;
        }

        alert('Erfolgreich hochgeladen! Dein Beitrag ist jetzt im Feed & Profil sichtbar 🚀');
        window.closeMediaUploadModal();
        
        if (typeof window.loadCampusFeed === 'function') window.loadCampusFeed();
        if (typeof window.loadMyProfilePosts === 'function') window.loadMyProfilePosts();

    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
};

window.loadCampusFeed = async function() {
    const feedList = document.getElementById('reels-list');
    if (!feedList) return;

    feedList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Campus-Feeds...</p>';

    const { data: posts, error } = await _supabase
        .from('media_posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !posts || posts.length === 0) {
        feedList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Noch keine Beiträge im Campus-Feed vorhanden.</p>';
        return;
    }

    feedList.innerHTML = '';

    posts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'reel-item';
        
        let mediaHtml = '';
        if (post.media_type === 'video') {
            mediaHtml = `<video src="${post.media_url}" controls class="reel-media" style="object-fit: contain; width: 100%; height: 100%;"></video>`;
        } else if (post.media_url) {
            mediaHtml = `<img src="${post.media_url}" class="reel-media" style="object-fit: contain; width: 100%; height: 100%;" alt="Post">`;
        }

        const cleanCaption = (post.caption && !post.caption.includes('\${post.caption}')) ? post.caption : '';

        item.innerHTML = `
            ${mediaHtml}
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.9) 0%, rgba(9,13,22,0.2) 60%, transparent 100%);">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">👤 ${post.author_email || 'Anonym'}</div>
                ${cleanCaption ? `<div style="font-size: 13px; color: #fff; font-weight: 600;">\${cleanCaption}</div>` : ''}
            </div>
        `;
        
        feedList.appendChild(item);
    });
};

window.loadMyProfilePosts = async function() {
    const grid = document.getElementById('my-profile-posts-grid');
    if (!grid || !state.currentUserEmail) return;

    grid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Lade deine Beiträge...</p>';

    const { data: posts, error } = await _supabase
        .from('media_posts')
        .select('*')
        .eq('author_email', state.currentUserEmail)
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
            item.innerHTML = `<video src="${post.media_url}" controls style="width: 100%; height: 100px; object-fit: contain; background: #000;"></video>`;
        } else {
            item.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 100px; object-fit: contain; background: #000;" alt="Post">`;
        }
        
        const cleanCaption = (post.caption && !post.caption.includes('\${post.caption}')) ? post.caption : '';
        if (cleanCaption) {
            item.innerHTML += `<div style="padding: 6px; font-size: 10px; color: var(--text);">${cleanCaption}</div>`;
        }
        
        grid.appendChild(item);
    });
};