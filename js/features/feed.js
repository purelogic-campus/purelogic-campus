// js/features/feed.js - Vollständiges Campus-Feed & Medien Modul mit Engagement-Scoring, Hashtag-Suche & Tastatur-A11y
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { sendInteractionPush } from './notifications.js';

let selectedMediaFile = null;
let observer = null;
let activeCommentPostId = null;
let activeSearchQuery = '';
let searchListenersInitialized = false;

function escapeHtmlAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlText(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function makeKeyboardAccessible(el, handler) {
    if (!el || typeof handler !== 'function') return;
    if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
    }
    if (!el.hasAttribute('role')) {
        el.setAttribute('role', 'button');
    }
    el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handler(event);
        }
    });
}

function normalizeSearchQuery(rawQuery) {
    return String(rawQuery || '').trim().toLowerCase();
}

function ensureActiveSearchBanner() {
    const feedList = document.getElementById('reels-list');
    if (!feedList || !feedList.parentElement) return null;

    let banner = document.getElementById('feed-active-search-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'feed-active-search-banner';
        banner.className = 'hidden';
        banner.style.cssText = 'display: none; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 12px; padding: 8px 12px; border-radius: 12px; background: rgba(99, 102, 241, 0.16); border: 1px solid rgba(129, 140, 248, 0.45); color: #fff; font-size: 12px; font-weight: 700;';
        feedList.parentElement.insertBefore(banner, feedList);
    }

    if (!activeSearchQuery) {
        banner.classList.add('hidden');
        banner.style.display = 'none';
        banner.innerHTML = '';
        return banner;
    }

    const isTag = activeSearchQuery.startsWith('#') && activeSearchQuery.length > 1;
    const labelText = isTag
        ? `Hashtag-Filter aktiv: <span style="color: #818cf8; font-weight: 900;">${escapeHtmlText(activeSearchQuery)}</span>`
        : `Suchfilter aktiv: <span style="color: #818cf8; font-weight: 900;">"${escapeHtmlText(activeSearchQuery)}"</span>`;

    banner.innerHTML = `
        <span>🔎 ${labelText}</span>
        <button type="button" onclick="window.clearFeedSearch()" aria-label="Suchfilter zurücksetzen" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; cursor: pointer; flex-shrink: 0;">✕ Filter löschen</button>
    `;
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
    return banner;
}

export function initFeedSearchControls() {
    if (searchListenersInitialized) return;
    const searchInput = document.getElementById('feed-search-input');
    if (!searchInput) return;

    searchListenersInitialized = true;

    searchInput.addEventListener('input', (event) => {
        const nextQuery = normalizeSearchQuery(event.target.value);
        if (nextQuery === activeSearchQuery) return;
        activeSearchQuery = nextQuery;
        loadCampusFeed(state.currentReelFilter || 'foryou');
    });

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            activeSearchQuery = normalizeSearchQuery(searchInput.value);
            loadCampusFeed(state.currentReelFilter || 'foryou');
        } else if (event.key === 'Escape') {
            event.preventDefault();
            window.clearFeedSearch();
        }
    });
}

window.runFeedSearch = function(queryOverride) {
    const searchInput = document.getElementById('feed-search-input');
    const sourceVal = typeof queryOverride === 'string'
        ? queryOverride
        : (searchInput ? searchInput.value : '');

    if (searchInput && typeof queryOverride === 'string') {
        searchInput.value = queryOverride;
    }

    activeSearchQuery = normalizeSearchQuery(sourceVal);
    loadCampusFeed(state.currentReelFilter || 'foryou');
};

window.clearFeedSearch = function() {
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    activeSearchQuery = '';
    loadCampusFeed(state.currentReelFilter || 'foryou');
};

/**
 * Hilfsfunktion: Text mit Hashtags in klickbare & fokussierbare Links umwandeln
 */
