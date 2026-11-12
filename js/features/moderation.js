// js/features/moderation.js - Vollautomatischer Regex- & Wortfilter gegen Beleidigungen und Rassismus

const forbiddenWords = [
    // Schimpfwörter & Beleidigungen
    "arsch", "arschloch", "scheiße", "scheisse", "hure", "hurensohn", "fotze", 
    "wichser", "schlampe", "idiot", "vollidiot", "missgeburt",
    // Rassismus & Diskriminierung
    "nigger", "neger", "kanake", "judensau", "ausländer raus", "nazi", "hitler",
    "sieg heil", "geh zurück in dein land"
];

/**
 * Prüft Text auf verbotene Wörter (case-insensitive)
 * @param {string} text 
 * @returns {boolean} true wenn toxisch/verboten, sonst false
 */
export function containsForbiddenContent(text) {
    if (!text || typeof text !== 'string') return false;
    
    const lowerText = text.toLowerCase();
    
    for (const word of forbiddenWords) {
        const regex = new RegExp(`\\b${word}\\b|[\\s\\S]*${word}[\\s\\S]*`, 'i');
        if (regex.test(lowerText)) {
            return true;
        }
    }
    return false;
}

/**
 * Filtert Text und ersetzt anstößige Wörter durch Sterne
 * @param {string} text 
 * @returns {string} bereinigter Text
 */
export function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    
    forbiddenWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        const stars = '*'.repeat(word.length);
        sanitized = sanitized.replace(regex, stars);
    });
    
    return sanitized;
}

/**
 * Wrapper-Funktion mit Warnmeldung per alert()
 * @param {string} text 
 * @returns {boolean} true wenn sicher, false bei Regelverstoß
 */
export function validateInputOrAlert(text) {
    if (containsForbiddenContent(text)) {
        alert('⚠️ Moderations-Hinweis: Deine Eingabe enthält unerbotene Ausdrücke, Beleidigungen oder diskriminierende Inhalte. Bitte halte dich an die Campus-Community-Regeln!');
        return false;
    }
    return true;
}

// Global verfügbar machen
window.containsForbiddenContent = containsForbiddenContent;
window.sanitizeText = sanitizeText;
window.validateInputOrAlert = validateInputOrAlert;