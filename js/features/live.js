// js/features/live.js • PURE LOGIC Live-Stream, WebRTC Peer-to-Peer, Realtime-Chat, Geschenke & Abos
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let liveObserver = null;
let localStream = null;
let activePeerConnection = null;
let remoteStream = null;
let activeStreamId = null;
let selectedMainCategory = '💬 Plaudern';
let selectedSubCategory = 'Allgemein';
let currentActiveFilter = 'Alle';
let viewerInterval = null;
let chatPollInterval = null;
let chatChannel = null;
let streamsListChannel = null;
let signalingChannel = null;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const campusGifts = [
    { id: 1, name: 'Kaffee ☕', cost: 10 },
    { id: 2, name: 'Brezel 🥨', cost: 20 },
    { id: 3, name: 'Energiedrink ⚡', cost: 35 },
    { id: 4, name: 'Pizza-Slice 🍕', cost: 50 },
    { id: 5, name: 'Skript 📖', cost: 75 },
    { id: 6, name: 'Club Mate 🧉', cost: 100 },
    { id: 7, name: 'Spickzettel 📝', cost: 150 },
    { id: 8, name: 'Tischrechner 🧮', cost: 200 },
    { id: 9, name: 'Vorlesungs-Stift ✒️', cost: 300 },
    { id: 10, name: 'Mensa-Gutschein 🍔', cost: 450 },
    { id: 11, name: 'Bib-Platz (1. Reihe) 🪑', cost: 600 },
    { id: 12, name: 'Hype Rakete 🚀', cost: 800 },
    { id: 13, name: 'Professoren-Respekt 🎓', cost: 1000 },
    { id: 14, name: 'Goldene Mensa-Card 💳', cost: 1500 },
    { id: 15, name: 'Master-Admin Krone 👑', cost: 2500 }
];

const subCategoriesMap = {
    '💬 Plaudern': ['Allgemein', 'Campus Life', 'Late Night Talk', 'Q&A / Frag mich alles', 'Kaffee & Break'],
    '🎮 Gaming': ['World of Warcraft (WoW)', 'Minecraft', 'League of Legends', 'Valorant', 'Apex Legends', 'GTA V', 'Indie Games'],
    '🎵 Musik': ['Rock / Metal', 'Pop & Charts', 'Hip-Hop / Rap', 'Electronic / Techno', 'Lo-Fi / Chill Beats', 'Akustik / Live Jam'],
    '📚 Lernen': ['Study With Me (Pomodoro)', 'Coding & Programming', 'Mathematik & Statistik', 'Vorbereitung Klausur', 'Fremdsprachen']
};

export async function handlePreLiveCheck() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um einen Live-Stream zu starten!');
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, 
            audio: true 
        });
    } catch (err) {
        console.warn('Kamera-Zugriff verweigert oder nicht verfügbar:', err);
        alert('Kamera-Zugriff wird für den Live-Stream benötigt.');
        return;
    }

    showPreLivePreviewModal();
}

