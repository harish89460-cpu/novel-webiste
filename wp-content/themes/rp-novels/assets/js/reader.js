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
    showToast(`அத்தியாயம் ${chNum} புக்மார்க் செய்யப்பட்டது! ✨`);
  };

  window.shareChapter = (type, title) => {
    const url = window.location.href;
    if (type === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' - ' + url)}`, '_blank');
    } else if (type === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (type === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        showToast('இணைப்பு நகலெடுக்கப்பட்டது! 📋');
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
