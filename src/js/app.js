// Main Application Engine & Client Router

import { SITE_DATA } from './data.js';
import { initReader, applyReaderMode, applyFontSize, showToast } from './reader.js';
import { initForum, renderReactionButtons } from './forum.js';
import { initMessaging, updateUnreadMessageBadge } from './messaging.js';
import { initNotifications } from './notifications.js';
import { initSearch } from './search.js';
import { initAuth, updateHeaderUserArea } from './auth.js';
import { t, getLanguage, setLanguage, toggleLanguage, updateLanguageSwitcherUI, updateStaticDOMElements } from './i18n.js';
import { 
  startRouteProgress, 
  finishRouteProgress, 
  renderErrorView, 
  renderNotFound, 
  renderAccessDenied, 
  renderServerError, 
  renderNetworkError, 
  renderChapterError, 
  renderNovelGridSkeleton, 
  renderReaderSkeleton, 
  renderMembersSkeleton, 
  apiFetch 
} from './errors.js';
import { renderReactionsWidget, renderCommentsWidget } from './comments.js';

export function initApp() {
  // Initialize i18n from storage (default English)
  const savedLang = localStorage.getItem('rp_lang') || 'en';
  setLanguage(savedLang);

  // Initialize Subsystems
  initReader();
  initForum();
  initMessaging();
  initNotifications();
  initSearch();
  initAuth();

  // Sticky Header Scroll Effect
  const handleHeaderScroll = () => {
    const header = document.querySelector('.site-header');
    if (header) {
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  };
  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();

  // Mobile Drawer Toggle
  window.toggleMobileDrawer = () => {
    const drawer = document.getElementById('mobile-drawer');
    const btn = document.querySelector('.hamburger-btn');
    if (drawer && btn) {
      const isOpen = drawer.classList.contains('open');
      drawer.classList.toggle('open', !isOpen);
      btn.classList.toggle('active', !isOpen);
    }
  };

  window.closeMobileDrawer = () => {
    const drawer = document.getElementById('mobile-drawer');
    const btn = document.querySelector('.hamburger-btn');
    if (drawer && btn) {
      drawer.classList.remove('open');
      btn.classList.remove('active');
    }
  };

  // Hash-based Routing
  window.addEventListener('hashchange', renderAppView);
  window.renderAppView = renderAppView;

  renderAppView();
  updateHeaderUserArea();
  updateUnreadMessageBadge();

  // Dismiss early loading screen once initial render has mounted
  if (typeof window.dismissInitialLoader === 'function') {
    window.dismissInitialLoader();
  }
}

export async function renderAppView() {
  const hash = window.location.hash || '#home';
  const main = document.getElementById('main-content');
  if (!main) return;

  startRouteProgress();

  // Guarantee reading theme is strictly isolated and never leaks to global body/html
  document.body.classList.remove('mode-sepia', 'mode-dark', 'mode-light');
  document.documentElement.classList.remove('mode-sepia', 'mode-dark', 'mode-light');

  // Scroll to top upon route transition
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update active state in desktop & mobile navs
  updateNavActiveState(hash);

  try {
    if (hash.startsWith('#reader')) {
      await renderReaderView(main, hash);
    } else if (hash.startsWith('#novel?')) {
      renderNovelDetailView(main, hash);
    } else if (hash.startsWith('#novels')) {
      renderNovelLibraryView(main, hash);
    } else if (hash.startsWith('#forum')) {
      renderForumView(main);
    } else if (hash.startsWith('#topic?')) {
      renderTopicView(main, hash);
    } else if (hash.startsWith('#members')) {
      await renderMembersView(main);
    } else if (hash.startsWith('#member?')) {
      await renderMemberProfileView(main, hash);
    } else if (hash.startsWith('#about')) {
      renderAboutView(main);
    } else if (hash.startsWith('#contact')) {
      renderContactView(main);
    } else if (hash.startsWith('#admin')) {
      renderAdminView(main);
    } else if (hash === '#home' || hash === '' || hash === '#') {
      renderHomeView(main);
    } else {
      // 404 Page Not Found for unrecognized routes
      renderNotFound(main);
    }
  } catch (err) {
    console.error('[Route Rendering Error]', hash, err);
    if (err && err.isNetworkError) {
      renderNetworkError(main, () => renderAppView());
    } else if (err && err.status === 403) {
      renderAccessDenied(main, hash);
    } else {
      renderServerError(main, () => renderAppView());
    }
  } finally {
    finishRouteProgress();
    if (typeof window.dismissInitialLoader === 'function') {
      window.dismissInitialLoader();
    }
  }

  // Close mobile drawer on route change
  window.closeMobileDrawer();
}

function updateNavActiveState(hash) {
  const path = hash.split('?')[0];
  document.querySelectorAll('.nav-link, .drawer-nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '#home' && href === '#home')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 1. HOME VIEW
function renderHomeView(container) {
  const isTa = getLanguage() === 'ta';
  const featured = SITE_DATA.novels.filter(n => n.featured);
  const ongoing = SITE_DATA.novels.filter(n => n.status === 'Ongoing');
  const completed = SITE_DATA.novels.filter(n => n.status === 'Completed');
  const trending = [...SITE_DATA.novels].sort((a, b) => a.trendingRank - b.trendingRank).slice(0, 5);

  container.innerHTML = `
    <!-- Hero Section Framed with Desktop/Mobile Parchment Artwork -->
    <section class="hero-section">
      <div class="hero-content-frame">
        <div class="hero-badge">
          <span class="hero-badge-icon">👑</span>
          <span>${t('hero_badge')}</span>
        </div>

        <h1 class="hero-title">
          ${t('hero_brand')}
        </h1>

        <div class="hero-divider">
          <span class="hero-divider-line"></span>
          <span class="hero-divider-glyph">🪶</span>
          <span class="hero-divider-line"></span>
        </div>

        <p class="hero-subtitle">
          ${t('hero_desc')}
        </p>

        <!-- Centered Safe-Zone Search -->
        <div class="hero-search-box" onclick="openSearchModal()">
          <span style="font-size:18px; color:var(--color-gold-warm);">🔍</span>
          <input type="text" class="hero-search-input" placeholder="${t('hero_search_placeholder')}" readonly>
          <button class="btn btn-gold btn-sm">${t('search_all')}</button>
        </div>

        <div class="hero-actions">
          <a href="#novels" class="btn btn-primary btn-lg">
            <span>${t('hero_btn_explore')}</span>
            <span>➔</span>
          </a>
          <a href="#forum" class="btn btn-outline btn-lg" style="background:rgba(255,255,255,0.8);">
            <span>${t('hero_btn_community')}</span>
          </a>
        </div>

        <!-- Literary Stats Strip -->
        <div class="hero-stats-strip">
          <div class="stat-item">
            <span class="stat-number">16+</span>
            <span class="stat-label">${t('hero_stat_novels')}</span>
          </div>
          <div class="stat-divider" style="width:1px; height:28px; background:var(--color-border);"></div>
          <div class="stat-item">
            <span class="stat-number">350K+</span>
            <span class="stat-label">${t('hero_stat_readers')}</span>
          </div>
          <div class="stat-divider" style="width:1px; height:28px; background:var(--color-border);"></div>
          <div class="stat-item">
            <span class="stat-number">20K+</span>
            <span class="stat-label">${t('hero_stat_discussions')}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURED NOVELS -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('ongoing_subtitle')}</span>
            <h2 class="section-title">${t('ongoing_title')}</h2>
          </div>
          <a href="#novels" class="section-link">${t('ongoing_more')} ➔</a>
        </div>

        <div class="novel-grid novel-grid-4">
          ${featured.map(n => renderNovelCard(n)).join('')}
        </div>
      </div>
    </section>

    <!-- ONGOING NOVELS -->
    <section class="section section-bg-alt">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('ongoing_subtitle')}</span>
            <h2 class="section-title">${t('ongoing_title')}</h2>
          </div>
          <a href="#novels?status=ongoing" class="section-link">${t('ongoing_more')} ➔</a>
        </div>

        <div class="novel-grid">
          ${ongoing.map(n => renderNovelCard(n, 'continue')).join('')}
        </div>
      </div>
    </section>

    <!-- AUDIO NOVELS SECTION -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('audio_subtitle')}</span>
            <h2 class="section-title">${t('audio_title')}</h2>
          </div>
          <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="section-more-link" style="color:var(--color-gold-warm); font-weight:600; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
            <span>${t('audio_more')}</span>
          </a>
        </div>

        <div class="novel-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
          ${renderAudioNovelCard()}
        </div>
      </div>
    </section>

    <!-- TRENDING NOVELS (01 - 05) -->
    <section class="section section-bg-alt">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('trending_subtitle')}</span>
            <h2 class="section-title">${t('trending_title')}</h2>
          </div>
        </div>

        <div class="trending-list">
          ${trending.map(n => `
            <div class="trending-item">
              <div class="trending-rank">0${n.trendingRank}</div>
              <img src="${n.cover}" class="trending-thumb" alt="${n.title}">
              <div class="trending-title">${isTa ? n.tamilTitle : n.title}</div>
              <div class="trending-stats">
                <span>👁 ${n.views}</span>
                <span>★ ${n.rating}</span>
              </div>
              <a href="#novel?id=${n.id}" class="btn btn-outline btn-sm" style="margin-top:12px;">${t('btn_read_more')}</a>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- COMPLETED NOVELS -->
    <section class="section">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('completed_subtitle')}</span>
            <h2 class="section-title">${t('completed_title')}</h2>
          </div>
          <a href="#novels?status=completed" class="section-link">${t('completed_more')} ➔</a>
        </div>

        <div class="novel-grid">
          ${completed.map(n => renderNovelCard(n)).join('')}
        </div>
      </div>
    </section>

    <!-- LATEST DISCUSSIONS & COMMUNITY -->
    <section class="section section-bg-alt">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('forum_subtitle')}</span>
            <h2 class="section-title">${t('forum_title')}</h2>
          </div>
          <a href="#forum" class="section-link">${isTa ? 'மன்றத்திற்குச் செல் ➔' : 'Visit Forum ➔'}</a>
        </div>

        <div class="forum-layout" style="grid-template-columns: 1fr;">
          ${SITE_DATA.forumTopics.map(tData => `
            <div class="topic-card">
              <img src="${getAvatarUrl(tData.authorAvatar)}" class="topic-author-avatar" alt="${tData.author}" onerror="this.src='/profile.png'">
              <div class="topic-main-info">
                <a href="#topic?id=${tData.id}" class="topic-title-link">${tData.title}</a>
                <div class="topic-meta-line">
                  ${(tData.authorRole && tData.authorRole !== 'Moderator' && tData.authorRole !== 'Admin') ? `<span class="author-role-badge">${tData.authorRole}</span>` : ''}
                  <span>${tData.author}</span>
                  <span>•</span>
                  <span>${tData.date}</span>
                </div>
              </div>
              <div class="topic-stats-bubble">
                <span>💬 ${tData.repliesCount} ${t('forum_replies')}</span>
                <span>👁 ${tData.views} ${t('forum_views')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- FEATURED AUTHOR SPOTLIGHT -->
    <section class="section">
      <div class="container">
        <div class="author-spotlight">
          <div class="author-photo-wrap">
            <img src="${SITE_DATA.author.avatar}" class="author-photo" alt="${SITE_DATA.author.name}">
            <div class="author-badge">👑 ${t('author_role')}</div>
          </div>
          <div class="author-info">
            <span class="section-subtitle">${t('author_subtitle')}</span>
            <h2 class="author-name">${isTa ? SITE_DATA.author.tamilName : SITE_DATA.author.name}</h2>
            <p class="author-bio">${isTa ? SITE_DATA.author.tamilBio : SITE_DATA.author.bio}</p>
            <div style="display:flex; gap:24px; margin-top:8px;">
              <div><strong>${SITE_DATA.author.publishedCount}</strong> <span style="font-size:12px; color:var(--color-text-muted);">${t('author_novels_count')}</span></div>
              <div><strong>${SITE_DATA.author.readersCount}</strong> <span style="font-size:12px; color:var(--color-text-muted);">${t('author_readers_count')}</span></div>
            </div>
            <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
              <a href="#member?id=rudhra" class="btn btn-gold btn-sm">${t('author_profile_btn')}</a>
              <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Pratilipi</a>
              <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="btn btn-outline btn-sm">YouTube</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- COMMUNITY CTA -->
    <section class="section" style="background:linear-gradient(135deg, var(--color-navy-deep), var(--color-navy-royal)); color:#FFFFFF; text-align:center;">
      <div class="container" style="max-width:760px;">
        <span style="font-size:13px; color:var(--color-gold-light); font-weight:700; text-transform:uppercase; letter-spacing:2px;">${t('community_subtitle')}</span>
        <h2 style="font-family:var(--font-serif); font-size:2.4rem; color:#FFFFFF; margin:12px 0 16px;">${t('community_title')}</h2>
        <p style="color:var(--color-parchment); font-size:1.05rem; line-height:1.7; margin-bottom:28px;">
          ${t('community_desc')}
        </p>
        <button class="btn btn-gold btn-lg" onclick="openAuthModal('register')">${t('community_btn')}</button>
      </div>
    </section>
  `;
}

// 2. NOVEL LIBRARY VIEW
function renderNovelLibraryView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const initialCategory = urlParams.get('category') || 'All';
  const isTa = getLanguage() === 'ta';

  container.innerHTML = `
    <div class="container section">
      <div class="section-header">
        <div class="section-heading-group">
          <span class="section-subtitle">${isTa ? 'நூலகம்' : 'Library'}</span>
          <h1 class="section-title">${t('novels_library_title')}</h1>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="members-filter-bar">
        <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:360px;">
          <input type="text" id="library-search-input" class="form-input" placeholder="${t('novels_search_placeholder')}" 
                 oninput="filterNovelsLibrary()">
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <select id="library-category-select" class="form-input" style="width:auto;" onchange="filterNovelsLibrary()">
            <option value="All" ${initialCategory === 'All' ? 'selected' : ''}>${t('filter_all')}</option>
            <option value="Ongoing Novels" ${initialCategory === 'Ongoing' ? 'selected' : ''}>${t('filter_ongoing')}</option>
            <option value="Completed Novels" ${initialCategory === 'Completed' ? 'selected' : ''}>${t('filter_completed')}</option>
            <option value="Audio Novels" ${initialCategory === 'Audio' ? 'selected' : ''}>${t('filter_audio')}</option>
            <option value="Short Stories" ${initialCategory === 'Short Stories' ? 'selected' : ''}>${isTa ? 'சிறுகதைகள்' : 'Short Stories'}</option>
          </select>

          <select id="library-sort-select" class="form-input" style="width:auto;" onchange="filterNovelsLibrary()">
            <option value="newest">${isTa ? 'புதியவை முதலில்' : 'Newest First'}</option>
            <option value="popular">${isTa ? 'அதிக வாசகர்கள்' : 'Most Popular'}</option>
            <option value="alpha">${isTa ? 'அகரவரிசை (A-Z)' : 'Alphabetical (A-Z)'}</option>
          </select>
        </div>
      </div>

      <!-- Novel Grid Container -->
      <div class="novel-grid" id="library-novel-grid">
        ${SITE_DATA.novels.map(n => renderNovelCard(n)).join('')}
      </div>
    </div>
  `;

  window.filterNovelsLibrary = () => {
    const q = (document.getElementById('library-search-input')?.value || '').toLowerCase();
    const cat = document.getElementById('library-category-select')?.value || 'All';
    const sort = document.getElementById('library-sort-select')?.value || 'newest';

    let list = SITE_DATA.novels.filter(n => {
      const matchQuery = !q || n.title.toLowerCase().includes(q) || n.tamilTitle.toLowerCase().includes(q);
      const matchCat = cat === 'All' || n.category === cat;
      return matchQuery && matchCat;
    });

    if (sort === 'popular') {
      list.sort((a, b) => parseInt(b.views.replace(/,/g, '')) - parseInt(a.views.replace(/,/g, '')));
    } else if (sort === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    const grid = document.getElementById('library-novel-grid');
    if (grid) {
      if (list.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; padding:48px; text-align:center; color:var(--color-text-muted);">${t('novels_empty')}</div>`;
      } else {
        grid.innerHTML = list.map(n => renderNovelCard(n)).join('');
      }
    }
  };
}

// 3. NOVEL DETAIL VIEW
function renderNovelDetailView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const novelId = urlParams.get('id');
  if (!novelId) {
    renderNotFound(container);
    return;
  }

  const novel = SITE_DATA.novels.find(n => n.id === novelId);
  if (!novel) {
    renderNotFound(container);
    return;
  }
  const isTa = getLanguage() === 'ta';

  container.innerHTML = `
    <div class="container section">
      <div class="novel-detail-grid">
        <div class="novel-detail-cover-col">
          <img src="${novel.cover}" style="width:100%; aspect-ratio:2/3; border-radius:var(--radius-lg); object-fit:cover; border:2px solid var(--color-border); box-shadow:var(--shadow-md);" alt="${novel.title}">
          <div style="display:flex; gap:10px;">
            <a href="#reader?novel=${novel.id}&ch=1" class="btn btn-gold" style="flex:1;">${t('novel_start_reading')}</a>
            <button class="btn btn-outline" onclick="bookmarkChapter('${novel.id}', 1)" title="${isTa ? 'புக்மார்க்' : 'Bookmark'}">🔖</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-3);">
          <div style="display:flex; gap:8px;">
            <span class="novel-badge-status badge-${novel.status.toLowerCase()}" style="position:static;">${isTa ? (novel.status === 'Ongoing' ? 'தொடர்கிறது' : 'முழுமை பெற்றது') : novel.status}</span>
            <span class="novel-badge-genre" style="position:static;">${novel.genre}</span>
          </div>

          <h1 style="font-family:var(--font-serif); font-size:2.5rem; color:var(--color-navy-deep);">${isTa ? novel.tamilTitle : novel.title}</h1>

          <div style="font-size:var(--text-sm); color:var(--color-text-muted);">
            ${t('novel_author')}: <strong style="color:var(--color-navy-deep);">${isTa ? novel.author : 'Rudhra Prarthana'}</strong> • 
            ${isTa ? 'பார்வைகள்' : 'Views'}: <strong>${novel.views}</strong> • 
            ${isTa ? 'மதிப்பீடு' : 'Rating'}: <strong>★ ${novel.rating}</strong>
          </div>

          <div style="margin:var(--space-4) 0; padding:var(--space-5); background:var(--color-card-bg); border-left:3px solid var(--color-gold); border-radius:0 var(--radius-md) var(--radius-md) 0; line-height:1.8;">
            <h4 style="font-size:14px; text-transform:uppercase; color:var(--color-gold-warm); margin-bottom:6px;">${t('novel_synopsis')}</h4>
            <p>${novel.description}</p>
          </div>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '${novel.title}')">WhatsApp</button>
            <button class="share-btn facebook" onclick="shareChapter('facebook', '${novel.title}')">Facebook</button>
            <button class="share-btn" onclick="shareChapter('copy', '${novel.title}')">${isTa ? 'இணைப்பை நகலெடு' : 'Copy Link'}</button>
          </div>
        </div>
      </div>

      <!-- CHAPTER LIST -->
      <div class="section-header" style="border-top:1px solid var(--color-border); padding-top:var(--space-8);">
        <div class="section-heading-group">
          <span class="section-subtitle">${t('novel_chapters')}</span>
          <h3 class="section-title">${t('novel_chapters')} (${novel.chapters.length})</h3>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${novel.chapters.map(ch => {
          const isOngoing = novel.status === 'Ongoing';
          const maxCh = Math.max(...novel.chapters.map(c => c.num));
          const isLatest = isOngoing && ch.num === maxCh;

          const badgeHtml = isLatest 
            ? `<span style="font-size:11px; font-weight:700; color:var(--color-gold-warm); background:rgba(200,155,60,0.12); padding:2px 8px; border-radius:var(--radius-sm); margin-left:8px;">✨ ${isTa ? 'இன்றைய புதிய அத்தியாயம்' : 'Daily Update'}</span>`
            : '';

          const buttonHtml = `<a href="#reader?novel=${novel.id}&ch=${ch.num}" class="btn ${isLatest ? 'btn-gold' : 'btn-outline'} btn-sm">${t('btn_read_more')} ➔</a>`;

          return `
          <div class="chapter-list-item">
            <div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-weight:700; color:var(--color-navy-deep); word-break:break-word;">${isTa ? ch.title : `Chapter ${ch.num} — The Awakening`}</span>
                ${badgeHtml}
              </div>
              <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">${ch.date} • ${ch.words} • ${ch.readTime}</div>
            </div>
            ${buttonHtml}
          </div>
          `;
        }).join('')}
      </div>

      <!-- Novel Reactions & Community Discussion -->
      <div id="novel-reactions-widget"></div>
      <div id="novel-comments-widget"></div>
    </div>
  `;

  // Mount novel reactions and comments dynamically
  renderReactionsWidget('novel-reactions-widget', 'novel', novel.id);
  renderCommentsWidget('novel-comments-widget', novel.id, 0);
}

// 4. CHAPTER READING VIEW
async function renderReaderView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const novelId = urlParams.get('novel');
  const chNum = parseInt(urlParams.get('ch') || '1', 10);

  if (!novelId || isNaN(chNum)) {
    renderNotFound(container);
    return;
  }

  const novel = SITE_DATA.novels.find(n => n.id === novelId);
  if (!novel) {
    renderNotFound(container);
    return;
  }

  if (chNum < 1 || chNum > novel.chaptersCount) {
    renderNotFound(container);
    return;
  }

  const chapter = novel.chapters.find(c => c.num === chNum) || { 
    num: chNum, 
    title: `Chapter ${chNum}`, 
    date: 'Today', 
    readTime: '8 mins' 
  };
  const isTa = getLanguage() === 'ta';

  const prevCh = chNum > 1 ? chNum - 1 : null;
  const nextCh = chNum < novel.chaptersCount ? chNum + 1 : null;

  // Show Skeleton Loader while fetching chapter content
  container.innerHTML = renderReaderSkeleton();

  // Check Backend Access Rule with SQLite
  let access = null;
  try {
    const res = await apiFetch(`/api/content/chapter?novel=${encodeURIComponent(novelId)}&ch=${chNum}`);
    if (res.ok) {
      access = await res.json();
    } else if (res.status === 403) {
      renderAccessDenied(container, hash);
      return;
    } else if (res.status === 404) {
      renderNotFound(container);
      return;
    } else {
      renderChapterError(container, novelId, chNum, () => renderReaderView(container, hash));
      return;
    }
  } catch (e) {
    if (e && e.isNetworkError) {
      renderNetworkError(container, () => renderReaderView(container, hash));
      return;
    } else if (e && e.isSessionExpired) {
      renderSessionExpired(container);
      return;
    }

    access = {
      allowed: true,
      content: SITE_DATA.sampleChapterContent
    };
  }

  // If Access is Denied (e.g. for members-only audio stream): Render friendly restriction card
  if (!access || !access.allowed) {
    renderAccessDenied(container, hash);
    return;
  }

  // Access Granted: Render full chapter
  const storyBody = (access.content || SITE_DATA.sampleChapterContent).split('\n\n').map(p => `<p>${p}</p>`).join('');

  const currentMode = localStorage.getItem('rp_reader_mode') || 'light';
  const currentFontSize = parseFloat(localStorage.getItem('rp_font_size') || '1.15');

  container.innerHTML = `
    <!-- Top Progress Track -->
    <div class="reading-progress-track">
      <div class="reading-progress-bar"></div>
    </div>

    <div class="reader-page mode-${currentMode}" data-reader-theme="${currentMode}">
      <!-- Floating Reader Controls Toolbar -->
      <div class="reader-toolbar">
        <div class="reader-toolbar-group">
          <button class="reader-tool-btn" onclick="adjustFontSize(-0.08)" title="Smaller">A−</button>
          <button class="reader-tool-btn reader-tool-btn-reset" onclick="adjustFontSize(0)" title="Reset">Reset</button>
          <button class="reader-tool-btn" onclick="adjustFontSize(0.08)" title="Larger">A+</button>
        </div>

        <div class="reader-toolbar-group">
          <button class="mode-pill mode-pill-light ${currentMode === 'light' ? 'active' : ''}" data-mode="light" onclick="setReaderMode('light')">${t('reader_mode_light')}</button>
          <button class="mode-pill mode-pill-sepia ${currentMode === 'sepia' ? 'active' : ''}" data-mode="sepia" onclick="setReaderMode('sepia')">${t('reader_mode_sepia')}</button>
          <button class="mode-pill mode-pill-dark ${currentMode === 'dark' ? 'active' : ''}" data-mode="dark" onclick="setReaderMode('dark')">${t('reader_mode_dark')}</button>
        </div>
      </div>

      <div class="reader-container">
        <!-- Chapter Header -->
        <div class="reader-header">
          <a href="#novel?id=${novel.id}" class="reader-novel-crumb">« ${isTa ? novel.tamilTitle : novel.title}</a>
          <h1 class="reader-chapter-title">${isTa ? (access.titleTa || chapter.title) : (access.title || `Chapter ${chNum} — Beginning of Memories`)}</h1>
          <div class="reader-meta-bar">
            <span>✍️ ${isTa ? novel.author : 'Rudhra Prarthana'}</span>
            <span>•</span>
            <span>📅 ${chapter.date}</span>
            <span>•</span>
            <span>⏱ ${chapter.readTime}</span>
            <span>•</span>
            <span style="color:var(--color-gold-warm);">🔒 ${isTa ? 'பாதுகாக்கப்பட்ட வாசிப்பு' : 'Protected Reading'}</span>
          </div>
        </div>

        <!-- Chapter Story Content with Anti-Copy Protection -->
        <article class="reader-body reader-body-protected" id="reader-body-content" title="${isTa ? 'உள்ளடக்க நகலெடுப்பு முடக்கப்பட்டுள்ளது' : 'Content copying is restricted'}">
          ${storyBody}
        </article>

        <!-- Decorative Chapter Divider -->
        <div class="chapter-end-ornament">
          <span class="chapter-end-line"></span>
          <span>❦</span>
          <span class="chapter-end-line"></span>
        </div>

        <!-- Chapter Navigation Footbar -->
        <div class="reader-footer-nav">
          <div class="reader-nav-buttons">
            <button class="reader-nav-btn" ${!prevCh ? 'disabled' : ''} 
                    onclick="if(${prevCh}) window.location.hash='#reader?novel=${novel.id}&ch=${prevCh}'">
              ⬅ ${t('reader_prev')}
            </button>

            <a href="#novel?id=${novel.id}" class="reader-nav-btn">
              ☰ ${t('reader_all_chapters')}
            </a>

            <button class="reader-nav-btn" ${!nextCh ? 'disabled' : ''} 
                    onclick="if(${nextCh}) window.location.hash='#reader?novel=${novel.id}&ch=${nextCh}'">
              ${t('reader_next')} ➔
            </button>
          </div>

          <!-- Sharing & Bookmark Bar -->
          <div class="reader-actions-bar">
            <button class="btn btn-gold btn-sm" onclick="bookmarkChapter('${novel.id}', ${chNum})">
              🔖 ${isTa ? 'புக்மார்க் செய்' : 'Bookmark Chapter'}
            </button>

            <div class="reader-share-group">
              <span style="font-size:12px; color:var(--color-text-muted);">${isTa ? 'பகிர்க:' : 'Share:'}</span>
              <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '${chapter.title}')">WhatsApp</button>
              <button class="share-btn facebook" onclick="shareChapter('facebook', '${chapter.title}')">Facebook</button>
              <button class="share-btn" onclick="shareChapter('copy', '${chapter.title}')">${isTa ? 'இணைப்பை நகலெடு' : 'Copy Link'}</button>
            </div>
          </div>
        </div>

        <!-- Chapter Emoji Reactions & Comments Section -->
        <div id="chapter-reactions-widget"></div>
        <div id="chapter-comments-widget"></div>
      </div>
    </div>
  `;

  // Mount chapter reactions and comments dynamically
  renderReactionsWidget('chapter-reactions-widget', 'content', `novel:${novel.id}:ch:${chNum}`);
  renderCommentsWidget('chapter-comments-widget', novel.id, chNum);

  // Apply saved reader theme & font size to current novel reading view
  applyReaderMode(currentMode);
  applyFontSize(currentFontSize);

  // Attach Content Protection strictly to the novel reading content area
  const readerContent = document.getElementById('reader-body-content');
  if (readerContent) {
    const handleBlockedCopy = (e) => {
      e.preventDefault();
      showToast(isTa ? 'உள்ளடக்க நகலெடுப்பு முடக்கப்பட்டுள்ளது. 🔒' : 'Content copying is restricted. 🔒');
    };
    readerContent.addEventListener('copy', handleBlockedCopy);
    readerContent.addEventListener('cut', handleBlockedCopy);
    readerContent.addEventListener('contextmenu', handleBlockedCopy);
    readerContent.addEventListener('selectstart', (e) => e.preventDefault());

    // Prevent keyboard shortcuts (Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+U, Cmd+C, Cmd+A, etc.) inside story text
    readerContent.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'C', 'x', 'X', 'a', 'A', 'u', 'U'].includes(e.key)) {
        handleBlockedCopy(e);
      }
    });
  }
}