export function parseHashtagsInText(text) {
    if (!text) return '';
    const safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return safeText.replace(/#([a-zA-Z0-9_äöüÄÖÜß]+)/g, (_match, tagName) => {
        const safeTag = escapeHtmlAttr(`#${tagName}`);
        return `<button type="button" class="hashtag-link" onclick="searchByHashtag('${safeTag}')" aria-label="Nach Hashtag ${safeTag} suchen" style="background: transparent; border: none; padding: 0 2px; border-radius: 4px; color: #818cf8; font-weight: 700; font-size: inherit; cursor: pointer; display: inline;">#${tagName}</button>`;
    });
}

window.searchByHashtag = function(tag) {
    const normalizedTag = normalizeSearchQuery(tag);
    if (!normalizedTag) return;
    const formattedTag = normalizedTag.startsWith('#') ? normalizedTag : `#${normalizedTag}`;
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput) {
        searchInput.value = formattedTag;
    }
    activeSearchQuery = formattedTag;
    loadCampusFeed(state.currentReelFilter || 'foryou');
};

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
 * Verarbeitet die gewählte Datei und zeigt Vorschau / Trimmer
 */
export function handleMediaSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedMediaFile = file;
    const trimmerContainer = document.getElementById('trimmer-container');
    const videoPreview = document.getElementById('trim-video-preview');
    const infoText = document.getElementById('video-duration-info');
    
    if (trimmerContainer) trimmerContainer.classList.remove('hidden');

    if (file.type.startsWith('video/')) {
        const fileURL = URL.createObjectURL(file);
        if (videoPreview) videoPreview.src = fileURL;
        
        if (videoPreview) {
            videoPreview.onloadedmetadata = function() {
                const duration = Math.round(videoPreview.duration);
                if (infoText) {
                    if (duration > 30) {
                        infoText.textContent = `⚠️ Achtung: Das Video ist ${duration}s lang (Empfohlen: max. 30s).`;
                        infoText.style.color = '#f59e0b';
                    } else {
                        infoText.textContent = `✅ Video-Länge: ${duration}s (Perfekt für Campus-Reels!)`;
                        infoText.style.color = '#10b981';
                    }
                }
            };
        }
    } else if (file.type.startsWith('image/')) {
        if (videoPreview) videoPreview.src = '';
        if (infoText) {
            infoText.textContent = `🖼️ Bild ausgewählt: ${file.name} (Wird automatisch optimiert)`;
            infoText.style.color = '#818cf8';
        }
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
    
    const captionInput = document.getElementById('media-caption-input');
    const caption = captionInput ? captionInput.value.trim() : '';

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
    
    try {
        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data: uploadData, error: uploadError } = await _supabase.storage
            .from('campus_media')
            .upload(filePath, fileToUpload);

        if (uploadError) {
            console.error('Upload-Fehler:', uploadError.message);
            alert('Fehler beim Hochladen der Datei in den Speicher.');
            return;
        }

        const { data: urlData } = _supabase.storage
            .from('campus_media')
            .getPublicUrl(filePath);

        const mediaUrl = urlData ? urlData.publicUrl : '';

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
 * Erhöht den View-Counter eines Beitrags in der Datenbank
 */
async function incrementPostView(postId) {
    try {
        const { data: post } = await _supabase
            .from('media_posts')
            .select('views')
            .eq('id', postId)
            .single();

        if (post) {
            const nextViews = (post.views || 0) + 1;
            await _supabase
                .from('media_posts')
                .update({ views: nextViews })
                .eq('id', postId);

            const viewEl = document.getElementById(`view-count-${postId}`);
            if (viewEl) viewEl.textContent = `👁️ ${nextViews}`;
        }
    } catch (err) {
        console.warn('View-Update fehlgeschlagen:', err);
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
            .select('liked_by, author_email')
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

        if (index === -1 && postData?.author_email) {
            await sendInteractionPush({
                type: 'like',
                recipientEmail: postData.author_email,
                actorEmail: state.currentUserEmail,
                postId
            });
        }

        const likeCountEl = document.getElementById(`like-count-${postId}`);
        if (likeCountEl) {
            likeCountEl.textContent = `${likedByList.length} ❤️`;
            likeCountEl.setAttribute('aria-label', `Beitrag liken, aktuell ${likedByList.length} Likes`);
        }

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
                .select('full_name, avatar_url')
                .eq('email', email)
                .single();

            if (userData) {
                if (userData.full_name) name = userData.full_name;
                if (userData.avatar_url) avatar = userData.avatar_url;
            }

            const safeEmail = escapeHtmlAttr(email);
            const safeName = escapeHtmlText(name);
            const item = document.createElement('button');
            item.type = 'button';
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 10px; cursor: pointer; border: none; width: 100%; text-align: left;';
            item.setAttribute('aria-label', `Profil von ${safeName} öffnen`);
            item.onclick = () => {
                modal.classList.add('hidden');
                window.openPublicProfile(email);
            };
            item.innerHTML = `
                <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" alt="Avatar von ${safeName}">
                <span style="font-size: 12px; font-weight: 700; color: #fff;">${safeName}</span>
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
                .select('full_name, avatar_url')
                .eq('email', c.author_email)
                .single();

            if (userData) {
                if (userData.full_name) authorName = userData.full_name;
                if (userData.avatar_url) authorAvatar = userData.avatar_url;
            }

            const commentItem = document.createElement('div');
            commentItem.style.cssText = 'display: flex; gap: 10px; background: rgba(255,255,255,0.04); padding: 10px; border-radius: 10px; align-items: flex-start;';
            commentItem.innerHTML = `
                <button type="button" onclick="document.getElementById('comments-modal').classList.add('hidden'); window.openPublicProfile('${escapeHtmlAttr(c.author_email)}')" aria-label="Profil von ${escapeHtmlAttr(authorName)} öffnen" style="background: transparent; border: none; padding: 0; border-radius: 50%; cursor: pointer; flex-shrink: 0;">
                    <img src="${authorAvatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary); display: block;" alt="Avatar von ${escapeHtmlAttr(authorName)}">
                </button>
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <button type="button" onclick="document.getElementById('comments-modal').classList.add('hidden'); window.openPublicProfile('${escapeHtmlAttr(c.author_email)}')" style="background: transparent; border: none; padding: 0; font-size: 12px; font-weight: 800; color: #818cf8; cursor: pointer; text-align: left;">${authorName}</button>
                        <span style="font-size: 10px; color: var(--text-muted);">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style="font-size: 12px; color: #fff; margin: 0; word-break: break-word;">${parseHashtagsInText(c.comment_text)}</p>
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

        try {
            const { data: postOwner } = await _supabase
                .from('media_posts')
                .select('author_email')
                .eq('id', activeCommentPostId)
                .maybeSingle();

            if (postOwner?.author_email) {
                await sendInteractionPush({
                    type: 'comment',
                    recipientEmail: postOwner.author_email,
                    actorEmail: state.currentUserEmail,
                    postId: activeCommentPostId,
                    previewText: text
                });
            }
        } catch (_notifErr) {}

        input.value = '';
        await loadCommentsForPost(activeCommentPostId);

        const { count } = await _supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', activeCommentPostId);

        const commentCountEl = document.getElementById(`comment-count-${activeCommentPostId}`);
        if (commentCountEl) {
            commentCountEl.textContent = `${count || 0} 💬`;
            commentCountEl.setAttribute('aria-label', `Kommentare öffnen, aktuell ${count || 0} Kommentare`);
        }

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
                <button type="button" onclick="document.getElementById('comments-modal').classList.add('hidden')" aria-label="Kommentare schließen" style="background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <div id="comments-list-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;"></div>
            <div style="padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; background: rgba(0,0,0,0.2);">
                <input type="text" id="new-comment-input" placeholder="Schreibe einen Kommentar..." aria-label="Kommentar eingeben" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 10px 14px; border-radius: 25px; color: #fff; font-size: 12px; outline: none; margin: 0;">
                <button type="button" onclick="window.submitNewComment()" class="btn" style="width: auto; padding: 8px 16px; font-size: 12px; font-weight: 800; background: var(--gradient-main); margin: 0;">Senden</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    return modalDiv;
}

/**
 * Hilfsfunktion zum Erstellen eines dynamischen Info-Modals (für Likes)
 */
function createInfoModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dynamic-info-modal';
    modalDiv.className = 'hidden';
    modalDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);';
    modalDiv.innerHTML = `
        <div style="background: var(--card); border: 1px solid var(--border); width: 90%; max-width: 400px; max-height: 70vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 id="dynamic-modal-title" style="font-size: 14px; font-weight: 900; color: #fff; margin: 0;">Info</h3>
                <button type="button" onclick="document.getElementById('dynamic-info-modal').classList.add('hidden')" aria-label="Info-Fenster schließen" style="background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <div id="dynamic-modal-content" style="flex: 1; overflow-y: auto; padding: 16px;"></div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    return modalDiv;
}

/**
 * Berechnet den Engagement-Score eines Beitrags für den "For You"-Algorithmus.
 * Berücksichtigt Likes, Kommentare, Views und Zeitverfall (Recency Decay).
 */
async function calculateEngagementScore(post) {
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

    const createdAt = new Date(post.created_at).getTime();
    const now = new Date().getTime();
    const ageInHours = Math.max(1, (now - createdAt) / (1000 * 60 * 60));

    const rawScore = (likes * 5) + (commentsCount * 10) + (views * 1);
    const recencyDecay = Math.pow(ageInHours + 2, 1.5);
    
    return rawScore / recencyDecay;
}

/**
 * Richtet den IntersectionObserver für automatisches Abspielen & Zählen von Views ein
 */
function setupFeedObserver() {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            const postId = entry.target.dataset.postId;

            if (entry.isIntersecting) {
                if (video) {
                    video.play().catch(() => {});
                }
                if (postId && !entry.target.dataset.viewed) {
                    entry.target.dataset.viewed = 'true';
                    incrementPostView(postId);
                }
            } else {
                if (video) {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.65 });
}

/**
 * Lädt den Campus-Feed (For You mit Algorithmus, Discover, Following, sowie Hashtag-Filter)
 */
export async function loadCampusFeed(filter = 'foryou') {
    initFeedSearchControls();
    const searchInput = document.getElementById('feed-search-input');
    if (searchInput && normalizeSearchQuery(searchInput.value) !== activeSearchQuery) {
        activeSearchQuery = normalizeSearchQuery(searchInput.value);
    }

    const feedContainer = document.getElementById('reels-list');
    if (!feedContainer) return;

    feedContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 30px;">Lade Campus-Feed...</p>';
    ensureActiveSearchBanner();

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
        query = query.order('created_at', { ascending: false }).limit(50);
    }

    const { data: posts, error } = await query;

    if (error || !posts) {
        feedContainer.innerHTML = '<p style="text-align: center; color: #ef4444; font-size: 13px; padding: 30px;">Fehler beim Laden der Beiträge.</p>';
        return;
    }

    let processedPosts = [...posts];

    if (activeSearchQuery) {
        processedPosts = processedPosts.filter(p => {
            const captionText = (p.caption || '').toLowerCase();
            const authorText = (p.author_email || '').toLowerCase();
            return captionText.includes(activeSearchQuery) || authorText.includes(activeSearchQuery);
        });
    }

    if (filter === 'foryou') {
        const scoredPosts = [];
        for (const post of processedPosts) {
            const score = await calculateEngagementScore(post);
            scoredPosts.push({ post, score });
        }
        scoredPosts.sort((a, b) => b.score - a.score);
        processedPosts = scoredPosts.map(item => item.post);
    }

    if (processedPosts.length === 0) {
        const emptyMsg = activeSearchQuery
            ? `Keine Beiträge für „${escapeHtmlText(activeSearchQuery)}“ gefunden.`
            : 'Noch keine Beiträge in diesem Feed vorhanden.';
        feedContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 30px;">${emptyMsg}</p>`;
        return;
    }

    feedContainer.innerHTML = '';
    setupFeedObserver();

    for (const post of processedPosts) {
        const authorEmail = post.author_email || 'student@uni.at';
        const safeAuthorEmail = escapeHtmlAttr(authorEmail);
        const safePostId = escapeHtmlAttr(post.id);
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
            const { data: userData } = await _supabase
                .from('users')
                .select('full_name, avatar_url')
                .eq('email', authorEmail)
                .single();

            if (userData) {
                if (userData.full_name) authorName = userData.full_name;
                if (userData.avatar_url) authorAvatar = userData.avatar_url;
            }
        } catch (e) {}

        const safeAuthorName = escapeHtmlText(authorName);
        const card = document.createElement('div');
        card.className = 'reel-card';
        card.dataset.postId = post.id;
        card.style.cssText = 'position: relative; background: #000; border-radius: 16px; overflow: hidden; margin-bottom: 16px; border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.4);';

        let mediaHtml = '';
        if (post.media_type === 'video') {
            mediaHtml = `<video src="${post.media_url}" loop muted playsinline style="width: 100%; max-height: 70vh; object-fit: contain; display: block; background: #000;"></video>`;
        } else {
            mediaHtml = `<img src="${post.media_url}" style="width: 100%; max-height: 70vh; object-fit: contain; display: block; background: #000;" alt="Beitrag von ${safeAuthorName}">`;
        }

        card.innerHTML = `
            ${mediaHtml}
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 30px 16px 14px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" onclick="window.openPublicProfile('${safeAuthorEmail}')" aria-label="Profil von ${safeAuthorName} öffnen" style="display: inline-flex; align-items: center; gap: 8px; background: transparent; border: none; padding: 0; cursor: pointer;">
                        <img src="${authorAvatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--primary); display: block;" alt="Avatar von ${safeAuthorName}">
                        <span style="font-size: 13px; font-weight: 800; color: #fff;">@${safeAuthorName}</span>
                    </button>
                </div>
                <p style="font-size: 12px; color: #e2e8f0; margin: 0; line-height: 1.35;">${parseHashtagsInText(post.caption || '')}</p>
                
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 4px;">
                    <span id="view-count-${safePostId}" style="background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.14); color: #e2e8f0; padding: 3px 10px; border-radius: 16px; backdrop-filter: blur(6px); font-size: 11px; font-weight: 700;">
                        👁️ ${viewsCount}
                    </span>

                    <button type="button" id="comment-count-${safePostId}" onclick="window.openCommentsModal('${safePostId}')" aria-label="Kommentare öffnen, aktuell ${commentCount} Kommentare" style="cursor: pointer; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.45); color: #818cf8; padding: 3px 10px; border-radius: 16px; backdrop-filter: blur(6px); box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 11px; font-weight: 700;">
                        ${commentCount} 💬
                    </button>

                    <button type="button" id="like-count-${safePostId}" onclick="window.likePost('${safePostId}')" oncontextmenu="event.preventDefault(); window.openLikesModal('${safePostId}');" aria-label="Beitrag liken, aktuell ${likesCount} Likes" style="cursor: pointer; background: rgba(236, 72, 153, 0.25); border: 1px solid rgba(236, 72, 153, 0.45); color: #ec4899; padding: 3px 10px; border-radius: 16px; backdrop-filter: blur(6px); box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 11px; font-weight: 700;" title="Klicken zum Liken | Rechtsklick für Liker-Liste">
                        ${likesCount} ❤️
                    </button>
                </div>
            </div>
        `;

        feedContainer.appendChild(card);
        if (observer) observer.observe(card);
    }
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
        grid.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Noch keine Beiträge hochgeladen.</p>';
        return;
    }

    grid.innerHTML = '';
    posts.forEach(async post => {
        const item = document.createElement('div');
        item.style.cssText = 'position: relative; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); display: flex; flex-direction: column;';

        if (post.media_type === 'video') {
            item.innerHTML = `<video src="${post.media_url}" muted style="width: 100%; height: 110px; object-fit: cover;"></video>`;
        } else {
            item.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 110px; object-fit: cover;" alt="Eigener Beitrag">`;
        }
        
        const views = post.views || 0;
        const likes = Array.isArray(post.liked_by) ? post.liked_by.length : 0;
        const safePostId = escapeHtmlAttr(post.id);
        
        let commentsCount = 0;
        try {
            const { count } = await _supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
            commentsCount = count || 0;
        } catch (e) {}

        item.innerHTML += `
            <div style="padding: 6px; font-size: 9px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                <span>👁️ ${views}</span>
                <button type="button" style="background: transparent; border: none; padding: 0; font-size: 9px; cursor: pointer; color: #818cf8;" onclick="window.openCommentsModal('${safePostId}')">💬 ${commentsCount}</button>
                <button type="button" style="background: transparent; border: none; padding: 0; font-size: 9px; cursor: pointer; color: #ec4899;" onclick="window.openLikesModal('${safePostId}')">❤️ ${likes}</button>
            </div>
        `;
        
        grid.appendChild(item);
    });
}

