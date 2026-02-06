/**
 * Flashcards Learning App - Main JavaScript Module
 * Manages flashcard decks, quiz logic, and user interactions
 */

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Debounce function - delays execution until after wait time has elapsed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function - ensures function is called at most once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================================
// Global State Management
// ============================================================================

/** @type {Array<Object>} Current set of cards being studied */
let cards = [];

/** @type {number} Index of the currently displayed card */
let currentCardIndex = 0;

/** @type {number} Count of correctly answered cards */
let correctCount = 0;

/** @type {number} Count of incorrectly answered cards */
let incorrectCount = 0;

/** @type {Array<boolean|null>} Track answers for each card (true=correct, false=incorrect, null=not answered) */
let answeredCards = [];

/** @type {boolean} Flag to prevent double-marking answers */
let isAnswered = false;

/** @type {Array<string>} Names of currently active decks */
let activeDecks = [];

/** @type {Object<string, {cards: Array}>} Saved decks from localStorage */
let savedDecks = {};

/** @type {Object<string, Array<number>>} Indices of incorrect answers per deck */
let previousIncorrectIndices = {};

/** @type {Array<number>} Selected option indices for multiple choice questions */
let selectedOptionIndices = [];

/** @type {Object<string, {correct: number, incorrect: number, total: number}>} Statistics per deck */
let deckStats = {};

/** @type {string} Current study mode: 'spaced-repetition', 'incorrect-first', 'incorrect-only' */
let studyMode = 'spaced-repetition';

/** @type {Object<string, {interval: number, easeFactor: number, repetitions: number, nextReview: Date}>} Spaced repetition data per card */
let spacedRepetitionData = {};

// ============================================================================
// DOM Elements Cache
// ============================================================================

let fileInput;
let appContent;
let appTitle;
let appSubtitle;
let questionText;
let questionBack;
let sourceDeckDisplay;
let answerText;
let userAnswerInput;
let userAnswerContainer;
let userAnswerDisplay;
let optionsContainer;
let optionsContainerBack;
let selectedOptionsContainer;
let selectedOptionsDisplay;
let mcCorrectAnswerContainer;
let mcCorrectAnswerText;
let standardAnswerContainer;
let textExplanationContainer;
let textExplanationContent;
let showAnswerBtn;
let markCorrectBtn;
let markIncorrectBtn;
let nextCardBtn;
let progressBar;
let cardsRemainingElement;
let cardsCompletedElement;
let correctCountElement;
let incorrectCountElement;
let feedbackElement;
let finalScoreElement;
let deckStatsContainer;
let restartBtn;
let uploadNewBtn;
let returnToSrBtn;
let errorMessageElement;
let flipCard;
let cardContainer;
let savedDecksContainer;
let startSelectedDecksBtn;
let selectAllDecksBtn;
let deselectAllDecksBtn;
let studyModeSelect;
let deckSearchInput;
let openSrManagerBtn;
let srManagerContainer;
let srBucketsDisplay;
let startSelectedBucketsBtn;
let selectAllBucketsBtn;
let deselectAllBucketsBtn;
let cleanupOrphansBtn;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize DOM elements and set up event listeners
 * Called when DOM content is loaded
 */
function initializeApp() {
    // Cache DOM elements
    fileInput = document.getElementById('file-input');
    appContent = document.getElementById('app-content');
    appTitle = document.getElementById('app-title');
    appSubtitle = document.getElementById('app-subtitle');
    questionText = document.getElementById('question-text');
    questionBack = document.getElementById('question-back');
    sourceDeckDisplay = document.getElementById('source-deck-display');
    answerText = document.getElementById('answer-text');
    userAnswerInput = document.getElementById('user-answer-input');
    userAnswerContainer = document.getElementById('user-answer-container');
    userAnswerDisplay = document.getElementById('user-answer-display');
    optionsContainer = document.getElementById('options-container');
    optionsContainerBack = document.getElementById('options-container-back');
    selectedOptionsContainer = document.getElementById('selected-options-container');
    selectedOptionsDisplay = document.getElementById('selected-options-display');
    mcCorrectAnswerContainer = document.getElementById('mc-correct-answer-container');
    mcCorrectAnswerText = document.getElementById('mc-correct-answer-text');
    standardAnswerContainer = document.getElementById('standard-answer-container');
    textExplanationContainer = document.getElementById('text-explanation-container');
    textExplanationContent = document.getElementById('text-explanation-content');
    showAnswerBtn = document.getElementById('show-answer');
    markCorrectBtn = document.getElementById('mark-correct');
    markIncorrectBtn = document.getElementById('mark-incorrect');
    nextCardBtn = document.getElementById('next-card');
    progressBar = document.getElementById('progress-bar');
    cardsRemainingElement = document.getElementById('cards-remaining');
    cardsCompletedElement = document.getElementById('cards-completed');
    correctCountElement = document.getElementById('correct-count');
    incorrectCountElement = document.getElementById('incorrect-count');
    feedbackElement = document.getElementById('feedback');
    finalScoreElement = document.getElementById('final-score');
    deckStatsContainer = document.getElementById('deck-stats-container');
    restartBtn = document.getElementById('restart-btn');
    uploadNewBtn = document.getElementById('upload-new-btn');
    returnToSrBtn = document.getElementById('return-to-sr-btn');
    errorMessageElement = document.getElementById('error-message');
    flipCard = document.getElementById('flip-card');
    cardContainer = document.getElementById('card-container');
    savedDecksContainer = document.getElementById('saved-decks');
    startSelectedDecksBtn = document.getElementById('start-selected-decks');
    selectAllDecksBtn = document.getElementById('select-all-decks');
    deselectAllDecksBtn = document.getElementById('deselect-all-decks');
    studyModeSelect = document.getElementById('study-mode');
    deckSearchInput = document.getElementById('deck-search');
    openSrManagerBtn = document.getElementById('open-sr-manager');
    srManagerContainer = document.getElementById('spaced-repetition-manager-container');
    srBucketsDisplay = document.getElementById('sr-buckets-display');
    startSelectedBucketsBtn = document.getElementById('start-selected-buckets');
    selectAllBucketsBtn = document.getElementById('select-all-buckets');
    deselectAllBucketsBtn = document.getElementById('deselect-all-buckets');
    cleanupOrphansBtn = document.getElementById('cleanup-orphans-btn');

    // Set up event listeners with debouncing/throttling for performance
    fileInput.addEventListener('change', handleFileUpload);
    showAnswerBtn.addEventListener('click', throttle(showAnswer, 300));
    markCorrectBtn.addEventListener('click', throttle(() => markAnswer(true), 300));
    markIncorrectBtn.addEventListener('click', throttle(() => markAnswer(false), 300));
    nextCardBtn.addEventListener('click', throttle(showNextCard, 300));
    restartBtn.addEventListener('click', throttle(restartQuiz, 500));
    uploadNewBtn.addEventListener('click', throttle(resetAndUpload, 500));
    returnToSrBtn.addEventListener('click', throttle(returnToSRManager, 500));
    startSelectedDecksBtn.addEventListener('click', throttle(startSelectedDecks, 500));
    selectAllDecksBtn.addEventListener('click', debounce(selectAllDecks, 200));
    deselectAllDecksBtn.addEventListener('click', debounce(deselectAllDecks, 200));
    studyModeSelect.addEventListener('change', throttle(handleStudyModeChange, 300));
    deckSearchInput.addEventListener('input', debounce(handleDeckSearch, 250));
    openSrManagerBtn.addEventListener('click', throttle(openSpacedRepetitionManager, 300));
    startSelectedBucketsBtn.addEventListener('click', throttle(startSelectedBuckets, 500));
    selectAllBucketsBtn.addEventListener('click', debounce(selectAllSRBuckets, 200));
    deselectAllBucketsBtn.addEventListener('click', debounce(deselectAllSRBuckets, 200));
    cleanupOrphansBtn.addEventListener('click', throttle(cleanupOrphanedSRData, 500));

    // Add event listener for text explanation toggle
    textExplanationContainer.addEventListener('click', toggleTextExplanation);

    // Add Enter key support for answer submission
    userAnswerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            showAnswer();
        }
    });

    // Hide the next button initially
    nextCardBtn.style.display = 'none';

    // Load saved decks from localStorage
    loadSavedDecks();
    displaySavedDecks();
    loadSpacedRepetitionData();
    
    // Set up service worker update listener
    setupServiceWorkerUpdates();
}

