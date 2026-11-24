// js/features/dm.js - Direct Messaging (DM) Modul mit Konversationsliste, Ungelesen-Zähler, Lesebestätigung, Smiley-Picker, bis zu 5 Bildern & zuverlässiger Bottom-Bar-Wiederherstellung
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';
import { notifyDirectMessage } from './notifications.js';

const DM_READ_STORAGE_PREFIX = 'pure_logic_dm_last_read_v1:';
const DM_PARTNER_READ_STORAGE_PREFIX = 'pure_logic_dm_partner_read_v1:';
const DM_ATTACHMENTS_MARKER_REGEX = /\n?\[attachments:(\[[\s\S]*?\])\]\s*$/i;

const STORAGE_BUCKET = 'media';
const MAX_IMAGES_PER_MESSAGE = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MOBILE_BREAKPOINT_PX = 768;

const QUICK_SMILEYS = [
    '😊', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳',
    '🤔', '😅', '😭', '🙏', '🔥', '💯', '👍', '👏',
    '🎉', '☕', '📚', '🎓', '🍻', '❤️', '✨', '🚀'
];

let activeRecipientEmail = null;
let dmRealtimeChannel = null;
let dmRealtimeEmail = '';
let supportsDbReadColumn = true;
let supportsAttachmentsColumn = true;
let isSendingDm = false;
let isLoadingConversations = false;
let isLoadingMessages = false;

// Ausgewählte Bilder (max. 5) vor dem Absenden: { id, file, previewUrl, name }
let pendingDmImageDrafts = [];

// Cache für bereits aufgelöste Anzeigenamen, damit kein Flackern zwischen Prefix und Profilname entsteht
const resolvedProfileNames = new Map();

function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT_PX;
}

function getBottomBarTargets() {
    const targets = [];
    const navBar = document.getElementById('bottom-nav-bar');
    const wrapper = navBar ? navBar.closest('.bottom-controls-wrapper') : null;
    const allWrappers = document.querySelectorAll('.bottom-controls-wrapper');

    if (wrapper) targets.push(wrapper);
    allWrappers.forEach(w => {
        if (!targets.includes(w)) targets.push(w);
    });
    if (navBar && !targets.includes(navBar)) {
        targets.push(navBar);
    }
    return targets;
}

function setBottomBarHiddenForMobileInbox(hideBottomBar) {
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
    setBottomBarHiddenForMobileInbox(isGlobalOpen || isInboxOpen);
}

