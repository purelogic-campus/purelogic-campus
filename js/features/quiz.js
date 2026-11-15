// js/features/quiz.js - Tägliches Campus- & Allgemein-Quiz für PURE LOGIC
import { _supabase } from '../config.js';
import { state } from '../state.js';

let currentQuizQuestionIndex = 0;
let userQuizScore = 0;
let quizTimerInterval = null;
let timeLeft = 15;

const campusQuizQuestions = [
    {
        question: "Welches Gebäude ist das historische Hauptgebäude der Universität Wien am Ring?",
        options: ["Das Arkadenhof-Hauptgebäude", "Der Nawi-Glassubus", "Das TU Freihaus", "Die WU Bibliographie"],
        correct: 0
    },
    {
        question: "Wie viele ECTS-Punkte umfasst typischerweise ein volles Studienjahr im Bachelor (Vollzeit)?",
        options: ["30 ECTS", "60 ECTS", "90 ECTS", "120 ECTS"],
        correct: 1
    },
    {
        question: "Was bedeutet die Endung '.ac.at' bei akademischen E-Mail-Adressen in Österreich?",
        options: ["Austrian Commerce", "Academic Community Austria", "Academic Corporation", "Austria Campus"],
        correct: 1
    },
    {
        question: "Welcher Wiener Hotspot ist bei Studierenden für eine Lernsession in der Bib besonders bekannt?",
        options: ["Die UB Wien (Universitätsbibliothek)", "Der Prater Hauptallee Kiosk", "Das Rathaus-Café", "Der Donauturm"],
        correct: 0
    },
    {
        question: "Wofür steht die Abkürzung 'TU' in Wien?",
        options: ["Theodor Universität", "Technische Universität", "Typische Universität", "Transfer Union"],
        correct: 1
    }
];

export function openCampusQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    currentQuizQuestionIndex = Math.floor(Math.random() * campusQuizQuestions.length);
    userQuizScore = 0;
    loadQuizQuestion();
}

export function closeCampusQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (modal) modal.classList.add('hidden');
    if (quizTimerInterval) clearInterval(quizTimerInterval);
}

function loadQuizQuestion() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    
    const qContainer = document.getElementById('quiz-question-container');
    const optionsContainer = document.getElementById('quiz-options-container');
    const subtitle = document.getElementById('quiz-subtitle');
    const timerBadge = document.getElementById('quiz-timer-badge');

    if (!qContainer || !optionsContainer) return;

    const q = campusQuizQuestions[currentQuizQuestionIndex];
    if (subtitle) subtitle.textContent = `Frage ${currentQuizQuestionIndex + 1} von ${campusQuizQuestions.length}`;
    qContainer.textContent = q.question;
    optionsContainer.innerHTML = '';

    timeLeft = 15;
    if (timerBadge) timerBadge.textContent = `⏱️ ${timeLeft}s`;

    quizTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerBadge) timerBadge.textContent = `⏱️ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            handleQuizAnswer(-1, q.correct);
        }
    }, 1000);

    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'text-align: left; padding: 10px 14px; font-size: 12px; margin-top: 0; background: rgba(255,255,255,0.05); border: 1px solid var(--border);';
        btn.textContent = opt;
        btn.onclick = () => {
            clearInterval(quizTimerInterval);
            handleQuizAnswer(idx, q.correct);
        };
        optionsContainer.appendChild(btn);
    });
}

async function handleQuizAnswer(selectedIndex, correctIndex) {
    const optionsContainer = document.getElementById('quiz-options-container');
    const qContainer = document.getElementById('quiz-question-container');
    
    if (!optionsContainer) return;

    const buttons = optionsContainer.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        if (i === correctIndex) {
            buttons[i].style.background = 'rgba(16, 185, 129, 0.3)';
            buttons[i].style.borderColor = '#10b981';
        } else if (i === selectedIndex && selectedIndex !== correctIndex) {
            buttons[i].style.background = 'rgba(239, 68, 68, 0.3)';
            buttons[i].style.borderColor = '#ef4444';
        }
        buttons[i].disabled = true;
    }

    if (selectedIndex === correctIndex) {
        userQuizScore += 25;
        if (qContainer) qContainer.textContent += ' 🎉 Richtig! +25 Punkte!';
    } else {
        if (qContainer) qContainer.textContent += ' ❌ Leichte Enttäuschung, das war falsch.';
    }

    // Punkte gutschreiben
    if (state.currentUserEmail && selectedIndex === correctIndex) {
        try {
            const { data: userData } = await _supabase
                .from('users')
                .select('logic_score')
                .eq('email', state.currentUserEmail)
                .single();

            if (userData) {
                const newScore = (userData.logic_score || 0) + 25;
                await _supabase
                    .from('users')
                    .update({ logic_score: newScore })
                    .eq('email', state.currentUserEmail);

                const scoreBadge = document.getElementById('score');
                if (scoreBadge) scoreBadge.textContent = `${newScore} P`;
            }
        } catch (err) {
            console.warn('Quiz Punkte Fehler:', err);
        }
    }

    setTimeout(() => {
        closeCampusQuizModal();
        alert(`Quiz beendet! Du hast ${userQuizScore} Punkte ergattert 🚀`);
    }, 1800);
}

window.openCampusQuizModal = openCampusQuizModal;
window.closeCampusQuizModal = closeCampusQuizModal;