/**
 * Set up listener for service worker updates
 * Shows notification when new version is available
 */
function setupServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                showUpdateNotification();
            }
        });
    }
}

/**
 * Show update notification banner
 */
function showUpdateNotification() {
    // Don't show if already showing
    if (document.getElementById('update-notification')) return;

    const notification = document.createElement('div');
    notification.id = 'update-notification';

    const messageSpan = document.createElement('span');
    messageSpan.textContent = '\u{1F504} Eine neue Version ist verfügbar!';

    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Jetzt aktualisieren';
    updateBtn.addEventListener('click', applyUpdate);

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '\u2715';
    dismissBtn.className = 'dismiss';
    dismissBtn.addEventListener('click', dismissUpdate);

    notification.appendChild(messageSpan);
    notification.appendChild(updateBtn);
    notification.appendChild(dismissBtn);
    document.body.appendChild(notification);
}

/**
 * Apply update by reloading the page
 */
function applyUpdate() {
    window.location.reload();
}

/**
 * Dismiss update notification
 */
function dismissUpdate() {
    const notification = document.getElementById('update-notification');
    if (notification) {
        notification.remove();
    }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', initializeApp);

// ============================================================================
// File Upload Handlers
// ============================================================================

/**
 * Toggle visibility of JSON format example
 */
function toggleJsonSample() {
    const sampleJson = document.getElementById('sample-json');
    sampleJson.classList.toggle('hidden');
}

// Expose SR manager functions to global scope for onclick handlers
window.toggleBucketExpansion = toggleBucketExpansion;
window.toggleBucketSelection = toggleBucketSelection;
window.moveSRCard = moveSRCard;
window.deleteSRCard = deleteSRCard;

/**
 * Handle single JSON file upload
 * @param {Event} event - File input change event
 */
/**
 * Handle file upload - supports both JSON and ZIP files
 * @param {Event} event - File input change event
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a ZIP file
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        handleZipUpload(event);
        return;
    }

    // Otherwise, treat it as JSON
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        showError('Bitte lade eine gültige JSON- oder ZIP-Datei hoch.');
        return;
    }

    processJsonFile(file);
}

/**
 * Handle ZIP file upload containing multiple JSON files
 * @param {Event} event - File input change event
 */
function handleZipUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        showError('Bitte lade eine gültige ZIP-Datei hoch.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(e.target.result);
            let processedCount = 0;
            let errorCount = 0;

            // Process each file in the ZIP
            const promises = [];
            zipContent.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && relativePath.endsWith('.json')) {
                    const promise = zipEntry.async('string').then(content => {
                        try {
                            const data = JSON.parse(content);
                            
                            if (!data.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
                                errorCount++;
                                return;
                            }

                            // Check card validity
                            const validCards = validateCards(data.cards);
                            
                            if (validCards.length === 0) {
                                errorCount++;
                                return;
                            }

                            // Save the deck with filename as deck name
                            const deckName = relativePath.split('/').pop().replace('.json', '');
                            saveToLocalStorage(deckName, validCards, []);
                            processedCount++;
                        } catch (e) {
                            errorCount++;
                        }
                    });
                    promises.push(promise);
                }
            });

            await Promise.all(promises);
            
            if (processedCount > 0) {
                displaySavedDecks();
                showMessage(`${processedCount} Decks erfolgreich importiert${errorCount > 0 ? `, ${errorCount} fehlgeschlagen` : ''}.`);
            } else {
                showError('Keine gültigen JSON-Dateien in der ZIP-Datei gefunden.');
            }
            
            // Reset the file input
            event.target.value = '';
        } catch (error) {
            showError('Fehler beim Entpacken der ZIP-Datei.');
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Process and validate a JSON file containing flashcards
 * @param {File} file - The JSON file to process
 */
function processJsonFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.cards || !Array.isArray(data.cards) || data.cards.length === 0) {
                showError('Ungültiges JSON-Format. Bitte stelle sicher, dass deine Datei ein "cards" Array mit mindestens einer Karte enthält.');
                return;
            }

            // Validate cards
            const validCards = validateCards(data.cards);

            if (validCards.length === 0) {
                showError('Keine gültigen Karten gefunden. Jede Karte muss entweder ein "question" und ein "answer" Feld ODER ein "question", "options" und "correct" Feld haben.');
                return;
            }

            // Save the deck to local storage
            const deckName = file.name.replace('.json', '');
            activeDecks = [deckName]; // Set as the only active deck

            // Update the app title with the deck name
            updateAppTitle([deckName]);

            // Save to local storage
            saveToLocalStorage(deckName, validCards, []);
            displaySavedDecks();

            // Initialize the quiz with the loaded cards
            initializeQuiz(validCards.map(card => ({...card, sourceDeck: deckName})));
            
            // Reset the file input
            fileInput.value = '';
        } catch (error) {
            showError('Fehler beim Parsen der JSON-Datei. Bitte überprüfe das Dateiformat.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

/**
 * Validate card format - checks for required fields
 * @param {Array<Object>} cards - Array of card objects to validate
 * @returns {Array<Object>} Array of valid cards
 */
function validateCards(cards) {
    return cards.filter(card => {
        // Check standard card format (question + answer)
        if (card.question && card.answer) {
            return true;
        }
        // Check multiple choice format (question + options + correct answers)
        if (card.question && Array.isArray(card.options) && card.options.length > 0 &&
            Array.isArray(card.correct) && card.correct.length > 0) {
            return true;
        }
        return false;
    });
}

// ============================================================================
// Local Storage Management
// ============================================================================

/**
 * Update the app title based on active decks
 * @param {Array<string>} deckNames - Names of active decks
 */
function updateAppTitle(deckNames) {
    if (deckNames.length === 1) {
        appTitle.textContent = `Lernkarten - ${deckNames[0]}`;
    } else {
        appTitle.textContent = `Lernkarten - ${deckNames.length} Decks kombiniert`;
    }
    // Hide the subtitle when a deck is active
    appSubtitle.style.display = 'none';
}

/**
 * Load saved decks from localStorage
 */
function loadSavedDecks() {
    const savedDecksString = localStorage.getItem('flashcardDecks');
    if (savedDecksString) {
        savedDecks = JSON.parse(savedDecksString);
    }
    
    const incorrectIndicesString = localStorage.getItem('flashcardIncorrectIndices');
    if (incorrectIndicesString) {
        previousIncorrectIndices = JSON.parse(incorrectIndicesString);
    }
}

/**
 * Save a deck to localStorage
 * @param {string} deckName - Name of the deck
 * @param {Array<Object>} deckCards - Array of card objects
 * @param {Array<number>} incorrectIndices - Indices of incorrectly answered cards
 */
function saveToLocalStorage(deckName, deckCards, incorrectIndices = []) {
    savedDecks[deckName] = {
        cards: deckCards
    };
    localStorage.setItem('flashcardDecks', JSON.stringify(savedDecks));
    
    // Save incorrect indices separately
    if (!previousIncorrectIndices[deckName]) {
        previousIncorrectIndices[deckName] = [];
    }
    if (incorrectIndices.length > 0) {
        previousIncorrectIndices[deckName] = [...incorrectIndices];
    }
    localStorage.setItem('flashcardIncorrectIndices', JSON.stringify(previousIncorrectIndices));
}

/**
 * Update incorrect indices in localStorage
 */
function updateIncorrectIndices() {
    localStorage.setItem('flashcardIncorrectIndices', JSON.stringify(previousIncorrectIndices));
}

// ============================================================================
// Deck Management UI
// ============================================================================

/**
 * Display all saved decks in the UI with checkboxes
 */
function displaySavedDecks(searchTerm = '') {
    const savedDecksDiv = document.getElementById('saved-decks');
    savedDecksDiv.innerHTML = '';

    if (Object.keys(savedDecks).length === 0) {
        const noDecksMessage = document.createElement('p');
        noDecksMessage.textContent = 'Keine gespeicherten Decks gefunden.';
        savedDecksDiv.appendChild(noDecksMessage);
        startSelectedDecksBtn.disabled = true;
        return;
    }

    // Filter decks by search term
    const filteredDeckNames = Object.keys(savedDecks).filter(deckName =>
        deckName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredDeckNames.length === 0 && searchTerm) {
        const noResultsMessage = document.createElement('p');
        noResultsMessage.textContent = 'Keine Decks gefunden.';
        savedDecksDiv.appendChild(noResultsMessage);
        startSelectedDecksBtn.disabled = true;
        return;
    }

    for (const deckName of filteredDeckNames) {
        const deckElement = document.createElement('div');
        deckElement.className = 'saved-deck';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `deck-checkbox-${deckName}`;
        checkbox.className = 'deck-checkbox';
        checkbox.dataset.deckName = deckName;
        checkbox.addEventListener('change', updateStartButtonState);

        const deckTitle = document.createElement('label');
        deckTitle.className = 'deck-title';
        deckTitle.htmlFor = `deck-checkbox-${deckName}`;
        deckTitle.textContent = `${deckName} (${savedDecks[deckName].cards.length} Karten)`;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-deck';
        deleteButton.textContent = '×';
        deleteButton.title = 'Deck löschen';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSavedDeck(deckName);
        });

        deckElement.appendChild(checkbox);
        deckElement.appendChild(deckTitle);
        deckElement.appendChild(deleteButton);
        savedDecksDiv.appendChild(deckElement);
    }
    
    updateStartButtonState();
}

