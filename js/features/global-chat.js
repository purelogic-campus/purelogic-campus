// js/features/global-chat.js - Campus-Chat mit Mobile-Uni-Dropdown unter Allgemein, Smiley-Picker, bis zu 5 Bildern & Bottom-Bar nur auf Smartphone ausgeblendet (Top-Header/Pure-Logic-Schriftzug bleibt unberührt)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

const CHANNEL_PREFIX_REGEX = /^\[channel:([^\]]+)\]\s*/i;
const ATTACHMENTS_MARKER_REGEX = /\n?\[attachments:(\[[\s\S]*?\])\]\s*$/i;
const DEFAULT_CHANNEL_KEY = 'general:all';
const DEFAULT_CATEGORY_ID = 'plaudern';
const CHAT_TABLE = 'global_messages';
const STORAGE_BUCKET = 'media';
const MAX_IMAGES_PER_MESSAGE = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MOBILE_BREAKPOINT_PX = 768;

const QUICK_SMILEYS = [
    '😊', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳',
    '🤔', '😅', '😭', '🙏', '🔥', '💯', '👍', '👏',
    '🎉', '☕', '📚', '🎓', '🍻', '❤️', '✨', '🚀'
];

const UNIVERSITIES = [
    { id: 'uni-wien', label: 'Universität Wien', short: 'Uni Wien' },
    { id: 'tu-wien', label: 'TU Wien', short: 'TU Wien' },
    { id: 'wu-wien', label: 'WU Wien', short: 'WU Wien' },
    { id: 'meduni-wien', label: 'MedUni Wien', short: 'MedUni Wien' },
    { id: 'boku', label: 'BOKU Wien', short: 'BOKU Wien' },
    { id: 'fh-wien', label: 'FH Wien', short: 'FH Wien' }
];

const CAMPUS_CATEGORIES = [
    { id: 'plaudern', label: '💬 Plaudern & Treffen' },
    { id: 'lernen', label: '📚 Lernen & Skripten' },
    { id: 'brett', label: '📌 Schwarzes Brett' },
    { id: 'events', label: '🎉 Campus-Events' }
];

let activeChannelKey = DEFAULT_CHANNEL_KEY;
let globalChatChannel = null;
let supportsChannelColumn = true;
let supportsAttachmentsColumn = true;
let isSendingGlobalMsg = false;
let isLoadingGlobalMsgs = false;
let cachedAllMessages = [];

// Ausgewählte Bilder (max. 5) vor dem Absenden: { id, file, previewUrl, name }
let pendingImageDrafts = [];

// Desktop: klappbare Uni-Akkordeons; Mobile: Dropdown-Status unter Allgemein
const expandedUniversities = new Set();
let mobileUnisDropdownOpen = false;
let mobileSelectedUniId = '';

function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT_PX;
}

function getBottomBarTargets() {
    // Explizit nur die untere Navigationsleiste / Bottom-Controls ansprechen – niemals Top-Header oder Pure-Logic-Logo
    const targets = [];
    const navBar = document.getElementById('bottom-nav-bar');
    if (navBar) {
        targets.push(navBar);
        const wrapper = navBar.closest('.bottom-controls-wrapper');
        if (wrapper && !targets.includes(wrapper)) {
            targets.push(wrapper);
        }
    }
    return targets;
}

function setBottomBarHiddenForMobileChat(hideBottomBar) {
    const shouldHide = Boolean(hideBottomBar && isMobileViewport());
    const targets = getBottomBarTargets();

    targets.forEach(target => {
        if (shouldHide) {
            if (!target.dataset.plPrevDisplay && target.style.display && target.style.display !== 'none') {
                target.dataset.plPrevDisplay = target.style.display;
            }
            target.style.setProperty('display', 'none', 'important');
        } else {
            target.style.removeProperty('display');
            if (target.dataset.plPrevDisplay) {
                target.style.display = target.dataset.plPrevDisplay;
                delete target.dataset.plPrevDisplay;
            }
        }
    });
}

function isTabCurrentlyOpen(tabId) {
    const tab = document.getElementById(tabId);
    if (!tab) return false;
    if (tab.classList.contains('hidden')) return false;
    const style = window.getComputedStyle(tab);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function syncBottomBarVisibility() {
    const isGlobalOpen = isTabCurrentlyOpen('tab-global');
    const isInboxOpen = isTabCurrentlyOpen('tab-inbox');
    setBottomBarHiddenForMobileChat(isGlobalOpen || isInboxOpen);
}

function installTabAndVisibilityWatchers() {
    if (window.__plBottomBarWatcherInstalled) return;
    window.__plBottomBarWatcherInstalled = true;

    const runSync = () => {
        syncBottomBarVisibility();
        requestAnimationFrame(syncBottomBarVisibility);
    };

    if (typeof window.switchTab === 'function' && !window.switchTab.__plWrapped) {
        const origSwitchTab = window.switchTab;
        const wrappedSwitchTab = function (tabName, ...args) {
            const res = origSwitchTab.apply(this, [tabName, ...args]);
            setTimeout(runSync, 0);
            setTimeout(runSync, 60);
            return res;
        };
        wrappedSwitchTab.__plWrapped = true;
        window.switchTab = wrappedSwitchTab;
    }

    const observer = new MutationObserver(() => {
        runSync();
    });

    ['tab-global', 'tab-inbox'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            observer.observe(el, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
    });

    document.addEventListener('click', () => {
        setTimeout(runSync, 0);
        setTimeout(runSync, 50);
    }, true);

    window.addEventListener('resize', runSync);
    window.addEventListener('hashchange', runSync);
    window.addEventListener('popstate', runSync);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeImageUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.startsWith('https://') || raw.startsWith('http://') || raw.startsWith('data:image/')) {
        return raw;
    }
    return '';
}

function formatMessageTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getChannelMeta(channelKey) {
    const key = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    if (key === DEFAULT_CHANNEL_KEY) {
        return {
            key: DEFAULT_CHANNEL_KEY,
            title: '🌐 Allgemein (Alle Unis)',
            subtitle: 'Offener Raum für Studierende aller Universitäten'
        };
    }

    const parts = key.split(':');
    const uniId = parts[0] || '';
    const catId = parts[1] || DEFAULT_CATEGORY_ID;

    const uni = UNIVERSITIES.find(u => u.id === uniId) || {
        id: uniId,
        label: uniId || 'Universität',
        short: uniId || 'Uni'
    };
    const cat = CAMPUS_CATEGORIES.find(c => c.id === catId) || {
        id: catId,
        label: '💬 Plaudern & Treffen'
    };

    return {
        key,
        title: `${uni.short} · ${cat.label}`,
        subtitle: `${uni.label} — Bereich: ${cat.label}`
    };
}

function encodeMessageWithChannel(text, channelKey, attachments = []) {
    const cleanText = String(text || '').trim();
    const key = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    let encoded = `[channel:${key}] ${cleanText}`.trim();

    if (Array.isArray(attachments) && attachments.length > 0) {
        try {
            const compact = attachments.slice(0, MAX_IMAGES_PER_MESSAGE).map(a => ({
                url: sanitizeImageUrl(a.url),
                name: String(a.name || 'bild').slice(0, 80)
            })).filter(a => a.url);

            if (compact.length > 0) {
                encoded = `${encoded}\n[attachments:${JSON.stringify(compact)}]`;
            }
        } catch (_err) {}
    }

    return encoded;
}

function parseAttachmentsArray(raw) {
    if (!raw) return [];
    let list = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch (_err) {
            return [];
        }
    }
    if (!Array.isArray(list)) return [];
    return list
        .slice(0, MAX_IMAGES_PER_MESSAGE)
        .map(item => {
            if (!item) return null;
            if (typeof item === 'string') {
                const safeUrl = sanitizeImageUrl(item);
                return safeUrl ? { url: safeUrl, name: 'Bild' } : null;
            }
            const safeUrl = sanitizeImageUrl(item.url || item.publicUrl || item.src || '');
            if (!safeUrl) return null;
            return {
                url: safeUrl,
                name: String(item.name || 'Bild').slice(0, 80)
            };
        })
        .filter(Boolean);
}

function decodeMessageRow(row) {
    if (!row) return null;
    let rawText = String(row.message_text || row.content || row.text || row.message || '');

    let attachments = parseAttachmentsArray(row.attachments);
    const attMatch = rawText.match(ATTACHMENTS_MARKER_REGEX);
    if (attMatch) {
        if (attachments.length === 0) {
            attachments = parseAttachmentsArray(attMatch[1]);
        }
        rawText = rawText.replace(ATTACHMENTS_MARKER_REGEX, '').trim();
    }

    const chMatch = rawText.match(CHANNEL_PREFIX_REGEX);
    let channelKey = DEFAULT_CHANNEL_KEY;
    let cleanText = rawText;

    if (row.channel_key) {
        channelKey = String(row.channel_key).trim().toLowerCase();
        if (chMatch) {
            cleanText = rawText.replace(CHANNEL_PREFIX_REGEX, '').trim();
        }
    } else if (chMatch) {
        channelKey = String(chMatch[1] || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
        cleanText = rawText.replace(CHANNEL_PREFIX_REGEX, '').trim();
    }

    return {
        id: row.id,
        senderEmail: String(row.sender_email || row.user_email || row.email || '').trim().toLowerCase(),
        senderName: String(row.sender_name || row.full_name || row.username || '').trim(),
        channelKey,
        text: cleanText,
        attachments,
        createdAt: row.created_at || ''
    };
}

function getChannelCountsMap() {
    const counts = new Map();
    (cachedAllMessages || []).forEach(msg => {
        if (!msg?.channelKey) return;
        counts.set(msg.channelKey, (counts.get(msg.channelKey) || 0) + 1);
    });
    return counts;
}

async function fetchGlobalRowsWithRetry() {
    let attempt = 0;
    while (attempt < 2) {
        attempt += 1;
        const { data, error } = await _supabase
            .from(CHAT_TABLE)
            .select('*')
            .order('created_at', { ascending: true })
            .limit(400);

        if (!error) {
            return Array.isArray(data) ? data : [];
        }

        const errMsg = String(error.message || '').toLowerCase();
        const isFetchErr = errMsg.includes('failed to fetch');
        if (!isFetchErr || attempt >= 2) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 350));
    }
    return [];
}

function ensureImagePreviewOverlay() {
    let overlay = document.getElementById('global-chat-image-lightbox');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'global-chat-image-lightbox';
    overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: rgba(5, 8, 16, 0.92)',
        'z-index: 9999',
        'display: none',
        'align-items: center',
        'justify-content: center',
        'padding: 16px'
    ].join(';');

    overlay.innerHTML = `
        <div style="position: relative; max-width: 92vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <button type="button" id="global-lightbox-close" aria-label="Bildvorschau schließen" style="align-self: flex-end; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.28); color: #fff; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">✕ Schließen</button>
            <img id="global-lightbox-img" src="" alt="Vorschau" style="max-width: 90vw; max-height: 80vh; border-radius: 12px; object-fit: contain; box-shadow: 0 18px 45px rgba(0,0,0,0.75);">
        </div>
    `;

    const closeBtn = overlay.querySelector('#global-lightbox-close');
    closeBtn?.addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    document.body.appendChild(overlay);
    return overlay;
}

function openImageLightbox(url) {
    const safeUrl = sanitizeImageUrl(url);
    if (!safeUrl) return;
    const overlay = ensureImagePreviewOverlay();
    const img = overlay.querySelector('#global-lightbox-img');
    if (img) {
        img.src = safeUrl;
    }
    overlay.style.display = 'flex';
}

