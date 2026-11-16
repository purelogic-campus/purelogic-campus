// js/features/notifications.js - Umfassende Push-Benachrichtigungen für PURE LOGIC
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

    // 1. Direktnachrichten
    _supabase
        .channel('public:direct_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_email=eq.${state.currentUserEmail}` }, payload => {
            const newMsg = payload.new;
            sendLocalNotification('Neue Direktnachricht 📬', `${newMsg.sender_email}: ${newMsg.message_text}`);
        })
        .subscribe();

    // 2. Kommentare auf eigene Beiträge
    _supabase
        .channel('public:comments')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async payload => {
            const newComment = payload.new;
            const { data: post } = await _supabase
                .from('media_posts')
                .select('author_email')
                .eq('id', newComment.post_id)
                .single();

            if (post && post.author_email === state.currentUserEmail && newComment.author_email !== state.currentUserEmail) {
                sendLocalNotification('Neuer Kommentar 💬', `${newComment.author_email} hat deinen Beitrag kommentiert.`);
            }
        })
        .subscribe();

    // 3. Likes auf eigene Beiträge
    _supabase
        .channel('public:media_posts_likes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'media_posts' }, payload => {
            const oldPost = payload.old;
            const newPost = payload.new;

            if (newPost.author_email === state.currentUserEmail) {
                const oldLikes = Array.isArray(oldPost.liked_by) ? oldPost.liked_by : [];
                const newLikes = Array.isArray(newPost.liked_by) ? newPost.liked_by : [];

                if (newLikes.length > oldLikes.length) {
                    const liker = newLikes.find(email => !oldLikes.includes(email));
                    if (liker && liker !== state.currentUserEmail) {
                        sendLocalNotification('Neues Like ❤️', `${liker} hat deinen Beitrag geliked.`);
                    }
                }
            }
        })
        .subscribe();

    // 4. Neue Campus-Drops (für alle User)
    _supabase
        .channel('public:campus_drops')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campus_drops' }, payload => {
            const drop = payload.new;
            sendLocalNotification('⚡ Neuer Campus-Drop!', `${drop.title} ist jetzt live. Hol dir deine Punkte vor Ort!`);
        })
        .subscribe();

    // 5. Neue Beiträge von gefolgten Personen
    _supabase
        .channel('public:media_posts_following')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media_posts' }, async payload => {
            const newPost = payload.new;
            if (newPost.author_email !== state.currentUserEmail) {
                // Prüfen, ob der aktuelle Nutzer dem Autor folgt
                const { data: follow } = await _supabase
                    .from('follows')
                    .select('*')
                    .eq('follower_email', state.currentUserEmail)
                    .eq('following_email', newPost.author_email)
                    .maybeSingle();

                if (follow) {
                    sendLocalNotification('Neuer Beitrag 🚀', `${newPost.author_email} hat etwas Neues im Campus-Feed gepostet.`);
                }
            }
        })
        .subscribe();
}

window.initPushNotifications = initPushNotifications;
window.sendLocalNotification = sendLocalNotification;
window.subscribeToRealtimeNotifications = subscribeToRealtimeNotifications;