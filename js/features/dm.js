// js/features/dm.js - Direct Messaging (DM) Modul für PURE LOGIC
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

let activeRecipientEmail = null;

/**
 * Öffnet das Postfach für eine bestimmte Empfänger-E-Mail
 */
export function openDirectMessageWith(recipientEmail) {
    if (!state.currentUserEmail) {
        alert('Bitte logge dich ein, um Direktnachrichten zu schreiben.');
        return;
    }
    
    if (recipientEmail === state.currentUserEmail) {
        alert('Du kannst dir nicht selbst Nachrichten schreiben.');
        return;
    }

    activeRecipientEmail = recipientEmail;
    
    // Zum Postfach-Tab wechseln
    if (typeof window.switchTab === 'function') {
        window.switchTab('inbox');
    }

    const recipientInput = document.getElementById('dm-recipient');
    if (recipientInput) {
        recipientInput.value = recipientEmail;
    }

    loadDirectMessages();
}

/**
 * Lädt die Direktnachrichten zwischen dem aktuellen Nutzer und dem Empfänger
 */
export async function loadDirectMessages() {
    const recipientInput = document.getElementById('dm-recipient');
    const chatList = document.getElementById('dm-chat-list');
    
    if (!recipientInput || !chatList) return;

    const recipientEmail = recipientInput.value.trim().toLowerCase();
    activeRecipientEmail = recipientEmail;

    if (!recipientEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Gib oben eine E-Mail ein, um zu schreiben.</p>';
        return;
    }

    if (!state.currentUserEmail) {
        chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Bitte logge dich ein.</p>';
        return;
    }

    chatList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Lade Nachrichten...</p>';

    try {
        const { data: messages, error } = await _supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_email.eq.${state.currentUserEmail},recipient_email.eq.${recipientEmail}),and(sender_email.eq.${recipientEmail},recipient_email.eq.${state.currentUserEmail})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            chatList.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align:center; padding: 20px;">Noch keine Nachrichten mit ${recipientEmail}. Starte die Konversation! 💬</p>`;
            return;
        }

        chatList.innerHTML = '';
        messages.forEach(msg => {
            const isMe = msg.sender_email.toLowerCase() === state.currentUserEmail.toLowerCase();
            const bubble = document.createElement('div');
            
            bubble.style.cssText = `
                max-width: 75%;
                padding: 10px 14px;
                border-radius: 14px;
                font-size: 12px;
                line-height: 1.4;
                word-break: break-word;
                align-self: ${isMe ? 'flex-end' : 'flex-start'};
                background: ${isMe ? 'var(--primary)' : 'var(--card)'};
                color: #fff;
                border: 1px solid ${isMe ? 'transparent' : 'var(--border)'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                margin-bottom: 4px;
            `;
            
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            bubble.innerHTML = `
                <div>${msg.message_text}</div>
                <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 2px;">${timeStr}</div>
            `;
            chatList.appendChild(bubble);
        });

        chatList.scrollTop = chatList.scrollHeight;

    } catch (err) {
        console.error('Fehler beim Laden der DMs:', err);
        chatList.innerHTML = '<p style="color: #ef4444; font-size: 12px; text-align:center; padding: 20px;">Fehler beim Laden der Nachrichten.</p>';
    }
}

/**
 * Sendet eine Direktnachricht an den Empfänger (inkl. Moderations-Check)
 */
export async function sendDirectMessage() {
    const recipientInput = document.getElementById('dm-recipient');
    const input = document.getElementById('dm-input');

    if (!recipientInput || !input) return;

    const recipientEmail = recipientInput.value.trim().toLowerCase();
    const text = input.value.trim();

    if (!recipientEmail) {
        alert('Bitte gib zuerst eine Empfänger-E-Mail ein.');
        return;
    }

    if (!text) return;

    if (!validateInputOrAlert(text)) {
        return;
    }

    if (!state.currentUserEmail) {
        alert('Du musst eingeloggt sein.');
        return;
    }

    try {
        const { error } = await _supabase
            .from('direct_messages')
            .insert([
                {
                    id: crypto.randomUUID(),
                    sender_email: state.currentUserEmail,
                    recipient_email: recipientEmail,
                    message_text: text,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        input.value = '';
        loadDirectMessages();

    } catch (err) {
        console.error('Fehler beim Senden der DM:', err);
        alert('Fehler beim Senden: ' + err.message);
    }
}

// Global für HTML-Events verfügbar machen
window.openDirectMessageWith = openDirectMessageWith;
window.loadDirectMessages = loadDirectMessages;
window.sendDirectMessage = sendDirectMessage;