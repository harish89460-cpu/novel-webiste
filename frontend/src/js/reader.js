import { startReadingSession, heartbeatReadingSession, pauseOrStopReadingSession } from './content-service.js';

// Reader Functionality: Font scaling, Light/Sepia/Dark modes, Scroll progress, Bookmarks, Reactions, Share Modal

export const EMOJI_LABELS = {
  '❤️': 'Love',
  '👍': 'Like',
  '👏': 'Clap',
  '😂': 'Laugh',
  '😮': 'Surprise',
  '😍': 'Adore',
  '😢': 'Sad'
};

export function formatAuthorRoleBadge(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') {
    return '<span class="forms-role-badge role-badge-admin" style="font-size:11px; font-weight:700; background:#FEF3C7; color:#92400E; padding:2px 8px; border-radius:12px; border:1px solid #FCD34D;">👑 Admin</span>';
  }
  if (r === 'writer' || r === 'author') {
    return '<span class="forms-role-badge role-badge-writer" style="font-size:11px; font-weight:700; background:#EDE9FE; color:#5B21B6; padding:2px 8px; border-radius:12px; border:1px solid #DDD6FE;">✍️ Writer</span>';
  }
  return '<span class="forms-role-badge role-badge-member" style="font-size:11px; font-weight:700; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:12px; border:1px solid #BAE6FD;">👤 Member</span>';
}

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
    const display = document.getElementById('reader-font-size-display');
    if (display) {
      display.textContent = `${Math.round(savedFontSize * 16)}px`;
    }
  };

  window.toggleReaderPreferencesModal = (show) => {
    let drawer = document.getElementById('reader-prefs-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'reader-prefs-drawer';
      drawer.className = 'reader-prefs-backdrop';
      drawer.onclick = (e) => {
        if (e.target === drawer) window.toggleReaderPreferencesModal(false);
      };
      const curMode = localStorage.getItem('rp_reader_mode') || 'light';
      const curFont = localStorage.getItem('rp_reader_font') || 'tamil';
      const curLh = parseFloat(localStorage.getItem('rp_reader_line_height') || '1.95');
      drawer.innerHTML = `
        <div class="reader-prefs-card" onclick="event.stopPropagation()">
          <div class="reader-prefs-header">
            <h4 class="reader-prefs-title"><span>⚙️</span> Reading Preferences</h4>
            <button type="button" class="reader-tool-btn" onclick="window.toggleReaderPreferencesModal(false)" style="padding:4px 8px;">✕</button>
          </div>
          <div class="reader-prefs-body">
            <!-- Reading Theme -->
            <div class="reader-prefs-row">
              <label class="reader-prefs-label">Reading Theme</label>
              <div class="reader-prefs-options">
                <button type="button" class="reader-pill-btn ${curMode === 'light' ? 'active' : ''}" data-mode-btn="light" onclick="setReaderMode('light')">☀️ Light</button>
                <button type="button" class="reader-pill-btn ${curMode === 'sepia' ? 'active' : ''}" data-mode-btn="sepia" onclick="setReaderMode('sepia')">📜 Sepia</button>
                <button type="button" class="reader-pill-btn ${curMode === 'dark' ? 'active' : ''}" data-mode-btn="dark" onclick="setReaderMode('dark')">🌙 Dark</button>
              </div>
            </div>

            <!-- Font Family -->
            <div class="reader-prefs-row">
              <label class="reader-prefs-label">Font Family</label>
              <div class="reader-prefs-options">
                <button type="button" class="reader-pill-btn ${curFont === 'tamil' ? 'active' : ''}" data-font-btn="tamil" onclick="setReaderFontFamily('tamil')">தமிழ் Mukta</button>
                <button type="button" class="reader-pill-btn ${curFont === 'serif' ? 'active' : ''}" data-font-btn="serif" onclick="setReaderFontFamily('serif')">Garamond Serif</button>
                <button type="button" class="reader-pill-btn ${curFont === 'sans' ? 'active' : ''}" data-font-btn="sans" onclick="setReaderFontFamily('sans')">Clean Sans</button>
                <button type="button" class="reader-pill-btn ${curFont === 'book' ? 'active' : ''}" data-font-btn="book" onclick="setReaderFontFamily('book')">Georgia Book</button>
              </div>
            </div>

            <!-- Line Spacing -->
            <div class="reader-prefs-row">
              <label class="reader-prefs-label">Line Spacing</label>
              <div class="reader-prefs-options">
                <button type="button" class="reader-pill-btn ${curLh === 1.75 ? 'active' : ''}" data-lh-btn="1.75" onclick="setReaderLineHeight(1.75)">Compact</button>
                <button type="button" class="reader-pill-btn ${curLh === 1.95 ? 'active' : ''}" data-lh-btn="1.95" onclick="setReaderLineHeight(1.95)">Relaxed</button>
                <button type="button" class="reader-pill-btn ${curLh === 2.15 ? 'active' : ''}" data-lh-btn="2.15" onclick="setReaderLineHeight(2.15)">Generous</button>
              </div>
            </div>

            <!-- Font Size -->
            <div class="reader-prefs-row">
              <label class="reader-prefs-label">Font Size</label>
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <button type="button" class="reader-pill-btn" onclick="adjustFontSize(-0.08)">A− Smaller</button>
                <button type="button" class="reader-pill-btn" onclick="adjustFontSize(0)">Default</button>
                <button type="button" class="reader-pill-btn" onclick="adjustFontSize(0.08)">A+ Larger</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(drawer);
    }
    if (drawer) {
      drawer.style.display = show ? 'flex' : 'none';
      if (show) drawer.classList.add('open');
      else drawer.classList.remove('open');
    }
  };

  window.toggleChapterJumpModal = (show) => {
    const modal = document.getElementById('chapter-jump-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      if (show) modal.classList.add('open');
      else modal.classList.remove('open');
    }
  };

  window.setReaderFontFamily = (font) => {
    localStorage.setItem('rp_reader_font', font);
    let fontFamilyVal = "var(--font-tamil, 'Mukta Malar', 'Noto Serif Tamil', Georgia, serif)";
    if (font === 'serif') fontFamilyVal = "'Cormorant Garamond', Georgia, serif";
    else if (font === 'sans') fontFamilyVal = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    else if (font === 'book') fontFamilyVal = "Georgia, Cambria, serif";
    applyFontFamily(fontFamilyVal);
    document.querySelectorAll('[data-font-btn]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-font-btn') === font);
    });
  };

  window.setReaderLineHeight = (height) => {
    localStorage.setItem('rp_reader_line_height', height);
    applyLineHeight(height);
    document.querySelectorAll('[data-lh-btn]').forEach(b => {
      b.classList.toggle('active', parseFloat(b.getAttribute('data-lh-btn')) === parseFloat(height));
    });
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

  // ==========================================================================
  // Single Share Button & Rich Social-Media Link Preview Share Modal Engine
  // ==========================================================================
  function extractCurrentContentId() {
    try {
      const hash = window.location.hash || '';
      if (!hash) return '';
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.slice(qIndex + 1));
        return params.get('id') || params.get('slug') || params.get('novel') || params.get('sub') || params.get('category') || '';
      }
      const slashParts = hash.split('/');
      if (slashParts.length > 1) {
        return slashParts[1].split('?')[0];
      }
    } catch {}
    return '';
  }

  window.shareChapter = (type, title, extraMeta = {}) => {
    const meta = typeof title === 'object' ? title : { title, ...extraMeta };
    if (!type || type === 'modal') {
      window.openReaderShareModal(meta);
    } else {
      const contentId = meta.id || meta.slug || extractCurrentContentId();
      const origin = window.location.origin;
      const shareUrl = meta.url || (contentId ? `${origin}/share?id=${encodeURIComponent(contentId)}` : `${origin}/share`);
      window.executeReaderShare(type, meta.title || title, shareUrl);
    }
  };

  window.openReaderShareModal = (options = {}) => {
    const contentId = options.id || options.slug || extractCurrentContentId();
    const origin = window.location.origin;
    const shareUrl = options.url || options.shareUrl || (contentId ? `${origin}/share?id=${encodeURIComponent(contentId)}` : `${origin}/share`);
    const title = options.title || document.title || 'Rudhra Prarthana Novels';
    const description = options.description || 'Explore captivating novels, audio releases, and community discussions by author Rudhra Prarthana.';
    const image = options.image || '/images/logo.png';
    const domain = origin.replace(/^https?:\/\//i, '').split('/')[0] || 'rudhraprarthananovels.com';

    let modal = document.getElementById('reader-share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reader-share-modal';
      modal.className = 'reader-share-modal-backdrop';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    const safeTitle = (title || 'Rudhra Prarthana Novel').replace(/"/g, '&quot;');
    const safeDesc = (description || '').replace(/"/g, '&quot;');
    const safeImage = (image || '/images/logo.png').replace(/"/g, '&quot;');
    const safeUrl = shareUrl.replace(/"/g, '&quot;');
    const safeDomain = domain.replace(/"/g, '&quot;');

    modal.innerHTML = `
      <div class="reader-share-card rp-social-preview-modal-card" onclick="event.stopPropagation()">
        <div class="reader-share-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🔗</span>
            <h3 style="margin:0; font-size:16.5px; font-weight:700; color:var(--reader-heading, #0B1F33);">Share Content</h3>
          </div>
          <button type="button" class="reader-share-close-btn" onclick="window.closeReaderShareModal()" aria-label="Close share dialog">✕</button>
        </div>

        <div class="reader-share-body">
          <!-- Professional Social Media Link Preview Card -->
          <div class="rp-social-share-preview-card" id="rp-share-preview-card" aria-label="Social Link Preview">
            <div class="rp-share-card-header">
              <img src="/images/logo.png" class="rp-share-card-brand-logo" alt="RP Novels" onerror="this.src='/profile.png'">
              <div class="rp-share-card-brand-meta">
                <span class="rp-share-card-brand-name">Rudhra Prarthana Novels</span>
                <span class="rp-share-card-domain">${safeDomain}</span>
              </div>
              <span class="rp-share-preview-badge">Link Preview</span>
            </div>

            <div class="rp-share-card-cover-wrap" id="rp-share-card-cover-wrap">
              <img src="${safeImage}" class="rp-share-card-cover-img" id="rp-share-card-cover-img" alt="${safeTitle}" onerror="this.src='/images/logo.png'">
            </div>

            <div class="rp-share-card-body">
              <h4 class="rp-share-card-title" id="rp-share-card-title">${safeTitle}</h4>
              <p class="rp-share-card-desc" id="rp-share-card-desc">${safeDesc}</p>
              <div class="rp-share-card-url-bar">
                <span class="rp-share-card-url-icon">🌐</span>
                <span class="rp-share-card-url-text" id="rp-share-card-url-text">${safeUrl}</span>
              </div>
            </div>
          </div>

          <!-- Social Media Target Buttons Grid -->
          <div class="reader-share-grid">
            <button type="button" class="reader-share-target-btn whatsapp" onclick="window.executeReaderShare('whatsapp', '${safeTitle}', '${safeUrl}')">
              <span class="share-icon">💬</span>
              <span class="share-name">WhatsApp</span>
            </button>
            <button type="button" class="reader-share-target-btn facebook" onclick="window.executeReaderShare('facebook', '${safeTitle}', '${safeUrl}')">
              <span class="share-icon">📘</span>
              <span class="share-name">Facebook</span>
            </button>
            <button type="button" class="reader-share-target-btn instagram" onclick="window.executeReaderShare('instagram', '${safeTitle}', '${safeUrl}')">
              <span class="share-icon">📷</span>
              <span class="share-name">Instagram</span>
            </button>
            ${navigator.share ? `
              <button type="button" class="reader-share-target-btn native-share" onclick="window.executeReaderShare('native', '${safeTitle}', '${safeUrl}')">
                <span class="share-icon">🌐</span>
                <span class="share-name">More Apps</span>
              </button>
            ` : ''}
          </div>

          <!-- Quick Copy Link Box -->
          <div class="reader-share-copy-box">
            <input type="text" readonly id="reader-share-url-input" value="${safeUrl}" class="reader-share-input" onclick="this.select()">
            <button type="button" class="reader-copy-btn" id="reader-copy-link-btn" onclick="window.executeReaderShare('copy', '${safeTitle}', '${safeUrl}')">
              <span>📋</span> Copy Link
            </button>
          </div>
        </div>
      </div>
    `;

    modal.onclick = (e) => {
      if (e.target === modal) window.closeReaderShareModal();
    };

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('open'));

    // Asynchronously fetch enriched metadata if missing image or short description
    if (contentId && (!options.image || options.image === '/images/logo.png' || !options.description)) {
      fetch(`/api/share?id=${encodeURIComponent(contentId)}&format=json`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.success && data.metadata) {
            const meta = data.metadata;
            const titleEl = document.getElementById('rp-share-card-title');
            const descEl = document.getElementById('rp-share-card-desc');
            const imgEl = document.getElementById('rp-share-card-cover-img');
            const urlEl = document.getElementById('rp-share-card-url-text');
            const inputEl = document.getElementById('reader-share-url-input');

            if (titleEl && meta.rawTitle) titleEl.textContent = meta.rawTitle;
            if (descEl && meta.description) descEl.textContent = meta.description;
            if (imgEl && meta.image) imgEl.src = meta.image;
            if (urlEl && meta.canonicalUrl) urlEl.textContent = meta.canonicalUrl;
            if (inputEl && meta.canonicalUrl) inputEl.value = meta.canonicalUrl;
          }
        })
        .catch(() => {});
    }
  };

  window.closeReaderShareModal = () => {
    const modal = document.getElementById('reader-share-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => {
        if (modal) modal.style.display = 'none';
      }, 200);
    }
  };

  window.executeReaderShare = async (platform, title, url) => {
    const contentId = extractCurrentContentId();
    const origin = window.location.origin;
    const shareUrl = url || (contentId ? `${origin}/share?id=${encodeURIComponent(contentId)}` : `${origin}/share`);
    const shareText = title ? `${title}\n${shareUrl}` : shareUrl;

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
    } else if (platform === 'instagram') {
      if (navigator.share) {
        try {
          await navigator.share({ title, text: shareText, url: shareUrl });
          return;
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('Share error:', e);
        }
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard! 📸 Paste into Instagram story, bio, or message.');
      } catch {
        showToast('Link copied to clipboard! 📋');
      }
    } else if (platform === 'native') {
      if (navigator.share) {
        try {
          await navigator.share({ title, text: shareText, url: shareUrl });
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('Native share error:', e);
        }
      }
    } else if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const copyBtn = document.getElementById('reader-copy-link-btn');
        if (copyBtn) {
          copyBtn.innerHTML = '<span>✅</span> Copied!';
          setTimeout(() => {
            if (copyBtn) copyBtn.innerHTML = '<span>📋</span> Copy Link';
          }, 2000);
        }
        showToast('Link copied to clipboard! 📋 Ready to share.');
      } catch {
        showToast('Link copied to clipboard! 📋');
      }
    }
  };

  // ==========================================================================
  // Reader 7-Emoji Reaction & Like System
  // ==========================================================================
  window.initReaderReactions = async (targetId, targetType = 'content') => {
    if (!targetId) return;
    try {
      const token = localStorage.getItem('rp_auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, { headers });
      const data = await res.json();
      if (data && data.success) {
        window.updateReaderReactionDisplay(data);
      }
    } catch (e) {
      console.warn('[Reader Reactions] Failed to load reactions:', e);
    }
  };

  window.toggleReaderEmojiPopup = (event, forceState) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const popup = document.getElementById('reader-emoji-popup');
    if (!popup) return;

    const isOpen = popup.style.display !== 'none' && popup.classList.contains('open');
    const nextState = forceState !== undefined ? forceState : !isOpen;

    if (nextState) {
      popup.style.display = 'block';
      requestAnimationFrame(() => popup.classList.add('open'));

      const outsideHandler = (e) => {
        if (!popup.contains(e.target) && !e.target.closest('#reader-main-like-btn')) {
          window.toggleReaderEmojiPopup(null, false);
          document.removeEventListener('click', outsideHandler);
          document.removeEventListener('touchstart', outsideHandler);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', outsideHandler);
        document.addEventListener('touchstart', outsideHandler, { passive: true });
      }, 50);
    } else {
      popup.classList.remove('open');
      setTimeout(() => {
        if (!popup.classList.contains('open')) {
          popup.style.display = 'none';
        }
      }, 150);
    }
  };

  window.handleReaderReaction = async (emoji, targetId, targetType = 'content') => {
    const container = document.getElementById('reader-like-container');
    const resolvedId = targetId || (container ? container.getAttribute('data-target-id') : null);
    const resolvedType = targetType || (container ? container.getAttribute('data-target-type') : 'content');

    if (!resolvedId) return;

    const token = localStorage.getItem('rp_auth_token');
    if (!token && !window.IS_LOGGED_IN) {
      window.toggleReaderEmojiPopup(null, false);
      if (typeof window.requireAuthOrRedirect === 'function') {
        window.requireAuthOrRedirect('Please log in to react to this novel ✨', window.location.hash);
      } else {
        showToast('Please log in to react to this novel ✨');
      }
      return;
    }

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetType: resolvedType,
          targetId: String(resolvedId),
          emoji
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save reaction');
      }

      window.updateReaderReactionDisplay(data);
      window.toggleReaderEmojiPopup(null, false);

      if (data.userReaction === emoji) {
        showToast(`Reacted with ${emoji} ${EMOJI_LABELS[emoji] || ''}! ✨`);
      } else {
        showToast('Reaction updated');
      }
    } catch (err) {
      showToast(err.message || 'Error saving reaction');
    }
  };

  window.updateReaderReactionDisplay = (data) => {
    const btn = document.getElementById('reader-main-like-btn');
    const icon = document.getElementById('reader-main-like-icon');
    const label = document.getElementById('reader-main-like-label');
    const count = document.getElementById('reader-main-like-count');
    if (!btn || !icon || !label || !count) return;

    const total = Number(data.total || 0);
    const userReaction = data.userReaction || null;

    if (total > 0) {
      count.textContent = total;
      count.style.display = 'inline-flex';
    } else {
      count.textContent = '0';
      count.style.display = 'none';
    }

    if (userReaction) {
      btn.classList.add('user-reacted');
      icon.textContent = userReaction;
      label.textContent = EMOJI_LABELS[userReaction] || 'Liked';
      btn.setAttribute('data-user-reaction', userReaction);
    } else {
      btn.classList.remove('user-reacted');
      icon.textContent = '👍';
      label.textContent = 'Like';
      btn.removeAttribute('data-user-reaction');
    }

    // Update active highlight on 7 emoji buttons inside popup
    document.querySelectorAll('.reader-emoji-item').forEach(el => {
      const e = el.getAttribute('data-emoji');
      if (e === userReaction) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Synchronize compact Reaction Summary Panel below Like button
    const container = document.getElementById('reader-like-container');
    const targetType = data.targetType || (container ? container.getAttribute('data-target-type') : 'content') || 'content';
    const targetId = data.targetId || (container ? container.getAttribute('data-target-id') : null);
    if (targetId && typeof window.updateReactionSummaryPanel === 'function') {
      window.updateReactionSummaryPanel(targetType, targetId, data);
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

export function applyFontFamily(font) {
  if (!font) return;
  document.documentElement.style.setProperty('--reader-font-family', font);
  const readerPage = document.querySelector('.reader-page');
  if (readerPage) {
    readerPage.style.setProperty('--reader-font-family', font);
  }
}

export function applyLineHeight(height) {
  if (!height) return;
  document.documentElement.style.setProperty('--reader-line-height', height);
  const readerPage = document.querySelector('.reader-page');
  if (readerPage) {
    readerPage.style.setProperty('--reader-line-height', height);
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

  // 4. Tab visibility change
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

if (typeof window !== 'undefined') {
  window.formatAuthorRoleBadge = formatAuthorRoleBadge;
}
