// js/features/lecture.js - Vorlesungs-Fokusmodus & Notizen-Export
import { state } from '../state.js';

/**
 * Schaltet den Lecture Mode (Hörsaal-Fokusmodus) ein oder aus
 */
export function toggleLectureMode() {
    const lectureView = document.getElementById('tab-lecture-mode');
    if (lectureView) {
        lectureView.classList.toggle('hidden');
    }
}

/**
 * Speichert die Notizen als .txt oder .pdf Datei auf dem Gerät
 */
export function saveLectureNotesToFile() {
    const notesInput = document.getElementById('lecture-notes-input');
    const fileNameInput = document.getElementById('lecture-file-name');
    const formatSelect = document.getElementById('lecture-file-format');

    if (!notesInput || !notesInput.value.trim()) {
        alert('Deine Notizen sind leer. Schreib zuerst etwas auf!');
        return;
    }

    const content = notesInput.value;
    const fileName = (fileNameInput && fileNameInput.value.trim()) ? fileNameInput.value.trim() : 'Vorlesungsnotiz';
    const format = formatSelect ? formatSelect.value : 'txt';

    if (format === 'txt') {
        // .txt Download über Blob
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
        // .pdf Download über jsPDF (falls eingebunden)
        try {
            if (window.jspdf && window.jspdf.jsPDF) {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.text("PURE LOGIC • Lecture Notes", 14, 20);
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                
                const splitText = doc.splitTextToSize(content, 180);
                doc.text(splitText, 14, 30);
                
                doc.save(`${fileName}.pdf`);
            } else {
                alert('jsPDF Bibliothek ist nicht geladen. Bitte verwende das .txt Format.');
            }
        } catch (err) {
            console.error('PDF Generierungsfehler:', err);
            alert('Fehler beim Generieren des PDFs: ' + err.message);
        }
    }
}

// Global für HTML-Events verfügbar machen
window.toggleLectureMode = toggleLectureMode;
window.saveLectureNotesToFile = saveLectureNotesToFile;