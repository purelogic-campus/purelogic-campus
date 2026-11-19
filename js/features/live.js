// js/features/live.js • PURE LOGIC Live-Stream, Vorschau-Logik (PC vs. Smartphone), Ranking-Sortierung, Auto-Weiterleitung, Geschenk-Animation (5s+), Geschenk-Sounds & Vertikaler PC-Chat (60% Transparenz + Collapse)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let localStream = null;
let activeStreamId = null;
let selectedMainCategory = '💬 Plaudern';
let selectedSubCategory = 'Allgemein';
let currentActiveFilter = 'Alle';
let viewerInterval = null;
let chatPollInterval = null;
let chatChannel = null;
let broadcastInterval = null;
let framePollInterval = null;
let gridPollInterval = null;
let audioCtx = null;
let desktopChatOpacity = 0.6;
let desktopChatCollapsed = false;
const animatedGiftMsgIds = new Set();

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

const giftSoundProfiles = {
    1: { notes: [523.25, 659.25], type: 'sine', step: 0.11, dur: 0.22, gain: 0.14 },
    2: { notes: [392.00, 493.88, 587.33], type: 'triangle', step: 0.09, dur: 0.18, gain: 0.14 },
    3: { notes: [440, 554.37, 659.25, 880], type: 'sawtooth', step: 0.06, dur: 0.16, gain: 0.11 },
    4: { notes: [349.23, 440.00, 523.25], type: 'triangle', step: 0.1, dur: 0.22, gain: 0.15 },
    5: { notes: [587.33, 783.99], type: 'sine', step: 0.12, dur: 0.24, gain: 0.13 },
    6: { notes: [493.88, 659.25, 783.99], type: 'square', step: 0.07, dur: 0.16, gain: 0.09 },
    7: { notes: [659.25, 587.33, 783.99], type: 'triangle', step: 0.07, dur: 0.15, gain: 0.12 },
    8: { notes: [783.99, 880.00, 987.77, 1046.50], type: 'sine', step: 0.06, dur: 0.14, gain: 0.12 },
    9: { notes: [440.00, 659.25], type: 'triangle', step: 0.12, dur: 0.25, gain: 0.13 },
    10: { notes: [523.25, 659.25, 783.99, 1046.50], type: 'triangle', step: 0.08, dur: 0.2, gain: 0.15 },
    11: { notes: [329.63, 493.88, 659.25], type: 'sine', step: 0.1, dur: 0.24, gain: 0.14 },
    12: { notes: [261.63, 392.00, 523.25, 783.99, 1046.50], type: 'sawtooth', step: 0.07, dur: 0.22, gain: 0.12 },
    13: { notes: [392.00, 493.88, 587.33, 783.99], type: 'sine', step: 0.11, dur: 0.28, gain: 0.15 },
    14: { notes: [587.33, 739.99, 880.00, 1174.66], type: 'triangle', step: 0.08, dur: 0.26, gain: 0.15 },
    15: { notes: [523.25, 659.25, 783.99, 1046.50, 1318.51], type: 'triangle', step: 0.09, dur: 0.34, gain: 0.17 }
};

const subCategoriesMap = {
    '💬 Plaudern': ['Allgemein', 'Campus Life', 'Late Night Talk', 'Q&A / Frag mich alles', 'Kaffee & Break'],
    '🎮 Gaming': ['World of Warcraft (WoW)', 'Minecraft', 'League of Legends', 'Valorant', 'Apex Legends', 'GTA V', 'Indie Games'],
    '🎵 Musik': ['Rock / Metal', 'Pop & Charts', 'Hip-Hop / Rap', 'Electronic / Techno', 'Lo-Fi / Chill Beats', 'Akustik / Live Jam'],
    '📚 Lernen': ['Study With Me (Pomodoro)', 'Coding & Programming', 'Mathematik & Statistik', 'Vorbereitung Klausur', 'Fremdsprachen']
};

function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

function findGiftByText(giftText) {
    if (!giftText) return campusGifts[0];
    const normalized = giftText.toLowerCase();
    return (
        campusGifts.find(g => normalized.includes(g.name.toLowerCase())) ||
        campusGifts.find(g => {
            const emoji = g.name.split(' ').pop();
            return emoji && normalized.includes(emoji);
        }) ||
        campusGifts[0]
    );
}

export function playGiftSound(giftOrId) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const giftId = typeof giftOrId === 'object' && giftOrId !== null ? giftOrId.id : Number(giftOrId) || 1;
    const profile = giftSoundProfiles[giftId] || giftSoundProfiles[1];
    const now = ctx.currentTime;

    profile.notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = profile.type;
        osc.frequency.setValueAtTime(freq, now + idx * profile.step);

        const startAt = now + idx * profile.step;
        const endAt = startAt + profile.dur;
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(profile.gain, startAt + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(endAt + 0.02);
    });
}

