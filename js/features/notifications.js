import { _supabase } from '../config.js';
import { state } from '../state.js';

export async function initPushNotifications() {
    if (!('Notification' in window)) {
        console.warn('Dieses Gerät unterstützt keine Push-Benachrichtigungen.');
        return;
    }

    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Push-Benachrichtigungen erlaubt!');
        }
    }
}

export function sendLocalNotification(title, body) {
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: 'icons/icon-192.png'
            });
        } catch (e) {
            console.warn('Fehler beim Senden der Benachrichtigung:', e);
        }
    }
}

export function subscribeToRealtimeNotifications() {
    if (!state.currentUserEmail) return;

    _supabase
        .channel('public:direct_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_email=eq.${state.currentUserEmail}` }, payload => {
            const newMsg = payload.new;
            sendLocalNotification('Neue Direktnachricht', `${newMsg.sender_email}: ${newMsg.message_text}`);
        })
        .subscribe();
}

window.initPushNotifications = initPushNotifications;
window.sendLocalNotification = sendLocalNotification;
window.subscribeToRealtimeNotifications = subscribeToRealtimeNotifications;