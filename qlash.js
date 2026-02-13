/**
 * Supabase Configuration
 * 
 * SECURITY NOTE: 
 * - These values are replaced by environment variables during deployment
 * - The anon key is designed for public use but should be protected with RLS policies
 * - Enable Row-Level Security (RLS) on all Supabase tables
 * - Configure rate limiting in Supabase project settings
 */

// These placeholders are replaced during build/deployment
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// Declare supabaseClient globally
let supabaseClient; 

// --- Utility functions ---
/**
 * Displays a simple message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - 'error' or 'info'.
 */
function showMessage(message, type = 'info') {
    console.log(`Message (${type}): ${message}`);

    // Remove existing toast if present
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger show animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 4000);
}

/**
 * Shows a specific view and hides all other views.
 * @param {string} viewToShowId - The ID of the view element to show.
 */
function showView(viewToShowId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const viewElement = document.getElementById(viewToShowId);
    if (viewElement) viewElement.classList.add('active');
    else console.error("View not found:", viewToShowId);

    // Hide role selection buttons once a role is chosen
    if (viewToShowId === 'host-view' || viewToShowId === 'player-view') {
        document.getElementById('role-selection').classList.add('hidden');
    }
}

/**
 * Generates a random alphanumeric ID of a specified length.
 * @param {number} length - The desired length of the ID.
 * @returns {string} The generated alphanumeric ID.
 */
function generateAlphanumericId(length) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Shuffles an array in place using the Fisher-Yates (Knuth) algorithm.
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- App initialization ---
// QR Code Modal elements (declared globally for early access)
let qrModalOverlay = null;
let qrModalCloseBtn = null;
let largeQrcodeContainer = null;
let modalRoomIdSpan = null;

document.addEventListener('DOMContentLoaded', () => {
            // Initialize Supabase client here, after the DOM is loaded
            // This ensures the Supabase global object is available
            if (typeof supabase !== 'undefined' && supabase.createClient) { 
                const { createClient } = supabase;
                supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            } else {
                console.error("Supabase library not loaded or 'supabase.createClient' is undefined. Please check network and script loading.");
                showMessage("Fehler: Die Supabase-Bibliothek konnte nicht geladen werden. Bitte überprüfe deine Internetverbindung oder versuche es später erneut.", 'error');
                return; // Prevent further execution if Supabase is not available
            }

            // Initialize QR modal elements as soon as DOM is ready
            qrModalOverlay = document.getElementById('qr-modal-overlay');
            qrModalCloseBtn = document.getElementById('qr-modal-close');
            largeQrcodeContainer = document.getElementById('large-qrcode');
            modalRoomIdSpan = document.getElementById('modal-room-id');

            // Event listener for closing the QR code modal when clicking the close button
            if (qrModalCloseBtn) {
                qrModalCloseBtn.addEventListener('click', () => {
                    if (qrModalOverlay) {
                        qrModalOverlay.classList.add('hidden');
                    }
                });
            }

            // Event listener for closing the QR code modal when clicking the overlay itself
            if (qrModalOverlay) {
                qrModalOverlay.addEventListener('click', (event) => {
                    // Only close if the click target is the overlay itself, not its children
                    if (event.target === qrModalOverlay) {
                        qrModalOverlay.classList.add('hidden');
                    }
                });
            }


            // Event listener for "Host a Quiz" button
            document.getElementById('host-btn').addEventListener('click', () => {
                showView('host-view');
                initializeHostFeatures();
            });
            // Event listener for "Join a Quiz" button
            document.getElementById('player-btn').addEventListener('click', () => {
                showView('player-view');
                initializePlayerFeatures();
            });

            // Check URL parameters for a host ID to auto-join on page load
            const urlParams = new URLSearchParams(window.location.search);
            const hostIdFromUrl = urlParams.get('host');

            if (hostIdFromUrl) {
                 // If host ID is in URL, navigate directly to player view and pre-fill
                 showView('player-view');
                 initializePlayerFeatures(); // Initialize player features first
                 document.getElementById('room-code-input').value = hostIdFromUrl;
            } else {
                 // Otherwise, show the role selection view
                 showView('role-selection');
            }

            // Reconnect Supabase channels when tab becomes visible again (e.g., after sleep/tab switch)
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState !== 'visible') return;

                console.log('Tab became visible, checking connections...');

                // Host reconnection
                if (hostRoomId && hostPlayerId) {
                    // Re-mark host as connected
                    try {
                        await supabaseClient.from('players').update({ is_connected: true }).eq('id', hostPlayerId);
                    } catch (e) {
                        console.error('Error re-marking host as connected:', e);
                    }
                }

                // Player reconnection
                if (playerRoomId && playerCurrentId) {
                    // Re-mark player as connected
                    try {
                        await supabaseClient.from('players').update({ is_connected: true }).eq('id', playerCurrentId);
                    } catch (e) {
                        console.error('Error re-marking player as connected:', e);
                    }
                }
            });
        });

// --- Host State & Initialization Flag ---
let hostGlobalQuizState = null;
let hostSupabaseChannel = null;
let hostPlayersSubscription = null;
let isHostInitialized = false;
let hostTimerInterval = null;
let hostQuestionStartTime = null;
let hostRoomId = null;
let hostPlayerId = null;
let hostViewHeading = null;
let hostBeforeUnloadHandler = null;
let hostBroadcastReconnectAttempts = 0;
let hostPlayersReconnectAttempts = 0;
let hostHeartbeatInterval = null;
const HOST_MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 2000;

/**
 * Returns an array of non-host players from quizState.
 * @returns {Array<Object>} Array of player objects excluding the host.
 */
function getNonHostPlayers() {
    if (!hostGlobalQuizState) return [];
    return Object.values(hostGlobalQuizState.players).filter(p => p.id !== hostPlayerId);
}

/**
 * Returns the count of non-host players.
 * @returns {number} Number of non-host players.
 */
function getNonHostPlayerCount() {
    return getNonHostPlayers().length;
}

/**
 * Checks if a player ID belongs to the host.
 * @param {string} playerId - The player ID to check.
 * @returns {boolean} True if the player is the host.
 */
function isHostPlayer(playerId) {
    return playerId === hostPlayerId;
}

