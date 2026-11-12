/**
 * Rudhra Prarthana Novels — Admin Dynamic Update / Announcement Panels Controller
 * 
 * Features:
 * - Create, Edit, Toggle status, and Delete custom update panels
 * - Multi-category and novel-specific visibility targeting
 * - Drag & drop unified sidebar reordering (Desktop + Mobile touch Up/Down buttons)
 * - Real-time persistence to MySQL backend
 */

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';

// Safe HTML escaper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SYSTEM_PANEL_INFO = {
  system_latest_updates: {
    title: 'Latest Updates / Recent Activity',
    icon: '📝',
    badge: 'RECENT',
    badgeColor: '#1E3A8A',
    badgeBg: 'rgba(30, 58, 138, 0.1)',
    description: 'System-generated feed of newest forum discussions and novel chapter updates'
  },
  system_trending: {
    title: 'Trending Posts',
    icon: '🔥',
    badge: 'POPULAR',
    badgeColor: '#B45309',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    description: 'System-ranked popular community topics based on reader engagement'
  },
  system_profile_posts: {
    title: 'Latest Profile Posts',
    icon: '💬',
    badge: 'COMMUNITY',
    badgeColor: '#8C6116',
    badgeBg: 'rgba(200, 155, 60, 0.15)',
    description: 'Member & author micro-updates feed with inline community replies'
  }
};

let cachedAdminData = {
  panels: [],
  panelOrder: ['system_latest_updates', 'system_trending', 'system_profile_posts'],
  categories: [],
  subcategories: []
};

let isReordering = false;

/**
 * Main entry point: render the Update Panels Admin Tab
 */
export async function renderUpdatePanelsManagementTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-tab-loading" style="min-height:50vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;">
      <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      <div style="font-size:14px; color:#64748B;">Loading Dynamic Update Panels...</div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `;

  try {
    const res = await apiFetch('/api/admin/update-panels');
    const data = await res.json();

    if (!res.ok || !data.success) {
      canvas.innerHTML = `
        <div style="padding:32px; text-align:center; background:#FFF; border-radius:12px; border:1px solid #E2E8F0; margin:20px;">
          <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
          <h3 style="color:#0B1F33; margin:0 0 8px;">Failed to load update panels</h3>
          <p style="color:#64748B; font-size:14px; margin:0 0 16px;">${escapeHtml(data.error || 'Server error')}</p>
          <button type="button" class="btn btn-gold btn-sm" onclick="renderUpdatePanelsManagementTab(document.getElementById('admin-main-canvas'))">
            Try Again
          </button>
        </div>
      `;
      return;
    }

    cachedAdminData = {
      panels: Array.isArray(data.panels) ? data.panels : [],
      panelOrder: Array.isArray(data.panelOrder) ? data.panelOrder : ['system_latest_updates', 'system_trending', 'system_profile_posts'],
      categories: Array.isArray(data.categories) ? data.categories : [],
      subcategories: Array.isArray(data.subcategories) ? data.subcategories : []
    };

    renderUpdatePanelsView(canvas);
  } catch (err) {
    console.error('[Admin UpdatePanels Error]:', err);
    canvas.innerHTML = `
      <div style="padding:32px; text-align:center; background:#FFF; border-radius:12px; border:1px solid #E2E8F0; margin:20px;">
        <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
        <h3 style="color:#0B1F33; margin:0 0 8px;">Network or Authorization Error</h3>
        <p style="color:#64748B; font-size:14px; margin:0 0 16px;">${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-gold btn-sm" onclick="renderUpdatePanelsManagementTab(document.getElementById('admin-main-canvas'))">
          Try Again
        </button>
      </div>
    `;
  }
}

/**
 * Render the full management view HTML and bind drag-and-drop & button handlers
 */
function renderUpdatePanelsView(canvas) {
  const { panels, panelOrder, categories, subcategories } = cachedAdminData;

  // Build map of custom panels
  const customMap = new Map();
  panels.forEach(p => {
    customMap.set(`custom_${p.id}`, p);
    if (p.panelKey) customMap.set(p.panelKey, p);
  });

  // Ensure all known panels are in the unified order list
  const fullOrderList = [...panelOrder];
  // Ensure default system panels are present
  ['system_latest_updates', 'system_trending', 'system_profile_posts'].forEach(k => {
    if (!fullOrderList.includes(k)) fullOrderList.push(k);
  });
  // Ensure any custom panel not yet in order is appended
  panels.forEach(p => {
    const k = `custom_${p.id}`;
    if (!fullOrderList.includes(k)) fullOrderList.push(k);
  });

  canvas.innerHTML = `
    <div class="update-panels-admin-page" style="padding:24px 20px 48px; max-width:1200px; margin:0 auto;">
      
      <!-- Top Header -->
      <div class="update-panels-admin-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #E2E8F0;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <span style="font-size:26px; line-height:1;">📢</span>
            <h1 style="font-family:'Playfair Display',serif; font-size:24px; font-weight:700; color:#0B1F33; margin:0;">
              Dynamic Update & Announcement Panels
            </h1>
          </div>
          <p style="font-size:14px; color:#64748B; margin:0; max-width:700px; line-height:1.5;">
            Create custom update panels, target specific categories (e.g. Audio Novels, Ongoing Novels), and drag & drop to arrange the exact display position of all sidebar panels on the Forum page.
          </p>
        </div>
        
        <div style="display:flex; gap:10px; align-items:center;">
          <button type="button" 
                  class="btn btn-gold" 
                  id="btn-create-update-panel"
                  style="display:inline-flex; align-items:center; gap:8px; padding:9px 18px; font-weight:600; font-size:13.5px; border-radius:8px; background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%); color:#FFF; border:none; cursor:pointer; box-shadow:0 2px 8px rgba(200,155,60,0.35);">
            <span style="font-size:16px; font-weight:bold;">+</span>
            <span>Create Update Panel</span>
          </button>
        </div>
      </div>

      <!-- Grid layout: Left = Reorder Panel Arrangement; Right = Manage Custom Panels -->
      <div class="update-panels-grid" style="display:grid; grid-template-columns: 1fr 1.3fr; gap:24px; align-items:start;">
        
        <!-- SECTION 1: DRAG & DROP SIDEBAR PANEL PLACEMENT -->
        <div class="admin-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden;">
          <div style="padding:16px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 style="font-size:16px; font-weight:700; color:#0B1F33; margin:0 0 4px; display:flex; align-items:center; gap:8px;">
                <span>↕️</span>
                <span>Sidebar Panel Placement</span>
              </h2>
              <div style="font-size:12px; color:#64748B;">
                Drag handles ⠿ or use Up/Down buttons to reorder panels live on Forum page.
              </div>
            </div>
            <span id="reorder-status-badge" style="display:inline-block; font-size:11px; font-weight:700; padding:3px 8px; border-radius:20px; background:#DCFCE7; color:#15803D;">
              Live Synced
            </span>
          </div>

          <div id="panel-reorder-container" class="panel-reorder-list" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
            ${fullOrderList.map((key, idx) => {
              const isSystem = key.startsWith('system_');
              const sysInfo = isSystem ? SYSTEM_PANEL_INFO[key] : null;
              const customPanel = !isSystem ? customMap.get(key) : null;

              if (!sysInfo && !customPanel) return '';

              const title = isSystem ? sysInfo.title : customPanel.title;
              const icon = isSystem ? sysInfo.icon : (customPanel.icon || '📢');
              const badge = isSystem ? sysInfo.badge : (customPanel.badge || 'UPDATE');
              const badgeColor = isSystem ? sysInfo.badgeColor : (customPanel.badgeColor || '#B45309');
              const badgeBg = isSystem ? sysInfo.badgeBg : (customPanel.badgeBg || 'rgba(217,119,6,0.15)');
              const isCustom = !isSystem;
              const isFirst = idx === 0;
              const isLast = idx === fullOrderList.length - 1;
              const statusPill = isCustom ? (customPanel.status === 'active' ? `<span style="font-size:10.5px; font-weight:700; color:#15803D; background:#DCFCE7; padding:2px 6px; border-radius:4px;">Active</span>` : `<span style="font-size:10.5px; font-weight:700; color:#64748B; background:#F1F5F9; padding:2px 6px; border-radius:4px;">Disabled</span>`) : `<span style="font-size:10.5px; font-weight:700; color:#1E40AF; background:#DBEAFE; padding:2px 6px; border-radius:4px;">System</span>`;

              return `
                <div class="panel-drag-card" 
                     data-panel-key="${escapeHtml(key)}" 
                     data-index="${idx}"
                     draggable="true"
                     style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; cursor:grab; transition:all 0.15s ease; user-select:none; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                  
                  <!-- Drag Handle -->
                  <div class="drag-handle" title="Drag to reorder" style="cursor:grab; color:#94A3B8; font-size:18px; line-height:1; padding:2px 4px;">
                    ⠿
                  </div>

                  <!-- Order Position Pill -->
                  <div style="font-size:12px; font-weight:700; color:#64748B; width:22px; text-align:center;">
                    #${idx + 1}
                  </div>

                  <!-- Panel Info -->
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px; flex-wrap:wrap;">
                      <span style="font-size:16px;">${escapeHtml(icon)}</span>
                      <strong style="font-size:13.5px; color:#0B1F33; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(title)}</strong>
                      <span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:${escapeHtml(badgeBg)}; color:${escapeHtml(badgeColor)};">${escapeHtml(badge)}</span>
                      ${statusPill}
                    </div>
                    <div style="font-size:11.5px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${isSystem ? escapeHtml(sysInfo.description) : (customPanel.isGlobal ? 'Visible across all categories' : `Categories: ${getCategoryNamesList(customPanel.categories, categories)}`)}
                    </div>
                  </div>

                  <!-- Up / Down Action Controls (Touch & accessibility friendly) -->
                  <div class="panel-move-buttons" style="display:flex; flex-direction:column; gap:3px;">
                    <button type="button" 
                            class="btn-move-panel" 
                            data-key="${escapeHtml(key)}" 
                            data-direction="up" 
                            ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}
                            title="Move Up"
                            style="width:24px; height:22px; display:flex; align-items:center; justify-content:center; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:4px; font-size:10px; cursor:pointer; color:#334155;">
                      ▲
                    </button>
                    <button type="button" 
                            class="btn-move-panel" 
                            data-key="${escapeHtml(key)}" 
                            data-direction="down" 
                            ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}
                            title="Move Down"
                            style="width:24px; height:22px; display:flex; align-items:center; justify-content:center; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:4px; font-size:10px; cursor:pointer; color:#334155;">
                      ▼
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- SECTION 2: CUSTOM UPDATE PANELS MANAGEMENT -->
        <div class="admin-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden;">
          <div style="padding:16px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2 style="font-size:16px; font-weight:700; color:#0B1F33; margin:0 0 4px; display:flex; align-items:center; gap:8px;">
                <span>📋</span>
                <span>Custom Update Panels (${panels.length})</span>
              </h2>
              <div style="font-size:12px; color:#64748B;">
                Manage content, category targeting, and active state
              </div>
            </div>
            
            <button type="button" 
                    class="btn btn-gold btn-sm" 
                    id="btn-create-update-panel-2"
                    style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; font-size:12px; font-weight:700; border-radius:6px; background:#C89B3C; color:#FFF; border:none; cursor:pointer;">
              + New Panel
            </button>
          </div>

          <div style="padding:16px;">
            ${panels.length === 0 ? `
              <div style="padding:40px 20px; text-align:center; border:2px dashed #E2E8F0; border-radius:10px; background:#FAFBFD;">
                <div style="font-size:36px; margin-bottom:10px;">📢</div>
                <h3 style="font-size:15px; font-weight:700; color:#0B1F33; margin:0 0 6px;">No Custom Update Panels Created Yet</h3>
                <p style="font-size:13px; color:#64748B; margin:0 0 16px; max-width:400px; margin-left:auto; margin-right:auto; line-height:1.5;">
                  Create announcements for audio releases, chapter updates, or special novel notices. Target specific categories so readers only see relevant updates.
                </p>
                <button type="button" 
                        class="btn btn-gold btn-sm" 
                        id="btn-create-update-panel-empty"
                        style="padding:8px 16px; font-size:13px; font-weight:700; border-radius:8px; background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%); color:#FFF; border:none; cursor:pointer;">
                  + Create Your First Update Panel
                </button>
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:14px;">
                ${panels.map(panel => {
                  const isActive = panel.status === 'active';
                  const catsList = getCategoryNamesList(panel.categories, categories);
                  const novelsList = getNovelNamesList(panel.novels, subcategories);

                  return `
                    <div class="custom-panel-row" 
                         data-id="${panel.id}"
                         style="border:1px solid #E2E8F0; border-radius:10px; padding:16px; background:#FFFFFF; transition:box-shadow 0.15s ease;">
                      
                      <!-- Header -->
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span style="font-size:20px;">${escapeHtml(panel.icon || '📢')}</span>
                          <div>
                            <h3 style="font-size:15px; font-weight:700; color:#0B1F33; margin:0 0 2px;">
                              ${escapeHtml(panel.title)}
                            </h3>
                            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                              <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; background:${escapeHtml(panel.badgeBg || 'rgba(217,119,6,0.15)')}; color:${escapeHtml(panel.badgeColor || '#B45309')};">
                                ${escapeHtml(panel.badge || 'UPDATE')}
                              </span>
                              <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; ${isActive ? 'background:#DCFCE7; color:#15803D;' : 'background:#F1F5F9; color:#64748B;'}">
                                ${isActive ? '● Active' : '○ Disabled'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- Actions -->
                        <div style="display:flex; gap:6px; align-items:center;">
                          <button type="button" 
                                  class="btn-edit-panel" 
                                  data-id="${panel.id}" 
                                  title="Edit Panel"
                                  style="padding:5px 10px; font-size:12px; font-weight:600; border-radius:6px; background:#F8FAFC; border:1px solid #CBD5E1; color:#0B1F33; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                            <span>✏️</span> Edit
                          </button>
                          
                          <button type="button" 
                                  class="btn-toggle-panel" 
                                  data-id="${panel.id}" 
                                  data-status="${panel.status}" 
                                  title="${isActive ? 'Disable Panel' : 'Enable Panel'}"
                                  style="padding:5px 10px; font-size:12px; font-weight:600; border-radius:6px; background:#F8FAFC; border:1px solid #CBD5E1; color:${isActive ? '#D97706' : '#15803D'}; cursor:pointer;">
                            ${isActive ? 'Disable' : 'Enable'}
                          </button>

                          <button type="button" 
                                  class="btn-delete-panel" 
                                  data-id="${panel.id}" 
                                  data-title="${escapeQuote(panel.title)}" 
                                  title="Delete Panel"
                                  style="padding:5px 10px; font-size:12px; font-weight:600; border-radius:6px; background:#FEF2F2; border:1px solid #FECACA; color:#DC2626; cursor:pointer;">
                            🗑️
                          </button>
                        </div>
                      </div>

                      <!-- Content Snippet -->
                      <!-- Live Activity Tracking Indicator -->
                      <div style="font-size:13px; color:#334155; line-height:1.5; background:#F8FAFC; border-radius:6px; padding:10px 12px; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; border:1px solid #E2E8F0;">
                        <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600; color:#047857;">
                          <span style="width:8px; height:8px; border-radius:50%; background:#10B981; display:inline-block;"></span>
                          Live Activity Tracking Active
                        </span>
                        <span style="font-size:12px; color:#64748B;">
                          ${Array.isArray(panel.activities) ? panel.activities.length : 0} recent activities captured
                        </span>
                      </div>

                      <!-- Visibility Info Line -->
                      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#64748B; flex-wrap:wrap; gap:8px;">
                        <div>
                          <strong>Visibility:</strong> 
                          ${panel.isGlobal ? `<span style="color:#2563EB; font-weight:600;">Global (All Categories + Forum Overview)</span>` : `<span style="color:#0B1F33;">${escapeHtml(catsList)}${novelsList ? ` · Novels: ${escapeHtml(novelsList)}` : ''}</span>`}
                        </div>
                        <div style="font-size:11.5px; color:#94A3B8;">
                          By ${escapeHtml(panel.creatorName || 'Admin')} · ${escapeHtml(panel.updatedAt || panel.createdAt || '')}
                        </div>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

      </div>

    </div>
  `;

  // Bind all interactive handlers
  attachUpdatePanelsEventHandlers(canvas);
}

/**
 * Convert category IDs array to human-readable names
 */
function getCategoryNamesList(categoryIds, allCategories) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return 'All Categories';
  const names = [];
  for (const id of categoryIds) {
    if (id === 'forum_overview' || id === 'forum') {
      names.push('Main Forum Overview');
      continue;
    }
    const found = allCategories.find(c => String(c.id) === String(id));
    if (found) names.push(found.title);
    else names.push(id);
  }
  return names.join(', ');
}

/**
 * Convert novel/sub-category IDs array to human-readable names
 */
function getNovelNamesList(novelIds, allSubcategories) {
  if (!Array.isArray(novelIds) || novelIds.length === 0) return '';
  const names = [];
  for (const id of novelIds) {
    const found = allSubcategories.find(s => String(s.id) === String(id));
    if (found) names.push(found.title);
  }
  return names.join(', ');
}

/**
 * Attach Drag-and-Drop and Click Handlers
 */
function attachUpdatePanelsEventHandlers(canvas) {
  // 1. Create buttons
  const btnCreate1 = document.getElementById('btn-create-update-panel');
  const btnCreate2 = document.getElementById('btn-create-update-panel-2');
  const btnCreateEmpty = document.getElementById('btn-create-update-panel-empty');

  const openCreate = () => openUpdatePanelModal(null);
  if (btnCreate1) btnCreate1.onclick = openCreate;
  if (btnCreate2) btnCreate2.onclick = openCreate;
  if (btnCreateEmpty) btnCreateEmpty.onclick = openCreate;

  // 2. Edit buttons
  canvas.querySelectorAll('.btn-edit-panel').forEach(btn => {
    btn.onclick = () => {
      const panelId = parseInt(btn.dataset.id, 10);
      openUpdatePanelModal(panelId);
    };
  });

  // 3. Toggle Active/Disabled buttons
  canvas.querySelectorAll('.btn-toggle-panel').forEach(btn => {
    btn.onclick = async () => {
      const panelId = parseInt(btn.dataset.id, 10);
      const currentStatus = btn.dataset.status;
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      try {
        btn.disabled = true;
        btn.textContent = 'Updating...';
        const res = await apiFetch(`/api/admin/update-panels/${panelId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Panel status changed to ${newStatus}.`);
          window.dispatchEvent(new CustomEvent('rp:update-panels-updated'));
          await renderUpdatePanelsManagementTab(canvas);
        } else {
          showToast(data.error || 'Failed to update status');
          btn.disabled = false;
        }
      } catch (err) {
        showToast('Error: ' + err.message);
        btn.disabled = false;
      }
    };
  });

  // 4. Delete buttons
  canvas.querySelectorAll('.btn-delete-panel').forEach(btn => {
    btn.onclick = async () => {
      const panelId = parseInt(btn.dataset.id, 10);
      const title = btn.dataset.title;
      const confirmDelete = confirm(`Are you sure you want to delete update panel "${title}"?\n\nThis will permanently remove the panel from the website.`);
      if (!confirmDelete) return;

      try {
        btn.disabled = true;
        const res = await apiFetch(`/api/admin/update-panels/${panelId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`Update panel deleted successfully.`);
          window.dispatchEvent(new CustomEvent('rp:update-panels-updated'));
          await renderUpdatePanelsManagementTab(canvas);
        } else {
          showToast(data.error || 'Failed to delete panel');
          btn.disabled = false;
        }
      } catch (err) {
        showToast('Error: ' + err.message);
        btn.disabled = false;
      }
    };
  });

  // 5. Up / Down Move buttons
  canvas.querySelectorAll('.btn-move-panel').forEach(btn => {
    btn.onclick = async () => {
      const key = btn.dataset.key;
      const direction = btn.dataset.direction;
      const list = [...cachedAdminData.panelOrder];
      const currentIndex = list.indexOf(key);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return;

      // Swap
      list[currentIndex] = list[targetIndex];
      list[targetIndex] = key;

      cachedAdminData.panelOrder = list;
      await persistPanelOrder(list, canvas);
    };
  });

  // 6. Drag and Drop for Desktop
  setupDragAndDrop(canvas);
}

/**
 * Setup HTML5 Drag and Drop on .panel-drag-card
 */
function setupDragAndDrop(canvas) {
  const container = canvas.querySelector('#panel-reorder-container');
  if (!container) return;

  let draggedItem = null;

  const cards = container.querySelectorAll('.panel-drag-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedItem = card;
      card.style.opacity = '0.4';
      card.style.background = '#FEF3C7';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.panelKey);
    });

    card.addEventListener('dragend', async () => {
      if (draggedItem) {
        draggedItem.style.opacity = '1';
        draggedItem.style.background = '#FFFFFF';
        draggedItem = null;
      }
      cards.forEach(c => c.style.borderTop = '');

      // Extract new order from DOM
      const newOrder = [];
      container.querySelectorAll('.panel-drag-card').forEach(c => {
        if (c.dataset.panelKey) newOrder.push(c.dataset.panelKey);
      });

      cachedAdminData.panelOrder = newOrder;
      await persistPanelOrder(newOrder, canvas);
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedItem && draggedItem !== card) {
        const rect = card.getBoundingClientRect();
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        container.insertBefore(draggedItem, next ? card.nextSibling : card);
      }
    });
  });
}

/**
 * Persist Panel Order to the Backend
 */
async function persistPanelOrder(newOrder, canvas) {
  const statusBadge = document.getElementById('reorder-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Saving...';
    statusBadge.style.background = '#FEF3C7';
    statusBadge.style.color = '#92400E';
  }

  try {
    const res = await apiFetch('/api/admin/update-panels/reorder', {
      method: 'PUT',
      body: JSON.stringify({ panelOrder: newOrder })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (statusBadge) {
        statusBadge.textContent = 'Saved!';
        statusBadge.style.background = '#DCFCE7';
        statusBadge.style.color = '#15803D';
      }
      showToast('Sidebar panel order updated successfully!');
      window.dispatchEvent(new CustomEvent('rp:update-panels-updated'));
      // Re-render to update the # numbers and disabled up/down arrows
      setTimeout(() => renderUpdatePanelsView(canvas), 200);
    } else {
      showToast(data.error || 'Failed to save panel order');
    }
  } catch (err) {
    console.error('[PersistPanelOrder Error]:', err);
    showToast('Network error saving order: ' + err.message);
  }
}

/**
 * Open Modal to Create or Edit an Update Panel
 */
export function openUpdatePanelModal(panelId = null) {
  const isEdit = panelId !== null;
  const existing = isEdit ? cachedAdminData.panels.find(p => p.id === panelId) : null;

  const currentTitle = existing ? existing.title : '';
  const currentContent = existing ? existing.content : '';
  const currentBadge = existing ? existing.badge : 'UPDATE';
  const currentBadgeColor = existing ? existing.badgeColor : '#B45309';
  const currentBadgeBg = existing ? existing.badgeBg : 'rgba(217, 119, 6, 0.15)';
  const currentIcon = existing ? existing.icon : '📢';
  const currentIsGlobal = existing ? existing.isGlobal : false;
  const currentStatus = existing ? existing.status : 'active';
  const currentCategories = existing && Array.isArray(existing.categories) ? existing.categories : [];
  const currentNovels = existing && Array.isArray(existing.novels) ? existing.novels : [];

  const { categories, subcategories } = cachedAdminData;

  // Remove any open modal
  document.getElementById('modal-update-panel')?.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'modal-update-panel';
  modalOverlay.className = 'admin-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(11, 31, 51, 0.6);
    backdrop-filter: blur(4px); z-index: 10000; display: flex;
    align-items: center; justify-content: center; padding: 20px;
    animation: modalFadeIn 0.2s ease;
  `;

  modalOverlay.innerHTML = `
    <div class="admin-modal-box" style="background:#FFFFFF; border-radius:14px; width:100%; max-width:680px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.2); overflow:hidden;">
      
      <!-- Modal Header -->
      <div style="padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">${isEdit ? '✏️' : '📢'}</span>
          <div>
            <h3 style="margin:0; font-family:'Playfair Display',serif; font-size:18px; font-weight:700; color:#0B1F33;">
              ${isEdit ? 'Edit Update Panel' : 'Create New Update Panel'}
            </h3>
            <div style="font-size:12px; color:#64748B;">
              Configure title, badge, and category-based visibility
            </div>
          </div>
        </div>
        <button type="button" id="btn-close-update-panel-modal" style="background:none; border:none; font-size:20px; color:#64748B; cursor:pointer; padding:4px 8px; border-radius:6px;">✕</button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div style="padding:22px 24px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:18px;">
        
        <!-- Panel Title -->
        <div>
          <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
            Panel Title <span style="color:#DC2626;">*</span>
          </label>
          <input type="text" 
                 id="up-title-input" 
                 placeholder="e.g. Latest Audio Novel Updates or Ongoing Novel Releases" 
                 value="${escapeQuote(currentTitle)}"
                 style="width:100%; padding:10px 14px; font-size:14px; border:1px solid #CBD5E1; border-radius:8px; outline:none; box-sizing:border-box;">
        </div>

        <!-- Icon & Badge Configuration -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <!-- Icon Picker -->
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Icon
            </label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="text" 
                     id="up-icon-input" 
                     value="${escapeQuote(currentIcon)}" 
                     maxlength="4" 
                     style="width:54px; text-align:center; font-size:20px; padding:6px; border:1px solid #CBD5E1; border-radius:8px;">
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                ${['📢', '🎧', '📚', '✨', '🔔', '⚡', '💬', '🌟'].map(emoji => `
                  <button type="button" 
                          class="btn-pick-emoji" 
                          data-emoji="${emoji}"
                          style="background:#F1F5F9; border:1px solid #E2E8F0; border-radius:6px; padding:4px 6px; font-size:14px; cursor:pointer;">
                    ${emoji}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Badge Text -->
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#0B1F33; margin-bottom:6px;">
              Badge Text
            </label>
            <div style="display:flex; gap:6px;">
              <input type="text" 
                     id="up-badge-input" 
                     placeholder="e.g. UPDATE, AUDIO RELEASE" 
                     value="${escapeQuote(currentBadge)}"
                     style="flex:1; padding:8px 12px; font-size:13px; border:1px solid #CBD5E1; border-radius:8px; outline:none;">
            </div>
          </div>
        </div>

        <!-- Badge Color Theme Presets -->
        <div>
          <label style="display:block; font-size:12.5px; font-weight:700; color:#64748B; margin-bottom:6px;">
            Badge Color Theme
          </label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;" id="badge-theme-presets">
            <button type="button" class="btn-theme-preset" data-color="#B45309" data-bg="rgba(217, 119, 6, 0.15)" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; background:rgba(217, 119, 6, 0.15); color:#B45309; border:1px solid #B45309; cursor:pointer;">Amber (Default)</button>
            <button type="button" class="btn-theme-preset" data-color="#5B21B6" data-bg="rgba(91, 33, 182, 0.15)" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; background:rgba(91, 33, 182, 0.15); color:#5B21B6; border:1px solid #5B21B6; cursor:pointer;">Purple / Audio</button>
            <button type="button" class="btn-theme-preset" data-color="#047857" data-bg="rgba(4, 120, 87, 0.15)" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; background:rgba(4, 120, 87, 0.15); color:#047857; border:1px solid #047857; cursor:pointer;">Emerald / Success</button>
            <button type="button" class="btn-theme-preset" data-color="#1E40AF" data-bg="rgba(30, 64, 175, 0.15)" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; background:rgba(30, 64, 175, 0.15); color:#1E40AF; border:1px solid #1E40AF; cursor:pointer;">Royal Blue</button>
            <button type="button" class="btn-theme-preset" data-color="#BE123C" data-bg="rgba(190, 18, 60, 0.15)" style="padding:4px 10px; font-size:11.5px; font-weight:700; border-radius:6px; background:rgba(190, 18, 60, 0.15); color:#BE123C; border:1px solid #BE123C; cursor:pointer;">Rose / Alert</button>
          </div>
          <input type="hidden" id="up-badge-color" value="${escapeQuote(currentBadgeColor)}">
          <input type="hidden" id="up-badge-bg" value="${escapeQuote(currentBadgeBg)}">
        </div>

        <!-- Category & Novel Visibility Targeting -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <label style="font-size:13.5px; font-weight:700; color:#0B1F33; display:flex; align-items:center; gap:6px;">
                <span>🎯</span> Category-Based Visibility Rules
              </label>
              <div style="font-size:12px; color:#64748B; margin-top:2px;">
                Choose where this update panel appears. If specific categories are checked, it will ONLY appear in those categories and NOT in unrelated ones.
              </div>
            </div>
          </div>

          <!-- Global Checkbox -->
          <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed #CBD5E1;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#0B1F33; cursor:pointer;">
              <input type="checkbox" id="up-is-global-checkbox" ${currentIsGlobal ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
              <span>Show across All Categories and Main Forum Overview Page (Global)</span>
            </label>
          </div>

          <!-- Main Categories Checkboxes -->
          <div id="category-selection-container" style="${currentIsGlobal ? 'opacity:0.5; pointer-events:none;' : ''}">
            <div style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              Target Main Categories:
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:8px;">
              <label style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:#FAF5EC; border:1px solid #E8DCCB; border-radius:6px; font-size:12.5px; color:#0B1F33; cursor:pointer; font-weight:700;">
                <input type="checkbox" 
                       class="up-category-cb" 
                       value="forum_overview" 
                       ${currentCategories.includes('forum_overview') || currentCategories.includes('forum') ? 'checked' : ''}
                       style="width:15px; height:15px; cursor:pointer;">
                <span>🏛️ Main Forum Overview Page</span>
              </label>

              ${categories.map(cat => {
                const isChecked = currentCategories.includes(cat.id);
                return `
                  <label style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; font-size:12.5px; color:#0B1F33; cursor:pointer;">
                    <input type="checkbox" 
                           class="up-category-cb" 
                           value="${escapeQuote(cat.id)}" 
                           ${isChecked ? 'checked' : ''}
                           style="width:15px; height:15px; cursor:pointer;">
                    <span>${escapeHtml(cat.title)}</span>
                  </label>
                `;
              }).join('')}
            </div>

            <!-- Novel / Subcategory Targeting (Optional) -->
            ${subcategories.length > 0 ? `
              <div style="margin-top:14px;">
                <details style="font-size:12.5px;">
                  <summary style="cursor:pointer; font-weight:700; color:#8C6116; padding:4px 0;">
                    + Select Specific Subcategories / Novels (Optional)
                  </summary>
                  <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:6px; margin-top:8px; max-height:160px; overflow-y:auto; padding:6px; background:#FFF; border:1px solid #E2E8F0; border-radius:6px;">
                    ${subcategories.map(sub => {
                      const isChecked = currentNovels.includes(sub.id);
                      return `
                        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#334155; cursor:pointer;">
                          <input type="checkbox" 
                                 class="up-novel-cb" 
                                 value="${escapeQuote(sub.id)}" 
                                 ${isChecked ? 'checked' : ''}
                                 style="width:14px; height:14px; cursor:pointer;">
                          <span>${escapeHtml(sub.title)}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </details>
              </div>
            ` : ''}

          </div>
        </div>

        <!-- Status Toggle -->
        <div style="display:flex; align-items:center; gap:12px;">
          <label style="font-size:13px; font-weight:700; color:#0B1F33;">Panel Status:</label>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#15803D; cursor:pointer; font-weight:600;">
            <input type="radio" name="up-status" value="active" ${currentStatus === 'active' ? 'checked' : ''}>
            <span>Active (Visible)</span>
          </label>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#64748B; cursor:pointer;">
            <input type="radio" name="up-status" value="disabled" ${currentStatus === 'disabled' ? 'checked' : ''}>
            <span>Disabled (Hidden)</span>
          </label>
        </div>

      </div>

      <!-- Modal Footer -->
      <div style="padding:14px 24px; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:10px; background:#F8FAFC;">
        <button type="button" 
                id="btn-cancel-update-panel"
                style="padding:8px 16px; font-size:13.5px; font-weight:600; border-radius:8px; background:#FFFFFF; border:1px solid #CBD5E1; color:#334155; cursor:pointer;">
          Cancel
        </button>
        <button type="button" 
                id="btn-save-update-panel"
                style="padding:8px 20px; font-size:13.5px; font-weight:700; border-radius:8px; background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%); color:#FFFFFF; border:none; cursor:pointer; box-shadow:0 2px 8px rgba(200,155,60,0.35);">
          ${isEdit ? 'Save Changes' : 'Create Panel'}
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Close handlers
  const closeModal = () => modalOverlay.remove();
  document.getElementById('btn-close-update-panel-modal').onclick = closeModal;
  document.getElementById('btn-cancel-update-panel').onclick = closeModal;
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  // Preset Emoji buttons
  modalOverlay.querySelectorAll('.btn-pick-emoji').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('up-icon-input').value = btn.dataset.emoji;
    };
  });

  // Preset Theme buttons
  modalOverlay.querySelectorAll('.btn-theme-preset').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('up-badge-color').value = btn.dataset.color;
      document.getElementById('up-badge-bg').value = btn.dataset.bg;
      modalOverlay.querySelectorAll('.btn-theme-preset').forEach(b => b.style.outline = '');
      btn.style.outline = '2px solid #0B1F33';
    };
  });

  // Global checkbox toggles category selection disabled state
  const globalCb = document.getElementById('up-is-global-checkbox');
  const catContainer = document.getElementById('category-selection-container');
  if (globalCb && catContainer) {
    globalCb.onchange = () => {
      if (globalCb.checked) {
        catContainer.style.opacity = '0.5';
        catContainer.style.pointerEvents = 'none';
      } else {
        catContainer.style.opacity = '1';
        catContainer.style.pointerEvents = 'auto';
      }
    };
  }

  // Save button handler
  document.getElementById('btn-save-update-panel').onclick = async () => {
    const title = document.getElementById('up-title-input').value.trim();
    const icon = document.getElementById('up-icon-input').value.trim() || '📢';
    const badge = document.getElementById('up-badge-input').value.trim() || 'UPDATE';
    const badgeColor = document.getElementById('up-badge-color').value.trim() || '#B45309';
    const badgeBg = document.getElementById('up-badge-bg').value.trim() || 'rgba(217, 119, 6, 0.15)';
    const isGlobal = document.getElementById('up-is-global-checkbox').checked;
    const statusRadio = modalOverlay.querySelector('input[name="up-status"]:checked');
    const status = statusRadio ? statusRadio.value : 'active';

    if (!title) {
      alert('Please enter a Panel Title.');
      document.getElementById('up-title-input').focus();
      return;
    }

    // Collect checked categories
    const selectedCategories = [];
    modalOverlay.querySelectorAll('.up-category-cb:checked').forEach(cb => {
      selectedCategories.push(cb.value);
    });

    // Collect checked novels
    const selectedNovels = [];
    modalOverlay.querySelectorAll('.up-novel-cb:checked').forEach(cb => {
      selectedNovels.push(cb.value);
    });

    // If not global and no categories selected, alert user
    if (!isGlobal && selectedCategories.length === 0 && selectedNovels.length === 0) {
      const proceedGlobal = confirm('No specific category was selected. Would you like this panel to be displayed Globally across all categories?');
      if (!proceedGlobal) return;
    }

    const payload = {
      title,
      content: '',
      icon,
      badge,
      badgeColor,
      badgeBg,
      isGlobal: isGlobal || (selectedCategories.length === 0 && selectedNovels.length === 0),
      categories: selectedCategories,
      novels: selectedNovels,
      status
    };

    const saveBtn = document.getElementById('btn-save-update-panel');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const endpoint = isEdit ? `/api/admin/update-panels/${panelId}` : '/api/admin/update-panels';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(isEdit ? 'Update panel updated successfully!' : 'Update panel created successfully!');
        window.dispatchEvent(new CustomEvent('rp:update-panels-updated'));
        closeModal();
        const canvas = document.getElementById('admin-main-canvas');
        if (canvas) {
          await renderUpdatePanelsManagementTab(canvas);
        }
      } else {
        alert(data.error || 'Failed to save update panel');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Panel';
      }
    } catch (err) {
      console.error('[Save UpdatePanel Error]:', err);
      alert('Error saving update panel: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Panel';
    }
  };
}

