// Entry Point
import './css/main.css';
import { initGlobalErrorBoundaries } from './js/errors.js';
import { initApp } from './js/app.js';

// Setup global error boundaries early
initGlobalErrorBoundaries();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

