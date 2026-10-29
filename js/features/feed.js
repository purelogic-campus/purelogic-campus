// js/features/feed.js - Vollständiges Campus-Feed & Medien Modul
import { _supabase } from '../config.js';
import { state } from '../state.js';

let selectedMediaFile = null;

/**
 * Bild-Skalierung und Komprimierung über Canvas (Standardisierung auf max 1080px)
 */
export function processAndResizeImage(file, maxDimension = 1080) {
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

/**
 * Öffnet das Medien-Upload-Modal
 */
export function openUploadModal() {
    document.getElementById('media-upload-modal')?.classList.remove('hidden');
}

/**
 * Schließt das Upload-Modal und setzt Eingaben zurück
 */
export function closeMediaUploadModal() {
    document.getElementById('media-upload-modal')?.classList.add('hidden');
    selectedMediaFile = null;
    const preview = document.getElementById('trim-video-preview');
    if (preview) preview.src = '';
    document.getElementById('trimmer-container')?.classList.add('hidden');
    const fileInput = document.getElementById('media-file-input');
    if (fileInput) fileInput.value = '';
    const captionInput = document.getElementById('media-caption-input');
    if (captionInput) captionInput.value = '';
}

/**
 * Verarbeitet die Dateiauswahl (Bilder / Videos)
 */
export function handleMediaSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedMediaFile = file;
    const trimmerContainer = document.getElementById('trimmer-container');
    const videoPreview = document.getElementById('trim-video-preview');
    const infoText = document.getElementById('video-duration-info');
    
    if (file.type.startsWith('video/')) {
        trimmerContainer?.classList.remove('hidden');
        const fileURL = URL.createObjectURL(file);
        if (videoPreview) videoPreview.src = fileURL;
        
        if (videoPreview) {
            videoPreview.onloadedmetadata = function() {
                const duration = Math.round(videoPreview.duration);
                if (infoText) {
                    if (duration > 30) {
                        infoText.textContent = `⚠️ Achtung: Das Video ist ${duration}s lang (Empfohlen: max. 30s).`;
                        infoText.style.color = '#ef4444';
                    } else {
                        infoText.textContent = `Dauer: ${duration}s (Perfekte Länge 🚀)`;
                        infoText.style.color = '#10b981';
                    }
                }
            };
        }
    } else {
        trimmerContainer?.classList.add('hidden');
    }
}

/**
 * Lädt die gewählte Datei hoch und speichert den Beitrag in Supabase
 */
export async function uploadTrimmedMedia() {
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
        closeMediaUploadModal();
        
        loadCampusFeed(state.currentReelFilter || 'foryou');
        loadMyProfilePosts();

    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
}

/**
 * Lädt die Beiträge für den Campus-Feed basierend auf dem Filter
 */
export async function loadCampusFeed(filter = 'foryou') {
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
}

/**
 * Lädt die eigenen Beiträge des angemeldeten Benutzers für das Profil
 */
export async function loadMyProfilePosts() {
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
}

/**
 * Setzt den aktiven Reel-Filter ("Entdecken", "Für dich", "Gefolgt")
 */
export function setReelFilter(filterType) {
    state.currentReelFilter = filterType;
    document.querySelectorAll('.reel-pill').forEach(p => p.classList.remove('active'));
    
    const pill = document.getElementById('reel-filter-' + filterType);
    if (pill) pill.classList.add('active');
    
    loadCampusFeed(filterType);
}

// Global für HTML-Events bereitstellen
window.openUploadModal = openUploadModal;
window.closeMediaUploadModal = closeMediaUploadModal;
window.handleMediaSelection = handleMediaSelection;
window.uploadTrimmedMedia = uploadTrimmedMedia;
window.loadCampusFeed = loadCampusFeed;
window.loadMyProfilePosts = loadMyProfilePosts;
window.setReelFilter = setReelFilter;