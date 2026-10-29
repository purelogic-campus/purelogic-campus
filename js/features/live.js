// js/features/live.js - Vollständiges Live-Stream Modul
import { _supabase } from '../config.js';

/**
 * Lädt exklusiv aktive Live-Streams aus der Tabelle 'live_streams'.
 * Verhindert das Verfälschen der Ansicht durch spontane Treffen.
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

        const category = stream.category || stream.title || 'Live Stream';
        const location = stream.location || 'Wien / Campus';
        const streamId = stream.id ? String(stream.id) : '0000';

        item.innerHTML = `
            <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0f172a, #1e1b4b); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; text-align: center; position: relative; cursor: pointer;" onclick="openLiveFullscreen('${streamId}', '${category}', '${location}')">
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; animation: pulseGlow 1s infinite;"></span> LIVE
                </div>
                
                <span style="background: rgba(99,102,241,0.2); color: #818cf8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-bottom: 10px;">${category}</span>
                <h3 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 6px;">Campus Stream # ${streamId.substring(0, 4)}</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">📍 ${location}</p>
                
                <button class="btn" style="width: auto; padding: 10px 24px; font-size: 13px; font-weight: 800; background: var(--gradient-main); box-shadow: 0 4px 15px rgba(99,102,241,0.4);" onclick="event.stopPropagation(); openLiveFullscreen('${streamId}', '${category}', '${location}')">Vollbild beitreten & Chatten 🚀</button>
            </div>
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.95) 0%, transparent 60%); padding: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 Live Broadcast</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600;">Wische für den nächsten Stream oder tippe zum Beitreten.</div>
            </div>
        `;
        
        liveList.appendChild(item);
    });
}

/**
 * Öffnet den Vollbildmodus für einen spezifischen Stream inklusive Chat.
 */
export function openLiveFullscreen(streamId, category, location) {
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
}

/**
 * Schließt das Vollbild-Modal.
 */
export function closeLiveFullscreen() {
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Sendet eine Chatnachricht im aktiven Stream.
 */
export function sendLiveChatMessage() {
    const input = document.getElementById('live-chat-input');
    const chatList = document.getElementById('live-chat-messages');
    if (!input || !input.value.trim() || !chatList) return;

    const msgText = input.value.trim();
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 8px; font-size: 11px; margin-bottom: 4px;';
    msgDiv.innerHTML = `<strong style="color: #818cf8;">Du:</strong> ${msgText}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;
    input.value = '';
}

// Global für onclick-Handler im HTML verfügbar machen
window.loadLiveStreams = loadLiveStreams;
window.openLiveFullscreen = openLiveFullscreen;
window.closeLiveFullscreen = closeLiveFullscreen;
window.sendLiveChatMessage = sendLiveChatMessage;