function ensureGiftAndDesktopStyles() {
    if (!document.getElementById('live-gift-anim-styles')) {
        const style = document.createElement('style');
        style.id = 'live-gift-anim-styles';
        style.textContent = `
            @keyframes liveGiftBannerPop {
                0% { transform: translate(-50%, 28px) scale(0.75); opacity: 0; }
                8% { transform: translate(-50%, 0) scale(1.06); opacity: 1; }
                14% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                88% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -32px) scale(0.92); opacity: 0; }
            }
            @keyframes liveGiftEmojiBurst {
                0% { transform: translateY(0) scale(0.5) rotate(-10deg); opacity: 0; }
                12% { opacity: 1; transform: translateY(-25px) scale(1.25) rotate(8deg); }
                100% { transform: translateY(-240px) scale(1.55) rotate(-14deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    if (!document.getElementById('live-desktop-left-chat-styles')) {
        const desktopStyle = document.createElement('style');
        desktopStyle.id = 'live-desktop-left-chat-styles';
        desktopStyle.textContent = `
            @media (min-width: 768px) {
                #live-fullscreen-modal.desktop-left-chat-active .live-modal-body,
                #live-fullscreen-modal.desktop-left-chat-active > div > div:last-child {
                    position: relative;
                }
                #live-fullscreen-modal.desktop-left-chat-active #live-chat-panel,
                #live-fullscreen-modal.desktop-left-chat-active [id*="live-chat-panel"] {
                    position: fixed !important;
                    top: 76px !important;
                    left: 20px !important;
                    bottom: 20px !important;
                    width: 320px !important;
                    max-width: calc(100vw - 40px) !important;
                    height: auto !important;
                    max-height: calc(100vh - 96px) !important;
                    z-index: 10050 !important;
                    border-radius: 16px !important;
                    border: 1px solid rgba(255, 255, 255, 0.16) !important;
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    transition: width 0.22s ease, opacity 0.2s ease;
                }
                #live-fullscreen-modal.desktop-left-chat-active.chat-is-collapsed #live-chat-panel,
                #live-fullscreen-modal.desktop-left-chat-active.chat-is-collapsed [id*="live-chat-panel"] {
                    width: auto !important;
                    height: auto !important;
                    top: 76px !important;
                    left: 20px !important;
                    bottom: auto !important;
                }
                #live-fullscreen-modal.desktop-left-chat-active.chat-is-collapsed #live-chat-messages,
                #live-fullscreen-modal.desktop-left-chat-active.chat-is-collapsed #live-chat-input-container,
                #live-fullscreen-modal.desktop-left-chat-active.chat-is-collapsed .live-chat-opacity-row {
                    display: none !important;
                }
                #live-fullscreen-modal.desktop-left-chat-active #live-chat-messages {
                    flex: 1 !important;
                    height: auto !important;
                    min-height: 168px !important;
                    max-height: none !important;
                    background: transparent !important;
                }
                #live-fullscreen-modal.desktop-left-chat-active #live-chat-input-container {
                    background: rgba(15, 23, 42, 0.55) !important;
                }
            }
        `;
        document.head.appendChild(desktopStyle);
    }
}

function applyDesktopChatLayout() {
    ensureGiftAndDesktopStyles();
    const modal = document.getElementById('live-fullscreen-modal');
    if (!modal) return;

    const chatMessagesEl = document.getElementById('live-chat-messages');
    const chatInputContainer = document.getElementById('live-chat-input-container');
    const chatPanel =
        chatMessagesEl?.closest('[id*="chat"]') ||
        chatInputContainer?.closest('[id*="chat"]') ||
        chatMessagesEl?.parentElement;

    if (chatPanel && !chatPanel.id) {
        chatPanel.id = 'live-chat-panel';
    }

    const isDesktop = window.innerWidth >= 768;

    if (isDesktop && chatPanel) {
        modal.classList.add('desktop-left-chat-active');
        modal.classList.toggle('chat-is-collapsed', desktopChatCollapsed);

        const alpha = desktopChatOpacity;
        chatPanel.style.backgroundColor = `rgba(15, 23, 42, ${alpha})`;
        chatPanel.style.backdropFilter = alpha < 0.95 ? 'blur(10px)' : 'none';

        let controlsBar = document.getElementById('desktop-chat-controls-bar');
        if (!controlsBar) {
            controlsBar = document.createElement('div');
            controlsBar.id = 'desktop-chat-controls-bar';
            controlsBar.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.12); background: rgba(9, 13, 22, 0.45); flex-shrink: 0;';
            chatPanel.prepend(controlsBar);
        }

        const pctValue = Math.round(desktopChatOpacity * 100);
        controlsBar.innerHTML = `
            <button type="button" onclick="toggleDesktopLiveChatCollapse()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 8px; cursor: pointer; white-space: nowrap;">
                ${desktopChatCollapsed ? '💬 Chat öffnen' : '➖ Einklappen'}
            </button>
            <div class="live-chat-opacity-row" style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;">
                <span style="font-size: 10px; font-weight: 700; color: #cbd5e1; white-space: nowrap;">Transparenz: <strong id="live-chat-opacity-label">${pctValue}%</strong></span>
                <input type="range" id="live-chat-opacity-slider" min="15" max="100" step="5" value="${pctValue}" oninput="setDesktopLiveChatOpacity(this.value)" style="width: 78px; margin: 0; padding: 0; accent-color: #ec4899; cursor: pointer;">
            </div>
        `;
    } else {
        modal.classList.remove('desktop-left-chat-active', 'chat-is-collapsed');
        const controlsBar = document.getElementById('desktop-chat-controls-bar');
        if (controlsBar) controlsBar.remove();
        if (chatPanel) {
            chatPanel.style.backgroundColor = '';
            chatPanel.style.backdropFilter = '';
        }
    }
}

window.toggleDesktopLiveChatCollapse = function() {
    desktopChatCollapsed = !desktopChatCollapsed;
    applyDesktopChatLayout();
};

window.setDesktopLiveChatOpacity = function(percentValue) {
    const num = Math.max(15, Math.min(100, Number(percentValue) || 60));
    desktopChatOpacity = num / 100;
    const label = document.getElementById('live-chat-opacity-label');
    if (label) label.textContent = `${num}%`;
    applyDesktopChatLayout();
};

window.addEventListener('resize', () => {
    if (activeStreamId) {
        applyDesktopChatLayout();
    }
});

export function playLiveGiftAnimation(giftText, senderLabel = 'Jemand', giftObj = null) {
    const playerContainer = document.getElementById('live-stream-player-container');
    if (!playerContainer) return;

    ensureGiftAndDesktopStyles();

    const matchedGift = giftObj || findGiftByText(giftText);
    playGiftSound(matchedGift);

    const cleanSender = senderLabel.includes('@') ? senderLabel.split('@')[0] : senderLabel;
    const emojiMatch = giftText.match(/(\p{Extended_Pictographic})/gu);
    const giftEmoji = emojiMatch && emojiMatch.length > 0 ? emojiMatch[emojiMatch.length - 1] : '🎁';
    const shortLabel = giftText
        .replace(/^🎁\s*HAT\s+/i, '')
        .replace(/\s*GESENDET!.*$/i, '')
        .trim();

    const animationDurationMs = 5200;

    const banner = document.createElement('div');
    banner.style.cssText = `
        position: absolute;
        bottom: 28px;
        left: 50%;
        transform: translate(-50%, 0);
        z-index: 99998;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(236, 72, 153, 0.95));
        color: #fff;
        padding: 11px 20px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.3px;
        box-shadow: 0 10px 30px rgba(236, 72, 153, 0.55);
        border: 2px solid rgba(255, 255, 255, 0.45);
        white-space: nowrap;
        animation: liveGiftBannerPop ${animationDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    `;
    banner.innerHTML = `${giftEmoji} <strong>${cleanSender}</strong> sendet <strong>${shortLabel || giftText}</strong> ✨`;
    playerContainer.appendChild(banner);
    setTimeout(() => banner.remove(), animationDurationMs + 150);

    for (let i = 0; i < 12; i++) {
        const burst = document.createElement('div');
        const offsetX = 15 + Math.random() * 70;
        const delayMs = i * 320;
        burst.textContent = i % 2 === 0 ? giftEmoji : '✨';
        burst.style.cssText = `
            position: absolute;
            left: ${offsetX}%;
            bottom: 52px;
            font-size: ${24 + Math.floor(Math.random() * 14)}px;
            z-index: 99997;
            pointer-events: none;
            animation: liveGiftEmojiBurst 2.4s ease-out ${delayMs}ms forwards;
        `;
        playerContainer.appendChild(burst);
        setTimeout(() => burst.remove(), 2550 + delayMs);
    }
}

function triggerGiftAnimationIfNeeded(msg) {
    if (!msg || !msg.message_text) return;
    const isGiftMessage = msg.message_text.includes('🎁') && msg.message_text.includes('GESENDET');
    if (!isGiftMessage) return;

    const msgKey = String(msg.id || `${msg.sender_email}_${msg.message_text}_${msg.created_at}`);
    if (animatedGiftMsgIds.has(msgKey)) return;
    animatedGiftMsgIds.add(msgKey);

    playLiveGiftAnimation(msg.message_text, msg.sender_email || 'Jemand');
}

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
                    <h3 style="font-size: 15px; font-weight: 900; color: #fff; margin: 0;">🎥 Live-Stream Setup</h3>
                    <button type="button" onclick="closePreLivePreview()" style="background: none; border: none; color: #fff; font-size: 22px; cursor: pointer;">&times;</button>
                </div>
                
                <div style="position: relative; width: 100%; height: 180px; background: #000; flex-shrink: 0;">
                    <video id="preview-camera-video" autoplay muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 800;">Kamera bereit 🎥</div>
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
        vidEl.muted = true;
        vidEl.play().catch(() => {});
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

    await startLiveStreamBroadcast(finalCategoryLabel, location, finalTitle, 'active');
}

async function startLiveStreamBroadcast(category, location, title, streamUrl = 'active') {
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
                    likes_count: 0,
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
        startCanvasBroadcasting();

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

function startCanvasBroadcasting() {
    if (broadcastInterval) clearInterval(broadcastInterval);
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = localStream;
    video.play().catch(() => {});

    broadcastInterval = setInterval(async () => {
        if (!activeStreamId || !localStream) return;
        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            await _supabase
                .from('live_streams')
                .update({ current_frame: dataUrl })
                .eq('id', activeStreamId);
        } catch (e) {}
    }, 150);
}

export async function loadLiveStreams() {
    const liveList = document.getElementById('live-streams-list');
    if (!liveList) return;

    liveList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Streams...</p>';

    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let query = _supabase
        .from('live_streams')
        .select('*')
        .gt('expires_at', oneHourAgoIso)
        .order('created_at', { ascending: false });

    if (currentActiveFilter && currentActiveFilter !== 'Alle') {
        query = query.ilike('category', `%${currentActiveFilter}%`);
    }

    const { data: streams, error } = await query;

    if (error || !streams || streams.length === 0) {
        liveList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">Keine Streams für "${currentActiveFilter}".</p>
                <p style="color: var(--text-muted); font-size: 11px;">Starte deinen eigenen Stream mit dem "+ Start"-Button!</p>
            </div>
        `;
        return;
    }

    let followedSet = new Set();
    if (state.currentUserEmail) {
        try {
            const { data: follows } = await _supabase
                .from('user_follows')
                .select('following_email')
                .eq('follower_email', state.currentUserEmail);

            if (follows) {
                follows.forEach(f => {
                    if (f.following_email) followedSet.add(f.following_email.toLowerCase());
                });
            }
        } catch (e) {}
    }

    const nowMs = Date.now();
    const sortedStreams = [...streams].sort((a, b) => {
        const aEnded = new Date(a.expires_at).getTime() <= nowMs;
        const bEnded = new Date(b.expires_at).getTime() <= nowMs;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;

        const aFollowed = followedSet.has((a.host_email || '').toLowerCase()) ? 1 : 0;
        const bFollowed = followedSet.has((b.host_email || '').toLowerCase()) ? 1 : 0;
        if (bFollowed !== aFollowed) return bFollowed - aFollowed;

        const aEngagement = (Number(a.viewers_count) || 0) * 2 + (Number(a.likes_count) || 0);
        const bEngagement = (Number(b.viewers_count) || 0) * 2 + (Number(b.likes_count) || 0);
        if (bEngagement !== aEngagement) return bEngagement - aEngagement;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const hostEmails = [...new Set(sortedStreams.map(s => s.host_email).filter(Boolean))];
    const avatarMap = {};
    if (hostEmails.length > 0) {
        try {
            const { data: usersData } = await _supabase
                .from('users')
                .select('email, avatar_url')
                .in('email', hostEmails);
            if (usersData) {
                usersData.forEach(u => {
                    if (u.email && u.avatar_url) avatarMap[u.email.toLowerCase()] = u.avatar_url;
                });
            }
        } catch (e) {}
    }

    liveList.innerHTML = '';
    liveList.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 16px; box-sizing: border-box;';

    const isMobileDevice = (window.innerWidth <= 768) || (navigator.maxTouchPoints > 0);

    for (const stream of sortedStreams) {
        const item = document.createElement('div');
        item.className = 'reel-item';
        item.style.cssText = 'position: relative; width: 100%; height: 380px; overflow: hidden; background: #0b0f19; border: 1px solid var(--border); border-radius: 16px; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.5); transition: transform 0.2s ease, border-color 0.2s ease;';
        
        item.onmouseover = () => { item.style.transform = 'translateY(-3px)'; item.style.borderColor = 'var(--primary)'; };
        item.onmouseout = () => { item.style.transform = 'translateY(0)'; item.style.borderColor = 'var(--border)'; };

        const category = stream.category || 'Live Stream';
        const location = stream.location || 'Wien / Campus';
        const streamTitle = stream.title || 'Campus Stream';
        const streamId = stream.id ? String(stream.id) : '0000';
        const hostEmail = stream.host_email || '';
        const viewers = stream.viewers_count || 1;
        const expiresAt = new Date(stream.expires_at).getTime();
        const isEnded = expiresAt <= Date.now();
        const isFollowed = followedSet.has(hostEmail.toLowerCase());

        const isMyStream = state.currentUserEmail && hostEmail.toLowerCase() === state.currentUserEmail.toLowerCase();
        const streamerAvatarUrl = avatarMap[hostEmail.toLowerCase()] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(hostEmail || 'campus')}`;

        let backgroundMediaHtml = '';

        if (isEnded) {
            backgroundMediaHtml = `
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #090d16; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1; filter: grayscale(40%);">
                    <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--text-muted); overflow: hidden; opacity: 0.6; margin-bottom: 10px;">
                        <img src="${streamerAvatarUrl}" alt="Streamer" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-14deg); border: 4px solid #ef4444; color: #ef4444; padding: 6px 24px; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; border-radius: 8px; background: rgba(15,23,42,0.85); box-shadow: 0 0 20px rgba(239,68,68,0.5); z-index: 20; pointer-events: none;">
                        BEENDET
                    </div>
                </div>
            `;
        } else if (isMobileDevice) {
            backgroundMediaHtml = `
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at center, #1e293b 0%, #090d16 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                    <div style="width: 88px; height: 88px; border-radius: 50%; border: 3px solid var(--primary); overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.6); background: #0f172a; margin-bottom: 10px;">
                        <img src="${streamerAvatarUrl}" alt="Streamer" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border);">Live-Profil 🔴</span>
                </div>
            `;
        } else {
            const previewImageSrc = stream.current_frame || streamerAvatarUrl;
            backgroundMediaHtml = `
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; overflow: hidden; background: #000;">
                    <img id="grid-thumb-img-${streamId}" src="${previewImageSrc}" style="width: 100%; height: 100%; object-fit: cover;" muted playsinline alt="Live Vorschau">
                </div>
            `;
        }

        const badgeHtml = isEnded 
            ? `<div style="position: absolute; top: 12px; left: 12px; background: rgba(100, 116, 139, 0.25); border: 1px solid rgba(100, 116, 139, 0.6); color: #94a3b8; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 900; z-index: 10;">VERGANGEN</div>`
            : `<div style="position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; z-index: 10;">
                <div style="background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.6); color: #ef4444; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 900; display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);"><span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> LIVE</div>
                ${isFollowed ? `<div style="background: rgba(16, 185, 129, 0.25); border: 1px solid rgba(16, 185, 129, 0.6); color: #10b981; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 900; backdrop-filter: blur(4px);">★ Gefolgt</div>` : ''}
               </div>`;

        item.innerHTML = `
            ${backgroundMediaHtml}
            ${badgeHtml}
            <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(0deg, rgba(9,13,22,0.98) 20%, rgba(9,13,22,0.7) 75%, transparent 100%); padding: 20px 14px 14px 14px; display: flex; flex-direction: column; align-items: flex-start; z-index: 10; box-sizing: border-box;">
                <div style="font-size: 11px; font-weight: 800; color: #818cf8; margin-bottom: 2px;">🔴 ${category}</div>
                <div style="font-size: 13px; color: #fff; font-weight: 900; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${streamTitle}</div>
                <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 8px;">${isEnded ? 'Stream beendet' : `👥 ${viewers} Zuschauer aktiv`}</div>
                <button type="button" class="btn" style="width: 100%; padding: 7px; font-size: 11px; font-weight: 900; background: var(--gradient-main); cursor: pointer; border-radius: 8px;" onclick="event.stopPropagation(); openLiveFullscreen('${streamId}', '${category}', '${location}', '${streamTitle}', ${isMyStream}, '${hostEmail}')">${isEnded ? 'Details ansehen 🔍' : 'Vollbild beitreten 🚀'}</button>
            </div>
        `;
        
        item.onclick = () => openLiveFullscreen(streamId, category, location, streamTitle, isMyStream, hostEmail);
        liveList.appendChild(item);
    }

    if (gridPollInterval) clearInterval(gridPollInterval);
    if (!isMobileDevice) {
        gridPollInterval = setInterval(async () => {
            const modal = document.getElementById('live-fullscreen-modal');
            if (modal && !modal.classList.contains('hidden')) return;

            try {
                const { data: freshStreams } = await _supabase
                    .from('live_streams')
                    .select('id,current_frame')
                    .gt('expires_at', new Date().toISOString());

                if (freshStreams) {
                    freshStreams.forEach(s => {
                        const imgEl = document.getElementById(`grid-thumb-img-${s.id}`);
                        if (imgEl && s.current_frame) {
                            imgEl.src = s.current_frame;
                        }
                    });
                }
            } catch (e) {}
        }, 600);
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
    desktopChatCollapsed = false;
    const modal = document.getElementById('live-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');

    const titleDisplay = document.getElementById('active-live-title-display');
    const playerContainer = document.getElementById('live-stream-player-container');
    const chatInputContainer = document.getElementById('live-chat-input-container');

    if (titleDisplay) titleDisplay.textContent = `🔴 ${streamTitle || category}`;
    
    const currentUserIsHost = isHost || (Boolean(state.currentUserEmail) && Boolean(hostEmail) && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase());

    if (!currentUserIsHost && localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    let currentViewers = 1;
    let currentLikes = 0;
    try {
        const { data: streamData } = await _supabase
            .from('live_streams')
            .select('viewers_count, likes_count, current_frame, host_email')
            .eq('id', streamId)
            .single();

        if (streamData) {
            if (streamData.host_email && !hostEmail) hostEmail = streamData.host_email;
            currentViewers = streamData.viewers_count || 1;
            currentLikes = streamData.likes_count || 0;
            
            const realIsHost = Boolean(state.currentUserEmail) && Boolean(hostEmail) && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase();

            if (!realIsHost) {
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

    const finalIsHost = Boolean(state.currentUserEmail) && Boolean(hostEmail) && state.currentUserEmail.toLowerCase() === hostEmail.toLowerCase();

    let topBar = document.getElementById('live-top-overlay-bar');
    if (!topBar && playerContainer) {
        topBar = document.createElement('div');
        topBar.id = 'live-top-overlay-bar';
        topBar.style.cssText = 'position: absolute; top: 16px; left: 16px; right: 16px; height: 34px; display: flex; align-items: center; justify-content: space-between; z-index: 99999; pointer-events: none;';
        playerContainer.style.position = 'relative';
    }

    if (topBar) {
        topBar.innerHTML = `
            <button type="button" onclick="subscribeToCreator('${hostEmail}')" class="btn" style="pointer-events: auto; margin: 0; width: auto; height: 32px; background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: #fff; font-size: 11px; font-weight: 900; padding: 0 14px; border-radius: 20px; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(139,92,246,0.4); display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;">⭐ Abo (150P/Mo)</button>
            <div id="live-likes-counter-badge" onclick="sendScreenTapLike()" style="pointer-events: auto; position: absolute; left: 50%; transform: translateX(-50%); height: 32px; background: rgba(15, 23, 42, 0.85); border: 2px solid #ec4899; color: #fff; padding: 0 14px; border-radius: 20px; font-size: 12px; font-weight: 900; backdrop-filter: blur(8px); display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); white-space: nowrap;">❤️ <span id="live-likes-count-num">${currentLikes}</span></div>
            <div id="guaranteed-live-viewer-badge" style="pointer-events: auto; height: 32px; background: rgba(15, 23, 42, 0.85); border: 2px solid #10b981; color: #fff; padding: 0 14px; border-radius: 20px; font-size: 12px; font-weight: 900; backdrop-filter: blur(8px); box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap;">👥 <span id="live-viewer-count" style="color: #10b981;">${currentViewers}</span> Zuschauer</div>
        `;
    }

    if (playerContainer) {
        playerContainer.onclick = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('#live-likes-counter-badge')) return;
            sendScreenTapLikeAnim(e.clientX, e.clientY);
        };

        if (finalIsHost && localStream) {
            playerContainer.innerHTML = `
                <video id="active-web-rtc-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; background: #000; position: absolute; top:0; left:0;"></video>
            `;
            const vidEl = document.getElementById('active-web-rtc-video');
            if (vidEl && localStream) {
                vidEl.srcObject = localStream;
                vidEl.play().catch(() => {});
            }
        } else {
            playerContainer.innerHTML = `
                <img id="active-stream-image-view" src="" style="width: 100%; height: 100%; object-fit: cover; background: #000; position: absolute; top:0; left:0; display: block;" alt="Live Stream">
                <div id="webrtc-status-msg" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 13px; background: rgba(0,0,0,0.85); padding: 10px 20px; border-radius: 10px; z-index: 6; border: 1px solid var(--border);">Lade Stream... 🔴</div>
            `;
            
            try {
                _supabase.from('live_streams').select('current_frame').eq('id', streamId).single().then(({ data: initData }) => {
                    if (initData && initData.current_frame) {
                        const imgEl = document.getElementById('active-stream-image-view');
                        const statusMsg = document.getElementById('webrtc-status-msg');
                        if (imgEl) imgEl.src = initData.current_frame;
                        if (statusMsg) statusMsg.remove();
                    }
                });
            } catch (e) {}
        }
        
        if (topBar) playerContainer.appendChild(topBar);
    }

    if (viewerInterval) clearInterval(viewerInterval);
    viewerInterval = setInterval(async () => {
        if (!activeStreamId) return;
        try {
            const { data: sData, error: sErr } = await _supabase
                .from('live_streams')
                .select('viewers_count, likes_count, current_frame, expires_at, host_email')
                .eq('id', activeStreamId)
                .single();

            const streamEndedOrMissing = sErr || !sData || (sData.expires_at && new Date(sData.expires_at).getTime() <= Date.now());
            const checkIsHost = Boolean(state.currentUserEmail) && Boolean(sData?.host_email) && state.currentUserEmail.toLowerCase() === sData.host_email.toLowerCase();

            if (!checkIsHost && streamEndedOrMissing) {
                await redirectViewerToNextLiveStream(activeStreamId);
                return;
            }

            if (sData) {
                const vSpan = document.getElementById('live-viewer-count');
                if (vSpan) vSpan.textContent = sData.viewers_count || 1;

                const lSpan = document.getElementById('live-likes-count-num');
                if (lSpan) lSpan.textContent = sData.likes_count || 0;

                if (!checkIsHost && sData.current_frame) {
                    const imgEl = document.getElementById('active-stream-image-view');
                    if (imgEl) {
                        imgEl.src = sData.current_frame;
                        const statusMsg = document.getElementById('webrtc-status-msg');
                        if (statusMsg) statusMsg.remove();
                    }
                }
            }
        } catch (err) {}
    }, 1000);

    if (framePollInterval) clearInterval(framePollInterval);
    if (!finalIsHost) {
        framePollInterval = setInterval(async () => {
            if (!activeStreamId) return;
            try {
                const { data: fData } = await _supabase
                    .from('live_streams')
                    .select('current_frame')
                    .eq('id', activeStreamId)
                    .single();

                if (fData && fData.current_frame) {
                    const imgEl = document.getElementById('active-stream-image-view');
                    if (imgEl) {
                        imgEl.src = fData.current_frame;
                        const statusMsg = document.getElementById('webrtc-status-msg');
                        if (statusMsg) statusMsg.remove();
                    }
                }
            } catch (e) {}
        }, 120);
    }

    if (chatInputContainer) {
        if (finalIsHost) {
            chatInputContainer.innerHTML = `
                <button type="button" class="btn" style="background: #ef4444; color: #fff; font-weight: 900; font-size: 11px; padding: 8px; border-radius: 8px; width: 100%; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239,68,68,0.4); margin-bottom: 4px;" onclick="terminateActiveStream()">🛑 Stream beenden</button>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <input type="text" id="live-chat-input" placeholder="Als Host schreiben..." style="margin: 0; font-size: 11px; padding: 8px 10px; flex: 1;" onkeydown="if(event.key==='Enter') sendLiveChatMessage()">
                    <button type="button" class="btn" style="width: auto; margin: 0; padding: 0 12px; font-size: 11px; font-weight: 800;" onclick="sendLiveChatMessage()">Senden</button>
                </div>
            `;
        } else {
            chatInputContainer.innerHTML = `
                <div style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center; overflow-x: auto; padding-bottom: 2px; justify-content: center;">
                    <button type="button" onclick="openGiftsGalleryModal('${hostEmail}')" class="btn" style="background: linear-gradient(135deg, #f59e0b, #ec4899); color: #fff; font-size: 10px; font-weight: 900; padding: 6px 14px; border-radius: 16px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">🎁 Geschenke senden</button>
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
        chatMessagesEl.style.cssText = 'height: 168px; min-height: 168px; max-height: 168px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; box-sizing: border-box;';
        chatMessagesEl.innerHTML = `<div id="chat-status-msg" style="color: var(--text-muted); text-align: center; padding: 10px; font-size: 11px;">Chat verbunden 💬</div>`;
    }

    applyDesktopChatLayout();

    await loadExistingChatMessages(streamId, true);

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
            appendMessageToChatUI(payload.new, false);
        })
        .subscribe();

    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
        loadExistingChatMessages(streamId, false);
    }, 2000);
}

