import fs from 'node:fs';

const modalFunctionsCode = `
// ============================================================================
// FORMS SUBTITLE CONTENT CREATION MODAL (ADMIN ONLY)
// ============================================================================

window.openFormsAddContentModal = (mainCategoryId, subCategoryId, subTitle) => {
  let modalWrap = document.getElementById('forms-add-content-modal-root');
  if (!modalWrap) {
    modalWrap = document.createElement('div');
    modalWrap.id = 'forms-add-content-modal-root';
    document.body.appendChild(modalWrap);
  }

  const defaultAuthor = window.CURRENT_USER?.displayName || window.CURRENT_USER?.username || 'Rudhra Prarthana';

  modalWrap.innerHTML = \`
    <div class="modal-backdrop" onclick="window.closeFormsAddContentModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="modal-dialog" onclick="event.stopPropagation()" style="background:#FFFFFF; border-radius:14px; width:100%; max-width:680px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); max-height:92vh; overflow-y:auto; border:1px solid #E2E8F0;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid #E2E8F0; background:#FAF7F2;">
          <div>
            <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:#1A0B2E; margin:0 0 3px;">
              + Add New Content
            </h3>
            <span style="font-size:12.5px; color:#64748B;">
              Creating content under section: <strong>\${escapeHtml(subTitle || 'Sub Title')}</strong>
            </span>
          </div>
          <button type="button" onclick="window.closeFormsAddContentModal()" style="border:none; background:none; font-size:20px; color:#64748B; cursor:pointer;">✕</button>
        </div>

        <form id="forms-add-content-form" onsubmit="window.submitFormsNewContent(event)" style="padding:20px 24px;">
          <input type="hidden" id="modal-main-cat-id" value="\${escapeHtml(mainCategoryId || '')}">
          <input type="hidden" id="modal-sub-cat-id" value="\${escapeHtml(subCategoryId || '')}">

          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12.5px; font-weight:700; color:#0B1F33; margin-bottom:5px;">
              Content Title *
            </label>
            <input type="text" id="modal-content-title" class="form-input" placeholder="e.g. Hello Members, Welcome to Our Community" required style="width:100%; box-sizing:border-box; font-size:14px; font-weight:600;" oninput="window.autoGenerateModalSlug(this.value)">
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12px; font-weight:600; color:#64748B; margin-bottom:4px;">
              Unique Slug (URL Identifier) *
            </label>
            <input type="text" id="modal-content-slug" class="form-input" placeholder="e.g. hello-members" required style="width:100%; box-sizing:border-box; font-family:monospace; font-size:12px;">
          </div>

          <!-- Rich Reading Content Editor -->
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="font-size:12.5px; font-weight:700; color:#0B1F33;">
                Reading Content *
              </label>
              <div style="display:flex; gap:4px;">
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('**', '**', 'bold text')"><strong>B</strong></button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('*', '*', 'italic text')"><em>I</em></button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('## ', '', 'Heading')">H2</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('> ', '', 'Quote text')">Quote</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('- ', '', 'List item')">• List</button>
                <button type="button" class="btn btn-outline btn-sm" style="padding:2px 7px; font-size:11px;" onclick="window.insertContentFormat('---', '', '')">Divider</button>
              </div>
            </div>
            <textarea id="modal-content-body" class="form-input" rows="8" placeholder="Write full reading content here. Supports multiple paragraphs, headings, and quotes..." required style="width:100%; box-sizing:border-box; font-family:Georgia, serif; font-size:14px; line-height:1.7; resize:vertical;"></textarea>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#0B1F33; margin-bottom:4px;">
                Author Attribution
              </label>
              <input type="text" id="modal-content-author" class="form-input" value="\${escapeHtml(defaultAuthor)}" style="width:100%; box-sizing:border-box; font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; color:#0B1F33; margin-bottom:4px;">
                Publishing Status
              </label>
              <select id="modal-content-status" class="form-input" style="width:100%; box-sizing:border-box; font-size:13px;">
                <option value="published" selected>Published (Visible Immediately)</option>
                <option value="draft">Draft (Unpublished)</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; padding-top:14px; border-top:1px solid #E2E8F0;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAddContentModal()">Cancel</button>
            <button type="submit" id="modal-content-submit-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
              Publish Content Article
            </button>
          </div>
        </form>
      </div>
    </div>
  \`;
};

window.closeFormsAddContentModal = (event) => {
  if (event && event.target && !event.target.classList.contains('modal-backdrop')) return;
  const root = document.getElementById('forms-add-content-modal-root');
  if (root) root.innerHTML = '';
};

window.autoGenerateModalSlug = (val) => {
  const slugInput = document.getElementById('modal-content-slug');
  if (slugInput && !slugInput.dataset.manual) {
    slugInput.value = (val || '')
      .toLowerCase()
      .trim()
      .replace(/[^\\w\\s-]/g, '')
      .replace(/[\\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};

window.insertContentFormat = (before, after, placeholder) => {
  const textarea = document.getElementById('modal-content-body');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end) || placeholder;
  textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
};

window.submitFormsNewContent = async (event) => {
  event.preventDefault();
  const mainCategoryId = document.getElementById('modal-main-cat-id')?.value;
  const subCategoryId = document.getElementById('modal-sub-cat-id')?.value;
  const title = document.getElementById('modal-content-title')?.value?.trim();
  const uniqueSlug = document.getElementById('modal-content-slug')?.value?.trim();
  const content = document.getElementById('modal-content-body')?.value?.trim();
  const authorName = document.getElementById('modal-content-author')?.value?.trim() || 'Rudhra Prarthana';
  const status = document.getElementById('modal-content-status')?.value || 'published';

  if (!title || !uniqueSlug || !content) {
    showToast('Please fill in all required fields.');
    return;
  }

  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    showToast('Admin session expired. Please log in.');
    return;
  }

  const submitBtn = document.getElementById('modal-content-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Publishing...';
  }

  try {
    const res = await fetch('/api/admin/content/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`
      },
      body: JSON.stringify({
        main_category_id: mainCategoryId,
        sub_category_id: subCategoryId,
        title,
        unique_slug: uniqueSlug,
        content,
        author_name: authorName,
        status,
        sort_order: 1
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to publish content.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Publish Content Article';
      }
      return;
    }

    showToast('Content published successfully! 🚀');
    window.closeFormsAddContentModal();

    // Trigger router re-render to reflect new content immediately
    if (typeof handleRouting === 'function') {
      handleRouting();
    } else {
      window.location.reload();
    }
  } catch (err) {
    console.error('Error saving content:', err);
    showToast(err.message || 'Network error.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Publish Content Article';
    }
  }
};
`;

const renderForumViewNewCode = `
// 5. FORUM COMMUNITY VIEW
async function renderForumView(container, hash = '') {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const currentCategoryId = urlParams.get('category');
  const currentSubId = urlParams.get('sub') || urlParams.get('subId');

  const token = localStorage.getItem('rp_auth_token');
  const headers = token ? { 'Authorization': \`Bearer \${token}\` } : {};

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
      window.location.hash = \`#novel?id=\${encodeURIComponent(currentSub.novelId)}\`;
      return;
    }

    if (currentSub) {
      const subArticles = currentSub.articles || [];

      container.innerHTML = \`
        <div class="container forum-page">
          <!-- Breadcrumbs -->
          <nav class="forum-breadcrumbs" aria-label="Forum Breadcrumb">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms &amp; Community</a>
            \${parentMain ? \`
              <span class="crumb-separator">›</span>
              <a href="#forms">\${escapeHtml(parentMain.title)}</a>
            \` : ''}
            <span class="crumb-separator">›</span>
            <span class="crumb-current">\${escapeHtml(currentSub.title)}</span>
          </nav>

          <!-- Subtitle Header Bar -->
          <div class="forms-subpage-header-bar">
            <div class="forms-subpage-left">
              <a href="#forms" class="btn btn-outline btn-sm">« Back to Forms</a>
              <div class="forms-subpage-icon-badge">\${currentSub.icon || '📌'}</div>
              <div>
                <h1 class="forms-subpage-title">\${escapeHtml(currentSub.title)}</h1>
                <div class="forms-subpage-meta">
                  <span class="forms-subpage-cat-tag">\${escapeHtml(parentMain?.title || 'General')}</span>
                  <span>•</span>
                  <span>\${subArticles.length} Content Titles</span>
                </div>
              </div>
            </div>

            \${isAdmin ? \`
              <button type="button" class="btn btn-gold btn-sm" onclick="window.openFormsAddContentModal('\${escapeQuotes(parentMain?.id || '')}', '\${escapeQuotes(currentSub.id)}', '\${escapeQuotes(currentSub.title)}')">
                <span style="font-size:15px; font-weight:bold; margin-right:4px;">+</span> Add New Content
              </button>
            \` : ''}
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
                  \${subArticles.length > 0 ? subArticles.map(art => \`
                    <a href="\${art.link}" class="forms-subpage-article-row">
                      <div class="forms-subpage-row-main">
                        <div class="forms-subpage-row-title">\${escapeHtml(art.title)}</div>
                        <div class="forms-subpage-row-meta">
                          <span class="forms-article-tag">✍️ \${escapeHtml(art.authorName || 'Rudhra Prarthana')}</span>
                          <span>📅 \${formatLastSeen(art.publishedAt)}</span>
                          <span>💬 \${art.commentsCount || 0} comments</span>
                        </div>
                      </div>
                      <div class="forms-subpage-row-arrow">
                        <span>Read</span> ➔
                      </div>
                    </a>
                  \`).join('') : \`
                    <div class="forms-subpage-empty">
                      <div style="font-size:32px; margin-bottom:8px;">📝</div>
                      <div style="font-weight:600; color:#0B1F33; margin-bottom:4px;">No Content Titles Yet</div>
                      <p style="font-size:13px; color:#64748B; margin:0 0 14px;">
                        No reading content has been published in this section yet.
                      </p>
                      \${isAdmin ? \`
                        <button type="button" class="btn btn-gold btn-sm" onclick="window.openFormsAddContentModal('\${escapeQuotes(parentMain?.id || '')}', '\${escapeQuotes(currentSub.id)}', '\${escapeQuotes(currentSub.title)}')">
                          + Add New Content
                        </button>
                      \` : ''}
                    </div>
                  \`}
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
                  \${renderSidebarPostItems(sidebarData?.latest)}
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
      \`;

      loadForumMembersOnline();
      return;
    }
  }

  // ============================================================================
  // B. MAIN FORMS OVERVIEW PAGE
  // ============================================================================
  const activeCategoryTitle = currentCategory ? currentCategory.title : 'Forms & Reader Forum';

  container.innerHTML = \`
    <div class="container forum-page">
      <!-- Breadcrumbs -->
      <nav class="forum-breadcrumbs" aria-label="Forum Breadcrumb">
        <a href="#forms">Home</a>
        <span class="crumb-separator">›</span>
        \${currentCategoryId ? \`
          <a href="#forms">Forms &amp; Community</a>
          <span class="crumb-separator">›</span>
          <span class="crumb-current">\${escapeHtml(currentCategory?.title || 'Category')}</span>
        \` : \`
          <span class="crumb-current">Forms &amp; Reader Community</span>
        \`}
      </nav>

      \${!currentCategoryId ? \`
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
      \` : \`
        <div class="forum-header-bar">
          <div>
            <a href="#forms" class="section-link" style="display:inline-flex; align-items:center; gap:6px; margin-bottom:8px; font-weight:600;">
              « Back to All Categories
            </a>
            <span class="section-subtitle">\${currentCategory ? (currentCategory.description || t('forum_subtitle')) : t('forum_subtitle')}</span>
            <h1 class="section-title">\${escapeHtml(activeCategoryTitle)}</h1>
          </div>
          <div>
            <div class="forum-live-stats-bar" id="forum-live-stats-bar" aria-label="Forum Live Statistics">
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">👥</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">\${Number(liveStats?.totalMembers || 0)}</span>
                  <span class="forum-stat-lbl">Members</span>
                </div>
              </div>
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">💬</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">\${Number(liveStats?.totalReplies || 0)}</span>
                  <span class="forum-stat-lbl">Replies</span>
                </div>
              </div>
              <div class="forum-stat-badge">
                <span class="forum-stat-icon">🌐</span>
                <div class="forum-stat-content">
                  <span class="forum-stat-val">\${Number(liveStats?.totalGuests || 0)}</span>
                  <span class="forum-stat-lbl">Guests Visited</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`}

      <div class="forum-layout">
        <!-- Main Content Column -->
        <div class="forum-main-col">
          <div class="forms-categories-container" id="forms-categories-root">
            \${(currentCategoryId ? hierarchy.filter(c => c.id === currentCategoryId) : hierarchy).map(cat => {
              const subs = cat.subcategories || [];
              const novels = cat.novels || [];

              return \`
                <div class="forms-category-section" id="cat-sec-\${escapeHtml(cat.id)}">
                  <!-- Royal-Purple Header Bar -->
                  <div class="forms-cat-header-bar" style="background: linear-gradient(90deg, #1A0B2E 0%, \${escapeHtml(cat.color || '#2E1065')} 60%, #3B0764 100%);">
                    <div class="forms-cat-title-group">
                      <div class="forms-cat-icon">\${cat.icon || '💬'}</div>
                      <div>
                        <h2 class="forms-cat-name">\${escapeHtml(cat.title)}</h2>
                        <div class="forms-cat-desc">\${escapeHtml(cat.description || '')}</div>
                      </div>
                    </div>
                    <div class="forms-cat-actions">
                      <span class="forms-cat-pill">\${subs.length > 0 ? \`\${subs.length} Sections\` : \`\${novels.length} Novels\`}</span>
                    </div>
                  </div>

                  <!-- 1. Clickable Subcategories (Main Title -> Clickable Sub Titles -> Content Titles) -->
                  \${subs.length > 0 ? subs.map(sub => {
                    const subLink = sub.novelId 
                      ? \`#novel?id=\${encodeURIComponent(sub.novelId)}\`
                      : \`#forms?sub=\${encodeURIComponent(sub.id)}\`;

                    return \`
                      <div class="forms-sub-section">
                        <div class="forms-sub-header">
                          <a href="\${subLink}" class="forms-sub-title-link" title="Open \${escapeHtml(sub.title)} section">
                            <span class="forms-sub-icon">\${sub.icon || '📌'}</span>
                            <h3 class="forms-sub-title">\${escapeHtml(sub.title)}</h3>
                            <span class="forms-sub-link-arrow">➔</span>
                          </a>
                          <a href="\${subLink}" class="forms-sub-badge-link">
                            \${sub.articles?.length || 0} Notes »
                          </a>
                        </div>

                        <div class="forms-articles-grid" style="margin-top:10px;">
                          \${sub.articles && sub.articles.length > 0 ? sub.articles.map(art => \`
                            <a href="\${art.link}" class="forms-article-card">
                              <div class="forms-article-title">\${escapeHtml(art.title)}</div>
                              <div class="forms-article-meta">
                                <span class="forms-article-tag">✍️ \${escapeHtml(art.authorName || 'Rudhra Prarthana')}</span>
                                <span>📅 \${formatLastSeen(art.publishedAt)}</span>
                                <span>💬 \${art.commentsCount || 0} comments</span>
                              </div>
                            </a>
                          \`).join('') : \`
                            <div style="font-size:12px; color:#94A3B8; padding:8px 0;">No published notes in this section yet.</div>
                          \`}
                        </div>
                      </div>
                    \`;
                  }).join('') : ''}

                  <!-- 2. Novels List (Ongoing Novels, Completed Novels, Short Stories, Audio Novels) -->
                  \${novels.length > 0 ? \`
                    <div class="forms-novel-grid">
                      \${novels.map(n => \`
                        <a href="\${n.link}" class="forms-novel-card">
                          <img src="\${n.cover || '/default-cover.jpg'}" class="forms-novel-thumb" alt="\${escapeHtml(n.title)}" onerror="this.src='/default-cover.jpg'">
                          <div class="forms-novel-info">
                            <div class="forms-novel-title">\${escapeHtml(n.title)}</div>
                            <div class="forms-novel-episode">📖 \${escapeHtml(n.latestEpisodeTitle || 'Latest Release')}</div>
                            <div class="forms-novel-date">📅 \${escapeHtml(n.updatedDate || 'Recent')} • ✍️ \${escapeHtml(n.author || 'Rudhra Prarthana')}</div>
                          </div>
                          <div style="color:#B88635; font-size:16px;">➔</div>
                        </a>
                      \`).join('')}
                    </div>
                  \` : ''}

                  \${subs.length === 0 && novels.length === 0 ? \`
                    <div class="forms-cat-empty">
                      <span>No discussions or notes in <strong>\${escapeHtml(cat.title)}</strong> yet.</span>
                    </div>
                  \` : ''}
                </div>
              \`;
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
              \${renderSidebarPostItems(sidebarData?.latest)}
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
              \${renderSidebarPostItems(sidebarData?.trending)}
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
  \`;

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
`;

function updateAppJs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace renderForumView
  const fnStart = content.indexOf('// 5. FORUM COMMUNITY VIEW');
  const fnEnd = content.indexOf('export async function refreshForumLiveStats()');

  if (fnStart !== -1 && fnEnd !== -1) {
    content = content.slice(0, fnStart) + renderForumViewNewCode.trim() + '\n\n' + content.slice(fnEnd);
  } else {
    console.error('Could not find renderForumView boundary in', filePath);
    return;
  }

  // Update breadcrumb in renderContentReadingView
  content = content.replace(
    '<a href="#forms">${escapeHtml(art.subCategoryTitle)}</a>',
    '<a href="#forms?sub=${encodeURIComponent(art.subCategoryId || \'\')}">${escapeHtml(art.subCategoryTitle)}</a>'
  );
  content = content.replace(
    '<span class="crumb-current">${escapeHtml(art.subCategoryTitle)}</span>',
    '<a href="#forms?sub=${encodeURIComponent(art.subCategoryId || \'\')}">${escapeHtml(art.subCategoryTitle)}</a>'
  );
  content = content.replace(
    '<a href="#forms" class="content-back-btn">',
    '<a href="#forms?sub=${encodeURIComponent(art.subCategoryId || \'\')}" class="content-back-btn">'
  );

  // Append modalFunctionsCode if not already present
  if (!content.includes('window.openFormsAddContentModal')) {
    content += '\n' + modalFunctionsCode;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated', filePath);
}

updateAppJs('src/js/app.js');
updateAppJs('frontend/src/js/app.js');

