// js/features/live.js • PURE LOGIC Live-Stream, WebRTC & Creator-Modul
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let liveObserver = null;
let localStream = null;
let activePeerConnection = null;
let activeStreamId = null;
let selectedCategory = '💬 Plaudern';
let pendingLocation = 'Uni Wien Hauptgebäude';

/**
 * Öffnet die Kamera-Vorschau vor dem Stream-Start
 */
export async function handlePreLiveCheck() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um einen Live-Stream zu starten!');
        return;
    }

    // Kamera & Mikrofon für die Vorschau anfordern
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
        console.warn('Kamera-Zugriff verweigert oder nicht verfügbar:', err);
        alert('Kamera-Zugriff wird für den Live-Stream benötigt.');
        return;
    }

    // Vorschau-Modal öffnen oder erstellen
    showPreLivePreviewModal();
}

/**
 * Zeigt das Vorschau-Modal mit interaktiven Kategorie-Buttons an
 */
function showPreLivePreviewModal() {
    let previewModal = document.getElementById('live-preview-modal');
    selectedCategory = '💬 Plaudern'; // Standardkategorie zurücksetzen
    
    if (!previewModal) {
        previewModal = document.createElement('div');
        previewModal.id = 'live-preview-modal';
        previewModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(9, 13, 22, 0.95); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;';
        
        previewModal.innerHTML = `
            <div style="width: 100%; max-width: 420px; background: #0f172a; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
                <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin: 0;">🎥 Stream-Vorschau & Setup</h3>
                    <button type="button" onclick="closePreLivePreview()" style="background: none; border: none; color: #fff; font-size: 22px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="position: relative; width: 100%; height: 240px; background: #000;">
                    <video id="preview-camera-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <div style="position: absolute; top: 12px; left: 12px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;">Kamera bereit 🎥</div>
                </div>

                <div style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted);">Wähle deine Kategorie:</label>
                    <div id="preview-category-pills" style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="cat-pill active" onclick="selectPreviewCategory(this, '💬 Plaudern')" style="background: var(--gradient-main); border: none; padding: 6px 12px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">💬 Plaudern</button>
                        <button type="button" class="cat-pill" onclick="selectPreviewCategory(this, '🎮 Gaming')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">🎮 Gaming</button>
                        <button type="button" class="cat-pill" onclick="selectPreviewCategory(this, '🎵 Musik')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">🎵 Musik</button>
                        <button type="button" class="cat-pill" onclick="selectPreviewCategory(this, '📚 Lernen')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">📚 Lernen</button>
                    </div>

                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 4px;">Standort / Hörsaal:</label>
                    <input type="text" id="preview-location-input" value="Uni Wien Hauptgebäude" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: #fff; font-size: 12px;">

                    <button type="button" class="btn" onclick="confirmAndStartLiveStream()" style="margin-top: 6px; background: var(--gradient-main); font-weight: 900; padding: 12px; font-size: 13px;">Jetzt live gehen 🚀</button>
                </div>
            </div>
        `;
        document.body.appendChild(previewModal);
    } else {
        previewModal.classList.remove('hidden');
    }

    const vidEl = document.getElementById('preview-camera-video');
    if (vidEl && localStream) {
        vidEl.srcObject = localStream;
    }
}

/**
 * Markiert die angeklickte Kategorie-Pill als aktiv in der Vorschau
 */
export function selectPreviewCategory(btnElement, categoryName) {
    selectedCategory = categoryName;
    document.querySelectorAll('#preview-category-pills button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.border = '1px solid var(--border)';
    });
    btnElement.classList.add('active');
    btnElement.style.background = 'var(--gradient-main)';
    btnElement.style.border = 'none';
}

/**
 * Schließt die Vorschau und stoppt die Kamera, falls abgebrochen wird
 */
export function closePreLivePreview() {
    const previewModal = document.getElementById('live-preview-modal');
    if (previewModal) {
        previewModal.classList.add('hidden');
    }
    if (localStream && !activeStreamId) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
}

/**
 * Bestätigt die Vorschau und startet den Stream offiziell in der Datenbank
 */
export async function confirmAndStartLiveStream() {
    const locInput = document.getElementById('preview-location-input');
    pendingLocation = locInput ? locInput.value.trim() : 'Uni Wien';

    if (!validateInputOrAlert(selectedCategory) || !validateInputOrAlert(pendingLocation)) return;

    closePreLivePreview();
    startLiveStreamBroadcast(selectedCategory, pendingLocation, 'webrtc-active');
}

/**
 * Startet den Live-Stream in der Datenbank
 */