function showPreLivePreviewModal() {
    let previewModal = document.getElementById('live-preview-modal');
    selectedMainCategory = '💬 Plaudern';
    selectedSubCategory = 'Allgemein';
    
    if (!previewModal) {
        previewModal = document.createElement('div');
        previewModal.id = 'live-preview-modal';
        previewModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(9, 13, 22, 0.96); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; overflow-y: auto;';
        
        previewModal.innerHTML = `
            <div style="width: 100%; max-width: 440px; background: #0f172a; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.8); max-height: 95vh;">
                <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <h3 style="font-size: 15px; font-weight: 900; color: #fff; margin: 0;">🎥 WebRTC Stream-Setup</h3>
                    <button type="button" onclick="closePreLivePreview()" style="background: none; border: none; color: #fff; font-size: 22px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="position: relative; width: 100%; height: 180px; background: #000; flex-shrink: 0;">
                    <video id="preview-camera-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 800;">WebRTC bereit 🎥</div>
                </div>

                <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted);">1. Hauptkategorie wählen:</label>
                    <div id="preview-main-cat-pills" style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="cat-pill active" onclick="selectMainPreviewCategory(this, '💬 Plaudern')" style="background: var(--gradient-main); border: none; padding: 5px 10px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">💬 Plaudern</button>
                        <button type="button" class="cat-pill" onclick="selectMainPreviewCategory(this, '🎮 Gaming')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 5px 10px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">🎮 Gaming</button>
                        <button type="button" class="cat-pill" onclick="selectMainPreviewCategory(this, '🎵 Musik')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 5px 10px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">🎵 Musik</button>
                        <button type="button" class="cat-pill" onclick="selectMainPreviewCategory(this, '📚 Lernen')" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); padding: 5px 10px; border-radius: 20px; color: #fff; font-size: 11px; font-weight: 800; cursor: pointer;">📚 Lernen</button>
                    </div>

                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 2px;">2. Genre / Unterkategorie:</label>
                    <div id="preview-sub-cat-pills" style="display: flex; gap: 5px; flex-wrap: wrap; max-height: 80px; overflow-y: auto;"></div>

                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 2px;">Stream-Info / Titel:</label>
                    <input type="text" id="preview-stream-title-input" placeholder="z. B. Live Coding oder Campus Talk..." style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: #fff; font-size: 11px;">

                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted);">Standort / Hörsaal:</label>
                    <input type="text" id="preview-location-input" value="Uni Wien Hauptgebäude" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: #fff; font-size: 11px;">

                    <button type="button" class="btn" onclick="confirmAndStartLiveStream()" style="margin-top: 4px; background: var(--gradient-main); font-weight: 900; padding: 10px; font-size: 12px;">Jetzt live gehen 🚀</button>
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

    updateSubCategoriesUI('💬 Plaudern');
}

export function selectMainPreviewCategory(btnElement, mainCat) {
    selectedMainCategory = mainCat;
    document.querySelectorAll('#preview-main-cat-pills button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.border = '1px solid var(--border)';
    });
    btnElement.classList.add('active');
    btnElement.style.background = 'var(--gradient-main)';
    btnElement.style.border = 'none';

    updateSubCategoriesUI(mainCat);
}

function updateSubCategoriesUI(mainCat) {
    const subContainer = document.getElementById('preview-sub-cat-pills');
    if (!subContainer) return;

    const subs = subCategoriesMap[mainCat] || ['Allgemein'];
    selectedSubCategory = subs[0];

    subContainer.innerHTML = '';
    subs.forEach((sub, index) => {
        const subBtn = document.createElement('button');
        subBtn.type = 'button';
        subBtn.className = index === 0 ? 'cat-pill active' : 'cat-pill';
        subBtn.textContent = sub;
        subBtn.style.cssText = index === 0 
            ? 'background: rgba(99,102,241,0.3); border: 1px solid #818cf8; padding: 4px 10px; border-radius: 16px; color: #fff; font-size: 10px; font-weight: 700; cursor: pointer;'
            : 'background: rgba(255,255,255,0.04); border: 1px solid var(--border); padding: 4px 10px; border-radius: 16px; color: var(--text-muted); font-size: 10px; font-weight: 700; cursor: pointer;';
        
        subBtn.onclick = () => {
            selectedSubCategory = sub;
            document.querySelectorAll('#preview-sub-cat-pills button').forEach(b => {
                b.style.background = 'rgba(255,255,255,0.04)';
                b.style.border = '1px solid var(--border)';
                b.style.color = 'var(--text-muted)';
            });
            subBtn.style.background = 'rgba(99,102,241,0.3)';
            subBtn.style.border = '1px solid #818cf8';
            subBtn.style.color = '#fff';
        };

        subContainer.appendChild(subBtn);
    });
}

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

export async function confirmAndStartLiveStream() {
    const locInput = document.getElementById('preview-location-input');
    const titleInput = document.getElementById('preview-stream-title-input');
    
    const location = locInput ? locInput.value.trim() : 'Uni Wien';
    const customTitle = titleInput ? titleInput.value.trim() : '';

    const finalCategoryLabel = `${selectedMainCategory} • ${selectedSubCategory}`;
    const finalTitle = customTitle ? customTitle : `${selectedSubCategory} live aus ${location}`;

    if (!validateInputOrAlert(finalCategoryLabel) || !validateInputOrAlert(location)) return;

    const previewModal = document.getElementById('live-preview-modal');
    if (previewModal) {
        previewModal.classList.add('hidden');
    }

    await startLiveStreamBroadcast(finalCategoryLabel, location, finalTitle, 'webrtc-active');
}

async function startLiveStreamBroadcast(category, location, title, streamUrl = 'webrtc-active') {
    try {
        const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

        const { data, error } = await _supabase
            .from('live_streams')
            .insert([
                {
                    id: crypto.randomUUID(),
                    host_email: state.currentUserEmail,
                    title: title,
                    category: category,
                    location: location,
                    stream_url: streamUrl,
                    viewers_count: 1,
                    expires_at: expiresAt,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Fehler:', error);
            alert('Datenbank-Fehler beim Starten: ' + error.message);
            return;
        }

        activeStreamId = data.id;
        loadLiveStreams();

        if (localStream) {
            openLiveFullscreen(data.id, category, location, title, true, data.host_email);
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

export async function loadLiveStreams() {
    const liveList = document.getElementById('live-streams-list');
    if (!liveList) return;

    liveList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade aktive Live-Streams...</p>';

    const nowIso = new Date().toISOString();

    let query = _supabase
        .from('live_streams')
        .select('*')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });

    if (currentActiveFilter && currentActiveFilter !== 'Alle') {
        query = query.ilike('category', `%${currentActiveFilter}%`);
    }

    const { data: streams, error } = await query;

    if (error || !streams || streams.length === 0) {
        liveList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Keine aktiven Streams für "${currentActiveFilter}".</p>
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
        const streamTitle = stream.title || 'Campus Stream';
        const streamId = stream.id ? String(stream.id) : '0000';
        const hostEmail = stream.host_email || '';
        const viewers = stream.viewers_count || 1;

        const isMyStream = state.currentUserEmail && hostEmail.toLowerCase() === state.currentUserEmail.toLowerCase();

        item.innerHTML = `
            <div style="width: 100%; height: 100%; position: relative; cursor: pointer; background: linear-gradient(135deg, #090d16, #1e1b4b);" onclick="openLiveFullscreen('${streamId}', '${category}', '${location}', '${streamTitle}', ${isMyStream}, '${hostEmail}')">
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; text-align: center; position: relative;">
                    <div style="font-size: 48px; margin-bottom: 8px;">🔴</div>
                    <span style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.5); color: #ef4444; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-bottom: 8px;">${category}</span>
                    <h3 style="font-size: 18px; font-weight: 900; color: #fff; margin-bottom: 4px;">${streamTitle}</h3>
                    <p style="font-size: 11px; color: var(--text-muted);">Streamer: ${hostEmail.split('@')[0]} • 👥 ${viewers} Zuschauer</p>
                </div>
                <div style="position: absolute; top: 16px; left: 16px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 4px; z-index: 2;">
                    <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> LIVE
                </div>
            </div>
            <div class="reel-overlay" style="justify-content: flex-end; align-items: flex-start; text-align: left; background: linear-gradient(0deg, rgba(9,13,22,0.95) 0%, transparent 60%); padding: 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 ${category}</div>
                <div style="font-size: 13px; color: #fff; font-weight: 600; margin-bottom: 4px;">${streamTitle}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">👥 ${viewers} Zuschauer aktiv</div>
                <button class="btn" style="width: auto; padding: 8px 18px; font-size: 11px; font-weight: 800; background: var(--gradient-main);" onclick="event.stopPropagation(); openLiveFullscreen('${streamId}', '${category}', '${location}', '${streamTitle}', ${isMyStream}, '${hostEmail}')">Vollbild beitreten 🚀</button>
            </div>
        `;
        
        liveList.appendChild(item);
    });

    if (!streamsListChannel) {
        streamsListChannel = _supabase
            .channel('public:live_streams_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => {
                loadLiveStreams();
            })
            .subscribe();
    }
}

export function setLiveFilter(element, category) {
    document.querySelectorAll('#live-filter-group .cat-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    currentActiveFilter = category;
    loadLiveStreams();
}

export async function openLiveFullscreen(streamId, category, location, streamTitle = '', isHost = false, hostEmail = '') {
    activeStreamId = streamId;
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');

    const titleDisplay = document.getElementById('active-live-title-display');
    const playerContainer = document.getElementById('live-stream-player-container');
    const chatInputContainer = document.getElementById('live-chat-input-container');

    if (titleDisplay) titleDisplay.textContent = `🔴 ${streamTitle || category}`;
    
    const currentUserIsHost = isHost || (state.currentUserEmail && hostEmail && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase()) || (localStream !== null);

    let currentViewers = 1;
    try {
        const { data: streamData } = await _supabase
            .from('live_streams')
            .select('viewers_count')
            .eq('id', streamId)
            .single();

        if (streamData) {
            currentViewers = streamData.viewers_count || 1;
            if (!currentUserIsHost) {
                currentViewers += 1;
                await _supabase
                    .from('live_streams')
                    .update({ viewers_count: currentViewers })
                    .eq('id', streamId);
            }
        }
    } catch (e) {
        console.warn('Viewer Count Sync Fehler:', e);
    }

    let badge = document.getElementById('guaranteed-live-viewer-badge');
    if (!badge && playerContainer) {
        badge = document.createElement('div');
        badge.id = 'guaranteed-live-viewer-badge';
        badge.style.cssText = 'position: absolute; top: 16px; right: 16px; background: rgba(15, 23, 42, 0.85); border: 2px solid #10b981; color: #fff; padding: 6px 14px; border-radius: 30px; font-size: 12px; font-weight: 900; z-index: 99999; backdrop-filter: blur(8px); box-shadow: 0 4px 20px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 6px;';
        playerContainer.style.position = 'relative';
        playerContainer.appendChild(badge);
    }
    if (badge) {
        badge.innerHTML = `👥 <span id="live-viewer-count" style="color: #10b981;">${currentViewers}</span> Zuschauer`;
    }

    if (viewerInterval) clearInterval(viewerInterval);
    viewerInterval = setInterval(async () => {
        try {
            const { data: sData } = await _supabase
                .from('live_streams')
                .select('viewers_count')
                .eq('id', activeStreamId)
                .single();

            if (sData) {
                const vSpan = document.getElementById('live-viewer-count');
                if (vSpan) {
                    vSpan.textContent = sData.viewers_count || 1;
                }
            }
        } catch (err) {}
    }, 2500);

    if (playerContainer) {
        const existingBadgeHtml = playerContainer.querySelector('#guaranteed-live-viewer-badge')?.outerHTML || '';
        playerContainer.innerHTML = `
            <video id="active-web-rtc-video" autoplay playsinline ${currentUserIsHost ? 'muted' : ''} style="width: 100%; height: 100%; object-fit: cover; background: #000; position: absolute; top:0; left:0;"></video>
            <div style="position: absolute; top: 16px; left: 16px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; z-index: 5;">${currentUserIsHost ? '🎥 Du sendest Live (WebRTC)' : '🔴 Live WebRTC Stream'}</div>
            ${existingBadgeHtml}
        `;
    }

    if (chatInputContainer) {
        if (currentUserIsHost) {
            chatInputContainer.innerHTML = `
                <button type="button" class="btn" style="background: #ef4444; color: #fff; font-weight: 900; font-size: 11px; padding: 8px; border-radius: 8px; width: 100%; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239,68,68,0.4); margin-bottom: 4px;" onclick="terminateActiveStream()">🛑 Stream beenden</button>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <input type="text" id="live-chat-input" placeholder="Als Host schreiben..." style="margin: 0; font-size: 11px; padding: 8px 10px; flex: 1;" onkeydown="if(event.key==='Enter') sendLiveChatMessage()">
                    <button type="button" class="btn" style="width: auto; margin: 0; padding: 0 12px; font-size: 11px; font-weight: 800;" onclick="sendLiveChatMessage()">Senden</button>
                </div>
            `;
        } else {
            chatInputContainer.innerHTML = `
                <div style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center; overflow-x: auto; padding-bottom: 2px;">
                    <button type="button" onclick="openGiftsGalleryModal('${hostEmail}')" class="btn" style="background: linear-gradient(135deg, #f59e0b, #ec4899); color: #fff; font-size: 10px; font-weight: 900; padding: 6px 10px; border-radius: 16px; border: none; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">🎁 Geschenke</button>
                    <button type="button" onclick="subscribeToCreator('${hostEmail}')" class="btn" style="background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: #fff; font-size: 10px; font-weight: 900; padding: 6px 10px; border-radius: 16px; border: none; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(139,92,246,0.3);">⭐ Abo (150P/Mo)</button>
                </div>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <input type="text" id="live-chat-input" placeholder="Nachricht in den Chat schreiben..." style="margin: 0; font-size: 11px; padding: 8px 10px; flex: 1;" onkeydown="if(event.key==='Enter') sendLiveChatMessage()">
                    <button type="button" class="btn" style="width: auto; margin: 0; padding: 0 12px; font-size: 11px; font-weight: 800;" onclick="sendLiveChatMessage()">Senden</button>
                </div>
            `;
        }
    }

    const chatMessagesEl = document.getElementById('live-chat-messages');
    if (chatMessagesEl) {
        chatMessagesEl.innerHTML = `<div style="color: var(--text-muted); text-align: center;">WebRTC Verbindung wird aufgebaut... 🔗</div>`;
    }

    await loadExistingChatMessages(streamId);

    if (chatChannel) {
        _supabase.removeChannel(chatChannel);
    }

    chatChannel = _supabase
        .channel(`public:live_chat_messages:stream_id=eq.${streamId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'live_chat_messages',
            filter: `stream_id=eq.${streamId}`
        }, payload => {
            appendMessageToChatUI(payload.new);
        })
        .subscribe();

    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
        loadExistingChatMessages(streamId);
    }, 2000);

    initWebRTCSignaling(streamId, currentUserIsHost);
}

