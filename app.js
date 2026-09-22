const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2bLjUm02NS5XDAJMvVDgTA_rSzQKZAe';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MASTER_ADMIN_EMAIL = 'admin@purelogic.app';
const MASTER_ADMIN_PASS = 'Doschi08021991';

// Erlaubte akademische bzw. Wiener Uni-Domains
const ALLOWED_DOMAINS = ['.ac.at', 'univie.ac.at', 'tuwien.ac.at', 'wu.ac.at', 'meduniwien.ac.at', 'boku.ac.at', 'fhwien.ac.at'];

let currentUserEmail = localStorage.getItem('campus_email') || '';
let userPoints = 0;
let selectedCategory = '☕ Kaffee';
let selectedGoLiveCategory = '🎮 Gaming';
let activeFilter = 'Alle';
let activeLiveFilter = 'Alle';
let reelFilter = 'foryou';
let allEventsCache = [];
let liveStreamsCache = [];
let globalChatCache = [];
let profilesCache = {};
let followsCache = []; 
let mediaPostsCache = [];

let currentTutorialStep = 1;
const totalTutorialSteps = 3;

let activeDropCache = null;
let allActiveDropsCache = [];
let profReviewsCache = [];
let isLectureModeActive = false;

// Quiz State
let activeQuizQuestions = [];
let currentQuizIndex = 0;
let userQuizAnswers = [];
let quizTimerInterval = null;
let quizSecondsLeft = 15;

let adminMap = null;
let adminMarker = null;

window.addEventListener('DOMContentLoaded', async () => {
  checkMatchWednesday();

  if (currentUserEmail) {
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('header-profile-btn').classList.remove('hidden');
    if (currentUserEmail === MASTER_ADMIN_EMAIL) {
      userPoints = 9999;
      setupAdminUI();
      initApp();
    } else {
      const { data } = await _supabase.from('users').select('*').eq('email', currentUserEmail).maybeSingle();
      if (data) {
        userPoints = data.points || 0;
        updatePointsDisplay();
        initApp();
      } else {
        resetUser(false);
      }
    }
  }
  
  loadActiveCampusDrops();
  loadProfReviews();

  const notesInput = document.getElementById('lecture-notes-input');
  const fileNameInput = document.getElementById('lecture-file-name');
  const fileDateInput = document.getElementById('lecture-file-date');

  if (notesInput) {
    notesInput.value = localStorage.getItem('lecture_mode_notes') || '';
    notesInput.addEventListener('input', () => {
      localStorage.setItem('lecture_mode_notes', notesInput.value);
    });
  }

  if (fileDateInput) {
    fileDateInput.value = new Date().toISOString().split('T')[0];
  }

  if (fileNameInput) {
    fileNameInput.value = 'Vorlesung_Notizen';
  }

  window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('points-dropdown-menu');
    const scoreBadge = document.getElementById('score');
    if (dropdown && !dropdown.classList.contains('hidden') && !scoreBadge.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});

// --- LECTURE MODE & SPEICHERN LOGIK (.TXT ODER .PDF) ---
function toggleLectureMode() {
  const appCard = document.querySelector('.app-card');
  const dropdown = document.getElementById('points-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');

  isLectureModeActive = !isLectureModeActive;

  if (isLectureModeActive) {
    appCard.classList.add('lecture-mode');
    const savedNotes = localStorage.getItem('lecture_mode_notes') || '';
    document.getElementById('lecture-notes-input').value = savedNotes;
  } else {
    appCard.classList.remove('lecture-mode');
  }
}

function saveLectureNotesToFile() {
  const notesContent = document.getElementById('lecture-notes-input').value;
  if (!notesContent.trim()) {
    alert('⚠️ Deine Notiz ist leer. Es gibt nichts zum Speichern!');
    return;
  }

  const customName = document.getElementById('lecture-file-name').value.trim() || 'Vorlesung_Notizen';
  const customDate = document.getElementById('lecture-file-date').value || new Date().toISOString().split('T')[0];
  const formatChoice = document.getElementById('lecture-file-format').value;

  if (formatChoice === 'txt') {
    const fileContent = `=== PURE LOGIC CAMPUS NOTIZ ===\nDatum: ${customDate}\nTitel: ${customName}\n=================================\n\n${notesContent}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customName}_${customDate}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert(`✅ Notiz erfolgreich als "${customName}_${customDate}.txt" heruntergeladen!`);
  } else if (formatChoice === 'pdf') {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(99, 102, 241);
      doc.text("PURE LOGIC • Campus Vorlesungsnotiz", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Titel: ${customName} | Datum: ${customDate}`, 14, 27);

      doc.setLineWidth(0.5);
      doc.setStrokeColor(200, 200, 200);
      doc.line(14, 32, 196, 32);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);

      const splitText = doc.splitTextToSize(notesContent, 180);
      doc.text(splitText, 14, 42);

      doc.save(`${customName}_${customDate}.pdf`);
      alert(`✅ Notiz erfolgreich als "${customName}_${customDate}.pdf" heruntergeladen! 📄`);
    } catch (err) {
      console.error("PDF Generierungsfehler:", err);
      alert('❌ Fehler beim Erstellen der PDF-Datei. Bitte versuche es erneut.');
    }
  }
}

// --- PROF-RATING & SURVIVAL GUIDE LOGIK ---
function openProfGuideModal() {
  document.getElementById('prof-guide-modal').classList.remove('hidden');
  loadProfReviews();
}

function closeProfGuideModal() {
  document.getElementById('prof-guide-modal').classList.add('hidden');
}

function toggleProfForm() {
  const form = document.getElementById('prof-review-form-container');
  form.classList.toggle('hidden');
}

async function loadProfReviews() {
  const { data, error } = await _supabase.from('prof_reviews').select('*').order('created_at', { ascending: false });
  if (!error && data) {
    profReviewsCache = data;
    renderProfReviews(profReviewsCache);
  }
}

