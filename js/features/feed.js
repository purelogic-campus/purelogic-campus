// js/features/feed.js - Vollständiges Campus-Feed & Medien Modul mit Autoren-Profilbildern & Follow-System
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let selectedMediaFile = null;
let observer = null;

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
 * Flash Drop beanspruchen (+50 Punkte)
 */
export async function claimActiveDrop() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um den Drop einzusammeln!');
        return;
    }
    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('logic_score')
            .eq('email', state.currentUserEmail)
            .single();

        if (userData) {
            const newScore = (userData.logic_score || 0) + 50;
            await _supabase
                .from('users')
                .update({ logic_score: newScore })
                .eq('email', state.currentUserEmail);

            const scoreBadge = document.getElementById('score');
            if (scoreBadge) scoreBadge.textContent = `${newScore} P`;
            
            alert('🎉 Flash Drop erfolgreich eingesammelt! +50 Punkte ⚡');
            const banner = document.getElementById('campus-drop-banner');
            if (banner) banner.style.display = 'none';
        }
    } catch (err) {
        console.error('Fehler beim Einlösen des Drops:', err);
        alert('Fehler beim Einsammeln des Drops.');
    }
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
 * Lädt die gewählte Datei hoch und speichert den Beitrag in Supabase (mit Moderations-Check)
 */
export async function uploadTrimmedMedia() {
    if (!selectedMediaFile) {
        alert('Bitte wähle zuerst eine Mediendatei aus.');
        return;
    }
    
    const caption = document.getElementById('media-caption-input')?.value || '';

    if (!validateInputOrAlert(caption)) {
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
 * Initialisiert den IntersectionObserver für automatisches Video-Autoplay im Sichtfeld
 */
function initVideoAutoplayObserver() {
    if (observer) observer.disconnect();

    const options = {
        root: document.getElementById('reels-list'),
        rootMargin: '0px',
        threshold: 0.6
    };

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                video.play().catch(err => {
                    console.warn('Autoplay wurde vom Browser blockiert:', err);
                });
            } else {
                video.pause();
            }
        });
    }, options);

    document.querySelectorAll('.reel-item').forEach(item => {
        observer.observe(item);
    });
}

/**
 * Lädt die Beiträge für den Campus-Feed basierend auf dem Filter (inkl. Autoren-Profilbildern)
 */