async function redirectViewerToNextLiveStream(endedStreamId) {
    try {
        const { data: nextStreams } = await _supabase
            .from('live_streams')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .neq('id', endedStreamId)
            .order('viewers_count', { ascending: false })
            .limit(1);

        if (nextStreams && nextStreams.length > 0) {
            const next = nextStreams[0];
            await openLiveFullscreen(
                String(next.id),
                next.category || 'Live Stream',
                next.location || 'Wien / Campus',
                next.title || 'Campus Stream',
                false,
                next.host_email || ''
            );
        } else {
            alert('Dieser Live-Stream wurde vom Host beendet.');
            await closeLiveFullscreen();
        }
    } catch (e) {
        await closeLiveFullscreen();
    }
}

window.sendScreenTapLike = async function() {
    if (!activeStreamId) return;
    try {
        const { data } = await _supabase.from('live_streams').select('likes_count').eq('id', activeStreamId).single();
        const newLikes = (data?.likes_count || 0) + 1;
        await _supabase.from('live_streams').update({ likes_count: newLikes }).eq('id', activeStreamId);
        
        const lSpan = document.getElementById('live-likes-count-num');
        if (lSpan) lSpan.textContent = newLikes;
    } catch (e) {}
};

function sendScreenTapLikeAnim(clientX, clientY) {
    sendScreenTapLike();
    
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.cssText = `position: fixed; left: ${clientX - 15}px; top: ${clientY - 15}px; font-size: 28px; z-index: 999999; pointer-events: none; transition: transform 0.8s ease-out, opacity 0.8s ease-out; transform: scale(0.5) translateY(0); opacity: 1;`;
    document.body.appendChild(heart);

    setTimeout(() => {
        heart.style.transform = `scale(1.4) translateY(-120px) rotate(${Math.random() * 40 - 20}deg)`;
        heart.style.opacity = '0';
    }, 30);

    setTimeout(() => heart.remove(), 850);
}

