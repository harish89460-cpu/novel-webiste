import { moveToTrash } from './trash.js';
// Forms, Threads, and Content Management Layer for Rudhra Prarthana Novels
// Implements 3-Level Hierarchy: Main Category -> Sub Category -> Content Articles
// With dedicated reading pages, comments, and fine-grained individual member access control

import { query, queryOne, getDb } from './db.js';
import { recordAdminAudit } from './admin-members.js';
import { createNotification } from './notifications.js';
import { checkAndPublishDueArticles } from './scheduler.js';

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
 * Generate a clean URL-friendly slug supporting Tamil, English, and Unicode
 */
export function generateSlug(text) {
  if (!text || typeof text !== 'string') return `item-${Date.now().toString(36)}`;
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/g, '-');
  if (!slug) {
    slug = `item-${Date.now().toString(36)}`;
  }
  return slug;
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
  await checkAndPublishDueArticles().catch(() => {});
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
    ? `SELECT id, unique_slug, main_category_id, sub_category_id, parent_id,
              title, summary, cover_image, author_id, author_name, status, is_published,
              is_disabled, visibility, access_permission, views_count, comments_count, sort_order,
              published_at, scheduled_at, created_at, updated_at
       FROM content_articles 
       ORDER BY sort_order ASC, published_at DESC, id DESC;`
    : `SELECT id, unique_slug, main_category_id, sub_category_id, parent_id,
              title, summary, cover_image, author_id, author_name, status, is_published,
              is_disabled, visibility, access_permission, views_count, comments_count, sort_order,
              published_at, scheduled_at, created_at, updated_at
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

  // Assemble the hierarchy
  const hierarchy = [];

  for (const mainCat of mainCategories) {
    if (!isAdmin && isRestricted('main', mainCat.id)) continue;

    const mainItem = {
      id: mainCat.id,
      title: mainCat.title,
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

    // Recursive builder for unlimited content hierarchy
    function buildContentTree(artList, parentId = null) {
      return artList
        .filter(a => {
          if (parentId === null) {
            return a.parent_id === null || a.parent_id === 0 || !a.parent_id;
          }
          return Number(a.parent_id) === Number(parentId);
        })
        .map(art => {
          const children = buildContentTree(artList, art.id);
          return {
            id: art.id,
            uniqueSlug: art.unique_slug,
            mainCategoryId: art.main_category_id,
            subCategoryId: art.sub_category_id,
            parentId: art.parent_id ? Number(art.parent_id) : null,
            novelId: art.novel_id || null,
            novelLink: art.novel_link || null,
            chapterNum: art.chapter_num || null,
            title: art.title,
            summary: art.summary || '',
            coverImage: art.cover_image || null,
            authorId: art.author_id,
            authorName: art.author_name || 'Rudhra Prarthana',
            status: art.status,
            isPublished: Boolean(art.is_published),
            isDisabled: Boolean(art.is_disabled),
            visibility: art.visibility || 'public',
            accessPermission: art.access_permission || 'admin_only',
            viewsCount: Number(art.views_count || 0),
            commentsCount: Number(art.comments_count || 0),
            sortOrder: Number(art.sort_order || 0),
            publishedAt: art.published_at || art.created_at,
            scheduledAt: art.scheduled_at || null,
            updatedAt: art.updated_at || art.created_at,
            link: `#content?slug=${encodeURIComponent(art.unique_slug)}`,
            children: children,
            hasChildren: children.length > 0
          };
        });
    }

    // Recursive builder for nested subcategories hierarchy (Main -> Sub-title -> Sub-sub-title)
    function buildSubcategoryTree(pId = null) {
      const directSubs = allSubcategories.filter(s => {
        if (s.main_category_id !== mainCat.id) return false;
        if (!isAdmin && isRestricted('sub', s.id)) return false;
        if (pId === null) {
          return !s.parent_id || s.parent_id === '';
        }
        return String(s.parent_id) === String(pId);
      });

      return directSubs.map(sub => {
        const childSubs = buildSubcategoryTree(sub.id);
        const hasChildren = childSubs.length > 0;
        const isLeaf = !hasChildren;

        // Filter accessible articles strictly under this exact subcategory level (no descendant or parent articles)
        const directArticles = allArticles.filter(a => String(a.sub_category_id) === String(sub.id));
        const accessibleArticles = directArticles.filter(a => {
          if (isAdmin) return true;
          if (isRestricted('content', a.id)) return false;
          if (!a.is_published || a.status === 'Draft' || a.status === 'draft') return false;
          if (a.status === 'Scheduled' && a.scheduled_at && new Date(a.scheduled_at) > new Date()) return false;
          const vis = (a.visibility || 'public').toLowerCase();
          if (vis === 'public') return true;
          if (vis === 'private' || vis === 'admin_only') return false;
          if (vis === 'members' || vis === 'all_members') return Boolean(userId);
          return true;
        });

        const sortedSubArticles = [...accessibleArticles].sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
        const subDiscussionComments = 0;

        const childItems = childSubs.reduce((sum, c) => sum + (c.stats?.totalItems || 0), 0);
        const childComments = childSubs.reduce((sum, c) => sum + (c.stats?.totalComments || 0), 0);
        const childViews = childSubs.reduce((sum, c) => sum + (c.stats?.totalViews || 0), 0);

        return {
          id: sub.id,
          mainCategoryId: sub.main_category_id,
          parentId: sub.parent_id || null,
          title: sub.title,
          description: sub.description || '',
          icon: sub.icon || '📌',
          novelId: sub.novel_id || null,
          sortOrder: Number(sub.sort_order || 0),
          status: sub.status || 'published',
          isActive: Boolean(sub.is_active),
          isDisabled: Boolean(sub.is_disabled),
          hasChildren,
          isLeaf,
          children: childSubs,
          subcategories: childSubs,
          articles: buildContentTree(accessibleArticles, null),
          discussionComments: subDiscussionComments,
          stats: {
            totalItems: accessibleArticles.length + childItems,
            totalComments: accessibleArticles.reduce((sum, a) => sum + Number(a.comments_count || 0), 0) + subDiscussionComments + childComments,
            totalViews: accessibleArticles.reduce((sum, a) => sum + Number(a.views_count || 0), 0) + childViews,
            latestTitle: sortedSubArticles[0]?.title || null,
            latestLink: sortedSubArticles[0]?.unique_slug ? `#thread?id=${encodeURIComponent(sortedSubArticles[0].unique_slug)}` : null,
            latestDate: sortedSubArticles[0]?.published_at || sortedSubArticles[0]?.created_at || null
          }
        };
      });
    }

    mainItem.subcategories = buildSubcategoryTree(null);
    const hasMainChildren = (mainItem.subcategories && mainItem.subcategories.length > 0);
    const isMainLeaf = !hasMainChildren;
    mainItem.hasChildren = hasMainChildren;
    mainItem.isLeaf = isMainLeaf;

    // Direct articles created strictly under this main category (without subcategory or where sub_category_id is null / mainCat.id)
    const directCategoryArticles = allArticles.filter(a => 
      String(a.main_category_id) === String(mainCat.id) && (!a.sub_category_id || a.sub_category_id === '' || String(a.sub_category_id) === String(mainCat.id))
    );
    const accessibleCategoryArticles = directCategoryArticles.filter(a => {
      if (isAdmin) return true;
      if (isRestricted('content', a.id)) return false;
      if (!a.is_published || a.status === 'Draft' || a.status === 'draft') return false;
      if (a.status === 'Scheduled' && a.scheduled_at && new Date(a.scheduled_at) > new Date()) return false;
      const vis = (a.visibility || 'public').toLowerCase();
      if (vis === 'public') return true;
      if (vis === 'private' || vis === 'admin_only') return false;
      if (vis === 'members' || vis === 'all_members') return Boolean(userId);
      return true;
    });
    mainItem.articles = buildContentTree(accessibleCategoryArticles, null);

    // Precalculate category-level statistics
    if (hasMainChildren) {
      const directArticles = mainItem.articles || [];
      const directLatest = directArticles[0] || null;
      const totalCatItems = mainItem.subcategories.reduce((sum, s) => sum + (s.stats?.totalItems || 0), 0) + directArticles.length;
      const totalDiscComments = mainItem.subcategories.reduce((sum, s) => sum + (s.stats?.totalComments || 0), 0) + directArticles.reduce((sum, a) => sum + Number(a.commentsCount || 0), 0);
      const totalCatViews = mainItem.subcategories.reduce((sum, s) => sum + (s.stats?.totalViews || 0), 0) + directArticles.reduce((sum, a) => sum + Number(a.viewsCount || 0), 0);
      mainItem.stats = {
        totalSubcategories: mainItem.subcategories.length,
        totalItems: totalCatItems,
        totalComments: totalDiscComments,
        totalViews: totalCatViews,
        latestTitle: directLatest?.title || null,
        latestLink: directLatest ? `#thread?id=${encodeURIComponent(directLatest.uniqueSlug || directLatest.id)}` : null,
        latestDate: directLatest ? (directLatest.publishedAt || directLatest.updatedAt) : null
      };
    } else if (isMainLeaf) {
      const directArticles = mainItem.articles || [];
      const directLatest = directArticles[0] || null;
      mainItem.stats = {
        totalSubcategories: 0,
        totalItems: directArticles.length,
        totalComments: directArticles.reduce((sum, a) => sum + Number(a.commentsCount || 0), 0),
        totalViews: directArticles.reduce((sum, a) => sum + Number(a.viewsCount || 0), 0),
        latestTitle: directLatest?.title || null,
        latestLink: directLatest ? `#thread?id=${encodeURIComponent(directLatest.uniqueSlug || directLatest.id)}` : null,
        latestDate: directLatest ? (directLatest.publishedAt || directLatest.updatedAt) : null
      };
    }

    hierarchy.push(mainItem);
  }

  return { success: true, hierarchy };
}

