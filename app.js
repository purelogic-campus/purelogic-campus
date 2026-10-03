const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2bLjUm02NS5XDAJMvVDgTA_rSzQKZAe';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MASTER_ADMIN_EMAIL = 'admin@purelogic.app';
const MASTER_ADMIN_PASS = 'Doschi08021991';

const ALLOWED_DOMAINS = ['.ac.at', 'univie.ac.at', 'tuwien.ac.at', 'wu.ac.at', 'meduniwien.ac.at', 'boku.ac.at', 'fhwien.ac.at'];

// Vollautomatischer Rassismus- & Beleidigungsfilter
const FORBIDDEN_REGEX = /\b(schimpfwort1|schimpfwort2|rassismus|hassrede|beleidigung)\b/i;

function containsHateSpeech(text) {
  if (!text) return false;
  const cleaned = text.toLowerCase().trim();
  return FORBIDDEN_REGEX.test(cleaned);
}

// i18n Sprachübersetzungen für alle 10 Sprachen (inkl. Modals, Untermenüs & Buttons)
const translations = {
  de: {
    matchBanner: "💖 MATCH-MITTWOCH • FIND YOUR CRUSH! [Klick fürs Radar 💘]",
    loginBtn: "Einloggen",
    signupBtn: "Account erstellen",
    logoutBtn: "🚪 Logout",
    forgotPw: "Passwort vergessen?",
    chatPlaceholder: "Nachricht an alle...",
    sendBtn: "Senden",
    tabReels: "Feed",
    tabFeed: "Treffen",
    tabGlobal: "Chat",
    tabInbox: "Postfach",
    tabLive: "Live",
    tabRanking: "Ranking",
    tabProfile: "Profil",
    tabAdmin: "Admin",
    subDiscover: "Entdecken",
    subTrending: "Trends",
    subForYou: "Für dich",
    subFollowing: "Gefolgt",
    subAll: "Alle",
    uniDuellBtn: "🏆 Zum Wiener Uni-Duell & Rangliste",
    activeSpotsTitle: "📍 Aktuelle Partner-Spots",
    profGuideTitle: "📚 Prof-Rating & Survival Guide",
    lectureModeTitle: "🎓 Lecture Mode (Fokus)",
    morePointsTitle: "🎁 Mehr Punkte sammeln",
    close: "Schließen",
    save: "Speichern",
    cancel: "Abbrechen",
    authWelcome: "Hey there 👋",
    authSubtitle: "Logge dich ein oder starte direkt durch:",
    emailLabel: "E-Mail-Adresse:",
    emailPlaceholder: "deine.mail@uni.at",
    passwordLabel: "Passwort:",
    passwordPlaceholder: "Dein geheimes Passwort",
    flashDropTitle: "⚡ FLASH DROP: 50 Extra-Punkte!",
    flashDropTimer: "Nur für kurze Zeit verfügbar! [Jetzt tippen 🎁]",
    lectureModeHeader: "🎓 Hörsaal-Fokusmodus",
    lectureModeSub: "Ablenkungsfrei & Akku-schonend",
    lectureModeExit: "Modus beenden ✕",
    lectureNotesPlaceholder: "Schreibe hier deine Vorlesungsnotizen mit...",
    saveNotesTitle: "💾 Notiz auf Gerät speichern:",
    fileNamePlaceholder: "Dateiname (z.B. Vorlesung_Mathe)",
    formatLabel: "Format:",
    formatTxt: ".txt (Textdatei)",
    formatPdf: ".pdf (Dokument)",
    downloadFileBtn: "📥 Als Datei herunterladen",
    liveHeader: "🔴 Campus Live & Mods",
    helpBtn: "💡 Hilfe",
    startStreamBtn: "+ Stream starten",
    liveFilterAll: "Alle Live",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Musik",
    liveFilterChat: "💬 Plaudern",
    liveFilterScience: "🔬 Lernen & Wissenschaft",
    loadingStreams: "Lade Live-Streams...",
    loadingFeeds: "Lade Campus-Feeds...",
    meetupsHeader: "Spontane Treffen",
    createBtn: "+ Erstellen",
    filterAll: "Alle",
    filterCoffee: "☕ Kaffee",
    filterStudy: "📖 Lernen",
    filterBeer: "🍺 Bier",
    filterSport: "🏀 Sport",
    loadingMeetups: "Lade Treffen...",
    rankingHeader: "🏆 Uni-Duell & Top 100",
    rankingReset: "Reset So. 23:59",
    wienerDuellBoxTitle: "🎓 Wiener Uni-Duell (Pro-Kopf)",
    loadingUniDuell: "Berechne Uni-Wertung...",
    wallOfFameTitle: "⭐ Wall of Fame (Top Creator)",
    loadingTopCreators: "Lade Top Creator...",
    loadingChat: "Lade Campus-Chat...",
    recipientLabel: "Empfänger (E-Mail):",
    recipientPlaceholder: "kommilitone@uni.at",
    inboxPrompt: "Gib oben eine E-Mail ein, um zu schreiben.",
    dmPlaceholder: "Direktnachricht...",
    followerStatsDefault: "0 Follower • 0 Gefolgt",
    shareCardHeader: "🚀 Zeig dein Campus-Level!",
    shareCardText: "Teile deinen Status in deiner WhatsApp-Status oder Insta-Story und hol dir Extrapunkte!",
    shareBtn: "📲 Profil in WhatsApp / Insta teilen",
    labelUsername: "Benutzername (Handle):",
    labelFullname: "Anzeigename:",
    labelUniversity: "Deine Universität:",
    labelBio: "Bio / Über mich:",
    labelAvatar: "Profilbild URL:",
    labelInterests: "Interessen (mit Komma getrennt):",
    saveProfileBtn: "Profil speichern (+10 P)",
    myPostsHeader: "Deine Beiträge",
    adminHeader: "⚡ Admin-Interface: Campus-Drops & Test-Tools",
    adminSub: "Verwalte hier Drops und teste dein Punktekonto im Admin-Modus.",
    adminTestPointsHeader: "🧪 Admin Test-Modus: Punkte simulieren",
    adminTestPointsSub: "Da du als Admin bist, kannst du hier deinen Test-Punktestand direkt anpassen:",
    setPointsBtn: "Punkte setzen",
    createDropHeader: "📍 Neuen Campus-Drop erstellen",
    dropTitleLabel: "Drop Titel / Info:",
    rewardTypeLabel: "Belohnungs-Typ:",
    rewardPoints: "Punkte (z. B. 50)",
    rewardBadge: "Spezial-Badge",
    rewardValueLabel: "Wert (Punktzahl oder Badge-Name):",
    startTimeLabel: "Startzeitpunkt (Datum & Uhrzeit):",
    mapSelectLabel: "📍 Spot auf Karte auswählen (Klick setzt Marker):",
    latLabel: "Latitude (Breitengrad):",
    lngLabel: "Longitude (Längengrad):",
    radiusLabel: "Radius in Metern (z. B. 100m vor Ort):",
    createDropBtn: "Drop mit GPS-Bindung freigeben 🚀",
    footerReport: "🚨 Inhalt melden",
    footerImpressum: "Impressum",
    footerAgb: "AGB",
    morePointsModalTitle: "🎁 Mehr Punkte sammeln",
    morePointsModalSub: "Wähle eine Methode, um deinen Punktestand und dein Uni-Ranking zu pushen:",
    quizCardTitle: "🧠 Tägliches Campus- & Allgemein-Quiz",
    quizCardSub: "Teste dein Wissen in 15 Sek. pro Frage & hol dir Bonuspunkte!",
    spotsCardTitle: "📍 Vor-Ort Campus-Drops",
    spotsCardSub: "Checke aktive Partner-Spots in Wien ab.",
    socialCardTitle: "📲 Profil & Social Sharing",
    socialCardSub: "Teile deine Erfolge in WhatsApp / Insta für Hype-Punkte.",
    writeReviewBtn: "+ Review schreiben",
    profGuideSub: "Altklausuren-Tipps, Prof-Erfahrungen und Schwierigkeitsgrade.",
    reviewFormTitle: "✍️ Neue Erfahrung teilen",
    profNamePlaceholder: "Name des Professors (z. B. Prof. Müller)",
    profSubjectPlaceholder: "Modul / Vorlesung (z. B. Analysis 1)",
    ratingLabel: "Bewertung:",
    difficultyLabel: "Schwierigkeit:",
    profCommentPlaceholder: "Insider-Tipps, Altklausuren...",
    submitReviewBtn: "Abschicken (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Nach Prof oder Fach suchen...",
    loadingReviews: "Lade Bewertungen...",
    quizModalTitle: "🧠 Campus & Allgemein Quiz",
    quizSubLoading: "Frage laden...",
    quizQuestionsLoading: "Lade Fragen...",
    activeSpotsModalTitle: "📍 Aktuelle Campus- & Partner-Spots",
    activeSpotsModalSub: "Gehe zum Spot vor Ort, um Punkte einzusammeln!",
    crushModalTitle: "💖 Anonymes Crush Radar",
    crushModalSub: "Trage deinen Campus-Crush ein. Bei gegenseitigem Match gibt es ein Blind-Date!",
    crushTargetLabel: "Crush (E-Mail oder @handle):",
    crushTargetPlaceholder: "crush@uni.at oder @username",
    crushHintLabel: "Geheimer Hinweis (optional):",
    crushHintPlaceholder: "z.b. Bib Reihe 4...",
    crushSubmitBtn: "Abschicken & Hoffen 💘"
  },
  en: {
    matchBanner: "💖 MATCH-WEDNESDAY • FIND YOUR CRUSH! [Click for Radar 💘]",
    loginBtn: "Log In",
    signupBtn: "Create Account",
    logoutBtn: "🚪 Logout",
    forgotPw: "Forgot password?",
    chatPlaceholder: "Message everyone...",
    sendBtn: "Send",
    tabReels: "Feed",
    tabFeed: "Meetups",
    tabGlobal: "Chat",
    tabInbox: "Inbox",
    tabLive: "Live",
    tabRanking: "Ranking",
    tabProfile: "Profile",
    tabAdmin: "Admin",
    subDiscover: "Discover",
    subTrending: "Trending",
    subForYou: "For You",
    subFollowing: "Following",
    subAll: "All",
    uniDuellBtn: "🏆 To Vienna Uni-Duel & Ranking",
    activeSpotsTitle: "📍 Current Partner Spots",
    profGuideTitle: "📚 Prof Rating & Survival Guide",
    lectureModeTitle: "🎓 Lecture Mode (Focus)",
    morePointsTitle: "🎁 Earn More Points",
    close: "Close",
    save: "Save",
    cancel: "Cancel",
    authWelcome: "Hey there 👋",
    authSubtitle: "Log in or get started right away:",
    emailLabel: "Email Address:",
    emailPlaceholder: "your.mail@uni.at",
    passwordLabel: "Password:",
    passwordPlaceholder: "Your secret password",
    flashDropTitle: "⚡ FLASH DROP: 50 Extra Points!",
    flashDropTimer: "Available for a limited time! [Tap now 🎁]",
    lectureModeHeader: "🎓 Lecture Focus Mode",
    lectureModeSub: "Distraction-free & battery saver",
    lectureModeExit: "Exit Mode ✕",
    lectureNotesPlaceholder: "Take your lecture notes here...",
    saveNotesTitle: "💾 Save note to device:",
    fileNamePlaceholder: "Filename (e.g. Lecture_Math)",
    formatLabel: "Format:",
    formatTxt: ".txt (Text file)",
    formatPdf: ".pdf (Document)",
    downloadFileBtn: "📥 Download as File",
    liveHeader: "🔴 Campus Live & Mods",
    helpBtn: "💡 Help",
    startStreamBtn: "+ Start Stream",
    liveFilterAll: "All Live",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Music",
    liveFilterChat: "💬 Chat",
    liveFilterScience: "🔬 Study & Science",
    loadingStreams: "Loading live streams...",
    loadingFeeds: "Loading campus feeds...",
    meetupsHeader: "Spontaneous Meetups",
    createBtn: "+ Create",
    filterAll: "All",
    filterCoffee: "☕ Coffee",
    filterStudy: "📖 Study",
    filterBeer: "🍺 Beer",
    filterSport: "🏀 Sport",
    loadingMeetups: "Loading meetups...",
    rankingHeader: "🏆 Uni Duel & Top 100",
    rankingReset: "Reset Sun. 23:59",
    wienerDuellBoxTitle: "🎓 Vienna Uni Duel (Per Capita)",
    loadingUniDuell: "Calculating uni stats...",
    wallOfFameTitle: "⭐ Wall of Fame (Top Creator)",
    loadingTopCreators: "Loading top creators...",
    loadingChat: "Loading campus chat...",
    recipientLabel: "Recipient (Email):",
    recipientPlaceholder: "colleague@uni.at",
    inboxPrompt: "Enter an email above to start writing.",
    dmPlaceholder: "Direct message...",
    followerStatsDefault: "0 Followers • 0 Following",
    shareCardHeader: "🚀 Show Your Campus Level!",
    shareCardText: "Share your status in your WhatsApp status or Insta story and earn extra points!",
    shareBtn: "📲 Share Profile to WhatsApp / Insta",
    labelUsername: "Username (Handle):",
    labelFullname: "Display Name:",
    labelUniversity: "Your University:",
    labelBio: "Bio / About me:",
    labelAvatar: "Profile Picture URL:",
    labelInterests: "Interests (comma separated):",
    saveProfileBtn: "Save Profile (+10 P)",
    myPostsHeader: "Your Posts",
    adminHeader: "⚡ Admin Interface: Campus Drops & Test Tools",
    adminSub: "Manage drops here and test your points in admin mode.",
    adminTestPointsHeader: "🧪 Admin Test Mode: Simulate Points",
    adminTestPointsSub: "Since you are admin, you can directly adjust your test point balance here:",
    setPointsBtn: "Set Points",
    createDropHeader: "📍 Create New Campus Drop",
    dropTitleLabel: "Drop Title / Info:",
    rewardTypeLabel: "Reward Type:",
    rewardPoints: "Points (e.g. 50)",
    rewardBadge: "Special Badge",
    rewardValueLabel: "Value (Points or Badge Name):",
    startTimeLabel: "Start Time (Date & Time):",
    mapSelectLabel: "📍 Select Spot on Map (Click places marker):",
    latLabel: "Latitude:",
    lngLabel: "Longitude:",
    radiusLabel: "Radius in meters (e.g. 100m on site):",
    createDropBtn: "Release Drop with GPS Bind 🚀",
    footerReport: "🚨 Report Content",
    footerImpressum: "Imprint",
    footerAgb: "T&C",
    morePointsModalTitle: "🎁 Earn More Points",
    morePointsModalSub: "Choose a method to boost your points and university ranking:",
    quizCardTitle: "🧠 Daily Campus & General Quiz",
    quizCardSub: "Test your knowledge in 15 sec per question & get bonus points!",
    spotsCardTitle: "📍 On-Site Campus Drops",
    spotsCardSub: "Check out active partner spots in Vienna.",
    socialCardTitle: "📲 Profile & Social Sharing",
    socialCardSub: "Share your achievements on WhatsApp / Insta for Hype points.",
    writeReviewBtn: "+ Write Review",
    profGuideSub: "Past exam tips, professor experiences, and difficulty levels.",
    reviewFormTitle: "✍️️ Share New Experience",
    profNamePlaceholder: "Professor Name (e.g. Prof. Müller)",
    profSubjectPlaceholder: "Module / Lecture (e.g. Analysis 1)",
    ratingLabel: "Rating:",
    difficultyLabel: "Difficulty:",
    profCommentPlaceholder: "Insider tips, past exams...",
    submitReviewBtn: "Submit (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Search prof or subject...",
    loadingReviews: "Loading reviews...",
    quizModalTitle: "🧠 Campus & General Quiz",
    quizSubLoading: "Loading question...",
    quizQuestionsLoading: "Loading questions...",
    activeSpotsModalTitle: "📍 Current Campus & Partner Spots",
    activeSpotsModalSub: "Go to the spot on-site to collect points!",
    crushModalTitle: "💖 Anonymous Crush Radar",
    crushModalSub: "Enter your campus crush. Mutual matches unlock a blind date!",
    crushTargetLabel: "Crush (Email or @handle):",
    crushTargetPlaceholder: "crush@uni.at o @username",
    crushHintLabel: "Secret hint (optional):",
    crushHintPlaceholder: "e.g. Library Row 4...",
    crushSubmitBtn: "Submit & Hope 💘"
  },
  it: {
    matchBanner: "💖 MATCH-MERCOLEDÌ • TROVA IL TUO CRUSH! [Clicca per il Radar 💘]",
    loginBtn: "Accedi",
    signupBtn: "Crea account",
    logoutBtn: "🚪 Esci",
    forgotPw: "Password dimenticata?",
    chatPlaceholder: "Messaggio a tutti...",
    sendBtn: "Invia",
    tabReels: "Feed",
    tabFeed: "Incontri",
    tabGlobal: "Chat",
    tabInbox: "Posta",
    tabLive: "Live",
    tabRanking: "Classifica",
    tabProfile: "Profilo",
    tabAdmin: "Admin",
    subDiscover: "Scopri",
    subTrending: "Tendenze",
    subForYou: "Per te",
    subFollowing: "Seguiti",
    subAll: "Tutti",
    uniDuellBtn: "🏆 Al Duello Universitario & Classifica",
    activeSpotsTitle: "📍 Spot Partner Attuali",
    profGuideTitle: "📚 Valutazione Prof & Guida",
    lectureModeTitle: "🎓 Modalità Lezione (Focus)",
    morePointsTitle: "🎁 Guadagna Più Punti",
    close: "Chiudi",
    save: "Salva",
    cancel: "Annulla",
    authWelcome: "Ciao 👋",
    authSubtitle: "Accedi o inizia subito:",
    emailLabel: "Indirizzo Email:",
    emailPlaceholder: "tua.mail@uni.at",
    passwordLabel: "Password:",
    passwordPlaceholder: "La tua password segreta",
    flashDropTitle: "⚡ FLASH DROP: 50 Punti Extra!",
    flashDropTimer: "Disponibile per un periodo limitato! [Tocca ora 🎁]",
    lectureModeHeader: "🎓 Modalità Focus Lezione",
    lectureModeSub: "Senza distrazioni e risparmio batteria",
    lectureModeExit: "Esci dalla modalità ✕",
    lectureNotesPlaceholder: "Prendi qui i tuoi appunti di lezione...",
    saveNotesTitle: "💾 Salva nota sul dispositivo:",
    fileNamePlaceholder: "Nome file (es. Lezione_Matematica)",
    formatLabel: "Formato:",
    formatTxt: ".txt (File di testo)",
    formatPdf: ".pdf (Documento)",
    downloadFileBtn: "📥 Scarica come file",
    liveHeader: "🔴 Campus Live & Mod",
    helpBtn: "💡 Aiuto",
    startStreamBtn: "+ Avvia Stream",
    liveFilterAll: "Tutti i Live",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Musica",
    liveFilterChat: "💬 Chat",
    liveFilterScience: "🔬 Studio & Scienza",
    loadingStreams: "Caricamento live stream...",
    loadingFeeds: "Caricamento feed campus...",
    meetupsHeader: "Incontri Spontanei",
    createBtn: "+ Crea",
    filterAll: "Tutti",
    filterCoffee: "☕ Caffè",
    filterStudy: "📖 Studio",
    filterBeer: "🍺 Birra",
    filterSport: "🏀 Sport",
    loadingMeetups: "Caricamento incontri...",
    rankingHeader: "🏆 Duello Universitario & Top 100",
    rankingReset: "Reset Dom. 23:59",
    wienerDuellBoxTitle: "🎓 Duello Universitario (Pro capite)",
    loadingUniDuell: "Calcolo statistiche universitarie...",
    wallOfFameTitle: "⭐ Wall of Fame (Top Creator)",
    loadingTopCreators: "Caricamento top creator...",
    loadingChat: "Caricamento chat campus...",
    recipientLabel: "Destinatario (Email):",
    recipientPlaceholder: "collega@uni.at",
    inboxPrompt: "Inserisci un'email sopra per iniziare a scrivere.",
    dmPlaceholder: "Messaggio diretto...",
    followerStatsDefault: "0 Follower • 0 Seguiti",
    shareCardHeader: "🚀 Mostra il tuo livello nel campus!",
    shareCardText: "Condividi il tuo stato su WhatsApp o Instagram e guadagna punti extra!",
    shareBtn: "📲 Condividi profilo su WhatsApp / Insta",
    labelUsername: "Nome utente (Handle):",
    labelFullname: "Nome visualizzato:",
    labelUniversity: "La tua Università:",
    labelBio: "Bio / Chi sono:",
    labelAvatar: "URL immagine profilo:",
    labelInterests: "Interessi (separati da virgola):",
    saveProfileBtn: "Salva profilo (+10 P)",
    myPostsHeader: "I tuoi post",
    adminHeader: "⚡ Interfaccia Admin: Drop & Strumenti di Test",
    adminSub: "Gestisci i drop qui e testa i tuoi punti in modalità admin.",
    adminTestPointsHeader: "🧪 Modalità Test Admin: Simula Punti",
    adminTestPointsSub: "Essendo admin, puoi regolare direttamente il tuo saldo punti di test:",
    setPointsBtn: "Imposta Punti",
    createDropHeader: "📍 Crea Nuovo Drop nel Campus",
    dropTitleLabel: "Titolo Drop / Info:",
    rewardTypeLabel: "Tipo di Premio:",
    rewardPoints: "Punti (es. 50)",
    rewardBadge: "Badge Speciale",
    rewardValueLabel: "Valore (Punti o Nome Badge):",
    startTimeLabel: "Orario di Inizio (Data & Ora):",
    mapSelectLabel: "📍 Seleziona spot sulla mappa (Il click posiziona il marker):",
    latLabel: "Latitudine:",
    lngLabel: "Longitudine:",
    radiusLabel: "Raggio in metri (es. 100m sul posto):",
    createDropBtn: "Rilascia Drop con GPS 🚀",
    footerReport: "🚨 Segnala Contenuto",
    footerImpressum: "Note Legali",
    footerAgb: "Termini",
    morePointsModalTitle: "🎁 Guadagna Più Punti",
    morePointsModalSub: "Scegli un metodo per aumentare i tuoi punti e il ranking universitario:",
    quizCardTitle: "🧠 Quiz Giornaliero Campus & Cultura",
    quizCardSub: "Mettiti alla prova in 15 sec a domanda & vinci punti bonus!",
    spotsCardTitle: "📍 Drop sul Posto",
    spotsCardSub: "Scopri i locali partner attivi a Vienna.",
    socialCardTitle: "📲 Profilo & Social Sharing",
    socialCardSub: "Condividi i tuoi successi su WhatsApp / Insta per punti Hype.",
    writeReviewBtn: "+ Scrivi Review",
    profGuideSub: "Consigli sugli esami passati, esperienze con i professori e difficoltà.",
    reviewFormTitle: "✍️ Condividi Nuova Esperienza",
    profNamePlaceholder: "Nome del Professore (es. Prof. Müller)",
    profSubjectPlaceholder: "Modulo / Lezione (es. Analisi 1)",
    ratingLabel: "Valutazione:",
    difficultyLabel: "Difficoltà:",
    profCommentPlaceholder: "Consigli utili, esami passati...",
    submitReviewBtn: "Invia (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Cerca prof o materia...",
    loadingReviews: "Caricamento recensioni...",
    quizModalTitle: "🧠 Quiz Campus & Cultura",
    quizSubLoading: "Caricamento domanda...",
    quizQuestionsLoading: "Caricamento domande...",
    activeSpotsModalTitle: "📍 Spot Partner & Campus Attuali",
    activeSpotsModalSub: "Vai sul posto per raccogliere punti!",
    crushModalTitle: "💖 Radar Crush Anonimo",
    crushModalSub: "Inserisci la tua crush nel campus. Match reciproci sbloccano un appuntamento al buio!",
    crushTargetLabel: "Crush (Email o @handle):",
    crushTargetPlaceholder: "crush@uni.at o @username",
    crushHintLabel: "Indizio segreto (opzionale):",
    crushHintPlaceholder: "es. Biblioteca Fila 4...",
    crushSubmitBtn: "Invia & Spera 💘"
  },
  bks: {
    matchBanner: "💖 MATCH-SRIJEDA • PRONAĐI SVOG CRUSHA! [Klik za Radar 💘]",
    loginBtn: "Prijava",
    signupBtn: "Kreiraj račun",
    logoutBtn: "🚪 Odjava",
    forgotPw: "Zaboravljena lozinka?",
    chatPlaceholder: "Poruka svima...",
    sendBtn: "Pošalji",
    tabReels: "Feed",
    tabFeed: "Susreti",
    tabGlobal: "Chat",
    tabInbox: "Sandučić",
    tabLive: "Live",
    tabRanking: "Poredak",
    tabProfile: "Profil",
    tabAdmin: "Admin",
    subDiscover: "Otkrij",
    subTrending: "U trendu",
    subForYou: "Za tebe",
    subFollowing: "Praćeno",
    subAll: "Svi",
    uniDuellBtn: "🏆 Na Bečki Uni-Duel i Poredak",
    activeSpotsTitle: "📍 Trenutne Partner Lokacije",
    profGuideTitle: "📚 Ocjene Profesora i Vodič",
    lectureModeTitle: "🎓 Način predavanja (Fokus)",
    morePointsTitle: "🎁 Zaradi više bodova",
    close: "Zatvori",
    save: "Spremi",
    cancel: "Odustani",
    authWelcome: "Bok 👋",
    authSubtitle: "Prijavi se ili zapeni odmah:",
    emailLabel: "Email adresa:",
    emailPlaceholder: "tvoja.mail@uni.at",
    passwordLabel: "Lozinka:",
    passwordPlaceholder: "Tvoja tajna lozinka",
    flashDropTitle: "⚡ FLASH DROP: 50 Extra Bodova!",
    flashDropTimer: "Dostupno samo kratko! [Klikni odmah 🎁]",
    lectureModeHeader: "🎓 Fokus način predavanja",
    lectureModeSub: "Bez ometanja i štednja baterije",
    lectureModeExit: "Izađi iz načina ✕",
    lectureNotesPlaceholder: "Piši bilješke sa predavanja ovdje...",
    saveNotesTitle: "💾 Spremi bilješku na uređaj:",
    fileNamePlaceholder: "Naziv datoteke (npr. Predavanje_Matematika)",
    formatLabel: "Format:",
    formatTxt: ".txt (Tekstualna datoteka)",
    formatPdf: ".pdf (Dokument)",
    downloadFileBtn: "📥 Preuzmi kao datoteku",
    liveHeader: "🔴 Campus Live & Mods",
    helpBtn: "💡 Pomoć",
    startStreamBtn: "+ Pokreni Stream",
    liveFilterAll: "Svi Live",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Glazba",
    liveFilterChat: "💬 Razgovor",
    liveFilterScience: "🔬 Učenje i znanost",
    loadingStreams: "Učitavam live streamove...",
    loadingFeeds: "Učitavam campus feedove...",
    meetupsHeader: "Spontana okupljanja",
    createBtn: "+ Kreiraj",
    filterAll: "Svi",
    filterCoffee: "☕ Kava",
    filterStudy: "📖 Učenje",
    filterBeer: "🍺 Pivo",
    filterSport: "🏀 Sport",
    loadingMeetups: "Učitavam susrete...",
    rankingHeader: "🏆 Uni-Duel & Top 100",
    rankingReset: "Reset Ned. 23:59",
    wienerDuellBoxTitle: "🎓 Bečki Uni-Duel (Po glavi)",
    loadingUniDuell: "Računam uni statistiku...",
    wallOfFameTitle: "⭐ Wall of Fame (Top Creator)",
    loadingTopCreators: "Učitavam top creatore...",
    loadingChat: "Učitavam campus chat...",
    recipientLabel: "Primatelj (Email):",
    recipientPlaceholder: "kolega@uni.at",
    inboxPrompt: "Unesi email gore za početak pisanja.",
    dmPlaceholder: "Izravna poruka...",
    followerStatsDefault: "0 Pratitelja • 0 Praćenih",
    shareCardHeader: "🚀 Pokaži svoju razinu!",
    shareCardText: "Podijeli svoj status na WhatsAppu ili Instagramu i osvoji dodatne bodove!",
    shareBtn: "📲 Podijeli profil na WhatsApp / Insta",
    labelUsername: "Korisničko ime (Handle):",
    labelFullname: "Prikazano ime:",
    labelUniversity: "Tvoje sveučilište:",
    labelBio: "Biografija / O meni:",
    labelAvatar: "URL slike profila:",
    labelInterests: "Interesi (odvojeni zarezom):",
    saveProfileBtn: "Spremi profil (+10 P)",
    myPostsHeader: "Tvoje objave",
    adminHeader: "⚡ Admin sučelje: Campus Dropovi & Alati",
    adminSub: "Upravljaj dropovima ovdje i testiraj bodove u admin načinu.",
    adminTestPointsHeader: "🧪 Admin Test Način: Simuliraj Bodove",
    adminTestPointsSub: "Kao admin, ovdje možeš direktno prilagoditi stanje testnih bodova:",
    setPointsBtn: "Postavi bodove",
    createDropHeader: "📍 Kreiraj novi Campus Drop",
    dropTitleLabel: "Naslov Dropa / Info:",
    rewardTypeLabel: "Vrsta nagrade:",
    rewardPoints: "Bodovi (npr. 50)",
    rewardBadge: "Specijalna značka",
    rewardValueLabel: "Vrijednost (Bodovi ili Naziv značke):",
    startTimeLabel: "Vrijeme početka (Datum i Vrijeme):",
    mapSelectLabel: "📍 Odaberi lokaciju na karti (Klik postavlja marker):",
    latLabel: "Geografska širina:",
    lngLabel: "Geografska dužina:",
    radiusLabel: "Radijus u metrima (npr. 100m na lokaciji):",
    createDropBtn: "Objavi Drop s GPS vezom 🚀",
    footerReport: "🚨 Prijavi sadržaj",
    footerImpressum: "Impresum",
    footerAgb: "Uvjeti",
    morePointsModalTitle: "🎁 Zaradi više bodova",
    morePointsModalSub: "Odaberi metodu za povećanje bodova i rang liste:",
    quizCardTitle: "🧠 Dnevni Kviz Znanja",
    quizCardSub: "Testiraj znanje u 15 sek po pitanju i osvoji bonus bodove!",
    spotsCardTitle: "📍 Lokacijski Dropovi",
    spotsCardSub: "Provjeri aktivne partnerske lokacije u Beču.",
    socialCardTitle: "📲 Profil & Social Sharing",
    socialCardSub: "Podijeli uspjehe na WhatsAppu / Instagramu za Hype bodove.",
    writeReviewBtn: "+ Napiši recenziju",
    profGuideSub: "Savjeti za ispite, iskustva s profesorima i težina.",
    reviewFormTitle: "✍️ Podijeli novo iskustvo",
    profNamePlaceholder: "Ime profesora (npr. Prof. Müller)",
    profSubjectPlaceholder: "Kolegij / Predavanje (npr. Analiza 1)",
    ratingLabel: "Ocjena:",
    difficultyLabel: "Težina:",
    profCommentPlaceholder: "Insajderski savjeti, stari ispiti...",
    submitReviewBtn: "Pošalji (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Pretraži profesora ili predmet...",
    loadingReviews: "Učitavam recenzije...",
    quizModalTitle: "🧠 Campus & Opći Kviz",
    quizSubLoading: "Učitavam pitanje...",
    quizQuestionsLoading: "Učitavam pitanja...",
    activeSpotsModalTitle: "📍 Trenutne Partner Lokacije",
    activeSpotsModalSub: "Idi na lokaciju na licu mjesta za sakupljanje bodova!",
    crushModalTitle: "💖 Anonimni Crush Radar",
    crushModalSub: "Unesi svog crusha. Obostrano podudaranje otvara spoj naslijepo!",
    crushTargetLabel: "Crush (Email ili @handle):",
    crushTargetPlaceholder: "crush@uni.at ili @username",
    crushHintLabel: "Tajna napomena (opcionalno):",
    crushHintPlaceholder: "npr. Knjižnica red 4...",
    crushSubmitBtn: "Pošalji & Nadaj se 💘"
  },
  tr: {
    matchBanner: "💖 MATCH-ÇARŞAMBA • CRUSH'INI BUL! [Radar için Tıkla 💘]",
    loginBtn: "Giriş Yap",
    signupBtn: "Hesap Oluştur",
    logoutBtn: "🚪 Çıkış",
    forgotPw: "Şifremi unuttum?",
    chatPlaceholder: "Herkese mesaj...",
    sendBtn: "Gönder",
    tabReels: "Akış",
    tabFeed: "Buluşmalar",
    tabGlobal: "Sohbet",
    tabInbox: "Gelen Kutusu",
    tabLive: "Canlı",
    tabRanking: "Sıralama",
    tabProfile: "Profil",
    tabAdmin: "Yönetici",
    subDiscover: "Keşfet",
    subTrending: "Trendler",
    subForYou: "Sizin İçin",
    subFollowing: "Takip Edilen",
    subAll: "Tümü",
    uniDuellBtn: "🏆 Viyana Üniversite Düellosu ve Sıralama",
    activeSpotsTitle: "📍 Güncel İş Ortamı Noktaları",
    profGuideTitle: "📚 Profesör Değerlendirmeleri ve Rehber",
    lectureModeTitle: "🎓 Ders Modu (Odak)",
    morePointsTitle: "🎁 Daha Fazla Puan Kazan",
    close: "Kapat",
    save: "Kaydet",
    cancel: "İptal",
    authWelcome: "Merhaba 👋",
    authSubtitle: "Giriş yap veya hemen başla:",
    emailLabel: "E-posta Adresi:",
    emailPlaceholder: "senin.mail@uni.at",
    passwordLabel: "Şifre:",
    passwordPlaceholder: "Gizli şifren",
    flashDropTitle: "⚡ FLASH DROP: 50 Ekstra Puan!",
    flashDropTimer: "Sınırlı süre için aktif! [Hemen tıkla 🎁]",
    lectureModeHeader: "🎓 Ders Odak Modu",
    lectureModeSub: "Dikkat dağıtmayan & pil tasarruflu",
    lectureModeExit: "Moddan Çık ✕",
    lectureNotesPlaceholder: "Ders notlarını buraya al...",
    saveNotesTitle: "💾 Notu cihaza kaydet:",
    fileNamePlaceholder: "Dosya adı (örn. Ders_Matematik)",
    formatLabel: "Biçim:",
    formatTxt: ".txt (Metin dosyası)",
    formatPdf: ".pdf (Belge)",
    downloadFileBtn: "📥 Dosya olarak indir",
    liveHeader: "🔴 Kampüs Canlı & Modlar",
    helpBtn: "💡 Yardım",
    startStreamBtn: "+ Yayın Başlat",
    liveFilterAll: "Tüm Canlılar",
    liveFilterGaming: "🎮 Oyun",
    liveFilterMusic: "🎵 Müzik",
    liveFilterChat: "💬 Sohbet",
    liveFilterScience: "🔬 Çalışma & Bilim",
    loadingStreams: "Canlı yayınlar yükleniyor...",
    loadingFeeds: "Kampüs akışı yükleniyor...",
    meetupsHeader: "Spontane Buluşmalar",
    createBtn: "+ Oluştur",
    filterAll: "Tümü",
    filterCoffee: "☕ Kahve",
    filterStudy: "📖 Çalışma",
    filterBeer: "🍺 Bira",
    filterSport: "🏀 Spor",
    loadingMeetups: "Buluşmalar yükleniyor...",
    rankingHeader: "🏆 Üniversite Düellosu & İlk 100",
    rankingReset: "Sıfırlama Pazar 23:59",
    wienerDuellBoxTitle: "🎓 Viyana Üniversite Düellosu (Kişi Başı)",
    loadingUniDuell: "Üniversite istatistikleri hesaplanıyor...",
    wallOfFameTitle: "⭐ Onur Listesi (En İyi İçerik Üreticiler)",
    loadingTopCreators: "En iyiler yükleniyor...",
    loadingChat: "Kampüs sohbeti yükleniyor...",
    recipientLabel: "Alıcı (E-posta):",
    recipientPlaceholder: "meslektas@uni.at",
    inboxPrompt: "Yazmaya başlamak için yukarıya bir e-posta girin.",
    dmPlaceholder: "Doğrudan mesaj...",
    followerStatsDefault: "0 Takipçi • 0 Takip Edilen",
    shareCardHeader: "🚀 Kampüs Seviyeni Göster!",
    shareCardText: "Durumunu WhatsApp veya Instagram'da paylaşarak ekstra puanlar kazan!",
    shareBtn: "📲 Profili WhatsApp / Insta'da Paylaş",
    labelUsername: "Kullanıcı Adı (Handle):",
    labelFullname: "Görünen Ad:",
    labelUniversity: "Üniversiten:",
    labelBio: "Hakkımda / Bio:",
    labelAvatar: "Profil Resmi URL:",
    labelInterests: "İlgi Alanları (virgülle ayırın):",
    saveProfileBtn: "Profili Kaydet (+10 P)",
    myPostsHeader: "Gönderilerin",
    adminHeader: "⚡ Yönetici Paneli: Kampüs Drop'ları & Araçlar",
    adminSub: "Drop'ları yönet ve yönetici modunda puanlarını test et.",
    adminTestPointsHeader: "🧪 Yönetici Test Modu: Puan Simülasyonu",
    adminTestPointsSub: "Yönetici olduğun için test puanı bakiyeni buradan doğrudan ayarlayabilirsin:",
    setPointsBtn: "Puanları Ayarla",
    createDropHeader: "📍 Yeni Kampüs Drop'u Oluştur",
    dropTitleLabel: "Drop Başlığı / Bilgi:",
    rewardTypeLabel: "Ödül Türü:",
    rewardPoints: "Puan (örn. 50)",
    rewardBadge: "Özel Rozet",
    rewardValueLabel: "Değer (Puan veya Rozet Adı):",
    startTimeLabel: "Başlangıç Zamanı (Tarih & Saat):",
    mapSelectLabel: "📍 Haritadan Nokta Seç (Tıklama işaretçi koyar):",
    latLabel: "Enlem:",
    lngLabel: "Boylam:",
    radiusLabel: "Metre cinsinden yarıçap (örn. 100m):",
    createDropBtn: "GPS Bağlantılı Drop'u Yayınla 🚀",
    footerReport: "🚨 İçeriği Bildir",
    footerImpressum: "Künye",
    footerAgb: "Şartlar",
    morePointsModalTitle: "🎁 Daha Fazla Puan Kazan",
    morePointsModalSub: "Puanlarını ve üniversite sıralamanı artırmak için bir yöntem seç:",
    quizCardTitle: "🧠 Günlük Kampüs & Genel Kültür Testi",
    quizCardSub: "Soruları 15 saniyede çöz, bonus puanları kap!",
    spotsCardTitle: "📍 Yerinde Kampüs Drop'ları",
    spotsCardSub: "Viyana'daki aktif partner mekanları kontrol et.",
    socialCardTitle: "📲 Profil & Sosyal Paylaşım",
    socialCardSub: "Başarılarını WhatsApp / Insta'da paylaş, Hype puanları kazan.",
    writeReviewBtn: "+ İnceleme Yaz",
    profGuideSub: "Geçmiş sınav ipuçları, profesör deneyimleri ve zorluk dereceleri.",
    reviewFormTitle: "✍️ Yeni Deneyim Paylaş",
    profNamePlaceholder: "Profesör Adı (örn. Prof. Müller)",
    profSubjectPlaceholder: "Ders / Modül (örn. Analiz 1)",
    ratingLabel: "Değerlendirme:",
    difficultyLabel: "Zorluk:",
    profCommentPlaceholder: "İçeriden ipuçları, çıkmış sorular...",
    submitReviewBtn: "Gönder (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Profesör veya ders ara...",
    loadingReviews: "Değerlendirmeler yükleniyor...",
    quizModalTitle: "🧠 Kampüs & Genel Test",
    quizSubLoading: "Soru yükleniyor...",
    quizQuestionsLoading: "Sorular yükleniyor...",
    activeSpotsModalTitle: "📍 Güncel Partner Noktaları",
    activeSpotsModalSub: "Puan toplamak için yerinde noktaya git!",
    crushModalTitle: "💖 Anonim Crush Radarı",
    crushModalSub: "Kampüs crush'ını gir. Karşılıklı eşleşmede kör randevu açılır!",
    crushTargetLabel: "Crush (E-posta veya @handle):",
    crushTargetPlaceholder: "crush@uni.at veya @username",
    crushHintLabel: "Gizli ipucu (isteğe bağlı):",
    crushHintPlaceholder: "örn. Kütüphane Sıra 4...",
    crushSubmitBtn: "Gönder & Umut Et 💘"
  },
  es: {
    matchBanner: "💖 MATCH-MIÉRCOLES • ¡ENCUENTRA A TU CRUSH! [Haz clic para el Radar 💘]",
    loginBtn: "Iniciar sesión",
    signupBtn: "Crear cuenta",
    logoutBtn: "🚪 Cerrar sesión",
    forgotPw: "¿Olvidaste tu contraseña?",
    chatPlaceholder: "Mensaje para todos...",
    sendBtn: "Enviar",
    tabReels: "Feed",
    tabFeed: "Encuentros",
    tabGlobal: "Chat",
    tabInbox: "Buzón",
    tabLive: "En vivo",
    tabRanking: "Ranking",
    tabProfile: "Perfil",
    tabAdmin: "Admin",
    subDiscover: "Descubrir",
    subTrending: "Tendencias",
    subForYou: "Para ti",
    subFollowing: "Siguiendo",
    subAll: "Todos",
    uniDuellBtn: "🏆 Al Duelo Universitario de Viena y Ranking",
    activeSpotsTitle: "📍 Puntos de Socios Actuales",
    profGuideTitle: "📚 Calificación de Profesores y Guía",
    lectureModeTitle: "🎓 Modo Conferencia (Enfoque)",
    morePointsTitle: "🎁 Gana Más Puntos",
    close: "Cerrar",
    save: "Guardar",
    cancel: "Cancelar",
    authWelcome: "Hola 👋",
    authSubtitle: "Inicia sesión o comienza de inmediato:",
    emailLabel: "Correo Electrónico:",
    emailPlaceholder: "tu.correo@uni.at",
    passwordLabel: "Contraseña:",
    passwordPlaceholder: "Tu contraseña secreta",
    flashDropTitle: "⚡ FLASH DROP: ¡50 Puntos Extra!",
    flashDropTimer: "¡Disponible por tiempo limitado! [Toca ahora 🎁]",
    lectureModeHeader: "🎓 Modo Enfoque de Clase",
    lectureModeSub: "Sin distracciones y ahorrador de batería",
    lectureModeExit: "Salir del modo ✕",
    lectureNotesPlaceholder: "Toma tus apuntes de clase aquí...",
    saveNotesTitle: "💾 Guardar nota en el dispositivo:",
    fileNamePlaceholder: "Nombre de archivo (ej. Clase_Mate)",
    formatLabel: "Formato:",
    formatTxt: ".txt (Archivo de texto)",
    formatPdf: ".pdf (Documento)",
    downloadFileBtn: "📥 Descargar como archivo",
    liveHeader: "🔴 Campus En Vivo y Mods",
    helpBtn: "💡 Ayuda",
    startStreamBtn: "+ Iniciar Stream",
    liveFilterAll: "Todos en Vivo",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Música",
    liveFilterChat: "💬 Chat",
    liveFilterScience: "🔬 Estudio y Ciencia",
    loadingStreams: "Cargando transmisiones en vivo...",
    loadingFeeds: "Cargando feeds del campus...",
    meetupsHeader: "Encuentros Espontáneos",
    createBtn: "+ Crear",
    filterAll: "Todos",
    filterCoffee: "☕ Café",
    filterStudy: "📖 Estudio",
    filterBeer: "🍺 Cerveza",
    filterSport: "🏀 Deporte",
    loadingMeetups: "Cargando encuentros...",
    rankingHeader: "🏆 Duelo Universitario y Top 100",
    rankingReset: "Reinicio Dom. 23:59",
    wienerDuellBoxTitle: "🎓 Duelo Universitario de Viena (Per Cápita)",
    loadingUniDuell: "Calculando estadísticas...",
    wallOfFameTitle: "⭐ Salón de la Fama (Top Creadores)",
    loadingTopCreators: "Cargando creadores...",
    loadingChat: "Cargando chat del campus...",
    recipientLabel: "Destinatario (Email):",
    recipientPlaceholder: "colega@uni.at",
    inboxPrompt: "Introduce un correo arriba para empezar a escribir.",
    dmPlaceholder: "Mensaje directo...",
    followerStatsDefault: "0 Seguidores • 0 Siguiendo",
    shareCardHeader: "🚀 ¡Muestra tu nivel en el campus!",
    shareCardText: "¡Comparte tu estado en tu WhatsApp o historia de Instagram y gana puntos extra!",
    shareBtn: "📲 Compartir perfil en WhatsApp / Insta",
    labelUsername: "Nombre de usuario (Handle):",
    labelFullname: "Nombre visible:",
    labelUniversity: "Tu Universidad:",
    labelBio: "Biografía / Sobre mí:",
    labelAvatar: "URL de foto de perfil:",
    labelInterests: "Intereses (separados por comas):",
    saveProfileBtn: "Guardar perfil (+10 P)",
    myPostsHeader: "Tus publicaciones",
    adminHeader: "⚡ Panel Admin: Campus Drops y Herramientas",
    adminSub: "Gestiona los drops aquí y prueba tus puntos en modo admin.",
    adminTestPointsHeader: "🧪 Modo Prueba Admin: Simular Puntos",
    adminTestPointsSub: "Como eres admin, puedes ajustar directamente tu saldo de puntos de prueba:",
    setPointsBtn: "Establecer Puntos",
    createDropHeader: "📍 Crear Nuevo Campus Drop",
    dropTitleLabel: "Título / Info del Drop:",
    rewardTypeLabel: "Tipo de Recompensa:",
    rewardPoints: "Puntos (ej. 50)",
    rewardBadge: "Insignia Especial",
    rewardValueLabel: "Valor (Puntos o Nombre de Insignia):",
    startTimeLabel: "Hora de Inicio (Fecha y Hora):",
    mapSelectLabel: "📍 Seleccionar punto en mapa (El clic coloca el marcador):",
    latLabel: "Latitud:",
    lngLabel: "Longitud:",
    radiusLabel: "Radio en metros (ej. 100m en el lugar):",
    createDropBtn: "Publicar Drop con Enlace GPS 🚀",
    footerReport: "🚨 Reportar Contenido",
    footerImpressum: "Aviso Legal",
    footerAgb: "Términos",
    morePointsModalTitle: "🎁 Gana Más Puntos",
    morePointsModalSub: "Elige un método para impulsar tus puntos y tu ranking universitario:",
    quizCardTitle: "🧠 Cuestionario Diario del Campus",
    quizCardSub: "¡Pon a prueba tus conocimientos en 15 seg por pregunta y gana puntos extra!",
    spotsCardTitle: "📍 Campus Drops en el Lugar",
    spotsCardSub: "Consulta los locales asociados activos en Viena.",
    socialCardTitle: "📲 Perfil y Compartir Social",
    socialCardSub: "Comparte tus logros en WhatsApp / Insta para ganar puntos Hype.",
    writeReviewBtn: "+ Escribir Reseña",
    profGuideSub: "Consejos de exámenes pasados, experiencias con profes y niveles de dificultad.",
    reviewFormTitle: "✍️ Compartir Nueva Experiencia",
    profNamePlaceholder: "Nombre del Profesor (ej. Prof. Müller)",
    profSubjectPlaceholder: "Módulo / Conferencia (ej. Análisis 1)",
    ratingLabel: "Calificación:",
    difficultyLabel: "Dificultad:",
    profCommentPlaceholder: "Consejos de expertos, exámenes pasados...",
    submitReviewBtn: "Enviar (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Buscar profesor o materia...",
    loadingReviews: "Cargando reseñas...",
    quizModalTitle: "🧠 Cuestionario del Campus",
    quizSubLoading: "Cargando pregunta...",
    quizQuestionsLoading: "Cargando preguntas...",
    activeSpotsModalTitle: "📍 Puntos de Socios Actuales",
    activeSpotsModalSub: "¡Ve al lugar en persona para conseguir puntos!",
    crushModalTitle: "💖 Radar de Crush Anónimo",
    crushModalSub: "Ingresa tu crush del campus. ¡Las coincidencias mutuas desbloquean una cita a ciegas!",
    crushTargetLabel: "Crush (Email o @handle):",
    crushTargetPlaceholder: "crush@uni.at o @username",
    crushHintLabel: "Pista secreta (opcional):",
    crushHintPlaceholder: "ej. Biblioteca Fila 4...",
    crushSubmitBtn: "Enviar y Esperar 💘"
  },
  fr: {
    matchBanner: "💖 MATCH-MERCREDI • TROUVE TON CRUSH ! [Clique pour le Radar 💘]",
    loginBtn: "Se connecter",
    signupBtn: "Créer un compte",
    logoutBtn: "🚪 Déconnexion",
    forgotPw: "Mot de passe oublié ?",
    chatPlaceholder: "Message à tous...",
    sendBtn: "Envoyer",
    tabReels: "Fil",
    tabFeed: "Rencontres",
    tabGlobal: "Chat",
    tabInbox: "Boîte de réception",
    tabLive: "En direct",
    tabRanking: "Classement",
    tabProfile: "Profil",
    tabAdmin: "Admin",
    subDiscover: "Découvrir",
    subTrending: "Tendances",
    subForYou: "Pour vous",
    subFollowing: "Abonnements",
    subAll: "Tous",
    uniDuellBtn: "🏆 Au Duel Universitaire de Vienne & Classement",
    activeSpotsTitle: "📍 Points Partenaires Actuels",
    profGuideTitle: "📚 Évaluation des Profs & Guide",
    lectureModeTitle: "🎓 Mode Cours (Focus)",
    morePointsTitle: "🎁 Gagner Plus de Points",
    close: "Fermer",
    save: "Enregistrer",
    cancel: "Annuler",
    authWelcome: "Salut 👋",
    authSubtitle: "Connecte-toi ou commence dès maintenant :",
    emailLabel: "Adresse e-mail :",
    emailPlaceholder: "ton.mail@uni.at",
    passwordLabel: "Mot de passe :",
    passwordPlaceholder: "Ton mot de passe secret",
    flashDropTitle: "⚡ FLASH DROP : 50 points extra !",
    flashDropTimer: "Disponible pour une durée limitée ! [Appuie ici 🎁]",
    lectureModeHeader: "🎓 Mode Focus Cours",
    lectureModeSub: "Sans distraction & économie de batterie",
    lectureModeExit: "Quitter le mode ✕",
    lectureNotesPlaceholder: "Prends tes notes de cours ici...",
    saveNotesTitle: "💾 Enregistrer la note sur l'appareil :",
    fileNamePlaceholder: "Nom de fichier (ex. Cours_Maths)",
    formatLabel: "Format :",
    formatTxt: ".txt (Fichier texte)",
    formatPdf: ".pdf (Document)",
    downloadFileBtn: "📥 Télécharger en fichier",
    liveHeader: "🔴 Campus Live & Mods",
    helpBtn: "💡 Aide",
    startStreamBtn: "+ Lancer un stream",
    liveFilterAll: "Tous les Live",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Musique",
    liveFilterChat: "💬 Discussion",
    liveFilterScience: "🔬 Études & Science",
    loadingStreams: "Chargement des diffusions en direct...",
    loadingFeeds: "Chargement des flux du campus...",
    meetupsHeader: "Rencontres Spontanées",
    createBtn: "+ Créer",
    filterAll: "Tous",
    filterCoffee: "☕ Café",
    filterStudy: "📖 Études",
    filterBeer: "🍺 Bière",
    filterSport: "🏀 Sport",
    loadingMeetups: "Chargement des rencontres...",
    rankingHeader: "🏆 Duel Universitaire & Top 100",
    rankingReset: "Réinit. Dim. 23:59",
    wienerDuellBoxTitle: "🎓 Duel Universitaire de Vienne (Par habitant)",
    loadingUniDuell: "Calcul des statistiques uni...",
    wallOfFameTitle: "⭐ Wall of Fame (Top Créateurs)",
    loadingTopCreators: "Chargement des créateurs...",
    loadingChat: "Chargement du chat du campus...",
    recipientLabel: "Destinataire (E-mail) :",
    recipientPlaceholder: "collegue@uni.at",
    inboxPrompt: "Entre un e-mail ci-dessus pour commencer à écrire.",
    dmPlaceholder: "Message direct...",
    followerStatsDefault: "0 Abonnés • 0 Abonnements",
    shareCardHeader: "🚀 Montre ton niveau sur le campus !",
    shareCardText: "Partage ton statut dans ta story WhatsApp ou Insta et gagne des points bonus !",
    shareBtn: "📲 Partager le profil sur WhatsApp / Insta",
    labelUsername: "Nom d'utilisateur (Handle) :",
    labelFullname: "Nom d'affichage :",
    labelUniversity: "Ton Université :",
    labelBio: "Bio / À propos :",
    labelAvatar: "URL de la photo de profil :",
    labelInterests: "Centres d'intérêt (séparés par des virgules) :",
    saveProfileBtn: "Enregistrer le profil (+10 P)",
    myPostsHeader: "Tes publications",
    adminHeader: "⚡ Interface Admin : Campus Drops & Outils",
    adminSub: "Gère les drops ici et teste tes points en mode admin.",
    adminTestPointsHeader: "🧪 Mode Test Admin : Simuler des points",
    adminTestPointsSub: "Puisque tu es admin, tu peux ajuster directement ton solde de points de test :",
    setPointsBtn: "Définir les points",
    createDropHeader: "📍 Créer un nouveau Campus Drop",
    dropTitleLabel: "Titre du Drop / Info :",
    rewardTypeLabel: "Type de récompense :",
    rewardPoints: "Points (ex. 50)",
    rewardBadge: "Badge Spécial",
    rewardValueLabel: "Valeur (Points ou Nom du badge) :",
    startTimeLabel: "Heure de début (Date & Heure) :",
    mapSelectLabel: "📍 Sélectionner un spot sur la carte (Le clic place un marqueur) :",
    latLabel: "Latitude :",
    lngLabel: "Longitude :",
    radiusLabel: "Rayon en mètres (ex. 100m sur place) :",
    createDropBtn: "Publier le Drop avec liaison GPS 🚀",
    footerReport: "🚨 Signaler un contenu",
    footerImpressum: "Mentions légales",
    footerAgb: "CGV",
    morePointsModalTitle: "🎁 Gagner Plus de Points",
    morePointsModalSub: "Choisis une méthode pour booster tes points et ton classement universitaire :",
    quizCardTitle: "🧠 Quiz Quotidien du Campus",
    quizCardSub: "Teste tes connaissances en 15 sec par question & gagne des points bonus !",
    spotsCardTitle: "📍 Campus Drops sur place",
    spotsCardSub: "Découvre les lieux partenaires actifs à Vienne.",
    socialCardTitle: "📲 Profil & Partage Social",
    socialCardSub: "Partage tes succès sur WhatsApp / Insta pour des points Hype.",
    writeReviewBtn: "+ Écrire un avis",
    profGuideSub: "Conseils d'examens, expériences avec les profs et niveaux de difficulté.",
    reviewFormTitle: "✍️ Partager une nouvelle expérience",
    profNamePlaceholder: "Nom du professeur (ex. Prof. Müller)",
    profSubjectPlaceholder: "Module / Cours (ex. Analyse 1)",
    ratingLabel: "Évaluation :",
    difficultyLabel: "Difficulté :",
    profCommentPlaceholder: "Astuces d'initiés, anciens examens...",
    submitReviewBtn: "Envoyer (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Rechercher un prof ou une matière...",
    loadingReviews: "Chargement des avis...",
    quizModalTitle: "🧠 Quiz du Campus",
    quizSubLoading: "Chargement de la question...",
    quizQuestionsLoading: "Chargement des questions...",
    activeSpotsModalTitle: "📍 Points Partenaires Actuels",
    activeSpotsModalSub: "Rends-toi sur place pour récupérer des points !",
    crushModalTitle: "💖 Radar Crush Anonyme",
    crushModalSub: "Entre ton crush du campus. Un match mutuel débloque un blind date !",
    crushTargetLabel: "Crush (E-mail ou @handle) :",
    crushTargetPlaceholder: "crush@uni.at ou @username",
    crushHintLabel: "Indice secret (optionnel) :",
    crushHintPlaceholder: "ex. Bib Rangée 4...",
    crushSubmitBtn: "Envoyer & Espérer 💘"
  },
  pl: {
    matchBanner: "💖 MATCH-ŚRODA • ZNAJDŹ SWOJEGO CRUSHA! [Kliknij po Radar 💘]",
    loginBtn: "Zaloguj się",
    signupBtn: "Utwórz konto",
    logoutBtn: "🚪 Wyloguj",
    forgotPw: "Zapomniałeś hasła?",
    chatPlaceholder: "Wiadomość do wszystkich...",
    sendBtn: "Wyślij",
    tabReels: "Tablica",
    tabFeed: "Spotkania",
    tabGlobal: "Czat",
    tabInbox: "Skrzynka",
    tabLive: "Na żywo",
    tabRanking: "Ranking",
    tabProfile: "Profil",
    tabAdmin: "Admin",
    subDiscover: "Odkryj",
    subTrending: "Trendy",
    subForYou: "Dla Ciebie",
    subFollowing: "Obserwowane",
    subAll: "Wszystkie",
    uniDuellBtn: "🏆 Do Wiedeńskiego Pojedynku Uczelni i Rankingu",
    activeSpotsTitle: "📍 Aktualne Punkty Partnerskie",
    profGuideTitle: "📚 Oceny Profesorów i Przewodnik",
    lectureModeTitle: "🎓 Tryb Wykładu (Fokus)",
    morePointsTitle: "🎁 Zdobądź Więcej Punktów",
    close: "Zamknij",
    save: "Zapisz",
    cancel: "Anuluj",
    authWelcome: "Cześć 👋",
    authSubtitle: "Zaloguj się lub zacznij od razu:",
    emailLabel: "Adres e-mail:",
    emailPlaceholder: "twoj.mail@uni.at",
    passwordLabel: "Hasło:",
    passwordPlaceholder: "Twoje tajne hasło",
    flashDropTitle: "⚡ FLASH DROP: 50 dodatkowych punktów!",
    flashDropTimer: "Dostępne przez ograniczony czas! [Kliknij teraz 🎁]",
    lectureModeHeader: "🎓 Tryb skupienia na wykładzie",
    lectureModeSub: "Bez rozpraszaczy i oszczędzanie baterii",
    lectureModeExit: "Wyjdź z trybu ✕",
    lectureNotesPlaceholder: "Rób notatki z wykładu tutaj...",
    saveNotesTitle: "💾 Zapisz notatkę na urządzeniu:",
    fileNamePlaceholder: "Nazwa pliku (np. Wykład_Matma)",
    formatLabel: "Format:",
    formatTxt: ".txt (Plik tekstowy)",
    formatPdf: ".pdf (Dokument)",
    downloadFileBtn: "📥 Pobierz jako plik",
    liveHeader: "🔴 Kampus Na Żywo i Mody",
    helpBtn: "💡 Pomoc",
    startStreamBtn: "+ Rozpocznij Stream",
    liveFilterAll: "Wszystkie na żywo",
    liveFilterGaming: "🎮 Gaming",
    liveFilterMusic: "🎵 Muzyka",
    liveFilterChat: "💬 Czat",
    liveFilterScience: "🔬 Nauka i Studia",
    loadingStreams: "Ładowanie transmisji...",
    loadingFeeds: "Ładowanie wpisów z kampusu...",
    meetupsHeader: "Spontaniczne spotkania",
    createBtn: "+ Utwórz",
    filterAll: "Wszystkie",
    filterCoffee: "☕ Kawa",
    filterStudy: "📖 Nauka",
    filterBeer: "🍺 Piwo",
    filterSport: "🏀 Sport",
    loadingMeetups: "Ładowanie spotkań...",
    rankingHeader: "🏆 Pojedynek Uczelni & Top 100",
    rankingReset: "Reset Nd. 23:59",
    wienerDuellBoxTitle: "🎓 Wiedeński Pojedynek Uczelni (Na osobę)",
    loadingUniDuell: "Obliczanie statystyk uczelni...",
    wallOfFameTitle: "⭐ Wall of Fame (Najlepsi Twórcy)",
    loadingTopCreators: "Ładowanie twórców...",
    loadingChat: "Ładowanie czatu kampusu...",
    recipientLabel: "Odbiorca (E-mail):",
    recipientPlaceholder: "kolega@uni.at",
    inboxPrompt: "Wpisz e-mail powyżej, aby zacząć pisać.",
    dmPlaceholder: "Wiadomość bezpośrednia...",
    followerStatsDefault: "0 Obserwujących • 0 Obserwowanych",
    shareCardHeader: "🚀 Pokaż swój poziom w kampusie!",
    shareCardText: "Udostępnij swój status na statusie WhatsApp lub Insta i zdobądź dodatkowe punkty!",
    shareBtn: "📲 Udostępnij profil na WhatsApp / Insta",
    labelUsername: "Nazwa użytkownika (Handle):",
    labelFullname: "Wyświetlana nazwa:",
    labelUniversity: "Twoja Uczelnia:",
    labelBio: "Bio / O mnie:",
    labelAvatar: "URL zdjęcia profilowego:",
    labelInterests: "Zainteresowania (oddzielone przecinkami):",
    saveProfileBtn: "Zapisz profil (+10 P)",
    myPostsHeader: "Twoje posty",
    adminHeader: "⚡ Panel Admina: Dropy i Narzędzia",
    adminSub: "Zarządzaj dropami tutaj i testuj punkty w trybie admina.",
    adminTestPointsHeader: "🧪 Tryb Testowy Admina: Symuluj Punkty",
    adminTestPointsSub: "Jako admin możesz bezpośrednio dostosować stan punktów testowych:",
    setPointsBtn: "Ustaw punkty",
    createDropHeader: "📍 Utwórz nowy Campus Drop",
    dropTitleLabel: "Tytuł Dropu / Info:",
    rewardTypeLabel: "Typ nagrody:",
    rewardPoints: "Punkty (np. 50)",
    rewardBadge: "Specjalna odznaka",
    rewardValueLabel: "Wartość (Punkty lub Nazwa odznaki):",
    startTimeLabel: "Czas rozpoczęcia (Data i Godzina):",
    mapSelectLabel: "📍 Wybierz punkt na mapie (Kliknięcie stawia znacznik):",
    latLabel: "Szerokość geograficzna:",
    lngLabel: "Długość geograficzna:",
    radiusLabel: "Promień w metrach (np. 100m na miejscu):",
    createDropBtn: "Opublikuj Drop z powiązaniem GPS 🚀",
    footerReport: "🚨 Zgłoś treść",
    footerImpressum: "Redakcja",
    footerAgb: "Regulamin",
    morePointsModalTitle: "🎁 Zdobądź Więcej Punktów",
    morePointsModalSub: "Wybierz metodę, aby zwiększyć swoje punkty i ranking uczelni:",
    quizCardTitle: "🧠 Codzienny Quiz Kampusu",
    quizCardSub: "Sprawdź swoją wiedzę w 15 sek na pytanie i zgarnij punkty bonusowe!",
    spotsCardTitle: "📍 Dropy na miejscu",
    spotsCardSub: "Sprawdź aktywne lokale partnerskie w Wiedniu.",
    socialCardTitle: "📲 Profil i Social Sharing",
    socialCardSub: "Udostępnij swoje osiągnięcia na WhatsApp / Insta dla punktów Hype.",
    writeReviewBtn: "+ Napisz recenzję",
    profGuideSub: "Wskazówki do egzaminów, doświadczenia z profesorami i poziom trudności.",
    reviewFormTitle: "✍️ Podziel się nowym doświadczeniem",
    profNamePlaceholder: "Nazwisko profesora (np. Prof. Müller)",
    profSubjectPlaceholder: "Moduł / Wykład (np. Analiza 1)",
    ratingLabel: "Ocena:",
    difficultyLabel: "Trudność:",
    profCommentPlaceholder: "Wskazówki, stare egzaminy...",
    submitReviewBtn: "Wyślij (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Szukaj profesora lub przedmiotu...",
    loadingReviews: "Ładowanie recenzji...",
    quizModalTitle: "🧠 Quiz Kampusu",
    quizSubLoading: "Ładowanie pytania...",
    quizQuestionsLoading: "Ładowanie pytań...",
    activeSpotsModalTitle: "📍 Aktualne Punkty Partnerskie",
    activeSpotsModalSub: "Udaj się na miejsce, aby zebrać punkty!",
    crushModalTitle: "💖 Anonimowy Radar Crush",
    crushModalSub: "Wpisz swojego crusha z kampusu. Wzajemne dopasowanie odblokowuje randkę w ciemno!",
    crushTargetLabel: "Crush (E-mail lub @handle):",
    crushTargetPlaceholder: "crush@uni.at lub @username",
    crushHintLabel: "Sekretna wskazówka (opcjonalnie):",
    crushHintPlaceholder: "np. Biblioteka Rząd 4...",
    crushSubmitBtn: "Wyślij i Miej Nadzieję 💘"
  },
  hu: {
    matchBanner: "💖 MATCH-SZERDA • TALÁLD MEG A CRUSH-EDET! [Kattints a Radarért 💘]",
    loginBtn: "Bejelentkezés",
    signupBtn: "Fiók létrehozása",
    logoutBtn: "🚪 Kijelentkezés",
    forgotPw: "Elfelejtetted a jelszavad?",
    chatPlaceholder: "Üzenet mindenkinek...",
    sendBtn: "Küldés",
    tabReels: "Hírfolyam",
    tabFeed: "Találkozók",
    tabGlobal: "Csevegés",
    tabInbox: "Beérkező",
    tabLive: "Élő",
    tabRanking: "Rangsor",
    tabProfile: "Profil",
    tabAdmin: "Admin",
    subDiscover: "Felfedezés",
    subTrending: "Felkapott",
    subForYou: "Neked",
    subFollowing: "Követett",
    subAll: "Összes",
    uniDuellBtn: "🏆 A Bécsi Egyetemi Párbajhoz és Rangsorhoz",
    activeSpotsTitle: "📍 Aktuális Partner Helyszínek",
    profGuideTitle: "📚 Prof Értékelések és Útmutató",
    lectureModeTitle: "🎓 Előadás Mód (Fókusz)",
    morePointsTitle: "🎁 Szerezz Több Pontot",
    close: "Bezárás",
    save: "Mentés",
    cancel: "Mégse",
    authWelcome: "Helló 👋",
    authSubtitle: "Jelentkezz be vagy kezdj bele azonnal:",
    emailLabel: "E-mail cím:",
    emailPlaceholder: "a.te.cimed@uni.at",
    passwordLabel: "Jelszó:",
    passwordPlaceholder: "A titkos jelszavad",
    flashDropTitle: "⚡ FLASH DROP: 50 Extra Pont!",
    flashDropTimer: "Csak korlátozott ideig elérhető! [Kattints most 🎁]",
    lectureModeHeader: "🎓 Előadás Fókusz Mód",
    lectureModeSub: "Zavarmentes & akkumulátorkímélő",
    lectureModeExit: "Mód bezárása ✕",
    lectureNotesPlaceholder: "Írd ide az előadás jegyzeteidet...",
    saveNotesTitle: "💾 Jegyzet mentése eszközre:",
    fileNamePlaceholder: "Fájlnév (pl. Elöadas_Matematika)",
    formatLabel: "Formátum:",
    formatTxt: ".txt (Szöveges fájl)",
    formatPdf: ".pdf (Dokumentum)",
    downloadFileBtn: "📥 Letöltés fájlként",
    liveHeader: "🔴 Campus Élő & Modok",
    helpBtn: "💡 Súgó",
    startStreamBtn: "+ Stream Indítása",
    liveFilterAll: "Összes Élő",
    liveFilterGaming: "🎮 Játék",
    liveFilterMusic: "🎵 Zene",
    liveFilterChat: "💬 Csevegés",
    liveFilterScience: "🔬 Tanulás & Tudomány",
    loadingStreams: "Élő közvetítések betöltése...",
    loadingFeeds: "Campus hírfolyam betöltése...",
    meetupsHeader: "Spontán Találkozók",
    createBtn: "+ Létrehozás",
    filterAll: "Összes",
    filterCoffee: "☕ Kávé",
    filterStudy: "📖 Tanulás",
    filterBeer: "🍺 Sör",
    filterSport: "🏀 Sport",
    loadingMeetups: "Találkozók betöltése...",
    rankingHeader: "🏆 Egyetemi Párbaj & Top 100",
    rankingReset: "Reset Vas. 23:59",
    wienerDuellBoxTitle: "🎓 Bécsi Egyetemi Párbaj (Fejenként)",
    loadingUniDuell: "Egyetemi statisztikák számítása...",
    wallOfFameTitle: "⭐ Hírességek Csarnoka (Top Alkotók)",
    loadingTopCreators: "Top alkotók betöltése...",
    loadingChat: "Campus csevegés betöltése...",
    recipientLabel: "Címzett (E-mail):",
    recipientPlaceholder: "kollega@uni.at",
    inboxPrompt: "Írj be egy e-mail címet fent az íráshoz.",
    dmPlaceholder: "Közvetlen üzenet...",
    followerStatsDefault: "0 Követő • 0 Követett",
    shareCardHeader: "🚀 Mutasd meg a Campus szintedet!",
    shareCardText: "Oszd meg a státuszodat WhatsAppon vagy Insta sztoriban, és gyűjts extra pontokat!",
    shareBtn: "📲 Profil megosztása WhatsApp / Insta",
    labelUsername: "Felhasználónév (Handle):",
    labelFullname: "Megjelenített név:",
    labelUniversity: "Az Egyetemed:",
    labelBio: "Rólam / Bio:",
    labelAvatar: "Profilkép URL:",
    labelInterests: "Érdeklődési körök (vesszővel elválasztva):",
    saveProfileBtn: "Profil mentése (+10 P)",
    myPostsHeader: "Saját bejegyzéseid",
    adminHeader: "⚡ Admin Felület: Campus Dropok & Eszközök",
    adminSub: "Kezeld a dropokat itt és teszteld a pontjaidat admin módban.",
    adminTestPointsHeader: "🧪 Admin Teszt Mód: Pontok Szimulációja",
    adminTestPointsSub: "Adminisztrátorként itt közvetlenül beállíthatod a teszt pontszámodat:",
    setPointsBtn: "Pontok beállítása",
    createDropHeader: "📍 Új Campus Drop Létrehozása",
    dropTitleLabel: "Drop Cím / Info:",
    rewardTypeLabel: "Jutalom Típusa:",
    rewardPoints: "Pontok (pl. 50)",
    rewardBadge: "Speciális Jelvény",
    rewardValueLabel: "Érték (Pontszám vagy Jelvény Név):",
    startTimeLabel: "Kezdési időpont (Dátum & Idő):",
    mapSelectLabel: "📍 Helyszín kiválasztása a térképen (Kattintás jelölőt tesz):",
    latLabel: "Szélesség (Lat):",
    lngLabel: "Hosszúság (Lng):",
    radiusLabel: "Sugár méterben (pl. 100m a helyszínen):",
    createDropBtn: "Drop kiadása GPS kapcsolattal 🚀",
    footerReport: "🚨 Tartalom jelentése",
    footerImpressum: "Impresszum",
    footerAgb: "ÁSZF",
    morePointsModalTitle: "🎁 Szerezz Több Pontot",
    morePointsModalSub: "Válassz egy módszert a pontjaid és az egyetemi rangsorod növelésére:",
    quizCardTitle: "🧠 Napi Campus & Általános Kvíz",
    quizCardSub: "Teszteld a tudásod 15 mp alatt kérdésenként & szerezz bónuszpontokat!",
    spotsCardTitle: "📍 Helyszíni Campus Dropok",
    spotsCardSub: "Nézd meg az aktív partnerhelyeket Bécsben.",
    socialCardTitle: "📲 Profil & Közösségi Megosztás",
    socialCardSub: "Oszd meg sikereidet WhatsAppon / Instán Hype pontokért.",
    writeReviewBtn: "+ Értékelés írása",
    profGuideSub: "Korábbi vizsgatippek, professzori tapasztalatok és nehézségi szintek.",
    reviewFormTitle: "✍ Új Élmény Megosztása",
    profNamePlaceholder: "Professzor neve (pl. Prof. Müller)",
    profSubjectPlaceholder: "Modul / Előadás (pl. Analízis 1)",
    ratingLabel: "Értékelés:",
    difficultyLabel: "Nehézség:",
    profCommentPlaceholder: "Belsős tippek, régebbi vizsgák...",
    submitReviewBtn: "Küldés (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Prof vagy tantárgy keresése...",
    loadingReviews: "Értékelések betöltése...",
    quizModalTitle: "🧠 Campus & Általános Kvíz",
    quizSubLoading: "Kérdés betöltése...",
    quizQuestionsLoading: "Kérdések betöltése...",
    activeSpotsModalTitle: "📍 Aktuális Partner Helyszínek",
    activeSpotsModalSub: "Menj a helyszínre a pontok begyűjtéséhez!",
    crushModalTitle: "💖 Névtelen Crush Radar",
    crushModalSub: "Add meg a campus crush-odat. Kölcsönös találat esetén vakrandi nyílik!",
    crushTargetLabel: "Crush (E-mail vagy @handle):",
    crushTargetPlaceholder: "crush@uni.at vagy @username",
    crushHintLabel: "Titkos tipp (opcionális):",
    crushHintPlaceholder: "pl. Könyvtár 4. sor...",
    crushSubmitBtn: "Küldés & Reménykedés 💘"
  },
  uk: {
    matchBanner: "💖 MATCH-СЕРЕДА • ЗНАЙДИ СВОГО КРАША! [Клікни для Радару 💘]",
    loginBtn: "Увійти",
    signupBtn: "Створити акаунт",
    logoutBtn: "🚪 Вийти",
    forgotPw: "Забули пароль?",
    chatPlaceholder: "Повідомлення всім...",
    sendBtn: "Надіслати",
    tabReels: "Стрічка",
    tabFeed: "Зустрічі",
    tabGlobal: "Чат",
    tabInbox: "Вхідні",
    tabLive: "Наживо",
    tabRanking: "Рейтинг",
    tabProfile: "Профіль",
    tabAdmin: "Адмін",
    subDiscover: "Відкрити",
    subTrending: "Тренді",
    subForYou: "Для вас",
    subFollowing: "Підписки",
    subAll: "Всі",
    uniDuellBtn: "🏆 До Віденського Університетського Дуелю та Рейтингу",
    activeSpotsTitle: "📍 Актуальні Партнерські Точки",
    profGuideTitle: "📚 Оцінки Викладачів та Посібник",
    lectureModeTitle: "🎓 Режим Лекції (Фокус)",
    morePointsTitle: "🎁 Отримати Більше Балів",
    close: "Закрити",
    save: "Зберегти",
    cancel: "Скасувати",
    authWelcome: "Привіт 👋",
    authSubtitle: "Увійди або почни одразу:",
    emailLabel: "Електронна пошта:",
    emailPlaceholder: "tvoja.mail@uni.at",
    passwordLabel: "Пароль:",
    passwordPlaceholder: "Твій секретний пароль",
    flashDropTitle: "⚡ FLASH DROP: 50 додаткових балів!",
    flashDropTimer: "Доступно обмежений час! [Натисни зараз 🎁]",
    lectureModeHeader: "🎓 Режим фокусу на лекції",
    lectureModeSub: "Без відволікань та економія батареї",
    lectureModeExit: "Вийти з режиму ✕",
    lectureNotesPlaceholder: "Пиши нотатки з лекції тут...",
    saveNotesTitle: "💾 Зберегти нотатку на пристрій:",
    fileNamePlaceholder: "Назва файлу (напр. Лекція_Математика)",
    formatLabel: "Формат:",
    formatTxt: ".txt (Текстовий файл)",
    formatPdf: ".pdf (Документ)",
    downloadFileBtn: "📥 Завантажити як файл",
    liveHeader: "🔴 Кампус Наживо та Моди",
    helpBtn: "💡 Допомога",
    startStreamBtn: "+ Почати стрім",
    liveFilterAll: "Всі наживо",
    liveFilterGaming: "🎮 Ігри",
    liveFilterMusic: "🎵 Музика",
    liveFilterChat: "💬 Спілкування",
    liveFilterScience: "🔬 Навчання та наука",
    loadingStreams: "Завантаження стрімів...",
    loadingFeeds: "Завантаження стрічки кампусу...",
    meetupsHeader: "Спонтанні зустрічі",
    createBtn: "+ Створити",
    filterAll: "Всі",
    filterCoffee: "☕ Кава",
    filterStudy: "📖 Навчання",
    filterBeer: "🍺 Пиво",
    filterSport: "🏀 Спорт",
    loadingMeetups: "Завантаження зустрічей...",
    rankingHeader: "🏆 Університетський Дуель & Топ 100",
    rankingReset: "Скидання Нд. 23:59",
    wienerDuellBoxTitle: "🎓 Віденський Університетський Дуель (На душу)",
    loadingUniDuell: "Обчислення університетської статистики...",
    wallOfFameTitle: "⭐ Зала Слави (Топ Автори)",
    loadingTopCreators: "Завантаження топ авторів...",
    loadingChat: "Завантаження чату кампусу...",
    recipientLabel: "Отримувач (Email):",
    recipientPlaceholder: "kolega@uni.at",
    inboxPrompt: "Введи email вище, щоб почати писати.",
    dmPlaceholder: "Пряме повідомлення...",
    followerStatsDefault: "0 Підписників • 0 Підписок",
    shareCardHeader: "🚀 Покжи свій рівень у кампусі!",
    shareCardText: "Поділися своїм статусом у WhatsApp або Instagram та отримай додаткові бали!",
    shareBtn: "📲 Поділитися профілем у WhatsApp / Insta",
    labelUsername: "Ім'я користувача (Handle):",
    labelFullname: "Відображуване ім'я:",
    labelUniversity: "Твій Університет:",
    labelBio: "Біо / Про мене:",
    labelAvatar: "URL зображення профілю:",
    labelInterests: "Інтереси (через кому):",
    saveProfileBtn: "Зберегти профіль (+10 P)",
    myPostsHeader: "Твої публікації",
    adminHeader: "⚡ Адмін-панель: Кампус Дропи та Інструменти",
    adminSub: "Керуй дропами тут та тестуй бали в режимі адміна.",
    adminTestPointsHeader: "🧪 Тестовий режим адміна: Симуляція балів",
    adminTestPointsSub: "Оскільки ти адмін, ти можеш напряму налаштувати свій тестовий баланс балів:",
    setPointsBtn: "Встановити бали",
    createDropHeader: "📍 Створити новий Кампус Дроп",
    dropTitleLabel: "Назва Дропу / Інфо:",
    rewardTypeLabel: "Тип винагороди:",
    rewardPoints: "Бали (напр. 50)",
    rewardBadge: "Спеціальний бейдж",
    rewardValueLabel: "Значення (Бали або Назва бейджа):",
    startTimeLabel: "Час початку (Дата та Час):",
    mapSelectLabel: "📍 Вибрати точку на карті (Клік ставить маркер):",
    latLabel: "Широта:",
    lngLabel: "Довгота:",
    radiusLabel: "Радіус у метрах (напр. 100м на місці):",
    createDropBtn: "Опублікувати Дроп з GPS прив'язкою 🚀",
    footerReport: "🚨 Поскаржитися",
    footerImpressum: "Імпрессум",
    footerAgb: "Умови",
    morePointsModalTitle: "🎁 Отримати Більше Балів",
    morePointsModalSub: "Вибери метод, щоб збільшити свої бали та університетський рейтинг:",
    quizCardTitle: "🧠 Щоденний квиз кампусу",
    quizCardSub: "Перевір свої знання за 15 сек на питання та отримай бонусні бали!",
    spotsCardTitle: "📍 Точки Дропів на місці",
    spotsCardSub: "Перевір активні партнерські заклади у Відні.",
    socialCardTitle: "📲 Профіль та Соцмережі",
    socialCardSub: "Поділися успіхами у WhatsApp / Insta для Hype балів.",
    writeReviewBtn: "+ Написати відгук",
    profGuideSub: "Поради щодо іспитів, досвід викладачів та рівні складності.",
    reviewFormTitle: "✍️ Поділитися новим досвідом",
    profNamePlaceholder: "Ім'я викладача (напр. Проф. Мюллер)",
    profSubjectPlaceholder: "Модуль / Лекція (напр. Аналіз 1)",
    ratingLabel: "Оцінка:",
    difficultyLabel: "Складність:",
    profCommentPlaceholder: "Інсайдерські поради, старі іспити...",
    submitReviewBtn: "Надіслати (+15 P) 🚀",
    profSearchPlaceholder: "🔍 Шукати викладача або предмет...",
    loadingReviews: "Завантаження відгуків...",
    quizModalTitle: "🧠 Квиз Кампусу",
    quizSubLoading: "Завантаження питання...",
    quizQuestionsLoading: "Завантаження питань...",
    activeSpotsModalTitle: "📍 Актуальні Партнерські Точки",
    activeSpotsModalSub: "Вирушай на місце, щоб зібрати бали!",
    crushModalTitle: "💖 Анонімний Радар Крашів",
    crushModalSub: "Введи свого університетського краша. При взаємному збігу відкривається побачення наосліп!",
    crushTargetLabel: "Краш (Email або @handle):",
    crushTargetPlaceholder: "crush@uni.at або @username",
    crushHintLabel: "Секретна підказка (необов'язково):",
    crushHintPlaceholder: "напр. Бібліотека Ряд 4...",
    crushSubmitBtn: "Надіслати та Сподіватися 💘"
  }
};

