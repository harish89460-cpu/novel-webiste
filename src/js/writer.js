// Rudhra Prarthana Novels — Professional Writer Dashboard & Novel Writing Workspace
// Minimal, distraction-free writing environment connected directly to MySQL backend

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';
import { ADMIN_ICONS } from './admin.js';
import { updateHeaderUserArea } from './auth.js';

// Global Writer State
export const writerState = {
  activeTab: 'overview', // 'overview' | 'novels' | 'write' | 'episodes' | 'editor' | 'status' | 'profile'
  user: null,
  stats: null,
  novels: [],
  selectedNovelId: null,
  episodes: [],
  currentNovel: null,
  currentEpisode: null,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved'
  editorDirty: false,
  autosaveTimer: null
};
window.writerState = writerState;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ========================================================
   1. MAIN WRITER DASHBOARD CONTROLLER
   ======================================================== */
export async function renderWriterDashboard(container, requestedTab) {
  // Loading guard
  container.innerHTML = `
    <div class="writer-dashboard" style="min-height:80vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;">
      <div style="width:38px; height:38px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:writerSpin 0.8s linear infinite;"></div>
      <div style="font-family:'Playfair Display',serif; font-size:16px; color:#0B1F33; font-weight:600;">
        Connecting to Writer Workspace...
      </div>
      <style>@keyframes writerSpin { to { transform: rotate(360deg); } }</style>
    </div>
  `;

  // Verify Writer / Author Session with Backend
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    sessionStorage.setItem('rp_admin_redirect', '#writer');
    showToast('Please log in to access your Writer Workspace.');
    window.location.hash = '#admin-login';
    return;
  }

  let sessionUser = null;
  try {
    const res = await apiFetch('/api/writer/workspace');
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Access denied: Active Writer session required.');
        sessionStorage.setItem('rp_admin_redirect', '#writer');
        window.location.hash = '#admin-login';
        return;
      }
      throw new Error('Failed to load writer workspace');
    }

    const data = await res.json();
    sessionUser = data.writer;
    writerState.user = data.writer;
    writerState.stats = data.stats || {
      novelsCount: 0,
      draftsCount: 0,
      publishedNovelsCount: 0,
      episodesCount: 0,
      totalViews: 0
    };
    writerState.novels = data.novels || [];
    window.CURRENT_USER = data.writer;
    window.IS_LOGGED_IN = true;
    updateHeaderUserArea();
  } catch (err) {
    console.error('Writer workspace auth error:', err);
    container.innerHTML = `
      <div class="writer-dashboard" style="min-height:80vh; display:flex; align-items:center; justify-content:center; padding:20px;">
        <div class="writer-card" style="max-width:480px; text-align:center; padding:36px 28px;">
          <div style="font-size:42px; margin-bottom:12px;">🔒</div>
          <h2 class="writer-header-title" style="margin-bottom:8px; font-size:22px;">Authentication Required</h2>
          <p style="color:#64748B; font-size:14px; line-height:1.6; margin-bottom:20px;">
            ${escapeHtml(err.message || 'Please log in with your authorized Writer account.')}
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <a href="#forms" class="btn btn-outline">« Reader Home</a>
            <a href="#admin-login" class="btn btn-gold">Author & Writer Login »</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (requestedTab) {
    writerState.activeTab = requestedTab;
  }

  const TAB_TITLES = {
    overview: 'Overview',
    novels: 'My Novels',
    write: 'Write Novel',
    episodes: 'Manage Episodes',
    editor: 'Writing Editor',
    status: 'Publishing Status',
    profile: 'Profile & Password'
  };

  // Render Writer Shell Layout with strictly 8 essential sidebar items
  container.innerHTML = `
    <div class="writer-dashboard">
      <!-- Mobile Bar -->
      <header class="admin-top-bar" role="banner" style="background:#0B1F33; border-bottom:1px solid rgba(255,255,255,0.08);">
        <button type="button" id="writer-mobile-toggle" class="admin-mobile-toggle-btn" 
                aria-label="Toggle Navigation Menu" aria-expanded="false" 
                onclick="toggleWriterMobileNav()">
          <span class="hamburger-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="admin-mobile-toggle-label" style="color:#FFFFFF;">Menu</span>
        </button>
        
        <span id="writer-top-bar-current-tab" class="admin-top-current-tab" style="color:#FFFFFF;">
          ${TAB_TITLES[writerState.activeTab] || 'Writer Dashboard'}
        </span>

        <a href="#forms" class="admin-mobile-site-btn" title="View Reader Site" style="color:#E2E8F0;">
          ${ADMIN_ICONS.externalLink}
        </a>
      </header>

      <!-- Mobile Backdrop -->
      <div id="writer-sidebar-backdrop" class="admin-sidebar-backdrop" onclick="toggleWriterMobileNav(false)" aria-hidden="true"></div>

      <div class="writer-shell">
        <!-- Sidebar Navigation: ONLY 8 essential items -->
        <aside class="writer-sidebar" id="writer-sidebar-nav" aria-label="Writer Navigation">
          <!-- Mobile Drawer Header -->
          <div class="admin-drawer-header" style="border-bottom:1px solid rgba(255,255,255,0.08); padding:16px 20px;">
            <span class="admin-drawer-title" style="color:#FFFFFF; font-size:15px; font-weight:600;">Writer Menu</span>
            <button type="button" class="admin-drawer-close-btn" aria-label="Close navigation" onclick="toggleWriterMobileNav(false)" style="color:#94A3B8;">
              ✕
            </button>
          </div>

          <!-- Writer Identity -->
          <div class="writer-sidebar-user">
            <div class="writer-avatar-circle">
              ${sessionUser.avatar && sessionUser.avatar !== '/profile.png' ? `
                <img src="${escapeHtml(sessionUser.avatar)}" alt="${escapeHtml(sessionUser.name || sessionUser.username)}">
              ` : `
                <span class="writer-avatar-initial">${escapeHtml((sessionUser.name || sessionUser.username || 'W')[0].toUpperCase())}</span>
              `}
            </div>
            <div class="writer-user-info">
              <div class="writer-user-name">${escapeHtml(sessionUser.name || sessionUser.username)}</div>
              <span class="writer-user-role">Writer</span>
            </div>
          </div>

          <!-- Strictly 8 Essential Navigation Items -->
          <nav class="writer-nav-list" aria-label="Writer Workspace Navigation">
            <!-- 1. Overview -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'overview' ? 'active' : ''}" 
                    onclick="switchWriterTab('overview')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.grid}
                <span>Overview</span>
              </span>
            </button>

            <!-- 2. My Novels -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'novels' ? 'active' : ''}" 
                    onclick="switchWriterTab('novels')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.book}
                <span>My Novels</span>
              </span>
              <span class="writer-nav-pill" id="wnav-novels-count">${writerState.novels.length}</span>
            </button>

            <!-- 3. Write Novel -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'write' ? 'active' : ''}" 
                    onclick="switchWriterTab('write')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.edit}
                <span>Write Novel</span>
              </span>
            </button>

            <!-- 4. Manage Episodes -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'episodes' ? 'active' : ''}" 
                    onclick="switchWriterTab('episodes')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.episodes}
                <span>Manage Episodes</span>
              </span>
              <span class="writer-nav-pill" id="wnav-episodes-count">${writerState.stats?.episodesCount || 0}</span>
            </button>

            <!-- 5. Publishing Status -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'status' ? 'active' : ''}" 
                    onclick="switchWriterTab('status')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.checkCircle}
                <span>Publishing Status</span>
              </span>
            </button>

            <!-- 6. Profile & Password -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'profile' ? 'active' : ''}" 
                    onclick="switchWriterTab('profile')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.settings}
                <span>Profile & Password</span>
              </span>
            </button>
          </nav>

          <!-- Sidebar Footer: 7. Community Site, 8. Sign Out -->
          <div class="writer-sidebar-footer">
            <a href="#forms" class="writer-footer-link" title="View Reader Site">
              ${ADMIN_ICONS.externalLink}
              <span>Community Site</span>
            </a>
            <button type="button" class="writer-footer-link logout-btn" onclick="handleWriterLogout()" title="Sign Out of Writer Workspace">
              ${ADMIN_ICONS.logout}
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Canvas -->
        <main class="writer-canvas" id="writer-main-canvas" role="main" tabindex="-1">
          <!-- Dynamically populated based on activeTab -->
        </main>
      </div>
    </div>
  `;

  // Window methods for navigation
  window.toggleWriterMobileNav = (forceState) => {
    const sidebar = document.getElementById('writer-sidebar-nav');
    const backdrop = document.getElementById('writer-sidebar-backdrop');
    const toggleBtn = document.getElementById('writer-mobile-toggle');
    if (!sidebar) return;

    const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('drawer-open');
    if (isOpen) {
      sidebar.classList.add('drawer-open');
      if (backdrop) backdrop.classList.add('active');
      if (toggleBtn) toggleBtn.classList.add('active');
    } else {
      sidebar.classList.remove('drawer-open');
      if (backdrop) backdrop.classList.remove('active');
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  };

  window.switchWriterTab = (tab, params = {}) => {
    // Unsaved changes guard
    if (writerState.editorDirty && !confirm('You have unsaved writing changes. Discard and switch section?')) {
      return;
    }
    writerState.editorDirty = false;

    writerState.activeTab = tab;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#writer?tab=${tab}`);
    }

    if (typeof window.toggleWriterMobileNav === 'function') {
      window.toggleWriterMobileNav(false);
    }

    document.querySelectorAll('#writer-sidebar-nav .writer-nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const clickedBtn = document.querySelector(`#writer-sidebar-nav .writer-nav-btn[onclick*="'${tab}'"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    const topBarTitle = document.getElementById('writer-top-bar-current-tab');
    if (topBarTitle) {
      topBarTitle.textContent = TAB_TITLES[tab] || 'Writer Dashboard';
    }

    renderActiveWriterTab(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.handleWriterLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      localStorage.removeItem('rp_auth_token');
      sessionStorage.removeItem('rp_admin_redirect');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      updateHeaderUserArea();
      showToast('Logged out of Writer Workspace successfully.');
      window.location.hash = '#admin-login';
      if (window.renderAppView) window.renderAppView();
    }
  };

  // Beforeunload warning if editor is dirty
  window.onbeforeunload = (e) => {
    if (writerState.editorDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved writing changes.';
      return 'You have unsaved writing changes.';
    }
  };

  renderActiveWriterTab();
}