function installInboxAndVisibilityWatchers() {
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

function formatReadDateTime(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('de-AT', {
        hour: '2-digit',
        minute: '2-digit'
    });
    return `${datePart}, ${timePart}`;
}

function parseTimestamp(isoDate) {
    if (!isoDate) return 0;
    const ts = new Date(isoDate).getTime();
    return Number.isNaN(ts) ? 0 : ts;
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

function encodeMessageWithAttachments(text, attachments = []) {
    const cleanText = String(text || '').trim();
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return cleanText;
    }
    try {
        const compact = attachments.slice(0, MAX_IMAGES_PER_MESSAGE).map(a => ({
            url: sanitizeImageUrl(a.url),
            name: String(a.name || 'bild').slice(0, 80)
        })).filter(a => a.url);

        if (compact.length === 0) return cleanText;
        return `${cleanText}\n[attachments:${JSON.stringify(compact)}]`.trim();
    } catch (_err) {
        return cleanText;
    }
}

function decodeDmRow(msg) {
    if (!msg) return null;
    let rawText = String(msg.message_text || '');
    let attachments = parseAttachmentsArray(msg.attachments);

    const match = rawText.match(DM_ATTACHMENTS_MARKER_REGEX);
    if (match) {
        if (attachments.length === 0) {
            attachments = parseAttachmentsArray(match[1]);
        }
        rawText = rawText.replace(DM_ATTACHMENTS_MARKER_REGEX, '').trim();
    }

    return {
        ...msg,
        cleanText: rawText,
        attachments
    };
}

function ensureDmImagePreviewOverlay() {
    let overlay = document.getElementById('dm-chat-image-lightbox');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'dm-chat-image-lightbox';
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
            <button type="button" id="dm-lightbox-close" aria-label="Bildvorschau schließen" style="align-self: flex-end; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.28); color: #fff; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">✕ Schließen</button>
            <img id="dm-lightbox-img" src="" alt="Vorschau" style="max-width: 90vw; max-height: 80vh; border-radius: 12px; object-fit: contain; box-shadow: 0 18px 45px rgba(0,0,0,0.75);">
        </div>
    `;

    const closeBtn = overlay.querySelector('#dm-lightbox-close');
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

function openDmImageLightbox(url) {
    const safeUrl = sanitizeImageUrl(url);
    if (!safeUrl) return;
    const overlay = ensureDmImagePreviewOverlay();
    const img = overlay.querySelector('#dm-lightbox-img');
    if (img) {
        img.src = safeUrl;
    }
    overlay.style.display = 'flex';
}

function renderPendingDmAttachmentsBar() {
    const bar = document.getElementById('dm-chat-attachments-bar');
    if (!bar) return;

    if (pendingDmImageDrafts.length === 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = '';

    pendingDmImageDrafts.forEach((draft, idx) => {
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
        img.addEventListener('click', () => openDmImageLightbox(draft.previewUrl));

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
            removePendingDmImage(draft.id);
        });

        chip.appendChild(img);
        chip.appendChild(removeBtn);
        bar.appendChild(chip);
    });

    const infoTag = document.createElement('span');
    infoTag.style.cssText = 'font-size: 10px; font-weight: 700; color: #a5b4fc; align-self: center; margin-left: 4px;';
    infoTag.textContent = `${pendingDmImageDrafts.length}/${MAX_IMAGES_PER_MESSAGE} Bilder`;
    bar.appendChild(infoTag);
}

function removePendingDmImage(draftId) {
    const target = pendingDmImageDrafts.find(d => d.id === draftId);
    if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(target.previewUrl);
        } catch (_err) {}
    }
    pendingDmImageDrafts = pendingDmImageDrafts.filter(d => d.id !== draftId);
    renderPendingDmAttachmentsBar();
}

function clearPendingDmImages() {
    pendingDmImageDrafts.forEach(d => {
        if (d.previewUrl && d.previewUrl.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(d.previewUrl);
            } catch (_err) {}
        }
    });
    pendingDmImageDrafts = [];
    const fileInput = document.getElementById('dm-chat-image-input');
    if (fileInput) {
        fileInput.value = '';
    }
    renderPendingDmAttachmentsBar();
}

function handleDmImageSelection(filesList) {
    const incoming = Array.from(filesList || []).filter(f => f && String(f.type || '').startsWith('image/'));
    if (incoming.length === 0) return;

    const availableSlots = MAX_IMAGES_PER_MESSAGE - pendingDmImageDrafts.length;
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
        pendingDmImageDrafts.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name || 'bild.jpg',
            previewUrl: URL.createObjectURL(file)
        });
    }

    const fileInput = document.getElementById('dm-chat-image-input');
    if (fileInput) {
        fileInput.value = '';
    }
    renderPendingDmAttachmentsBar();
}

function insertDmSmileyAtCursor(smiley) {
    const input = document.getElementById('dm-input');
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

function toggleDmSmileyPicker(event) {
    if (event) event.stopPropagation();
    const picker = document.getElementById('dm-smiley-picker');
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

async function uploadDmDraftImages() {
    if (pendingDmImageDrafts.length === 0) return [];

    const uploaded = [];
    const draftsToSend = pendingDmImageDrafts.slice(0, MAX_IMAGES_PER_MESSAGE);

    for (const draft of draftsToSend) {
        const ext = (draft.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const uniquePath = `dm-chat/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

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

function enhanceDmInputRowWithSmileyAndImages(inputArea) {
    if (!inputArea || inputArea.dataset.dmMediaToolbarBound) return;
    inputArea.dataset.dmMediaToolbarBound = '1';

    inputArea.style.position = 'relative';
    inputArea.style.flexWrap = 'wrap';
    inputArea.style.gap = '6px';

    const previewBar = document.createElement('div');
    previewBar.id = 'dm-chat-attachments-bar';
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
    picker.id = 'dm-smiley-picker';
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
            insertDmSmileyAtCursor(emoji);
        });
        picker.appendChild(eBtn);
    });
    inputArea.appendChild(picker);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'dm-chat-image-input';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
        handleDmImageSelection(e.target?.files);
    });
    inputArea.appendChild(fileInput);

    const smileyBtn = document.createElement('button');
    smileyBtn.type = 'button';
    smileyBtn.id = 'dm-smiley-btn';
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
    smileyBtn.addEventListener('click', toggleDmSmileyPicker);

    const imageBtn = document.createElement('button');
    imageBtn.type = 'button';
    imageBtn.id = 'dm-image-btn';
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
        if (pendingDmImageDrafts.length >= MAX_IMAGES_PER_MESSAGE) {
            alert(`Es sind bereits ${MAX_IMAGES_PER_MESSAGE} Bilder ausgewählt.`);
            return;
        }
        fileInput.click();
    });

    const textInput = document.getElementById('dm-input');
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

function getReadMapStorageKey(currentEmail) {
    return `${DM_READ_STORAGE_PREFIX}${String(currentEmail || '').trim().toLowerCase()}`;
}

function getReadTimestampsMap(currentEmail) {
    const normalizedCurrent = String(currentEmail || '').trim().toLowerCase();
    if (!normalizedCurrent) return {};
    try {
        const raw = localStorage.getItem(getReadMapStorageKey(normalizedCurrent));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
        return {};
    }
}

function saveReadTimestampsMap(currentEmail, mapObj) {
    const normalizedCurrent = String(currentEmail || '').trim().toLowerCase();
    if (!normalizedCurrent) return;
    try {
        localStorage.setItem(getReadMapStorageKey(normalizedCurrent), JSON.stringify(mapObj || {}));
    } catch (_err) {}
}

function getPartnerReadStorageKey(senderEmail, recipientEmail) {
    const s = String(senderEmail || '').trim().toLowerCase();
    const r = String(recipientEmail || '').trim().toLowerCase();
    return `${DM_PARTNER_READ_STORAGE_PREFIX}${s}__to__${r}`;
}