// 5. FORUM COMMUNITY VIEW (wpForo Integrated)
function renderForumView(container) {
  const isTa = getLanguage() === 'ta';

  container.innerHTML = `
    <div class="container forum-page">
      <div class="forum-header-bar">
        <div>
          <span class="section-subtitle">${t('forum_subtitle')}</span>
          <h1 class="section-title">${t('forum_title')}</h1>
        </div>

        <div class="forum-stats-summary">
          <span>${isTa ? 'பிரிவுகள்' : 'Categories'}: <strong>${SITE_DATA.forumCategories.length}</strong></span>
          <span>${isTa ? 'விவாதங்கள்' : 'Topics'}: <strong>926</strong></span>
          <span>${isTa ? 'பதிவுகள்' : 'Posts'}: <strong>24,180</strong></span>
        </div>
      </div>

      <div class="forum-layout">
        <!-- Forum Categories List -->
        <div class="forum-categories-list">
          ${SITE_DATA.forumCategories.map(cat => `
            <div class="forum-category-card" onclick="window.location.hash = '#topic?id=topic-nenjam-24';">
              <div class="category-icon-box">${cat.icon}</div>
              <div class="category-meta-info">
                <div class="category-title">${isTa ? cat.tamilTitle : cat.title}</div>
                <div class="category-desc">${isTa ? cat.tamilDesc : cat.desc}</div>
                <div style="font-size:11px; color:var(--color-gold-warm); margin-top:4px;">
                  ${isTa ? 'சமீபத்தியது:' : 'Latest:'} ${cat.latest}
                </div>
              </div>
              <div class="category-stats-col">
                <div><strong>${cat.topicsCount}</strong> ${t('forum_topics')}</div>
                <div><strong>${cat.postsCount}</strong> ${t('forum_replies')}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Sidebar Widgets -->
        <aside class="forum-sidebar">
          <div class="forum-widget">
            <h3 class="widget-title">${isTa ? 'மன்றத்தில் தேடுக' : 'Search Forum'}</h3>
            <div class="hero-search-box" style="margin-bottom:0;" onclick="openSearchModal()">
              <span>🔍</span>
              <input type="text" class="hero-search-input" placeholder="${isTa ? 'விவாதங்களைத் தேடுங்கள்...' : 'Search discussions...'}" readonly>
            </div>
          </div>

          <div class="forum-widget">
            <h3 class="widget-title">${isTa ? 'அண்மைய விவாதங்கள்' : 'Recent Discussions'}</h3>
            <div class="widget-item-list">
              <div class="widget-item">
                <span>💬</span>
                <div>
                  <a href="#topic?id=topic-nenjam-24" style="font-weight:600; color:var(--color-navy-deep);">${isTa ? 'நெஞ்சம் மறப்பதில்லை அத்தியாயம் 24 கருத்து திரி' : 'Nenjam Marappadhillai Chapter 24 Discussion'}</a>
                  <div style="font-size:10px; color:var(--color-text-muted);">${isTa ? 'ருத்ரா பிரார்த்தனா' : 'Rudhra Prarthana'} • 3 ${t('forum_replies')}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="forum-widget">
            <h3 class="widget-title">${isTa ? 'உறுப்பினர்கள்' : 'Active Members'}</h3>
            <div id="forum-active-members-list" style="display:flex; flex-wrap:wrap; gap:8px;">
              <!-- Dynamic genuine registered members -->
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Dynamically load genuine members from local DB
  (async () => {
    try {
      const token = localStorage.getItem('rp_auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/members', { headers });
      if (res.ok) {
        const data = await res.json();
        const sideEl = document.getElementById('forum-active-members-list');
        if (sideEl && Array.isArray(data.members)) {
          SITE_DATA.members = data.members;
          if (data.members.length === 0) {
            sideEl.innerHTML = `<span style="font-size:12px; color:var(--color-text-muted);">${isTa ? 'உறுப்பினர்கள் இல்லை' : 'No members yet'}</span>`;
          } else {
            sideEl.innerHTML = data.members.map(m => {
              const mName = isTa && m.displayNameTa ? m.displayNameTa : (m.displayName || m.username);
              const dot = (!m.statusHidden && m.isOnline) 
                ? `<span class="status-dot green" style="position:absolute; bottom:0; right:0; width:9px; height:9px; border:2px solid #fff;"></span>` 
                : '';
              const mAvatar = getAvatarUrl(m.avatar);
              return `
                <a href="#member?id=${encodeURIComponent(m.username || m.id)}" title="${mName}" style="position:relative; display:inline-block;">
                  <img src="${mAvatar}" style="width:34px; height:34px; border-radius:var(--radius-full); border:2px solid var(--color-gold-light); object-fit:cover;" alt="${mName}" onerror="this.src='/profile.png'">
                  ${dot}
                </a>
              `;
            }).join('');
          }
        }
      }
    } catch {}
  })();
}