const recentArticleViews = new Map();

/**
 * Retrieve a single content article for dedicated reading page
 * with full authorization and restriction checks
 */
export async function getContentArticle(idOrSlug, currentUser = null, { incrementView = true } = {}) {
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
           s.parent_id as sub_parent_id,
           ps.title as parent_sub_category_title, ps.id as parent_sub_category_id,
           p.avatar as author_avatar, u.role as author_role
    FROM content_articles a
    LEFT JOIN forum_categories m ON m.id = a.main_category_id
    LEFT JOIN content_subcategories s ON s.id = a.sub_category_id
    LEFT JOIN content_subcategories ps ON ps.id = s.parent_id
    LEFT JOIN users u ON u.id = a.author_id
    LEFT JOIN profiles p ON p.user_id = a.author_id
    WHERE a.unique_slug = ? OR CAST(a.id AS CHAR) = ?
    LIMIT 1;
  `, [String(idOrSlug), String(idOrSlug)]);

  if (!article) {
    return { success: false, error: 'The requested reading content does not exist or has been removed.', code: 'NOT_FOUND' };
  }

  // 1.5. Resolve complete hierarchical breadcrumbs chain
  const breadcrumbs = [];
  if (article.main_category_id) {
    breadcrumbs.push({
      id: article.main_category_id,
      title: article.main_category_title || 'General',
      isMain: true,
      isDisabled: Boolean(article.main_is_disabled || article.main_status === 'disabled')
    });
  }
  if (article.sub_category_id) {
    const chain = [];
    let curId = article.sub_category_id;
    while (curId) {
      const sRow = await queryOne(`SELECT id, title, parent_id, is_disabled, status FROM content_subcategories WHERE id = ?;`, [curId]);
      if (!sRow) break;
      chain.unshift(sRow);
      curId = sRow.parent_id;
    }
    for (const item of chain) {
      breadcrumbs.push({
        id: item.id,
        title: item.title,
        isMain: false,
        isDisabled: Boolean(item.is_disabled || item.status === 'disabled')
      });
    }
  }

  // 2. Access checks for non-administrators
  if (!isAdmin) {
    // Draft / Unpublished check
    if (!article.is_published || article.status === 'unpublished' || article.status === 'draft') {
      return { 
        success: false, 
        error: 'This content is currently unpublished or in draft status. Only administrators may view it.', 
        code: 'UNPUBLISHED' 
      };
    }

    // Global disable checks (Item, Subcategory, or Main Category)
    if (article.is_disabled || article.status === 'disabled') {
      return { 
        success: false, 
        error: 'This content has been temporarily disabled by an administrator.', 
        code: 'DISABLED' 
      };
    }

    // Check if any ancestor category/section is disabled
    const disabledAncestor = breadcrumbs.find(b => b.isDisabled);
    if (disabledAncestor) {
      return {
        success: false,
        error: `The parent ${disabledAncestor.isMain ? 'category' : 'section'} "${disabledAncestor.title}" has been temporarily disabled by an administrator.`,
        code: 'DISABLED'
      };
    }

    // Check Individual Member Access Restrictions
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
  }

  // 6. Increment view count (only for authentic reader page visits, not comments or admin operations)
  if (incrementView && !isAdmin) {
    const debounceKey = `${userId || 'guest'}_${article.id}`;
    const lastTime = recentArticleViews.get(debounceKey) || 0;
    const now = Date.now();
    if (now - lastTime > 5000) {
      recentArticleViews.set(debounceKey, now);
      await query(`UPDATE content_articles SET views_count = views_count + 1 WHERE id = ?;`, [article.id]);
      article.views_count = Number(article.views_count || 0) + 1;
    }
    if (recentArticleViews.size > 20000) {
      recentArticleViews.clear();
    }
  }

  // 7. Resolve Parent, Children, and Siblings for nested navigation
  let parentArticle = null;
  if (article.parent_id) {
    const parentRow = await queryOne(`SELECT id, title, unique_slug FROM content_articles WHERE id = ?;`, [article.parent_id]);
    if (parentRow) {
      parentArticle = {
        id: parentRow.id,
        title: parentRow.title,
        uniqueSlug: parentRow.unique_slug,
        link: `#content?slug=${encodeURIComponent(parentRow.unique_slug)}`
      };
    }
  }

  const childRows = await query(`
    SELECT id, unique_slug, title, summary, status, published_at 
    FROM content_articles 
    WHERE parent_id = ? AND is_published = 1 AND is_disabled = 0
    ORDER BY sort_order ASC, id ASC;
  `, [article.id]);

  const siblingRows = await query(`
    SELECT id, unique_slug, title, sort_order 
    FROM content_articles 
    WHERE sub_category_id = ? 
      AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))
      AND is_published = 1 AND is_disabled = 0
    ORDER BY sort_order ASC, id ASC;
  `, [article.sub_category_id, article.parent_id || null, article.parent_id || null]);

  const formatted = formatArticle(article);
  formatted.parent = parentArticle;
  formatted.parentArticle = parentArticle;
  formatted.children = (childRows || []).map(c => ({
    id: c.id,
    title: c.title,
    uniqueSlug: c.unique_slug,
    summary: c.summary || '',
    status: c.status,
    publishedAt: c.published_at,
    link: `#content?slug=${encodeURIComponent(c.unique_slug)}`
  }));
  formatted.siblings = (siblingRows || []).map(s => ({
    id: s.id,
    title: s.title,
    uniqueSlug: s.unique_slug,
    link: `#content?slug=${encodeURIComponent(s.unique_slug)}`,
    isCurrent: s.id === article.id
  }));

  formatted.breadcrumbs = breadcrumbs;
  return { success: true, article: formatted };
}