function getLocalPartnerReadIso(senderEmail, recipientEmail) {
    try {
        return localStorage.getItem(getPartnerReadStorageKey(senderEmail, recipientEmail)) || '';
    } catch (_err) {
        return '';
    }
}

function setLocalPartnerReadIso(senderEmail, recipientEmail, isoString) {
    try {
        const prev = getLocalPartnerReadIso(senderEmail, recipientEmail);
        const nextTs = Math.max(parseTimestamp(prev), parseTimestamp(isoString), Date.now());
        localStorage.setItem(getPartnerReadStorageKey(senderEmail, recipientEmail), new Date(nextTs).toISOString());
    } catch (_err) {}
}

function setLocalReadTimestamp(currentEmail, partnerEmail, referenceIsoDate = null) {
    const mapObj = getReadTimestampsMap(currentEmail);
    const prevTs = parseTimestamp(mapObj[partnerEmail]);
    const refTs = parseTimestamp(referenceIsoDate);
    const nextTs = Math.max(Date.now(), prevTs, refTs);
    const nextIso = new Date(nextTs).toISOString();

    mapObj[partnerEmail] = nextIso;
    saveReadTimestampsMap(currentEmail, mapObj);
    setLocalPartnerReadIso(partnerEmail, currentEmail, nextIso);
    return nextIso;
}

export async function markConversationAsRead(partnerEmail, referenceIsoDate = null) {
    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const partner = String(partnerEmail || '').trim().toLowerCase();
    if (!currentEmail || !partner) return;

    const nextIso = setLocalReadTimestamp(currentEmail, partner, referenceIsoDate);

    if (!supportsDbReadColumn) return;

    try {
        const { error } = await _supabase
            .from('direct_messages')
            .update({ recipient_last_read_at: nextIso })
            .eq('sender_email', partner)
            .eq('recipient_email', currentEmail);

        if (error) {
            const msgText = String(error.message || '').toLowerCase();
            if (msgText.includes('recipient_last_read_at') || msgText.includes('column')) {
                supportsDbReadColumn = false;
            }
        }
    } catch (_err) {}
}