function renderPendingAttachmentsBar() {
    const bar = document.getElementById('global-chat-attachments-bar');
    if (!bar) return;

    if (pendingImageDrafts.length === 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = '';

    pendingImageDrafts.forEach((draft, idx) => {
        const chip = document.createElement('div');
        chip.style.cssText = [
            'position: relative',
            'width: 58px',
            'height: 58px',
            'border-radius: 10px',
            'overflow: hidden',
            'border: 1px solid rgba(129, 140, 248, 0.55)',
            'background: rgba(0, 0, 0, 0.35)',
            'flex-shrink: 0'
        ].join(';');

        const img = document.createElement('img');
        img.src = draft.previewUrl;
        img.alt = draft.name || `Bild ${idx + 1}`;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
        img.addEventListener('click', () => openImageLightbox(draft.previewUrl));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Bild entfernen';
        removeBtn.setAttribute('aria-label', 'Bild entfernen');
        removeBtn.style.cssText = [
            'position: absolute',
            'top: 2px',
            'right: 2px',
            'width: 18px',
            'height: 18px',
            'border-radius: 999px',
            'border: none',
            'background: rgba(15, 23, 42, 0.85)',
            'color: #fff',
            'font-size: 10px',
            'font-weight: 900',
            'cursor: pointer',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            'line-height: 1'
        ].join(';');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removePendingImage(draft.id);
        });

        chip.appendChild(img);
        chip.appendChild(removeBtn);
        bar.appendChild(chip);
    });

    const infoTag = document.createElement('span');
    infoTag.style.cssText = 'font-size: 10px; font-weight: 700; color: #a5b4fc; align-self: center; margin-left: 4px;';
    infoTag.textContent = `${pendingImageDrafts.length}/${MAX_IMAGES_PER_MESSAGE} Bilder`;
    bar.appendChild(infoTag);
}

function removePendingImage(draftId) {
    const target = pendingImageDrafts.find(d => d.id === draftId);
    if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(target.previewUrl);
        } catch (_err) {}
    }
    pendingImageDrafts = pendingImageDrafts.filter(d => d.id !== draftId);
    renderPendingAttachmentsBar();
}

function clearPendingImages() {
    pendingImageDrafts.forEach(d => {
        if (d.previewUrl && d.previewUrl.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(d.previewUrl);
            } catch (_err) {}
        }
    });
    pendingImageDrafts = [];
    const fileInput = document.getElementById('global-chat-image-input');
    if (fileInput) {
        fileInput.value = '';
    }
    renderPendingAttachmentsBar();
}

function handleImageSelection(filesList) {
    const incoming = Array.from(filesList || []).filter(f => f && String(f.type || '').startsWith('image/'));
    if (incoming.length === 0) return;

    const availableSlots = MAX_IMAGES_PER_MESSAGE - pendingImageDrafts.length;
    if (availableSlots <= 0) {
        alert(`Du kannst maximal ${MAX_IMAGES_PER_MESSAGE} Bilder pro Nachricht hinzufügen.`);
        return;
    }

    if (incoming.length > availableSlots) {
        alert(`Es sind maximal ${MAX_IMAGES_PER_MESSAGE} Bilder pro Nachricht erlaubt. Es wurden ${availableSlots} Bild(er) hinzugefügt.`);
    }

    const accepted = incoming.slice(0, availableSlots);
    for (const file of accepted) {
        if (file.size > MAX_IMAGE_BYTES) {
            alert(`"${file.name}" ist größer als 5 MB und wurde übersprungen.`);
            continue;
        }
        pendingImageDrafts.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name || 'bild.jpg',
            previewUrl: URL.createObjectURL(file)
        });
    }

    const fileInput = document.getElementById('global-chat-image-input');
    if (fileInput) {
        fileInput.value = '';
    }
    renderPendingAttachmentsBar();
}

function insertSmileyAtCursor(smiley) {
    const input = document.getElementById('global-chat-input');
    if (!input) return;

    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);

    input.value = `${before}${smiley}${after}`;
    const nextPos = start + smiley.length;
    input.focus();
    try {
        input.setSelectionRange(nextPos, nextPos);
    } catch (_err) {}
}

function toggleSmileyPicker(event) {
    if (event) event.stopPropagation();
    const picker = document.getElementById('global-smiley-picker');
    if (!picker) return;
    const willOpen = picker.style.display !== 'grid';
    picker.style.display = willOpen ? 'grid' : 'none';
}

function fileToCompressedDataUrl(file, maxDimension = 1024, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDimension || height > maxDimension) {
                    if (width >= height) {
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
                if (!ctx) {
                    resolve(String(reader.result || ''));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
            img.src = String(reader.result || '');
        };
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsDataURL(file);
    });
}

