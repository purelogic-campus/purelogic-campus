// js/features/avatarUpload.js • Profilbild aus Gerätespeicher (Smartphone/PC) hochladen & in users.avatar_url speichern
import { _supabase } from '../config.js';
import { state } from '../state.js';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // Maximal 5 MB pro Profilbild

// Aktualisiert alle sichtbaren Profilbild-Elemente im DOM sofort mit Cache-Busting
function updateAvatarElementsInDom(newUrl) {
    if (!newUrl) return;
    const cacheBustedUrl = `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

    const selectors = [
        '#profile-avatar-img',
        '#user-avatar-img',
        '[data-role="profile-avatar"]',
        'img[alt*="Profilbild"]',
        'img[alt*="Avatar"]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(img => {
        if (img instanceof HTMLImageElement) {
            img.src = cacheBustedUrl;
        }
    });
}

// Konvertiert das gewählte Bild bei Bedarf in einen kompakten JPEG-Data-URL-Fallback
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsDataURL(file);
    });
}

// Erstellt bzw. holt das versteckte Datei-Auswahlfeld für Smartphone und PC
function ensureAvatarFileInput(onFileSelected) {
    let input = document.getElementById('device-avatar-file-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'device-avatar-file-input';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
    }

    input.onchange = async event => {
        const file = event.target?.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Bitte wähle eine gültige Bilddatei aus (z. B. JPG, PNG oder WebP).');
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            alert('Das Bild ist zu groß. Maximal 5 MB sind erlaubt.');
            return;
        }

        if (typeof onFileSelected === 'function') {
            await onFileSelected(file);
        }
    };

    return input;
}

// Speichert die Bild-URL in der users-Tabelle und aktualisiert den lokalen State sowie die UI
async function saveAvatarUrlToUser(avatarUrl) {
    const { error: dbError } = await _supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('email', state.currentUserEmail);

    if (dbError) {
        throw new Error(`Profil konnte nicht gespeichert werden: ${dbError.message}`);
    }

    if (state.currentUser) {
        state.currentUser.avatar_url = avatarUrl;
    }
    updateAvatarElementsInDom(avatarUrl);
}

// Öffnet die Galerie/Dateiauswahl vom Gerät und lädt das Bild hoch
export async function uploadProfileAvatarFromDevice(options = {}) {
    const { buttonEl = null, onSuccess = null } = options;

    if (!state.currentUserEmail) {
        alert('Bitte logge dich zuerst ein, um dein Profilbild zu ändern.');
        return null;
    }

    const fileInput = ensureAvatarFileInput(async file => {
        const originalText = buttonEl ? buttonEl.textContent : '';
        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.textContent = 'Lädt hoch... ⏳';
        }

        try {
            const extFromName = file.name.includes('.')
                ? file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
                : '';
            const extFromMime = file.type.split('/')[1]?.split('+')[0]?.toLowerCase() || 'jpg';
            const extension = extFromName || extFromMime || 'jpg';

            const safeUserKey = state.currentUserEmail
                .toLowerCase()
                .replace(/[^a-z0-9._-]/g, '_');
            const filePath = `${safeUserKey}/avatar_${Date.now()}.${extension}`;

            let finalAvatarUrl = '';

            // Versuch 1: Upload in den Storage-Bucket 'avatars'
            const { error: uploadError } = await _supabase.storage
                .from(AVATAR_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: file.type
                });

            if (!uploadError) {
                const { data: publicUrlData } = _supabase.storage
                    .from(AVATAR_BUCKET)
                    .getPublicUrl(filePath);
                finalAvatarUrl = publicUrlData?.publicUrl || '';
            }

            // Versuch 2: Falls Storage nicht genutzt/freigegeben ist, als Data-URL direkt speichern
            if (!finalAvatarUrl) {
                finalAvatarUrl = await readFileAsDataUrl(file);
            }

            if (!finalAvatarUrl) {
                throw new Error('Bilddaten konnten nicht verarbeitet werden.');
            }

            await saveAvatarUrlToUser(finalAvatarUrl);

            if (typeof onSuccess === 'function') {
                onSuccess(finalAvatarUrl);
            }

            alert('Profilbild erfolgreich übernommen! 🎉');
            return finalAvatarUrl;
        } catch (err) {
            console.error('Fehler beim Profilbild-Upload:', err);
            alert(err.message || 'Beim Hochladen des Profilbilds ist ein Fehler aufgetreten.');
            return null;
        } finally {
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.textContent = originalText || '🖼️ Bild vom Gerät wählen';
            }
        }
    });

    fileInput.click();
    return true;
}

// Bindet automatisch vorhandene Upload-Buttons oder erstellt im Profilbereich einen Button, falls keiner da ist
export function initDeviceAvatarUpload() {
    const bindButtons = () => {
        const existingButtons = document.querySelectorAll(
            '#upload-avatar-btn, [data-action="upload-avatar"], [onclick*="uploadProfileAvatarFromDevice"]'
        );

        existingButtons.forEach(btn => {
            if (btn.getAttribute('data-avatar-upload-bound') === '1') return;
            btn.setAttribute('data-avatar-upload-bound', '1');
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                uploadProfileAvatarFromDevice({ buttonEl: btn });
            });
        });

        const avatarImg = document.querySelector(
            '#profile-avatar-img, #user-avatar-img, [data-role="profile-avatar"]'
        );
        const targetContainer =
            document.getElementById('profile-avatar-actions') ||
            avatarImg?.parentElement ||
            null;

        if (targetContainer && !document.getElementById('auto-device-avatar-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'auto-device-avatar-btn';
            btn.className = 'btn';
            btn.textContent = '🖼️ Bild vom Gerät wählen';
            btn.style.cssText = 'margin-top: 8px; padding: 7px 12px; font-size: 11px; font-weight: 800; cursor: pointer;';
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                uploadProfileAvatarFromDevice({ buttonEl: btn });
            });
            targetContainer.appendChild(btn);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindButtons);
    } else {
        bindButtons();
    }

    const observer = new MutationObserver(() => {
        bindButtons();
    });
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
}

window.uploadProfileAvatarFromDevice = uploadProfileAvatarFromDevice;
window.initDeviceAvatarUpload = initDeviceAvatarUpload;