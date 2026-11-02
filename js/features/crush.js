// js/features/crush.js - Anonymes Crush-Radar & Blind-Date-Mittwoch Modul
import { _supabase } from '../config.js';
import { state } from '../state.js';

export function openCrushModal() {
    const modal = document.getElementById('crush-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadCrushMatches();
    }
}

export function closeCrushModal() {
    const modal = document.getElementById('crush-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export async function submitCrush() {
    const targetInput = document.getElementById('crush-target-input')?.value.trim();
    const hintInput = document.getElementById('crush-hint-input')?.value.trim();

    if (!targetInput) {
        alert('Bitte gib den Crush (E-Mail oder @handle) an!');
        return;
    }

    if (!state.currentUserEmail) {
        alert('Du musst eingeloggt sein, um das Crush-Radar zu nutzen.');
        return;
    }

    try {
        const { error } = await _supabase
            .from('crushes')
            .insert([
                {
                    id: crypto.randomUUID(),
                    sender_email: state.currentUserEmail,
                    target_identifier: targetInput,
                    hint: hintInput || '',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        alert('Dein Crush wurde anonym eingetragen! Bei einem gegenseitigen Match wirst du benachrichtigt 💘');
        document.getElementById('crush-target-input').value = '';
        document.getElementById('crush-hint-input').value = '';
        
        // Prüfen auf gegenseitiges Match
        checkCrushMatch(targetInput);
        loadCrushMatches();

    } catch (err) {
        console.error('Fehler beim Speichern des Crushes:', err);
        alert('Fehler beim Eintragen: ' + err.message);
    }
}

export async function checkCrushMatch(targetIdentifier) {
    try {
        const { data: reverseCrushes, error } = await _supabase
            .from('crushes')
            .select('*')
            .eq('sender_email', targetIdentifier)
            .ilike('target_identifier', `%${state.currentUserEmail}%`);

        if (!error && reverseCrushes && reverseCrushes.length > 0) {
            alert('🎉 IT\'S A MATCH! Jemand auf dem Campus erwidert deinen Crush! Schau in dein Postfach 💌');
        }
    } catch (err) {
        console.error('Fehler bei Match-Prüfung:', err);
    }
}

export async function loadCrushMatches() {
    const box = document.getElementById('crush-matches-box');
    if (!box) return;

    box.innerHTML = '<p style="color: var(--text-muted); font-size: 11px;">Suche nach anonymen Hinweisen...</p>';

    try {
        const { data: crushes, error } = await _supabase
            .from('crushes')
            .select('*')
            .ilike('target_identifier', `%${state.currentUserEmail}%`);

        if (error || !crushes || crushes.length === 0) {
            box.innerHTML = '<p style="color: var(--text-muted); font-size: 11px;">Bisher noch keine anonymen Hinweise für dich eingegangen. Bleib wachsam! 👀</p>';
            return;
        }

        box.innerHTML = '<strong style="color: var(--accent); font-size: 11px; display: block; margin-bottom: 4px;">💘 Hinweise für dich:</strong>';
        crushes.forEach(c => {
            const item = document.createElement('div');
            item.style.cssText = 'background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.3); border-radius: 8px; padding: 6px 8px; margin-bottom: 4px; font-size: 11px;';
            item.innerHTML = `<div>Hinweis: "${c.hint || 'Kein Hinweis angegeben'}"</div>`;
            box.appendChild(item);
        });
    } catch (err) {
        console.error('Fehler beim Laden der Hinweise:', err);
    }
}

window.openCrushModal = openCrushModal;
window.closeCrushModal = closeCrushModal;
window.submitCrush = submitCrush;