async function uploadDraftImages() {
    if (pendingImageDrafts.length === 0) return [];

    const uploaded = [];
    const draftsToSend = pendingImageDrafts.slice(0, MAX_IMAGES_PER_MESSAGE);

    for (const draft of draftsToSend) {
        const ext = (draft.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const uniquePath = `campus-chat/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

        let finalUrl = '';
        try {
            const { error: uploadError } = await _supabase.storage
                .from(STORAGE_BUCKET)
                .upload(uniquePath, draft.file, {
                    contentType: draft.file.type || 'image/jpeg',
                    upsert: false
                });

            if (!uploadError) {
                const { data: pubData } = _supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(uniquePath);
                if (pubData?.publicUrl) {
                    finalUrl = pubData.publicUrl;
                }
            }
        } catch (_storageErr) {}

        if (!finalUrl) {
            finalUrl = await fileToCompressedDataUrl(draft.file);
        }

        if (finalUrl) {
            uploaded.push({
                url: finalUrl,
                name: draft.name
            });
        }
    }

    return uploaded;
}

function enhanceInputRowWithSmileyAndImages(inputArea) {
    if (!inputArea || inputArea.dataset.mediaToolbarBound) return;
    inputArea.dataset.mediaToolbarBound = '1';

    inputArea.style.position = 'relative';
    inputArea.style.flexWrap = 'wrap';
    inputArea.style.gap = '6px';

    const previewBar = document.createElement('div');
    previewBar.id = 'global-chat-attachments-bar';
    previewBar.style.cssText = [
        'display: none',
        'width: 100%',
        'flex-direction: row',
        'align-items: center',
        'gap: 8px',
        'padding: 6px 8px',
        'border-radius: 10px',
        'background: rgba(255, 255, 255, 0.03)',
        'border: 1px solid var(--border)',
        'overflow-x: auto'
    ].join(';');
    inputArea.insertBefore(previewBar, inputArea.firstChild);

    const picker = document.createElement('div');
    picker.id = 'global-smiley-picker';
    picker.style.cssText = [
        'display: none',
        'position: absolute',
        'bottom: calc(100% + 8px)',
        'left: 8px',
        'grid-template-columns: repeat(8, 1fr)',
        'gap: 4px',
        'padding: 8px',
        'border-radius: 12px',
        'background: rgba(15, 20, 36, 0.98)',
        'border: 1px solid rgba(129, 140, 248, 0.5)',
        'box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65)',
        'z-index: 60'
    ].join(';');

    QUICK_SMILEYS.forEach(emoji => {
        const eBtn = document.createElement('button');
        eBtn.type = 'button';
        eBtn.textContent = emoji;
        eBtn.style.cssText = [
            'width: 30px',
            'height: 30px',
            'border: none',
            'border-radius: 8px',
            'background: transparent',
            'font-size: 16px',
            'cursor: pointer',
            'display: flex',
            'align-items: center',
            'justify-content: center'
        ].join(';');
        eBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            insertSmileyAtCursor(emoji);
        });
        picker.appendChild(eBtn);
    });
    inputArea.appendChild(picker);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'global-chat-image-input';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
        handleImageSelection(e.target?.files);
    });
    inputArea.appendChild(fileInput);

    const smileyBtn = document.createElement('button');
    smileyBtn.type = 'button';
    smileyBtn.id = 'global-smiley-btn';
    smileyBtn.textContent = '😊';
    smileyBtn.title = 'Smiley einfügen';
    smileyBtn.setAttribute('aria-label', 'Smiley einfügen');
    smileyBtn.style.cssText = [
        'width: 38px',
        'height: 38px',
        'border-radius: 10px',
        'border: 1px solid var(--border)',
        'background: rgba(255, 255, 255, 0.06)',
        'color: #fff',
        'font-size: 17px',
        'cursor: pointer',
        'flex-shrink: 0',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center'
    ].join(';');
    smileyBtn.addEventListener('click', toggleSmileyPicker);

    const imageBtn = document.createElement('button');
    imageBtn.type = 'button';
    imageBtn.id = 'global-image-btn';
    imageBtn.textContent = '🖼️';
    imageBtn.title = `Bis zu ${MAX_IMAGES_PER_MESSAGE} Bilder hinzufügen`;
    imageBtn.setAttribute('aria-label', `Bis zu ${MAX_IMAGES_PER_MESSAGE} Bilder hinzufügen`);
    imageBtn.style.cssText = [
        'width: 38px',
        'height: 38px',
        'border-radius: 10px',
        'border: 1px solid var(--border)',
        'background: rgba(255, 255, 255, 0.06)',
        'color: #fff',
        'font-size: 16px',
        'cursor: pointer',
        'flex-shrink: 0',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center'
    ].join(';');
    imageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pendingImageDrafts.length >= MAX_IMAGES_PER_MESSAGE) {
            alert(`Es sind bereits ${MAX_IMAGES_PER_MESSAGE} Bilder ausgewählt.`);
            return;
        }
        fileInput.click();
    });

    const textInput = document.getElementById('global-chat-input');
    if (textInput && textInput.parentElement === inputArea) {
        inputArea.insertBefore(smileyBtn, textInput);
        inputArea.insertBefore(imageBtn, textInput);
        textInput.style.flex = '1';
        textInput.style.minWidth = '120px';
    } else {
        inputArea.appendChild(smileyBtn);
        inputArea.appendChild(imageBtn);
    }

    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target !== smileyBtn) {
            picker.style.display = 'none';
        }
    });
}

function syncMobileStateFromActiveChannel() {
    const key = String(activeChannelKey || DEFAULT_CHANNEL_KEY).toLowerCase();
    if (key === DEFAULT_CHANNEL_KEY) {
        mobileSelectedUniId = '';
        return;
    }
    const parts = key.split(':');
    if (parts[0] && parts[0] !== 'general') {
        mobileSelectedUniId = parts[0];
    }
}

function buildMobileChannelsBar(sidebarList) {
    syncMobileStateFromActiveChannel();
    const counts = getChannelCountsMap();
    const isGeneralActive = activeChannelKey === DEFAULT_CHANNEL_KEY;
    const generalCount = counts.get(DEFAULT_CHANNEL_KEY) || 0;

    const currentParts = activeChannelKey.split(':');
    const currentCatId = currentParts.length === 2 && currentParts[0] !== 'general'
        ? currentParts[1]
        : DEFAULT_CATEGORY_ID;

    const selectedUniObj = UNIVERSITIES.find(u => u.id === mobileSelectedUniId) || null;
    const selectedUniLabel = selectedUniObj ? selectedUniObj.short : 'Unis';

    sidebarList.innerHTML = '';

    const topRow = document.createElement('div');
    topRow.style.cssText = [
        'display: grid',
        'grid-template-columns: 1fr 1fr',
        'gap: 6px',
        'width: 100%'
    ].join(';');

    const generalBtn = document.createElement('button');
    generalBtn.type = 'button';
    generalBtn.dataset.channelKey = DEFAULT_CHANNEL_KEY;
    generalBtn.style.cssText = [
        'padding: 7px 10px',
        'border-radius: 9px',
        'cursor: pointer',
        'font-size: 11px',
        'font-weight: 800',
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'gap: 4px',
        'white-space: nowrap',
        'overflow: hidden',
        'text-overflow: ellipsis',
        isGeneralActive
            ? 'background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(129, 140, 248, 0.75); color: #fff;'
            : 'background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border); color: var(--text);'
    ].join(';');
    generalBtn.innerHTML = `
        <span>🌐 Allgemein</span>
        ${generalCount > 0 ? `<span style="font-size: 9px; padding: 1px 5px; border-radius: 999px; background: rgba(129, 140, 248, 0.24); color: #c7d2fe;">${generalCount}</span>` : ''}
    `;
    generalBtn.addEventListener('click', () => {
        mobileUnisDropdownOpen = false;
        mobileSelectedUniId = '';
        selectGlobalChannel(DEFAULT_CHANNEL_KEY);
    });

    const unisDropdownBtn = document.createElement('button');
    unisDropdownBtn.type = 'button';
    unisDropdownBtn.setAttribute('aria-expanded', String(mobileUnisDropdownOpen));
    unisDropdownBtn.style.cssText = [
        'padding: 7px 10px',
        'border-radius: 9px',
        'cursor: pointer',
        'font-size: 11px',
        'font-weight: 800',
        'display: flex',
        'align-items: center',
        'justify-content: space-between',
        'gap: 4px',
        'white-space: nowrap',
        'overflow: hidden',
        'text-overflow: ellipsis',
        !isGeneralActive
            ? 'background: rgba(99, 102, 241, 0.22); border: 1px solid rgba(129, 140, 248, 0.65); color: #fff;'
            : 'background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border); color: #a5b4fc;'
    ].join(';');
    unisDropdownBtn.innerHTML = `
        <span style="overflow: hidden; text-overflow: ellipsis;">🎓 ${escapeHtml(selectedUniLabel)}</span>
        <span style="font-size: 10px; flex-shrink: 0;">${mobileUnisDropdownOpen ? '▴' : '▾'}</span>
    `;
    unisDropdownBtn.addEventListener('click', () => {
        mobileUnisDropdownOpen = !mobileUnisDropdownOpen;
        buildChannelsSidebar(sidebarList);
    });

    topRow.appendChild(generalBtn);
    topRow.appendChild(unisDropdownBtn);
    sidebarList.appendChild(topRow);

    if (mobileUnisDropdownOpen) {
        const uniMenu = document.createElement('div');
        uniMenu.style.cssText = [
            'display: grid',
            'grid-template-columns: repeat(2, minmax(0, 1fr))',
            'gap: 5px',
            'padding: 6px',
            'border-radius: 10px',
            'background: rgba(15, 20, 36, 0.92)',
            'border: 1px solid rgba(129, 140, 248, 0.4)'
        ].join(';');

        UNIVERSITIES.forEach(uni => {
            let uniTotalCount = 0;
            CAMPUS_CATEGORIES.forEach(cat => {
                uniTotalCount += counts.get(`${uni.id}:${cat.id}`) || 0;
            });
            const isPicked = mobileSelectedUniId === uni.id;

            const uBtn = document.createElement('button');
            uBtn.type = 'button';
            uBtn.style.cssText = [
                'padding: 6px 8px',
                'border-radius: 8px',
                'cursor: pointer',
                'font-size: 10px',
                'font-weight: 800',
                'display: flex',
                'align-items: center',
                'justify-content: space-between',
                'gap: 4px',
                'text-align: left',
                isPicked
                    ? 'background: rgba(99, 102, 241, 0.28); border: 1px solid rgba(129, 140, 248, 0.8); color: #fff;'
                    : 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--text);'
            ].join(';');
            uBtn.innerHTML = `
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(uni.short)}</span>
                ${uniTotalCount > 0 ? `<span style="font-size: 9px; opacity: 0.85;">${uniTotalCount}</span>` : ''}
            `;
            uBtn.addEventListener('click', () => {
                mobileSelectedUniId = uni.id;
                mobileUnisDropdownOpen = false;
                selectGlobalChannel(`${uni.id}:${currentCatId}`);
            });
            uniMenu.appendChild(uBtn);
        });

        sidebarList.appendChild(uniMenu);
    }

    if (selectedUniObj) {
        const catRow = document.createElement('div');
        catRow.style.cssText = [
            'display: flex',
            'gap: 5px',
            'overflow-x: auto',
            'padding-bottom: 2px'
        ].join(';');

        CAMPUS_CATEGORIES.forEach(cat => {
            const key = `${selectedUniObj.id}:${cat.id}`;
            const isCatActive = activeChannelKey === key;
            const cBtn = document.createElement('button');
            cBtn.type = 'button';
            cBtn.dataset.channelKey = key;
            cBtn.style.cssText = [
                'padding: 5px 8px',
                'border-radius: 8px',
                'cursor: pointer',
                'font-size: 10px',
                'font-weight: 700',
                'white-space: nowrap',
                'flex-shrink: 0',
                isCatActive
                    ? 'background: rgba(99, 102, 241, 0.26); border: 1px solid rgba(129, 140, 248, 0.75); color: #fff;'
                    : 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--text);'
            ].join(';');
            cBtn.textContent = cat.label;
            cBtn.addEventListener('click', () => selectGlobalChannel(key));
            catRow.appendChild(cBtn);
        });

        sidebarList.appendChild(catRow);
    }
}

function buildDesktopChannelsSidebar(sidebarList) {
    const counts = getChannelCountsMap();

    const generalCount = counts.get(DEFAULT_CHANNEL_KEY) || 0;
    const generalBtn = document.createElement('button');
    generalBtn.type = 'button';
    generalBtn.dataset.channelKey = DEFAULT_CHANNEL_KEY;
    generalBtn.style.cssText = [
        'width: 100%',
        'text-align: left',
        'padding: 10px 12px',
        'border-radius: 10px',
        'cursor: pointer',
        'display: flex',
        'flex-direction: column',
        'gap: 2px',
        'flex-shrink: 0',
        'transition: background 0.15s ease, border-color 0.15s ease'
    ].join(';');
    generalBtn.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <span style="font-size: 12px; font-weight: 800; color: #fff;">🌐 Allgemein</span>
            ${generalCount > 0 ? `<span style="font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 999px; background: rgba(129, 140, 248, 0.22); color: #c7d2fe;">${generalCount}</span>` : ''}
        </div>
        <span style="font-size: 10px; color: var(--text-muted);">Alle Studierenden · Alle Unis</span>
    `;
    generalBtn.addEventListener('click', () => selectGlobalChannel(DEFAULT_CHANNEL_KEY));
    sidebarList.appendChild(generalBtn);

    UNIVERSITIES.forEach(uni => {
        const isOpen = expandedUniversities.has(uni.id);
        const hasActiveChild = activeChannelKey.startsWith(`${uni.id}:`);

        let uniTotalCount = 0;
        CAMPUS_CATEGORIES.forEach(cat => {
            uniTotalCount += counts.get(`${uni.id}:${cat.id}`) || 0;
        });

        const groupBox = document.createElement('div');
        groupBox.style.cssText = [
            'border: 1px solid var(--border)',
            'border-radius: 10px',
            hasActiveChild ? 'background: rgba(99, 102, 241, 0.07);' : 'background: rgba(255, 255, 255, 0.015);',
            'padding: 6px',
            'display: flex',
            'flex-direction: column',
            'gap: 4px',
            'flex-shrink: 0'
        ].join(';');

        const uniHeaderBtn = document.createElement('button');
        uniHeaderBtn.type = 'button';
        uniHeaderBtn.setAttribute('aria-expanded', String(isOpen));
        uniHeaderBtn.style.cssText = [
            'width: 100%',
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 8px',
            'padding: 7px 8px',
            'border-radius: 8px',
            'border: none',
            'background: transparent',
            'cursor: pointer',
            'text-align: left',
            'color: #a5b4fc',
            'font-size: 11px',
            'font-weight: 800'
        ].join(';');
        uniHeaderBtn.innerHTML = `
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🎓 ${escapeHtml(uni.label)}</span>
            <span style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${uniTotalCount > 0 ? `<span style="font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 999px; background: rgba(129, 140, 248, 0.16); color: #a5b4fc;">${uniTotalCount}</span>` : ''}
                <span style="font-size: 10px; opacity: 0.85;">${isOpen ? '▾' : '▸'}</span>
            </span>
        `;
        uniHeaderBtn.addEventListener('click', () => toggleUniversityDropdown(uni.id));
        groupBox.appendChild(uniHeaderBtn);

        if (isOpen) {
            const subMenu = document.createElement('div');
            subMenu.style.cssText = [
                'display: flex',
                'flex-direction: column',
                'gap: 4px',
                'padding: 2px 2px 2px 6px'
            ].join(';');

            CAMPUS_CATEGORIES.forEach(cat => {
                const key = `${uni.id}:${cat.id}`;
                const catCount = counts.get(key) || 0;
                const catBtn = document.createElement('button');
                catBtn.type = 'button';
                catBtn.dataset.channelKey = key;
                catBtn.style.cssText = [
                    'width: 100%',
                    'text-align: left',
                    'padding: 6px 8px',
                    'border-radius: 8px',
                    'cursor: pointer',
                    'font-size: 11px',
                    'font-weight: 700',
                    'display: flex',
                    'justify-content: space-between',
                    'align-items: center',
                    'gap: 6px',
                    'transition: background 0.15s ease, border-color 0.15s ease'
                ].join(';');
                catBtn.innerHTML = `
                    <span>${escapeHtml(cat.label)}</span>
                    ${catCount > 0 ? `<span style="font-size: 9px; font-weight: 800; opacity: 0.85;">${catCount}</span>` : ''}
                `;
                catBtn.addEventListener('click', () => selectGlobalChannel(key));
                subMenu.appendChild(catBtn);
            });

            groupBox.appendChild(subMenu);
        }

        sidebarList.appendChild(groupBox);
    });

    highlightActiveChannelButtons();
}

function buildChannelsSidebar(sidebarList) {
    if (!sidebarList) return;
    sidebarList.innerHTML = '';

    if (isMobileViewport()) {
        sidebarList.style.overflowY = 'visible';
        sidebarList.style.padding = '6px 8px';
        sidebarList.style.gap = '6px';
        buildMobileChannelsBar(sidebarList);
    } else {
        sidebarList.style.overflowY = 'auto';
        sidebarList.style.padding = '8px';
        sidebarList.style.gap = '8px';
        buildDesktopChannelsSidebar(sidebarList);
    }
}

function applyResponsiveLayout(shell, sidebar, channelHeader) {
    if (!shell || !sidebar) return;
    const mobile = isMobileViewport();

    if (mobile) {
        shell.style.gridTemplateColumns = '1fr';
        shell.style.gridTemplateRows = 'auto minmax(0, 1fr)';
        shell.style.gap = '8px';

        sidebar.style.maxHeight = 'none';
        const headerBar = sidebar.firstElementChild;
        if (headerBar && headerBar.tagName === 'DIV') {
            headerBar.style.display = 'none';
        }
        if (channelHeader) {
            channelHeader.style.padding = '7px 10px';
            channelHeader.style.marginBottom = '6px';
        }
    } else {
        shell.style.gridTemplateColumns = 'minmax(225px, 300px) minmax(0, 1fr)';
        shell.style.gridTemplateRows = '1fr';
        shell.style.gap = '12px';

        const headerBar = sidebar.firstElementChild;
        if (headerBar && headerBar.tagName === 'DIV') {
            headerBar.style.display = 'flex';
        }
        if (channelHeader) {
            channelHeader.style.padding = '10px 14px';
            channelHeader.style.marginBottom = '8px';
        }
    }
}

function ensureGlobalChatLayout() {
    installTabAndVisibilityWatchers();
    syncBottomBarVisibility();

    const globalTab = document.getElementById('tab-global');
    if (!globalTab) return null;

    const chatContainer = globalTab.querySelector('.chat-container');
    const messagesList = document.getElementById('global-chat-list');
    const inputArea = globalTab.querySelector('.chat-input-area');
    if (!chatContainer || !messagesList || !inputArea) return null;

    enhanceInputRowWithSmileyAndImages(inputArea);

    chatContainer.style.padding = '10px';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.overflow = 'hidden';

    let shell = document.getElementById('global-chat-shell');
    let sidebar = document.getElementById('global-channels-sidebar');
    let sidebarList = document.getElementById('global-channels-list');
    let channelHeader = document.getElementById('global-active-channel-header');

    if (!shell) {
        shell = document.createElement('div');
        shell.id = 'global-chat-shell';
        shell.style.cssText = [
            'display: grid',
            'grid-template-columns: minmax(225px, 300px) minmax(0, 1fr)',
            'gap: 12px',
            'flex: 1',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        sidebar = document.createElement('div');
        sidebar.id = 'global-channels-sidebar';
        sidebar.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'background: rgba(255, 255, 255, 0.02)',
            'border: 1px solid var(--border)',
            'border-radius: 12px',
            'overflow: hidden',
            'min-height: 0'
        ].join(';');

        sidebar.innerHTML = `
            <div style="padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-shrink: 0;">
                <span style="font-size: 12px; font-weight: 800; color: #fff;">🧭 Campus-Kanäle</span>
                <button type="button" onclick="window.loadGlobalMessages(false)" aria-label="Chat aktualisieren" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted); border-radius: 8px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">↻</button>
            </div>
            <div id="global-channels-list" style="flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px;"></div>
        `;

        const threadPane = document.createElement('div');
        threadPane.id = 'global-thread-pane';
        threadPane.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'min-width: 0',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        channelHeader = document.createElement('div');
        channelHeader.id = 'global-active-channel-header';
        channelHeader.style.cssText = [
            'display: flex',
            'align-items: center',
            'justify-content: space-between',
            'gap: 10px',
            'padding: 10px 14px',
            'margin-bottom: 8px',
            'background: rgba(255, 255, 255, 0.03)',
            'border: 1px solid var(--border)',
            'border-radius: 12px',
            'flex-shrink: 0'
        ].join(';');
        channelHeader.innerHTML = `
            <div style="min-width: 0;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px;">Aktiver Kanal</div>
                <div id="global-active-channel-title" style="font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🌐 Allgemein (Alle Unis)</div>
                <div id="global-active-channel-sub" style="font-size: 11px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Offener Raum für Studierende aller Universitäten</div>
            </div>
        `;

        threadPane.appendChild(channelHeader);
        if (messagesList.parentElement === chatContainer) {
            threadPane.appendChild(messagesList);
        }
        if (inputArea.parentElement === chatContainer) {
            threadPane.appendChild(inputArea);
        }

        shell.appendChild(sidebar);
        shell.appendChild(threadPane);
        chatContainer.appendChild(shell);

        sidebarList = document.getElementById('global-channels-list');
    }

    if (!shell.dataset.resizeBound) {
        shell.dataset.resizeBound = '1';
        window.addEventListener('resize', () => {
            applyResponsiveLayout(shell, sidebar, channelHeader);
            buildChannelsSidebar(document.getElementById('global-channels-list'));
            syncBottomBarVisibility();
        });
    }

    applyResponsiveLayout(shell, sidebar, channelHeader);
    buildChannelsSidebar(sidebarList);
    updateActiveChannelHeader();
    return { shell, sidebarList };
}

function toggleUniversityDropdown(uniId) {
    if (!uniId) return;
    if (expandedUniversities.has(uniId)) {
        expandedUniversities.delete(uniId);
    } else {
        expandedUniversities.add(uniId);
    }
    const sidebarList = document.getElementById('global-channels-list');
    if (sidebarList) {
        buildChannelsSidebar(sidebarList);
    }
}

function highlightActiveChannelButtons() {
    const sidebarList = document.getElementById('global-channels-list');
    if (!sidebarList) return;

    sidebarList.querySelectorAll('button[data-channel-key]').forEach(btn => {
        const key = btn.getAttribute('data-channel-key');
        const isActive = key === activeChannelKey;
        btn.setAttribute('aria-pressed', String(isActive));

        if (isActive) {
            btn.style.background = 'rgba(99, 102, 241, 0.24)';
            btn.style.border = '1px solid rgba(129, 140, 248, 0.7)';
            btn.style.color = '#fff';
        } else {
            btn.style.background = key === DEFAULT_CHANNEL_KEY ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)';
            btn.style.border = '1px solid var(--border)';
            btn.style.color = 'var(--text)';
        }
    });
}

