// js/features/profguide.js - Vollständiges Prof-Rating & Survival Guide Modul mit Moderation & responsivem Layout
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

export function syncProfGuideResponsiveLayout() {
    const modal = document.getElementById('prof-guide-modal');
    if (!modal) return;

    modal.classList.add('prof-guide-modal-responsive');
    const card = modal.querySelector('.container-box');
    if (card) {
        card.classList.add('prof-guide-card');
    }

    const formContainer = document.getElementById('prof-review-form-container');
    if (formContainer) {
        formContainer.classList.add('prof-form-card');
        const metaRow = formContainer.querySelector('div[style*="display: flex"]');
        if (metaRow) {
            metaRow.classList.add('prof-form-meta-row');
        }
        const actionRow = formContainer.querySelector('div:last-child');
        if (actionRow && actionRow !== metaRow) {
            actionRow.classList.add('prof-form-actions');
        }
    }

    const isMobile = window.innerWidth < 768;
    modal.dataset.viewportMode = isMobile ? 'mobile' : 'desktop';
}

export function openProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        syncProfGuideResponsiveLayout();
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
    syncProfGuideResponsiveLayout();
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

    syncProfGuideResponsiveLayout();
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
        item.className = 'prof-review-item';

        const safeRating = Math.max(1, Math.min(5, parseInt(review.rating || 5, 10) || 5));
        const safeDifficulty = Math.max(1, Math.min(5, parseInt(review.difficulty || 3, 10) || 3));
        const stars = '⭐'.repeat(safeRating);

        item.innerHTML = `
            <div class="prof-review-header">
                <strong class="prof-review-name">${escapeHtml(review.prof_name)}</strong>
                <span class="prof-review-subject">${escapeHtml(review.subject)}</span>
            </div>
            <div class="prof-review-meta">
                <span>Bewertung: ${stars}</span>
                <span class="prof-meta-sep">•</span>
                <span>Schwierigkeit: ${safeDifficulty}/5 ⚙️</span>
            </div>
            <p class="prof-review-comment">${escapeHtml(review.comment)}</p>
            <div class="prof-review-author">Von: ${escapeHtml(review.author_email || 'Anonym')}</div>
        `;
        listContainer.appendChild(item);
    });

    filterProfReviews();
}

/**
 * Sendet eine neue Prof-Bewertung an Supabase (mit Moderations-Check)
 */
export async function submitProfReview() {
    const profName = document.getElementById('prof-name-input')?.value.trim();
    const subject = document.getElementById('prof-subject-input')?.value.trim();
    const rating = parseInt(document.getElementById('prof-rating-select')?.value || '5', 10);
    const difficulty = parseInt(document.getElementById('prof-difficulty-select')?.value || '3', 10);
    const comment = document.getElementById('prof-comment-input')?.value.trim();

    if (!profName || !subject || !comment) {
        alert('Bitte fülle alle Pflichtfelder (Professor, Modul und Kommentar) aus.');
        return;
    }

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

        document.getElementById('prof-name-input').value = '';
        document.getElementById('prof-subject-input').value = '';
        document.getElementById('prof-comment-input').value = '';
        toggleProfForm();

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
    const query = (document.getElementById('prof-search-input')?.value || '').trim().toLowerCase();
    const items = document.querySelectorAll('#prof-reviews-list .prof-review-item, #prof-reviews-list > div');

    items.forEach(item => {
        if (!item.classList.contains('prof-review-item')) return;
        const text = (item.textContent || '').toLowerCase();
        if (!query || text.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

window.addEventListener('resize', () => {
    const modal = document.getElementById('prof-guide-modal');
    if (modal && !modal.classList.contains('hidden')) {
        syncProfGuideResponsiveLayout();
    }
});

// Global für HTML-Events bereitstellen
window.openProfGuideModal = openProfGuideModal;
window.closeProfGuideModal = closeProfGuideModal;
window.toggleProfForm = toggleProfForm;
window.submitProfReview = submitProfReview;
window.filterProfReviews = filterProfReviews;
window.syncProfGuideResponsiveLayout = syncProfGuideResponsiveLayout;