/**
 * Switch and Render Active Tab
 */
function renderActiveWriterTab(params = {}) {
  const canvas = document.getElementById('writer-main-canvas');
  if (!canvas) return;

  switch (writerState.activeTab) {
    case 'overview':
      renderWriterOverview(canvas);
      break;
    case 'novels':
      renderWriterNovels(canvas);
      break;
    case 'write':
      renderWriterCreateNovel(canvas, params.novelId);
      break;
    case 'episodes':
      renderWriterEpisodes(canvas, params.novelId);
      break;
    case 'editor':
      renderWriterEditor(canvas, params.episodeId, params.novelId);
      break;
    case 'status':
      renderWriterStatus(canvas);
      break;
    case 'profile':
      renderWriterProfile(canvas);
      break;
    default:
      renderWriterOverview(canvas);
  }
}

/* ========================================================
   2. WRITER OVERVIEW TAB
   ======================================================== */
async function renderWriterOverview(canvas) {
  // Show honest loading state if stats not yet present
  if (!writerState.stats) {
    canvas.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#64748B;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:writerSpin 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading dashboard metrics...</div>
      </div>
    `;
  }

  // Refresh workspace data from MySQL to ensure real-time counts
  try {
    const res = await apiFetch('/api/writer/workspace');
    if (res.ok) {
      const data = await res.json();
      writerState.stats = data.stats;
      writerState.novels = data.novels || [];
      const novelsPill = document.getElementById('wnav-novels-count');
      if (novelsPill) novelsPill.textContent = writerState.novels.length;
      const epPill = document.getElementById('wnav-episodes-count');
      if (epPill) epPill.textContent = data.stats?.episodesCount || 0;
    }
  } catch (e) {
    console.warn('Failed to refresh stats:', e);
  }

  const stats = writerState.stats || {
    novelsCount: 0,
    draftsCount: 0,
    publishedNovelsCount: 0,
    episodesCount: 0,
    totalViews: 0
  };

  // Safe numerical formatting (guarantees NO 'undefined' ever)
  const novelsCount = Number(stats.novelsCount) || 0;
  const draftsCount = Number(stats.draftsCount) || 0;
  const publishedNovelsCount = Number(stats.publishedNovelsCount) || 0;
  const episodesCount = Number(stats.episodesCount) || 0;
  const totalViews = Number(stats.totalViews) || 0;

  canvas.innerHTML = `
    <!-- Simple, Clean Header -->
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Writer Dashboard</h1>
        <p class="writer-header-sub">Manage your novels and drafts.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
          ${ADMIN_ICONS.edit}
          <span>+ Write Novel</span>
        </button>
      </div>
    </div>

    <!-- Essential Database-Backed Statistics Grid (Zero fake counts, NO undefined) -->
    <div class="writer-metrics-grid">
      <div class="writer-metric-card">
        <span class="writer-metric-label">My Novels</span>
        <span class="writer-metric-value">${novelsCount}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Drafts</span>
        <span class="writer-metric-value drafts">${draftsCount}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Published Novels</span>
        <span class="writer-metric-value published">${publishedNovelsCount}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Episodes</span>
        <span class="writer-metric-value">${episodesCount}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Reader Views</span>
        <span class="writer-metric-value" style="color:#0B1F33;">${totalViews.toLocaleString()}</span>
      </div>
    </div>

    <!-- Recent Novels Section (Compact, Clean, Distraction-free) -->
    <div class="writer-card">
      <div class="writer-card-header">
        <h2 class="writer-card-title">Recent Novels</h2>
        ${writerState.novels.length > 0 ? `
          <button type="button" class="btn btn-outline" style="font-size:12.5px; padding:4px 10px;" onclick="switchWriterTab('novels')">
            View All (${writerState.novels.length}) »
          </button>
        ` : ''}
      </div>

      ${writerState.novels.length === 0 ? `
        <div class="writer-empty-state">
          <div class="writer-empty-icon">📖</div>
          <h3 class="writer-empty-title">No novels created yet</h3>
          <p class="writer-empty-desc">Begin your writing journey by creating your first novel.</p>
          <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
            + Write Novel
          </button>
        </div>
      ` : `
        <div class="writer-table-wrap">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:60px;">Cover</th>
                <th>Novel Title</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:center;">Episodes</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.novels.slice(0, 5).map(n => `
                <tr>
                  <td>
                    <img src="${escapeHtml(n.cover || '/default-cover.jpg')}" alt="${escapeHtml(n.title)}" 
                         style="width:36px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;">
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33; font-size:14px;">${escapeHtml(n.title)}</div>
                    <div style="font-size:12px; color:#64748B;">${escapeHtml(n.genre || 'Novel')}</div>
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${n.visibility === 'public' ? 'published' : (n.visibility === 'submitted' ? 'review' : 'draft')}">
                      ${n.visibility === 'public' ? 'Published' : (n.visibility === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:center; font-weight:600; color:#0B1F33;">
                    ${n.chapters_count || n.chaptersCount || 0}
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 10px;" 
                              onclick="switchWriterTab('write', { novelId: '${n.id}' })">
                        Edit
                      </button>
                      <button type="button" class="btn btn-gold" style="font-size:12px; padding:5px 10px;" 
                              onclick="switchWriterTab('episodes', { novelId: '${n.id}' })">
                        Episodes
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* ========================================================
   3. MY NOVELS TAB
   ======================================================== */
async function renderWriterNovels(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">My Novels</h1>
        <p class="writer-header-sub">Manage your novels catalog, edit titles, and organize episodes.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
          ${ADMIN_ICONS.edit}
          <span>+ Write Novel</span>
        </button>
      </div>
    </div>

    <div id="writer-novels-table-container">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading your novels...
      </div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/writer/novels');
    const data = await res.json();
    writerState.novels = data.novels || [];

    const container = document.getElementById('writer-novels-table-container');
    if (!container) return;

    if (writerState.novels.length === 0) {
      container.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📚</div>
            <h3 class="writer-empty-title">No novels created yet</h3>
            <p class="writer-empty-desc">You haven't created any novels yet. Start your first novel today.</p>
            <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
              + Write Novel
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="writer-card" style="padding:0; overflow:hidden;">
        <div class="writer-table-wrap" style="border:none;">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:60px;">Cover</th>
                <th>Novel Title</th>
                <th>Genre</th>
                <th style="text-align:center;">Episodes</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.novels.map(n => `
                <tr>
                  <td>
                    <img src="${escapeHtml(n.cover || '/default-cover.jpg')}" alt="${escapeHtml(n.title)}" 
                         style="width:40px; height:56px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;">
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33; font-size:14.5px;">${escapeHtml(n.title)}</div>
                    <div style="font-size:12px; color:#64748B; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${escapeHtml(n.description || 'No description added.')}
                    </div>
                  </td>
                  <td style="color:#475569;">
                    ${escapeHtml(n.genre || 'Novel')}
                  </td>
                  <td style="text-align:center; font-weight:700; color:#0B1F33;">
                    ${n.chapters_count || n.chaptersCount || 0}
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${n.visibility === 'public' ? 'published' : (n.visibility === 'submitted' ? 'review' : 'draft')}">
                      ${n.visibility === 'public' ? 'Published' : (n.visibility === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      <button type="button" class="btn btn-outline" style="font-size:12.5px; padding:5px 10px;" 
                              onclick="switchWriterTab('write', { novelId: '${n.id}' })">
                        Edit
                      </button>
                      <button type="button" class="btn btn-gold" style="font-size:12.5px; padding:5px 10px;" 
                              onclick="switchWriterTab('episodes', { novelId: '${n.id}' })">
                        Episodes
                      </button>
                      ${n.visibility === 'public' ? `
                        <a href="#novel?id=${encodeURIComponent(n.id)}" class="btn btn-outline" style="font-size:12px; padding:5px 8px;" target="_blank" title="View Reader Page">
                          ${ADMIN_ICONS.externalLink}
                        </a>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load novels: ' + err.message);
  }
}

/* ========================================================
   4. WRITE NOVEL / EDIT NOVEL TAB (Focused Minimal Form)
   ======================================================== */
async function renderWriterCreateNovel(canvas, editNovelId = null) {
  let existing = null;
  if (editNovelId) {
    existing = writerState.novels.find(n => n.id === editNovelId);
    if (!existing) {
      try {
        const res = await apiFetch(`/api/writer/novels/${editNovelId}`);
        const data = await res.json();
        existing = data.novel;
      } catch (e) {
        console.warn('Novel fetch error:', e);
      }
    }
  }

  const isEditing = Boolean(existing);
  writerState.currentNovel = existing;
  writerState.editorDirty = false;

  canvas.innerHTML = `
    <!-- Compact Writing Page Header -->
    <div class="writer-header-bar">
      <div>
        <a href="#writer?tab=novels" onclick="switchWriterTab('novels')" class="btn btn-outline" style="padding:4px 10px; font-size:12px; margin-bottom:8px; display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.backArrow}
          <span>Back to My Novels</span>
        </a>
        <h1 class="writer-header-title" id="wn-header-title">
          ${isEditing ? escapeHtml(existing.title) : 'New Novel'}
        </h1>
      </div>

      <div class="writer-header-actions">
        <!-- Live Save Status Indicator -->
        <div id="wn-save-status" class="writer-save-status saved">
          <span class="writer-save-dot"></span>
          <span>${isEditing ? 'Saved' : 'Draft'}</span>
        </div>

        <button type="button" class="btn btn-outline" onclick="previewWriterNovel()">
          ${ADMIN_ICONS.eye}
          <span>Preview</span>
        </button>

        <button type="button" class="btn btn-gold" id="wn-save-btn" onclick="submitWriterNovel(false, ${isEditing ? `'${existing.id}'` : 'null'})">
          ${isEditing ? 'Save Changes' : 'Save Draft'}
        </button>
      </div>
    </div>

    <!-- Distraction-Free Form Canvas -->
    <div class="writer-card" style="max-width:760px; margin:0 auto; padding:32px;">
      <div id="wn-form-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:18px; font-weight:600;"></div>

      <form id="writer-novel-form" onsubmit="event.preventDefault(); submitWriterNovel(false, ${isEditing ? `'${existing.id}'` : 'null'});">
        <!-- 1. Novel Title (Required) -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-title">
            Novel Title <span style="color:#DC2626;">*</span>
          </label>
          <input type="text" id="wn-title" class="writer-form-input" 
                 value="${escapeHtml(existing?.title || '')}"
                 placeholder="e.g. நிலவே மலர்ந்திடு (Nilaave Malarnthidu)" required autofocus
                 style="font-size:16px; font-weight:600; padding:12px 14px;"
                 oninput="handleNovelFormChange()">
          <div class="writer-form-hint">Slug will be generated automatically in the background.</div>
        </div>

        <!-- 2. Category / Genre -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-genre">
            Category / Genre
          </label>
          <select id="wn-genre" class="writer-form-select" onchange="handleNovelFormChange()">
            ${[
              'Family Romance',
              'Romance / Drama',
              'Thriller / Mystery',
              'Social Drama',
              'Historical Fiction',
              'Poetry / Literary'
            ].map(g => `
              <option value="${g}" ${(existing?.genre || 'Family Romance') === g ? 'selected' : ''}>${g}</option>
            `).join('')}
          </select>
        </div>

        <!-- 3. Cover Image (URL + Upload Picker) -->
        <div class="writer-form-group">
          <label class="writer-form-label">Cover Image</label>
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:50px; height:70px; border-radius:6px; border:1px solid #CBD5E1; overflow:hidden; background:#F8FAFC; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              <img id="wn-cover-preview" src="${escapeHtml(existing?.cover || '/default-cover.jpg')}" alt="Cover preview" 
                   style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="flex:1;">
              <input type="text" id="wn-cover" class="writer-form-input" 
                     value="${escapeHtml(existing?.cover || '')}"
                     placeholder="https://... or upload below"
                     oninput="updateCoverPreview(this.value); handleNovelFormChange();">
            </div>
            <label class="btn btn-outline" style="cursor:pointer; padding:10px 14px; white-space:nowrap; margin:0;">
              ${ADMIN_ICONS.upload}
              <span>Upload</span>
              <input type="file" id="wn-cover-file" accept="image/*" style="display:none;" onchange="handleWriterCoverUpload(this)">
            </label>
          </div>
          <div class="writer-form-hint">Standard cover ratio 2:3 (e.g. 600x900px, max 5MB).</div>
        </div>

        <!-- 4. Description / Synopsis -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-description">
            Description / Synopsis
          </label>
          <textarea id="wn-description" class="writer-form-textarea" rows="5" 
                    placeholder="Enter an engaging synopsis for your novel..."
                    style="line-height:1.6;"
                    oninput="handleNovelFormChange()">${escapeHtml(existing?.description || '')}</textarea>
        </div>

        <!-- Primary Action -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #F1F5F9; padding-top:20px; margin-top:24px;">
          <button type="button" class="btn btn-outline" onclick="switchWriterTab('novels')">
            Cancel
          </button>
          
          <div style="display:flex; gap:10px;">
            <button type="submit" id="wn-bottom-save-btn" class="btn btn-gold" style="padding:10px 24px;">
              ${isEditing ? 'Save Changes' : 'Save Draft'}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

window.handleNovelFormChange = () => {
  writerState.editorDirty = true;
  const statusEl = document.getElementById('wn-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status unsaved';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
  }
};

window.updateCoverPreview = (url) => {
  const preview = document.getElementById('wn-cover-preview');
  if (preview) {
    preview.src = url || '/default-cover.jpg';
  }
};

window.handleWriterCoverUpload = async (fileInput) => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Cover image size must be under 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      showToast('Uploading cover image...');
      const res = await apiFetch('/api/comments/upload-image', {
        method: 'POST',
        body: JSON.stringify({ data: reader.result })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const coverInput = document.getElementById('wn-cover');
        if (coverInput) {
          coverInput.value = data.url;
          updateCoverPreview(data.url);
          handleNovelFormChange();
        }
        showToast('Cover image uploaded successfully! 🖼️');
      } else {
        showToast(data.error || 'Failed to upload cover image.');
      }
    } catch (e) {
      showToast('Error uploading image: ' + e.message);
    }
  };
  reader.readAsDataURL(file);
};

window.submitWriterNovel = async (publishNow = false, novelId = null) => {
  const title = document.getElementById('wn-title')?.value?.trim();
  const genre = document.getElementById('wn-genre')?.value?.trim() || 'Novel';
  const cover = document.getElementById('wn-cover')?.value?.trim() || '/default-cover.jpg';
  const description = document.getElementById('wn-description')?.value?.trim() || '';
  const errorEl = document.getElementById('wn-form-error');
  const saveBtn = document.getElementById('wn-save-btn');
  const bottomSaveBtn = document.getElementById('wn-bottom-save-btn');
  const statusEl = document.getElementById('wn-save-status');

  if (errorEl) errorEl.style.display = 'none';

  if (!title) {
    if (errorEl) {
      errorEl.textContent = 'Novel title is required.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saving…</span>`;
  }
  if (saveBtn) saveBtn.disabled = true;
  if (bottomSaveBtn) bottomSaveBtn.disabled = true;

  try {
    const url = novelId ? `/api/writer/novels/${novelId}` : '/api/writer/novels';
    const method = novelId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        title,
        genre,
        cover,
        description,
        visibility: 'draft'
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to save novel.';
        errorEl.style.display = 'block';
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status unsaved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Failed to save</span>`;
      }
      return;
    }

    writerState.editorDirty = false;
    if (statusEl) {
      statusEl.className = 'writer-save-status saved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
    }

    showToast(novelId ? 'Novel updated successfully!' : 'Novel draft created successfully!');
    switchWriterTab('novels');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error communicating with server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (bottomSaveBtn) bottomSaveBtn.disabled = false;
  }
};

window.previewWriterNovel = () => {
  const title = document.getElementById('wn-title')?.value || 'Untitled Novel';
  const genre = document.getElementById('wn-genre')?.value || 'Novel';
  const cover = document.getElementById('wn-cover')?.value || '/default-cover.jpg';
  const description = document.getElementById('wn-description')?.value || 'No description provided.';
  const authorName = writerState.user?.name || writerState.user?.username || 'Writer';

  openReaderPreviewModal({
    novelTitle: title,
    episodeTitle: 'Synopsis & Book Details',
    authorName,
    cover,
    genre,
    content: `<p style="font-size:18px; line-height:1.8; color:#1E293B;">${escapeHtml(description)}</p>`,
    isDraft: true
  });
};

/* ========================================================
   5. MANAGE EPISODES TAB
   ======================================================== */
async function renderWriterEpisodes(canvas, preselectedNovelId = null) {
  if (preselectedNovelId) {
    writerState.selectedNovelId = preselectedNovelId;
  } else if (!writerState.selectedNovelId && writerState.novels.length > 0) {
    writerState.selectedNovelId = writerState.novels[0].id;
  }

  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Manage Episodes</h1>
        <p class="writer-header-sub">Select a novel to organize chapters and launch the writing editor.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold" onclick="openNewEpisodeForCurrentNovel()" id="btn-add-episode">
          ${ADMIN_ICONS.edit}
          <span>+ Add Episode</span>
        </button>
      </div>
    </div>

    <!-- Novel Selector Dropdown -->
    <div class="writer-card" style="padding:16px 20px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
        <label for="writer-novel-picker" style="font-weight:600; color:#0B1F33; font-size:13.5px; white-space:nowrap;">
          Select Novel:
        </label>
        <select id="writer-novel-picker" class="writer-form-select" style="max-width:380px; padding:8px 12px;" onchange="handleWriterNovelSelect(this.value)">
          ${writerState.novels.map(n => `
            <option value="${n.id}" ${n.id === writerState.selectedNovelId ? 'selected' : ''}>
              ${escapeHtml(n.title)} (${n.chapters_count || n.chaptersCount || 0} episodes)
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    <div id="writer-episodes-table-card">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading episodes...
      </div>
    </div>
  `;

  if (writerState.novels.length === 0) {
    const card = document.getElementById('writer-episodes-table-card');
    if (card) {
      card.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📖</div>
            <h3 class="writer-empty-title">No novels available</h3>
            <p class="writer-empty-desc">Create a novel first before adding episodes.</p>
            <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">+ Write Novel</button>
          </div>
        </div>
      `;
    }
    return;
  }

  loadEpisodesForWriterNovel(writerState.selectedNovelId);
}

window.handleWriterNovelSelect = (novelId) => {
  writerState.selectedNovelId = novelId;
  loadEpisodesForWriterNovel(novelId);
};

async function loadEpisodesForWriterNovel(novelId) {
  const container = document.getElementById('writer-episodes-table-card');
  if (!container) return;

  try {
    const res = await apiFetch(`/api/writer/episodes?novelId=${encodeURIComponent(novelId)}`);
    const data = await res.json();
    writerState.episodes = data.episodes || [];

    if (writerState.episodes.length === 0) {
      container.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📝</div>
            <h3 class="writer-empty-title">No episodes written yet</h3>
            <p class="writer-empty-desc">Start writing Episode 1 for this novel.</p>
            <button type="button" class="btn btn-gold" onclick="openNewEpisodeForCurrentNovel()">+ Write Episode 1</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="writer-card" style="padding:0; overflow:hidden;">
        <div class="writer-table-wrap" style="border:none;">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:70px;">Episode</th>
                <th>Episode Title</th>
                <th style="text-align:center;">Words</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.episodes.map(ep => `
                <tr>
                  <td style="font-weight:700; color:#0B1F33;">
                    #${ep.episode_number || ep.chapter_num || '1'}
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33;">${escapeHtml(ep.title || `Episode ${ep.episode_number || ep.chapter_num}`)}</div>
                  </td>
                  <td style="text-align:center; color:#64748B;">
                    ${(ep.word_count || ep.wordCount || 0).toLocaleString()}
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${ep.status === 'published' ? 'published' : (ep.status === 'submitted' ? 'review' : 'draft')}">
                      ${ep.status === 'published' ? 'Published' : (ep.status === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      <button type="button" class="btn btn-gold" style="font-size:12.5px; padding:5px 12px;" 
                              onclick="switchWriterTab('editor', { episodeId: '${ep.id}', novelId: '${novelId}' })">
                        Edit
                      </button>
                      <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px;" 
                              onclick="previewWriterEpisodeFromList('${ep.id}')" title="Preview Episode">
                        ${ADMIN_ICONS.eye}
                      </button>
                      ${ep.status !== 'published' ? `
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px; color:#DC2626; border-color:#FCA5A5;" 
                                onclick="deleteWriterEpisode('${ep.id}')" title="Delete Draft Episode">
                          ${ADMIN_ICONS.trash}
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="writer-card" style="padding:24px; text-align:center; color:#DC2626;">Failed to load episodes: ${escapeHtml(err.message)}</div>`;
  }
}

window.openNewEpisodeForCurrentNovel = () => {
  const novelId = writerState.selectedNovelId;
  if (!novelId) {
    showToast('Please select or create a novel first.');
    return;
  }
  switchWriterTab('editor', { episodeId: null, novelId });
};

window.deleteWriterEpisode = async (episodeId) => {
  if (!confirm('Are you sure you want to delete this draft episode?')) return;

  try {
    const res = await apiFetch(`/api/writer/episodes/${episodeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Episode deleted successfully.');
      loadEpisodesForWriterNovel(writerState.selectedNovelId);
    } else {
      showToast(data.error || 'Failed to delete episode.');
    }
  } catch (e) {
    showToast('Error: ' + e.message);
  }
};

window.previewWriterEpisodeFromList = (episodeId) => {
  const ep = writerState.episodes.find(e => String(e.id) === String(episodeId));
  const novel = writerState.novels.find(n => n.id === writerState.selectedNovelId);
  if (!ep) return;

  openReaderPreviewModal({
    novelTitle: novel?.title || 'Story',
    episodeTitle: ep.title || `Episode #${ep.episode_number || ep.chapter_num}`,
    authorName: writerState.user?.name || writerState.user?.username || 'Writer',
    cover: novel?.cover || '/default-cover.jpg',
    genre: novel?.genre || 'Novel',
    content: ep.content || '<p>No content in this episode.</p>',
    isDraft: ep.status !== 'published'
  });
};

/* ========================================================
   6. PROFESSIONAL NOVEL WRITING PAGE / RICH-TEXT EDITOR
   ======================================================== */
async function renderWriterEditor(canvas, episodeId = null, novelId = null) {
  const currentNovelId = novelId || writerState.selectedNovelId;
  const currentNovel = writerState.novels.find(n => n.id === currentNovelId) || writerState.novels[0];

  let ep = null;
  if (episodeId) {
    try {
      const res = await apiFetch(`/api/writer/episodes/${episodeId}`);
      const data = await res.json();
      ep = data.episode;
    } catch (e) {
      console.warn('Episode fetch error:', e);
    }
  }

  const isEditing = Boolean(ep);
  const nextNum = ep ? (ep.episode_number || ep.chapter_num || '1') : String((writerState.episodes?.length || 0) + 1);
  writerState.currentEpisode = ep;
  writerState.editorDirty = false;

  canvas.innerHTML = `
    <!-- Distraction-free Writing Workspace Header -->
    <div class="writer-header-bar">
      <div>
        <a href="#writer?tab=episodes" onclick="switchWriterTab('episodes', { novelId: '${currentNovelId}' })" 
           class="btn btn-outline" style="padding:4px 10px; font-size:12px; margin-bottom:8px; display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.backArrow}
          <span>Back to Episodes</span>
        </a>
        <h1 class="writer-header-title" id="we-page-title">
          ${isEditing ? `Episode #${nextNum} — ${escapeHtml(ep?.title || '')}` : `New Episode — ${escapeHtml(currentNovel?.title || 'Story')}`}
        </h1>
      </div>

      <div class="writer-header-actions">
        <!-- Live Save Status Indicator -->
        <div id="we-save-status" class="writer-save-status saved">
          <span class="writer-save-dot"></span>
          <span>${isEditing ? 'Saved' : 'Draft'}</span>
        </div>

        <button type="button" class="btn btn-outline" onclick="previewWriterEditorContent()">
          ${ADMIN_ICONS.eye}
          <span>Preview</span>
        </button>

        <button type="button" class="btn btn-outline" id="we-save-draft-btn" 
                onclick="saveWriterEpisode('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'}, 'draft')">
          Save Draft
        </button>

        <button type="button" class="btn btn-gold" id="we-submit-review-btn" 
                onclick="saveWriterEpisode('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'}, 'submitted')">
          Submit for Review
        </button>
      </div>
    </div>

    <!-- Episode Details Row -->
    <div class="writer-card" style="padding:18px 24px; margin-bottom:16px;">
      <div id="we-editor-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:14px; font-weight:600;"></div>

      <div style="display:grid; grid-template-columns: 140px 1fr; gap:16px; align-items:center;">
        <div>
          <label class="writer-form-label" for="we-number">Episode #</label>
          <input type="text" id="we-number" class="writer-form-input" value="${escapeHtml(nextNum)}" 
                 placeholder="e.g. 1 or 1.1" required style="font-weight:700; text-align:center;"
                 oninput="handleEditorInputChange()">
        </div>

        <div>
          <label class="writer-form-label" for="we-title">Episode Title</label>
          <input type="text" id="we-title" class="writer-form-input" 
                 value="${escapeHtml(ep?.title || '')}" 
                 placeholder="e.g. Episode ${nextNum}: The Awakening"
                 oninput="handleEditorInputChange()">
        </div>
      </div>
    </div>

    <!-- Focused Writing Canvas with Compact Toolbar -->
    <div class="writer-editor-container">
      <!-- Formatting Toolbar -->
      <div class="writer-toolbar" role="toolbar" aria-label="Text Formatting">
        <!-- Style Select -->
        <select class="writer-toolbar-btn" style="padding:4px 8px; font-size:12.5px; border:1px solid #CBD5E1; background:#fff;" 
                onchange="formatStory('formatBlock', this.value); this.value='p';">
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>

        <div class="writer-toolbar-divider"></div>

        <!-- Inline Formats -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('bold')" title="Bold (Ctrl+B)">
          <strong>B</strong>
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('italic')" title="Italic (Ctrl+I)">
          <em>I</em>
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('underline')" title="Underline (Ctrl+U)">
          <u>U</u>
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Text Alignment -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyLeft')" title="Align Left">
          ⇤
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyCenter')" title="Center">
          ⇋
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyRight')" title="Align Right">
          ⇥
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyFull')" title="Justify">
          ☰
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Lists -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('insertUnorderedList')" title="Bulleted List">
          • List
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('insertOrderedList')" title="Numbered List">
          1. List
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Insert -->
        <button type="button" class="writer-toolbar-btn" onclick="insertStoryLink()" title="Insert Link">
          🔗 Link
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="insertStoryImage()" title="Insert Image">
          🖼️ Image
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- History & Clean -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('undo')" title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('redo')" title="Redo (Ctrl+Y)">
          ↪
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('removeFormat')" title="Clear Formatting">
          ✕ Clear
        </button>
      </div>

      <!-- Comfortable Contenteditable Story Canvas -->
      <div id="we-canvas" class="writer-writing-area" contenteditable="true" 
           spellcheck="true"
           oninput="handleStoryInput()"
           placeholder="Write your story here...">${ep?.content || '<p>Write your novel chapter here...</p>'}</div>

      <!-- Live Counters & Status Bar -->
      <div class="writer-editor-footer">
        <div id="we-word-counter">Words: 0 | Characters: 0</div>
        <div style="font-size:12px; color:#64748B;">Autosave enabled</div>
      </div>
    </div>
  `;

  setTimeout(() => {
    handleStoryInput(false);
  }, 100);
}

window.handleEditorInputChange = () => {
  writerState.editorDirty = true;
  const statusEl = document.getElementById('we-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status unsaved';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
  }
};

window.formatStory = (cmd, val = null) => {
  document.execCommand(cmd, false, val);
  const canvas = document.getElementById('we-canvas');
  if (canvas) canvas.focus();
  handleStoryInput();
};

window.insertStoryLink = () => {
  const url = prompt('Enter link URL:');
  if (url) formatStory('createLink', url);
};

window.insertStoryImage = () => {
  const url = prompt('Enter image URL:');
  if (url) formatStory('insertImage', url);
};

window.handleStoryInput = (markDirty = true) => {
  const canvas = document.getElementById('we-canvas');
  const counter = document.getElementById('we-word-counter');
  if (!canvas || !counter) return;

  const text = canvas.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  counter.textContent = `Words: ${words.toLocaleString()} | Characters: ${chars.toLocaleString()}`;

  if (markDirty) {
    writerState.editorDirty = true;
    const statusEl = document.getElementById('we-save-status');
    if (statusEl) {
      statusEl.className = 'writer-save-status unsaved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
    }

    // Debounced autosave after 4 seconds of inactivity
    if (writerState.autosaveTimer) clearTimeout(writerState.autosaveTimer);
    writerState.autosaveTimer = setTimeout(() => {
      autosaveDraftSilently();
    }, 4000);
  }
};

async function autosaveDraftSilently() {
  if (!writerState.editorDirty) return;
  const canvas = document.getElementById('we-canvas');
  const num = document.getElementById('we-number')?.value?.trim();
  const title = document.getElementById('we-title')?.value?.trim();
  const currentNovelId = writerState.selectedNovelId;
  const ep = writerState.currentEpisode;

  if (!canvas || !num || !currentNovelId) return;

  const statusEl = document.getElementById('we-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Autosaving…</span>`;
  }

  try {
    const url = ep ? `/api/writer/episodes/${ep.id}` : '/api/writer/episodes';
    const method = ep ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        novelId: currentNovelId,
        episodeNumber: num,
        title: title || `Episode ${num}`,
        content: canvas.innerHTML,
        status: 'draft'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      writerState.editorDirty = false;
      if (!ep && data.episode) {
        writerState.currentEpisode = data.episode;
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status saved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
      }
    }
  } catch (e) {
    console.warn('Autosave error:', e);
  }
}

window.saveWriterEpisode = async (novelId, episodeId, targetStatus = 'draft') => {
  const num = document.getElementById('we-number')?.value?.trim();
  const title = document.getElementById('we-title')?.value?.trim() || `Episode ${num}`;
  const canvas = document.getElementById('we-canvas');
  const content = canvas ? canvas.innerHTML : '';
  const errorEl = document.getElementById('we-editor-error');
  const draftBtn = document.getElementById('we-save-draft-btn');
  const reviewBtn = document.getElementById('we-submit-review-btn');
  const statusEl = document.getElementById('we-save-status');

  if (errorEl) errorEl.style.display = 'none';

  if (!num) {
    if (errorEl) {
      errorEl.textContent = 'Episode number is required.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (draftBtn) draftBtn.disabled = true;
  if (reviewBtn) reviewBtn.disabled = true;
  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saving…</span>`;
  }

  try {
    const url = episodeId ? `/api/writer/episodes/${episodeId}` : '/api/writer/episodes';
    const method = episodeId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        novelId,
        episodeNumber: num,
        title,
        content,
        status: targetStatus
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to save episode.';
        errorEl.style.display = 'block';
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status unsaved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Failed</span>`;
      }
      return;
    }

    writerState.editorDirty = false;
    if (statusEl) {
      statusEl.className = 'writer-save-status saved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
    }

    if (targetStatus === 'submitted') {
      showToast('Episode submitted for Admin Review! 📩');
    } else {
      showToast('Episode draft saved successfully! 💾');
    }

    switchWriterTab('episodes', { novelId });
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error communicating with server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (draftBtn) draftBtn.disabled = false;
    if (reviewBtn) reviewBtn.disabled = false;
  }
};

window.previewWriterEditorContent = () => {
  const currentNovel = writerState.novels.find(n => n.id === writerState.selectedNovelId);
  const num = document.getElementById('we-number')?.value || '1';
  const title = document.getElementById('we-title')?.value || `Episode ${num}`;
  const canvas = document.getElementById('we-canvas');
  const content = canvas ? canvas.innerHTML : '<p>No content written yet.</p>';
  const authorName = writerState.user?.name || writerState.user?.username || 'Writer';

  openReaderPreviewModal({
    novelTitle: currentNovel?.title || 'Novel Story',
    episodeTitle: title,
    authorName,
    cover: currentNovel?.cover || '/default-cover.jpg',
    genre: currentNovel?.genre || 'Novel',
    content,
    isDraft: writerState.editorDirty || true
  });
};

/* ========================================================
   7. READER PREVIEW MODAL
   ======================================================== */
function openReaderPreviewModal({ novelTitle, episodeTitle, authorName, cover, genre, content, isDraft }) {
  // Remove existing modal if open
  const existing = document.getElementById('writer-reader-preview-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'writer-reader-preview-overlay';
  overlay.className = 'writer-preview-overlay';
  overlay.innerHTML = `
    <div class="writer-preview-modal" role="dialog" aria-modal="true" aria-labelledby="wpreview-title">
      <!-- Preview Notice Bar -->
      <div class="writer-preview-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">📖</span>
          <span style="font-weight:600; font-size:13.5px;">Reader Preview Mode ${isDraft ? '— (Draft Content)' : ''}</span>
        </div>
        <button type="button" class="btn btn-outline" style="color:#FFFFFF; border-color:rgba(255,255,255,0.25); padding:3px 10px; font-size:12px;" onclick="closeReaderPreviewModal()">
          ✕ Close Preview
        </button>
      </div>

      <!-- Reader Simulation Canvas -->
      <div class="writer-preview-body">
        <div style="text-align:center; margin-bottom:32px; border-bottom:1px solid #E2E8F0; padding-bottom:24px;">
          <div style="font-size:13px; font-weight:700; color:#B88635; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
            ${escapeHtml(genre || 'Novel')}
          </div>
          <h2 id="wpreview-title" style="font-family:'Playfair Display',Georgia,serif; font-size:26px; color:#0B1F33; margin:0 0 6px;">
            ${escapeHtml(novelTitle)}
          </h2>
          <h3 style="font-size:16px; font-weight:600; color:#64748B; margin:0 0 10px;">
            ${escapeHtml(episodeTitle)}
          </h3>
          <div style="font-size:12.5px; color:#94A3B8;">
            By ${escapeHtml(authorName)}
          </div>
        </div>

        <!-- Rendered Story Content -->
        <article class="reader-formatted-content" style="max-width:680px; margin:0 auto; font-family:'Lora','Georgia','Noto Sans Tamil',serif; font-size:17.5px; line-height:1.9; color:#1E293B;">
          ${content}
        </article>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

window.closeReaderPreviewModal = () => {
  const overlay = document.getElementById('writer-reader-preview-overlay');
  if (overlay) overlay.remove();
};

/* ========================================================
   8. PUBLISHING STATUS TAB
   ======================================================== */
async function renderWriterStatus(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Publishing Status & Guidelines</h1>
        <p class="writer-header-sub">Understand the review and publishing workflow for writer episodes.</p>
      </div>
    </div>

    <div class="writer-card">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:18px;">
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#B45309; font-size:15px; margin-bottom:8px;">1. Writer Draft</div>
          <p style="font-size:13px; color:#78350F; line-height:1.6; margin:0;">
            Created exclusively by you. Revise, edit, and preview anytime. Entirely private and hidden from public readers.
          </p>
        </div>

        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#1D4ED8; font-size:15px; margin-bottom:8px;">2. Submitted for Review</div>
          <p style="font-size:13px; color:#1E40AF; line-height:1.6; margin:0;">
            When your episode is ready, click "Submit for Review". The administrator reviews and approves for public release.
          </p>
        </div>

        <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#15803D; font-size:15px; margin-bottom:8px;">3. Published & Live</div>
          <p style="font-size:13px; color:#166534; line-height:1.6; margin:0;">
            Once approved, the episode becomes live in the novel library for readers with full comment and rating features.
          </p>
        </div>
      </div>
    </div>
  `;
}

/* ========================================================
   9. WRITER PROFILE & PASSWORD TAB
   ======================================================== */
async function renderWriterProfile(canvas) {
  const user = writerState.user || {};

  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Profile & Password</h1>
        <p class="writer-header-sub">Manage your writer identity and update your password.</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
      <!-- Writer Identity Card -->
      <div class="writer-card">
        <h2 class="writer-card-title" style="margin-bottom:18px;">Writer Details</h2>

        <div class="writer-form-group">
          <label class="writer-form-label">Display Name</label>
          <input type="text" class="writer-form-input" value="${escapeHtml(user.name || user.username)}" disabled 
                 style="background:#F8FAFC; color:#64748B;">
          <div class="writer-form-hint">Display name registered by administration.</div>
        </div>

        <div class="writer-form-group">
          <label class="writer-form-label">Email Address</label>
          <input type="email" class="writer-form-input" value="${escapeHtml(user.email || '')}" disabled 
                 style="background:#F8FAFC; color:#64748B; font-family:monospace;">
          <div class="writer-form-hint">Your verified login email.</div>
        </div>

        <div class="writer-form-group" style="margin-bottom:0;">
          <label class="writer-form-label">Account Status</label>
          <span class="writer-badge published">✓ Active Writer</span>
        </div>
      </div>

      <!-- Change Password Card -->
      <div class="writer-card">
        <h2 class="writer-card-title" style="margin-bottom:18px;">Change Password</h2>

        <div id="wp-pass-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <form onsubmit="event.preventDefault(); submitWriterPasswordChange();">
          <div class="writer-form-group">
            <label class="writer-form-label" for="wp-new-pass">
              New Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="wp-new-pass" class="writer-form-input" placeholder="Min 6 characters" required minlength="6">
          </div>

          <div class="writer-form-group">
            <label class="writer-form-label" for="wp-confirm-pass">
              Confirm New Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="wp-confirm-pass" class="writer-form-input" placeholder="Re-enter new password" required minlength="6">
          </div>

          <button type="submit" id="wp-pass-btn" class="btn btn-gold" style="width:100%; padding:11px; font-weight:600;">
            Update Password
          </button>
        </form>
      </div>
    </div>
  `;
}

window.submitWriterPasswordChange = async () => {
  const newPass = document.getElementById('wp-new-pass')?.value;
  const confirmPass = document.getElementById('wp-confirm-pass')?.value;
  const errorEl = document.getElementById('wp-pass-error');
  const btn = document.getElementById('wp-pass-btn');

  if (errorEl) errorEl.style.display = 'none';

  if (!newPass || newPass.length < 6) {
    if (errorEl) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (newPass !== confirmPass) {
    if (errorEl) {
      errorEl.textContent = 'New passwords do not match.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
  }

  try {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ newPassword: newPass })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to update password.';
        errorEl.style.display = 'block';
      }
      return;
    }

    showToast('Password updated successfully! 🔒');
    const p1 = document.getElementById('wp-new-pass');
    const p2 = document.getElementById('wp-confirm-pass');
    if (p1) p1.value = '';
    if (p2) p2.value = '';
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error updating password.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
};
