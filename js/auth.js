import { _supabase } from './config.js';
import { state } from './state.js';
import { loadCampusFeed, loadMyProfilePosts } from './features/feed.js';
import { loadLiveStreams } from './features/live.js';

export async function handleLogin() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value.trim();

    if (!email || !password) {
        showAuthMsg('Bitte E-Mail und Passwort eingeben.', 'error');
        return;
    }

    try {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        state.currentUserEmail = data.user.email;
        await checkAndCreateUserRecord(data.user.email);
        await initMainApp();
    } catch (err) {
        showAuthMsg('Login-Fehler: ' + err.message, 'error');
    }
}

export async function handleSignup() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value.trim();

    if (!email || !password) {
        showAuthMsg('Bitte E-Mail und Passwort eingeben.', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMsg('Das Passwort muss mindestens 6 Zeichen lang sein.', 'error');
        return;
    }

    try {
        // 1. Globale Session hart auf dem Client & Server beenden
        await _supabase.auth.signOut({ scope: 'global' });
        
        // 2. Allen lokalen Speicher restlos bereinigen
        localStorage.clear();
        sessionStorage.clear();
        state.currentUserEmail = null;

        // 3. Frische Registrierung als neuer, isolierter User ausführen
        const { data, error } = await _supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    email_confirm: true
                }
            }
        });
        
        if (error) throw error;

        const userEmail = data.user?.email || email;
        state.currentUserEmail = userEmail;
        await checkAndCreateUserRecord(userEmail);
        
        const isAcAt = userEmail.toLowerCase().endsWith('.ac.at');
        const successMsg = isAcAt 
            ? 'Account erfolgreich erstellt! .ac.at Studenten-Status erkannt 🎓' 
            : 'Account erfolgreich erstellt! Willkommen bei Pure Logic 🚀';

        showAuthMsg(successMsg, 'success');
        
        setTimeout(() => {
            initMainApp();
        }, 1000);
    } catch (err) {
        console.error('Signup-Fehler Details:', err);
        showAuthMsg('Registrierungs-Fehler: ' + (err.message || 'Unbekannter Fehler'), 'error');
    }
}

async function checkAndCreateUserRecord(email) {
    try {
        const isVerifiedStudent = email.toLowerCase().endsWith('.ac.at');

        const { data: existingUser } = await _supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (!existingUser) {
            await _supabase.from('users').insert([
                {
                    id: crypto.randomUUID(),
                    email: email,
                    username: email.split('@')[0],
                    full_name: email.split('@')[0],
                    university: isVerifiedStudent ? 'Universität Wien (Verifiziert)' : 'Universität Wien',
                    logic_score: 50,
                    is_verified_student: isVerifiedStudent,
                    created_at: new Date().toISOString()
                }
            ]);
        } else {
            await _supabase
                .from('users')
                .update({ is_verified_student: isVerifiedStudent })
                .eq('email', email);
        }
        
        state.isVerifiedStudent = isVerifiedStudent;
    } catch (err) {
        console.error('Fehler beim Prüfen des User-Records:', err);
    }
}

export async function handleForgotPassword() {
    const email = document.getElementById('email')?.value.trim();
    if (!email) {
        showAuthMsg('Bitte gib oben deine E-Mail-Adresse für den Reset ein.', 'error');
        return;
    }

    try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo,
        });
        if (error) throw error;
        showAuthMsg('Passwort-Zurücksetzen-Link wurde an deine E-Mail gesendet! 💌', 'success');
    } catch (err) {
        showAuthMsg('Fehler beim Zurücksetzen: ' + err.message, 'error');
    }
}

export async function checkPasswordRecoveryFlow() {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        const newPassword = prompt('Bitte gib dein neues, sicheres Passwort ein:');
        if (!newPassword) return;

        try {
            const { error } = await _supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('Passwort erfolgreich aktualisiert! Du kannst dich jetzt einloggen. 🚀');
            window.location.href = window.location.pathname;
        } catch (err) {
            alert('Fehler beim Aktualisieren des Passworts: ' + err.message);
        }
    }
}

function showAuthMsg(text, type) {
    const msgBox = document.getElementById('auth-msg');
    if (!msgBox) return;
    msgBox.textContent = text;
    msgBox.classList.remove('hidden', 'msg-error', 'msg-success');
    
    if (type === 'error') {
        msgBox.style.background = 'rgba(239, 68, 68, 0.15)';
        msgBox.style.color = '#ef4444';
        msgBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    } else {
        msgBox.style.background = 'rgba(16, 185, 129, 0.15)';
        msgBox.style.color = '#10b981';
        msgBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }
}

export function togglePasswordVisibility() {
    const pwInput = document.getElementById('password');
    if (!pwInput) return;
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
}

export function resetUser() {
    _supabase.auth.signOut({ scope: 'global' });
    state.currentUserEmail = null;
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.pathname;
}

export async function initMainApp() {
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');
    
    document.getElementById('logout-btn')?.classList.remove('hidden');
    document.getElementById('header-profile-btn')?.classList.remove('hidden');

    const isMasterAdmin = (
        state.currentUserEmail?.toLowerCase() === 'office@pure-logic.at' ||
        state.currentUserEmail?.toLowerCase() === 'admin@pure-logic.at' ||
        state.currentUserEmail?.toLowerCase().includes('admin')
    );

    if (isMasterAdmin) {
        const adminBtn = document.getElementById('header-admin-tab-btn');
        if (adminBtn) adminBtn.classList.remove('hidden');
        const scoreBadge = document.getElementById('score');
        if (scoreBadge) scoreBadge.classList.add('admin-badge');
    }

    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('*')
            .eq('email', state.currentUserEmail)
            .single();

        if (userData) {
            const scoreBadge = document.getElementById('score');
            if (scoreBadge) scoreBadge.textContent = `${userData.logic_score || 0} P`;

            state.isVerifiedStudent = userData.is_verified_student || false;

            const badgeContainer = document.getElementById('verified-student-badge-container');
            if (badgeContainer) {
                if (state.isVerifiedStudent) {
                    badgeContainer.innerHTML = `<span style="display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; margin-top: 2px;">🎓 Verified Student (.ac.at)</span>`;
                } else {
                    badgeContainer.innerHTML = '';
                }
            }

            if (userData.is_admin || userData.role === 'admin') {
                document.getElementById('header-admin-tab-btn')?.classList.remove('hidden');
                if (scoreBadge) scoreBadge.classList.add('admin-badge');
            }
        }
    } catch (err) {
        console.error('Fehler beim Laden der User-Daten:', err);
    }

    loadCampusFeed('foryour');
    loadLiveStreams();
    loadMyProfilePosts();
}

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.resetUser = resetUser;