function ensureInboxLayout() {
    installInboxAndVisibilityWatchers();
    syncBottomBarVisibility();

    const inboxTab = document.getElementById('tab-inbox');
    if (!inboxTab) return null;

    const chatList = document.getElementById('dm-chat-list');
    const recipientInput = document.getElementById('dm-recipient');
    const inputArea = inboxTab.querySelector('.chat-input-area');
    if (!chatList || !recipientInput) return null;

    if (inputArea) {
        enhanceDmInputRowWithSmileyAndImages(inputArea);
    }

    let shell = document.getElementById('dm-inbox-shell');
    let convList = document.getElementById('dm-conversations-list');

    if (!shell) {
        const parentContainer = chatList.parentElement;
        if (!parentContainer) return null;

        shell = document.createElement('div');
        shell.id = 'dm-inbox-shell';
        shell.style.cssText = [
            'display: grid',
            'grid-template-columns: minmax(210px, 280px) minmax(0, 1fr)',
            'gap: 12px',
            'flex: 1',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const sidebar = document.createElement('div');
        sidebar.id = 'dm-conversations-sidebar';
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
                <span style="font-size: 12px; font-weight: 800; color: #fff;">💬 Konversationen</span>
                <button type="button" onclick="window.loadConversationsList(false)" aria-label="Konversationen aktualisieren" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text-muted); border-radius: 8px; padding: 3px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">↻</button>
            </div>
            <div id="dm-conversations-list" style="flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                <p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Lade Chats...</p>
            </div>
        `;

        const threadPane = document.createElement('div');
        threadPane.id = 'dm-thread-pane';
        threadPane.style.cssText = [
            'display: flex',
            'flex-direction: column',
            'min-width: 0',
            'min-height: 0',
            'overflow: hidden'
        ].join(';');

        const activePartnerHeader = document.createElement('div');
        activePartnerHeader.id = 'dm-active-partner-header';
        activePartnerHeader.style.cssText = [
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
        activePartnerHeader.innerHTML = `
            <div style="min-width: 0;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px;">Konversation mit</div>
                <div id="dm-active-partner-name" style="font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Kein Gesprächspartner gewählt</div>
                <div id="dm-active-partner-email" style="font-size: 11px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">–</div>
            </div>
        `;

        const recipientLabel = inboxTab.querySelector('label[for="dm-recipient"]');

        threadPane.appendChild(activePartnerHeader);

        if (recipientLabel && recipientLabel.parentElement === parentContainer) {
            threadPane.appendChild(recipientLabel);
        }
        if (recipientInput.parentElement === parentContainer) {
            threadPane.appendChild(recipientInput);
        }
        if (chatList.parentElement === parentContainer) {
            threadPane.appendChild(chatList);
        }
        if (inputArea && inputArea.parentElement === parentContainer) {
            threadPane.appendChild(inputArea);
        }

        shell.appendChild(sidebar);
        shell.appendChild(threadPane);
        parentContainer.insertBefore(shell, parentContainer.firstChild);

        convList = document.getElementById('dm-conversations-list');
    }

    const applyResponsiveColumns = () => {
        if (!shell) return;
        if (window.innerWidth <= 720) {
            shell.style.gridTemplateColumns = '1fr';
            shell.style.gridTemplateRows = 'minmax(110px, 155px) minmax(0, 1fr)';
        } else {
            shell.style.gridTemplateColumns = 'minmax(210px, 280px) minmax(0, 1fr)';
            shell.style.gridTemplateRows = '1fr';
        }
        syncBottomBarVisibility();
    };

    if (!shell.dataset.resizeBound) {
        shell.dataset.resizeBound = '1';
        window.addEventListener('resize', applyResponsiveColumns);
    }
    applyResponsiveColumns();

    return { shell, convList };
}

function getStableDisplayName(email, profile = null) {
    const normalized = String(email || '').trim().toLowerCase();
    const fallback = normalized.split('@')[0] || normalized;

    if (profile) {
        const candidate = String(profile.full_name || profile.username || '').trim();
        if (candidate) {
            resolvedProfileNames.set(normalized, {
                displayName: candidate,
                username: String(profile.username || '').replace(/^@+/, '').trim()
            });
            return candidate;
        }
    }

    const cached = resolvedProfileNames.get(normalized);
    if (cached?.displayName) {
        return cached.displayName;
    }

    return fallback;
}

function getStableHeaderLabel(email, profile = null) {
    const normalized = String(email || '').trim().toLowerCase();
    const fallback = normalized.split('@')[0] || normalized;

    if (profile) {
        const displayName = String(profile.full_name || profile.username || fallback).trim();
        const rawHandle = String(profile.username || '').replace(/^@+/, '').trim();
        resolvedProfileNames.set(normalized, {
            displayName,
            username: rawHandle
        });
        return rawHandle ? `${displayName} (@${rawHandle})` : displayName;
    }

    const cached = resolvedProfileNames.get(normalized);
    if (cached?.displayName) {
        return cached.username ? `${cached.displayName} (@${cached.username})` : cached.displayName;
    }

    return fallback;
}

async function fetchProfilesMap(emails) {
    const map = new Map();
    const uniqueEmails = [...new Set((emails || []).map(e => String(e || '').trim().toLowerCase()).filter(Boolean))];
    if (uniqueEmails.length === 0) return map;

    try {
        const { data, error } = await _supabase
            .from('users')
            .select('email, full_name, username, avatar_url')
            .in('email', uniqueEmails);

        if (!error && Array.isArray(data)) {
            data.forEach(u => {
                if (u?.email) {
                    const key = String(u.email).toLowerCase();
                    map.set(key, u);
                    const candidate = String(u.full_name || u.username || '').trim();
                    if (candidate) {
                        resolvedProfileNames.set(key, {
                            displayName: candidate,
                            username: String(u.username || '').replace(/^@+/, '').trim()
                        });
                    }
                }
            });
        }
    } catch (_err) {}

    return map;
}

async function updateActivePartnerHeader(partnerEmail) {
    ensureInboxLayout();
    const nameEl = document.getElementById('dm-active-partner-name');
    const emailEl = document.getElementById('dm-active-partner-email');
    if (!nameEl || !emailEl) return;

    const normalizedPartner = String(partnerEmail || '').trim().toLowerCase();
    if (!normalizedPartner) {
        nameEl.textContent = 'Kein Gesprächspartner gewählt';
        emailEl.textContent = 'Links wählen oder E-Mail eingeben';
        return;
    }

    emailEl.textContent = normalizedPartner;
    nameEl.textContent = getStableHeaderLabel(normalizedPartner);

    const profilesMap = await fetchProfilesMap([normalizedPartner]);
    const profile = profilesMap.get(normalizedPartner);
    if (profile) {
        nameEl.textContent = getStableHeaderLabel(normalizedPartner, profile);
    }
}

function updateInboxTabBadge(totalUnread) {
    const inboxBtn = document.getElementById('btn-tab-inbox');
    if (!inboxBtn) return;

    let badge = document.getElementById('dm-inbox-tab-badge');
    if (totalUnread > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'dm-inbox-tab-badge';
            badge.style.cssText = [
                'display: inline-flex',
                'align-items: center',
                'justify-content: center',
                'min-width: 16px',
                'height: 16px',
                'padding: 0 4px',
                'margin-left: 5px',
                'border-radius: 999px',
                'background: #ec4899',
                'color: #fff',
                'font-size: 9px',
                'font-weight: 900',
                'line-height: 1'
            ].join(';');
            inboxBtn.appendChild(badge);
        }
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    } else if (badge) {
        badge.remove();
    }
}

function resolveMessageReadAt(msg, currentEmail) {
    const recipient = String(msg.recipient_email || '').trim().toLowerCase();
    const dbReadIso = msg.recipient_last_read_at || '';
    const localReadIso = getLocalPartnerReadIso(currentEmail, recipient);

    const dbTs = parseTimestamp(dbReadIso);
    const localTs = parseTimestamp(localReadIso);
    const bestReadTs = Math.max(dbTs, localTs);
    if (!bestReadTs) return '';

    const msgTs = parseTimestamp(msg.created_at);
    if (msgTs > 0 && bestReadTs >= msgTs) {
        return new Date(bestReadTs).toISOString();
    }
    return '';
}

function renderConversationsView(convList, currentEmail, messages, selectedPartner, isInboxVisible) {
    const readMap = getReadTimestampsMap(currentEmail);
    const conversationsMap = new Map();

    (messages || []).forEach(rawMsg => {
        const msg = decodeDmRow(rawMsg);
        if (!msg) return;

        const sender = String(msg.sender_email || '').trim().toLowerCase();
        const recipient = String(msg.recipient_email || '').trim().toLowerCase();
        if (!sender || !recipient) return;

        const partnerEmail = sender === currentEmail ? recipient : sender;
        if (!partnerEmail || partnerEmail === currentEmail) return;

        const summaryText = msg.cleanText || (msg.attachments?.length ? `📷 ${msg.attachments.length} Bild(er)` : '');

        if (!conversationsMap.has(partnerEmail)) {
            conversationsMap.set(partnerEmail, {
                partnerEmail,
                lastMessage: summaryText,
                lastTime: msg.created_at || '',
                lastSender: sender,
                unreadCount: 0
            });
        }

        const convEntry = conversationsMap.get(partnerEmail);
        const isIncoming = sender === partnerEmail && recipient === currentEmail;
        const isCurrentlyOpen = isInboxVisible && selectedPartner === partnerEmail;

        if (isIncoming && !isCurrentlyOpen) {
            const msgTs = parseTimestamp(msg.created_at);
            const lastReadTs = parseTimestamp(readMap[partnerEmail]);
            if (msgTs > lastReadTs) {
                convEntry.unreadCount += 1;
            }
        }
    });

    if (selectedPartner && selectedPartner !== currentEmail && !conversationsMap.has(selectedPartner)) {
        conversationsMap.set(selectedPartner, {
            partnerEmail: selectedPartner,
            lastMessage: 'Neue Konversation starten',
            lastTime: '',
            lastSender: '',
            unreadCount: 0
        });
    }

    const conversations = [...conversationsMap.values()];
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    updateInboxTabBadge(totalUnread);

    if (conversations.length === 0) {
        convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Noch keine Konversationen vorhanden. Trage rechts eine E-Mail ein, um zu starten.</p>';
        return conversations;
    }

    convList.innerHTML = '';
    conversations.forEach(conv => {
        const displayName = getStableDisplayName(conv.partnerEmail);
        const isSelected = selectedPartner === conv.partnerEmail;
        const timeLabel = formatMessageTime(conv.lastTime);
        const prefix = conv.lastSender === currentEmail ? 'Du: ' : '';
        const previewText = `${prefix}${conv.lastMessage || ''}`;
        const hasUnread = conv.unreadCount > 0;
        const unreadLabel = conv.unreadCount > 99 ? '99+' : String(conv.unreadCount);

        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.dataset.partnerEmail = conv.partnerEmail;
        itemBtn.setAttribute('aria-pressed', String(isSelected));
        itemBtn.style.cssText = [
            'width: 100%',
            'text-align: left',
            'padding: 9px 10px',
            'border-radius: 10px',
            'cursor: pointer',
            'display: flex',
            'flex-direction: column',
            'gap: 3px',
            'transition: background 0.15s ease, border-color 0.15s ease',
            isSelected
                ? 'background: rgba(99, 102, 241, 0.22); border: 1px solid rgba(129, 140, 248, 0.65); color: #fff;'
                : hasUnread
                    ? 'background: rgba(236, 72, 153, 0.10); border: 1px solid rgba(236, 72, 153, 0.45); color: var(--text);'
                    : 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); color: var(--text);'
        ].join(';');

        itemBtn.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                <span class="conv-display-name" style="font-size: 12px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                <div style="display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;">
                    ${hasUnread ? `<span aria-label="${escapeHtml(unreadLabel)} ungelesene Nachrichten" style="display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ec4899; color: #fff; font-size: 10px; font-weight: 900; line-height: 1;">${escapeHtml(unreadLabel)}</span>` : ''}
                    <span style="font-size: 9px; color: ${hasUnread ? '#f472b6' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '700' : '400'};">${escapeHtml(timeLabel)}</span>
                </div>
            </div>
            <div style="font-size: 10px; color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(conv.partnerEmail)}</div>
            <div style="font-size: 11px; color: ${hasUnread ? '#f8fafc' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '700' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(previewText)}</div>
        `;

        itemBtn.addEventListener('click', async () => {
            activeRecipientEmail = conv.partnerEmail;
            const recipientInput = document.getElementById('dm-recipient');
            if (recipientInput) {
                recipientInput.value = conv.partnerEmail;
            }
            setLocalReadTimestamp(currentEmail, conv.partnerEmail, conv.lastTime);
            await updateActivePartnerHeader(conv.partnerEmail);
            await loadConversationsList(true);
            await loadDirectMessages(true);
            markConversationAsRead(conv.partnerEmail, conv.lastTime);
        });

        convList.appendChild(itemBtn);
    });

    return conversations;
}