function initWebRTCSignaling(streamId, isHost) {
    if (signalingChannel) _supabase.removeChannel(signalingChannel);

    signalingChannel = _supabase.channel(`webrtc:${streamId}`, {
        config: { broadcast: { self: false } }
    });

    activePeerConnection = new RTCPeerConnection(rtcConfig);

    if (isHost && localStream) {
        localStream.getTracks().forEach(track => activePeerConnection.addTrack(track, localStream));
        const vidEl = document.getElementById('active-web-rtc-video');
        if (vidEl) vidEl.srcObject = localStream;
    }

    activePeerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        const vidEl = document.getElementById('active-web-rtc-video');
        if (vidEl && remoteStream) {
            vidEl.srcObject = remoteStream;
            vidEl.play().catch(e => console.warn('Remote Video Autoplay:', e));
        }
    };

    activePeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalingChannel.send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: { candidate: event.candidate, sender: state.currentUserEmail }
            });
        }
    };

    signalingChannel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
            if (isHost) return;
            try {
                await activePeerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await activePeerConnection.createAnswer();
                await activePeerConnection.setLocalDescription(answer);

                signalingChannel.send({
                    type: 'broadcast',
                    event: 'answer',
                    payload: { answer: answer, sender: state.currentUserEmail }
                });
            } catch (err) {
                console.error('WebRTC Offer Fehler:', err);
            }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
            if (!isHost) return;
            try {
                await activePeerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
            } catch (err) {
                console.error('WebRTC Answer Fehler:', err);
            }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            try {
                if (payload.candidate) {
                    await activePeerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
                }
            } catch (err) {
                console.error('ICE Candidate Fehler:', err);
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && isHost) {
                setTimeout(async () => {
                    try {
                        const offer = await activePeerConnection.createOffer();
                        await activePeerConnection.setLocalDescription(offer);
                        signalingChannel.send({
                            type: 'broadcast',
                            event: 'offer',
                            payload: { offer: offer, sender: state.currentUserEmail }
                        });
                    } catch (err) {
                        console.error('Host Offer Fehler:', err);
                    }
                }, 1000);
            }
        });
}

