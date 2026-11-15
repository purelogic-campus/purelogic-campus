// js/features/crush.js - Anonymes Crush Radar für PURE LOGIC
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

export function openCrushModal() {
    const modal = document.getElementById('crush-modal');
    if (modal) {
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

    const myEmail = state.currentUserEmail.toLowerCase();
    const myHandle = state.currentUserUsername ? `@${state.currentUserUsername.toLowerCase()}` : '';

    matchesBox.innerHTML = '<p style="color: var(--text-muted);">Suche nach Matches im Radar...</p>';

    try {
        // Alle Einträge holen, wo ich der Absender bin oder der Ziel-Identifier bin
        const { data: allCrushes, error } = await _supabase
            .from('crushes')
            .select('*');

        if (error) throw error;

        if (!allCrushes) {
            matchesBox.innerHTML = '<p style="color: var(--text-muted);">Noch keine Matches gefunden. Bleib dran! ✨</p>';
            return;
        }

        // Finde heraus, wen ich gecrasht habe
        const myCrushes = allCrushes.filter(c => c.sender_email.toLowerCase() === myEmail);
        
        // Finde heraus, wer mich gecrasht hat (entweder per E-Mail oder Handle)
        const whoCrushedMe = allCrushes.filter(c => {
            const target = c.target_identifier.toLowerCase();
            return target === myEmail || (myHandle && target === myHandle);
        });

        // Prüfe auf Gegenseitigkeit (Match)
        let matches = [];
        myCrushes.forEach(mine => {
            const target = mine.target_identifier.toLowerCase();
            const matchFound = whoCrushedMe.find(theirs => theirs.sender_email.toLowerCase() === target);
            if (matchFound) {
                matches.push(matchFound.sender_email);
            }
        });

        if (matches.length > 0) {
            matchesBox.innerHTML = `
                <div style="background: rgba(236,72,153,0.15); border: 1px solid var(--accent); padding: 10px; border-radius: 10px;">
                    <div style="font-weight: 800; color: var(--accent); margin-bottom: 4px;">💖 IT'S A MATCH!</div>
                    <p style="color: #fff; margin-bottom: 6px;">Du hast ein gegenseitiges Crush-Match mit: <strong>${matches.join(', ')}</strong></p>
                    <button onclick="window.openDirectMessageWith('${matches[0]}')" class="btn" style="margin-top:0; padding: 6px; font-size: 11px;">Jetzt Nachricht schreiben 💬</button>
                </div>
            `;
        } else {
            matchesBox.innerHTML = `
                <p style="color: var(--text-muted); text-align: center;">
                    Bisher noch kein gegenseitiges Match (${whoCrushedMe.length} Personen haben dich im Radar). Trage weitere Crushes ein! 💫
                </p>
            `;
        }

    } catch (err) {
        console.error('Fehler beim Prüfen der Matches:', err);
        matchesBox.innerHTML = '<p style="color: #ef4444;">Fehler beim Laden der Matches.</p>';
    }
}

window.openCrushModal = openCrushModal;
window.closeCrushModal = closeCrushModal;
window.submitCrush = submitCrush;
window.checkCrushMatches = checkCrushMatches;