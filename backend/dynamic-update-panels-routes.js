/**
 * Rudhra Prarthana Novels — Dynamic Updates / Announcement Panel System
 * 
 * Manages:
 * - Creation, Editing, Deletion, and Toggling of custom update/announcement panels
 * - Multi-category and specific novel visibility rules
 * - Drag-and-drop persistent ordering across all sidebar panels (system & custom)
 * - Strict Admin authorization (viewable by members/guests according to category filter)
 * - Live real-time activity tracking across categories & novels
 */

import { query, queryOne } from './db.js';

// Default panel ordering if not set
export const DEFAULT_SIDEBAR_PANEL_ORDER = [
  'system_latest_updates',
  'system_trending',
  'system_profile_posts'
];

/**
 * Check if the authenticated user has Administrator privileges
 */
export function isUserAdmin(user) {
  if (!user) return false;
  if (user.isAdmin === true || user.is_admin === 1 || user.isAuthorSession === true) return true;
  const role = String(user.role || '').trim().toLowerCase();
  return ['admin', 'administrator', 'editor', 'moderator'].includes(role) || user.email === 'digitalmarkservices.in@gmail.com';
}

/**
 * Retrieve the saved sidebar panel order from site_settings
 */
export async function getSidebarPanelOrder() {
  try {
    const row = await queryOne(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'forum_sidebar_panel_order' LIMIT 1;"
    );
    if (row && row.setting_value) {
      const parsed = JSON.parse(row.setting_value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[UpdatePanels] Error reading forum_sidebar_panel_order:', err.message);
  }
  return [...DEFAULT_SIDEBAR_PANEL_ORDER];
}

/**
 * Save the unified sidebar panel order in site_settings
 */
export async function saveSidebarPanelOrder(orderArray) {
  if (!Array.isArray(orderArray)) return false;
  const jsonStr = JSON.stringify(orderArray);
  await query(`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES ('forum_sidebar_panel_order', ?, NOW())
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW();
  `, [jsonStr]);
  return true;
}

/**
 * Safe JSON parsing helper
 */
function safeJsonParse(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
  if (!date) return 'Recently';
  const safeDateStr = typeof date === 'string' && date.includes(' ') && !date.includes('T')
    ? date.replace(' ', 'T')
    : date;
  const d = new Date(safeDateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now - d) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1 min ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Record a live activity into panel_activities
 */
export async function recordPanelActivity({
  categoryId,
  subCategoryId = null,
  novelId = null,
  userId,
  userName = null,
  userAvatar = null,
  activityType,
  title,
  preview = null,
  emoji = null,
  targetType,
  targetId,
  url
}) {
  if (!categoryId || !userId || !activityType || !targetType || !targetId || !title || !url) {
    return null;
  }

  try {
    let finalName = userName;
    let finalAvatar = userAvatar;
    if (!finalName || !finalAvatar) {
      const u = await queryOne(`
        SELECT u.username, COALESCE(p.display_name, u.username) AS name, p.avatar
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = ?;
      `, [userId]);
      if (u) {
        finalName = finalName || u.name || u.username;
        finalAvatar = finalAvatar || u.avatar || '/profile.png';
      }
    }

    const cleanPreview = preview ? preview.replace(/<[^>]+>/g, '').trim().slice(0, 150) : null;

    // Check if an identical activity already exists for user + target + activityType to avoid duplicates
    const existing = await queryOne(`
      SELECT id FROM panel_activities
      WHERE user_id = ? AND target_type = ? AND target_id = ? AND activity_type = ?
      LIMIT 1;
    `, [userId, targetType, String(targetId), activityType]);

    if (existing) {
      await query(`
        UPDATE panel_activities
        SET category_id = ?, sub_category_id = ?, novel_id = ?,
            user_name = ?, user_avatar = ?, title = ?, preview = ?,
            emoji = ?, url = ?, updated_at = NOW()
        WHERE id = ?;
      `, [
        categoryId, subCategoryId, novelId,
        finalName || 'Member', finalAvatar || '/profile.png',
        title, cleanPreview, emoji, url,
        existing.id
      ]);
      return existing.id;
    }

    const res = await query(`
      INSERT INTO panel_activities (
        category_id, sub_category_id, novel_id, user_id, user_name, user_avatar,
        activity_type, title, preview, emoji, target_type, target_id, url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      categoryId, subCategoryId, novelId,
      userId, finalName || 'Member', finalAvatar || '/profile.png',
      activityType, title, cleanPreview, emoji, targetType, String(targetId), url
    ]);

    return res.insertId;
  } catch (err) {
    console.warn('[RecordPanelActivity Error]:', err.message);
    return null;
  }
}

/**
 * Remove an activity record (e.g. When a like/reaction is removed, or thread/comment deleted)
 */
export async function removePanelActivity({ targetType, targetId, userId = null, activityType = null }) {
  if (!targetType || !targetId) return false;
  try {
    let sql = 'DELETE FROM panel_activities WHERE target_type = ? AND target_id = ?';
    const params = [targetType, String(targetId)];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (activityType) {
      sql += ' AND activity_type = ?';
      params.push(activityType);
    }

    await query(sql, params);
    return true;
  } catch (err) {
    console.warn('[RemovePanelActivity Error]:', err.message);
    return false;
  }
}

/**
 * Resolves main_category_id, sub_category_id, novel_id, title and url for a target
 */
export async function resolveCategoryForTarget(targetType, targetId, novelId = null) {
  let articleId = null;
  if (targetType === 'content' || targetType === 'thread') {
    articleId = targetId;
  } else if (novelId) {
    if (String(novelId).startsWith('content_')) {
      articleId = String(novelId).replace('content_', '');
    } else {
      articleId = novelId;
    }
  }

  if (articleId) {
    const art = await queryOne(
      'SELECT id, main_category_id, sub_category_id, title, unique_slug FROM content_articles WHERE id = ? OR unique_slug = ? LIMIT 1',
      [articleId, articleId]
    );
    if (art) {
      return {
        categoryId: String(art.main_category_id || ''),
        subCategoryId: art.sub_category_id ? String(art.sub_category_id) : null,
        novelId: String(art.id),
        title: art.title,
        url: `#thread?id=${encodeURIComponent(art.unique_slug || art.id)}`
      };
    }
  }

  if (targetType === 'comment' && targetId) {
    const comm = await queryOne('SELECT id, novel_id FROM comments WHERE id = ? LIMIT 1;', [targetId]);
    if (comm && comm.novel_id) {
      return resolveCategoryForTarget('comment', null, comm.novel_id);
    }
  }

  // Fallback check in content_subcategories
  if (novelId) {
    const sub = await queryOne('SELECT id, main_category_id, title FROM content_subcategories WHERE id = ? LIMIT 1;', [novelId]);
    if (sub) {
      return {
        categoryId: String(sub.main_category_id || ''),
        subCategoryId: String(sub.id),
        novelId: String(sub.id),
        title: sub.title,
        url: `#forum?category=${encodeURIComponent(sub.main_category_id)}&sub=${encodeURIComponent(sub.id)}`
      };
    }
  }

  return { categoryId: 'general', subCategoryId: null, novelId: null, title: 'Discussion Thread', url: '#forum' };
}

/**
 * Fetch live activities for an update panel according to its category & novel configuration
 */
export async function getPanelActivitiesForPanel(panel, limit = 8) {
  if (!panel) return [];
  try {
    const isGlobal = Boolean(panel.isGlobal);
    const categories = Array.isArray(panel.categories) ? panel.categories : [];
    const novels = Array.isArray(panel.novels) ? panel.novels : [];

    let whereClause = '';
    const params = [];

    if (!isGlobal && (categories.length > 0 || novels.length > 0)) {
      const conditions = [];

      if (categories.length > 0) {
        const normCats = Array.from(new Set(categories.flatMap(c => {
          const s = String(c).trim();
          return [s, s.replace(/_/g, '-'), s.replace(/-/g, '_')];
        })));
        const placeholders = normCats.map(() => '?').join(',');
        conditions.push(`(category_id IN (${placeholders}) OR REPLACE(category_id, '-', '_') IN (${placeholders}))`);
        params.push(...normCats, ...normCats);
      }

      if (novels.length > 0) {
        const placeholders = novels.map(() => '?').join(',');
        conditions.push(`(sub_category_id IN (${placeholders}) OR novel_id IN (${placeholders}))`);
        params.push(...novels, ...novels);
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' OR ')}`;
      }
    }

    const sql = `
      SELECT id, category_id, sub_category_id, novel_id, user_id, user_name, user_avatar,
             activity_type, title, preview, emoji, target_type, target_id, url, created_at, updated_at
      FROM panel_activities
      ${whereClause}
      ORDER BY GREATEST(created_at, COALESCE(updated_at, created_at)) DESC, id DESC
      LIMIT ?;
    `;
    params.push(limit);

    const rows = await query(sql, params);
    return rows.map(r => {
      const effectiveDate = r.updated_at && new Date(r.updated_at) > new Date(r.created_at) ? r.updated_at : r.created_at;
      return {
        id: r.id,
        categoryId: r.category_id,
        subCategoryId: r.sub_category_id,
        novelId: r.novel_id,
        userId: r.user_id,
        userName: r.user_name || 'Member',
        userAvatar: r.user_avatar || '/profile.png',
        activityType: r.activity_type,
        title: r.title,
        preview: r.preview || '',
        emoji: r.emoji,
        targetType: r.target_type,
        targetId: r.target_id,
        url: r.url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        timeAgo: formatRelativeTime(effectiveDate)
      };
    });
  } catch (err) {
    console.warn('[GetPanelActivitiesForPanel Error]:', err.message);
    return [];
  }
}

/**
 * Format a raw database row into a structured panel object
 */
function formatPanel(row) {
  if (!row) return null;
  return {
    id: row.id,
    panelKey: `custom_${row.id}`,
    title: row.title,
    content: row.content,
    badge: row.badge || 'UPDATE',
    badgeColor: row.badge_color || '#B45309',
    badgeBg: row.badge_bg || 'rgba(217, 119, 6, 0.15)',
    icon: row.icon || '📢',
    categories: safeJsonParse(row.categories_json, []),
    novels: safeJsonParse(row.novels_json, []),
    isGlobal: Boolean(row.is_global),
    status: row.status || 'active',
    sortOrder: Number(row.sort_order || 0),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Main HTTP router for Dynamic Update Panels
 */
export async function handleDynamicUpdatePanelsEndpoints(
  req,
  res,
  pathname,
  method,
  parsed,
  currentUser,
  sendJson,
  readJsonBody
) {
  const normPath = pathname.startsWith('/api') ? pathname.replace(/^\/api/, '') : pathname;

  // --------------------------------------------------------------------------
  // 1. PUBLIC: GET /api/update-panels
  // Fetch active update panels filtered by current category / subcategory context
  // --------------------------------------------------------------------------
  if (normPath === '/update-panels' && method === 'GET') {
    try {
      const categoryId = (parsed.query?.category || '').trim();
      const subCategoryId = (parsed.query?.sub || parsed.query?.subCategory || '').trim();
      const isOverview = !categoryId && !subCategoryId;

      const rows = await query(`
        SELECT * FROM dynamic_update_panels
        WHERE status = 'active'
        ORDER BY sort_order ASC, id ASC;
      `);

      const allActive = rows.map(formatPanel);

      // If viewing a subcategory and categoryId wasn't passed, resolve parent category from DB
      let resolvedCategoryId = categoryId;
      if (!resolvedCategoryId && subCategoryId) {
        try {
          const subRow = await queryOne('SELECT main_category_id FROM content_subcategories WHERE id = ? LIMIT 1;', [subCategoryId]);
          if (subRow && subRow.main_category_id) {
            resolvedCategoryId = subRow.main_category_id;
          }
        } catch (e) {
          console.warn('[UpdatePanels] Error resolving subcategory parent:', e.message);
        }
      }

      // Apply category, novel, and forum overview visibility rules
      const visiblePanels = allActive.filter(p => {
        // 1. If panel is explicitly configured to show globally across all pages
        if (p.isGlobal) {
          return true;
        }

        // 2. If panel has no restrictive category filter or novel filter, it shows everywhere
        if ((!p.categories || p.categories.length === 0) && (!p.novels || p.novels.length === 0)) {
          return true;
        }

        // 3. Main Forum overview page (#forum / #forms):
        if (isOverview) {
          // Visible if explicitly marked for forum_overview / forum
          if (p.categories && (p.categories.includes('forum_overview') || p.categories.includes('forum') || p.categories.includes('overview') || p.categories.includes('all'))) {
            return true;
          }
          // Also, update panels targeted to any of the forum categories are showcased in the Forum sidebar
          if (p.categories && p.categories.length > 0) {
            return true;
          }
          return false;
        }

        // 4. Specific category view (e.g. #forum?category=audio-novels)
        if (resolvedCategoryId) {
          // Direct match
          if (p.categories && p.categories.includes(resolvedCategoryId)) {
            return true;
          }
          // Normalized match (handling rudhra_prarthana_tamil_novels vs rudhraprarthana_tamil_novels)
          const normCat = resolvedCategoryId.replace(/_/g, '').toLowerCase();
          if (p.categories && p.categories.some(c => String(c).replace(/_/g, '').toLowerCase() === normCat)) {
            return true;
          }
        }

        // 5. Specific subcategory / novel view (e.g. #forum?sub=konjam_ullam_sinthidu)
        if (subCategoryId) {
          if (p.novels && p.novels.includes(subCategoryId)) {
            return true;
          }
          if (resolvedCategoryId && p.categories && p.categories.includes(resolvedCategoryId)) {
            return true;
          }
          const normCat = resolvedCategoryId ? resolvedCategoryId.replace(/_/g, '').toLowerCase() : '';
          if (normCat && p.categories && p.categories.some(c => String(c).replace(/_/g, '').toLowerCase() === normCat)) {
            return true;
          }
        }

        return false;
      });

      const panelOrder = await getSidebarPanelOrder();

      // Populate live activities for each visible panel
      for (const p of visiblePanels) {
        p.activities = await getPanelActivitiesForPanel(p, 8);
      }

      if (res.setHeader) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }

      return sendJson(res, {
        success: true,
        panels: visiblePanels,
        panelOrder
      }, 200);
    } catch (err) {
      console.error('[UpdatePanels GET Error]:', err);
      return sendJson(res, { success: false, error: 'Failed to retrieve update panels' }, 500);
    }
  }

  // --------------------------------------------------------------------------
  // ADMIN ONLY ENDPOINTS:
  // Requires user to be authenticated and have Admin privileges
  // --------------------------------------------------------------------------
  const isAdminRoute = normPath === '/admin/update-panels' ||
                       normPath.startsWith('/admin/update-panels/');

  if (isAdminRoute) {
    if (!currentUser || !isUserAdmin(currentUser)) {
      return sendJson(res, {
        success: false,
        error: 'Administrator authorization required.'
      }, 403);
    }

    // 2. ADMIN: GET /api/admin/update-panels
    if (normPath === '/admin/update-panels' && method === 'GET') {
      try {
        const rows = await query(`
          SELECT p.*, u.username as creator_name
          FROM dynamic_update_panels p
          LEFT JOIN users u ON u.id = p.created_by
          ORDER BY p.sort_order ASC, p.id ASC;
        `);

        const panels = rows.map(r => ({
          ...formatPanel(r),
          creatorName: r.creator_name || 'Admin'
        }));

        // Populate live activities snippet for each panel in admin view
        for (const p of panels) {
          p.activities = await getPanelActivitiesForPanel(p, 6);
        }

        // Fetch available categories and subcategories for the configuration modal
        const categories = await query(`
          SELECT id, title, icon, sort_order
          FROM forum_categories
          ORDER BY sort_order ASC, title ASC;
        `);

        const subcategories = await query(`
          SELECT id, main_category_id, parent_id, title, sort_order
          FROM content_subcategories
          ORDER BY sort_order ASC, title ASC;
        `);

        const panelOrder = await getSidebarPanelOrder();

        return sendJson(res, {
          success: true,
          panels,
          panelOrder,
          categories,
          subcategories
        }, 200);
      } catch (err) {
        console.error('[Admin UpdatePanels GET Error]:', err);
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 3. ADMIN: PUT /api/admin/update-panels/reorder
    if (normPath === '/admin/update-panels/reorder' && method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        const { panelOrder } = body || {};

        if (!Array.isArray(panelOrder)) {
          return sendJson(res, { success: false, error: 'panelOrder must be an array of panel keys.' }, 400);
        }

        // Clean & ensure all system panels are retained if omitted
        const cleanOrder = [];
        for (const item of panelOrder) {
          if (typeof item === 'string' && item.trim() && !cleanOrder.includes(item.trim())) {
            cleanOrder.push(item.trim());
          }
        }

        for (const sys of DEFAULT_SIDEBAR_PANEL_ORDER) {
          if (!cleanOrder.includes(sys)) {
            cleanOrder.push(sys);
          }
        }

        // Save order in site_settings
        await saveSidebarPanelOrder(cleanOrder);

        // Also update sort_order in dynamic_update_panels for custom panels
        for (let i = 0; i < cleanOrder.length; i++) {
          const key = cleanOrder[i];
          if (key.startsWith('custom_')) {
            const customId = parseInt(key.replace('custom_', ''), 10);
            if (!isNaN(customId)) {
              await query(`UPDATE dynamic_update_panels SET sort_order = ? WHERE id = ?;`, [i, customId]);
            }
          }
        }

        return sendJson(res, {
          success: true,
          message: 'Sidebar panel order updated successfully.',
          panelOrder: cleanOrder
        }, 200);
      } catch (err) {
        console.error('[Admin UpdatePanels Reorder Error]:', err);
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 4. ADMIN: POST /api/admin/update-panels
    if (normPath === '/admin/update-panels' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const title = (body.title || '').trim();
        const content = (body.content || '').trim();

        if (!title) {
          return sendJson(res, { success: false, error: 'Panel title is required.' }, 400);
        }

        const badge = (body.badge || 'UPDATE').trim();
        const badgeColor = (body.badgeColor || '#B45309').trim();
        const badgeBg = (body.badgeBg || 'rgba(217, 119, 6, 0.15)').trim();
        const icon = (body.icon || '📢').trim();
        const categories = Array.isArray(body.categories) ? body.categories : [];
        const novels = Array.isArray(body.novels) ? body.novels : [];
        const isGlobal = body.isGlobal === true || body.isGlobal === 1 || categories.length === 0 ? 1 : 0;
        const status = body.status === 'disabled' ? 'disabled' : 'active';

        // Compute max sort_order
        const maxOrderRow = await queryOne('SELECT MAX(sort_order) as max_ord FROM dynamic_update_panels;');
        const newSortOrder = (maxOrderRow && maxOrderRow.max_ord !== null) ? Number(maxOrderRow.max_ord) + 1 : 10;

        const insertResult = await query(`
          INSERT INTO dynamic_update_panels (
            title, content, badge, badge_color, badge_bg, icon,
            categories_json, novels_json, is_global, status, sort_order, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          title,
          content || null,
          badge,
          badgeColor,
          badgeBg,
          icon,
          JSON.stringify(categories),
          JSON.stringify(novels),
          isGlobal,
          status,
          newSortOrder,
          currentUser.id
        ]);

        const newId = insertResult.insertId;

        // Append to panelOrder
        const currentOrder = await getSidebarPanelOrder();
        const customKey = `custom_${newId}`;
        if (!currentOrder.includes(customKey)) {
          currentOrder.push(customKey);
          await saveSidebarPanelOrder(currentOrder);
        }

        const createdRow = await queryOne('SELECT * FROM dynamic_update_panels WHERE id = ?;', [newId]);
        const formatted = formatPanel(createdRow);
        formatted.activities = await getPanelActivitiesForPanel(formatted, 6);

        return sendJson(res, {
          success: true,
          message: 'Update panel created successfully.',
          panel: formatted,
          panelOrder: currentOrder
        }, 201);
      } catch (err) {
        console.error('[Admin Create UpdatePanel Error]:', err);
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 5. ADMIN: PUT /api/admin/update-panels/:id
    const putMatch = normPath.match(/^\/admin\/update-panels\/(\d+)$/);
    if (putMatch && method === 'PUT') {
      try {
        const panelId = parseInt(putMatch[1], 10);
        const existing = await queryOne('SELECT * FROM dynamic_update_panels WHERE id = ?;', [panelId]);
        if (!existing) {
          return sendJson(res, { success: false, error: 'Update panel not found.' }, 404);
        }

        const body = await readJsonBody(req);
        const title = body.title !== undefined ? String(body.title).trim() : existing.title;
        const content = body.content !== undefined ? String(body.content).trim() : existing.content;

        if (!title) {
          return sendJson(res, { success: false, error: 'Panel title cannot be empty.' }, 400);
        }

        const badge = body.badge !== undefined ? String(body.badge).trim() : existing.badge;
        const badgeColor = body.badgeColor !== undefined ? String(body.badgeColor).trim() : existing.badge_color;
        const badgeBg = body.badgeBg !== undefined ? String(body.badgeBg).trim() : existing.badge_bg;
        const icon = body.icon !== undefined ? String(body.icon).trim() : existing.icon;
        const categories = Array.isArray(body.categories) ? body.categories : safeJsonParse(existing.categories_json, []);
        const novels = Array.isArray(body.novels) ? body.novels : safeJsonParse(existing.novels_json, []);
        const isGlobal = body.isGlobal !== undefined
          ? (body.isGlobal === true || body.isGlobal === 1 || categories.length === 0 ? 1 : 0)
          : existing.is_global;
        const status = body.status !== undefined
          ? (body.status === 'disabled' ? 'disabled' : 'active')
          : existing.status;

        await query(`
          UPDATE dynamic_update_panels
          SET title = ?, content = ?, badge = ?, badge_color = ?, badge_bg = ?, icon = ?,
              categories_json = ?, novels_json = ?, is_global = ?, status = ?, updated_at = NOW()
          WHERE id = ?;
        `, [
          title,
          content || null,
          badge,
          badgeColor,
          badgeBg,
          icon,
          JSON.stringify(categories),
          JSON.stringify(novels),
          isGlobal,
          status,
          panelId
        ]);

        const updatedRow = await queryOne('SELECT * FROM dynamic_update_panels WHERE id = ?;', [panelId]);
        const formatted = formatPanel(updatedRow);
        formatted.activities = await getPanelActivitiesForPanel(formatted, 6);

        return sendJson(res, {
          success: true,
          message: 'Update panel updated successfully.',
          panel: formatted
        }, 200);
      } catch (err) {
        console.error('[Admin Update UpdatePanel Error]:', err);
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // 6. ADMIN: DELETE /api/admin/update-panels/:id
    const deleteMatch = normPath.match(/^\/admin\/update-panels\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
      try {
        const panelId = parseInt(deleteMatch[1], 10);
        const existing = await queryOne('SELECT * FROM dynamic_update_panels WHERE id = ?;', [panelId]);
        if (!existing) {
          return sendJson(res, { success: false, error: 'Update panel not found.' }, 404);
        }

        await query('DELETE FROM dynamic_update_panels WHERE id = ?;', [panelId]);

        // Remove from panelOrder
        const currentOrder = await getSidebarPanelOrder();
        const customKey = `custom_${panelId}`;
        const newOrder = currentOrder.filter(k => k !== customKey);
        await saveSidebarPanelOrder(newOrder);

        return sendJson(res, {
          success: true,
          message: 'Update panel deleted successfully.',
          panelOrder: newOrder
        }, 200);
      } catch (err) {
        console.error('[Admin Delete UpdatePanel Error]:', err);
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }
  }

  // Not handled by this sub-router
  return false;
}
