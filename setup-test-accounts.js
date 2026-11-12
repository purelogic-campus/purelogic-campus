// ============================================================================
// PURE LOGIC • Test-Accounts Automatisierungs-Skript (Vollständig)
// ============================================================================
import { createClient } from '@supabase/supabase-js';

// Trage hier deine Supabase Credentials ein (mit Service Role Key für Admin-Rechte)
const SUPABASE_URL = 'DEINE_SUPABASE_URL';
const SUPABASE_SERVICE_ROLE_KEY = 'DEIN_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const testAccounts = [
    { email: 'schelli@pure-logic.at', password: 'Tenschi2026', username: 'schelli' },
    { email: 'benschi@purelogic.at', password: 'Emma2026', username: 'benschi' },
    { email: 'steffi@pure-logic.at', password: 'Liebe2026', username: 'steffi' },
    { email: 'daniboy@pure-logic.de', password: 'Minecraft2026', username: 'daniboy' },
    { email: 'lesterhr@pure-logic.at', password: 'Hund2026', username: 'lesterhr' },
    { email: 'manuels@pure-logic-at', password: 'gras2026', username: 'manuels' },
    { email: 'wolfi@purelogic.at', password: 'kreatur2026', username: 'wolfi' },
    { email: 'josolo@pure-logic.at', password: 'Koch2026', username: 'josolo' }
];

async function seedTestAccounts() {
    console.log('🚀 Starte das automatische Anlegen der Test-Accounts...');

    for (const acc of testAccounts) {
        try {
            console.log(`Verarbeite Account: ${acc.email}...`);

            // 1. In Supabase Auth anlegen (falls noch nicht vorhanden)
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: acc.email,
                password: acc.password,
                email_confirm: true
            });

            if (authError && !authError.message.includes('already registered')) {
                console.warn(`Auth-Hinweis für ${acc.email}:`, authError.message);
            } else {
                console.log(`✅ Auth-User bereit: ${acc.email}`);
            }

            // 2. Automatische Erkennung ob .ac.at Student
            const isVerifiedStudent = acc.email.toLowerCase().endsWith('.ac.at');

            // 3. In der 'users' Tabelle upserten
            const { error: dbError } = await supabase
                .from('users')
                .upsert([
                    {
                        email: acc.email,
                        username: acc.username,
                        full_name: acc.username.charAt(0).toUpperCase() + acc.username.slice(1),
                        university: acc.email.includes('pure-logic.at') ? 'Universität Wien' : 'Auslands-Uni',
                        logic_score: 100, // Start-Punkte fürs Testen
                        is_verified_student: isVerifiedStudent,
                        created_at: new Date().toISOString()
                    }
                ], { onConflict: 'email' });

            if (dbError) {
                console.error(`❌ DB-Fehler bei ${acc.email}:`, dbError.message);
            } else {
                console.log(`✅ Tabelleneintrag erfolgreich (Verifiziert: ${isVerifiedStudent})\n`);
            }

        } catch (err) {
            console.error(`Unerwarteter Fehler bei ${acc.email}:`, err);
        }
    }

    console.log('🎉 Alle Test-Accounts wurden erfolgreich eingerichtet und sind einsatzbereit!');
}

seedTestAccounts();