function renderProfReviews(reviews) {
  const listEl = document.getElementById('prof-reviews-list');
  if (!listEl) return;

  if (reviews.length === 0) {
    listEl.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Noch keine Bewertungen vorhanden. Sei der Erste! 🎓</p>';
    return;
  }

  listEl.innerHTML = reviews.map(r => {
    const stars = '⭐'.repeat(r.rating);
    const diffText = ['Chillig', 'Machbar', 'Mittel', 'Anspruchsvoll', 'Killer-Klausur'][r.difficulty - 1] || 'Mittel';
    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div>
            <strong style="font-size: 13px; color: var(--text);">👨‍🏫 ${r.prof_name}</strong><br>
            <span style="font-size: 11px; color: #818cf8; font-weight: 700;">📖 ${r.subject_code}</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px;">${stars}</span><br>
            <span style="font-size: 10px; color: var(--text-muted);">Schwierigkeit: ${diffText}</span>
          </div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">💬 ${r.comment}</p>
        <div style="font-size: 9px; color: var(--text-muted); margin-top: 6px; text-align: right;">Von: ${r.author_email ? r.author_email.split('@')[0] : 'Anonym'}</div>
      </div>
    `;
  }).join('');
}

function filterProfReviews() {
  const query = document.getElementById('prof-search-input').value.toLowerCase();
  const filtered = profReviewsCache.filter(r => 
    r.prof_name.toLowerCase().includes(query) || 
    r.subject_code.toLowerCase().includes(query) ||
    r.comment.toLowerCase().includes(query)
  );
  renderProfReviews(filtered);
}

async function submitProfReview() {
  const profName = document.getElementById('prof-name-input').value.trim();
  const subject = document.getElementById('prof-subject-input').value.trim();
  const rating = parseInt(document.getElementById('prof-rating-select').value);
  const difficulty = parseInt(document.getElementById('prof-difficulty-select').value);
  const comment = document.getElementById('prof-comment-input').value.trim();

  if (!profName || !subject || !comment) {
    alert('⚠️ Bitte fülle alle Felder aus.');
    return;
  }

  const { error } = await _supabase.from('prof_reviews').insert([{
    prof_name: profName,
    subject_code: subject,
    rating: rating,
    difficulty: difficulty,
    comment: comment,
    author_email: currentUserEmail || 'student@uni.at'
  }]);

  if (error) {
    alert('Fehler beim Speichern der Review: ' + error.message);
    return;
  }

  document.getElementById('prof-name-input').value = '';
  document.getElementById('prof-subject-input').value = '';
  document.getElementById('prof-comment-input').value = '';
  toggleProfForm();

  await addPoints(15);
  loadProfReviews();
  alert('🎉 Review erfolgreich veröffentlicht! +15 Punkte gutgeschrieben. 🚀');
}

// --- ADMIN TEST-MODUS PUNKTE SETZEN ---
function adminSetTestPoints() {
  const input = document.getElementById('admin-test-points-input');
  const val = parseInt(input.value);
  if (isNaN(val)) return alert('Bitte eine gültige Zahl eingeben.');

  userPoints = val;
  const badge = document.getElementById('score');
  badge.innerText = `${userPoints} P`;
  badge.className = 'points-badge'; 
  badge.onclick = (e) => togglePointsDropdown(e);
  alert(`✅ Test-Punktzahl auf ${userPoints} P gesetzt! Du kannst das Menü jetzt testen.`);
}

function togglePointsDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('points-dropdown-menu');
  dropdown.classList.toggle('hidden');
}

function openMorePointsModal() {
  document.getElementById('more-points-modal').classList.remove('hidden');
}

function closeMorePointsModal() {
  document.getElementById('more-points-modal').classList.add('hidden');
}

// --- QUIZ LOGIK ---
async function openCampusQuizModal() {
  document.getElementById('quiz-modal').classList.remove('hidden');
  document.getElementById('quiz-question-container').innerText = 'Lade Fragen aus der Datenbank... ⏳';
  document.getElementById('quiz-options-container').innerHTML = '';

  const { data, error } = await _supabase.from('quiz_questions').select('id, question_text, options').limit(5);

  if (error || !data || data.length === 0) {
    document.getElementById('quiz-question-container').innerText = '⚠️ Keine Quiz-Fragen in der Datenbank gefunden oder Fehler beim Laden.';
    return;
  }

  activeQuizQuestions = data;
  currentQuizIndex = 0;
  userQuizAnswers = [];
  startQuizQuestion();
}

function closeCampusQuizModal() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  document.getElementById('quiz-modal').classList.add('hidden');
}

function startQuizQuestion() {
  if (currentQuizIndex >= activeQuizQuestions.length) {
    submitQuizToBackend();
    return;
  }

  quizSecondsLeft = 15;
  updateQuizTimerDisplay();

  if (quizTimerInterval) clearInterval(quizTimerInterval);
  quizTimerInterval = setInterval(() => {
    quizSecondsLeft--;
    updateQuizTimerDisplay();
    if (quizSecondsLeft <= 0) {
      clearInterval(quizTimerInterval);
      userQuizAnswers.push({ questionId: activeQuizQuestions[currentQuizIndex].id, selectedOptionId: null });
      currentQuizIndex++;
      startQuizQuestion();
    }
  }, 1000);

  const q = activeQuizQuestions[currentQuizIndex];
  document.getElementById('quiz-subtitle').innerText = `Frage ${currentQuizIndex + 1} von ${activeQuizQuestions.length}`;
  document.getElementById('quiz-question-container').innerText = q.question_text;

  const optContainer = document.getElementById('quiz-options-container');
  const optionsList = Array.isArray(q.options) ? q.options : [];

  optContainer.innerHTML = optionsList.map((opt, idx) => {
    const optId = opt.id !== undefined ? opt.id : idx;
    const optText = typeof opt === 'string' ? opt : (opt.text || opt);
    return `<button class="btn btn-secondary" style="text-align: left; margin-top: 0; padding: 10px 14px; font-size: 12px;" onclick="selectQuizAnswer('${q.id}', ${optId})">${optText}</button>`;
  }).join('');
}

function updateQuizTimerDisplay() {
  const timerBadge = document.getElementById('quiz-timer-badge');
  if (timerBadge) timerBadge.innerText = `⏱️ ${quizSecondsLeft}s`;
}

function selectQuizAnswer(questionId, selectedOptionId) {
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  userQuizAnswers.push({ questionId: questionId, selectedOptionId: selectedOptionId });
  currentQuizIndex++;
  startQuizQuestion();
}

async function submitQuizToBackend() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  document.getElementById('quiz-question-container').innerText = 'Wertet Antworten serverseitig aus... ⏳';
  document.getElementById('quiz-options-container').innerHTML = '';
  document.getElementById('quiz-subtitle').innerText = 'Sichere Validierung';

  try {
    const { data, error } = await _supabase.functions.invoke('submit-quiz', {
      body: { answers: userQuizAnswers }
    });

    if (error) throw new Error(error.message || 'Fehler beim Aufruf der Edge Function');

    if (data && data.success) {
      await addPoints(data.earnedPoints || 0);
      document.getElementById('quiz-question-container').innerHTML = `
        <h3 style="color: var(--success); margin-bottom: 6px;">🎉 Quiz erfolgreich beendet!</h3>
        <p>Deine Antworten wurden sicher im Backend ausgewertet.</p>
        <p style="margin-top: 6px; font-size: 15px; color: #818cf8;">Erhaltene Punkte: <strong>+${data.earnedPoints} P</strong> 🚀</p>
      `;
      document.getElementById('quiz-options-container').innerHTML = `<button class="btn" onclick="closeCampusQuizModal()">Fertig</button>`;
    } else {
      throw new Error(data.error || 'Unbekannter Serverfehler');
    }
  } catch (err) {
    document.getElementById('quiz-question-container').innerHTML = `
      <h3 style="color: var(--accent); margin-bottom: 6px;">⚠️ Hinweis</h3>
      <p>${err.message}</p>
    `;
    document.getElementById('quiz-options-container').innerHTML = `<button class="btn btn-secondary" onclick="closeCampusQuizModal()">Schließen</button>`;
  }
}

// --- LEAFLET KARTE ---
function initAdminMap() {
  if (adminMap) {
    adminMap.invalidateSize();
    return;
  }

  const defaultLat = 48.2128;
  const defaultLng = 16.3598;

  adminMap = L.map('admin-map').setView([defaultLat, defaultLng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(adminMap);

  adminMap.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    document.getElementById('admin-drop-lat').value = lat.toFixed(6);
    document.getElementById('admin-drop-lng').value = lng.toFixed(6);

    if (adminMarker) {
      adminMarker.setLatLng([lat, lng]);
    } else {
      adminMarker = L.marker([lat, lng]).addTo(adminMap);
    }
  });
}

// --- SPOTS & DROPS ---
function openActiveSpotsModal() {
  document.getElementById('active-spots-modal').classList.remove('hidden');
  renderActiveSpotsInModal();
}

function closeActiveSpotsModal() {
  document.getElementById('active-spots-modal').classList.add('hidden');
}

function renderActiveSpotsInModal() {
  const listEl = document.getElementById('modal-active-spots-list');
  if (!listEl) return;

  if (allActiveDropsCache.length === 0) {
    listEl.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Aktuell sind keine Partner-Spots aktiv.</p>';
    return;
  }

  listEl.innerHTML = allActiveDropsCache.map(drop => {
    const isClaimed = localStorage.getItem(`claimed_drop_${drop.id}`);
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border);">
        <div>
          <strong style="font-size: 13px; color: var(--text);">📍 ${drop.title}</strong><br>
          <span style="font-size: 11px; color: var(--text-muted);">Belohnung: <strong>${drop.reward_value} ${drop.reward_type === 'points' ? 'Punkte' : 'Badge'}</strong></span>
        </div>
        <div>
          ${isClaimed ? '<span style="color: var(--success); font-weight: 800; font-size: 11px;">Eingesammelt ✅</span>' : `<button class="btn-join" onclick="claimSpecificDrop('${drop.id}')">Einlösen 🎯</button>`}
        </div>
      </div>
    `;
  }).join('');
}