/**
 * Update the enabled state of the start button based on checkbox selections
 */
function updateStartButtonState() {
    const checkboxes = document.querySelectorAll('.deck-checkbox:checked');
    startSelectedDecksBtn.disabled = checkboxes.length === 0;
}

/**
 * Start quiz with selected decks
 */
function startSelectedDecks() {
    const selectedCheckboxes = document.querySelectorAll('.deck-checkbox:checked');
    if (selectedCheckboxes.length === 0) return;

    const selectedDeckNames = Array.from(selectedCheckboxes).map(cb => cb.dataset.deckName);
    activeDecks = selectedDeckNames;

    // Update the app title
    updateAppTitle(selectedDeckNames);

    // Merge selected decks
    let mergedCards = [];
    selectedDeckNames.forEach(deckName => {
        if (savedDecks[deckName]) {
            const cardsWithSource = savedDecks[deckName].cards.map(card => ({
                ...card,
                sourceDeck: deckName
            }));
            mergedCards = [...mergedCards, ...cardsWithSource];
        }
    });

    // Initialize statistics tracking for each deck
    resetDeckStats(selectedDeckNames);

    // Initialize the quiz with merged cards
    initializeQuiz(mergedCards);
}

/**
 * Reset deck statistics for the given deck names
 * @param {Array<string>} deckNames - Names of decks to reset stats for
 */
function resetDeckStats(deckNames) {
    deckStats = {};
    deckNames.forEach(deckName => {
        deckStats[deckName] = {
            correct: 0,
            incorrect: 0,
            total: savedDecks[deckName].cards.length
        };
    });
}

/**
 * Select all deck checkboxes
 */
function selectAllDecks() {
    const checkboxes = document.querySelectorAll('.deck-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    updateStartButtonState();
}

/**
 * Deselect all deck checkboxes
 */
function deselectAllDecks() {
    const checkboxes = document.querySelectorAll('.deck-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    updateStartButtonState();
}

/**
 * Delete a saved deck from localStorage
 * @param {string} deckName - Name of the deck to delete
 */
function deleteSavedDeck(deckName) {
    if (confirm(`Möchtest du das Deck "${deckName}" wirklich löschen?`)) {
        delete savedDecks[deckName];
        localStorage.setItem('flashcardDecks', JSON.stringify(savedDecks));
        
        if (previousIncorrectIndices[deckName]) {
            delete previousIncorrectIndices[deckName];
            localStorage.setItem('flashcardIncorrectIndices', JSON.stringify(previousIncorrectIndices));
        }
        
        displaySavedDecks();
    }
}

// ============================================================================
// Quiz Logic
// ============================================================================

/**
 * Initialize quiz with the given cards
 * @param {Array<Object>} loadedCards - Cards to use in the quiz
 */
function initializeQuiz(loadedCards) {
    // Reset the quiz state
    cards = loadedCards;
    currentCardIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    answeredCards = new Array(cards.length).fill(null);

    // Check if this is from SR buckets
    const isFromSRBuckets = activeDecks.length === 1 && activeDecks[0] === 'SR Buckets';
    
    // Only shuffle if not from SR buckets (bucket order should be preserved)
    if (!isFromSRBuckets) {
        // Randomize initial card order
        shuffleArray(cards);

        // Prioritize incorrectly answered cards if available
        prioritizeIncorrectCards();
    }

    // Show the app content
    document.getElementById('file-input-container').style.display = 'none';
    appContent.classList.remove('hidden');
    
    // Hide SR button during active quiz
    openSrManagerBtn.style.display = 'none';

    // Update UI
    updateStatistics();
    showCurrentCard();
}

/**
 * Prioritize incorrectly answered cards from previous sessions
 * Places incorrect cards at the beginning of the deck
 */
function prioritizeIncorrectCards() {
    if (activeDecks.length === 0) return;
    
    // Create a copy of the cards array for manipulation
    const allCards = [...cards];
    const prioritizedCards = [];
    const remainingCards = [];
    
    // First, identify cards from decks with incorrect answers
    allCards.forEach(card => {
        const deckName = card.sourceDeck;
        if (previousIncorrectIndices[deckName] && previousIncorrectIndices[deckName].length > 0) {
            // Find if this card was incorrect in its original deck
            const originalIndex = savedDecks[deckName].cards.findIndex(c => 
                c.question === card.question && 
                (c.answer === card.answer || 
                 (Array.isArray(c.options) && Array.isArray(card.options) && 
                  JSON.stringify(c.options) === JSON.stringify(card.options)))
            );
            
            if (originalIndex !== -1 && previousIncorrectIndices[deckName].includes(originalIndex)) {
                prioritizedCards.push(card);
            } else {
                remainingCards.push(card);
            }
        } else {
            remainingCards.push(card);
        }
    });

    // Shuffle both arrays
    shuffleArray(prioritizedCards);
    shuffleArray(remainingCards);

    // Combine the arrays
    cards = [...prioritizedCards, ...remainingCards];
}

/**
 * Shuffle the current cards array
 */
function shuffleCards() {
    shuffleArray(cards);
}

/**
 * Fisher-Yates shuffle algorithm - shuffles array in place
 * @param {Array} array - Array to shuffle
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ============================================================================
// Card Display
// ============================================================================

/**
 * Display the current card or show feedback if quiz is complete
 */
function showCurrentCard() {
    if (currentCardIndex >= cards.length) {
        showFeedback();
        return;
    }

    isAnswered = false;
    selectedOptionIndices = []; // Reset selected options
    const card = cards[currentCardIndex];

    // Check if we're currently showing the back side
    const isShowingBack = flipCard.classList.contains('flipped');
    
    if (isShowingBack) {
        // Reset to front side and animate fly-in from bottom
        flipCard.classList.remove('flipped');
        
        // Update card content immediately (while transitioning to front)
        updateCardContent(card);
        
        // Start fly-in animation from bottom
        flipCard.classList.add('fly-in-bottom');
        
        // Clean up animation class after animation completes
        setTimeout(() => {
            flipCard.classList.remove('fly-in-bottom');
        }, 600);
    } else {
        // Normal case: just update content (first card or already on front)
        updateCardContent(card);
    }
}

/**
 * Update the card content with new question data
 * @param {Object} card - The card object to display
 */
function updateCardContent(card) {
    
    // Set question on both sides
    questionText.textContent = card.question;
    questionBack.textContent = card.question;
    
    // Show source deck info
    sourceDeckDisplay.textContent = `Quelle: ${card.sourceDeck}`;

    // Check if current card is multiple choice or standard
    const isMultipleChoice = Array.isArray(card.options) && card.options.length > 0;

    if (isMultipleChoice) {
        // Handle multiple choice question
        userAnswerInput.classList.add('hidden');
        optionsContainer.classList.remove('hidden');
        showAnswerBtn.classList.remove('hidden');

        // Clear previous options
        optionsContainer.innerHTML = '';

        // Create a copy of options array for shuffling
        const shuffledOptions = [...card.options];
        // Create a mapping to track original indices after shuffling
        const optionMapping = shuffledOptions.map((_, index) => index);

        // Shuffle options
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
            [optionMapping[i], optionMapping[j]] = [optionMapping[j], optionMapping[i]];
        }

        // Create option items with shuffled order
        shuffledOptions.forEach((option, index) => {
            const originalIndex = optionMapping[index];
            const optionItem = document.createElement('div');
            optionItem.className = 'option-item';
            optionItem.dataset.index = originalIndex;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'option-checkbox';
            checkbox.id = `option-${index}`;

            const label = document.createElement('label');
            label.htmlFor = `option-${index}`;
            label.textContent = option;

            optionItem.appendChild(checkbox);
            optionItem.appendChild(label);

            // Add click handler to toggle selection
            optionItem.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== label) {
                    checkbox.checked = !checkbox.checked;
                }
                optionItem.classList.toggle('selected', checkbox.checked);

                // Update selectedOptionIndices
                if (checkbox.checked) {
                    if (!selectedOptionIndices.includes(originalIndex)) {
                        selectedOptionIndices.push(originalIndex);
                    }
                } else {
                    const indexToRemove = selectedOptionIndices.indexOf(originalIndex);
                    if (indexToRemove !== -1) {
                        selectedOptionIndices.splice(indexToRemove, 1);
                    }
                }
            });

            optionsContainer.appendChild(optionItem);
        });

        // Set answer text for back of card
        standardAnswerContainer.classList.add('hidden');
        mcCorrectAnswerContainer.classList.remove('hidden');

        // Display all options with color coding (will be filled when answer is shown)
        const correctIndices = card.correct;
        mcCorrectAnswerText.innerHTML = ''; // Will be populated in showAnswer()

    } else {
        // Handle standard question
        userAnswerInput.classList.remove('hidden');
        optionsContainer.classList.add('hidden');
        showAnswerBtn.classList.remove('hidden');

        // Reset user answer input
        userAnswerInput.value = '';
        userAnswerInput.readOnly = false;

        // Set answer text for standard card
        answerText.textContent = card.answer;
        standardAnswerContainer.classList.remove('hidden');
        mcCorrectAnswerContainer.classList.add('hidden');
    }

    // Reset containers
    userAnswerContainer.classList.add('hidden');
    selectedOptionsContainer.classList.add('hidden');
    optionsContainerBack.classList.add('hidden');
    textExplanationContainer.classList.add('hidden');
    textExplanationContent.classList.add('hidden');
    
    // Reset explanation label and animation
    const explanationLabel = document.querySelector('.explanation-label');
    const explanationIcon = document.querySelector('.explanation-icon');
    if (explanationLabel) {
        explanationLabel.style.display = 'inline';
    }
    if (explanationIcon) {
        explanationIcon.style.animation = '';
    }
    
    // Clean up any existing tooltips from previous cards
    document.querySelectorAll('.option-explanation-tooltip').forEach(tooltip => {
        tooltip.remove();
    });

    // Reset buttons
    markCorrectBtn.style.display = 'inline-block';
    markIncorrectBtn.style.display = 'inline-block';
    nextCardBtn.style.display = 'none';

    updateStatistics();
}

