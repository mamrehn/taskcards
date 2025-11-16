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
let errorMessageElement;
let flipCard;
let cardContainer;
let savedDecksContainer;
let startSelectedDecksBtn;
let selectAllDecksBtn;
let deselectAllDecksBtn;
let studyModeSelect;
let deckSearchInput;

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
    errorMessageElement = document.getElementById('error-message');
    flipCard = document.getElementById('flip-card');
    cardContainer = document.getElementById('card-container');
    savedDecksContainer = document.getElementById('saved-decks');
    startSelectedDecksBtn = document.getElementById('start-selected-decks');
    selectAllDecksBtn = document.getElementById('select-all-decks');
    deselectAllDecksBtn = document.getElementById('deselect-all-decks');
    studyModeSelect = document.getElementById('study-mode');
    deckSearchInput = document.getElementById('deck-search');

    // Set up event listeners with debouncing/throttling for performance
    fileInput.addEventListener('change', handleFileUpload);
    showAnswerBtn.addEventListener('click', throttle(showAnswer, 300));
    markCorrectBtn.addEventListener('click', throttle(() => markAnswer(true), 300));
    markIncorrectBtn.addEventListener('click', throttle(() => markAnswer(false), 300));
    nextCardBtn.addEventListener('click', throttle(showNextCard, 300));
    restartBtn.addEventListener('click', throttle(restartQuiz, 500));
    uploadNewBtn.addEventListener('click', throttle(resetAndUpload, 500));
    startSelectedDecksBtn.addEventListener('click', throttle(startSelectedDecks, 500));
    selectAllDecksBtn.addEventListener('click', debounce(selectAllDecks, 200));
    deselectAllDecksBtn.addEventListener('click', debounce(deselectAllDecks, 200));
    studyModeSelect.addEventListener('change', throttle(handleStudyModeChange, 300));
    deckSearchInput.addEventListener('input', debounce(handleDeckSearch, 250));

    // Hide the next button initially
    nextCardBtn.style.display = 'none';

    // Load saved decks from localStorage
    loadSavedDecks();
    displaySavedDecks();
    loadSpacedRepetitionData();
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

    // Randomize initial card order
    shuffleArray(cards);

    // Prioritize incorrectly answered cards if available
    prioritizeIncorrectCards();

    // Show the app content
    document.getElementById('file-input-container').style.display = 'none';
    appContent.classList.remove('hidden');

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
                checkbox.checked = !checkbox.checked;

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

    // Reset buttons
    markCorrectBtn.style.display = 'inline-block';
    markIncorrectBtn.style.display = 'inline-block';
    nextCardBtn.style.display = 'none';

    updateStatistics();
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
            } else if (!wasSelected && isCorrectOption) {
                // Should have been selected but wasn't
                optionItem.classList.add('mc-missed');
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
            isCorrect = arraysEqual(selectedOptionIndices.sort(), card.correct.sort());
            console.log('MC Question - Selected:', selectedOptionIndices.sort(), 'Correct:', card.correct.sort(), 'isCorrect:', isCorrect);
        } else {
            // No selection was made - treat as incorrect (unless there are no correct answers)
            isCorrect = card.correct.length === 0;
            console.log('No selection made, isCorrect:', isCorrect);
        }
        
        // Auto-evaluate the answer
        console.log('About to call markAnswer with isCorrect:', isCorrect);
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
        
        // Check if the user's answer exactly matches the correct answer
        const correctAnswer = card.answer.trim();
        const isExactMatch = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        
        if (isExactMatch) {
            // Automatically mark as correct and show only Next button
            console.log('Exact match detected! Auto-marking as correct.');
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
    console.log('markAnswer called with isCorrect:', isCorrect);
    
    if (isAnswered) {
        console.log('Answer already marked, returning');
        return;
    }

    isAnswered = true;
    answeredCards[currentCardIndex] = isCorrect;
    const card = cards[currentCardIndex];
    const deckName = card.sourceDeck;

    // Update spaced repetition data
    if (studyMode === 'spaced-repetition') {
        updateSpacedRepetition(card, isCorrect);
    }

    if (isCorrect) {
        console.log('Answer is correct! Incrementing correctCount and triggering confetti');
        correctCount++;
        if (deckStats[deckName]) {
            deckStats[deckName].correct++;
        }
        
        // Trigger confetti animation for correct answers
        triggerConfetti();
    } else {
        console.log('Answer is incorrect');

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
                <strong>${deckName}:</strong> 
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
 * Reset the app and return to deck selection
 */
function resetAndUpload() {
    // Reset everything and show file upload
    document.getElementById('file-input-container').style.display = 'block';
    appContent.classList.add('hidden');
    feedbackElement.classList.add('hidden');
    cardContainer.classList.remove('hidden');
    fileInput.value = '';

    // Reset the app title
    appTitle.textContent = 'Lernkarten';
    appSubtitle.style.display = 'block';

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
    // First, randomize the card order
    shuffleArray(cards);
    
    switch (studyMode) {
        case 'incorrect-first':
            // Show incorrect cards first (current session + previous sessions), then correct/unanswered
            cards.sort((a, b) => {
                const aIndex = cards.indexOf(a);
                const bIndex = cards.indexOf(b);
                
                // Check if answered incorrectly in current session
                const aIncorrectNow = answeredCards[aIndex] === false;
                const bIncorrectNow = answeredCards[bIndex] === false;
                
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
            const incorrectAnswers = [];
            cards.forEach((card, index) => {
                const incorrectNow = answeredCards[index] === false;
                const incorrectBefore = isCardIncorrectFromPreviousSession(card);
                
                if (incorrectNow || incorrectBefore) {
                    incorrectCards.push(card);
                    incorrectAnswers.push(answeredCards[index]);
                }
            });
            if (incorrectCards.length > 0) {
                cards = incorrectCards;
                answeredCards = incorrectAnswers;
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
 * @param {Object} card - Card object
 * @returns {string} Unique card key
 */
function getCardKey(card) {
    return `${card.sourceDeck || 'unknown'}_${card.question}`;
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
        console.error('❌ Confetti container not found!');
        return;
    }

    console.log('🎉 Triggering confetti animation - container found!');

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
    
    console.log(`✅ Added ${numConfetti} confetti pieces to container`);
}