window.handlePureLogicLogoClick = async function() {
    if (activeStreamId) {
        await closeLiveFullscreen();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const logoEls = document.querySelectorAll('.logo, #logo, [onclick*="Home"], [onclick*="feed"]');
    logoEls.forEach(el => {
        const origOnClick = el.onclick;
        el.onclick = async (e) => {
            if (activeStreamId) {
                await closeLiveFullscreen();
            }
            if (origOnClick) origOnClick(e);
        };
    });
});

async function loadExistingChatMessages(streamId, isInitialLoad = false) {
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
                if (isInitialLoad && msg.message_text && msg.message_text.includes('🎁') && msg.message_text.includes('GESENDET')) {
                    const msgKey = String(msg.id || `${msg.sender_email}_${msg.message_text}_${msg.created_at}`);
                    animatedGiftMsgIds.add(msgKey);
                }

                if (!existingIds.has(String(msg.id))) {
                    appendMessageToChatUI(msg, isInitialLoad);
                }
            });
        }
    } catch (e) {}
}

function appendMessageToChatUI(msg, skipGiftAnimation = false) {
    const chatList = document.getElementById('live-chat-messages');
    if (!chatList) return;

    const statusMsg = document.getElementById('chat-status-msg');
    if (statusMsg) statusMsg.remove();

    const sender = msg.sender_email ? msg.sender_email.split('@')[0] : 'User';
    const isMe = state.currentUserEmail && msg.sender_email && msg.sender_email.toLowerCase() === state.currentUserEmail.toLowerCase();
    const color = isMe ? '#10b981' : '#818cf8';

    const msgDiv = document.createElement('div');
    msgDiv.setAttribute('data-msg-id', msg.id);
    msgDiv.style.cssText = 'background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px; font-size: 11px; line-height: 1.35; word-break: break-word; flex-shrink: 0;';
    msgDiv.innerHTML = `<strong style="color: ${color};">${sender}:</strong> ${msg.message_text}`;
    
    chatList.appendChild(msgDiv);
    chatList.scrollTop = chatList.scrollHeight;

    if (!skipGiftAnimation) {
        triggerGiftAnimationIfNeeded(msg);
    }
}

