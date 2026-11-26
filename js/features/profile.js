// js/features/profile.js - Eigenes Profil-Modul mit direkter Anbindung der lokalen Activity-Historie (Punkt 27)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import {
    renderActivityHistoryFeed,
    initRealtimePushListeners,
    updatePushStatusUi,
    requestPushPermission
} from './notifications.js';

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, ''');
}

function getProfileHostContainer() {
    return (
        document.getElementById('tab-profile') ||
        document.getElementById('profile-section') ||
        document.getElementById('profile-view') ||
        document.querySelector('[data-profile-view]') ||
        null
    );
}

export function mountProfileActivityFeed() {
    const profileHost = getProfileHostContainer();
    let feedContainer = document.getElementById('profile-activity-feed');

    if (!feedContainer && profileHost) {
        feedContainer = document.createElement('section');
        feedContainer.id = 'profile-activity-feed';
        feedContainer.setAttribute('aria-label', 'Lokale Benachrichtigungs-Historie');
        feedContainer.style.cssText = 'margin-top: 16px; width: 100%; box-sizing: border-box;';
        profileHost.appendChild(feedContainer);
    }

    if (feedContainer) {
        renderActivityHistoryFeed(feedContainer);
    }

    updatePushStatusUi();
}

export async function loadProfileData(targetEmail = '') {
    const email = (targetEmail || state.currentUserEmail || '').trim();
    const profileHost = getProfileHostContainer();

    mountProfileActivityFeed();

    if (!email) {
        const nameEl = document.getElementById('profile-display-name');
        const emailEl = document.getElementById('profile-email-display');
        if (nameEl) nameEl.textContent = 'Gast';
        if (emailEl) emailEl.textContent = 'Nicht eingeloggt';
        return null;
    }

    initRealtimePushListeners(email);

    try {
        const { data: userRow, error } = await _supabase
            .from('users')
            .select('email, full_name, username, university, bio, avatar_url, logic_score')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.warn('Profil konnte nicht aus Supabase geladen werden:', error);
            return null;
        }

        const displayName =
            userRow?.full_name ||
            userRow?.username ||
            email.split('@')[0];

        const nameEl = document.getElementById('profile-display-name');
        if (nameEl) nameEl.textContent = displayName;

        const handleEl = document.getElementById('profile-username-display');
        if (handleEl) {
            handleEl.textContent = userRow?.username ? `@${userRow.username}` : `@${email.split('@')[0]}`;
        }

        const emailEl = document.getElementById('profile-email-display');
        if (emailEl) emailEl.textContent = email;

        const uniEl = document.getElementById('profile-university-display');
        if (uniEl && userRow?.university) uniEl.textContent = userRow.university;

        const bioEl = document.getElementById('profile-bio-display');
        if (bioEl) bioEl.textContent = userRow?.bio || 'Noch keine Bio hinterlegt.';

        const scoreEl = document.getElementById('profile-score-display');
        if (scoreEl && typeof userRow?.logic_score === 'number') {
            scoreEl.textContent = `${userRow.logic_score} P`;
        }

        const avatarEl = document.getElementById('profile-avatar-img');
        if (avatarEl && userRow?.avatar_url) {
            avatarEl.src = userRow.avatar_url;
        }

        if (profileHost && !document.getElementById('profile-push-controls')) {
            const controlsDiv = document.createElement('div');
            controlsDiv.id = 'profile-push-controls';
            controlsDiv.style.cssText = 'margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;';
            controlsDiv.innerHTML = `
                <button id="push-permission-btn" type="button" onclick="requestPushPermission()" style="background: rgba(99, 102, 241, 0.22); border: 1px solid rgba(129, 140, 248, 0.45); color: #f8fafc; border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer;">
                    🔔 Push aktivieren
                </button>
                <span style="font-size: 11px; color: #94a3b8;">Konto: ${escapeHtml(email)}</span>
            `;
            const feedSection = document.getElementById('profile-activity-feed');
            if (feedSection && feedSection.parentElement === profileHost) {
                profileHost.insertBefore(controlsDiv, feedSection);
            } else {
                profileHost.appendChild(controlsDiv);
            }
            updatePushStatusUi();
        }

        mountProfileActivityFeed();
        return userRow || null;
    } catch (err) {
        console.warn('Fehler beim Laden des Profils:', err);
        mountProfileActivityFeed();
        return null;
    }
}

export async function openProfileView(targetEmail = '') {
    const profileHost = getProfileHostContainer();
    if (profileHost) {
        profileHost.classList.remove('hidden');
    }
    await loadProfileData(targetEmail);
}

document.addEventListener('DOMContentLoaded', () => {
    mountProfileActivityFeed();
    if (state.currentUserEmail) {
        loadProfileData(state.currentUserEmail);
    }
});

document.addEventListener('click', (event) => {
    const clickedProfileTrigger = event.target instanceof Element
        ? event.target.closest('[data-tab="profile"], [onclick*="profile"], [onclick*="Profile"], #nav-profile, #profile-btn')
        : null;

    if (clickedProfileTrigger) {
        requestAnimationFrame(() => {
            mountProfileActivityFeed();
            if (state.currentUserEmail) {
                loadProfileData(state.currentUserEmail);
            }
        });
    }
});

window.mountProfileActivityFeed = mountProfileActivityFeed;
window.loadProfileData = loadProfileData;
window.openProfileView = openProfileView;