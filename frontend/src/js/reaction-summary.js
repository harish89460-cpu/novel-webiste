/**
 * =============================================================================
 * REACTION SUMMARY PANEL & DETAIL MODAL
 * =============================================================================
 * Compact, unified Like / Reaction Summary Panel matching the design:
 *   - Clean, light background (#F8FAFC)
 *   - Left red accent bar border (3px solid #DC2626 / #C8102E)
 *   - Overlapping/grouped emoji glyphs (e.g. 👍 😍)
 *   - Formatted text summary: "You, Idhazhya Isai, Mrs.Gnanasekarr and 38 others"
 *   - Accurate total reaction count
 *   - Hidden when total reactions === 0
 *   - Clickable to view complete list with avatars, usernames, and reaction emojis
 *   - Works across threads, chapters, novels, comments, replies, and profile posts
 * =============================================================================
 */

const REACTION_CACHE = new Map();

/**
 * Build the exact human-readable text summary:
 * e.g. "You, User1, User2 and 38 others"
 */
export function formatReactionSummaryText(reactors = [], total = 0) {
  if (!total || total <= 0) return '';
  if (!reactors || reactors.length === 0) {
    return `${total} ${total === 1 ? 'person' : 'people'}`;
  }

  // Find if current user reacted
  const currentUser = (typeof window !== 'undefined' && window.CURRENT_USER) ? window.CURRENT_USER : (function() {
    try {
      if (typeof localStorage !== 'undefined') {
        return JSON.parse(localStorage.getItem('rp_user'));
      }
      return null;
    } catch {
      return null;
    }
  })();
  const currentUserId = currentUser ? Number(currentUser.id) : null;

  // Prioritize current user ("You") first if present
  const sorted = [...reactors].sort((a, b) => {
    const aIsMe = Boolean((a.isCurrentUser) || (currentUserId && Number(a.userId) === currentUserId));
    const bIsMe = Boolean((b.isCurrentUser) || (currentUserId && Number(b.userId) === currentUserId));
    if (aIsMe && !bIsMe) return -1;
    if (!aIsMe && bIsMe) return 1;
    return 0;
  });

  const names = [];
  const MAX_NAMED = 3;

  for (let i = 0; i < sorted.length && names.length < MAX_NAMED; i++) {
    const r = sorted[i];
    const isMe = Boolean(r.isCurrentUser || (currentUserId && Number(r.userId) === currentUserId));
    const name = isMe ? 'You' : (r.name || r.username || 'Reader');
    if (!names.includes(name)) {
      names.push(name);
    }
  }

  const namedCount = names.length;
  const remainingCount = Math.max(0, total - namedCount);

  if (remainingCount > 0) {
    return `${names.join(', ')} and ${remainingCount} other${remainingCount === 1 ? '' : 's'}`;
  }

  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  if (names.length === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]}`;
  }

  return names.join(', ');
}

/**
 * Generate the HTML string for the compact reaction summary panel
 */
export function renderReactionSummaryPanelHtml({ targetType, targetId, total = 0, activeEmojis = [], reactors = [], extraClass = '' }) {
  const panelId = `rp-rx-panel-${targetType}-${targetId}`;
  const isHidden = !total || total <= 0;
  const emojis = (activeEmojis && activeEmojis.length > 0) ? activeEmojis.slice(0, 3) : ['👍'];
  const summaryText = formatReactionSummaryText(reactors, total);

  return `
    <div class="rp-reaction-summary-panel ${extraClass}" 
         id="${panelId}" 
         data-target-type="${escapeHtml(targetType)}" 
         data-target-id="${escapeHtml(String(targetId))}"
         role="button"
         tabindex="0"
         title="Click to view all reactions (${total})"
         onclick="window.openReactionDetailModal?.('${escapeQuotes(targetType)}', '${escapeQuotes(String(targetId))}')"
         onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); window.openReactionDetailModal?.('${escapeQuotes(targetType)}', '${escapeQuotes(String(targetId))}'); }"
         style="${isHidden ? 'display:none;' : ''}">
      <div class="rp-rx-summary-inner">
        <span class="rp-rx-emojis-cluster" id="${panelId}-emojis">
          ${emojis.map(e => `<span class="rp-rx-cluster-emoji">${escapeHtml(e)}</span>`).join('')}
        </span>
        <span class="rp-rx-summary-text" id="${panelId}-text">
          ${escapeHtml(summaryText)}
        </span>
      </div>
    </div>
  `;
}

/**
 * In-place DOM update for an existing summary panel without re-rendering parent container
 */
export function updateReactionSummaryPanel(targetType, targetId, reactionData = {}) {
  const panelId = `rp-rx-panel-${targetType}-${targetId}`;
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const total = Number(reactionData.total || reactionData.likesCount || 0);
  const reactors = reactionData.reactors || [];
  let activeEmojis = reactionData.activeEmojis || [];

  if (!activeEmojis.length && reactionData.counts) {
    activeEmojis = Object.keys(reactionData.counts).filter(e => reactionData.counts[e] > 0);
  }
  if (!activeEmojis.length && total > 0) {
    activeEmojis = ['👍'];
  }

  // Cache updated data for instant modal popup
  const cacheKey = `${targetType}:${targetId}`;
  REACTION_CACHE.set(cacheKey, { total, activeEmojis, reactors, counts: reactionData.counts });

  if (total <= 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  panel.setAttribute('title', `Click to view all reactions (${total})`);

  const emojisEl = document.getElementById(`${panelId}-emojis`);
  const textEl = document.getElementById(`${panelId}-text`);

  if (emojisEl) {
    const top = activeEmojis.slice(0, 3);
    emojisEl.innerHTML = top.map(e => `<span class="rp-rx-cluster-emoji">${escapeHtml(e)}</span>`).join('');
  }

  if (textEl) {
    textEl.textContent = formatReactionSummaryText(reactors, total);
  }
}

/**
 * Fetch reaction summary from backend API and update panel
 */
export async function refreshReactionSummary(targetType, targetId) {
  if (!targetType || !targetId) return null;
  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    let url = `/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;

    if (targetType === 'novel') {
      url = `/api/reactions?targetType=novel&targetId=${encodeURIComponent(targetId)}`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data && data.success) {
      updateReactionSummaryPanel(targetType, targetId, data);
      return data;
    }
  } catch (err) {
    console.warn('[ReactionSummary] refresh error:', err);
  }
  return null;
}