export async function sendLiveChatMessage() {
    const input = document.getElementById('live-chat-input');
    if (!input) return;

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
            alert('Fehler beim Senden der Nachricht: ' + error.message);
            return;
        }

        input.value = '';
    } catch (err) {}
}

window.openGiftsGalleryModal = function(hostEmail) {
    getAudioContext();
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
                    <span style="font-size: 10px; color: var(--text-muted);">Jedes Geschenk spielt seinen eigenen Sound & Animation ab! 🔊✨</span>
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
        
        card.onclick = () => sendLiveGift(gift.name, gift.cost, hostEmail, gift);

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

    } catch (err) {}
}

export async function sendLiveGift(giftName, cost, hostEmail, matchedGift = null) {
    getAudioContext();
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

        const giftMessageText = `🎁 HAT ${giftName.toUpperCase()} (${cost} P) GESENDET! 🎉`;
        const giftMsgId = crypto.randomUUID();
        animatedGiftMsgIds.add(giftMsgId);
        playLiveGiftAnimation(giftMessageText, state.currentUserEmail || 'Du', matchedGift);

        if (activeStreamId) {
            await _supabase
                .from('live_chat_messages')
                .insert([
                    {
                        id: giftMsgId,
                        stream_id: activeStreamId,
                        sender_email: state.currentUserEmail,
                        message_text: giftMessageText,
                        created_at: new Date().toISOString()
                    }
                ]);
        }

    } catch (err) {}
}