async function loadActiveCampusDrops() {
  try {
    const { data, error } = await _supabase.from('campus_drops').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });

    allActiveDropsCache = data || [];
    const banner = document.getElementById('campus-drop-banner');

    if (allActiveDropsCache.length > 0) {
      activeDropCache = allActiveDropsCache[0];
      const claimedKey = `claimed_drop_${activeDropCache.id}`;
      
      if (localStorage.getItem(claimedKey) || new Date().getTime() > new Date(activeDropCache.expires_at).getTime()) {
        if (banner) banner.style.display = 'none';
      } else {
        let locationInfo = activeDropCache.latitude ? " 📍 [Vor Ort Spot]" : "";
        if (banner) {
          document.getElementById('drop-title-text').innerText = `⚡ FLASH DROP: ${activeDropCache.title}${locationInfo}`;
          const expiresTime = new Date(activeDropCache.expires_at).getTime();
          const now = new Date().getTime();
          const diffMins = Math.max(1, Math.round((expiresTime - now) / 60000));
          const timerText = document.getElementById('drop-timer-text');
          if (timerText) timerText.innerText = `Noch ${diffMins} Minuten aktiv! [Klick auf Punkte für Alle 🎁]`;
          banner.style.display = 'block';
        }
      }
    } else {
      if (banner) banner.style.display = 'none';
      handleFallbackDrop();
    }
  } catch (err) {
    handleFallbackDrop();
  }
}

