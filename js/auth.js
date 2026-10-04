// js/auth.js
import { SUPABASE_URL } from './config.js';

// Beispiel für Passwort-Zurücksetzen (aus deinem Code)
export async function handleForgotPassword() {
    const email = document.getElementById('email')?.value.trim().toLowerCase();
    if (!email) {
        alert('Bitte E-Mail eingeben.');
        return;
    }
    try {
        // Falls _supabase global ist oder importiert werden muss:
        await _supabase.auth.resetPasswordForEmail(email);
        alert('E-Mail zum Zurücksetzen gesendet!');
    } catch (error) {
        console.error('Fehler:', error);
    }
}

// Hier kannst du Schritt für Schritt weitere Auth-Funktionen aus deiner app.js hineinkopieren