async function loadExistingChatMessages(streamId) {
    try {
        const { data: messages, error } = await _supabase
            .from('live_chat_messages')
            .select('*')
            .eq('stream_id', streamId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (!error && messages) {
            const chatList = document.getElementById('live-chat-messages');
            if (!chatList) return;

            const existingIds = new Set(Array.from(chatList.querySelectorAll('[data-msg-id]')).map(el => el.getAttribute('data-msg-id')));

            messages.forEach(msg => {
                if (!existingIds.has(String(msg.id))) {
                    appendMessageToChatUI(msg);
                }
            });
        }
    } catch (e) {}
}

function appendMessageToChatUI(msg) {
    const chatList = document.getElementById('live-chat-messages');
    if (!chatList) return;

    if (chatList.innerHTML.includes('WebRTC Verbindung') || chatList.innerHTML.includes('Willkommen im Live-Chat!')) {
        chatList.innerHTML = '';
    }

    const sender = msg.sender_email ? msg.sender_email.split('@')[0] : 'User';
    const isMe = state.currentUserEmail && msg.sender_email && msg.sender_email.toLowerCase() === state.currentUserEmail.toLowerCase();
    const color = isMe ? '#10b981' : '#818cf8';

    const msgDiv = document.createElement('div');
    msgDiv.setAttribute('data-msg-id', msg.id);
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 6px; font-size: 11px; margin-bottom: 3px; word-break: break-word;';
    msgDiv.innerHTML = `<strong style="color: ${color};">${sender}:</strong> ${msg.message_text}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;
}

export async function sendLiveChatMessage() {
    const input = document.getElementById('live-chat-input');
    if (!input) {
        console.warn('Chat-Input Feld nicht gefunden!');
        return;
    }

    const msgText = input.value.trim();
    if (!msgText) return;

    if (!validateInputOrAlert(msgText)) return;

    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um im Chat zu schreiben.');
        return;
    }

    if (!activeStreamId) {
        alert('Kein aktiver Stream verbunden!');
        return;
    }

    try {
        const { error } = await _supabase
            .from('live_chat_messages')
            .insert([
                {
                    id: crypto.randomUUID(),
                    stream_id: activeStreamId,
                    sender_email: state.currentUserEmail,
                    message_text: msgText,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Supabase Chat Insert Fehler:', error);
            alert('Fehler beim Senden der Nachricht: ' + error.message);
            return;
        }

        input.value = '';
    } catch (err) {
        console.error('Fehler beim Senden der Chat-Nachricht:', err);
    }
}

window.openGiftsGalleryModal = function(hostEmail) {
    let modal = document.getElementById('gifts-gallery-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gifts-gallery-modal';
        modal.className = 'hidden';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 20000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(6px);';
        
        modal.innerHTML = `
            <div style="background: var(--card); border: 1px solid var(--border); width: 92%; max-width: 420px; height: 82vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
                <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
                    <div>
                        <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin: 0;">🎁 Campus Geschenke-Galerie</h3>
                        <p style="font-size: 10px; color: var(--text-muted); margin: 2px 0 0 0;">Zahle mit Campus-Punkten (Coins kommen bald! 🪙)</p>
                    </div>
                    <button type="button" onclick="closeGiftsGalleryModal()" style="background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer;">&times;</button>
                </div>
                
                <div id="gifts-grid-container" style="flex: 1; overflow-y: auto; padding: 14px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;"></div>

                <div style="padding: 12px 16px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.3); text-align: center;">
                    <span style="font-size: 10px; color: var(--text-muted);">Geschenke lösen Animationen im Stream aus! ✨</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    renderGiftsGrid(hostEmail);
};

window.closeGiftsGalleryModal = function() {
    const modal = document.getElementById('gifts-gallery-modal');
    if (modal) modal.classList.add('hidden');
};

function renderGiftsGrid(hostEmail) {
    const grid = document.getElementById('gifts-grid-container');
    if (!grid) return;

    grid.innerHTML = '';
    campusGifts.forEach(gift => {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; cursor: pointer; transition: all 0.2s ease;';
        card.onmouseover = () => { card.style.borderColor = 'var(--primary)'; card.style.background = 'rgba(99,102,241,0.08)'; };
        card.onmouseout = () => { card.style.borderColor = 'var(--border)'; card.style.background = 'rgba(255,255,255,0.03)'; };
        
        card.onclick = () => sendLiveGift(gift.name, gift.cost, hostEmail);

        card.innerHTML = `
            <div style="font-size: 28px;">${gift.name.split(' ').pop()}</div>
            <div style="font-size: 12px; font-weight: 800; color: #fff;">${gift.name}</div>
            <div style="font-size: 11px; font-weight: 900; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(245,158,11,0.3);">⚡ ${gift.cost} P</div>
        `;
        grid.appendChild(card);
    });
}

export async function subscribeToCreator(creatorEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um einen Creator zu abonnieren.');
        return;
    }

    if (creatorEmail && state.currentUserEmail.toLowerCase() === creatorEmail.toLowerCase()) {
        alert('Du kannst deinen eigenen Kanal nicht abonnieren! 😉');
        return;
    }

    const subCost = 150;

    if (!confirm(`Möchtest du diesen Creator für 1 Monat abonnieren? Kosten: ${subCost} Campus-Punkte ⚡`)) {
        return;
    }

    try {
        const { data: myData, error: myErr } = await _supabase
            .from('users')
            .select('logic_score')
            .eq('email', state.currentUserEmail)
            .single();

        if (myErr || !myData || (myData.logic_score || 0) < subCost) {
            alert(`Du hast nicht genügend Campus-Punkte! Ein Abo kostet ${subCost} P.`);
            return;
        }

        const newMyScore = myData.logic_score - subCost;

        await _supabase
            .from('users')
            .update({ logic_score: newMyScore })
            .eq('email', state.currentUserEmail);

        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.textContent = `${newMyScore} P`;

        if (creatorEmail) {
            const { data: hostData } = await _supabase
                .from('users')
                .select('logic_score')
                .eq('email', creatorEmail)
                .single();

            const hostNewScore = (hostData?.logic_score || 0) + subCost;
            await _supabase
                .from('users')
                .update({ logic_score: hostNewScore })
                .eq('email', creatorEmail);
        }

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await _supabase
            .from('channel_subscriptions')
            .upsert([
                {
                    subscriber_email: state.currentUserEmail,
                    creator_email: creatorEmail,
                    monthly_points: subCost,
                    expires_at: expiresAt
                }
            ], { onConflict: 'subscriber_email, creator_email' });

        alert('Abo erfolgreich abgeschlossen! Du hast nun exklusive VIP-Vorteile in diesem Stream. 🎉');

    } catch (err) {
        console.error('Fehler beim Abo-Abschluss:', err);
        alert('Fehler beim Abschließen des Abos.');
    }
}

