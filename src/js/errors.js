// Error Handling System, Route Loading Controller, & Skeleton Loaders

let progressInterval = null;

/**
 * 1. Global Route Progress Bar
 */
export function startRouteProgress() {
  const bar = document.getElementById('rp-route-progress');
  if (!bar) return;
  if (progressInterval) clearInterval(progressInterval);

  bar.style.transition = 'width 0.2s ease, opacity 0.2s ease';
  bar.classList.add('loading');
  bar.style.width = '25%';

  let currentWidth = 25;
  progressInterval = setInterval(() => {
    if (currentWidth < 80) {
      currentWidth += Math.random() * 15;
      bar.style.width = `${currentWidth}%`;
    }
  }, 180);
}

export function finishRouteProgress() {
  const bar = document.getElementById('rp-route-progress');
  if (!bar) return;
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  bar.style.transition = 'width 0.15s ease, opacity 0.3s ease';
  bar.style.width = '100%';

  setTimeout(() => {
    bar.classList.remove('loading');
    setTimeout(() => {
      bar.style.width = '0%';
    }, 250);
  }, 150);
}

/**
 * 2. Skeleton Loaders
 */
export function renderNovelGridSkeleton(count = 8) {
  let cards = '';
  for (let i = 0; i < count; i++) {
    cards += `
      <div class="skeleton-novel-card">
        <div class="skeleton-novel-cover skeleton-shimmer"></div>
        <div class="skeleton-novel-body">
          <div class="skeleton-text title skeleton-shimmer"></div>
          <div class="skeleton-text subtitle skeleton-shimmer"></div>
          <div class="skeleton-text para skeleton-shimmer" style="width:90%;"></div>
          <div class="skeleton-text para skeleton-shimmer" style="width:65%;"></div>
        </div>
      </div>
    `;
  }
  return `<div class="novel-grid">${cards}</div>`;
}

export function renderReaderSkeleton() {
  return `
    <div class="skeleton-reader-wrap">
      <div class="skeleton-reader-header">
        <div class="skeleton-reader-crumb skeleton-shimmer"></div>
        <div class="skeleton-reader-title skeleton-shimmer"></div>
        <div class="skeleton-reader-meta skeleton-shimmer"></div>
      </div>
      <div class="skeleton-reader-content">
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:98%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:92%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:95%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:70%;"></div>
        <br>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:96%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:90%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:88%;"></div>
        <br>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:94%;"></div>
        <div class="skeleton-text skeleton-shimmer" style="height:18px; width:85%;"></div>
      </div>
    </div>
  `;
}

export function renderMembersSkeleton(count = 8) {
  let items = '';
  for (let i = 0; i < count; i++) {
    items += `
      <div class="skeleton-member-card">
        <div class="skeleton-member-avatar skeleton-shimmer"></div>
        <div class="skeleton-member-name skeleton-shimmer"></div>
        <div class="skeleton-member-role skeleton-shimmer"></div>
        <div class="skeleton-member-stats skeleton-shimmer"></div>
      </div>
    `;
  }
  return `<div class="members-grid">${items}</div>`;
}

/**
 * 3. Centralized Comprehensive Error Views
 */