export async function loadCampusFeed(filter = 'foryou') {
    const feedList = document.getElementById('reels-list');
    if (!feedList) return;

    feedList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Campus-Feeds...</p>';

    let query = _supabase.from('media_posts').select('*');

    if (filter === 'following' && state.currentUserEmail) {
        const { data: follows } = await _supabase
            .from('follows')
            .select('following_email')
            .eq('follower_email', state.currentUserEmail);
            
        const followingEmails = follows ? follows.map(f => f.following_email) : [];
        followingEmails.push(state.currentUserEmail);
        
        query = query.in('author_email', followingEmails);
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

    for (const post of posts) {
        const item = document.createElement('div');
        item.className = 'reel-item';
        
        let mediaHtml = '';
        if (post.media_type === 'video') {
            mediaHtml = `<video src="${post.media_url}" muted playsinline loop class="reel-media" style="object-fit: contain; width: 100%; height: 100%;"></video>`;
        } else if (post.media_url) {
            mediaHtml = `<img src="${post.media_url}" class="reel-media" style="object-fit: contain; width: 100%; height: 100%;" alt="Post">`;
        }

        const cleanCaption = (post.caption && !post.caption.includes('${post.caption}')) ? post.caption : '';
        const authorEmail = post.author_email || 'student@uni.at';

        // Autorendaten (Profilbild & Name) aus der 'users'-Tabelle abrufen
        let authorName = authorEmail.split('@')[0];
        let authorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

        try {
            const { data: authorData } = await _supabase
                .from('users')
                .select('full_name, username, avatar_url')
                .eq('email', authorEmail)
                .maybeSingle();

            if (authorData) {
                authorName = authorData.full_name || authorData.username || authorName;
                if (authorData.avatar_url) authorAvatar = authorData.avatar_url;
            }
        } catch (e) {
            console.warn('Konnte Autor-Profil nicht laden:', e);
        }

        item.innerHTML = `
            ${mediaHtml}
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.9) 0%, rgba(9,13,22,0.2) 60%, transparent 100%);">
                <!-- Klickbare Autoreninfo mit Profilbild & Name oben links -->
                <div onclick="window.openPublicProfile('${authorEmail}')" style="display: flex; align-items: center; gap: 8px; background: rgba(19, 27, 46, 0.85); border: 1px solid rgba(129, 140, 248, 0.4); padding: 5px 12px; border-radius: 30px; cursor: pointer; margin-bottom: 6px; backdrop-filter: blur(5px);">
                    <img src="${authorAvatar}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary);" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
                    <span style="font-size: 12px; font-weight: 800; color: #fff;">${authorName}</span>
                </div>
                ${cleanCaption ? `<div style="font-size: 13px; color: #fff; font-weight: 600; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 6px;">💬 ${cleanCaption}</div>` : ''}
            </div>
        `;
        
        feedList.appendChild(item);
    }

    setTimeout(initVideoAutoplayObserver, 100);
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
            item.innerHTML = `<video src="${post.media_url}" muted playsinline style="width: 100%; height: 100px; object-fit: contain; background: #000;"></video>`;
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
 * Öffnet das öffentliche Profil eines beliebigen Nutzers per E-Mail und zeigt Follow-Button an
 */
window.openPublicProfile = async function(email) {
    if (!email) return;
    
    const modal = document.getElementById('public-profile-modal');
    if (modal) modal.classList.remove('hidden');

    const avatar = document.getElementById('pub-profile-avatar');
    const fullname = document.getElementById('pub-profile-fullname');
    const handle = document.getElementById('pub-profile-handle');
    const uni = document.getElementById('pub-profile-uni');
    const score = document.getElementById('pub-profile-score');
    const bio = document.getElementById('pub-profile-bio');
    const badgeContainer = document.getElementById('pub-profile-badge-container');
    const postsGrid = document.getElementById('pub-profile-posts-grid');

    if (fullname) fullname.textContent = 'Lädt...';
    if (postsGrid) postsGrid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Lade Beiträge...</p>';

    let followBtnContainer = document.getElementById('pub-profile-follow-container');
    if (!followBtnContainer && fullname && fullname.parentNode) {
        followBtnContainer = document.createElement('div');
        followBtnContainer.id = 'pub-profile-follow-container';
        followBtnContainer.style.cssText = 'margin-top: 8px;';
        fullname.parentNode.appendChild(followBtnContainer);
    }

    if (followBtnContainer && state.currentUserEmail && state.currentUserEmail !== email) {
        const { data: existingFollow } = await _supabase
            .from('follows')
            .select('*')
            .eq('follower_email', state.currentUserEmail)
            .eq('following_email', email)
            .maybeSingle();

        const isFollowing = !!existingFollow;
        followBtnContainer.innerHTML = `
            <button onclick="window.toggleFollowUser('${email}')" class="btn" style="padding: 6px 14px; font-size: 11px; font-weight: 800; background: ${isFollowing ? 'var(--card)' : 'var(--gradient-main)'}; border: ${isFollowing ? '1px solid var(--border)' : 'none'}; color: ${isFollowing ? 'var(--text)' : '#fff'}; width: auto; margin-top: 0;">
                ${isFollowing ? '✓ Gefolgt' : '+ Folgen'}
            </button>
        `;
    } else if (followBtnContainer) {
        followBtnContainer.innerHTML = '';
    }

    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userData) {
            if (avatar) avatar.src = userData.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
            if (fullname) fullname.textContent = userData.full_name || email.split('@')[0];
            if (handle) handle.textContent = '@' + (userData.username || email.split('@')[0]);
            if (uni) uni.textContent = userData.university || 'Universität Wien';
            if (score) score.textContent = `${userData.logic_score || 0} P`;
            if (bio) bio.textContent = userData.bio || 'Keine Bio hinterlegt.';

            if (badgeContainer) {
                if (userData.is_verified_student) {
                    badgeContainer.innerHTML = `<span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; margin-top: 2px;">🎓 Verified Student (.ac.at)</span>`;
                } else {
                    badgeContainer.innerHTML = '';
                }
            }
        } else {
            if (fullname) fullname.textContent = email.split('@')[0];
            if (handle) handle.textContent = '@' + email.split('@')[0];
            if (bio) bio.textContent = 'Kein Profil in der Datenbank gefunden.';
        }

        const { data: userPosts } = await _supabase
            .from('media_posts')
            .select('*')
            .eq('author_email', email)
            .order('created_at', { ascending: false });

        if (postsGrid) {
            if (!userPosts || userPosts.length === 0) {
                postsGrid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted); grid-column: span 3;">Keine Beiträge vorhanden.</p>';
            } else {
                postsGrid.innerHTML = '';
                userPosts.forEach(post => {
                    const postItem = document.createElement('div');
                    postItem.style.cssText = 'background: #000; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; height: 90px;';
                    if (post.media_type === 'video') {
                        postItem.innerHTML = `<video src="${post.media_url}" muted style="width: 100%; height: 100%; object-fit: cover;"></video>`;
                    } else {
                        postItem.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Post">`;
                    }
                    postsGrid.appendChild(postItem);
                });
            }
        }

    } catch (err) {
        console.error('Fehler beim Laden des öffentlichen Profils:', err);
    }
};