/**
 * Add explanation indicator to a multiple choice option
 * @param {HTMLElement} optionItem - The option element
 * @param {number} index - The option index
 * @param {Object} card - The card object
 */
function addExplanationToOption(optionItem, index, card) {
    // Check if explanations exist for this card and this specific option
    if (card.explanations && card.explanations[index.toString()]) {
        const explanation = card.explanations[index.toString()];
        
        // Create explanation indicator
        const indicator = document.createElement('span');
        indicator.className = 'option-explanation-indicator';
        indicator.setAttribute('tabindex', '0');
        indicator.setAttribute('role', 'button');
        indicator.setAttribute('aria-label', 'Erklärung anzeigen');
        
        // Create tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'option-explanation-tooltip';
        tooltip.textContent = explanation;
        
        // Append tooltip to body instead of indicator for better positioning
        document.body.appendChild(tooltip);
        
        // Store reference to tooltip on indicator for cleanup
        indicator._tooltip = tooltip;
        
        optionItem.appendChild(indicator);
        
        // Re-enable pointer events for the indicator only
        indicator.style.pointerEvents = 'auto';
        
        // Add event listeners for tooltip positioning
        let isHovering = false;
        
        const showTooltip = () => {
            isHovering = true;
            const rect = indicator.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate available space
            const spaceAbove = rect.top;
            const spaceBelow = viewportHeight - rect.bottom;
            
            // Position vertically (prefer above, but use below if not enough space)
            if (spaceAbove > 120 || spaceAbove > spaceBelow) {
                // Position above
                tooltip.style.bottom = (viewportHeight - rect.top + 8) + 'px';
                tooltip.style.top = 'auto';
                tooltip.setAttribute('data-arrow', 'down');
            } else {
                // Position below
                tooltip.style.top = (rect.bottom + 8) + 'px';
                tooltip.style.bottom = 'auto';
                tooltip.setAttribute('data-arrow', 'up');
            }
            
            // Position horizontally (ensure it stays in viewport)
            const tooltipWidth = 250; // Approximate max-width
            if (rect.left + tooltipWidth > viewportWidth - 16) {
                // Align to right edge
                tooltip.style.right = '1rem';
                tooltip.style.left = 'auto';
            } else {
                // Align to left of indicator
                tooltip.style.left = Math.max(rect.left, 16) + 'px';
                tooltip.style.right = 'auto';
            }

            tooltip.style.display = 'block';
        };
        
        const hideTooltip = () => {
            isHovering = false;
            // Delay hiding to allow mouse to move to tooltip
            setTimeout(() => {
                if (!isHovering) {
                    tooltip.style.display = 'none';
                }
            }, 100);
        };
        
        // Allow hovering over the tooltip itself
        tooltip.addEventListener('mouseenter', () => {
            isHovering = true;
        });
        
        tooltip.addEventListener('mouseleave', () => {
            isHovering = false;
            hideTooltip();
        });
        
        indicator.addEventListener('mouseenter', showTooltip);
        indicator.addEventListener('mouseleave', hideTooltip);
        indicator.addEventListener('focus', showTooltip);
        indicator.addEventListener('blur', hideTooltip);
        
    }
}

/**
 * Toggle the visibility of text explanation content
 */
function toggleTextExplanation() {
    const isHidden = textExplanationContent.classList.contains('hidden');
    textExplanationContent.classList.toggle('hidden');
    
    // Stop pulsating animation after first click
    const icon = textExplanationContainer.querySelector('.explanation-icon');
    const label = textExplanationContainer.querySelector('.explanation-label');
    
    if (icon) {
        icon.style.animation = 'none';
    }
    
    // Toggle label visibility based on explanation visibility
    if (label) {
        if (isHidden) {
            // Explanation is now shown, hide the label
            label.style.display = 'none';
        } else {
            // Explanation is now hidden, show the label
            label.style.display = 'inline';
        }
    }
}

/**
 * Flip the card to show the answer
 */
