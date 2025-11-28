(function () {
  "use strict";

  const STORAGE_KEY = "taskcards-theme";
  const THEME_DARK = "dark";
  const THEME_LIGHT = "light";
  const THEME_SYSTEM = "system";

  /**
   * Get the system's preferred color scheme
   * @returns {string} 'dark' or 'light'
   */
  function getSystemPreference() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? THEME_DARK
      : THEME_LIGHT;
  }

  /**
   * Get the stored theme preference
   * @returns {string|null} Stored theme or null
   */
  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("localStorage not available:", e);
      return null;
    }
  }

  /**
   * Store the theme preference
   * @param {string} theme - Theme to store
   */
  function storeTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      console.warn("Could not save theme preference:", e);
    }
  }

  /**
   * Get the effective theme (resolves 'system' to actual theme)
   * @param {string} theme - Theme preference
   * @returns {string} 'dark' or 'light'
   */
  function resolveTheme(theme) {
    if (theme === THEME_SYSTEM || !theme) {
      return getSystemPreference();
    }
    return theme;
  }

  /**
   * Apply the theme to the document
   * @param {string} theme - 'dark' or 'light'
   */
  function applyTheme(theme) {
    const effectiveTheme = resolveTheme(theme);

    // Set data attribute on both html and body for CSS targeting
    // Use documentElement if available, otherwise wait for it
    if (document.documentElement) {
      document.documentElement.setAttribute("data-theme", effectiveTheme);
    }

    // Also set on body when it's available (for inline styles)
    if (document.body) {
      document.body.setAttribute("data-theme", effectiveTheme);
    }

    // Update meta theme-color for mobile browsers (hopefully nobody uses mobile lol)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        effectiveTheme === THEME_DARK ? "#1a1a2e" : "#3498db"
      );
    }

    // Update toggle button state if it exists
    updateToggleButton(effectiveTheme);

    // Dispatch custom event for other scripts to react
    window.dispatchEvent(
      new CustomEvent("themechange", {
        detail: { theme: effectiveTheme, preference: theme },
      })
    );
  }

  /**
   * Update the toggle button appearance
   * @param {string} theme - Current effective theme
   */
  function updateToggleButton(theme) {
    const toggleBtn = document.getElementById("theme-toggle");
    if (!toggleBtn) return;

    const icon = toggleBtn.querySelector(".theme-icon");
    const label = toggleBtn.querySelector(".theme-label");

    if (icon) {
      icon.textContent = theme === THEME_DARK ? "🔆" : "🌙";
    }
    if (label) {
      label.textContent = theme === THEME_DARK ? "Light" : "Dark";
    }

    toggleBtn.setAttribute(
      "aria-label",
      theme === THEME_DARK ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const stored = getStoredTheme();
    const current = resolveTheme(stored);
    const newTheme = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;

    storeTheme(newTheme);
    applyTheme(newTheme);
  }

  /**
   * Create and inject the theme toggle button
   */
  function createToggleButton() {
    // Don't create if already exists
    if (document.getElementById("theme-toggle")) return;

    const button = document.createElement("button");
    button.id = "theme-toggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle dark mode");
    button.innerHTML = `
            <span class="theme-icon">🌙</span>
            <span class="theme-label">Dark</span>
        `;

    button.addEventListener("click", toggleTheme);

    // Insert at the beginning of body
    document.body.insertBefore(button, document.body.firstChild);
  }

  /**
   * Initialize the theme system
   */
  function init() {
    // Apply theme immediately (before DOM fully loaded to prevent blinding flash)
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme || THEME_SYSTEM;
    applyTheme(initialTheme);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", (e) => {
      const stored = getStoredTheme();
      // Only react to system changes if user hasn't set a preference
      if (!stored || stored === THEME_SYSTEM) {
        applyTheme(THEME_SYSTEM);
      }
    });

    // Create toggle button when DOM is ready, then update its state
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        // Re-apply theme now that body exists
        applyTheme(initialTheme);
        createToggleButton();
        // Ensure button state matches current theme after creation
        updateToggleButton(resolveTheme(initialTheme));
      });
    } else {
      // Re-apply theme to ensure body has the attribute
      applyTheme(initialTheme);
      createToggleButton();
      // Ensure button state matches current theme after creation
      updateToggleButton(resolveTheme(initialTheme));
    }
  }

  // Expose API for external use
  window.ThemeManager = {
    toggle: toggleTheme,
    setTheme: (theme) => {
      storeTheme(theme);
      applyTheme(theme);
    },
    getTheme: () => resolveTheme(getStoredTheme()),
    DARK: THEME_DARK,
    LIGHT: THEME_LIGHT,
    SYSTEM: THEME_SYSTEM,
  };

  init();
})();
