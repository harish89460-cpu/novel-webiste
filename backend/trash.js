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

      case 'novel': {
        const n = data.novel || data;
        await conn.query(`
          INSERT INTO novels (
            id, title, author, genre, category, status, badge, cover,
            description, chapters_count, views, rating, updated_date,
            featured, continue_reading, is_audio, audio_available,
            audio_duration, audio_voice, youtube_url, trending_rank,
            sort_order, is_published, visibility, link, author_id,
            content_type, access_permission, language, scheduled_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          ) ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), is_published = VALUES(is_published);
        `, [
          n.id, n.title, n.author, n.genre || 'Romance', n.category || 'General',
          n.status || 'Ongoing', n.badge || '', n.cover || '/default-cover.jpg',
          n.description || '', Number(n.chapters_count || 0), n.views || '0',
          Number(n.rating || 5.0), n.updated_date || 'Recent',
          n.featured ? 1 : 0, n.continue_reading ? 1 : 0, n.is_audio ? 1 : 0,
          n.audio_available ? 1 : 0, n.audio_duration || null, n.audio_voice || null,
          n.youtube_url || null, Number(n.trending_rank || 0), Number(n.sort_order || 0),
          n.is_published ? 1 : 0, n.visibility || 'public', n.link || null,
          n.author_id || user.id, n.content_type || 'written_novel',
          n.access_permission || 'admin_only', n.language || 'ta', n.scheduled_at || null
        ]);

        // Restore chapters if attached
        if (Array.isArray(data.chapters) && data.chapters.length > 0) {
          for (const ch of data.chapters) {
            await conn.query(`
              INSERT INTO chapters (
                id, novel_id, chapter_number, title, content, published_date,
                views, audio_url, youtube_url, sort_order, is_published,
                visibility, author_id, access_permission, scheduled_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content);
            `, [
              ch.id, ch.novel_id, ch.chapter_number, ch.title, ch.content,
              ch.published_date || new Date(), Number(ch.views || 0),
              ch.audio_url || null, ch.youtube_url || null, Number(ch.sort_order || 0),
              ch.is_published ? 1 : 0, ch.visibility || 'public',
              ch.author_id || user.id, ch.access_permission || 'admin_only',
              ch.scheduled_at || null
            ]);
          }
        }
        break;
      }

      case 'chapter':
      case 'episode':
      case 'audio_episode': {
        const ch = data.chapter || data;
        await conn.query(`
          INSERT INTO chapters (
            id, novel_id, chapter_number, title, content, published_date,
            views, audio_url, youtube_url, sort_order, is_published,
            visibility, author_id, access_permission, scheduled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), is_published = VALUES(is_published);
        `, [
          ch.id, ch.novel_id, ch.chapter_number, ch.title, ch.content,
          ch.published_date || new Date(), Number(ch.views || 0),
          ch.audio_url || null, ch.youtube_url || null, Number(ch.sort_order || 0),
          ch.is_published ? 1 : 0, ch.visibility || 'public',
          ch.author_id || user.id, ch.access_permission || 'admin_only',
          ch.scheduled_at || null
        ]);
        break;
      }

      case 'short_story': {
        const s = data.story || data;
        await conn.query(`
          INSERT INTO short_stories (
            id, title, slug, author, genre, cover_image, summary, content,
            status, views_count, sort_order, author_id, is_disabled, visibility, published_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), status = VALUES(status);
        `, [
          s.id, s.title, s.slug, s.author || 'Rudhra Prarthana', s.genre || 'General',
          s.cover_image || null, s.summary || '', s.content || '', s.status || 'published',
          Number(s.views_count || 0), Number(s.sort_order || 0), s.author_id || user.id,
          s.is_disabled ? 1 : 0, s.visibility || 'public', s.published_at || new Date()
        ]);
        break;
      }

      case 'audio_novel': {
        const a = data.audioNovel || data;
        await conn.query(`
          INSERT INTO audio_novels (
            id, title, author, voice, duration, cover, total_episodes, views_count, status, visibility, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status);
        `, [
          a.id, a.title, a.author, a.voice || a.author, a.duration || 'Full',
          a.cover || null, Number(a.total_episodes || 0), Number(a.views_count || 0),
          a.status || 'published', a.visibility || 'public', Number(a.sort_order || 0)
        ]);
        break;
      }

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
