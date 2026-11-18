// js/features/match-mittwoch.js • PURE LOGIC Match-Mittwoch Modul (Automatische Theme-Umschaltung, Herzen & UI)
import { _supabase } from '../config.js';
import { state } from '../state.js';
import { validateInputOrAlert } from './moderation.js';

/**
 * Prüft beim Start, ob heute Mittwoch ist und aktiviert das Theme vollautomatisch.
 */
export function initMatchMittwochTheme() {
    const today = new Date().getDay(); // 3 = Mittwoch
    const isWednesday = (today === 3);

    if (isWednesday) {
        document.body.classList.add('match-mittwoch-active');
        console.log('💖 Match Mittwoch: Design und Herzen wurden vollautomatisch aktiviert!');
        if (!document.getElementById('floating-hearts-container')) {
            createFloatingHeartsEffect();
        }
    } else {
        document.body.classList.remove('match-mittwoch-active');
    }
}

/**
 * Erzeugt sanft schwebende Herzen im Hintergrund für den Match Mittwoch.
 */
function createFloatingHeartsEffect() {
    const container = document.createElement('div');
    container.id = 'floating-hearts-container';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999; overflow: hidden;';
    document.body.appendChild(container);

    setInterval(() => {
        if (!document.body.classList.contains('match-mittwoch-active')) return;

        const heart = document.createElement('div');
        heart.innerHTML = ['💖', '💕', '💘', '❤️', '✨'][Math.floor(Math.random() * 5)];
        const startX = Math.random() * window.innerWidth;
        const size = Math.floor(Math.random() * 16) + 14;
        const duration = Math.random() * 4 + 4;

        heart.style.cssText = `
            position: absolute;
            left: ${startX}px;
            bottom: -30px;
            font-size: ${size}px;
            opacity: 0.85;
            animation: floatUpHeart ${duration}s linear forwards;
        `;

        container.appendChild(heart);
        setTimeout(() => heart.remove(), duration * 1000);
    }, 1200);

    if (!document.getElementById('heart-keyframes')) {
        const style = document.createElement('style');
        style.id = 'heart-keyframes';
        style.innerHTML = `
            @keyframes floatUpHeart {
                0% { transform: translateY(0) rotate(0deg) scale(0.8); opacity: 0.9; }
                50% { transform: translateY(-50vh) rotate(15deg) scale(1.1); opacity: 0.6; }
                100% { transform: translateY(-105vh) rotate(-15deg) scale(0.6); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Öffnet das Match-Mittwoch / Crush-Radar Panel oder Modal
 */
export function openMatchMittwochModal() {
    // Verknüpfung mit dem bestehenden Crush-Radar aus crush.js
    if (typeof window.openCrushModal === 'function') {
        window.openCrushModal();
    } else {
        alert('💘 Match-Mittwoch & Crush-Radar Modul aktiv!');
    }
}

// Global für HTML-Events verfügbar machen
window.initMatchMittwochTheme = initMatchMittwochTheme;
window.openMatchMittwochModal = openMatchMittwochModal;