function formatArticle(row) {
  return {
    id: row.id,
    uniqueSlug: row.unique_slug,
    mainCategoryId: row.main_category_id,
    mainCategoryTitle: row.main_category_title || 'General',
    subCategoryId: row.sub_category_id || null,
    subCategoryTitle: row.sub_category_id ? (row.sub_category_title || null) : null,
    subParentId: row.sub_parent_id || null,
    parentSubCategoryId: row.parent_sub_category_id || null,
    parentSubCategoryTitle: row.parent_sub_category_title || null,
    parentId: row.parent_id ? Number(row.parent_id) : null,
    title: row.title,
    content: row.content || '',
    summary: row.summary || '',
    coverImage: row.cover_image || null,
    authorId: row.author_id,
    authorName: row.author_name || 'Rudhra Prarthana',
    authorAvatar: row.author_avatar || '/profile.png',
    authorRole: row.author_role || 'author',
    status: row.status,
    visibility: row.visibility || 'public',
    accessPermission: row.access_permission || 'admin_only',
    scheduledAt: row.scheduled_at || null,
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
  const article = await queryOne(`SELECT id, title, author_id, unique_slug, main_category_id, sub_category_id FROM content_articles WHERE id = ?;`, [contentId]);
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

  // Real-time Notification Generation for Comments and Replies
  try {
    const commenter = await queryOne(`
      SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?;
    `, [userId]);
    const commenterName = commenter?.display_name || commenter?.username || 'A reader';
    const cleanSnippet = cleanText.replace(/<[^>]+>/g, '').trim().slice(0, 80);
    const threadLink = `#thread?id=${encodeURIComponent(article.unique_slug || article.id)}`;

    if (parentId) {
      // 1. Reply: notify parent comment author
      const parentComment = await queryOne(`
        SELECT id, user_id FROM content_comments WHERE id = ?;
      `, [parentId]);

      if (parentComment && parentComment.user_id && Number(parentComment.user_id) !== Number(userId)) {
        await createNotification({
          userId: parentComment.user_id,
          actorId: userId,
          type: 'comment_reply',
          title: 'New Reply to your Comment',
          message: `${commenterName} replied to your comment on "${article.title}": "${cleanSnippet}"`,
          link: threadLink,
          entityType: 'comment',
          entityId: result.insertId
        }).catch(() => {});
      }

      // Also notify thread author if thread author is neither commenter nor parent comment author
      if (article.author_id && 
          Number(article.author_id) !== Number(userId) && 
          (!parentComment || Number(parentComment.user_id) !== Number(article.author_id))) {
        await createNotification({
          userId: article.author_id,
          actorId: userId,
          type: 'novel_comment',
          title: `New Comment on "${article.title}"`,
          message: `${commenterName} commented on your thread "${article.title}": "${cleanSnippet}"`,
          link: threadLink,
          entityType: 'content_article',
          entityId: article.id
        }).catch(() => {});
      }
    } else {
      // 2. Direct comment on thread: notify thread author
      if (article.author_id && Number(article.author_id) !== Number(userId)) {
        await createNotification({
          userId: article.author_id,
          actorId: userId,
          type: 'novel_comment',
          title: `New Comment on "${article.title}"`,
          message: `${commenterName} commented on your thread "${article.title}": "${cleanSnippet}"`,
          link: threadLink,
          entityType: 'content_article',
          entityId: article.id
        }).catch(() => {});
      }
    }
  } catch (notifErr) {
    console.warn('[Thread Comment Notification Error]:', notifErr.message);
  }

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
export async function createMainCategory({ id, title, icon = '💬', color = '#2E1065', sortOrder, sort_order, adminId = 2 }) {
  if (!title || !title.trim()) {
    return { success: false, error: 'Main title is required.' };
  }

  const cleanTitle = title.trim();
  const cleanId = (id || generateSlug(cleanTitle)).trim();

  const existing = await queryOne(`SELECT id FROM forum_categories WHERE id = ?;`, [cleanId]);
  if (existing) {
    return { success: false, error: `A category with ID "${cleanId}" already exists.` };
  }

  let finalSortOrder;
  const inputOrder = sortOrder !== undefined ? sortOrder : sort_order;
  if (inputOrder !== undefined && inputOrder !== null && inputOrder !== '' && !isNaN(Number(inputOrder))) {
    finalSortOrder = Number(inputOrder);
  } else {
    // Sensible default: place after existing categories
    const maxRow = await queryOne('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM forum_categories;');
    finalSortOrder = Number(maxRow?.max_order || 0) + 1;
  }

  await query(`
    INSERT INTO forum_categories (id, title, icon, color, sort_order, is_active, status, is_disabled)
    VALUES (?, ?, ?, ?, ?, 1, 'published', 0);
  `, [cleanId, cleanTitle, icon, color, finalSortOrder]);

  await recordAdminAudit({
    adminId,
    action: 'main_title_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created main category "${cleanTitle}" (ID: ${cleanId}, Order: ${finalSortOrder})`
  });

  return { success: true, id: cleanId, category: { id: cleanId, sortOrder: finalSortOrder }, message: 'Main category created successfully!' };
}

/**
 * Update an existing Main Title
 */
export async function updateMainCategory({ id, title, icon, color, sortOrder, sort_order, adminId = 2 }) {
  const cat = await queryOne(`SELECT * FROM forum_categories WHERE id = ?;`, [id]);
  if (!cat) return { success: false, error: 'Main category not found.' };

  const inputOrder = sortOrder !== undefined ? sortOrder : sort_order;
  const finalSortOrder = inputOrder !== undefined && inputOrder !== null && inputOrder !== '' && !isNaN(Number(inputOrder))
    ? Number(inputOrder)
    : null;

  await query(`
    UPDATE forum_categories 
    SET title = COALESCE(?, title),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?;
  `, [
    title ? title.trim() : null,
    icon || null,
    color || null,
    finalSortOrder,
    id
  ]);

  await recordAdminAudit({
    adminId,
    action: 'main_title_updated',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated main category "${id}"${finalSortOrder !== null ? ` (Order: ${finalSortOrder})` : ''}`
  });

  return { success: true, message: 'Main category updated successfully!' };
}

/**
 * Reorder Main Categories (Bulk Sort Order update)
 */
export async function reorderMainCategories(orderList, adminId = 2) {
  if (!Array.isArray(orderList) || orderList.length === 0) {
    return { success: false, error: 'Ordered list of categories is required.' };
  }

  for (let i = 0; i < orderList.length; i++) {
    const item = orderList[i];
    const catId = typeof item === 'string' ? item : item.id;
    const orderNum = typeof item === 'object' && item.sortOrder !== undefined
      ? Number(item.sortOrder)
      : (typeof item === 'object' && item.sort_order !== undefined ? Number(item.sort_order) : (i + 1));
    
    if (catId) {
      await query('UPDATE forum_categories SET sort_order = ? WHERE id = ?;', [orderNum, catId]);
    }
  }

  await recordAdminAudit({
    adminId,
    action: 'main_categories_reordered',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated display order for ${orderList.length} main categories.`
  });

  const updatedCategories = await query('SELECT * FROM forum_categories ORDER BY sort_order ASC, title ASC;');
  return {
    success: true,
    message: 'Category display order updated successfully!',
    categories: updatedCategories
  };
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

  const trimmedConfirm = (confirmTitle || '').trim().toLowerCase();
  const trimmedTitle = (cat.title || '').trim().toLowerCase();
  const trimmedId = String(cat.id || '').trim().toLowerCase();
  if (trimmedConfirm && trimmedConfirm !== trimmedTitle && trimmedConfirm !== trimmedId) {
    return { success: false, error: `Confirmation mismatch. Please type "${cat.title}" to confirm deletion.` };
  }

  const conn = await getDb().getConnection();
  try {
    await conn.beginTransaction();

    // Check all subcategories and child subcategories under this main category
    const [subRows] = await conn.query(`SELECT * FROM content_subcategories WHERE main_category_id = ?;`, [id]);
    const subIds = (subRows || []).map(s => s.id);

    // Save full snapshot to Trash before removal
    try {
      await moveToTrash({
        itemType: 'main_category',
        itemId: cat.id,
        title: cat.title,
        ownerId: adminId,
        deletedBy: adminId,
        originalLocation: 'Form Management',
        itemData: {
          category: cat,
          subcategories: subRows || []
        }
      });
    } catch (trashErr) {
      console.warn('Could not move main category to trash:', trashErr.message);
    }

    if (subIds.length > 0) {
      // Delete access rules for subcategories
      for (const sId of subIds) {
        await conn.query(`DELETE FROM content_access_rules WHERE target_type = 'sub' AND target_id = ?;`, [sId]);
      }
      // Delete articles under these subcategories
      for (const sId of subIds) {
        await conn.query(`DELETE FROM content_articles WHERE sub_category_id = ?;`, [sId]);
      }
      // Delete child subcategories (sub-sub-titles)
      for (const sId of subIds) {
        await conn.query(`DELETE FROM content_subcategories WHERE parent_id = ?;`, [sId]);
      }
      // Delete subcategories
      await conn.query(`DELETE FROM content_subcategories WHERE main_category_id = ?;`, [id]);
    }

    // Delete access rules for main category
    await conn.query(`DELETE FROM content_access_rules WHERE target_type IN ('main', 'main_category') AND target_id = ?;`, [id]);
    // Delete any articles under main category
    await conn.query(`DELETE FROM content_articles WHERE main_category_id = ?;`, [id]);
    // Delete forum topics and posts if any
    await conn.query(`DELETE FROM forum_topics WHERE category_id = ?;`, [id]);
    // Delete main category
    await conn.query(`DELETE FROM forum_categories WHERE id = ?;`, [id]);

    await conn.commit();

    await recordAdminAudit({
      adminId,
      action: 'main_title_deleted',
      targetUserId: null,
      ipAddress: null,
      userAgent: null,
      details: `Deleted main category "${cat.title}" (Purged ${subIds.length} subcategories)`
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
export async function createSubCategory({ id, mainCategoryId, main_category_id, parentId, parent_id, title, description, icon = '📌', sortOrder = 0, sort_order = 0, adminId = 2 }) {
  const mId = mainCategoryId || main_category_id;
  const pId = parentId || parent_id || null;
  const sOrder = sortOrder !== undefined ? sortOrder : (sort_order !== undefined ? sort_order : 0);

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
    INSERT INTO content_subcategories (id, main_category_id, parent_id, title, description, icon, sort_order, status, is_active, is_disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 0);
  `, [cleanId, mId, pId, cleanTitle, description || '', icon, Number(sOrder)]);

  await recordAdminAudit({
    adminId,
    action: 'sub_title_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created subcategory "${cleanTitle}" under main "${mId}" (parent: ${pId || 'none'})`
  });

  return { success: true, id: cleanId, subcategory: { id: cleanId }, message: 'Subcategory created successfully!' };
}

/**
 * Update Sub Title
 */
export async function updateSubCategory({
  id,
  mainCategoryId,
  main_category_id,
  parentId,
  parent_id,
  title,
  description,
  icon,
  sortOrder,
  sort_order,
  status,
  is_disabled,
  isDisabled,
  adminId = 2
}) {
  const sub = await queryOne(`SELECT * FROM content_subcategories WHERE id = ?;`, [id]);
  if (!sub) return { success: false, error: 'Subcategory not found.' };

  const mId = mainCategoryId || main_category_id || sub.main_category_id;
  const pId = parentId !== undefined ? parentId : (parent_id !== undefined ? parent_id : sub.parent_id);
  const sOrder = sortOrder !== undefined ? sortOrder : (sort_order !== undefined ? sort_order : sub.sort_order);

  let newStatus = status;
  let newDisabled = is_disabled !== undefined ? is_disabled : (isDisabled !== undefined ? (isDisabled ? 1 : 0) : undefined);
  if (newStatus !== undefined && newDisabled === undefined) {
    newDisabled = newStatus === 'disabled' ? 1 : 0;
  } else if (newDisabled !== undefined && newStatus === undefined) {
    newStatus = newDisabled ? 'disabled' : 'published';
  }

  await query(`
    UPDATE content_subcategories
    SET main_category_id = ?,
        parent_id = ?,
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        status = COALESCE(?, status),
        is_disabled = COALESCE(?, is_disabled),
        is_active = CASE WHEN COALESCE(?, is_disabled) = 1 THEN 0 ELSE 1 END
    WHERE id = ?;
  `, [
    mId || null,
    pId || null,
    title ? title.trim() : null,
    description !== undefined ? description : null,
    icon || null,
    sOrder !== undefined ? Number(sOrder) : null,
    newStatus || null,
    newDisabled !== undefined ? Number(newDisabled) : null,
    newDisabled !== undefined ? Number(newDisabled) : null,
    id
  ]);

  // If moved to another main category, update all descendant articles and child subcategories
  if (mId && mId !== sub.main_category_id) {
    await query(`UPDATE content_articles SET main_category_id = ? WHERE sub_category_id = ?;`, [mId, id]);
    async function updateDescendantMain(pSubId) {
      const children = await query('SELECT id FROM content_subcategories WHERE parent_id = ?;', [pSubId]);
      for (const c of children) {
        await query('UPDATE content_subcategories SET main_category_id = ? WHERE id = ?;', [mId, c.id]);
        await query('UPDATE content_articles SET main_category_id = ? WHERE sub_category_id = ?;', [mId, c.id]);
        await updateDescendantMain(c.id);
      }
    }
    await updateDescendantMain(id);
  }

  await recordAdminAudit({
    adminId,
    action: 'sub_title_updated',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated subcategory "${id}" (Parent: ${pId || 'none'}, Main: ${mId})`
  });

  return { success: true, message: 'Subcategory updated successfully!' };
}

/**
 * Reorder Sub Categories (Bulk Sort Order & Hierarchy update)
 */
export async function reorderSubCategories(orderList, adminId = 2) {
  if (!Array.isArray(orderList) || orderList.length === 0) {
    return { success: false, error: 'Ordered list of subcategories is required.' };
  }

  for (let i = 0; i < orderList.length; i++) {
    const item = orderList[i];
    const subId = typeof item === 'string' ? item : item.id;
    const orderNum = typeof item === 'object' && item.sortOrder !== undefined
      ? Number(item.sortOrder)
      : (typeof item === 'object' && item.sort_order !== undefined ? Number(item.sort_order) : (i + 1));
    const pId = typeof item === 'object' ? (item.parentId !== undefined ? item.parentId : item.parent_id) : undefined;
    const mId = typeof item === 'object' ? (item.mainCategoryId || item.main_category_id) : undefined;
    
    if (subId) {
      if (pId !== undefined && mId) {
        await query('UPDATE content_subcategories SET sort_order = ?, parent_id = ?, main_category_id = ? WHERE id = ?;', [orderNum, pId || null, mId, subId]);
        await query('UPDATE content_articles SET main_category_id = ? WHERE sub_category_id = ?;', [mId, subId]);
      } else if (pId !== undefined) {
        await query('UPDATE content_subcategories SET sort_order = ?, parent_id = ? WHERE id = ?;', [orderNum, pId || null, subId]);
      } else if (mId) {
        await query('UPDATE content_subcategories SET sort_order = ?, main_category_id = ? WHERE id = ?;', [orderNum, mId, subId]);
        await query('UPDATE content_articles SET main_category_id = ? WHERE sub_category_id = ?;', [mId, subId]);
      } else {
        await query('UPDATE content_subcategories SET sort_order = ? WHERE id = ?;', [orderNum, subId]);
      }
    }
  }

  await recordAdminAudit({
    adminId,
    action: 'subcategories_reordered',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Updated display order and relationships for ${orderList.length} subcategories.`
  });

  const updatedSubs = await query('SELECT * FROM content_subcategories ORDER BY sort_order ASC, title ASC;');
  return {
    success: true,
    message: 'Subcategory display order updated successfully!',
    subcategories: updatedSubs
  };
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

  const trimmedConfirm = (confirmTitle || '').trim().toLowerCase();
  const trimmedTitle = (sub.title || '').trim().toLowerCase();
  const trimmedId = String(sub.id || '').trim().toLowerCase();
  if (trimmedConfirm && trimmedConfirm !== trimmedTitle && trimmedConfirm !== trimmedId) {
    return { success: false, error: `Confirmation mismatch. Please type "${sub.title}" to confirm deletion.` };
  }

  const conn = await getDb().getConnection();
  try {
    await conn.beginTransaction();

    // Check for all child subcategories recursively (sub-sub-titles, sub-sub-sub-titles, etc.)
    async function getAllDescendantSubs(parentIds) {
      if (!parentIds || parentIds.length === 0) return [];
      const [rows] = await conn.query(`SELECT * FROM content_subcategories WHERE parent_id IN (?);`, [parentIds]);
      if (!rows || rows.length === 0) return [];
      const deeper = await getAllDescendantSubs(rows.map(r => r.id));
      return [...rows, ...deeper];
    }

    const allDescendantRows = await getAllDescendantSubs([id]);
    const childIds = allDescendantRows.map(c => c.id);
    const allIdsToDelete = [id, ...childIds];
    const mainCat = await queryOne(`SELECT title FROM forum_categories WHERE id = ?;`, [sub.main_category_id]);

    // Save full snapshot to Trash before removal
    try {
      await moveToTrash({
        itemType: 'sub_category',
        itemId: sub.id,
        title: sub.title,
        ownerId: adminId,
        deletedBy: adminId,
        originalLocation: mainCat ? `Main Title: ${mainCat.title}` : `Main ID: ${sub.main_category_id}`,
        itemData: {
          subcategory: sub,
          childSubcategories: allDescendantRows || []
        }
      });
    } catch (trashErr) {
      console.warn('Could not move subcategory to trash:', trashErr.message);
    }

    for (const targetId of allIdsToDelete) {
      await conn.query(`DELETE FROM content_access_rules WHERE target_type = 'sub' AND target_id = ?;`, [targetId]);
      await conn.query(`DELETE FROM content_articles WHERE sub_category_id = ?;`, [targetId]);
    }

    if (childIds.length > 0) {
      await conn.query(`DELETE FROM content_subcategories WHERE id IN (?);`, [childIds]);
    }
    await conn.query(`DELETE FROM content_subcategories WHERE id = ?;`, [id]);

    await conn.commit();

    await recordAdminAudit({
      adminId,
      action: 'sub_title_deleted',
      targetUserId: null,
      ipAddress: null,
      userAgent: null,
      details: `Deleted subcategory "${sub.title}" (ID: ${id}, purged ${childIds.length} descendant titles)`
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
  parentId = null,
  parent_id = null,
  title,
  uniqueSlug,
  unique_slug,
  content = '',
  summary = '',
  coverImage = null,
  cover_image = null,
  authorId = 2,
  author_id = 2,
  authorName = 'Rudhra Prarthana',
  author_name = 'Rudhra Prarthana',
  status = 'published',
  visibility = 'public',
  accessPermission = 'admin_only',
  access_permission = 'admin_only',
  isPublished: isPublishedParam,
  is_published,
  scheduledAt = null,
  scheduled_at = null,
  sortOrder = 0,
  sort_order = 0,
  adminId = 2
}) {
  const mId = mainCategoryId || main_category_id;
  const sId = subCategoryId || sub_category_id;
  const pId = parentId !== undefined && parentId !== null && parentId !== '' ? Number(parentId) : (parent_id ? Number(parent_id) : null);
  const uSlug = uniqueSlug || unique_slug;
  const cImage = coverImage || cover_image || null;
  const aId = authorId || author_id || 2;
  const aName = authorName || author_name || 'Rudhra Prarthana';
  const sOrder = sortOrder || sort_order || 0;
  const accPerm = accessPermission || access_permission || 'admin_only';
  const schedAt = scheduledAt || scheduled_at || null;

  const cleanSubId = (sId && String(sId).trim() !== '' && String(sId) !== String(mId)) ? String(sId).trim() : null;

  if (!mId || !title || !title.trim()) {
    return { success: false, error: 'Main category and thread title are required.' };
  }

  const cleanTitle = title.trim();
  let cleanSlug = (uSlug || generateSlug(cleanTitle)).trim();

  // Ensure unique slug
  const existing = await queryOne(`SELECT id FROM content_articles WHERE unique_slug = ?;`, [cleanSlug]);
  if (existing) {
    cleanSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`;
  }

  const statusLower = (status || '').toLowerCase();
  const isPublished = (
    statusLower === 'published' || 
    statusLower === 'ongoing' || 
    statusLower === 'completed' || 
    isPublishedParam === 1 || 
    isPublishedParam === true || 
    is_published === 1 || 
    is_published === true
  ) ? 1 : 0;
  const isDisabled = statusLower === 'disabled' ? 1 : 0;

  const result = await query(`
    INSERT INTO content_articles (
      unique_slug, main_category_id, sub_category_id, parent_id,
      title, content, summary, cover_image, author_id, author_name, status, visibility, access_permission,
      is_published, is_disabled, sort_order, published_at, scheduled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?);
  `, [
    cleanSlug, mId, cleanSubId, pId,
    cleanTitle, content || '', summary || '', cImage, aId, aName, status, visibility, accPerm,
    isPublished, isDisabled, Number(sOrder), schedAt
  ]);

  await recordAdminAudit({
    adminId,
    action: 'content_article_created',
    targetUserId: null,
    ipAddress: null,
    userAgent: null,
    details: `Created content article "${cleanTitle}" (ID: ${result.insertId}, ParentID: ${pId}, Slug: ${cleanSlug})`
  });

  // Notify followers and members if published
  if (isPublished) {
    try {
      const author = await queryOne(`
        SELECT u.id, u.username, u.role, COALESCE(p.display_name, u.username) AS display_name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = ?;
      `, [aId]);
      const authorDisplayName = author?.display_name || aName || author?.username || 'A member';
      const threadLink = `#thread?id=${encodeURIComponent(cleanSlug)}`;

      // Thread creation recipients:
      // 1. All active Admins and Writers (moderators)
      // 2. All followers of the thread author
      // 3. All active Members who have notify_forum enabled (default: true)
      // Excludes the author themselves (u.id != aId)
      const recipients = await query(`
        SELECT DISTINCT u.id AS user_id
        FROM users u
        LEFT JOIN notification_preferences np ON u.id = np.user_id
        WHERE u.id != ?
          AND u.status = 'active'
          AND (
            LOWER(u.role) IN ('admin', 'administrator', 'editor', 'writer', 'author')
            OR u.id IN (SELECT follower_id FROM follows WHERE following_id = ?)
            OR (np.notify_forum IS NULL OR np.notify_forum = 1)
          );
      `, [aId, aId]);

      for (const r of recipients) {
        await createNotification({
          userId: r.user_id,
          actorId: aId,
          type: 'thread_created',
          title: 'New Thread Published',
          message: `${authorDisplayName} published a new thread: "${cleanTitle}".`,
          link: threadLink,
          entityType: 'content_article',
          entityId: result.insertId
        }).catch((err) => {
          console.warn('[Notification Delivery Warning]:', err.message);
        });
      }
    } catch (err) {
      console.warn('[Thread Creation Notification Error]:', err.message);
    }
  }

  return { 
    success: true, 
    id: result.insertId, 
    article: { id: result.insertId, uniqueSlug: cleanSlug, unique_slug: cleanSlug, slug: cleanSlug, parent_id: pId, title: cleanTitle },
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
  parentId,
  parent_id,
  title,
  uniqueSlug,
  content,
  summary,
  coverImage,
  authorName,
  status,
  visibility,
  accessPermission,
  access_permission,
  scheduledAt,
  scheduled_at,
  sortOrder,
  adminId = 2
}) {
  const art = await queryOne(`SELECT * FROM content_articles WHERE id = ?;`, [id]);
  if (!art) return { success: false, error: 'Content article not found.' };

  const isPublished = status !== undefined ? (status === 'published' ? 1 : 0) : art.is_published;
  const isDisabled = status !== undefined ? (status === 'disabled' ? 1 : 0) : art.is_disabled;
  const pId = parentId !== undefined ? (parentId ? Number(parentId) : null) : (parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : art.parent_id);
  const accPerm = accessPermission || access_permission || art.access_permission;
  const schedAt = scheduledAt !== undefined ? scheduledAt : (scheduled_at !== undefined ? scheduled_at : art.scheduled_at);

  await query(`
    UPDATE content_articles
    SET main_category_id = COALESCE(?, main_category_id),
        sub_category_id = COALESCE(?, sub_category_id),
        parent_id = ?,
        title = COALESCE(?, title),
        unique_slug = COALESCE(?, unique_slug),
        content = COALESCE(?, content),
        summary = COALESCE(?, summary),
        cover_image = COALESCE(?, cover_image),
        author_name = COALESCE(?, author_name),
        status = COALESCE(?, status),
        visibility = COALESCE(?, visibility),
        access_permission = ?,
        scheduled_at = ?,
        is_published = ?,
        is_disabled = ?,
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?;
  `, [
    mainCategoryId || null,
    subCategoryId || null,
    pId,
    title ? title.trim() : null,
    uniqueSlug ? uniqueSlug.trim() : null,
    content !== undefined ? content : null,
    summary !== undefined ? summary : null,
    coverImage !== undefined ? coverImage : null,
    authorName || null,
    status || null,
    visibility || null,
    accPerm,
    schedAt,
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

  // Move to Trash before deleting permanently
  try {
    await moveToTrash({
      itemType: 'article',
      itemId: art.id,
      title: art.title,
      ownerId: art.author_id,
      deletedBy: adminId,
      originalLocation: `Hierarchy > ${art.main_category_id} > ${art.sub_category_id}`,
      itemData: art
    });
  } catch (err) {
    console.error('Failed to move article to trash:', err);
  }

  // Delete child articles recursively
  const childIds = await query(`SELECT id FROM content_articles WHERE parent_id = ?;`, [id]);
  for (const c of childIds) {
    await deleteContentArticle({ id: c.id, confirmTitle: true, adminId });
  }

  // Delete access rules for this content
  await query(`DELETE FROM content_access_rules WHERE target_type IN ('content', 'article') AND (target_id = ? OR target_id = ?);`, [String(id), String(art.unique_slug)]);
  // Delete comments in content_comments
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