/**
 * Initializes all features and event listeners for the host role.
 */
        async function initializeHostFeatures() {
            console.log("Initializing Host Features. Initialized flag:", isHostInitialized);
            // Initialize quiz state if not already set
            if (!hostGlobalQuizState) {
                hostGlobalQuizState = {
                    currentQuestionIndex: 0,
                    questions: [], // Stores original questions
                    shuffledQuestions: [], // Stores shuffled questions for the current quiz session
                    players: {}, // Player structure includes score and answer time
                    answersReceived: 0,
                    isQuestionActive: false,
                    roomId: null, // This will be the 4-digit alphanumeric code
                    questionDuration: 20 // Default question duration in seconds
                };
            }

            const quizState = hostGlobalQuizState;
            // Cache DOM elements for performance
            const jsonFileInput = document.getElementById('json-file');
            const fileStatus = document.getElementById('file-status');
            const questionForm = document.getElementById('question-form');
            const questionText = document.getElementById('question-text');
            const addOptionBtn = document.getElementById('add-option-btn');
            const questionsContainer = document.getElementById('questions-container');
            const questionDurationInput = document.getElementById('question-duration-input');
            const startQuizBtn = document.getElementById('start-quiz-btn');
            const qrContainer = document.getElementById('qr-container');
            const hostSetup = document.getElementById('host-setup');
            const qrcodeElement = document.getElementById('qrcode');
            const roomIdElement = document.getElementById('room-id');
            const joinLinkElement = document.getElementById('join-link');
            const joinLinkModalElement = document.getElementById('join-link-modal');
            const playerCountElement = document.getElementById('player-count');
            const playersList = document.getElementById('players-list');
            const startQuestionsBtn = document.getElementById('start-questions-btn');
            const hostQuestionDisplay = document.getElementById('host-question-display');
            const currentQuestionTextEl = document.getElementById('current-question-text');
            const hostCurrentOptionsEl = document.getElementById('host-current-options');
            const questionCounterEl = document.getElementById('question-counter');
            const timerBar = document.getElementById('timer-bar');
            const answersCount = document.getElementById('answers-count');
            const totalPlayers = document.getElementById('total-players');
            const hostScoreboardEl = document.getElementById('host-scoreboard');
            const scoreboardListEl = document.getElementById('scoreboard-list');
            const showNextBtn = document.getElementById('show-next-btn');
            const showResultsBtn = document.getElementById('show-results-btn');
            const hostResults = document.getElementById('host-results');
            const leaderboard = document.getElementById('leaderboard');
            const newQuizBtn = document.getElementById('new-quiz-btn');
            hostViewHeading = document.getElementById('host-view-heading'); // Cache the heading

            // Set default duration input value
            questionDurationInput.value = quizState.questionDuration;

            // Only set up event listeners once
            if (!isHostInitialized) {
                console.log("Setting up host event listeners for the first time.");

                // Event listener for JSON file import
                jsonFileInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = JSON.parse(e.target.result);
                            if (data && Array.isArray(data) && data.every(q => q.question && q.options && q.correct)) {
                                quizState.questions = data;
                            } else if (data && data.cards && Array.isArray(data.cards)) {
                                quizState.questions = data.cards;
                            } else {
                                fileStatus.textContent = 'Ungültiges JSON. Erwartet wird ein Array von Fragen oder eine "Karten"-Struktur.';
                                quizState.questions = [];
                            }
                            fileStatus.textContent = quizState.questions.length > 0 ? `Importiert ${quizState.questions.length} Fragen.` : (fileStatus.textContent || 'Keine Fragen im JSON gefunden.');
                            renderQuestionsList();
                        } catch (error) {
                            console.error('Error parsing JSON:', error);
                            fileStatus.textContent = 'Fehler beim Parsen des JSON. Format überprüfen.';
                            quizState.questions = [];
                            renderQuestionsList();
                        }
                    };
                    reader.readAsText(file);
                });

                // Event listener for adding new option input fields
                addOptionBtn.addEventListener('click', () => {
                    const optionGroups = questionForm.querySelectorAll('.option-group');
                    const newIndex = optionGroups.length + 1;
                    const optionGroup = document.createElement('div');
                    optionGroup.className = 'option-group';
                    optionGroup.innerHTML = `<input type="text" class="option-input" placeholder="Option ${newIndex}"><input type="checkbox" class="correct-checkbox"><label>Richtig</label>`;
                    questionForm.insertBefore(optionGroup, addOptionBtn);
                });

                // Event listener for submitting a new question
                questionForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const question = questionText.value.trim();
                    if (!question) {
                        showMessage('Bitte gebe eine Frage ein', 'error');
                        return;
                    }

                    const optionInputs = questionForm.querySelectorAll('.option-input');
                    const options = [];
                    const correct = [];

                    optionInputs.forEach((inputEl) => {
                        const optionText = inputEl.value.trim();
                        if (optionText) {
                            const currentIndex = options.length;
                            options.push(optionText);
                            const checkbox = inputEl.parentElement.querySelector('.correct-checkbox');
                            if (checkbox && checkbox.checked) {
                                correct.push(currentIndex);
                            }
                        }
                    });

                    if (options.length < 2) {
                        showMessage('Bitte füge mindestens zwei gültige Optionen hinzu', 'error');
                        return;
                    }
                    if (correct.length === 0) {
                        showMessage('Bitte wähle mindestens eine richtige Antwort aus', 'error');
                        return;
                    }

                    quizState.questions.push({ question, options, correct });
                    questionText.value = '';
                    questionForm.querySelectorAll('.option-group').forEach((group, index) => {
                        const input = group.querySelector('.option-input');
                        const checkbox = group.querySelector('.correct-checkbox');
                        if (index < 2) {
                            if(input) input.value = '';
                            if(checkbox) checkbox.checked = false;
                        } else {
                            group.remove();
                        }
                    });
                    renderQuestionsList();
                });

                // Event listener for starting the quiz
                startQuizBtn.addEventListener('click', async () => {
                    if (quizState.questions.length === 0) {
                        showMessage('Bitte füge mindestens eine Frage hinzu.', 'error');
                        return;
                    }
                    const duration = parseInt(questionDurationInput.value, 10);
                    if (isNaN(duration) || duration < 5 || duration > 60) {
                        showMessage('Bitte gebe eine gültige Fragedauer zwischen 5 und 60 Sekunden ein.', 'error');
                        return;
                    }
                    quizState.questionDuration = duration;

                    // Shuffle questions once when quiz starts
                    quizState.shuffledQuestions = [...quizState.questions]; // Create a copy
                    shuffleArray(quizState.shuffledQuestions);

                    await initHostSupabase();
                });

                // Event listener for starting questions (after players join)
                startQuestionsBtn.addEventListener('click', async () => {
                    if (getNonHostPlayerCount() === 0) {
                        showMessage("Es sind noch keine Spieler beigetreten!", 'info');
                        return;
                    }
                    qrContainer.classList.add('hidden');
                    hostQuestionDisplay.classList.remove('hidden');
                    if (hostViewHeading) hostViewHeading.classList.add('hidden'); // Hide "Quiz hosten" heading
                    quizState.currentQuestionIndex = 0;
                    await startQuestion();
                });

                // Event listener for moving to the next question
                showNextBtn.addEventListener('click', async () => {
                    quizState.currentQuestionIndex++;
                    await startQuestion();
                });

                // Event listener for showing final results
                showResultsBtn.addEventListener('click', showFinalResults);

                // Event listener for starting a new quiz
                newQuizBtn.addEventListener('click', async () => {
                    // Stop heartbeat
                    if (hostHeartbeatInterval) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }

                    // Clean up Supabase subscriptions
                    if (hostSupabaseChannel) {
                        await supabaseClient.removeChannel(hostSupabaseChannel);
                        hostSupabaseChannel = null;
                    }
                    if (hostPlayersSubscription) {
                        await supabaseClient.removeChannel(hostPlayersSubscription);
                        hostPlayersSubscription = null;
                    }

                    // Remove room and players from DB
                    if (hostRoomId) {
                        await supabaseClient.from('players').delete().eq('room_id', hostRoomId); // Delete players first due to foreign key
                        await supabaseClient.from('rooms').delete().eq('id', hostRoomId);
                    }

                    hostGlobalQuizState = null;
                    isHostInitialized = false;
                    fileStatus.textContent = '';
                    if(jsonFileInput) jsonFileInput.value = '';
                    hostResults.classList.add('hidden');
                    hostQuestionDisplay.classList.add('hidden');
                    qrContainer.classList.add('hidden');
                    hostSetup.classList.remove('hidden');
                    document.getElementById('role-selection').classList.remove('hidden'); // Show role selection again
                    if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading
                    initializeHostFeatures(); // Re-initialize to reset UI fully
                });

                // Clean up on window unload using sendBeacon for reliable delivery
                // Remove any existing handler to prevent duplicates
                if (hostBeforeUnloadHandler) {
                    window.removeEventListener('beforeunload', hostBeforeUnloadHandler);
                }
                hostBeforeUnloadHandler = () => {
                    // Use sendBeacon for reliable delivery during page unload
                    if (hostPlayerId && SUPABASE_URL && SUPABASE_ANON_KEY) {
                        const url = `${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(hostPlayerId)}`;
                        const headers = {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Prefer': 'return=minimal'
                        };
                        const body = JSON.stringify({ is_connected: false });
                        // fetch with keepalive: true is queued by the browser even during unload
                        try {
                            fetch(url, { method: 'PATCH', headers, body, keepalive: true });
                        } catch (e) {
                            // Best effort - page is unloading
                        }
                    }
                    // Best-effort channel cleanup (synchronous, non-blocking)
                    if (hostSupabaseChannel) {
                        supabaseClient.removeChannel(hostSupabaseChannel);
                    }
                    if (hostPlayersSubscription) {
                        supabaseClient.removeChannel(hostPlayersSubscription);
                    }
                };
                window.addEventListener('beforeunload', hostBeforeUnloadHandler);

                // Event listener for opening the QR code modal
                qrcodeElement.addEventListener('click', () => {
                    if (qrModalOverlay && largeQrcodeContainer && hostRoomId) {
                        qrModalOverlay.classList.remove('hidden');
                        largeQrcodeContainer.innerHTML = ''; // Clear previous QR
                        new QRCode(largeQrcodeContainer, {
                            text: joinLinkElement.href, // Use the full join link
                            width: 300, // Larger size for modal
                            height: 300,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.H
                        });
                        modalRoomIdSpan.textContent = quizState.roomId; // Display the 4-digit room code in modal
                    }
                });

                isHostInitialized = true;
            }

            renderQuestionsList();
            updatePlayersList();

            // Logic to determine which host section to display on initialization/re-entry
            if(hostRoomId) { // Check if a room is already established
                if (quizState.isQuestionActive || quizState.currentQuestionIndex < quizState.shuffledQuestions.length) {
                    hostSetup.classList.add('hidden');
                    qrContainer.classList.add('hidden');
                    hostResults.classList.add('hidden');
                    hostQuestionDisplay.classList.remove('hidden');
                    if (hostViewHeading) hostViewHeading.classList.add('hidden'); // Hide "Quiz hosten" heading
                    // Re-render current question details if returning to view
                    const currentQuestion = quizState.shuffledQuestions[quizState.currentQuestionIndex];
                    currentQuestionTextEl.textContent = currentQuestion.question;
                    // Options are displayed without correct indicators while question is active
                    displayHostOptions(currentQuestion.shuffledOptions || currentQuestion.options, []); // Use shuffled if available
                    questionCounterEl.textContent = `Frage ${quizState.currentQuestionIndex + 1} von ${quizState.shuffledQuestions.length}`;
                    answersCount.textContent = quizState.answersReceived.toString();
                    totalPlayers.textContent = getNonHostPlayerCount().toString();
                    if (quizState.currentQuestionIndex < quizState.shuffledQuestions.length - 1) showNextBtn.classList.remove('hidden');
                    else showResultsBtn.classList.remove('hidden');
                } else if (hostResults.classList.contains('active')) {
                    hostSetup.classList.add('hidden');
                    qrContainer.classList.add('hidden');
                    hostQuestionDisplay.classList.add('hidden');
                    hostResults.classList.remove('hidden');
                    if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading
                    displayLeaderboard();
                } else { // Room is open, but quiz not active, show QR container
                    hostSetup.classList.add('hidden');
                    qrContainer.classList.remove('hidden');
                    if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading
                    const currentJoinUrl = updateJoinLink(hostRoomId); // Get the current join URL
                    generateQRCode(currentJoinUrl); // Generate QR with the full URL
                    roomIdElement.textContent = quizState.roomId || 'N/A';
                }
            } else { // Default: show setup if no room instance
                hostSetup.classList.remove('hidden');
                qrContainer.classList.add('hidden');
                hostQuestionDisplay.classList.add('hidden');
                hostResults.classList.add('hidden');
                if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading
            }


            /**
             * Renders the list of added questions in the host setup view.
             */
            function renderQuestionsList() {
                questionsContainer.innerHTML = '';
                if (quizState.questions.length === 0) {
                    questionsContainer.innerHTML = '<p>Noch keine Fragen hinzugefügt</p>';
                    startQuizBtn.classList.add('hidden');
                    return;
                }

                quizState.questions.forEach((q, index) => {
                    const item = document.createElement('div');
                    item.className = 'question-item';
                    const correctIndices = q.correct.map(i => i + 1).join(', ');
                    item.innerHTML = `
                        <p><strong>F${index + 1}:</strong> ${sanitizeHTML(q.question)}</p>
                        <p><strong>Optionen:</strong> ${q.options.map(o => sanitizeHTML(o)).join('; ')}</p>
                        <p><strong>Richtige Option(en):</strong> ${correctIndices}</p>
                        <button class="btn remove-question" data-index="${index}">Entfernen</button>
                    `;
                    questionsContainer.appendChild(item);
                });

                document.querySelectorAll('.remove-question').forEach(button => {
                    button.onclick = (e) => {
                        const index = parseInt(e.target.getAttribute('data-index'));
                        quizState.questions.splice(index, 1);
                        renderQuestionsList();
                    };
                });

                startQuizBtn.classList.remove('hidden');
            }

            /**
             * Initializes Supabase for the host, creates a room, and sets up subscriptions.
             */
            async function initHostSupabase() {
                // Generate a random 4-character alphanumeric room code
                const rawGeneratedId = generateAlphanumericId(4);
                hostRoomId = rawGeneratedId; // Store the raw ID for Supabase
                quizState.roomId = rawGeneratedId.substring(0, 2) + ' ' + rawGeneratedId.substring(2, 4); // Store formatted for display

                hostPlayerId = `host-${generateAlphanumericId(12)}`; // Unique ID for the host player

                try {
                    // Insert room into Supabase
                    const { data: roomData, error: roomError } = await supabaseClient
                        .from('rooms')
                        .insert([
                            {
                                id: hostRoomId,
                                current_question_index: quizState.currentQuestionIndex,
                                quiz_state: {
                                    is_active: false,
                                    question_duration: quizState.questionDuration
                                },
                                host_player_id: hostPlayerId
                            }
                        ]);

                    if (roomError) throw roomError;
                    console.log('Room created in Supabase:', roomData);

                    // Insert host as a player (for internal state management, not for display in player list)
                    const { data: hostPlayerData, error: hostPlayerError } = await supabaseClient
                        .from('players')
                        .insert([
                            {
                                id: hostPlayerId,
                                room_id: hostRoomId,
                                name: 'Host', // Host's name
                                score: 0,
                                is_connected: true
                            }
                        ]);

                    if (hostPlayerError) throw hostPlayerError;
                    console.log('Host player created:', hostPlayerData);
                    quizState.players[hostPlayerId] = {
                        id: hostPlayerId,
                        name: 'Host',
                        score: 0,
                        currentAnswer: [],
                        answerTime: null
                    };
                    updatePlayersList();


                    // Subscribe to player changes in this room with reconnection logic
                    function subscribeToPlayerChanges() {
                        hostPlayersSubscription = supabaseClient
                            .channel(`players_in_room_${hostRoomId}_${Date.now()}`) // Unique channel name for reconnection
                            .on('postgres_changes', {
                                event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
                                schema: 'public',
                                table: 'players',
                                filter: `room_id=eq.${hostRoomId}`
                            }, payload => {
                                if (payload.eventType === 'INSERT') {
                                    if (payload.new.id !== hostPlayerId) { // Ignore host's own insert
                                        console.log('New player joined:', payload.new);
                                        quizState.players[payload.new.id] = {
                                            id: payload.new.id,
                                            name: payload.new.name,
                                            score: payload.new.score,
                                            currentAnswer: [],
                                            answerTime: null
                                        };
                                        updatePlayersList();
                                    }
                                } else if (payload.eventType === 'UPDATE') {
                                    if (payload.new.id !== hostPlayerId) { // Ignore host's own updates
                                        handlePlayerData(payload.new);
                                    }
                                } else if (payload.eventType === 'DELETE') {
                                    console.log('Player disconnected (deleted):', payload.old.id);
                                    if (quizState.players[payload.old.id]) {
                                        delete quizState.players[payload.old.id];
                                        updatePlayersList();
                                        if (quizState.isQuestionActive && quizState.answersReceived >= getNonHostPlayerCount()) {
                                            endQuestion();
                                        }
                                    }
                                }
                            })
                            .subscribe((status) => {
                                if (status === 'SUBSCRIBED') {
                                    console.log('Host subscribed to player changes channel');
                                    hostPlayersReconnectAttempts = 0;
                                    // Sync players from DB to catch anything missed during reconnection
                                    updatePlayersList();
                                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                                    console.error('Host player changes channel status:', status);
                                    if (hostPlayersReconnectAttempts < HOST_MAX_RECONNECT_ATTEMPTS) {
                                        hostPlayersReconnectAttempts++;
                                        console.log(`Reconnecting player changes (${hostPlayersReconnectAttempts}/${HOST_MAX_RECONNECT_ATTEMPTS})...`);
                                        if (hostPlayersSubscription) {
                                            supabaseClient.removeChannel(hostPlayersSubscription);
                                        }
                                        setTimeout(subscribeToPlayerChanges, RECONNECT_DELAY_MS);
                                    } else {
                                        console.error('Host player changes: max reconnect attempts reached.');
                                    }
                                }
                            });
                    }
                    subscribeToPlayerChanges();


                    // Get initial players list
                    const { data: initialPlayers, error: initialPlayersError } = await supabaseClient
                        .from('players')
                        .select('*')
                        .eq('room_id', hostRoomId)
                        .eq('is_connected', true); // Only fetch currently connected players

                    if (initialPlayersError) throw initialPlayersError;
                    initialPlayers.forEach(p => {
                        if (p.id !== hostPlayerId) { // Ensure host is not added to quizState.players from initial fetch
                            quizState.players[p.id] = {
                                id: p.id,
                                name: p.name,
                                score: p.score || 0,
                                currentAnswer: p.last_answer_data || [],
                                answerTime: p.last_answer_time ? (new Date(p.last_answer_time).getTime() - hostQuestionStartTime) / 1000 : null
                            };
                        }
                    });
                    updatePlayersList();


                    // Initialize broadcast channel for this room with reconnection logic
                    let hostBroadcastInitialConnect = true;
                    function subscribeToHostBroadcast() {
                        hostSupabaseChannel = supabaseClient.channel(`quiz_room_${hostRoomId}`);
                        hostSupabaseChannel.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                console.log('Host subscribed to broadcast channel:', `quiz_room_${hostRoomId}`);
                                hostBroadcastReconnectAttempts = 0;
                                if (hostBroadcastInitialConnect) {
                                    hostBroadcastInitialConnect = false;
                                    hostSetup.classList.add('hidden');
                                    qrContainer.classList.remove('hidden');
                                    roomIdElement.textContent = quizState.roomId;
                                    const currentJoinUrl = updateJoinLink(hostRoomId);
                                    generateQRCode(currentJoinUrl);
                                    if (hostViewHeading) hostViewHeading.classList.remove('hidden');
                                }
                            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                                console.error('Host broadcast channel status:', status);
                                if (hostBroadcastReconnectAttempts < HOST_MAX_RECONNECT_ATTEMPTS) {
                                    hostBroadcastReconnectAttempts++;
                                    console.log(`Reconnecting host broadcast (${hostBroadcastReconnectAttempts}/${HOST_MAX_RECONNECT_ATTEMPTS})...`);
                                    if (hostSupabaseChannel) {
                                        supabaseClient.removeChannel(hostSupabaseChannel);
                                    }
                                    setTimeout(subscribeToHostBroadcast, RECONNECT_DELAY_MS);
                                } else {
                                    console.error('Host broadcast: max reconnect attempts reached.');
                                    showMessage('Verbindung zum Quiz-Raum verloren. Bitte lade die Seite neu.', 'error');
                                    resetHostStateAndUI();
                                }
                            }
                        });
                    }
                    subscribeToHostBroadcast();

                    // Start host heartbeat to signal liveness
                    if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
                    hostHeartbeatInterval = setInterval(async () => {
                        if (hostPlayerId) {
                            try {
                                await supabaseClient.from('players')
                                    .update({ is_connected: true })
                                    .eq('id', hostPlayerId);
                            } catch (e) {
                                console.warn('Host heartbeat failed:', e);
                            }
                        }
                    }, 30000); // Every 30 seconds

                } catch (error) {
                    console.error('Error initializing host Supabase:', error);
                    showMessage(`Fehler beim Starten des Hosts: ${error.message}. Bitte überprüfe deine Supabase-Konfiguration und versuche es erneut.`, 'error');
                    resetHostStateAndUI();
                }
            }

            /**
             * Handles data received from connected players (via Supabase database updates).
             * @param {Object} playerData - The updated player data from Supabase.
             */
            function handlePlayerData(playerData) {
                const playerId = playerData.id;
                console.log('Host received player data update from', playerId, playerData);

                // Ensure the player exists in our local state and the quiz is active
                if (!quizState.players[playerId] || !quizState.isQuestionActive) {
                    // If player is new or reconnected, add them to local state
                    if (playerId !== hostPlayerId && !quizState.players[playerId]) { // Only add if not host and not already present
                        quizState.players[playerId] = {
                            id: playerId,
                            name: playerData.name,
                            score: playerData.score || 0,
                            currentAnswer: playerData.last_answer_data || [],
                            answerTime: playerData.last_answer_time ? (new Date(playerData.last_answer_time).getTime() - hostQuestionStartTime) / 1000 : null
                        };
                        updatePlayersList();
                    }
                    // If quiz is not active, just update player's score and connection status
                    if (playerId !== hostPlayerId) { // Only update non-host players
                        quizState.players[playerId].score = playerData.score || 0;
                        quizState.players[playerId].is_connected = playerData.is_connected;
                        updatePlayersList(); // Update connected players count
                    }
                    return;
                }

                // Only count as a new answer if player hasn't answered this question yet
                // and the answer data is different from the last recorded one for this question
                const currentQuestion = quizState.shuffledQuestions[quizState.currentQuestionIndex];
                const hasAnsweredCurrentQuestion = quizState.players[playerId].currentAnswer &&
                                                   JSON.stringify(quizState.players[playerId].currentAnswer) === JSON.stringify(playerData.last_answer_data);

                if (playerData.last_answer_data && !hasAnsweredCurrentQuestion) {
                    quizState.answersReceived++;
                    const answerReceiveTime = playerData.last_answer_time ? new Date(playerData.last_answer_time).getTime() : Date.now();
                    const timeTaken = (answerReceiveTime - hostQuestionStartTime) / 1000; // Time in seconds
                    quizState.players[playerId].answerTime = timeTaken;
                    quizState.players[playerId].currentAnswer = playerData.last_answer_data; // Store the new answer
                    answersCount.textContent = quizState.answersReceived.toString();

                    // Check if all non-host players have answered
                    if (quizState.answersReceived >= getNonHostPlayerCount()) {
                        endQuestion();
                    }
                }
            }

            /**
             * Updates the displayed list of connected players and player count.
             */
            async function updatePlayersList() {
                try {
                    const { data: players, error } = await supabaseClient
                        .from('players')
                        .select('id, name, score') // Fetch score to keep local state updated
                        .eq('room_id', hostRoomId)
                        .eq('is_connected', true); // Only show connected players

                    if (error) throw error;

                    // Filter out the host from the list of players for display
                    const nonHostPlayers = players.filter(p => p.id !== hostPlayerId);

                    // During active questions, only update UI and add new players - don't overwrite existing state
                    // This prevents race conditions where answer data could be lost
                    if (quizState.isQuestionActive) {
                        // Only add new players, don't modify existing ones
                        nonHostPlayers.forEach(p => {
                            if (!quizState.players[p.id]) {
                                quizState.players[p.id] = {
                                    id: p.id,
                                    name: p.name,
                                    score: p.score || 0,
                                    currentAnswer: [],
                                    answerTime: null
                                };
                            }
                        });
                        // Remove disconnected players
                        const connectedIds = new Set(nonHostPlayers.map(p => p.id));
                        connectedIds.add(hostPlayerId); // Keep host
                        Object.keys(quizState.players).forEach(id => {
                            if (!connectedIds.has(id)) {
                                delete quizState.players[id];
                            }
                        });
                    } else {
                        // When no question is active, safe to do full sync
                        const currentConnectedPlayers = {};
                        nonHostPlayers.forEach(p => {
                            currentConnectedPlayers[p.id] = {
                                id: p.id,
                                name: p.name,
                                score: p.score || 0,
                                currentAnswer: quizState.players[p.id]?.currentAnswer || [],
                                answerTime: quizState.players[p.id]?.answerTime || null
                            };
                        });
                        // Ensure the host's player object is in quizState.players for internal logic
                        if (quizState.players[hostPlayerId]) {
                            currentConnectedPlayers[hostPlayerId] = quizState.players[hostPlayerId];
                        }
                        quizState.players = currentConnectedPlayers;
                    }

                    const playerCount = nonHostPlayers.length; // Count only non-host players
                    playerCountElement.textContent = playerCount.toString();
                    totalPlayers.textContent = playerCount.toString(); // Total players for answers count is also non-host

                    playersList.innerHTML = '';

                    nonHostPlayers.forEach(p => { // Iterate only non-host players for display
                        const i = document.createElement('div');
                        i.className = 'player-item';
                        i.textContent = p.name;
                        playersList.appendChild(i);
                    });

                    startQuestionsBtn.classList.toggle('hidden', playerCount === 0);
                } catch (error) {
                    console.error('Error updating players list from Supabase:', error);
                }
            }

            /**
             * Generates and displays a QR code for the given URL.
             * @param {string} url - The URL to encode in the QR code.
             */
            function generateQRCode(url) {
                qrcodeElement.innerHTML = ''; // Clear previous QR code
                if (typeof QRCode === 'undefined') {
                    console.error("QR-Code-Bibliothek nicht geladen.");
                    qrcodeElement.innerHTML = `<p class="qr-error">QR-Code-Bibliothek nicht geladen. URL: ${sanitizeHTML(url)}</p>`;
                    return;
                }
                try {
                    new QRCode(qrcodeElement, {
                        text: url, // Encode the full URL
                        width: 240, // Increased size for initial display
                        height: 240,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H // High error correction for complex URLs
                    });
                } catch (e) {
                    console.error("QR Code generation error:", e);
                    qrcodeElement.innerHTML = `<p class="qr-error">Fehler beim Generieren des QR-Codes. URL: ${sanitizeHTML(url)}</p>`;
                }
            }

             /**
              * Updates the join link to include the host's Peer ID.
              * @param {string} roomId - The Supabase room ID (4-digit alphanumeric code).
              * @returns {string} The full join URL.
              */
            function updateJoinLink(roomId) {
                // Correctly construct the URL by taking the base path and appending the query parameter
                const baseUrl = window.location.origin + window.location.pathname.split('?')[0];
                const joinUrl = `${baseUrl}?host=${roomId}`;
                joinLinkElement.href = joinUrl;
                // Display the short URL for easy typing
                const shortUrl = 'https://bycs.link/karten';
                joinLinkElement.textContent = shortUrl;

                joinLinkModalElement.href = joinUrl;
                joinLinkModalElement.textContent = shortUrl;

                return joinUrl; // Return the URL for QR code generation
            }


            /**
             * Starts a new question round on the host side.
             */
            async function startQuestion() {
                if (quizState.currentQuestionIndex >= quizState.shuffledQuestions.length) {
                    showFinalResults();
                    return;
                }

                const currentQuestion = quizState.shuffledQuestions[quizState.currentQuestionIndex];
                quizState.answersReceived = 0;
                quizState.isQuestionActive = true;
                hostQuestionStartTime = Date.now();

                // Prepare shuffled options and correct indices for this question
                const optionObjects = currentQuestion.options.map((text, index) => ({ text, originalIndex: index }));
                shuffleArray(optionObjects); // Shuffle the options
                const shuffledOptions = optionObjects.map(obj => obj.text);
                const shuffledCorrectIndices = currentQuestion.correct.map(originalIdx =>
                    optionObjects.findIndex(obj => obj.originalIndex === originalIdx)
                );

                // Store shuffled options and correct indices in the current question object
                currentQuestion.shuffledOptions = shuffledOptions;
                currentQuestion.shuffledCorrect = shuffledCorrectIndices;

                // Reset player answers for the new question in local state and in DB
                for (const p of Object.values(quizState.players)) {
                    p.currentAnswer = [];
                    p.answerTime = null;
                    if (p.id !== hostPlayerId) { // Don't reset host's own entry
                        try {
                            await supabaseClient.from('players').update({ last_answer_data: [], last_answer_time: null }).eq('id', p.id);
                        } catch (error) {
                            console.error(`Error resetting player ${p.name}'s answer:`, error);
                        }
                    }
                }


                currentQuestionTextEl.textContent = currentQuestion.question;
                // Display options on host side WITHOUT correct indicators initially
                displayHostOptions(shuffledOptions, []); // Use shuffled options for display
                questionCounterEl.textContent = `Frage ${quizState.currentQuestionIndex + 1} von ${quizState.shuffledQuestions.length}`;
                answersCount.textContent = '0';
                totalPlayers.textContent = getNonHostPlayerCount().toString();

                showNextBtn.classList.add('hidden');
                showResultsBtn.classList.add('hidden');
                hostScoreboardEl.classList.add('hidden'); // Hide scoreboard while question is active
                if (hostViewHeading) hostViewHeading.classList.add('hidden'); // Hide "Quiz hosten" heading

                startTimer(quizState.questionDuration); // Use host-defined duration
                await sendQuestionToPlayers(currentQuestion); // Pass the question object which now contains shuffled data
            }

            /**
             * Displays the question options on the host side.
             * @param {string[]} options - An array of option strings (already shuffled if applicable).
             * @param {number[]} [correctIndices=[]] - An optional array of indices for correct answers (already re-mapped if applicable).
             * @param {number[]} [optionCounts=[]] - An optional array of counts for each option selected by players.
             */
            function displayHostOptions(options, correctIndices = [], optionCounts = []) {
                 hostCurrentOptionsEl.innerHTML = '';
                 const correctSet = new Set(correctIndices);
                 options.forEach((option, index) => {
                     const li = document.createElement('li');
                     let optionText = option;
                     if (optionCounts && optionCounts[index] !== undefined) {
                         optionText += ` (${optionCounts[index]}x gewählt)`;
                     }
                     li.textContent = optionText;
                     if (correctSet.has(index)) {
                         li.classList.add('correct');
                     }
                     hostCurrentOptionsEl.appendChild(li);
                 });
            }


            /**
             * Sends question data to all connected players via Supabase Broadcast.
             * @param {Object} question - The question object to send (now contains shuffled options and correct indices).
             */
            async function sendQuestionToPlayers(question) {
                const qData = {
                    type: 'question',
                    question: question.question,
                    options: question.shuffledOptions, // Send shuffled options
                    index: quizState.currentQuestionIndex,
                    total: quizState.shuffledQuestions.length,
                    startTime: hostQuestionStartTime, // Send start time for player timer/scoring
                    duration: quizState.questionDuration // Send duration to players
                };
                try {
                    // Update room state in DB
                    await supabaseClient
                        .from('rooms')
                        .update({
                            current_question_index: quizState.currentQuestionIndex,
                            quiz_state: { is_active: true, question_duration: quizState.questionDuration }
                        })
                        .eq('id', hostRoomId);

                    // Broadcast question to players
                    await hostSupabaseChannel.send({
                        type: 'broadcast',
                        event: 'quiz_event',
                        payload: qData
                    });
                    console.log('Question broadcasted:', qData);
                } catch (error) {
                    console.error('Error sending question via Supabase:', error);
                    showMessage('Fehler beim Senden der Frage. Bitte überprüfe deine Supabase-Verbindung.', 'error');
                }
            }

            /**
             * Starts the timer for the current question.
             * @param {number} durationSeconds - The total duration of the timer in seconds.
             */
            function startTimer(durationSeconds) {
                timerBar.style.width = '100%';
                if (hostTimerInterval) clearInterval(hostTimerInterval);

                const totalDurationMs = durationSeconds * 1000;
                const timerStartTime = Date.now();

                hostTimerInterval = setInterval(() => {
                     const elapsed = Date.now() - timerStartTime;
                     const remaining = Math.max(0, totalDurationMs - elapsed);
                     timerBar.style.width = `${(remaining / totalDurationMs) * 100}%`;

                    if (remaining <= 0) {
                        endQuestion();
                    }
                }, 100); // Update every 100ms
            }

            /**
             * Ends the current question round, calculates scores, and displays results.
             */
            async function endQuestion() {
                if (!quizState.isQuestionActive) return;

                if (hostTimerInterval) {
                    clearInterval(hostTimerInterval);
                    hostTimerInterval = null;
                }

                quizState.isQuestionActive = false;

                // Calculate option counts for display on host side
                const currentQuestion = quizState.shuffledQuestions[quizState.currentQuestionIndex];
                const optionCounts = Array(currentQuestion.shuffledOptions.length).fill(0);
                getNonHostPlayers().forEach(p => {
                    if (p.currentAnswer && Array.isArray(p.currentAnswer)) {
                        p.currentAnswer.forEach(ansIndex => {
                            if (optionCounts[ansIndex] !== undefined) {
                                optionCounts[ansIndex]++;
                            }
                        });
                    }
                });

                // Display correct answers and counts on the host side
                displayHostOptions(currentQuestion.shuffledOptions, currentQuestion.shuffledCorrect, optionCounts);


                calculateScores();
                await sendResultsToPlayers();

                displayCurrentScoreboard(); // Display the scoreboard

                if (quizState.currentQuestionIndex < quizState.shuffledQuestions.length - 1) {
                    showNextBtn.classList.remove('hidden');
                    showResultsBtn.classList.add('hidden');
                } else {
                    showNextBtn.classList.add('hidden');
                    showResultsBtn.classList.remove('hidden');
                }
            }

            /**
             * Calculates scores for the current question based on correctness and time taken.
             */
            function calculateScores() {
                const currentQ = quizState.shuffledQuestions[quizState.currentQuestionIndex]; // Use shuffled questions
                const correctSet = new Set(currentQ.shuffledCorrect); // Use shuffled correct indices
                const totalQuestionTime = quizState.questionDuration; // Use host-defined duration
                const numQuestions = quizState.shuffledQuestions.length;

                const basePointsFirst = 100;
                const basePointsLast = 300;
                let currentQuestionBasePoints = basePointsFirst;

                if (numQuestions > 1) {
                    const pointsIncreasePerQuestion = (basePointsLast - basePointsFirst) / (numQuestions - 1);
                    currentQuestionBasePoints = basePointsFirst + (quizState.currentQuestionIndex * pointsIncreasePerQuestion);
                }
                // If only one question, it gets basePointsFirst (100)
                // If 2 questions, 1st gets 100, 2nd gets 300. (200 increase / 1 interval = 200 per question)
                // If 3 questions, 1st gets 100, 2nd gets 200, 3rd gets 300. (200 increase / 2 intervals = 100 per question)


                getNonHostPlayers().forEach(p => {
                    if (p.currentAnswer && p.currentAnswer.length > 0) {
                        const playerAnsSet = new Set(p.currentAnswer);

                        // Count how many correct answers the player selected
                        const correctHits = [...playerAnsSet].filter(item => correctSet.has(item)).length;

                        if (correctHits > 0) {
                            const correctRatio = correctHits / correctSet.size;
                            // Score = ratio * (Base Points + Time Bonus)
                            let timeTaken = p.answerTime !== null ? p.answerTime : totalQuestionTime;
                            
                            // Time taken cannot be negative or greater than total time
                            timeTaken = Math.max(0, Math.min(timeTaken, totalQuestionTime));
                            
                            const timeRemaining = Math.max(0, totalQuestionTime - timeTaken);
                            const timeBonus = (timeRemaining / totalQuestionTime) * (currentQuestionBasePoints * 0.5);

                            p.score += correctRatio * (currentQuestionBasePoints + timeBonus);
                        }
                    }
                });
            }

            /**
             * Sends results of the current question to all players via Supabase Broadcast.
             */
            async function sendResultsToPlayers() {
                const currentQ = quizState.shuffledQuestions[quizState.currentQuestionIndex]; // Use shuffled questions
                const isFinalQ = quizState.currentQuestionIndex === quizState.shuffledQuestions.length - 1;

                const leaderboardData = getLeaderboardData(); // Get latest leaderboard for results

                for (const p of getNonHostPlayers()) {
                    // Update player score in DB
                    try {
                        await supabaseClient
                            .from('players')
                            .update({ score: p.score })
                            .eq('id', p.id);
                    } catch (error) {
                        console.error(`Error updating player ${p.name}'s score in Supabase:`, error);
                    }
                }

                // Broadcast result to all players after all scores are updated in DB
                const resData = {
                    type: 'result',
                    correct: currentQ.shuffledCorrect, // Send shuffled correct indices
                    isFinal: isFinalQ,
                    options: currentQ.shuffledOptions, // Send shuffled options to player for result display
                    leaderboard: leaderboardData // Include leaderboard for final results
                };

                try {
                    await hostSupabaseChannel.send({
                        type: 'broadcast',
                        event: 'quiz_event',
                        payload: resData
                    });
                    console.log('Results broadcasted.');
                } catch (error) {
                    console.error('Error broadcasting results via Supabase:', error);
                    showMessage('Fehler beim Senden der Ergebnisse. Bitte überprüfe deine Supabase-Verbindung.', 'error');
                }
            }

             /**
              * Displays the current scoreboard (top 10) on the host side.
              */
            function displayCurrentScoreboard() {
                const sortedPlayers = getLeaderboardData(); // This function already filters out the host
                scoreboardListEl.innerHTML = '';
                hostScoreboardEl.classList.remove('hidden');

                const topPlayers = sortedPlayers.slice(0, 10);

                if (topPlayers.length === 0) {
                    scoreboardListEl.innerHTML = '<li>Noch keine Spieler.</li>';
                    return;
                }

                topPlayers.forEach((p, idx) => {
                    const li = document.createElement('li');
                    li.className = 'scoreboard-item';
                    if (idx === 0) li.classList.add('rank-1');
                    else if (idx === 1) li.classList.add('rank-2');
                    else if (idx === 2) li.classList.add('rank-3');
                    li.innerHTML = `<span>${idx + 1}. ${sanitizeHTML(p.name)}</span><span>${Math.round(p.score)} Punkte</span>`;
                    scoreboardListEl.appendChild(li);
                });
            }


            /**
             * Shows the final results leaderboard on the host side.
             */
            function showFinalResults() {
                hostQuestionDisplay.classList.add('hidden');
                hostResults.classList.remove('hidden'); // Ensure host results view is shown
                if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading

                displayLeaderboard();

                // No need to send 'final' broadcast here, it's already sent with the last 'result'
                // This function just handles the host UI transition
            }

            /**
             * Retrieves and sorts player data for the leaderboard.
             * @returns {Array<Object>} Sorted array of player objects with name and score.
             */
            function getLeaderboardData() {
                return getNonHostPlayers()
                    .map(p => ({ name: p.name, score: p.score }))
                    .sort((a, b) => b.score - a.score);
            }

            /**
             * Displays the final leaderboard on the host side.
             */
            function displayLeaderboard() {
                const sortedPlayers = getLeaderboardData(); // This function already filters out the host
                leaderboard.innerHTML = '';

                if (sortedPlayers.length === 0) {
                    leaderboard.innerHTML = '<p>Noch keine Spieler in der Rangliste.</p>';
                    return;
                }

                sortedPlayers.forEach((p, idx) => {
                    const i = document.createElement('div');
                    i.className = 'leaderboard-item';
                    if (idx === 0) i.classList.add('rank-1');
                    else if (idx === 1) i.classList.add('rank-2');
                    else if (idx === 2) i.classList.add('rank-3');
                    i.innerHTML = `<span>${idx + 1}. ${sanitizeHTML(p.name)}</span><span>${Math.round(p.score)} Punkte</span>`;
                    leaderboard.appendChild(i);
                });
            }

            /**
             * Resets the host's state and UI to the initial setup form.
             */
            async function resetHostStateAndUI() {
                // Stop heartbeat
                if (hostHeartbeatInterval) {
                    clearInterval(hostHeartbeatInterval);
                    hostHeartbeatInterval = null;
                }

                // Reset reconnection counters
                hostBroadcastReconnectAttempts = 0;
                hostPlayersReconnectAttempts = 0;

                // Unsubscribe from Supabase channels
                if (hostSupabaseChannel) {
                    await supabaseClient.removeChannel(hostSupabaseChannel);
                    hostSupabaseChannel = null;
                }
                if (hostPlayersSubscription) {
                    await supabaseClient.removeChannel(hostPlayersSubscription);
                    hostPlayersSubscription = null;
                }

                hostGlobalQuizState = null;
                isHostInitialized = false;
                hostRoomId = null;
                hostPlayerId = null;

                fileStatus.textContent = '';
                if(jsonFileInput) jsonFileInput.value = '';
                hostResults.classList.add('hidden');
                hostQuestionDisplay.classList.add('hidden');
                qrContainer.classList.add('hidden');
                hostSetup.classList.remove('hidden');
                document.getElementById('role-selection').classList.remove('hidden'); // Show role selection again
                if (hostViewHeading) hostViewHeading.classList.remove('hidden'); // Show "Quiz hosten" heading
                initializeHostFeatures(); // Re-initialize to reset UI fully
            }
        }

