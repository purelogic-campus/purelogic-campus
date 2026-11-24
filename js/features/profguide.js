// js/features/profguide.js - Vollständiges Prof-Rating & Survival Guide Modul (100% responsiv, Summary-Stats, gezielter Filter, Escape & Fokus)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let previousFocusProf = null;
let cachedReviews = [];

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureProfSummaryContainer(modal) {
    if (!modal) return null;
    const card = modal.querySelector('.container-box');
    if (!card) return null;

    let summaryEl = document.getElementById('prof-guide-summary');
    if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.id = 'prof-guide-summary';
        summaryEl.className = 'prof-summary-bar';
        const searchInput = document.getElementById('prof-search-input');
        if (searchInput && searchInput.parentElement === card) {
            card.insertBefore(summaryEl, searchInput);
        } else {
            card.appendChild(summaryEl);
        }
    }
    return summaryEl;
}

function renderProfSummary(reviews) {
    const modal = document.getElementById('prof-guide-modal');
    const summaryEl = ensureProfSummaryContainer(modal);
    if (!summaryEl) return;

    const list = Array.isArray(reviews) ? reviews : [];
    if (list.length === 0) {
        summaryEl.innerHTML = `
            <span class="campus-badge">📝 0 Reviews</span>
            <span class="campus-badge">⭐ Ø –</span>
            <span class="campus-badge">⚙️ Ø –</span>
        `;
        return;
    }

    const total = list.length;
    const avgRating = (
        list.reduce((acc, r) => acc + (parseFloat(r.rating) || 0), 0) / total
    ).toFixed(1);
    const avgDifficulty = (
        list.reduce((acc, r) => acc + (parseFloat(r.difficulty) || 0), 0) / total
    ).toFixed(1);

    summaryEl.innerHTML = `
        <span class="campus-badge accent">📝 ${total} ${total === 1 ? 'Review' : 'Reviews'}</span>
        <span class="campus-badge success">⭐ Ø ${avgRating}/5</span>
        <span class="campus-badge warning">⚙️ Schwierigkeit Ø ${avgDifficulty}/5</span>
    `;
}

export function syncProfGuideResponsiveLayout() {
    const modal = document.getElementById('prof-guide-modal');
    if (!modal) return;

    modal.classList.add('prof-guide-modal-responsive');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const card = modal.querySelector('.container-box');
    if (card) {
        card.classList.add('prof-guide-card');
    }

    ensureProfSummaryContainer(modal);

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
    if (!modal) return;

    previousFocusProf = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    syncProfGuideResponsiveLayout();
    modal.classList.remove('hidden');

    const searchInput = document.getElementById('prof-search-input');
    if (searchInput) {
        requestAnimationFrame(() => searchInput.focus());
    }

    loadProfReviews();
}

export function closeProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    if (previousFocusProf && previousFocusProf.isConnected) {
        previousFocusProf.focus();
    }
    previousFocusProf = null;
}

export function toggleProfForm() {
    syncProfGuideResponsiveLayout();
    const formContainer = document.getElementById('prof-review-form-container');
    if (!formContainer) return;

    const willShow = formContainer.classList.contains('hidden');
    formContainer.classList.toggle('hidden');

    if (willShow) {
        const nameInput = document.getElementById('prof-name-input');
        if (nameInput) {
            requestAnimationFrame(() => nameInput.focus());
        }
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
        cachedReviews = [];
        renderProfSummary([]);
        listContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Noch keine Bewertungen vorhanden. Sei der Erste! 🚀</p>';
        return;
    }

    cachedReviews = reviews;
    renderProfSummary(reviews);

    listContainer.innerHTML = '';
    reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'prof-review-item';
        item.dataset.profName = String(review.prof_name || '').toLowerCase();
        item.dataset.subject = String(review.subject || '').toLowerCase();
        item.dataset.comment = String(review.comment || '').toLowerCase();

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
 * Filtert die Bewertungen gezielt nach Professor, Modul oder Kommentar
 */
export function filterProfReviews() {
    const query = (document.getElementById('prof-search-input')?.value || '').trim().toLowerCase();
    const listContainer = document.getElementById('prof-reviews-list');
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.prof-review-item');
    let visibleCount = 0;

    items.forEach(item => {
        const searchable = [
            item.dataset.profName || '',
            item.dataset.subject || '',
            item.dataset.comment || ''
        ].join(' ');

        if (!query || searchable.includes(query)) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    let emptyFilterEl = document.getElementById('prof-filter-empty-msg');
    if (items.length > 0 && visibleCount === 0) {
        if (!emptyFilterEl) {
            emptyFilterEl = document.createElement('p');
            emptyFilterEl.id = 'prof-filter-empty-msg';
            emptyFilterEl.style.cssText = 'font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px;';
            listContainer.appendChild(emptyFilterEl);
        }
        emptyFilterEl.textContent = `Keine passenden Bewertungen für „${document.getElementById('prof-search-input')?.value.trim() || ''}“ gefunden.`;
    } else if (emptyFilterEl) {
        emptyFilterEl.remove();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modal = document.getElementById('prof-guide-modal');
    if (modal && !modal.classList.contains('hidden')) {
        closeProfGuideModal();
    }
});

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