// js/features/profguide.js - Vollständiges Prof-Rating & Survival Guide Modul mit Moderation
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

export function openProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadProfReviews();
    }
}

export function closeProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

export function toggleProfForm() {
    const formContainer = document.getElementById('prof-review-form-container');
    if (formContainer) {
        formContainer.classList.toggle('hidden');
    }
}

/**
 * Lädt alle Prof-Bewertungen aus der Supabase-Datenbank
 */
export async function loadProfReviews() {
    const listContainer = document.getElementById('prof-reviews-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Lade Bewertungen...</p>';

    const { data: reviews, error } = await _supabase
        .from('prof_reviews')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !reviews || reviews.length === 0) {
        listContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Noch keine Bewertungen vorhanden. Sei der Erste! 🚀</p>';
        return;
    }

    listContainer.innerHTML = '';
    reviews.forEach(review => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 10px; font-size: 11px;';
        
        const stars = '⭐'.repeat(review.rating || 5);
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #818cf8; font-size: 12px;">${review.prof_name}</strong>
                <span style="background: rgba(99,102,241,0.2); color: #818cf8; padding: 2px 6px; border-radius: 6px; font-weight: 700;">${review.subject}</span>
            </div>
            <div style="display: flex; gap: 8px; color: var(--text-muted); margin-bottom: 6px;">
                <span>Bewertung: ${stars}</span>
                <span>•</span>
                <span>Schwierigkeit: ${review.difficulty}/5 ⚙️</span>
            </div>
            <p style="color: var(--text); line-height: 1.4; margin-bottom: 4px;">${review.comment}</p>
            <div style="font-size: 9px; color: var(--text-muted); text-align: right;">Von: ${review.author_email || 'Anonym'}</div>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * Sendet eine neue Prof-Bewertung an Supabase (mit Moderations-Check)
 */
export async function submitProfReview() {
    const profName = document.getElementById('prof-name-input')?.value.trim();
    const subject = document.getElementById('prof-subject-input')?.value.trim();
    const rating = parseInt(document.getElementById('prof-rating-select')?.value || '5');
    const difficulty = parseInt(document.getElementById('prof-difficulty-select')?.value || '3');
    const comment = document.getElementById('prof-comment-input')?.value.trim();

    if (!profName || !subject || !comment) {
        alert('Bitte fülle alle Pflichtfelder (Professor, Modul und Kommentar) aus.');
        return;
    }

    // Moderations-Check für Professor-Name, Fach und Kommentar
    if (!validateInputOrAlert(profName) || !validateInputOrAlert(subject) || !validateInputOrAlert(comment)) {
        return;
    }

    try {
        const { error } = await _supabase
            .from('prof_reviews')
            .insert([
                {
                    id: crypto.randomUUID(),
                    prof_name: profName,
                    subject: subject,
                    rating: rating,
                    difficulty: difficulty,
                    comment: comment,
                    author_email: state.currentUserEmail || 'student@uni.at',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        alert('Bewertung erfolgreich veröffentlicht! Du hast 15 Bonuspunkte erhalten 🚀');
        
        // Formular leeren und schließen
        document.getElementById('prof-name-input').value = '';
        document.getElementById('prof-subject-input').value = '';
        document.getElementById('prof-comment-input').value = '';
        toggleProfForm();

        // Punkte gutschreiben
        if (state.currentUserEmail) {
            const { data: userData } = await _supabase
                .from('users')
                .select('logic_score')
                .eq('email', state.currentUserEmail)
                .single();

            const currentScore = userData?.logic_score || 0;
            const newScore = currentScore + 15;

            await _supabase
                .from('users')
                .update({ logic_score: newScore })
                .eq('email', state.currentUserEmail);

            const badge = document.getElementById('score');
            if (badge && !badge.classList.contains('admin-badge')) {
                badge.textContent = `${newScore} P`;
            }
        }

        loadProfReviews();

    } catch (err) {
        console.error('Fehler beim Speichern der Bewertung:', err);
        alert('Fehler beim Speichern in der Datenbank: ' + err.message);
    }
}

/**
 * Filtert die Bewertungen live nach Suchbegriff
 */
export function filterProfReviews() {
    const query = document.getElementById('prof-search-input')?.value.toLowerCase() || '';
    const items = document.querySelectorAll('#prof-reviews-list > div');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Global für HTML-Events bereitstellen
window.openProfGuideModal = openProfGuideModal;
window.closeProfGuideModal = closeProfGuideModal;
window.toggleProfForm = toggleProfForm;
window.submitProfReview = submitProfReview;
window.filterProfReviews = filterProfReviews;