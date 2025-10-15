/**
 * Index Page - Confetti Animation and Navigation
 * Provides confetti effects when navigating to different sections
 */

/**
 * Trigger confetti animation and navigate to URL
 * @param {string} url - The URL to navigate to after confetti animation
 */
function triggerConfettiTo(url) {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) {
        console.warn("Confetti-Container nicht gefunden.");
        // Navigate anyway even if container not found
        window.location = url;
        return;
    }

    // Confetti colors - vibrant rainbow palette
    const colors = [
        '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
        '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', 
        '#009688', '#4CAF50', '#8bc34a', '#cddc39', 
        '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
    ];
    
    const numConfetti = 50; // Number of confetti pieces

    for (let i = 0; i < numConfetti; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`; // Random horizontal position
        piece.style.top = `${-20 - Math.random() * 100}px`; // Start above viewport
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = `${Math.random() * 0.5}s`; // Stagger animation
        piece.style.animationDuration = `${2 + Math.random() * 2}s`; // Random duration

        confettiContainer.appendChild(piece);

        // Remove the piece after its animation ends
        piece.addEventListener('animationend', () => {
            piece.remove();
        });
    }
    
    // Navigate after a short delay to show animation
    setTimeout(function() { 
        window.location = url;
    }, 1250);
}
