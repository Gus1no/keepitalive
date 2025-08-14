// Re-activate keep-alive when returning to tab or restoring window
function handleVisibility() {
  if (document.visibilityState === 'visible') {
    autoActivate();
  }
}
document.addEventListener('visibilitychange', handleVisibility);
// Entry point for the app (ES Module)
import { initKeepAlive } from './core.js';

// Initialize once DOM is ready
let keepApi;
function autoActivate() {
  if (keepApi && typeof keepApi.enable === 'function') {
    keepApi.enable();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    keepApi = initKeepAlive();
    setTimeout(autoActivate, 100);
  });
} else {
  keepApi = initKeepAlive();
  setTimeout(autoActivate, 100);
}