export async function sendLiveGift(giftName, cost, hostEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um Geschenke zu senden.');
        return;
    }

    if (hostEmail && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase()) {
        alert('Du kannst dir selbst keine Geschenke senden! 😉');
        return;
    }

    try {
        const { data: myData, error: myErr } = await _supabase
            .from('users')
            .select('logic_score')
            .eq('email', state.currentUserEmail)
            .single();

        if (myErr || !myData || (myData.logic_score || 0) < cost) {
            alert(`Du hast nicht genügend Campus-Punkte! Dieses Geschenk kostet ${cost} P.`);
            return;
        }

        const newMyScore = myData.logic_score - cost;

        await _supabase
            .from('users')
            .update({ logic_score: newMyScore })
            .eq('email', state.currentUserEmail);

        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.textContent = `${newMyScore} P`;

        if (hostEmail) {
            const { data: hostData } = await _supabase
                .from('users')
                .select('logic_score')
                .eq('email', hostEmail)
                .single();

            const hostNewScore = (hostData?.logic_score || 0) + cost;
            await _supabase
                .from('users')
                .update({ logic_score: hostNewScore })
                .eq('email', hostEmail);
        }

        closeGiftsGalleryModal();

        if (activeStreamId) {
            await _supabase
                .from('live_chat_messages')
                .insert([
                    {
                        id: crypto.randomUUID(),
                        stream_id: activeStreamId,
                        sender_email: state.currentUserEmail,
                        message_text: `🎁 HAT ${giftName.toUpperCase()} (${cost} P) GESENDET! 🎉`,
                        created_at: new Date().toISOString()
                    }
                ]);
        }

    } catch (err) {
        console.error('Fehler beim Senden des Geschenks:', err);
        alert('Fehler beim Senden des Geschenks.');
    }
}

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
        console.error('Fehler beim Löschen des Streams:', err);
    }

    closeLiveFullscreen();
    loadLiveStreams();
}