function handleFallbackDrop() {
  const banner = document.getElementById('campus-drop-banner');
  if (!banner) return;
  const fallbackKey = 'claimed_drop_fallback_test';
  if (localStorage.getItem(fallbackKey)) {
    banner.style.display = 'none';
  } else {
    document.getElementById('drop-title-text').innerText = '⚡ FLASH DROP: 50 Extra-Punkte abholen!';
    const timerText = document.getElementById('drop-timer-text');
    if (timerText) timerText.innerText = 'Exklusiver Campus-Drop! [Klick auf Punkte für Alle 🎁]';
    banner.style.display = 'block';
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function claimActiveDrop() {
  if (activeDropCache) {
    await claimSpecificDrop(activeDropCache.id);
  } else {
    const banner = document.getElementById('campus-drop-banner');
    const fallbackKey = 'claimed_drop_fallback_test';
    if (localStorage.getItem(fallbackKey)) {
      alert('⚠️ Du hast diesen Drop bereits eingesammelt!');
      if (banner) banner.style.display = 'none';
      return;
    }
    await addPoints(50);
    localStorage.setItem(fallbackKey, 'true');
    alert('🎉 Glückwunsch! Du hast dir erfolgreich 50 Hype-Punkte gesichert! 🔥');
    if (banner) banner.style.display = 'none';
  }
}

async function claimSpecificDrop(dropId) {
  const drop = allActiveDropsCache.find(d => d.id === dropId);
  if (!drop) return alert('⚠️ Drop nicht gefunden oder bereits abgelaufen.');

  const claimedKey = `claimed_drop_${drop.id}`;
  if (localStorage.getItem(claimedKey)) return alert('⚠️ Du hast diesen Drop bereits eingesammelt!');

  if (new Date().getTime() > new Date(drop.expires_at).getTime()) return alert('⏳ Dieser Drop ist leider bereits abgelaufen!');

  if (drop.latitude && drop.longitude) {
    if (!navigator.geolocation) return alert('❌ Dein Browser unterstützt keine Standortabfrage.');
    alert('📍 Standort wird geprüft...');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const distance = calculateDistance(position.coords.latitude, position.coords.longitude, drop.latitude, drop.longitude);
      if (distance > (drop.radius || 100)) {
        return alert(`❌ Du bist zu weit entfernt (${Math.round(distance)}m). Bewege dich vor Ort zum Partner-Lokal! 📍`);
      }
    } catch (err) {
      return alert('❌ Standort konnte nicht ermittelt werden.');
    }
  }

  await _supabase.from('drop_claims').insert([{ drop_id: drop.id, user_email: currentUserEmail }]);
  if (drop.reward_type === 'points') {
    const pts = parseInt(drop.reward_value) || 20;
    await addPoints(pts);
    alert(`🎉 Drop vor Ort erfolgreich eingesammelt! +${pts} Punkte! 🚀`);
  } else {
    alert(`🎉 Drop vor Ort eingesammelt! Badge erhalten: ${drop.reward_value} 👑`);
  }

  localStorage.setItem(claimedKey, 'true');
  loadActiveCampusDrops();
  renderActiveSpotsInModal();
}

async function handleCreateCampusDrop() {
  if (currentUserEmail !== MASTER_ADMIN_EMAIL) return alert('⚠️ Nur Administratoren können Campus-Drops erstellen!');

  const title = document.getElementById('admin-drop-title').value.trim();
  const rewardType = document.getElementById('admin-drop-reward-type').value;
  const rewardValue = document.getElementById('admin-drop-reward-value').value.trim();
  const startTimeInput = document.getElementById('admin-drop-start-time').value;
  const lat = parseFloat(document.getElementById('admin-drop-lat').value) || null;
  const lng = parseFloat(document.getElementById('admin-drop-lng').value) || null;
  const radius = parseInt(document.getElementById('admin-drop-radius').value) || 100;

  if (!title || !rewardValue || !startTimeInput) return alert('⚠️ Bitte fülle alle Pflichtfelder aus.');

  const startDate = new Date(startTimeInput);
  const expiresDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const { error } = await _supabase.from('campus_drops').insert([{
    title, reward_type: rewardType, reward_value: rewardValue,
    created_at: startDate.toISOString(), expires_at: expiresDate.toISOString(),
    latitude: lat, longitude: lng, radius
  }]);

  if (error) return alert('Fehler: ' + error.message);

  alert('✅ Campus-Drop erfolgreich erstellt!');
  document.getElementById('admin-drop-title').value = '';
  document.getElementById('admin-drop-reward-value').value = '';
  document.getElementById('admin-drop-start-time').value = '';
  document.getElementById('admin-drop-lat').value = '';
  document.getElementById('admin-drop-lng').value = '';
  if (adminMarker && adminMap) { adminMap.removeLayer(adminMarker); adminMarker = null; }
  loadActiveCampusDrops();
}

function checkMatchWednesday() {
  const today = new Date().getDay();
  if (today === 3) document.documentElement.classList.add('match-wednesday');
  else document.documentElement.classList.remove('match-wednesday');
}

async function initApp() {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  
  await loadProfiles();
  await loadFollows();
  await ensureMyProfileExists();
  updateStreamButtonState();

  loadEvents();
  loadLiveStreams();
  loadMediaPosts();
  loadGlobalChat();
  initRealtime();
  
  switchTab('reels');
  setReelFilter('foryou');
}

function changeLanguage(langCode) {}

function changeAvatarDirectly() {
  const currentUrl = document.getElementById('profile-avatar').value;
  const newUrl = prompt("Gib die Bild-URL für dein neues Profilbild ein:", currentUrl);
  if (newUrl !== null) {
    document.getElementById('profile-avatar').value = newUrl;
    document.getElementById('my-profile-avatar-preview').src = newUrl;
    document.getElementById('header-avatar-preview').src = newUrl;
  }
}

function updateStreamButtonState() {
  const streamBtn = document.getElementById('start-stream-btn');
  if (!streamBtn) return;
  const profile = profilesCache[currentUserEmail] || {};
  streamBtn.disabled = !(currentUserEmail === MASTER_ADMIN_EMAIL || profile.tutorial_completed);
}

function initRealtime() {
  _supabase.channel('public:all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_events' }, () => loadEvents())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => loadLiveStreams())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'global_chat' }, () => loadGlobalChat())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { loadProfiles(); updateStreamButtonState(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => loadFollows())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'media_posts' }, () => loadMediaPosts())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_drops' }, () => loadActiveCampusDrops())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prof_reviews' }, () => loadProfReviews())
    .subscribe();
}

async function loadProfiles() {
  const { data } = await _supabase.from('profiles').select('*');
  if (data) {
    profilesCache = {};
    data.forEach(p => { profilesCache[p.email] = p; });
    renderMyProfileInputs();
    renderUniDuellAndRanking();
    updateStreamButtonState();
  }
}

async function loadFollows() {
  const { data } = await _supabase.from('follows').select('*').eq('follower_email', currentUserEmail);
  followsCache = data ? data.map(f => f.following_email) : [];
  updateFollowerStatsUI();
}

