// Trash / Recycle Bin System for Rudhra Prarthana Novels
// Soft-delete, trash management, restoration, and permanent purge

import { query, queryOne, getDb } from './db.js';
import { recordAdminAudit } from './admin-members.js';

export function isUserAdmin(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const role = (user.role || '').toLowerCase();
  return ['admin', 'administrator', 'editor'].includes(role);
}

export function isUserWriter(user) {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  const role = (user.role || '').toLowerCase();
  return role === 'writer' || Boolean(user.isWriter);
}

/**
 * Move any supported content to Trash
 */
export async function moveToTrash({
  itemType,
  itemId,
  title,
  ownerId = null,
  deletedBy,
  deletedByName = '',
  originalLocation = '',
  itemData
}) {
  if (!itemType || !itemId || !title) {
    throw new Error('itemType, itemId, and title are required for trash.');
  }

  const jsonPayload = typeof itemData === 'string' ? itemData : JSON.stringify(itemData);

  // Check if this item is already in trash (avoid duplicates)
  const existing = await queryOne(
    `SELECT id FROM trash_items WHERE item_type = ? AND item_id = ?;`,
    [itemType, String(itemId)]
  );

  if (existing) {
    await query(`
      UPDATE trash_items
      SET title = ?,
          owner_id = ?,
          deleted_by = ?,
          deleted_by_name = ?,
          original_location = ?,
          item_data = ?,
          deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `, [title, ownerId, deletedBy, deletedByName || '', originalLocation || '', jsonPayload, existing.id]);
    return { success: true, trashId: existing.id, isUpdated: true };
  } else {
    const result = await query(`
      INSERT INTO trash_items (
        item_type, item_id, title, owner_id, deleted_by, deleted_by_name, original_location, item_data, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `, [itemType, String(itemId), title, ownerId, deletedBy, deletedByName || '', originalLocation || '', jsonPayload]);
    return { success: true, trashId: result.insertId };
  }
}

/**
 * Get Trash Items with role-based filtering (Admin views all, Writer views own)
 */
