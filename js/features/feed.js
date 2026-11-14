// js/features/feed.js - Vollständiges Campus-Feed & Medien Modul mit Autoren-Infos, Kommentaren & Like-Listen
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let selectedMediaFile = null;
let observer = null;
let activeCommentPostId = null;

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
                    views: 0,
                    liked_by: [],
                    created_at: new Date().toISOString()
                }
            ]);

        if (dbError) {
            console.error('Datenbank-Fehler:', dbError.message);
            alert('Fehler beim Speichern in der Datenbank: ' + dbError.message);
            return;
        }

        alert('Erfolgreich hochgeladen! Dein Beitrag ist jetzt im Feed sichtbar 🚀');
        closeMediaUploadModal();
        
        loadCampusFeed(state.currentReelFilter || 'foryou');
        loadMyProfilePosts();

    } catch (err) {
        console.error('Unerwarteter Fehler:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten.');
    }
}

/**
 * Erhöht die Aufrufe (Views) eines Beitrags beim Sichtbarwerden im Feed
 */
async function incrementPostView(postId) {
    try {
        const { data } = await _supabase
            .from('media_posts')
            .select('views')
            .eq('id', postId)
            .single();

        if (data) {
            const newViews = (data.views || 0) + 1;
            await _supabase
                .from('media_posts')
                .update({ views: newViews })
                .eq('id', postId);
        }
    } catch (e) {
        console.warn('View-Counter Fehler:', e);
    }
}

/**
 * Liked einen Beitrag und aktualisiert die Liker-Liste
 */
window.likePost = async function(postId) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um Beiträge zu liken.');
        return;
    }

    try {
        const { data: postData } = await _supabase
            .from('media_posts')
            .select('liked_by')
            .eq('id', postId)
            .single();

        let likedByList = postData?.liked_by || [];
        if (!Array.isArray(likedByList)) likedByList = [];

        const index = likedByList.indexOf(state.currentUserEmail);
        if (index > -1) {
            likedByList.splice(index, 1);
        } else {
            likedByList.push(state.currentUserEmail);
        }

        await _supabase
            .from('media_posts')
            .update({ liked_by: likedByList })
            .eq('id', postId);

        const likeCountEl = document.getElementById(`like-count-${postId}`);
        if (likeCountEl) likeCountEl.textContent = `${likedByList.length} ❤️`;

    } catch (err) {
        console.warn('Like-Fehler:', err);
    }
};

/**
 * Öffnet das Modal, um zu sehen, wer diesen Beitrag geliked hat
 */
window.openLikesModal = async function(postId) {
    const modal = document.getElementById('dynamic-info-modal') || createInfoModal();
    const title = document.getElementById('dynamic-modal-title');
    const content = document.getElementById('dynamic-modal-content');

    if (title) title.textContent = 'Geliked von ❤️';
    if (content) content.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Lade Personen...</p>';
    modal.classList.remove('hidden');

    try {
        const { data: postData } = await _supabase
            .from('media_posts')
            .select('liked_by')
            .eq('id', postId)
            .single();

        const likedByList = postData?.liked_by || [];
        if (likedByList.length === 0) {
            content.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Noch keine Likes für diesen Beitrag.</p>';
            return;
        }

        content.innerHTML = '<div style="display: flex; flex-direction: column; gap: 8px;"></div>';
        const listContainer = content.firstElementChild;

        for (const email of likedByList) {
            let name = email.split('@')[0];
            let avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

            const { data: userData } = await _supabase
                .from('users')
                .select('full_name, username, avatar_url')
                .eq('email', email)
                .maybeSingle();

            if (userData) {
                name = userData.full_name || userData.username || name;
                if (userData.avatar_url) avatar = userData.avatar_url;
            }

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 8px; cursor: pointer;';
            item.onclick = () => {
                modal.classList.add('hidden');
                window.openPublicProfile(email);
            };
            item.innerHTML = `
                <img src="${avatar}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary);">
                <span style="font-size: 13px; font-weight: 700; color: #fff;">${name}</span>
            `;
            listContainer.appendChild(item);
        }
    } catch (err) {
        console.error('Fehler beim Laden der Likes:', err);
    }
};