async function ensureMyProfileExists() {
  if (!profilesCache[currentUserEmail]) {
    const defaultUsername = currentUserEmail.split('@')[0];
    await _supabase.from('profiles').insert([{
      email: currentUserEmail, username: defaultUsername, full_name: defaultUsername,
      university: getUniversityFromEmail(currentUserEmail), bio: 'Verified Student 🎓', avatar_url: '',
      interests: ['Campus', 'Kaffee'], verified_student: true, tutorial_completed: false
    }]);
    await loadProfiles();
  }
  renderMyProfileInputs();
  updateStreamButtonState();
}

function getUniversityFromEmail(email) {
  if (email.includes('univie')) return 'Universität Wien';
  if (email.includes('tuwien')) return 'TU Wien';
  if (email.includes('wu')) return 'Wirtschaftsuniversität Wien (WU)';
  if (email.includes('meduniwien')) return 'MedUni Wien';
  if (email.includes('boku')) return 'BOKU Wien';
  return 'Universität Wien';
}

function getCampusRank(points) {
  if (points >= 600) return { title: '👑 Absolute Campus-Legende', color: '#ec4899' };
  if (points >= 300) return { title: '🔥 Campus Insider', color: '#f59e0b' };
  if (points >= 100) return { title: '🍕 Aktiver Fachschaftler', color: '#10b981' };
  return { title: '☕ Frischer Erstie', color: '#818cf8' };
}

function renderMyProfileInputs() {
  const profile = profilesCache[currentUserEmail];
  if (!profile) return;

  document.getElementById('profile-username').value = profile.username || '';
  document.getElementById('profile-fullname').value = profile.full_name || '';
  document.getElementById('profile-university').value = profile.university || 'Universität Wien';
  document.getElementById('profile-bio').value = profile.bio || '';
  document.getElementById('profile-avatar').value = profile.avatar_url || '';
  document.getElementById('profile-interests').value = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';

  document.getElementById('my-profile-display-name').innerText = profile.full_name || profile.username || currentUserEmail.split('@')[0];
  document.getElementById('my-profile-handle-preview').innerText = '@' + (profile.username || 'user');
  
  const rankInfo = getCampusRank(userPoints);
  const rankBadge = document.getElementById('profile-rank-badge');
  if (rankBadge) {
    rankBadge.innerHTML = `${rankInfo.title} <br><span class="verified-badge">🛡️ Verified Student</span>`;
    rankBadge.style.color = rankInfo.color;
    rankBadge.style.borderColor = rankInfo.color;
    rankBadge.style.background = rankInfo.color + '22';
  }

  const avatarUrl = profile.avatar_url || '';
  document.getElementById('my-profile-avatar-preview').src = avatarUrl;
  document.getElementById('header-avatar-preview').src = avatarUrl;

  updateFollowerStatsUI();
  renderMyProfilePostsGrid();
}

function shareProfileCard() {
  const profile = profilesCache[currentUserEmail] || {};
  const handle = profile.username || currentUserEmail.split('@')[0];
  const rankInfo = getCampusRank(userPoints);
  const shareText = `🎓 Hey! Check mein PURE LOGIC Campus-Profil aus:\n\n👤 @${handle}\n🏆 Rang: ${rankInfo.title}\n⭐ Punkte: ${userPoints} P\n\nSei auch dabei beim Wiener Uni-Duell! 🚀`;

  if (navigator.share) {
    navigator.share({ title: 'PURE LOGIC • Campus Profil', text: shareText, url: window.location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText);
    alert('📋 Profil-Text in die Zwischenablage kopiert! Füge ihn in deinen WhatsApp-Status oder deine Insta-Story ein! 🚀');
  }
}

function renderMyProfilePostsGrid() {
  const grid = document.getElementById('my-profile-posts-grid');
  if (!grid) return;
  const myPosts = mediaPostsCache.filter(p => p.author_email === currentUserEmail);
  if (myPosts.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted); font-size:11px; grid-column:span 3; padding:8px 0;">Noch keine eigenen Beiträge.</p>';
    return;
  }
  grid.innerHTML = myPosts.map(p => `
    <div class="profile-grid-item">
      ${p.media_type === 'video' ? `<video src="${p.media_url}"></video>` : `<img src="${p.media_url}" alt="Post">`}
    </div>
  `).join('');
}

async function updateFollowerStatsUI() {
  const { count: followingCount } = await _supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_email', currentUserEmail);
  const { count: followerCount } = await _supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_email', currentUserEmail);
  const statsEl = document.getElementById('follower-stats');
  if (statsEl) statsEl.innerText = `${followerCount || 0} Follower • ${followingCount || 0} Gefolgt`;
}

async function saveMyProfile() {
  const username = document.getElementById('profile-username').value.trim().replace(/^@/, '');
  const full_name = document.getElementById('profile-fullname').value.trim();
  const university = document.getElementById('profile-university').value;
  const bio = document.getElementById('profile-bio').value.trim();
  const avatar_url = document.getElementById('profile-avatar').value.trim();
  const interestsRaw = document.getElementById('profile-interests').value.trim();
  const interests = interestsRaw ? interestsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!username) return alert('Bitte einen Benutzernamen (Handle) eingeben.');

  const { error } = await _supabase.from('profiles').update({
    username, full_name, university, bio, avatar_url, interests
  }).eq('email', currentUserEmail);

  if (error) return alert('Fehler beim Speichern: ' + error.message);

  await addPoints(10);
  await loadProfiles();
  alert('Profil erfolgreich aktualisiert!');
}

