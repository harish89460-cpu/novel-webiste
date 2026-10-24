// Consolidated REST API Middleware for Rudhra Prarthana Novels
// Pure MySQL Database Integration with Role-Based Security

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  registerUser,
  loginUser,
  loginAuthor,
  getUserByToken,
  logoutUser,
  setActivityStatus,
  touchHeartbeat,
  getAllMembersWithStatus,
  updateUserProfile,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  completePasswordReset
} from './auth.js';
import { getChapterContent, getAudioAccess } from './content.js';
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  getReactions,
  toggleReaction
} from './comments.js';
import {
  getAllNovels,
  getNovelById,
  getChaptersByNovel,
  getHomepageData,
  updateNovel,
  createNovel,
  deleteNovel,
  updateSectionVisibility
} from './novels.js';
import {
  getSidebarPostsFromDb,
  getForumTopicsFromDb,
  getForumTopicByIdFromDb,
  addForumReplyToDb,
  createForumTopicInDb,
  getForumCategoriesFromDb,
  getReadingProgressFromDb,
  saveReadingProgressToDb,
  getLikesFromDb,
  toggleLikeInDb,
  recordGuestVisitor,
  getForumLiveStatsFromDb,
  query,
  queryOne
} from './db.js';
import {
  getUserNotifications,
  getUnreadNotificationsCount,
  markNotificationReadInDb,
  markAllNotificationsReadInDb,
  registerSseClient,
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  getNotificationPreferences,
  updateNotificationPreferences
} from './notifications.js';
import {
  getEpisodesByNovel,
  getEpisodeById,
  createEpisode,
  updateEpisode,
  duplicateEpisode,
  deleteEpisode,
  getScheduledEpisodes,
  publishEpisodeNow,
  cancelEpisodeSchedule,
  checkAndPublishDueEpisodes
} from './episodes.js';
import {
  getAdminOverview,
  getMediaList,
  uploadMediaAsset,
  deleteMediaAsset,
  getSiteSettings,
  updateSiteSettings,
  getAdminHomepageSections,
  createAdminHomepageSection,
  updateAdminHomepageSection,
  reorderAdminHomepageSections,
  toggleAdminHomepageSectionVisibility,
  deleteAdminHomepageSection,
  resetAdminHomepageSectionsOrder
} from './admin.js';
import {
  getAllAudioNovels,
  getAudioNovelByIdOrSlug,
  createAudioNovel,
  updateAudioNovel,
  deleteAudioNovel,
  saveBase64Audio
} from './audio.js';
import {
  recordPresence,
  removePresence,
  getOnlinePresenceSummary
} from './presence.js';
import {
  createWriterAccount,
  getAllWriters,
  getWriterDetails,
  updateWriterProfile,
  setWriterStatus,
  deleteWriterAccount,
  getWriterAuditLogs,
  getWriterWorkspaceData
} from './writers.js';

function readJsonBody(req, maxBytes = 55 * 1024 * 1024) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(JSON.stringify(data));
}

function extractToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'];
  }
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const tokenParam = urlObj.searchParams.get('token');
    if (tokenParam) return tokenParam.trim();
  } catch {}
  return null;
}

function extractCookie(req, name) {
  const header = req.headers['cookie'];
  if (!header) return null;
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Access Control: Strictly require active Author / Admin session
 */
function requireAdminOrEditor(currentUser, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!currentUser) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Authentication required. Please log in.', code: 'UNAUTHORIZED' }));
    return true;
  }
  const isAuthorizedAuthor = currentUser.isAdmin === true && currentUser.isAuthorSession === true;
  if (!isAuthorizedAuthor) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Access denied: Author & Admin privileges required. Please authenticate via the dedicated Author Login page.',
      code: 'FORBIDDEN' 
    }));
    return true;
  }
  return false;
}

/**
 * Access Control: Require active Writer OR Admin session
 */
function requireWriterOrAdmin(currentUser, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!currentUser) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Authentication required. Please log in.', code: 'UNAUTHORIZED' }));
    return true;
  }
  const isAuthorized = currentUser.isAdmin === true || currentUser.isWriter === true;
  if (!isAuthorized) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Access denied: Writer or Admin privileges required.',
      code: 'FORBIDDEN' 
    }));
    return true;
  }
  return false;
}