// --- Player State & Initialization Flag ---
let playerSupabaseChannel = null;
let playerRoomId = null;
let playerCurrentId = null;
let isPlayerInitialized = false;
let playerTimerInterval = null;
let playerCurrentQuestionOptions = [];
let selectedAnswers = [];
let playerScore = 0;
let playerQuestionStartTime = null;
let playerBeforeUnloadHandler = null;

// --- Player Persistence Helpers ---
/**
 * Gets the localStorage key for storing player ID for a specific room.
 * @param {string} roomId - The room ID.
 * @returns {string} The localStorage key.
 */
function getPlayerStorageKey(roomId) {
    return `qlash_player_${roomId}`;
}

/**
 * Saves player session data to localStorage.
 * @param {string} roomId - The room ID.
 * @param {string} playerId - The player's unique ID.
 * @param {string} playerName - The player's name.
 */
function savePlayerSession(roomId, playerId, playerName) {
    const sessionData = {
        playerId: playerId,
        playerName: playerName,
        timestamp: Date.now()
    };
    localStorage.setItem(getPlayerStorageKey(roomId), JSON.stringify(sessionData));
}

/**
 * Retrieves player session data from localStorage.
 * @param {string} roomId - The room ID.
 * @returns {Object|null} The session data or null if not found/expired.
 */