async function startLiveStreamBroadcast(category, location, streamUrl = 'webrtc-active') {
    try {
        const streamTitle = `${category} live aus ${location}`;
        const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

        const { data, error } = await _supabase
            .from('live_streams')
            .insert([
                {
                    id: crypto.randomUUID(),
                    host_email: state.currentUserEmail,
                    title: streamTitle,
                    category: category,
                    location: location,
                    stream_url: streamUrl,
                    expires_at: expiresAt,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        activeStreamId = data.id;
        loadLiveStreams();

        if (localStream) {
            openLiveFullscreen(data.id, category, location, true, data.host_email);
        }
    } catch (err) {
        console.error('Fehler beim Starten des Streams:', err);
        alert('Fehler beim Starten des Streams: ' + err.message);
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

/**
 * Initialisiert den IntersectionObserver für automatisches Live-Video-Autoplay beim Scrollen
 */
function initLiveAutoplayObserver() {
    if (liveObserver) liveObserver.disconnect();

    const options = {
        root: document.getElementById('live-streams-list'),
        rootMargin: '0px',
        threshold: 0.6
    };

    liveObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const item = entry.target;
            const video = item.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                video.play().catch(err => {
                    console.warn('Live-Video Autoplay vom Browser blockiert:', err);
                });
            } else {
                video.pause();
            }
        });
    }, options);

    document.querySelectorAll('#live-streams-list .reel-item').forEach(item => {
        liveObserver.observe(item);
    });
}

/**
 * Lädt aktive Live-Streams aus der Datenbank.
 */