function showAnswer() {
    flipCard.classList.add('flipped');

    const card = cards[currentCardIndex];
    const isMultipleChoice = Array.isArray(card.options) && Array.isArray(card.correct);

    if (isMultipleChoice) {
        // For multiple choice questions
        // Clone options to back side for color-coded feedback
        optionsContainerBack.innerHTML = optionsContainer.innerHTML;
        
        // Apply color coding to back side option items
        const backOptionItems = optionsContainerBack.querySelectorAll('.option-item');
        backOptionItems.forEach((optionItem) => {
            const originalIndex = parseInt(optionItem.dataset.index);
            const isCorrectOption = card.correct.includes(originalIndex);
            const wasSelected = selectedOptionIndices.includes(originalIndex);
            
            // Disable further interaction
            const checkbox = optionItem.querySelector('.option-checkbox');
            checkbox.disabled = true;
            optionItem.style.pointerEvents = 'none';
            
            // Remove previous selection styling
            optionItem.classList.remove('selected');
            
            // Apply color coding based on correctness
            if (wasSelected && isCorrectOption) {
                // Correctly selected
                optionItem.classList.add('mc-correct-selected');
            } else if (wasSelected && !isCorrectOption) {
                // Incorrectly selected (should not have been ticked)
                optionItem.classList.add('mc-incorrect-selected');
                // Add explanation indicator if available
                addExplanationToOption(optionItem, originalIndex, card);
            } else if (!wasSelected && isCorrectOption) {
                // Should have been selected but wasn't
                optionItem.classList.add('mc-missed');
                // Add explanation indicator if available
                addExplanationToOption(optionItem, originalIndex, card);
            } else {
                // Correctly not selected
                optionItem.classList.add('mc-neutral');
            }
        });
        
        // Show back options container and hide other answer displays
        optionsContainerBack.classList.remove('hidden');
        selectedOptionsContainer.classList.add('hidden');
        mcCorrectAnswerContainer.classList.add('hidden');
        
        // Automatically evaluate the answer
        let isCorrect;
        if (selectedOptionIndices.length > 0) {
            // Check if the answer is correct
            isCorrect = arraysEqual([...selectedOptionIndices].sort((a, b) => a - b), [...card.correct].sort((a, b) => a - b));
        } else {
            // No selection was made - treat as incorrect (unless there are no correct answers)
            isCorrect = card.correct.length === 0;
        }
        markAnswer(isCorrect);
        
        // For multiple choice, always hide Richtig/Falsch buttons and show Next button
        markCorrectBtn.style.display = 'none';
        markIncorrectBtn.style.display = 'none';
        nextCardBtn.style.display = 'inline-block';
    } else {
        // Handle standard text answer display
        const userAnswer = userAnswerInput.value.trim();
        if (userAnswer) {
            userAnswerDisplay.textContent = userAnswer;
            userAnswerContainer.classList.remove('hidden');
        } else {
            userAnswerContainer.classList.add('hidden');
        }
        
        // Show explanation for text answers if available (always, not just for incorrect answers)
        if (card.explanation) {
            textExplanationContent.textContent = card.explanation;
            textExplanationContainer.classList.remove('hidden');
        }
        
        // Check if the user's answer exactly matches the correct answer
        const correctAnswer = card.answer.trim();
        const isExactMatch = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        
        if (isExactMatch) {
            // Automatically mark as correct and show only Next button
            markAnswer(true);
            markCorrectBtn.style.display = 'none';
            markIncorrectBtn.style.display = 'none';
            nextCardBtn.style.display = 'inline-block';
        } else {
            // For text answers that don't match, show the Richtig/Falsch buttons
            markCorrectBtn.style.display = 'inline-block';
            markIncorrectBtn.style.display = 'inline-block';
            nextCardBtn.style.display = 'none';
        }
    }
}

/**
 * Compare two arrays for equality
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Mark the current answer as correct or incorrect
 * @param {boolean} isCorrect - Whether the answer was correct
 */
function markAnswer(isCorrect) {
    if (isAnswered) {
        return;
    }

    isAnswered = true;
    answeredCards[currentCardIndex] = isCorrect;
    const card = cards[currentCardIndex];
    const deckName = card.sourceDeck;

    // Update spaced repetition data
    const isFromSRBuckets = activeDecks.length === 1 && activeDecks[0] === 'SR Buckets';
    if (studyMode === 'spaced-repetition' || isFromSRBuckets) {
        updateSpacedRepetition(card, isCorrect);
    }

    if (isCorrect) {
        correctCount++;
        if (deckStats[deckName]) {
            deckStats[deckName].correct++;
        }
        
        // Trigger confetti animation for correct answers
        triggerConfetti();
    } else {
        incorrectCount++;
        if (deckStats[deckName]) {
            deckStats[deckName].incorrect++;
        }
        
        // Store the incorrect card in the source deck's incorrect indices
        if (deckName && savedDecks[deckName]) {
            // Find original index in the source deck
            const originalDeckCards = savedDecks[deckName].cards;
            const originalIndex = originalDeckCards.findIndex(c => 
                c.question === card.question && 
                (c.answer === card.answer || 
                (Array.isArray(c.options) && Array.isArray(card.options) && 
                JSON.stringify(c.options) === JSON.stringify(card.options)))
            );
            
            if (originalIndex !== -1) {
                if (!previousIncorrectIndices[deckName]) {
                    previousIncorrectIndices[deckName] = [];
                }
                if (!previousIncorrectIndices[deckName].includes(originalIndex)) {
                    previousIncorrectIndices[deckName].push(originalIndex);
                }
            }
        }
    }

    // Update incorrect indices in local storage
    updateIncorrectIndices();

    // Hide the evaluation buttons and show next button
    markCorrectBtn.style.display = 'none';
    markIncorrectBtn.style.display = 'none';
    nextCardBtn.style.display = 'inline-block';

    // If this was a multiple choice question, highlight correct/incorrect options
    if (Array.isArray(card.options) && Array.isArray(card.correct)) {
        const optionItems = document.querySelectorAll('.option-item');

        optionItems.forEach(item => {
            const optionIndex = parseInt(item.dataset.index);
            const isOptionCorrect = card.correct.includes(optionIndex);
            const isOptionSelected = selectedOptionIndices.includes(optionIndex);

            // First remove any existing styling classes
            item.classList.remove('correct', 'incorrect');

            // Add appropriate styling
            if (isOptionCorrect) {
                item.classList.add('correct');
            } else if (isOptionSelected) {
                item.classList.add('incorrect');
            }
        });
    }

    updateStatistics();
}

/**
 * Move to the next card
 */
function showNextCard() {
    currentCardIndex++;
    showCurrentCard();
}

/**
 * Update the statistics display
 */
function updateStatistics() {
    const totalCards = cards.length;
    const completedCards = correctCount + incorrectCount;
    const remainingCards = totalCards - completedCards;
    const percentageComplete = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;

    cardsRemainingElement.textContent = remainingCards;
    cardsCompletedElement.textContent = completedCards;
    correctCountElement.textContent = correctCount;
    incorrectCountElement.textContent = incorrectCount;

    progressBar.style.width = `${percentageComplete}%`;
}

// ============================================================================
// Quiz Completion & Restart
// ============================================================================

/**
 * Show feedback and statistics when quiz is complete
 */
function showFeedback() {
    const totalAnswered = correctCount + incorrectCount;
    const percentageCorrect = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    finalScoreElement.textContent = `${percentageCorrect}%`;
    feedbackElement.classList.remove('hidden');
    cardContainer.classList.add('hidden');

    // Show/hide buttons based on whether we're in SR bucket mode
    const isFromSRBuckets = activeDecks.length === 1 && activeDecks[0] === 'SR Buckets';
    if (isFromSRBuckets) {
        restartBtn.style.display = 'none';
        uploadNewBtn.style.display = 'none';
        returnToSrBtn.style.display = 'inline-block';
    } else {
        restartBtn.style.display = 'inline-block';
        uploadNewBtn.style.display = 'inline-block';
        returnToSrBtn.style.display = 'none';
    }

    // Display per-deck statistics
    deckStatsContainer.innerHTML = '';
    
    if (activeDecks.length > 1) {
        const deckStatsHeader = document.createElement('h3');
        deckStatsHeader.textContent = 'Statistik pro Deck:';
        deckStatsContainer.appendChild(deckStatsHeader);
        
        const deckStatsList = document.createElement('div');
        deckStatsList.className = 'deck-stats-list';
        
        for (const deckName in deckStats) {
            const stats = deckStats[deckName];
            const totalAnswered = stats.correct + stats.incorrect;
            
            if (totalAnswered === 0) continue;
            
            const deckAccuracy = Math.round((stats.correct / totalAnswered) * 100);
            
            const deckStatItem = document.createElement('div');
            deckStatItem.className = 'deck-stat-item';
            deckStatItem.innerHTML = `
                <strong>${sanitizeHTML(deckName)}:</strong>
                ${stats.correct} richtig,
                ${stats.incorrect} falsch,
                ${deckAccuracy}% Genauigkeit
            `;
            
            deckStatsList.appendChild(deckStatItem);
        }
        
        deckStatsContainer.appendChild(deckStatsList);
    }
}

/**
 * Restart the quiz with the same cards
 */
function restartQuiz() {
    // Don't allow restart from SR buckets mode
    const isFromSRBuckets = activeDecks.length === 1 && activeDecks[0] === 'SR Buckets';
    if (isFromSRBuckets) {
        showError('Bitte nutze "Zurück zur SR-Verwaltung" um neue Buckets auszuwählen.');
        return;
    }

    currentCardIndex = 0;
    correctCount = 0;
    incorrectCount = 0;

    // Reset deck statistics
    resetDeckStats(activeDecks);

    // Reset answered cards
    answeredCards = new Array(cards.length).fill(null);

    // Prioritize incorrect cards again and reshuffle
    shuffleCards();
    prioritizeIncorrectCards();

    // Reset UI
    feedbackElement.classList.add('hidden');
    cardContainer.classList.remove('hidden');
    updateStatistics();
    showCurrentCard();
}