export async function getTrashItems({ user, filterType = 'all', search = '', limit = 100, offset = 0 }) {
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const isAdmin = isUserAdmin(user);
  const whereClauses = [];
  const params = [];

  // Role filtering
  if (!isAdmin) {
    whereClauses.push('(owner_id = ? OR deleted_by = ?)');
    params.push(user.id, user.id);
  }

  // Type filtering
  if (filterType && filterType !== 'all') {
    whereClauses.push('item_type = ?');
    params.push(filterType);
  }

  // Search filtering
  if (search && search.trim()) {
    whereClauses.push('(title LIKE ? OR original_location LIKE ? OR item_id LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = await queryOne(`SELECT COUNT(*) as total FROM trash_items ${whereSql};`, params);
  const total = Number(countRow?.total || 0);

  const items = await query(
    `SELECT id, item_type, item_id, title, owner_id, deleted_by, deleted_by_name, original_location, deleted_at
     FROM trash_items
     ${whereSql}
     ORDER BY deleted_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    success: true,
    items: items || [],
    total,
    isAdmin
  };
}

/**
 * Restore an item from Trash back to its original location
 */
export async function restoreFromTrash({ trashId, user }) {
  if (!user) return { success: false, error: 'Authentication required' };

  const trashItem = await queryOne(`SELECT * FROM trash_items WHERE id = ?;`, [trashId]);
  if (!trashItem) {
    return { success: false, error: 'Item not found in Trash.' };
  }

  const isAdmin = isUserAdmin(user);
  const isOwner = Number(trashItem.owner_id) === Number(user.id);
  const isDeleter = Number(trashItem.deleted_by) === Number(user.id);

  if (!isAdmin && !isOwner && !isDeleter) {
    return { success: false, error: 'You do not have permission to restore this item.' };
  }

  let data;
  try {
    data = typeof trashItem.item_data === 'string' ? JSON.parse(trashItem.item_data) : trashItem.item_data;
  } catch (err) {
    return { success: false, error: 'Corrupted trash item data.' };
  }

  const conn = await getDb().getConnection();
  try {
    await conn.beginTransaction();

    switch (trashItem.item_type) {
      case 'main_category': {
        const cat = data.category || data;
        // Re-insert into forum_categories
        await conn.query(`
          INSERT INTO forum_categories (id, title, icon, color, sort_order, is_active, status, visibility, is_disabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            title = VALUES(title), icon = VALUES(icon), color = VALUES(color),
            sort_order = VALUES(sort_order), is_active = VALUES(is_active),
            status = VALUES(status), is_disabled = VALUES(is_disabled);
        `, [
          cat.id, cat.title, cat.icon || '📖', cat.color || '#2E1065',
          Number(cat.sort_order || 0), cat.is_active ?? 1, cat.status || 'published',
          cat.visibility || 'public', cat.is_disabled ? 1 : 0
        ]);

        // Restore child subcategories if any
        if (Array.isArray(data.subcategories) && data.subcategories.length > 0) {
          for (const sub of data.subcategories) {
            await conn.query(`
              INSERT INTO content_subcategories (id, main_category_id, parent_id, title, description, icon, novel_id, sort_order, status, is_active, is_disabled, visibility, access_permission)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                title = VALUES(title), main_category_id = VALUES(main_category_id),
                parent_id = VALUES(parent_id), icon = VALUES(icon),
                sort_order = VALUES(sort_order), is_active = VALUES(is_active),
                is_disabled = VALUES(is_disabled);
            `, [
              sub.id, sub.main_category_id, sub.parent_id || null, sub.title,
              sub.description || '', sub.icon || '📌', sub.novel_id || null,
              Number(sub.sort_order || 0), sub.status || 'published', sub.is_active ?? 1,
              sub.is_disabled ? 1 : 0, sub.visibility || 'public', sub.access_permission || 'admin_only'
            ]);
          }
        }
        break;
      }

      case 'sub_category': {
        const sub = data.subcategory || data;
        await conn.query(`
          INSERT INTO content_subcategories (id, main_category_id, parent_id, title, description, icon, novel_id, sort_order, status, is_active, is_disabled, visibility, access_permission)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            title = VALUES(title), main_category_id = VALUES(main_category_id),
            parent_id = VALUES(parent_id), icon = VALUES(icon),
            sort_order = VALUES(sort_order), is_active = VALUES(is_active),
            is_disabled = VALUES(is_disabled);
        `, [
          sub.id, sub.main_category_id, sub.parent_id || null, sub.title,
          sub.description || '', sub.icon || '📌', sub.novel_id || null,
          Number(sub.sort_order || 0), sub.status || 'published', sub.is_active ?? 1,
          sub.is_disabled ? 1 : 0, sub.visibility || 'public', sub.access_permission || 'admin_only'
        ]);

        // Restore nested child subcategories if any
        if (Array.isArray(data.childSubcategories) && data.childSubcategories.length > 0) {
          for (const child of data.childSubcategories) {
            await conn.query(`
              INSERT INTO content_subcategories (id, main_category_id, parent_id, title, description, icon, novel_id, sort_order, status, is_active, is_disabled, visibility, access_permission)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE title = VALUES(title);
            `, [
              child.id, child.main_category_id, child.parent_id, child.title,
              child.description || '', child.icon || '📌', child.novel_id || null,
              Number(child.sort_order || 0), child.status || 'published', child.is_active ?? 1,
              child.is_disabled ? 1 : 0, child.visibility || 'public', child.access_permission || 'admin_only'
            ]);
          }
        }
        break;
      }

      case 'content_article':
      case 'article': {
        const art = data.article || data;
        await conn.query(`
          INSERT INTO content_articles (
            id, unique_slug, main_category_id, sub_category_id, parent_id,
            title, content, summary, cover_image, author_id, author_name,
            status, is_published, is_disabled, visibility, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content);
        `, [
          art.id, art.unique_slug, art.main_category_id, art.sub_category_id, art.parent_id || null,
          art.title, art.content, art.summary || '', art.cover_image || null, art.author_id || user.id,
          art.author_name || user.username, art.status || 'published', art.is_published ? 1 : 0,
          art.is_disabled ? 1 : 0, art.visibility || 'public', Number(art.sort_order || 0)
        ]);
        break;
      }

      default:
        throw new Error(`Unsupported content type for restore: ${trashItem.item_type}`);
    }

    // Delete from trash_items
    await conn.query(`DELETE FROM trash_items WHERE id = ?;`, [trashId]);

    await conn.commit();

    try {
      if (isAdmin && user && user.id) {
        await recordAdminAudit({
          adminId: user.id,
          action: 'item_restored_from_trash',
          targetUserId: trashItem.owner_id,
          ipAddress: null,
          userAgent: null,
          details: `Restored ${trashItem.item_type} "${trashItem.title}" (ID: ${trashItem.item_id}) from Trash`
        });
      }
    } catch (auditErr) {
      // Non-fatal
    }

    return {
      success: true,
      message: `"${trashItem.title}" restored successfully!`,
      itemType: trashItem.item_type,
      itemId: trashItem.item_id
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Permanently delete an item from Trash
 */
export async function permanentlyDeleteTrash({ trashId, user }) {
  if (!user) return { success: false, error: 'Authentication required' };

  const trashItem = await queryOne(`SELECT * FROM trash_items WHERE id = ?;`, [trashId]);
  if (!trashItem) {
    return { success: false, error: 'Item not found in Trash.' };
  }

  const isAdmin = isUserAdmin(user);
  const isOwner = Number(trashItem.owner_id) === Number(user.id);
  const isDeleter = Number(trashItem.deleted_by) === Number(user.id);

  if (!isAdmin && !isOwner && !isDeleter) {
    return { success: false, error: 'You do not have permission to permanently delete this item.' };
  }

  await query(`DELETE FROM trash_items WHERE id = ?;`, [trashId]);

  try {
    if (isAdmin) {
      await recordAdminAudit({
        adminId: user.id,
        action: 'item_permanently_deleted',
        targetUserId: trashItem.owner_id,
        ipAddress: null,
        userAgent: null,
        details: `Permanently purged ${trashItem.item_type} "${trashItem.title}" (ID: ${trashItem.item_id}) from Trash`
      });
    }
  } catch (auditErr) {
    // Ignore non-fatal audit log errors
  }

  return { success: true, message: `"${trashItem.title}" deleted permanently.` };
}

/**
 * Empty Trash
 * Admins empty all trash; writers empty only their own items
 */
export async function emptyTrash({ user }) {
  if (!user) return { success: false, error: 'Authentication required' };

  const isAdmin = isUserAdmin(user);
  let result;

  if (isAdmin) {
    result = await query(`DELETE FROM trash_items;`);
  } else {
    result = await query(`DELETE FROM trash_items WHERE owner_id = ? OR deleted_by = ?;`, [user.id, user.id]);
  }

  try {
    if (isAdmin) {
      await recordAdminAudit({
        adminId: user.id,
        action: 'trash_emptied',
        targetUserId: null,
        ipAddress: null,
        userAgent: null,
        details: `Recycle bin emptied (${result.affectedRows || 0} items purged)`
      });
    }
  } catch (auditErr) {
    // Ignore non-fatal audit errors
  }

  return {
    success: true,
    message: 'Trash emptied successfully.',
    purgedCount: result.affectedRows || 0
  };
}