function updateActiveChannelHeader() {
    const meta = getChannelMeta(activeChannelKey);
    const titleEl = document.getElementById('global-active-channel-title');
    const subEl = document.getElementById('global-active-channel-sub');
    const inputEl = document.getElementById('global-chat-input');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;
    if (inputEl) inputEl.placeholder = `Nachricht in ${meta.title}...`;
}

export async function selectGlobalChannel(channelKey) {
    activeChannelKey = String(channelKey || DEFAULT_CHANNEL_KEY).trim().toLowerCase();
    const parts = activeChannelKey.split(':');
    if (parts.length === 2 && parts[0] !== 'general') {
        expandedUniversities.add(parts[0]);
        mobileSelectedUniId = parts[0];
    } else {
        mobileSelectedUniId = '';
    }
    ensureGlobalChatLayout();
    highlightActiveChannelButtons();
    updateActiveChannelHeader();
    await loadGlobalMessages(false);
}

function ensureGlobalChatRealtime() {
    if (globalChatChannel) return;

    try {
        globalChatChannel = _supabase
            .channel('pl-campus-channels-chat')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: CHAT_TABLE },
                (payload) => {
                    const decoded = decodeMessageRow(payload?.new);
                    if (!decoded) return;
                    cachedAllMessages = [...cachedAllMessages, decoded];
                    const sidebarList = document.getElementById('global-channels-list');
                    if (sidebarList) buildChannelsSidebar(sidebarList);
                    if (decoded.channelKey === activeChannelKey) {
                        loadGlobalMessages(true);
                    }
                }
            )
            .subscribe();
    } catch (_err) {}
}

