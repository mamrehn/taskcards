/**
 * Input Sanitization Utility
 * Provides functions to sanitize user inputs and prevent XSS attacks
 */

/**
 * Sanitize HTML string to prevent XSS attacks
 * Removes potentially dangerous HTML tags and attributes
 * 
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string safe for display
 */
function sanitizeHTML(input) {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Create a temporary div to leverage browser's HTML parsing
    const temp = document.createElement('div');
    temp.textContent = input; // textContent automatically escapes HTML
    return temp.innerHTML;
}

/**
 * Sanitize user input for storage and display
 * Trims whitespace and limits length
 * 
 * @param {string} input - The input string to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 1000)
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    
    // Remove any null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    return sanitized;
}

/**
 * Sanitize player name for multiplayer quiz
 * Ensures name is alphanumeric with limited special characters
 * 
 * @param {string} name - The player name to sanitize
 * @returns {string} Sanitized player name
 */
function sanitizePlayerName(name) {
    if (typeof name !== 'string') {
        return '';
    }
    
    // Remove any HTML
    let sanitized = sanitizeHTML(name);
    
    // Trim and limit length
    sanitized = sanitizeInput(sanitized, 50);
    
    // Only allow letters, numbers, spaces, and basic punctuation
    sanitized = sanitized.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_\.]/g, '');
    
    return sanitized;
}

/**
 * Sanitize room code for multiplayer quiz
 * Ensures code is alphanumeric only
 * 
 * @param {string} code - The room code to sanitize
 * @returns {string} Sanitized room code
 */
function sanitizeRoomCode(code) {
    if (typeof code !== 'string') {
        return '';
    }
    
    // Only allow uppercase letters and numbers
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
}

/**
 * Sanitize question or answer text
 * Allows more characters but removes dangerous content
 * 
 * @param {string} text - The text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeQuestionText(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    // Remove any HTML tags
    let sanitized = sanitizeHTML(text);
    
    // Trim and limit length
    sanitized = sanitizeInput(sanitized, 5000);
    
    return sanitized;
}

/**
 * Validate and sanitize JSON input
 * Ensures JSON is valid and within size limits
 * 
 * @param {string} jsonString - The JSON string to validate
 * @param {number} maxSize - Maximum size in bytes (default: 5MB)
 * @returns {Object|null} Parsed JSON object or null if invalid
 */
function sanitizeJSON(jsonString, maxSize = 5 * 1024 * 1024) {
    if (typeof jsonString !== 'string') {
        return null;
    }
    
    // Check size
    if (new Blob([jsonString]).size > maxSize) {
        console.error('JSON file too large');
        return null;
    }
    
    try {
        const parsed = JSON.parse(jsonString);
        return parsed;
    } catch (e) {
        console.error('Invalid JSON:', e);
        return null;
    }
}

/**
 * Sanitize URL to prevent javascript: or data: URLs
 * Only allows http: and https: protocols
 * 
 * @param {string} url - The URL to sanitize
 * @returns {string} Sanitized URL or empty string if invalid
 */
function sanitizeURL(url) {
    if (typeof url !== 'string') {
        return '';
    }
    
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return url;
        }
    } catch (e) {
        // Invalid URL
    }
    
    return '';
}

/**
 * Create a safe text node for DOM insertion
 * Prevents XSS by using createTextNode instead of innerHTML
 * 
 * @param {string} text - The text to display
 * @returns {Text} Text node safe for DOM insertion
 */
function createSafeTextNode(text) {
    return document.createTextNode(sanitizeInput(text));
}

/**
 * Safely set element text content
 * 
 * @param {HTMLElement} element - The element to update
 * @param {string} text - The text to set
 */
function setSafeText(element, text) {
    if (element && typeof text === 'string') {
        element.textContent = sanitizeInput(text);
    }
}

/**
 * Validate email format (basic check)
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} True if email format is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