/**
 * Lädt alle Konversationen des aktuellen Nutzers inklusive Ungelesen-Zähler
 */
export async function loadConversationsList(silent = false) {
    if (isLoadingConversations) return;
    const layout = ensureInboxLayout();
    const convList = layout?.convList || document.getElementById('dm-conversations-list');
    if (!convList) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) {
        updateInboxTabBadge(0);
        convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Bitte logge dich ein, um Chats zu sehen.</p>';
        return;
    }

    const hasExistingItems = convList.querySelectorAll('button').length > 0;
    if (!silent && !hasExistingItems) {
        convList.innerHTML = '<p style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 14px;">Lade Konversationen...</p>';
    }

    isLoadingConversations = true;
    try {
        const { data: messages, error } = await _supabase
            .from('direct_messages')
            .select('*')
            .or(`sender_email.eq.${currentEmail},recipient_email.eq.${currentEmail}`)
            .order('created_at', { ascending: false })
            .limit(300);

        if (error) throw error;

        const activeFromInput = String(document.getElementById('dm-recipient')?.value || '').trim().toLowerCase();
        const selectedPartner = activeFromInput || activeRecipientEmail || '';
        const isInboxVisible = isTabCurrentlyOpen('tab-inbox');

        if (isInboxVisible && selectedPartner) {
            setLocalReadTimestamp(currentEmail, selectedPartner);
        }

        const conversations = renderConversationsView(convList, currentEmail, messages || [], selectedPartner, isInboxVisible);

        if (Array.isArray(conversations) && conversations.length > 0) {
            const profilesMap = await fetchProfilesMap(conversations.map(c => c.partnerEmail));
            convList.querySelectorAll('button[data-partner-email]').forEach(btn => {
                const pEmail = btn.getAttribute('data-partner-email');
                const profile = profilesMap.get(pEmail);
                const nameSpan = btn.querySelector('.conv-display-name');
                if (nameSpan) {
                    nameSpan.textContent = getStableDisplayName(pEmail, profile);
                }
            });
        }
    } catch (err) {
        console.error('Fehler beim Laden der Konversationen:', err);
        if (!hasExistingItems) {
            convList.innerHTML = '<p style="color: #ef4444; font-size: 11px; text-align: center; padding: 14px;">Konversationen konnten nicht geladen werden.</p>';
        }
    } finally {
        isLoadingConversations = false;
    }
}

