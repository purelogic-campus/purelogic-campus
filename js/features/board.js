// js/features/board.js - Schwarzes Brett & Marktplatz für PURE LOGIC
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

export async function openBlackboardModal() {
    const modal = document.getElementById('blackboard-modal') || createBlackboardModal();
    modal.classList.remove('hidden');
    await loadBlackboardPosts();
}

export function closeBlackboardModal() {
    const modal = document.getElementById('blackboard-modal');
    if (modal) modal.classList.add('hidden');
}

function createBlackboardModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'blackboard-modal';
    modalDiv.className = 'hidden';
    modalDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);';
    modalDiv.innerHTML = `
        <div style="background: var(--card); border: 1px solid var(--border); width: 92%; max-width: 500px; height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 16px; font-weight: 900; color: #fff; margin: 0;">📌 Schwarzes Brett & Marktplatz</h3>
                <button onclick="closeBlackboardModal()" style="background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer;">✕</button>
            </div>
            
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); display: flex; flex-direction: column; gap: 8px;">
                <h4 style="font-size: 12px; font-weight: 800; color: #818cf8; margin: 0;">+ Neuen Eintrag erstellen</h4>
                <input type="text" id="board-title-input" placeholder="Titel (z. B. Suche WG-Zimmer in 8. Bezirk)" style="font-size: 11px; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 8px; color: #fff;">
                <div style="display: flex; gap: 6px;">
                    <select id="board-category-select" style="flex: 1; font-size: 11px; padding: 8px; background: var(--card); color: #fff; border: 1px solid var(--border); border-radius: 8px;">
                        <option value="WG & Wohnen">🏠 WG & Wohnen</option>
                        <option value="Lernpartner">📚 Lernpartner</option>
                        <option value="Bücher & Skripten">📖 Bücher & Skripten</option>
                        <option value="Jobs & Sonstiges">💼 Jobs & Sonstiges</option>
                    </select>
                </div>
                <textarea id="board-desc-input" rows="2" placeholder="Beschreibung, Details und Kontaktinfos..." style="font-size: 11px; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 8px; color: #fff; resize: none;"></textarea>
                <button onclick="window.submitBlackboardPost()" class="btn" style="padding: 8px; font-size: 11px; font-weight: 800; background: var(--gradient-main);">Eintrag veröffentlichen 🚀</button>
            </div>

            <div id="board-posts-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                <p style="color: var(--text-muted); font-size: 12px; text-align: center;">Lade Anzeigen...</p>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    return modalDiv;
}

export async function loadBlackboardPosts() {
    const container = document.getElementById('board-posts-container');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center;">Lade Anzeigen...</p>';

    try {
        const { data: posts, error } = await _supabase
            .from('blackboard_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !posts || posts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">Noch keine Anzeigen am Schwarzen Brett. Erstelle den ersten Eintrag! 📌</p>';
            return;
        }

        container.innerHTML = '';

        for (const post of posts) {
            let authorName = post.author_email.split('@')[0];
            let authorAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

            try {
                const { data: userData } = await _supabase
                    .from('users')
                    .select('full_name, username, avatar_url')
                    .eq('email', post.author_email)
                    .maybeSingle();

                if (userData) {
                    authorName = userData.full_name || userData.username || authorName;
                    if (userData.avatar_url) authorAvatar = userData.avatar_url;
                }
            } catch (e) {}

            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; font-weight: 800; background: rgba(99,102,241,0.2); color: #818cf8; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(99,102,241,0.3);">${post.category}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">${new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <h4 style="font-size: 13px; font-weight: 800; color: #fff; margin: 0;">${post.title}</h4>
                <p style="font-size: 12px; color: var(--text-muted); margin: 0; word-break: break-word; line-height: 1.4;">${post.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; cursor: pointer;" onclick="window.openPublicProfile('${post.author_email}')">
                        <img src="${authorAvatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary);">
                        <span style="font-size: 11px; font-weight: 700; color: #fff;">${authorName}</span>
                    </div>
                    ${state.currentUserEmail && state.currentUserEmail !== post.author_email ? `
                    <button onclick="window.openDirectMessageWith('${post.author_email}')" class="btn" style="width: auto; padding: 4px 10px; font-size: 10px; font-weight: 800; background: var(--gradient-main); margin-top: 0;">Nachricht senden 💬</button>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        }
    } catch (err) {
        console.error('Fehler beim Laden des Schwarzen Bretts:', err);
        container.innerHTML = '<p style="color: #ef4444; font-size: 12px; text-align: center; padding: 20px;">Fehler beim Laden der Anzeigen.</p>';
    }
}

window.submitBlackboardPost = async function() {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um eine Anzeige aufzugeben.');
        return;
    }

    const titleInput = document.getElementById('board-title-input');
    const descInput = document.getElementById('board-desc-input');
    const categorySelect = document.getElementById('board-category-select');

    if (!titleInput || !descInput || !categorySelect) return;

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const category = categorySelect.value;

    if (!title || !description) {
        alert('Bitte Titel und Beschreibung ausfüllen.');
        return;
    }

    if (!validateInputOrAlert(title + ' ' + description)) {
        return;
    }

    try {
        const { error } = await _supabase
            .from('blackboard_posts')
            .insert([
                {
                    id: crypto.randomUUID(),
                    author_email: state.currentUserEmail,
                    title: title,
                    description: description,
                    category: category,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        titleInput.value = '';
        descInput.value = '';
        alert('Anzeige erfolgreich am Schwarzen Brett veröffentlicht! 📌');
        await loadBlackboardPosts();

    } catch (err) {
        alert('Fehler beim Veröffentlichen: ' + err.message);
    }
};

window.openBlackboardModal = openBlackboardModal;
window.closeBlackboardModal = closeBlackboardModal;