/**
 * Return to SR Manager after completing a quiz from SR buckets
 */
function returnToSRManager() {
    // Hide quiz content
    appContent.classList.add('hidden');
    feedbackElement.classList.add('hidden');
    
    // Show file input container and SR manager
    document.getElementById('file-input-container').style.display = 'block';
    srManagerContainer.classList.remove('hidden');
    
    // Hide saved decks and upload section
    const savedDecksContainer = document.getElementById('saved-decks-container');
    const uploadSection = document.querySelector('.upload-section');
    const subtitle = document.getElementById('app-subtitle');
    
    savedDecksContainer.classList.add('hidden');
    if (uploadSection) uploadSection.classList.add('hidden');
    if (subtitle) subtitle.classList.add('hidden');
    
    // Update button state
    openSrManagerBtn.textContent = '📚 Decks anzeigen';
    openSrManagerBtn.classList.add('active');
    
    // Hide study mode selector in SR manager
    studyModeSelect.style.display = 'none';
    
    // Refresh SR buckets display
    displaySpacedRepetitionBuckets();
    
    // Reset the app title
    appTitle.textContent = 'Lernkarten App';
    
    // Clear active decks
    activeDecks = [];
}

/**
 * Reset the app and return to deck selection
 */
function resetAndUpload() {
    // Don't allow upload from SR buckets mode
    const isFromSRBuckets = activeDecks.length === 1 && activeDecks[0] === 'SR Buckets';
    if (isFromSRBuckets) {
        showError('Bitte nutze "Zurück zur SR-Verwaltung" um neue Buckets auszuwählen.');
        return;
    }

    // Reset everything and show file upload
    document.getElementById('file-input-container').style.display = 'block';
    appContent.classList.add('hidden');
    feedbackElement.classList.add('hidden');
    cardContainer.classList.remove('hidden');
    fileInput.value = '';

    // Reset the app title
    appTitle.textContent = 'Lernkarten';
    appSubtitle.style.display = 'block';
    studyModeSelect.style.display = 'inline-block';
    
    // Show SR button only if in spaced-repetition mode
    if (studyMode === 'spaced-repetition') {
        openSrManagerBtn.style.display = 'inline-block';
    } else {
        openSrManagerBtn.style.display = 'none';
    }

    // Clear any error messages
    errorMessageElement.classList.add('hidden');
    errorMessageElement.textContent = '';

    // Display saved decks
    displaySavedDecks();
}

// ============================================================================
// User Feedback
// ============================================================================

/**
 * Show an error message to the user
 * @param {string} message - Error message to display
 */
function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
    setTimeout(() => {
        errorMessageElement.classList.add('hidden');
    }, 5000);
}

// ============================================================================
// UX Enhancements
// ============================================================================

/**
 * Handle study mode change
 * @param {Event} event - Change event from select element
 */
function handleStudyModeChange(event) {
    studyMode = event.target.value;
    
    // Show/hide SR button based on mode
    if (studyMode === 'spaced-repetition') {
        openSrManagerBtn.style.display = 'inline-block';
    } else {
        openSrManagerBtn.style.display = 'none';
    }
    
    // Reorganize cards based on study mode
    reorganizeCardsByStudyMode();
    
    // Reset to first card
    currentCardIndex = 0;
    showCurrentCard();
}

/**
 * Reorganize cards based on selected study mode
 */
function reorganizeCardsByStudyMode() {
    // Build card-to-answer map BEFORE shuffling to preserve answer associations
    const cardAnswerMap = new Map();
    cards.forEach((card, index) => cardAnswerMap.set(card, answeredCards[index]));

    // Randomize the card order
    shuffleArray(cards);

    switch (studyMode) {
        case 'incorrect-first':
            // Show incorrect cards first (current session + previous sessions), then correct/unanswered
            cards.sort((a, b) => {
                // Check if answered incorrectly in current session
                const aIncorrectNow = cardAnswerMap.get(a) === false;
                const bIncorrectNow = cardAnswerMap.get(b) === false;

                // Check if was incorrect in previous session
                const aIncorrectBefore = isCardIncorrectFromPreviousSession(a);
                const bIncorrectBefore = isCardIncorrectFromPreviousSession(b);

                // Combine both: incorrect in current session OR incorrect in previous session
                const aIncorrect = aIncorrectNow || aIncorrectBefore;
                const bIncorrect = bIncorrectNow || bIncorrectBefore;

                // Incorrect cards come first (1), then others (0)
                return bIncorrect - aIncorrect;
            });
            break;

        case 'incorrect-only':
            // Filter to show only incorrect cards (current session + previous sessions)
            const incorrectCards = [];
            cards.forEach((card) => {
                const incorrectNow = cardAnswerMap.get(card) === false;
                const incorrectBefore = isCardIncorrectFromPreviousSession(card);

                if (incorrectNow || incorrectBefore) {
                    incorrectCards.push(card);
                }
            });
            if (incorrectCards.length > 0) {
                cards = incorrectCards;
            } else {
                showError('Keine falsch beantworteten Karten gefunden.');
            }
            break;

        case 'spaced-repetition':
            // Sort by next review date
            cards.sort((a, b) => {
                const aKey = getCardKey(a);
                const bKey = getCardKey(b);
                const aData = spacedRepetitionData[aKey] || { nextReview: new Date() };
                const bData = spacedRepetitionData[bKey] || { nextReview: new Date() };
                return new Date(aData.nextReview) - new Date(bData.nextReview);
            });
            break;
    }

    // Rebuild answeredCards to match the new card order
    answeredCards = cards.map(card => cardAnswerMap.get(card) ?? null);
}

/**
 * Check if a card was answered incorrectly in a previous session
 * @param {Object} card - Card object
 * @returns {boolean} True if card was incorrect in previous session
 */
function isCardIncorrectFromPreviousSession(card) {
    const deckName = card.sourceDeck;
    if (!deckName || !previousIncorrectIndices[deckName] || previousIncorrectIndices[deckName].length === 0) {
        return false;
    }
    
    // Find the original index of this card in its source deck
    if (!savedDecks[deckName]) return false;
    
    const originalIndex = savedDecks[deckName].cards.findIndex(c => 
        c.question === card.question && 
        (c.answer === card.answer || 
         (Array.isArray(c.options) && Array.isArray(card.options) && 
          JSON.stringify(c.options) === JSON.stringify(card.options)))
    );
    
    return originalIndex !== -1 && previousIncorrectIndices[deckName].includes(originalIndex);
}

/**
 * Get unique key for a card (for spaced repetition tracking)
 * Uses ||| as separator since it won't appear in normal text
 * @param {Object} card - Card object
 * @returns {string} Unique card key
 */
function getCardKey(card) {
    return `${card.sourceDeck || 'unknown'}|||${card.question}`;
}

/**
 * Update spaced repetition data after answering
 * @param {Object} card - Card object
 * @param {boolean} wasCorrect - Whether answer was correct
 */
function updateSpacedRepetition(card, wasCorrect) {
    const key = getCardKey(card);
    let data = spacedRepetitionData[key] || {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        nextReview: new Date()
    };

    if (wasCorrect) {
        if (data.repetitions === 0) {
            data.interval = 1;
        } else if (data.repetitions === 1) {
            data.interval = 6;
        } else {
            data.interval = Math.round(data.interval * data.easeFactor);
        }
        data.repetitions++;
        data.easeFactor = Math.max(1.3, data.easeFactor + 0.1);
    } else {
        data.repetitions = 0;
        data.interval = 1;
        data.easeFactor = Math.max(1.3, data.easeFactor - 0.2);
    }

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + data.interval);
    data.nextReview = nextReview;

    spacedRepetitionData[key] = data;
    saveSpacedRepetitionData();
}

/**
 * Save spaced repetition data to localStorage
 */
function saveSpacedRepetitionData() {
    try {
        localStorage.setItem('spacedRepetitionData', JSON.stringify(spacedRepetitionData));
    } catch (error) {
        console.error('Error saving spaced repetition data:', error);
    }
}

/**
 * Load spaced repetition data from localStorage
 */