function ensureDmRealtimeSubscription() {
    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    if (!currentEmail) return;
    if (dmRealtimeChannel && dmRealtimeEmail === currentEmail) return;

    if (dmRealtimeChannel && typeof _supabase.removeChannel === 'function') {
        _supabase.removeChannel(dmRealtimeChannel);
        dmRealtimeChannel = null;
    }

    dmRealtimeEmail = currentEmail;

    try {
        dmRealtimeChannel = _supabase
            .channel(`pl-dm-inbox-${currentEmail}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'direct_messages' },
                async (payload) => {
                    const row = payload?.new || payload?.old;
                    if (!row) return;
                    const sender = String(row.sender_email || '').trim().toLowerCase();
                    const recipient = String(row.recipient_email || '').trim().toLowerCase();
                    if (sender !== currentEmail && recipient !== currentEmail) return;

                    const partner = sender === currentEmail ? recipient : sender;
                    if (!activeRecipientEmail && partner) {
                        activeRecipientEmail = partner;
                        const recipientInput = document.getElementById('dm-recipient');
                        if (recipientInput && !recipientInput.value.trim()) {
                            recipientInput.value = partner;
                        }
                    }

                    const isInboxVisible = isTabCurrentlyOpen('tab-inbox');
                    const currentTarget = String(document.getElementById('dm-recipient')?.value || activeRecipientEmail || '').trim().toLowerCase();
                    const isOpenWithPartner = Boolean(isInboxVisible && currentTarget && (sender === currentTarget || recipient === currentTarget));

                    if (isOpenWithPartner && partner && sender === partner) {
                        setLocalReadTimestamp(currentEmail, partner, row.created_at);
                    }

                    await updateActivePartnerHeader(currentTarget || activeRecipientEmail || '');
                    await loadConversationsList(true);
                    if (isOpenWithPartner) {
                        await loadDirectMessages(true);
                    }
                }
            )
            .subscribe();
    } catch (_err) {}
}

/**
 * Öffnet das Postfach für eine bestimmte Empfänger-E-Mail
 */
export function openDirectMessageWith(recipientEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um Direktnachrichten zu schreiben.');
        return;
    }

    const normalizedRecipient = String(recipientEmail || '').trim().toLowerCase();
    const normalizedCurrent = String(state.currentUserEmail || '').trim().toLowerCase();

    if (normalizedRecipient === normalizedCurrent) {
        alert('Du kannst dir nicht selbst Nachrichten schreiben.');
        return;
    }

    activeRecipientEmail = normalizedRecipient;
    ensureInboxLayout();

    if (typeof window.switchTab === 'function') {
        window.switchTab('inbox');
    }

    syncBottomBarVisibility();

    const recipientInput = document.getElementById('dm-recipient');
    if (recipientInput) {
        recipientInput.value = normalizedRecipient;
    }

    setLocalReadTimestamp(normalizedCurrent, normalizedRecipient);
    updateActivePartnerHeader(normalizedRecipient);
    loadConversationsList(true);
    loadDirectMessages(false);
    markConversationAsRead(normalizedRecipient);
}

function renderDmMessageAttachments(bubble, attachments) {
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
        img.alt = att.name || 'DM-Bild';
        img.loading = 'lazy';
        img.style.cssText = [
            'width: 100%',
            'max-height: 180px',
            'object-fit: cover',
            'border-radius: 10px',
            'border: 1px solid rgba(255, 255, 255, 0.18)',
            'cursor: pointer',
            'background: rgba(0, 0, 0, 0.25)'
        ].join(';');
        img.addEventListener('click', () => openDmImageLightbox(safeUrl));
        gallery.appendChild(img);
    });

    if (gallery.children.length > 0) {
        bubble.appendChild(gallery);
    }
}

/**
 * Lädt die Direktnachrichten zwischen dem aktuellen Nutzer und dem Empfänger
 */
export async function loadDirectMessages(silent = false) {
    if (isLoadingMessages) return;
    ensureInboxLayout();
    ensureDmRealtimeSubscription();

    const recipientInput = document.getElementById('dm-recipient');
    const chatList = document.getElementById('dm-chat-list');

    if (!recipientInput || !chatList) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const recipientEmail = recipientInput.value.trim().toLowerCase();
    activeRecipientEmail = recipientEmail;

    updateActivePartnerHeader(recipientEmail);

    if (!currentEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Bitte logge dich ein.</p>';
        return;
    }

    if (!recipientEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Wähle links eine Konversation aus oder gib oben eine E-Mail ein.</p>';
        return;
    }

    setLocalReadTimestamp(currentEmail, recipientEmail);

    const hasExistingMessages = chatList.querySelectorAll('div').length > 0 && !chatList.textContent.includes('Lade Nachrichten...');
    if (!silent && !hasExistingMessages) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Nachrichten...</p>';
    }

    isLoadingMessages = true;
    try {
        const { data: messages, error } = await _supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_email.eq.${currentEmail},recipient_email.eq.${recipientEmail}),and(sender_email.eq.${recipientEmail},recipient_email.eq.${currentEmail})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            chatList.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Noch keine Nachrichten mit ${escapeHtml(recipientEmail)}. Starte die Konversation! 💬</p>`;
            return;
        }

        const latestMsgTime = messages[messages.length - 1]?.created_at || null;
        setLocalReadTimestamp(currentEmail, recipientEmail, latestMsgTime);

        chatList.innerHTML = '';
        messages.forEach(rawMsg => {
            const msg = decodeDmRow(rawMsg);
            if (!msg) return;

            const isMe = String(msg.sender_email || '').toLowerCase() === currentEmail;
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: ${isMe ? 'flex-end' : 'flex-start'};
                margin-bottom: 10px;
                max-width: 82%;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
            `;

            const bubble = document.createElement('div');
            bubble.style.cssText = `
                width: 100%;
                padding: 16px 20px;
                border-radius: 20px;
                font-size: 14px;
                line-height: 1.55;
                word-break: break-word;
                background: ${isMe ? 'var(--primary)' : 'var(--card)'};
                color: #fff;
                border: 1px solid ${isMe ? 'transparent' : 'var(--border)'};
                box-shadow: 0 4px 14px rgba(0,0,0,0.28);
            `;

            const timeStr = formatMessageTime(msg.created_at);
            const textBlock = msg.cleanText ? `<div>${escapeHtml(msg.cleanText)}</div>` : '';
            bubble.innerHTML = `
                ${textBlock}
                <div style="font-size: 10px; opacity: 0.75; text-align: right; margin-top: 8px;">${escapeHtml(timeStr)}</div>
            `;
            renderDmMessageAttachments(bubble, msg.attachments);
            wrapper.appendChild(bubble);

            if (isMe) {
                const readIso = resolveMessageReadAt(msg, currentEmail);
                const statusRow = document.createElement('div');
                statusRow.style.cssText = `
                    font-size: 10px;
                    margin-top: 4px;
                    padding-right: 4px;
                    font-weight: 700;
                    color: ${readIso ? '#34d399' : 'var(--text-muted)'};
                `;

                if (readIso) {
                    statusRow.textContent = `✓✓ Gelesen · ${formatReadDateTime(readIso)}`;
                } else {
                    statusRow.textContent = '✓ Ungelesen';
                }

                wrapper.appendChild(statusRow);
            }

            chatList.appendChild(wrapper);
        });

        chatList.scrollTop = chatList.scrollHeight;
        markConversationAsRead(recipientEmail, latestMsgTime);
        loadConversationsList(true);

    } catch (err) {
        console.error('Fehler beim Laden der DMs:', err);
        if (!hasExistingMessages) {
            chatList.innerHTML = '<p style="color: #ef4444; font-size: 12px; text-align:center; padding: 20px;">Fehler beim Laden der Nachrichten.</p>';
        }
    } finally {
        isLoadingMessages = false;
    }
}

async function insertDirectMessageWithRetry(payloadRow) {
    let attempt = 0;
    while (attempt < 2) {
        attempt += 1;
        const { error } = await _supabase
            .from('direct_messages')
            .insert([payloadRow]);

        if (!error) return;

        const isFetchError = String(error.message || '').toLowerCase().includes('failed to fetch');
        if (!isFetchError || attempt >= 2) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 350));
    }
}

/**
 * Sendet eine Direktnachricht an den Empfänger (inkl. Moderations-Check, bis zu 5 Bildern & Retry)
 */
export async function sendDirectMessage() {
    if (isSendingDm) return;

    const recipientInput = document.getElementById('dm-recipient');
    const input = document.getElementById('dm-input');

    if (!recipientInput || !input) return;

    const currentEmail = String(state.currentUserEmail || '').trim().toLowerCase();
    const recipientEmail = recipientInput.value.trim().toLowerCase();
    const text = input.value.trim();
    const hasImages = pendingDmImageDrafts.length > 0;

    if (!recipientEmail) {
        alert('Bitte gib zuerst eine Empfänger-E-Mail ein.');
        return;
    }

    if (!text && !hasImages) return;

    if (text && !validateInputOrAlert(text)) {
        return;
    }

    if (!currentEmail) {
        alert('Du musst eingeloggt sein.');
        return;
    }

    isSendingDm = true;
    try {
        const nowIso = new Date().toISOString();
        const uploadedAttachments = await uploadDmDraftImages();
        const encodedText = encodeMessageWithAttachments(text, uploadedAttachments);

        const basePayload = {
            id: crypto.randomUUID(),
            sender_email: currentEmail,
            recipient_email: recipientEmail,
            message_text: encodedText || '📷 Bildanhang',
            created_at: nowIso
        };

        let inserted = false;

        if (supportsAttachmentsColumn) {
            const withAttachmentsPayload = {
                ...basePayload,
                message_text: text || (uploadedAttachments.length > 0 ? '📷 Bildanhang' : ''),
                attachments: uploadedAttachments
            };

            try {
                let attempt = 0;
                while (attempt < 2) {
                    attempt += 1;
                    const { error } = await _supabase
                        .from('direct_messages')
                        .insert([withAttachmentsPayload]);

                    if (!error) {
                        inserted = true;
                        break;
                    }

                    const msg = String(error.message || '').toLowerCase();
                    if (msg.includes('attachments') || msg.includes('column')) {
                        supportsAttachmentsColumn = false;
                        break;
                    }
                    if (!msg.includes('failed to fetch') || attempt >= 2) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            } catch (err) {
                const msg = String(err?.message || '').toLowerCase();
                if (msg.includes('attachments') || msg.includes('column')) {
                    supportsAttachmentsColumn = false;
                } else {
                    throw err;
                }
            }
        }

        if (!inserted) {
            await insertDirectMessageWithRetry(basePayload);
        }

        setLocalReadTimestamp(currentEmail, recipientEmail, nowIso);

        try {
            const notifText = text || `📷 ${uploadedAttachments.length} Bild(er) gesendet`;
            await notifyDirectMessage(recipientEmail, currentEmail, notifText);
        } catch (_notifErr) {}

        activeRecipientEmail = recipientEmail;
        input.value = '';
        clearPendingDmImages();
        await updateActivePartnerHeader(recipientEmail);
        await loadDirectMessages(true);
        await loadConversationsList(true);
        markConversationAsRead(recipientEmail, nowIso);

    } catch (err) {
        console.error('Fehler beim Senden der DM:', err);
        const detail = err?.message || String(err);
        alert(`Fehler beim Senden: ${detail}\nBitte prüfe deine Internetverbindung oder ob ein Werbeblocker/Firewall Supabase blockiert.`);
    } finally {
        isSendingDm = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    installInboxAndVisibilityWatchers();
    ensureInboxLayout();
    updateActivePartnerHeader('');
    syncBottomBarVisibility();

    const recipientInput = document.getElementById('dm-recipient');
    if (recipientInput) {
        recipientInput.addEventListener('input', () => {
            updateActivePartnerHeader(recipientInput.value.trim().toLowerCase());
        });
    }

    const inboxBtn = document.getElementById('btn-tab-inbox');
    if (inboxBtn) {
        inboxBtn.addEventListener('click', () => {
            setTimeout(() => {
                ensureInboxLayout();
                loadConversationsList(true);
                loadDirectMessages(true);
                syncBottomBarVisibility();
            }, 50);
        });
    }

    setInterval(() => {
        if (!state.currentUserEmail) return;
        ensureDmRealtimeSubscription();
        if (isTabCurrentlyOpen('tab-inbox')) {
            loadConversationsList(true);
        }
    }, 3500);
});

// Global für HTML-Events verfügbar machen
window.openDirectMessageWith = openDirectMessageWith;
window.loadDirectMessages = loadDirectMessages;
window.sendDirectMessage = sendDirectMessage;
window.loadConversationsList = loadConversationsList;
window.markConversationAsRead = markConversationAsRead;