/**
 * Umschalten der Follow-Beziehung (Folgen / Entfolgen)
 */
window.toggleFollowUser = async function(targetEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um anderen Nutzern zu folgen.');
        return;
    }

    try {
        const { data: existing } = await _supabase
            .from('follows')
            .select('*')
            .eq('follower_email', state.currentUserEmail)
            .eq('following_email', targetEmail)
            .maybeSingle();

        if (existing) {
            await _supabase
                .from('follows')
                .delete()
                .eq('follower_email', state.currentUserEmail)
                .eq('following_email', targetEmail);
            
            alert(`Du folgst ${targetEmail} nicht mehr.`);
        } else {
            await _supabase
                .from('follows')
                .insert([
                    {
                        id: crypto.randomUUID(),
                        follower_email: state.currentUserEmail,
                        following_email: targetEmail,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            alert(`Du folgst jetzt ${targetEmail} 🚀`);
        }

        window.openPublicProfile(targetEmail);

    } catch (err) {
        console.error('Fehler beim Follow-Wechsel:', err);
        alert('Fehler: ' + err.message);
    }
};

window.closePublicProfileModal = function() {
    document.getElementById('public-profile-modal')?.classList.add('hidden');
};

/**
 * Setzt den aktiven Reel-Filter ("Entdecken", "Für dich", "Gefolgt")
 */
export function setReelFilter(filterType) {
    state.currentReelFilter = filterType;
    document.querySelectorAll('.feed-filter-bar span').forEach(s => s.style.color = 'var(--text-muted)');
    
    if (filterType === 'foryou') {
        const el = document.getElementById('subtab-foryou');
        if (el) el.style.color = 'var(--primary)';
    } else if (filterType === 'discover') {
        const el = document.getElementById('subtab-discover');
        if (el) el.style.color = 'var(--primary)';
    } else if (filterType === 'following') {
        const el = document.getElementById('subtab-following');
        if (el) el.style.color = 'var(--primary)';
    }
    
    loadCampusFeed(filterType);
}

/**
 * Filter-Funktion für Treffen
 */
export function setFilter(element, category) {
    document.querySelectorAll('#filter-group .cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

// Global für HTML-Events bereitstellen
window.openUploadModal = openUploadModal;
window.closeMediaUploadModal = closeMediaUploadModal;
window.handleMediaSelection = handleMediaSelection;
window.uploadTrimmedMedia = uploadTrimmedMedia;
window.loadCampusFeed = loadCampusFeed;
window.loadMyProfilePosts = loadMyProfilePosts;
window.setReelFilter = setReelFilter;
window.setFilter = setFilter;
window.claimActiveDrop = claimActiveDrop;