/**
 * Öffnet das Kommentar-Modal für einen spezifischen Beitrag
 */
window.openCommentsModal = async function(postId) {
    activeCommentPostId = postId;
    const modal = document.getElementById('comments-modal') || createCommentsModal();
    modal.classList.remove('hidden');
    await loadCommentsForPost(postId);
};

/**
 * Lädt alle Kommentare für einen Beitrag und zeigt sie im Modal an
 */
async function loadCommentsForPost(postId) {
    const listContainer = document.getElementById('comments-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center;">Lade Kommentare...</p>';

    try {
        const { data: comments, error } = await _supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error || !comments || comments.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Noch keine Kommentare. Schreib den ersten! 💬</p>';
            return;
        }

        listContainer.innerHTML = '';

        for (const c of comments) {
            let authorName = c.author_email.split('@')[0];
            let authorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

            const { data: userData } = await _supabase
                .from('users')
                .select('full_name, username, avatar_url')
                .eq('email', c.author_email)
                .maybeSingle();

            if (userData) {
                authorName = userData.full_name || userData.username || authorName;
                if (userData.avatar_url) authorAvatar = userData.avatar_url;
            }

            const commentItem = document.createElement('div');
            commentItem.style.cssText = 'display: flex; gap: 10px; background: rgba(255,255,255,0.04); padding: 10px; border-radius: 10px; align-items: flex-start;';
            commentItem.innerHTML = `
                <img src="${authorAvatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary); cursor: pointer;" onclick="document.getElementById('comments-modal').classList.add('hidden'); window.openPublicProfile('${c.author_email}')">
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; font-weight: 800; color: #818cf8; cursor: pointer;" onclick="document.getElementById('comments-modal').classList.add('hidden'); window.openPublicProfile('${c.author_email}')">${authorName}</span>
                        <span style="font-size: 10px; color: var(--text-muted);">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style="font-size: 12px; color: #fff; margin: 0; word-break: break-word;">${c.comment_text}</p>
                </div>
            `;
            listContainer.appendChild(commentItem);
        }
    } catch (err) {
        console.error('Fehler beim Laden der Kommentare:', err);
    }
}

/**
 * Sendet einen neuen Kommentar ab (inkl. Moderations-Check)
 */
window.submitNewComment = async function() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um zu kommentieren.');
        return;
    }
    if (!activeCommentPostId) return;

    const input = document.getElementById('new-comment-input');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();

    if (!validateInputOrAlert(text)) {
        return;
    }

    try {
        const { error } = await _supabase
            .from('comments')
            .insert([
                {
                    id: crypto.randomUUID(),
                    post_id: activeCommentPostId,
                    author_email: state.currentUserEmail,
                    comment_text: text,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        input.value = '';
        await loadCommentsForPost(activeCommentPostId);

        const { count } = await _supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', activeCommentPostId);

        const commentCountEl = document.getElementById(`comment-count-${activeCommentPostId}`);
        if (commentCountEl) commentCountEl.textContent = `${count || 0} 💬`;

    } catch (err) {
        alert('Fehler beim Senden des Kommentars: ' + err.message);
    }
};

/**
 * Hilfsfunktion zum Erstellen des Kommentar-Modals
 */
function createCommentsModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'comments-modal';
    modalDiv.className = 'hidden';
    modalDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);';
    modalDiv.innerHTML = `
        <div style="background: var(--card); border: 1px solid var(--border); width: 90%; max-width: 450px; height: 80vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 15px; font-weight: 900; color: #fff; margin: 0;">Beitrag Kommentare 💬</h3>
                <button onclick="document.getElementById('comments-modal').classList.add('hidden')" style="background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <div id="comments-list-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;"></div>
            <div style="padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; background: rgba(0,0,0,0.2);">
                <input type="text" id="new-comment-input" placeholder="Schreibe einen Kommentar..." style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 10px 14px; border-radius: 25px; color: #fff; font-size: 12px; outline: none;">
                <button onclick="window.submitNewComment()" class="btn" style="width: auto; padding: 8px 16px; font-size: 12px; font-weight: 800; background: var(--gradient-main);">Senden</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    return modalDiv;
}

/**
 * Hilfsfunktion zum Erstellen des Info-Modals
 */
function createInfoModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dynamic-info-modal';
    modalDiv.className = 'hidden';
    modalDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);';
    modalDiv.innerHTML = `
        <div style="background: var(--card); border: 1px solid var(--border); width: 90%; max-width: 380px; max-height: 70vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 id="dynamic-modal-title" style="font-size: 15px; font-weight: 900; color: #fff; margin: 0;">Info</h3>
                <button onclick="document.getElementById('dynamic-info-modal').classList.add('hidden')" style="background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <div id="dynamic-modal-content" style="flex: 1; overflow-y: auto; padding: 16px;"></div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    return modalDiv;
}