export async function loadLiveStreams() {
    const liveList = document.getElementById('live-streams-list');
    if (!liveList) return;

    liveList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade aktive Live-Streams...</p>';

    const { data: streams, error } = await _supabase
        .from('live_streams')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !streams || streams.length === 0) {
        liveList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Aktuell sind keine Live-Streams aktiv.</p>
                <p style="color: var(--text-muted); font-size: 11px;">Starte deinen eigenen Stream mit dem "+ Start"-Button!</p>
            </div>
        `;
        return;
    }

    liveList.innerHTML = '';

    streams.forEach(stream => {
        const item = document.createElement('div');
        item.className = 'reel-item';

        const category = stream.category || 'Live Stream';
        const location = stream.location || 'Wien / Campus';
        const streamId = stream.id ? String(stream.id) : '0000';
        const hostEmail = stream.host_email || '';
        const streamMediaUrl = stream.stream_url && stream.stream_url.startsWith('http') ? stream.stream_url : '';

        let mediaContentHtml = '';
        if (streamMediaUrl) {
            mediaContentHtml = `<video src="${streamMediaUrl}" autoplay muted playsinline loop class="reel-media" style="object-fit: cover; width: 100%; height: 100%;"></video>`;
        } else {
            mediaContentHtml = `
                <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0f172a, #1e1b4b); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; text-align: center; position: relative;">
                    <span style="background: rgba(99,102,241,0.2); color: #818cf8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-bottom: 10px;">${category}</span>
                    <h3 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 6px;">Campus Stream</h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">📍 ${location}</p>
                </div>
            `;
        }

        const isMyStream = state.currentUserEmail && hostEmail.toLowerCase() === state.currentUserEmail.toLowerCase();

        item.innerHTML = `
            <div style="width: 100%; height: 100%; position: relative; cursor: pointer;" onclick="openLiveFullscreen('${streamId}', '${category}', '${location}', ${isMyStream}, '${hostEmail}')">
                ${mediaContentHtml}
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px; z-index: 2;">
                    <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> LIVE
                </div>
            </div>
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.95) 0%, transparent 60%); padding: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 ${category} • ${location}</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600; margin-bottom: 8px;">Tippe, um dem Vollbild-Stream & Chat beizutreten.</div>
                <button class="btn" style="width: auto; padding: 8px 18px; font-size: 11px; font-weight: 800; background: var(--gradient-main);" onclick="event.stopPropagation(); openLiveFullscreen('${streamId}', '${category}', '${location}', ${isMyStream}, '${hostEmail}')">Vollbild beitreten 🚀</button>
            </div>
        `;
        
        liveList.appendChild(item);
    });

    setTimeout(initLiveAutoplayObserver, 100);
}

/**
 * Filtert die Live-Streams nach Kategorie
 */
export function setLiveFilter(element, category) {
    document.querySelectorAll('#live-filter-group .cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    loadLiveStreams();
}

/**
 * Öffnet den Vollbildmodus für einen spezifischen Stream (mit Creator-Steuerung & Zuschauer-Zähler)
 */
export function openLiveFullscreen(streamId, category, location, isHost = false, hostEmail = '') {
    activeStreamId = streamId;
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');

    const titleDisplay = document.getElementById('active-live-title-display');
    const hostDisplay = document.getElementById('active-live-host-display');
    const playerContainer = document.getElementById('live-stream-player-container');
    const chatInputContainer = document.getElementById('live-chat-input-container');

    if (titleDisplay) titleDisplay.textContent = `🔴 ${category}`;
    
    const currentUserIsHost = isHost || (state.currentUserEmail && hostEmail && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase()) || (localStream !== null);

    if (hostDisplay) {
        hostDisplay.innerHTML = `📍 ${location} | 👥 <span id="live-viewer-count">1</span> Zuschauer`;
    }

    if (playerContainer) {
        if (currentUserIsHost && localStream) {
            playerContainer.innerHTML = `
                <video id="local-host-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover; background: #000;"></video>
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;">🎥 Du sendest Live (WebRTC)</div>
            `;
            const vidEl = document.getElementById('local-host-video');
            if (vidEl) vidEl.srcObject = localStream;
        } else {
            playerContainer.innerHTML = `
                <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #090d16, #1e1b4b); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
                    <span style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.5); color: #ef4444; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; margin-bottom: 12px;">🔴 LIVE BROADCAST</span>
                    <h3 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 6px;">${category}</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">Standort: ${location}</p>
                </div>
            `;
        }
    }

    if (chatInputContainer) {
        if (currentUserIsHost) {
            chatInputContainer.innerHTML = `
                <button type="button" class="btn" style="background: #ef4444; color: #fff; font-weight: 900; font-size: 12px; padding: 10px; border-radius: 10px; width: 100%; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239,68,68,0.4); margin-bottom: 6px;" onclick="terminateActiveStream()">🛑 Stream beenden</button>
                <div style="display: flex; gap: 6px; width: 100%;">
                    <input type="text" id="live-chat-input" placeholder="Als Host in den Stream schreiben..." style="margin: 0; font-size: 11px; padding: 10px 12px; flex: 1;" onkeydown="if(event.key==='Enter') sendLiveChatMessage()">
                    <button type="button" class="btn" style="width: auto; margin: 0; padding: 0 16px; font-size: 11px; font-weight: 800;" onclick="sendLiveChatMessage()">Senden</button>
                </div>
            `;
        } else {
            chatInputContainer.innerHTML = `
                <div style="display: flex; gap: 6px; width: 100%;">
                    <input type="text" id="live-chat-input" placeholder="Nachricht an den Stream senden..." style="margin: 0; font-size: 11px; padding: 10px 12px; flex: 1;" onkeydown="if(event.key==='Enter') sendLiveChatMessage()">
                    <button type="button" class="btn" style="width: auto; margin: 0; padding: 0 16px; font-size: 11px; font-weight: 800;" onclick="sendLiveChatMessage()">Senden</button>
                </div>
            `;
        }
    }

    const chatList = document.getElementById('live-chat-messages');
    if (chatList) {
        chatList.innerHTML = `<div style="color: var(--text-muted); text-align: center;">Willkommen im Live-Chat! 💬</div>`;
    }
}

/**
 * Beendet den eigenen Live-Stream (löscht ihn aus der DB und stoppt die Kamera)
 */
export async function terminateActiveStream() {
    if (!confirm('Möchtest du deinen Live-Stream wirklich beenden?')) return;

    try {
        if (activeStreamId) {
            await _supabase
                .from('live_streams')
                .delete()
                .eq('id', activeStreamId);
        }
    } catch (err) {
        console.error('Fehler beim Löschen des Streams aus der DB:', err);
    }

    closeLiveFullscreen();
    loadLiveStreams();
}

/**
 * Schließt das Vollbild-Modal und stoppt lokale Streams sowie Kamera-Hardware.
 */
export async function closeLiveFullscreen() {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.add('hidden');

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (activePeerConnection) {
        activePeerConnection.close();
        activePeerConnection = null;
    }
    activeStreamId = null;
    loadLiveStreams();
}

/**
 * Sendet eine Chatnachricht im aktiven Stream (speziell für Host oder Zuschauer).
 */
export function sendLiveChatMessage() {
    const input = document.getElementById('live-chat-input');
    const chatList = document.getElementById('live-chat-messages');
    if (!input || !input.value.trim() || !chatList) return;

    const msgText = input.value.trim();
    if (!validateInputOrAlert(msgText)) return;

    const isHost = localStream !== null;
    const prefix = isHost ? '👑 Host (Du)' : 'Du';
    const color = isHost ? '#10b981' : '#818cf8';

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 8px; font-size: 11px; margin-bottom: 4px;';
    msgDiv.innerHTML = `<strong style="color: ${color};">${prefix}:</strong> ${msgText}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;
    input.value = '';
}

// Globale Bindings
window.loadLiveStreams = loadLiveStreams;
window.handlePreLiveCheck = handlePreLiveCheck;
window.closePreLivePreview = closePreLivePreview;
window.selectPreviewCategory = selectPreviewCategory;
window.confirmAndStartLiveStream = confirmAndStartLiveStream;
window.setLiveFilter = setLiveFilter;
window.openLiveFullscreen = openLiveFullscreen;
window.closeLiveFullscreen = closeLiveFullscreen;
window.terminateActiveStream = terminateActiveStream;
window.sendLiveChatMessage = sendLiveChatMessage;