/**
 * Complete reaction list modal with tabs/filter by emoji & user details
 */
export async function openReactionDetailModal(targetType, targetId) {
  const cacheKey = `${targetType}:${targetId}`;
  let data = REACTION_CACHE.get(cacheKey);

  // If not in cache or missing reactors, fetch fresh from backend
  if (!data || !data.reactors || !data.reactors.length) {
    try {
      const token = localStorage.getItem('rp_auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, { headers });
      const apiData = await res.json();
      if (apiData && apiData.success) {
        data = apiData;
        REACTION_CACHE.set(cacheKey, apiData);
      }
    } catch {}
  }

  const reactors = data?.reactors || [];
  const total = Number(data?.total || data?.likesCount || reactors.length || 0);
  if (total <= 0) return;

  const modalId = 'rp-reaction-detail-modal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal-overlay open rp-reaction-modal-overlay';
  modal.style.cssText = 'position:fixed; inset:0; z-index:999999; display:flex; align-items:center; justify-content:center; background:rgba(11,31,51,0.65); backdrop-filter:blur(4px); padding:16px; box-sizing:border-box;';
  document.body.appendChild(modal);

  // Distinct active emojis for tab filtering
  const activeEmojis = Array.from(new Set(reactors.map(r => r.emoji || '👍'))).filter(Boolean);

  modal.innerHTML = `
    <div class="modal-card rp-reaction-modal-card" style="max-width:440px; width:100%; max-height:85vh; display:flex; flex-direction:column; background:#FFFFFF; border-radius:14px; overflow:hidden; box-shadow:0 20px 50px rgba(11,31,51,0.3); position:relative; margin:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #E2E8F0; background:#F8FAFC;">
        <h4 style="margin:0; font-family:var(--font-serif); font-size:1.1rem; color:#0B1F33; display:flex; align-items:center; gap:8px;">
          <span>Reactions</span>
          <span style="font-size:12px; font-weight:700; background:rgba(200,155,60,0.18); color:#92400E; padding:2px 8px; border-radius:12px;">${total}</span>
        </h4>
        <button type="button" class="rp-rx-modal-close" style="background:none; border:none; font-size:22px; cursor:pointer; color:#64748B; line-height:1; padding:4px;" title="Close">&times;</button>
      </div>

      <!-- Emoji filter bar -->
      ${activeEmojis.length > 1 ? `
        <div class="rp-rx-filter-bar" style="display:flex; gap:6px; padding:10px 16px; border-bottom:1px solid #F1F5F9; overflow-x:auto;">
          <button type="button" class="rp-rx-filter-chip active" data-filter="all" style="padding:4px 12px; font-size:12px; font-weight:700; border-radius:14px; border:1px solid #CBD5E1; background:#0B1F33; color:#FFFFFF; cursor:pointer;">
            All ${total}
          </button>
          ${activeEmojis.map(emoji => {
            const count = reactors.filter(r => r.emoji === emoji).length;
            return `
              <button type="button" class="rp-rx-filter-chip" data-filter="${escapeQuote(emoji)}" style="padding:4px 10px; font-size:12px; font-weight:600; border-radius:14px; border:1px solid #E2E8F0; background:#F8FAFC; color:#334E68; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                <span>${emoji}</span> <span>${count}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Reactors list -->
      <div class="rp-rx-reactors-list" style="padding:8px 12px; overflow-y:auto; flex:1; max-height:420px;">
        ${reactors.map(r => `
          <div class="rp-rx-reactor-item" data-emoji="${escapeQuote(r.emoji || '👍')}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; transition:background-color 0.15s ease;">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <div style="position:relative; width:38px; height:38px; flex-shrink:0;">
                <img src="${r.avatar || '/profile.png'}" alt="${escapeHtml(r.name)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:1.5px solid #E2E8F0;" onerror="this.src='/profile.png'">
                <span style="position:absolute; bottom:-3px; right:-3px; font-size:14px; line-height:1; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2));">${r.emoji || '👍'}</span>
              </div>
              <div style="min-width:0;">
                <div style="font-weight:700; font-size:13.5px; color:#0B1F33; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${escapeHtml(r.name || r.username)} ${r.isCurrentUser ? '<span style="font-size:11px; color:#C89B3C; font-weight:600;">(You)</span>' : ''}
                </div>
                <div style="font-size:11px; color:#64748B;">@${escapeHtml(r.username || 'member')}</div>
              </div>
            </div>
            <a href="#member?id=${encodeURIComponent(r.username || '')}" class="btn btn-outline btn-xs" style="font-size:11px; padding:3px 8px; flex-shrink:0;" onclick="document.getElementById('${modalId}')?.remove()">View Profile</a>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const closeModal = () => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKey);

  modal.querySelector('.rp-rx-modal-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Filter chips handler
  modal.querySelectorAll('.rp-rx-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll('.rp-rx-filter-chip').forEach(c => {
        c.style.background = '#F8FAFC';
        c.style.color = '#334E68';
        c.style.borderColor = '#E2E8F0';
        c.classList.remove('active');
      });
      chip.style.background = '#0B1F33';
      chip.style.color = '#FFFFFF';
      chip.style.borderColor = '#0B1F33';
      chip.classList.add('active');

      const filter = chip.getAttribute('data-filter');
      modal.querySelectorAll('.rp-rx-reactor-item').forEach(item => {
        if (filter === 'all' || item.getAttribute('data-emoji') === filter) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuotes(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

if (typeof window !== 'undefined') {
  window.renderReactionSummaryPanelHtml = renderReactionSummaryPanelHtml;
  window.updateReactionSummaryPanel = updateReactionSummaryPanel;
  window.refreshReactionSummary = refreshReactionSummary;
  window.openReactionDetailModal = openReactionDetailModal;
  window.formatReactionSummaryText = formatReactionSummaryText;
}
