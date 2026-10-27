// Forms, Novel Content, and Reading Management Layer for Rudhra Prarthana Novels
// Implements 3-Level Hierarchy: Main Title -> Sub Title -> Content Title -> Reading Content
// With dedicated reading pages, comments, and fine-grained individual member access control

import { query, queryOne, getDb } from './db.js';
import { recordAdminAudit } from './admin-members.js';

/**
 * Check if a given user is an authorized administrator or editor
 */
export function isUserAdmin(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const role = (user.role || '').toLowerCase();
  return ['admin', 'administrator', 'editor'].includes(role);
}

/**
 * Check if a user is an authorized writer
 */
export function isUserWriter(user) {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  const role = (user.role || '').toLowerCase();
  return role === 'writer' || Boolean(user.isWriter);
}

/**
 * Generate a clean URL-friendly slug
 */
export function generateSlug(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

/**
 * Calculate expiration datetime given a duration string
 */
export function calculateExpiry(duration) {
  if (!duration || duration === 'indefinite' || duration === 'permanent') return null;
  const now = new Date();
  if (duration === '1h') return new Date(now.getTime() + 60 * 60 * 1000);
  if (duration === '24h' || duration === '1d') return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (duration === '3d') return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (duration === '7d' || duration === '1w') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (duration === '30d' || duration === '1m') return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const custom = new Date(duration);
  if (!isNaN(custom.getTime()) && custom > now) return custom;
  return null;
}

// ============================================================================
// 1. PUBLIC & MEMBER ACCESS EVALUATION & HIERARCHY
// ============================================================================

/**
 * Check if a user is blocked from a specific target
 */
export async function checkAccessRestriction({ targetType, targetId, userId }) {
  if (!targetType || !targetId) return null;

  // 1. Check global disablement rule (user_id IS NULL)
  const globalRule = await queryOne(`
    SELECT * FROM content_access_rules 
    WHERE target_type = ? AND target_id = ? AND user_id IS NULL AND rule_type = 'disable'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY id DESC LIMIT 1;
  `, [targetType, String(targetId)]);

  if (globalRule) {
    return {
      blocked: true,
      reason: globalRule.reason || 'Content temporarily disabled by administrator.',
      rule: globalRule,
      isGlobal: true
    };
  }

  // 2. Check user-specific block rule
  if (userId) {
    const userRule = await queryOne(`
      SELECT * FROM content_access_rules 
      WHERE target_type = ? AND target_id = ? AND user_id = ? AND rule_type = 'block'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC LIMIT 1;
    `, [targetType, String(targetId), userId]);

    if (userRule) {
      return {
        blocked: true,
        reason: userRule.reason || 'Your access has been restricted by an administrator.',
        rule: userRule,
        isGlobal: false
      };
    }
  }

  return null;
}

/**
 * Retrieve the full 3-level Forms & Content hierarchy
 * Main Titles -> Sub Titles -> Content Titles
 */
export async function getContentHierarchy(currentUser = null) {
  const isAdmin = isUserAdmin(currentUser);
  const userId = currentUser ? currentUser.id : null;

  // 1. Fetch Main Categories (Main Titles)
  const mainCatsQuery = isAdmin
    ? `SELECT * FROM forum_categories ORDER BY sort_order ASC, title ASC;`
    : `SELECT * FROM forum_categories WHERE is_active = 1 AND is_disabled = 0 AND (status = 'published' OR status IS NULL) ORDER BY sort_order ASC, title ASC;`;
  
  const mainCategories = await query(mainCatsQuery);

  // 2. Fetch Subcategories (Sub Titles)
  const subCatsQuery = isAdmin
    ? `SELECT * FROM content_subcategories ORDER BY sort_order ASC, title ASC;`
    : `SELECT * FROM content_subcategories WHERE is_active = 1 AND is_disabled = 0 AND status = 'published' ORDER BY sort_order ASC, title ASC;`;
  
  const allSubcategories = await query(subCatsQuery);

  // 3. Fetch Content Articles (Content Titles)
  const articlesQuery = isAdmin
    ? `SELECT id, unique_slug, main_category_id, sub_category_id, novel_id, chapter_num,
              title, summary, cover_image, author_id, author_name, status, is_published,
              is_disabled, visibility, views_count, comments_count, sort_order, published_at, created_at
       FROM content_articles 
       ORDER BY sort_order ASC, published_at DESC, id DESC;`
    : `SELECT id, unique_slug, main_category_id, sub_category_id, novel_id, chapter_num,
              title, summary, cover_image, author_id, author_name, status, is_published,
              is_disabled, visibility, views_count, comments_count, sort_order, published_at, created_at
       FROM content_articles 
       WHERE is_published = 1 AND is_disabled = 0 AND status = 'published'
       ORDER BY sort_order ASC, published_at DESC, id DESC;`;
  
  const allArticles = await query(articlesQuery);

  // 4. Fetch Active Access Rules to filter for non-admin readers
  let userRestrictions = [];
  if (!isAdmin && userId) {
    userRestrictions = await query(`
      SELECT target_type, target_id, rule_type, reason, expires_at 
      FROM content_access_rules 
      WHERE user_id = ? AND rule_type = 'block' AND (expires_at IS NULL OR expires_at > NOW());
    `, [userId]);
  }

  const isRestricted = (type, id) => {
    if (isAdmin) return false;
    return userRestrictions.some(r => r.target_type === type && String(r.target_id) === String(id));
  };

  // 5. Fetch Novels with latest published episodes for Ongoing / Completed / Audio categories
  const novelsWithEpisodes = await query(`
    SELECT n.id, n.title, n.author, n.category, n.status, n.badge, n.cover, n.description,
           n.chapters_count, n.views, n.rating, n.updated_date, n.is_audio, n.audio_voice, n.audio_duration,
           (SELECT COUNT(*) FROM comments c WHERE c.novel_id = n.id) as comments_count,
           (
             SELECT c.title 
             FROM chapters c 
             WHERE c.novel_id = n.id AND c.status = 'published'
             ORDER BY c.sort_order DESC, c.id DESC LIMIT 1
           ) as latest_episode_title,
           (
             SELECT COALESCE(c.episode_number, c.chapter_num) 
             FROM chapters c 
             WHERE c.novel_id = n.id AND c.status = 'published'
             ORDER BY c.sort_order DESC, c.id DESC LIMIT 1
           ) as latest_episode_num,
           (
             SELECT c.published_at 
             FROM chapters c 
             WHERE c.novel_id = n.id AND c.status = 'published'
             ORDER BY c.sort_order DESC, c.id DESC LIMIT 1
           ) as latest_published_at
    FROM novels n
    WHERE n.is_published = 1
    ORDER BY latest_published_at DESC, n.sort_order ASC, n.id ASC;
  `);

  // Assemble the hierarchy
  const hierarchy = [];

  for (const mainCat of mainCategories) {
    if (!isAdmin && isRestricted('main', mainCat.id)) continue;

    const mainItem = {
      id: mainCat.id,
      title: mainCat.title,
      description: mainCat.description || mainCat.desc || '',
      icon: mainCat.icon || '💬',
      color: mainCat.color || '#2E1065',
      sortOrder: Number(mainCat.sort_order || 0),
      status: mainCat.status || (mainCat.is_active ? 'published' : 'disabled'),
      isActive: Boolean(mainCat.is_active),
      isDisabled: Boolean(mainCat.is_disabled),
      subcategories: [],
      novels: [],
      stats: null
    };

    // Subcategories for this Main Category
    const directSubs = allSubcategories.filter(s => s.main_category_id === mainCat.id);

    for (const sub of directSubs) {
      if (!isAdmin && isRestricted('sub', sub.id)) continue;

      const subItem = {
        id: sub.id,
        mainCategoryId: sub.main_category_id,
        title: sub.title,
        description: sub.description || '',
        icon: sub.icon || '📌',
        novelId: sub.novel_id || null,
        sortOrder: Number(sub.sort_order || 0),
        status: sub.status || 'published',
        isActive: Boolean(sub.is_active),
        isDisabled: Boolean(sub.is_disabled),
        articles: [],
        stats: null
      };

      // Content Articles under this Subcategory
      const directArticles = allArticles.filter(a => a.sub_category_id === sub.id);
      for (const art of directArticles) {
        if (!isAdmin && isRestricted('content', art.id)) continue;
        subItem.articles.push({
          id: art.id,
          uniqueSlug: art.unique_slug,
          mainCategoryId: art.main_category_id,
          subCategoryId: art.sub_category_id,
          title: art.title,
          summary: art.summary || '',
          coverImage: art.cover_image || null,
          authorName: art.author_name || 'Rudhra Prarthana',
          status: art.status,
          viewsCount: Number(art.views_count || 0),
          commentsCount: Number(art.comments_count || 0),
          publishedAt: art.published_at || art.created_at,
          link: `#content?slug=${encodeURIComponent(art.unique_slug)}`
        });
      }

      const sortedSubArticles = [...subItem.articles].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      subItem.stats = {
        totalItems: subItem.articles.length,
        totalComments: subItem.articles.reduce((sum, a) => sum + Number(a.commentsCount || 0), 0),
        totalViews: subItem.articles.reduce((sum, a) => sum + Number(a.viewsCount || 0), 0),
        latestTitle: sortedSubArticles[0]?.title || null,
        latestLink: sortedSubArticles[0]?.link || null,
        latestDate: sortedSubArticles[0]?.publishedAt || null
      };

      mainItem.subcategories.push(subItem);
    }

    // Special category novel integration:
    // Ongoing Novels
    if (mainCat.id === 'ongoing-novels') {
      const ongoingNovels = novelsWithEpisodes.filter(n => n.status === 'Ongoing' || (n.category && n.category.toLowerCase().includes('ongoing')));
      mainItem.novels = ongoingNovels.map(n => ({
        id: n.id,
        title: n.title,
        author: n.author,
        category: n.category,
        cover: n.cover,
        views: n.views || '0',
        viewsCount: parseInt(String(n.views || '0').replace(/,/g, ''), 10) || 0,
        commentsCount: Number(n.comments_count || 0),
        latestEpisodeTitle: n.latest_episode_title || 'Episode 01',
        latestEpisodeNum: n.latest_episode_num || '1',
        updatedDate: n.latest_published_at ? new Date(n.latest_published_at).toLocaleDateString() : (n.updated_date || 'Recent'),
        link: `#novel?id=${encodeURIComponent(n.id)}`,
        readLink: `#reader?novel=${encodeURIComponent(n.id)}&ch=${encodeURIComponent(n.latest_episode_num || '1')}`
      }));
    }

    // Completed Novels
    if (mainCat.id === 'completed-novels') {
      const completedNovels = novelsWithEpisodes.filter(n => n.status === 'Completed' || (n.category && n.category.toLowerCase().includes('completed')));
      mainItem.novels = completedNovels.map(n => ({
        id: n.id,
        title: n.title,
        author: n.author,
        category: n.category,
        cover: n.cover,
        views: n.views || '0',
        viewsCount: parseInt(String(n.views || '0').replace(/,/g, ''), 10) || 0,
        commentsCount: Number(n.comments_count || 0),
        latestEpisodeTitle: n.latest_episode_title || 'Full Novel',
        latestEpisodeNum: n.latest_episode_num || '1',
        updatedDate: n.updated_date || 'Completed',
        link: `#novel?id=${encodeURIComponent(n.id)}`,
        readLink: `#reader?novel=${encodeURIComponent(n.id)}&ch=1`
      }));
    }

    // Short Stories
    if (mainCat.id === 'short-stories') {
      const shortNovels = novelsWithEpisodes.filter(n => (n.category && n.category.toLowerCase().includes('short')));
      mainItem.novels = shortNovels.map(n => ({
        id: n.id,
        title: n.title,
        author: n.author,
        cover: n.cover,
        views: n.views || '0',
        viewsCount: parseInt(String(n.views || '0').replace(/,/g, ''), 10) || 0,
        commentsCount: Number(n.comments_count || 0),
        latestEpisodeTitle: n.latest_episode_title || 'Story Collection',
        latestEpisodeNum: n.latest_episode_num || '1',
        updatedDate: n.updated_date || 'Collection',
        link: `#novel?id=${encodeURIComponent(n.id)}`,
        readLink: `#reader?novel=${encodeURIComponent(n.id)}&ch=1`
      }));
    }

    // Audio Novels
    if (mainCat.id === 'audio-novels') {
      const audioNovels = novelsWithEpisodes.filter(n => Boolean(n.is_audio) || (n.category && n.category.toLowerCase().includes('audio')));
      mainItem.novels = audioNovels.map(n => ({
        id: n.id,
        title: n.title,
        author: n.author,
        voice: n.audio_voice || n.author,
        duration: n.audio_duration || 'Full Audio',
        cover: n.cover,
        views: n.views || '0',
        viewsCount: parseInt(String(n.views || '0').replace(/,/g, ''), 10) || 0,
        commentsCount: Number(n.comments_count || 0),
        latestEpisodeTitle: n.latest_episode_title || 'Audio Episode',
        link: `#audio`
      }));
    }

    // Precalculate category-level statistics
    if (mainItem.novels.length > 0) {
      mainItem.stats = {
        totalItems: mainItem.novels.length,
        totalComments: mainItem.novels.reduce((sum, n) => sum + Number(n.commentsCount || 0), 0),
        totalViews: mainItem.novels.reduce((sum, n) => sum + Number(n.viewsCount || 0), 0),
        latestTitle: mainItem.novels[0]?.latestEpisodeTitle ? `${mainItem.novels[0].title} — ${mainItem.novels[0].latestEpisodeTitle}` : (mainItem.novels[0]?.title || null),
        latestNovelTitle: mainItem.novels[0]?.title || null,
        latestLink: mainItem.novels[0]?.readLink || mainItem.novels[0]?.link || null,
        latestDate: mainItem.novels[0]?.latestPublishedAt || mainItem.novels[0]?.updatedDate || null
      };
    } else if (mainItem.subcategories.length > 0) {
      const allCatArticles = mainItem.subcategories.flatMap(s => s.articles || []);
      const sortedArticles = [...allCatArticles].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      mainItem.stats = {
        totalSubcategories: mainItem.subcategories.length,
        totalItems: allCatArticles.length,
        totalComments: allCatArticles.reduce((sum, a) => sum + Number(a.commentsCount || 0), 0),
        totalViews: allCatArticles.reduce((sum, a) => sum + Number(a.viewsCount || 0), 0),
        latestTitle: sortedArticles[0]?.title || null,
        latestLink: sortedArticles[0]?.link || null,
        latestDate: sortedArticles[0]?.publishedAt || null
      };
    }

    hierarchy.push(mainItem);
  }

  return { success: true, hierarchy };
}

/**
 * Retrieve a single content article for dedicated reading page
 * with full authorization and restriction checks
 */
export async function getContentArticle(idOrSlug, currentUser = null) {
  if (!idOrSlug) {
    return { success: false, error: 'Content identifier is required.', code: 'NOT_FOUND' };
  }

  const isAdmin = isUserAdmin(currentUser);
  const userId = currentUser ? currentUser.id : null;

  // 1. Resolve content article from database
  const article = await queryOne(`
    SELECT a.*, 
           m.title as main_category_title, m.is_disabled as main_is_disabled, m.status as main_status,
           s.title as sub_category_title, s.is_disabled as sub_is_disabled, s.status as sub_status,
           p.avatar as author_avatar, u.role as author_role
    FROM content_articles a
    LEFT JOIN forum_categories m ON m.id = a.main_category_id
    LEFT JOIN content_subcategories s ON s.id = a.sub_category_id
    LEFT JOIN users u ON u.id = a.author_id
    LEFT JOIN profiles p ON p.user_id = a.author_id
    WHERE a.unique_slug = ? OR CAST(a.id AS CHAR) = ?
    LIMIT 1;
  `, [String(idOrSlug), String(idOrSlug)]);

  if (!article) {
    return { success: false, error: 'The requested reading content does not exist or has been removed.', code: 'NOT_FOUND' };
  }

  // 2. Administrators have bypass access
  if (isAdmin) {
    // Increment view count
    await query(`UPDATE content_articles SET views_count = views_count + 1 WHERE id = ?;`, [article.id]);
    return { success: true, article: formatArticle(article) };
  }

  // 3. Draft / Unpublished check
  if (!article.is_published || article.status === 'unpublished' || article.status === 'draft') {
    return { 
      success: false, 
      error: 'This content is currently unpublished or in draft status. Only administrators may view it.', 
      code: 'UNPUBLISHED' 
    };
  }

  // 4. Global disable checks (Item, Subcategory, or Main Category)
  if (article.is_disabled || article.status === 'disabled') {
    return { 
      success: false, 
      error: 'This content has been temporarily disabled by an administrator.', 
      code: 'DISABLED' 
    };
  }

  if (article.sub_is_disabled || article.sub_status === 'disabled') {
    return { 
      success: false, 
      error: 'The parent section has been temporarily disabled by an administrator.', 
      code: 'DISABLED' 
    };
  }

  if (article.main_is_disabled || article.main_status === 'disabled') {
    return { 
      success: false, 
      error: 'The parent category has been temporarily disabled by an administrator.', 
      code: 'DISABLED' 
    };
  }

  // 5. Check Individual Member Access Restrictions
  if (userId) {
    // A. Check article-level restriction
    const artBlock = await queryOne(`
      SELECT * FROM content_access_rules 
      WHERE (target_type = 'content' OR target_type = 'article') 
        AND (target_id = ? OR target_id = ?) 
        AND user_id = ? AND rule_type = 'block'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC LIMIT 1;
    `, [String(article.id), String(article.unique_slug), userId]);

    if (artBlock) {
      const expMsg = artBlock.expires_at ? ` (until ${new Date(artBlock.expires_at).toLocaleString()})` : '';
      const rsnMsg = artBlock.reason ? ` Reason: ${artBlock.reason}` : '';
      return {
        success: false,
        error: `Your access to "${article.title}" has been restricted by an administrator.${expMsg}${rsnMsg}`,
        code: 'FORBIDDEN',
        reason: artBlock.reason,
        expiresAt: artBlock.expires_at
      };
    }

    // B. Check subcategory-level restriction
    const subBlock = await queryOne(`
      SELECT * FROM content_access_rules 
      WHERE (target_type = 'sub' OR target_type = 'subcategory') AND target_id = ? AND user_id = ? AND rule_type = 'block'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC LIMIT 1;
    `, [String(article.sub_category_id), userId]);

    if (subBlock) {
      return {
        success: false,
        error: `Your access to the section "${article.sub_category_title || 'Section'}" has been restricted by an administrator.`,
        code: 'FORBIDDEN',
        reason: subBlock.reason
      };
    }

    // C. Check main-category-level restriction
    const mainBlock = await queryOne(`
      SELECT * FROM content_access_rules 
      WHERE (target_type = 'main' OR target_type = 'main_category') AND target_id = ? AND user_id = ? AND rule_type = 'block'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY id DESC LIMIT 1;
    `, [String(article.main_category_id), userId]);

    if (mainBlock) {
      return {
        success: false,
        error: `Your access to the category "${article.main_category_title || 'Category'}" has been restricted by an administrator.`,
        code: 'FORBIDDEN',
        reason: mainBlock.reason
      };
    }
  }

  // 6. Increment view count
  await query(`UPDATE content_articles SET views_count = views_count + 1 WHERE id = ?;`, [article.id]);

  return { success: true, article: formatArticle(article) };
}

function formatArticle(row) {
  return {
    id: row.id,
    uniqueSlug: row.unique_slug,
    mainCategoryId: row.main_category_id,
    mainCategoryTitle: row.main_category_title || 'General',
    subCategoryId: row.sub_category_id,
    subCategoryTitle: row.sub_category_title || 'Notes',
    novelId: row.novel_id || null,
    chapterNum: row.chapter_num || null,
    title: row.title,
    content: row.content,
    summary: row.summary || '',
    coverImage: row.cover_image || null,
    authorId: row.author_id,
    authorName: row.author_name || 'Rudhra Prarthana',
    authorAvatar: row.author_avatar || '/profile.png',
    authorRole: row.author_role || 'author',
    status: row.status,
    isPublished: Boolean(row.is_published),
    isDisabled: Boolean(row.is_disabled),
    viewsCount: Number(row.views_count || 0),
    commentsCount: Number(row.comments_count || 0),
    sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ============================================================================
// 2. COMMENTS ON MANAGED CONTENT ARTICLES
// ============================================================================

/**
 * Retrieve comments and replies for a content article
 */
export async function getContentComments(contentId) {
  const rows = await query(`
    SELECT c.*, 
           u.username, p.display_name, p.avatar, u.role
    FROM content_comments c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN profiles p ON p.user_id = c.user_id
    WHERE c.content_id = ?
    ORDER BY c.created_at ASC;
  `, [contentId]);

  // Nest replies under parent comments
  const commentMap = {};
  const rootComments = [];

  for (const r of rows) {
    const formatted = {
      id: r.id,
      contentId: r.content_id,
      userId: r.user_id,
      parentId: r.parent_id,
      author: r.display_name || r.username || 'Reader',
      username: r.username,
      avatar: r.avatar || '/profile.png',
      role: r.role || 'Member',
      content: r.content,
      createdAt: r.created_at,
      replies: []
    };
    commentMap[r.id] = formatted;

    if (!r.parent_id) {
      rootComments.push(formatted);
    } else if (commentMap[r.parent_id]) {
      commentMap[r.parent_id].replies.push(formatted);
    } else {
      rootComments.push(formatted);
    }
  }

  return { success: true, comments: rootComments, total: rows.length };
}

/**
 * Add a comment or reply to a content article
 */
export async function addContentComment({ contentId, userId, parentId = null, content }) {
  if (!contentId || !userId || !content || !content.trim()) {
    return { success: false, error: 'Please enter a valid comment.' };
  }

  // Ensure content article exists
  const article = await queryOne(`SELECT id FROM content_articles WHERE id = ?;`, [contentId]);
  if (!article) {
    return { success: false, error: 'Content item does not exist.' };
  }

  const cleanText = content.trim();
  const result = await query(`
    INSERT INTO content_comments (content_id, user_id, parent_id, content)
    VALUES (?, ?, ?, ?);
  `, [contentId, userId, parentId ? Number(parentId) : null, cleanText]);

  // Update comments count on article
  await query(`
    UPDATE content_articles 
    SET comments_count = (SELECT COUNT(*) FROM content_comments WHERE content_id = ?) 
    WHERE id = ?;
  `, [contentId, contentId]);

  return { 
    success: true, 
    commentId: result.insertId,
    comment: { id: result.insertId },
    message: 'Your comment has been posted successfully!' 
  };
}

/**
 * Delete a comment on a content article
 */
export async function deleteContentComment({ commentId, userId, isAdmin }) {
  const comment = await queryOne(`SELECT * FROM content_comments WHERE id = ?;`, [commentId]);
  if (!comment) {
    return { success: false, error: 'Comment not found.' };
  }

  if (!isAdmin && comment.user_id !== userId) {
    return { success: false, error: 'You are not authorized to delete this comment.' };
  }

  // Delete comment and its replies
  await query(`DELETE FROM content_comments WHERE id = ? OR parent_id = ?;`, [commentId, commentId]);

  // Update article comment count
  await query(`
    UPDATE content_articles 
    SET comments_count = (SELECT COUNT(*) FROM content_comments WHERE content_id = ?) 
    WHERE id = ?;
  `, [comment.content_id, comment.content_id]);

  return { success: true, message: 'Comment deleted successfully.' };
}

// ============================================================================
// 3. ADMIN MANAGEMENT: MAIN TITLES, SUB TITLES & CONTENT ARTICLES
// ============================================================================

/**
 * Create a new Main Title (forum_category)
 */
export async function createMainCategory({ id, title, description, icon = '💬', color = '#2E1065', sortOrder = 0, adminId = 2 }) {
  if (!title || !title.trim()) {
    return { success: false, error: 'Main title is required.' };
  }

  const cleanTitle = title.trim();
  const cleanId = (id || generateSlug(cleanTitle)).trim();

  const existing = await queryOne(`SELECT id FROM forum_categories WHERE id = ?;`, [cleanId]);
  if (existing) {
    return { success: false, error: `A category with ID "${cleanId}" already exists.` };
  }

  await query(`
    INSERT INTO forum_categories (id, title, description, icon, color, sort_order, is_active, status, is_disabled)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'published', 0);
  `, [cleanId, cleanTitle, description || '', icon, color, Number(sortOrder || 0)]);

  await recordAdminAudit({
    adminId,
    action: 'main_title_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created main category "${cleanTitle}" (ID: ${cleanId})`
  });

  return { success: true, id: cleanId, category: { id: cleanId }, message: 'Main category created successfully!' };
}

/**
 * Update an existing Main Title
 */
export async function updateMainCategory({ id, title, description, icon, color, sortOrder, adminId = 2 }) {
  const cat = await queryOne(`SELECT * FROM forum_categories WHERE id = ?;`, [id]);
  if (!cat) return { success: false, error: 'Main category not found.' };

  await query(`
    UPDATE forum_categories 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?;
  `, [
    title ? title.trim() : null,
    description !== undefined ? description : null,
    icon || null,
    color || null,
    sortOrder !== undefined ? Number(sortOrder) : null,
    id
  ]);

  await recordAdminAudit({
    adminId,
    action: 'main_title_updated',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated main category "${id}"`
  });

  return { success: true, message: 'Main category updated successfully!' };
}

/**
 * Toggle Main Title status (Publish / Unpublish / Disable)
 */
export async function toggleMainCategoryStatus({ id, status, isDisabled, adminId = 2 }) {
  const cat = await queryOne(`SELECT * FROM forum_categories WHERE id = ?;`, [id]);
  if (!cat) return { success: false, error: 'Main category not found.' };

  const newStatus = status || (isDisabled ? 'disabled' : (cat.status === 'published' ? 'disabled' : 'published'));
  const disabledFlag = isDisabled !== undefined ? (isDisabled ? 1 : 0) : (newStatus === 'disabled' ? 1 : 0);
  const activeFlag = newStatus === 'disabled' ? 0 : 1;

  await query(`
    UPDATE forum_categories 
    SET status = ?, is_disabled = ?, is_active = ?
    WHERE id = ?;
  `, [newStatus, disabledFlag, activeFlag, id]);

  await recordAdminAudit({
    adminId,
    action: 'main_title_status_changed',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Changed main category "${id}" status to ${newStatus} (Disabled: ${disabledFlag})`
  });

  return { success: true, status: newStatus, isDisabled: Boolean(disabledFlag) };
}

/**
 * Delete a Main Title with safe confirmation and cascade handling
 */
export async function deleteMainCategory({ id, confirmTitle, adminId = 2 }) {
  const cat = await queryOne(`SELECT * FROM forum_categories WHERE id = ?;`, [id]);
  if (!cat) return { success: false, error: 'Main category not found.' };

  if (['general', 'ongoing-novels', 'completed-novels'].includes(id)) {
    return { success: false, error: 'Default core system categories cannot be deleted.' };
  }

  if (confirmTitle !== cat.title && confirmTitle !== cat.id) {
    return { success: false, error: `Confirmation mismatch. Please type "${cat.title}" to confirm deletion.` };
  }

  const conn = await getDb().getConnection();
  try {
    await conn.beginTransaction();

    // Check count of articles and subcategories
    const [subRows] = await conn.query(`SELECT COUNT(*) as c FROM content_subcategories WHERE main_category_id = ?;`, [id]);
    const [artRows] = await conn.query(`SELECT COUNT(*) as c FROM content_articles WHERE main_category_id = ?;`, [id]);

    // Delete access rules
    await conn.query(`DELETE FROM content_access_rules WHERE target_type = 'main' AND target_id = ?;`, [id]);
    // Delete articles
    await conn.query(`DELETE FROM content_articles WHERE main_category_id = ?;`, [id]);
    // Delete subcategories
    await conn.query(`DELETE FROM content_subcategories WHERE main_category_id = ?;`, [id]);
    // Delete main category
    await conn.query(`DELETE FROM forum_categories WHERE id = ?;`, [id]);

    await conn.commit();

    await recordAdminAudit({
      adminId,
      action: 'main_title_deleted',
      targetUserId: null,
      ipAddress: null,
      userAgent: null,
      details: `Deleted main category "${cat.title}" (Purged ${subRows[0].c} subcategories, ${artRows[0].c} articles)`
    });

    return { success: true, message: `Category "${cat.title}" deleted successfully.` };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ----------------------------------------------------------------------------
// Sub Title Management
// ----------------------------------------------------------------------------

/**
 * Create a new Sub Title under a Main Title
 */
export async function createSubCategory({ id, mainCategoryId, main_category_id, title, description, icon = '📌', sortOrder = 0, sort_order = 0, novelId = null, novel_id = null, adminId = 2 }) {
  const mId = mainCategoryId || main_category_id;
  const sOrder = sortOrder || sort_order || 0;
  const nId = novelId || novel_id || null;

  if (!mId || !title || !title.trim()) {
    return { success: false, error: 'Parent main category and sub title are required.' };
  }

  const cleanTitle = title.trim();
  const cleanId = (id || generateSlug(cleanTitle)).trim();

  const main = await queryOne(`SELECT id FROM forum_categories WHERE id = ?;`, [mId]);
  if (!main) return { success: false, error: 'Parent main category does not exist.' };

  const existing = await queryOne(`SELECT id FROM content_subcategories WHERE id = ?;`, [cleanId]);
  if (existing) {
    return { success: false, error: `A subcategory with ID "${cleanId}" already exists.` };
  }

  await query(`
    INSERT INTO content_subcategories (id, main_category_id, title, description, icon, novel_id, sort_order, status, is_active, is_disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 0);
  `, [cleanId, mId, cleanTitle, description || '', icon, nId, Number(sOrder)]);

  await recordAdminAudit({
    adminId,
    action: 'sub_title_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created subcategory "${cleanTitle}" under main "${mId}"`
  });

  return { success: true, id: cleanId, subcategory: { id: cleanId }, message: 'Subcategory created successfully!' };
}

/**
 * Update Sub Title
 */
export async function updateSubCategory({ id, mainCategoryId, title, description, icon, sortOrder, adminId = 2 }) {
  const sub = await queryOne(`SELECT * FROM content_subcategories WHERE id = ?;`, [id]);
  if (!sub) return { success: false, error: 'Subcategory not found.' };

  await query(`
    UPDATE content_subcategories
    SET main_category_id = COALESCE(?, main_category_id),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?;
  `, [
    mainCategoryId || null,
    title ? title.trim() : null,
    description !== undefined ? description : null,
    icon || null,
    sortOrder !== undefined ? Number(sortOrder) : null,
    id
  ]);

  // If moved to another main category, update children articles
  if (mainCategoryId && mainCategoryId !== sub.main_category_id) {
    await query(`UPDATE content_articles SET main_category_id = ? WHERE sub_category_id = ?;`, [mainCategoryId, id]);
  }

  await recordAdminAudit({
    adminId,
    action: 'sub_title_updated',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated subcategory "${id}"`
  });

  return { success: true, message: 'Subcategory updated successfully!' };
}

/**
 * Toggle Sub Title status
 */
export async function toggleSubCategoryStatus({ id, status, isDisabled, adminId = 2 }) {
  const sub = await queryOne(`SELECT * FROM content_subcategories WHERE id = ?;`, [id]);
  if (!sub) return { success: false, error: 'Subcategory not found.' };

  const newStatus = status || (isDisabled ? 'disabled' : (sub.status === 'published' ? 'disabled' : 'published'));
  const disabledFlag = isDisabled !== undefined ? (isDisabled ? 1 : 0) : (newStatus === 'disabled' ? 1 : 0);
  const activeFlag = newStatus === 'disabled' ? 0 : 1;

  await query(`
    UPDATE content_subcategories 
    SET status = ?, is_disabled = ?, is_active = ?
    WHERE id = ?;
  `, [newStatus, disabledFlag, activeFlag, id]);

  await recordAdminAudit({
    adminId,
    action: 'sub_title_status_changed',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Changed subcategory "${id}" status to ${newStatus}`
  });

  return { success: true, status: newStatus, isDisabled: Boolean(disabledFlag) };
}

/**
 * Delete Sub Title
 */
export async function deleteSubCategory({ id, confirmTitle, adminId = 2 }) {
  const sub = await queryOne(`SELECT * FROM content_subcategories WHERE id = ?;`, [id]);
  if (!sub) return { success: false, error: 'Subcategory not found.' };

  if (confirmTitle !== sub.title && confirmTitle !== sub.id) {
    return { success: false, error: `Confirmation mismatch. Please type "${sub.title}" to confirm deletion.` };
  }

  const conn = await getDb().getConnection();
  try {
    await conn.beginTransaction();

    // Delete access rules
    await conn.query(`DELETE FROM content_access_rules WHERE target_type = 'sub' AND target_id = ?;`, [id]);
    // Delete articles under this subcategory
    await conn.query(`DELETE FROM content_articles WHERE sub_category_id = ?;`, [id]);
    // Delete subcategory
    await conn.query(`DELETE FROM content_subcategories WHERE id = ?;`, [id]);

    await conn.commit();

    await recordAdminAudit({
      adminId,
      action: 'sub_title_deleted',
      targetUserId: null,
      ipAddress: null,
      userAgent: null,
      details: `Deleted subcategory "${sub.title}" (ID: ${id})`
    });

    return { success: true, message: `Subcategory "${sub.title}" deleted successfully.` };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ----------------------------------------------------------------------------
// Content Title & Reading Content Management
// ----------------------------------------------------------------------------

/**
 * Create a new Content Article
 */
export async function createContentArticle({
  mainCategoryId,
  main_category_id,
  subCategoryId,
  sub_category_id,
  title,
  uniqueSlug,
  unique_slug,
  content,
  summary,
  coverImage,
  cover_image,
  authorId = 2,
  author_id = 2,
  authorName = 'Rudhra Prarthana',
  author_name = 'Rudhra Prarthana',
  status = 'published',
  sortOrder = 0,
  sort_order = 0,
  adminId = 2
}) {
  const mId = mainCategoryId || main_category_id;
  const sId = subCategoryId || sub_category_id;
  const uSlug = uniqueSlug || unique_slug;
  const cImage = coverImage || cover_image || null;
  const aId = authorId || author_id || 2;
  const aName = authorName || author_name || 'Rudhra Prarthana';
  const sOrder = sortOrder || sort_order || 0;

  if (!mId || !sId || !title || !title.trim() || !content || !content.trim()) {
    return { success: false, error: 'Main title, sub title, content title, and reading content are required.' };
  }

  const cleanTitle = title.trim();
  let cleanSlug = (uSlug || generateSlug(cleanTitle)).trim();

  // Ensure unique slug
  const existing = await queryOne(`SELECT id FROM content_articles WHERE unique_slug = ?;`, [cleanSlug]);
  if (existing) {
    cleanSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`;
  }

  const isPublished = status === 'published' ? 1 : 0;
  const isDisabled = status === 'disabled' ? 1 : 0;

  const result = await query(`
    INSERT INTO content_articles (
      unique_slug, main_category_id, sub_category_id, title, content,
      summary, cover_image, author_id, author_name, status, is_published,
      is_disabled, sort_order, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());
  `, [
    cleanSlug, mId, sId, cleanTitle, content,
    summary || '', cImage, aId, aName, status,
    isPublished, isDisabled, Number(sOrder)
  ]);

  await recordAdminAudit({
    adminId,
    action: 'content_article_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created content article "${cleanTitle}" (ID: ${result.insertId}, Slug: ${cleanSlug})`
  });

  return { 
    success: true, 
    id: result.insertId, 
    article: { id: result.insertId, unique_slug: cleanSlug, slug: cleanSlug },
    slug: cleanSlug, 
    message: 'Content created successfully!' 
  };
}

/**
 * Update an existing Content Article
 */
export async function updateContentArticle({
  id,
  mainCategoryId,
  subCategoryId,
  title,
  uniqueSlug,
  content,
  summary,
  coverImage,
  authorName,
  status,
  sortOrder,
  adminId = 2
}) {
  const art = await queryOne(`SELECT * FROM content_articles WHERE id = ?;`, [id]);
  if (!art) return { success: false, error: 'Content article not found.' };

  const isPublished = status !== undefined ? (status === 'published' ? 1 : 0) : art.is_published;
  const isDisabled = status !== undefined ? (status === 'disabled' ? 1 : 0) : art.is_disabled;

  await query(`
    UPDATE content_articles
    SET main_category_id = COALESCE(?, main_category_id),
        sub_category_id = COALESCE(?, sub_category_id),
        title = COALESCE(?, title),
        unique_slug = COALESCE(?, unique_slug),
        content = COALESCE(?, content),
        summary = COALESCE(?, summary),
        cover_image = COALESCE(?, cover_image),
        author_name = COALESCE(?, author_name),
        status = COALESCE(?, status),
        is_published = ?,
        is_disabled = ?,
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?;
  `, [
    mainCategoryId || null,
    subCategoryId || null,
    title ? title.trim() : null,
    uniqueSlug ? uniqueSlug.trim() : null,
    content !== undefined ? content : null,
    summary !== undefined ? summary : null,
    coverImage !== undefined ? coverImage : null,
    authorName || null,
    status || null,
    isPublished,
    isDisabled,
    sortOrder !== undefined ? Number(sortOrder) : null,
    id
  ]);

  await recordAdminAudit({
    adminId,
    action: 'content_article_updated',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated content article "${art.title}" (ID: ${id})`
  });

  return { success: true, message: 'Content updated successfully!' };
}

/**
 * Toggle Content Article status (Published / Unpublished / Disabled)
 */
export async function toggleContentArticleStatus({ id, status, isDisabled, adminId = 2 }) {
  const art = await queryOne(`SELECT * FROM content_articles WHERE id = ?;`, [id]);
  if (!art) return { success: false, error: 'Content article not found.' };

  const newStatus = status || (isDisabled ? 'disabled' : (art.status === 'published' ? 'disabled' : 'published'));
  const disabledFlag = isDisabled !== undefined ? (isDisabled ? 1 : 0) : (newStatus === 'disabled' ? 1 : 0);
  const publishedFlag = newStatus === 'published' ? 1 : 0;

  await query(`
    UPDATE content_articles 
    SET status = ?, is_disabled = ?, is_published = ?
    WHERE id = ?;
  `, [newStatus, disabledFlag, publishedFlag, id]);

  await recordAdminAudit({
    adminId,
    action: 'content_article_status_changed',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Changed article "${art.title}" status to ${newStatus}`
  });

  return { success: true, status: newStatus, isPublished: Boolean(publishedFlag), isDisabled: Boolean(disabledFlag) };
}

/**
 * Delete a Content Article
 */
export async function deleteContentArticle({ id, confirmTitle, adminId = 2 }) {
  const art = await queryOne(`SELECT * FROM content_articles WHERE id = ?;`, [id]);
  if (!art) return { success: false, error: 'Content article not found.' };

  if (confirmTitle && confirmTitle !== 'yes' && confirmTitle !== true && confirmTitle !== 'true' && confirmTitle !== art.title && confirmTitle !== String(art.id) && confirmTitle !== art.unique_slug) {
    return { success: false, error: `Confirmation mismatch. Please type "${art.title}" to confirm deletion.` };
  }

  // Delete access rules for this content
  await query(`DELETE FROM content_access_rules WHERE target_type IN ('content', 'article') AND (target_id = ? OR target_id = ?);`, [String(id), String(art.unique_slug)]);
  // Delete comments
  await query(`DELETE FROM content_comments WHERE content_id = ?;`, [id]);
  // Delete article
  await query(`DELETE FROM content_articles WHERE id = ?;`, [id]);

  await recordAdminAudit({
    adminId,
    action: 'content_article_deleted',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Deleted content article "${art.title}" (ID: ${id})`
  });

  return { success: true, message: `Article "${art.title}" deleted successfully.` };
}

// ----------------------------------------------------------------------------
// Fine-Grained Individual Member Access Control
// ----------------------------------------------------------------------------

/**
 * Retrieve access rules for a specific content item or parent section
 */
export async function getContentAccessRules({ targetType, targetId }) {
  const rules = await query(`
    SELECT r.*, 
           u.username, u.email, p.display_name, p.avatar,
           a.username as admin_username
    FROM content_access_rules r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN profiles p ON p.user_id = r.user_id
    LEFT JOIN users a ON a.id = r.created_by_admin_id
    WHERE r.target_type = ? AND r.target_id = ?
    ORDER BY r.id DESC;
  `, [targetType, String(targetId)]);

  return {
    success: true,
    rules: rules.map(r => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      userId: r.user_id,
      userName: r.display_name || r.username || 'All Members',
      userEmail: r.email,
      ruleType: r.rule_type,
      reason: r.reason || '',
      expiresAt: r.expires_at,
      isExpired: r.expires_at ? new Date() >= new Date(r.expires_at) : false,
      adminName: r.admin_username || 'Admin',
      createdAt: r.created_at
    }))
  };
}

/**
 * Add or update an individual member access restriction rule
 */
export async function addContentAccessRule({ 
  targetType, 
  target_type, 
  targetId, 
  target_id, 
  userId, 
  user_id, 
  ruleType = 'block', 
  rule_type = 'block', 
  duration = null, 
  reason = '', 
  adminId = 2 
}) {
  const tType = targetType || target_type;
  const tId = targetId || target_id;
  const uId = userId !== undefined ? userId : user_id;
  const rType = ruleType || rule_type || 'block';

  if (!tType || !tId) {
    return { success: false, error: 'Target type and target ID are required.' };
  }

  // If uId provided, check user exists
  let targetUser = null;
  if (uId) {
    targetUser = await queryOne(`SELECT id, username, email FROM users WHERE id = ?;`, [uId]);
    if (!targetUser) return { success: false, error: 'Selected member not found.' };
  }

  const expiresAt = calculateExpiry(duration);
  let ruleId = null;

  // Check if existing rule exists for this user/target
  const existing = await queryOne(`
    SELECT id FROM content_access_rules 
    WHERE target_type = ? AND target_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL)) AND rule_type = ?;
  `, [tType, String(tId), uId || null, uId || null, rType]);

  if (existing) {
    ruleId = existing.id;
    await query(`
      UPDATE content_access_rules 
      SET expires_at = ?, reason = ?, created_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `, [expiresAt, reason || '', adminId, existing.id]);
  } else {
    const insertRes = await query(`
      INSERT INTO content_access_rules (target_type, target_id, user_id, rule_type, reason, expires_at, created_by_admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [tType, String(tId), uId || null, rType, reason || '', expiresAt, adminId]);
    ruleId = insertRes.insertId;
  }

  await recordAdminAudit({
    adminId,
    action: 'content_access_rule_created',
    targetUserId: uId || null,
    ipAddress: null,
    userAgent: null,
    details: `${rType.toUpperCase()} rule set on ${tType}:${tId} for ${targetUser ? targetUser.username : 'All Members'}. Reason: ${reason || 'N/A'}`
  });

  return { 
    success: true, 
    ruleId,
    rule: { id: ruleId },
    message: 'Access control rule applied successfully!' 
  };
}

/**
 * Remove an access restriction rule (Restore access)
 */
export async function removeContentAccessRule({ ruleId, adminId = 2 }) {
  const rule = await queryOne(`SELECT * FROM content_access_rules WHERE id = ?;`, [ruleId]);
  if (!rule) return { success: false, error: 'Access rule not found.' };

  await query(`DELETE FROM content_access_rules WHERE id = ?;`, [ruleId]);

  await recordAdminAudit({
    adminId,
    action: 'content_access_rule_removed',
    targetUserId: rule.user_id,
    ipAddress: null,
    userAgent: null,
    details: `Restored access: removed ${rule.rule_type} on ${rule.target_type}:${rule.target_id}`
  });

  return { success: true, message: 'Access rule removed and access restored successfully!' };
}
