// Main Application Engine & Client Router

import {
  getHomepageContent,
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
import { initReader, applyReaderMode, applyFontSize, showToast } from './reader.js';
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
  if ((!hash || hash === '#home' || hash === '#') && window.location.pathname.startsWith('/admin')) {
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
        media: 'media'
      };
      const tab = tabMap[sub] || 'overview';
      hash = `#admin?tab=${tab}`;
    }
  }

  if (!hash || hash === '#' || hash === '') {
    hash = '#forum';
    if (window.location.hash !== '#forum') {
      window.history.replaceState(null, '', '#forum');
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
    } else if (hash.startsWith('#forum')) {
      await renderForumView(main, hash);
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
    } else if (hash === '#home') {
      await renderHomeView(main);
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
  let path = hash ? hash.split('?')[0] : '#forum';
  if (path === '#' || path === '') path = '#forum';
  document.querySelectorAll('.nav-link, .drawer-nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 1. HOME VIEW
async function renderHomeView(container) {
  let homeData = null;
  try {
    homeData = await getHomepageContent();
  } catch (err) {
    console.warn('[Home View] Failed to fetch homepage data:', err);
  }

  // Ordered sections from MySQL, strictly respecting saved priority
  const orderedSections = homeData?.orderedSections || [];

  container.innerHTML = `
    <!-- Hero Section Framed with Desktop/Mobile Artwork -->
    <section class="hero-section">
      <div class="hero-content-frame">
        <div class="hero-badge">
          <span>WELCOME</span>
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

        <div class="hero-actions">
          <a href="#novels" class="btn btn-primary btn-lg">
            <span>${t('hero_btn_explore')}</span>
            <span>➔</span>
          </a>
          <a href="#forum" class="btn btn-outline btn-lg" style="background:rgba(255,255,255,0.8);">
            <span>${t('hero_btn_community')}</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Dynamic Admin-Controlled Homepage Sections Container -->
    <div id="homepage-dynamic-sections-container">
      ${orderedSections.map((sec, idx) => renderDynamicHomepageSection(sec, idx)).join('')}
    </div>
  `;
}

/**
 * Dispatcher to render each homepage section using safe, reusable components
 */
function renderDynamicHomepageSection(sec, idx) {
  if (!sec || sec.visible === false || sec.isVisible === false) return '';

  const isAltBg = idx % 2 === 1;
  const bgClass = isAltBg ? 'section-bg-alt' : '';

  switch (sec.sectionType) {
    case 'featured':
      return renderFeaturedSectionComponent(sec, bgClass);
    case 'continue_reading':
      return renderContinueReadingSectionComponent(sec, bgClass);
    case 'audio':
      return renderAudioSectionComponent(sec, bgClass);
    case 'trending':
      return renderTrendingSectionComponent(sec, bgClass);
    case 'completed':
      return renderCompletedSectionComponent(sec, bgClass);
    case 'latest':
      return renderLatestSectionComponent(sec, bgClass);
    case 'curated':
      return renderCuratedSectionComponent(sec, bgClass);
    case 'forum':
      return renderForumSectionComponent(sec, bgClass);
    case 'author_spotlight':
      return renderAuthorSpotlightSectionComponent(sec, bgClass);
    case 'community_cta':
      return renderCommunityCtaSectionComponent(sec);
    default:
      return renderCuratedSectionComponent(sec, bgClass);
  }
}

function renderFeaturedSectionComponent(sec, bgClass) {
  const novels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || t('ongoing_subtitle');
  const title = sec.title || t('ongoing_title');
  const moreLink = sec.viewAllLink || '#novels';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <a href="${escapeHtml(moreLink)}" class="section-link">${t('ongoing_more')} ➔</a>
        </div>
        ${novels.length > 0 ? `
          <div class="novel-grid novel-grid-4">
            ${novels.map(n => renderNovelCard(n)).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">📚</div>
            <p style="font-size:15px; margin:0;">No featured ongoing novels currently releasing.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderContinueReadingSectionComponent(sec, bgClass) {
  const novels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || t('continue_reading_subtitle');
  const title = sec.title || t('continue_reading_title');
  const moreLink = sec.viewAllLink || '#novels?status=ongoing';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <a href="${escapeHtml(moreLink)}" class="section-link">${t('continue_reading_more')} ➔</a>
        </div>
        ${novels.length > 0 ? `
          <div class="novel-grid">
            ${novels.map(n => renderNovelCard(n, 'continue')).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">📖</div>
            <p style="font-size:15px; margin:0;">No reading progress found. Pick up a novel below to begin reading.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderAudioSectionComponent(sec, bgClass) {
  const audioNovels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || 'Listen & Enjoy';
  const title = sec.title || 'Audio Novels';
  const moreLink = sec.viewAllLink || '#audio';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <div style="display:flex; align-items:center; gap:16px;">
            <a href="${escapeHtml(moreLink)}" class="section-more-link" style="color:var(--color-navy-deep); font-weight:600; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
              <span>View All Audio Novels →</span>
            </a>
            <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="section-more-link" style="color:var(--color-gold-warm); font-weight:600; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
              <span>▶ YouTube Channel</span>
            </a>
          </div>
        </div>
        ${audioNovels.length > 0 ? `
          <div class="audio-novels-grid">
            ${audioNovels.map(audio => renderAudioNovelCard(audio)).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">🎧</div>
            <p style="font-size:15px; margin:0;">No audio novels currently scheduled.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderTrendingSectionComponent(sec, bgClass) {
  const trendingNovels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || t('trending_subtitle');
  const title = sec.title || t('trending_title');
  const moreLink = sec.viewAllLink || '#novels';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          ${sec.viewAllLink ? `<a href="${escapeHtml(moreLink)}" class="section-link">View All ➔</a>` : ''}
        </div>
        ${trendingNovels.length > 0 ? `
          <div class="trending-list">
            ${trendingNovels.map((n, idx) => {
              const rank = n.trendingRank || n.rank || (idx + 1);
              const formattedRank = String(rank).padStart(2, '0');
              const cover = n.cover || '/default-cover.jpg';
              const nTitle = n.title || '';
              const link = n.link || ('#novel?id=' + (n.id || ''));
              return `
                <div class="trending-item">
                  <div class="trending-rank">${formattedRank}</div>
                  <img src="${cover}" class="trending-thumb" alt="${escapeHtml(nTitle)}" loading="lazy" onerror="this.onerror=null;this.src='/default-cover.jpg';">
                  <div class="trending-title">${escapeHtml(nTitle)}</div>
                  ${(n.views || n.rating) ? `
                    <div class="trending-stats">
                      ${n.views ? `<span>👁 ${n.views}</span>` : ''}
                      ${n.rating ? `<span>★ ${n.rating}</span>` : ''}
                    </div>
                  ` : ''}
                  <a href="${link}" class="btn btn-outline btn-sm" style="margin-top:12px;">${t('btn_read_more')}</a>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">🔥</div>
            <p style="font-size:15px; margin:0;">Trending novels will appear here as readers engage.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderCompletedSectionComponent(sec, bgClass) {
  const completedNovels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || t('completed_subtitle');
  const title = sec.title || t('completed_title');
  const moreLink = sec.viewAllLink || '#novels?status=completed';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <a href="${escapeHtml(moreLink)}" class="section-link">${t('completed_more')} ➔</a>
        </div>
        ${completedNovels.length > 0 ? `
          <div class="novel-grid">
            ${completedNovels.map(n => renderNovelCard(n)).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">✨</div>
            <p style="font-size:15px; margin:0;">No completed novels available at this time.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderLatestSectionComponent(sec, bgClass) {
  const novels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || 'Fresh Updates';
  const title = sec.title || 'Latest Novels';
  const moreLink = sec.viewAllLink || '#novels';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <a href="${escapeHtml(moreLink)}" class="section-link">View All ➔</a>
        </div>
        ${novels.length > 0 ? `
          <div class="novel-grid">
            ${novels.map(n => renderNovelCard(n)).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">📚</div>
            <p style="font-size:15px; margin:0;">No novels published yet.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderCuratedSectionComponent(sec, bgClass) {
  const novels = sec.novels || sec.items || [];
  const subtitle = sec.subtitle || 'Curated Selection';
  const title = sec.title || 'Special Collection';
  const moreLink = sec.viewAllLink || '#novels';
  const isCompact = sec.displayStyle === 'compact_grid' || (sec.contentLimit && sec.contentLimit <= 4);
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          ${sec.viewAllLink ? `<a href="${escapeHtml(moreLink)}" class="section-link">View All ➔</a>` : ''}
        </div>
        ${novels.length > 0 ? `
          <div class="novel-grid ${isCompact ? 'novel-grid-4' : ''}">
            ${novels.map(n => renderNovelCard(n)).join('')}
          </div>
        ` : `
          <div class="empty-section-message" style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:#ffffff; border:1px dashed var(--color-border); border-radius:var(--radius-lg);">
            <div style="font-size:32px; margin-bottom:8px;">✨</div>
            <p style="font-size:15px; margin:0;">No novels currently featured in this collection.</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderForumSectionComponent(sec, bgClass) {
  const homeTopics = sec.items || [];
  const subtitle = sec.subtitle || t('forum_subtitle');
  const title = sec.title || t('forum_title');
  const moreLink = sec.viewAllLink || '#forum';
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="section-header">
          <div class="section-heading-group">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="section-title">${escapeHtml(title)}</h2>
          </div>
          <a href="${escapeHtml(moreLink)}" class="section-link">Visit Forum ➔</a>
        </div>

        <div class="forum-layout" style="grid-template-columns: 1fr;">
          ${homeTopics.length > 0 ? homeTopics.map(tData => `
            <div class="topic-card">
              <img src="${getAvatarUrl(tData.authorAvatar)}" class="topic-author-avatar" alt="${escapeHtml(tData.author)}" onerror="this.src='/profile.png'">
              <div class="topic-main-info">
                <a href="#topic?id=${encodeURIComponent(tData.id)}" class="topic-title-link">${escapeHtml(tData.title)}</a>
                <div class="topic-meta-line">
                  <span>${escapeHtml(tData.author)}</span>
                  <span>•</span>
                  <span>${formatLastSeen(tData.date)}</span>
                </div>
              </div>
              <div class="topic-stats-bubble">
                <span>💬 ${tData.repliesCount || 0} ${t('forum_replies')}</span>
                <span>👁 ${tData.views || 0} ${t('forum_views')}</span>
              </div>
            </div>
          `).join('') : `
            <div style="text-align:center; padding:36px 20px; background:#FFFFFF; border-radius:12px; border:1px dashed var(--color-border); box-shadow:var(--shadow-sm);">
              <div style="font-size:32px; margin-bottom:8px;">💬</div>
              <h3 style="font-family:var(--font-serif); font-size:1.25rem; color:var(--color-navy-deep); margin:0 0 6px 0;">No forum discussions yet</h3>
              <p style="font-size:13px; color:var(--color-text-muted); margin:0 0 16px 0;">Join fellow readers and explore discussions in our community forum!</p>
              <a href="#forum" class="btn btn-gold btn-sm">Explore Community Forum ➔</a>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

function renderAuthorSpotlightSectionComponent(sec, bgClass) {
  const subtitle = sec.subtitle || t('author_subtitle');
  const title = sec.title || t('author_role');
  return `
    <section class="section ${bgClass}" id="section-${escapeHtml(sec.sectionKey)}">
      <div class="container">
        <div class="author-spotlight">
          <div class="author-photo-wrap">
            <img src="${SITE_DATA.author.avatar}" class="author-photo" alt="${SITE_DATA.author.name}">
            <div class="author-badge">👑 ${escapeHtml(title)}</div>
          </div>
          <div class="author-info">
            <span class="section-subtitle">${escapeHtml(subtitle)}</span>
            <h2 class="author-name">${SITE_DATA.author.name}</h2>
            <p class="author-bio">${SITE_DATA.author.bio}</p>
            <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
              <a href="#member?id=rudhra" class="btn btn-gold btn-sm">${t('author_profile_btn')}</a>
              <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Pratilipi</a>
              <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="btn btn-outline btn-sm">YouTube</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderCommunityCtaSectionComponent(sec) {
  const subtitle = sec.subtitle || t('community_subtitle');
  const title = sec.title || t('community_title');
  return `
    <section class="section" id="section-${escapeHtml(sec.sectionKey)}" style="background:linear-gradient(135deg, var(--color-navy-deep), var(--color-navy-royal)); color:#FFFFFF; text-align:center;">
      <div class="container" style="max-width:760px;">
        <span style="font-size:13px; color:var(--color-gold-light); font-weight:700; text-transform:uppercase; letter-spacing:2px;">${escapeHtml(subtitle)}</span>
        <h2 style="font-family:var(--font-serif); font-size:2.4rem; color:#FFFFFF; margin:12px 0 16px;">${escapeHtml(title)}</h2>
        <p style="color:var(--color-parchment); font-size:1.05rem; line-height:1.7; margin-bottom:28px;">
          ${t('community_desc')}
        </p>
        <button class="btn btn-gold btn-lg" onclick="openAuthModal('register')">${t('community_btn')}</button>
      </div>
    </section>
  `;
}

// 2. NOVEL LIBRARY VIEW
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
  const firstChapterNum = chapters.length > 0 
    ? (chapters[0].chapterNum || chapters[0].episodeNumber || String(chapters[0].num || '1')) 
    : null;

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
          <h3 class="section-title">${t('novel_chapters')} (${chapters.length})</h3>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${chapters.length > 0 ? chapters.map(ch => {
          const isOngoing = novel.status === 'Ongoing';
          const isSub = Boolean(ch.parentId || String(ch.num || '').includes('.'));
          const epNumDisplay = ch.episodeNumber || ch.num;

          const subBadge = isSub
            ? `<span style="font-size:10px; font-weight:700; color:var(--color-gold-warm); background:#FAF5EC; border:1px solid var(--color-border); padding:1px 6px; border-radius:4px;">Sub-Ep ${escapeHtml(String(epNumDisplay))}</span>`
            : '';

          const chParam = encodeURIComponent(ch.chapterNum || ch.episodeNumber || String(ch.num));
          const buttonHtml = `<a href="#reader?novel=${encodeURIComponent(novel.id)}&ch=${chParam}" class="btn btn-outline btn-sm">${t('btn_read_more')} ➔</a>`;

          return `
            <div class="chapter-list-item" style="${isSub ? 'margin-left:24px; border-left:3px solid var(--color-gold); background:#FFFDF8;' : ''}">
              <div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  ${subBadge}
                  <span style="font-weight:700; color:var(--color-navy-deep); word-break:break-word;">${escapeHtml(ch.title || `Episode ${epNumDisplay}`)}</span>
                </div>
                <div style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">
                  ${ch.date ? `<span>📅 ${escapeHtml(ch.date)}</span>` : ''}
                  ${ch.readTime ? `<span style="margin-left:8px;">⏱ ${escapeHtml(ch.readTime)}</span>` : ''}
                  ${ch.words ? `<span style="margin-left:8px;">📖 ${escapeHtml(ch.words)}</span>` : ''}
                </div>
              </div>
              ${buttonHtml}
            </div>
          `;
        }).join('') : `
          <div style="padding:48px 24px; text-align:center; color:var(--color-text-muted); background:var(--color-card-bg); border-radius:var(--radius-md); border:1px dashed var(--color-border);">
            <div style="font-size:32px; margin-bottom:8px;">📖</div>
            <p style="font-size:15px; margin:0;">Episodes for this novel are currently being prepared and will be released soon.</p>
          </div>
        `}
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
  let currIndex = chapters.findIndex(c => String(c.num) === chRaw || String(c.chapterNum) === chRaw || String(c.episodeNumber) === chRaw);
  if (currIndex === -1 && chRaw === '1' && chapters.length > 0) {
    currIndex = 0;
  }
  const chapter = currIndex !== -1 ? chapters[currIndex] : {
    num: chRaw,
    chapterNum: chRaw,
    episodeNumber: chRaw,
    title: `Episode ${chRaw}`,
    date: 'Today',
    readTime: '8 mins'
  };
  const chNum = chapter ? (chapter.chapterNum || chapter.episodeNumber || String(chapter.num || chRaw)) : chRaw;

  const prevCh = currIndex > 0 ? (chapters[currIndex - 1].chapterNum || chapters[currIndex - 1].episodeNumber || String(chapters[currIndex - 1].num)) : null;
  const nextCh = (currIndex !== -1 && currIndex < chapters.length - 1) ? (chapters[currIndex + 1].chapterNum || chapters[currIndex + 1].episodeNumber || String(chapters[currIndex + 1].num)) : null;

  // Track reading progress automatically
  saveReadingProgress(novelId, chNum, 100);

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
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const currentCategoryId = urlParams.get('category');

  const [categoriesList, topicsData, sidebarData, liveStats] = await Promise.all([
    getForumCategories(),
    getForumTopics(currentCategoryId),
    getSidebarPosts(),
    getForumLiveStats()
  ]);

  const categories = Array.isArray(categoriesList) ? categoriesList : [];
  const currentCategory = currentCategoryId ? categories.find(c => String(c.id) === String(currentCategoryId)) : null;

  // Genuine counts directly from MySQL categories aggregate
  const totalCategories = categories.length;
  const totalTopics = categories.reduce((acc, c) => acc + (c.topicsCount || 0), 0);
  const totalPosts = categories.reduce((acc, c) => acc + (c.postsCount || c.repliesCount || 0), 0);

  const activeCategoryTitle = currentCategory ? currentCategory.title : t('forum_title');

  container.innerHTML = `
    <div class="container forum-page">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" aria-label="Forum Breadcrumb">
        <a href="#home">Home</a>
        <span class="crumb-separator">›</span>
        ${currentCategoryId ? `
          <a href="#forum">Forum</a>
          <span class="crumb-separator">›</span>
          <span class="crumb-current">${escapeHtml(currentCategory?.title || 'Category')}</span>
        ` : `
          <span class="crumb-current">Forum & Community</span>
        `}
      </nav>

      <div class="forum-header-bar">
        <div>
          ${currentCategoryId ? `
            <a href="#forum" class="section-link" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:8px; font-weight:600;">
              « Back to All Categories
            </a>
          ` : ''}
          <span class="section-subtitle">${currentCategory ? (currentCategory.desc || t('forum_subtitle')) : t('forum_subtitle')}</span>
          <h1 class="section-title">${escapeHtml(activeCategoryTitle)}</h1>
        </div>

        <div>
          <div class="forum-live-stats-bar" id="forum-live-stats-bar" aria-label="Forum Live Statistics">
            <div class="forum-stat-badge" title="Total registered member accounts">
              <span class="forum-stat-icon">👥</span>
              <div class="forum-stat-content">
                <span class="forum-stat-val" id="forum-stat-members">${Number(liveStats?.totalMembers || 0)}</span>
                <span class="forum-stat-lbl">Members</span>
              </div>
            </div>

            <div class="forum-stat-badge" title="Total replies across all forum threads">
              <span class="forum-stat-icon">💬</span>
              <div class="forum-stat-content">
                <span class="forum-stat-val" id="forum-stat-replies">${Number(liveStats?.totalReplies || 0)}</span>
                <span class="forum-stat-lbl">Replies</span>
              </div>
            </div>

            <div class="forum-stat-badge" title="Total unique guest visitors tracked">
              <span class="forum-stat-icon">🌐</span>
              <div class="forum-stat-content">
                <span class="forum-stat-val" id="forum-stat-guests">${Number(liveStats?.totalGuests || 0)}</span>
                <span class="forum-stat-lbl">Guests Visited</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="forum-layout">
        <!-- Main Content Column -->
        <div class="forum-main-col">
          ${currentCategoryId ? `
            <!-- Category Discussion List View -->
            <div class="category-header-banner" style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div class="category-icon-box" style="width:52px; height:52px; font-size:24px;">${currentCategory?.icon || '💬'}</div>
                <div>
                  <h2 style="font-family:var(--font-serif); font-size:1.35rem; color:var(--color-navy-deep); margin:0 0 4px 0;">${escapeHtml(currentCategory?.title || 'Category')}</h2>
                  <div style="font-size:12.5px; color:var(--color-text-muted);">${escapeHtml(currentCategory?.desc || '')}</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="display:flex; gap:14px; font-size:12px; color:var(--color-text-muted);">
                  <span>Topics: <strong style="color:var(--color-navy-deep);">${currentCategory?.topicsCount || 0}</strong></span>
                  <span>Replies: <strong style="color:var(--color-navy-deep);">${currentCategory?.repliesCount || 0}</strong></span>
                </div>
                <button type="button" class="btn btn-gold btn-sm" onclick="toggleNewTopicForm()">+ Start Discussion 💬</button>
              </div>
            </div>

            <!-- Collapsible New Discussion Form -->
            <div id="new-topic-form-container" class="new-topic-form-wrap" style="display:none;">
              <h3 style="font-family:var(--font-serif); font-size:1.25rem; color:var(--color-navy-deep); margin-bottom:12px;">
                Start a Discussion in ${escapeHtml(currentCategory?.title || 'this Category')}
              </h3>
              <input type="text" id="new-topic-title-input" class="form-input" placeholder="Discussion title..." style="width:100%; box-sizing:border-box; margin-bottom:12px; font-weight:600;">
              <textarea id="new-topic-content-input" class="form-input" rows="4" placeholder="What would you like to discuss with fellow readers?" style="width:100%; box-sizing:border-box; resize:vertical; margin-bottom:14px;"></textarea>
              <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="btn btn-outline btn-sm" onclick="toggleNewTopicForm()">Cancel</button>
                <button type="button" id="new-topic-submit-btn" class="btn btn-gold btn-sm" onclick="submitNewForumTopic('${escapeQuotes(currentCategoryId)}')">
                  Publish Discussion 🚀
                </button>
              </div>
            </div>

            <div class="forum-topics-list">
              ${topicsData.length > 0 ? topicsData.map(topic => `
                <div class="topic-card">
                  <img src="${getAvatarUrl(topic.authorAvatar)}" class="topic-author-avatar" alt="${escapeHtml(topic.author)}" onerror="this.src='/profile.png'">
                  <div class="topic-main-info" style="flex:1; min-width:0;">
                    <a href="#topic?id=${encodeURIComponent(topic.id)}" class="topic-title-link">${escapeHtml(topic.title)}</a>
                    ${topic.excerpt ? `<div style="font-size:12px; color:var(--color-text-muted); margin:4px 0; line-height:1.4;">${escapeHtml(topic.excerpt)}</div>` : ''}
                    <div class="topic-meta-line" style="font-size:11px; color:var(--color-text-muted); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                      <span>✍️ ${escapeHtml(topic.author)}</span>
                      <span>•</span>
                      <span>📅 ${formatLastSeen(topic.date)}</span>
                      ${topic.lastAuthor ? `<span>• Last reply by <strong>${escapeHtml(topic.lastAuthor)}</strong></span>` : ''}
                    </div>
                  </div>
                  <div class="topic-stats-bubble" style="flex-shrink:0;">
                    <span title="${topic.repliesCount} Replies">💬 ${topic.repliesCount}</span>
                    <span title="${topic.views} Views">👁 ${topic.views}</span>
                    ${(topic.reactionsCount || 0) > 0 ? `<span title="${topic.reactionsCount} Reactions">❤️ ${topic.reactionsCount}</span>` : ''}
                  </div>
                </div>
              `).join('') : `
                <div style="text-align:center; padding:48px 24px; background:#FFFFFF; border-radius:var(--radius-lg); border:1px dashed var(--color-border);">
                  <div style="font-size:36px; margin-bottom:8px;">💬</div>
                  <h3 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin-bottom:6px;">No discussions yet in this category</h3>
                  <p style="font-size:13px; color:var(--color-text-muted); margin-bottom:16px;">Be the first reader to start a discussion in this topic!</p>
                  <button type="button" class="btn btn-gold btn-sm" onclick="toggleNewTopicForm()">+ Start Discussion 💬</button>
                </div>
              `}
            </div>
          ` : `
            <!-- All Categories Cards List -->
            <div class="forum-categories-list">
              ${categories.map(cat => `
                <div class="forum-category-card" onclick="window.location.hash = '#forum?category=${encodeURIComponent(cat.id)}';">
                  <div class="category-icon-box">${cat.icon || '💬'}</div>
                  <div class="category-meta-info">
                    <div class="category-title">${escapeHtml(cat.title)}</div>
                    <div class="category-desc">${escapeHtml(cat.desc || cat.description || '')}</div>
                    <div style="font-size:11px; color:var(--color-gold-warm); margin-top:4px;">
                      Browse Category ➔
                    </div>
                  </div>
                  <div class="category-stats-col">
                    <div><strong>${cat.topicsCount || 0}</strong> ${t('forum_topics')}</div>
                    <div><strong>${cat.postsCount || cat.repliesCount || 0}</strong> ${t('forum_replies')}</div>
                  </div>
                  <div class="category-latest-col">
                    ${cat.latestTopicTitle ? `
                      <img src="${getAvatarUrl(cat.lastActivityAvatar)}" class="category-latest-avatar" alt="${escapeHtml(cat.lastActivityAuthor || 'Member')}" onerror="this.src='/profile.png'">
                      <div class="category-latest-info">
                        <a href="#topic?id=${encodeURIComponent(cat.latestTopicId)}" class="category-latest-title" onclick="event.stopPropagation();" title="${escapeHtml(cat.latestTopicTitle)}">
                          ${escapeHtml(cat.latestTopicTitle)}
                        </a>
                        <span class="category-latest-meta">
                          by <strong>${escapeHtml(cat.lastActivityAuthor || 'Member')}</strong> • ${formatLastSeen(cat.lastActivityAt)}
                        </span>
                      </div>
                    ` : `
                      <div style="font-size:11.5px; color:var(--color-text-muted); font-style:italic;">No discussions yet</div>
                    `}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Recent Discussions Across All Categories -->
            <div style="margin-top:32px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:var(--color-navy-deep); margin:0;">
                  Recent Community Discussions
                </h3>
              </div>

              <div class="forum-topics-list">
                ${topicsData.length > 0 ? topicsData.map(topic => `
                  <div class="topic-card">
                    <img src="${getAvatarUrl(topic.authorAvatar)}" class="topic-author-avatar" alt="${escapeHtml(topic.author)}" onerror="this.src='/profile.png'">
                    <div class="topic-main-info" style="flex:1; min-width:0;">
                      <a href="#topic?id=${encodeURIComponent(topic.id)}" class="topic-title-link">${escapeHtml(topic.title)}</a>
                      ${topic.excerpt ? `<div style="font-size:12px; color:var(--color-text-muted); margin:4px 0; line-height:1.4;">${escapeHtml(topic.excerpt)}</div>` : ''}
                      <div class="topic-meta-line" style="font-size:11px; color:var(--color-text-muted); display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <a href="#forum?category=${encodeURIComponent(topic.categoryId)}" style="background:#FAF5EC; color:var(--color-gold-warm); padding:1px 6px; border-radius:4px; font-weight:600; border:1px solid #E8DCCB; text-decoration:none;">${escapeHtml(topic.categoryTitle)}</a>
                        <span>✍️ ${escapeHtml(topic.author)}</span>
                        <span>•</span>
                        <span>📅 ${formatLastSeen(topic.date)}</span>
                        ${topic.lastAuthor ? `<span>• Last reply by <strong>${escapeHtml(topic.lastAuthor)}</strong></span>` : ''}
                      </div>
                    </div>
                    <div class="topic-stats-bubble" style="flex-shrink:0;">
                      <span title="${topic.repliesCount} Replies">💬 ${topic.repliesCount}</span>
                      <span title="${topic.views} Views">👁 ${topic.views}</span>
                      ${(topic.reactionsCount || 0) > 0 ? `<span title="${topic.reactionsCount} Reactions">❤️ ${topic.reactionsCount}</span>` : ''}
                    </div>
                  </div>
                `).join('') : `
                  <div style="text-align:center; padding:40px 20px; background:#FFFFFF; border-radius:var(--radius-lg); border:1px dashed var(--color-border);">
                    <div style="font-size:32px; margin-bottom:6px;">💬</div>
                    <div style="font-weight:600; font-size:13.5px; color:var(--color-navy-deep); margin-bottom:4px;">No community discussions yet</div>
                    <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:12px;">Share your thoughts and reviews directly on each novel or episode page!</div>
                    <a href="#novels" class="btn btn-gold btn-sm">Browse Novels & Comment ➔</a>
                  </div>
                `}
              </div>
            </div>
          `}
        </div>

        <!-- Sidebar Panels (Warm Ivory & Gold) -->
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

          <!-- Members Online Panel (Real-Time MySQL Activity) -->
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

            <!-- Summary Stats Counter Grid -->
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

            <!-- Active Members List / Avatars / Names -->
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

  // Dynamically load real-time online members & guests from MySQL
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
    renderNotFound(container);
    return;
  }

  const topic = await getForumTopicById(topicId);
  if (!topic) {
    renderNotFound(container);
    return;
  }

  window.renderTopicView = () => renderTopicView(container, hash);

  const backLink = topic.categoryId ? `#forum?category=${encodeURIComponent(topic.categoryId)}` : '#forum';

  container.innerHTML = `
    <div class="container section">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" aria-label="Thread Breadcrumb">
        <a href="#home">Home</a>
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
    if (!m.statusHidden) {
      if (m.isOnline) {
        statusBadge = `<div class="status-indicator online"><span class="status-dot green"></span> Online Now</div>`;
        avatarDot = `<span class="status-dot green" style="position:absolute; bottom:2px; right:2px; border:2px solid #FFFFFF;"></span>`;
      } else if (m.lastSeen) {
        statusBadge = `<div class="status-indicator offline">⏱ Last seen: ${formatLastSeen(m.lastSeen)}</div>`;
      } else {
        statusBadge = `<div class="status-indicator offline"><span class="status-dot" style="background:#94a3b8;"></span> Offline</div>`;
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
                    ? `<span class="status-indicator online"><span class="status-dot green"></span> Online Now</span>`
                    : (member.lastSeen
                      ? `<span class="status-indicator offline">⏱ Last seen: ${formatLastSeen(member.lastSeen)}</span>`
                      : `<span class="status-indicator offline"><span class="status-dot" style="background:#94a3b8;"></span> Offline</span>`
                    )
                  }
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Activity Status Privacy Control (For Current User only) -->
          ${isCurrentUser ? `
            <div class="activity-status-card">
              <div class="activity-status-info">
                <span class="activity-status-icon">${isActEnabled ? '🟢' : '🔒'}</span>
                <div>
                  <div class="activity-status-title-row">
                    <span class="activity-status-title">Activity Status</span>
                    <span id="activity-status-label" class="activity-status-badge ${isActEnabled ? 'enabled' : 'hidden'}">
                      ${isActEnabled ? 'Enabled' : 'Hidden'}
                    </span>
                  </div>
                  <p class="activity-status-desc">
                    When enabled, other readers can see when you are online and your last-seen time. When hidden, your online status remains private.
                  </p>
                </div>
              </div>
              <label class="switch" aria-label="Toggle Activity Status">
                <input type="checkbox" id="profile-activity-toggle" ${isActEnabled ? 'checked' : ''} onchange="toggleActivityStatus(this.checked)">
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
        <button class="btn btn-gold btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#home'}'); openAuthModal('login');">
          🔑 ${t('btn_login')}
        </button>
        <button class="btn btn-outline btn-lg" onclick="document.getElementById('content-restriction-modal')?.remove(); sessionStorage.setItem('rp_auth_redirect', '${redirectHash || window.location.hash || '#home'}'); openAuthModal('register');">
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