// 6. TOPIC THREAD VIEW
function renderTopicView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const topicId = urlParams.get('id');
  if (!topicId) {
    renderNotFound(container);
    return;
  }

  const topic = SITE_DATA.forumTopics.find(tData => tData.id === topicId);
  if (!topic) {
    renderNotFound(container);
    return;
  }
  const isTa = getLanguage() === 'ta';

  window.renderTopicView = () => renderTopicView(container, hash);

  container.innerHTML = `
    <div class="container section">
      <div style="margin-bottom:var(--space-6);">
        <a href="#forum" class="section-link">⬅ ${t('forum_title')}</a>
        <h1 style="font-family:var(--font-serif); font-size:2.2rem; color:var(--color-navy-deep); margin-top:8px;">${topic.title}</h1>
        <div style="font-size:12px; color:var(--color-text-muted); display:flex; gap:16px; margin-top:4px; flex-wrap:wrap;">
          <span>${isTa ? 'பிரிவு' : 'Category'}: <strong>${topic.categoryTitle}</strong></span>
          <span>${isTa ? 'ஆரம்பித்தவர்' : 'Started by'}: <strong>${isTa && topic.authorTa ? topic.authorTa : topic.author}</strong></span>
          <span>${isTa ? 'பார்வைகள்' : 'Views'}: <strong>${topic.views}</strong></span>
          <span>${isTa ? 'மறுமொழிகள்' : 'Replies'}: <strong>${topic.repliesCount}</strong></span>
        </div>
      </div>

      <!-- Posts Stream -->
      <div style="display:flex; flex-direction:column;">
        ${topic.posts.map(post => {
          const postAuthor = isTa && post.authorTa ? post.authorTa : post.author;
          const isModOrAdmin = post.role === 'Admin' || post.role === 'Moderator';
          const postRoleLabel = isTa 
            ? (post.role === 'Author' ? 'எழுத்தாளர்' : 'உறுப்பினர்')
            : post.role;
          const roleBadgeHtml = isModOrAdmin 
            ? '' 
            : `<span class="author-role-badge role-${post.role.toLowerCase()}">${postRoleLabel}</span>`;
          const postAvatar = getAvatarUrl(post.avatar);
          return `
          <div class="topic-post-card">
            <div class="post-header">
              <div class="post-author-box">
                <img src="${postAvatar}" style="width:44px; height:44px; border-radius:var(--radius-full); object-fit:cover; border:2px solid var(--color-gold-light);" alt="${postAuthor}" onerror="this.src='/profile.png'">
                <div>
                  <div class="post-author-name">${postAuthor}</div>
                  ${roleBadgeHtml}
                </div>
              </div>
              <div style="font-size:11px; color:var(--color-text-muted);">${post.date}</div>
            </div>

            <div class="post-content-body">${post.content}</div>

            <div class="post-actions-bar">
              <div class="reaction-group" id="reactions-${post.id}">
                ${renderReactionButtons(topic.id, post)}
              </div>

              <div class="post-reply-actions">
                <button class="btn btn-outline btn-sm" onclick="quotePost('${postAuthor}', '${escapeQuotes(post.content)}')">
                  ${isTa ? 'மேற்கோள்' : 'Quote'}
                </button>
              </div>
            </div>
          </div>
        `}).join('')}
      </div>

      <!-- Reply Box -->
      <div class="topic-post-card" style="border:2px solid var(--color-border); background:var(--color-card-bg);">
        <h3 style="font-family:var(--font-serif); font-size:1.3rem; margin-bottom:12px; color:var(--color-navy-deep);">${isTa ? 'உங்கள் பதிலை எழுதுங்கள்' : 'Leave a Reply'}</h3>
        <textarea id="topic-reply-input" class="form-input" rows="4" placeholder="${t('forum_reply_placeholder')}"></textarea>
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          <button class="btn btn-gold" onclick="submitForumReply('${topic.id}')">${t('forum_reply_btn')}</button>
        </div>
      </div>
    </div>
  `;
}