/**
 * Initialisiert den IntersectionObserver für Video-Autoplay & View-Zählung im Sichtfeld
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
            const item = entry.target;
            const video = item.querySelector('video');
            const postId = item.getAttribute('data-post-id');

            if (entry.isIntersecting) {
                if (postId && !item.dataset.viewed) {
                    item.dataset.viewed = 'true';
                    incrementPostView(postId);
                }
                if (video) {
                    video.play().catch(err => {
                        console.warn('Autoplay wurde blockiert:', err);
                    });
                }
            } else {
                if (video) {
                    video.pause();
                }
            }
        });
    }, options);

    document.querySelectorAll('.reel-item').forEach(item => {
        observer.observe(item);
    });
}

/**
 * Lädt den Campus-Feed (For You, Discover, Following)
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
        item.setAttribute('data-post-id', post.id);
        
        let mediaHtml = '';
        if (post.media_type === 'video') {
            mediaHtml = `<video src="${post.media_url}" muted playsinline loop class="reel-media" style="object-fit: contain; width: 100%; height: 100%;"></video>`;
        } else if (post.media_url) {
            mediaHtml = `<img src="${post.media_url}" class="reel-media" style="object-fit: contain; width: 100%; height: 100%;" alt="Post">`;
        }

        const cleanCaption = (post.caption && !post.caption.includes('${post.caption}')) ? post.caption : '';
        const authorEmail = post.author_email || 'student@uni.at';
        const viewsCount = post.views || 0;
        
        const likedByList = Array.isArray(post.liked_by) ? post.liked_by : [];
        const likesCount = likedByList.length;

        let commentCount = 0;
        try {
            const { count } = await _supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
            commentCount = count || 0;
        } catch (e) {}

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
            <!-- Oberes Overlay links oben: Autor + Likes, Kommentare & Views -->
            <div style="position: absolute; top: 14px; left: 14px; right: 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; z-index: 10; pointer-events: none;">
                <!-- Autoreninfo (Klickbar -> Öffentliches Profil) -->
                <div onclick="window.openPublicProfile('${authorEmail}')" style="pointer-events: auto; display: flex; align-items: center; gap: 8px; background: rgba(19, 27, 46, 0.85); border: 1px solid rgba(129, 140, 248, 0.4); padding: 5px 12px; border-radius: 30px; cursor: pointer; backdrop-filter: blur(6px); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                    <img src="${authorAvatar}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary);" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
                    <span style="font-size: 12px; font-weight: 800; color: #fff;">${authorName}</span>
                </div>

                <!-- Metriken & Interaktion links oben direkt unter dem Autor -->
                <div style="pointer-events: auto; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; font-weight: 700; color: #cbd5e1; background: rgba(9, 13, 22, 0.78); border: 1px solid rgba(255, 255, 255, 0.12); padding: 5px 10px; border-radius: 16px; backdrop-filter: blur(6px); box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                    <span>👁️ ${viewsCount}</span>
                    <span id="comment-count-${post.id}" onclick="window.openCommentsModal('${post.id}')" style="cursor: pointer; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.45); color: #818cf8; padding: 2px 8px; border-radius: 12px;">${commentCount} 💬</span>
                    <span id="like-count-${post.id}" onclick="window.likePost('${post.id}')" oncontextmenu="event.preventDefault(); window.openLikesModal('${post.id}');" style="cursor: pointer; background: rgba(236, 72, 153, 0.25); border: 1px solid rgba(236, 72, 153, 0.45); color: #ec4899; padding: 2px 8px; border-radius: 12px;" title="Klicken zum Liken | Rechtsklick für Liker-Liste">${likesCount} ❤️</span>
                    <span onclick="window.openLikesModal('${post.id}')" style="font-size: 10px; color: var(--text-muted); cursor: pointer; text-decoration: underline; margin-left: 2px;">Likes</span>
                </div>
            </div>

            <!-- Unteres Overlay: Nur noch Caption/Beschreibung, falls vorhanden -->
            ${cleanCaption ? `
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; background: linear-gradient(0deg, rgba(9,13,22,0.9) 0%, transparent 100%);">
                <div style="font-size: 13px; color: #fff; font-weight: 600; background: rgba(0,0,0,0.55); padding: 6px 10px; border-radius: 8px; max-width: 90%;">💬 ${cleanCaption}</div>
            </div>
            ` : ''}
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
    
    for (const post of posts) {
        const item = document.createElement('div');
        item.style.cssText = 'background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;';
        
        if (post.media_type === 'video') {
            item.innerHTML = `<video src="${post.media_url}" muted playsinline style="width: 100%; height: 90px; object-fit: contain; background: #000;"></video>`;
        } else {
            item.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 90px; object-fit: contain; background: #000;" alt="Post">`;
        }
        
        const views = post.views || 0;
        const likes = Array.isArray(post.liked_by) ? post.liked_by.length : 0;
        
        let commentsCount = 0;
        try {
            const { count } = await _supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
            commentsCount = count || 0;
        } catch (e) {}

        item.innerHTML += `
            <div style="padding: 6px; font-size: 9px; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>👁️ ${views}</span>
                <span style="cursor: pointer; color: #818cf8;" onclick="window.openCommentsModal('${post.id}')">💬 ${commentsCount}</span>
                <span style="cursor: pointer; color: #ec4899;" onclick="window.openLikesModal('${post.id}')">❤️ ${likes}</span>
            </div>
        `;
        
        grid.appendChild(item);
    }
}

/**
 * Öffnet das öffentliche Profil eines beliebigen Nutzers per E-Mail
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
                    postItem.style.cssText = 'background: #000; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; height: 90px; cursor: pointer;';
                    postItem.onclick = () => {
                        document.getElementById('public-profile-modal').classList.add('hidden');
                        window.openCommentsModal(post.id);
                    };
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
 * Umschalten der Follow-Beziehung
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
 * Setzt den aktiven Reel-Filter
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

export function setFilter(element, category) {
    document.querySelectorAll('#filter-group .cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

// Global bereitstellen
window.openUploadModal = openUploadModal;
window.closeMediaUploadModal = closeMediaUploadModal;
window.handleMediaSelection = handleMediaSelection;
window.uploadTrimmedMedia = uploadTrimmedMedia;
window.loadCampusFeed = loadCampusFeed;
window.loadMyProfilePosts = loadMyProfilePosts;
window.setReelFilter = setReelFilter;
window.setFilter = setFilter;
window.claimActiveDrop = claimActiveDrop;