export async function closeLiveFullscreen() {
    if (viewerInterval) clearInterval(viewerInterval);
    if (chatPollInterval) clearInterval(chatPollInterval);
    if (chatChannel) {
        _supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (signalingChannel) {
        _supabase.removeChannel(signalingChannel);
        signalingChannel = null;
    }
    
    if (activeStreamId) {
        try {
            const { data: sData } = await _supabase
                .from('live_streams')
                .select('viewers_count, host_email')
                .eq('id', activeStreamId)
                .single();

            if (sData) {
                const isHost = state.currentUserEmail && sData.host_email && state.currentUserEmail.toLowerCase() === sData.host_email.toLowerCase();
                if (!isHost) {
                    const newCount = Math.max(1, (sData.viewers_count || 1) - 1);
                    await _supabase
                        .from('live_streams')
                        .update({ viewers_count: newCount })
                        .eq('id', activeStreamId);
                }
            }
        } catch (e) {}
    }

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

// Globale Bindings
window.loadLiveStreams = loadLiveStreams;
window.handlePreLiveCheck = handlePreLiveCheck;
window.closePreLivePreview = closePreLivePreview;
window.selectMainPreviewCategory = selectMainPreviewCategory;
window.confirmAndStartLiveStream = confirmAndStartLiveStream;
window.setLiveFilter = setLiveFilter;
window.openLiveFullscreen = openLiveFullscreen;
window.closeLiveFullscreen = closeLiveFullscreen;
window.terminateActiveStream = terminateActiveStream;
window.sendLiveChatMessage = sendLiveChatMessage;
window.sendLiveGift = sendLiveGift;
window.subscribeToCreator = subscribeToCreator;