function getPlayerSession(roomId) {
    const key = getPlayerStorageKey(roomId);
    const data = localStorage.getItem(key);
    if (!data) return null;

    try {
        const sessionData = JSON.parse(data);
        const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
        if (Date.now() - sessionData.timestamp > SESSION_EXPIRY_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return sessionData;
    } catch (e) {
        localStorage.removeItem(key);
        return null;
    }
}

/**
 * Clears player session data from localStorage.
 * @param {string} roomId - The room ID.
 */
function clearPlayerSession(roomId) {
    localStorage.removeItem(getPlayerStorageKey(roomId));
}

/**
 * Triggers confetti animation for correct answers.
 */
function triggerConfetti() {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) {
        console.warn("Confetti-Container nicht gefunden.");
        return;
    }

    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const numConfetti = 50;

    for (let i = 0; i < numConfetti; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = `${-20 - Math.random() * 100}px`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = `${Math.random() * 0.5}s`;
        piece.style.animationDuration = `${2 + Math.random() * 2}s`;

        confettiContainer.appendChild(piece);

        piece.addEventListener('animationend', () => {
            piece.remove();
        });
    }
}

/**
 * Initializes all features and event listeners for the player role.
 */
function initializePlayerFeatures() {
            console.log("Initializing Player Features. Initialized flag:", isPlayerInitialized);

            // Cache DOM elements for performance
            const roomCodeInput = document.getElementById('room-code-input');
            const playerNameInput = document.getElementById('player-name-input');
            const joinBtn = document.getElementById('join-btn');
            const joinForm = document.getElementById('join-form');
            const waitingRoom = document.getElementById('waiting-room');
            const waitingMessage = document.getElementById('waiting-message');
            const playerQuestionView = document.getElementById('player-question');
            const playerQuestionTextEl = document.getElementById('player-question-text');
            const playerQuestionCounterEl = document.getElementById('player-question-counter');
            const playerTimerBar = document.getElementById('player-timer-bar');
            const optionsContainer = document.getElementById('options-container');
            const submitAnswerBtn = document.getElementById('submit-answer-btn');
            const playerResultView = document.getElementById('player-result');
            const resultDisplay = document.getElementById('result-display');
            const playerScoreEl = document.getElementById('player-score');
            const waitingForNext = document.getElementById('waiting-for-next');
            const playerFinalResultView = document.getElementById('player-final-result');
            const finalScoreEl = document.getElementById('final-score');
            const playAgainBtn = document.getElementById('play-again-btn');
            const playerLeaderboardContainer = document.getElementById('player-leaderboard-container');

            if (!isPlayerInitialized) {
                console.log("Setting up player event listeners for the first time.");

                joinBtn.addEventListener('click', async () => {
                    const roomCode = roomCodeInput.value.trim().replace(/\s/g, ''); // Remove spaces
                    const playerName = playerNameInput.value.trim();
                    // Use a default name if player doesn't provide one
                    const finalPlayerName = playerName || 'Spieler ' + generateAlphanumericId(4);

                    if (!roomCode) {
                        showMessage('Bitte gib einen Raum-Code ein.', 'error');
                        return;
                    }
                    await initPlayerSupabase(roomCode, finalPlayerName);
                });

                submitAnswerBtn.addEventListener('click', async () => {
                    if (selectedAnswers.length === 0) {
                        showMessage('Bitte wähle mindestens eine Antwort aus.', 'info');
                        return;
                    }

                    submitAnswerBtn.disabled = true;
                    optionsContainer.querySelectorAll('button.option-btn').forEach(btn => btn.disabled = true);
                    console.log("Player submitted answer:", selectedAnswers);

                    if (playerTimerInterval) {
                        clearInterval(playerTimerInterval);
                        playerTimerInterval = null;
                    }

                    // Update player's answer in Supabase
                    try {
                        await supabaseClient
                            .from('players')
                            .update({
                                last_answer_data: selectedAnswers,
                                last_answer_time: new Date().toISOString()
                            })
                            .eq('id', playerCurrentId);
                        console.log('Player answer updated in Supabase.');
                    } catch (error) {
                        console.error('Error updating player answer in Supabase:', error);
                        showMessage('Fehler beim Absenden der Antwort. Bitte versuche es erneut.', 'error');
                    }
                });

                playAgainBtn.addEventListener('click', () => {
                    resetPlayerStateAndUI();
                    isPlayerInitialized = false;
                    showView('role-selection');
                });

                // Clean up on window unload using fetch+keepalive for reliable delivery
                if (playerBeforeUnloadHandler) {
                    window.removeEventListener('beforeunload', playerBeforeUnloadHandler);
                }
                playerBeforeUnloadHandler = () => {
                    // Use fetch with keepalive for reliable delivery during page unload
                    if (playerCurrentId && SUPABASE_URL && SUPABASE_ANON_KEY) {
                        const url = `${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(playerCurrentId)}`;
                        const headers = {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Prefer': 'return=minimal'
                        };
                        const body = JSON.stringify({ is_connected: false });
                        try {
                            fetch(url, { method: 'PATCH', headers, body, keepalive: true });
                        } catch (e) {
                            // Best effort - page is unloading
                        }
                    }
                    // Best-effort channel cleanup
                    if (playerSupabaseChannel) {
                        supabaseClient.removeChannel(playerSupabaseChannel);
                    }
                };
                window.addEventListener('beforeunload', playerBeforeUnloadHandler);

                isPlayerInitialized = true;
            }

            roomCodeInput.value = '';
            playerNameInput.value = '';
            joinForm.classList.remove('hidden');
            waitingRoom.classList.add('hidden');
            playerQuestionView.classList.add('hidden');
            playerResultView.classList.add('hidden');
            playerFinalResultView.classList.add('hidden');


            /**
             * Initializes Supabase for the player and joins a room.
             * @param {string} hostRoomId - The Supabase room ID.
             * @param {string} pName - The player's name.
             */
            async function initPlayerSupabase(hostRoomId, pName) {
                playerRoomId = hostRoomId;

                joinForm.classList.add('hidden');
                waitingRoom.classList.remove('hidden');
                waitingMessage.textContent = `Verbinde mit Raum ${playerRoomId}...`;

                try {
                    // Check if room exists
                    const { data: room, error: roomError } = await supabaseClient
                        .from('rooms')
                        .select('id')
                        .eq('id', playerRoomId)
                        .single();

                    if (roomError || !room) {
                        showMessage('Raum nicht gefunden oder Fehler beim Abrufen des Raums. Bitte überprüfe den Code.', 'error');
                        resetPlayerStateAndUI();
                        return;
                    }

                    // Check for existing session (reconnection)
                    const existingSession = getPlayerSession(playerRoomId);
                    let isReconnecting = false;

                    if (existingSession) {
                        // Try to reconnect with existing player ID
                        const { data: existingPlayer, error: existingPlayerError } = await supabaseClient
                            .from('players')
                            .select('id, name, score')
                            .eq('id', existingSession.playerId)
                            .eq('room_id', playerRoomId)
                            .single();

                        if (!existingPlayerError && existingPlayer) {
                            // Player exists, reconnect
                            playerCurrentId = existingSession.playerId;
                            playerScore = existingPlayer.score || 0;
                            isReconnecting = true;
                            console.log('Reconnecting player:', playerCurrentId);

                            // Update connection status
                            await supabaseClient
                                .from('players')
                                .update({ is_connected: true })
                                .eq('id', playerCurrentId);

                            // Update session timestamp
                            savePlayerSession(playerRoomId, playerCurrentId, existingPlayer.name);
                        } else {
                            // Session exists but player not found in DB, clear stale session
                            clearPlayerSession(playerRoomId);
                        }
                    }

                    if (!isReconnecting) {
                        // New player - generate new ID and insert
                        playerCurrentId = `player-${generateAlphanumericId(12)}`;

                        const { data: playerData, error: playerInsertError } = await supabaseClient
                            .from('players')
                            .insert([
                                {
                                    id: playerCurrentId,
                                    room_id: playerRoomId,
                                    name: pName,
                                    score: 0,
                                    is_connected: true
                                }
                            ]);

                        if (playerInsertError) throw playerInsertError;
                        console.log('Player joined Supabase:', playerData);

                        // Save session for future reconnection
                        savePlayerSession(playerRoomId, playerCurrentId, pName);
                    }

                    // Subscribe to broadcast channel for this room with reconnection handling
                    let reconnectAttempts = 0;
                    const MAX_RECONNECT_ATTEMPTS = 5;
                    const RECONNECT_DELAY_MS = 2000;

                    function subscribeToChannel() {
                        playerSupabaseChannel = supabaseClient.channel(`quiz_room_${playerRoomId}`);
                        playerSupabaseChannel.on('broadcast', { event: 'quiz_event' }, (payload) => {
                            handleHostData(payload.payload); // Process messages from host
                        }).subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                console.log('Player subscribed to broadcast channel:', `quiz_room_${playerRoomId}`);
                                reconnectAttempts = 0; // Reset on successful connection
                                waitingMessage.textContent = isReconnecting
                                    ? 'Wieder verbunden! Warte auf Host...'
                                    : 'Verbunden! Warte auf Host...';
                            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                                console.error('Player channel status:', status);
                                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                                    reconnectAttempts++;
                                    console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                                    waitingMessage.textContent = `Verbindung unterbrochen. Reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`;
                                    // Clean up old channel before reconnecting
                                    if (playerSupabaseChannel) {
                                        supabaseClient.removeChannel(playerSupabaseChannel);
                                    }
                                    setTimeout(subscribeToChannel, RECONNECT_DELAY_MS);
                                } else {
                                    showMessage('Verbindung zum Quiz-Raum verloren. Bitte lade die Seite neu.', 'error');
                                    resetPlayerStateAndUI();
                                }
                            }
                        });
                    }

                    subscribeToChannel();

                } catch (error) {
                    console.error('Error initializing player Supabase:', error);
                    showMessage(`Fehler beim Beitreten des Quiz: ${error.message}.`, 'error');
                    resetPlayerStateAndUI();
                }
            }

            /**
             * Handles data received from the host (via Supabase Broadcast).
             * @param {Object} data - The data received from the host.
             */
            async function handleHostData(data) { // Made async to allow await for DB fetch
                console.log('Player received data from host:', data);

                switch (data.type) {
                    case 'question':
                        playerCurrentQuestionOptions = data.options; // These are already shuffled
                        selectedAnswers = []; // Reset selected answers for new question
                        // Use host's startTime for accurate timing, with fallback to local time
                        playerQuestionStartTime = data.startTime || Date.now();
                        displayQuestion(data);
                        // Calculate remaining time based on host's start time
                        const elapsedSinceStart = (Date.now() - playerQuestionStartTime) / 1000;
                        const remainingDuration = Math.max(1, data.duration - elapsedSinceStart);
                        startPlayerTimer(remainingDuration);
                        break;
                    case 'result':
                        // Fetch the player's most recent score and answer data from DB
                        const { data: currentPlayerDbData, error: fetchError } = await supabaseClient
                            .from('players')
                            .select('score, last_answer_data')
                            .eq('id', playerCurrentId)
                            .single();

                        if (fetchError) {
                            console.error('Error fetching player data for result display:', fetchError);
                            // Fallback to previous score if fetch fails
                            displayResult(data, selectedAnswers, playerScore); // Use local selectedAnswers as fallback
                        } else {
                            playerScore = currentPlayerDbData.score || 0;
                            const playerAnswerFromDb = currentPlayerDbData.last_answer_data || [];
                            displayResult(data, playerAnswerFromDb, playerScore);
                        }
                        
                        waitingForNext.textContent = data.isFinal ? 'Warten auf Endergebnisse...' : 'Warten auf nächste Frage...';
                        if (data.isFinal) {
                            displayFinalResult(data);
                        }
                        break;
                    case 'final':
                        // This case might be redundant if 'result' already handles final.
                        // However, keeping it for robustness if a separate 'final' broadcast is sent.
                        displayFinalResult(data);
                        break;
                    case 'quiz_terminated':
                        showMessage("Der Host hat das Quiz beendet.", 'info');
                        resetPlayerStateAndUI();
                        showView('role-selection');
                        break;
                }
            }

            /**
             * Starts the player's timer for the current question.
             * @param {number} durationSeconds - The total duration of the timer in seconds.
             */
            function startPlayerTimer(durationSeconds) {
                playerTimerBar.style.width = '100%';
                if (playerTimerInterval) clearInterval(playerTimerInterval);

                const totalDurationMs = durationSeconds * 1000;
                const timerStartTime = Date.now();

                playerTimerInterval = setInterval(() => {
                    const elapsed = Date.now() - timerStartTime;
                    const remaining = Math.max(0, totalDurationMs - elapsed);
                    playerTimerBar.style.width = `${(remaining / totalDurationMs) * 100}%`;

                    if (remaining <= 0) {
                        clearInterval(playerTimerInterval);
                        playerTimerInterval = null;
                        submitAnswerBtn.classList.add('hidden');
                        optionsContainer.querySelectorAll('button.option-btn').forEach(btn => btn.disabled = true);
                        console.log("Player timer up.");
                         // Auto-submit current selections if player hasn't already submitted
                         if (!submitAnswerBtn.disabled) {
                             submitAnswerBtn.disabled = true;
                             supabaseClient.from('players').update({ last_answer_data: selectedAnswers, last_answer_time: new Date().toISOString() }).eq('id', playerCurrentId)
                                 .then(() => console.log("Auto-submitted player answer on timeout:", selectedAnswers))
                                 .catch(e => console.error("Error auto-submitting answer:", e));
                         }
                    }
                }, 100); // Update every 100ms
            }

            /**
             * Displays the question and options for the player.
             * @param {Object} qData - The question data received from the host.
             */
            function displayQuestion(qData) {
                waitingRoom.classList.add('hidden');
                playerResultView.classList.add('hidden');
                playerQuestionView.classList.remove('hidden');

                playerQuestionTextEl.textContent = qData.question;
                playerQuestionCounterEl.textContent = `Frage ${qData.index + 1} von ${qData.total}`;

                optionsContainer.innerHTML = '';
                selectedAnswers = []; // Ensure selectedAnswers is reset for a new question

                // qData.options are already shuffled from the host
                qData.options.forEach((option, index) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.textContent = option;
                    btn.dataset.index = index;

                    btn.addEventListener('click', () => {
                        const optIdx = parseInt(btn.dataset.index);
                        const pos = selectedAnswers.indexOf(optIdx);

                        if (pos > -1) {
                            selectedAnswers.splice(pos, 1);
                            btn.classList.remove('selected');
                        } else {
                            selectedAnswers.push(optIdx);
                            btn.classList.add('selected');
                        }

                        submitAnswerBtn.classList.toggle('hidden', selectedAnswers.length === 0);
                    });

                    optionsContainer.appendChild(btn);
                });

                submitAnswerBtn.classList.add('hidden');
                submitAnswerBtn.disabled = false;
                optionsContainer.querySelectorAll('button.option-btn').forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('correct-answer', 'incorrect-answer', 'selected'); // Clean up previous result styles
                });
            }

            /**
             * Displays the result of the just-answered question for the player.
             * @param {Object} rData - The result data received from the host.
             * @param {Array<number>} playerAnswer - The player's actual answer for this question (fetched from DB or local).
             * @param {number} currentScore - The player's current score (fetched from DB).
             */
            function displayResult(rData, playerAnswer, currentScore) {
                playerQuestionView.classList.add('hidden');
                playerResultView.classList.remove('hidden');

                let resultHtml = 'Deine Antwort war ';
                // Use the actual playerAnswer passed to the function
                const playerAnsSet = new Set(playerAnswer || []); 
                const correctSet = new Set(rData.correct);
                const options = rData.options; // These are the shuffled options from the host

                const correctHits = [...playerAnsSet].filter(item => correctSet.has(item)).length;
                const isCompletelyCorrect = correctHits === correctSet.size &&
                                           playerAnsSet.size === correctSet.size;

                if (!playerAnswer || playerAnswer.length === 0) {
                    resultHtml = "Du hast nicht geantwortet. ";
                } else if (isCompletelyCorrect) {
                    resultHtml += '<strong class="correct">RICHTIG!</strong> ';
                    triggerConfetti();
                } else if (correctHits > 0) {
                    resultHtml += `<strong class="correct">TEILWEISE RICHTIG (${correctHits}/${correctSet.size})</strong> `;
                } else {
                    resultHtml += '<strong class="incorrect">FALSCH.</strong> ';
                }

                resultHtml += '<br>Richtige Antwort(en): ';

                options.forEach((option, index) => {
                    // Always show correct answers
                    if (correctSet.has(index)) {
                         if (playerAnsSet.has(index)) {
                             resultHtml += `<span class="correct player-selected">"${sanitizeHTML(option)}"</span> `; // Correct and selected by player
                         } else {
                             resultHtml += `<span class="correct-not-selected">"${sanitizeHTML(option)}"</span> `; // Correct but not selected by player
                         }
                    } else if (playerAnsSet.has(index)) {
                         // Per instruction: "Do not show the falsely selected answers of the player anymore."
                         // This means we don't add special classes or text for them.
                         // The original text for the option will still be there, but no specific highlight.
                    }
                });


                resultDisplay.innerHTML = resultHtml;
                playerScoreEl.textContent = Math.round(currentScore); // Use currentScore passed to the function

                // Update player option buttons to show correct/incorrect after result
                optionsContainer.querySelectorAll('button.option-btn').forEach(btn => {
                    const index = parseInt(btn.dataset.index);
                    btn.disabled = true; // Ensure buttons are disabled
                    btn.classList.remove('selected'); // Remove selected class from active state

                    if (correctSet.has(index)) {
                        btn.classList.add('correct-answer'); // Highlight correct answer
                    }
                    // If the player selected a correct answer, re-apply 'selected' to show they chose it.
                    if (playerAnsSet.has(index) && correctSet.has(index)) {
                         btn.classList.add('selected'); // Re-apply selected style if it was correct and selected
                    }
                });
            }

            /**
             * Displays the final results and leaderboard for the player.
             * @param {Object} frData - The final results data received from the host.
             */
            function displayFinalResult(frData) {
                console.log("Displaying final results for player:", frData); // Debug log
                playerQuestionView.classList.add('hidden');
                playerResultView.classList.add('hidden');
                waitingRoom.classList.add('hidden');
                playerFinalResultView.classList.remove('hidden'); // Ensure this view is shown

                finalScoreEl.textContent = Math.round(playerScore); // Use the global playerScore for final display

                playerLeaderboardContainer.innerHTML = '';

                if (frData.leaderboard) {
                    const lbDiv = document.createElement('div');
                    lbDiv.innerHTML = '<h4>Endgültige Rangliste:</h4>';
                    const ol = document.createElement('ol');
                    if (frData.leaderboard.length === 0) {
                        ol.innerHTML = '<li>Keine Spieler in der Rangliste.</li>';
                    } else {
                        frData.leaderboard.forEach((p, idx) => { // Added idx for rank highlighting
                            const li = document.createElement('li');
                            if (idx === 0) li.classList.add('rank-1');
                            else if (idx === 1) li.classList.add('rank-2');
                            else if (idx === 2) li.classList.add('rank-3');
                            li.textContent = `${idx + 1}. ${p.name}: ${Math.round(p.score)} Punkte`;
                            ol.appendChild(li);
                        });
                    }
                    lbDiv.appendChild(ol);
                    playerLeaderboardContainer.appendChild(lbDiv);
                } else {
                    playerLeaderboardContainer.innerHTML = '<p>Keine Ranglistendaten verfügbar.</p>'; // Fallback
                }
            }

            /**
             * Resets the player's state and UI to the initial join form.
             */
            async function resetPlayerStateAndUI() {
                if (playerSupabaseChannel) {
                    await supabaseClient.removeChannel(playerSupabaseChannel);
                    playerSupabaseChannel = null;
                }
                // Mark player as disconnected in DB
                if (playerCurrentId) {
                    await supabaseClient.from('players').update({ is_connected: false }).eq('id', playerCurrentId);
                }

                playerScore = 0;
                selectedAnswers = [];
                playerCurrentQuestionOptions = [];
                playerQuestionStartTime = null;
                playerRoomId = null;
                playerCurrentId = null;

                roomCodeInput.value = '';
                playerNameInput.value = '';
                joinForm.classList.remove('hidden');
                waitingRoom.classList.add('hidden');
                playerQuestionView.classList.add('hidden');
                playerResultView.classList.add('hidden');
                playerFinalResultView.classList.add('hidden');
                optionsContainer.innerHTML = '';
                resultDisplay.innerHTML = '';
                playerLeaderboardContainer.innerHTML = '';
                playerScoreEl.textContent = '0';
                finalScoreEl.textContent = '0';
            }
        }
