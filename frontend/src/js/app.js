
export function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, "\'");
}

if (typeof window !== 'undefined') {
  window.escapeQuote = escapeQuote;
  window.escapeQuotes = escapeQuotes;
}

// Main Application Engine & Client Router

import {
  getSidebarPosts,
  getMembersList,
  getMemberProfile,
  getNovelsList,
  getNovelById,
  getForumCategories,
  getForumTopics,
  getForumTopicById,
  saveReadingProgress,
  getAudioNovelsList,
  getAudioNovelDetail,
  pingPresenceHeartbeat,
  getOnlinePresence,
  getGuestSessionId,
  getForumLiveStats
} from './content-service.js';
import { initReader, applyReaderMode, applyFontSize, showToast, setupReadingSessionTracker, stopReadingSessionTracker } from './reader.js';
import { initForum, renderReactionButtons } from './forum.js';
import { initMessaging, updateUnreadMessageBadge } from './messaging.js';
import { initNotifications } from './notifications.js';
import { initSearch } from './search.js';
import { initAuth, updateHeaderUserArea } from './auth.js';
import { renderAdminDashboard, renderAdminLoginView, verifyAdminAuthentication } from './admin.js';
import { renderWriterDashboard } from './writer.js';
import { updateAuthorWriterHeader, isAuthorWriterPage } from './author-header.js';
import { t, updateStaticDOMElements } from './i18n.js';
import {
  startRouteProgress,
  finishRouteProgress,
  renderNotFound,
  renderAccessDenied,
  renderServerError,
  renderNetworkError,
  renderChapterError,
  renderReaderSkeleton,
  renderMembersSkeleton,
  apiFetch
} from './errors.js';
import { renderReactionsWidget, renderCommentsWidget } from './comments.js';
import { SITE_DATA } from './data.js';

export function initApp() {
  updateStaticDOMElements();

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
    const hash = window.location.hash || '';
    if (hash.startsWith('#admin') && typeof window.toggleAdminMobileNav === 'function') {
      window.toggleAdminMobileNav();
      return;
    }
    if (hash.startsWith('#writer') && typeof window.toggleWriterMobileNav === 'function') {
      window.toggleWriterMobileNav();
      return;
    }
    const drawer = document.getElementById('mobile-drawer');
    const btn = document.querySelector('.hamburger-btn');
    if (drawer && btn) {
      const isOpen = drawer.classList.contains('open');
      drawer.classList.toggle('open', !isOpen);
      btn.classList.toggle('active', !isOpen);
    }
  };

  window.closeMobileDrawer = () => {
    if (typeof window.toggleAdminMobileNav === 'function') {
      window.toggleAdminMobileNav(false);
    }
    if (typeof window.toggleWriterMobileNav === 'function') {
      window.toggleWriterMobileNav(false);
    }
    const drawer = document.getElementById('mobile-drawer');
    const btn = document.querySelector('.hamburger-btn');
    if (drawer && btn) {
      drawer.classList.remove('open');
      btn.classList.remove('active');
    }
  };

  // Hash & History-based Routing
  window.addEventListener('hashchange', renderAppView);
  window.addEventListener('popstate', renderAppView);
  window.renderAppView = renderAppView;

  renderAppView();
  updateHeaderUserArea();
  updateUnreadMessageBadge();
  initPresenceHeartbeat();

  // Dismiss early loading screen once initial render has mounted
  if (typeof window.dismissInitialLoader === 'function') {
    window.dismissInitialLoader();
  }
}

