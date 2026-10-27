import { startReadingSession, heartbeatReadingSession, pauseOrStopReadingSession } from './content-service.js';

// Reader Functionality: Font scaling, Light/Sepia/Dark modes, Scroll progress, Bookmarks

export function initReader() {
  const currentMode = localStorage.getItem('rp_reader_mode') || 'light';
  let currentFontSize = parseFloat(localStorage.getItem('rp_font_size') || '1.15');

  applyReaderMode(currentMode);
  applyFontSize(currentFontSize);

  // Scroll Progress Tracker
  window.addEventListener('scroll', updateReadingProgress, { passive: true });

  // Expose global methods for inline clicks
  window.setReaderMode = (mode) => {
    localStorage.setItem('rp_reader_mode', mode);
    applyReaderMode(mode);
  };

  window.adjustFontSize = (delta) => {
    let savedFontSize = parseFloat(localStorage.getItem('rp_font_size') || '1.15');
    if (delta === 0) {
      savedFontSize = 1.15;
    } else {
      savedFontSize = Math.round((Math.min(1.65, Math.max(0.95, savedFontSize + delta))) * 100) / 100;
    }
    localStorage.setItem('rp_font_size', savedFontSize.toString());
    applyFontSize(savedFontSize);
  };

  window.bookmarkChapter = (novelId, chNum) => {
    const key = `bookmark_${novelId}`;
    localStorage.setItem(key, JSON.stringify({
      chapter: chNum,
      date: new Date().toLocaleDateString(),
      scrollY: window.scrollY
    }));
    showToast(`Chapter ${chNum} bookmarked! ✨`);
  };

  window.shareChapter = (type, title) => {
    const url = window.location.href;
    if (type === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' - ' + url)}`, '_blank');
    } else if (type === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (type === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard! 📋');
      });
    }
  };
}

export function applyReaderMode(mode) {
  // Ensure reading theme styles NEVER affect global body, html, or other pages
  document.body.classList.remove('mode-sepia', 'mode-dark', 'mode-light');
  document.documentElement.classList.remove('mode-sepia', 'mode-dark', 'mode-light');

  const readerPage = document.querySelector('.reader-page');
  if (readerPage) {
    readerPage.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
    readerPage.classList.add(`mode-${mode}`);
    readerPage.setAttribute('data-reader-theme', mode);
  }

  document.querySelectorAll('.mode-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

export function applyFontSize(size) {
  document.documentElement.style.setProperty('--reader-font-size', `${size}rem`);
  const readerPage = document.querySelector('.reader-page');
  if (readerPage) {
    readerPage.style.setProperty('--reader-font-size', `${size}rem`);
  }
}

function updateReadingProgress() {
  const bar = document.querySelector('.reading-progress-bar');
  if (!bar) return;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) {
    bar.style.width = '0%';
    return;
  }
  const pct = Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100));
  bar.style.width = `${pct}%`;
}

export function showToast(message) {
  let toast = document.getElementById('rp-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'rp-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--color-navy-deep, #0B1F33);
      color: #FFFFFF;
      border: 1px solid var(--color-gold, #C89B3C);
      padding: 12px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      z-index: 2000;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(12px);
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
  }, 3200);
}

// ============================================================================
// Real-Time Member Reading Activity & Duration Tracking
// ============================================================================

let readingTrackerInterval = null;
let currentTrackingSession = null;
let lastUserActivityTime = Date.now();
let readingSessionTabId = null;

function getTabId() {
  if (!readingSessionTabId) {
    try {
      readingSessionTabId = sessionStorage.getItem('rp_reading_tab_id');
      if (!readingSessionTabId) {
        readingSessionTabId = 'tab_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
        sessionStorage.setItem('rp_reading_tab_id', readingSessionTabId);
      }
    } catch {
      readingSessionTabId = 'tab_' + Math.random().toString(36).slice(2, 10);
    }
  }
  return readingSessionTabId;
}

export function setupReadingSessionTracker(novelId, chapterNum) {
  // Only track authentic reading for logged-in members
  if (!window.IS_LOGGED_IN) return;
  if (!novelId || !chapterNum) return;

  // Clean up any previously active tracking session
  stopReadingSessionTracker();

  const tabId = getTabId();
  currentTrackingSession = {
    novelId,
    chapterNum,
    tabId,
    startedAt: Date.now(),
    lastPingAt: Date.now()
  };
  lastUserActivityTime = Date.now();

  // 1. Initial Start Ping to Backend
  startReadingSession(novelId, chapterNum, tabId).catch(() => {});

  // 2. Track genuine interaction (scroll, touch, mouse, key)
  const onUserActivity = () => {
    lastUserActivityTime = Date.now();
  };
  window.addEventListener('scroll', onUserActivity, { passive: true });
  window.addEventListener('mousemove', onUserActivity, { passive: true });
  window.addEventListener('keydown', onUserActivity, { passive: true });
  window.addEventListener('touchstart', onUserActivity, { passive: true });

  // 3. Periodic Heartbeat every 25 seconds
  readingTrackerInterval = setInterval(() => {
    if (!currentTrackingSession) return;

    // If tab is hidden or user has been completely idle for more than 120 seconds, pause accumulating time
    const isTabHidden = document.hidden;
    const idleSeconds = (Date.now() - lastUserActivityTime) / 1000;

    if (isTabHidden || idleSeconds > 120) {
      return;
    }

    const elapsed = Math.round((Date.now() - currentTrackingSession.lastPingAt) / 1000);
    currentTrackingSession.lastPingAt = Date.now();

    heartbeatReadingSession(
      currentTrackingSession.novelId,
      currentTrackingSession.chapterNum,
      currentTrackingSession.tabId,
      Math.min(elapsed, 30)
    ).catch(() => {});
  }, 25000);

  // 4. Tab visibility change (pause when tab hidden, resume when tab visible)
  const onVisibilityChange = () => {
    if (document.hidden) {
      if (currentTrackingSession) {
        pauseOrStopReadingSession(currentTrackingSession.novelId, currentTrackingSession.chapterNum).catch(() => {});
      }
    } else {
      if (currentTrackingSession) {
        lastUserActivityTime = Date.now();
        currentTrackingSession.lastPingAt = Date.now();
        startReadingSession(currentTrackingSession.novelId, currentTrackingSession.chapterNum, currentTrackingSession.tabId).catch(() => {});
      }
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 5. Unload / navigation cleanup
  const onBeforeUnload = () => {
    if (currentTrackingSession) {
      try {
        const payload = JSON.stringify({ novelId: currentTrackingSession.novelId, chapterNum: currentTrackingSession.chapterNum });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/reading/session/pause', blob);
        } else {
          fetch('/api/reading/session/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          });
        }
      } catch {}
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  currentTrackingSession._cleanup = () => {
    window.removeEventListener('scroll', onUserActivity);
    window.removeEventListener('mousemove', onUserActivity);
    window.removeEventListener('keydown', onUserActivity);
    window.removeEventListener('touchstart', onUserActivity);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}

export function stopReadingSessionTracker() {
  if (readingTrackerInterval) {
    clearInterval(readingTrackerInterval);
    readingTrackerInterval = null;
  }
  if (currentTrackingSession) {
    if (typeof currentTrackingSession._cleanup === 'function') {
      currentTrackingSession._cleanup();
    }
    pauseOrStopReadingSession(currentTrackingSession.novelId, currentTrackingSession.chapterNum).catch(() => {});
    currentTrackingSession = null;
  }
}