let currentLanguage = localStorage.getItem('campus_lang') || 'de';

function changeLanguage(langCode) {
  currentLanguage = langCode;
  localStorage.setItem('campus_lang', langCode);
  
  const t = translations[langCode] || translations['de'];

  const matchBanner = document.getElementById('match-banner');
  if (matchBanner) matchBanner.innerText = t.matchBanner;

  const loginBtn = document.querySelector('#auth-gate .btn:not(.btn-secondary)');
  if (loginBtn) loginBtn.innerText = t.loginBtn;

  const signupBtn = document.querySelector('#auth-gate .btn-secondary');
  if (signupBtn) signupBtn.innerText = t.signupBtn;

  const globalInput = document.getElementById('global-chat-input');
  if (globalInput) globalInput.placeholder = t.chatPlaceholder;

  // Haupt-Navigation Tabs
  const btnReels = document.getElementById('btn-tab-reels');
  if (btnReels) btnReels.innerText = `📱 ${t.tabReels}`;
  
  const btnFeed = document.getElementById('btn-tab-feed');
  if (btnFeed) btnFeed.innerText = `💬 ${t.tabFeed}`;

  const btnGlobal = document.getElementById('btn-tab-global');
  if (btnGlobal) btnGlobal.innerText = `⚡ ${t.tabGlobal}`;

  const btnInbox = document.getElementById('btn-tab-inbox');
  if (btnInbox) btnInbox.innerText = `📬 ${t.tabInbox}`;

  const btnLive = document.getElementById('btn-tab-live');
  if (btnLive) btnLive.innerText = `🔴 ${t.tabLive}`;

  const btnRanking = document.getElementById('btn-tab-ranking');
  if (btnRanking) btnRanking.innerText = `🏆 ${t.tabRanking}`;

  const btnProfile = document.getElementById('btn-tab-profile');
  if (btnProfile) btnProfile.innerText = `👤 ${t.tabProfile}`;

  const btnAdmin = document.getElementById('btn-tab-admin');
  if (btnAdmin) btnAdmin.innerText = `🛡️ ${t.tabAdmin}`;

  // Update all elements with data-i18n attribute across the DOM (including modals, sub-navs, buttons)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = t[key];
      } else {
        el.innerText = t[key];
      }
    }
  });
}

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

  const langSelect = document.getElementById('languageSelect');
  if (langSelect) {
    langSelect.value = currentLanguage;
  }
  changeLanguage(currentLanguage);

  if (currentUserEmail) {
    const logoutBtn = document.getElementById('logout-btn');
    const headerProfileBtn = document.getElementById('header-profile-btn');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (headerProfileBtn) headerProfileBtn.classList.remove('hidden');

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
    if (dropdown && !dropdown.classList.contains('hidden') && scoreBadge && !scoreBadge.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
});