export async function terminateActiveStream() {
    if (!confirm('Möchtest du deinen Live-Stream wirklich beenden?')) return;

    if (broadcastInterval) clearInterval(broadcastInterval);
    if (framePollInterval) clearInterval(framePollInterval);
    if (gridPollInterval) clearInterval(gridPollInterval);
    try {
        if (activeStreamId) {
            await _supabase
                .from('live_streams')
                .delete()
                .eq('id', activeStreamId);
        }
    } catch (err) {}

    await closeLiveFullscreen();
}

export async function closeLiveFullscreen() {
    if (viewerInterval) clearInterval(viewerInterval);
    if (chatPollInterval) clearInterval(chatPollInterval);
    if (broadcastInterval) clearInterval(broadcastInterval);
    if (framePollInterval) clearInterval(framePollInterval);
    if (gridPollInterval) clearInterval(gridPollInterval);
    if (chatChannel) {
        _supabase.removeChannel(chatChannel);
        chatChannel = null;
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
    activeStreamId = null;
    loadLiveStreams();
}

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
window.sendScreenTapLike = sendScreenTapLike;
window.handlePureLogicLogoClick = handlePureLogicLogoClick;
window.playLiveGiftAnimation = playLiveGiftAnimation;
window.playGiftSound = playGiftSound;