function renderMessageAttachments(item, attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return;

    const gallery = document.createElement('div');
    const cols = attachments.length === 1 ? 1 : 2;
    gallery.style.cssText = [
        'display: grid',
        `grid-template-columns: repeat(${cols}, minmax(0, 1fr))`,
        'gap: 6px',
        'margin-top: 8px'
    ].join(';');

    attachments.slice(0, MAX_IMAGES_PER_MESSAGE).forEach(att => {
        const safeUrl = sanitizeImageUrl(att.url);
        if (!safeUrl) return;

        const img = document.createElement('img');
        img.src = safeUrl;
        img.alt = att.name || 'Chat-Bild';
        img.loading = 'lazy';
        img.style.cssText = [
            'width: 100%',
            'max-height: 180px',
            'object-fit: cover',
            'border-radius: 10px',
            'border: 1px solid rgba(255, 255, 255, 0.15)',
            'cursor: pointer',
            'background: rgba(0, 0, 0, 0.25)'
        ].join(';');
        img.addEventListener('click', () => openImageLightbox(safeUrl));
        gallery.appendChild(img);
    });

    if (gallery.children.length > 0) {
        item.appendChild(gallery);
    }
}

function renderFilteredMessages(listEl, currentEmail, meta) {
    const filtered = (cachedAllMessages || []).filter(item => item && item.channelKey === activeChannelKey);

    if (filtered.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Noch keine Nachrichten in <strong>${escapeHtml(meta.title)}</strong>. Schreib als Erste/r! 💬</p>`;
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach(msg => {
        const isMe = currentEmail && msg.senderEmail === currentEmail;
        const senderLabel = msg.senderName || (msg.senderEmail ? msg.senderEmail.split('@')[0] : 'Student');

        const item = document.createElement('div');
        item.className = 'campus-chat-msg';
        item.style.cssText = [
            'max-width: 82%',
            'padding: 12px 16px',
            'border-radius: 14px',
            'font-size: 13px',
            'line-height: 1.45',
            'word-break: break-word',
            'margin-bottom: 8px',
            `align-self: ${isMe ? 'flex-end' : 'flex-start'}`,
            `background: ${isMe ? 'var(--primary)' : 'var(--card)'}`,
            'color: #fff',
            `border: 1px solid ${isMe ? 'transparent' : 'var(--border)'}`
        ].join(';');

        const timeStr = formatMessageTime(msg.createdAt);
        const textHtml = msg.text ? `<div>${escapeHtml(msg.text)}</div>` : '';

        item.innerHTML = `
            <div style="font-size: 10px; font-weight: 800; opacity: 0.85; margin-bottom: 4px; color: ${isMe ? '#fff' : '#818cf8'};">${escapeHtml(senderLabel)}</div>
            ${textHtml}
            <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 6px;">${escapeHtml(timeStr)}</div>
        `;

        renderMessageAttachments(item, msg.attachments);
        listEl.appendChild(item);
    });

    listEl.scrollTop = listEl.scrollHeight;
}

export async function loadGlobalMessages(silent = false) {
    if (isLoadingGlobalMsgs) return;
    ensureGlobalChatLayout();
    ensureGlobalChatRealtime();

    const listEl = document.getElementById('global-chat-list');
    if (!listEl) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const meta = getChannelMeta(activeChannelKey);

    const hasExisting = listEl.querySelectorAll('.campus-chat-msg').length > 0;
    if (!silent && !hasExisting) {
        listEl.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Lade ${escapeHtml(meta.title)}...</p>`;
    }

    isLoadingGlobalMsgs = true;
    try {
        const rows = await fetchGlobalRowsWithRetry();
        cachedAllMessages = rows.map(decodeMessageRow).filter(Boolean);

        const sidebarList = document.getElementById('global-channels-list');
        if (sidebarList) {
            buildChannelsSidebar(sidebarList);
        }

        renderFilteredMessages(listEl, currentEmail, meta);
    } catch (err) {
        console.error('Fehler beim Laden des Campus-Chats:', err);
        if (!hasExisting) {
            const reason = escapeHtml(err?.message || 'Netzwerk- oder Tabellenfehler');
            listEl.innerHTML = `
                <div style="color: #ef4444; font-size: 12px; text-align:center; padding: 20px;">
                    <div>Nachrichten konnten nicht geladen werden.</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${reason}</div>
                    <button type="button" onclick="window.loadGlobalMessages(false)" style="margin-top: 10px; background: rgba(255,255,255,0.08); border: 1px solid var(--border); color: #fff; border-radius: 8px; padding: 5px 12px; font-size: 11px; cursor: pointer;">Erneut versuchen</button>
                </div>
            `;
        }
    } finally {
        isLoadingGlobalMsgs = false;
    }
}

