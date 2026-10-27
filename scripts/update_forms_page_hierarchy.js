import fs from 'node:fs';

const renderContentReadingCode = `
// ============================================================================
// DEDICATED CONTENT READING VIEW (Main Title -> Sub Title -> Content Title -> Reading Content)
// ============================================================================
async function renderContentReadingView(container, hash) {
  const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const slug = urlParams.get('slug') || urlParams.get('id') || (hash.includes('/') ? hash.split('/')[1] : '');

  container.innerHTML = \`
    <div class="content-reading-wrap">
      <div style="text-align:center; padding:60px 20px; color:#64748B;">
        <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading reading content...</div>
      </div>
    </div>
  \`;

  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = token ? { 'Authorization': \`Bearer \${token}\` } : {};
    const res = await fetch(\`/api/content/articles/\${encodeURIComponent(slug)}\`, { headers });
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

      container.innerHTML = \`
        <div class="content-reading-wrap">
          <nav class="forum-breadcrumbs" style="margin-bottom:20px;">
            <a href="#forms">Home</a>
            <span class="crumb-separator">›</span>
            <a href="#forms">Forms</a>
            <span class="crumb-separator">›</span>
            <span class="crumb-current">Unavailable</span>
          </nav>

          <div class="content-restricted-alert">
            <div style="font-size:42px; margin-bottom:12px;">\${icon}</div>
            <h2 style="font-family:var(--font-serif); color:#9A3412; margin:0 0 8px;">\${escapeHtml(errTitle)}</h2>
            <p style="color:#7C2D12; font-size:14px; margin-bottom:20px; line-height:1.6;">
              \${escapeHtml(errDesc)}
            </p>
            <div style="display:flex; justify-content:center; gap:12px;">
              <a href="#forms" class="btn btn-primary btn-sm">« Return to Forms &amp; Community</a>
              <a href="#novels" class="btn btn-outline btn-sm">Explore Novels</a>
            </div>
          </div>
        </div>
      \`;
      return;
    }

    const art = data.article;
    const authorAvatar = art.authorAvatar || '/profile.png';
    const commentsCount = Number(art.commentsCount || 0);

    container.innerHTML = \`
      <div class="content-reading-wrap">
        <!-- Breadcrumbs & Back Bar -->
        <nav class="forum-breadcrumbs" style="margin-bottom:14px;">
          <a href="#forms">Home</a>
          <span class="crumb-separator">›</span>
          <a href="#forms">Forms</a>
          <span class="crumb-separator">›</span>
          <a href="#forms">\${escapeHtml(art.mainCategoryTitle)}</a>
          <span class="crumb-separator">›</span>
          <span class="crumb-current">\${escapeHtml(art.subCategoryTitle)}</span>
        </nav>

        <div class="content-reading-back-bar">
          <a href="#forms" class="content-back-btn">
            <span>«</span> Back to \${escapeHtml(art.subCategoryTitle)}
          </a>
          <div style="font-size:12px; color:#64748B;">
            Published: <strong>\${new Date(art.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </div>
        </div>

        <!-- Main Reading Article Card -->
        <article class="content-reading-card">
          <div class="content-reading-badge">
            <span>🌸</span>
            <span>\${escapeHtml(art.mainCategoryTitle)} › \${escapeHtml(art.subCategoryTitle)}</span>
          </div>

          <h1 class="content-reading-headline">\${escapeHtml(art.title)}</h1>

          <div class="content-reading-meta-bar">
            <div class="content-author-chip">
              <img src="\${authorAvatar}" class="content-author-avatar" alt="\${escapeHtml(art.authorName)}" onerror="this.src='/profile.png'">
              <div>
                <div class="content-author-name">
                  \${escapeHtml(art.authorName)}
                  <span class="forms-role-badge" style="margin-left:6px;">Official Author</span>
                </div>
                <div class="content-author-sub">
                  <span>Rudhra Prarthana Literary Platform</span>
                </div>
              </div>
            </div>

            <div style="display:flex; gap:14px; font-size:12.5px; color:#64748B; align-items:center;">
              <span title="Views">👁️ \${art.viewsCount} reads</span>
              <span>•</span>
              <span title="Comments">💬 \${commentsCount} comments</span>
            </div>
          </div>

          <!-- Formatted Reading Content -->
          <div class="content-reading-body">
            \${art.content}
          </div>
        </article>

        <!-- Dedicated Comments Card -->
        <section class="content-reading-comments-card" id="article-comments-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #F1ECE4; padding-bottom:12px;">
            <h3 style="font-family:var(--font-serif); font-size:1.3rem; color:#1A0B2E; margin:0;">
              💬 Reader Thoughts &amp; Discussion (<span id="article-comments-counter">\${commentsCount}</span>)
            </h3>
          </div>

          <!-- Comment Input Form -->
          <div style="margin-bottom:28px;">
            \${window.IS_LOGGED_IN ? \`
              <form id="article-comment-form" onsubmit="window.submitArticleComment(event, \${art.id})">
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
            \` : \`
              <div style="background:#FAF7F2; border:1px dashed #C89B3C; border-radius:10px; padding:18px; text-align:center;">
                <p style="margin:0 0 10px 0; font-size:13.5px; color:#1A0B2E;">Log in to participate in the conversation and share your feedback.</p>
                <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">Log In to Comment</button>
              </div>
            \`}
          </div>

          <!-- Comments List Container -->
          <div id="article-comments-container">
            <div style="text-align:center; padding:20px; color:#64748B;">Loading comments...</div>
          </div>
        </section>
      </div>
    \`;

    // Load comments
    window.loadArticleComments(art.id);
  } catch (err) {
    console.error('Error rendering content reading view:', err);
    container.innerHTML = \`
      <div class="content-reading-wrap">
        <div class="content-restricted-alert">
          <h2>Failed to Load Content</h2>
          <p>\${escapeHtml(err.message)}</p>
          <a href="#forms" class="btn btn-primary btn-sm">Return to Forms</a>
        </div>
      </div>
    \`;
  }
}

window.loadArticleComments = async (articleId) => {
  const container = document.getElementById('article-comments-container');
  if (!container) return;
  try {
    const res = await fetch(\`/api/content/articles/\${articleId}/comments\`);
    const data = await res.json();
    const comments = data.comments || [];
    const counter = document.getElementById('article-comments-counter');
    if (counter) counter.textContent = data.total || comments.length;

    if (comments.length === 0) {
      container.innerHTML = \`
        <div style="text-align:center; padding:32px 16px; color:#64748B; background:#FAF7F2; border-radius:10px;">
          <div style="font-size:24px; margin-bottom:6px;">💬</div>
          <div style="font-size:13.5px; font-weight:600; color:#1A0B2E;">No comments yet</div>
          <div style="font-size:12px;">Be the first to share your thoughts on this note!</div>
        </div>
      \`;
      return;
    }

    container.innerHTML = comments.map(c => \`
      <div class="comment-item" style="border-bottom:1px solid #F1ECE4; padding:16px 0;" id="comment-item-\${c.id}">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <img src="\${c.avatar || '/profile.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png'" alt="">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div>
                <strong style="color:#1A0B2E; font-size:13.5px;">\${escapeHtml(c.author)}</strong>
                \${c.role === 'author' || c.role === 'admin' ? '<span class="forms-role-badge" style="margin-left:4px;">Author</span>' : ''}
              </div>
              <span style="font-size:11.5px; color:#64748B;">\${new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="font-size:13px; color:#2D3748; line-height:1.6; margin-bottom:8px;">
              \${escapeHtml(c.content)}
            </div>
            <div style="display:flex; gap:14px; font-size:11.5px;">
              \${window.IS_LOGGED_IN ? \`
                <button type="button" onclick="window.toggleReplyForm(\${c.id})" style="border:none; background:none; color:#6B21A8; font-weight:600; cursor:pointer; padding:0;">
                  Reply
                </button>
              \` : ''}
              \${(window.CURRENT_USER && (window.CURRENT_USER.id === c.userId || window.CURRENT_USER.isAdmin)) ? \`
                <button type="button" onclick="window.deleteArticleComment(\${articleId}, \${c.id})" style="border:none; background:none; color:#DC2626; font-weight:600; cursor:pointer; padding:0;">
                  Delete
                </button>
              \` : ''}
            </div>

            <!-- Inline reply form container -->
            <div id="reply-form-\${c.id}" style="display:none; margin-top:10px;">
              <textarea id="reply-input-\${c.id}" rows="2" class="form-input" style="width:100%; border-radius:8px; border:1px solid #CBD5E1; padding:8px; font-size:12.5px; margin-bottom:6px;" placeholder="Write a reply..."></textarea>
              <div style="text-align:right; display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn btn-outline btn-xs" onclick="window.toggleReplyForm(\${c.id})">Cancel</button>
                <button type="button" class="btn btn-gold btn-xs" onclick="window.submitArticleReply(\${articleId}, \${c.id})">Submit Reply</button>
              </div>
            </div>

            <!-- Nested Replies -->
            \${(c.replies && c.replies.length > 0) ? \`
              <div style="margin-top:12px; margin-left:14px; border-left:2px solid #E9D5FF; padding-left:12px;">
                \${c.replies.map(rep => \`
                  <div style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div>
                        <strong style="color:#1A0B2E; font-size:12.5px;">\${escapeHtml(rep.author)}</strong>
                        \${rep.role === 'author' || rep.role === 'admin' ? '<span class="forms-role-badge" style="margin-left:4px;">Author</span>' : ''}
                      </div>
                      <span style="font-size:11px; color:#64748B;">\${new Date(rep.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style="font-size:12.5px; color:#2D3748; line-height:1.5;">\${escapeHtml(rep.content)}</div>
                  </div>
                \`).join('')}
              </div>
            \` : ''}
          </div>
        </div>
      </div>
    \`).join('');
  } catch (err) {
    console.error('Failed to load article comments:', err);
    container.innerHTML = \`<div style="color:#DC2626; font-size:12px; text-align:center;">Failed to load comments: \${escapeHtml(err.message)}</div>\`;
  }
};

window.toggleReplyForm = (commentId) => {
  const form = document.getElementById(\`reply-form-\${commentId}\`);
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
    const res = await fetch(\`/api/content/articles/\${articleId}/comments\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`
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
  const input = document.getElementById(\`reply-input-\${parentId}\`);
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(\`/api/content/articles/\${articleId}/comments\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`
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
    const res = await fetch(\`/api/content/articles/\${articleId}/comments/\${commentId}\`, {
      method: 'DELETE',
      headers: { 'Authorization': \`Bearer \${token}\` }
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
`;

function updateAppJs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add route in renderAppView
  const routeTarget = `} else if (hash.startsWith('#forum') || hash.startsWith('#forms')) {
      await renderForumView(main, hash);`;
  const routeReplacement = `} else if (hash.startsWith('#forum') || hash.startsWith('#forms')) {
      await renderForumView(main, hash);
    } else if (hash.startsWith('#content?') || hash.startsWith('#content/')) {
      await renderContentReadingView(main, hash);`;

  if (!content.includes('#content?')) {
    content = content.replace(routeTarget, routeReplacement);
  }

  // 2. Enhance renderForumView to fetch hierarchy and render 3-level categories
  const oldForumViewStart = 'async function renderForumView(container, hash = \'\') {';
  const oldForumViewEnd = 'loadForumMembersOnline();';

  const startIdx = content.indexOf(oldForumViewStart);
  const endIdx = content.indexOf(oldForumViewEnd);

  if (startIdx !== -1 && endIdx !== -1) {
    const newForumViewHeader = `async function renderForumView(container, hash = '') {
  const urlParams = new URLSearchParams(hash.split('?')[1] || '');
  const currentCategoryId = urlParams.get('category');

  const token = localStorage.getItem('rp_auth_token');
  const headers = token ? { 'Authorization': \`Bearer \${token}\` } : {};

  const [hierarchyData, sidebarData, liveStats] = await Promise.all([
    fetch('/api/content/hierarchy', { headers }).then(r => r.json()).catch(() => ({ hierarchy: [] })),
    getSidebarPosts(),
    getForumLiveStats()
  ]);

  const hierarchy = Array.isArray(hierarchyData?.hierarchy) ? hierarchyData.hierarchy : [];
  const currentCategory = currentCategoryId ? hierarchy.find(c => String(c.id) === String(currentCategoryId)) : null;

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
              const totalItems = subs.reduce((acc, s) => acc + (s.articles?.length || 0), 0) + novels.length;

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

                  <!-- 1. Subcategory Groups (Main Title -> Sub Titles -> Content Titles) -->
                  \${subs.length > 0 ? subs.map(sub => \`
                    <div class="forms-sub-section">
                      <div class="forms-sub-header">
                        <div class="forms-sub-title-wrap">
                          <span class="forms-sub-icon">\${sub.icon || '📌'}</span>
                          <h3 class="forms-sub-title">\${escapeHtml(sub.title)}</h3>
                        </div>
                        <span style="font-size:11px; color:#B88635; font-weight:700;">\${sub.articles?.length || 0} Notes</span>
                      </div>
                      \${sub.description ? \`<div class="forms-sub-desc">\${escapeHtml(sub.description)}</div>\` : ''}

                      <div class="forms-articles-grid" style="margin-top:10px;">
                        \${sub.articles && sub.articles.length > 0 ? sub.articles.map(art => \`
                          <a href="\${art.link}" class="forms-article-card">
                            <div>
                              <div class="forms-article-title">\${escapeHtml(art.title)}</div>
                              \${art.summary ? \`<div style="font-size:12px; color:#64748B; margin-bottom:8px; line-height:1.4;">\${escapeHtml(art.summary)}</div>\` : ''}
                            </div>
                            <div class="forms-article-meta">
                              <span class="forms-article-tag">✍️ \${escapeHtml(art.authorName)}</span>
                              <span>📅 \${formatLastSeen(art.publishedAt)}</span>
                              <span>💬 \${art.commentsCount} comments</span>
                            </div>
                          </a>
                        \`).join('') : \`
                          <div style="font-size:12px; color:#94A3B8; padding:8px 0;">No published notes in this section yet.</div>
                        \`}
                      </div>
                    </div>
                  \`).join('') : ''}

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

  `;

    content = content.slice(0, startIdx) + newForumViewHeader + content.slice(endIdx);
  }

  // 3. Append renderContentReadingCode if not present
  if (!content.includes('function renderContentReadingView')) {
    content += '\n' + renderContentReadingCode;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated', filePath);
}

updateAppJs('src/js/app.js');
updateAppJs('frontend/src/js/app.js');

