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

  if (hash.startsWith('#admin') || hash.startsWith('#writer')) {
    document.body.classList.add('admin-view');
  }

  // Scoped Author/Writer header activation
  const isAuthorWriterDash = hash.startsWith('#writer') || (hash.startsWith('#admin') && !hash.startsWith('#admin-login'));
  if (isAuthorWriterDash) {
    updateAuthorWriterHeader(true);
  } else if (!hash.startsWith('#member')) {
    updateAuthorWriterHeader(false);
  }

  // Scroll to top upon route transition
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update active state in desktop & mobile navs
  updateNavActiveState(hash);

  if (!hash.startsWith('#reader')) {
    try { stopReadingSessionTracker(); } catch {}
  }

  try {
    if (hash.startsWith('#admin-login')) {
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
    } else if (hash.startsWith('#content?') || hash.startsWith('#content/')) {
      await renderContentReadingView(main, hash);
    } else if (hash.startsWith('#topic?')) {
      await renderTopicView(main, hash);
    } else if (hash.startsWith('#members')) {
      await renderMembersView(main);
    } else if (hash.startsWith('#member?')) {
      await renderMemberProfileView(main, hash);
    } else if (hash.startsWith('#about')) {
      renderAboutView(main);
    } else if (hash.startsWith('#contact')) {
      renderContactView(main);
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
            <button class="btn btn-outline bookmark-btn" onclick="bookmarkChapter('${escapeQuotes(novel.id)}', '${escapeQuotes(firstChapterNum || '1')}')" title="Bookmark">🔖</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-3); min-width:0;">
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span class="novel-badge-status badge-${(novel.status || 'ongoing').toLowerCase()}" style="position:static;">${novel.status || 'Ongoing'}</span>
            <span class="novel-badge-genre" style="position:static;">${novel.genre || 'Novel'}</span>
          </div>

          <h1 class="novel-detail-title">${escapeHtml(novel.title)}</h1>

          <div style="font-size:var(--text-sm); color:var(--color-text-muted);">
            ${novel.author ? `${t('novel_author')}: <strong style="color:var(--color-navy-deep);">${escapeHtml(novel.author)}</strong>` : ''}${novel.views ? ` • Views: <strong>${escapeHtml(String(novel.views))}</strong>` : ''}${novel.rating ? ` • Rating: <strong>★ ${escapeHtml(String(novel.rating))}</strong>` : ''}
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

  // Check if current user is an authorized administrator
  const isAdmin = Boolean(
    window.CURRENT_USER && (
      window.CURRENT_USER.isAdmin || 
      ['admin', 'editor'].includes((window.CURRENT_USER.role || '').toLowerCase())
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

    // If subcategory links to a novel, redirect directly to the existing novel page
    if (currentSub && currentSub.novelId) {
      window.location.hash = `#novel?id=${encodeURIComponent(currentSub.novelId)}`;
      return;
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
              <div class="forms-subpage-icon-badge">${currentSub.icon || '📌'}</div>
              <div>
                <h1 class="forms-subpage-title">${escapeHtml(currentSub.title)}</h1>
                <div class="forms-subpage-meta">
                  <span class="forms-subpage-cat-tag">${escapeHtml(parentMain?.title || 'General')}</span>
                  <span>•</span>
                  <span>${subArticles.length} Content Titles</span>
                </div>
              </div>
            </div>

            ${isAdmin ? `
              <button type="button" class="btn btn-gold btn-sm" onclick="window.openFormsAddContentModal('${escapeQuotes(parentMain?.id || '')}', '${escapeQuotes(currentSub.id)}', '${escapeQuotes(currentSub.title)}')">
                <span style="font-size:15px; font-weight:bold; margin-right:4px;">+</span> Add New Content
              </button>
            ` : ''}
          </div>

          <div class="forum-layout">
            <!-- Main Content Column -->
            <div class="forum-main-col">
              <div class="forms-subpage-articles-card">
                <div class="forms-subpage-card-header">
                  <h2 class="forms-subpage-card-title">Content Titles</h2>
                  <span class="forms-subpage-card-hint">Click any title to open the full reading page</span>
                </div>

                <div class="forms-subpage-articles-list">
                  ${subArticles.length > 0 ? subArticles.map(art => `
                    <a href="${art.link}" class="forms-subpage-article-row">
                      <div class="forms-subpage-row-main">
                        <div class="forms-subpage-row-title">${escapeHtml(art.title)}</div>
                        <div class="forms-subpage-row-meta">
                          <span class="forms-article-tag">✍️ ${escapeHtml(art.authorName || 'Rudhra Prarthana')}</span>
                          <span>📅 ${formatLastSeen(art.publishedAt)}</span>
                          <span>💬 ${art.commentsCount || 0} comments</span>
                        </div>
                      </div>
                      <div class="forms-subpage-row-arrow">
                        <span>Read</span> ➔
                      </div>
                    </a>
                  `).join('') : `
                    <div class="forms-subpage-empty">
                      <div style="font-size:32px; margin-bottom:8px;">📝</div>
                      <div style="font-weight:600; color:#0B1F33; margin-bottom:4px;">No Content Titles Yet</div>
                      <p style="font-size:13px; color:#64748B; margin:0 0 14px;">
                        No reading content has been published in this section yet.
                      </p>
                      ${isAdmin ? `
                        <button type="button" class="btn btn-gold btn-sm" onclick="window.openFormsAddContentModal('${escapeQuotes(parentMain?.id || '')}', '${escapeQuotes(currentSub.id)}', '${escapeQuotes(currentSub.title)}')">
                          + Add New Content
                        </button>
                      ` : ''}
                    </div>
                  `}
                </div>
              </div>
            </div>

            <!-- Sidebar Panels -->
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
              <a href="#forms" class="btn btn-outline btn-lg forms-hero-btn-outline" onclick="document.getElementById('forms-categories-root')?.scrollIntoView({ behavior: 'smooth' })">
                <span>Join Reader Forum</span>
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
            <span class="section-subtitle">${currentCategory ? (currentCategory.description || t('forum_subtitle')) : t('forum_subtitle')}</span>
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

              return `
                <div class="forms-category-section" id="cat-sec-${escapeHtml(cat.id)}">
                  <!-- Royal-Purple Header Bar -->
                  <div class="forms-cat-header-bar" style="background: linear-gradient(90deg, #1A0B2E 0%, ${escapeHtml(cat.color || '#2E1065')} 60%, #3B0764 100%);">
                    <div class="forms-cat-title-group">
                      <div class="forms-cat-icon">${cat.icon || '💬'}</div>
                      <div>
                        <h2 class="forms-cat-name">${escapeHtml(cat.title)}</h2>
                        <div class="forms-cat-desc">${escapeHtml(cat.description || '')}</div>
                      </div>
                    </div>
                    <div class="forms-cat-actions">
                      <span class="forms-cat-pill">${subs.length > 0 ? `${subs.length} Sections` : `${novels.length} Novels`}</span>
                    </div>
                  </div>

                  <!-- 1. Clickable Subcategories (Main Title -> Clickable Sub Titles -> Content Titles) -->
                  ${subs.length > 0 ? subs.map(sub => {
                    const subLink = sub.novelId 
                      ? `#novel?id=${encodeURIComponent(sub.novelId)}`
                      : `#forms?sub=${encodeURIComponent(sub.id)}`;

                    return `
                      <div class="forms-sub-section">
                        <div class="forms-sub-header">
                          <a href="${subLink}" class="forms-sub-title-link" title="Open ${escapeHtml(sub.title)} section">
                            <span class="forms-sub-icon">${sub.icon || '📌'}</span>
                            <h3 class="forms-sub-title">${escapeHtml(sub.title)}</h3>
                            <span class="forms-sub-link-arrow">➔</span>
                          </a>
                          <a href="${subLink}" class="forms-sub-badge-link">
                            ${sub.articles?.length || 0} Notes »
                          </a>
                        </div>

                        <div class="forms-articles-grid" style="margin-top:10px;">
                          ${sub.articles && sub.articles.length > 0 ? sub.articles.map(art => `
                            <a href="${art.link}" class="forms-article-card">
                              <div class="forms-article-title">${escapeHtml(art.title)}</div>
                              <div class="forms-article-meta">
                                <span class="forms-article-tag">✍️ ${escapeHtml(art.authorName || 'Rudhra Prarthana')}</span>
                                <span>📅 ${formatLastSeen(art.publishedAt)}</span>
                                <span>💬 ${art.commentsCount || 0} comments</span>
                              </div>
                            </a>
                          `).join('') : `
                            <div style="font-size:12px; color:#94A3B8; padding:8px 0;">No published notes in this section yet.</div>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('') : ''}

                  <!-- 2. Novels List (Ongoing Novels, Completed Novels, Short Stories, Audio Novels) -->
                  ${novels.length > 0 ? `
                    <div class="forms-novel-grid">
                      ${novels.map(n => `
                        <a href="${n.link}" class="forms-novel-card">
                          <img src="${n.cover || '/default-cover.jpg'}" class="forms-novel-thumb" alt="${escapeHtml(n.title)}" onerror="this.src='/default-cover.jpg'">
                          <div class="forms-novel-info">
                            <div class="forms-novel-title">${escapeHtml(n.title)}</div>
                            <div class="forms-novel-episode">📖 ${escapeHtml(n.latestEpisodeTitle || 'Latest Release')}</div>
                            <div class="forms-novel-date">📅 ${escapeHtml(n.updatedDate || 'Recent')} • ✍️ ${escapeHtml(n.author || 'Rudhra Prarthana')}</div>
                          </div>
                          <div style="color:#B88635; font-size:16px;">➔</div>
                        </a>
                      `).join('')}
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

        <!-- Sidebar Panels -->
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
              ${renderSidebarPostItems(sidebarData?.trending)}
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

function renderSidebarPostItems(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return `
      <div class="sidebar-empty-state" style="text-align:center; padding:24px 16px;">
        <div style="font-size:24px; margin-bottom:6px;">📭</div>
        <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep); margin-bottom:2px;">No posts yet</div>
        <div style="font-size:12px; color:var(--color-text-muted);">Start a discussion to see it here.</div>
      </div>
    `;
  }

  return posts.map(post => {
    const avatarUrl = getAvatarUrl(post.avatar);
    const safeTitle = escapeHtml(post.title || 'Untitled Discussion');
    const safeAuthor = escapeHtml(post.lastAuthor || post.author || 'Member');
    const safeCategory = escapeHtml(post.category || 'General Discussions');
    const safeExcerpt = escapeHtml(post.excerpt || '');
    const safeTime = escapeHtml(post.timeDisplay || 'Recently');
    const replies = Number(post.replies ?? 0);
    const views = Number(post.views ?? 0);
    const link = post.link || `#topic?id=${encodeURIComponent(post.id)}`;

    return `
      <article class="sidebar-post-item" style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; gap:10px; align-items:flex-start;">
        <div class="sidebar-post-avatar-wrap" style="flex-shrink:0;">
          <img src="${avatarUrl}" alt="${safeAuthor}" class="sidebar-post-avatar" onerror="this.onerror=null;this.src='/profile.png';" loading="lazy">
        </div>
        <div class="sidebar-post-content" style="flex:1; min-width:0;">
          <a href="${link}" class="sidebar-post-title" title="${safeTitle}" style="font-weight:600; font-size:13px; color:var(--color-navy-deep); text-decoration:none; display:block; margin-bottom:3px; word-break:break-word;">${safeTitle}</a>
          ${safeExcerpt ? `<div style="font-size:11.5px; color:var(--color-text-muted); margin-bottom:5px; line-height:1.35; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${safeExcerpt}</div>` : ''}
          <div class="sidebar-post-meta" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--color-text-muted);">
            <span style="background:#FAF5EC; color:var(--color-gold-warm); padding:1px 5px; border-radius:4px; font-weight:600; border:1px solid #E8DCCB; font-size:10.5px;">${safeCategory}</span>
            <span class="sidebar-post-author">${safeAuthor}</span>
            <span>•</span>
            <time class="sidebar-post-time">${safeTime}</time>
            <span style="margin-left:auto; display:flex; gap:6px;">
              <span title="${replies} Replies">💬 ${replies}</span>
              <span title="${views} Views">👁 ${views}</span>
            </span>
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
    trendingContainer.innerHTML = renderSidebarPostItems(data?.trending);
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

  const topic = await getForumTopicById(topicId);
  const novelId = topic?.novelId || 'nenjam-marappadhillai';
  const chParam = topic?.chapterNum ? `&ch=${encodeURIComponent(topic.chapterNum)}` : '';
  window.location.hash = `#novel?id=${encodeURIComponent(novelId)}${chParam}#comments`;
  return;
}

async function _legacyRenderTopicView(container, hash) {

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

// 8. MEMBER PROFILE VIEW WITH USER-CONTROLLED EDITING & PROFILE PICTURE UPLOAD
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
    if (profileData && profileData.member) {
      member = profileData.member;
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

  const avatarDot = (!member.statusHidden && member.isOnline)
    ? `<span class="status-dot green profile-avatar-dot"></span>`
    : '';

  const mAvatar = getAvatarUrl(member.avatar);

  // Setup Global profile editing and photo upload state
  window._pendingAvatarAction = undefined;

  window.handleProfileChatToggle = async (checked) => {
    try {
      const res = await apiFetch('/api/chat/settings', {
        method: 'POST',
        body: JSON.stringify({ is_chat_available: checked ? 1 : 0 })
      });
      if (res && res.success) {
        if (window.CURRENT_USER) window.CURRENT_USER.isChatAvailable = checked;
        const lbl = document.getElementById('profile-chat-status-label');
        if (lbl) {
          lbl.textContent = checked ? 'Available' : 'Paused';
          lbl.className = `activity-status-badge ${checked ? 'enabled' : 'hidden'}`;
        }
        showToast(checked ? 'Chat is now Available! Members can message you.' : 'Chat is now Paused. Direct messages are blocked.');
      } else {
        throw new Error(res?.error || 'Failed to update chat setting');
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

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast('Only JPG, PNG, WEBP, and GIF images are allowed.');
      event.target.value = '';
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Image size must be less than 2MB.');
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

  container.innerHTML = `
    <div class="container section">
      <div class="profile-card-container">
        <!-- Cover Banner -->
        <div class="profile-cover-banner">
          <div class="profile-cover-pattern"></div>
        </div>

        <!-- Main Header Card -->
        <div class="profile-header-main">
          <div class="profile-header-top-row">
            <!-- Large Avatar overlapping cover with green status dot -->
            <div class="profile-avatar-container">
              <div class="profile-avatar-inner">
                <img src="${mAvatar}" class="profile-large-avatar" alt="${mName}" onerror="this.src='/profile.png';">
                ${avatarDot}
              </div>
            </div>

            <!-- Action Buttons Bar (User Dashboard Controls) -->
            <div class="profile-header-actions">
              ${isCurrentUser ? `
                <button class="btn btn-gold btn-sm" onclick="toggleProfileEditCard()">
                  ✏️ Edit Profile
                </button>
                ${(window.CURRENT_USER?.isAdmin && window.CURRENT_USER?.isAuthorSession) ? `
                  <button class="btn btn-outline btn-sm" onclick="window.location.hash='#admin';" style="border-color:var(--color-gold); color:var(--color-gold-warm);">
                    👑 Author Dashboard
                  </button>
                ` : ''}
                <button class="btn btn-outline btn-sm" onclick="handleLogout()" style="color:#EF4444; border-color:#FCA5A5;" title="Logout and invalidate session">
                  🚪 Logout
                </button>
              ` : `
                <button class="btn btn-gold btn-sm" onclick="openDirectChatWithUser(${JSON.stringify(member.id)})" title="Send a private message to this member">💬 Message</button>
                <button class="btn btn-outline btn-sm" onclick="showToast('Following member!')">➕ Follow</button>
              `}
            </div>
          </div>

          <!-- User Details (display name, username, roles, joined date, status) -->
          <div class="profile-details-section">
            <div class="profile-name-row">
              <h1 class="profile-display-name">${mName}</h1>
              <span class="profile-username-tag">@${escapeHtml(member.username)}</span>
            </div>

            <div class="profile-meta-chips">
              <span class="profile-chip role">👑 ${escapeHtml(member.title || 'Member')}</span>
              <span class="profile-chip joined">📅 Joined ${escapeHtml(joinedDate)}</span>
              ${!member.statusHidden ? `
                <span class="profile-chip status">
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

            <!-- Compact Member Reading Activity (Active Status Protected) -->
            ${(!member.statusHidden && (member.currentReading || member.lastRead)) ? `
              <div class="profile-reading-activity-wrap">
                ${member.currentReading ? `
                  <div class="profile-reading-chip reading-now">
                    <div class="reading-chip-badge"><span class="status-dot green"></span> Reading Now</div>
                    <div class="reading-chip-body">
                      <div class="reading-chip-row"><span class="chip-lbl">Reading:</span> <strong class="chip-title">${escapeHtml(member.currentReading.novelTitle)}${member.currentReading.chapterNum ? ` (${member.currentReading.chapterNum})` : ''}</strong></div>
                      <div class="reading-chip-row"><span class="chip-lbl">Reading for:</span> <span class="chip-duration">${escapeHtml(member.currentReading.duration)}</span></div>
                    </div>
                  </div>
                ` : `
                  <div class="profile-reading-chip last-read">
                    <div class="reading-chip-badge">📚 Recent Activity</div>
                    <div class="reading-chip-body">
                      <div class="reading-chip-row"><span class="chip-lbl">Last read:</span> <strong class="chip-title">${escapeHtml(member.lastRead.novelTitle)}${member.lastRead.chapterNum ? ` (${member.lastRead.chapterNum})` : ''}</strong></div>
                      <div class="reading-chip-row"><span class="chip-lbl">Last read time:</span> <span class="chip-duration">${escapeHtml(member.lastRead.lastReadAgo || 'Recently')}</span></div>
                    </div>
                  </div>
                `}
              </div>
            ` : ''}
          </div>

          <!-- Activity Status Privacy Control (For Current User only) -->
          ${isCurrentUser ? `
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

            <!-- Global Chat Availability Setting -->
            <div class="activity-status-card" style="margin-top:12px;">
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
          ` : ''}
        </div>
      </div>

      <!-- User-Controlled Profile Edit Card (Collapsible) -->
      ${isCurrentUser ? `
        <div id="edit-profile-card" style="display:none; background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-6); margin:20px 0 28px; box-shadow:var(--shadow-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--color-border-light); padding-bottom:12px;">
            <h3 style="margin:0; font-family:var(--font-serif); color:var(--color-navy-deep); font-size:1.3rem;">
              ✏️ Edit Your Profile
            </h3>
            <button class="action-btn" onclick="toggleProfileEditCard()" style="border:none; background:transparent; font-size:18px; cursor:pointer;" title="Close">✕</button>
          </div>
          
          <form id="profile-edit-form" onsubmit="event.preventDefault(); window.handleSaveProfile();">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:16px;">
              <div class="form-group">
                <label class="form-label">Display Name <span style="color:#EF4444;">*</span></label>
                <input type="text" id="edit-display-name" class="form-input" value="${escapeHtml(member.displayName || member.username || '')}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Username <span style="color:#EF4444;">*</span></label>
                <input type="text" id="edit-username" class="form-input" value="${escapeHtml(member.username || '')}" required pattern="[a-zA-Z0-9_]{3,20}">
                <small style="color:var(--color-text-muted); font-size:11px;">3-20 characters, numbers or _</small>
              </div>
            </div>

            <!-- Profile Picture Upload, Preview, and Removal -->
            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label">Profile Picture</label>
              <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; background:rgba(0,0,0,0.02); padding:16px; border-radius:var(--radius-md); border:1px dashed var(--color-border);">
                <img id="edit-avatar-preview" src="${mAvatar}" style="width:72px; height:72px; border-radius:var(--radius-full); object-fit:cover; border:3px solid var(--color-gold-warm); box-shadow:var(--shadow-sm); flex-shrink:0;" onerror="this.src='/profile.png'">
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
                  <small style="color:var(--color-text-muted); font-size:11px;">
                    JPG, PNG, WEBP or GIF (Max 2MB)
                  </small>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">About / Bio</label>
              <textarea id="edit-bio" class="form-input" rows="3" placeholder="Write a few lines about yourself...">${escapeHtml(member.bio || '')}</textarea>
            </div>

            <div style="display:flex; gap:12px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline" onclick="toggleProfileEditCard()">Cancel</button>
              <button type="submit" id="save-profile-btn" class="btn btn-gold">💾 Save Changes</button>
            </div>
          </form>
        </div>
      ` : ''}

      <!-- Profile Tabs Navigation -->
      <div class="profile-tabs-nav">
        <div class="profile-tab-btn active">Overview</div>
        <div class="profile-tab-btn" onclick="showToast('Loading topics...')">${t('forum_topics')} (${member.topicsCount ?? 0})</div>
        <div class="profile-tab-btn" onclick="showToast('Loading bookmarks...')">Bookmarks</div>
      </div>

      <!-- About Me & Community Stats Card -->
      <div style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-6); box-shadow:var(--shadow-sm);">
        <h3 style="font-family:var(--font-serif); font-size:1.35rem; color:var(--color-navy-deep); margin-bottom:10px;">About Me</h3>
        <p style="font-size:15px; line-height:1.8; color:var(--color-text-main); margin-bottom:0;">${mBio}</p>

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border-light); display:flex; gap:32px; flex-wrap:wrap;">
          <div><strong>${member.postsCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">Forum Replies</span></div>
          <div><strong>${member.topicsCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">Created Topics</span></div>
          <div><strong>${member.followersCount ?? 0}</strong> <span style="color:var(--color-text-muted); font-size:12px;">Readers</span></div>
        </div>
      </div>
    </div>
  `;
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

// 10. CONTACT VIEW
function renderContactView(container) {
  container.innerHTML = `
    <div class="container section" style="max-width:760px;">
      <span class="section-subtitle">${t('nav_contact')}</span>
      <h1 class="section-title" style="margin-bottom:var(--space-6);">${t('contact_title')}</h1>

      <div class="contact-form-card">
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
            <textarea class="form-input contact-textarea" rows="5" required placeholder="${t('contact_message')}"></textarea>
          </div>
          <button type="submit" class="btn btn-gold btn-contact-submit">${t('contact_send_btn')}</button>
        </form>
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
  const [audioNovels, novels] = await Promise.all([
    getAudioNovelsList({ search, novelId, sort }).catch(() => []),
    getNovelsList({ all: true }).catch(() => [])
  ]);

  container.innerHTML = `
    <div class="audio-page-container">
      <!-- Section Heading -->
      <section class="audio-hero-header">
        <div class="container">
          <span class="audio-hero-subtitle">Listen & Enjoy</span>
          <h1 class="audio-hero-title">Audio Novels</h1>
          <p class="audio-hero-desc">Discover your favourite stories in audio.</p>
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

          <!-- Linked Novel Filter -->
          <select id="reader-audio-novel-filter" class="audio-filter-select" onchange="handleAudioFilterChange()">
            <option value="all" ${novelId === 'all' ? 'selected' : ''}>All Novels</option>
            ${novels.map(n => `
              <option value="${n.id}" ${novelId === n.id ? 'selected' : ''}>${escapeHtml(n.title)}</option>
            `).join('')}
          </select>

          <!-- Sort Filter -->
          <select id="reader-audio-sort-filter" class="audio-filter-select" onchange="handleAudioFilterChange()">
            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="title" ${sort === 'title' ? 'selected' : ''}>Title (A-Z)</option>
            <option value="views" ${sort === 'views' ? 'selected' : ''}>Most Listened</option>
          </select>
        </div>

        <!-- Audio Novels Grid / Empty State -->
        ${audioNovels.length === 0 ? `
          <div class="audio-empty-state">
            <span class="audio-empty-icon">🎧</span>
            <h3 class="audio-empty-title">No Audio Novels Found</h3>
            <p class="audio-empty-text">
              ${(search || novelId !== 'all') 
                ? 'No published audio novels match your current search or filter criteria. Try resetting the filters.' 
                : 'No audio novels have been published yet. Please check back soon!'}
            </p>
            ${(search || novelId !== 'all') ? `
              <div style="margin-top:16px;">
                <button type="button" class="btn btn-gold btn-sm" onclick="window.location.hash = '#audio';">
                  Reset Filters
                </button>
              </div>
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
    const n = document.getElementById('reader-audio-novel-filter')?.value || 'all';
    const st = document.getElementById('reader-audio-sort-filter')?.value || 'newest';

    const p = new URLSearchParams();
    if (s) p.set('search', s);
    if (n !== 'all') p.set('novel', n);
    if (st !== 'newest') p.set('sort', st);

    const newHash = p.toString() ? `#audio?${p.toString()}` : '#audio';
    window.location.hash = newHash;
  };
}

function renderAudioDirectoryCard(an) {
  const isYouTube = an.sourceType === 'youtube';
  const idOrSlug = an.slug || an.id;

  return `
    <article class="audio-novel-item-card">
      <div class="audio-card-media">
        <a href="#audio?id=${encodeURIComponent(idOrSlug)}" style="display:block; width:100%; height:100%;">
          <img src="${an.cover || '/default-cover.jpg'}" class="audio-card-img" alt="${escapeQuotes(an.title)}" loading="lazy" onerror="this.onerror=null;this.src='/default-cover.jpg';">
        </a>
        <div class="audio-badge-overlay">
          <span class="audio-type-pill ${isYouTube ? 'youtube' : 'audio-file'}">
            ${isYouTube ? '▶ YouTube' : '🎧 Audio Story'}
          </span>
          ${an.episodeNumber ? `
            <span class="audio-type-pill" style="background:#0B1F33; color:#FFFFFF;">
              ${escapeHtml(an.episodeNumber)}
            </span>
          ` : ''}
        </div>
        ${an.audioDuration ? `
          <span class="audio-duration-pill">⏱ ${escapeHtml(an.audioDuration)}</span>
        ` : ''}
      </div>

      <div class="audio-card-body">
        <div class="audio-card-meta">
          <span>🌐 ${escapeHtml(an.language || 'Tamil')}</span>
          ${an.views ? `<span>• 👁 ${an.views} views</span>` : ''}
        </div>

        <h3 class="audio-card-title">
          <a href="#audio?id=${encodeURIComponent(idOrSlug)}" style="color:inherit; text-decoration:none;">
            ${escapeHtml(an.title)}
          </a>
        </h3>

        <p class="audio-card-desc">
          ${escapeHtml(an.description || 'Listen to this captivating audio story by author Rudhra Prarthana.')}
        </p>

        <div class="audio-card-footer">
          ${an.linkedNovelTitle ? `
            <a href="#novel?id=${encodeURIComponent(an.novelId)}" class="audio-card-novel-link" title="${escapeQuotes(an.linkedNovelTitle)}">
              📖 ${escapeHtml(an.linkedNovelTitle)}
            </a>
          ` : `<span></span>`}

          <a href="#audio?id=${encodeURIComponent(idOrSlug)}" class="audio-play-btn-primary">
            <span>▶ Listen Now</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

/* ========================================================
   3. DEDICATED AUDIO PLAYBACK VIEW (#audio?id=...)
   ======================================================== */
export async function renderAudioPlayerView(container, hash) {
  const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryStr);
  const idOrSlug = searchParams.get('id') || searchParams.get('slug') || '';

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

  // Fetch single audio novel detail
  const audioNovel = await getAudioNovelDetail(idOrSlug);

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

  const isYouTube = audioNovel.sourceType === 'youtube';
  const parts = audioNovel.parts || [];
  const hasMultipleParts = parts.length > 1;

  container.innerHTML = `
    <div class="audio-player-page">
      <div class="container">
        <!-- Back Navigation -->
        <div class="audio-back-link-wrap">
          <a href="#audio" class="audio-back-link">
            « Back to Audio Novels
          </a>
        </div>

        <div class="audio-player-layout">
          <!-- Main Player & Content Column -->
          <main class="audio-main-stage">
            ${isYouTube ? `
              <!-- Embedded Official YouTube Player -->
              <div class="youtube-player-stage">
                <iframe src="${audioNovel.embedUrl || `https://www.youtube-nocookie.com/embed/${audioNovel.youtubeVideoId}?rel=0`}" 
                        class="youtube-player-iframe" 
                        title="${escapeQuotes(audioNovel.title)}" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                </iframe>
              </div>
            ` : `
              <!-- Sleek Direct HTML5 Audio Player Card -->
              <div class="direct-audio-player-card">
                <div class="audio-track-banner">
                  <img src="${audioNovel.cover || '/default-cover.jpg'}" class="audio-track-cover" alt="${escapeQuotes(audioNovel.title)}" onerror="this.src='/default-cover.jpg'">
                  <div class="audio-track-info">
                    <span class="audio-track-badge">🎧 ${escapeHtml(audioNovel.episodeNumber || 'Audio Track')}</span>
                    <h2 class="audio-track-title">${escapeHtml(audioNovel.title)}</h2>
                    <div class="audio-track-subtitle">
                      Language: ${escapeHtml(audioNovel.language || 'Tamil')} ${audioNovel.audioDuration ? `• Duration: ${escapeHtml(audioNovel.audioDuration)}` : ''}
                    </div>
                  </div>
                </div>

                <!-- Hidden Native Audio Element -->
                <audio id="rp-active-audio-player" src="${audioNovel.audioFileUrl}" preload="metadata"></audio>

                <!-- Custom Native Controls -->
                <div class="custom-audio-controls">
                  <!-- Scrub / Seek Slider -->
                  <div class="audio-scrub-bar-container">
                    <input type="range" id="rp-audio-seek-slider" min="0" max="100" value="0" class="audio-progress-slider" aria-label="Seek audio position">
                    <div class="audio-time-row">
                      <span id="rp-audio-current-time">00:00</span>
                      <span id="rp-audio-duration-time">${escapeHtml(audioNovel.audioDuration || '00:00')}</span>
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

                  <!-- Error Notification Banner -->
                  <div id="rp-audio-error-box" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:12px; margin-top:10px;"></div>
                </div>
              </div>
            `}

            <!-- Audio Description & Information Pane -->
            <div class="audio-details-pane">
              <h1 class="audio-details-title">${escapeHtml(audioNovel.title)}</h1>

              <div class="audio-details-tags">
                <span class="audio-tag gold">🎧 ${escapeHtml(audioNovel.episodeNumber || 'Full Audio')}</span>
                <span class="audio-tag">🌐 ${escapeHtml(audioNovel.language || 'Tamil')}</span>
                ${audioNovel.audioDuration ? `<span class="audio-tag">⏱ ${escapeHtml(audioNovel.audioDuration)}</span>` : ''}
                <span class="audio-tag">👁 ${audioNovel.views || 0} listens</span>
              </div>

              ${audioNovel.description ? `
                <div class="audio-details-text">
                  ${escapeHtml(audioNovel.description).replace(/\n/g, '<br>')}
                </div>
              ` : `
                <div class="audio-details-text" style="color:#64748B; font-style:italic;">
                  Enjoy listening to this audio release from author Rudhra Prarthana.
                </div>
              `}

              ${isYouTube ? `
                <div class="audio-disclaimer-notice">
                  <strong>ℹ Official YouTube Player:</strong> Playback is powered by the official embedded YouTube player and depends on video availability and embedding permissions.
                </div>
              ` : ''}
            </div>
          </main>

          <!-- Sidebar: Multi-part Episodes & Linked Novel Promotion -->
          <aside class="audio-parts-sidebar">
            ${hasMultipleParts ? `
              <!-- Multi-part Series List -->
              <div class="audio-parts-card">
                <h3 class="audio-parts-header">
                  <span>Available Parts</span>
                  <span style="font-size:12px; font-family:sans-serif; color:var(--color-gold-warm); font-weight:600;">
                    ${parts.length} Episodes
                  </span>
                </h3>
                <div class="audio-parts-list">
                  ${parts.map((p, idx) => `
                    <a href="#audio?id=${encodeURIComponent(p.slug || p.id)}" 
                       class="audio-part-item ${p.isActive ? 'active' : ''}" 
                       title="${escapeQuotes(p.title)}">
                      <div class="audio-part-num">${idx + 1}</div>
                      <div class="audio-part-details">
                        <div class="audio-part-title">${escapeHtml(p.title)}</div>
                        <div class="audio-part-duration">
                          ${escapeHtml(p.episodeNumber || `Part ${p.partNumber}`)} ${p.audioDuration ? `• ${escapeHtml(p.audioDuration)}` : ''}
                        </div>
                      </div>
                      ${p.isActive ? `<span style="font-size:12px; color:var(--color-gold-warm); font-weight:700;">Playing ▶</span>` : ''}
                    </a>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${audioNovel.novelId ? `
              <!-- Linked Novel Read-Now Card -->
              <div class="audio-linked-novel-card">
                <img src="${audioNovel.linkedNovelCover || audioNovel.cover || '/default-cover.jpg'}" class="audio-linked-novel-cover" alt="" onerror="this.src='/default-cover.jpg'">
                <div class="audio-linked-novel-title">${escapeHtml(audioNovel.linkedNovelTitle || 'Read the Written Novel')}</div>
                <p class="audio-linked-novel-desc">
                  Enjoyed the audio version? Read all written chapters and updates in the reader library.
                </p>
                <a href="#novel?id=${encodeURIComponent(audioNovel.novelId)}" class="btn btn-gold btn-sm" style="display:inline-block; width:100%;">
                  📖 Read Full Novel »
                </a>
              </div>
            ` : ''}
          </aside>
        </div>
      </div>
    </div>
  `;

  // Initialize Custom HTML5 Audio Player Controls if direct audio
  if (!isYouTube) {
    const audioEl = document.getElementById('rp-active-audio-player');
    if (audioEl) {
      setupHtml5AudioPlayer(audioEl);
    }
  }

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
async function renderContentReadingView(container, hash) {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const slug = urlParams.get('slug') || urlParams.get('id') || (hash.includes('/') ? hash.split('/')[1] : '');

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

    container.innerHTML = `
      <div class="content-reading-wrap">
        <!-- Breadcrumbs & Back Bar -->
        <nav class="forum-breadcrumbs" style="margin-bottom:14px;">
          <a href="#forms">Home</a>
          <span class="crumb-separator">›</span>
          <a href="#forms">Forms</a>
          <span class="crumb-separator">›</span>
          <a href="#forms">${escapeHtml(art.mainCategoryTitle)}</a>
          <span class="crumb-separator">›</span>
          <a href="#forms?sub=${encodeURIComponent(art.subCategoryId || '')}">${escapeHtml(art.subCategoryTitle)}</a>
        </nav>

        <div class="content-reading-back-bar">
          <a href="#forms?sub=${encodeURIComponent(art.subCategoryId || '')}" class="content-back-btn">
            <span>«</span> Back to ${escapeHtml(art.subCategoryTitle)}
          </a>
          <div style="font-size:12px; color:#64748B;">
            Published: <strong>${new Date(art.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
        </div>

        <!-- Main Reading Article Card -->
        <article class="content-reading-card">
          <div class="content-reading-badge">
            <span>🌸</span>
            <span>${escapeHtml(art.mainCategoryTitle)} › ${escapeHtml(art.subCategoryTitle)}</span>
          </div>

          <h1 class="content-reading-headline">${escapeHtml(art.title)}</h1>

          <div class="content-reading-meta-bar">
            <div class="content-author-chip">
              <img src="${authorAvatar}" class="content-author-avatar" alt="${escapeHtml(art.authorName)}" onerror="this.src='/profile.png'">
              <div>
                <div class="content-author-name">
                  ${escapeHtml(art.authorName)}
                  <span class="forms-role-badge" style="margin-left:6px;">Official Author</span>
                </div>
                <div class="content-author-sub">
                  <span>Rudhra Prarthana Literary Platform</span>
                </div>
              </div>
            </div>

            <div style="display:flex; gap:14px; font-size:12.5px; color:#64748B; align-items:center;">
              <span title="Views">👁️ ${art.viewsCount} reads</span>
              <span>•</span>
              <span title="Comments">💬 ${commentsCount} comments</span>
            </div>
          </div>

          <!-- Formatted Reading Content -->
          <div class="content-reading-body">
            ${art.content}
          </div>
        </article>

        <!-- Dedicated Comments Card -->
        <section class="content-reading-comments-card" id="article-comments-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #F1ECE4; padding-bottom:12px;">
            <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:#1A0B2E; margin:0;">
              💬 Reader Thoughts &amp; Discussion (<span id="article-comments-counter">${commentsCount}</span>)
            </h3>
          </div>

          <!-- Comment Input Form -->
          <div style="margin-bottom:28px;">
            ${window.IS_LOGGED_IN ? `
              <form id="article-comment-form" onsubmit="window.submitArticleComment(event, ${art.id})">
                <textarea id="article-comment-input" rows="3" class="form-input" 
                          style="width:100%; border-radius:10px; border:1px solid #E2E8F0; padding:12px; font-family:inherit; resize:vertical; margin-bottom:10px;"
                          placeholder="Share your thoughts on this note with author Rudhra Prarthana and fellow members..."></textarea>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:12px; color:#64748B;">Polite and warm reader camaraderie is welcomed.</span>
                  <button type="submit" id="article-comment-submit-btn" class="btn btn-gold btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>
            ` : `
              <div style="background:#FAF7F2; border:1px dashed #C89B3C; border-radius:10px; padding:18px; text-align:center;">
                <p style="margin:0 0 10px 0; font-size:13.5px; color:#1A0B2E;">Log in to participate in the conversation and share your feedback.</p>
                <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">Log In to Comment</button>
              </div>
            `}
          </div>

          <!-- Comments List Container -->
          <div id="article-comments-container">
            <div style="text-align:center; padding:20px; color:#64748B;">Loading comments...</div>
          </div>
        </section>
      </div>
    `;

    // Load comments
    window.loadArticleComments(art.id);
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
