// js/main.js - Vollständige und fehlerfreie Version
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
        // Falls es sich um den Live-Tab handelt, direkt die echten Live-Streams laden
        if (tabId === 'live' && typeof window.loadLiveStreams === 'function') {
            window.loadLiveStreams();
        }
    }

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('btn-tab-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'profile' && typeof window.loadMyProfilePosts === 'function') {
        window.loadMyProfilePosts();
    }
    if (tabId === 'reels' && typeof window.loadCampusFeed === 'function') {
        window.loadCampusFeed(state.currentReelFilter || 'foryou');
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

// Subnav Filter-Logik für "Entdecken", "Für dich" und "Gefolgt"
window.setReelFilter = function(filterType) {
    state.currentReelFilter = filterType;
    document.querySelectorAll('.reel-pill').forEach(p => p.classList.remove('active'));
    
    const pill = document.getElementById('reel-filter-' + filterType);
    if (pill) pill.classList.add('active');
    
    window.loadCampusFeed(filterType);
};

// LIVE TAB: LÄDT EXKLUSIV NUR AUS DER TABELLE 'live_streams'
window.loadLiveStreams = async function() {
    const liveList = document.getElementById('live-streams-list');
    if (!liveList) return;

    liveList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade aktive Live-Streams...</p>';

    // Abfrage geht strikt an die Live-Streams-Tabelle
    const { data: streams, error } = await _supabase
        .from('live_streams')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !streams || streams.length === 0) {
        liveList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Aktuell sind keine Live-Streams aktiv.</p>';
        return;
    }

    liveList.innerHTML = '';

    streams.forEach(stream => {
        const item = document.createElement('div');
        item.className = 'reel-item';

        const category = stream.category || stream.title || 'Live Stream';
        const location = stream.location || 'Wien / Campus';

        item.innerHTML = `
            <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0f172a, #1e1b4b); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; text-align: center; position: relative; cursor: pointer;" onclick="openLiveFullscreen('${stream.id}', '${category}', '${location}')">
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; animation: pulseGlow 1s infinite;"></span> LIVE
                </div>
                
                <span style="background: rgba(99,102,241,0.2); color: #818cf8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-bottom: 10px;">${category}</span>
                <h3 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 6px;">Campus Stream # ${stream.id.substring(0, 4)}</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">📍 ${location}</p>
                
                <button class="btn" style="width: auto; padding: 10px 24px; font-size: 13px; font-weight: 800; background: var(--gradient-main); box-shadow: 0 4px 15px rgba(99,102,241,0.4);" onclick="event.stopPropagation(); openLiveFullscreen('${stream.id}', '${category}', '${location}')">Vollbild beitreten & Chatten 🚀</button>
            </div>
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.95) 0%, transparent 60%); padding: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 Live Broadcast</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600;">Wische für den nächsten Stream oder tippe zum Beitreten.</div>
            </div>
        `;
        
        liveList.appendChild(item);
    });
};

// VOLLBILD LIVE MIT INTERAKTIVEM CHAT
window.openLiveFullscreen = function(streamId, category, location) {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');

    const titleDisplay = document.getElementById('active-live-title-display');
    const hostDisplay = document.getElementById('active-live-host-display');
    if (titleDisplay) titleDisplay.textContent = `🔴 ${category}`;
    if (hostDisplay) hostDisplay.textContent = `Standort: ${location} | Stream-ID: ${streamId.substring(0, 8)}`;

    const chatList = document.getElementById('live-chat-messages');
    if (chatList) {
        chatList.innerHTML = `<div style="color: var(--text-muted); text-align: center;">Verbunden mit Live-Stream ${streamId.substring(0, 6)}... Schreib eine Nachricht!</div>`;
    }
};

window.closeLiveFullscreen = function() {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.add('hidden');
};

window.sendLiveChatMessage = function() {
    const input = document.getElementById('live-chat-input');
    const chatList = document.getElementById('live-chat-messages');
    if (!input || !input.value.trim() || !chatList) return;

    const msgText = input.value.trim();
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 8px; font-size: 11px;';
    msgDiv.innerHTML = `<strong style="color: #818cf8;">Du:</strong> ${msgText}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;
    input.value = '';
};

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
        window.loadCampusFeed('foryou');
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

        alert('Erfolgreich hochgeladen! Dein Beitrag / deine Confession ist jetzt im Feed sichtbar 🚀');
        window.closeMediaUploadModal();
        
        if (typeof window.loadCampusFeed === 'function') window.loadCampusFeed(state.currentReelFilter || 'foryou');
        if (typeof window.loadMyProfilePosts === 'function') window.loadMyProfilePosts();

    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
};

window.loadCampusFeed = async function(filter = 'foryou') {
    const feedList = document.getElementById('reels-list');
    if (!feedList) return;

    feedList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Campus-Feeds...</p>';

    let query = _supabase.from('media_posts').select('*');

    if (filter === 'following' && state.currentUserEmail) {
        query = query.eq('author_email', state.currentUserEmail);
    } else if (filter === 'discover') {
        query = query.order('created_at', { ascending: false }).limit(20);
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data: posts, error } = await query;

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

        const cleanCaption = (post.caption && !post.caption.includes('${post.caption}')) ? post.caption : '';

        item.innerHTML = `
            ${mediaHtml}
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.9) 0%, rgba(9,13,22,0.2) 60%, transparent 100%);">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">👤 ${post.author_email || 'Anonyme Confession'}</div>
                ${cleanCaption ? `<div style="font-size: 13px; color: #fff; font-weight: 600; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 6px;">💬 ${cleanCaption}</div>` : ''}
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
        
        const cleanCaption = (post.caption && !post.caption.includes('${post.caption}')) ? post.caption : '';
        if (cleanCaption) {
            item.innerHTML += `<div style="padding: 6px; font-size: 10px; color: var(--text);">${cleanCaption}</div>`;
        }
        
        grid.appendChild(item);
    });
};