/**
 * Öffnet ein öffentliches Nutzerprofil
 */
window.openPublicProfile = async function(email) {
    if (!email) return;
    const modal = document.getElementById('public-profile-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

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

    const safeTargetEmail = escapeHtmlAttr(email);

    if (followBtnContainer && state.currentUserEmail && state.currentUserEmail !== email) {
        const { data: existingFollow } = await _supabase
            .from('follows')
            .select('*')
            .eq('follower_email', state.currentUserEmail)
            .eq('following_email', email)
            .maybeSingle();

        const isFollowing = !!existingFollow;
        followBtnContainer.innerHTML = `
            <button type="button" onclick="window.toggleFollowUser('${safeTargetEmail}')" class="btn" style="padding: 6px 14px; font-size: 11px; font-weight: 800; background: ${isFollowing ? 'var(--card)' : 'var(--gradient-main)'}; border: ${isFollowing ? '1px solid var(--border)' : 'none'}; color: ${isFollowing ? 'var(--text)' : '#fff'}; width: auto; margin-top: 0;">
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
                    const postBtn = document.createElement('button');
                    postBtn.type = 'button';
                    postBtn.style.cssText = 'background: #000; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; height: 90px; padding: 0; cursor: pointer; display: block; width: 100%;';
                    postBtn.setAttribute('aria-label', 'Beitrag und Kommentare ansehen');
                    postBtn.onclick = () => {
                        document.getElementById('public-profile-modal').classList.add('hidden');
                        window.openCommentsModal(post.id);
                    };
                    if (post.media_type === 'video') {
                        postBtn.innerHTML = `<video src="${post.media_url}" muted style="width: 100%; height: 100%; object-fit: cover;"></video>`;
                    } else {
                        postBtn.innerHTML = `<img src="${post.media_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Beitragsbild">`;
                    }
                    postsGrid.appendChild(postBtn);
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

            await sendInteractionPush({
                type: 'follow',
                recipientEmail: targetEmail,
                actorEmail: state.currentUserEmail
            });
            
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
    document.querySelectorAll('.feed-filter-bar .feed-subtab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        if (btn.id !== 'subtab-live') {
            btn.style.color = 'var(--text-muted)';
        }
    });
    
    if (filterType === 'foryou') {
        const el = document.getElementById('subtab-foryou');
        if (el) {
            el.classList.add('active');
            el.setAttribute('aria-selected', 'true');
            el.style.color = 'var(--primary)';
        }
    } else if (filterType === 'discover') {
        const el = document.getElementById('subtab-discover');
        if (el) {
            el.classList.add('active');
            el.setAttribute('aria-selected', 'true');
            el.style.color = 'var(--primary)';
        }
    } else if (filterType === 'following') {
        const el = document.getElementById('subtab-following');
        if (el) {
            el.classList.add('active');
            el.setAttribute('aria-selected', 'true');
            el.style.color = 'var(--primary)';
        }
    }
    
    loadCampusFeed(filterType);
}

export function setFilter(element, category) {
    document.querySelectorAll('#filter-group .cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    initFeedSearchControls();
});

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
window.initFeedSearchControls = initFeedSearchControls;