function formatLastSeen(isoStr, isTa) {
  if (!isoStr) return isTa ? 'ஆஃப்லைன்' : 'Offline';
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return isTa ? 'சற்றுமுன்' : 'Just now';
    if (diffMins < 60) return isTa ? `${diffMins} நிமிடம் முன்` : `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return isTa ? `${diffHours} மணிநேரம் முன்` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return isTa ? `${diffDays} நாள் முன்` : `${diffDays}d ago`;
  } catch {
    return isTa ? 'ஆஃப்லைன்' : 'Offline';
  }
}

export function getAvatarUrl(avatar) {
  if (!avatar || typeof avatar !== 'string') return '/profile.png';
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'remove') return '/profile.png';
  if (trimmed.includes('images.unsplash.com') || trimmed.includes('ui-avatars.com')) {
    return '/profile.png';
  }
  return trimmed;
}

// 7. MEMBERS DIRECTORY VIEW
async function renderMembersView(container) {
  const isTa = getLanguage() === 'ta';
  let membersList = SITE_DATA.members || [];

  if (membersList.length === 0) {
    container.innerHTML = `
      <div class="container members-page">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${t('members_subtitle')}</span>
            <h1 class="section-title">${t('members_title')}</h1>
          </div>
        </div>
        ${renderMembersSkeleton(6)}
      </div>
    `;
  }

  try {
    const res = await apiFetch('/api/members');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.members)) {
        membersList = data.members;
        SITE_DATA.members = data.members;
      }
    }
  } catch (e) {
    if (e && e.isNetworkError && membersList.length === 0) {
      renderNetworkError(container, () => renderMembersView(container));
      return;
    }
    console.warn('Using local members cache', e);
  }

  container.innerHTML = `
    <div class="container members-page">
      <div class="section-header">
        <div class="section-heading-group">
          <span class="section-subtitle">${t('members_subtitle')}</span>
          <h1 class="section-title">${t('members_title')}</h1>
        </div>
      </div>

      <div class="members-grid">
        ${membersList.length === 0 ? `
          <div class="text-center" style="grid-column: 1 / -1; padding: 48px; background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--color-border);">
            <div style="font-size: 40px; margin-bottom: 12px;">👥</div>
            <h3 style="color: var(--color-navy-deep); margin-bottom: 8px;">${isTa ? 'உறுப்பினர்கள் எவரும் இல்லை' : 'No Members Found'}</h3>
            <p style="color: var(--color-text-muted);">${isTa ? 'பதிவுசெய்த வாசகர்கள் மட்டுமே இங்கு தோன்றுவார்கள்.' : 'Only registered users will appear in this directory.'}</p>
          </div>
        ` : membersList.map(m => {
          const mName = isTa && m.displayNameTa ? m.displayNameTa : (m.displayName || (isTa && m.nameTa ? m.nameTa : (m.name || m.username)));
          const isModOrAdminMember = m.role === 'Admin' || m.role === 'Moderator' || (m.title && (m.title.includes('Moderator') || m.title.includes('Admin')));
          const mTitle = isModOrAdminMember ? (isTa ? 'செயலில் உள்ள வாசகர்' : 'Active Contributor') : (isTa && (m.titleTa || m.title_ta) ? (m.titleTa || m.title_ta) : (m.title || 'Member'));
          const mAvatar = getAvatarUrl(m.avatar);
          
          let statusBadge = '';
          let avatarDot = '';
          if (!m.statusHidden) {
            if (m.isOnline) {
              statusBadge = `<div class="status-indicator online"><span class="status-dot green"></span> ${isTa ? 'இணையத்தில்' : 'Online'}</div>`;
              avatarDot = `<span class="status-dot green" style="position:absolute; bottom:2px; right:2px; border:2px solid #FFFFFF;"></span>`;
            } else if (m.lastSeen) {
              statusBadge = `<div class="status-indicator offline">⏱ ${isTa ? 'கடைசியாக பார்த்தது' : 'Last seen'}: ${formatLastSeen(m.lastSeen, isTa)}</div>`;
            } else {
              statusBadge = `<div class="status-indicator offline"><span class="status-dot" style="background:#94a3b8;"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</div>`;
            }
          }

          return `
          <div class="member-card">
            <div style="position:relative; display:inline-block; margin:0 auto 12px;">
              <img src="${mAvatar}" class="member-avatar" style="margin-bottom:0;" alt="${mName}" onerror="this.src='/profile.png'">
              ${avatarDot}
            </div>
            <h3 class="member-name">${mName}</h3>
            <span class="member-role-title">${mTitle}</span>
            <div style="min-height:24px; margin-bottom:12px; display:flex; justify-content:center;">
              ${statusBadge}
            </div>
            <div class="member-stats-row">
              <div class="member-stat-box">
                <span class="member-stat-val">${m.postsCount ?? 0}</span>
                <span class="member-stat-lbl">${isTa ? 'பதிவுகள்' : 'Posts'}</span>
              </div>
              <div class="member-stat-box">
                <span class="member-stat-val">${m.topicsCount ?? 0}</span>
                <span class="member-stat-lbl">${isTa ? 'தலைப்புகள்' : 'Topics'}</span>
              </div>
              <div class="member-stat-box">
                <span class="member-stat-val">${m.followersCount ?? 0}</span>
                <span class="member-stat-lbl">${isTa ? 'பின்தொடர்பவர்கள்' : 'Followers'}</span>
              </div>
            </div>
            <div style="display:flex; gap:8px; width:100%;">
              <a href="#member?id=${encodeURIComponent(m.username || m.id)}" class="btn btn-outline btn-sm" style="flex:1;">${t('members_view_profile')}</a>
              <button class="btn btn-gold btn-sm" onclick="openMessagesDrawer('t1');">${t('members_send_message')}</button>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

// 8. MEMBER PROFILE VIEW WITH USER-CONTROLLED EDITING & PROFILE PICTURE UPLOAD
async function renderMemberProfileView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const memberParam = urlParams.get('id') || (window.CURRENT_USER ? window.CURRENT_USER.username : 'rudhra_author');
  const isTa = getLanguage() === 'ta';

  let member = null;
  if (window.CURRENT_USER && (memberParam === 'me' || memberParam === window.CURRENT_USER.username || String(memberParam) === String(window.CURRENT_USER.id))) {
    member = window.CURRENT_USER;
  } else if (SITE_DATA.members && SITE_DATA.members.length > 0) {
    member = SITE_DATA.members.find(m => m.id === memberParam || m.username === memberParam || String(m.id) === String(memberParam));
  }

  try {
    const res = await apiFetch('/api/members');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.members)) {
        SITE_DATA.members = data.members;
        const found = data.members.find(m => m.id === memberParam || m.username === memberParam || String(m.id) === String(memberParam));
        if (found) {
          member = found;
        } else if (memberParam === 'me' && window.CURRENT_USER) {
          member = data.members.find(m => m.id === window.CURRENT_USER.id || m.username === window.CURRENT_USER.username) || window.CURRENT_USER;
        }
      }
    }
  } catch (e) {
    console.warn('Using local member cache', e);
  }

  // If member not found, render 404 page
  if (!member) {
    renderNotFound(container);
    return;
  }


  const isCurrentUser = Boolean(window.IS_LOGGED_IN && window.CURRENT_USER && (
    String(window.CURRENT_USER.id) === String(member.id) ||
    window.CURRENT_USER.username === member.username ||
    memberParam === 'me'
  ));

  const mName = isTa && (member.displayNameTa || member.nameTa) ? (member.displayNameTa || member.nameTa) : (member.displayName || member.name || member.username);
  const isModOrAdminMember = member.role === 'Admin' || member.role === 'Moderator' || (member.title && (member.title.includes('Moderator') || member.title.includes('Admin')));
  const mTitle = isModOrAdminMember ? (isTa ? 'செயலில் உள்ள வாசகர்' : 'Active Contributor') : (isTa && (member.titleTa || member.title_ta) ? (member.titleTa || member.title_ta) : (member.title || 'Member'));
  const mBio = isTa && (member.bioTa || member.bio_ta) ? (member.bioTa || member.bio_ta) : (member.bio || (isTa ? 'சுய குறிப்பு சேர்க்கப்படவில்லை.' : 'No bio added yet.'));
  const joinedDate = member.joinedDate || member.joined || 'Jan 2024';
  const roleTagDisplay = isModOrAdminMember 
    ? `${isTa ? 'இணைந்தது' : 'Joined'}: ${joinedDate}`
    : `${mTitle} • ${isTa ? 'இணைந்தது' : 'Joined'}: ${joinedDate}`;

  // Activity Status & Privacy Display
  let statusBadgeHtml = '';
  if (isCurrentUser) {
    const isActEnabled = window.CURRENT_USER?.activityStatusEnabled ?? (member.activityStatusEnabled ?? true);
    statusBadgeHtml = `
      <div class="activity-status-card" style="margin-top:16px; padding:14px 18px; background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:space-between; box-shadow:var(--shadow-sm);">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:22px;">🟢</div>
          <div>
            <div style="font-weight:700; color:var(--color-navy-deep); font-size:14px; display:flex; align-items:center; gap:8px;">
              <span>${isTa ? 'செயல்பாடு நிலை (Activity Status)' : 'Activity Status'}</span>
              <span id="activity-status-label" style="font-size:11px; font-weight:700; color:${isActEnabled ? '#10B981' : 'var(--color-text-muted)'}; background:${isActEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.06)'}; padding:2px 8px; border-radius:12px;">
                ${isActEnabled ? (isTa ? 'செயலில்' : 'Enabled') : (isTa ? 'மறைக்கப்பட்டது' : 'Hidden')}
              </span>
            </div>
            <p style="font-size:12px; color:var(--color-text-muted); margin-top:2px; margin-bottom:0;">
              ${isTa ? 'இயக்கப்பட்டால், வாசகர்கள் நீங்கள் ஆன்லைனில் இருப்பதையும் (பச்சை புள்ளி) கடைசி வருகை நேரத்தையும் காணலாம்.' : 'When enabled, friends can see a green dot when you are online and your last-seen time when offline.'}
            </p>
          </div>
        </div>
        <label class="switch" style="flex-shrink:0;">
          <input type="checkbox" id="profile-activity-toggle" ${isActEnabled ? 'checked' : ''} onchange="toggleActivityStatus(this.checked)">
          <span class="slider round"></span>
        </label>
      </div>
    `;
  } else {
    if (!member.statusHidden) {
      if (member.isOnline) {
        statusBadgeHtml = `<div class="status-indicator online" style="margin-top:8px; display:inline-flex;"><span class="status-dot green"></span> ${isTa ? 'இணையத்தில் உள்ளார்' : 'Online Now'}</div>`;
      } else if (member.lastSeen) {
        statusBadgeHtml = `<div class="status-indicator offline" style="margin-top:8px; display:inline-flex;">⏱ ${isTa ? 'கடைசியாக பார்த்தது' : 'Last seen'}: ${formatLastSeen(member.lastSeen, isTa)}</div>`;
      } else {
        statusBadgeHtml = `<div class="status-indicator offline" style="margin-top:8px; display:inline-flex;"><span class="status-dot" style="background:#94a3b8;"></span> ${isTa ? 'ஆஃப்லைன்' : 'Offline'}</div>`;
      }
    }
  }

  const avatarDot = (!member.statusHidden && member.isOnline) 
    ? `<span class="status-dot green" style="position:absolute; bottom:6px; right:6px; width:14px; height:14px; border:3px solid #FFFFFF;"></span>` 
    : '';

  const mAvatar = getAvatarUrl(member.avatar);

  // Setup Global profile editing and photo upload state
  window._pendingAvatarAction = undefined;

  window.toggleProfileEditCard = () => {
    const card = document.getElementById('edit-profile-card');
    if (card) {
      const isHidden = card.style.display === 'none';
      card.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  window.handleProfileFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast(isTa ? 'JPG, PNG, WEBP மற்றும் GIF படங்கள் மட்டுமே அனுமதிக்கப்படுகின்றன.' : 'Only JPG, PNG, WEBP, and GIF images are allowed.');
      event.target.value = '';
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(isTa ? 'படத்தின் அளவு 2MB-க்கு குறைவாக இருக்க வேண்டும்.' : 'Image size must be less than 2MB.');
      event.target.value = '';
      return;
    }

    // Immediate preview using FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const preview = document.getElementById('edit-avatar-preview');
      if (preview) preview.src = dataUrl;
      window._pendingAvatarAction = dataUrl;
      showToast(isTa ? 'முன்னோட்டம் தயாராக உள்ளது! சேமிக்க கீழே உள்ள பொத்தானை அழுத்தவும்.' : 'Preview ready! Click Save Changes to apply.');
    };
    reader.onerror = () => {
      showToast(isTa ? 'படத்தைப் படிக்க முடியவில்லை.' : 'Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  window.handleRemoveProfileAvatar = () => {
    const preview = document.getElementById('edit-avatar-preview');
    if (preview) preview.src = '/profile.png';
    const fileInput = document.getElementById('edit-avatar-file-input');
    if (fileInput) fileInput.value = '';
    window._pendingAvatarAction = 'remove';
    showToast(isTa ? 'புகைப்படம் நீக்கப்பட்டது. இயல்புநிலை படம் தேர்ந்தெடுக்கப்பட்டது.' : 'Photo removed. Default avatar selected.');
  };

  window.handleSaveProfile = async () => {
    const displayName = document.getElementById('edit-display-name')?.value?.trim();
    const username = document.getElementById('edit-username')?.value?.trim();
    const bio = document.getElementById('edit-bio')?.value?.trim();

    if (!displayName || !username) {
      showToast(isTa ? 'காட்சிப் பெயர் மற்றும் பயனர்பெயர் தேவை.' : 'Display name and username are required.');
      return;
    }

    const btn = document.getElementById('save-profile-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = isTa ? 'சேமிக்கிறது...' : 'Saving...';
    }

    const payload = { displayName, username, bio };
    if (window._pendingAvatarAction !== undefined) {
      payload.avatar = window._pendingAvatarAction;
    }

    const result = await window.updateProfile(payload);
    if (result.success) {
      window._pendingAvatarAction = undefined;
      if (window.location.hash.includes('#member')) {
        window.location.hash = `#member?id=${encodeURIComponent(username)}`;
      }
      if (window.renderAppView) window.renderAppView();
    } else {
      if (btn) {
        btn.disabled = false;
        btn.textContent = `💾 ${isTa ? 'சேமிக்கவும்' : 'Save Changes'}`;
      }
    }
  };

  container.innerHTML = `
    <div class="container section">
      <div class="profile-hero">
        <div class="profile-avatar-wrap">
          <div style="position:relative; display:inline-block;">
            <img src="${mAvatar}" class="profile-large-avatar" alt="${mName}" onerror="this.src='/profile.png'">
            ${avatarDot}
          </div>
          <div class="profile-identity">
            <h1 class="profile-display-name">${mName}</h1>
            <span class="profile-role-tag">${roleTagDisplay}</span>
            ${!isCurrentUser ? statusBadgeHtml : ''}
          </div>
        </div>
      </div>

      ${isCurrentUser ? statusBadgeHtml : ''}

      <!-- Action Buttons Bar -->
      <div style="display:flex; justify-content:flex-end; gap:12px; margin:24px 0; flex-wrap:wrap;">
        ${isCurrentUser ? `
          <button class="btn btn-gold" onclick="toggleProfileEditCard()">
            ✏️ ${isTa ? 'சுயவிவரத்தைத் திருத்து' : 'Edit Profile'}
          </button>
        ` : `
          <button class="btn btn-gold" onclick="openMessagesDrawer('t1')">✉️ ${t('members_send_message')}</button>
          <button class="btn btn-outline" onclick="showToast('${isTa ? 'பின்தொடரத் தொடங்கினீர்கள்!' : 'Following member!'}')">➕ ${isTa ? 'பின்தொடர்' : 'Follow'}</button>
        `}
      </div>

      <!-- User-Controlled Profile Edit Card (Collapsible) -->
      ${isCurrentUser ? `
        <div id="edit-profile-card" style="display:none; background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-6); margin: 20px 0; box-shadow: var(--shadow-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--color-border-light); padding-bottom:12px;">
            <h3 style="margin:0; font-family:var(--font-serif); color:var(--color-navy-deep); font-size:1.3rem;">
              ✏️ ${isTa ? 'சுயவிவர அமைப்புகள்' : 'Edit Your Profile'}
            </h3>
            <button class="action-btn" onclick="toggleProfileEditCard()" style="border:none; background:transparent; font-size:18px; cursor:pointer;" title="Close">✕</button>
          </div>
          
          <form id="profile-edit-form" onsubmit="event.preventDefault(); window.handleSaveProfile();">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:16px;">
              <div class="form-group">
                <label class="form-label">${isTa ? 'காட்சிப் பெயர் (Display Name)' : 'Display Name'} <span style="color:#EF4444;">*</span></label>
                <input type="text" id="edit-display-name" class="form-input" value="${member.displayName || member.username || ''}" required>
              </div>
              <div class="form-group">
                <label class="form-label">${isTa ? 'பயனர்பெயர் (Username)' : 'Username'} <span style="color:#EF4444;">*</span></label>
                <input type="text" id="edit-username" class="form-input" value="${member.username || ''}" required pattern="[a-zA-Z0-9_]{3,20}">
                <small style="color:var(--color-text-muted); font-size:11px;">${isTa ? '3-20 எழுத்துக்கள், எண்கள் அல்லது _' : '3-20 characters, numbers or _'}</small>
              </div>
            </div>

            <!-- Profile Picture Upload, Preview, and Removal -->
            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label">${isTa ? 'சுயவிவரப் படம் (Profile Picture)' : 'Profile Picture'}</label>
              <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; background:rgba(0,0,0,0.02); padding:16px; border-radius:var(--radius-md); border:1px dashed var(--color-border);">
                <img id="edit-avatar-preview" src="${mAvatar}" style="width:72px; height:72px; border-radius:var(--radius-full); object-fit:cover; border:3px solid var(--color-gold-warm); box-shadow:var(--shadow-sm); flex-shrink:0;" onerror="this.src='/profile.png'">
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <input type="file" id="edit-avatar-file-input" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" style="display:none;" onchange="window.handleProfileFileChange(event)">
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('edit-avatar-file-input').click()">
                      📷 ${isTa ? 'புகைப்படம் பதிவேற்றவும்' : 'Upload Photo'}
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" id="btn-remove-avatar" onclick="window.handleRemoveProfileAvatar()" style="color:#DC2626; border-color:#FECACA;">
                      🗑️ ${isTa ? 'புகைப்படத்தை நீக்கு' : 'Remove Photo'}
                    </button>
                  </div>
                  <small style="color:var(--color-text-muted); font-size:11px;">
                    ${isTa ? 'JPG, PNG, WEBP அல்லது GIF (அதிகபட்சம் 2MB)' : 'JPG, PNG, WEBP or GIF (Max 2MB)'}
                  </small>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">${isTa ? 'சுய குறிப்பு (Bio)' : 'About / Bio'}</label>
              <textarea id="edit-bio" class="form-input" rows="3" placeholder="${isTa ? 'உங்களைப் பற்றி சில வரிகள்...' : 'Write a few lines about yourself...'}">${member.bio || ''}</textarea>
            </div>

            <div style="display:flex; gap:12px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline" onclick="toggleProfileEditCard()">${isTa ? 'ரத்துசெய்' : 'Cancel'}</button>
              <button type="submit" id="save-profile-btn" class="btn btn-gold">💾 ${isTa ? 'சேமிக்கவும்' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      ` : ''}

      <div class="profile-tabs-nav">
        <div class="profile-tab-btn active">${isTa ? 'சுயவிவரம்' : 'Overview'}</div>
        <div class="profile-tab-btn" onclick="showToast('${isTa ? 'பதிவுகள் ஏற்றப்படுகின்றன...' : 'Loading posts...'}')">${t('forum_topics')} (${member.topicsCount ?? 0})</div>
        <div class="profile-tab-btn" onclick="showToast('${isTa ? 'புக்மார்க்குகள் ஏற்றப்படுகின்றன...' : 'Loading bookmarks...'}')">${isTa ? 'புக்மார்க்குகள்' : 'Bookmarks'}</div>
      </div>

      <div class="novel-card-body" style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-6);">
        <h3 style="font-family:var(--font-serif); font-size:1.4rem; color:var(--color-navy-deep); margin-bottom:8px;">${isTa ? 'சுய குறிப்பு' : 'About Me'}</h3>
        <p style="font-size:15px; line-height:1.8;">${mBio}</p>

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border-light); display:flex; gap:32px;">
          <div><strong>${member.postsCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">${isTa ? 'மன்ற மறுமொழிகள்' : 'Forum Replies'}</span></div>
          <div><strong>${member.topicsCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">${isTa ? 'துவக்கிய தலைப்புகள்' : 'Created Topics'}</span></div>
          <div><strong>${member.followersCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">${isTa ? 'வாசகர்கள்' : 'Readers'}</span></div>
        </div>
      </div>
    </div>
  `;
}

// 9. ABOUT VIEW (Fallback route)
function renderAboutView(container) {
  const isTa = getLanguage() === 'ta';
  container.innerHTML = `
    <div class="container section" style="max-width:880px;">
      <span class="section-subtitle">${isTa ? 'எங்களைப்பற்றி' : 'About Us'}</span>
      <h1 class="section-title" style="margin-bottom:var(--space-6);">Rudhra Prarthana Novels</h1>
      
      <div style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-xl); padding:var(--space-8); line-height:1.9; font-size:16px;">
        <p>${t('footer_desc')}</p>
        <div style="text-align:center; margin-top:32px;">
          <a href="#novels" class="btn btn-gold btn-lg">${t('hero_btn_explore')} ➔</a>
        </div>
      </div>
    </div>
  `;
}

// 10. CONTACT VIEW
function renderContactView(container) {
  const isTa = getLanguage() === 'ta';
  container.innerHTML = `
    <div class="container section" style="max-width:760px;">
      <span class="section-subtitle">${t('nav_contact')}</span>
      <h1 class="section-title" style="margin-bottom:var(--space-6);">${t('contact_title')}</h1>

      <div style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-xl); padding:var(--space-8);">
        <form onsubmit="event.preventDefault(); showToast('${t('contact_success')}');">
          <div class="form-group">
            <label class="form-label">${t('contact_name')}</label>
            <input type="text" class="form-input" required placeholder="${t('contact_name')}">
          </div>
          <div class="form-group">
            <label class="form-label">${t('contact_email')}</label>
            <input type="email" class="form-input" required placeholder="name@example.com">
          </div>
          <div class="form-group">
            <label class="form-label">${t('contact_subject')}</label>
            <input type="text" class="form-input" required placeholder="${t('contact_subject')}">
          </div>
          <div class="form-group">
            <label class="form-label">${t('contact_message')}</label>
            <textarea class="form-input" rows="5" required placeholder="${t('contact_message')}"></textarea>
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%;">${t('contact_send_btn')}</button>
        </form>
      </div>
    </div>
  `;
}

// 11. WORDPRESS ADMIN SHOWCASE VIEW
function renderAdminView(container) {
  const isTa = getLanguage() === 'ta';
  container.innerHTML = `
    <div class="wp-admin-page">
      <div class="container">
        <div class="wp-admin-shell">
          <div class="wp-admin-sidebar">
            <div class="wp-admin-brand">
              <img src="/images/logo.png" style="width:28px; height:28px; border-radius:50%;" alt="WP">
              <span>RP Novels Admin</span>
            </div>
            <div class="wp-menu-list">
              <div class="wp-menu-item active">📚 ${isTa ? 'நாவல்கள்' : 'Novels'}</div>
              <div class="wp-menu-item">✍️ ${isTa ? 'அத்தியாயங்கள்' : 'Chapters'}</div>
              <div class="wp-menu-item">📢 ${isTa ? 'அறிவிப்புகள்' : 'Announcements'}</div>
              <div class="wp-menu-item">💬 ${isTa ? 'மன்றம்' : 'wpForo Community'}</div>
              <div class="wp-menu-item">👥 ${isTa ? 'உறுப்பினர்கள்' : 'Members'}</div>
              <div class="wp-menu-item">⚙️ ${isTa ? 'அமைப்புகள்' : 'Theme Settings'}</div>
            </div>
          </div>

          <div class="wp-admin-main">
            <div class="wp-admin-heading">
              <h2>${isTa ? 'நாவல்கள் மேலாண்மை' : 'Novels Management'}</h2>
              <button class="wp-button-primary" onclick="showToast('${isTa ? 'படிவம் திறக்கப்படுகிறது...' : 'Opening add novel form...'}')">+ Add New Novel</button>
            </div>

            <div class="wp-admin-card">
              <table class="wp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Genre</th>
                    <th>Chapters</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${SITE_DATA.novels.map(n => `
                    <tr>
                      <td><strong>${isTa ? n.tamilTitle : n.title}</strong></td>
                      <td>${isTa ? n.author : 'Rudhra Prarthana'}</td>
                      <td><span class="novel-badge-status badge-${n.status.toLowerCase()}" style="position:static;">${n.status}</span></td>
                      <td>${n.genre}</td>
                      <td>${n.chaptersCount}</td>
                      <td>
                        <a href="#novel?id=${n.id}" style="color:#2271B1; text-decoration:underline;">Edit</a> | 
                        <a href="#novel?id=${n.id}" style="color:#2271B1; text-decoration:underline;">View</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helpers
function renderNovelCard(n, mode = 'read') {
  const isTa = getLanguage() === 'ta';
  const title = isTa ? n.tamilTitle : n.title;
  const author = isTa ? n.author : 'Rudhra Prarthana';
  const statusLabel = isTa ? (n.status === 'Ongoing' ? 'தொடர்கிறது' : 'முழுமை பெற்றது') : n.status;
  const btnText = mode === 'continue' ? (isTa ? 'தொடர்ந்து வாசிக்க ➔' : 'Continue Reading ➔') : t('btn_read_more');

  return `
    <div class="novel-card">
      <div class="novel-card-cover">
        <img src="${n.cover}" class="novel-card-img" alt="${title}" loading="lazy">
        <span class="novel-badge-status badge-${n.status.toLowerCase()}">${statusLabel}</span>
        <span class="novel-badge-genre">${n.genre.split('/')[0]}</span>
      </div>
      <div class="novel-card-body">
        <h3 class="novel-card-title">${title}</h3>
        <div class="novel-card-author">✍️ ${author}</div>
        <p class="novel-card-desc">${n.description}</p>
        <div class="novel-card-meta">
          <span class="novel-card-meta-item">📖 ${n.chaptersCount} ${t('novel_chapters')}</span>
          <span class="novel-card-meta-item">★ ${n.rating}</span>
        </div>
      </div>
      <div class="novel-card-footer">
        <a href="#novel?id=${n.id}" class="btn ${mode === 'continue' ? 'btn-primary' : 'btn-gold'}" style="width:100%;">
          ${btnText}
        </a>
      </div>
    </div>
  `;
}

function renderAudioNovelCard() {
  const isTa = getLanguage() === 'ta';
  const audio = SITE_DATA.novels.find(n => n.category === 'Audio Novels') || SITE_DATA.novels[4];
  const title = isTa ? audio.tamilTitle : audio.title;
  const author = isTa ? audio.author : 'Rudhra Prarthana';

  return `
    <div class="audio-card">
      <div class="audio-card-top">
        <img src="${audio.cover}" class="audio-card-cover" alt="${title}">
        <div class="audio-card-info">
          <span class="novel-badge-status badge-audio" style="position:static; display:inline-block; margin-bottom:4px;">${t('audio_badge')}</span>
          <h3 style="font-family:var(--font-serif); font-size:1.2rem; color:var(--color-navy-deep);">${title}</h3>
          <div style="font-size:11px; color:var(--color-text-muted); margin-top:4px;">${t('audio_voice')}: ${author} • ${audio.duration}</div>
        </div>
      </div>
      <div class="audio-player-controls">
        <button class="audio-play-btn" onclick="toggleAudioDemo(this)" title="Play">▶</button>
        <div class="audio-track-progress">
          <div class="audio-progress-bar">
            <div class="audio-progress-fill"></div>
          </div>
          <div class="audio-duration">
            <span>08:14</span>
            <span>22:00</span>
          </div>
        </div>
      </div>
      <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--color-border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <span style="font-size:11px; color:var(--color-text-muted);">${t('audio_note')}</span>
        <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 10px; color:#C89B3C; border-color:#C89B3C;">
          ▶ ${t('nav_youtube_channel')}
        </a>
      </div>
    </div>
  `;
}

window.showContentRestrictionModal = ({ title, message, redirectHash } = {}) => {
  const isTa = getLanguage() === 'ta';
  document.getElementById('content-restriction-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'content-restriction-modal';
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center; max-width:440px; padding:32px 24px;">
      <div style="font-size:48px; margin-bottom:12px;">🎧🔒</div>
      <h3 style="font-family:var(--font-serif); font-size:1.4rem; color:var(--color-navy-deep); margin-bottom:8px;">
        ${title || (isTa ? 'உறுப்பினர்களுக்கு மட்டுமேயான பகுதி' : 'Members Only Content')}
      </h3>
      <p style="font-size:15px; color:var(--color-navy-deep); font-weight:600; margin-bottom:10px; line-height:1.5;">
        ${message || (isTa ? 'முழு கதையையும் தொடர்ந்து வாசிக்க உள்நுழையவும்.' : 'Please log in to continue reading the full story.')}
      </p>
      <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:24px; line-height:1.6;">
        ${isTa ? 'விருந்தினர்கள் ஒவ்வொரு நாவலின் சமீபத்திய தினசரி அத்தியாயத்தை இலவசமாக வாசிக்கலாம். முந்தைய அத்தியாயங்கள், முழு நாவல்கள் மற்றும் ஆடியோ கதைகள் பதிவு செய்த உறுப்பினர்களுக்கு மட்டுமே.' : 'Guests can read the latest daily update of each novel for free. Previous chapters, completed stories, and full audio stories are reserved for registered members.'}
      </p>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-gold btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#home'}'); openAuthModal('login');">
          🔑 ${t('btn_login')}
        </button>
        <button class="btn btn-outline btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#home'}'); openAuthModal('register');">
          ✨ ${t('btn_register')}
        </button>
        <button class="btn btn-outline btn-sm" style="border:none; margin-top:6px; color:var(--color-text-muted);" onclick="document.getElementById('content-restriction-modal')?.remove();">
          ${isTa ? 'மூடு' : 'Close'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.toggleAudioDemo = async (btn) => {
  const isTa = getLanguage() === 'ta';
  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';

  if (isGuest) {
    window.showContentRestrictionModal({
      title: isTa ? 'முழு ஒலி நாவல் (உறுப்பினர்களுக்கு மட்டும்)' : 'Full Audio Story (Members Only)',
      message: isTa ? 'முழு கதையையும் தொடர்ந்து வாசிக்க உள்நுழையவும்.' : 'Please log in to continue reading the full story.',
      redirectHash: window.location.hash || '#home'
    });
    return;
  }

  if (btn.innerText === '▶') {
    btn.innerText = '⏸';
    showToast(isTa ? 'ஆடியோ நாவல் இசைக்கப்படுகிறது... 🎧' : 'Playing audio novel sample... 🎧');
  } else {
    btn.innerText = '▶';
    showToast(isTa ? 'ஆடியோ நாவல் இடைநிறுத்தப்பட்டது.' : 'Audio paused.');
  }
};

function escapeQuotes(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, "\\'");
}
