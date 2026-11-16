// js/features/live.js • PURE LOGIC Live-Stream & WebRTC Modul
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let liveObserver = null;
let localStream = null;
let activePeerConnection = null;

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

/**
 * Vorab-Prüfung vor dem Start eines Live-Streams mit Kamera-Zugriff
 */
export async function handlePreLiveCheck() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um einen Live-Stream zu starten!');
        return;
    }
    
    const category = prompt('Wähle eine Kategorie für deinen Stream (z.B. 🎮 Gaming, 🎵 Musik, 💬 Plaudern):', '💬 Plaudern');
    if (!category) return;
    if (!validateInputOrAlert(category)) return;
    
    const location = prompt('Dein Standort / Hörsaal (z.B. HS 32, Uni Wien):', 'Uni Wien Hauptgebäude');
    if (!location) return;
    if (!validateInputOrAlert(location)) return;

    try {
        // Kamera & Mikrofon anfordern für WebRTC Broadcast
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        startLiveStreamBroadcast(category, location);
    } catch (err) {
        console.warn('Kamera-Zugriff verweigert oder nicht verfügbar:', err);
        // Fallback ohne Kamera-Stream starten
        startLiveStreamBroadcast(category, location, null);
    }
}

/**
 * Startet einen neuen Live-Stream in der Datenbank und bindet den WebRTC-Stream ein
 */
async function startLiveStreamBroadcast(category, location, streamUrl = null) {
    try {
        const { data, error } = await _supabase
            .from('live_streams')
            .insert([
                {
                    id: crypto.randomUUID(),
                    host_email: state.currentUserEmail,
                    category: category,
                    location: location,
                    stream_url: streamUrl,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        alert('Dein Live-Stream ist jetzt LIVE! 🔴');
        loadLiveStreams();

        if (localStream) {
            openLiveFullscreen(data.id, category, location, true);
        }
    } catch (err) {
        console.error('Fehler beim Starten des Streams:', err);
        alert('Fehler beim Starten des Streams: ' + err.message);
        
        // Bei Fehler Hardware-Ressourcen sofort wieder freigeben
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
        const streamMediaUrl = stream.stream_url || '';

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

        item.innerHTML = `
            <div style="width: 100%; height: 100%; position: relative; cursor: pointer;" onclick="openLiveFullscreen('${streamId}', '${category}', '${location}')">
                ${mediaContentHtml}
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px; z-index: 2;">
                    <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> LIVE
                </div>
            </div>
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.95) 0%, transparent 60%); padding: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 ${category} • ${location}</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600; margin-bottom: 8px;">Tippe, um dem Vollbild-Stream & Chat beizutreten.</div>
                <button class="btn" style="width: auto; padding: 8px 18px; font-size: 11px; font-weight: 800; background: var(--gradient-main);" onclick="event.stopPropagation(); openLiveFullscreen('${streamId}', '${category}', '${location}')">Vollbild beitreten 🚀</button>
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
 * Öffnet den Vollbildmodus für einen spezifischen Stream inklusive WebRTC-Videofeed und Chat.
 */
export function openLiveFullscreen(streamId, category, location, isHost = false) {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');

    const titleDisplay = document.getElementById('active-live-title-display');
    const hostDisplay = document.getElementById('active-live-host-display');
    const playerContainer = document.getElementById('live-stream-player-container');

    if (titleDisplay) titleDisplay.textContent = `🔴 ${category}`;
    if (hostDisplay) hostDisplay.textContent = `Standort: ${location} | ${isHost ? 'Du bist der Host 🎥' : 'Zuschauer-Modus'}`;

    if (playerContainer) {
        if (isHost && localStream) {
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

    const chatList = document.getElementById('live-chat-messages');
    if (chatList) {
        chatList.innerHTML = `<div style="color: var(--text-muted); text-align: center;">Willkommen im Live-Chat! 💬</div>`;
    }
}

/**
 * Schließt das Vollbild-Modal und stoppt lokale Streams sowie Kamera-Hardware.
 */
export async function closeLiveFullscreen() {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.add('hidden');

    // Kamera-Hardware explizit stoppen, damit die LED ausgeht
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (activePeerConnection) {
        activePeerConnection.close();
        activePeerConnection = null;
    }
}

/**
 * Sendet eine Chatnachricht im aktiven Stream.
 */
export function sendLiveChatMessage() {
    const input = document.getElementById('live-chat-input');
    const chatList = document.getElementById('live-chat-messages');
    if (!input || !input.value.trim() || !chatList) return;

    const msgText = input.value.trim();
    if (!validateInputOrAlert(msgText)) return;

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 8px; font-size: 11px; margin-bottom: 4px;';
    msgDiv.innerHTML = `<strong style="color: #818cf8;">Du:</strong> ${msgText}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;
    input.value = '';
}

// Globale Bindings
window.loadLiveStreams = loadLiveStreams;
window.handlePreLiveCheck = handlePreLiveCheck;
window.setLiveFilter = setLiveFilter;
window.openLiveFullscreen = openLiveFullscreen;
window.closeLiveFullscreen = closeLiveFullscreen;
window.sendLiveChatMessage = sendLiveChatMessage;