function loadSpacedRepetitionData() {
    try {
        const data = localStorage.getItem('spacedRepetitionData');
        if (data) {
            spacedRepetitionData = JSON.parse(data);
            // Convert date strings back to Date objects
            Object.keys(spacedRepetitionData).forEach(key => {
                spacedRepetitionData[key].nextReview = new Date(spacedRepetitionData[key].nextReview);
            });
        }
    } catch (error) {
        console.error('Error loading spaced repetition data:', error);
        spacedRepetitionData = {};
    }
}

/**
 * Handle deck search input
 * @param {Event} event - Input event
 */
function handleDeckSearch(event) {
    const searchTerm = event.target.value.trim();
    displaySavedDecks(searchTerm);
}

/**
 * Show a temporary success/info message to the user
 * @param {string} message - Message to display
 */
function showMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message-popup';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        messageEl.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 300);
    }, 3000);
}

// ============================================================================
// Confetti Animation
// ============================================================================

/**
 * Trigger an improved confetti animation for correct answers
 */
function triggerConfetti() {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) {
        console.error('Confetti container not found');
        return;
    }


    // Vibrant color palette
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52D17C',
        '#FF8ED4', '#6C5CE7', '#FD79A8', '#FDCB6E', '#00B894'
    ];
    
    const numConfetti = 80;

    for (let i = 0; i < numConfetti; i++) {
        const piece = document.createElement('div');
        
        // Random starting position (spread across top)
        const startX = Math.random() * 100;
        const startY = -20 - Math.random() * 50;
        
        // Random color
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Random size variation
        const size = 10 + Math.random() * 6;
        
        // Random shape
        const shapeRand = Math.random();
        let borderRadius = '0';
        let clipPath = 'none';
        if (shapeRand > 0.66) {
            borderRadius = '50%';
        } else if (shapeRand > 0.33) {
            clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        }
        
        // Animation properties
        const duration = 1 + Math.random() * 0.5; // 1-1.5 seconds (very fast)
        const delay = Math.random() * 0.15;
        const horizontalDrift = (Math.random() - 0.5) * 200;
        const rotation = 360 + Math.random() * 720;
        
        // Set all styles inline
        piece.style.cssText = `
            position: absolute;
            left: ${startX}vw;
            top: ${startY}px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border-radius: ${borderRadius};
            clip-path: ${clipPath};
            opacity: 1;
            z-index: 10000;
            pointer-events: none;
            --confetti-x: ${horizontalDrift}px;
            --confetti-rotate: ${rotation}deg;
            animation: confetti-fall ${duration}s ease-in forwards;
            animation-delay: ${delay}s;
        `;
        
        // Add to DOM
        confettiContainer.appendChild(piece);

        // Remove piece after animation completes
        setTimeout(() => {
            if (piece.parentNode) {
                piece.remove();
            }
        }, (duration + delay) * 1000 + 100);
    }
    
}

// ============================================================================
// Spaced Repetition Manager
// ============================================================================

/**
 * Toggle the Spaced Repetition Manager interface
 */
function openSpacedRepetitionManager() {
    const savedDecksContainer = document.getElementById('saved-decks-container');
    const uploadSection = document.querySelector('.upload-section');
    const subtitle = document.getElementById('app-subtitle');
    const isCurrentlyOpen = !srManagerContainer.classList.contains('hidden');
    
    if (isCurrentlyOpen) {
        // Close SR manager, show saved decks
        srManagerContainer.classList.add('hidden');
        savedDecksContainer.classList.remove('hidden');
        if (uploadSection) uploadSection.classList.remove('hidden');
        if (subtitle) subtitle.classList.remove('hidden');
        studyModeSelect.style.display = 'inline-block';
        openSrManagerBtn.textContent = '📊 SR verwalten';
        openSrManagerBtn.classList.remove('active');
        // Refresh saved decks display
        displaySavedDecks(deckSearchInput.value);
    } else {
        // Open SR manager, hide saved decks
        srManagerContainer.classList.remove('hidden');
        savedDecksContainer.classList.add('hidden');
        if (uploadSection) uploadSection.classList.add('hidden');
        if (subtitle) subtitle.classList.add('hidden');
        studyModeSelect.style.display = 'none';
        openSrManagerBtn.textContent = '📚 Decks anzeigen';
        openSrManagerBtn.classList.add('active');
        displaySpacedRepetitionBuckets();
    }
}

/**
 * Display cards grouped by their spaced repetition intervals (buckets)
 */