function renderUniDuellAndRanking() {
  const duellListEl = document.getElementById('uni-duell-list');
  const creatorsListEl = document.getElementById('top-creators-list');
  if (!duellListEl || !creatorsListEl) return;

  let uniStats = {};
  let usersList = [];

  Object.values(profilesCache).forEach(p => {
    const uni = p.university || 'Universität Wien';
    if (!uniStats[uni]) uniStats[uni] = { totalPoints: 0, studentCount: 0 };
    uniStats[uni].totalPoints += (p.points || 100);
    uniStats[uni].studentCount += 1;

    usersList.push({
      name: p.full_name || p.username || p.email.split('@')[0],
      handle: p.username || 'user',
      avatar: p.avatar_url || '',
      points: p.points || Math.floor(Math.random() * 500) + 50
    });
  });

  let uniRanking = Object.keys(uniStats).map(uni => {
    const stats = uniStats[uni];
    const avg = stats.studentCount > 0 ? Math.round(stats.totalPoints / stats.studentCount) : 0;
    return { uni, avg, count: stats.studentCount };
  });
  uniRanking.sort((a, b) => b.avg - a.avg);

  duellListEl.innerHTML = uniRanking.map((item, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 10px; font-size: 12px;">
      <div><strong>#${index + 1} ${item.uni}</strong> <span style="font-size:10px; color:var(--text-muted);">(${item.count} Studis)</span></div>
      <div style="color: #818cf8; font-weight: 800;">${item.avg} P Ø</div>
    </div>
  `).join('');

  usersList.sort((a, b) => b.points - a.points);
  creatorsListEl.innerHTML = usersList.slice(0, 10).map((u, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 10px; font-size: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; color: ${index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'var(--text-muted)'};">#${index + 1}</span>
        <img src="${u.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; background:var(--border);" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'><path d=\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\'></path><circle cx=\'12\' cy=\'7\' r=\'4\'></circle></svg>'">
        <div><strong>${u.name}</strong><br><span style="font-size:10px; color:var(--text-muted);">@${u.handle}</span></div>
      </div>
      <div style="font-weight: 800; color: var(--success);">${u.points} P</div>
    </div>
  `).join('');
}

function switchTab(tabName) {
  document.querySelectorAll('#bottom-nav-bar .tab-btn').forEach(btn => btn.classList.remove('active'));
  ['live', 'reels', 'feed', 'ranking', 'global', 'inbox', 'profile', 'admin'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.add('hidden');
  });

  const activeBtn = document.getElementById(`btn-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');
  
  if (tabName === 'profile') renderMyProfileInputs();
  if (tabName === 'ranking') renderUniDuellAndRanking();
  if (tabName === 'admin') setTimeout(initAdminMap, 200);

  if (tabName === 'live') {
    document.getElementById('tab-reels').classList.remove('hidden');
    document.getElementById('tab-live').classList.remove('hidden');
    document.getElementById('reel-filter-live').classList.add('active');
    ['discover', 'foryou', 'following'].forEach(f => document.getElementById(`reel-filter-${f}`).classList.remove('active'));
  }
}

function setLiveFilter(element, cat) {
  document.querySelectorAll('#live-filter-group .cat-pill').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  activeLiveFilter = cat;
  renderLiveStreams();
}

function selectGoLiveCategory(element, cat) {
  document.querySelectorAll('#go-live-category-group .cat-pill').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  selectedGoLiveCategory = cat;
}

function openCrushModal() {
  document.getElementById('crush-modal').classList.remove('hidden');
  checkCrushMatches();
}

function closeCrushModal() {
  document.getElementById('crush-modal').classList.add('hidden');
}

async function submitCrush() {
  const target = document.getElementById('crush-target-input').value.trim().toLowerCase();
  const hint = document.getElementById('crush-hint-input').value.trim();
  if (!target) return alert('Bitte gib deinen Crush an.');

  const { error } = await _supabase.from('crushes').insert([{ sender_email: currentUserEmail, target_identifier: target, hint }]);
  if (error) return alert('Fehler: ' + error.message);

  alert('Dein geheimer Crush wurde eingetragen! 💘');
  closeCrushModal();
  checkCrushMatches();
}

async function checkCrushMatches() {
  const box = document.getElementById('crush-matches-box');
  box.innerHTML = '<span style="color:var(--accent);">🔍 Prüfe Radar... ✨</span>';
  
  const { data } = await _supabase.from('crushes').select('*');
  if (!data) return box.innerHTML = '<span style="color:var(--text-muted);">Nicht erreichbar.</span>';

  const myCrushes = data.filter(c => c.sender_email === currentUserEmail);
  let matched = myCrushes.some(c => data.find(item => item.sender_email === c.target_identifier && item.target_identifier === currentUserEmail));

  if (matched) box.innerHTML = '<span style="color:var(--success); font-weight:800;">🎉 IT\'S A MATCH! Blind-Date freigeschaltet! 🥂</span>';
  else box.innerHTML = '<span style="color:var(--text-muted);">🔍 Radar aktiv... Keine Treffer bisher. ✨</span>';
}

function openStreamHelpModal() {
  currentTutorialStep = 1;
  updateTutorialStepUI();
  document.getElementById('tab-live').classList.add('hidden');
  document.getElementById('go-live-modal').classList.add('hidden');
  document.getElementById('bottom-nav-bar').classList.add('hidden');
  document.getElementById('stream-help-modal').classList.remove('hidden');
}

function closeStreamHelpModal() {
  document.getElementById('stream-help-modal').classList.add('hidden');
  document.getElementById('bottom-nav-bar').classList.remove('hidden');
  document.getElementById('tab-live').classList.remove('hidden');
}

function changeTutorialStep(direction) {
  currentTutorialStep += direction;
  if (currentTutorialStep > totalTutorialSteps) return completeTutorialAndProceed();
  if (currentTutorialStep < 1) currentTutorialStep = 1;
  updateTutorialStepUI();
}

function updateTutorialStepUI() {
  document.querySelectorAll('.tutorial-step').forEach(el => {
    el.classList.remove('active');
    if (parseInt(el.getAttribute('data-step')) === currentTutorialStep) el.classList.add('active');
  });
  document.getElementById('tutorial-back-btn').style.display = (currentTutorialStep === 1) ? 'none' : 'block';
  document.getElementById('tutorial-next-btn').innerText = (currentTutorialStep === totalTutorialSteps) ? 'Abschließen & Loslegen ✅' : 'Weiter';
}

async function completeTutorialAndProceed() {
  await _supabase.from('profiles').update({ tutorial_completed: true }).eq('email', currentUserEmail);
  if (profilesCache[currentUserEmail]) profilesCache[currentUserEmail].tutorial_completed = true;
  updateStreamButtonState();
  closeStreamHelpModal();
  openGoLiveModal();
}

function handlePreLiveCheck() {
  const profile = profilesCache[currentUserEmail] || {};
  if (currentUserEmail === MASTER_ADMIN_EMAIL || profile.tutorial_completed) openGoLiveModal();
  else openStreamHelpModal();
}

function openGoLiveModal() {
  document.getElementById('tab-live').classList.add('hidden');
  document.getElementById('bottom-nav-bar').classList.add('hidden');
  document.getElementById('go-live-modal').classList.remove('hidden');
}

function closeGoLiveModal() {
  document.getElementById('go-live-modal').classList.add('hidden');
  document.getElementById('bottom-nav-bar').classList.remove('hidden');
  document.getElementById('tab-live').classList.remove('hidden');
}

async function submitLiveStream() {
  const title = document.getElementById('live-title').value.trim();
  const url = document.getElementById('live-url').value.trim();
  if (!title || !url) return alert('Bitte Titel und URL angeben.');
  const expiresAt = new Date(Date.now() + 3 * 3600000).toISOString();
  await _supabase.from('live_streams').insert([{ host_email: currentUserEmail, title, stream_url: url, category: selectedGoLiveCategory, expires_at: expiresAt }]);
  await addPoints(25);
  closeGoLiveModal();
  loadLiveStreams();
}

async function loadLiveStreams() {
  const { data } = await _supabase.from('live_streams').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  liveStreamsCache = data || [];
  renderLiveStreams();
}

function renderLiveStreams() {
  const list = document.getElementById('live-streams-list');
  let streams = activeLiveFilter === 'Alle' ? liveStreamsCache : liveStreamsCache.filter(s => s.category === activeLiveFilter);
  if (streams.length === 0) return list.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 40px;">Keine Live-Streams aktiv.</p>';
  list.innerHTML = streams.map(s => `
    <div class="live-card">
      <div class="event-header"><div class="event-title">${s.category || '🔴'} ${s.title}</div></div>
      <div class="event-footer"><a href="${s.stream_url}" target="_blank" class="btn-join" style="text-decoration:none;">Stream ansehen</a></div>
    </div>
  `).join('');
}

function openReportModal() { document.getElementById('bottom-nav-bar').classList.add('hidden'); document.getElementById('report-modal').classList.remove('hidden'); }
function closeReportModal() { document.getElementById('report-modal').classList.add('hidden'); document.getElementById('bottom-nav-bar').classList.remove('hidden'); }
async function submitReport() {
  const reason = document.getElementById('report-reason').value;
  const details = document.getElementById('report-details').value.trim();
  await _supabase.from('reports').insert([{ reporter_email: currentUserEmail, reason, details }]);
  alert('Meldung versendet.');
  closeReportModal();
}

function openImpressumModal() { document.getElementById('bottom-nav-bar').classList.add('hidden'); document.getElementById('impressum-modal').classList.remove('hidden'); }
function closeImpressumModal() { document.getElementById('impressum-modal').classList.add('hidden'); document.getElementById('bottom-nav-bar').classList.remove('hidden'); }
function openAgbModal() { document.getElementById('bottom-nav-bar').classList.add('hidden'); document.getElementById('agb-modal').classList.remove('hidden'); }
function closeAgbModal() { document.getElementById('agb-modal').classList.add('hidden'); document.getElementById('bottom-nav-bar').classList.remove('hidden'); }

function setReelFilter(filter) {
  reelFilter = filter;
  ['discover', 'foryou', 'following', 'live'].forEach(f => {
    const el = document.getElementById(`reel-filter-${f}`);
    if (el) el.classList.remove('active');
  });
  document.getElementById(`reel-filter-${filter}`).classList.add('active');
  
  if (filter === 'live') document.getElementById('tab-live').classList.remove('hidden');
  else {
    document.getElementById('tab-live').classList.add('hidden');
    renderMediaPosts();
  }
}

async function loadMediaPosts() {
  const { data } = await _supabase.from('media_posts').select('*').order('created_at', { ascending: false });
  mediaPostsCache = data || [];
  renderMediaPosts();
  renderMyProfilePostsGrid();
}

function renderMediaPosts() {
  const list = document.getElementById('reels-list');
  let posts = [...mediaPostsCache];
  
  if (posts.length === 0) {
    posts = [
      { id: 'mock-1', author_email: 'campus@uni.at', media_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600', media_type: 'image', caption: 'Willkommen am Campus! 🎉' },
      { id: 'mock-2', author_email: 'lounge@uni.at', media_url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600', media_type: 'image', caption: 'Kaffee-Treffen in der Lounge! ☕' }
    ];
  }

  list.innerHTML = posts.map(post => `
    <div class="reel-item">
      ${post.media_type === 'video' ? `<video class="reel-media" src="${post.media_url}" autoplay muted loop playsinline></video>` : `<img class="reel-media" src="${post.media_url}" alt="Post">`}
      <div class="reel-overlay">
        <p style="font-size: 24px; color: white; font-weight: 700; line-height: 1.4; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">${post.caption || ''}</p>
      </div>
    </div>
  `).join('');
}

function openUploadModal() { document.getElementById('upload-modal').classList.remove('hidden'); document.getElementById('bottom-nav-bar').classList.add('hidden'); }
function closeUploadModal() { document.getElementById('upload-modal').classList.add('hidden'); document.getElementById('bottom-nav-bar').classList.remove('hidden'); }

async function submitConfessionPost() {
  const text = document.getElementById('confession-text-input').value.trim();
  if (!text) return alert('Bitte Text eingeben.');
  const bgImages = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600"
  ];
  const randomImg = bgImages[Math.floor(Math.random() * bgImages.length)];
  await _supabase.from('media_posts').insert([{ author_email: 'anonymous@campus.at', media_url: randomImg, media_type: 'image', caption: text, likes: {}, comments: [] }]);
  document.getElementById('confession-text-input').value = '';
  await addPoints(15);
  closeUploadModal();
  loadMediaPosts();
  alert('Confession anonym gepostet! 🤫✨');
}

function togglePasswordVisibility() {
  const pw = document.getElementById('password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
}

function selectCreateCategory(el, cat) {
  document.querySelectorAll('#create-category-group .cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  selectedCategory = cat;
}

function setFilter(el, cat) {
  document.querySelectorAll('#filter-group .cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activeFilter = cat;
  renderEvents();
}

function showMessage(text, isError = true) {
  const box = document.getElementById('auth-msg');
  box.innerText = text;
  box.className = `msg-box ${isError ? 'msg-error' : 'msg-success'}`;
  box.classList.remove('hidden');
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  if (!email || !password) return showMessage('Bitte E-Mail und Passwort eingeben.');

  if (email === MASTER_ADMIN_EMAIL && password === MASTER_ADMIN_PASS) {
    currentUserEmail = email;
    localStorage.setItem('campus_email', currentUserEmail);
    userPoints = 9999;
    setupAdminUI();
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('header-profile-btn').classList.remove('hidden');
    initApp();
    return;
  }

  const { error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) return showMessage('Login fehlgeschlagen: ' + error.message);
  currentUserEmail = email;
  localStorage.setItem('campus_email', currentUserEmail);
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('header-profile-btn').classList.remove('hidden');
  initApp();
}

async function handleSignup() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    return showMessage('Bitte E-Mail und Passwort eingeben.');
  }

  // Harte Zugangsschranke: Prüfen, ob die E-Mail eine gültige Uni-Endung hat
  const isValidUniMail = ALLOWED_DOMAINS.some(domain => email.endsWith(domain));

  if (!isValidUniMail) {
    return showMessage('❌ Registrierung nur mit einer offiziellen Wiener Uni- oder .ac.at-Mailadresse erlaubt!');
  }

  const { error } = await _supabase.auth.signUp({ email, password });
  
  if (error) {
    return showMessage('Fehler bei der Registrierung: ' + error.message);
  }

  const defaultUsername = email.split('@')[0];
  await _supabase.from('profiles').upsert([{
    email: email,
    username: defaultUsername,
    full_name: defaultUsername,
    university: getUniversityFromEmail(email),
    bio: 'Verified Student 🎓',
    verified_student: true,
    tutorial_completed: false
  }]);

  showMessage('✅ Account erstellt! Bitte bestätige deine Uni-E-Mail, um fortzufahren.', false);
}

async function handleForgotPassword() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  if (!email) return showMessage('Bitte E-Mail eingeben.');
  await _supabase.auth.resetPasswordForEmail(email);
  showMessage('E-Mail zum Zurücksetzen gesendet!', false);
}

function setupAdminUI() {
  const badge = document.getElementById('score');
  badge.innerText = '⭐ Admin';
  badge.className = 'points-badge admin-badge';
  badge.onclick = (e) => togglePointsDropdown(e);
}

async function addPoints(amount) {
  if (currentUserEmail === MASTER_ADMIN_EMAIL) {
    userPoints += amount;
    document.getElementById('score').innerText = `${userPoints} P`;
    return;
  }
  userPoints += amount;
  updatePointsDisplay();
  renderMyProfilePostsGrid();
}

function updatePointsDisplay() {
  if (currentUserEmail === MASTER_ADMIN_EMAIL) return;
  document.getElementById('score').innerText = `${userPoints} P`;
}

function resetUser(ask = true) {
  if (!ask || confirm('Abmelden?')) {
    localStorage.removeItem('campus_email');
    _supabase.auth.signOut();
    location.reload();
  }
}

function toggleModal(show) {
  document.getElementById('create-modal').classList.toggle('hidden', !show);
  document.getElementById('bottom-nav-bar').classList.toggle('hidden', show);
  document.getElementById('tab-feed').classList.toggle('hidden', show);
}

async function submitEvent() {
  const title = document.getElementById('title').value.trim();
  const location = document.getElementById('location').value.trim();
  if (!title || !location) return alert('Bitte ausfüllen');
  await _supabase.from('live_events').insert([{ title, location, category: selectedCategory, expires_at: new Date(Date.now() + 7200000).toISOString() }]);
  await addPoints(20);
  toggleModal(false);
  loadEvents();
}

async function loadEvents() {
  const { data } = await _supabase.from('live_events').select('*').gt('expires_at', new Date().toISOString());
  allEventsCache = data || [];
  renderEvents();
}

function renderEvents() {
  const list = document.getElementById('feed-list');
  let filtered = activeFilter === 'Alle' ? allEventsCache : allEventsCache.filter(e => e.category === activeFilter);
  if (filtered.length === 0) return list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:15px;">Keine Treffen.</p>';
  list.innerHTML = filtered.map(e => `
    <div class="event-card">
      <div class="event-title">${e.category || '📍'} ${e.title}</div>
      <div class="event-meta">${e.location}</div>
      <button class="btn-join" onclick="joinEvent('${e.id}')">Bin dabei!</button>
    </div>
  `).join('');
}

async function joinEvent(id) {
  await addPoints(10);
  alert('Angemeldet!');
}

async function loadGlobalChat() {
  const { data } = await _supabase.from('global_chat').select('*').order('created_at', { ascending: true });
  globalChatCache = data || [];
  renderGlobalChat();
}

function renderGlobalChat() {
  const list = document.getElementById('global-chat-list');
  list.innerHTML = globalChatCache.map(m => `<div class="msg-bubble"><strong>${m.user_email.split('@')[0]}:</strong> ${m.message}</div>`).join('');
}

async function sendGlobalMessage() {
  const input = document.getElementById('global-chat-input');
  if (!input.value.trim()) return;
  await _supabase.from('global_chat').insert([{ user_email: currentUserEmail, message: input.value.trim() }]);
  input.value = '';
  loadGlobalChat();
}

async function loadDirectMessages() {
  const recipient = document.getElementById('dm-recipient').value.trim().toLowerCase();
  const list = document.getElementById('dm-chat-list');
  if (!recipient) return;

  const { data } = await _supabase.from('direct_messages').select('*')
    .or(`and(sender_email.eq.${currentUserEmail},recipient_email.eq.${recipient}),and(sender_email.eq.${recipient},recipient_email.eq.${currentUserEmail})`)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Keine Nachrichten.</p>';
  list.innerHTML = data.map(m => `<div class="msg-bubble" style="${m.sender_email === currentUserEmail ? 'background: rgba(99,102,241,0.2);' : ''}"><strong>${m.sender_email.split('@')[0]}:</strong> ${m.message}</div>`).join('');
}

async function sendDirectMessage() {
  const recipient = document.getElementById('dm-recipient').value.trim().toLowerCase();
  const input = document.getElementById('dm-input');
  const msg = input.value.trim();
  if (!recipient || !msg) return alert('Bitte Empfänger und Nachricht eingeben.');

  await _supabase.from('direct_messages').insert([{ sender_email: currentUserEmail, recipient_email: recipient, message: msg }]);
  input.value = '';
  loadDirectMessages();
}