function toggleLectureMode() {
  const appCard = document.querySelector('.app-card');
  const dropdown = document.getElementById('points-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');

  isLectureModeActive = !isLectureModeActive;

  if (isLectureModeActive) {
    if (appCard) appCard.classList.add('lecture-mode');
    const savedNotes = localStorage.getItem('lecture_mode_notes') || '';
    const notesInput = document.getElementById('lecture-notes-input');
    if (notesInput) notesInput.value = savedNotes;
  } else {
    if (appCard) appCard.classList.remove('lecture-mode');
  }
}

function saveLectureNotesToFile() {
  const notesInput = document.getElementById('lecture-notes-input');
  if (!notesInput) return;
  const notesContent = notesInput.value;
  if (!notesContent.trim()) {
    alert('⚠️ Deine Notiz ist leer. Es gibt nichts zum Speichern!');
    return;
  }

  const customName = document.getElementById('lecture-file-name')?.value.trim() || 'Vorlesung_Notizen';
  const customDate = document.getElementById('lecture-file-date')?.value || new Date().toISOString().split('T')[0];
  const formatChoice = document.getElementById('lecture-file-format')?.value || 'txt';

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

function openProfGuideModal() {
  document.getElementById('prof-guide-modal')?.classList.remove('hidden');
  loadProfReviews();
}

function closeProfGuideModal() {
  document.getElementById('prof-guide-modal')?.classList.add('hidden');
}

function toggleProfForm() {
  const form = document.getElementById('prof-review-form-container');
  form?.classList.toggle('hidden');
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
  const query = document.getElementById('prof-search-input')?.value.toLowerCase() || '';
  const filtered = profReviewsCache.filter(r => 
    r.prof_name.toLowerCase().includes(query) || 
    r.subject_code.toLowerCase().includes(query) ||
    r.comment.toLowerCase().includes(query)
  );
  renderProfReviews(filtered);
}

async function submitProfReview() {
  const profName = document.getElementById('prof-name-input')?.value.trim();
  const subject = document.getElementById('prof-subject-input')?.value.trim();
  const rating = parseInt(document.getElementById('prof-rating-select')?.value || '5');
  const difficulty = parseInt(document.getElementById('prof-difficulty-select')?.value || '3');
  const comment = document.getElementById('prof-comment-input')?.value.trim();

  if (!profName || !subject || !comment) {
    alert('⚠️ Bitte fülle alle Felder aus.');
    return;
  }

  if (containsHateSpeech(comment)) {
    alert('⚠️ Deine Bewertung enthält Ausdrücke, die gegen unsere Richtlinien verstoßen.');
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

  if (document.getElementById('prof-name-input')) document.getElementById('prof-name-input').value = '';
  if (document.getElementById('prof-subject-input')) document.getElementById('prof-subject-input').value = '';
  if (document.getElementById('prof-comment-input')) document.getElementById('prof-comment-input').value = '';
  toggleProfForm();

  await addPoints(15);
  loadProfReviews();
  alert('🎉 Review erfolgreich veröffentlicht! +15 Punkte gutgeschrieben. 🚀');
}

function adminSetTestPoints() {
  const input = document.getElementById('admin-test-points-input');
  const val = parseInt(input?.value);
  if (isNaN(val)) return alert('Bitte eine gültige Zahl eingeben.');

  userPoints = val;
  const badge = document.getElementById('score');
  if (badge) {
    badge.innerText = `${userPoints} P`;
    badge.className = 'points-badge'; 
    badge.onclick = (e) => togglePointsDropdown(e);
  }
  alert(`✅ Test-Punktzahl auf ${userPoints} P gesetzt! Du kannst das Menü jetzt testen.`);
}

function togglePointsDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('points-dropdown-menu');
  dropdown?.classList.toggle('hidden');
}

function openMorePointsModal() {
  document.getElementById('more-points-modal')?.classList.remove('hidden');
}

function closeMorePointsModal() {
  document.getElementById('more-points-modal')?.classList.add('hidden');
}

async function openCampusQuizModal() {
  document.getElementById('quiz-modal')?.classList.remove('hidden');
  const qContainer = document.getElementById('quiz-question-container');
  const optContainer = document.getElementById('quiz-options-container');
  if (qContainer) qContainer.innerText = 'Lade Fragen aus der Datenbank... ⏳';
  if (optContainer) optContainer.innerHTML = '';

  const { data, error } = await _supabase.from('quiz_questions').select('id, question_text, options').limit(5);

  if (error || !data || data.length === 0) {
    if (qContainer) qContainer.innerText = '⚠ Keine Quiz-Fragen in der Datenbank gefunden oder Fehler beim Laden.';
    return;
  }

  activeQuizQuestions = data;
  currentQuizIndex = 0;
  userQuizAnswers = [];
  startQuizQuestion();
}

function closeCampusQuizModal() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  document.getElementById('quiz-modal')?.classList.add('hidden');
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
  const subEl = document.getElementById('quiz-subtitle');
  const qEl = document.getElementById('quiz-question-container');
  if (subEl) subEl.innerText = `Frage ${currentQuizIndex + 1} von ${activeQuizQuestions.length}`;
  if (qEl) qEl.innerText = q.question_text;

  const optContainer = document.getElementById('quiz-options-container');
  const optionsList = Array.isArray(q.options) ? q.options : [];

  if (optContainer) {
    optContainer.innerHTML = optionsList.map((opt, idx) => {
      const optId = opt.id !== undefined ? opt.id : idx;
      const optText = typeof opt === 'string' ? opt : (opt.text || opt);
      return `<button class="btn btn-secondary" style="text-align: left; margin-top: 0; padding: 10px 14px; font-size: 12px;" onclick="selectQuizAnswer('${q.id}', ${optId})">${optText}</button>`;
    }).join('');
  }
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
  const qEl = document.getElementById('quiz-question-container');
  const optEl = document.getElementById('quiz-options-container');
  const subEl = document.getElementById('quiz-subtitle');

  if (qEl) qEl.innerText = 'Wertet Antworten serverseitig aus... ⏳';
  if (optEl) optEl.innerHTML = '';
  if (subEl) subEl.innerText = 'Sichere Validierung';

  try {
    const { data, error } = await _supabase.functions.invoke('submit-quiz', {
      body: { answers: userQuizAnswers }
    });

    if (error) throw new Error(error.message || 'Fehler beim Aufruf der Edge Function');

    if (data && data.success) {
      await addPoints(data.earnedPoints || 0);
      if (qEl) {
        qEl.innerHTML = `
          <h3 style="color: var(--success); margin-bottom: 6px;">🎉 Quiz erfolgreich beendet!</h3>
          <p>Deine Antworten wurden sicher im Backend ausgewertet.</p>
          <p style="margin-top: 6px; font-size: 15px; color: #818cf8;">Erhaltene Punkte: <strong>+${data.earnedPoints} P</strong> 🚀</p>
        `;
      }
      if (optEl) optEl.innerHTML = `<button class="btn" onclick="closeCampusQuizModal()">Fertig</button>`;
    } else {
      throw new Error(data.error || 'Unbekannter Serverfehler');
    }
  } catch (err) {
    if (qEl) {
      qEl.innerHTML = `
        <h3 style="color: var(--accent); margin-bottom: 6px;">⚠ Hinweis</h3>
        <p>${err.message}</p>
      `;
    }
    if (optEl) optEl.innerHTML = `<button class="btn btn-secondary" onclick="closeCampusQuizModal()">Schließen</button>`;
  }
}

