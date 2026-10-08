// js/i18n.js

export const translations = {
    de: {
        welcome: "Willkommen auf dem GenZ Campus"
    },
    en: {
        welcome: "Welcome to the GenZ Campus"
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