import fs from 'node:fs';

const adminFormsContentCode = `
// ============================================================================
// FORMS & CONTENT MANAGEMENT (3-LEVEL HIERARCHY & FINE-GRAINED ACCESS CONTROL)
// Main Title -> Sub Title -> Content Title -> Reading Content
// ============================================================================

window.formsAdminState = {
  activeSubTab: 'main', // 'main' | 'subs' | 'articles' | 'access'
  mainCategories: [],
  subcategories: [],
  articles: [],
  accessRules: [],
  members: [],
  novels: [],
  selectedMainFilter: 'all',
  selectedSubFilter: 'all',
  searchQuery: '',
  isLoading: false
};

export async function renderForumManagementTab(canvas) {
  canvas.innerHTML = \`
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
      <div>
        <h1 style="font-family:'Playfair Display',serif; font-size:1.85rem; color:#0B1F33; margin:0 0 6px;">
          Forms &amp; Content Management
        </h1>
        <p style="color:#64748B; font-size:13.5px; margin:0; line-height:1.5;">
          Manage the 3-level content hierarchy (<strong>Main Title → Sub Title → Content Title → Reading Content</strong>), novel integration, and granular member access controls.
        </p>
      </div>

      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <a href="#forms" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
          \${ADMIN_ICONS.externalLink} View Live Forms
        </a>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.openCreateMainModal()">
          \${ADMIN_ICONS.plus} New Main Title
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="window.openCreateSubModal()">
          \${ADMIN_ICONS.plus} New Sub Title
        </button>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.openCreateArticleModal()">
          \${ADMIN_ICONS.plus} New Content Article
        </button>
      </div>
    </div>

    <!-- Hierarchy Sub-tab Navigation -->
    <div style="display:flex; gap:8px; border-bottom:2px solid #E2E8F0; margin-bottom:24px; overflow-x:auto;">
      <button type="button" id="tab-btn-main" 
              onclick="window.switchFormsAdminTab('main')"
              style="padding:10px 18px; font-weight:700; font-size:13.5px; background:none; border:none; border-bottom:3px solid \${window.formsAdminState.activeSubTab === 'main' ? '#B88635' : 'transparent'}; color:\${window.formsAdminState.activeSubTab === 'main' ? '#0B1F33' : '#64748B'}; cursor:pointer; white-space:nowrap;">
        📂 Main Titles (<span id="count-main">0</span>)
      </button>
      <button type="button" id="tab-btn-subs" 
              onclick="window.switchFormsAdminTab('subs')"
              style="padding:10px 18px; font-weight:700; font-size:13.5px; background:none; border:none; border-bottom:3px solid \${window.formsAdminState.activeSubTab === 'subs' ? '#B88635' : 'transparent'}; color:\${window.formsAdminState.activeSubTab === 'subs' ? '#0B1F33' : '#64748B'}; cursor:pointer; white-space:nowrap;">
        📑 Sub Titles (<span id="count-subs">0</span>)
      </button>
      <button type="button" id="tab-btn-articles" 
              onclick="window.switchFormsAdminTab('articles')"
              style="padding:10px 18px; font-weight:700; font-size:13.5px; background:none; border:none; border-bottom:3px solid \${window.formsAdminState.activeSubTab === 'articles' ? '#B88635' : 'transparent'}; color:\${window.formsAdminState.activeSubTab === 'articles' ? '#0B1F33' : '#64748B'}; cursor:pointer; white-space:nowrap;">
        📝 Content Titles &amp; Articles (<span id="count-articles">0</span>)
      </button>
      <button type="button" id="tab-btn-access" 
              onclick="window.switchFormsAdminTab('access')"
              style="padding:10px 18px; font-weight:700; font-size:13.5px; background:none; border:none; border-bottom:3px solid \${window.formsAdminState.activeSubTab === 'access' ? '#B88635' : 'transparent'}; color:\${window.formsAdminState.activeSubTab === 'access' ? '#0B1F33' : '#64748B'}; cursor:pointer; white-space:nowrap;">
        🛡️ Member Access Controls (<span id="count-access">0</span>)
      </button>
    </div>

    <!-- Sub-tab Content Canvas -->
    <div id="forms-admin-content-canvas">
      <div style="text-align:center; padding:50px 20px; color:#64748B;">
        <div style="width:34px; height:34px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading Forms &amp; Content Management system...</div>
      </div>
    </div>

    <!-- Modals Container -->
    <div id="forms-admin-modal-container"></div>
  \`;

  await window.loadFormsAdminData();
}

window.switchFormsAdminTab = (subTab) => {
  window.formsAdminState.activeSubTab = subTab;
  ['main', 'subs', 'articles', 'access'].forEach(t => {
    const btn = document.getElementById(\`tab-btn-\${t}\`);
    if (btn) {
      btn.style.borderBottomColor = (t === subTab) ? '#B88635' : 'transparent';
      btn.style.color = (t === subTab) ? '#0B1F33' : '#64748B';
    }
  });

  if (subTab === 'main') window.renderFormsAdminMainView();
  else if (subTab === 'subs') window.renderFormsAdminSubsView();
  else if (subTab === 'articles') window.renderFormsAdminArticlesView();
  else if (subTab === 'access') window.renderFormsAdminAccessView();
};

window.loadFormsAdminData = async () => {
  try {
    const [mainRes, subRes, artRes, accRes, memRes, novRes] = await Promise.all([
      apiFetch('/api/admin/content/main-categories'),
      apiFetch('/api/admin/content/subcategories'),
      apiFetch('/api/admin/content/articles'),
      apiFetch('/api/admin/content/access-rules'),
      apiFetch('/api/admin/members?limit=250'),
      apiFetch('/api/admin/novels')
    ]);

    if (mainRes.ok) {
      const data = await mainRes.json();
      window.formsAdminState.mainCategories = data.categories || [];
    }
    if (subRes.ok) {
      const data = await subRes.json();
      window.formsAdminState.subcategories = data.subcategories || [];
    }
    if (artRes.ok) {
      const data = await artRes.json();
      window.formsAdminState.articles = data.articles || [];
    }
    if (accRes.ok) {
      const data = await accRes.json();
      window.formsAdminState.accessRules = data.rules || [];
    }
    if (memRes.ok) {
      const data = await memRes.json();
      window.formsAdminState.members = data.members || [];
    }
    if (novRes.ok) {
      const data = await novRes.json();
      window.formsAdminState.novels = data.novels || [];
    }

    // Update counter badges
    const mCount = document.getElementById('count-main');
    const sCount = document.getElementById('count-subs');
    const aCount = document.getElementById('count-articles');
    const accCount = document.getElementById('count-access');
    const sidebarCount = document.getElementById('nav-forum-count');

    if (mCount) mCount.textContent = window.formsAdminState.mainCategories.length;
    if (sCount) sCount.textContent = window.formsAdminState.subcategories.length;
    if (aCount) aCount.textContent = window.formsAdminState.articles.length;
    if (accCount) accCount.textContent = window.formsAdminState.accessRules.length;
    if (sidebarCount) sidebarCount.textContent = window.formsAdminState.mainCategories.length;

    // Render current active subtab
    window.switchFormsAdminTab(window.formsAdminState.activeSubTab);
  } catch (err) {
    console.error('Error loading forms admin data:', err);
    const canvas = document.getElementById('forms-admin-content-canvas');
    if (canvas) {
      canvas.innerHTML = \`
        <div style="background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:20px; border-radius:10px; text-align:center;">
          <strong>Error loading data:</strong> \${escapeHtml(err.message)}
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.loadFormsAdminData()">Retry</button>
          </div>
        </div>
      \`;
    }
  }
};

// ============================================================================
// 1. MAIN TITLES VIEW
// ============================================================================
window.renderFormsAdminMainView = () => {
  const canvas = document.getElementById('forms-admin-content-canvas');
  if (!canvas) return;

  const categories = window.formsAdminState.mainCategories || [];

  canvas.innerHTML = \`
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:'Playfair Display',serif; font-size:1.25rem; color:#0B1F33; margin:0 0 4px;">
            Main Categories &amp; Titles (\${categories.length})
          </h2>
          <span style="font-size:12.5px; color:#64748B;">
            Root titles displayed on the Forms page (e.g. General, Ongoing Novels, Completed Novels, Audio Novels).
          </span>
        </div>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.openCreateMainModal()">
          \${ADMIN_ICONS.plus} Add Main Title
        </button>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:720px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:2px solid #E2E8F0; text-align:left;">
              <th style="padding:12px 14px; width:70px;">Order</th>
              <th style="padding:12px 14px;">Main Title</th>
              <th style="padding:12px 14px;">Icon &amp; Accent</th>
              <th style="padding:12px 14px;">Description</th>
              <th style="padding:12px 14px; text-align:center;">Sub Titles</th>
              <th style="padding:12px 14px; text-align:center;">Status</th>
              <th style="padding:12px 14px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${categories.map(cat => {
              const subsCount = (window.formsAdminState.subcategories || []).filter(s => String(s.main_category_id) === String(cat.id)).length;
              const isDis = cat.is_disabled || cat.status === 'disabled';
              return \`
                <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                  <td style="padding:12px 14px;">
                    <span style="background:#F1F5F9; padding:3px 8px; border-radius:6px; font-weight:700; font-size:12px;">#\${cat.sort_order || 0}</span>
                  </td>
                  <td style="padding:12px 14px;">
                    <div style="font-weight:700; color:#0B1F33; font-size:14px;">\${escapeHtml(cat.title)}</div>
                    <div style="font-size:11px; color:#64748B; font-family:monospace;">ID: \${escapeHtml(cat.id)}</div>
                  </td>
                  <td style="padding:12px 14px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="display:inline-block; width:22px; height:22px; border-radius:4px; background:\${escapeHtml(cat.accent_color || '#2E1065')}; border:1px solid #CBD5E1;"></span>
                      <span style="font-size:16px;">\${cat.icon || '💬'}</span>
                      <span style="font-size:11px; color:#64748B; font-family:monospace;">\${escapeHtml(cat.accent_color || '#2E1065')}</span>
                    </div>
                  </td>
                  <td style="padding:12px 14px; color:#475569; font-size:12px; max-width:220px;">
                    \${escapeHtml(cat.description || '-')}
                  </td>
                  <td style="padding:12px 14px; text-align:center;">
                    <button type="button" class="btn btn-outline btn-sm" style="font-size:11px; padding:2px 8px;" onclick="window.filterSubsByMain('\${escapeQuotes(cat.id)}')">
                      \${subsCount} sub titles »
                    </button>
                  </td>
                  <td style="padding:12px 14px; text-align:center;">
                    <button type="button" 
                            onclick="window.toggleMainCategoryStatus('\${escapeQuotes(cat.id)}', \${isDis ? 'true' : 'false'})"
                            style="border:none; cursor:pointer; background:none; padding:0;"
                            title="Click to toggle active / disabled state">
                      <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; \${!isDis ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEE2E2; color:#DC2626;'}">
                        <span style="width:6px; height:6px; border-radius:50%; background:\${!isDis ? '#16A34A' : '#DC2626'};"></span>
                        \${!isDis ? 'Published' : 'Disabled'}
                      </span>
                    </button>
                  </td>
                  <td style="padding:12px 14px; text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px;" onclick="window.openEditMainModal('\${escapeQuotes(cat.id)}')">
                        Edit
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#B88635; border-color:#E8DCCB;" onclick="window.openAccessRuleModal('main_category', '\${escapeQuotes(cat.id)}', '\${escapeQuotes(cat.title)}')">
                        🛡️ Access
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#DC2626; border-color:#FECACA;" onclick="window.deleteMainCategory('\${escapeQuotes(cat.id)}')">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  \`;
};

// ============================================================================
// 2. SUB TITLES VIEW
// ============================================================================
window.renderFormsAdminSubsView = () => {
  const canvas = document.getElementById('forms-admin-content-canvas');
  if (!canvas) return;

  const categories = window.formsAdminState.mainCategories || [];
  let subs = window.formsAdminState.subcategories || [];

  if (window.formsAdminState.selectedMainFilter && window.formsAdminState.selectedMainFilter !== 'all') {
    subs = subs.filter(s => String(s.main_category_id) === String(window.formsAdminState.selectedMainFilter));
  }

  canvas.innerHTML = \`
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:'Playfair Display',serif; font-size:1.25rem; color:#0B1F33; margin:0 0 4px;">
            Sub Titles &amp; Sections (\${subs.length})
          </h2>
          <span style="font-size:12.5px; color:#64748B;">
            Subcategories grouped under Main Titles (e.g. Welcome Notes, Announcements, Tea Time, or Specific Novels).
          </span>
        </div>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.openCreateSubModal()">
          \${ADMIN_ICONS.plus} Add Sub Title
        </button>
      </div>

      <!-- Filter by Main Category -->
      <div style="display:flex; gap:12px; margin-bottom:16px; align-items:center;">
        <label style="font-size:12.5px; font-weight:700; color:#0B1F33;">Filter by Main Title:</label>
        <select class="form-input" style="font-size:13px; max-width:280px;" onchange="window.filterSubsByMain(this.value)">
          <option value="all" \${window.formsAdminState.selectedMainFilter === 'all' ? 'selected' : ''}>All Main Titles</option>
          \${categories.map(c => \`
            <option value="\${escapeHtml(c.id)}" \${String(c.id) === String(window.formsAdminState.selectedMainFilter) ? 'selected' : ''}>
              \${escapeHtml(c.icon || '📂')} \${escapeHtml(c.title)}
            </option>
          \`).join('')}
        </select>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:760px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:2px solid #E2E8F0; text-align:left;">
              <th style="padding:12px 14px; width:60px;">Order</th>
              <th style="padding:12px 14px;">Sub Title</th>
              <th style="padding:12px 14px;">Parent Main Title</th>
              <th style="padding:12px 14px;">Linked Novel</th>
              <th style="padding:12px 14px; text-align:center;">Articles</th>
              <th style="padding:12px 14px; text-align:center;">Status</th>
              <th style="padding:12px 14px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${subs.length > 0 ? subs.map(sub => {
              const artCount = (window.formsAdminState.articles || []).filter(a => String(a.sub_category_id) === String(sub.id)).length;
              const isDis = sub.is_disabled || sub.status === 'disabled';
              return \`
                <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                  <td style="padding:12px 14px;">
                    <span style="background:#F1F5F9; padding:3px 8px; border-radius:6px; font-weight:700; font-size:12px;">#\${sub.sort_order || 0}</span>
                  </td>
                  <td style="padding:12px 14px;">
                    <div style="font-weight:700; color:#0B1F33; font-size:13.5px;">
                      \${escapeHtml(sub.icon || '📑')} \${escapeHtml(sub.title)}
                    </div>
                    \${sub.description ? \`<div style="font-size:11.5px; color:#64748B; margin-top:2px;">\${escapeHtml(sub.description)}</div>\` : ''}
                  </td>
                  <td style="padding:12px 14px;">
                    <span style="background:#FAF5EC; color:#B88635; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11.5px; border:1px solid #E8DCCB;">
                      \${escapeHtml(sub.main_category_title || sub.main_category_id)}
                    </span>
                  </td>
                  <td style="padding:12px 14px; color:#475569; font-size:12px;">
                    \${sub.novel_title ? \`<a href="#novel?id=\${encodeURIComponent(sub.novel_id)}" target="_blank" style="color:#1D4ED8; text-decoration:none; font-weight:600;">📖 \${escapeHtml(sub.novel_title)}</a>\` : '<span style="color:#94A3B8;">—</span>'}
                  </td>
                  <td style="padding:12px 14px; text-align:center;">
                    <button type="button" class="btn btn-outline btn-sm" style="font-size:11px; padding:2px 8px;" onclick="window.filterArticlesBySub('\${escapeQuotes(sub.id)}')">
                      \${artCount} articles »
                    </button>
                  </td>
                  <td style="padding:12px 14px; text-align:center;">
                    <button type="button" 
                            onclick="window.toggleSubCategoryStatus('\${escapeQuotes(sub.id)}', \${isDis ? 'true' : 'false'})"
                            style="border:none; cursor:pointer; background:none; padding:0;"
                            title="Click to toggle publish status">
                      <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; \${!isDis ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEE2E2; color:#DC2626;'}">
                        \${!isDis ? 'Active' : 'Disabled'}
                      </span>
                    </button>
                  </td>
                  <td style="padding:12px 14px; text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px;" onclick="window.openEditSubModal('\${escapeQuotes(sub.id)}')">
                        Edit
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#B88635; border-color:#E8DCCB;" onclick="window.openAccessRuleModal('subcategory', '\${escapeQuotes(sub.id)}', '\${escapeQuotes(sub.title)}')">
                        🛡️ Access
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#DC2626; border-color:#FECACA;" onclick="window.deleteSubCategory('\${escapeQuotes(sub.id)}')">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              \`;
            }).join('') : \`
              <tr>
                <td colspan="7" style="text-align:center; padding:30px; color:#64748B;">No sub titles found for this filter.</td>
              </tr>
            \`}
          </tbody>
        </table>
      </div>
    </div>
  \`;
};

window.filterSubsByMain = (mainId) => {
  window.formsAdminState.selectedMainFilter = mainId;
  window.formsAdminState.activeSubTab = 'subs';
  window.switchFormsAdminTab('subs');
};

// ============================================================================
// 3. CONTENT TITLES & ARTICLES VIEW
// ============================================================================
window.renderFormsAdminArticlesView = () => {
  const canvas = document.getElementById('forms-admin-content-canvas');
  if (!canvas) return;

  const categories = window.formsAdminState.mainCategories || [];
  const subcategories = window.formsAdminState.subcategories || [];
  let articles = window.formsAdminState.articles || [];

  // Filter by Sub
  if (window.formsAdminState.selectedSubFilter && window.formsAdminState.selectedSubFilter !== 'all') {
    articles = articles.filter(a => String(a.sub_category_id) === String(window.formsAdminState.selectedSubFilter));
  }

  // Filter by Search Query
  if (window.formsAdminState.searchQuery) {
    const q = window.formsAdminState.searchQuery.toLowerCase();
    articles = articles.filter(a => (a.title || '').toLowerCase().includes(q) || (a.author_name || '').toLowerCase().includes(q));
  }

  canvas.innerHTML = \`
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:'Playfair Display',serif; font-size:1.25rem; color:#0B1F33; margin:0 0 4px;">
            Content Titles &amp; Reading Articles (\${articles.length})
          </h2>
          <span style="font-size:12.5px; color:#64748B;">
            Each content title opens a dedicated full reading page with rich typography, author notes, and interactive comments.
          </span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.openCreateArticleModal()">
          \${ADMIN_ICONS.plus} New Content Article
        </button>
      </div>

      <!-- Filters Row -->
      <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
        <div style="flex:1; min-width:200px;">
          <input type="text" class="form-input" placeholder="Search by content title or author..." 
                 value="\${escapeHtml(window.formsAdminState.searchQuery)}"
                 oninput="window.handleArticleSearch(this.value)"
                 style="width:100%; box-sizing:border-box; font-size:13px;">
        </div>
        <div style="min-width:200px;">
          <select class="form-input" onchange="window.handleArticleSubFilter(this.value)" style="width:100%; box-sizing:border-box; font-size:13px;">
            <option value="all" \${window.formsAdminState.selectedSubFilter === 'all' ? 'selected' : ''}>All Sub Categories</option>
            \${subcategories.map(s => \`
              <option value="\${escapeHtml(s.id)}" \${String(s.id) === String(window.formsAdminState.selectedSubFilter) ? 'selected' : ''}>
                \${escapeHtml(s.main_category_title || '')} › \${escapeHtml(s.title)}
              </option>
            \`).join('')}
          </select>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:800px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:2px solid #E2E8F0; text-align:left;">
              <th style="padding:12px 14px;">Content Title</th>
              <th style="padding:12px 14px;">Hierarchy Path</th>
              <th style="padding:12px 14px;">Author</th>
              <th style="padding:12px 14px; text-align:center;">Engagement</th>
              <th style="padding:12px 14px; text-align:center;">Status</th>
              <th style="padding:12px 14px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${articles.length > 0 ? articles.map(art => {
              const isDis = art.is_disabled || art.status === 'disabled';
              const isPub = art.is_published && art.status === 'published';
              return \`
                <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                  <td style="padding:12px 14px; max-width:280px;">
                    <a href="#content?slug=\${encodeURIComponent(art.unique_slug || art.id)}" target="_blank" style="font-weight:700; color:#0B1F33; text-decoration:none; font-size:13.5px; display:block;">
                      \${escapeHtml(art.title)}
                    </a>
                    <div style="font-size:11px; color:#64748B; font-family:monospace; margin-top:2px;">
                      Slug: \${escapeHtml(art.unique_slug || art.id)}
                    </div>
                  </td>
                  <td style="padding:12px 14px;">
                    <div style="font-size:12px; font-weight:600; color:#334155;">
                      \${escapeHtml(art.main_category_title || '-')}
                    </div>
                    <div style="font-size:11.5px; color:#B88635;">
                      › \${escapeHtml(art.sub_category_title || '-')}
                    </div>
                  </td>
                  <td style="padding:12px 14px; color:#334155; font-size:12px;">
                    <div style="font-weight:600;">\${escapeHtml(art.author_name || 'Admin')}</div>
                    <div style="font-size:11px; color:#64748B;">\${formatAdminDateTime(art.published_at || art.created_at)}</div>
                  </td>
                  <td style="padding:12px 14px; text-align:center; font-size:12px; color:#64748B;">
                    <div>👁 \${art.views_count || 0} views</div>
                    <div>💬 \${art.comments_count || 0} comments</div>
                  </td>
                  <td style="padding:12px 14px; text-align:center;">
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; \${isDis ? 'background:#FEE2E2; color:#DC2626;' : (isPub ? 'background:#DCFCE7; color:#15803D;' : 'background:#FEF3C7; color:#92400E;')}">
                      \${isDis ? 'Disabled' : (isPub ? 'Published' : 'Draft / Unpub')}
                    </span>
                  </td>
                  <td style="padding:12px 14px; text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                      <a href="#content?slug=\${encodeURIComponent(art.unique_slug || art.id)}" target="_blank" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px;" title="Open Reading View">
                        Read
                      </a>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px;" onclick="window.openEditArticleModal('\${escapeQuotes(art.id)}')">
                        Edit
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#B88635; border-color:#E8DCCB;" onclick="window.openAccessRuleModal('article', '\${escapeQuotes(art.id)}', '\${escapeQuotes(art.title)}')">
                        🛡️ Access
                      </button>
                      <button type="button" class="btn btn-outline btn-sm" style="padding:3px 8px; font-size:11.5px; color:#DC2626; border-color:#FECACA;" onclick="window.deleteArticle('\${escapeQuotes(art.id)}')">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              \`;
            }).join('') : \`
              <tr>
                <td colspan="6" style="text-align:center; padding:35px; color:#64748B;">No articles found matching your criteria.</td>
              </tr>
            \`}
          </tbody>
        </table>
      </div>
    </div>
  \`;
};

window.handleArticleSearch = (q) => {
  window.formsAdminState.searchQuery = q;
  window.renderFormsAdminArticlesView();
};

window.handleArticleSubFilter = (subId) => {
  window.formsAdminState.selectedSubFilter = subId;
  window.renderFormsAdminArticlesView();
};

window.filterArticlesBySub = (subId) => {
  window.formsAdminState.selectedSubFilter = subId;
  window.formsAdminState.activeSubTab = 'articles';
  window.switchFormsAdminTab('articles');
};

// ============================================================================
// 4. ACCESS CONTROL & MEMBER RESTRICTIONS VIEW
// ============================================================================
window.renderFormsAdminAccessView = () => {
  const canvas = document.getElementById('forms-admin-content-canvas');
  if (!canvas) return;

  const rules = window.formsAdminState.accessRules || [];

  canvas.innerHTML = \`
    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-family:'Playfair Display',serif; font-size:1.25rem; color:#0B1F33; margin:0 0 4px;">
            Fine-Grained Member Access Restrictions (\${rules.length})
          </h2>
          <span style="font-size:12.5px; color:#64748B;">
            Restricts specific individual members or disables access for all readers across Main Titles, Sub Titles, Articles, or Novels. Expired rules are auto-lifted.
          </span>
        </div>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.openAccessRuleModal()">
          \${ADMIN_ICONS.plus} New Access Restriction
        </button>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:760px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:2px solid #E2E8F0; text-align:left;">
              <th style="padding:12px 14px;">Target Item</th>
              <th style="padding:12px 14px;">Restricted Member</th>
              <th style="padding:12px 14px;">Restriction Type</th>
              <th style="padding:12px 14px;">Reason</th>
              <th style="padding:12px 14px;">Duration / Expiry</th>
              <th style="padding:12px 14px;">Created By</th>
              <th style="padding:12px 14px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            \${rules.length > 0 ? rules.map(rule => {
              const isExpired = rule.expires_at && new Date(rule.expires_at) < new Date();
              return \`
                <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                  <td style="padding:12px 14px;">
                    <span style="background:#FAF5EC; color:#B88635; padding:2px 6px; border-radius:4px; font-weight:700; font-size:10.5px; text-transform:uppercase;">
                      \${escapeHtml(rule.target_type)}
                    </span>
                    <div style="font-weight:600; color:#0B1F33; margin-top:2px;">
                      ID: \${escapeHtml(rule.target_id)}
                    </div>
                  </td>
                  <td style="padding:12px 14px;">
                    \${rule.user_id ? \`
                      <div style="font-weight:600; color:#0B1F33;">\${escapeHtml(rule.display_name || rule.username || 'Member')}</div>
                      <div style="font-size:11px; color:#64748B;">\${escapeHtml(rule.email || '')} (ID: \${rule.user_id})</div>
                    \` : \`
                      <span style="color:#DC2626; font-weight:700;">All Readers (Global Disable)</span>
                    \`}
                  </td>
                  <td style="padding:12px 14px;">
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; \${rule.rule_type === 'block' ? 'background:#FEE2E2; color:#DC2626;' : 'background:#FEF3C7; color:#92400E;'}">
                      \${rule.rule_type === 'block' ? '🚫 Member Blocked' : '⏸️ Disabled for All'}
                    </span>
                  </td>
                  <td style="padding:12px 14px; color:#475569; font-size:12px; max-width:180px;">
                    \${escapeHtml(rule.reason || 'Administrative restriction')}
                  </td>
                  <td style="padding:12px 14px; font-size:12px;">
                    \${rule.expires_at ? \`
                      <div style="color:\${isExpired ? '#94A3B8' : '#0B1F33'}; font-weight:600;">
                        \${formatAdminDateTime(rule.expires_at)}
                      </div>
                      <div style="font-size:11px; color:\${isExpired ? '#DC2626' : '#15803D'};">
                        \${isExpired ? 'Expired' : 'Active'}
                      </div>
                    \` : \`
                      <span style="color:#64748B; font-weight:600;">Indefinite (Manual restore)</span>
                    \`}
                  </td>
                  <td style="padding:12px 14px; color:#64748B; font-size:11.5px;">
                    \${escapeHtml(rule.admin_name || 'Admin')}
                  </td>
                  <td style="padding:12px 14px; text-align:right;">
                    <button type="button" class="btn btn-outline btn-sm" style="padding:3px 10px; font-size:11.5px; color:#15803D; border-color:#BBF7D0;" onclick="window.removeAccessRule(\${rule.id})">
                      Restore Access ✓
                    </button>
                  </td>
                </tr>
              \`;
            }).join('') : \`
              <tr>
                <td colspan="7" style="text-align:center; padding:35px; color:#64748B;">
                  No active access restrictions. All published content is accessible according to default member roles.
                </td>
              </tr>
            \`}
          </tbody>
        </table>
      </div>
    </div>
  \`;
};

// ============================================================================
// MAIN CATEGORY MODALS & ACTIONS
// ============================================================================
window.openCreateMainModal = () => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const nextOrder = (window.formsAdminState.mainCategories.length + 1);

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:520px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            Create Main Category / Title
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Title *</label>
          <input type="text" id="main-form-title" class="form-input" placeholder="e.g. General, Ongoing Novels, Completed Novels" style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description</label>
          <textarea id="main-form-desc" class="form-input" rows="2" placeholder="Brief description of this section..." style="width:100%; box-sizing:border-box; resize:vertical;"></textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Icon (Emoji / Symbol)</label>
            <input type="text" id="main-form-icon" class="form-input" value="💬" placeholder="💬 or 📖 or 📚" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Accent Color</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="color" id="main-form-color-picker" value="#2E1065" onchange="document.getElementById('main-form-color').value = this.value;" style="width:40px; height:36px; border:none; padding:0; cursor:pointer; border-radius:4px;">
              <input type="text" id="main-form-color" class="form-input" value="#2E1065" style="flex:1; box-sizing:border-box; font-family:monospace; font-size:12px;">
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="main-form-order" class="form-input" value="\${nextOrder}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Status</label>
            <select id="main-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="published" selected>Published (Active)</option>
              <option value="disabled">Disabled (Hidden for Readers)</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitMainCategoryForm()">Save Main Title</button>
        </div>
      </div>
    </div>
  \`;
};

window.openEditMainModal = (catId) => {
  const cat = (window.formsAdminState.mainCategories || []).find(c => String(c.id) === String(catId));
  if (!cat) return;

  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:520px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            Edit Main Title: \${escapeHtml(cat.title)}
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Title *</label>
          <input type="text" id="main-form-title" class="form-input" value="\${escapeHtml(cat.title)}" style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description</label>
          <textarea id="main-form-desc" class="form-input" rows="2" style="width:100%; box-sizing:border-box; resize:vertical;">\${escapeHtml(cat.description || '')}</textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Icon (Emoji / Symbol)</label>
            <input type="text" id="main-form-icon" class="form-input" value="\${escapeHtml(cat.icon || '💬')}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Accent Color</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="color" id="main-form-color-picker" value="\${escapeHtml(cat.accent_color || '#2E1065')}" onchange="document.getElementById('main-form-color').value = this.value;" style="width:40px; height:36px; border:none; padding:0; cursor:pointer; border-radius:4px;">
              <input type="text" id="main-form-color" class="form-input" value="\${escapeHtml(cat.accent_color || '#2E1065')}" style="flex:1; box-sizing:border-box; font-family:monospace; font-size:12px;">
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="main-form-order" class="form-input" value="\${cat.sort_order || 1}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Status</label>
            <select id="main-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="published" \${cat.status !== 'disabled' && !cat.is_disabled ? 'selected' : ''}>Published (Active)</option>
              <option value="disabled" \${cat.status === 'disabled' || cat.is_disabled ? 'selected' : ''}>Disabled (Hidden)</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitMainCategoryForm('\${escapeQuotes(cat.id)}')">Save Changes</button>
        </div>
      </div>
    </div>
  \`;
};

window.submitMainCategoryForm = async (catId = null) => {
  const title = document.getElementById('main-form-title')?.value?.trim();
  const description = document.getElementById('main-form-desc')?.value?.trim() || '';
  const icon = document.getElementById('main-form-icon')?.value?.trim() || '💬';
  const accent_color = document.getElementById('main-form-color')?.value?.trim() || '#2E1065';
  const sort_order = parseInt(document.getElementById('main-form-order')?.value, 10) || 1;
  const status = document.getElementById('main-form-status')?.value || 'published';

  if (!title) {
    showToast('Main title is required.');
    return;
  }

  try {
    const url = catId ? \`/api/admin/content/main-categories/\${encodeURIComponent(catId)}\` : '/api/admin/content/main-categories';
    const method = catId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, icon, accent_color, sort_order, status })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save main title.');
      return;
    }

    showToast(catId ? 'Main title updated successfully!' : 'Main title created successfully!');
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving main title.');
  }
};

window.toggleMainCategoryStatus = async (catId, currentDisabled) => {
  try {
    const res = await apiFetch(\`/api/admin/content/main-categories/\${encodeURIComponent(catId)}/status\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_disabled: !currentDisabled })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(!currentDisabled ? 'Main category disabled for readers.' : 'Main category published! 🚀');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to update status.');
    }
  } catch (err) {
    showToast(err.message || 'Error updating status.');
  }
};

window.deleteMainCategory = async (catId) => {
  if (!confirm(\`Are you sure you want to delete this Main Title?\\n\\nNotice: Any existing sub titles and articles will remain in the database safely.\\nThis action cannot be undone.\`)) {
    return;
  }
  try {
    const res = await apiFetch(\`/api/admin/content/main-categories/\${encodeURIComponent(catId)}\`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Main title deleted.');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete main title.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting main title.');
  }
};

// ============================================================================
// SUB CATEGORY MODALS & ACTIONS
// ============================================================================
window.openCreateSubModal = () => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const categories = window.formsAdminState.mainCategories || [];
  const novels = window.formsAdminState.novels || [];
  const nextOrder = (window.formsAdminState.subcategories.length + 1);

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:540px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            Create Sub Title / Section
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Parent Main Title *</label>
          <select id="sub-form-main" class="form-input" style="width:100%; box-sizing:border-box;">
            \${categories.map(c => \`
              <option value="\${escapeHtml(c.id)}" \${String(c.id) === String(window.formsAdminState.selectedMainFilter) ? 'selected' : ''}>
                \${escapeHtml(c.icon || '📂')} \${escapeHtml(c.title)}
              </option>
            \`).join('')}
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub Title *</label>
          <input type="text" id="sub-form-title" class="form-input" placeholder="e.g. Welcome Notes, Announcements, Tea Time" style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description</label>
          <textarea id="sub-form-desc" class="form-input" rows="2" placeholder="Brief note or guidelines..." style="width:100%; box-sizing:border-box; resize:vertical;"></textarea>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Link to Existing Novel (Optional)</label>
          <select id="sub-form-novel" class="form-input" style="width:100%; box-sizing:border-box;">
            <option value="">— None (Independent Subcategory) —</option>
            \${novels.map(n => \`
              <option value="\${escapeHtml(n.id)}">📖 \${escapeHtml(n.title)} (\${escapeHtml(n.category || 'Novel')})</option>
            \`).join('')}
          </select>
          <span style="font-size:11px; color:#64748B; margin-top:3px; display:block;">For novel sections, linking automatically pulls latest episode updates.</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="sub-form-order" class="form-input" value="\${nextOrder}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Status</label>
            <select id="sub-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="active" selected>Active (Visible)</option>
              <option value="disabled">Disabled (Hidden)</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitSubCategoryForm()">Save Sub Title</button>
        </div>
      </div>
    </div>
  \`;
};

window.openEditSubModal = (subId) => {
  const sub = (window.formsAdminState.subcategories || []).find(s => String(s.id) === String(subId));
  if (!sub) return;

  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const categories = window.formsAdminState.mainCategories || [];
  const novels = window.formsAdminState.novels || [];

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:540px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            Edit Sub Title: \${escapeHtml(sub.title)}
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Parent Main Title * (Move Section)</label>
          <select id="sub-form-main" class="form-input" style="width:100%; box-sizing:border-box;">
            \${categories.map(c => \`
              <option value="\${escapeHtml(c.id)}" \${String(c.id) === String(sub.main_category_id) ? 'selected' : ''}>
                \${escapeHtml(c.icon || '📂')} \${escapeHtml(c.title)}
              </option>
            \`).join('')}
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub Title *</label>
          <input type="text" id="sub-form-title" class="form-input" value="\${escapeHtml(sub.title)}" style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description</label>
          <textarea id="sub-form-desc" class="form-input" rows="2" style="width:100%; box-sizing:border-box; resize:vertical;">\${escapeHtml(sub.description || '')}</textarea>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Link to Existing Novel</label>
          <select id="sub-form-novel" class="form-input" style="width:100%; box-sizing:border-box;">
            <option value="">— None (Independent Subcategory) —</option>
            \${novels.map(n => \`
              <option value="\${escapeHtml(n.id)}" \${String(n.id) === String(sub.novel_id) ? 'selected' : ''}>
                📖 \${escapeHtml(n.title)} (\${escapeHtml(n.category || 'Novel')})
              </option>
            \`).join('')}
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="sub-form-order" class="form-input" value="\${sub.sort_order || 1}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Status</label>
            <select id="sub-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="active" \${!sub.is_disabled && sub.status !== 'disabled' ? 'selected' : ''}>Active (Visible)</option>
              <option value="disabled" \${sub.is_disabled || sub.status === 'disabled' ? 'selected' : ''}>Disabled (Hidden)</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitSubCategoryForm(\${sub.id})">Save Changes</button>
        </div>
      </div>
    </div>
  \`;
};

window.submitSubCategoryForm = async (subId = null) => {
  const main_category_id = document.getElementById('sub-form-main')?.value;
  const title = document.getElementById('sub-form-title')?.value?.trim();
  const description = document.getElementById('sub-form-desc')?.value?.trim() || '';
  const novel_id = document.getElementById('sub-form-novel')?.value || null;
  const sort_order = parseInt(document.getElementById('sub-form-order')?.value, 10) || 1;
  const status = document.getElementById('sub-form-status')?.value || 'active';

  if (!title || !main_category_id) {
    showToast('Sub title and Parent Main Title are required.');
    return;
  }

  try {
    const url = subId ? \`/api/admin/content/subcategories/\${subId}\` : '/api/admin/content/subcategories';
    const method = subId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main_category_id, title, description, novel_id, sort_order, status })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save sub title.');
      return;
    }

    showToast(subId ? 'Sub title updated successfully!' : 'Sub title created successfully!');
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving sub title.');
  }
};

window.toggleSubCategoryStatus = async (subId, currentDisabled) => {
  try {
    const res = await apiFetch(\`/api/admin/content/subcategories/\${subId}/status\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_disabled: !currentDisabled })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(!currentDisabled ? 'Sub category disabled.' : 'Sub category enabled! 🚀');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to update status.');
    }
  } catch (err) {
    showToast(err.message || 'Error updating status.');
  }
};

window.deleteSubCategory = async (subId) => {
  if (!confirm(\`Are you sure you want to delete this Sub Title?\\n\\nExisting articles under this sub title will be preserved safely.\\nThis action cannot be undone.\`)) {
    return;
  }
  try {
    const res = await apiFetch(\`/api/admin/content/subcategories/\${subId}\`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Sub title deleted.');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete sub title.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting sub title.');
  }
};

// ============================================================================
// CONTENT ARTICLES & RICH TEXT EDITOR MODALS
// ============================================================================
window.openCreateArticleModal = () => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const categories = window.formsAdminState.mainCategories || [];
  const subcategories = window.formsAdminState.subcategories || [];

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:760px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:92vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            Create Content Title &amp; Reading Article
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Category *</label>
            <select id="art-form-main" class="form-input" style="width:100%; box-sizing:border-box;" onchange="window.updateArticleSubOptions(this.value)">
              \${categories.map(c => \`
                <option value="\${escapeHtml(c.id)}">\${escapeHtml(c.icon || '📂')} \${escapeHtml(c.title)}</option>
              \`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub Category *</label>
            <select id="art-form-sub" class="form-input" style="width:100%; box-sizing:border-box;">
              \${subcategories.map(s => \`
                <option value="\${escapeHtml(s.id)}">\${escapeHtml(s.title)}</option>
              \`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Content Title *</label>
            <input type="text" id="art-form-title" class="form-input" placeholder="e.g. Hello Members, Welcome to Our Community" style="width:100%; box-sizing:border-box; font-weight:600;" oninput="window.autoFillSlug(this.value)">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Unique Slug *</label>
            <input type="text" id="art-form-slug" class="form-input" placeholder="hello-members" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:12px;">
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Short Summary / Excerpt (Optional)</label>
          <input type="text" id="art-form-summary" class="form-input" placeholder="A brief note previewed on listing cards..." style="width:100%; box-sizing:border-box;">
        </div>

        <!-- Rich Text Toolbar & Content Area -->
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; font-weight:700; color:#0B1F33;">Reading Content *</label>
            <div style="display:flex; gap:4px;">
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('**', '**', 'bold text')"><strong>B</strong></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('*', '*', 'italic text')"><em>I</em></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('## ', '', 'Heading')">H2</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('> ', '', 'Quote text')">Quote</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('- ', '', 'List item')">• List</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('---', '', '')">Divider</button>
            </div>
          </div>
          <textarea id="art-form-content" class="form-input" rows="10" placeholder="Write full reading content here. Supports paragraphs, headings, quotes, and links..." style="width:100%; box-sizing:border-box; resize:vertical; font-family:Georgia, serif; font-size:14px; line-height:1.7;"></textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Author Attribution</label>
            <input type="text" id="art-form-author" class="form-input" value="Rudhra Prarthana" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Publishing Status</label>
            <select id="art-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="published" selected>Published (Live for Readers)</option>
              <option value="draft">Draft (Unpublished)</option>
              <option value="disabled">Disabled (Hidden)</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="art-form-order" class="form-input" value="1" style="width:100%; box-sizing:border-box;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.submitArticleForm()">Publish Content Article</button>
        </div>
      </div>
    </div>
  \`;

  window.updateArticleSubOptions(categories[0]?.id);
};

window.openEditArticleModal = async (artId) => {
  try {
    const res = await apiFetch(\`/api/admin/content/articles/\${artId}\`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to load article details.');
      return;
    }
    const art = data.article;

    const container = document.getElementById('forms-admin-modal-container');
    if (!container) return;

    const categories = window.formsAdminState.mainCategories || [];
    const subcategories = window.formsAdminState.subcategories || [];

    container.innerHTML = \`
      <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:760px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:92vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
              Edit Content Article: \${escapeHtml(art.title)}
            </h3>
            <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Category *</label>
              <select id="art-form-main" class="form-input" style="width:100%; box-sizing:border-box;" onchange="window.updateArticleSubOptions(this.value)">
                \${categories.map(c => \`
                  <option value="\${escapeHtml(c.id)}" \${String(c.id) === String(art.main_category_id) ? 'selected' : ''}>\${escapeHtml(c.icon || '📂')} \${escapeHtml(c.title)}</option>
                \`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub Category *</label>
              <select id="art-form-sub" class="form-input" style="width:100%; box-sizing:border-box;">
                \${subcategories.map(s => \`
                  <option value="\${escapeHtml(s.id)}" \${String(s.id) === String(art.sub_category_id) ? 'selected' : ''}>\${escapeHtml(s.title)}</option>
                \`).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Content Title *</label>
              <input type="text" id="art-form-title" class="form-input" value="\${escapeHtml(art.title)}" style="width:100%; box-sizing:border-box; font-weight:600;">
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Unique Slug *</label>
              <input type="text" id="art-form-slug" class="form-input" value="\${escapeHtml(art.unique_slug || '')}" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:12px;">
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Short Summary / Excerpt</label>
            <input type="text" id="art-form-summary" class="form-input" value="\${escapeHtml(art.summary || '')}" style="width:100%; box-sizing:border-box;">
          </div>

          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="font-size:12px; font-weight:700; color:#0B1F33;">Reading Content *</label>
              <div style="display:flex; gap:4px;">
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('**', '**', 'bold text')"><strong>B</strong></button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('*', '*', 'italic text')"><em>I</em></button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('## ', '', 'Heading')">H2</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('> ', '', 'Quote text')">Quote</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('- ', '', 'List item')">• List</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertEditorFormat('---', '', '')">Divider</button>
              </div>
            </div>
            <textarea id="art-form-content" class="form-input" rows="10" style="width:100%; box-sizing:border-box; resize:vertical; font-family:Georgia, serif; font-size:14px; line-height:1.7;">\${escapeHtml(art.content || '')}</textarea>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:18px;">
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Author Attribution</label>
              <input type="text" id="art-form-author" class="form-input" value="\${escapeHtml(art.author_name || 'Rudhra Prarthana')}" style="width:100%; box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Publishing Status</label>
              <select id="art-form-status" class="form-input" style="width:100%; box-sizing:border-box;">
                <option value="published" \${art.status === 'published' ? 'selected' : ''}>Published (Live for Readers)</option>
                <option value="draft" \${art.status === 'draft' || art.status === 'unpublished' ? 'selected' : ''}>Draft (Unpublished)</option>
                <option value="disabled" \${art.status === 'disabled' || art.is_disabled ? 'selected' : ''}>Disabled (Hidden)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
              <input type="number" id="art-form-order" class="form-input" value="\${art.sort_order || 1}" style="width:100%; box-sizing:border-box;">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.submitArticleForm(\${art.id})">Save Changes</button>
          </div>
        </div>
      </div>
    \`;
  } catch (err) {
    showToast(err.message || 'Error loading article.');
  }
};

window.autoFillSlug = (title) => {
  const slugInput = document.getElementById('art-form-slug');
  if (slugInput && !slugInput.dataset.manual) {
    slugInput.value = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
};

window.insertEditorFormat = (before, after, placeholder) => {
  const textarea = document.getElementById('art-form-content');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end) || placeholder;

  textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
};

window.updateArticleSubOptions = (mainId) => {
  const subSelect = document.getElementById('art-form-sub');
  if (!subSelect) return;

  const subs = (window.formsAdminState.subcategories || []).filter(s => String(s.main_category_id) === String(mainId));
  subSelect.innerHTML = subs.map(s => \`<option value="\${escapeHtml(s.id)}">\${escapeHtml(s.title)}</option>\`).join('') || '<option value="">No subcategories</option>';
};

window.submitArticleForm = async (artId = null) => {
  const main_category_id = document.getElementById('art-form-main')?.value;
  const sub_category_id = document.getElementById('art-form-sub')?.value;
  const title = document.getElementById('art-form-title')?.value?.trim();
  const unique_slug = document.getElementById('art-form-slug')?.value?.trim();
  const summary = document.getElementById('art-form-summary')?.value?.trim() || null;
  const content = document.getElementById('art-form-content')?.value?.trim();
  const author_name = document.getElementById('art-form-author')?.value?.trim() || 'Admin';
  const status = document.getElementById('art-form-status')?.value || 'published';
  const sort_order = parseInt(document.getElementById('art-form-order')?.value, 10) || 1;

  if (!title || !unique_slug || !content) {
    showToast('Title, slug, and reading content are required.');
    return;
  }

  try {
    const url = artId ? \`/api/admin/content/articles/\${artId}\` : '/api/admin/content/articles';
    const method = artId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        main_category_id,
        sub_category_id,
        title,
        unique_slug,
        summary,
        content,
        author_name,
        status,
        sort_order
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save article.');
      return;
    }

    showToast(artId ? 'Article updated successfully!' : 'Article published successfully!');
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving article.');
  }
};

window.deleteArticle = async (artId) => {
  if (!confirm(\`Are you sure you want to delete this Content Article?\\n\\nAll associated comments and view metrics will be handled safely.\\nThis action cannot be undone.\`)) {
    return;
  }
  try {
    const res = await apiFetch(\`/api/admin/content/articles/\${artId}\`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Article deleted.');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete article.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting article.');
  }
};

// ============================================================================
// ACCESS CONTROL MODAL & ACTIONS
// ============================================================================
window.openAccessRuleModal = (presetType = 'article', presetId = '', presetName = '') => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const members = window.formsAdminState.members || [];
  const mainCategories = window.formsAdminState.mainCategories || [];
  const subcategories = window.formsAdminState.subcategories || [];
  const articles = window.formsAdminState.articles || [];
  const novels = window.formsAdminState.novels || [];

  container.innerHTML = \`
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:540px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            🛡️ Set Fine-Grained Access Control
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Target Hierarchy Level *</label>
            <select id="acc-target-type" class="form-input" style="width:100%; box-sizing:border-box;" onchange="window.updateAccessTargetOptions(this.value)">
              <option value="article" \${presetType === 'article' ? 'selected' : ''}>Article / Content Item</option>
              <option value="subcategory" \${presetType === 'subcategory' ? 'selected' : ''}>Sub Title</option>
              <option value="main_category" \${presetType === 'main_category' ? 'selected' : ''}>Main Title</option>
              <option value="novel" \${presetType === 'novel' ? 'selected' : ''}>Novel</option>
              <option value="chapter" \${presetType === 'chapter' ? 'selected' : ''}>Episode / Chapter</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Target Item *</label>
            <select id="acc-target-id" class="form-input" style="width:100%; box-sizing:border-box;"></select>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Audience to Restrict *</label>
          <select id="acc-audience" class="form-input" style="width:100%; box-sizing:border-box;" onchange="document.getElementById('acc-member-wrap').style.display = (this.value === 'member' ? 'block' : 'none');">
            <option value="member" selected>Specific Member (Block individual user)</option>
            <option value="all">All Readers (Disable item for entire community)</option>
          </select>
        </div>

        <div id="acc-member-wrap" style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Select Member *</label>
          <select id="acc-user-id" class="form-input" style="width:100%; box-sizing:border-box;">
            \${members.map(m => \`
              <option value="\${m.id}">\${escapeHtml(m.display_name || m.username)} (\${escapeHtml(m.email)}) - ID: \${m.id}</option>
            \`).join('')}
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Restriction Type</label>
            <select id="acc-rule-type" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="block" selected>Block Access</option>
              <option value="disable">Disable Completely</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Duration</label>
            <select id="acc-duration" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours (1 Day)</option>
              <option value="3d">3 Days</option>
              <option value="7d" selected>7 Days (1 Week)</option>
              <option value="30d">30 Days (1 Month)</option>
              <option value="indefinite">Indefinite (Manual restore)</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:18px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Reason for Restriction (Shown to restricted member)</label>
          <input type="text" id="acc-reason" class="form-input" placeholder="e.g. Violation of community reading policies" style="width:100%; box-sizing:border-box;" value="Violation of community reading policies">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitAccessRule()">Apply Restriction</button>
        </div>
      </div>
    </div>
  \`;

  window.updateAccessTargetOptions(presetType, presetId);
};

window.updateAccessTargetOptions = (type, selectedId = '') => {
  const select = document.getElementById('acc-target-id');
  if (!select) return;

  let items = [];
  if (type === 'article') {
    items = (window.formsAdminState.articles || []).map(a => ({ id: a.id, label: \`\${a.title} (Slug: \${a.unique_slug || a.id})\` }));
  } else if (type === 'subcategory') {
    items = (window.formsAdminState.subcategories || []).map(s => ({ id: s.id, label: \`\${s.title} (Main: \${s.main_category_title})\` }));
  } else if (type === 'main_category') {
    items = (window.formsAdminState.mainCategories || []).map(m => ({ id: m.id, label: m.title }));
  } else if (type === 'novel') {
    items = (window.formsAdminState.novels || []).map(n => ({ id: n.id, label: n.title }));
  } else if (type === 'chapter') {
    items = (window.formsAdminState.articles || []).filter(a => a.novel_id).map(c => ({ id: c.id, label: \`Chapter: \${c.title}\` }));
  }

  select.innerHTML = items.map(item => \`
    <option value="\${escapeHtml(String(item.id))}" \${String(item.id) === String(selectedId) ? 'selected' : ''}>
      \${escapeHtml(item.label)}
    </option>
  \`).join('') || '<option value="">No items available</option>';
};

window.submitAccessRule = async () => {
  const target_type = document.getElementById('acc-target-type')?.value;
  const target_id = document.getElementById('acc-target-id')?.value;
  const audience = document.getElementById('acc-audience')?.value;
  const user_id = audience === 'member' ? document.getElementById('acc-user-id')?.value : null;
  const rule_type = document.getElementById('acc-rule-type')?.value || 'block';
  const duration = document.getElementById('acc-duration')?.value || '7d';
  const reason = document.getElementById('acc-reason')?.value?.trim() || null;

  if (!target_id) {
    showToast('Please select a target item.');
    return;
  }
  if (audience === 'member' && !user_id) {
    showToast('Please select a member to restrict.');
    return;
  }

  try {
    const res = await apiFetch('/api/admin/content/access-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type, target_id, user_id, rule_type, duration, reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to apply access restriction.');
      return;
    }

    showToast('Access restriction applied successfully! 🛡️');
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
    window.switchFormsAdminTab('access');
  } catch (err) {
    showToast(err.message || 'Error applying restriction.');
  }
};

window.removeAccessRule = async (ruleId) => {
  if (!confirm('Are you sure you want to lift this restriction and immediately restore access?')) {
    return;
  }
  try {
    const res = await apiFetch(\`/api/admin/content/access-rules/\${ruleId}\`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Access successfully restored! ✓');
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to lift restriction.');
    }
  } catch (err) {
    showToast(err.message || 'Error lifting restriction.');
  }
};

window.closeFormsAdminModal = (event) => {
  if (event && event.target && !event.target.classList.contains('admin-modal-backdrop') && !event.target.classList.contains('btn-close')) {
    return;
  }
  const container = document.getElementById('forms-admin-modal-container');
  if (container) container.innerHTML = '';
};
`;

function updateAdminJs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace tab title for forum
  content = content.replace("forum: 'Forum & Category Management'", "forum: 'Forms & Content Management'");
  content = content.replace("<span>Forum Management</span>", "<span>Forms &amp; Content Management</span>");
  content = content.replace("<span>Forum & Category Management</span>", "<span>Forms &amp; Content Management</span>");

  // Find start of renderForumManagementTab
  const fnIdx = content.indexOf('export async function renderForumManagementTab');
  if (fnIdx !== -1) {
    content = content.slice(0, fnIdx) + adminFormsContentCode;
  } else {
    content += '\n' + adminFormsContentCode;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated', filePath);
}

updateAdminJs('src/js/admin.js');
updateAdminJs('frontend/src/js/admin.js');

