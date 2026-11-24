// js/features/crush.js - Anonymes Crush Radar für PURE LOGIC (mit responsiver Layout-Steuerung)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function syncCrushResponsiveLayout() {
    const modal = document.getElementById('crush-modal');
    if (!modal) return;

    modal.classList.add('crush-modal-responsive');
    const card = modal.querySelector('.container-box');
    if (card) {
        card.classList.add('crush-modal-card');
    }

    const isMobile = window.innerWidth < 768;
    modal.dataset.viewportMode = isMobile ? 'mobile' : 'desktop';
}

export function openCrushModal() {
    const modal = document.getElementById('crush-modal');
    if (modal) {
        syncCrushResponsiveLayout();
        modal.classList.remove('hidden');
        checkCrushMatches();
    }
}

export function closeCrushModal() {
    const modal = document.getElementById('crush-modal');
    if (modal) modal.classList.add('hidden');
}

export async function submitCrush() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um das Crush-Radar zu nutzen.');
        return;
    }

    const targetInput = document.getElementById('crush-target-input');
    const hintInput = document.getElementById('crush-hint-input');

    if (!targetInput) return;

    const target = targetInput.value.trim().toLowerCase();
    const hint = hintInput ? hintInput.value.trim() : '';

    if (!target) {
        alert('Bitte gib eine E-Mail oder ein @handle deines Crushes ein.');
        return;
    }

    if (target === state.currentUserEmail.toLowerCase()) {
        alert('Du kannst dich nicht selbst als Crush eintragen! 😉');
        return;
    }

    if (hint && !validateInputOrAlert(hint)) {
        return;
    }

    try {
        const { error } = await _supabase
            .from('crushes')
            .insert([
                {
                    id: crypto.randomUUID(),
                    sender_email: state.currentUserEmail.toLowerCase(),
                    target_identifier: target,
                    secret_hint: hint,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        targetInput.value = '';
        if (hintInput) hintInput.value = '';

        alert('Crush erfolgreich im Radar gespeichert! 💘 Wenn die Person dich auch einträgt, gibt es ein Match.');
        checkCrushMatches();

    } catch (err) {
        console.error('Fehler beim Speichern des Crushes:', err);
        alert('Fehler beim Abschicken: ' + err.message);
    }
}

export async function checkCrushMatches() {
    const matchesBox = document.getElementById('crush-matches-box');
    if (!matchesBox || !state.currentUserEmail) return;

    syncCrushResponsiveLayout();

    const myEmail = state.currentUserEmail.toLowerCase();
    const myHandle = state.currentUserUsername ? `@${state.currentUserUsername.toLowerCase()}` : '';

    matchesBox.innerHTML = '<p style="color: var(--text-muted);">Suche nach Matches im Radar...</p>';

    try {
        const { data: allCrushes, error } = await _supabase
            .from('crushes')
            .select('*');

        if (error) throw error;

        if (!allCrushes) {
            matchesBox.innerHTML = '<p style="color: var(--text-muted);">Noch keine Matches gefunden. Bleib dran! ✨</p>';
            return;
        }

        const myCrushes = allCrushes.filter(c => (c.sender_email || '').toLowerCase() === myEmail);

        const whoCrushedMe = allCrushes.filter(c => {
            const target = (c.target_identifier || '').toLowerCase();
            return target === myEmail || (myHandle && target === myHandle);
        });

        let matches = [];
        myCrushes.forEach(mine => {
            const target = (mine.target_identifier || '').toLowerCase();
            const matchFound = whoCrushedMe.find(theirs => (theirs.sender_email || '').toLowerCase() === target);
            if (matchFound && !matches.includes(matchFound.sender_email)) {
                matches.push(matchFound.sender_email);
            }
        });

        const hintsForMe = whoCrushedMe
            .map(c => String(c.secret_hint || '').trim())
            .filter(Boolean);

        const hintBannerHtml = hintsForMe.length > 0
            ? `<div class="crush-hints-box">
                <div class="crush-hints-title">🕵️ Geheime Hinweise für dich (${hintsForMe.length}):</div>
                <ul class="crush-hints-list">
                    ${hintsForMe.map(h => `<li>„${escapeHtml(h)}“</li>`).join('')}
                </ul>
               </div>`
            : '';

        if (matches.length > 0) {
            const safeFirstMatchAttr = escapeAttr(matches[0]);
            const safeMatchesText = escapeHtml(matches.join(', '));
            matchesBox.innerHTML = `
                <div class="crush-match-card">
                    <div class="crush-match-title">💖 IT'S A MATCH!</div>
                    <p class="crush-match-text">Du hast ein gegenseitiges Crush-Match mit: <strong>${safeMatchesText}</strong></p>
                    <button type="button" onclick="window.openDirectMessageWith('${safeFirstMatchAttr}')" class="btn crush-match-btn">Jetzt Nachricht schreiben 💬</button>
                </div>
                ${hintBannerHtml}
            `;
        } else {
            matchesBox.innerHTML = `
                <p style="color: var(--text-muted); text-align: center; line-height: 1.45;">
                    Bisher noch kein gegenseitiges Match (${whoCrushedMe.length} Personen haben dich im Radar). Trage weitere Crushes ein! 💫
                </p>
                ${hintBannerHtml}
            `;
        }

    } catch (err) {
        console.error('Fehler beim Prüfen der Matches:', err);
        matchesBox.innerHTML = '<p style="color: #ef4444;">Fehler beim Laden der Matches.</p>';
    }
}

window.addEventListener('resize', () => {
    const modal = document.getElementById('crush-modal');
    if (modal && !modal.classList.contains('hidden')) {
        syncCrushResponsiveLayout();
    }
});

window.openCrushModal = openCrushModal;
window.closeCrushModal = closeCrushModal;
window.submitCrush = submitCrush;
window.checkCrushMatches = checkCrushMatches;
window.syncCrushResponsiveLayout = syncCrushResponsiveLayout;