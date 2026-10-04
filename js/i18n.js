// js/i18n.js

export const translations = {
    de: {
        // Kopiere hier den deutschen Teil deiner Übersetzungen aus der alten app.js hinein
        // Beispiel: welcome: "Willkommen auf dem GenZ Campus"
    },
    en: {
        // Kopiere hier den englischen Teil deiner Übersetzungen hinein
    }
};

export function changeLanguage(langCode) {
    localStorage.setItem('preferred_lang', langCode);
    const t = translations[langCode] || translations['de'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
}