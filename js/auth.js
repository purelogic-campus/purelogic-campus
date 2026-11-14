// js/auth.js - Authentifizierung & .ac.at Studenten-Verifizierung
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

    try {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) throw error;

        state.currentUserEmail = data.user.email;
        await checkAndCreateUserRecord(data.user.email);
        
        const isAcAt = email.toLowerCase().endsWith('.ac.at');
        const successMsg = isAcAt 
            ? 'Account erfolgreich erstellt! .ac.at Studenten-Status erkannt 🎓' 
            : 'Account erfolgreich erstellt! Willkommen bei Pure Logic 🚀';

        showAuthMsg(successMsg, 'success');
        setTimeout(initMainApp, 1000);
    } catch (err) {
        showAuthMsg('Registrierungs-Fehler: ' + err.message, 'error');
    }
}

async function checkAndCreateUserRecord(email) {
    try {
        const isVerifiedStudent = email.toLowerCase().endsWith('.ac.at');

        const { data: existingUser } = await _supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

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
            // Falls sich der Status geändert hat oder beim Login nachgezogen werden soll
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
        const { error } = await _supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showAuthMsg('Passwort-Zurücksetzen-Link wurde an deine E-Mail gesendet! 💌', 'success');
    } catch (err) {
        showAuthMsg('Fehler beim Zurücksetzen: ' + err.message, 'error');
    }
}

function showAuthMsg(text, type) {
    const msgBox = document.getElementById('auth-msg');
    if (!msgBox) return;
    msgBox.textContent = text;
    msgBox.classList.remove('hidden', 'msg-error', 'msg-success');
    msgBox.classList.add(type === 'error' ? 'msg-error' : 'msg-success');
}

export function togglePasswordVisibility() {
    const pwInput = document.getElementById('password');
    if (!pwInput) return;
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
}

export function resetUser() {
    _supabase.auth.signOut();
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

            // Verified Badge im Profil rendern
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

    loadCampusFeed('foryou');
    loadLiveStreams();
    loadMyProfilePosts();
}

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleForgotPassword = handleForgotPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.resetUser = resetUser;
```[cite: 6]

---

### 2. `schema.sql` (Datenbankseitige Absicherung per Trigger)
Damit auch auf Datenbankebene (falls User direkt über Supabase Auth angelegt werden) die `.ac.at`-Endung automatisch erkannt und das Flag `is_verified_student` gesetzt wird, erweitern wir das SQL-Schema wie folgt[cite: 3]:

```sql
-- Erweiterung der users Tabelle für .ac.at Verifizierung
ALTER TABLE IF EXISTS users 
ADD COLUMN IF NOT EXISTS is_verified_student BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Automatischer Trigger, der bei Registrierung prüft, ob die Mail auf .ac.at endet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, university, is_verified_student, logic_score)
  VALUES (
    NEW.id, 
    NEW.email, 
    'Universität Wien', 
    NEW.email ILIKE '%.ac.at', 
    50
  )
  ON CONFLICT (email) DO UPDATE 
  SET is_verified_student = EXCLUDED.email ILIKE '%.ac.at';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();