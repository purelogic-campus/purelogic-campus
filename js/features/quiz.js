// js/features/quiz.js - Vollständiges Campus-Quiz Modul
import { _supabase } from '../config.js';
import { state } from '../state.js';

const quizQuestions = [
    {
        question: "An welcher Universität in Wien befindet sich das berühmte Hauptgebäude am Universitätsring 1?",
        options: ["Universität Wien", "TU Wien", "WU Wien", "BOKU Wien"],
        correct: 0
    },
    {
        question: "Wie heißt das traditionelle wöchentliche Event bei Pure Logic mit Rosa Redesign & Herz-Motiven?",
        options: ["Freitags-Fete", "Match-Mittwoch", "Campus-Montag", "Hörsaal-Donnerstag"],
        correct: 1
    },
    {
        question: "Welche Dateiendung wird für den 'Lecture Mode' beim Speichern von Notizen auf dem Gerät angeboten?",
        options: [".exe und .bat", ".txt und .pdf", ".mp3 und .wav", ".zip und .rar"],
        correct: 1
    },
    {
        question: "Welches Backend-Dienstleister-Tool verwenden wir für Datenbank, Authentifizierung und Storage?",
        options: ["Firebase", "Supabase", "AWS Amplify", "MongoDB Atlas"],
        correct: 1
    }
];

let currentQuestionIndex = 0;
let quizTimer = null;
let timeLeft = 15;

export function initQuiz() {
    console.log("Quiz-Modul initialisiert.");
}

export function openCampusQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (modal) {
        modal.classList.remove('hidden');
        currentQuestionIndex = Math.floor(Math.random() * quizQuestions.length);
        loadQuizQuestion();
    }
}

export function closeCampusQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    if (quizTimer) clearInterval(quizTimer);
}

function loadQuizQuestion() {
    if (quizTimer) clearInterval(quizTimer);
    timeLeft = 15;

    const timerBadge = document.getElementById('quiz-timer-badge');
    if (timerBadge) timerBadge.textContent = `⏱️ ${timeLeft}s`;

    const qData = quizQuestions[currentQuestionIndex];
    const questionContainer = document.getElementById('quiz-question-container');
    const optionsContainer = document.getElementById('quiz-options-container');
    const subtitle = document.getElementById('quiz-subtitle');

    if (subtitle) subtitle.textContent = `Frage ${currentQuestionIndex + 1} von ${quizQuestions.length} (+25 Punkte)`;
    if (questionContainer) questionContainer.textContent = qData.question;

    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        qData.options.forEach((optionText, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'text-align: left; padding: 10px 14px; font-size: 12px; margin-top: 0;';
            btn.textContent = optionText;
            btn.onclick = () => handleQuizAnswer(index, qData.correct);
            optionsContainer.appendChild(btn);
        });
    }

    quizTimer = setInterval(() => {
        timeLeft--;
        if (timerBadge) timerBadge.textContent = `⏱️ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            alert('⏰ Zeit abgelaufen! Leider keine Punkte.');
            closeCampusQuizModal();
        }
    }, 1000);
}

async function handleQuizAnswer(selectedIndex, correctIndex) {
    if (quizTimer) clearInterval(quizTimer);

    if (selectedIndex === correctIndex) {
        alert('🎉 Richtig! Du hast 25 Bonuspunkte gewonnen!');
        await addQuizPoints(25);
    } else {
        alert('❌ Leider falsch! Versuche es morgen noch einmal.');
    }
    closeCampusQuizModal();
}

async function addQuizPoints(points) {
    if (!state.currentUserEmail) return;

    try {
        const { data: userData } = await _supabase
            .from('users')
            .select('logic_score')
            .eq('email', state.currentUserEmail)
            .single();

        const currentScore = userData?.logic_score || 0;
        const newScore = currentScore + points;

        await _supabase
            .from('users')
            .update({ logic_score: newScore })
            .eq('email', state.currentUserEmail);

        const badge = document.getElementById('score');
        if (badge && !badge.classList.contains('admin-badge')) {
            badge.textContent = `${newScore} P`;
        }
    } catch (err) {
        console.error('Fehler beim Gutschreiben der Punkte:', err);
    }
}

// Global für HTML-Events bereitstellen
window.openCampusQuizModal = openCampusQuizModal;
window.closeCampusQuizModal = closeCampusQuizModal;