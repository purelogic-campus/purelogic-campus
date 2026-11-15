// js/features/ranking.js - Wiener Uni-Duell (Pro-Kopf) & Wall of Fame (Top 100)
import { _supabase } from '../config.js';
import { state } from '../state.js';

const VIENNA_UNIS = [
    { key: 'Universität Wien', label: 'Universität Wien', icon: '🏛️', color: '#3b82f6' },
    { key: 'TU Wien', label: 'TU Wien', icon: '⚙️', color: '#06b6d4' },
    { key: 'Wirtschaftsuniversität Wien (WU)', label: 'WU Wien', icon: '📈', color: '#10b981' },
    { key: 'MedUni Wien', label: 'MedUni Wien', icon: '🩺', color: '#ef4444' },
    { key: 'boku', label: 'BOKU Wien', icon: '🌿', color: '#84cc16' },
    { key: 'FH Wien', label: 'FH Wien', icon: '🎓', color: '#a855f7' }
];

function normalizeUniversity(rawUni) {
    if (!rawUni) return 'Universität Wien';
    const lower = rawUni.toLowerCase();
    if (lower.includes('tu')) return 'TU Wien';
    if (lower.includes('wu') || lower.includes('wirtschaft')) return 'Wirtschaftsuniversität Wien (WU)';
    if (lower.includes('med')) return 'MedUni Wien';
    if (lower.includes('boku')) return 'boku';
    if (lower.includes('fh')) return 'FH Wien';
    return 'Universität Wien';
}

function getRankBadge(score) {
    if (score >= 1000) return '👑 Campus Legende';
    if (score >= 500) return '🔥 Hörsaal Boss';
    if (score >= 250) return '⚡ Streber-Elite';
    if (score >= 100) return '📚 Bib-Stammgast';
    return '☕ Frischer Erstie';
}

export async function loadRankingData() {
    const uniListEl = document.getElementById('uni-duell-list');
    const creatorsListEl = document.getElementById('top-creators-list');

    if (!uniListEl || !creatorsListEl) return;

    uniListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Berechne Uni-Wertung...</p>';
    creatorsListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Lade Top Creator...</p>';

    try {
        const { data: users, error } = await _supabase
            .from('users')
            .select('email, full_name, username, university, logic_score, avatar_url, role');

        if (error) throw error;

        if (!users || users.length === 0) {
            uniListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Noch keine Uni-Daten vorhanden.</p>';
            creatorsListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Noch keine Nutzer im Ranking.</p>';
            return;
        }

        // 1. WIENER UNI-DUELL (PRO-KOPF-BERECHNUNG)
        const uniStatsMap = {};
        VIENNA_UNIS.forEach(u => {
            uniStatsMap[u.key] = {
                ...u,
                totalPoints: 0,
                studentCount: 0,
                perCapita: 0
            };
        });

        users.forEach(u => {
            const normUni = normalizeUniversity(u.university);
            const pts = Number(u.logic_score) || 0;
            if (!uniStatsMap[normUni]) {
                uniStatsMap[normUni] = {
                    key: normUni,
                    label: normUni,
                    icon: '🎓',
                    color: '#818cf8',
                    totalPoints: 0,
                    studentCount: 0,
                    perCapita: 0
                };
            }
            uniStatsMap[normUni].totalPoints += pts;
            uniStatsMap[normUni].studentCount += 1;
        });

        const rankedUnis = Object.values(uniStatsMap)
            .map(u => ({
                ...u,
                perCapita: u.studentCount > 0 ? Math.round((u.totalPoints / u.studentCount) * 10) / 10 : 0
            }))
            .sort((a, b) => {
                if (b.perCapita !== a.perCapita) return b.perCapita - a.perCapita;
                return b.totalPoints - a.totalPoints;
            });

        const maxPerCapita = Math.max(...rankedUnis.map(u => u.perCapita), 1);

        uniListEl.innerHTML = '';
        rankedUnis.forEach((uni, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            const barWidth = uni.studentCount > 0 ? Math.max(8, Math.round((uni.perCapita / maxPerCapita) * 100)) : 4;

            const row = document.createElement('div');
            row.style.cssText = `
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid ${rank === 1 ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)'};
                border-radius: 10px;
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            `;

            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px; font-weight: 900; min-width: 24px;">${medal}</span>
                        <span style="font-size: 13px; font-weight: 800; color: #fff;">${uni.icon} ${uni.label}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 13px; font-weight: 900; color: ${uni.color};">${uni.perCapita} P</span>
                        <span style="font-size: 10px; color: var(--text-muted); display: block;">Ø / Kopf (${uni.studentCount} Stud.)</span>
                    </div>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
                    <div style="width: ${barWidth}%; height: 100%; background: ${uni.color}; border-radius: 999px; transition: width 0.5s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted);">
                    <span>Gesamt-Pool: ${uni.totalPoints} P</span>
                    <span>${rank === 1 && uni.totalPoints > 0 ? '🔥 Aktueller Spitzenreiter' : 'Wochen-Challenge'}</span>
                </div>
            `;
            uniListEl.appendChild(row);
        });

        // 2. WALL OF FAME (TOP 100 CREATOR)
        const topUsers = [...users]
            .sort((a, b) => (Number(b.logic_score) || 0) - (Number(a.logic_score) || 0))
            .slice(0, 100);

        creatorsListEl.innerHTML = '';
        topUsers.forEach((user, index) => {
            const rank = index + 1;
            const score = Number(user.logic_score) || 0;
            const displayName = user.full_name || user.username || user.email.split('@')[0];
            const handle = user.username ? `@${user.username}` : user.email.split('@')[0];
            const uniLabel = normalizeUniversity(user.university);
            const isMe = state.currentUserEmail && user.email.toLowerCase() === state.currentUserEmail.toLowerCase();
            const avatar = user.avatar_url || `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg>`;
            const rankColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#cbd5e1' : rank === 3 ? '#d97706' : 'var(--text-muted)';

            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                border-radius: 10px;
                background: ${isMe ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)'};
                border: 1px solid ${isMe ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.05)'};
                cursor: pointer;
            `;

            item.onclick = () => {
                if (typeof window.openPublicProfile === 'function') {
                    window.openPublicProfile(user.email);
                }
            };

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <span style="font-size: 12px; font-weight: 900; color: ${rankColor}; min-width: 24px; text-align: center;">#${rank}</span>
                    <img src="${avatar}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0;">
                    <div style="min-width: 0;">
                        <div style="font-size: 12px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${displayName} ${isMe ? '<span style="color:#818cf8; font-size:10px;">(Du)</span>' : ''}
                        </div>
                        <div style="font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${handle} • ${uniLabel} • ${getRankBadge(score)}
                        </div>
                    </div>
                </div>
                <div style="font-size: 12px; font-weight: 900; color: #818cf8; flex-shrink: 0; margin-left: 8px;">
                    ${score} P
                </div>
            `;
            creatorsListEl.appendChild(item);
        });

    } catch (err) {
        console.error('Fehler beim Laden des Uni-Duells:', err);
        uniListEl.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Fehler beim Laden der Uni-Wertung.</p>';
        creatorsListEl.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Fehler beim Laden der Top Creator.</p>';
    }
}

window.loadRankingData = loadRankingData;