export function renderErrorView(container, options = {}) {
  const {
    code = '500',
    title = '',
    message = '',
    tip = '',
    icon = '⚠️',
    primaryAction = null,
    secondaryAction = null,
    retryFn = null
  } = options;

  // Defaults per error type
  const configs = {
    '404': {
      icon: '🔍',
      codeLabel: '404 — NOT FOUND',
      defTitle: 'Page Not Found',
      defMsg: "The page or novel chapter you are looking for doesn't exist or may have been moved.",
      defTip: 'Check the link address or browse our complete novel library to discover stories.',
      prim: { text: 'Go Home', href: '#forms' },
      sec: { text: 'Return to Novels', href: '#novels' }
    },
    '403': {
      icon: '🔒',
      codeLabel: '403 — ACCESS RESTRICTED',
      defTitle: 'Members Only Area',
      defMsg: 'This content is reserved for registered community members. Guests can read the latest chapter for free.',
      defTip: 'Log in with your existing account or join free in less than 30 seconds.',
      prim: { text: 'Log In', onClick: "openAuthModal('login')" },
      sec: { text: 'Register Free', onClick: "openAuthModal('register')" }
    },
    '500': {
      icon: '⚙️',
      codeLabel: '500 — SERVER ERROR',
      defTitle: 'Something Went Wrong',
      defMsg: 'Our literary servers encountered an unexpected issue while preparing this page.',
      defTip: 'We have logged this issue. Please try reloading the page in a moment.',
      prim: { text: 'Try Again', isRetry: true },
      sec: { text: 'Go Home', href: '#forms' }
    },
    'offline': {
      icon: '📡',
      codeLabel: 'CONNECTION ERROR',
      defTitle: 'Network Connection Lost',
      defMsg: 'Unable to reach the server. Please check your internet connection and try again.',
      defTip: 'Ensure your device has an active Wi-Fi or mobile data connection.',
      prim: { text: 'Try Again', isRetry: true },
      sec: { text: 'Go Home', href: '#forms' }
    },
    'session_expired': {
      icon: '⌛',
      codeLabel: 'SESSION EXPIRED',
      defTitle: 'Your Session Has Expired',
      defMsg: 'For your account security, your session has expired. Please log in again to continue reading.',
      defTip: 'Your reading progress and bookmarks remain safely saved.',
      prim: { text: 'Log In Again', onClick: "openAuthModal('login')" },
      sec: { text: 'Go Home', href: '#forms' }
    },
    'chapter_error': {
      icon: '📖⚠️',
      codeLabel: 'CHAPTER ERROR',
      defTitle: 'Unable to Load Chapter',
      defMsg: "We couldn't retrieve the chapter content from the novel database right now.",
      defTip: 'Try reloading the chapter or return to the novel details page.',
      prim: { text: 'Try Again', isRetry: true },
      sec: { text: 'Return to Novels', href: '#novels' }
    }
  };

  const currentCfg = configs[code] || configs['500'];

  const displayIcon = icon || currentCfg.icon;
  const displayTitle = title || currentCfg.defTitle;
  const displayMsg = message || currentCfg.defMsg;
  const displayTip = tip || currentCfg.defTip;
  const primBtn = primaryAction || currentCfg.prim;
  const secBtn = secondaryAction || currentCfg.sec;

  // Generate unique retry identifier if retryFn is provided
  const retryId = `retry_${Math.random().toString(36).slice(2, 9)}`;
  if (retryFn) {
    window[retryId] = () => {
      try {
        retryFn();
      } catch (err) {
        console.error('[Retry Failure]', err);
      }
    };
  }

  let primBtnHtml = '';
  if (primBtn) {
    if (primBtn.isRetry && retryFn) {
      primBtnHtml = `<button class="btn btn-gold" onclick="window['${retryId}']()">🔄 ${primBtn.text}</button>`;
    } else if (primBtn.onClick) {
      primBtnHtml = `<button class="btn btn-gold" onclick="${primBtn.onClick}">${primBtn.text}</button>`;
    } else if (primBtn.href) {
      primBtnHtml = `<a href="${primBtn.href}" class="btn btn-gold">${primBtn.text}</a>`;
    }
  }

  let secBtnHtml = '';
  if (secBtn) {
    if (secBtn.onClick) {
      secBtnHtml = `<button class="btn btn-outline" onclick="${secBtn.onClick}">${secBtn.text}</button>`;
    } else if (secBtn.href) {
      secBtnHtml = `<a href="${secBtn.href}" class="btn btn-outline">${secBtn.text}</a>`;
    }
  }

  container.innerHTML = `
    <div class="error-page-container">
      <div class="error-card">
        <div class="error-badge-icon">${displayIcon}</div>
        <div class="error-code">${currentCfg.codeLabel}</div>
        <h1 class="error-title">${displayTitle}</h1>
        <p class="error-message">${displayMsg}</p>
        ${displayTip ? `<p class="error-tip">${displayTip}</p>` : ''}
        <div class="error-actions">
          ${primBtnHtml}
          ${secBtnHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderNotFound(container) {
  renderErrorView(container, { code: '404' });
}

export function renderAccessDenied(container, redirectHash = null) {
  renderErrorView(container, {
    code: '403',
    primaryAction: {
      text: 'Log In',
      onClick: `sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash}'); openAuthModal('login');`
    },
    secondaryAction: {
      text: 'Register Free',
      onClick: `sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash}'); openAuthModal('register');`
    }
  });
}

export function renderServerError(container, retryFn = null) {
  renderErrorView(container, { code: '500', retryFn });
}

export function renderNetworkError(container, retryFn = null) {
  renderErrorView(container, { code: 'offline', retryFn });
}

export function renderSessionExpired(container) {
  renderErrorView(container, { code: 'session_expired' });
}

export function renderChapterError(container, novelId, chNum, retryFn = null) {
  renderErrorView(container, {
    code: 'chapter_error',
    retryFn,
    secondaryAction: {
      text: 'Chapter List',
      href: `#novel?id=${encodeURIComponent(novelId)}`
    }
  });
}

/**
 * 4. Robust API Fetch Wrapper with Timeouts, 401 Session Handling, and Offline Detection
 */
export async function apiFetch(url, options = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Auto-attach authorization token if present
  const token = localStorage.getItem('rp_auth_token');
  const headers = { ...(options.headers || {}) };
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 401 Unauthorized / Token Expired
    const isAuthRoute = url.includes('/login') || url.includes('/register') || url.includes('/forgot-password');
    if (response.status === 401 && !isAuthRoute) {
      if (token) {
        localStorage.removeItem('rp_auth_token');
        window.CURRENT_USER = null;
        window.IS_LOGGED_IN = false;
        if (typeof window.updateHeaderUserArea === 'function') {
          window.updateHeaderUserArea();
        }
      }
      const errorObj = new Error('Session Expired');
      errorObj.status = 401;
      errorObj.isSessionExpired = true;
      throw errorObj;
    }

    return response;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Request Timeout');
      timeoutErr.status = 408;
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const netErr = new Error('Network Connection Error');
      netErr.status = 0;
      netErr.isNetworkError = true;
      throw netErr;
    }

    throw err;
  }
}

/**
 * 5. Global Error Boundaries
 */
export function initGlobalErrorBoundaries() {
  window.addEventListener('error', (event) => {
    // Dismiss early loader or progress bar so user isn't stuck
    if (typeof window.dismissInitialLoader === 'function') {
      window.dismissInitialLoader();
    }
    finishRouteProgress();

    console.error('[Global App Error Boundary]', event.error || event.message);

    // If main content failed to render completely
    const main = document.getElementById('main-content');
    if (main && (!main.innerHTML || main.innerHTML.trim() === '')) {
      renderErrorView(main, {
        code: '500',
        retryFn: () => window.location.reload()
      });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (typeof window.dismissInitialLoader === 'function') {
      window.dismissInitialLoader();
    }
    finishRouteProgress();

    console.error('[Global Unhandled Rejection]', event.reason);

    if (event.reason && event.reason.isSessionExpired) {
      const main = document.getElementById('main-content');
      if (main) renderSessionExpired(main);
    }
  });
}