export async function renderAppView() {
  let hash = window.location.hash;

  // Direct pathname normalization for admin routes (e.g. /admin, /admin/dashboard, /admin/novels, /admin/login)
  if ((!hash || hash === '#home' || hash === '#' || hash === '#forms') && window.location.pathname.startsWith('/admin')) {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (pathname === '/admin/login') {
      hash = '#admin-login';
    } else if (pathname === '/admin' || pathname === '/admin/dashboard') {
      hash = '#admin';
    } else {
      const sub = pathname.replace('/admin/', '').split('/')[0];
      const tabMap = {
        novels: 'novels',
        episodes: 'episodes',
        editor: 'editor',
        schedule: 'scheduler',
        scheduler: 'scheduler',
        settings: 'settings',
        overview: 'overview',
        media: 'media',
        'writer-chats': 'writer-chats'
      };
      const tab = tabMap[sub] || 'overview';
      hash = `#admin?tab=${tab}`;
    }
  }

  // Direct pathname normalization for writer routes (e.g. /writer, /writer/dashboard, /writer/editor)
  if ((!hash || hash === '#home' || hash === '#' || hash === '#forms') && window.location.pathname.startsWith('/writer')) {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    if (pathname === '/writer' || pathname === '/writer/dashboard') {
      hash = '#writer';
    } else {
      const sub = pathname.replace('/writer/', '').split('/')[0];
      hash = `#writer?tab=${sub}`;
    }
  }

  if (!hash || hash === '#' || hash === '' || hash === '#home') {
    hash = '#forms';
    if (window.location.hash !== '#forms') {
      window.history.replaceState(null, '', '#forms');
    }
  }
  const main = document.getElementById('main-content');
  if (!main) return;

  startRouteProgress();

  // Guarantee reading theme is strictly isolated and never leaks to global body/html
  document.body.classList.remove('mode-sepia', 'mode-dark', 'mode-light', 'admin-view');
  document.documentElement.classList.remove('mode-sepia', 'mode-dark', 'mode-light');

  const isLoginPage = hash.startsWith('#admin-login') || hash.startsWith('#writer-login');
  if (!isLoginPage && (hash.startsWith('#admin') || hash.startsWith('#writer'))) {
    document.body.classList.add('admin-view');
  }

  // Scoped Author/Writer header activation — strictly only for authenticated author/writer dashboard sessions
  const isAuthorWriterDash = !isLoginPage && (hash.startsWith('#writer') || hash.startsWith('#admin')) && window.IS_LOGGED_IN && Boolean(window.CURRENT_USER);
  if (isAuthorWriterDash) {
    updateAuthorWriterHeader(true, null, hash);
  } else if (!hash.startsWith('#member')) {
    updateAuthorWriterHeader(false, null, hash);
  }

  // Scroll to top upon route transition
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update active state in desktop & mobile navs
  updateNavActiveState(hash);

  if (!hash.startsWith('#reader')) {
    try { stopReadingSessionTracker(); } catch {}
  }

  try {
    if (hash.startsWith('#admin-login') || hash.startsWith('#writer-login')) {
      await renderAdminLoginView(main);
    } else if (hash.startsWith('#admin')) {
      const tabParam = hash.includes('tab=') ? new URLSearchParams(hash.split('?')[1]).get('tab') : 'overview';
      await renderAdminDashboard(main, tabParam);
    } else if (hash.startsWith('#writer')) {
      const tabParam = hash.includes('tab=') ? new URLSearchParams(hash.split('?')[1]).get('tab') : 'overview';
      await renderWriterDashboard(main, tabParam);
    } else if (hash.startsWith('#dashboard')) {
      const auth = await verifyAdminAuthentication();
      if (auth.authorized) {
        if (auth.user?.role === 'writer' || auth.user?.isWriter) {
          window.location.hash = '#writer';
        } else {
          window.location.hash = '#admin';
        }
      } else if (window.IS_LOGGED_IN) {
        window.location.hash = '#member?id=me';
      } else {
        window.location.hash = '#admin-login';
      }
    } else if (hash.startsWith('#reader')) {
      await renderReaderView(main, hash);
    } else if (hash.startsWith('#audio?') || hash.startsWith('#audio-player?')) {
      await renderAudioPlayerView(main, hash);
    } else if (hash.startsWith('#audio') || hash.startsWith('#audio-novels')) {
      await renderAudioNovelsView(main, hash);
    } else if (hash.startsWith('#novel?')) {
      await renderNovelDetailView(main, hash);
    } else if (hash.startsWith('#novels')) {
      await renderNovelLibraryView(main, hash);
    } else if (hash.startsWith('#forum') || hash.startsWith('#forms')) {
      await renderForumView(main, hash);
    } else if (hash.startsWith('#thread-create') || hash.startsWith('#add-thread')) {
      await renderThreadCreateView(main, hash);
    } else if (hash.startsWith('#thread?') || hash.startsWith('#thread/')) {
      await renderContentReadingView(main, hash);
    } else if (hash.startsWith('#content?') || hash.startsWith('#content/')) {
      await renderContentReadingView(main, hash);
    } else if (hash.startsWith('#story?') || hash.startsWith('#story/')) {
      await renderStoryReadingView(main, hash);
    } else if (hash.startsWith('#topic?')) {
      await renderTopicView(main, hash);
    } else if (hash.startsWith('#followers') || hash.startsWith('#following') || hash.startsWith('#connections') || hash.startsWith('#network')) {
      await renderFollowersFollowingView(main, hash);
    } else if (hash.startsWith('#members')) {
      await renderMembersView(main);
    } else if (hash.startsWith('#member?')) {
      await renderMemberProfileView(main, hash);
    } else if (hash.startsWith('#about')) {
      renderAboutView(main);
    } else if (hash.startsWith('#contact')) {
      renderContactView(main);
    } else if (hash.startsWith('#privacy')) {
      renderPrivacyView(main);
    } else if (hash.startsWith('#disclaimer')) {
      renderDisclaimerView(main);
    } else if (hash.startsWith('#terms')) {
      renderTermsView(main);
    } else if (hash.startsWith('#copyright')) {
      renderCopyrightView(main);
    } else if (hash.startsWith('#messages') || hash.startsWith('#chat')) {
      const params = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : null;
      const targetParam = params?.get('user') || params?.get('id') || null;
      if (typeof window.openMessagesDrawer === 'function') {
        window.openMessagesDrawer(targetParam ? Number(targetParam) : null);
      }
      if (!main.children.length) {
        await renderForumView(main, '#forms');
      }
    } else if (hash === '#home' || hash.startsWith('#home')) {
      window.location.hash = '#forms';
      return;
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
  let path = hash ? hash.split('?')[0] : '#forms';
  if (path === '#' || path === '' || path === '#home') path = '#forms';
  const isForumOrForms = path === '#forum' || path === '#forms' || path.startsWith('#topic');
  document.querySelectorAll('.nav-link, .drawer-nav-item').forEach(link => {
    const href = link.getAttribute('href');
    const dataNav = link.getAttribute('data-nav');
    if (dataNav === 'home' && (path === '#forms' || path === '#home')) {
      link.classList.add('active');
    } else if (dataNav === 'forms' && (path === '#forms' || path === '#home')) {
      link.classList.remove('active');
    } else if (href === path || (isForumOrForms && (href === '#forum' || href === '#forms' || href === '#home') && dataNav !== 'forms')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 1. NOVEL LIBRARY VIEW
async function renderNovelLibraryView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const initialCategory = urlParams.get('category') || 'All';
  const novelsList = await getNovelsList({ all: true });

  container.innerHTML = `
    <div class="container section">
      <div class="section-header">
        <div class="section-heading-group">
          <span class="section-subtitle">Library</span>
          <h1 class="section-title">${t('novels_library_title')}</h1>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="members-filter-bar">
        <div class="library-search-box">
          <input type="text" id="library-search-input" class="form-input" placeholder="${t('novels_search_placeholder')}" 
                 oninput="filterNovelsLibrary()">
        </div>

        <div class="library-filter-selects">
          <select id="library-category-select" class="form-input" onchange="filterNovelsLibrary()">
            <option value="All" ${initialCategory === 'All' ? 'selected' : ''}>${t('filter_all')}</option>
            <option value="Ongoing Novels" ${initialCategory === 'Ongoing' ? 'selected' : ''}>${t('filter_ongoing')}</option>
            <option value="Completed Novels" ${initialCategory === 'Completed' ? 'selected' : ''}>${t('filter_completed')}</option>
            <option value="Audio Novels" ${initialCategory === 'Audio' ? 'selected' : ''}>${t('filter_audio')}</option>
            <option value="Short Stories" ${initialCategory === 'Short Stories' ? 'selected' : ''}>Short Stories</option>
          </select>

          <select id="library-sort-select" class="form-input" onchange="filterNovelsLibrary()">
            <option value="newest">Newest First</option>
            <option value="popular">Most Popular</option>
            <option value="alpha">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>

      <!-- Novel Grid Container -->
      <div class="novel-grid" id="library-novel-grid">
        ${novelsList.length > 0 ? novelsList.map(n => renderNovelCard(n)).join('') : `
          <div class="empty-section-message" style="grid-column: 1 / -1; padding:64px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:36px; margin-bottom:12px;">📚</div>
            <h3 style="margin:0 0 8px; font-size:18px; color:var(--color-navy); font-family:var(--font-heading);">${t('novels_empty')}</h3>
            <p style="font-size:14px; margin:0;">New literary works and chapters will appear here once published by the author.</p>
          </div>
        `}
      </div>
    </div>
  `;

  window.filterNovelsLibrary = () => {
    const q = (document.getElementById('library-search-input')?.value || '').toLowerCase();
    const cat = document.getElementById('library-category-select')?.value || 'All';
    const sort = document.getElementById('library-sort-select')?.value || 'newest';

    let list = novelsList.filter(n => {
      const matchQuery = !q || n.title.toLowerCase().includes(q) || (n.genre && n.genre.toLowerCase().includes(q));
      const matchCat = cat === 'All' || n.category === cat || n.genre === cat;
      return matchQuery && matchCat;
    });

    if (sort === 'popular') {
      list.sort((a, b) => parseInt(String(b.views || '0').replace(/,/g, '')) - parseInt(String(a.views || '0').replace(/,/g, '')));
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
async function renderNovelDetailView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const novelId = urlParams.get('id');
  if (!novelId) {
    renderNotFound(container);
    return;
  }

  const novel = await getNovelById(novelId);
  if (!novel) {
    renderNotFound(container);
    return;
  }

  const chapters = novel.chapters || [];
  const selectedChapterParam = urlParams.get('chapter') || urlParams.get('chapterId');

  // Build hierarchical mapping
  const novelTitle = novel.title || 'Novel';
  const childrenByParent = new Map();
  for (const ch of chapters) {
    if (ch.parentId) {
      const pId = Number(ch.parentId);
      if (!childrenByParent.has(pId)) childrenByParent.set(pId, []);
      childrenByParent.get(pId).push(ch);
    }
  }

  const roots = chapters.filter(c => !c.parentId);
  const hasHierarchy = roots.length > 0 && Array.from(childrenByParent.values()).some(arr => arr.length > 0);

  function getDisplayTitle(item, defaultPrefix, num) {
    const tVal = (item.title || '').trim();
    if (tVal && !/^Episode\s+[\d\.]+/i.test(tVal)) {
      return tVal;
    }
    return `${novelTitle} (${num})`;
  }

  // Find first readable episode (leaf episode, not navigation container)
  const readableEpisodes = chapters.filter(c => !chapters.some(child => Number(child.parentId) === Number(c.id)));
  const firstEpisode = readableEpisodes.length > 0 ? readableEpisodes[0] : (chapters[0] || null);
  const firstChapterNum = firstEpisode 
    ? (firstEpisode.chapterNum || firstEpisode.episodeNumber || String(firstEpisode.num || '1')) 
    : null;

  // Real-Time Save Novel Handler
  window.toggleSaveNovel = async (targetNovelId) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to save novels.');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    const btn = document.getElementById('novel-save-btn');
    const icon = btn?.querySelector('.save-icon');
    const label = btn?.querySelector('.save-text');
    try {
      const res = await apiFetch(`/api/novels/${encodeURIComponent(targetNovelId)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelId: targetNovelId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        novel.isSaved = data.isSaved;
        if (btn) {
          if (data.isSaved) {
            btn.classList.add('is-saved');
            btn.title = 'Saved in your library';
            if (icon) icon.textContent = '🔖';
            if (label) label.textContent = 'Saved';
          } else {
            btn.classList.remove('is-saved');
            btn.title = 'Save novel to your profile';
            if (icon) icon.textContent = '📑';
            if (label) label.textContent = 'Save Novel';
          }
        }
        showToast(data.message || (data.isSaved ? 'Novel added to your Saved Novels!' : 'Novel removed from Saved Novels.'));
      } else {
        showToast(data?.error || 'Failed to update save status');
      }
    } catch (err) {
      showToast('Could not save novel: ' + err.message);
    }
  };

  // Author Follow / Unfollow Handler on Novel Page
  window.toggleAuthorFollow = async (authorId) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to follow the author.');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    try {
      const res = await apiFetch(`/api/members/${encodeURIComponent(authorId)}/follow`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        novel.isFollowingAuthor = data.isFollowing;
        novel.authorFollowersCount = data.followersCount;

        const btn = document.getElementById('author-follow-btn');
        if (btn) {
          if (data.isFollowing) {
            btn.className = 'btn btn-outline btn-sm is-following';
            btn.textContent = '✓ Following';
          } else {
            btn.className = 'btn btn-gold btn-sm';
            btn.textContent = '➕ Follow';
          }
        }
        const countEl = document.getElementById('author-followers-count');
        if (countEl) countEl.textContent = data.followersCount;
        showToast(data.isFollowing ? `Now following ${novel.author || 'Author'}!` : `Unfollowed ${novel.author || 'Author'}.`);
      } else {
        showToast(data?.error || 'Failed to update follow status');
      }
    } catch (err) {
      showToast('Could not follow author: ' + err.message);
    }
  };

  // Interactive 5-Star Rating Handlers
  window.hoverNovelRating = (hoverVal) => {
    const starsGroup = document.getElementById('rating-stars-group');
    if (!starsGroup) return;
    const stars = starsGroup.querySelectorAll('.star-item');
    stars.forEach(s => {
      const val = parseInt(s.dataset.val, 10);
      if (val <= hoverVal) {
        s.classList.add('hovered');
      } else {
        s.classList.remove('hovered');
      }
    });
  };

  window.resetHoverNovelRating = () => {
    const starsGroup = document.getElementById('rating-stars-group');
    if (!starsGroup) return;
    const stars = starsGroup.querySelectorAll('.star-item');
    stars.forEach(s => s.classList.remove('hovered'));
  };

  window.submitNovelRating = async (targetNovelId, ratingVal) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to rate this novel.');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    try {
      const res = await apiFetch(`/api/novels/${encodeURIComponent(targetNovelId)}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingVal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        novel.userRating = data.userRating;
        novel.averageRating = data.averageRating;
        novel.totalRatings = data.totalRatings;

        // Update stars state
        const starsGroup = document.getElementById('rating-stars-group');
        if (starsGroup) {
          starsGroup.dataset.userRating = String(data.userRating);
          const stars = starsGroup.querySelectorAll('.star-item');
          stars.forEach(s => {
            const val = parseInt(s.dataset.val, 10);
            if (val <= data.userRating) {
              s.classList.add('filled');
            } else {
              s.classList.remove('filled');
            }
          });
        }

        // Update ratings summary
        const avgEl = document.getElementById('novel-avg-rating');
        if (avgEl) avgEl.textContent = data.averageRating;
        const totEl = document.getElementById('novel-total-ratings');
        if (totEl) totEl.textContent = data.totalRatings;
        const userMsgEl = document.getElementById('novel-user-rating-msg');
        if (userMsgEl) {
          userMsgEl.textContent = `Your rating: ${data.userRating}★`;
          userMsgEl.className = 'user-rating-badge has-rated';
          userMsgEl.style.background = '#E6F4EA';
          userMsgEl.style.color = '#137333';
        }

        showToast(`Rating saved: ${ratingVal} ★. Average is now ${data.averageRating}!`);
      } else {
        showToast(data?.error || 'Failed to submit rating');
      }
    } catch (err) {
      showToast('Could not submit rating: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // DEDICATED CHAPTER VIEW: When a specific chapter is selected
  // -------------------------------------------------------------
  if (selectedChapterParam && hasHierarchy) {
    const targetRoot = roots.find(r => 
      String(r.chapterNum || r.episodeNumber || r.num) === String(selectedChapterParam) ||
      String(r.id) === String(selectedChapterParam)
    ) || chapters.find(c => 
      String(c.chapterNum || c.episodeNumber || c.num) === String(selectedChapterParam)
    ) || roots[0];

    const targetRootNum = targetRoot ? (targetRoot.chapterNum || targetRoot.episodeNumber || targetRoot.num) : selectedChapterParam;
    const targetRootTitle = targetRoot ? getDisplayTitle(targetRoot, 'Chapter', targetRootNum) : `Chapter ${targetRootNum}`;
    const directEpisodes = targetRoot ? (childrenByParent.get(Number(targetRoot.id)) || []) : [];

    container.innerHTML = `
      <div class="container section">
        <!-- Breadcrumb Navigation -->
        <nav class="breadcrumb-bar" style="margin-bottom:20px; font-size:13px; color:var(--color-text-muted); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <a href="#forms" style="color:var(--color-gold-warm); text-decoration:none; font-weight:600;">Home</a>
          <span>›</span>
          <a href="#novels" style="color:var(--color-gold-warm); text-decoration:none; font-weight:600;">Novels</a>
          <span>›</span>
          <a href="#novel?id=${encodeURIComponent(novel.id)}" style="color:var(--color-gold-warm); text-decoration:none; font-weight:600;">${escapeHtml(novel.title)}</a>
          <span>›</span>
          <span style="color:var(--color-navy-deep); font-weight:700;">Chapter ${escapeHtml(String(targetRootNum))}</span>
        </nav>

        <!-- Back Button & Chapter Title Header -->
        <div style="background:var(--color-card-bg, #FFF); border:1px solid var(--color-border); border-radius:12px; padding:24px; margin-bottom:28px; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="margin-bottom:14px;">
            <a href="#novel?id=${encodeURIComponent(novel.id)}" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
              ← Back to All Chapters
            </a>
          </div>
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:800; color:var(--color-navy-deep); background:var(--color-gold); padding:4px 10px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">
              Chapter ${escapeHtml(String(targetRootNum))}
            </span>
            <h1 style="font-size:24px; font-weight:700; color:var(--color-navy-deep); margin:0;">
              ${escapeHtml(targetRootTitle)}
            </h1>
          </div>
          <div style="font-size:13px; color:var(--color-text-muted);">
            <span>Novel: <strong style="color:var(--color-navy-deep);">${escapeHtml(novel.title)}</strong></span>
            ${novel.author ? `<span style="margin-left:14px;">Author: <strong style="color:var(--color-navy-deep);">${escapeHtml(novel.author)}</strong></span>` : ''}
            <span style="margin-left:14px;">Total Episodes: <strong>${directEpisodes.length}</strong></span>
          </div>
        </div>

        <!-- Hierarchical Episodes & Sub-episodes List (Belonging ONLY to this chapter) -->
        <div class="section-header" style="margin-bottom:16px;">
          <div class="section-heading-group">
            <span class="section-subtitle">Chapter Episodes</span>
            <h3 class="section-title">Episodes (${directEpisodes.length})</h3>
          </div>
        </div>

        <div class="chapter-episodes-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom:40px;">
          ${(() => {
            if (directEpisodes.length === 0) {
              return `
                <div style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:var(--color-card-bg); border-radius:var(--radius-md); border:1px dashed var(--color-border);">
                  <div style="font-size:32px; margin-bottom:8px;">📖</div>
                  <p style="font-size:15px; margin:0;">No episodes have been released under Chapter ${escapeHtml(String(targetRootNum))} yet.</p>
                </div>
              `;
            }

            return directEpisodes.map(ep => {
              const epNum = ep.episodeNumber || ep.chapterNum || ep.num;
              const epTitle = getDisplayTitle(ep, 'Episode', epNum);
              const epParam = encodeURIComponent(ep.chapterNum || ep.episodeNumber || String(ep.num));
              const subSubs = childrenByParent.get(Number(ep.id)) || [];

              return `
                <div class="chapter-group-card" style="background:var(--color-card-bg, #FFF); border:1px solid var(--color-border); border-radius:10px; overflow:hidden;">
                  <!-- Episode Item -->
                  <div class="chapter-list-item episode-row" style="background:#FFFDF8; border-left:4px solid var(--color-navy-deep); padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="font-size:11px; font-weight:700; color:#FFF; background:var(--color-navy-deep); padding:3px 8px; border-radius:4px;">
                          Episode ${escapeHtml(String(epNum))}
                        </span>
                        <span style="font-weight:700; font-size:15px; color:var(--color-navy-deep); word-break:break-word;">
                          ${escapeHtml(epTitle)}
                        </span>
                      </div>
                      <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">
                        ${ep.date ? `<span>📅 ${escapeHtml(ep.date)}</span>` : ''}
                        ${ep.readTime ? `<span style="margin-left:8px;">⏱ ${escapeHtml(ep.readTime)}</span>` : ''}
                        ${ep.words ? `<span style="margin-left:8px;">📖 ${escapeHtml(ep.words)} words</span>` : ''}
                      </div>
                    </div>
                    <div>
                      <a href="#reader?novel=${encodeURIComponent(novel.id)}&ch=${epParam}" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                        Read Episode ➔
                      </a>
                    </div>
                  </div>

                  <!-- Nested Sub-Episodes under this Episode -->
                  ${subSubs.length > 0 ? `
                    <div style="padding:10px 18px; background:#FAFAFA; border-top:1px solid var(--color-border); display:flex; flex-direction:column; gap:8px;">
                      ${subSubs.map(ss => {
                        const ssNum = ss.episodeNumber || ss.chapterNum || ss.num;
                        const ssTitle = getDisplayTitle(ss, 'Sub-Ep', ssNum);
                        const ssParam = encodeURIComponent(ss.chapterNum || ss.episodeNumber || String(ss.num));
                        return `
                          <div class="chapter-list-item sub-episode-row" style="margin-left:20px; background:#FFF; border-left:3px solid var(--color-gold); padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                            <div>
                              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:10px; font-weight:700; color:var(--color-navy-deep); background:var(--color-gold); padding:2px 7px; border-radius:4px;">
                                  Sub-Episode ${escapeHtml(String(ssNum))}
                                </span>
                                <span style="font-weight:600; font-size:13.5px; color:var(--color-navy-deep); word-break:break-word;">
                                  ${escapeHtml(ssTitle)}
                                </span>
                              </div>
                              <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">
                                ${ss.date ? `<span>📅 ${escapeHtml(ss.date)}</span>` : ''}
                                ${ss.readTime ? `<span style="margin-left:8px;">⏱ ${escapeHtml(ss.readTime)}</span>` : ''}
                                ${ss.words ? `<span style="margin-left:8px;">📖 ${escapeHtml(ss.words)} words</span>` : ''}
                              </div>
                            </div>
                            <div>
                              <a href="#reader?novel=${encodeURIComponent(novel.id)}&ch=${ssParam}" class="btn btn-outline btn-sm" style="font-size:12px; padding:4px 10px; font-weight:600;">
                                Read Episode ➔
                              </a>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('');
          })()}
        </div>

        <!-- Novel Reactions & Community Discussion -->
        <div id="novel-reactions-widget"></div>
        <div id="novel-comments-widget"></div>
      </div>
    `;

    renderReactionsWidget('novel-reactions-widget', 'chapter', `${novel.id}:${targetRootNum}`);
    renderCommentsWidget('novel-comments-widget', novel.id, targetRootNum);
    return;
  }

  // -------------------------------------------------------------
  // MAIN NOVEL VIEW: Shows only chapter headings (no episodes)
  // -------------------------------------------------------------
  const displayChapterCount = hasHierarchy ? roots.length : chapters.length;

  container.innerHTML = `
    <div class="container section">
      <div class="novel-detail-grid">
        <div class="novel-detail-cover-col">
          <div class="novel-detail-cover-wrap">
            <img src="${novel.cover || '/default-cover.jpg'}" class="novel-detail-cover-img" alt="${escapeHtml(novel.title || 'Novel Cover')}" onerror="this.onerror=null;this.src='/default-cover.jpg';">
          </div>
          <div class="novel-detail-actions">
            ${firstChapterNum ? `
              <a href="#reader?novel=${encodeURIComponent(novel.id)}&ch=${encodeURIComponent(firstChapterNum)}" class="btn btn-gold">${t('novel_start_reading')}</a>
            ` : `
              <button class="btn btn-gold" disabled style="opacity:0.6; cursor:not-allowed;">${t('novel_start_reading')} (Coming Soon)</button>
            `}
            <button id="novel-save-btn" class="btn btn-save-novel ${novel.isSaved ? 'is-saved' : ''}" onclick="window.toggleSaveNovel('${escapeQuotes(novel.id)}')" title="${novel.isSaved ? 'Saved in your library' : 'Save novel to your profile'}">
              <span class="save-icon">${novel.isSaved ? '🔖' : '📑'}</span>
              <span class="save-text">${novel.isSaved ? 'Saved' : 'Save Novel'}</span>
            </button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-3); min-width:0;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span class="novel-badge-status badge-${(novel.status || 'ongoing').toLowerCase()}" style="position:static;">${novel.status || 'Ongoing'}</span>
            <span class="novel-badge-genre" style="position:static;">${novel.genre || 'Novel'}</span>
          </div>

          <h1 class="novel-detail-title">${escapeHtml(novel.title)}</h1>

          <!-- Author Row with Real-Time Follow / Unfollow -->
          <div class="novel-author-row" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-size:14px; color:var(--color-text-muted);">
              ${t('novel_author')}: <a href="#member?id=${encodeURIComponent(novel.authorId || novel.author_id || 2)}" style="color:var(--color-navy-deep); font-weight:700; text-decoration:none;">${escapeHtml(novel.author || 'Rudhra Prarthana')}</a>
            </span>
            ${(!window.CURRENT_USER || String(window.CURRENT_USER.id) !== String(novel.authorId || novel.author_id || 2)) ? `
              <button id="author-follow-btn" class="btn btn-sm ${novel.isFollowingAuthor ? 'btn-outline is-following' : 'btn-gold'}" style="font-size:11px; padding:3px 12px; border-radius:20px; font-weight:700;" onclick="window.toggleAuthorFollow('${escapeQuotes(novel.authorId || novel.author_id || 2)}')">
                ${novel.isFollowingAuthor ? '✓ Following' : '➕ Follow'}
              </button>
            ` : ''}
            <span id="author-followers-badge" style="font-size:12px; color:var(--color-text-muted); font-weight:500;">
              (<span id="author-followers-count">${novel.authorFollowersCount || 0}</span> followers)
            </span>
            ${novel.views ? `<span style="color:var(--color-text-muted); font-size:13px;">• Views: <strong>${escapeHtml(String(novel.views))}</strong></span>` : ''}
          </div>

          <!-- Interactive 5-Star Novel Rating Component -->
          <div class="novel-rating-container" style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin:4px 0 8px 0; background:#FFFDF8; border:1px solid rgba(200,155,60,0.25); border-radius:8px; padding:10px 14px; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
            <div class="rating-stars-group" id="rating-stars-group" data-user-rating="${novel.userRating || 0}" style="display:inline-flex; gap:4px; font-size:22px; line-height:1; cursor:pointer;" title="Click star to rate">
              <span class="star-item ${novel.userRating >= 1 ? 'filled' : ''}" data-val="1" onclick="window.submitNovelRating('${escapeQuotes(novel.id)}', 1)" onmouseenter="window.hoverNovelRating(1)" onmouseleave="window.resetHoverNovelRating()" title="Rate 1 star">★</span>
              <span class="star-item ${novel.userRating >= 2 ? 'filled' : ''}" data-val="2" onclick="window.submitNovelRating('${escapeQuotes(novel.id)}', 2)" onmouseenter="window.hoverNovelRating(2)" onmouseleave="window.resetHoverNovelRating()" title="Rate 2 stars">★</span>
              <span class="star-item ${novel.userRating >= 3 ? 'filled' : ''}" data-val="3" onclick="window.submitNovelRating('${escapeQuotes(novel.id)}', 3)" onmouseenter="window.hoverNovelRating(3)" onmouseleave="window.resetHoverNovelRating()" title="Rate 3 stars">★</span>
              <span class="star-item ${novel.userRating >= 4 ? 'filled' : ''}" data-val="4" onclick="window.submitNovelRating('${escapeQuotes(novel.id)}', 4)" onmouseenter="window.hoverNovelRating(4)" onmouseleave="window.resetHoverNovelRating()" title="Rate 4 stars">★</span>
              <span class="star-item ${novel.userRating >= 5 ? 'filled' : ''}" data-val="5" onclick="window.submitNovelRating('${escapeQuotes(novel.id)}', 5)" onmouseenter="window.hoverNovelRating(5)" onmouseleave="window.resetHoverNovelRating()" title="Rate 5 stars">★</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:13.5px; flex-wrap:wrap;">
              <strong id="novel-avg-rating" style="font-size:16px; color:var(--color-navy-deep);">${novel.averageRating || novel.rating || '5.0'}</strong>
              <span style="color:var(--color-text-muted); font-size:12px;">/ 5.0</span>
              <span style="color:var(--color-text-muted); font-size:12px;">(<span id="novel-total-ratings">${novel.totalRatings || 0}</span> ${novel.totalRatings === 1 ? 'rating' : 'ratings'})</span>
              <span id="novel-user-rating-msg" class="user-rating-badge ${novel.userRating ? 'has-rated' : ''}" style="margin-left:6px; font-size:11.5px; padding:2px 8px; border-radius:12px; background:${novel.userRating ? '#E6F4EA' : '#F1F3F4'}; color:${novel.userRating ? '#137333' : '#5F6368'}; font-weight:600;">
                ${novel.userRating ? `Your rating: ${novel.userRating}★` : 'Click stars to rate'}
              </span>
            </div>
          </div>

          <div style="margin:var(--space-4) 0; padding:var(--space-5); background:var(--color-card-bg); border-left:3px solid var(--color-gold); border-radius:0 var(--radius-md) var(--radius-md) 0; line-height:1.8;">
            <h4 style="font-size:14px; text-transform:uppercase; color:var(--color-gold-warm); margin-bottom:6px;">${t('novel_synopsis')}</h4>
            <p>${escapeHtml(novel.description || 'No description available for this novel yet.')}</p>
          </div>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '${escapeQuotes(novel.title)}')">WhatsApp</button>
            <button class="share-btn facebook" onclick="shareChapter('facebook', '${escapeQuotes(novel.title)}')">Facebook</button>
            <button class="share-btn" onclick="shareChapter('copy', '${escapeQuotes(novel.title)}')">Copy Link</button>
          </div>
        </div>
      </div>

      <!-- CHAPTER LIST -->
      <div class="section-header" style="border-top:1px solid var(--color-border); padding-top:var(--space-8);">
        <div class="section-heading-group">
          <span class="section-subtitle">${t('novel_chapters')}</span>
          <h3 class="section-title">${t('novel_chapters')} (${displayChapterCount})</h3>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${(() => {
          if (!chapters || chapters.length === 0) {
            return `
              <div style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:var(--color-card-bg); border-radius:var(--radius-md); border:1px dashed var(--color-border);">
                <div style="font-size:32px; margin-bottom:8px;">📖</div>
                <p style="font-size:15px; margin:0;">Episodes for this novel are currently being prepared and will be released soon.</p>
              </div>
            `;
          }

          if (!hasHierarchy) {
            // Flat chapters listing (for legacy novels without hierarchy)
            return chapters.map(ch => {
              const numDisplay = ch.episodeNumber || ch.chapterNum || ch.num;
              const chParam = encodeURIComponent(ch.chapterNum || ch.episodeNumber || String(ch.num));
              const displayTitle = getDisplayTitle(ch, 'Chapter', numDisplay);
              return `
                <div class="chapter-list-item">
                  <div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span style="font-size:10px; font-weight:800; color:var(--color-navy-deep); background:var(--color-gold); padding:2px 7px; border-radius:4px; text-transform:uppercase;">
                        Chapter ${escapeHtml(String(numDisplay))}
                      </span>
                      <span style="font-weight:700; color:var(--color-navy-deep); word-break:break-word;">
                        ${escapeHtml(displayTitle)}
                      </span>
                    </div>
                    <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">
                      ${ch.date ? `<span>📅 ${escapeHtml(ch.date)}</span>` : ''}
                      ${ch.readTime ? `<span style="margin-left:8px;">⏱ ${escapeHtml(ch.readTime)}</span>` : ''}
                      ${ch.words ? `<span style="margin-left:8px;">📖 ${escapeHtml(ch.words)}</span>` : ''}
                    </div>
                  </div>
                  <div>
                    <a href="#reader?novel=${encodeURIComponent(novel.id)}&ch=${chParam}" class="btn btn-outline btn-sm">
                      ${t('btn_read_more')} ➔
                    </a>
                  </div>
                </div>
              `;
            }).join('');
          }

          // Hierarchical listing: ONLY Chapter cards on the novel page (No episodes, no reading button)
          return roots.map(root => {
            const rootNum = root.chapterNum || root.episodeNumber || root.num;
            const rootTitle = getDisplayTitle(root, 'Chapter', rootNum);
            const episodes = childrenByParent.get(Number(root.id)) || [];
            const rootParam = encodeURIComponent(root.chapterNum || root.episodeNumber || String(root.num));

            return `
              <div class="chapter-list-item root-chapter-card" 
                   style="background:#FFFDF8; border:1px solid var(--color-border); border-left:4px solid var(--color-gold); border-radius:8px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease;"
                   onclick="window.location.hash='#novel?id=${encodeURIComponent(novel.id)}&chapter=${rootParam}'">
                <div>
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-size:11px; font-weight:800; color:var(--color-navy-deep); background:var(--color-gold); padding:3px 8px; border-radius:4px; text-transform:uppercase;">
                      Chapter ${escapeHtml(String(rootNum))}
                    </span>
                    <span style="font-size:15px; font-weight:700; color:var(--color-navy-deep); word-break:break-word;">
                      ${escapeHtml(rootTitle)}
                    </span>
                  </div>
                  <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">
                    <span>📖 ${episodes.length} ${episodes.length === 1 ? 'Episode' : 'Episodes'}</span>
                    ${root.date ? `<span style="margin-left:12px;">📅 ${escapeHtml(root.date)}</span>` : ''}
                  </div>
                </div>
                <div>
                  <a href="#novel?id=${encodeURIComponent(novel.id)}&chapter=${rootParam}" 
                     class="btn btn-outline btn-sm" 
                     onclick="event.stopPropagation();"
                     style="display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                    View Episodes (${episodes.length}) ➔
                  </a>
                </div>
              </div>
            `;
          }).join('');
        })()}
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
  const chRaw = (urlParams.get('ch') || '1').trim();

  if (!novelId || !chRaw) {
    renderNotFound(container);
    return;
  }

  const novel = await getNovelById(novelId);
  if (!novel) {
    renderNotFound(container);
    return;
  }

  const chapters = novel.chapters || [];
  
  // Identify container chapters that have child episodes (Episode-only reading enforcement)
  const hasChildEpisodes = (chId) => chapters.some(c => Number(c.parentId) === Number(chId));

  // If chRaw corresponds to a chapter container with child episodes, redirect to its first child episode
  const matchedTarget = chapters.find(c => String(c.num) === chRaw || String(c.chapterNum) === chRaw || String(c.episodeNumber) === chRaw || String(c.id) === chRaw);
  if (matchedTarget && hasChildEpisodes(matchedTarget.id)) {
    const firstChild = chapters.find(c => Number(c.parentId) === Number(matchedTarget.id));
    if (firstChild) {
      const childNum = firstChild.chapterNum || firstChild.episodeNumber || String(firstChild.num);
      window.location.replace(`#reader?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(childNum)}`);
      return;
    } else {
      window.location.replace(`#novel?id=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(chRaw)}`);
      return;
    }
  }

  // Filter readable episodes: items that are episodes or leaf chapters, excluding pure chapter containers
  const readableEpisodes = chapters.filter(c => !hasChildEpisodes(c.id));
  let currIndex = readableEpisodes.findIndex(c => String(c.num) === chRaw || String(c.chapterNum) === chRaw || String(c.episodeNumber) === chRaw);
  if (currIndex === -1 && chRaw === '1' && readableEpisodes.length > 0) {
    currIndex = 0;
  }
  const chapter = currIndex !== -1 ? readableEpisodes[currIndex] : (matchedTarget || {
    num: chRaw,
    chapterNum: chRaw,
    episodeNumber: chRaw,
    title: `Episode ${chRaw}`,
    date: 'Today',
    readTime: '8 mins'
  });
  const chNum = chapter ? (chapter.chapterNum || chapter.episodeNumber || String(chapter.num || chRaw)) : chRaw;

  const prevCh = currIndex > 0 ? (readableEpisodes[currIndex - 1].chapterNum || readableEpisodes[currIndex - 1].episodeNumber || String(readableEpisodes[currIndex - 1].num)) : null;
  const nextCh = (currIndex !== -1 && currIndex < readableEpisodes.length - 1) ? (readableEpisodes[currIndex + 1].chapterNum || readableEpisodes[currIndex + 1].episodeNumber || String(readableEpisodes[currIndex + 1].num)) : null;

  // Track reading progress automatically
  saveReadingProgress(novelId, chNum, 100);
  try {
    setupReadingSessionTracker(novelId, chNum);
  } catch (e) {
    console.warn('[Reader] Failed to start reading session tracker:', e);
  }

  // Show Skeleton Loader while fetching chapter content
  container.innerHTML = renderReaderSkeleton();

  // Check Backend Access Rule with SQL Database
  let access = null;
  try {
    const res = await apiFetch(`/api/content/chapter?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(chNum)}`);
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
      renderNotFound(container);
      return;
    }

    renderChapterError(container, novelId, chNum, () => renderReaderView(container, hash));
    return;
  }

  if (!access || !access.allowed) {
    renderAccessDenied(container, hash);
    return;
  }

  // Access Granted: Render full chapter
  const rawStory = access.content || '';
  const isHtml = rawStory.includes('<p>') || rawStory.includes('<div') || rawStory.includes('<h');
  const storyBody = isHtml ? rawStory : rawStory.split('\n\n').map(p => `<p>${p}</p>`).join('');

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
          <a href="#novel?id=${novel.id}" class="reader-novel-crumb">« ${novel.title}</a>
          <h1 class="reader-chapter-title">${access.title || chapter.title}</h1>
          <div class="reader-meta-bar">
            <span>✍️ ${novel.author || 'Rudhra Prarthana'}</span>
            <span>•</span>
            <span>📅 ${chapter.date}</span>
            <span>•</span>
            <span>⏱ ${chapter.readTime}</span>
            <span>•</span>
            <span style="color:var(--color-gold-warm);">🔒 Protected Reading</span>
          </div>
        </div>

        <!-- Chapter Story Content with Anti-Copy Protection -->
        <article class="reader-body reader-body-protected" id="reader-body-content" title="Content copying is restricted">
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
                    onclick="if('${prevCh}') window.location.hash='#reader?novel=${novel.id}&ch=${encodeURIComponent(prevCh)}'">
              ⬅ ${t('reader_prev')}
            </button>

            <a href="#novel?id=${novel.id}" class="reader-nav-btn">
              ☰ ${t('reader_all_chapters')}
            </a>

            <button class="reader-nav-btn" ${!nextCh ? 'disabled' : ''} 
                    onclick="if('${nextCh}') window.location.hash='#reader?novel=${novel.id}&ch=${encodeURIComponent(nextCh)}'">
              ${t('reader_next')} ➔
            </button>
          </div>

          <!-- Sharing & Bookmark Bar -->
          <div class="reader-actions-bar">
            <button class="btn btn-gold btn-sm" onclick="bookmarkChapter('${escapeQuotes(novel.id)}', '${escapeQuotes(chNum)}')">
              🔖 Bookmark Chapter
            </button>

            <div class="reader-share-group">
              <span style="font-size:12px; color:var(--color-text-muted);">Share:</span>
              <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '${escapeQuotes(chapter.title)}')">WhatsApp</button>
              <button class="share-btn facebook" onclick="shareChapter('facebook', '${escapeQuotes(chapter.title)}')">Facebook</button>
              <button class="share-btn" onclick="shareChapter('copy', '${escapeQuotes(chapter.title)}')">Copy Link</button>
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
      showToast('Content copying is restricted. 🔒');
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

// 5. FORUM COMMUNITY VIEW
async function renderForumView(container, hash = '') {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const currentCategoryId = urlParams.get('category');
  const currentSubId = urlParams.get('sub') || urlParams.get('subId');

  const token = localStorage.getItem('rp_auth_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  const [hierarchyData, sidebarData, liveStats] = await Promise.all([
    fetch('/api/content/hierarchy', { headers }).then(r => r.json()).catch(() => ({ hierarchy: [] })),
    getSidebarPosts(),
    getForumLiveStats()
  ]);

  const hierarchy = Array.isArray(hierarchyData?.hierarchy) ? hierarchyData.hierarchy : [];
  const currentCategory = currentCategoryId ? hierarchy.find(c => String(c.id) === String(currentCategoryId)) : null;

  // Check if current user is an authorized administrator or writer
  const isAdmin = Boolean(
    window.CURRENT_USER && (
      window.CURRENT_USER.isAdmin || 
      ['admin', 'administrator', 'editor'].includes((window.CURRENT_USER.role || '').toLowerCase())
    )
  );
  const isPrivilegedWriter = Boolean(
    window.CURRENT_USER && (
      isAdmin ||
      ['writer', 'author'].includes((window.CURRENT_USER.role || '').toLowerCase()) ||
      window.CURRENT_USER.isWriter
    )
  );

  // ============================================================================
  // A. DEDICATED SUBTITLE VIEW (e.g. #forms?sub=welcome-notes)
  // ============================================================================
  if (currentSubId) {
    let currentSub = null;
    let parentMain = null;

    for (const cat of hierarchy) {
      const found = (cat.subcategories || []).find(s => String(s.id) === String(currentSubId) || String(s.slug) === String(currentSubId));
      if (found) {
        currentSub = found;
        parentMain = cat;
        break;
      }
    }



    if (currentSub) {
      const subArticles = currentSub.articles || [];

      container.innerHTML = `
        <div class="container forum-page">
          <!-- Breadcrumbs -->
          <nav class="forum-breadcrumbs" aria-label="Forum Breadcrumb">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms &amp; Community</a>
            ${parentMain ? `
              <span class="crumb-separator">›</span>
              <a href="#forms">${escapeHtml(parentMain.title)}</a>
            ` : ''}
            <span class="crumb-separator">›</span>
            <span class="crumb-current">${escapeHtml(currentSub.title)}</span>
          </nav>

          <!-- Subtitle Header Bar -->
          <div class="forms-subpage-header-bar">
            <div class="forms-subpage-left">
              <a href="#forms" class="btn btn-outline btn-sm">« Back to Forms</a>
              ${currentSub.novelId ? `
                <a href="#novel?id=${encodeURIComponent(currentSub.novelId)}" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:4px;">
                  <span>📖</span> Novel Synopsis
                </a>
              ` : ''}
              <div class="forms-subpage-icon-badge">${currentSub.icon || '📌'}</div>
              <div>
                <h1 class="forms-subpage-title">${escapeHtml(currentSub.title)}</h1>
                <div class="forms-subpage-meta">
                  <span class="forms-subpage-cat-tag">${escapeHtml(parentMain?.title || 'General')}</span>
                  <span>•</span>
                  <span>${subArticles.length} Content ${subArticles.length === 1 ? 'Title' : 'Titles'}</span>
                </div>
              </div>
            </div>

            ${isPrivilegedWriter ? `
              <a href="#thread-create?sub=${encodeURIComponent(currentSub.id)}&cat=${encodeURIComponent(parentMain?.id || '')}" class="btn btn-gold btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; text-decoration:none;">
                <span style="font-size:16px;">+</span> Add Thread
              </a>
            ` : ''}
          </div>

          <div class="forum-layout">
            <!-- Main Content Column -->
            <div class="forum-main-col">
              <!-- Compact Aligned Summary Header Row -->
              <div class="forum-summary-bar">
                <div class="forum-summary-stats">
                  <span class="forum-summary-stat-item"><strong>${subArticles.length}</strong> Content ${subArticles.length === 1 ? 'Title' : 'Titles'}</span>
                  <span>•</span>
                  <span class="forum-summary-stat-item"><strong>${currentSub.stats?.totalComments ?? subArticles.reduce((s, a) => s + Number(a.commentsCount || 0), 0)}</strong> Comments</span>
                  <span>•</span>
                  <span class="forum-summary-stat-item"><strong>${Number(currentSub.stats?.totalViews ?? subArticles.reduce((s, a) => s + Number(a.viewsCount || 0), 0)).toLocaleString()}</strong> Views</span>
                </div>
                ${(currentSub.stats?.latestTitle || subArticles[0]?.title) ? `
                  <div class="forum-summary-latest">
                    <span>Latest:</span>
                    <a href="${currentSub.stats?.latestLink || subArticles[0]?.link || '#'}" title="${escapeHtml(currentSub.stats?.latestTitle || subArticles[0]?.title || '')}">
                      ${escapeHtml(currentSub.stats?.latestTitle || subArticles[0]?.title || '')}
                    </a>
                    <span>(${formatLastSeen(currentSub.stats?.latestDate || subArticles[0]?.publishedAt)})</span>
                  </div>
                ` : ''}
              </div>

              <!-- Compact Forum-Style Content Articles Table -->
              <div class="forum-table-card">
                <div class="forum-table-header forum-table-header-articles">
                  <div>Thread Title</div>
                  <div>Author</div>
                  <div class="forum-table-col-center">Comments</div>
                  <div class="forum-table-col-center">Views</div>
                  <div class="forum-table-col-right">Published</div>
                </div>
                <div class="forum-table-body">
                  ${subArticles.length > 0 ? (function renderRows(list, depth = 0) {
                    return list.map(art => `
                      <div class="forum-table-row forum-table-row-articles ${depth > 0 ? 'forum-table-row-nested' : ''}" style="${depth > 0 ? `padding-left:${depth * 22 + 16}px; background:#FDFBF7; border-left:3px solid #C89B3C;` : ''}">
                        <div class="forum-table-cell-title">
                          <span class="forum-table-icon">${depth > 0 ? '↳ 📄' : '📄'}</span>
                          <div class="forum-table-title-meta">
                            <a href="#thread?id=${encodeURIComponent(art.uniqueSlug || art.id)}" class="forum-table-title-link" title="${escapeHtml(art.title)}">${escapeHtml(art.title)}</a>
                            ${art.children && art.children.length > 0 ? `<span class="forms-role-badge" style="margin-left:6px; background:#EDE9FE; color:#5B21B6;">${art.children.length} ${art.children.length === 1 ? 'part' : 'parts'}</span>` : ''}
                          </div>
                        </div>
                        <div class="forum-table-cell-author">
                          ✍️ ${escapeHtml(art.authorName || 'Rudhra Prarthana')}
                        </div>
                        <div class="forum-table-cell-stat">
                          <span class="forum-stat-pill">💬 ${art.commentsCount || 0}</span>
                        </div>
                        <div class="forum-table-cell-stat">
                          <span class="forum-stat-pill">👁 ${Number(art.viewsCount || 0).toLocaleString()}</span>
                        </div>
                        <div class="forum-table-cell-last">
                          <div class="forum-table-meta-subrow">
                            <span class="forum-table-last-date">🕒 ${formatLastSeen(art.publishedAt)}</span>
                            <div class="forum-table-mobile-badges">
                              <span class="forum-stat-pill">💬 ${art.commentsCount || 0}</span>
                              <span class="forum-stat-pill">👁 ${Number(art.viewsCount || 0).toLocaleString()}</span>
                            </div>
                          </div>
                          <a href="#thread?id=${encodeURIComponent(art.uniqueSlug || art.id)}" class="forum-table-last-link" style="color:#B88635; font-size:11px;">Read ➔</a>
                        </div>
                      </div>
                      ${art.children && art.children.length > 0 ? renderRows(art.children, depth + 1) : ''}
                    `).join('');
                  })(subArticles) : `
                    <div class="forms-subpage-empty" style="padding:48px 20px; text-align:center; color:#64748B;">
                      <div style="font-size:32px; margin-bottom:8px;">📝</div>
                      <div style="font-weight:600; color:#0B1F33; margin-bottom:4px;">No Content Titles Yet</div>
                      <p style="font-size:13px; color:#64748B; margin:0 0 14px;">
                        No reading content has been published in this section yet.
                      </p>
                      ${isPrivilegedWriter ? `
                        <a href="#thread-create?sub=${encodeURIComponent(currentSub.id)}&cat=${encodeURIComponent(parentMain?.id || '')}" class="btn btn-gold btn-sm" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; text-decoration:none; margin-top:10px;">
                          + Add Thread
                        </a>
                      ` : ''}
                    </div>
                  `}
                </div>
              </div>

              <!-- Dedicated Forum Discussion Section for Review Forms Title -->
              <div class="forms-discussion-card" style="margin-top:24px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:22px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #F1F5F9; flex-wrap:wrap; gap:8px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:22px;">💬</span>
                    <div>
                      <h2 style="font-family:var(--font-serif, 'Cinzel', serif); font-size:1.25rem; font-weight:700; color:#0B1F33; margin:0;">
                        ${escapeHtml(currentSub.title)} — Discussions &amp; Member Reviews
                      </h2>
                      <p style="font-size:12.5px; color:#64748B; margin:2px 0 0;">
                        Participate in discussions about novels, characters, episodes, stories, and share your reading experiences.
                      </p>
                    </div>
                  </div>
                </div>

                <div id="forms-subcategory-discussion-mount"></div>
              </div>
            </div>

            <!-- Sidebar Panels (Clean, without separate stats panel) -->
            <aside class="forum-sidebar">
              <!-- Latest Posts Panel -->
              <section class="forum-panel" aria-labelledby="sidebar-latest-posts-heading">
                <div class="forum-panel-header">
                  <h3 id="sidebar-latest-posts-heading" class="forum-panel-title">
                    <span>📝</span>
                    <span>Latest Posts</span>
                  </h3>
                  <span class="forum-panel-badge">RECENT</span>
                </div>
                <div id="forum-latest-posts-list" class="forum-panel-list">
                  ${renderSidebarPostItems(sidebarData?.latest)}
                </div>
              </section>

              <!-- Trending Posts Panel -->
              <section class="forum-panel" aria-labelledby="sidebar-trending-posts-heading">
                <div class="forum-panel-header">
                  <h3 id="sidebar-trending-posts-heading" class="forum-panel-title">
                    <span>🔥</span>
                    <span>Trending Posts</span>
                  </h3>
                  <span class="forum-panel-badge" style="background:rgba(217, 119, 6, 0.15); color:#B45309;">POPULAR</span>
                </div>
                <div id="forum-trending-posts-list" class="forum-panel-list">
                  ${renderSidebarPostItems(sidebarData?.trending, { isTrending: true })}
                </div>
              </section>

              <!-- Members Online Panel -->
              <section class="forum-panel forum-presence-panel" aria-labelledby="sidebar-members-online-heading">
                <div class="forum-panel-header">
                  <h3 id="sidebar-members-online-heading" class="forum-panel-title">
                    <span class="presence-live-indicator" aria-hidden="true">
                      <span class="presence-pulse-dot"></span>
                    </span>
                    <span>Members Online</span>
                  </h3>
                  <span class="forum-panel-badge" id="presence-status-badge">LIVE</span>
                </div>

                <div class="presence-stats-grid" id="presence-stats-grid">
                  <div class="presence-stat-card">
                    <div class="presence-stat-num" id="presence-members-count">-</div>
                    <div class="presence-stat-label">Members</div>
                  </div>
                  <div class="presence-stat-card">
                    <div class="presence-stat-num" id="presence-guests-count">-</div>
                    <div class="presence-stat-label">Guests</div>
                  </div>
                  <div class="presence-stat-card presence-stat-total">
                    <div class="presence-stat-num" id="presence-total-count">-</div>
                    <div class="presence-stat-label">Total Online</div>
                  </div>
                </div>

                <div class="presence-members-block">
                  <div class="presence-subhead">
                    <span>Active Members</span>
                    <span class="presence-subhead-count" id="presence-visible-count"></span>
                  </div>
                  <div id="forum-online-members-list" class="presence-members-list">
                    <div class="presence-loading-skeleton">Loading active members...</div>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      `;

      loadForumMembersOnline();
      renderCommentsWidget('forms-subcategory-discussion-mount', `review_sub_${currentSub.id}`, 0);
      return;
    }
  }

  // ============================================================================
  // B. MAIN FORMS OVERVIEW PAGE
  // ============================================================================
  const activeCategoryTitle = currentCategory ? currentCategory.title : 'Forms & Reader Forum';

  container.innerHTML = `
    <div class="container forum-page">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" aria-label="Forum Breadcrumb">
        <a href="#forms">Home</a>
        <span class="crumb-separator">›</span>
        ${currentCategoryId ? `
          <a href="#forms">Forms &amp; Community</a>
          <span class="crumb-separator">›</span>
          <span class="crumb-current">${escapeHtml(currentCategory?.title || 'Category')}</span>
        ` : `
          <span class="crumb-current">Forms &amp; Reader Community</span>
        `}
      </nav>

      ${!currentCategoryId ? `
        <!-- 1. Welcoming Hero Section -->
        <section class="forms-hero-section" id="forms-hero-section" aria-label="Forms Welcome Hero">
          <div class="forms-hero-overlay">
            <div class="forms-hero-badge">
              <span>WELCOME</span>
            </div>

            <h1 class="forms-hero-title">Rudhra Prarthana Novels</h1>

            <div class="forms-hero-divider">
              <span class="forms-hero-divider-line"></span>
              <span class="forms-hero-divider-glyph">🪶</span>
              <span class="forms-hero-divider-line"></span>
            </div>

            <p class="forms-hero-subtitle">
              Touch-the-heart family novels, captivating romance, and a warm community for passionate readers.
            </p>

            <div class="forms-hero-actions">
              <a href="#novels" class="btn btn-primary btn-lg forms-hero-btn-primary">
                <span>Explore Novels</span>
                <span>➔</span>
              </a>
            </div>
          </div>
        </section>
      ` : `
        <div class="forum-header-bar">
          <div>
            <a href="#forms" class="section-link" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:8px; font-weight:600;">
              « Back to All Categories
            </a>
            <span class="section-subtitle">${t('forum_subtitle')}</span>
            <h1 class="section-title">${escapeHtml(activeCategoryTitle)}</h1>
          </div>
          <div>
            <div class="forum-live-stats-bar" id="forum-live-stats-bar" aria-label="Forum Live Statistics">
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">👥</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">${Number(liveStats?.totalMembers || 0)}</span>
                  <span class="forum-stat-lbl">Members</span>
                </div>
              </div>
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">💬</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">${Number(liveStats?.totalReplies || 0)}</span>
                  <span class="forum-stat-lbl">Replies</span>
                </div>
              </div>
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">🌐</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">${Number(liveStats?.totalGuests || 0)}</span>
                  <span class="forum-stat-lbl">Guests Visited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `}

      <div class="forum-layout">
        <!-- Main Content Column -->
        <div class="forum-main-col">
          <div class="forms-categories-container" id="forms-categories-root">
            ${(currentCategoryId ? hierarchy.filter(c => c.id === currentCategoryId) : hierarchy).map(cat => {
              const subs = cat.subcategories || [];
              const novels = cat.novels || [];
              const isAudio = cat.id === 'audio-novels';

              const totalCatComments = subs.length > 0
                ? (cat.stats?.totalComments ?? subs.reduce((s, sub) => s + (sub.stats?.totalComments || 0), 0))
                : (cat.stats?.totalComments ?? novels.reduce((s, n) => s + Number(n.commentsCount || 0), 0));

              const totalCatViews = subs.length > 0
                ? (cat.stats?.totalViews ?? subs.reduce((s, sub) => s + (sub.stats?.totalViews || 0), 0))
                : (cat.stats?.totalViews ?? novels.reduce((s, n) => s + Number(n.viewsCount || 0), 0));

              const totalCatItems = subs.length > 0
                ? (cat.stats?.totalItems ?? subs.reduce((s, sub) => s + (sub.articles?.length || 0), 0))
                : (cat.stats?.totalItems ?? novels.length);

              const latestTitle = cat.stats?.latestTitle || (novels[0]?.title ? `${novels[0].title} — ${novels[0].latestEpisodeTitle || 'Latest Release'}` : (subs[0]?.stats?.latestTitle || null));
              const latestLink = cat.stats?.latestLink || (novels[0]?.readLink || novels[0]?.link || (subs[0]?.stats?.latestLink || '#'));
              const latestDate = cat.stats?.latestDate || (novels[0]?.updatedDate || (subs[0]?.stats?.latestDate || null));

              return `
                <div class="forms-category-section" id="cat-sec-${escapeHtml(cat.id)}">
                  <!-- Royal-Purple Header Bar -->
                  <div class="forms-cat-header-bar" style="background: linear-gradient(90deg, #1A0B2E 0%, ${escapeHtml(cat.color || '#2E1065')} 60%, #3B0764 100%);">
                    <div class="forms-cat-title-group">
                      <div class="forms-cat-icon">${cat.icon || '💬'}</div>
                      <div>
                        <a href="#forms?category=${encodeURIComponent(cat.id)}" style="text-decoration:none; color:inherit;" title="View all in ${escapeHtml(cat.title)}">
                          <h2 class="forms-cat-name">${escapeHtml(cat.title)}</h2>
                        </a>
                      </div>
                    </div>
                    <div class="forms-cat-actions">
                      <span class="forms-cat-pill">${subs.length > 0 ? `${subs.length} Sections` : `${novels.length} Novels`}</span>
                    </div>
                  </div>

                  <!-- Aligned Summary Header Row Above Content List -->
                  <div class="forum-summary-bar" style="margin:12px 16px 14px;">
                    <div class="forum-summary-stats">
                      <span class="forum-summary-stat-item">
                        <strong>${subs.length > 0 ? subs.length : novels.length}</strong> ${subs.length > 0 ? (subs.length === 1 ? 'Subcategory' : 'Subcategories') : (novels.length === 1 ? 'Novel' : 'Novels')}
                      </span>
                      ${subs.length > 0 ? `
                        <span>•</span>
                        <span class="forum-summary-stat-item"><strong>${totalCatItems}</strong> ${totalCatItems === 1 ? 'Title' : 'Titles'}</span>
                      ` : ''}
                      <span>•</span>
                      <span class="forum-summary-stat-item"><strong>${totalCatComments}</strong> Comments</span>
                      <span>•</span>
                      <span class="forum-summary-stat-item"><strong>${Number(totalCatViews).toLocaleString()}</strong> Views</span>
                    </div>
                    ${latestTitle ? `
                      <div class="forum-summary-latest">
                        <span>Latest:</span>
                        <a href="${latestLink}">${escapeHtml(latestTitle)}</a>
                        ${latestDate ? `<span>(${formatLastSeen(latestDate)})</span>` : ''}
                      </div>
                    ` : ''}
                  </div>

                  <!-- 1. General Subcategories Table Layout (Welcome Notes, Announcements, Tea Time) -->
                  ${subs.length > 0 ? `
                    <div class="forum-table-card" style="margin:0 16px 16px; width:calc(100% - 32px);">
                      <div class="forum-table-header forum-table-header-articles">
                        <div>Subcategory / Section</div>
                        <div>Content Count</div>
                        <div class="forum-table-col-center">Comments</div>
                        <div class="forum-table-col-center">Views</div>
                        <div class="forum-table-col-right">Latest Activity</div>
                      </div>
                      <div class="forum-table-body">
                        ${subs.map(sub => {
                          const subLink = `#forms?sub=${encodeURIComponent(sub.id)}`;
                          const noteCount = sub.articles?.length || 0;
                          const subComments = sub.stats?.totalComments ?? (sub.articles || []).reduce((s, a) => s + Number(a.commentsCount || 0), 0);
                          const subViews = sub.stats?.totalViews ?? (sub.articles || []).reduce((s, a) => s + Number(a.viewsCount || 0), 0);
                          const latestArt = sub.stats?.latestTitle ? { title: sub.stats.latestTitle, link: sub.stats.latestLink || subLink, date: sub.stats.latestDate } : (sub.articles && sub.articles[0]);

                          return `
                            <div class="forum-table-row forum-table-row-articles">
                              <div class="forum-table-cell-title">
                                <span class="forum-table-icon">${sub.icon || '📌'}</span>
                                <div class="forum-table-title-meta">
                                  <a href="${subLink}" class="forms-sub-title-link" title="Open ${escapeHtml(sub.title)}">${escapeHtml(sub.title)}</a>
                                  <span class="forum-table-tagline">Click to view all ${noteCount} content titles</span>
                                </div>
                              </div>
                              <div class="forum-table-cell-author">
                                <span class="forum-stat-pill">📄 ${noteCount} ${noteCount === 1 ? 'Title' : 'Titles'}</span>
                              </div>
                              <div class="forum-table-cell-stat">
                                <span class="forum-stat-pill">💬 ${subComments}</span>
                              </div>
                              <div class="forum-table-cell-stat">
                                <span class="forum-stat-pill">👁 ${Number(subViews).toLocaleString()}</span>
                              </div>
                              <div class="forum-table-cell-last">
                                ${latestArt ? `
                                  <div class="forum-table-last-row">
                                    <span class="forum-table-last-label">Latest:</span>
                                    <a href="${latestArt.link || subLink}" class="forum-table-last-link" title="${escapeHtml(latestArt.title)}">${escapeHtml(latestArt.title)}</a>
                                  </div>
                                  <div class="forum-table-meta-subrow">
                                    <span class="forum-table-last-date">🕒 ${formatLastSeen(latestArt.publishedAt || latestArt.date)}</span>
                                    <div class="forum-table-mobile-badges">
                                      <span class="forum-stat-pill">💬 ${subComments}</span>
                                      <span class="forum-stat-pill">👁 ${Number(subViews).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ` : `
                                  <div class="forum-table-meta-subrow">
                                    <span class="forum-table-last-date" style="color:#94A3B8;">No threads yet</span>
                                    <div class="forum-table-mobile-badges">
                                      <span class="forum-stat-pill">💬 ${subComments}</span>
                                      <span class="forum-stat-pill">👁 ${Number(subViews).toLocaleString()}</span>
                                    </div>
                                  </div>
                                `}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <!-- 2. Compact Forum Table Layout for Novels & Stories -->
                  ${novels.length > 0 ? `
                    ${subs.length > 0 ? `
                      <div style="font-size:12px; font-weight:700; color:#856404; text-transform:uppercase; letter-spacing:0.75px; margin:18px 20px 8px; display:flex; align-items:center; gap:6px;">
                        <span>📚</span> Associated Catalog Novels &amp; Releases
                      </div>
                    ` : ''}
                    <div class="forum-table-card" style="margin:0 16px 16px; width:calc(100% - 32px);">
                      <div class="forum-table-header forum-table-header-novels">
                        <div>Novel / Story</div>
                        <div>Latest Episode / Release</div>
                        <div>Author</div>
                        <div class="forum-table-col-center">Replies</div>
                        <div class="forum-table-col-center">Views</div>
                        <div class="forum-table-col-right">Last Updated</div>
                      </div>
                      <div class="forum-table-body">
                        ${novels.map(n => {
                          const novelLink = n.link || `#novel?id=${encodeURIComponent(n.id)}`;
                          const episodeLink = isAudio ? '#audio' : (n.readLink || `#reader?novel=${encodeURIComponent(n.id)}&ch=${encodeURIComponent(n.latestEpisodeNum || '1')}`);

                          return `
                            <div class="forum-table-row forum-table-row-novels">
                              <div class="forum-table-cell-title">
                                <img src="${n.cover || '/default-cover.jpg'}" alt="${escapeHtml(n.title)}" class="forum-table-thumb" onerror="this.src='/default-cover.jpg';">
                                <div class="forum-table-title-meta">
                                  <a href="${novelLink}" class="forum-table-title-link" title="Open ${escapeHtml(n.title)}">${escapeHtml(n.title)}</a>
                                  <span class="forum-table-tagline">${isAudio ? `🎙️ ${escapeHtml(n.voice || n.author || 'Rudhra Prarthana')}` : (n.category || 'Novel')}</span>
                                </div>
                              </div>
                              <div style="font-size:12px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <a href="${episodeLink}" class="forum-table-last-link" title="Read ${escapeHtml(n.latestEpisodeTitle || 'Latest Release')}">
                                  ${isAudio ? '▶ Full Audio Novel' : `📖 ${escapeHtml(n.latestEpisodeTitle || 'Latest Release')}`}
                                </a>
                              </div>
                              <div class="forum-table-cell-author">
                                ✍️ ${escapeHtml(n.author || 'Rudhra Prarthana')}
                              </div>
                              <div class="forum-table-cell-stat">
                                <span class="forum-stat-pill">💬 ${n.commentsCount || 0}</span>
                              </div>
                              <div class="forum-table-cell-stat">
                                <span class="forum-stat-pill">👁 ${Number(n.viewsCount || 0).toLocaleString()}</span>
                              </div>
                              <div class="forum-table-cell-last">
                                <div class="forum-table-meta-subrow">
                                  <span class="forum-table-last-date">🕒 ${escapeHtml(n.updatedDate || 'Recent')}</span>
                                  <div class="forum-table-mobile-badges">
                                    <span class="forum-stat-pill">💬 ${n.commentsCount || 0}</span>
                                    <span class="forum-stat-pill">👁 ${Number(n.viewsCount || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                                <a href="${novelLink}" class="forum-table-last-link" style="color:#B88635; font-size:11px;">View Novel ➔</a>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${subs.length === 0 && novels.length === 0 ? `
                    <div class="forms-cat-empty">
                      <span>No discussions or notes in <strong>${escapeHtml(cat.title)}</strong> yet.</span>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Sidebar Panels (Clean, without separate stats panel) -->
        <aside class="forum-sidebar">
          <!-- Latest Posts Panel -->
          <section class="forum-panel" aria-labelledby="sidebar-latest-posts-heading">
            <div class="forum-panel-header">
              <h3 id="sidebar-latest-posts-heading" class="forum-panel-title">
                <span>📝</span>
                <span>Latest Posts</span>
              </h3>
              <span class="forum-panel-badge">RECENT</span>
            </div>
            <div id="forum-latest-posts-list" class="forum-panel-list">
              ${renderSidebarPostItems(sidebarData?.latest)}
            </div>
          </section>

          <!-- Trending Posts Panel -->
          <section class="forum-panel" aria-labelledby="sidebar-trending-posts-heading">
            <div class="forum-panel-header">
              <h3 id="sidebar-trending-posts-heading" class="forum-panel-title">
                <span>🔥</span>
                <span>Trending Posts</span>
              </h3>
              <span class="forum-panel-badge" style="background:rgba(217, 119, 6, 0.15); color:#B45309;">POPULAR</span>
            </div>
            <div id="forum-trending-posts-list" class="forum-panel-list">
              ${renderSidebarPostItems(sidebarData?.trending, { isTrending: true })}
            </div>
          </section>

          <!-- Members Online Panel -->
          <section class="forum-panel forum-presence-panel" aria-labelledby="sidebar-members-online-heading">
            <div class="forum-panel-header">
              <h3 id="sidebar-members-online-heading" class="forum-panel-title">
                <span class="presence-live-indicator" aria-hidden="true">
                  <span class="presence-pulse-dot"></span>
                </span>
                <span>Members Online</span>
              </h3>
              <span class="forum-panel-badge" id="presence-status-badge">LIVE</span>
            </div>

            <div class="presence-stats-grid" id="presence-stats-grid">
              <div class="presence-stat-card">
                <div class="presence-stat-num" id="presence-members-count">-</div>
                <div class="presence-stat-label">Members</div>
              </div>
              <div class="presence-stat-card">
                <div class="presence-stat-num" id="presence-guests-count">-</div>
                <div class="presence-stat-label">Guests</div>
              </div>
              <div class="presence-stat-card presence-stat-total">
                <div class="presence-stat-num" id="presence-total-count">-</div>
                <div class="presence-stat-label">Total Online</div>
              </div>
            </div>

            <div class="presence-members-block">
              <div class="presence-subhead">
                <span>Active Members</span>
                <span class="presence-subhead-count" id="presence-visible-count"></span>
              </div>
              <div id="forum-online-members-list" class="presence-members-list">
                <div class="presence-loading-skeleton">Loading active members...</div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  loadForumMembersOnline();

  // Periodic refresh for live statistics
  if (window._rpForumStatsInterval) {
    clearInterval(window._rpForumStatsInterval);
  }
  window._rpForumStatsInterval = setInterval(() => {
    if (document.getElementById('forum-live-stats-bar')) {
      refreshForumLiveStats();
    } else {
      clearInterval(window._rpForumStatsInterval);
      window._rpForumStatsInterval = null;
    }
  }, 30000);
}

export async function refreshForumLiveStats() {
  const membersEl = document.getElementById('forum-stat-members');
  const repliesEl = document.getElementById('forum-stat-replies');
  const guestsEl = document.getElementById('forum-stat-guests');
  if (!membersEl && !repliesEl && !guestsEl) return;

  try {
    const stats = await getForumLiveStats();
    if (membersEl) membersEl.textContent = Number(stats?.totalMembers || 0);
    if (repliesEl) repliesEl.textContent = Number(stats?.totalReplies || 0);
    if (guestsEl) guestsEl.textContent = Number(stats?.totalGuests || 0);
  } catch (err) {
    console.warn('[Forum Live Stats] Refresh error:', err);
  }
}

// Global listener for forum live updates to re-fetch sidebar and live stats
if (typeof window !== 'undefined' && !window._rpForumListenerBound) {
  window._rpForumListenerBound = true;
  window.addEventListener('rp:forum-updated', () => {
    if (document.getElementById('forum-latest-posts-list')) {
      loadForumSidebarPosts(true);
    }
    refreshForumLiveStats();
  });
}

function getSidebarSkeletonHtml(count = 4) {
  return `
    <div class="sidebar-loading-state" aria-hidden="true">
      ${Array(count).fill(0).map(() => `
        <div class="sidebar-skeleton-item">
          <div class="sidebar-skeleton-avatar"></div>
          <div class="sidebar-skeleton-lines">
            <div class="sidebar-skeleton-line" style="width:85%;"></div>
            <div class="sidebar-skeleton-line" style="width:55%; height:9px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSidebarPostItems(posts, { isTrending = false } = {}) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return `
      <div class="sidebar-empty-state" style="text-align:center; padding:24px 16px;">
        <div style="font-size:24px; margin-bottom:6px;">📭</div>
        <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep); margin-bottom:2px;">No posts yet</div>
        <div style="font-size:12px; color:var(--color-text-muted);">Activity will appear here as discussions and content are updated.</div>
      </div>
    `;
  }

  return posts.map((post, index) => {
    const avatarUrl = getAvatarUrl(post.avatar);
    const safeTitle = escapeHtml(post.title || 'Untitled');
    const safeLastAuthor = escapeHtml(post.lastAuthor || post.author || 'Member');
    const safeTime = escapeHtml(post.timeDisplay || 'Recently');
    const replies = Number(post.replies ?? 0);
    const views = Number(post.views ?? 0);
    const link = post.link || `#topic?id=${encodeURIComponent(post.id)}`;
    const rankBadge = isTrending ? `<span class="trending-rank-pill ${index < 3 ? 'top-rank' : ''}">#${index + 1}</span>` : '';

    return `
      <article class="sidebar-post-item ${isTrending ? 'trending-post-item' : ''}">
        <div class="sidebar-post-avatar-wrap">
          <img src="${avatarUrl}" alt="${safeLastAuthor}" class="sidebar-post-avatar" onerror="this.onerror=null;this.src='/profile.png';" loading="lazy">
          ${rankBadge}
        </div>
        <div class="sidebar-post-content">
          <a href="${link}" class="sidebar-post-title" title="${safeTitle}">${safeTitle}</a>
          <div class="sidebar-post-updater">
            Last updated by <strong class="sidebar-updater-name">${safeLastAuthor}</strong>
          </div>
          <div class="sidebar-post-meta-line">
            <span class="meta-item">🕐 ${safeTime}</span>
            <span class="meta-dot">·</span>
            <span class="meta-item">💬 ${replies} ${replies === 1 ? 'reply' : 'replies'}</span>
            <span class="meta-dot">·</span>
            <span class="meta-item">👁️ ${views.toLocaleString()} ${views === 1 ? 'view' : 'views'}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function loadForumSidebarPosts(forceRefresh = false) {
  const latestContainer = document.getElementById('forum-latest-posts-list');
  const trendingContainer = document.getElementById('forum-trending-posts-list');
  if (!latestContainer || !trendingContainer) return;

  try {
    const data = await getSidebarPosts(forceRefresh);
    if (!document.getElementById('forum-latest-posts-list')) return;

    latestContainer.innerHTML = renderSidebarPostItems(data?.latest);
    trendingContainer.innerHTML = renderSidebarPostItems(data?.trending, { isTrending: true });
  } catch (err) {
    console.error('[Forum Sidebar] Error loading posts:', err);
    const errorHtml = `
      <div class="sidebar-empty-state" style="text-align:center; padding:24px 16px;">
        <div style="font-size:24px; margin-bottom:6px;">⚠️</div>
        <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep);">Unable to load posts</div>
      </div>
    `;
    if (latestContainer) latestContainer.innerHTML = errorHtml;
    if (trendingContainer) trendingContainer.innerHTML = errorHtml;
  }
}

let _presenceHeartbeatTimer = null;
function initPresenceHeartbeat() {
  if (typeof window === 'undefined') return;

  // Immediate ping on boot
  pingPresenceHeartbeat().then(() => {
    if (document.getElementById('presence-stats-grid')) {
      loadForumMembersOnline();
    }
  });

  // Regular heartbeat interval (every 35s)
  if (!_presenceHeartbeatTimer) {
    _presenceHeartbeatTimer = setInterval(() => {
      pingPresenceHeartbeat().then(() => {
        if (document.getElementById('presence-stats-grid')) {
          loadForumMembersOnline();
        }
      });
    }, 35000);
  }

  // Ping on tab visibility restore
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pingPresenceHeartbeat().then(() => {
        if (document.getElementById('presence-stats-grid')) {
          loadForumMembersOnline();
        }
      });
    }
  });

  // Listen for auth state changes to update presence instantly
  window.addEventListener('rp:auth-changed', () => {
    pingPresenceHeartbeat().then(() => {
      if (document.getElementById('presence-stats-grid')) {
        loadForumMembersOnline(true);
      }
    });
  });
}

export async function loadForumMembersOnline(forceRefresh = false) {
  const membersEl = document.getElementById('forum-online-members-list');
  const membersCountEl = document.getElementById('presence-members-count');
  const guestsCountEl = document.getElementById('presence-guests-count');
  const totalCountEl = document.getElementById('presence-total-count');
  const visibleCountEl = document.getElementById('presence-visible-count');

  if (!membersEl && !membersCountEl) return;

  try {
    const data = await getOnlinePresence();
    if (!data || !data.success) {
      if (membersEl) {
        membersEl.innerHTML = `
          <div class="presence-empty-state">
            <span style="font-size:16px;">⚠️</span>
            <span>Presence temporarily unavailable</span>
          </div>
        `;
      }
      return;
    }

    if (membersCountEl) membersCountEl.textContent = data.membersOnline ?? 0;
    if (guestsCountEl) guestsCountEl.textContent = data.guestsOnline ?? 0;
    if (totalCountEl) totalCountEl.textContent = data.totalOnline ?? 0;

    if (visibleCountEl) {
      if (data.hiddenMembersCount > 0) {
        visibleCountEl.textContent = `${data.visibleMembersCount} visible (${data.hiddenMembersCount} private)`;
      } else {
        visibleCountEl.textContent = `${data.visibleMembersCount || 0} active`;
      }
    }

    if (membersEl) {
      if (!Array.isArray(data.visibleMembers) || data.visibleMembers.length === 0) {
        membersEl.innerHTML = `
          <div class="presence-empty-state">
            <span style="font-size:18px;">👥</span>
            <span style="font-weight:600; color:var(--color-navy-deep);">No members currently online</span>
            <span style="font-size:11px; opacity:0.8;">Guests are currently browsing</span>
          </div>
        `;
      } else {
        membersEl.innerHTML = data.visibleMembers.map(m => {
          const mName = m.displayName || m.username;
          const isPrivileged = Boolean(m.role && ['admin', 'administrator', 'author'].includes(m.role.toLowerCase()));
          const roleLabel = isPrivileged 
            ? (m.role.toLowerCase() === 'author' ? 'Author' : 'Admin')
            : (m.role || 'Member');
          const badgeHtml = isPrivileged
            ? `<span class="presence-member-badge" style="background:#FEF3C7; color:#B45309; border:1px solid #FCD34D;">👑 ${escapeQuotes(roleLabel)}</span>`
            : `<span class="presence-member-badge">${escapeQuotes(roleLabel)}</span>`;
          const avatarUrl = getAvatarUrl(m.avatar);

          return `
            <a href="#member?id=${encodeURIComponent(m.username || m.id)}" class="presence-member-row" title="${escapeQuotes(mName)}">
              <div class="presence-member-avatar-box">
                <img src="${avatarUrl}" class="presence-member-avatar-img" alt="${escapeQuotes(mName)}" onerror="this.src='/profile.png'">
                <span class="presence-status-online-dot" title="Online now"></span>
              </div>
              <div class="presence-member-meta">
                <span class="presence-member-name">${escapeHtml(mName)}</span>
                <span style="font-size:10px; color:var(--color-text-muted);">@${escapeHtml(m.username)}</span>
              </div>
              ${badgeHtml}
            </a>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('[Presence] UI update error:', err);
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 6. TOPIC THREAD VIEW
async function renderTopicView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const topicId = urlParams.get('id');
  if (!topicId) {
    window.location.hash = '#novels';
    return;
  }

  // Track member topic read activity
  if (window.IS_LOGGED_IN && topicId) {
    apiFetch(`/api/forum/topics/${encodeURIComponent(topicId)}/read`, { method: 'POST' }).catch(() => {});
  }

  const topic = await getForumTopicById(topicId);
  if (!topic) {
    renderNotFound(container);
    return;
  }

  if (topic.novelId) {
    const chParam = topic.chapterNum ? `&ch=${encodeURIComponent(topic.chapterNum)}` : '';
    window.location.hash = `#novel?id=${encodeURIComponent(topic.novelId)}${chParam}#comments`;
    return;
  }

  return renderDiscussionThread(container, topic);
}

async function renderDiscussionThread(container, topic) {

  const backLink = topic.categoryId ? `#forum?category=${encodeURIComponent(topic.categoryId)}` : '#forum';

  container.innerHTML = `
    <div class="container section">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" aria-label="Thread Breadcrumb">
        <a href="#forms">Home</a>
        <span class="crumb-separator">›</span>
        <a href="#forum">Forum</a>
        <span class="crumb-separator">›</span>
        <a href="${backLink}">${escapeHtml(topic.categoryTitle || 'Category')}</a>
        <span class="crumb-separator">›</span>
        <span class="crumb-current">${escapeHtml(topic.title)}</span>
      </nav>

      <div style="margin-bottom:var(--space-6);">
        <a href="${backLink}" class="section-link" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:10px;">
          « Back to ${escapeHtml(topic.categoryTitle || 'Forum')}
        </a>
        <h1 style="font-family:var(--font-serif); font-size:2.2rem; color:var(--color-navy-deep); margin:4px 0 10px 0; word-break:break-word;">${escapeHtml(topic.title)}</h1>
        <div style="font-size:12px; color:var(--color-text-muted); display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          <a href="${backLink}" style="background:#FAF5EC; color:var(--color-gold-warm); padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid #E8DCCB; text-decoration:none;">${escapeHtml(topic.categoryTitle)}</a>
          <span>✍️ Started by: <strong style="color:var(--color-navy-deep);">${escapeHtml(topic.author)}</strong></span>
          <span>👁 Views: <strong>${topic.views}</strong></span>
          <span>💬 Replies: <strong>${topic.repliesCount}</strong></span>
          <span>📅 ${formatLastSeen(topic.date)}</span>
        </div>
      </div>

      <!-- Posts Stream -->
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${topic.posts.map((post, idx) => {
          const postAuthor = post.author;
          const postAvatar = getAvatarUrl(post.avatar);
          const isPrivileged = Boolean(post.role && ['admin', 'administrator', 'editor', 'author'].includes(post.role.toLowerCase()));
          const roleBadge = isPrivileged 
            ? `<span style="font-size:10.5px; font-weight:700; color:#B45309; background:#FEF3C7; border:1px solid #FCD34D; padding:1px 6px; border-radius:10px; margin-left:6px;">👑 ${escapeHtml(post.userTitle || post.role)}</span>` 
            : '';
          const postDateDisplay = formatLastSeen(post.date) !== 'Offline' ? formatLastSeen(post.date) : (post.date || 'Recently');
          
          // Identify parent post if nested reply
          const parentPost = post.parentId ? topic.posts.find(p => String(p.id) === String(post.parentId)) : null;
          const parentIdx = parentPost ? topic.posts.indexOf(parentPost) : -1;

          return `
            <div class="topic-post-card" id="post-${post.id}" style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-sm);">
              <div class="post-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:10px;">
                <div class="post-author-box" style="display:flex; align-items:center; gap:12px;">
                  <img src="${postAvatar}" style="width:44px; height:44px; border-radius:var(--radius-full); object-fit:cover; border:2px solid var(--color-gold-light);" alt="${escapeHtml(postAuthor)}" onerror="this.src='/profile.png'">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="post-author-name" style="font-weight:700; color:var(--color-navy-deep); font-size:14px;">${escapeHtml(postAuthor)}</span>
                      ${roleBadge}
                    </div>
                    <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">#${idx + 1} • ${postDateDisplay}</div>
                  </div>
                </div>
              </div>

              ${parentPost ? `
                <div class="nested-reply-indicator">
                  ↳ Replying to #${parentIdx + 1} (<strong>@${escapeHtml(parentPost.author)}</strong>)
                </div>
              ` : ''}

              <div class="post-content-body" style="line-height:1.7; font-size:14.5px; color:#2D3748; white-space:pre-wrap; word-break:break-word;">${escapeHtml(post.content)}</div>

              <div class="post-actions-bar" style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:10px; border-top:1px dashed var(--color-border);">
                <div class="reaction-group" id="reactions-${post.id}">
                  ${renderReactionButtons(topic.id, post, false)}
                </div>

                <div class="post-reply-actions" style="display:flex; gap:8px;">
                  <button type="button" class="btn btn-outline btn-sm" onclick="setReplyingToPost('${escapeQuotes(post.id)}', '${escapeQuotes(postAuthor)}')">
                    Reply ↳
                  </button>
                  <button type="button" class="btn btn-outline btn-sm" onclick="quotePost('${escapeQuotes(postAuthor)}', '${escapeQuotes(post.content)}')">
                    Quote
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Reply Box -->
      <div class="topic-post-card" style="border:2px solid var(--color-border); background:var(--color-card-bg); border-radius:var(--radius-lg); padding:24px; margin-top:20px;">
        <h3 style="font-family:var(--font-serif); font-size:1.3rem; margin-bottom:12px; color:var(--color-navy-deep);">Leave a Reply</h3>

        <!-- Replying to Indicator Banner -->
        <div id="replying-to-indicator" class="replying-to-indicator-banner" style="display:none;">
          <span>Replying to <strong id="replying-to-author">Member</strong></span>
          <button type="button" class="replying-to-cancel-btn" onclick="cancelReplyToPost()">✕ Cancel</button>
        </div>

        ${window.IS_LOGGED_IN ? `
          <textarea id="topic-reply-input" class="form-input" rows="4" placeholder="${t('forum_reply_placeholder') || 'Write your reply or share your thoughts with the community...'}" style="width:100%; box-sizing:border-box; resize:vertical;"></textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:12px;">
            <button type="button" id="topic-reply-submit-btn" class="btn btn-gold btn-sm" onclick="submitForumReply('${escapeQuotes(topic.id)}')">
              Post Reply 💬
            </button>
          </div>
        ` : `
          <div style="text-align:center; padding:20px; background:#FAF5EC; border:1px solid #E8DCCB; border-radius:8px;">
            <p style="font-size:13.5px; color:var(--color-navy-deep); margin-bottom:12px; font-weight:600;">
              🔒 Please log in to join this discussion and post a reply.
            </p>
            <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">Log In to Reply</button>
          </div>
        `}
      </div>

      <!-- Novel Comment Invitation Banner -->
      <div style="background:#FAF5EC; border:1px solid #E8DCCB; border-radius:var(--radius-lg); padding:16px 20px; margin-top:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="font-size:13px; color:var(--color-navy-deep);">
          <strong>📖 Want to discuss or review our novels?</strong>
          <span style="color:var(--color-text-muted); margin-left:6px;">Use the rich-text comment box on any novel or episode page to share your thoughts, emojis, and reactions!</span>
        </div>
        <a href="#novels" class="btn btn-gold btn-sm">Browse Novels & Comment ➔</a>
      </div>
    </div>
  `;
}

function formatLastSeen(isoStr) {
  if (!isoStr) return 'Offline';
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Offline';
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
    const data = await getMembersList();
    if (data && Array.isArray(data.members)) {
      membersList = data.members;
      SITE_DATA.members = data.members;
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
            <h3 style="color: var(--color-navy-deep); margin-bottom: 8px;">No Members Found</h3>
            <p style="color: var(--color-text-muted);">Only registered users will appear in this directory.</p>
          </div>
        ` : membersList.map(m => {
    const mName = escapeHtml(m.displayName || m.name || m.username);
    const mAvatar = getAvatarUrl(m.avatar);

    let statusBadge = '';
    let avatarDot = '';
    let readingBox = '';
    if (!m.statusHidden) {
      if (m.isOnline) {
        statusBadge = `<div class="status-indicator online"><span class="status-dot green"></span> Active now</div>`;
        avatarDot = `<span class="status-dot green" style="position:absolute; bottom:2px; right:2px; border:2px solid #FFFFFF;"></span>`;
      } else if (m.lastSeen) {
        statusBadge = `<div class="status-indicator offline">⏱ Last active ${escapeHtml(m.lastSeenText || formatLastSeen(m.lastSeen))}</div>`;
      } else {
        statusBadge = `<div class="status-indicator offline"><span class="status-dot" style="background:#94a3b8;"></span> Member</div>`;
      }

      if (m.currentReading) {
        readingBox = `
          <div class="member-reading-activity active-read">
            <div class="reading-line"><span class="reading-icon">📖</span> <span class="reading-lbl">Reading:</span> <strong class="reading-val" title="${escapeHtml(m.currentReading.novelTitle)}">${escapeHtml(m.currentReading.novelTitle)}</strong></div>
            <div class="reading-line"><span class="reading-icon">⏱</span> <span class="reading-lbl">Reading for:</span> <span class="reading-val">${escapeHtml(m.currentReading.duration)}</span></div>
          </div>
        `;
      } else if (m.lastRead) {
        readingBox = `
          <div class="member-reading-activity last-read">
            <div class="reading-line"><span class="reading-icon">📚</span> <span class="reading-lbl">Last read:</span> <strong class="reading-val" title="${escapeHtml(m.lastRead.novelTitle)}">${escapeHtml(m.lastRead.novelTitle)}</strong></div>
            <div class="reading-line"><span class="reading-icon">🕒</span> <span class="reading-lbl">Last read:</span> <span class="reading-val">${escapeHtml(m.lastRead.lastReadAgo || 'Recently')}</span></div>
          </div>
        `;
      }
    }

    return `
          <div class="member-card">
            <div class="member-avatar-wrap">
              <img src="${mAvatar}" class="member-avatar" alt="${mName}" onerror="this.src='/profile.png';">
              ${avatarDot}
            </div>
            <h3 class="member-name">${mName}</h3>
            <span class="member-role-title">${escapeHtml(m.title || 'Member')}</span>
            <div class="member-status-box">
              ${statusBadge}
              ${readingBox}
            </div>
            <div class="member-stats-row">
              <div class="member-stat-box">
                <span class="member-stat-val">${m.postsCount ?? 0}</span>
                <span class="member-stat-lbl">Posts</span>
              </div>
              <div class="member-stat-box">
                <span class="member-stat-val">${m.topicsCount ?? 0}</span>
                <span class="member-stat-lbl">Topics</span>
              </div>
              <div class="member-stat-box">
                <span class="member-stat-val">${m.followersCount ?? 0}</span>
                <span class="member-stat-lbl">Readers</span>
              </div>
            </div>
            <div class="member-card-actions">
              <a href="#member?id=${encodeURIComponent(m.username || m.id)}" class="btn btn-outline btn-sm">${t('members_view_profile')}</a>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

// 8. MEMBER PROFILE VIEW WITH INSTAGRAM-STYLE REDESIGN
async function renderMemberProfileView(container, hash) {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const memberParam = urlParams.get('id') || (window.CURRENT_USER ? window.CURRENT_USER.username : 'rudhra');

  let member = null;
  if (window.CURRENT_USER && (memberParam === 'me' || memberParam === window.CURRENT_USER.username || String(memberParam) === String(window.CURRENT_USER.id))) {
    member = window.CURRENT_USER;
  } else if (SITE_DATA.members && SITE_DATA.members.length > 0) {
    member = SITE_DATA.members.find(m => m.id === memberParam || m.username === memberParam || String(m.id) === String(memberParam));
  }

  try {
    const profileData = await getMemberProfile(memberParam);
    if (profileData) {
      member = profileData.member || profileData || member;
    }
  } catch (e) {
    console.warn('Using local member profile fallback', e);
  }

  if (!member) {
    updateAuthorWriterHeader(false);
    renderNotFound(container);
    return;
  }

  const isCurrentUser = Boolean(window.IS_LOGGED_IN && window.CURRENT_USER && (
    String(window.CURRENT_USER.id) === String(member.id) ||
    window.CURRENT_USER.username === member.username ||
    memberParam === 'me'
  ));

  const isAuthorWriter = Boolean(
    member.role === 'writer' ||
    member.role === 'Admin' ||
    member.isWriter ||
    member.isAuthor ||
    memberParam === 'rudhra' ||
    memberParam === 'rudhra_author' ||
    member.username === 'rudhra_author' ||
    String(member.id) === '2' ||
    (isCurrentUser && window.CURRENT_USER && (window.CURRENT_USER.role === 'writer' || window.CURRENT_USER.role === 'Admin' || window.CURRENT_USER.isWriter || window.CURRENT_USER.isAuthor))
  );

  updateAuthorWriterHeader(isAuthorWriter, member);

  const mName = escapeHtml(member.displayName || member.name || member.username);
  const mBio = escapeHtml(member.bio || 'No bio added yet.');
  const joinedDate = member.joinedDate || member.joined || 'Jan 2024';
  const isActEnabled = window.CURRENT_USER?.activityStatusEnabled ?? (member.activityStatusEnabled ?? true);
  const mAvatar = getAvatarUrl(member.avatar);

  const avatarDot = (!member.statusHidden && member.isOnline)
    ? `<span class="status-dot green profile-ig-dot"></span>`
    : '';

  // Setup Global profile editing and photo upload state
  window._pendingAvatarAction = undefined;

  // Initialize Profile State for Tabs, Stats, and Pagination
  window._profileState = {
    memberParam: memberParam,
    memberId: member.id,
    isCurrentUser: isCurrentUser,
    activeTab: urlParams.get('tab') || 'saved', // 'saved' | 'activity' | 'recent-topics'
    savedPage: 1,
    activityPage: 1,
    recentPage: 1,
    isFollowing: Boolean(member.isFollowing),
    followersCount: Number(member.followers || member.followersCount || 0),
    followingCount: Number(member.following || member.followingCount || 0),
    totalComments: Number(member.totalComments || (member.posts || 0))
  };

  // Follow / Unfollow Toggle Handler
  window.handleProfileFollowToggle = async (targetId) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to follow members.');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    try {
      const res = await apiFetch(`/api/members/${encodeURIComponent(targetId)}/follow`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        window._profileState.isFollowing = data.isFollowing;
        window._profileState.followersCount = data.followersCount;
        
        // Update stats counter & button in DOM
        const numEl = document.getElementById('profile-followers-num');
        if (numEl) numEl.textContent = data.followersCount;
        
        const btn = document.getElementById('profile-follow-toggle-btn');
        if (btn) {
          if (data.isFollowing) {
            btn.className = 'btn btn-outline btn-sm is-following';
            btn.textContent = '✓ Following';
          } else {
            btn.className = 'btn btn-gold btn-sm';
            btn.textContent = '➕ Follow';
          }
        }
        showToast(data.isFollowing ? `Following ${mName}!` : `Unfollowed ${mName}.`);
      } else {
        showToast(data?.error || 'Failed to update follow status');
      }
    } catch (err) {
      showToast('Could not update follow status: ' + err.message);
    }
  };

  // Chat Settings Toggle
  window.handleProfileChatToggle = async (checked) => {
    try {
      const res = await apiFetch('/api/chat/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_chat_available: checked ? 1 : 0 })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (window.CURRENT_USER) window.CURRENT_USER.isChatAvailable = checked;
        const lbl = document.getElementById('profile-chat-status-label');
        if (lbl) {
          lbl.textContent = checked ? 'Available' : 'Paused';
          lbl.className = `activity-status-badge ${checked ? 'enabled' : 'hidden'}`;
        }
        showToast(checked ? 'Chat is now Available! Members can message you.' : 'Chat is now Paused. Direct messages are blocked.');
      } else {
        throw new Error(data?.error || 'Failed to update chat setting');
      }
    } catch (err) {
      showToast('Error updating chat setting: ' + err.message);
      const chk = document.getElementById('profile-chat-toggle');
      if (chk) chk.checked = !checked;
    }
  };

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

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast('Only JPG, PNG, WEBP, and GIF images are allowed.');
      event.target.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Image size must be less than 10MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const preview = document.getElementById('edit-avatar-preview');
      if (preview) preview.src = dataUrl;
      window._pendingAvatarAction = dataUrl;
      showToast('Preview ready! Click Save Changes to apply.');
    };
    reader.onerror = () => {
      showToast('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  window.handleRemoveProfileAvatar = () => {
    const preview = document.getElementById('edit-avatar-preview');
    if (preview) preview.src = '/profile.png';
    const fileInput = document.getElementById('edit-avatar-file-input');
    if (fileInput) fileInput.value = '';
    window._pendingAvatarAction = 'remove';
    showToast('Photo removed. Default avatar selected.');
  };

  window.handleSaveProfile = async () => {
    const displayName = document.getElementById('edit-display-name')?.value?.trim();
    const username = document.getElementById('edit-username')?.value?.trim();
    const bio = document.getElementById('edit-bio')?.value?.trim();

    if (!displayName || !username) {
      showToast('Display name and username are required.');
      return;
    }

    const btn = document.getElementById('save-profile-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
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
        btn.textContent = '💾 Save Changes';
      }
    }
  };

  // Tab Switching Function
  window.switchProfileTab = (tabName) => {
    window._profileState.activeTab = tabName;
    document.querySelectorAll('.profile-clean-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    const targetEl = document.getElementById('profile-tab-content-area');
    if (!targetEl) return;

    if (tabName === 'saved') {
      window.loadProfileSavedNovels(window._profileState.savedPage);
    } else if (tabName === 'activity') {
      window.loadProfileActivity(window._profileState.activityPage);
    } else if (tabName === 'recent-topics') {
      window.loadProfileRecentTopics(window._profileState.recentPage);
    }
  };

  // 1. Load Saved Novels (10 per page)
  window.loadProfileSavedNovels = async (page = 1) => {
    window._profileState.savedPage = page;
    const targetEl = document.getElementById('profile-tab-content-area');
    if (!targetEl) return;

    targetEl.innerHTML = `
      <div style="text-align:center; padding:40px; color:#64748B;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:rpSpinLogo 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading saved novels…</div>
      </div>
    `;

    try {
      const res = await apiFetch(`/api/members/${encodeURIComponent(memberParam)}/saved-novels?page=${page}&limit=10`);
      const data = await res.json();
      const items = data.items || [];
      const total = data.pagination?.total || 0;
      const totalPages = data.pagination?.totalPages || 1;

      // Update badge count
      const badge = document.getElementById('badge-count-saved');
      if (badge) badge.textContent = total;

      if (items.length === 0) {
        targetEl.innerHTML = `
          <div class="profile-empty-state">
            <div class="profile-empty-icon">🔖</div>
            <div class="profile-empty-title">No Saved Novels Yet</div>
            <p class="profile-empty-desc">${isCurrentUser ? 'Novels you bookmark or save while reading will appear here.' : 'This member has not saved any novels yet.'}</p>
            <a href="#forms" class="btn btn-gold btn-sm">Explore Novels ➔</a>
          </div>
        `;
        return;
      }

      targetEl.innerHTML = `
        <div class="saved-novels-grid">
          ${items.map(item => `
            <div class="saved-novel-card">
              ${isCurrentUser ? `
                <button type="button" class="saved-novel-remove-btn" 
                        onclick="window.handleRemoveSavedNovel('${escapeHtml(item.novelId)}')" 
                        title="Remove from saved list" aria-label="Remove novel">
                  ✕
                </button>
              ` : ''}
              <a href="#novel?id=${encodeURIComponent(item.novelId)}" class="saved-novel-cover-wrap">
                <img src="${escapeHtml(item.coverImage || '/images/logo.png')}" alt="${escapeHtml(item.title)}" class="saved-novel-cover" onerror="this.src='/images/logo.png'">
              </a>
              <div class="saved-novel-body">
                <a href="#novel?id=${encodeURIComponent(item.novelId)}" class="saved-novel-title" style="text-decoration:none;">
                  ${escapeHtml(item.title)}
                </a>
                <div class="saved-novel-author">By ${escapeHtml(item.author || 'Rudhra Prarthana')}</div>
                <div class="saved-novel-meta">
                  <span>📖 ${item.episodesCount} Episodes</span>
                  <span>👁️ ${item.totalViews} views</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        ${renderPaginationHtml('loadProfileSavedNovels', page, totalPages, total, 'novels')}
      `;
    } catch (err) {
      targetEl.innerHTML = `<div class="profile-empty-state"><p style="color:#EF4444;">Failed to load saved novels: ${escapeHtml(err.message)}</p></div>`;
    }
  };

  // Remove Saved Novel
  window.handleRemoveSavedNovel = async (novelId) => {
    if (!confirm('Remove this novel from your saved list?')) return;
    try {
      const res = await apiFetch(`/api/members/me/saved-novels/${encodeURIComponent(novelId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Novel removed from saved list.');
        window.loadProfileSavedNovels(window._profileState.savedPage);
      } else {
        throw new Error(data.error || 'Failed to remove');
      }
    } catch (err) {
      showToast('Error removing novel: ' + err.message);
    }
  };

  // 2. Load Activity Timeline (10 per page)
  window.loadProfileActivity = async (page = 1) => {
    window._profileState.activityPage = page;
    const targetEl = document.getElementById('profile-tab-content-area');
    if (!targetEl) return;

    targetEl.innerHTML = `
      <div style="text-align:center; padding:40px; color:#64748B;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:rpSpinLogo 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading activity timeline…</div>
      </div>
    `;

    try {
      const res = await apiFetch(`/api/members/${encodeURIComponent(memberParam)}/activity?page=${page}&limit=10`);
      const data = await res.json();
      const items = data.items || [];
      const total = data.pagination?.total || 0;
      const totalPages = data.pagination?.totalPages || 1;

      const badge = document.getElementById('badge-count-activity');
      if (badge) badge.textContent = total;

      if (items.length === 0) {
        targetEl.innerHTML = `
          <div class="profile-empty-state">
            <div class="profile-empty-icon">⚡</div>
            <div class="profile-empty-title">No Activity Recorded</div>
            <p class="profile-empty-desc">${isCurrentUser ? 'Comments, replies, reactions, and forum discussions you create will appear here.' : 'No public activity recorded for this member yet.'}</p>
          </div>
        `;
        return;
      }

      const typeMeta = {
        novel_comment: { icon: '💬', label: 'Novel Comment' },
        content_comment: { icon: '💬', label: 'Article Comment' },
        short_story_comment: { icon: '📝', label: 'Story Comment' },
        forum_topic: { icon: '💡', label: 'Forum Topic' },
        forum_post: { icon: '💭', label: 'Forum Reply' },
        reaction: { icon: '❤️', label: 'Reaction' },
        like: { icon: '👍', label: 'Like' }
      };

      targetEl.innerHTML = `
        <div class="activity-timeline-list">
          ${items.map(item => {
            const meta = typeMeta[item.activityType] || { icon: '📌', label: 'Activity' };
            const timeAgo = escapeHtml(item.createdAt || 'Recently');
            return `
              <div class="activity-card" id="activity-row-${escapeHtml(item.activityType)}-${escapeHtml(item.id)}">
                <div class="activity-icon-badge">${meta.icon}</div>
                <div class="activity-content-col">
                  <div class="activity-header-row">
                    <span class="activity-type-pill">${meta.label}</span>
                    <span class="activity-time-stamp">⏱ ${timeAgo}</span>
                  </div>
                  <div>
                    <a href="${escapeHtml(item.targetUrl || '#forms')}" class="activity-target-link">
                      ${escapeHtml(item.targetTitle || 'View Discussion')}
                    </a>
                  </div>
                  ${item.content ? `
                    <div class="activity-excerpt" id="activity-content-${escapeHtml(item.activityType)}-${escapeHtml(item.id)}">
                      ${escapeHtml(item.content)}
                    </div>
                  ` : ''}
                  ${(item.canEdit || item.canDelete) ? `
                    <div class="activity-actions-bar">
                      ${item.canEdit ? `
                        <button type="button" class="activity-action-btn edit" 
                                onclick="window.handleEditActivityItem('${escapeHtml(item.activityType)}', '${escapeHtml(item.id)}')" title="Edit your content">
                          ✏️ Edit
                        </button>
                      ` : ''}
                      ${item.canDelete ? `
                        <button type="button" class="activity-action-btn delete" 
                                onclick="window.handleDeleteActivityItem('${escapeHtml(item.activityType)}', '${escapeHtml(item.id)}')" title="Delete this record">
                          🗑️ Delete
                        </button>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${renderPaginationHtml('loadProfileActivity', page, totalPages, total, 'activities')}
      `;
    } catch (err) {
      targetEl.innerHTML = `<div class="profile-empty-state"><p style="color:#EF4444;">Failed to load activity: ${escapeHtml(err.message)}</p></div>`;
    }
  };

  // Edit Activity Item Handler
  window.handleEditActivityItem = async (type, id) => {
    const contentEl = document.getElementById(`activity-content-${type}-${id}`);
    const currentText = contentEl ? contentEl.textContent.trim() : '';
    const newText = prompt('Edit your comment / post content:', currentText);
    if (newText === null || newText.trim() === '' || newText.trim() === currentText) return;

    try {
      const res = await apiFetch(`/api/members/activity/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Activity content updated successfully.');
        if (contentEl) contentEl.textContent = newText.trim();
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (err) {
      showToast('Error updating content: ' + err.message);
    }
  };

  // Delete Activity Item Handler
  window.handleDeleteActivityItem = async (type, id) => {
    if (!confirm('Are you sure you want to permanently delete this comment or post? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/api/members/activity/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Activity record deleted.');
        const row = document.getElementById(`activity-row-${type}-${id}`);
        if (row) row.remove();
        // Refresh activity to keep page count accurate
        window.loadProfileActivity(window._profileState.activityPage);
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      showToast('Error deleting item: ' + err.message);
    }
  };

  // 3. Load Recently Read Topics (10 per page)
  window.loadProfileRecentTopics = async (page = 1) => {
    window._profileState.recentPage = page;
    const targetEl = document.getElementById('profile-tab-content-area');
    if (!targetEl) return;

    targetEl.innerHTML = `
      <div style="text-align:center; padding:40px; color:#64748B;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:rpSpinLogo 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading recent topics…</div>
      </div>
    `;

    try {
      const res = await apiFetch(`/api/members/${encodeURIComponent(memberParam)}/recent-topics?page=${page}&limit=10`);
      const data = await res.json();
      const items = data.items || [];
      const total = data.pagination?.total || 0;
      const totalPages = data.pagination?.totalPages || 1;

      const badge = document.getElementById('badge-count-recent');
      if (badge) badge.textContent = total;

      if (items.length === 0) {
        targetEl.innerHTML = `
          <div class="profile-empty-state">
            <div class="profile-empty-icon">📖</div>
            <div class="profile-empty-title">No Recently Read Topics</div>
            <p class="profile-empty-desc">${isCurrentUser ? 'Forum discussion topics you read or open in the community will appear here.' : 'No recently read topics for this member.'}</p>
            <a href="#forms" class="btn btn-gold btn-sm">Explore Community Forum ➔</a>
          </div>
        `;
        return;
      }

      targetEl.innerHTML = `
        <div class="recent-topics-list">
          ${items.map(topic => `
            <a href="#topic?id=${encodeURIComponent(topic.topicId)}" class="recent-topic-card">
              <div class="recent-topic-main">
                <div class="recent-topic-title">${escapeHtml(topic.title)}</div>
                <div class="recent-topic-meta-row">
                  ${topic.categoryTitle ? `<span class="recent-topic-category-badge">${escapeHtml(topic.categoryTitle)}</span>` : ''}
                  <span>💬 ${topic.repliesCount} replies</span>
                  <span>👁️ ${topic.viewsCount} views</span>
                  <span class="recent-topic-last-read">⏱️ Last read ${escapeHtml(topic.lastReadAt || 'recently')}</span>
                </div>
              </div>
              <div style="color:#C89B3C; font-size:18px;">➔</div>
            </a>
          `).join('')}
        </div>

        ${renderPaginationHtml('loadProfileRecentTopics', page, totalPages, total, 'topics')}
      `;
    } catch (err) {
      targetEl.innerHTML = `<div class="profile-empty-state"><p style="color:#EF4444;">Failed to load recent topics: ${escapeHtml(err.message)}</p></div>`;
    }
  };

  // Helper function to render consistent 10-item pagination controls
  function renderPaginationHtml(fnName, currentPage, totalPages, totalCount, label) {
    if (totalPages <= 1) return '';
    const startItem = (currentPage - 1) * 10 + 1;
    const endItem = Math.min(currentPage * 10, totalCount);

    let pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return `
      <div class="profile-pagination-wrap">
        <div class="profile-pagination-info">
          Showing <strong>${startItem}–${endItem}</strong> of <strong>${totalCount}</strong> ${label}
        </div>
        <div class="profile-pagination-controls">
          <button type="button" class="profile-page-btn" 
                  ${currentPage <= 1 ? 'disabled' : ''} 
                  onclick="${fnName}(${currentPage - 1})">
            « Prev
          </button>
          ${pages.map(p => {
            if (p === '...') return '<span style="padding:0 4px; color:#94A3B8;">...</span>';
            return `
              <button type="button" class="profile-page-btn ${p === currentPage ? 'active' : ''}" 
                      onclick="${fnName}(${p})">
                ${p}
              </button>
            `;
          }).join('')}
          <button type="button" class="profile-page-btn" 
                  ${currentPage >= totalPages ? 'disabled' : ''} 
                  onclick="${fnName}(${currentPage + 1})">
            Next »
          </button>
        </div>
      </div>
    `;
  }

  // Render Full Instagram-Style Profile Shell
  container.innerHTML = `
    <div class="container section">
      <div class="profile-clean-container">
        <!-- Clean Solid Background Accent (No heavy blue banner) -->
        <div class="profile-clean-cover"></div>

        <!-- Instagram-Inspired Profile Header -->
        <div class="profile-ig-header">
          <!-- Avatar Column -->
          <div class="profile-ig-avatar-wrap">
            <div class="profile-ig-avatar-ring">
              <img src="${mAvatar}" class="profile-ig-avatar" alt="${mName}" onerror="this.src='/profile.png';">
            </div>
            ${avatarDot}
          </div>

          <!-- Main Info Column -->
          <div class="profile-ig-main-col">
            <!-- Top Bar: Display Name & Actions -->
            <div class="profile-ig-top-bar">
              <div class="profile-ig-user-headline">
                <h1 class="profile-ig-title">${mName}</h1>
                <span class="profile-ig-handle">@${escapeHtml(member.username)}</span>
              </div>

              <!-- Action Controls -->
              <div class="profile-ig-actions">
                ${isCurrentUser ? `
                  <button type="button" class="btn btn-outline btn-sm" onclick="toggleProfileEditCard()" style="border-color:#C89B3C; color:#0B1F33; font-weight:700;">
                    ✏️ Edit Profile
                  </button>
                  ${(window.CURRENT_USER?.isAdmin || window.CURRENT_USER?.role === 'Admin' || window.CURRENT_USER?.isAuthorSession) ? `
                    <button type="button" class="btn btn-gold btn-sm" onclick="window.location.hash='#admin';" style="padding:4px 10px; font-weight:700;">
                      👑 AD
                    </button>
                  ` : (window.CURRENT_USER?.isWriter || window.CURRENT_USER?.role === 'writer') ? `
                    <button type="button" class="btn btn-gold btn-sm" onclick="window.location.hash='#writer';" style="padding:4px 10px; font-weight:700;">
                      ✍️ WD
                    </button>
                  ` : ''}
                  <button type="button" class="btn btn-outline btn-sm" onclick="handleLogout()" style="color:#EF4444; border-color:#FCA5A5;" title="Logout">
                    🚪 Logout
                  </button>
                ` : `
                  <button type="button" class="btn btn-gold btn-sm" onclick="openDirectChatWithUser(${JSON.stringify(member.id)})" title="Send a private message">
                    💬 Message
                  </button>
                  <button type="button" id="profile-follow-toggle-btn" 
                          class="btn ${window._profileState.isFollowing ? 'btn-outline' : 'btn-gold'} btn-sm" 
                          onclick="window.handleProfileFollowToggle(${JSON.stringify(member.id)})">
                    ${window._profileState.isFollowing ? '✓ Following' : '➕ Follow'}
                  </button>
                `}
              </div>
            </div>

            <!-- Instagram-Style Metrics Row (Followers, Following, Total Comments) -->
            <div class="profile-ig-stats-row">
              <div class="profile-ig-stat-box" onclick="window.location.hash='#followers?id=' + encodeURIComponent(window._profileState?.member?.username || 'me');" style="cursor:pointer;" title="View Followers">
                <span class="profile-ig-stat-num" id="profile-followers-num">${window._profileState.followersCount}</span>
                <span class="profile-ig-stat-lbl">Followers</span>
              </div>
              <div class="profile-ig-stat-box" onclick="window.location.hash='#following?id=' + encodeURIComponent(window._profileState?.member?.username || 'me');" style="cursor:pointer;" title="View Following">
                <span class="profile-ig-stat-num" id="profile-following-num">${window._profileState.followingCount}</span>
                <span class="profile-ig-stat-lbl">Following</span>
              </div>
              <div class="profile-ig-stat-box" title="Total Community Comments">
                <span class="profile-ig-stat-num" id="profile-comments-num">${window._profileState.totalComments}</span>
                <span class="profile-ig-stat-lbl">Comments</span>
              </div>
            </div>

            <!-- Bio -->
            <div class="profile-ig-bio">${mBio}</div>

            <!-- Role & Meta Chips -->
            <div class="profile-ig-meta-chips">
              <span class="profile-ig-chip role">👑 ${escapeHtml(member.title || member.role || 'Member')}</span>
              <span class="profile-ig-chip joined">📅 Joined ${escapeHtml(joinedDate)}</span>
              ${!member.statusHidden ? `
                <span class="profile-ig-chip" style="background:transparent; padding:0;">
                  ${member.isOnline
                    ? `<span class="status-indicator online"><span class="status-dot green"></span> Active now</span>`
                    : (member.lastSeen
                      ? `<span class="status-indicator offline">⏱ Last active ${escapeHtml(member.lastSeenText || formatLastSeen(member.lastSeen))}</span>`
                      : `<span class="status-indicator offline"><span class="status-dot" style="background:#94a3b8;"></span> Member</span>`
                    )
                  }
                </span>
              ` : ''}
            </div>

            <!-- Active Status & Chat Availability Controls (For Current User only) -->
            ${isCurrentUser ? `
              <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
                <!-- Active Status Toggle -->
                <div class="activity-status-card">
                  <div class="activity-status-info">
                    <span class="activity-status-icon">${isActEnabled ? '🟢' : '🔒'}</span>
                    <div>
                      <div class="activity-status-title-row">
                        <span class="activity-status-title">Active Status</span>
                        <span id="activity-status-label" class="activity-status-badge ${isActEnabled ? 'enabled' : 'hidden'}">
                          ${isActEnabled ? 'Enabled' : 'Hidden'}
                        </span>
                      </div>
                      <p id="activity-status-desc-text" class="activity-status-desc">
                        ${isActEnabled
                          ? 'When enabled, other readers can see when you are online, your reading duration, and your current or last read story.'
                          : 'When hidden, your online status, current story, duration, and last-read activity remain completely private.'
                        }
                      </p>
                    </div>
                  </div>
                  <label class="switch" aria-label="Toggle Active Status">
                    <input type="checkbox" id="profile-activity-toggle" ${isActEnabled ? 'checked' : ''} onchange="toggleActivityStatus(this.checked)">
                    <span class="slider round"></span>
                  </label>
                </div>

                <!-- Chat Availability Toggle -->
                <div class="activity-status-card">
                  <div class="activity-status-info">
                    <span class="activity-status-icon">💬</span>
                    <div>
                      <div class="activity-status-title-row">
                        <span class="activity-status-title">Chat Availability</span>
                        <span id="profile-chat-status-label" class="activity-status-badge ${window.CURRENT_USER?.isChatAvailable !== false ? 'enabled' : 'hidden'}">
                          ${window.CURRENT_USER?.isChatAvailable !== false ? 'Available' : 'Paused'}
                        </span>
                      </div>
                      <p class="activity-status-desc">
                        When enabled, other eligible members and authors can send you direct private messages. When paused, new incoming messages are blocked.
                      </p>
                    </div>
                  </div>
                  <label class="switch" aria-label="Toggle Chat Availability">
                    <input type="checkbox" id="profile-chat-toggle" ${window.CURRENT_USER?.isChatAvailable !== false ? 'checked' : ''} onchange="handleProfileChatToggle(this.checked)">
                    <span class="slider round"></span>
                  </label>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- User-Controlled Profile Edit Card (Collapsible) -->
        ${isCurrentUser ? `
          <div id="edit-profile-card" style="display:none; background:#FAF5EC; border-top:1px solid rgba(200,155,60,0.25); border-bottom:1px solid rgba(200,155,60,0.25); padding:24px 36px; box-shadow:inset 0 2px 8px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-family:var(--font-serif); color:#0B1F33; font-size:1.3rem;">
                ✏️ Edit Your Profile
              </h3>
              <button type="button" class="action-btn" onclick="toggleProfileEditCard()" style="border:none; background:transparent; font-size:18px; cursor:pointer;" title="Close">✕</button>
            </div>
            
            <form id="profile-edit-form" onsubmit="event.preventDefault(); window.handleSaveProfile();">
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:16px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight:700; color:#0B1F33; font-size:13px;">Display Name <span style="color:#EF4444;">*</span></label>
                  <input type="text" id="edit-display-name" class="form-input" value="${escapeHtml(member.displayName || member.username || '')}" required style="width:100%; padding:10px 14px; border:1px solid #CBD5E1; border-radius:8px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700; color:#0B1F33; font-size:13px;">Username <span style="color:#EF4444;">*</span></label>
                  <input type="text" id="edit-username" class="form-input" value="${escapeHtml(member.username || '')}" required pattern="[a-zA-Z0-9_]{3,20}" style="width:100%; padding:10px 14px; border:1px solid #CBD5E1; border-radius:8px;">
                  <small style="color:#64748B; font-size:11px;">3-20 characters, letters, numbers or _</small>
                </div>
              </div>

              <!-- Profile Picture Upload, Preview, and Removal -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label" style="font-weight:700; color:#0B1F33; font-size:13px;">Profile Photo</label>
                <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; background:#FFFFFF; padding:16px; border-radius:10px; border:1px dashed #CBD5E1;">
                  <img id="edit-avatar-preview" src="${mAvatar}" style="width:68px; height:68px; border-radius:50%; object-fit:cover; border:2px solid #C89B3C; box-shadow:0 2px 8px rgba(0,0,0,0.1); flex-shrink:0;" onerror="this.src='/profile.png'">
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="file" id="edit-avatar-file-input" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" style="display:none;" onchange="window.handleProfileFileChange(event)">
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                      <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('edit-avatar-file-input').click()">
                        📷 Upload Photo
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" id="btn-remove-avatar" onclick="window.handleRemoveProfileAvatar()" style="color:#DC2626; border-color:#FECACA;">
                        🗑️ Remove Photo
                      </button>
                    </div>
                    <small style="color:#64748B; font-size:11px;">
                      JPG, PNG, WEBP or GIF (Max 10MB)
                    </small>
                  </div>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label" style="font-weight:700; color:#0B1F33; font-size:13px;">About / Bio</label>
                <textarea id="edit-bio" class="form-input" rows="3" placeholder="Write a few lines about yourself..." style="width:100%; padding:10px 14px; border:1px solid #CBD5E1; border-radius:8px;">${escapeHtml(member.bio || '')}</textarea>
              </div>

              <div style="display:flex; gap:12px; justify-content:flex-end;">
                <button type="button" class="btn btn-outline" onclick="toggleProfileEditCard()">Cancel</button>
                <button type="submit" id="save-profile-btn" class="btn btn-gold">💾 Save Changes</button>
              </div>
            </form>
          </div>
        ` : ''}

        <!-- 2. Profile Navigation Tabs (Strictly: 1. Saved Novels, 2. Activity, 3. Recently Read Topics) -->
        <div class="profile-clean-tabs-nav" role="tablist">
          <button type="button" class="profile-clean-tab-btn ${window._profileState.activeTab === 'saved' ? 'active' : ''}" 
                  data-tab="saved" onclick="switchProfileTab('saved')" role="tab">
            <span>🔖 Saved Novels</span>
            <span class="tab-count-badge" id="badge-count-saved">0</span>
          </button>
          <button type="button" class="profile-clean-tab-btn ${window._profileState.activeTab === 'activity' ? 'active' : ''}" 
                  data-tab="activity" onclick="switchProfileTab('activity')" role="tab">
            <span>⚡ Activity</span>
            <span class="tab-count-badge" id="badge-count-activity">0</span>
          </button>
          <button type="button" class="profile-clean-tab-btn ${window._profileState.activeTab === 'recent-topics' ? 'active' : ''}" 
                  data-tab="recent-topics" onclick="switchProfileTab('recent-topics')" role="tab">
            <span>📖 Recently Read Topics</span>
            <span class="tab-count-badge" id="badge-count-recent">0</span>
          </button>
        </div>

        <!-- 3. Dynamic Tab Content Area -->
        <div id="profile-tab-content-area" style="padding:0 36px 36px;">
          <!-- Loaded dynamically via window.switchProfileTab() -->
        </div>
      </div>
    </div>
  `;

  // Trigger initial tab load
  window.switchProfileTab(window._profileState.activeTab);
}

// 9. ABOUT VIEW (Fallback route)
function renderAboutView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:880px;">
      <span class="section-subtitle">About Us</span>
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


// ============================================================================
// 10. CONTACT US VIEW & FORM HANDLER
// ============================================================================
window.handleContactSubmit = async (event) => {
  event.preventDefault();
  const statusBox = document.getElementById('contact-status-box');
  const submitBtn = document.getElementById('contact-submit-btn');
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const subjectInput = document.getElementById('contact-subject');
  const messageInput = document.getElementById('contact-message');

  const name = (nameInput?.value || '').trim();
  const email = (emailInput?.value || '').trim();
  const subject = (subjectInput?.value || '').trim();
  const message = (messageInput?.value || '').trim();

  if (statusBox) {
    statusBox.style.display = 'none';
    statusBox.innerHTML = '';
  }

  // Client Validation
  if (!name || !email || !subject || !message) {
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#FEF2F2';
      statusBox.style.border = '1px solid #FCA5A5';
      statusBox.style.color = '#991B1B';
      statusBox.innerHTML = '<strong>Validation Error:</strong> Please fill in all required fields (Name, Email, Subject, Message).';
    }
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#FEF2F2';
      statusBox.style.border = '1px solid #FCA5A5';
      statusBox.style.color = '#991B1B';
      statusBox.innerHTML = '<strong>Invalid Email:</strong> Please enter a valid email address.';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending Message...';
  }

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message })
    });
    const data = await res.json();

    if (data.success) {
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.style.background = '#F0FDF4';
        statusBox.style.border = '1px solid #86EFAC';
        statusBox.style.color = '#166534';
        statusBox.innerHTML = '<strong>✓ Message Sent!</strong> ' + escapeHtml(data.message || 'Thank you! Your message has been sent successfully. We will try our best to respond as soon as possible.');
      }
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (subjectInput) subjectInput.value = '';
      if (messageInput) messageInput.value = '';
      if (typeof showToast === 'function') {
        showToast('Message sent successfully!');
      }
    } else {
      throw new Error(data.error || 'Failed to submit message.');
    }
  } catch (err) {
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#FEF2F2';
      statusBox.style.border = '1px solid #FCA5A5';
      statusBox.style.color = '#991B1B';
      statusBox.innerHTML = '<strong>Submission Error:</strong> ' + escapeHtml(err.message || 'An error occurred while submitting your message. Please try again.');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  }
};

function renderContactView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:760px; padding-top:var(--space-6); padding-bottom:var(--space-12);">
      <div style="text-align:center; margin-bottom:32px;">
        <span class="section-subtitle" style="display:inline-block; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#B88635; margin-bottom:6px;">CONTACT</span>
        <h1 class="section-title" style="font-family:var(--font-serif); font-size:clamp(2rem, 4vw, 2.7rem); color:#0B1F33; margin:0;">Contact Us</h1>
      </div>

      <!-- 1. Contact Form Card (Spacious, Responsive, Warm-Gold Accents) -->
      <div class="contact-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(20px, 4vw, 36px); box-shadow:0 8px 30px rgba(11,31,51,0.06); box-sizing:border-box; margin-bottom:36px;">
        <form onsubmit="window.handleContactSubmit(event)" novalidate>
          <div class="form-group" style="margin-bottom:18px;">
            <label for="contact-name" class="form-label" style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">Your Name *</label>
            <input type="text" id="contact-name" class="form-input" required placeholder="Your Name" style="width:100%; box-sizing:border-box; border-radius:8px; border:1px solid #D5C9B8; padding:12px 14px; font-size:14.5px;">
          </div>

          <div class="form-group" style="margin-bottom:18px;">
            <label for="contact-email" class="form-label" style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">Email Address *</label>
            <input type="email" id="contact-email" class="form-input" required placeholder="name@example.com" style="width:100%; box-sizing:border-box; border-radius:8px; border:1px solid #D5C9B8; padding:12px 14px; font-size:14.5px;">
          </div>

          <div class="form-group" style="margin-bottom:18px;">
            <label for="contact-subject" class="form-label" style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">Subject *</label>
            <input type="text" id="contact-subject" class="form-input" required placeholder="Subject of your message" style="width:100%; box-sizing:border-box; border-radius:8px; border:1px solid #D5C9B8; padding:12px 14px; font-size:14.5px;">
          </div>

          <div class="form-group" style="margin-bottom:22px;">
            <label for="contact-message" class="form-label" style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">Message *</label>
            <textarea id="contact-message" class="form-input contact-textarea" rows="5" required placeholder="Write your message here..." style="width:100%; box-sizing:border-box; border-radius:8px; border:1px solid #D5C9B8; padding:12px 14px; font-size:14.5px; line-height:1.6; resize:vertical; min-height:120px;"></textarea>
          </div>

          <button type="submit" id="contact-submit-btn" class="btn btn-gold btn-contact-submit" style="width:100%; justify-content:center; padding:14px 20px; font-size:15px; font-weight:700; letter-spacing:0.5px; border-radius:8px; cursor:pointer;">
            Send Message
          </button>

          <div id="contact-status-box" style="display:none; margin-top:18px; padding:14px 18px; border-radius:8px; font-size:14px; line-height:1.5;"></div>
        </form>
      </div>

      <!-- 2. Supplied Contact Content Below Form (Exact Supplied Text) -->
      <div class="contact-info-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(24px, 4vw, 40px); box-shadow:0 6px 24px rgba(11,31,51,0.04); color:#1E293B; line-height:1.75; box-sizing:border-box;">
        <h2 style="font-family:var(--font-serif); font-size:1.6rem; color:#0B1F33; margin-top:0; margin-bottom:12px;">Contact Us</h2>
        <p style="font-size:15px; font-weight:600; color:#B88635; margin-bottom:12px;">We’d love to hear from you! ❤️</p>
        <p style="font-size:14.5px; color:#475569; margin-bottom:24px;">
          If you have any questions, suggestions, feedback, or enquiries regarding <strong>Rudhra Prarthana Novels</strong>, please feel free to contact us.
        </p>

        <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:#0B1F33; margin-bottom:10px;">Get in Touch</h3>
        <p style="font-size:14px; color:#475569; margin-bottom:10px;">You can contact us regarding:</p>
        <ul style="padding-left:22px; margin-bottom:24px; font-size:14px; color:#334155; display:flex; flex-direction:column; gap:6px;">
          <li>Website-related questions</li>
          <li>Forum and membership-related queries</li>
          <li>Novel and audio novel-related enquiries</li>
          <li>Suggestions and feedback</li>
          <li>Copyright-related concerns</li>
          <li>Technical issues</li>
        </ul>

        <div style="background:#FAF7F2; border:1px solid #E8DCCB; border-radius:10px; padding:14px 20px; display:inline-flex; align-items:center; gap:12px; margin-bottom:24px;">
          <span style="font-size:20px;">✉️</span>
          <a href="mailto:rudraprarthananovels@gmail.com" style="color:#0B1F33; font-weight:700; text-decoration:none; font-size:15px; font-family:monospace;" onmouseover="this.style.color='#C89B3C'" onmouseout="this.style.color='#0B1F33'">rudraprarthananovels@gmail.com</a>
        </div>

        <p style="font-size:13.5px; color:#64748B; margin-bottom:6px;">
          Please provide sufficient details about your enquiry so that we can assist you appropriately.
        </p>
        <p style="font-size:13.5px; color:#64748B; margin-bottom:20px;">
          We will try our best to respond as soon as possible.
        </p>
        
        <div style="font-family:var(--font-serif); font-size:1.2rem; font-weight:700; color:#0B1F33; border-top:1px dashed #E8DCCB; padding-top:16px;">
          Rudhra Prarthana Novels
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 11. PRIVACY POLICY VIEW (EXACT SUPPLIED TEXT)
// ============================================================================
function renderPrivacyView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:840px; padding-top:var(--space-6); padding-bottom:var(--space-12);">
      <div style="text-align:center; margin-bottom:28px;">
        <span class="section-subtitle" style="display:inline-block; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#B88635; margin-bottom:6px;">LEGAL</span>
        <h1 class="section-title" style="font-family:var(--font-serif); font-size:clamp(1.9rem, 4vw, 2.6rem); color:#0B1F33; margin:0 0 8px;">Privacy Policy</h1>
        <div style="font-size:13px; color:#64748B; font-weight:500;">Last Updated: September 2026</div>
      </div>

      <div class="legal-content-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(24px, 4vw, 44px); box-shadow:0 6px 24px rgba(11,31,51,0.04); color:#1E293B; line-height:1.8; font-size:15px; box-sizing:border-box;">
        <p style="font-size:16px; font-weight:600; color:#0B1F33; margin-top:0;">Welcome to Rudhra Prarthana Novels.</p>
        <p>We respect your privacy and are committed to protecting the information you provide while using our website.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">1. Information We Collect</h2>
        <p>When you register on our website, participate in our forums, or contact us, we may collect information such as:</p>
        <ul style="padding-left:24px; display:flex; flex-direction:column; gap:6px;">
          <li>Your name or username</li>
          <li>Email address</li>
          <li>Profile information you choose to provide</li>
          <li>Comments, forum posts, and other content you submit</li>
          <li>Technical information such as browser type, device information, IP address, and basic website usage information</li>
        </ul>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">2. How We Use Your Information</h2>
        <p>We may use the information collected to:</p>
        <ul style="padding-left:24px; display:flex; flex-direction:column; gap:6px;">
          <li>Create and manage your member account</li>
          <li>Provide access to forum and community features</li>
          <li>Respond to your questions and messages</li>
          <li>Improve our website and user experience</li>
          <li>Maintain website security and prevent misuse</li>
          <li>Send important website-related notifications when necessary</li>
          <li>Understand website traffic and usage</li>
        </ul>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">3. Forum Content</h2>
        <p>Content that you voluntarily post in public areas of the website, including forum posts, comments, usernames, and profile information, may be visible to other visitors or members.</p>
        <p>Please avoid posting personal, private, or confidential information in public forum areas.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">4. Cookies</h2>
        <p>Our website may use cookies and similar technologies to maintain login sessions, remember preferences, improve website functionality, and understand basic website usage.</p>
        <p>You can control or disable cookies through your browser settings. Some website features may not function properly if cookies are disabled.</p>
        
        <h3 style="font-family:var(--font-serif); font-size:1.15rem; color:#0B1F33; margin-top:20px; margin-bottom:8px;">Google AdSense and Advertising Cookies</h3>
        <p>If Google AdSense or other advertising services are used on this website, third-party vendors, including Google, may use cookies to serve advertisements based on users’ previous visits to this website or other websites.</p>
        <p>Google may use advertising cookies to help serve relevant advertisements to visitors. Users may opt out of personalized advertising by visiting Google’s Ads Settings.</p>
        <p>For more information about how Google uses cookies for advertising, please visit Google’s advertising and privacy information.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">5. Third-Party Services</h2>
        <p>Our website may contain links to or use services provided by third parties, including YouTube, Pratilipi, analytics services, hosting services, Google AdSense, or other external websites and services.</p>
        <p>These third-party websites and services have their own privacy policies, and we are not responsible for their privacy practices.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">6. Data Security</h2>
        <p>We take reasonable measures to protect the information collected through our website. However, no method of transmission or storage over the Internet can be guaranteed to be completely secure.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">7. Children’s Privacy</h2>
        <p>Our website is not intended to knowingly collect personal information from children without appropriate parental or guardian involvement.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">8. Your Rights</h2>
        <p>You may contact us to request information about, correction of, or deletion of personal information associated with your account, subject to applicable laws and legitimate website requirements.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">9. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">10. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or how your information is handled, please contact us through the <a href="#contact" style="color:#B88635; font-weight:600;">Contact Us</a> page of this website.</p>

        <div style="font-family:var(--font-serif); font-size:1.2rem; font-weight:700; color:#0B1F33; border-top:1px dashed #E8DCCB; padding-top:20px; margin-top:36px;">
          Rudhra Prarthana Novels
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 12. DISCLAIMER VIEW (EXACT SUPPLIED TEXT)
// ============================================================================
function renderDisclaimerView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:840px; padding-top:var(--space-6); padding-bottom:var(--space-12);">
      <div style="text-align:center; margin-bottom:28px;">
        <span class="section-subtitle" style="display:inline-block; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#B88635; margin-bottom:6px;">LEGAL</span>
        <h1 class="section-title" style="font-family:var(--font-serif); font-size:clamp(1.9rem, 4vw, 2.6rem); color:#0B1F33; margin:0 0 8px;">Disclaimer</h1>
        <div style="font-size:13px; color:#64748B; font-weight:500;">Last Updated: September 2026</div>
      </div>

      <div class="legal-content-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(24px, 4vw, 44px); box-shadow:0 6px 24px rgba(11,31,51,0.04); color:#1E293B; line-height:1.8; font-size:15px; box-sizing:border-box;">
        <p style="font-size:16px; font-weight:600; color:#0B1F33; margin-top:0;">Welcome to Rudhra Prarthana Novels.</p>
        <p>The information and content published on this website are provided for general informational and entertainment purposes.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">1. Fictional Content</h2>
        <p>The novels, stories, characters, names, events, and situations published on Rudhra Prarthana Novels may be fictional or created for entertainment purposes.</p>
        <p>Any resemblance to actual persons, living or deceased, or actual events is purely coincidental unless specifically stated otherwise.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">2. Copyright</h2>
        <p>All original stories, written content, audio content, images, logos, and other creative materials published by Rudhra Prarthana Novels are protected by applicable copyright laws unless otherwise stated.</p>
        <p>You may not reproduce, copy, distribute, modify, or republish our original content without prior written permission.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">3. External Links</h2>
        <p>Our website may contain links to third-party websites and services, including YouTube, Prathilipi, and other external platforms.</p>
        <p>We do not control or guarantee the accuracy, availability, security, or privacy practices of these external websites.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">4. Accuracy of Information</h2>
        <p>We make reasonable efforts to provide accurate information on our website. However, we do not guarantee that all information will always be complete, accurate, or up to date.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">5. User-Generated Content</h2>
        <p>Members may post comments, discussions, and other content through our forum.</p>
        <p>Users are responsible for the content they submit. Rudhra Prarthana Novels does not necessarily endorse opinions expressed by individual users.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">6. Changes to the Website</h2>
        <p>We reserve the right to modify, update, remove, or discontinue any part of the website or its content at any time without prior notice.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">7. Acceptance of This Disclaimer</h2>
        <p>By using this website, you acknowledge that you have read and understood this Disclaimer and agree to its terms.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">8. Contact</h2>
        <p>If you have any questions regarding this Disclaimer, please contact us through the <a href="#contact" style="color:#B88635; font-weight:600;">Contact Us</a> page.</p>

        <div style="font-family:var(--font-serif); font-size:1.2rem; font-weight:700; color:#0B1F33; border-top:1px dashed #E8DCCB; padding-top:20px; margin-top:36px;">
          Rudhra Prarthana Novels
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 13. TERMS & CONDITIONS VIEW (EXACT SUPPLIED TEXT)
// ============================================================================
function renderTermsView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:840px; padding-top:var(--space-6); padding-bottom:var(--space-12);">
      <div style="text-align:center; margin-bottom:28px;">
        <span class="section-subtitle" style="display:inline-block; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#B88635; margin-bottom:6px;">LEGAL</span>
        <h1 class="section-title" style="font-family:var(--font-serif); font-size:clamp(1.9rem, 4vw, 2.6rem); color:#0B1F33; margin:0 0 8px;">Terms &amp; Conditions</h1>
        <div style="font-size:13px; color:#64748B; font-weight:500;">Last Updated: September 2026</div>
      </div>

      <div class="legal-content-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(24px, 4vw, 44px); box-shadow:0 6px 24px rgba(11,31,51,0.04); color:#1E293B; line-height:1.8; font-size:15px; box-sizing:border-box;">
        <p style="font-size:16px; font-weight:600; color:#0B1F33; margin-top:0;">Welcome to Rudhra Prarthana Novels. By accessing or using this website, you agree to comply with the following Terms &amp; Conditions.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">1. Website Usage</h2>
        <p>This website is intended for personal, non-commercial use unless otherwise permitted by us.</p>
        <p>You agree not to use the website for any unlawful purpose or in any way that may harm, disrupt, or interfere with the website or other users.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">2. Account Registration</h2>
        <p>Some features, including forum participation, may require registration.</p>
        <p>You are responsible for keeping your account information secure and for all activity carried out through your account.</p>
        <p>Please provide accurate information when creating an account.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">3. Forum Rules</h2>
        <p>Users must use the forum respectfully and responsibly.</p>
        <p>You must not post:</p>
        <ul style="padding-left:24px; display:flex; flex-direction:column; gap:6px;">
          <li>Abusive, threatening, or harassing content</li>
          <li>Illegal or harmful content</li>
          <li>Spam or misleading content</li>
          <li>Content that infringes another person’s copyright or other rights</li>
          <li>Personal or confidential information belonging to others</li>
          <li>Unwanted advertisements or promotional material</li>
        </ul>
        <p>We reserve the right to remove content or restrict accounts that violate these rules.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">4. Intellectual Property</h2>
        <p>All original novels, stories, audio novels, written content, logos, graphics, and other creative materials published by Rudhra Prarthana Novels are protected by applicable copyright laws.</p>
        <p>You may not copy, reproduce, redistribute, sell, modify, or republish our original content without prior written permission.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">5. User-Submitted Content</h2>
        <p>By submitting content to our forums or other public areas, you agree that you have the necessary rights to share that content.</p>
        <p>You remain responsible for the content you submit and must not knowingly post material that violates the rights of others.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">6. Third-Party Links</h2>
        <p>The website may contain links to third-party websites and services such as YouTube, Prathilipi, and other external platforms.</p>
        <p>We are not responsible for the content, availability, security, or policies of third-party websites.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">7. Website Availability</h2>
        <p>We make reasonable efforts to keep the website available and functioning properly. However, we do not guarantee uninterrupted or error-free access.</p>
        <p>We may modify, suspend, or discontinue any part of the website when necessary.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">8. Account Suspension or Termination</h2>
        <p>We reserve the right to suspend or terminate an account if a user violates these Terms &amp; Conditions, forum rules, or applicable laws.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">9. Changes to These Terms</h2>
        <p>We may update these Terms &amp; Conditions from time to time. Changes will be posted on this page with an updated date.</p>

        <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin-top:32px; margin-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.3); padding-bottom:6px;">10. Contact</h2>
        <p>If you have questions regarding these Terms &amp; Conditions, please contact us through the <a href="#contact" style="color:#B88635; font-weight:600;">Contact Us</a> page.</p>

        <p style="font-weight:600; color:#0B1F33; margin-top:20px;">By using this website, you acknowledge that you have read and agreed to these Terms &amp; Conditions.</p>

        <div style="font-family:var(--font-serif); font-size:1.2rem; font-weight:700; color:#0B1F33; border-top:1px dashed #E8DCCB; padding-top:20px; margin-top:36px;">
          Rudhra Prarthana Novels
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 14. COPYRIGHT VIEW (EXACT SUPPLIED TEXT)
// ============================================================================
function renderCopyrightView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:840px; padding-top:var(--space-6); padding-bottom:var(--space-12);">
      <div style="text-align:center; margin-bottom:28px;">
        <span class="section-subtitle" style="display:inline-block; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#B88635; margin-bottom:6px;">LEGAL</span>
        <h1 class="section-title" style="font-family:var(--font-serif); font-size:clamp(1.9rem, 4vw, 2.6rem); color:#0B1F33; margin:0 0 8px;">Copyright</h1>
        <div style="font-size:14px; color:#B88635; font-weight:600;">© 2026 Rudhra Prarthana Novels. All Rights Reserved.</div>
      </div>

      <div class="legal-content-card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:clamp(24px, 4vw, 44px); box-shadow:0 6px 24px rgba(11,31,51,0.04); color:#1E293B; line-height:1.8; font-size:15px; box-sizing:border-box;">
        <p style="font-size:15.5px; margin-top:0;">
          All content published on this website, including novels, stories, audio novels, written content, images, graphics, and other original materials, is protected by applicable copyright laws.
        </p>

        <p>
          No part of the content may be copied, reproduced, republished, distributed, modified, or used for commercial purposes without prior written permission from the respective copyright owner.
        </p>

        <p>
          If you believe that any content on this website infringes your copyright, please contact us with the relevant details so that we can review the matter.
        </p>

        <div style="margin-top:28px; background:#FAF7F2; border:1px solid #E8DCCB; border-radius:10px; padding:16px 20px; display:inline-flex; align-items:center; gap:12px;">
          <span style="font-size:20px;">✉️</span>
          <div>
            <div style="font-size:12px; color:#64748B; font-weight:600; text-transform:uppercase;">Copyright Enquiries:</div>
            <a href="mailto:rudraprarthananovels@gmail.com" style="color:#0B1F33; font-weight:700; text-decoration:none; font-size:15px; font-family:monospace;" onmouseover="this.style.color='#C89B3C'" onmouseout="this.style.color='#0B1F33'">rudraprarthananovels@gmail.com</a>
          </div>
        </div>

        <div style="font-family:var(--font-serif); font-size:1.2rem; font-weight:700; color:#0B1F33; border-top:1px dashed #E8DCCB; padding-top:20px; margin-top:36px;">
          Rudhra Prarthana Novels
        </div>
      </div>
    </div>
  `;
}


// Helpers
function renderNovelCard(n, mode = 'read') {
  if (!n) return '';
  const title = n.title || '';
  const author = n.author || '';
  const statusLabel = n.status || '';
  const statusClass = statusLabel ? statusLabel.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'ongoing';
  const genreLabel = n.genre ? n.genre.split('/')[0].trim() : (n.category || '');
  const description = n.description || '';
  const chaptersCount = n.chaptersCount ?? n.chapters_count;
  const rating = n.rating;
  const cover = n.cover || '/default-cover.jpg';
  const link = n.link || (n.id ? `#novel?id=${encodeURIComponent(n.id)}` : '#novels');
  const btnText = mode === 'continue' ? 'Continue Reading ➔' : (n.btnText || t('btn_read_more'));

  const metaItems = [];
  if (typeof chaptersCount === 'number' && chaptersCount > 0) {
    metaItems.push(`<span class="novel-card-meta-item">📖 ${chaptersCount} ${t('novel_chapters')}</span>`);
  }
  if (rating && String(rating).trim() !== '' && String(rating).trim() !== '0') {
    metaItems.push(`<span class="novel-card-meta-item">★ ${rating}</span>`);
  }

  return `
    <div class="novel-card">
      <div class="novel-card-cover">
        <img src="${cover}" class="novel-card-img" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='/default-cover.jpg';">
        ${statusLabel ? `<span class="novel-badge-status badge-${statusClass}">${statusLabel}</span>` : ''}
        ${genreLabel ? `<span class="novel-badge-genre">${genreLabel}</span>` : ''}
      </div>
      <div class="novel-card-body">
        <h3 class="novel-card-title">${title}</h3>
        ${author ? `<div class="novel-card-author">✍️ ${author}</div>` : ''}
        ${description ? `<p class="novel-card-desc">${description}</p>` : ''}
        ${metaItems.length > 0 ? `
          <div class="novel-card-meta">
            ${metaItems.join('')}
          </div>
        ` : ''}
      </div>
      <div class="novel-card-footer">
        <a href="${link}" class="btn ${mode === 'continue' ? 'btn-primary' : 'btn-gold'}" style="width:100%;">
          ${btnText}
        </a>
      </div>
    </div>
  `;
}

function escapeQuotes(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
}

function renderAudioNovelCard(audioItem) {
  if (!audioItem) return '';
  const audio = audioItem;
  const idOrSlug = audio.slug || audio.id;
  const title = audio.title || '';
  const cover = audio.cover || '/default-cover.jpg';
  const duration = audio.duration || audio.audioDuration || '';
  const linkedNovel = audio.novelTitle || audio.linkedNovelTitle || '';
  const isYouTube = audio.sourceType === 'youtube' || Boolean(audio.youtubeVideoId);
  const partLabel = audio.episodeNumber || (audio.partNumber ? `Part ${audio.partNumber}` : '');
  const desc = audio.description || '';

  return `
    <div class="audio-card">
      <div class="audio-card-top">
        <a href="#audio?id=${encodeURIComponent(idOrSlug)}" style="display:block; flex-shrink:0;">
          <img src="${cover}" class="audio-card-cover" alt="${escapeQuotes(title)}" loading="lazy" onerror="this.onerror=null;this.src='/default-cover.jpg';">
        </a>
        <div class="audio-card-info">
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
            <span class="novel-badge-status ${isYouTube ? 'badge-ongoing' : 'badge-completed'}" style="position:static; display:inline-block; font-size:10px; padding:2px 6px;">
              ${isYouTube ? '▶ YouTube' : '🎧 Audio'}
            </span>
            ${partLabel ? `
              <span class="novel-badge-status badge-audio" style="position:static; display:inline-block; font-size:10px; padding:2px 6px;">
                ${escapeHtml(partLabel)}
              </span>
            ` : ''}
          </div>
          <h3 style="font-family:var(--font-serif); font-size:1.15rem; color:var(--color-navy-deep); margin:0 0 4px; line-height:1.3;">
            <a href="#audio?id=${encodeURIComponent(idOrSlug)}" style="color:inherit; text-decoration:none;">
              ${escapeHtml(title)}
            </a>
          </h3>
          ${linkedNovel ? `
            <div style="font-size:11.5px; color:var(--color-gold-warm); font-weight:600;">
              📖 ${escapeHtml(linkedNovel)}
            </div>
          ` : ''}
          ${duration ? `
            <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">
              ⏱ ${escapeHtml(duration)}
            </div>
          ` : ''}
        </div>
      </div>

      ${desc ? `
        <p style="font-size:12.5px; color:var(--color-text-muted); line-height:1.4; margin:4px 0 0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
          ${escapeHtml(desc)}
        </p>
      ` : ''}

      <div style="margin-top:auto; padding-top:12px; border-top:1px dashed var(--color-border); display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <a href="#audio?id=${encodeURIComponent(idOrSlug)}" class="audio-play-btn-primary" style="padding:6px 14px; font-size:12px;">
          <span>▶ Listen Now</span>
        </a>
        <span style="font-size:11.5px; color:var(--color-text-muted);">
          ${audio.language || 'Tamil'}
        </span>
      </div>
    </div>
  `;
}

/* ========================================================
   2. READER AUDIO NOVELS DIRECTORY VIEW (#audio)
   ======================================================== */
export async function renderAudioNovelsView(container, hash) {
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryStr);
  const search = searchParams.get('search') || '';
  const novelId = searchParams.get('novel') || searchParams.get('novelId') || 'all';
  const sort = searchParams.get('sort') || 'newest';

  // Fetch real MySQL data from API
  let audioNovels = [];
  try {
    const res = await apiFetch(`/api/audio-novels?search=${encodeURIComponent(search)}&sort=${encodeURIComponent(sort)}`);
    const data = await res.json();
    audioNovels = data.audioNovels || [];
  } catch (err) {
    console.warn('Error fetching audio novels:', err);
  }

  container.innerHTML = `
    <div class="audio-page-container">
      <!-- Section Heading -->
      <section class="audio-hero-header">
        <div class="container">
          <span class="audio-hero-subtitle">Listen & Enjoy</span>
          <h1 class="audio-hero-title">Audio Novels</h1>
          <p class="audio-hero-desc">Experience Rudhra Prarthana's captivating romantic dramas and family stories in audio.</p>
        </div>
      </section>

      <div class="container">
        <!-- Search and Filter Bar -->
        <div class="audio-filters-bar">
          <div class="audio-search-box">
            <span class="audio-search-icon">🔍</span>
            <input type="text" id="reader-audio-search" class="audio-search-input" 
                   value="${escapeHtml(search)}" 
                   placeholder="Search audio novels by title or description..." 
                   onkeydown="if(event.key === 'Enter') handleAudioFilterChange();">
          </div>

          <!-- Sort Filter -->
          <select id="reader-audio-sort-filter" class="audio-filter-select" onchange="handleAudioFilterChange()">
            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="title" ${sort === 'title' ? 'selected' : ''}>Title (A-Z)</option>
            <option value="views" ${sort === 'views' ? 'selected' : ''}>Most Listened</option>
          </select>
        </div>

        <!-- Audio Novels Grid / Empty State -->
        ${audioNovels.length === 0 ? `
          <div class="audio-empty-state" style="text-align:center; padding:64px 20px; background:#FFFDF8; border:1px dashed #E2E8F0; border-radius:12px;">
            <span class="audio-empty-icon" style="font-size:3rem; display:block; margin-bottom:12px;">🎧</span>
            <h3 class="audio-empty-title" style="font-family:var(--font-serif); color:var(--color-navy-deep); margin:0 0 8px;">No Audio Novels Found</h3>
            <p class="audio-empty-text" style="color:#64748B; font-size:14px; max-width:480px; margin:0 auto 16px;">
              ${search ? 'No audio novels matched your search query. Try clearing the search box.' : 'No audio novels have been published yet. Please check back soon!'}
            </p>
            ${search ? `
              <button type="button" class="btn btn-gold btn-sm" onclick="window.location.hash = '#audio';">Reset Search</button>
            ` : ''}
          </div>
        ` : `
          <div class="audio-grid">
            ${audioNovels.map(an => renderAudioDirectoryCard(an)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  window.handleAudioFilterChange = () => {
    const s = (document.getElementById('reader-audio-search')?.value || '').trim();
    const st = document.getElementById('reader-audio-sort-filter')?.value || 'newest';

    const p = new URLSearchParams();
    if (s) p.set('search', s);
    if (st !== 'newest') p.set('sort', st);

    const newHash = p.toString() ? `#audio?${p.toString()}` : '#audio';
    window.location.hash = newHash;
  };
}

function renderAudioDirectoryCard(an) {
  const novelLink = `#audio?novel=${encodeURIComponent(an.id || an.slug)}`;
  const chCount = an.chaptersCount || 0;
  const epCount = an.episodesCount || 0;

  return `
    <article class="audio-novel-item-card">
      <div class="audio-card-media">
        <a href="${novelLink}" style="display:block; width:100%; height:100%;">
          <img src="${an.cover || '/default-cover.jpg'}" class="audio-card-img" alt="${escapeQuotes(an.title)}" loading="lazy" onerror="this.onerror=null;this.src='/default-cover.jpg';">
        </a>
        <div class="audio-badge-overlay">
          <span class="audio-type-pill audio-file">
            🎙️ ${escapeHtml(an.voice || an.author || 'Rudhra Prarthana')}
          </span>
          <span class="audio-type-pill" style="background:#0B1F33; color:#FFFFFF;">
            ${chCount} ${chCount === 1 ? 'Chapter' : 'Chapters'}
          </span>
        </div>
        ${an.duration ? `
          <span class="audio-duration-pill">⏱ ${escapeHtml(an.duration)}</span>
        ` : ''}
      </div>

      <div class="audio-card-body">
        <div class="audio-card-meta">
          <span>🎙️ Voice: ${escapeHtml(an.voice || an.author || 'Rudhra Prarthana')}</span>
          <span>• 👁 ${Number(an.views || 0).toLocaleString()} listens</span>
        </div>

        <h3 class="audio-card-title">
          <a href="${novelLink}" style="color:inherit; text-decoration:none;">
            ${escapeHtml(an.title)}
          </a>
        </h3>

        <p class="audio-card-desc">
          ${escapeHtml(an.description || 'Listen to this captivating audio story by author Rudhra Prarthana.')}
        </p>

        <div class="audio-card-footer">
          <span style="font-size:12px; color:#64748B; font-weight:600;">
            ${epCount > 0 ? `${epCount} ${epCount === 1 ? 'Episode' : 'Episodes'} Available` : 'Audio Chapters'}
          </span>

          <a href="${novelLink}" class="audio-play-btn-primary">
            <span>▶ Listen Now</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

/* ========================================================
   3. DEDICATED CHAPTER-WISE & EPISODE-WISE AUDIO PLAYBACK VIEW (#audio?novel=...)
   ======================================================== */
export async function renderAudioPlayerView(container, hash) {
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryStr);
  const idOrSlug = searchParams.get('novel') || searchParams.get('novelId') || searchParams.get('id') || searchParams.get('slug') || '';
  const targetEpisodeId = searchParams.get('ep') || searchParams.get('episode') || null;

  if (!idOrSlug) {
    container.innerHTML = `
      <div class="container" style="padding:60px 20px; text-align:center;">
        <h2 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin-bottom:12px;">Audio Novel Not Specified</h2>
        <p style="color:var(--color-text-muted); margin-bottom:20px;">Please select an audio novel from the library to begin listening.</p>
        <a href="#audio" class="btn btn-gold">« Browse Audio Novels</a>
      </div>
    `;
    return;
  }

  // Fetch full audio novel hierarchy
  let audioNovel = null;
  try {
    const res = await apiFetch(`/api/audio-novels/${encodeURIComponent(idOrSlug)}`);
    if (res.ok) {
      const data = await res.json();
      audioNovel = data.audioNovel;
    }
  } catch (err) {
    console.warn('Error fetching audio novel:', err);
  }

  if (!audioNovel) {
    container.innerHTML = `
      <div class="container" style="padding:60px 20px; text-align:center;">
        <div style="font-size:44px; margin-bottom:12px;">🎧❓</div>
        <h2 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin-bottom:12px;">Audio Novel Not Found</h2>
        <p style="color:var(--color-text-muted); margin-bottom:24px;">This audio novel may have been unpublished or removed.</p>
        <a href="#audio" class="btn btn-gold">« Back to Audio Novels</a>
      </div>
    `;
    return;
  }

  const playlist = audioNovel.playlist || [];
  let activeEpisode = null;
  if (targetEpisodeId) {
    activeEpisode = playlist.find(e => String(e.id) === String(targetEpisodeId)) || null;
  }
  if (!activeEpisode) {
    activeEpisode = playlist[0] || (audioNovel.chapters[0] || null);
  }

  const hasAudio = Boolean(activeEpisode?.audioFileUrl);
  const hasYouTube = Boolean(activeEpisode?.youtubeUrl || activeEpisode?.youtubeVideoId);
  const isBoth = hasAudio && hasYouTube;

  container.innerHTML = `
    <div class="audio-player-page">
      <div class="container">
        <!-- Back Navigation & Breadcrumb -->
        <div class="audio-back-link-wrap" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <a href="#audio" class="audio-back-link">
            « Back to Audio Novels
          </a>
          <span style="font-size:12px; color:#64748B;">
            Rudhra Prarthana Novels • ${escapeHtml(audioNovel.title)}
          </span>
        </div>

        <div class="audio-player-layout">
          <!-- Main Player & Content Column -->
          <main class="audio-main-stage">
            <!-- Sleek Integrated Player Card -->
            <div class="direct-audio-player-card" id="rp-active-player-card">
              <div class="audio-track-banner">
                <img src="${activeEpisode?.thumbnail || audioNovel.cover || '/default-cover.jpg'}" class="audio-track-cover" id="rp-track-cover-img" alt="${escapeQuotes(audioNovel.title)}" onerror="this.src='/default-cover.jpg'">
                <div class="audio-track-info">
                  <span class="audio-track-badge" id="rp-track-badge">
                    🎧 ${escapeHtml(activeEpisode?.episodeNumber ? `Episode ${activeEpisode.episodeNumber}` : 'Audio Episode')}
                  </span>
                  <h2 class="audio-track-title" id="rp-track-title">${escapeHtml(activeEpisode?.title || audioNovel.title)}</h2>
                  <div class="audio-track-subtitle" id="rp-track-subtitle">
                    Voice: ${escapeHtml(audioNovel.voice || audioNovel.author)} ${activeEpisode?.audioDuration ? `• Duration: ${escapeHtml(activeEpisode.audioDuration)}` : ''}
                  </div>
                </div>
              </div>

              <!-- Media Format Alert / Indicator -->
              ${isBoth ? `
                <div style="background:#FAF5FF; border:1px solid #E9D5FF; color:#6B21A8; font-size:12px; font-weight:600; padding:6px 12px; border-radius:6px; margin:10px 0 14px; display:flex; align-items:center; gap:6px;">
                  <span>🎧+🎥</span>
                  <span>Both High-Definition Audio Stream and Official YouTube Video are available for this episode.</span>
                </div>
              ` : ''}

              <!-- YouTube Stage (When YouTube link exists) -->
              <div class="youtube-player-stage" id="rp-yt-stage" style="margin-top:14px; display:${hasYouTube ? 'block' : 'none'}; font-family:sans-serif;">
                <iframe id="rp-yt-iframe" src="${hasYouTube ? (activeEpisode?.embedUrl || `https://www.youtube-nocookie.com/embed/${activeEpisode?.youtubeVideoId}?rel=0`) : ''}"
                        class="youtube-player-iframe"
                        title="${escapeQuotes(activeEpisode?.title || audioNovel.title)}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen>
                </iframe>
              </div>

              <!-- Direct HTML5 Audio Player Stage (When Audio File exists) -->
              <div id="rp-direct-audio-stage" style="display:${hasAudio ? 'block' : 'none'}; margin-top:${isBoth ? '18px' : '0'}; font-family:sans-serif;">
                ${isBoth ? `
                  <div style="font-size:12.5px; font-weight:700; color:#334155; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                    <span>🎧 Direct Audio Stream Controls</span>
                  </div>
                ` : ''}
                <audio id="rp-active-audio-player" src="${activeEpisode?.audioFileUrl || ''}" preload="metadata"></audio>

                <!-- Custom Native Controls -->
                <div class="custom-audio-controls">
                  <!-- Scrub / Seek Slider -->
                  <div class="audio-scrub-bar-container">
                    <input type="range" id="rp-audio-seek-slider" min="0" max="100" value="0" class="audio-progress-slider" aria-label="Seek audio position">
                    <div class="audio-time-row">
                      <span id="rp-audio-current-time">00:00</span>
                      <span id="rp-audio-duration-time">${escapeHtml(activeEpisode?.audioDuration || '00:00')}</span>
                    </div>
                  </div>

                  <!-- Playback Action Buttons -->
                  <div class="audio-buttons-row">
                    <div class="audio-playback-btn-group">
                      <button type="button" class="audio-skip-btn" onclick="skipAudio(-10)" title="Rewind 10 seconds">
                        -10s
                      </button>

                      <button type="button" id="rp-audio-play-pause-btn" class="audio-main-play-btn" title="Play / Pause" aria-label="Play / Pause">
                        ▶
                      </button>

                      <button type="button" class="audio-skip-btn" onclick="skipAudio(10)" title="Fast-forward 10 seconds">
                        +10s
                      </button>
                    </div>

                    <!-- Speed Options -->
                    <div style="display:flex; align-items:center; gap:8px;">
                      <label for="rp-audio-speed-select" style="font-size:12px; color:#64748B;">Speed:</label>
                      <select id="rp-audio-speed-select" class="audio-rate-select" aria-label="Playback Speed">
                        <option value="0.75">0.75x</option>
                        <option value="1.0" selected>1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2.0">2.0x</option>
                      </select>
                    </div>

                    <!-- Volume Control -->
                    <div class="audio-volume-wrap">
                      <button type="button" id="rp-audio-mute-btn" class="audio-skip-btn" title="Mute / Unmute" style="border:none;">
                        🔊
                      </button>
                      <input type="range" id="rp-audio-volume-slider" min="0" max="1" step="0.05" value="1" class="audio-volume-slider" aria-label="Volume">
                    </div>
                  </div>

                  <div id="rp-audio-error-box" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:12px; margin-top:10px;"></div>
                </div>
              </div>

              ${!hasAudio && !hasYouTube ? `
                <div style="padding:24px; text-align:center; color:#64748B; background:#F8FAFC; border-radius:8px; margin-top:14px;">
                  ⚠️ Media stream is currently being prepared for this episode.
                </div>
              ` : ''}

              <!-- Episode Playlist Navigation Buttons (Previous / Next) -->
              <div class="audio-playlist-nav-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid #E2E8F0;">
                <button type="button" class="btn btn-outline btn-sm" id="btn-audio-prev-ep" onclick="navigateAudioEpisode(-1)">
                  « Previous Episode
                </button>
                <span id="audio-ep-counter-pill" style="font-size:12px; font-weight:600; color:#64748B;"></span>
                <button type="button" class="btn btn-outline btn-sm" id="btn-audio-next-ep" onclick="navigateAudioEpisode(1)">
                  Next Episode »
                </button>
              </div>
            </div>

            <!-- Chapter-Wise and Episode-Wise Hierarchy Explorer -->
            <section class="audio-hierarchy-explorer">
              <h3 class="audio-hierarchy-title">
                <span>📖 Chapters & Episodes</span>
                <span style="font-size:13px; font-weight:normal; color:#64748B;">
                  (${audioNovel.chaptersCount || 0} ${audioNovel.chaptersCount === 1 ? 'Chapter' : 'Chapters'} • ${playlist.length} ${playlist.length === 1 ? 'Episode' : 'Episodes'})
                </span>
              </h3>

              ${(audioNovel.chapters || []).length === 0 ? `
                <div style="padding:24px; text-align:center; background:#FAF8F5; border-radius:8px; color:#64748B;">
                  No published episodes available yet.
                </div>
              ` : `
                <div class="audio-chapters-accordion-group">
                  ${audioNovel.chapters.map(ch => `
                    <div class="audio-chapter-accordion" id="acc-ch-${ch.id}">
                      <div class="audio-chapter-acc-header" onclick="toggleAudioChapterAccordion('${ch.id}')">
                        <div style="display:flex; align-items:center; gap:10px;">
                          <span class="admin-audio-chapter-badge">Chapter ${escapeHtml(ch.chapterNum || ch.episodeNumber)}</span>
                          <span style="font-weight:700; color:#0B1F33; font-size:15px;">${escapeHtml(ch.title)}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#64748B;">
                          <span>${(ch.subEpisodes || []).length} ${(ch.subEpisodes || []).length === 1 ? 'Episode' : 'Episodes'}</span>
                          <span id="acc-icon-${ch.id}">▼</span>
                        </div>
                      </div>

                      <div class="audio-episodes-acc-body" id="acc-body-${ch.id}">
                        ${(ch.subEpisodes || []).length === 0 ? `
                          <div style="font-size:12px; color:#94A3B8; padding:8px 10px; font-style:italic;">
                            No episodes released under this chapter yet.
                          </div>
                        ` : (ch.subEpisodes || []).map(ep => `
                          <div class="audio-episode-acc-item ${activeEpisode?.id === ep.id ? 'now-playing' : ''}" id="acc-ep-${ep.id}" onclick="playSelectedAudioEpisode('${ep.id}')">
                            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                              <span class="admin-audio-badge-sm">Episode ${escapeHtml(ep.episodeNumber)}</span>
                              <div>
                                <div style="font-size:14px; font-weight:600; color:#0B1F33;">${escapeHtml(ep.title)}</div>
                                <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                  ${ep.hasAudio && ep.hasYouTube ? '<span style="font-size:10px; color:#701A75; font-weight:700;">🎧+🎥 Both</span>' : (ep.hasYouTube ? '<span style="font-size:10px; color:#DC2626; font-weight:700;">🎥 Video</span>' : '<span style="font-size:10px; color:#D97706; font-weight:700;">🎧 Audio</span>')}
                                  ${ep.audioDuration ? `<span class="audio-duration-pill" style="font-size:10.5px;">⏱ ${escapeHtml(ep.audioDuration)}</span>` : ''}
                                </div>
                              </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                              ${activeEpisode?.id === ep.id ? `
                                <span class="now-playing-pill">Playing ▶</span>
                              ` : `
                                <button type="button" class="btn btn-gold btn-sm" style="font-size:11.5px; padding:3px 10px;">▶ Play</button>
                              `}
                            </div>
                          </div>

                          <!-- Sub-episodes (Level 2) -->
                          ${(ep.subEpisodes || []).map(sub => `
                            <div class="audio-episode-acc-item audio-subepisode-acc-item ${activeEpisode?.id === sub.id ? 'now-playing' : ''}" id="acc-ep-${sub.id}" onclick="playSelectedAudioEpisode('${sub.id}')">
                              <div style="display:flex; align-items:center; gap:8px; flex:1;">
                                <span class="admin-audio-badge-sm" style="background:#701A75;">Sub-Ep ${escapeHtml(sub.episodeNumber)}</span>
                                <div>
                                  <div style="font-size:13px; font-weight:600; color:#0B1F33;">${escapeHtml(sub.title)}</div>
                                  <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                    ${sub.hasAudio && sub.hasYouTube ? '<span style="font-size:9.5px; color:#701A75; font-weight:700;">🎧+🎥 Both</span>' : (sub.hasYouTube ? '<span style="font-size:9.5px; color:#DC2626; font-weight:700;">🎥 Video</span>' : '<span style="font-size:9.5px; color:#D97706; font-weight:700;">🎧 Audio</span>')}
                                    ${sub.audioDuration ? `<span class="audio-duration-pill" style="font-size:10px;">⏱ ${escapeHtml(sub.audioDuration)}</span>` : ''}
                                  </div>
                                </div>
                              </div>
                              <div style="display:flex; align-items:center; gap:8px;">
                                ${activeEpisode?.id === sub.id ? `
                                  <span class="now-playing-pill" style="font-size:9.5px;">Playing ▶</span>
                                ` : `
                                  <button type="button" class="btn btn-gold btn-sm" style="font-size:10.5px; padding:2px 8px;">▶ Play</button>
                                `}
                              </div>
                            </div>
                          `).join('')}
                        `).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </section>

            <!-- Audio Description & Information Pane -->
            <div class="audio-details-pane" style="margin-top:24px;">
              <h1 class="audio-details-title">${escapeHtml(audioNovel.title)}</h1>

              <div class="audio-details-tags">
                <span class="audio-tag gold">🎙️ Voice: ${escapeHtml(audioNovel.voice || audioNovel.author)}</span>
                <span class="audio-tag">📖 ${audioNovel.chaptersCount || 0} Chapters</span>
                <span class="audio-tag">🎧 ${playlist.length} Episodes</span>
                <span class="audio-tag">👁 ${Number(audioNovel.views || 0).toLocaleString()} listens</span>
              </div>

              ${audioNovel.description ? `
                <div class="audio-details-text">
                  ${escapeHtml(audioNovel.description).replace(/\n/g, '<br>')}
                </div>
              ` : ''}
            </div>

            <!-- Novel Comment Box (Exact Reuse of Existing Rich-Text Comment Engine) -->
            <section class="content-reading-comments-card" id="audio-comments-container" style="margin-top:28px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                <div>
                  <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:var(--color-navy-deep); margin:0;">
                    💬 Comments & Discussion
                  </h3>
                  <div style="font-size:12.5px; color:#64748B; margin-top:2px;">
                    Discussion for <strong id="audio-comments-context-label">${activeEpisode ? `Episode ${activeEpisode.episodeNumber || activeEpisode.chapterNum}` : 'Whole Novel'}</strong>
                  </div>
                </div>

                <div class="audio-comment-scope-buttons" style="display:flex; gap:6px;">
                  <button type="button" class="btn btn-xs btn-gold" id="btn-audio-comm-ep" onclick="switchAudioCommentsScope('episode')">
                    Episode Comments
                  </button>
                  <button type="button" class="btn btn-xs btn-outline" id="btn-audio-comm-novel" onclick="switchAudioCommentsScope('novel')">
                    Whole Novel Discussion
                  </button>
                </div>
              </div>

              <!-- Mount novel comment widget -->
              <div id="audio-comments-widget"></div>
            </section>
          </main>

          <!-- Sidebar: Linked Written Novel -->
          <aside class="audio-parts-sidebar">
            <div class="audio-linked-novel-card">
              <img src="${audioNovel.cover || '/default-cover.jpg'}" class="audio-linked-novel-cover" alt="" onerror="this.src='/default-cover.jpg'">
              <div class="audio-linked-novel-title">${escapeHtml(audioNovel.title)}</div>
              <p class="audio-linked-novel-desc">
                Author: ${escapeHtml(audioNovel.author)}<br>
                Voice Artist: ${escapeHtml(audioNovel.voice || audioNovel.author)}
              </p>
              <a href="#novel?id=${encodeURIComponent(audioNovel.id)}" class="btn btn-gold btn-sm" style="display:inline-block; width:100%;">
                📖 Read Written Novel »
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `;

  // Helper to update previous / next buttons
  function updatePlaylistNavButtons() {
    const curIdx = playlist.findIndex(e => String(e.id) === String(activeEpisode?.id));
    const prevBtn = document.getElementById('btn-audio-prev-ep');
    const nextBtn = document.getElementById('btn-audio-next-ep');
    const pill = document.getElementById('audio-ep-counter-pill');

    if (curIdx !== -1) {
      if (pill) pill.textContent = `${curIdx + 1} of ${playlist.length}`;
      if (prevBtn) prevBtn.disabled = curIdx <= 0;
      if (nextBtn) nextBtn.disabled = curIdx >= playlist.length - 1;
    } else {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
    }
  }

  window.navigateAudioEpisode = (delta) => {
    const curIdx = playlist.findIndex(e => String(e.id) === String(activeEpisode?.id));
    if (curIdx === -1) return;
    const targetIdx = curIdx + delta;
    if (targetIdx >= 0 && targetIdx < playlist.length) {
      window.playSelectedAudioEpisode(playlist[targetIdx].id);
    }
  };

  // Comments scope management
  let audioCommentScope = 'episode';
  function mountCurrentComments() {
    const contextLabel = document.getElementById('audio-comments-context-label');
    const btnEp = document.getElementById('btn-audio-comm-ep');
    const btnNovel = document.getElementById('btn-audio-comm-novel');

    if (audioCommentScope === 'episode' && activeEpisode) {
      const epNum = activeEpisode.episodeNumber || activeEpisode.chapterNum || '1';
      if (contextLabel) contextLabel.textContent = `Episode ${epNum}`;
      if (btnEp) { btnEp.className = 'btn btn-xs btn-gold'; }
      if (btnNovel) { btnNovel.className = 'btn btn-xs btn-outline'; }
      renderCommentsWidget('audio-comments-widget', audioNovel.id, epNum);
    } else {
      if (contextLabel) contextLabel.textContent = 'Whole Novel Discussion';
      if (btnEp) { btnEp.className = 'btn btn-xs btn-outline'; }
      if (btnNovel) { btnNovel.className = 'btn btn-xs btn-gold'; }
      renderCommentsWidget('audio-comments-widget', audioNovel.id, 0);
    }
  }

  window.switchAudioCommentsScope = (scope) => {
    audioCommentScope = scope;
    mountCurrentComments();
  };

  // Accordion toggle
  window.toggleAudioChapterAccordion = (chId) => {
    const body = document.getElementById(`acc-body-${chId}`);
    const icon = document.getElementById(`acc-icon-${chId}`);
    if (body) {
      if (body.style.display === 'none') {
        body.style.display = 'flex';
        if (icon) icon.textContent = '▼';
      } else {
        body.style.display = 'none';
        if (icon) icon.textContent = '▶';
      }
    }
  };

  // Play selected episode dynamically without reloading whole page
  window.playSelectedAudioEpisode = (epId) => {
    const ep = playlist.find(e => String(e.id) === String(epId));
    if (!ep) return;
    activeEpisode = ep;

    // Update active highlight in UI
    document.querySelectorAll('.audio-episode-acc-item').forEach(el => el.classList.remove('now-playing'));
    const targetItem = document.getElementById(`acc-ep-${ep.id}`);
    if (targetItem) targetItem.classList.add('now-playing');

    // Update header info
    const trackBadge = document.getElementById('rp-track-badge');
    const trackTitle = document.getElementById('rp-track-title');
    const trackSubtitle = document.getElementById('rp-track-subtitle');
    const trackCover = document.getElementById('rp-track-cover-img');

    if (trackBadge) trackBadge.textContent = `🎧 Episode ${ep.episodeNumber}`;
    if (trackTitle) trackTitle.textContent = ep.title;
    if (trackSubtitle) trackSubtitle.textContent = `Voice: ${audioNovel.voice || audioNovel.author} ${ep.audioDuration ? `• Duration: ${ep.audioDuration}` : ''}`;
    if (trackCover && ep.thumbnail) trackCover.src = ep.thumbnail;

    const hasEpAudio = Boolean(ep.audioFileUrl);
    const hasEpYt = Boolean(ep.youtubeUrl || ep.youtubeVideoId);

    const ytStage = document.getElementById('rp-yt-stage');
    const directStage = document.getElementById('rp-direct-audio-stage');
    const iframe = document.getElementById('rp-yt-iframe');
    const audioEl = document.getElementById('rp-active-audio-player');

    // Handle YouTube
    if (hasEpYt) {
      if (ytStage) ytStage.style.display = 'block';
      if (iframe) iframe.src = ep.embedUrl || `https://www.youtube-nocookie.com/embed/${ep.youtubeVideoId}?rel=0&autoplay=1`;
    } else {
      if (ytStage) ytStage.style.display = 'none';
      if (iframe) iframe.src = '';
    }

    // Handle Direct Audio
    if (hasEpAudio) {
      if (directStage) directStage.style.display = 'block';
      if (audioEl && ep.audioFileUrl) {
        audioEl.src = ep.audioFileUrl;
        audioEl.play().catch(e => console.warn('Autoplay prevented:', e.message));
        const playBtn = document.getElementById('rp-audio-play-pause-btn');
        if (playBtn) playBtn.textContent = '⏸';
      }
    } else {
      if (directStage) directStage.style.display = 'none';
      if (audioEl) audioEl.pause();
    }

    updatePlaylistNavButtons();
    mountCurrentComments();
  };

  // Initialize Custom HTML5 Audio Player Controls
  const audioEl = document.getElementById('rp-active-audio-player');
  if (audioEl) {
    setupHtml5AudioPlayer(audioEl);
  }

  updatePlaylistNavButtons();
  mountCurrentComments();

  window.skipAudio = (seconds) => {
    const audioEl = document.getElementById('rp-active-audio-player');
    if (audioEl && isFinite(audioEl.duration)) {
      audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, audioEl.currentTime + seconds));
    }
  };
}

function setupHtml5AudioPlayer(audioEl) {
  const playBtn = document.getElementById('rp-audio-play-pause-btn');
  const seekSlider = document.getElementById('rp-audio-seek-slider');
  const curTimeEl = document.getElementById('rp-audio-current-time');
  const durTimeEl = document.getElementById('rp-audio-duration-time');
  const speedSelect = document.getElementById('rp-audio-speed-select');
  const volumeSlider = document.getElementById('rp-audio-volume-slider');
  const muteBtn = document.getElementById('rp-audio-mute-btn');
  const errorBox = document.getElementById('rp-audio-error-box');

  function formatSecs(secs) {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  if (playBtn) {
    playBtn.onclick = () => {
      if (audioEl.paused) {
        audioEl.play().catch(e => {
          if (errorBox) {
            errorBox.textContent = 'Playback error: ' + (e.message || 'Unable to play audio stream.');
            errorBox.style.display = 'block';
          }
        });
      } else {
        audioEl.pause();
      }
    };
  }

  audioEl.onplay = () => {
    if (playBtn) playBtn.innerHTML = '⏸';
    if (errorBox) errorBox.style.display = 'none';
  };

  audioEl.onpause = () => {
    if (playBtn) playBtn.innerHTML = '▶';
  };

  audioEl.onloadedmetadata = () => {
    if (durTimeEl && audioEl.duration && isFinite(audioEl.duration)) {
      durTimeEl.textContent = formatSecs(audioEl.duration);
    }
  };

  audioEl.ontimeupdate = () => {
    if (curTimeEl) {
      curTimeEl.textContent = formatSecs(audioEl.currentTime);
    }
    if (seekSlider && audioEl.duration && isFinite(audioEl.duration)) {
      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      seekSlider.value = pct || 0;
    }
  };

  if (seekSlider) {
    seekSlider.oninput = (e) => {
      if (audioEl.duration && isFinite(audioEl.duration)) {
        const targetTime = (e.target.value / 100) * audioEl.duration;
        audioEl.currentTime = targetTime;
      }
    };
  }

  if (speedSelect) {
    speedSelect.onchange = (e) => {
      audioEl.playbackRate = parseFloat(e.target.value) || 1.0;
    };
  }

  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      audioEl.volume = parseFloat(e.target.value);
      if (muteBtn) {
        muteBtn.textContent = audioEl.volume === 0 ? '🔇' : '🔊';
      }
    };
  }

  if (muteBtn) {
    muteBtn.onclick = () => {
      audioEl.muted = !audioEl.muted;
      muteBtn.textContent = audioEl.muted ? '🔇' : '🔊';
    };
  }

  audioEl.onerror = () => {
    if (errorBox) {
      errorBox.textContent = 'Failed to load audio stream. Please check file format and network connectivity.';
      errorBox.style.display = 'block';
    }
  };
}

window.showContentRestrictionModal = ({ title, message, redirectHash } = {}) => {
  document.getElementById('content-restriction-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop active';
  modal.id = 'content-restriction-modal';
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center; max-width:440px; padding:32px 24px;">
      <div style="font-size:48px; margin-bottom:12px;">🎧🔒</div>
      <h3 style="font-family:var(--font-serif); font-size:1.4rem; color:var(--color-navy-deep); margin-bottom:8px;">
        ${title || 'Members Only Content'}
      </h3>
      <p style="font-size:15px; color:var(--color-navy-deep); font-weight:600; margin-bottom:10px; line-height:1.5;">
        ${message || 'Please log in to continue reading the full story.'}
      </p>
      <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:24px; line-height:1.6;">
        Guests can read the latest daily update of each novel for free. Previous chapters, completed stories, and full audio stories are reserved for registered members.
      </p>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-gold btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#forms'}'); openAuthModal('login');">
          🔑 ${t('btn_login')}
        </button>
        <button class="btn btn-outline btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#forms'}'); openAuthModal('register');">
          ✨ ${t('btn_register')}
        </button>
        <button class="btn btn-outline btn-sm" style="border:none; margin-top:6px; color:var(--color-text-muted);" onclick="document.getElementById('content-restriction-modal')?.remove();">
          Close
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};





// ============================================================================
// DEDICATED CONTENT READING VIEW (Main Title -> Sub Title -> Content Title -> Reading Content)
// ============================================================================

// ============================================================================
// DEDICATED THREAD CREATION VIEW (Admin and Writers Only)
// ============================================================================
async function renderThreadCreateView(container, hash = '') {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const subId = urlParams.get('sub') || '';
  const catId = urlParams.get('cat') || '';

  const isPrivilegedWriter = Boolean(
    window.CURRENT_USER && (
      window.CURRENT_USER.isAdmin ||
      ['admin', 'administrator', 'editor', 'writer', 'author'].includes((window.CURRENT_USER.role || '').toLowerCase()) ||
      window.CURRENT_USER.isWriter
    )
  );

  if (!window.IS_LOGGED_IN) {
    showToast('Please log in as Admin or Writer to post a thread.');
    window.location.hash = '#auth?mode=login';
    return;
  }

  if (!isPrivilegedWriter) {
    showToast('Access restricted: Only Admin and Writers can post threads.');
    window.location.hash = '#forms';
    return;
  }

  container.innerHTML = `
    <div class="container section" style="max-width:860px; margin:0 auto; padding:40px 16px;">
      <div style="text-align:center; padding:50px 20px; color:#64748B;">
        <div style="width:34px; height:34px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading thread creator...</div>
      </div>
    </div>
  `;

  const token = localStorage.getItem('rp_auth_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  let hierarchy = [];
  try {
    const res = await fetch('/api/content/hierarchy', { headers });
    const data = await res.json();
    hierarchy = data.hierarchy || [];
  } catch (e) {}

  let targetCat = hierarchy.find(c => String(c.id) === String(catId));
  let targetSub = null;
  for (const c of hierarchy) {
    const s = (c.subcategories || []).find(sub => String(sub.id) === String(subId));
    if (s) {
      targetSub = s;
      if (!targetCat) targetCat = c;
      break;
    }
  }

  const catTitle = targetCat?.title || 'General';
  const subTitle = targetSub?.title || 'Category Title';

  container.innerHTML = `
    <div class="container section" style="max-width:860px; margin:0 auto; padding:40px 16px;">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" style="margin-bottom:20px;">
        <a href="#forms">Home</a>
        <span class="crumb-separator">›</span>
        <a href="#forms">Forms</a>
        <span class="crumb-separator">›</span>
        <a href="#forms?category=${encodeURIComponent(targetCat?.id || catId)}">${escapeHtml(catTitle)}</a>
        <span class="crumb-separator">›</span>
        <a href="#forms?sub=${encodeURIComponent(targetSub?.id || subId)}">${escapeHtml(subTitle)}</a>
        <span class="crumb-separator">›</span>
        <span class="crumb-current">Add Thread</span>
      </nav>

      <div class="card" style="background:#FFFFFF; border:1px solid #E8DCCB; border-radius:16px; padding:32px; box-shadow:0 8px 30px rgba(11,31,51,0.06);">
        <div style="border-bottom:1px solid #F1ECE4; padding-bottom:18px; margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <span class="forms-cat-pill" style="margin-bottom:8px; display:inline-block;">${escapeHtml(catTitle)} › ${escapeHtml(subTitle)}</span>
              <h1 style="font-family:var(--font-serif); font-size:1.85rem; color:#0B1F33; margin:0 0 6px;">Create New Thread</h1>
              <p style="color:#64748B; font-size:13.5px; margin:0;">
                Post your thread with linked novel content to publish it for readers in this category.
              </p>
            </div>
            <a href="#forms?sub=${encodeURIComponent(targetSub?.id || subId)}" class="btn btn-outline btn-sm">
              « Back to Section
            </a>
          </div>
        </div>

        <form id="thread-create-form" onsubmit="event.preventDefault(); window.submitThreadPosting('${escapeQuotes(targetCat?.id || catId)}', '${escapeQuotes(targetSub?.id || subId)}');">
          <div id="thread-error-banner" style="display:none; background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:12px 16px; border-radius:8px; font-size:13px; margin-bottom:18px; font-weight:600;"></div>

          <!-- 1. Thread Title -->
          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Thread Title <span style="color:#DC2626;">*</span>
            </label>
            <input type="text" id="thread-title-input" class="form-input" 
                   placeholder="e.g. Episode 1: A New Dawn — Reading &amp; Discussion" 
                   style="width:100%; box-sizing:border-box; font-size:15px; padding:10px 14px;" required>
          </div>

          <!-- 2. Content / Description Editor -->
          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Content / Description Editor
            </label>
            <div style="font-size:12px; color:#64748B; margin-bottom:6px;">
              Add introductory notes, episode synopsis, or discussion prompts for readers.
            </div>
            <textarea id="thread-content-input" class="form-input" rows="6" 
                      placeholder="Write your episode introduction, author reflections, or background thoughts here..." 
                      style="width:100%; box-sizing:border-box; font-size:14px; line-height:1.6; padding:12px;"></textarea>
          </div>

          <!-- 3. Novel Content Link field -->
          <div style="margin-bottom:26px; background:#FAF8F5; border:1px solid #E8DCCB; border-radius:10px; padding:16px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:4px;">
              Novel Content Link <span style="color:#DC2626;">*</span>
            </label>
            <div style="font-size:12px; color:#856404; margin-bottom:8px;">
              Paste the unique content link generated after saving the novel/episode in your Admin or Writer dashboard.
            </div>
            <input type="text" id="thread-novel-link-input" class="form-input" 
                   placeholder="e.g. http://localhost:5173/#reader?novel=hello&amp;ch=1 or #reader?novel=hello&amp;ch=1" 
                   style="width:100%; box-sizing:border-box; font-family:monospace; font-size:13px; padding:10px 14px;" required>
          </div>

          <!-- Actions -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid #F1ECE4; padding-top:20px;">
            <a href="#forms?sub=${encodeURIComponent(targetSub?.id || subId)}" class="btn btn-outline">
              Cancel
            </a>
            <button type="submit" class="btn btn-gold btn-lg" id="btn-submit-thread" style="display:inline-flex; align-items:center; gap:8px; font-weight:700; padding:10px 24px;">
              🚀 Publish Thread
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

window.submitThreadPosting = async (catId, subId) => {
  const titleInput = document.getElementById('thread-title-input');
  const contentInput = document.getElementById('thread-content-input');
  const linkInput = document.getElementById('thread-novel-link-input');
  const errorBanner = document.getElementById('thread-error-banner');
  const submitBtn = document.getElementById('btn-submit-thread');

  if (errorBanner) errorBanner.style.display = 'none';

  const title = (titleInput?.value || '').trim();
  const content = (contentInput?.value || '').trim();
  const novelLink = (linkInput?.value || '').trim();

  if (!title) {
    if (errorBanner) {
      errorBanner.textContent = 'Please enter a thread title.';
      errorBanner.style.display = 'block';
    }
    titleInput?.focus();
    return;
  }

  if (!novelLink) {
    if (errorBanner) {
      errorBanner.textContent = 'Please paste the novel content link from your dashboard.';
      errorBanner.style.display = 'block';
    }
    linkInput?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';
  }

  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const res = await fetch('/api/content/threads', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mainCategoryId: catId,
        subCategoryId: subId,
        title,
        content,
        novelLink,
        status: 'published',
        isPublished: 1
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to publish thread.');
    }

    showToast('Thread published successfully! 🎉');
    window.location.hash = `#forms?sub=${encodeURIComponent(subId)}`;
  } catch (err) {
    if (errorBanner) {
      errorBanner.textContent = err.message || 'Error publishing thread.';
      errorBanner.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Publish Thread';
    }
  }
};



// ============================================================================
// DEDICATED THREAD & CONTENT READING VIEW (Novel Reading Layout & Rules)
// ============================================================================
async function renderContentReadingView(container, hash) {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const slug = urlParams.get('id') || urlParams.get('slug') || (hash.includes('/') ? hash.split('/')[1] : '');

  container.innerHTML = `
    <div class="content-reading-wrap">
      <div style="text-align:center; padding:60px 20px; color:#64748B;">
        <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading reading content...</div>
      </div>
    </div>
  `;

  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`/api/content/articles/${encodeURIComponent(slug)}`, { headers });
    const data = await res.json();

    if (!res.ok || !data.success) {
      const errCode = data.code || 'UNAVAILABLE';
      let errTitle = 'Content Temporarily Unavailable';
      let errDesc = data.error || 'This content is not accessible at this moment.';
      let icon = '🔒';

      if (errCode === 'FORBIDDEN') {
        errTitle = 'Access Restricted';
        icon = '🚫';
      } else if (errCode === 'DISABLED') {
        errTitle = 'Temporarily Disabled';
        icon = '⏸️';
      } else if (errCode === 'UNPUBLISHED') {
        errTitle = 'Unpublished Content';
        icon = '📝';
      }

      container.innerHTML = `
        <div class="content-reading-wrap">
          <nav class="forum-breadcrumbs" style="margin-bottom:20px;">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms</a>
            <span class="crumb-separator">›</span>
            <span class="crumb-current">Unavailable</span>
          </nav>

          <div class="content-restricted-alert">
            <div style="font-size:42px; margin-bottom:12px;">${icon}</div>
            <h2 style="font-family:var(--font-serif); color:#9A3412; margin:0 0 8px;">${escapeHtml(errTitle)}</h2>
            <p style="color:#7C2D12; font-size:14px; margin-bottom:20px; line-height:1.6;">
              ${escapeHtml(errDesc)}
            </p>
            <div style="display:flex; justify-content:center; gap:12px;">
              <a href="#forms" class="btn btn-primary btn-sm">« Return to Forms &amp; Community</a>
              <a href="#novels" class="btn btn-outline btn-sm">Explore Novels</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const art = data.article;
    const authorAvatar = art.authorAvatar || '/profile.png';
    const commentsCount = Number(art.commentsCount || 0);

    const rawNovelStory = art.linkedChapter?.content || (art.linkedNovel ? (art.linkedNovel.description || art.linkedNovel.synopsis) : '') || art.content || '';
    const isHtml = rawNovelStory.includes('<p>') || rawNovelStory.includes('<div') || rawNovelStory.includes('<h');
    const storyBody = isHtml ? rawNovelStory : rawNovelStory.split('\n\n').filter(Boolean).map(p => `<p>${p}</p>`).join('');
    const currentMode = localStorage.getItem('rp_reader_mode') || 'light';

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
            <button class="mode-pill ${currentMode === 'light' ? 'active' : ''}" data-mode="light" onclick="setReaderMode('light')">Light</button>
            <button class="mode-pill ${currentMode === 'sepia' ? 'active' : ''}" data-mode="sepia" onclick="setReaderMode('sepia')">Sepia</button>
            <button class="mode-pill ${currentMode === 'dark' ? 'active' : ''}" data-mode="dark" onclick="setReaderMode('dark')">Dark</button>
          </div>
          <div class="reader-toolbar-group">
            <button class="reader-tool-btn" onclick="shareChapter('copy', '${escapeQuotes(art.title)}')" title="Share Link">🔗 Share</button>
          </div>
        </div>

        <div class="reader-container" style="max-width:840px; margin:0 auto; padding:20px 16px;">
          <!-- Breadcrumbs & Back Bar -->
          <nav class="forum-breadcrumbs" style="margin-bottom:14px;">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms</a>
            <span class="crumb-separator">›</span>
            <a href="#forms?category=${encodeURIComponent(art.mainCategoryId || '')}">${escapeHtml(art.mainCategoryTitle || 'Category')}</a>
            <span class="crumb-separator">›</span>
            <a href="#forms?sub=${encodeURIComponent(art.subCategoryId || '')}">${escapeHtml(art.subCategoryTitle || 'Section')}</a>
            <span class="crumb-separator">›</span>
            <span class="crumb-current">${escapeHtml(art.title)}</span>
          </nav>

          <div class="content-reading-back-bar" style="margin-bottom:18px;">
            <a href="#forms?sub=${encodeURIComponent(art.subCategoryId || '')}" class="content-back-btn">
              « Back to ${escapeHtml(art.subCategoryTitle || 'Section')}
            </a>
            <div style="font-size:12px; color:#64748B;">
              Published: <strong>${new Date(art.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            </div>
          </div>

          <!-- Chapter Header -->
          <div class="reader-header" style="margin-bottom:24px; text-align:left;">
            ${art.linkedNovel ? `
              <div style="font-size:13px; font-weight:700; color:#B88635; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                📖 ${escapeHtml(art.linkedNovel.title)}${art.linkedChapter ? ` — ${escapeHtml(art.linkedChapter.title || ('Chapter ' + (art.linkedChapter.episodeNumber || art.linkedChapter.chapterNum)))}` : ''}
              </div>
            ` : ''}
            <h1 class="reader-chapter-title" style="font-family:var(--font-serif); font-size:clamp(1.7rem, 4vw, 2.4rem); color:var(--color-navy-deep); margin:0 0 10px;">
              ${escapeHtml(art.title)}
            </h1>

            <div class="reader-meta-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 0; border-top:1px solid rgba(0,0,0,0.06); border-bottom:1px solid rgba(0,0,0,0.06);">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="${authorAvatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #C89B3C;" alt="${escapeHtml(art.authorName)}" onerror="this.src='/profile.png'">
                <div>
                  <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">
                    ${escapeHtml(art.authorName)}
                    <span class="forms-role-badge" style="margin-left:6px;">Official Author</span>
                  </div>
                  <div style="font-size:11px; color:#64748B;">Rudhra Prarthana Novels</div>
                </div>
              </div>

              <div style="display:flex; gap:14px; font-size:12.5px; color:#64748B; align-items:center;">
                <span title="Views">👁️ ${art.viewsCount || 0} reads</span>
                <span>•</span>
                <span title="Comments">💬 ${commentsCount} comments</span>
              </div>
            </div>
          </div>

          <!-- Distraction-Free Novel Content Body with Copy Protection (Read-Only) -->
          <article class="reader-body reader-body-protected" id="reader-body-content" title="Content copying is restricted" style="min-height:220px; line-height:1.85; font-size:var(--reader-font-size, 1.15rem);">
            ${storyBody || '<p style="color:#64748B; font-style:italic;">No novel content available for this thread.</p>'}
          </article>

          <!-- Comments & Reviews Section -->
          <section style="margin-top:40px; padding-top:24px; border-top:1px dashed #E2E8F0;">
            <h3 style="font-family:var(--font-serif); font-size:1.35rem; color:#0B1F33; margin:0 0 16px;">
              💬 Reader Comments &amp; Discussion
            </h3>
            <div id="article-comments-widget"></div>
          </section>
        </div>
      </div>
    `;

    // Attach read-only protection listeners
    const readerContent = document.getElementById('reader-body-content');
    if (readerContent) {
      const handleBlockedCopy = (e) => {
        e.preventDefault();
        showToast('Content copying is restricted. 🔒');
      };
      readerContent.addEventListener('copy', handleBlockedCopy);
      readerContent.addEventListener('contextmenu', handleBlockedCopy);
      readerContent.addEventListener('selectstart', (e) => e.preventDefault());
    }

    // Mount novel-style comments widget
    renderCommentsWidget('article-comments-widget', `content_${art.id}`, 0);
  } catch (err) {
    console.error('Error rendering content reading view:', err);
    container.innerHTML = `
      <div class="content-reading-wrap">
        <div class="content-restricted-alert">
          <h2>Failed to Load Content</h2>
          <p>${escapeHtml(err.message)}</p>
          <a href="#forms" class="btn btn-primary btn-sm">Return to Forms</a>
        </div>
      </div>
    `;
  }
}


window.loadArticleComments = async (articleId) => {
  const container = document.getElementById('article-comments-container');
  if (!container) return;
  try {
    const res = await fetch(`/api/content/articles/${articleId}/comments`);
    const data = await res.json();
    const comments = data.comments || [];
    const counter = document.getElementById('article-comments-counter');
    if (counter) counter.textContent = data.total || comments.length;

    if (comments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:#64748B; background:#FAF7F2; border-radius:10px;">
          <div style="font-size:24px; margin-bottom:6px;">💬</div>
          <div style="font-size:13.5px; font-weight:600; color:#1A0B2E;">No comments yet</div>
          <div style="font-size:12px;">Be the first to share your thoughts on this note!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = comments.map(c => `
      <div class="comment-item" style="border-bottom:1px solid #F1ECE4; padding:16px 0;" id="comment-item-${c.id}">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <img src="${c.avatar || '/profile.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png'" alt="">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div>
                <strong style="color:#1A0B2E; font-size:13.5px;">${escapeHtml(c.author)}</strong>
                ${c.role === 'author' || c.role === 'admin' ? '<span class="forms-role-badge" style="margin-left:4px;">Author</span>' : ''}
              </div>
              <span style="font-size:11.5px; color:#64748B;">${new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="font-size:13px; color:#2D3748; line-height:1.6; margin-bottom:8px;">
              ${escapeHtml(c.content)}
            </div>
            <div style="display:flex; gap:14px; font-size:11.5px;">
              ${window.IS_LOGGED_IN ? `
                <button type="button" onclick="window.toggleReplyForm(${c.id})" style="border:none; background:none; color:#6B21A8; font-weight:600; cursor:pointer; padding:0;">
                  Reply
                </button>
              ` : ''}
              ${(window.CURRENT_USER && (window.CURRENT_USER.id === c.userId || window.CURRENT_USER.isAdmin)) ? `
                <button type="button" onclick="window.deleteArticleComment(${articleId}, ${c.id})" style="border:none; background:none; color:#DC2626; font-weight:600; cursor:pointer; padding:0;">
                  Delete
                </button>
              ` : ''}
            </div>

            <!-- Inline reply form container -->
            <div id="reply-form-${c.id}" style="display:none; margin-top:10px;">
              <textarea id="reply-input-${c.id}" rows="2" class="form-input" style="width:100%; border-radius:8px; border:1px solid #CBD5E1; padding:8px; font-size:12.5px; margin-bottom:6px;" placeholder="Write a reply..."></textarea>
              <div style="text-align:right; display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn btn-outline btn-xs" onclick="window.toggleReplyForm(${c.id})">Cancel</button>
                <button type="button" class="btn btn-gold btn-xs" onclick="window.submitArticleReply(${articleId}, ${c.id})">Submit Reply</button>
              </div>
            </div>

            <!-- Nested Replies -->
            ${(c.replies && c.replies.length > 0) ? `
              <div style="margin-top:12px; margin-left:14px; border-left:2px solid #E9D5FF; padding-left:12px;">
                ${c.replies.map(rep => `
                  <div style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div>
                        <strong style="color:#1A0B2E; font-size:12.5px;">${escapeHtml(rep.author)}</strong>
                        ${rep.role === 'author' || rep.role === 'admin' ? '<span class="forms-role-badge" style="margin-left:4px;">Author</span>' : ''}
                      </div>
                      <span style="font-size:11px; color:#64748B;">${new Date(rep.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style="font-size:12.5px; color:#2D3748; line-height:1.5;">${escapeHtml(rep.content)}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load article comments:', err);
    container.innerHTML = `<div style="color:#DC2626; font-size:12px; text-align:center;">Failed to load comments: ${escapeHtml(err.message)}</div>`;
  }
};

window.toggleReplyForm = (commentId) => {
  const form = document.getElementById(`reply-form-${commentId}`);
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
};

window.submitArticleComment = async (e, articleId) => {
  e.preventDefault();
  const input = document.getElementById('article-comment-input');
  const btn = document.getElementById('article-comment-submit-btn');
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    openAuthModal('login');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Posting...';
  }

  try {
    const res = await fetch(`/api/content/articles/${articleId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      input.value = '';
      if (typeof window.showToast === 'function') {
        window.showToast('✅ Comment posted successfully!');
      }
      await window.loadArticleComments(articleId);
    } else {
      alert(data.error || 'Failed to post comment');
    }
  } catch (err) {
    alert(err.message || 'Error submitting comment');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Post Comment';
    }
  }
};

window.submitArticleReply = async (articleId, parentId) => {
  const input = document.getElementById(`reply-input-${parentId}`);
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/content/articles/${articleId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content, parentId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      window.toggleReplyForm(parentId);
      if (typeof window.showToast === 'function') {
        window.showToast('✅ Reply posted successfully!');
      }
      await window.loadArticleComments(articleId);
    } else {
      alert(data.error || 'Failed to post reply');
    }
  } catch (err) {
    alert(err.message || 'Error submitting reply');
  }
};

window.deleteArticleComment = async (articleId, commentId) => {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  const token = localStorage.getItem('rp_auth_token');
  if (!token) return;

  try {
    const res = await fetch(`/api/content/articles/${articleId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (typeof window.showToast === 'function') {
        window.showToast('Comment deleted.');
      }
      await window.loadArticleComments(articleId);
    } else {
      alert(data.error || 'Failed to delete comment');
    }
  } catch (err) {
    alert(err.message || 'Error deleting comment');
  }
};


/**
 * Render Dedicated Short Story Reading View
 */
async function renderStoryReadingView(container, hash) {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const idOrSlug = urlParams.get('slug') || urlParams.get('id') || (hash.includes('/') ? hash.split('/')[1] : '');

  container.innerHTML = `
    <div class="content-reading-wrap">
      <div style="text-align:center; padding:60px 20px; color:#64748B;">
        <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading short story...</div>
      </div>
    </div>
  `;

  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`/api/short-stories/${encodeURIComponent(idOrSlug)}`, { headers });
    const data = await res.json();

    if (!res.ok || !data.success || !data.story) {
      const errCode = data.code || 'UNAVAILABLE';
      let errTitle = 'Short Story Temporarily Unavailable';
      let errDesc = data.error || 'This short story is not accessible at this moment.';
      let icon = '📖';

      if (errCode === 'FORBIDDEN') {
        errTitle = 'Access Restricted';
        icon = '🚫';
      } else if (errCode === 'DISABLED') {
        errTitle = 'Story Temporarily Disabled';
        icon = '⏸️';
      } else if (errCode === 'UNPUBLISHED') {
        errTitle = 'Unpublished Story';
        icon = '📝';
      }

      container.innerHTML = `
        <div class="content-reading-wrap">
          <nav class="forum-breadcrumbs" style="margin-bottom:20px;">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms</a>
            <span class="crumb-separator">›</span>
            <a href="#forms?category=short-stories">Short Stories</a>
            <span class="crumb-separator">›</span>
            <span class="crumb-current">Unavailable</span>
          </nav>

          <div class="content-restricted-alert">
            <div style="font-size:42px; margin-bottom:12px;">${icon}</div>
            <h2 style="font-family:var(--font-serif); color:#9A3412; margin:0 0 8px;">${escapeHtml(errTitle)}</h2>
            <p style="color:#7C2D12; font-size:14px; margin-bottom:20px; line-height:1.6;">
              ${escapeHtml(errDesc)}
            </p>
            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
              <a href="#forms?category=short-stories" class="btn btn-primary btn-sm">« Return to Short Stories</a>
              <a href="#forms" class="btn btn-outline btn-sm">Forms &amp; Community</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const story = data.story;
    const authorName = story.author || 'Rudhra Prarthana';
    const authorAvatar = story.authorAvatar || '/profile.png';
    const commentsCount = Number(story.comments_count ?? story.commentsCount ?? 0);
    const viewsCount = Number(story.views_count ?? story.viewsCount ?? 0);
    const wordCount = Number(story.word_count ?? story.wordCount ?? 0);
    const readTime = story.read_time || story.readTime || '10 mins read';
    const publishedDate = story.published_at || story.publishedAt || story.created_at || story.createdAt;
    const titleTa = story.title_ta || story.titleTa;
    const coverImg = story.cover_image || story.coverImage;

    container.innerHTML = `
      <div class="content-reading-wrap">
        <!-- Breadcrumbs & Back Navigation -->
        <nav class="forum-breadcrumbs" style="margin-bottom:14px;">
          <a href="#forms">Home</a>
          <span class="crumb-separator">›</span>
          <a href="#forms">Forms</a>
          <span class="crumb-separator">›</span>
          <a href="#forms?category=short-stories">Short Stories</a>
          <span class="crumb-separator">›</span>
          <span class="crumb-current">${escapeHtml(story.title)}</span>
        </nav>

        <div class="content-reading-back-bar">
          <a href="#forms?category=short-stories" class="content-back-btn">
            <span>«</span> Back to Short Stories
          </a>
          <div style="font-size:12px; color:#64748B;">
            Published: <strong>${new Date(publishedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
        </div>

        <!-- Main Short Story Article Card -->
        <article class="content-reading-card story-reading-card">
          <div class="content-reading-badge">
            <span>📖</span>
            <span>${escapeHtml(story.genre || 'Short Story')}</span>
          </div>

          <h1 class="content-reading-headline story-reading-headline">${escapeHtml(story.title)}</h1>
          ${titleTa ? `
            <div class="story-tamil-subheadline" style="font-size:1.15rem; color:#B88635; margin-top:-6px; margin-bottom:16px; font-weight:600;">
              ${escapeHtml(titleTa)}
            </div>
          ` : ''}

          <div class="content-reading-meta-bar" style="flex-wrap:wrap; gap:16px;">
            <div class="content-author-chip">
              <img src="${authorAvatar}" class="content-author-avatar" alt="${escapeHtml(authorName)}" onerror="this.src='/profile.png'">
              <div>
                <div class="content-author-name">
                  ${escapeHtml(authorName)}
                  <span class="forms-role-badge" style="margin-left:6px;">Official Author</span>
                </div>
                <div class="content-author-sub">
                  <span>Rudhra Prarthana Literary Platform</span>
                </div>
              </div>
            </div>

            <div style="display:flex; gap:14px; font-size:12.5px; color:#64748B; align-items:center; flex-wrap:wrap;">
              <span title="Read Time">⏳ ${escapeHtml(readTime)}</span>
              <span>•</span>
              <span title="Word Count">📝 ${wordCount.toLocaleString()} words</span>
              <span>•</span>
              <span title="Total Reads">👁️ ${viewsCount.toLocaleString()} reads</span>
              <span>•</span>
              <span title="Comments">💬 <span id="story-meta-comments-count">${commentsCount}</span> comments</span>
            </div>
          </div>

          ${coverImg ? `
            <div class="story-cover-banner" style="text-align:center; margin:22px 0 28px;">
              <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(story.title)}" 
                   style="max-height:380px; max-width:100%; border-radius:12px; box-shadow:0 8px 24px rgba(26,11,46,0.12); object-fit:cover;"
                   onerror="this.style.display='none';">
            </div>
          ` : ''}

          ${story.description ? `
            <div class="story-synopsis-callout" style="background:#FAF7F2; border-left:3px solid #C89B3C; padding:14px 18px; border-radius:0 8px 8px 0; margin-bottom:26px; font-style:italic; color:#475569; font-size:14.5px; line-height:1.65;">
              ${escapeHtml(story.description)}
            </div>
          ` : ''}

          <!-- Formatted Rich-Text Story Body -->
          <div class="content-reading-body story-reading-body" style="font-family:'Lora', 'Georgia', serif; font-size:1.1rem; line-height:1.85; color:#1E293B;">
            ${story.content || ''}
          </div>

          <!-- Elegant Finishing Flourish -->
          <div class="story-fin-ornament" style="text-align:center; margin:42px 0 16px; color:#B88635; font-size:26px;" aria-hidden="true">
            ❦
          </div>
        </article>

        <!-- Dedicated Comments Section -->
        <section class="content-reading-comments-card" id="story-comments-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #F1ECE4; padding-bottom:12px;">
            <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:#1A0B2E; margin:0;">
              💬 Reader Thoughts &amp; Discussion (<span id="story-comments-counter">${commentsCount}</span>)
            </h3>
          </div>

          <!-- Comment Input Form -->
          <div style="margin-bottom:28px;">
            ${window.IS_LOGGED_IN ? `
              <form id="story-comment-form" onsubmit="window.submitStoryComment(event, ${story.id})">
                <textarea id="story-comment-input" rows="3" class="form-input" 
                          style="width:100%; border-radius:10px; border:1px solid #E2E8F0; padding:12px; font-family:inherit; resize:vertical; margin-bottom:10px;"
                          placeholder="Share your thoughts on this story with author Rudhra Prarthana and fellow members..."></textarea>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                  <span style="font-size:12px; color:#64748B;">Polite and warm reader camaraderie is welcomed.</span>
                  <button type="submit" id="story-comment-submit-btn" class="btn btn-gold btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>
            ` : `
              <div style="background:#FAF7F2; border:1px dashed #C89B3C; border-radius:10px; padding:18px; text-align:center;">
                <p style="margin:0 0 10px 0; font-size:13.5px; color:#1A0B2E;">Log in to participate in the conversation and share your feedback on this story.</p>
                <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">Log In to Comment</button>
              </div>
            `}
          </div>

          <!-- Comments List Container -->
          <div id="story-comments-container">
            <div style="text-align:center; padding:20px; color:#64748B;">Loading comments...</div>
          </div>
        </section>
      </div>
    `;

    // Load live story comments
    window.loadStoryComments(story.id);
  } catch (err) {
    console.error('Error rendering short story reading view:', err);
    container.innerHTML = `
      <div class="content-reading-wrap">
        <div class="content-restricted-alert">
          <h2>Failed to Load Story</h2>
          <p>${escapeHtml(err.message)}</p>
          <a href="#forms?category=short-stories" class="btn btn-primary btn-sm">Return to Short Stories</a>
        </div>
      </div>
    `;
  }
}

/**
 * Load Comments for Short Story
 */
window.loadStoryComments = async (storyId) => {
  const container = document.getElementById('story-comments-container');
  if (!container) return;
  try {
    const res = await fetch(`/api/short-stories/${storyId}/comments`);
    const data = await res.json();
    const comments = data.comments || [];
    const total = data.total !== undefined ? data.total : comments.length;

    const counter = document.getElementById('story-comments-counter');
    if (counter) counter.textContent = total;
    const metaCounter = document.getElementById('story-meta-comments-count');
    if (metaCounter) metaCounter.textContent = total;

    if (comments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:#64748B; background:#FAF7F2; border-radius:10px;">
          <div style="font-size:24px; margin-bottom:6px;">💬</div>
          <div style="font-size:13.5px; font-weight:600; color:#1A0B2E;">No comments yet</div>
          <div style="font-size:12px;">Be the first to share your thoughts on this story!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = comments.map(c => `
      <div class="comment-item" style="border-bottom:1px solid #F1ECE4; padding:16px 0;" id="story-comment-item-${c.id}">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <img src="${c.avatar || '/profile.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png'" alt="">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div>
                <strong style="color:#1A0B2E; font-size:13.5px;">${escapeHtml(c.author || c.displayName || c.username || 'Reader')}</strong>
                ${c.role === 'author' || c.role === 'admin' ? '<span class="forms-role-badge" style="margin-left:4px;">Author</span>' : ''}
              </div>
              <span style="font-size:11.5px; color:#64748B;">${new Date(c.createdAt || c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="font-size:13px; color:#2D3748; line-height:1.6; margin-bottom:8px;">
              ${escapeHtml(c.content)}
            </div>
            <div style="display:flex; gap:14px; font-size:11.5px;">
              ${window.IS_LOGGED_IN ? `
                <button type="button" onclick="window.toggleStoryReplyForm(${c.id})" style="border:none; background:none; color:#6B21A8; font-weight:600; cursor:pointer; padding:0;">
                  Reply
                </button>
              ` : ''}
            </div>

            <!-- Inline reply form container -->
            <div id="story-reply-form-${c.id}" style="display:none; margin-top:12px; background:#FAF7F2; padding:12px; border-radius:8px;">
              <textarea id="story-reply-input-${c.id}" rows="2" class="form-input" style="width:100%; margin-bottom:8px;" placeholder="Write your reply..."></textarea>
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button type="button" class="btn btn-outline btn-xs" onclick="window.toggleStoryReplyForm(${c.id})">Cancel</button>
                <button type="button" class="btn btn-gold btn-xs" onclick="window.submitStoryReply(${storyId}, ${c.id})">Submit Reply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading story comments:', err);
    container.innerHTML = '<div style="color:#EF4444; padding:12px;">Failed to load comments.</div>';
  }
};

window.toggleStoryReplyForm = (commentId) => {
  const form = document.getElementById(`story-reply-form-${commentId}`);
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
};

window.submitStoryComment = async (e, storyId) => {
  e.preventDefault();
  const input = document.getElementById('story-comment-input');
  const btn = document.getElementById('story-comment-submit-btn');
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    openAuthModal('login');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Posting...';
  }

  try {
    const res = await fetch(`/api/short-stories/${storyId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      input.value = '';
      if (typeof window.showToast === 'function') {
        window.showToast('✅ Comment posted successfully!');
      }
      await window.loadStoryComments(storyId);
    } else {
      alert(data.error || 'Failed to post comment');
    }
  } catch (err) {
    alert(err.message || 'Error submitting comment');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Post Comment';
    }
  }
};

window.submitStoryReply = async (storyId, parentId) => {
  const input = document.getElementById(`story-reply-input-${parentId}`);
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/short-stories/${storyId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content, parentId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      window.toggleStoryReplyForm(parentId);
      if (typeof window.showToast === 'function') {
        window.showToast('✅ Reply posted successfully!');
      }
      await window.loadStoryComments(storyId);
    } else {
      alert(data.error || 'Failed to post reply');
    }
  } catch (err) {
    alert(err.message || 'Error submitting reply');
  }
};


// ============================================================================
// DEDICATED FOLLOWERS & FOLLOWING PAGE CONTROLLER
// ============================================================================

window._connectionsState = {
  tab: 'followers', // 'followers' | 'following'
  targetUserParam: null,
  targetUser: null,
  search: '',
  followersCount: 0,
  followingCount: 0,
  users: [],
  loading: false,
  searchTimer: null
};

async function renderFollowersFollowingView(container, hash) {
  const urlParts = (hash || '').split('?');
  const path = urlParts[0].toLowerCase();
  const params = new URLSearchParams(urlParts[1] || '');

  // Determine active tab
  let initialTab = 'followers';
  if (path.startsWith('#following') || params.get('tab') === 'following') {
    initialTab = 'following';
  } else if (params.get('tab') === 'followers') {
    initialTab = 'followers';
  }

  const targetParam = params.get('id') || (window.CURRENT_USER?.username || 'me');
  window._connectionsState.tab = initialTab;
  window._connectionsState.targetUserParam = targetParam;
  window._connectionsState.search = '';

  const isGuest = !window.IS_LOGGED_IN;
  const isSelf = isGuest ? false : (!targetParam || targetParam === 'me' || targetParam === window.CURRENT_USER?.username || String(targetParam) === String(window.CURRENT_USER?.id));

  // If viewing own connections as guest -> require login
  if (isGuest && (!targetParam || targetParam === 'me')) {
    container.innerHTML = `
      <div class="container connections-page-wrap">
        <div class="connections-header-card" style="text-align:center; padding:56px 24px;">
          <div style="font-size:48px; margin-bottom:14px;">👥</div>
          <h2 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin-bottom:8px;">Followers &amp; Following</h2>
          <p style="color:var(--color-text-muted); font-size:14px; max-width:440px; margin:0 auto 20px;">
            Please log in to your account to view your followers, manage who you follow, and connect with members.
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login') || 'Log In'}</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register') || 'Register'}</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Render initial page shell
  const titleText = isSelf ? 'My Community Network' : 'Member Connections';
  const subtitleText = isSelf 
    ? 'View your followers and manage everyone you follow on Rudhra Prarthana Novels.'
    : `Viewing connections for @${escapeHtml(targetParam)}`;

  container.innerHTML = `
    <div class="container connections-page-wrap">
      <!-- Breadcrumb navigation -->
      <div class="breadcrumbs" style="margin-bottom:16px;">
        <a href="#forms">Home</a>
        <span class="breadcrumb-separator">/</span>
        <a href="#members">Members</a>
        <span class="breadcrumb-separator">/</span>
        ${isSelf ? `
          <a href="#member?id=me">My Profile</a>
          <span class="breadcrumb-separator">/</span>
        ` : `
          <a href="#member?id=${encodeURIComponent(targetParam)}">@${escapeHtml(targetParam)}</a>
          <span class="breadcrumb-separator">/</span>
        `}
        <span>Connections</span>
      </div>

      <!-- Main Connections Card Shell -->
      <div class="connections-header-card">
        <div class="connections-title-row">
          <div class="connections-title-group">
            <h1>${titleText}</h1>
            <p>${subtitleText}</p>
          </div>
          <div>
            ${isSelf ? `
              <a href="#member?id=me" class="btn btn-outline btn-sm" style="font-size:12.5px;">
                👤 View My Profile
              </a>
            ` : `
              <a href="#member?id=${encodeURIComponent(targetParam)}" class="btn btn-outline btn-sm" style="font-size:12.5px;">
                👤 View Profile
              </a>
            `}
          </div>
        </div>

        <!-- Separate Tabs for Followers and Following -->
        <div class="connections-tabs-row" role="tablist">
          <button type="button" 
                  id="conn-tab-followers" 
                  class="connections-tab-btn ${initialTab === 'followers' ? 'active' : ''}" 
                  onclick="window.switchConnectionsTab('followers')">
            <span>Followers</span>
            <span class="connections-tab-count-badge" id="conn-followers-badge">...</span>
          </button>
          <button type="button" 
                  id="conn-tab-following" 
                  class="connections-tab-btn ${initialTab === 'following' ? 'active' : ''}" 
                  onclick="window.switchConnectionsTab('following')">
            <span>Following</span>
            <span class="connections-tab-count-badge" id="conn-following-badge">...</span>
          </button>
        </div>

        <!-- Live Instant Search Bar -->
        <div class="connections-search-bar">
          <span class="connections-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input type="text" 
                 id="conn-search-input" 
                 class="connections-search-input" 
                 placeholder="Search by name or username..." 
                 oninput="window.handleConnectionsSearch(this.value)">
          <button type="button" 
                  id="conn-search-clear" 
                  onclick="window.clearConnectionSearch()" 
                  style="display:none; position:absolute; right:12px; background:none; border:none; color:#94A3B8; cursor:pointer; font-size:16px;">
            ✕
          </button>
        </div>
      </div>

      <!-- Mount point for users list -->
      <div id="connections-list-mount">
        ${renderConnectionsSkeleton()}
      </div>
    </div>
  `;

  // Fetch initial data
  await loadConnectionsList();
}

function renderConnectionsSkeleton() {
  return `
    <div class="connections-list">
      ${[1, 2, 3, 4].map(() => `
        <div class="connection-user-card" style="opacity:0.6; pointer-events:none;">
          <div class="connection-user-info-wrap">
            <div class="skeleton-avatar" style="width:52px; height:52px; border-radius:50%; background:#E2E8F0;"></div>
            <div class="connection-user-text-col" style="flex:1;">
              <div class="skeleton-line" style="height:16px; width:140px; background:#E2E8F0; border-radius:4px; margin-bottom:6px;"></div>
              <div class="skeleton-line" style="height:12px; width:90px; background:#E2E8F0; border-radius:4px; margin-bottom:6px;"></div>
              <div class="skeleton-line" style="height:12px; width:220px; background:#F1F5F9; border-radius:4px;"></div>
            </div>
          </div>
          <div style="width:80px; height:32px; background:#E2E8F0; border-radius:8px;"></div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadConnectionsList() {
  const state = window._connectionsState;
  const mount = document.getElementById('connections-list-mount');
  const followersBadge = document.getElementById('conn-followers-badge');
  const followingBadge = document.getElementById('conn-following-badge');

  if (!mount) return;

  const endpoint = state.targetUserParam && state.targetUserParam !== 'me'
    ? `/api/members/${encodeURIComponent(state.targetUserParam)}/${state.tab}?search=${encodeURIComponent(state.search)}`
    : `/api/user/${state.tab}?search=${encodeURIComponent(state.search)}`;

  try {
    const res = await apiFetch(endpoint);
    const data = await res.json();

    if (!res.ok || !data.success) {
      mount.innerHTML = `
        <div class="profile-empty-state">
          <div class="profile-empty-icon" style="color:#DC2626;">⚠️</div>
          <div class="profile-empty-title">Failed to Load ${state.tab === 'followers' ? 'Followers' : 'Following'}</div>
          <div class="profile-empty-desc">${escapeHtml(data.error || 'A network error occurred. Please try again.')}</div>
          <button type="button" class="btn btn-gold btn-sm" onclick="loadConnectionsList()">Try Again</button>
        </div>
      `;
      return;
    }

    state.followersCount = data.followersCount || 0;
    state.followingCount = data.followingCount || 0;
    state.users = data.users || [];
    state.targetUser = data.targetUser;

    if (followersBadge) followersBadge.textContent = state.followersCount;
    if (followingBadge) followingBadge.textContent = state.followingCount;

    renderConnectionsUsers();
  } catch (err) {
    mount.innerHTML = `
      <div class="profile-empty-state">
        <div class="profile-empty-icon" style="color:#DC2626;">⚠️</div>
        <div class="profile-empty-title">Connection Error</div>
        <div class="profile-empty-desc">${escapeHtml(err.message)}</div>
        <button type="button" class="btn btn-gold btn-sm" onclick="loadConnectionsList()">Retry</button>
      </div>
    `;
  }
}

function renderConnectionsUsers() {
  const state = window._connectionsState;
  const mount = document.getElementById('connections-list-mount');
  if (!mount) return;

  const users = state.users;
  const isSearch = Boolean(state.search.trim());

  if (users.length === 0) {
    if (isSearch) {
      mount.innerHTML = `
        <div class="profile-empty-state">
          <div class="profile-empty-icon">🔍</div>
          <div class="profile-empty-title">No Members Found</div>
          <div class="profile-empty-desc">No ${state.tab === 'followers' ? 'followers' : 'following'} matching "${escapeHtml(state.search)}".</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.clearConnectionSearch()">Clear Search</button>
        </div>
      `;
    } else if (state.tab === 'followers') {
      mount.innerHTML = `
        <div class="profile-empty-state">
          <div class="profile-empty-icon">👥</div>
          <div class="profile-empty-title">No Followers Yet</div>
          <div class="profile-empty-desc">When other members follow you, they will be listed here.</div>
        </div>
      `;
    } else {
      mount.innerHTML = `
        <div class="profile-empty-state">
          <div class="profile-empty-icon">🌟</div>
          <div class="profile-empty-title">Not Following Anyone Yet</div>
          <div class="profile-empty-desc">You are not following any members or authors yet. Explore the community directory to connect with your favorite authors and readers!</div>
          <a href="#members" class="btn btn-gold btn-sm" style="display:inline-block; margin-top:8px;">Explore Members Directory ➔</a>
        </div>
      `;
    }
    return;
  }

  mount.innerHTML = `
    <div class="connections-list" id="conn-active-list">
      ${users.map(u => {
        const profileLink = `#member?id=${encodeURIComponent(u.username)}`;
        const avatarUrl = getAvatarUrl(u.avatar);
        const nameText = escapeHtml(u.displayName || u.username);
        const userText = escapeHtml(u.username);
        const bioText = u.bio ? escapeHtml(u.bio) : '';

        return `
          <div class="connection-user-card" id="conn-card-${u.id}">
            <a href="${profileLink}" class="connection-user-info-wrap" title="View ${nameText}'s Profile">
              <img src="${avatarUrl}" class="connection-user-avatar" alt="${nameText}" onerror="this.src='/profile.png'">
              <div class="connection-user-text-col">
                <div class="connection-user-name">
                  <span>${nameText}</span>
                  ${u.role && u.role !== 'Member' ? `<span class="connection-user-role-badge">${escapeHtml(u.role)}</span>` : ''}
                </div>
                <div class="connection-user-username">@${userText}</div>
                ${bioText ? `<div class="connection-user-bio">${bioText}</div>` : ''}
              </div>
            </a>

            <div class="connection-action-wrap">
              ${u.isSelf ? `
                <span style="font-size:12px; color:#94A3B8; font-weight:600; padding:4px 8px;">(You)</span>
              ` : state.tab === 'following' ? `
                <button type="button" 
                        id="conn-btn-${u.id}"
                        class="connection-action-btn unfollow" 
                        onclick="window.handleDirectUnfollow(${u.id}, '${escapeQuote(u.username)}', event)">
                  Unfollow
                </button>
              ` : `
                <button type="button" 
                        id="conn-btn-${u.id}"
                        class="connection-action-btn ${u.isFollowing ? 'following' : 'follow'}" 
                        onclick="window.handleFollowersActionToggle(${u.id}, '${escapeQuote(u.username)}', event)">
                  ${u.isFollowing ? '✓ Following' : '➕ Follow Back'}
                </button>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Interactive Global Handlers
window.switchConnectionsTab = (tab) => {
  if (window._connectionsState.tab === tab) return;
  window._connectionsState.tab = tab;
  window._connectionsState.search = '';

  const input = document.getElementById('conn-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('conn-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  document.querySelectorAll('.connections-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`conn-tab-${tab}`);
  if (activeBtn) activeBtn.classList.add('active');

  const mount = document.getElementById('connections-list-mount');
  if (mount) mount.innerHTML = renderConnectionsSkeleton();

  loadConnectionsList();
};

window.handleConnectionsSearch = (val) => {
  const clearBtn = document.getElementById('conn-search-clear');
  if (clearBtn) clearBtn.style.display = val.trim() ? 'block' : 'none';

  clearTimeout(window._connectionsState.searchTimer);
  window._connectionsState.searchTimer = setTimeout(() => {
    window._connectionsState.search = val.trim();
    loadConnectionsList();
  }, 250);
};

window.clearConnectionSearch = () => {
  const input = document.getElementById('conn-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('conn-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  window._connectionsState.search = '';
  loadConnectionsList();
};

window.handleDirectUnfollow = async (targetId, username, event) => {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const btn = document.getElementById(`conn-btn-${targetId}`);
  const card = document.getElementById(`conn-card-${targetId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Unfollowing…';
  }

  try {
    const res = await apiFetch(`/api/user/following/${targetId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to unfollow member.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Unfollow';
      }
      return;
    }

    // Update Following count live
    window._connectionsState.followingCount = Math.max(0, (window._connectionsState.followingCount || 1) - 1);
    const followingBadge = document.getElementById('conn-following-badge');
    if (followingBadge) followingBadge.textContent = window._connectionsState.followingCount;

    // Smooth card removal animation
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => {
        card.remove();
        // Check if list is now empty
        const activeList = document.getElementById('conn-active-list');
        if (activeList && activeList.children.length === 0) {
          renderConnectionsUsers();
        }
      }, 300);
    }

    showToast(`Unfollowed @${username}.`);
  } catch (err) {
    showToast('Network error: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Unfollow';
    }
  }
};

window.handleFollowersActionToggle = async (targetId, username, event) => {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const btn = document.getElementById(`conn-btn-${targetId}`);
  if (btn) btn.disabled = true;

  try {
    const res = await apiFetch(`/api/members/${targetId}/follow`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update follow status.');
      if (btn) btn.disabled = false;
      return;
    }

    const isFollowing = data.isFollowing;
    if (btn) {
      btn.disabled = false;
      btn.className = `connection-action-btn ${isFollowing ? 'following' : 'follow'}`;
      btn.textContent = isFollowing ? '✓ Following' : '➕ Follow Back';
    }

    // Update Following badge live
    if (isFollowing) {
      window._connectionsState.followingCount = (window._connectionsState.followingCount || 0) + 1;
    } else {
      window._connectionsState.followingCount = Math.max(0, (window._connectionsState.followingCount || 1) - 1);
    }
    const followingBadge = document.getElementById('conn-following-badge');
    if (followingBadge) followingBadge.textContent = window._connectionsState.followingCount;

    showToast(data.message || (isFollowing ? `Following @${username}` : `Unfollowed @${username}`));
  } catch (err) {
    showToast('Network error: ' + err.message);
    if (btn) btn.disabled = false;
  }
};