export async function apiMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const parsed = {
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams.entries())
  };
  const method = req.method.toUpperCase();
  const token = extractToken(req);
  const currentUser = token ? await getUserByToken(token) : null;

  // 1. Health Check & Database Status
  if (pathname === '/health' || pathname === '/health/') {
    return sendJson(res, { status: 'ok', database: 'mysql', timestamp: new Date().toISOString() });
  }

  // 2. Authentication: Register (standard readers)
  if (pathname === '/auth/register' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await registerUser(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 3. Authentication: Normal Reader Login (strictly non-admin reader session)
  if (pathname === '/auth/login' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await loginUser(body);
    if (!result.success) {
      return sendJson(res, result, 401);
    }
    return sendJson(res, result, 200);
  }

  // 3-Admin. Dedicated Author & Administrator Login (creates author session)
  if ((pathname === '/auth/admin/login' || pathname === '/admin/login') && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await loginAuthor(body);
    if (!result.success) {
      const statusCode = result.error.includes('Access denied') ? 403 : 401;
      return sendJson(res, result, statusCode);
    }
    return sendJson(res, result, 200);
  }

  // 3a. Forgot Password: Request OTP
  if (pathname === '/auth/forgot-password/request-otp' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await requestPasswordResetOtp(body.email);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 3b. Forgot Password: Verify OTP
  if (pathname === '/auth/forgot-password/verify-otp' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await verifyPasswordResetOtp(body.email, body.otp);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 3c. Forgot Password: Resend OTP
  if (pathname === '/auth/forgot-password/resend-otp' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await resendPasswordResetOtp(body.email);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 3d. Forgot Password: Reset Password
  if (pathname === '/auth/forgot-password/reset-password' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await completePasswordReset(body.email, body.resetToken, body.newPassword, body.confirmPassword);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 4. Authentication: Current Session User (Me)
  if (pathname === '/auth/me' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { authenticated: false, isGuest: true }, 200);
    }
    const guestId = req.headers['x-guest-session-id'] || null;
    await recordPresence({ userId: currentUser.id, guestId, isMember: true });
    return sendJson(res, { authenticated: true, isGuest: false, user: currentUser }, 200);
  }

  // 5. Authentication: Logout
  if (pathname === '/auth/logout' && method === 'POST') {
    if (currentUser) {
      await removePresence({ userId: currentUser.id });
    }
    await logoutUser(token);
    return sendJson(res, { success: true }, 200);
  }

  // 6. User Activity Status Toggle
  if (pathname === '/user/activity-status' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const isEnabled = Boolean(body.enabled);
    const result = await setActivityStatus(currentUser.id, isEnabled);
    return sendJson(res, result, 200);
  }

  // 7. User Activity Heartbeat
  if (pathname === '/user/heartbeat' && method === 'POST') {
    if (currentUser) {
      await recordPresence({ userId: currentUser.id, isMember: true });
    }
    return sendJson(res, { success: true }, 200);
  }

  // 7a. Real-Time Online Presence Ping / Heartbeat (Members & Guests)
  if ((pathname === '/presence/ping' || pathname === '/presence/heartbeat') && method === 'POST') {
    const body = await readJsonBody(req).catch(() => ({}));
    const guestId = body?.guestId || req.headers['x-guest-session-id'] || null;

    if (currentUser) {
      await recordPresence({ userId: currentUser.id, guestId, isMember: true });
    } else if (guestId) {
      await recordGuestVisitor({ visitorId: guestId, userAgent: req.headers['user-agent'] });
      await recordPresence({ userId: null, guestId, isMember: false });
    }

    const viewerId = currentUser ? currentUser.id : null;
    const summary = await getOnlinePresenceSummary(viewerId);
    return sendJson(res, {
      success: true,
      isMember: Boolean(currentUser),
      ...summary
    }, 200);
  }

  // 7b. Real-Time Online Presence Statistics (Public Reader)
  if (pathname === '/presence' && method === 'GET') {
    const viewerId = currentUser ? currentUser.id : null;
    const summary = await getOnlinePresenceSummary(viewerId);
    return sendJson(res, { success: true, ...summary }, 200);
  }

  // 8. User Profile Update
  if (pathname === '/user/profile' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const result = await updateUserProfile(currentUser.id, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 8a. User Reading Progress
  if ((pathname === '/user/reading-progress' || pathname === '/reading-progress') && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { success: true, progress: [] }, 200);
    }
    const novelId = parsed.query.novel || parsed.query.novelId;
    const progress = await getReadingProgressFromDb(currentUser.id, novelId);
    return sendJson(res, { success: true, progress }, 200);
  }

  if ((pathname === '/user/reading-progress' || pathname === '/reading-progress') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const novelId = body.novelId;
    const chapterVal = body.chapterNum !== undefined ? body.chapterNum : body.chapterNumber;
    if (!novelId || chapterVal === undefined) {
      return sendJson(res, { success: false, error: 'novelId and chapterNum required' }, 400);
    }
    const chVal = String(chapterVal || '1').trim();
    const pct = body.percentage !== undefined ? body.percentage : (body.progressPercentage !== undefined ? body.progressPercentage : 100);
    const result = await saveReadingProgressToDb(currentUser.id, novelId, chVal, pct);
    return sendJson(res, result, 200);
  }

  // 9. Members Directory with Activity Status (Privacy Protected)
  if (pathname === '/members' && method === 'GET') {
    const viewerId = currentUser ? currentUser.id : null;
    const members = await getAllMembersWithStatus(viewerId);
    return sendJson(res, { success: true, members }, 200);
  }

  // 9a. Member Detail
  if (pathname.startsWith('/members/') && method === 'GET') {
    let memberIdOrUsername = pathname.replace('/members/', '').trim();
    if (memberIdOrUsername === 'me') {
      if (!currentUser) {
        return sendJson(res, { success: false, error: 'Authentication required' }, 401);
      }
      memberIdOrUsername = String(currentUser.id);
    }
    const viewerId = currentUser ? currentUser.id : null;
    const row = await queryOne(`
      SELECT 
        u.id, u.username, u.role,
        p.display_name, p.avatar, p.bio, p.title, p.joined_date,
        p.posts_count, p.topics_count, p.followers_count,
        a.is_enabled AS activity_status_enabled,
        a.is_online, a.last_seen
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN activity_status a ON u.id = a.user_id
      WHERE u.id = ? OR LOWER(u.username) = LOWER(?);
    `, [memberIdOrUsername, memberIdOrUsername]);

    if (!row) {
      return sendJson(res, { success: false, error: 'Member not found' }, 404);
    }

    const isSelf = viewerId && viewerId === row.id;
    const canShowStatus = Boolean(row.activity_status_enabled) || isSelf;

    return sendJson(res, {
      success: true,
      member: {
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        avatar: row.avatar || '/profile.png',
        role: row.role || 'Member',
        title: row.title || row.role || 'Member',
        joined: row.joined_date || 'Member',
        bio: row.bio || '',
        posts: Number(row.posts_count || 0),
        topics: Number(row.topics_count || 0),
        followers: Number(row.followers_count || 0),
        isOnline: canShowStatus ? Boolean(row.is_online) : null,
        lastSeen: canShowStatus ? row.last_seen : null
      }
    }, 200);
  }

  // 10. Chapter Content Access & Protection
  if (pathname === '/content/chapter' && method === 'GET') {
    const rawNovel = parsed.query.novel ? String(parsed.query.novel).trim() : '';
    const chNum = parsed.query.ch ? String(parsed.query.ch).trim() : '1';
    let novelId = rawNovel;
    try {
      novelId = decodeURIComponent(rawNovel);
    } catch {}

    if (!novelId) {
      return sendJson(res, { allowed: false, error: 'novel parameter is required' }, 400);
    }

    try {
      const result = await getChapterContent({ novelId, chNum, user: currentUser });
      if (result.notFound) {
        return sendJson(res, result, 404);
      }
      if (!result.allowed) {
        return sendJson(res, result, 403);
      }
      return sendJson(res, result, 200);
    } catch (err) {
      console.error('[API Error] /content/chapter failed:', err);
      return sendJson(res, { allowed: false, error: 'Failed to retrieve chapter content' }, 500);
    }
  }

  // 11. Audio Story Access & Protection
  if (pathname === '/content/audio' && method === 'GET') {
    const audioId = parsed.query.id || 'maaya-nadhi-theeram';
    const result = await getAudioAccess({ audioId, user: currentUser });
    if (!result.allowed) {
      return sendJson(res, result, 403);
    }
    return sendJson(res, result, 200);
  }

  // 12. Comments: Get Comments (with nested threaded replies and likes status)
  if (pathname === '/comments' && method === 'GET') {
    const novelId = parsed.query.novel;
    const chapterNum = parsed.query.ch ? String(parsed.query.ch).trim() : '0';
    if (!novelId) {
      return sendJson(res, { success: false, error: 'novel is required' }, 400);
    }
    const page = parsed.query.page ? parseInt(parsed.query.page, 10) : null;
    const limit = parsed.query.limit ? parseInt(parsed.query.limit, 10) : null;
    const offset = parsed.query.offset !== undefined ? parseInt(parsed.query.offset, 10) : (page && limit ? (page - 1) * limit : null);
    const userId = currentUser ? currentUser.id : null;
    const comments = await getComments({ novelId, chapterNum, userId, limit, offset });
    return sendJson(res, { success: true, comments }, 200);
  }

  // 13. Comments: Add Comment or Nested Reply (Registered Users Only)
  const isPostCommentRoute = (
    pathname === '/comments' ||
    /^\/comments\/\d+\/reply$/.test(pathname) ||
    /^\/novels\/[^\/]+\/chapters\/[^\/]+\/comments$/.test(pathname)
  ) && method === 'POST';

  if (isPostCommentRoute) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to post a comment.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    let novelId = body.novelId;
    let chapterNum = body.chapterNum;
    let parentId = body.parentId ? parseInt(body.parentId, 10) : null;

    if (/^\/comments\/(\d+)\/reply$/.test(pathname)) {
      const match = pathname.match(/^\/comments\/(\d+)\/reply$/);
      if (match) parentId = parseInt(match[1], 10);
    } else if (/^\/novels\/[^\/]+\/chapters\/[^\/]+\/comments$/.test(pathname)) {
      const parts = pathname.split('/');
      novelId = novelId || parts[2];
      chapterNum = chapterNum !== undefined ? chapterNum : parts[4];
    }

    const result = await addComment({
      novelId,
      chapterNum: chapterNum !== undefined ? String(chapterNum).trim() : '0',
      userId: currentUser.id,
      content: body.content,
      parentId
    });

    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, {
      success: true,
      commentId: result.comment?.id,
      comment: result.comment
    }, 201);
  }

  // 13.5. Comments: Like/Unlike Comment (Instagram-Style Like)
  const isCommentLikeRoute = (pathname === '/comments/like' || /^\/comments\/\d+\/like$/.test(pathname)) && method === 'POST';
  if (isCommentLikeRoute) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to like this comment.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    let commentId = parseInt(body.commentId, 10);
    const match = pathname.match(/^\/comments\/(\d+)\/like$/);
    if (match) commentId = parseInt(match[1], 10);

    if (!commentId || isNaN(commentId)) {
      return sendJson(res, { success: false, error: 'Valid commentId is required.' }, 400);
    }

    const result = await toggleCommentLike({ commentId, userId: currentUser.id });
    return sendJson(res, result, result.success ? 200 : 400);
  }

  // 14. Comments: Update Comment (Owner or Admin)
  if ((pathname.startsWith('/comments/') && method === 'PUT') || (pathname === '/comments/update' && method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to edit.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const commentId = parseInt(body.commentId || pathname.split('/').pop(), 10);
    const result = await updateComment({
      commentId,
      userId: currentUser.id,
      content: body.content
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 15. Comments: Delete Comment (Owner or Admin)
  if ((pathname.startsWith('/comments/') && method === 'DELETE') || (pathname === '/comments/delete' && method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to delete.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const commentId = parseInt(body.commentId || pathname.split('/').pop(), 10);
    const result = await deleteComment({
      commentId,
      userId: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 16. Comments: Upload Image (Max 5MB)
  if (pathname === '/comments/upload-image' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to upload images.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const { data: base64Data } = body;

    if (!base64Data || typeof base64Data !== 'string') {
      return sendJson(res, { success: false, error: 'No image data provided.' }, 400);
    }

    const matches = base64Data.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
    if (!matches) {
      return sendJson(res, { success: false, error: 'Only JPEG, PNG, WebP, and GIF image files are allowed.' }, 400);
    }

    const mimeType = matches[1].toLowerCase();
    const rawBase64 = matches[3];
    const buffer = Buffer.from(rawBase64, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return sendJson(res, { success: false, error: 'Image file size must be under 5MB.' }, 400);
    }

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';

    const safeName = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const uploadDir = path.resolve(__dirname, 'uploads/comments');

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, safeName), buffer);
      return sendJson(res, { success: true, url: `/uploads/comments/${safeName}` }, 200);
    } catch (err) {
      console.error('Failed to save comment image:', err);
      return sendJson(res, { success: false, error: 'Failed to save image on server.' }, 500);
    }
  }

  // 17. Reactions: Get Reactions
  if (pathname === '/reactions' && method === 'GET') {
    const targetType = parsed.query.targetType || 'content';
    const targetId = parsed.query.targetId;
    if (!targetId) {
      return sendJson(res, { success: false, error: 'targetId is required' }, 400);
    }
    const userId = currentUser ? currentUser.id : null;
    const result = await getReactions({ targetType, targetId, userId });
    return sendJson(res, result, 200);
  }

  // 18. Reactions: Toggle Reaction
  const isReactionRoute = (pathname === '/reactions' || /^\/novels\/[^\/]+\/chapters\/[^\/]+\/comments\/[^\/]+\/react$/.test(pathname)) && method === 'POST';
  if (isReactionRoute) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to react.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    let targetId = body.targetId;
    let targetType = body.targetType || 'content';
    let emoji = body.emoji;

    if (/^\/novels\/[^\/]+\/chapters\/[^\/]+\/comments\/[^\/]+\/react$/.test(pathname)) {
      const parts = pathname.split('/');
      targetId = parts[6];
      targetType = 'comment';
      const reactName = (body.reaction || '').toLowerCase();
      const emojiMap = {
        'love': '❤️',
        'like': '👍',
        'laugh': '😂',
        'surprise': '😮',
        'adore': '😍',
        'sad': '😢',
        'cry': '😭'
      };
      emoji = emoji || emojiMap[reactName] || '❤️';
    }

    if (!targetId || !emoji) {
      return sendJson(res, { success: false, error: 'targetId and emoji are required.' }, 400);
    }
    const result = await toggleReaction({
      targetType,
      targetId,
      userId: currentUser.id,
      emoji
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 19. Likes: Get Likes
  if (pathname === '/likes' && method === 'GET') {
    const targetType = parsed.query.targetType || 'novel';
    const targetId = parsed.query.targetId;
    if (!targetId) {
      return sendJson(res, { success: false, error: 'targetId is required' }, 400);
    }
    const userId = currentUser ? currentUser.id : null;
    const result = await getLikesFromDb({ targetType, targetId, userId });
    return sendJson(res, result, 200);
  }

  // 20. Likes: Toggle Like
  if (pathname === '/likes' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to like this item.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    if (!body.targetId) {
      return sendJson(res, { success: false, error: 'targetId is required' }, 400);
    }
    const targetType = body.targetType || 'novel';
    const result = await toggleLikeInDb({ targetType, targetId: body.targetId, userId: currentUser.id });
    return sendJson(res, result, 200);
  }

  // 21. Novels: Get Homepage Structured Content from SQL
  if (pathname === '/novels/homepage' && method === 'GET') {
    const data = await getHomepageData(currentUser);
    return sendJson(res, data, 200);
  }

  // 22. Novels: Get All Configured Novels
  if (pathname === '/novels' && method === 'GET') {
    const isAuthor = currentUser && currentUser.isAdmin === true && currentUser.isAuthorSession === true;
    const publishedOnly = !isAuthor || parsed.query.all !== 'true';
    const novels = await getAllNovels({
      status: parsed.query.status,
      category: parsed.query.category,
      publishedOnly
    });
    return sendJson(res, { success: true, novels }, 200);
  }

  // 23. Novels: Create Novel (requires Admin or Editor role)
  if ((pathname === '/novels' || pathname === '/admin/novels') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createNovel(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 24. Novels: Get Single Novel By ID
  if (pathname.startsWith('/novels/') && method === 'GET' && !pathname.includes('/homepage') && !pathname.includes('/sections')) {
    const parts = pathname.replace('/novels/', '').split('/');
    const rawId = parts[0].trim();
    let novelId = rawId;
    try {
      novelId = decodeURIComponent(rawId);
    } catch {}

    if (!novelId) {
      return sendJson(res, { success: false, error: 'Novel ID is required' }, 400);
    }

    try {
      if (parts[1] === 'chapters' || parts[1] === 'episodes') {
        const chapters = await getChaptersByNovel(novelId, { includeAll: false });
        return sendJson(res, { success: true, novelId, chapters }, 200);
      }

      const novel = await getNovelById(novelId, { includeAll: false });
      if (!novel) {
        return sendJson(res, { success: false, error: 'Novel not found' }, 404);
      }
      return sendJson(res, { success: true, novel }, 200);
    } catch (err) {
      console.error(`[API Error] GET /novels/${novelId} failed:`, err);
      return sendJson(res, { success: false, error: 'Failed to retrieve novel' }, 500);
    }
  }

  // 25. Novels: Update Novel (requires Admin or Editor role)
  if ((pathname.startsWith('/novels/') && method === 'PUT') || (pathname === '/novels/update' && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const novelId = pathname.startsWith('/novels/') && method === 'PUT'
      ? pathname.replace('/novels/', '').trim()
      : (await readJsonBody(req)).id;
    const body = await readJsonBody(req);
    const result = await updateNovel(novelId, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 26. Novels: Delete Novel (requires Admin or Editor role)
  if ((pathname.startsWith('/novels/') && method === 'DELETE') || (pathname === '/novels/delete' && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const novelId = pathname.startsWith('/novels/') && method === 'DELETE'
      ? pathname.replace('/novels/', '').trim()
      : (await readJsonBody(req)).id;
    const result = await deleteNovel(novelId);
    return sendJson(res, result, 200);
  }

  // 27. Novels: Update Section Visibility & Order (requires Admin or Editor role)
  if (pathname === '/novels/sections/visibility' && (method === 'POST' || method === 'PUT')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    if (!body.sectionKey) {
      return sendJson(res, { success: false, error: 'sectionKey is required' }, 400);
    }
    const result = await updateSectionVisibility(body.sectionKey, body);
    return sendJson(res, result, 200);
  }

  // ========================================================
  // ADMIN & AUTHOR DASHBOARD DEDICATED REST API ENDPOINTS
  // Strictly protected: requires Admin or Editor authentication
  // ========================================================

  // A0. Admin / Author / Writer Session Verification Check
  if ((pathname === '/admin/auth/check' || pathname === '/admin/check-session') && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    return sendJson(res, {
      success: true,
      authorized: true,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        email: currentUser.email,
        role: currentUser.role,
        isAdmin: currentUser.isAdmin,
        isWriter: currentUser.isWriter,
        isAuthorSession: currentUser.isAuthorSession
      }
    }, 200);
  }

  // A1. Admin Overview Metrics & Counts
  if (pathname === '/admin/overview' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const overview = await getAdminOverview();
    return sendJson(res, overview, 200);
  }

  // A2. Admin Novels List (includes all draft, scheduled & completed novels)
  if (pathname === '/admin/novels' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const novels = await getAllNovels({ publishedOnly: false });
    return sendJson(res, { success: true, novels }, 200);
  }

  // A3. Admin Episodes: List by Novel with hierarchy tree
  if (pathname === '/admin/episodes' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const novelId = parsed.query.novel;
    if (!novelId) {
      return sendJson(res, { success: false, error: 'novel query param is required' }, 400);
    }
    const hierarchical = parsed.query.hierarchical !== 'false';
    const episodes = await getEpisodesByNovel(novelId, { includeAll: true, hierarchical });
    return sendJson(res, { success: true, novelId, episodes }, 200);
  }

  // A4. Admin Episodes: Create New Episode or Nested Sub-Episode
  const isCreateEpisodeRoute = (pathname === '/admin/episodes' || pathname === '/episodes' || /^\/novels\/[^\/]+\/(episodes|chapters)$/.test(pathname)) && method === 'POST';
  if (isCreateEpisodeRoute) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    if (/^\/novels\/[^\/]+\/(episodes|chapters)$/.test(pathname)) {
      const parts = pathname.split('/');
      body.novelId = body.novelId || parts[2];
    }
    const result = await createEpisode(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, {
      success: true,
      chapterId: result.episode?.id,
      chapter: result.episode,
      episode: result.episode
    }, 201);
  }

  // A5. Admin Episodes: Duplicate Episode as Draft Copy
  if (pathname.startsWith('/admin/episodes/') && pathname.endsWith('/duplicate') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/admin/episodes/', '').replace('/duplicate', ''), 10);
    const result = await duplicateEpisode(episodeId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // A6. Admin Episodes: Get Single Episode By ID
  if (pathname.startsWith('/admin/episodes/') && method === 'GET' && !pathname.endsWith('/duplicate')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/admin/episodes/', ''), 10);
    const episode = await getEpisodeById(episodeId);
    if (!episode) {
      return sendJson(res, { success: false, error: 'Episode not found' }, 404);
    }
    return sendJson(res, { success: true, episode }, 200);
  }

  // A7. Admin Episodes: Update Episode
  if (((pathname.startsWith('/admin/episodes/') || pathname.startsWith('/episodes/')) && (method === 'PUT' || method === 'POST')) || (pathname === '/episodes/update' && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = pathname.startsWith('/admin/episodes/')
      ? parseInt(pathname.replace('/admin/episodes/', '').split('/')[0], 10)
      : (pathname.startsWith('/episodes/') ? parseInt(pathname.replace('/episodes/', '').split('/')[0], 10) : (await readJsonBody(req)).id);
    const body = await readJsonBody(req);
    const result = await updateEpisode(episodeId, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A8. Admin Episodes: Delete Episode
  if (((pathname.startsWith('/admin/episodes/') || pathname.startsWith('/episodes/')) && method === 'DELETE') || (pathname === '/episodes/delete' && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = pathname.startsWith('/admin/episodes/')
      ? parseInt(pathname.replace('/admin/episodes/', '').split('/')[0], 10)
      : (pathname.startsWith('/episodes/') ? parseInt(pathname.replace('/episodes/', '').split('/')[0], 10) : (await readJsonBody(req)).id);
    const result = await deleteEpisode(episodeId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A9. Publishing Scheduler: List All Scheduled Episodes
  if (pathname === '/admin/scheduler' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const scheduled = await getScheduledEpisodes();
    return sendJson(res, { success: true, scheduled }, 200);
  }

  // A10. Publishing Scheduler: Publish Episode Immediately
  if (pathname.startsWith('/admin/scheduler/') && pathname.endsWith('/publish-now') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/admin/scheduler/', '').replace('/publish-now', ''), 10);
    const result = await publishEpisodeNow(episodeId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A11. Publishing Scheduler: Cancel Schedule (Revert to Draft)
  if (pathname.startsWith('/admin/scheduler/') && pathname.endsWith('/cancel') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/admin/scheduler/', '').replace('/cancel', ''), 10);
    const result = await cancelEpisodeSchedule(episodeId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A12. Media Management: List Uploaded Media
  if (pathname === '/admin/media' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const search = parsed.query.search || '';
    const limit = parseInt(parsed.query.limit || '50', 10);
    const offset = parseInt(parsed.query.offset || '0', 10);
    const result = await getMediaList({ search, limit, offset });
    return sendJson(res, result, 200);
  }

  // A13. Media Management: Upload Media Asset (Max 10MB)
  if (pathname === '/admin/media/upload' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await uploadMediaAsset({
      data: body.data,
      filename: body.filename || 'image.jpg',
      userId: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // A14. Media Management: Delete Media Asset
  if (pathname.startsWith('/admin/media/') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const mediaId = parseInt(pathname.replace('/admin/media/', ''), 10);
    const result = await deleteMediaAsset(mediaId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A15. Author / Site Settings: Retrieve Settings
  if (pathname === '/admin/settings' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const result = await getSiteSettings();
    return sendJson(res, result, 200);
  }

  // A16. Author / Site Settings: Update Settings
  if (pathname === '/admin/settings' && (method === 'POST' || method === 'PUT')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await updateSiteSettings(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A17. Admin Audio Novels: List All (including drafts)
  if (pathname === '/admin/audio-novels' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const audioNovels = await getAllAudioNovels({
      forAdmin: true,
      search: parsed.query.search,
      language: parsed.query.language,
      novelId: parsed.query.novelId || parsed.query.novel,
      sort: parsed.query.sort
    });
    return sendJson(res, { success: true, audioNovels }, 200);
  }

  // A18. Admin Audio Novels: Upload Direct Audio File (Max 50MB)
  if (pathname === '/admin/audio-novels/upload-audio' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req, 60 * 1024 * 1024);
    if (!body.data) {
      return sendJson(res, { success: false, error: 'Audio file data is required.' }, 400);
    }
    try {
      const url = saveBase64Audio(body.data, 'audio-upload');
      return sendJson(res, { success: true, url }, 200);
    } catch (err) {
      return sendJson(res, { success: false, error: err.message }, 400);
    }
  }

  // A19. Admin Audio Novels: Create Audio Novel
  if (pathname === '/admin/audio-novels' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req, 60 * 1024 * 1024);
    const result = await createAudioNovel(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // A20. Admin Audio Novels: Get Single Audio Novel By ID
  if (pathname.startsWith('/admin/audio-novels/') && method === 'GET' && !pathname.includes('/upload')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const idOrSlug = pathname.replace('/admin/audio-novels/', '').trim();
    const audioNovel = await getAudioNovelByIdOrSlug(idOrSlug, { forAdmin: true });
    if (!audioNovel) {
      return sendJson(res, { success: false, error: 'Audio novel not found' }, 404);
    }
    return sendJson(res, { success: true, audioNovel }, 200);
  }

  // A21. Admin Audio Novels: Update Audio Novel
  if ((pathname.startsWith('/admin/audio-novels/') && method === 'PUT') || (pathname.startsWith('/admin/audio-novels/') && pathname.endsWith('/update') && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const id = parseInt(pathname.replace('/admin/audio-novels/', '').replace('/update', ''), 10);
    const body = await readJsonBody(req, 60 * 1024 * 1024);
    const result = await updateAudioNovel(id, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // A22. Admin Audio Novels: Delete Audio Novel
  if ((pathname.startsWith('/admin/audio-novels/') && method === 'DELETE') || (pathname.startsWith('/admin/audio-novels/') && pathname.endsWith('/delete') && method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const id = parseInt(pathname.replace('/admin/audio-novels/', '').replace('/delete', ''), 10);
    const result = await deleteAudioNovel(id);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // ==========================================
  // HOMEPAGE SECTIONS MANAGEMENT (Admin Only)
  // ==========================================
  // List all homepage sections
  if (pathname === '/admin/homepage-sections' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const result = await getAdminHomepageSections();
    return sendJson(res, result, 200);
  }

  // Create new homepage section
  if (pathname === '/admin/homepage-sections' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createAdminHomepageSection(body, currentUser);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  // Reorder homepage sections (atomic transaction)
  if (pathname === '/admin/homepage-sections/reorder' && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const orders = Array.isArray(body) ? body : (body?.orders || []);
    try {
      const result = await reorderAdminHomepageSections(orders, currentUser);
      if (!result.success) return sendJson(res, result, 400);
      return sendJson(res, result, 200);
    } catch (err) {
      return sendJson(res, { success: false, error: err.message }, 500);
    }
  }

  // Reset homepage sections to system default order
  if (pathname === '/admin/homepage-sections/reset-order' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const result = await resetAdminHomepageSectionsOrder(currentUser);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Toggle homepage section visibility
  if (pathname.startsWith('/admin/homepage-sections/') && pathname.endsWith('/visibility') && (method === 'PATCH' || method === 'PUT')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const sectionKey = decodeURIComponent(pathname.replace('/admin/homepage-sections/', '').replace('/visibility', ''));
    const body = await readJsonBody(req);
    const isVisible = body.isVisible !== undefined ? body.isVisible : body.is_visible;
    const result = await toggleAdminHomepageSectionVisibility(sectionKey, isVisible, currentUser);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Update homepage section
  if (pathname.startsWith('/admin/homepage-sections/') && !pathname.endsWith('/visibility') && !pathname.endsWith('/reorder') && !pathname.endsWith('/reset-order') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const sectionKey = decodeURIComponent(pathname.replace('/admin/homepage-sections/', ''));
    const body = await readJsonBody(req);
    const result = await updateAdminHomepageSection(sectionKey, body, currentUser);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Delete custom homepage section
  if (pathname.startsWith('/admin/homepage-sections/') && !pathname.endsWith('/visibility') && !pathname.endsWith('/reorder') && !pathname.endsWith('/reset-order') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const sectionKey = decodeURIComponent(pathname.replace('/admin/homepage-sections/', ''));
    const result = await deleteAdminHomepageSection(sectionKey, currentUser);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }
  // ==========================================
  // WRITER MANAGEMENT (Admin Authorized Only)
  // ==========================================
  // List all writer accounts
  if (pathname === '/admin/writers' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writers = await getAllWriters(parsed.query);
    return sendJson(res, { success: true, writers }, 200);
  }

  // Create new writer account
  if (pathname === '/admin/writers' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createWriterAccount({
      ...body,
      createdByActorId: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // Writer Audit Logs
  if (pathname === '/admin/writers/audit-logs' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parsed.query.writerId ? parseInt(parsed.query.writerId, 10) : null;
    const logs = await getWriterAuditLogs(writerId, 60);
    return sendJson(res, { success: true, logs }, 200);
  }

  // Get single writer details
  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', ''), 10);
    const writer = await getWriterDetails(writerId);
    if (!writer) {
      return sendJson(res, { success: false, error: 'Writer account not found' }, 404);
    }
    return sendJson(res, { success: true, writer }, 200);
  }

  // Block / Reactivate writer account
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/status') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/status', ''), 10);
    const body = await readJsonBody(req);
    const result = await setWriterStatus({
      writerId,
      status: body.status,
      actorId: currentUser.id,
      reason: body.reason
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Update writer profile (Admin)
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/profile') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/profile', ''), 10);
    const body = await readJsonBody(req);
    const result = await updateWriterProfile({
      writerId,
      displayName: body.displayName,
      bio: body.bio,
      avatar: body.avatar,
      actorId: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Delete writer account safely
  if (pathname.startsWith('/admin/writers/') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', ''), 10);
    const result = await deleteWriterAccount({
      writerId,
      actorId: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // ==========================================
  // WRITER DEDICATED WORKSPACE (Writer & Admin)
  // ==========================================
  // Workspace Overview Statistics
  if (pathname === '/writer/workspace' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const data = await getWriterWorkspaceData(currentUser.id);
    if (!data) {
      return sendJson(res, { success: false, error: 'Writer workspace not found' }, 404);
    }
    return sendJson(res, { success: true, ...data }, 200);
  }

  // Writer's Novels List (strictly novels owned by writer)
  if (pathname === '/writer/novels' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const novels = await query(`
      SELECT * FROM novels WHERE author_id = ? ORDER BY updated_at DESC;
    `, [currentUser.id]);
    return sendJson(res, { success: true, novels }, 200);
  }

  // Writer Create Novel
  if (pathname === '/writer/novels' && method === 'POST') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createNovel({
      ...body,
      authorId: currentUser.id,
      author: currentUser.displayName || currentUser.username,
      isPublished: 0,
      visibility: 'draft',
      status: 'Ongoing'
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // Writer's Single Novel (strictly verified ownership)
  if (pathname.startsWith('/writer/novels/') && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const novelId = pathname.replace('/writer/novels/', '').trim();
    const novel = await getNovelById(novelId, { includeAll: true });
    if (!novel) return sendJson(res, { success: false, error: 'Novel not found' }, 404);
    if (!currentUser.isAdmin && Number(novel.authorId || novel.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You do not own this novel' }, 403);
    }
    return sendJson(res, { success: true, novel }, 200);
  }

  // Writer Update Novel (ownership verified!)
  if (pathname.startsWith('/writer/novels/') && (method === 'PUT' || method === 'POST')) {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const novelId = pathname.replace('/writer/novels/', '').trim();
    const existing = await queryOne('SELECT id, author_id FROM novels WHERE id = ?;', [novelId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Novel not found' }, 404);
    }
    if (!currentUser.isAdmin && existing.author_id !== currentUser.id) {
      return sendJson(res, { success: false, error: 'Access denied: You can only edit your own novels.' }, 403);
    }
    const body = await readJsonBody(req);
    if (!currentUser.isAdmin) {
      body.isPublished = 0;
      body.visibility = 'draft';
    }
    const result = await updateNovel(novelId, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Writer's Episodes List
  if (pathname === '/writer/episodes' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const novelId = parsed.query.novelId;
    let sql = `
      SELECT c.*, n.title AS novel_title 
      FROM chapters c
      JOIN novels n ON c.novel_id = n.id
      WHERE n.author_id = ?
    `;
    const params = [currentUser.id];
    if (novelId) {
      sql += ' AND c.novel_id = ?';
      params.push(novelId);
    }
    sql += ' ORDER BY c.novel_id, c.sort_order ASC;';
    const episodes = await query(sql, params);
    return sendJson(res, { success: true, episodes }, 200);
  }

  // Writer Create Episode (ownership of novel verified!)
  if (pathname === '/writer/episodes' && method === 'POST') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const body = await readJsonBody(req);
    const novel = await queryOne('SELECT id, author_id FROM novels WHERE id = ?;', [body.novelId]);
    if (!novel) {
      return sendJson(res, { success: false, error: 'Associated novel not found.' }, 404);
    }
    if (!currentUser.isAdmin && novel.author_id !== currentUser.id) {
      return sendJson(res, { success: false, error: 'Access denied: You can only create episodes for your own novels.' }, 403);
    }
    if (!currentUser.isAdmin) {
      body.status = 'draft';
    }
    const result = await createEpisode(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // Writer Single Episode (GET)
  if (pathname.startsWith('/writer/episodes/') && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/writer/episodes/', ''), 10);
    const existing = await queryOne(`
      SELECT c.*, n.title AS novel_title, n.author_id 
      FROM chapters c 
      JOIN novels n ON c.novel_id = n.id 
      WHERE c.id = ?;
    `, [episodeId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Episode not found.' }, 404);
    }
    if (!currentUser.isAdmin && Number(existing.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You can only view episodes of your own novels.' }, 403);
    }
    return sendJson(res, { success: true, episode: existing }, 200);
  }

  // Writer Update Episode (ownership of linked novel verified!)
  if (pathname.startsWith('/writer/episodes/') && (method === 'PUT' || method === 'POST')) {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/writer/episodes/', ''), 10);
    const existing = await queryOne(`
      SELECT c.id, c.novel_id, c.status, n.author_id 
      FROM chapters c 
      JOIN novels n ON c.novel_id = n.id 
      WHERE c.id = ?;
    `, [episodeId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Episode not found.' }, 404);
    }
    if (!currentUser.isAdmin && Number(existing.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You can only edit episodes of your own novels.' }, 403);
    }
    const body = await readJsonBody(req);
    if (!currentUser.isAdmin) {
      if (body.status === 'submitted') {
        body.status = 'submitted';
      } else {
        body.status = existing.status === 'published' ? 'published' : 'draft';
      }
    }
    const result = await updateEpisode(episodeId, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Writer Delete Episode (ownership of linked novel verified!)
  if (pathname.startsWith('/writer/episodes/') && method === 'DELETE') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const episodeId = parseInt(pathname.replace('/writer/episodes/', ''), 10);
    const existing = await queryOne(`
      SELECT c.id, c.novel_id, c.status, n.author_id 
      FROM chapters c 
      JOIN novels n ON c.novel_id = n.id 
      WHERE c.id = ?;
    `, [episodeId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Episode not found.' }, 404);
    }
    if (!currentUser.isAdmin && Number(existing.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You can only delete episodes of your own novels.' }, 403);
    }
    if (!currentUser.isAdmin && existing.status === 'published') {
      return sendJson(res, { success: false, error: 'Published episodes cannot be deleted by writers.' }, 400);
    }
    const result = await deleteEpisode(episodeId);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Public Audio Novels: List Published Audio Novels
  if (pathname === '/audio-novels' && method === 'GET') {
    const audioNovels = await getAllAudioNovels({
      forAdmin: false,
      search: parsed.query.search,
      language: parsed.query.language,
      novelId: parsed.query.novelId || parsed.query.novel,
      sort: parsed.query.sort
    });
    return sendJson(res, { success: true, audioNovels }, 200);
  }

  // Public Audio Novels: Get Single Audio Novel By ID or Slug (with multi-part episodes)
  if (pathname.startsWith('/audio-novels/') && method === 'GET') {
    const idOrSlug = pathname.replace('/audio-novels/', '').trim();
    const audioNovel = await getAudioNovelByIdOrSlug(idOrSlug, { forAdmin: false });
    if (!audioNovel) {
      return sendJson(res, { success: false, error: 'Audio novel not found or unavailable' }, 404);
    }
    return sendJson(res, { success: true, audioNovel }, 200);
  }

  // 28. Forum / Community: Get Sidebar Posts (Latest & Trending)
  if ((pathname === '/forum/posts' || pathname === '/posts/sidebar' || pathname === '/posts') && method === 'GET') {
    const data = await getSidebarPostsFromDb();
    return sendJson(res, { success: true, ...data }, 200);
  }

  // 29. Forum: Get Categories
  if (pathname === '/forum/categories' && method === 'GET') {
    const categories = await getForumCategoriesFromDb();
    return sendJson(res, { success: true, categories }, 200);
  }

  // 29-Stats. Forum: Get Live Statistics (Members, Replies, Guests)
  if ((pathname === '/forum/stats' || pathname === '/api/forum/stats') && method === 'GET') {
    let visitorId = extractCookie(req, 'rp_visitor_id') || req.headers['x-guest-session-id'] || parsed.query.visitorId || null;
    if (!currentUser) {
      if (!visitorId || typeof visitorId !== 'string' || !/^[a-zA-Z0-9_-]{10,64}$/.test(visitorId)) {
        visitorId = 'gst_' + crypto.randomBytes(16).toString('hex');
      }
      await recordGuestVisitor({ visitorId, userAgent: req.headers['user-agent'] });
      res.setHeader('Set-Cookie', `rp_visitor_id=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }
    const stats = await getForumLiveStatsFromDb();
    return sendJson(res, { success: true, stats, visitorId: !currentUser ? visitorId : null }, 200);
  }

  // 30. Forum: Get All Topics
  if (pathname === '/forum/topics' && method === 'GET') {
    const categoryId = parsed.query.category || null;
    const topics = await getForumTopicsFromDb(categoryId);
    return sendJson(res, { success: true, topics }, 200);
  }

  // 31. Forum: Create New Topic (Requires Login)
  if (pathname === '/forum/topics' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to create a topic.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const result = await createForumTopicInDb({
      categoryId: body.categoryId,
      title: body.title,
      authorId: currentUser.id,
      content: body.content
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 32. Forum: Get Single Topic By ID
  if (pathname.startsWith('/forum/topics/') && !pathname.endsWith('/reply') && method === 'GET') {
    const topicId = pathname.replace('/forum/topics/', '').trim();
    const topic = await getForumTopicByIdFromDb(topicId, currentUser ? currentUser.id : null);
    if (!topic) {
      return sendJson(res, { success: false, error: 'Topic not found' }, 404);
    }
    return sendJson(res, { success: true, topic }, 200);
  }

  // 33. Forum: Submit Topic Reply (Requires Login)
  if (pathname.startsWith('/forum/topics/') && pathname.endsWith('/reply') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to reply.', requireLogin: true }, 401);
    }
    const topicId = pathname.replace('/forum/topics/', '').replace('/reply', '').trim();
    const body = await readJsonBody(req);
    const result = await addForumReplyToDb(topicId, currentUser.id, body.content, body.parentId || null);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 34. Notifications: Get User Notifications & Count
  if (pathname === '/notifications' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { success: true, notifications: [], unreadCount: 0 }, 200);
    }
    const notifications = await getUserNotifications(currentUser.id);
    const unreadCount = await getUnreadNotificationsCount(currentUser.id);
    return sendJson(res, { success: true, notifications, unreadCount }, 200);
  }

  if (pathname === '/notifications/unread-count' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { success: true, count: 0 }, 200);
    }
    const count = await getUnreadNotificationsCount(currentUser.id);
    return sendJson(res, { success: true, count }, 200);
  }

  // 35. Notifications: Mark As Read
  if (pathname.startsWith('/notifications/') && pathname.endsWith('/read') && (method === 'POST' || method === 'PUT')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const notifId = parseInt(pathname.replace('/notifications/', '').replace('/read', ''), 10);
    const result = await markNotificationReadInDb(notifId, currentUser.id);
    return sendJson(res, result, 200);
  }

  if (pathname === '/notifications/read-all' && (method === 'POST' || method === 'PUT')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const result = await markAllNotificationsReadInDb(currentUser.id);
    return sendJson(res, result, 200);
  }

  // Real-Time Server-Sent Events (SSE) Stream
  if (pathname === '/notifications/stream' && method === 'GET') {
    if (!currentUser) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Authentication required for notification stream' }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const unreadCount = await getUnreadNotificationsCount(currentUser.id);
    res.write(`event: init\ndata: ${JSON.stringify({ unreadCount })}\n\n`);

    registerSseClient(currentUser.id, res);

    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(heartbeatInterval);
      }
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeatInterval);
    });
    return;
  }

  // Web Push VAPID Public Key
  if (pathname === '/notifications/vapid-public-key' && method === 'GET') {
    return sendJson(res, { success: true, publicKey: getVapidPublicKey() }, 200);
  }

  // Web Push Subscription Handlers
  if (pathname === '/notifications/push-subscribe' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const result = await savePushSubscription(currentUser.id, body.subscription, req.headers['user-agent']);
    return sendJson(res, result, result.success ? 200 : 400);
  }

  if (pathname === '/notifications/push-unsubscribe' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const result = await removePushSubscription(currentUser.id, body.endpoint);
    return sendJson(res, result, 200);
  }

  // Notification Preferences
  if (pathname === '/notifications/preferences' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const preferences = await getNotificationPreferences(currentUser.id);
    return sendJson(res, { success: true, preferences }, 200);
  }

  if (pathname === '/notifications/preferences' && (method === 'POST' || method === 'PUT')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const preferences = await updateNotificationPreferences(currentUser.id, body);
    return sendJson(res, { success: true, preferences }, 200);
  }

  // ========================================================
  // 36. Writer Management (Admin Only)
  // ========================================================

  if (pathname === '/admin/writers' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const { search, status, page, limit } = parsed.query;
    const result = await getAllWriters({ search, status, page, limit });
    return sendJson(res, { success: true, ...result });
  }

  if (pathname === '/admin/writers' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createWriterAccount({
      fullName: body.fullName || body.name,
      email: body.email,
      password: body.password,
      status: body.status || 'active',
      avatarUrl: body.avatarUrl || null,
      createdBy: currentUser.id
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  if (pathname === '/admin/writers/audit-logs' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parsed.query.writerId ? parseInt(parsed.query.writerId, 10) : null;
    const logs = await getWriterAuditLogs(writerId, 100);
    return sendJson(res, { success: true, logs });
  }

  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && !pathname.includes('/audit-logs') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', ''), 10);
    const writer = await getWriterDetails(writerId);
    if (!writer) return sendJson(res, { success: false, error: 'Writer not found' }, 404);
    return sendJson(res, { success: true, writer });
  }

  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/status') && method === 'PUT') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/status', ''), 10);
    const body = await readJsonBody(req);
    const result = await setWriterStatus(writerId, body.status, currentUser.id, body.reason || null);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/profile') && method === 'PUT') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/profile', ''), 10);
    const body = await readJsonBody(req);
    const result = await updateWriterProfile(writerId, body, currentUser.id);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && !pathname.includes('/audit-logs') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', ''), 10);
    const result = await deleteWriterAccount(writerId, currentUser.id, 2);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }



  // Fallthrough to next middleware if not an API route
  next();
}
