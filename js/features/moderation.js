// js/features/moderation.js - Erweiteter & moderner Content-Moderations-Filter (Stand 2026)

const forbiddenWords = [
    // 1. Schwere Beleidigungen & Mobbing (DE / EN)
    "arsch", "arschloch", "scheiße", "scheisse", "hure", "hurensohn", "fotze", 
    "wichser", "schlampe", "idiot", "vollidiot", "missgeburt", "spasti", "hässlich",
    "bitch", "whore", "cunt", "motherfucker", "asshole", "slut", "retard",
    
    // 2. Rassismus, Ethnizität & Xenophobie
    "nigger", "neger", "kanake", "judensau", "ausländer raus", "nazi", "hitler",
    "sieg heil", "hakenkreuz", "geh zurück in dein land", "parasiten", "kakerlaken",
    
    // 3. Sexismus & LGBTQ+-Feindlichkeit
    "schwuchtel", "trans-frau ist ein mann", "feminazi", "drecks lesbe",
    
    // 4. Gewalt, Suizid & Extremismus
    "ich bring dich um", "schlag dir die zähne", "verreck", "bring dich um",
    "stirb", "kill yourself", "kys"
];

/**
 * Bereinigt Text von absichtlichen Umgehungen (Sonderzeichen, Leerzeichen, Leetspeak)
 * @param {string} text 
 * @returns {string} bereinigter Text
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        // Leetspeak / Zahlen-Ersetzungen normalisieren
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/0/g, 'o')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        // Alle Sonderzeichen und Leerzeichen entfernen, um Wortketten zu prüfen
        .replace(/[^a-zäöüß]/g, '');
}

/**
 * Prüft Text auf verbotene Wörter und Toxizität (inkl. Normalisierung gegen Umgehungen)
 * @param {string} text 
 * @returns {boolean} true wenn toxisch/verboten, sonst false
 */
export function containsForbiddenContent(text) {
    if (!text || typeof text !== 'string') return false;
    
    const lowerText = text.toLowerCase();
    const normalized = normalizeText(text);
    
    for (const word of forbiddenWords) {
        const cleanWord = word.toLowerCase().replace(/[^a-zäöüß]/g, '');
        
        // Entweder direkter Treffer im normalen Text oder im normalisierten (gegen Leerzeichen/Sonderzeichen)
        if (lowerText.includes(word.toLowerCase()) || (cleanWord.length > 2 && normalized.includes(cleanWord))) {
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
 * Wrapper-Funktion mit Warnmeldung per alert() für Benutzereingaben
 * @param {string} text 
 * @returns {boolean} true wenn sicher, false bei Regelverstoß
 */
export function validateInputOrAlert(text) {
    if (containsForbiddenContent(text)) {
        alert('⚠️ Moderations-Hinweis: Deine Eingabe enthält unerbotene Ausdrücke, Beleidigungen, Hassrede oder diskriminierende Inhalte. Bitte halte dich an die Campus-Community-Regeln!');
        return false;
    }
    return true;
}

// Global für HTML & andere Module verfügbar machen
window.containsForbiddenContent = containsForbiddenContent;
window.sanitizeText = sanitizeText;
window.validateInputOrAlert = validateInputOrAlert;