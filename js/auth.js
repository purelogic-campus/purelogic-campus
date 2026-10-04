// js/auth.js
import { SUPABASE_URL } from './config.js';

export async function handleLogin() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const msgBox = document.getElementById('auth-msg');

    if (!email || !password) {
        if (msgBox) {
            msgBox.textContent = 'Bitte E-Mail und Passwort eingeben.';
            msgBox.classList.remove('hidden');
        }
        return;
    }

    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log('Erfolgreich eingeloggt:', data);
        location.reload(); // Seite neu laden, um die App-Ansicht zu aktivieren
    } catch (error) {
        console.error('Login-Fehler:', error.message);
        if (msgBox) {
            msgBox.textContent = 'Fehler: ' + error.message;
            msgBox.classList.remove('hidden');
        }
    }
}

export async function handleSignup() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const msgBox = document.getElementById('auth-msg');

    if (!email || !password) {
        if (msgBox) {
            msgBox.textContent = 'Bitte E-Mail und Passwort eingeben.';
            msgBox.classList.remove('hidden');
        }
        return;
    }

    try {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Account erstellt! Bitte E-Mail bestätigen oder direkt einloggen.');
    } catch (error) {
        console.error('Signup-Fehler:', error.message);
        if (msgBox) {
            msgBox.textContent = 'Fehler: ' + error.message;
            msgBox.classList.remove('hidden');
        }
    }
}

export async function resetUser() {
    try {
        await _supabase.auth.signOut();
        location.reload();
    } catch (error) {
        console.error('Logout-Fehler:', error);
    }
}

export async function handleForgotPassword() {
    const email = document.getElementById('email')?.value.trim();
    if (!email) {
        alert('Bitte E-Mail eingeben.');
        return;
    }
    try {
        await _supabase.auth.resetPasswordForEmail(email);
        alert('E-Mail zum Zurücksetzen gesendet!');
    } catch (error) {
        console.error('Fehler:', error);
    }
}