export async function sendGlobalMessage() {
    if (isSendingGlobalMsg) return;

    const input = document.getElementById('global-chat-input');
    if (!input) return;

    const text = input.value.trim();
    const hasImages = pendingImageDrafts.length > 0;
    if (!text && !hasImages) return;

    if (text && !validateInputOrAlert(text)) {
        return;
    }

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) {
        alert('Bitte logge dich ein, um im Chat zu schreiben.');
        return;
    }

    isSendingGlobalMsg = true;
    try {
        const uploadedAttachments = await uploadDraftImages();
        const safeBodyText = text || (uploadedAttachments.length > 0 ? '📷 Bildanhang' : '');

        const fallbackEncodedText = encodeMessageWithChannel(safeBodyText, activeChannelKey, uploadedAttachments);
        const basePayload = {
            id: crypto.randomUUID(),
            sender_email: currentEmail,
            message_text: fallbackEncodedText,
            created_at: new Date().toISOString()
        };

        let inserted = false;

        if (supportsChannelColumn && supportsAttachmentsColumn) {
            const fullPayload = {
                ...basePayload,
                channel_key: activeChannelKey,
                message_text: safeBodyText,
                attachments: uploadedAttachments
            };
            const { error } = await _supabase.from(CHAT_TABLE).insert([fullPayload]);
            if (!error) {
                inserted = true;
            } else {
                const msg = String(error.message || '').toLowerCase();
                if (msg.includes('attachments')) supportsAttachmentsColumn = false;
                if (msg.includes('channel_key')) supportsChannelColumn = false;
                if (!msg.includes('column')) throw error;
            }
        }

        if (!inserted && supportsChannelColumn) {
            const channelOnlyPayload = {
                ...basePayload,
                channel_key: activeChannelKey,
                message_text: encodeMessageWithChannel(safeBodyText, activeChannelKey, uploadedAttachments)
            };
            const { error } = await _supabase.from(CHAT_TABLE).insert([channelOnlyPayload]);
            if (!error) {
                inserted = true;
            } else {
                const msg = String(error.message || '').toLowerCase();
                if (msg.includes('channel_key') || msg.includes('column')) {
                    supportsChannelColumn = false;
                } else {
                    throw error;
                }
            }
        }

        if (!inserted) {
            const { error: fallbackError } = await _supabase.from(CHAT_TABLE).insert([basePayload]);
            if (fallbackError) throw fallbackError;
        }

        input.value = '';
        clearPendingImages();
        await loadGlobalMessages(true);
    } catch (err) {
        console.error('Fehler beim Senden der Chat-Nachricht:', err);
        alert('Fehler beim Senden: ' + (err?.message || String(err)));
    } finally {
        isSendingGlobalMsg = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    installTabAndVisibilityWatchers();
    ensureGlobalChatLayout();
    syncBottomBarVisibility();

    const globalTabBtn = document.getElementById('btn-tab-global');
    if (globalTabBtn) {
        globalTabBtn.addEventListener('click', () => {
            setTimeout(() => {
                ensureGlobalChatLayout();
                loadGlobalMessages(false);
                syncBottomBarVisibility();
            }, 50);
        });
    }
});

window.selectGlobalChannel = selectGlobalChannel;
window.loadGlobalMessages = loadGlobalMessages;
window.sendGlobalMessage = sendGlobalMessage;