function initAdminMap() {
  if (adminMap) {
    adminMap.invalidateSize();
    return;
  }

  const defaultLat = 48.2128;
  const defaultLng = 16.3598;

  const mapContainer = document.getElementById('admin-map');
  if (!mapContainer) return;

  adminMap = L.map('admin-map').setView([defaultLat, defaultLng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(adminMap);

  adminMap.on('click', function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const latInput = document.getElementById('admin-drop-lat');
    const lngInput = document.getElementById('admin-drop-lng');
    if (latInput) latInput.value = lat.toFixed(6);
    if (lngInput) lngInput.value = lng.toFixed(6);

    if (adminMarker) {
      adminMarker.setLatLng([lat, lng]);
    } else {
      adminMarker = L.marker([lat, lng]).addTo(adminMap);
    }
  });
}

function openActiveSpotsModal() {
  document.getElementById('active-spots-modal')?.classList.remove('hidden');
  renderActiveSpotsInModal();
}

function closeActiveSpotsModal() {
  document.getElementById('active-spots-modal')?.classList.add('hidden');
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
          const titleText = document.getElementById('drop-title-text');
          if (titleText) titleText.innerText = `⚡ FLASH DROP: ${activeDropCache.title}${locationInfo}`;
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
    const titleText = document.getElementById('drop-title-text');
    if (titleText) titleText.innerText = '⚡ FLASH DROP: 50 Extra-Punkte abholen!';
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
  if (localStorage.getItem(claimedKey)) return alert('⚠ Du hast diesen Drop bereits eingesammelt!');

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

  const title = document.getElementById('admin-drop-title')?.value.trim();
  const rewardType = document.getElementById('admin-drop-reward-type')?.value;
  const rewardValue = document.getElementById('admin-drop-reward-value')?.value.trim();
  const startTimeInput = document.getElementById('admin-drop-start-time')?.value;
  const lat = parseFloat(document.getElementById('admin-drop-lat')?.value) || null;
  const lng = parseFloat(document.getElementById('admin-drop-lng')?.value) || null;
  const radius = parseInt(document.getElementById('admin-drop-radius')?.value) || 100;

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
  if (document.getElementById('admin-drop-title')) document.getElementById('admin-drop-title').value = '';
  if (document.getElementById('admin-drop-reward-value')) document.getElementById('admin-drop-reward-value').value = '';
  if (document.getElementById('admin-drop-start-time')) document.getElementById('admin-drop-start-time').value = '';
  if (document.getElementById('admin-drop-lat')) document.getElementById('admin-drop-lat').value = '';
  if (document.getElementById('admin-drop-lng')) document.getElementById('admin-drop-lng').value = '';
  if (adminMarker && adminMap) { adminMap.removeLayer(adminMarker); adminMarker = null; }
  loadActiveCampusDrops();
}

function checkMatchWednesday() {
  const today = new Date().getDay();
  if (today === 3) document.documentElement.classList.add('match-wednesday');
  else document.documentElement.classList.remove('match-wednesday');
}

async function initApp() {
  document.getElementById('auth-gate')?.classList.add('hidden');
  document.getElementById('main-app')?.classList.remove('hidden');
  
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

function changeAvatarDirectly() {
  const currentUrl = document.getElementById('profile-avatar')?.value || '';
  const newUrl = prompt("Gib die Bild-URL für dein neues Profilbild ein:", currentUrl);
  if (newUrl !== null) {
    const avatarInput = document.getElementById('profile-avatar');
    const avatarPreview = document.getElementById('my-profile-avatar-preview');
    const headerPreview = document.getElementById('header-avatar-preview');
    if (avatarInput) avatarInput.value = newUrl;
    if (avatarPreview) avatarPreview.src = newUrl;
    if (headerPreview) headerPreview.src = newUrl;
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

  const usernameEl = document.getElementById('profile-username');
  const fullnameEl = document.getElementById('profile-fullname');
  const uniEl = document.getElementById('profile-university');
  const bioEl = document.getElementById('profile-bio');
  const avatarEl = document.getElementById('profile-avatar');
  const interestsEl = document.getElementById('profile-interests');

  if (usernameEl) usernameEl.value = profile.username || '';
  if (fullnameEl) fullnameEl.value = profile.full_name || '';
  if (uniEl) uniEl.value = profile.university || 'Universität Wien';
  if (bioEl) bioEl.value = profile.bio || '';
  if (avatarEl) avatarEl.value = profile.avatar_url || '';
  if (interestsEl) interestsEl.value = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';

  const namePreview = document.getElementById('my-profile-display-name');
  const handlePreview = document.getElementById('my-profile-handle-preview');
  if (namePreview) namePreview.innerText = profile.full_name || profile.username || currentUserEmail.split('@')[0];
  if (handlePreview) handlePreview.innerText = '@' + (profile.username || 'user');
  
  const rankInfo = getCampusRank(userPoints);
  const rankBadge = document.getElementById('profile-rank-badge');
  if (rankBadge) {
    rankBadge.innerHTML = `${rankInfo.title} <br><span class="verified-badge">🛡️ Verified Student</span>`;
    rankBadge.style.color = rankInfo.color;
    rankBadge.style.borderColor = rankInfo.color;
    rankBadge.style.background = rankInfo.color + '22';
  }

  const avatarUrl = profile.avatar_url || '';
  const myAvatarPreview = document.getElementById('my-profile-avatar-preview');
  const headerAvatarPreview = document.getElementById('header-avatar-preview');
  if (myAvatarPreview) myAvatarPreview.src = avatarUrl;
  if (headerAvatarPreview) headerAvatarPreview.src = avatarUrl;

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
  const username = document.getElementById('profile-username')?.value.trim().replace(/^@/, '');
  const full_name = document.getElementById('profile-fullname')?.value.trim();
  const university = document.getElementById('profile-university')?.value;
  const bio = document.getElementById('profile-bio')?.value.trim();
  const avatar_url = document.getElementById('profile-avatar')?.value.trim();
  const interestsRaw = document.getElementById('profile-interests')?.value.trim();
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
    document.getElementById('tab-reels')?.classList.remove('hidden');
    document.getElementById('tab-live')?.classList.remove('hidden');
    document.getElementById('reel-filter-live')?.classList.add('active');
    ['discover', 'foryou', 'following'].forEach(f => document.getElementById(`reel-filter-${f}`)?.classList.remove('active'));
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
  document.getElementById('crush-modal')?.classList.remove('hidden');
  checkCrushMatches();
}

function closeCrushModal() {
  document.getElementById('crush-modal')?.classList.add('hidden');
}

async function submitCrush() {
  const target = document.getElementById('crush-target-input')?.value.trim().toLowerCase();
  const hint = document.getElementById('crush-hint-input')?.value.trim();
  if (!target) return alert('Bitte gib deinen Crush an.');

  const { error } = await _supabase.from('crushes').insert([{ sender_email: currentUserEmail, target_identifier: target, hint }]);
  if (error) return alert('Fehler: ' + error.message);

  alert('Dein geheimer Crush wurde eingetragen! 💘');
  closeCrushModal();
  checkCrushMatches();
}

async function checkCrushMatches() {
  const box = document.getElementById('crush-matches-box');
  if (!box) return;
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
  document.getElementById('tab-live')?.classList.add('hidden');
  document.getElementById('go-live-modal')?.classList.add('hidden');
  document.getElementById('bottom-nav-bar')?.classList.add('hidden');
  document.getElementById('stream-help-modal')?.classList.remove('hidden');
}

function closeStreamHelpModal() {
  document.getElementById('stream-help-modal')?.classList.add('hidden');
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden');
  document.getElementById('tab-live')?.classList.remove('hidden');
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
  const backBtn = document.getElementById('tutorial-back-btn');
  const nextBtn = document.getElementById('tutorial-next-btn');
  if (backBtn) backBtn.style.display = (currentTutorialStep === 1) ? 'none' : 'block';
  if (nextBtn) nextBtn.innerText = (currentTutorialStep === totalTutorialSteps) ? 'Abschließen & Loslegen ✅' : 'Weiter';
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
  document.getElementById('tab-live')?.classList.add('hidden');
  document.getElementById('bottom-nav-bar')?.classList.add('hidden');
  document.getElementById('go-live-modal')?.classList.remove('hidden');
}

function closeGoLiveModal() {
  document.getElementById('go-live-modal')?.classList.add('hidden');
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden');
  document.getElementById('tab-live')?.classList.remove('hidden');
}

async function submitLiveStream() {
  const title = document.getElementById('live-title')?.value.trim();
  const url = document.getElementById('live-url')?.value.trim();
  const modEmail = document.getElementById('live-mod-input')?.value.trim().toLowerCase();
  
  if (!title || !url) return alert('Bitte Titel und URL angeben.');
  const expiresAt = new Date(Date.now() + 3 * 3600000).toISOString();
  
  const { data: streamData, error: streamError } = await _supabase.from('live_streams').insert([{ 
    host_email: currentUserEmail, 
    title, 
    stream_url: url, 
    category: selectedGoLiveCategory, 
    expires_at: expiresAt 
  }]).select().single();

  if (streamError) {
    alert('Fehler beim Starten des Streams: ' + streamError.message);
    return;
  }

  if (modEmail && streamData) {
    await _supabase.from('stream_moderators').insert([{
      stream_id: streamData.id,
      moderator_email: modEmail
    }]);
  }

  await addPoints(25);
  closeGoLiveModal();
  loadLiveStreams();
}

async function loadLiveStreams() {
  const { data } = await _supabase.from('live_streams').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  liveStreamsCache = data || [];
  renderLiveStreams();
}

async function checkIfUserIsMod(streamId) {
  if (currentUserEmail === MASTER_ADMIN_EMAIL) return true;
  const { data } = await _supabase.from('stream_moderators').select('*').eq('stream_id', streamId).eq('moderator_email', currentUserEmail).maybeSingle();
  return data !== null;
}

async function renderLiveStreams() {
  const list = document.getElementById('live-streams-list');
  if (!list) return;
  let streams = activeLiveFilter === 'Alle' ? liveStreamsCache : liveStreamsCache.filter(s => s.category === activeLiveFilter);
  if (streams.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 40px;">Keine Live-Streams aktiv.</p>';
    return;
  }
  
  let html = '';
  for (const s of streams) {
    const isHost = s.host_email === currentUserEmail;
    const isMod = await checkIfUserIsMod(s.id);

    html += `
      <div class="live-card">
        <div class="event-header">
          <div class="event-title">${s.category || '🔴'} ${s.title}</div>
          <span style="font-size:10px; color:var(--text-muted);">Host: ${s.host_email.split('@')[0]}</span>
        </div>
        <div class="event-footer" style="display:flex; justify-content:space-between; align-items:center;">
          <a href="${s.stream_url}" target="_blank" class="btn-join" style="text-decoration:none;">Stream ansehen</a>
          ${(isHost || isMod || currentUserEmail === MASTER_ADMIN_EMAIL) ? `<button class="btn-secondary" style="width:auto; padding:4px 8px; font-size:10px; margin:0;" onclick="moderateStreamPrompt('${s.id}')">🛡 Mod-Menü</button>` : ''}
        </div>
      </div>
    `;
  }
  list.innerHTML = html;
}

async function moderateStreamPrompt(streamId) {
  const action = prompt("🛡 Moderatoren-Aktion wählen:\n1 - Moderator hinzufügen (E-Mail eingeben)\n2 - Stream vorzeitig beenden");
  if (action === '1') {
    const modMail = prompt("Gib die E-Mail des neuen Moderators ein:")?.trim().toLowerCase();
    if (modMail) {
      await _supabase.from('stream_moderators').insert([{ stream_id: streamId, moderator_email: modMail }]);
      alert(`✅ Moderator ${modMail} erfolgreich hinzugefügt!`);
    }
  } else if (action === '2') {
    if (confirm("Möchtest du diesen Stream wirklich beenden?")) {
      await _supabase.from('live_streams').delete().eq('id', streamId);
      loadLiveStreams();
      alert('Stream beendet.');
    }
  }
}

function openReportModal() { 
  document.getElementById('bottom-nav-bar')?.classList.add('hidden'); 
  document.getElementById('report-modal')?.classList.remove('hidden'); 
}

function closeReportModal() { 
  document.getElementById('report-modal')?.classList.add('hidden'); 
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden'); 
}

async function submitReport() {
  const reason = document.getElementById('report-reason')?.value;
  const details = document.getElementById('report-details')?.value.trim();
  
  if (!details) {
    alert('⚠️ Bitte gib den betroffenen Benutzer, Link oder Grund genauer an.');
    return;
  }

  const { error } = await _supabase.from('reports').insert([{
    reporter_email: currentUserEmail || 'anonymous@campus.at',
    reason: reason,
    details: details,
    status: 'pending'
  }]);

  if (error) {
    alert('Fehler beim Senden der Meldung: ' + error.message);
    return;
  }

  if (details.includes('http') || details.length > 3) {
    await _supabase
      .from('media_posts')
      .update({ is_hidden: true })
      .or(`id.eq.${details},caption.ilike.%${details}%`);
  }

  alert('🚨 Meldung erfolgreich eingereicht. Der betroffene Inhalt wurde zu deiner rechtlichen Absicherung vorübergehend ausgeblendet und wird geprüft.');
  const detailsInput = document.getElementById('report-details');
  if (detailsInput) detailsInput.value = '';
  closeReportModal();
  loadMediaPosts();
}

function openImpressumModal() { 
  document.getElementById('bottom-nav-bar')?.classList.add('hidden'); 
  document.getElementById('impressum-modal')?.classList.remove('hidden'); 
}
function closeImpressumModal() { 
  document.getElementById('impressum-modal')?.classList.add('hidden'); 
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden'); 
}
function openAgbModal() { 
  document.getElementById('bottom-nav-bar')?.classList.add('hidden'); 
  document.getElementById('agb-modal')?.classList.remove('hidden'); 
}
function closeAgbModal() { 
  document.getElementById('agb-modal')?.classList.add('hidden'); 
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden'); 
}

function setReelFilter(filter) {
  reelFilter = filter;
  ['discover', 'foryou', 'following', 'live'].forEach(f => {
    const el = document.getElementById(`reel-filter-${f}`);
    if (el) el.classList.remove('active');
  });
  document.getElementById(`reel-filter-${filter}`)?.classList.add('active');
  
  if (filter === 'live') {
    document.getElementById('tab-live')?.classList.remove('hidden');
  } else {
    document.getElementById('tab-live')?.classList.add('hidden');
    renderMediaPosts();
  }
}

async function loadMediaPosts() {
  const { data } = await _supabase
    .from('media_posts')
    .select('*')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  mediaPostsCache = data || [];
  renderMediaPosts();
  renderMyProfilePostsGrid();
}

function renderMediaPosts() {
  const list = document.getElementById('reels-list');
  if (!list) return;
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

function openUploadModal() { 
  document.getElementById('upload-modal')?.classList.remove('hidden'); 
  document.getElementById('bottom-nav-bar')?.classList.add('hidden'); 
}
function closeUploadModal() { 
  document.getElementById('upload-modal')?.classList.add('hidden'); 
  document.getElementById('bottom-nav-bar')?.classList.remove('hidden'); 
}

async function submitConfessionPost() {
  const textInput = document.getElementById('confession-text-input');
  const text = textInput?.value.trim();
  if (!text) return alert('Bitte Text eingeben.');

  if (containsHateSpeech(text)) {
    alert('⚠️ Hassrede oder Beleidigungen sind in Confessions strengstens untersagt!');
    return;
  }

  const bgImages = [
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600"
  ];
  const randomImg = bgImages[Math.floor(Math.random() * bgImages.length)];
  await _supabase.from('media_posts').insert([{ author_email: 'anonymous@campus.at', media_url: randomImg, media_type: 'image', caption: text, likes: {}, comments: [], is_hidden: false }]);
  if (textInput) textInput.value = '';
  await addPoints(15);
  closeUploadModal();
  loadMediaPosts();
  alert('Confession anonym gepostet! 🤫✨');
}

// Behobene Passwort-Toggle Funktion für das Auge-Icon
function togglePasswordVisibility() {
  const pw = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-pw-btn');
  if (pw) {
    if (pw.type === 'password') {
      pw.type = 'text';
      if (toggleBtn) toggleBtn.innerText = '🔒';
    } else {
      pw.type = 'password';
      if (toggleBtn) toggleBtn.innerText = '👁️';
    }
  }
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
  if (!box) return;
  box.innerText = text;
  box.className = `msg-box ${isError ? 'msg-error' : 'msg-success'}`;
  box.classList.remove('hidden');
}

async function handleLogin() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  if (!emailEl || !passEl) return showMessage('E-Mail oder Passwort Feld nicht gefunden.');

  const email = emailEl.value.trim().toLowerCase();
  const password = passEl.value;
  if (!email || !password) return showMessage('Bitte E-Mail und Passwort eingeben.');

  if (email === MASTER_ADMIN_EMAIL && password === MASTER_ADMIN_PASS) {
    currentUserEmail = email;
    localStorage.setItem('campus_email', currentUserEmail);
    userPoints = 9999;
    setupAdminUI();
    document.getElementById('logout-btn')?.classList.remove('hidden');
    document.getElementById('header-profile-btn')?.classList.remove('hidden');
    initApp();
    return;
  }

  try {
    const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) throw authError;

    currentUserEmail = email;
    localStorage.setItem('campus_email', currentUserEmail);

    const { data: userData } = await _supabase.from('users').select('*').eq('email', email).maybeSingle();
    userPoints = userData ? (userData.points || 0) : 0;

    document.getElementById('logout-btn')?.classList.remove('hidden');
    document.getElementById('header-profile-btn')?.classList.remove('hidden');
    initApp();

  } catch (err) {
    console.error("Login fehlgeschlagen:", err.message);
    showMessage('Anmeldung fehlgeschlagen: ' + err.message);
  }
}

async function handleSignup() {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  if (!emailEl || !passEl) return showMessage('E-Mail oder Passwort Feld nicht gefunden.');

  const email = emailEl.value.trim().toLowerCase();
  const password = passEl.value;
  
  if (!email || !password) {
    return showMessage('Bitte E-Mail und Passwort eingeben.');
  }

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
  const email = document.getElementById('email')?.value.trim().toLowerCase();
  if (!email) return showMessage('Bitte E-Mail eingeben.');
  await _supabase.auth.resetPasswordForEmail(email);
  showMessage('E-Mail zum Zurücksetzen gesendet!', false);
}

function setupAdminUI() {
  const badge = document.getElementById('score');
  if (!badge) return;
  badge.innerText = '⭐ Admin';
  badge.className = 'points-badge admin-badge';
}