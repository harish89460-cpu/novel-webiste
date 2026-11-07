/**
 * Rudhra Prarthana Novels — Dynamic Updates / Announcement Panel System
 * 
 * Manages:
 * - Creation, Editing, Deletion, and Toggling of custom update/announcement panels
 * - Multi-category and specific novel visibility rules
 * - Drag-and-drop persistent ordering across all sidebar panels (system & custom)
 * - Strict Admin authorization (viewable by members/guests according to category filter)
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

      // Apply category and novel visibility rules
      const visiblePanels = allActive.filter(p => {
        // If viewing main Forms overview page (#forms):
        if (isOverview) {
          // Visible if marked global or has no restrictive category filter
          return p.isGlobal || p.categories.length === 0;
        }

        // If viewing a specific category:
        if (categoryId && p.categories.includes(categoryId)) {
          return true;
        }

        // If viewing a specific subcategory / novel:
        if (subCategoryId && p.novels.includes(subCategoryId)) {
          return true;
        }

        // Also check if subcategory's parent category matches
        if (categoryId && p.categories.includes(categoryId)) {
          return true;
        }

        // If panel is explicitly configured to show globally across all categories
        if (p.isGlobal) {
          return true;
        }

        return false;
      });

      const panelOrder = await getSidebarPanelOrder();

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
        if (!content) {
          return sendJson(res, { success: false, error: 'Panel content is required.' }, 400);
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
          content,
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

        return sendJson(res, {
          success: true,
          message: 'Update panel created successfully.',
          panel: formatPanel(createdRow),
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
        if (!content) {
          return sendJson(res, { success: false, error: 'Panel content cannot be empty.' }, 400);
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
          content,
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

        return sendJson(res, {
          success: true,
          message: 'Update panel updated successfully.',
          panel: formatPanel(updatedRow)
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