function displaySpacedRepetitionBuckets() {
    // Check if there are any cards with SR data
    if (Object.keys(spacedRepetitionData).length === 0) {
        srBucketsDisplay.innerHTML = '<div class="sr-empty-message">Noch keine Karten im Spaced Repetition System. Beantworte Fragen im Spaced Repetition Modus, um Karten hier zu sehen.</div>';
        startSelectedBucketsBtn.disabled = true;
        return;
    }

    // Group cards by interval
    const buckets = {};
    const now = new Date();
    let cardsNotFound = 0;

    Object.entries(spacedRepetitionData).forEach(([key, data]) => {
        const intervalKey = data.interval;
        if (!buckets[intervalKey]) {
            buckets[intervalKey] = [];
        }
        
        // Parse the card from the key
        const card = getCardFromKey(key);
        if (card) {
            buckets[intervalKey].push({
                key,
                card,
                data,
                isOverdue: data.nextReview <= now
            });
        } else {
            console.warn('Card not found for key:', key);
            cardsNotFound++;
            // Still add it with the key as the question
            buckets[intervalKey].push({
                key,
                card: { question: key.split('|||')[1] || 'Unbekannte Frage', sourceDeck: 'Unbekannt' },
                data,
                isOverdue: data.nextReview <= now
            });
        }
    });
    
    // Sort buckets by interval
    const sortedIntervals = Object.keys(buckets).map(Number).sort((a, b) => a - b);

    // Build HTML
    let html = '';
    sortedIntervals.forEach(interval => {
        const cards = buckets[interval];
        const intervalLabel = getIntervalLabel(interval);
        const overdueCount = cards.filter(c => c.isOverdue).length;
        
        html += `
            <div class="sr-bucket" data-interval="${interval}">
                <div class="sr-bucket-header" onclick="toggleBucketExpansion(${interval})">
                    <div class="sr-bucket-info">
                        <input type="checkbox" class="sr-bucket-checkbox" onclick="event.stopPropagation(); toggleBucketSelection(${interval})" data-interval="${interval}">
                        <span class="sr-bucket-title">${intervalLabel}</span>
                        <span class="sr-bucket-count">${cards.length} Karten${overdueCount > 0 ? ` (${overdueCount} fällig)` : ''}</span>
                    </div>
                    <span class="sr-bucket-interval">${interval} Tag${interval !== 1 ? 'e' : ''}</span>
                </div>
                <div class="sr-bucket-cards" id="bucket-cards-${interval}">
                    ${cards.map(({ key, card, data, isOverdue }) => `
                        <div class="sr-card-item" data-card-key="${encodeURIComponent(key)}">
                            <div class="sr-card-question">${sanitizeHTML(card.question || 'Unbekannte Frage')}</div>
                            <div class="sr-card-meta">
                                <span class="sr-card-next-review" style="color: ${isOverdue ? '#dc3545' : '#28a745'}">
                                    ${isOverdue ? '⚠️ Fällig' : '✓'} ${formatDate(data.nextReview)}
                                </span>
                                <div class="sr-card-actions">
                                    <button class="sr-move-btn" onclick="handleMoveSRCard(this)" data-interval="${interval}" title="Zu anderem Bucket verschieben">
                                        Verschieben
                                    </button>
                                    <button class="sr-delete-btn" onclick="handleDeleteSRCard(this)" title="Aus SR-System entfernen">
                                        Löschen
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    srBucketsDisplay.innerHTML = html;
    updateStartBucketButton();
}

/**
 * Get human-readable interval label
 * Maps intervals to 5 semantic learning stages
 */
function getIntervalLabel(interval) {
    if (interval === 1) return 'Neu (Tag 1)';
    if (interval <= 7) return 'Anfänger (2-7 Tage)';
    if (interval <= 30) return 'In Übung (8-30 Tage)';
    if (interval <= 90) return 'Fortgeschritten (1-3 Monate)';
    return 'Gut gelernt (3+ Monate)';
}

/**
 * Toggle bucket expansion
 */
function toggleBucketExpansion(interval) {
    const cardsContainer = document.getElementById(`bucket-cards-${interval}`);
    cardsContainer.classList.toggle('expanded');
}

/**
 * Toggle bucket selection
 */
function toggleBucketSelection(interval) {
    const bucket = document.querySelector(`.sr-bucket[data-interval="${interval}"]`);
    const checkbox = bucket.querySelector('.sr-bucket-checkbox');
    bucket.classList.toggle('selected');
    
    updateStartBucketButton();
}

/**
 * Update the state of the start button based on selected buckets
 */
function updateStartBucketButton() {
    const selectedCount = document.querySelectorAll('.sr-bucket.selected').length;
    startSelectedBucketsBtn.disabled = selectedCount === 0;
    startSelectedBucketsBtn.textContent = selectedCount > 0
        ? `Mit ${selectedCount} Bucket${selectedCount !== 1 ? 's' : ''} üben`
        : 'Mit ausgewählten Buckets üben';
}

/**
 * Select all SR buckets
 */
function selectAllSRBuckets() {
    document.querySelectorAll('.sr-bucket').forEach(bucket => {
        bucket.classList.add('selected');
        const checkbox = bucket.querySelector('.sr-bucket-checkbox');
        if (checkbox) checkbox.checked = true;
    });
    updateStartBucketButton();
}

/**
 * Deselect all SR buckets
 */
function deselectAllSRBuckets() {
    document.querySelectorAll('.sr-bucket').forEach(bucket => {
        bucket.classList.remove('selected');
        const checkbox = bucket.querySelector('.sr-bucket-checkbox');
        if (checkbox) checkbox.checked = false;
    });
    updateStartBucketButton();
}

/**
 * Start practice session with selected buckets
 */
function startSelectedBuckets() {
    const selectedBuckets = Array.from(document.querySelectorAll('.sr-bucket.selected'));
    if (selectedBuckets.length === 0) {
        showError('Bitte wähle mindestens einen Bucket aus.');
        return;
    }

    // Collect all cards from selected buckets
    const selectedCards = [];
    selectedBuckets.forEach(bucket => {
        const interval = parseInt(bucket.dataset.interval);
        Object.entries(spacedRepetitionData).forEach(([key, data]) => {
            if (data.interval === interval) {
                const card = getCardFromKey(key);
                if (card) {
                    // Add sourceDeck to maintain compatibility with quiz system
                    selectedCards.push({
                        ...card,
                        sourceDeck: card.sourceDeck || 'SR Practice'
                    });
                }
            }
        });
    });

    if (selectedCards.length === 0) {
        showError('Keine Karten in den ausgewählten Buckets gefunden.');
        return;
    }

    // Sort cards by interval (bucket order) then by nextReview date within each bucket
    selectedCards.sort((a, b) => {
        const aKey = getCardKey(a);
        const bKey = getCardKey(b);
        const aData = spacedRepetitionData[aKey];
        const bData = spacedRepetitionData[bKey];
        
        // First sort by interval (bucket)
        if (aData.interval !== bData.interval) {
            return aData.interval - bData.interval;
        }
        
        // Within same interval, sort by nextReview date (most overdue first)
        return new Date(aData.nextReview) - new Date(bData.nextReview);
    });

    // Set active decks for title display
    activeDecks = ['SR Buckets'];
    
    // Ensure study mode is set to spaced-repetition and hide selector
    studyMode = 'spaced-repetition';
    studyModeSelect.value = 'spaced-repetition';
    studyModeSelect.style.display = 'none';
    
    // Update the app title
    updateAppTitle(['SR Buckets']);

    // Close SR manager and show quiz
    const savedDecksContainer = document.getElementById('saved-decks-container');
    const uploadSection = document.querySelector('.upload-section');
    const subtitle = document.getElementById('app-subtitle');
    
    srManagerContainer.classList.add('hidden');
    savedDecksContainer.classList.remove('hidden');
    if (uploadSection) uploadSection.classList.remove('hidden');
    if (subtitle) subtitle.classList.remove('hidden');
    openSrManagerBtn.textContent = '📊 SR verwalten';
    openSrManagerBtn.classList.remove('active');

    // Initialize the quiz with selected cards
    initializeQuiz(selectedCards);
}

/**
 * Handler for move button click - extracts key from data attributes
 */
function handleMoveSRCard(button) {
    const cardItem = button.closest('.sr-card-item');
    const cardKey = decodeURIComponent(cardItem.dataset.cardKey);
    const currentInterval = parseInt(button.dataset.interval);
    moveSRCard(cardKey, currentInterval);
}

/**
 * Handler for delete button click - extracts key from data attributes
 */
function handleDeleteSRCard(button) {
    const cardItem = button.closest('.sr-card-item');
    const cardKey = decodeURIComponent(cardItem.dataset.cardKey);
    deleteSRCard(cardKey);
}

/**
 * Move a card to a different interval bucket
 */
function moveSRCard(cardKey, currentInterval) {
    const newInterval = prompt(`Karte zu welchem Intervall (in Tagen) verschieben?\nAktuell: ${currentInterval} Tag${currentInterval !== 1 ? 'e' : ''}`, currentInterval);
    
    if (newInterval === null) return; // Cancelled
    
    const trimmed = newInterval.trim();
    if (trimmed === '') {
        showError('Bitte gib eine gültige Anzahl von Tagen ein.');
        return;
    }
    
    const interval = parseInt(trimmed);
    if (isNaN(interval) || interval < 1 || interval > 365) {
        showError('Bitte gib eine gültige Anzahl von Tagen ein (1-365).');
        return;
    }

    if (spacedRepetitionData[cardKey]) {
        spacedRepetitionData[cardKey].interval = interval;
        
        // Recalculate next review date
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);
        spacedRepetitionData[cardKey].nextReview = nextReview;
        
        saveSpacedRepetitionData();
        displaySpacedRepetitionBuckets();
        showMessage(`Karte zu ${interval}-Tage-Intervall verschoben.`);
    } else {
        showError('Karte wurde nicht gefunden.');
    }
}

/**
 * Delete a card from the SR system
 */
function deleteSRCard(cardKey) {
    if (!confirm('Diese Karte aus dem Spaced Repetition System entfernen?')) {
        return;
    }

    delete spacedRepetitionData[cardKey];
    saveSpacedRepetitionData();
    displaySpacedRepetitionBuckets();
    showMessage('Karte aus SR-System entfernt.');
}

/**
 * Cleanup orphaned SR data (cards whose decks have been deleted)
 */
function cleanupOrphanedSRData() {
    const orphanedKeys = [];
    
    Object.keys(spacedRepetitionData).forEach(key => {
        // Extract deck name from key (format: "deckName|||question")
        const deckName = key.split('|||')[0];
        
        // Check if deck still exists
        if (!savedDecks[deckName]) {
            orphanedKeys.push(key);
        }
    });
    
    if (orphanedKeys.length === 0) {
        showMessage('Keine verwaisten Einträge gefunden. Alles sauber!');
        return;
    }
    
    if (!confirm(`${orphanedKeys.length} verwaiste Einträge gefunden (Decks wurden gelöscht). Jetzt entfernen?`)) {
        return;
    }
    
    orphanedKeys.forEach(key => {
        delete spacedRepetitionData[key];
    });
    
    saveSpacedRepetitionData();
    displaySpacedRepetitionBuckets();
    showMessage(`${orphanedKeys.length} verwaiste Einträge entfernt.`);
}

/**
 * Get card object from SR data key
 * Key format: "deckName|||question"
 */
function getCardFromKey(key) {
    const parts = key.split('|||');
    if (parts.length < 2) {
        console.warn('Invalid key format:', key);
        return null;
    }
    
    const deckName = parts[0];
    const question = parts.slice(1).join('|||'); // Handle ||| in question (unlikely but safe)
    
    // Try to find the card in saved decks
    if (savedDecks[deckName]) {
        const found = savedDecks[deckName].cards.find(card => card.question === question);
        if (found) {
            return { ...found, sourceDeck: deckName };
        }
    }
    
    // If deck not found or card not in deck, return a basic card object
    return {
        question: question,
        sourceDeck: deckName,
        answer: 'Nicht verfügbar'
    };
}

/**
 * Format date for display
 */
function formatDate(date) {
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Überfällig';
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    return `in ${diffDays} Tagen`;
}

