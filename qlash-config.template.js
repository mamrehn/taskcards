/**
 * WebSocket Server Configuration
 *
 * For local development:
 * 1. Copy this file to qlash-config.js
 * 2. Replace __WS_URL__ with your WebSocket server URL (e.g. wss://localhost:8080)
 * 3. qlash-config.js is already in .gitignore
 *
 * For production:
 * The placeholder is replaced during CI/CD build via the WS_URL secret.
 */

window.WS_URL = '__WS_URL__';
