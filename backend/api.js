import { getTrashItems, restoreFromTrash, permanentlyDeleteTrash, emptyTrash, moveToTrash } from './trash.js';
import { saveUploadedImageFile, deleteLocalUploadFile, parseBase64Image } from './image-upload.js';
import { formatISTDisplay, parseISTDateTime } from './timezone.js';
function escapeHtml(str) { return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
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
  completePasswordReset,
  sanitizeAvatar
} from './auth.js';
import {
  getUserChatSettings,
  updateUserChatSettings,
  toggleChatLock,
  toggleConversationLock,
  getOrCreateConversation,
  createDirectMessageConversation,
  inviteParticipantsToConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  editMessage,
  unsendMessage,
  getTotalUnreadChatCount,
  getEligibleChatUsers,
  getAdminWritersList,
  getAdminWriterConversations,
  getAdminWriterChatHistory
} from './chat.js';
import { handleProfileEndpoints } from './profile-routes.js';
import { handleProfilePostsEndpoints } from './profile-posts-routes.js';
import { handleDynamicUpdatePanelsEndpoints } from './dynamic-update-panels-routes.js';
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  getReactions,
  toggleReaction,
  fetchLinkPreview
} from './comments.js';
import { resolveContentMetadata, renderShareHtml } from './share-metadata.js';
import {
  getSidebarPostsFromDb,
  getForumTopicsFromDb,
  getForumTopicByIdFromDb,
  addForumReplyToDb,
  createForumTopicInDb,
  getForumCategoriesFromDb,
  createForumCategoryInDb,
  updateForumCategoryInDb,
  deleteForumCategoryInDb,
  updateForumTopicInDb,
  deleteForumTopicInDb,
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
  updateNotificationPreferences,
  broadcastAnnouncement
} from './notifications.js';
import {
  getAdminOverview,
  getMediaList,
  uploadMediaAsset,
  deleteMediaAsset,
  getSiteSettings,
  updateSiteSettings
} from './admin.js';
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
  getWriterWorkspaceData,
  getWriterPermissions,
  updateWriterPermissions,
  revokeWriterAccess,
  reactivateWriterAccess,
  bulkUpdateWriterPermissions,
  getWriterAssignments,
  createWriterAssignment,
  updateWriterAssignmentStatus,
  canWriterAccessContent,
  createOrUpdateSubmission,
  getAllSubmissions,
  reviewSubmission,
  getEnhancedWriterWorkspaceData
} from './writers.js';
import {
  getMembersList,
  getMemberDetails,
  createMemberAccount,
  updateMemberDetails,
  adminResetMemberPassword,
  temporarilyBlockMember,
  unblockMember,
  permanentlyDeleteMember,
  getMemberPermissions,
  updateMemberPermissions,
  toggleMemberStatus,
  revokeMemberSessions,
  getAdminAuditLogs
} from './admin-members.js';
import {
  getContentHierarchy,
  getContentArticle,
  getContentComments,
  addContentComment,
  deleteContentComment,
  createMainCategory,
  updateMainCategory,
  reorderMainCategories,
  toggleMainCategoryStatus,
  deleteMainCategory,
  createSubCategory,
  updateSubCategory,
  reorderSubCategories,
  toggleSubCategoryStatus,
  deleteSubCategory,
  createContentArticle,
  updateContentArticle,
  toggleContentArticleStatus,
  deleteContentArticle,
  getContentAccessRules,
  addContentAccessRule,
  removeContentAccessRule
} from './forms-content.js';

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

  
  // Contact Us Form Submission API
  if ((pathname === '/contact' || pathname === '/contact/' || pathname === '/api/contact') && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const subject = String(body.subject || '').trim();
      const message = String(body.message || '').trim();

      if (!name || !email || !subject || !message) {
        return sendJson(res, { success: false, error: 'All fields (Your Name, Email Address, Subject, Message) are required.' }, 400);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return sendJson(res, { success: false, error: 'Please enter a valid email address.' }, 400);
      }

      // Ensure contact_submissions table exists in database
      await query(`
        CREATE TABLE IF NOT EXISTS contact_submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      const insertResult = await query(
        'INSERT INTO contact_submissions (name, email, subject, message) VALUES (?, ?, ?, ?)',
        [name, email, subject, message]
      );

      console.log(`[CONTACT FORM RECEIVED] ID: ${insertResult.insertId} | From: ${name} <${email}> | Subject: "${subject}"`);

      // Attempt live email notification if SMTP is configured
      try {
        const { getTransporter } = await import('./email.js');
        const { transporter, smtpUser, smtpPass } = getTransporter();
        if (smtpPass) {
          await transporter.sendMail({
            from: `"${name} (RP Contact)" <${smtpUser || 'trendup089@gmail.com'}>`,
            to: 'rudraprarthananovels@gmail.com',
            replyTo: email,
            subject: `[Contact Form] ${subject} - from ${name}`,
            text: `Contact Form Submission\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
            html: `<div style="font-family:sans-serif; padding:16px;">
              <h2>New Contact Form Inquiry</h2>
              <p><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
              <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
              <hr/>
              <p><strong>Message:</strong></p>
              <div style="background:#F8F9FA; padding:12px; border-radius:6px; white-space:pre-wrap;">${escapeHtml(message)}</div>
            </div>`
          });
          console.log('[CONTACT FORM EMAIL] Forwarded notification to rudraprarthananovels@gmail.com');
        }
      } catch (mailErr) {
        console.warn('[CONTACT FORM EMAIL NOTE] SMTP notification not sent (logged to DB):', mailErr.message);
      }

      return sendJson(res, {
        success: true,
        message: 'Thank you! Your message has been sent successfully. We will try our best to respond as soon as possible.',
        submissionId: insertResult.insertId
      }, 200);
    } catch (err) {
      console.error('[CONTACT FORM ERROR]:', err);
      return sendJson(res, { success: false, error: 'An error occurred while submitting your message. Please try again.' }, 500);
    }
  }

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
      const statusCode = (result.error && (result.error.includes('blocked') || result.error.includes('suspended') || result.error.includes('disabled'))) ? 403 : 401;
      return sendJson(res, result, statusCode);
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

  // 8a. User Reading Progress (Legacy stub)
  if ((pathname === '/user/reading-progress' || pathname === '/reading-progress') && method === 'GET') {
    return sendJson(res, { success: true, progress: [] }, 200);
  }
  if ((pathname === '/user/reading-progress' || pathname === '/reading-progress') && method === 'POST') {
    return sendJson(res, { success: true, message: 'Saved' }, 200);
  }
  if (pathname.startsWith('/reading/session/') || pathname.startsWith('/reading-session/')) {
    return sendJson(res, { success: true, message: 'Session acknowledged' }, 200);
  }

  // 9. Members Directory with Reading Activity and Online Status (Privacy Protected)
  if (pathname === '/members' && method === 'GET') {
    const viewerId = currentUser ? currentUser.id : null;
    const members = await getAllMembersWithStatus(viewerId);
    return sendJson(res, { success: true, members }, 200);
  }

  // 9-Mentions. Lightweight member lookup for @tagging across editors and comment boxes
  if ((pathname === '/members/mentions' || pathname === '/api/members/mentions') && method === 'GET') {
    const q = (parsed.query.q || parsed.query.query || '').trim().toLowerCase();
    const rows = await query(`
      SELECT u.id, u.username, u.role, p.display_name, p.avatar
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE (u.status IS NULL OR u.status = 'active')
        ${q ? 'AND (LOWER(u.username) LIKE ? OR LOWER(p.display_name) LIKE ?)' : ''}
      ORDER BY 
        ${q ? `
          CASE WHEN LOWER(u.username) = ? THEN 1
               WHEN LOWER(p.display_name) = ? THEN 2
               WHEN LOWER(u.username) LIKE ? THEN 3
               ELSE 4 END,
        ` : ''}
        u.created_at ASC
      LIMIT 12;
    `, q ? [`%${q}%`, `%${q}%`, q, q, `${q}%`] : []);

    const members = rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: sanitizeAvatar(r.avatar),
      role: r.role || 'Member'
    }));

    return sendJson(res, { success: true, members }, 200);
  }

  // 9a. Member Reading Activity Dedicated Endpoint (Privacy Protected)
  if (pathname.startsWith('/members/') && pathname.endsWith('/reading-activity') && method === 'GET') {
    return sendJson(res, { success: true, activity: { readingTimeFormatted: '0 min', lastReadNovel: null, activityStatusEnabled: true, statusHidden: false, isOnline: false, lastSeen: null, lastSeenText: null } }, 200);
  }

  // 9-Profile. Enhanced Profile Subsystem Endpoints (Follows, Saved Novels, Activity, Recent Topics)
  const handledProfile = await handleProfileEndpoints(req, res, pathname, method, parsed, currentUser, sendJson, readJsonBody);
  if (handledProfile !== false) {
    return;
  }

  // 9-ProfilePosts. Latest Profile Posts Subsystem (Compact Community Posts)
  const handledProfilePosts = await handleProfilePostsEndpoints(req, res, pathname, method, parsed, currentUser, sendJson, readJsonBody);
  if (handledProfilePosts !== false) {
    return;
  }

  // 9-UpdatePanels. Dynamic Updates / Announcement Panel System
  const handledUpdatePanels = await handleDynamicUpdatePanelsEndpoints(req, res, pathname, method, parsed, currentUser, sendJson, readJsonBody);
  if (handledUpdatePanels !== false) {
    return;
  }

  // 9b. Member Detail with Reading Activity (Privacy Protected)
  if (pathname.startsWith('/members/') && method === 'GET' && !pathname.endsWith('/reading-activity')) {
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
        p.posts_count, p.topics_count, p.followers_count
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ? OR LOWER(u.username) = LOWER(?) OR (? = "rudhra" AND LOWER(u.username) = "rudhra_author");
    `, [memberIdOrUsername, memberIdOrUsername, memberIdOrUsername]);

    if (!row) {
      return sendJson(res, { success: false, error: 'Member not found' }, 404);
    }

    const activity = { readingTimeFormatted: '0 min', lastReadNovel: null, activityStatusEnabled: true, statusHidden: false, isOnline: false, lastSeen: null, lastSeenText: null };

    // Calculate dynamic accurate followers, following, and total comments counts
    const [followersRow, followingRow, commentsCountRow] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [row.id]),
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?;', [row.id]),
      queryOne(`
        SELECT (
          (SELECT COUNT(*) FROM content_comments WHERE user_id = ?) +
          (SELECT COUNT(*) FROM forum_posts WHERE user_id = ?)
        ) AS total_comments;
      `, [row.id, row.id])
    ]);

    let isFollowing = false;
    if (viewerId && viewerId !== row.id) {
      const followCheck = await queryOne('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?;', [viewerId, row.id]);
      isFollowing = Boolean(followCheck);
    }

    const followersCount = Number(followersRow?.count || 0);
    const followingCount = Number(followingRow?.count || 0);
    const totalComments = Number(commentsCountRow?.total_comments || 0);

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
        followers: followersCount,
        following: followingCount,
        totalComments: totalComments,
        isFollowing: isFollowing,
        activityStatusEnabled: activity?.activityStatusEnabled ?? true,
        statusHidden: activity?.statusHidden ?? false,
        isOnline: activity?.isOnline ?? null,
        lastSeen: activity?.lastSeen ?? null,
        lastSeenText: activity?.lastSeenText ?? null,
        currentReading: activity?.currentReading ?? null,
        lastRead: activity?.lastRead ?? null
      }
    }, 200);
  }

  // 11b. Forms Content 3-Level Hierarchy
  if (pathname === '/content/hierarchy' && method === 'GET') {
    const result = await getContentHierarchy(currentUser);
    return sendJson(res, result, 200);
  }

  // 11c. Get Single Content Article for Dedicated Reading Page
  if ((pathname.startsWith('/content/articles/') || pathname.startsWith('/content/threads/')) && !pathname.includes('/comments') && method === 'GET') {
    let slugOrId = pathname.replace('/content/articles/', '').replace('/content/threads/', '').trim();
    try {
      slugOrId = decodeURIComponent(slugOrId).trim();
    } catch (e) {}
    const result = await getContentArticle(slugOrId, currentUser, { incrementView: true });
    if (!result.success) {
      const statusCode = result.code === 'NOT_FOUND' ? 404 : 403;
      return sendJson(res, result, statusCode);
    }
    return sendJson(res, result, 200);
  }

  // 11d. Comments for Content Article
  if (pathname.startsWith('/content/articles/') && pathname.endsWith('/comments') && method === 'GET') {
    let slugOrId = pathname.replace('/content/articles/', '').replace('/comments', '').trim();
    try {
      slugOrId = decodeURIComponent(slugOrId).trim();
    } catch (e) {}
    const artRes = await getContentArticle(slugOrId, currentUser, { incrementView: false });
    if (!artRes.success) {
      return sendJson(res, artRes, artRes.code === 'NOT_FOUND' ? 404 : 403);
    }
    const result = await getContentComments(artRes.article.id);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/content/articles/') && pathname.endsWith('/comments') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to post a comment.', requireLogin: true }, 401);
    }
    if (currentUser.permissions && currentUser.permissions.can_comment === false) {
      return sendJson(res, { success: false, error: 'Your commenting privileges have been restricted by an administrator.' }, 403);
    }
    let slugOrId = pathname.replace('/content/articles/', '').replace('/comments', '').trim();
    try {
      slugOrId = decodeURIComponent(slugOrId).trim();
    } catch (e) {}
    const artRes = await getContentArticle(slugOrId, currentUser);
    if (!artRes.success) {
      return sendJson(res, artRes, artRes.code === 'NOT_FOUND' ? 404 : 403);
    }
    const body = await readJsonBody(req);
    const result = await addContentComment({
      contentId: artRes.article.id,
      userId: currentUser.id,
      parentId: body.parentId || body.parent_id || null,
      content: body.content || body.comment || ''
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/content/articles/') && pathname.includes('/comments/') && method === 'DELETE') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const parts = pathname.split('/comments/');
    const commentId = parseInt(parts[1], 10);
    const result = await deleteContentComment({
      commentId,
      userId: currentUser.id,
      isAdmin: Boolean(currentUser.isAdmin || ['admin', 'editor'].includes((currentUser.role || '').toLowerCase()))
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // 12. Comments: Get Comments (with nested threaded replies and likes status)
  if (pathname === '/comments' && method === 'GET') {
    const novelId = parsed.query.novel;
    const chapterNum = parsed.query.ch ? String(parsed.query.ch).trim() : '0';
    if (!novelId) {
      return sendJson(res, { success: false, error: 'novel is required' }, 400);
    }
    const page = parsed.query.page ? parseInt(parsed.query.page, 10) : 1;
    const limit = parsed.query.limit ? parseInt(parsed.query.limit, 10) : 7;
    const offset = parsed.query.offset !== undefined ? parseInt(parsed.query.offset, 10) : ((page - 1) * limit);
    const userId = currentUser ? currentUser.id : null;
    const comments = await getComments({ novelId, chapterNum, userId, limit, offset, page });
    return sendJson(res, {
      success: true,
      comments,
      pagination: comments.pagination || { page, limit, total: comments.length, totalPages: 1 },
      total: comments.pagination ? comments.pagination.total : comments.length
    }, 200);
  }

  // 12.5. Link Preview Metadata (Secure External URL Preview for Comments)
  if (pathname === '/link-preview' && method === 'GET') {
    const targetUrl = parsed.query.url;
    if (!targetUrl) {
      return sendJson(res, { success: false, error: 'url query parameter is required' }, 400);
    }
    const preview = await fetchLinkPreview(targetUrl);
    return sendJson(res, preview, 200);
  }

  // 12.6. Dynamic Social Media Link Previews & Open Graph Engine (/api/share and /share)
  if ((pathname === '/share' || pathname.startsWith('/share/') || pathname === '/share-preview') && method === 'GET') {
    let identifier = parsed.query.id || parsed.query.slug || parsed.query.novel || parsed.query.thread || parsed.query.sub || parsed.query.cat || '';
    if (!identifier && pathname.startsWith('/share/')) {
      const parts = pathname.replace(/^\/share\/?/, '').split('/').filter(Boolean);
      identifier = parts[parts.length - 1] || '';
    }

    const meta = await resolveContentMetadata(identifier, req);

    // If client requested JSON metadata
    const acceptHeader = req.headers?.['accept'] || '';
    if (parsed.query.format === 'json' || pathname === '/share-preview' || acceptHeader.includes('application/json')) {
      return sendJson(res, { success: true, metadata: meta }, 200);
    }

    // Otherwise render full Open Graph / Twitter Card HTML
    const html = renderShareHtml(meta);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'X-Robots-Tag': 'all'
    });
    return res.end(html);
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
    if (currentUser.permissions && currentUser.permissions.can_comment === false) {
      return sendJson(res, { success: false, error: 'Your commenting privileges have been restricted by an administrator.' }, 403);
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
  
  // Unified Persistent Image Upload Endpoint (Covers, Avatars, Media, Comments, Chat)
  if ((pathname === '/api/upload/image' || pathname === '/upload/image') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to upload images.', requireLogin: true }, 401);
    }

    const body = await readJsonBody(req);
    const base64Data = body.data || body.file || body.dataUrl || body.base64Data;
    if (!base64Data || typeof base64Data !== 'string') {
      return sendJson(res, { success: false, error: 'No image data provided.' }, 400);
    }

    let folder = (body.folder || 'covers').toLowerCase();
    const isAdmin = Boolean(currentUser.isAdmin || ['admin', 'administrator', 'author'].includes((currentUser.role || '').toLowerCase()));
    const isWriter = Boolean(isAdmin || (currentUser.role || '').toLowerCase() === 'writer');

    // Role-based folder restriction
    if (folder === 'media' && !isAdmin) {
      folder = isWriter ? 'covers' : 'comments';
    } else if (folder === 'covers' && !isWriter) {
      folder = 'comments';
    }

    const result = await saveUploadedImageFile({
      base64Data,
      folder,
      prefix: body.prefix || folder.slice(0, -1),
      filename: body.filename || body.name || 'image.jpg',
      oldImageUrl: body.replaceUrl || null,
      userId: currentUser.id
    });

    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  if (pathname === '/comments/upload-image' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to upload images.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const base64Data = body.data || body.file;
    if (!base64Data || typeof base64Data !== 'string') {
      return sendJson(res, { success: false, error: 'No image data provided.' }, 400);
    }

    const result = await saveUploadedImageFile({
      base64Data,
      folder: 'comments',
      prefix: 'comment',
      filename: body.name || body.filename || 'image.jpg',
      oldImageUrl: body.replaceUrl || null,
      userId: currentUser.id
    });

    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, { success: true, url: result.url }, 200);
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

  // 21. Novels: Get Homepage Structured Content (Deprecated - Forms is now main landing page)
  if (pathname === '/novels/homepage' && method === 'GET') {
    return sendJson(res, { success: true, message: 'Forms is now the main landing page', sections: [], orderedSections: [] }, 200);
  }

  // 21b. Genres API: Lookup and Dynamic Add
  if (pathname === '/genres' && method === 'GET') {
    const rows = await query('SELECT id, name, slug FROM novel_genres ORDER BY name ASC;');
    return sendJson(res, { success: true, genres: rows }, 200);
  }

  if (pathname === '/genres' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const cleanName = (body.name || '').trim();
    if (!cleanName) {
      return sendJson(res, { success: false, error: 'Genre name cannot be empty.' }, 400);
    }
    const cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `genre-${Date.now()}`;
    const existing = await queryOne('SELECT * FROM novel_genres WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR slug = ? LIMIT 1;', [cleanName, cleanSlug]);
    if (existing) {
      return sendJson(res, { success: true, genre: existing, message: 'Genre already exists.' }, 200);
    }
    const ins = await query('INSERT INTO novel_genres (name, slug) VALUES (?, ?);', [cleanName, cleanSlug]);
    const created = await queryOne('SELECT * FROM novel_genres WHERE id = ?;', [ins.insertId]);
    return sendJson(res, { success: true, genre: created }, 201);
  }

  // 21c. Content Categories API: Lookup and Dynamic Add
  if (pathname === '/content-categories' && method === 'GET') {
    const rows = await query('SELECT id, title, icon, sort_order, is_active, status FROM forum_categories ORDER BY sort_order ASC, title ASC;');
    return sendJson(res, { success: true, categories: rows }, 200);
  }

  if (pathname === '/content-categories' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const cleanTitle = (body.title || body.name || '').trim();
    if (!cleanTitle) {
      return sendJson(res, { success: false, error: 'Category title cannot be empty.' }, 400);
    }
    const slug = (body.id || body.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || `cat-${Date.now()}`;
    const existing = await queryOne('SELECT * FROM forum_categories WHERE id = ? OR LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1;', [slug, cleanTitle]);
    if (existing) {
      return sendJson(res, { success: true, category: existing, message: 'Category already exists.' }, 200);
    }
    const icon = body.icon || '📖';
    await query(`
      INSERT INTO forum_categories (id, title, icon, sort_order, is_active, status, visibility, is_disabled)
      VALUES (?, ?, ?, 99, 1, 'published', 'public', 0);
    `, [slug, cleanTitle, icon]);
    const created = await queryOne('SELECT * FROM forum_categories WHERE id = ?;', [slug]);
    return sendJson(res, { success: true, category: created }, 201);
  }

  // 21d. Members and Writers Lightweight Lookups for Form Checklists
  if (pathname === '/admin/members/lookup' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const members = await query(`
      SELECT u.id, u.username, u.email, u.role, u.status, p.display_name, p.avatar
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.status = 'active'
      ORDER BY COALESCE(p.display_name, u.username) ASC;
    `);
    return sendJson(res, {
      success: true,
      members: members.map(m => ({
        id: m.id,
        username: m.username,
        email: m.email,
        name: m.display_name || m.username,
        role: m.role,
        avatar: m.avatar || null
      }))
    }, 200);
  }

  if (pathname === '/admin/writers/lookup' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writers = await query(`
      SELECT u.id, u.username, u.email, u.role, u.status, p.display_name, p.avatar
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE LOWER(u.role) IN ('writer', 'author', 'admin', 'administrator', 'editor')
        AND u.status = 'active'
      ORDER BY (CASE WHEN LOWER(u.role) = 'admin' THEN 0 ELSE 1 END), COALESCE(p.display_name, u.username) ASC;
    `);
    return sendJson(res, {
      success: true,
      writers: writers.map(w => ({
        id: w.id,
        username: w.username,
        email: w.email,
        name: w.display_name || w.username,
        role: w.role,
        avatar: w.avatar || null
      }))
    }, 200);
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
  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && !pathname.includes('/permissions') && !pathname.includes('/assignments') && !pathname.includes('/submissions') && !pathname.includes('/audit-logs') && method === 'GET') {
    const idStr = pathname.replace('/admin/writers/', '').trim();
    if (/^\d+$/.test(idStr)) {
      if (requireAdminOrEditor(currentUser, res)) return;
      const writerId = parseInt(idStr, 10);
      const writer = await getWriterDetails(writerId);
      if (!writer) {
        return sendJson(res, { success: false, error: 'Writer account not found' }, 404);
      }
      return sendJson(res, { success: true, writer }, 200);
    }
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
  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/assignments') && method === 'DELETE') {
    const idStr = pathname.replace('/admin/writers/', '').trim();
    if (/^\d+$/.test(idStr)) {
      if (requireAdminOrEditor(currentUser, res)) return;
      const writerId = parseInt(idStr, 10);
      const result = await deleteWriterAccount({
        writerId,
        actorId: currentUser.id
      });
      if (!result.success) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result, 200);
    }
  }

  // ==========================================
  // ADMIN MEMBER MANAGEMENT (Admin Authorized Only)
  // ==========================================
  // 1. List members with KPIs, filtering, sorting, and pagination
  if (pathname === '/admin/members' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const result = await getMembersList(parsed.query);
    return sendJson(res, result, 200);
  }

  // 2. Create new member account
  if (pathname === '/admin/members' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await createMemberAccount({
      ...body,
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 3. Security Audit Logs
  if ((pathname === '/admin/members/audit-logs' || pathname === '/admin/audit-logs') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const result = await getAdminAuditLogs(parsed.query);
    return sendJson(res, result, 200);
  }

  // 4. Reset member password WITHOUT OTP (Admin-initiated)
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/reset-password') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/reset-password', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await adminResetMemberPassword({
      memberId,
      newPassword: body.newPassword || body.password,
      confirmPassword: body.confirmPassword,
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 5. Change member account access status (active, blocked, suspended, disabled)
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/status') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/status', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await toggleMemberStatus({
      memberId,
      status: body.status,
      reason: body.reason,
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 5a. Temporarily Block Member (with Duration, Reason, and Session Revocation)
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/block') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/block', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await temporarilyBlockMember({
      memberId,
      duration: body.duration || '24h',
      customExpiry: body.customExpiry || null,
      reason: body.reason || '',
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 5b. Unblock Member Early (Restore to Active)
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/unblock') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/unblock', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await unblockMember({
      memberId,
      reason: body.reason || '',
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 5c. Permanently Delete Member Account
  if (
    (pathname.startsWith('/admin/members/') && method === 'DELETE' && !pathname.includes('/permissions') && !pathname.includes('/status') && !pathname.includes('/reset-password') && !pathname.includes('/revoke-sessions') && !pathname.includes('/audit-logs')) ||
    (pathname.startsWith('/admin/members/') && pathname.endsWith('/delete') && method === 'POST')
  ) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/delete', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await permanentlyDeleteMember({
      memberId,
      confirmationText: body.confirmationText || body.confirm || body.confirmUsername || '',
      reason: body.reason || '',
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 5d. Get Granular Feature Permissions
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/permissions') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/permissions', ''), 10);
    const result = await getMemberPermissions(memberId);
    if (!result) {
      return sendJson(res, { success: false, error: 'Member not found' }, 404);
    }
    return sendJson(res, { success: true, ...result }, 200);
  }

  // 5e. Update Granular Feature Permissions
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/permissions') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/permissions', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await updateMemberPermissions({
      memberId,
      permissions: body.permissions || body,
      revokeSessions: Boolean(body.revokeSessions),
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 6. Revoke all active sessions for member
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/revoke-sessions') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', '').replace('/revoke-sessions', ''), 10);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await revokeMemberSessions({
      memberId,
      adminId: currentUser.id,
      ipAddress,
      userAgent
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 7. Get single member details
  if (pathname.startsWith('/admin/members/') && !pathname.includes('/status') && !pathname.includes('/reset-password') && !pathname.includes('/revoke-sessions') && !pathname.includes('/audit-logs') && !pathname.includes('/permissions') && !pathname.includes('/block') && !pathname.includes('/unblock') && !pathname.includes('/delete') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', ''), 10);
    const member = await getMemberDetails(memberId);
    if (!member) {
      return sendJson(res, { success: false, error: 'Member account not found' }, 404);
    }
    return sendJson(res, { success: true, member }, 200);
  }

  // 8. Update member details
  if (pathname.startsWith('/admin/members/') && !pathname.includes('/status') && !pathname.includes('/reset-password') && !pathname.includes('/revoke-sessions') && !pathname.includes('/audit-logs') && !pathname.includes('/permissions') && !pathname.includes('/block') && !pathname.includes('/unblock') && !pathname.includes('/delete') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const memberId = parseInt(pathname.replace('/admin/members/', ''), 10);
    const body = await readJsonBody(req);
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const result = await updateMemberDetails({
      memberId,
      ...body,
      adminId: currentUser.id,
      ipAddress,
      userAgent
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

  // 28. Forum / Community: Get Sidebar Posts (Latest & Trending)
  if ((pathname === '/forum/posts' || pathname === '/api/forum/posts' || pathname === '/posts/sidebar' || pathname === '/posts') && method === 'GET') {
    const limit = parsed.query && parsed.query.limit ? Math.min(25, Math.max(1, parseInt(parsed.query.limit, 10))) : 7;
    const data = await getSidebarPostsFromDb(limit);
    return sendJson(res, { success: true, ...data }, 200);
  }

  // 29. Forum: Get Categories (Public sees active only; admin can request all=1)
  if ((pathname === '/forum/categories' || pathname === '/api/forum/categories') && method === 'GET') {
    const includeAll = parsed.query.all === '1' || parsed.query.admin === '1';
    const categories = await getForumCategoriesFromDb(includeAll);
    return sendJson(res, { success: true, categories }, 200);
  }

  // Admin Forum Categories Management
  if (pathname === '/admin/forum/categories' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createForumCategoryInDb(body);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/forum/categories/') && method === 'PUT') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const catId = pathname.replace('/admin/forum/categories/', '').trim();
    const body = await readJsonBody(req);
    const result = await updateForumCategoryInDb(catId, body);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/forum/categories/') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const catId = pathname.replace('/admin/forum/categories/', '').trim();
    const result = await deleteForumCategoryInDb(catId);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // =========================================================================
  // TRASH / RECYCLE BIN REST API ENDPOINTS (ADMIN & WRITER DASHBOARDS)
  // =========================================================================

  // 1. Get Trash Items (Admin views all; Writer views own)
  if ((pathname === '/api/trash' || pathname === '/admin/trash' || pathname === '/writer/trash') && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const filterType = parsed.query.type || parsed.query.filterType || 'all';
    const search = parsed.query.search || parsed.query.q || '';
    const limit = parseInt(parsed.query.limit, 10) || 100;
    const offset = parseInt(parsed.query.offset, 10) || 0;
    const result = await getTrashItems({ user: currentUser, filterType, search, limit, offset });
    return sendJson(res, result, 200);
  }

  // 2. Empty Trash
  if ((pathname === '/api/trash/empty' || pathname === '/admin/trash/empty' || pathname === '/writer/trash/empty') && (method === 'POST' || method === 'DELETE')) {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const result = await emptyTrash({ user: currentUser });
    return sendJson(res, result, 200);
  }

  // 3. Restore Item from Trash
  if (pathname.includes('/trash/') && pathname.endsWith('/restore') && method === 'POST') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const idStr = pathname.replace(/^.*\/trash\//, '').replace(/\/restore.*$/, '').trim();
    const trashId = parseInt(idStr, 10);
    const result = await restoreFromTrash({ trashId, user: currentUser });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // 4. Permanently Delete Item from Trash
  if (pathname.includes('/trash/') && (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const idStr = pathname.replace(/^.*\/trash\//, '').replace(/\/delete.*$/, '').trim();
    const trashId = parseInt(idStr, 10);
    const result = await permanentlyDeleteTrash({ trashId, user: currentUser });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // =========================================================================
  // ADMIN FORMS & CONTENT MANAGEMENT API (3-LEVEL HIERARCHY & ACCESS CONTROL)
  // =========================================================================

  // A. Main Titles (Main Categories)
  if (pathname === '/admin/content/main-categories' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const categories = await query('SELECT * FROM forum_categories ORDER BY sort_order ASC, title ASC;');
    return sendJson(res, { success: true, categories }, 200);
  }

  // Reorder Main Categories
  if ((pathname === '/admin/content/main-categories/reorder' || pathname === '/admin/forum/categories/reorder') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const orderList = body.order || body.categories || body.items || body;
    const result = await reorderMainCategories(orderList, currentUser.id);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname === '/admin/content/main-categories' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createMainCategory({ ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/content/main-categories/') && (pathname.endsWith('/status') || pathname.endsWith('/toggle')) && (method === 'PATCH' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const catId = decodeURIComponent(pathname.replace('/admin/content/main-categories/', '').replace('/status', '').replace('/toggle', '').trim());
    const body = await readJsonBody(req);
    const result = await toggleMainCategoryStatus({ id: catId, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/content/main-categories/') && !pathname.endsWith('/status') && !pathname.endsWith('/toggle') && (method === 'PUT' || method === 'POST') && !pathname.endsWith('/delete')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const catId = decodeURIComponent(pathname.replace('/admin/content/main-categories/', '').trim());
    const body = await readJsonBody(req);
    const result = await updateMainCategory({ id: catId, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/content/main-categories/') && (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const catId = decodeURIComponent(pathname.replace('/admin/content/main-categories/', '').replace('/delete', '').trim());
    const body = await readJsonBody(req);
    const result = await deleteMainCategory({ id: catId, confirmTitle: body.confirmTitle || body.confirm || '', adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // B. Sub Titles (Subcategories)
  if (pathname === '/admin/content/subcategories' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const mainId = parsed.query.mainId;
    let sql = 'SELECT s.*, m.title as main_category_title FROM content_subcategories s LEFT JOIN forum_categories m ON m.id = s.main_category_id';
    const params = [];
    if (mainId) {
      sql += ' WHERE s.main_category_id = ?';
      params.push(mainId);
    }
    sql += ' ORDER BY s.sort_order ASC, s.title ASC;';
    const subcategories = await query(sql, params);
    return sendJson(res, { success: true, subcategories }, 200);
  }

  // Reorder Sub Categories
  if ((pathname === '/admin/content/subcategories/reorder' || pathname === '/admin/content/sub-categories/reorder') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const orderList = body.order || body.subcategories || body.items || body.orderList || body;
    const result = await reorderSubCategories(orderList, currentUser.id);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname === '/admin/content/subcategories' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createSubCategory({ ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/content/subcategories/') && (pathname.endsWith('/status') || pathname.endsWith('/toggle')) && (method === 'PATCH' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const subId = decodeURIComponent(pathname.replace('/admin/content/subcategories/', '').replace('/status', '').replace('/toggle', '').trim());
    const body = await readJsonBody(req);
    const result = await toggleSubCategoryStatus({ id: subId, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/content/subcategories/') && !pathname.endsWith('/status') && !pathname.endsWith('/toggle') && (method === 'PUT' || method === 'POST') && !pathname.endsWith('/delete')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const subId = decodeURIComponent(pathname.replace('/admin/content/subcategories/', '').trim());
    const body = await readJsonBody(req);
    const result = await updateSubCategory({ id: subId, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/content/subcategories/') && (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const subId = decodeURIComponent(pathname.replace('/admin/content/subcategories/', '').replace('/delete', '').trim());
    const body = await readJsonBody(req);
    const result = await deleteSubCategory({ id: subId, confirmTitle: body.confirmTitle || body.confirm || '', adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // C. Content Articles (Content Titles & Reading Content)
  if (pathname === '/admin/content/articles' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const mainId = parsed.query.mainId;
    const subId = parsed.query.subId;
    const search = parsed.query.search ? `%${parsed.query.search.trim()}%` : null;
    let sql = `
      SELECT a.*, 
             m.title as main_category_title,
             s.title as sub_category_title
      FROM content_articles a
      LEFT JOIN forum_categories m ON m.id = a.main_category_id
      LEFT JOIN content_subcategories s ON s.id = a.sub_category_id
      WHERE 1=1
    `;
    const params = [];
    if (mainId) {
      sql += ' AND a.main_category_id = ?';
      params.push(mainId);
    }
    if (subId) {
      sql += ' AND a.sub_category_id = ?';
      params.push(subId);
    }
    if (search) {
      sql += ' AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)';
      params.push(search, search, search);
    }
    sql += ' ORDER BY a.sort_order ASC, a.id DESC;';
    const articles = await query(sql, params);
    return sendJson(res, { success: true, articles }, 200);
  }

  /* ========================================================
     NOVEL WRITING & NOVEL MANAGEMENT ENDPOINTS (Admin & Writer)
     ======================================================== */

  // 1. Novel Management: List Novels with Pagination (10 per page), Search, & Status Filter
  if ((pathname === '/novels' || pathname === '/published-novels') && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || ['writer', 'author'].includes((currentUser.role || '').toLowerCase());
    if (!isAdmin && !isWriter) return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required.' }, 403);

    const search = (url.searchParams.get('search') || '').trim();
    const statusFilter = (url.searchParams.get('status') || 'all').toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 10; // Exactly 10 per page as required
    const offset = (page - 1) * limit;

    let whereConditions = ['(? = 1 OR a.author_id = ?)'];
    let params = [isAdmin ? 1 : 0, currentUser.id];

    if (statusFilter === 'draft') {
      whereConditions.push("(a.status = 'draft' OR (a.is_published = 0 AND (a.is_disabled IS NULL OR a.is_disabled = 0)))");
    } else if (statusFilter === 'published') {
      whereConditions.push("(a.status = 'published' AND a.is_published = 1 AND (a.is_disabled IS NULL OR a.is_disabled = 0))");
    } else if (statusFilter === 'disabled') {
      whereConditions.push("(a.status = 'disabled' OR a.is_disabled = 1)");
    }

    if (search) {
      whereConditions.push('(a.title LIKE ? OR a.content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = whereConditions.join(' AND ');

    // Total Count Query
    const countRow = await queryOne(`SELECT COUNT(*) AS total FROM content_articles a WHERE ${whereSql};`, params);
    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Page Data Query
    const dataSql = `
      SELECT a.id, a.unique_slug, a.main_category_id, a.sub_category_id,
             a.title, a.content, a.summary, a.author_id, a.author_name,
             a.status, a.is_published, a.is_disabled, a.views_count, a.comments_count,
             a.created_at, a.published_at, a.updated_at,
             fc.title AS category_title
      FROM content_articles a
      LEFT JOIN forum_categories fc ON a.main_category_id = fc.id
      WHERE ${whereSql}
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ? OFFSET ?;
    `;
    const rows = await query(dataSql, [...params, limit, offset]);

    const items = rows.map(r => {
      let resolvedStatus = 'draft';
      if (r.is_disabled === 1 || r.status === 'disabled') {
        resolvedStatus = 'disabled';
      } else if (r.status === 'published' || r.is_published === 1) {
        resolvedStatus = 'published';
      }

      const slug = r.unique_slug || String(r.id);
      return {
        id: r.id,
        slug: slug,
        uniqueSlug: slug,
        title: r.title || 'Untitled Novel',
        content: r.content || '',
        summary: r.summary || '',
        categoryTitle: r.category_title || r.main_category_id || 'Rudhra Novels',
        readerUrl: `#thread?id=${encodeURIComponent(slug)}`,
        contentLink: `#thread?id=${encodeURIComponent(slug)}`,
        authorId: r.author_id,
        authorName: r.author_name || (r.author_id === 2 ? 'Rudhra Prarthana' : 'Writer'),
        status: resolvedStatus,
        isPublished: resolvedStatus === 'published',
        isDisabled: resolvedStatus === 'disabled',
        viewsCount: r.views_count || 0,
        commentsCount: r.comments_count || 0,
        createdAt: r.created_at || r.published_at,
        publishedAt: r.published_at,
        updatedAt: r.updated_at || r.created_at
      };
    });

    return sendJson(res, {
      success: true,
      novels: items,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    }, 200);
  }

  // 2. Get Single Novel Details By ID
  if ((pathname.startsWith('/novels/') || pathname.startsWith('/published-novels/')) &&
      !pathname.endsWith('/delete') && !pathname.endsWith('/status') && !pathname.endsWith('/toggle') && !pathname.endsWith('/publish') &&
      method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const idStr = pathname.replace('/novels/', '').replace('/published-novels/', '').trim();
    const id = parseInt(idStr, 10);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());

    const article = isNaN(id)
      ? await queryOne('SELECT * FROM content_articles WHERE unique_slug = ?;', [idStr])
      : await queryOne('SELECT * FROM content_articles WHERE id = ? OR unique_slug = ?;', [id, idStr]);

    if (!article) return sendJson(res, { success: false, error: 'Novel not found.' }, 404);

    if (!isAdmin && Number(article.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You can only view your own novels.' }, 403);
    }

    let resolvedStatus = 'draft';
    if (article.is_disabled === 1 || article.status === 'disabled') {
      resolvedStatus = 'disabled';
    } else if (article.status === 'published' || article.is_published === 1) {
      resolvedStatus = 'published';
    }

    const slug = article.unique_slug || String(article.id);
    const item = {
      id: article.id,
      slug: slug,
      uniqueSlug: slug,
      title: article.title || '',
      content: article.content || '',
      summary: article.summary || '',
      authorId: article.author_id,
      authorName: article.author_name,
      status: resolvedStatus,
      isPublished: resolvedStatus === 'published',
      isDisabled: resolvedStatus === 'disabled',
      readerUrl: `#thread?id=${encodeURIComponent(slug)}`,
      contentLink: `#thread?id=${encodeURIComponent(slug)}`,
      createdAt: article.created_at,
      publishedAt: article.published_at,
      updatedAt: article.updated_at
    };

    return sendJson(res, { success: true, item, novel: item }, 200);
  }

  // 3. Novel Content Writing: Autosave / Save Draft Endpoint
  if ((pathname === '/novel-editor/autosave' || pathname === '/novels/autosave') && (method === 'POST' || method === 'PUT')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || ['writer', 'author'].includes((currentUser.role || '').toLowerCase());
    if (!isAdmin && !isWriter) return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required.' }, 403);

    const body = await readJsonBody(req);
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    let draftId = body.id || body.draftId ? parseInt(body.id || body.draftId, 10) : null;
    const authorId = currentUser.id;
    const authorName = currentUser.displayName || currentUser.username || (isAdmin ? 'Rudhra Prarthana' : 'Writer');

    if (!title && !content) {
      return sendJson(res, { success: false, error: 'Cannot save an empty novel.' }, 400);
    }

    // Update existing novel draft/record if ID provided
    if (draftId) {
      const existing = await queryOne('SELECT id, unique_slug, author_id, status, is_published FROM content_articles WHERE id = ?;', [draftId]);
      if (existing) {
        if (!isAdmin && Number(existing.author_id) !== Number(authorId)) {
          return sendJson(res, { success: false, error: 'Access denied: You cannot edit this novel.' }, 403);
        }
        await query(`
          UPDATE content_articles 
          SET title = ?, content = ?, updated_at = NOW() 
          WHERE id = ?;
        `, [title || existing.title || 'Untitled Novel', content, draftId]);

        const slug = existing.unique_slug || String(draftId);
        return sendJson(res, {
          success: true,
          id: draftId,
          draftId,
          uniqueSlug: slug,
          contentLink: `#thread?id=${encodeURIComponent(slug)}`,
          status: existing.status,
          updatedAt: new Date().toISOString(),
          message: 'Saved successfully.'
        }, 200);
      }
    }

    // Create new novel draft in database
    const safeTitle = title || 'Untitled Novel';
    const cleanSlug = `novel-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const ins = await query(`
      INSERT INTO content_articles (
        unique_slug, main_category_id, title, content, author_id, author_name,
        status, is_published, is_disabled, visibility, sort_order, created_at, updated_at
      ) VALUES (?, 'rudhra_prarthana_tamil_novels', ?, ?, ?, ?, 'draft', 0, 0, 'public', 0, NOW(), NOW());
    `, [cleanSlug, safeTitle, content, authorId, authorName]);

    return sendJson(res, {
      success: true,
      id: ins.insertId,
      draftId: ins.insertId,
      uniqueSlug: cleanSlug,
      contentLink: `#thread?id=${encodeURIComponent(cleanSlug)}`,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      message: 'Draft saved in database.'
    }, 200);
  }

  // 4. Novel Publishing Endpoint (Generate Publish Link & Mark Live)
  if ((pathname === '/novel-editor/publish' || pathname === '/novels/publish' ||
       ((pathname.startsWith('/novels/') || pathname.startsWith('/published-novels/')) && pathname.endsWith('/publish'))) &&
      (method === 'POST' || method === 'PUT')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || ['writer', 'author'].includes((currentUser.role || '').toLowerCase());
    if (!isAdmin && !isWriter) return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required.' }, 403);

    const body = await readJsonBody(req);
    let targetId = body.id || body.draftId;
    if (!targetId && (pathname.startsWith('/novels/') || pathname.startsWith('/published-novels/'))) {
      targetId = parseInt(pathname.replace('/novels/', '').replace('/published-novels/', '').replace('/publish', ''), 10);
    }

    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    const authorId = currentUser.id;
    const authorName = currentUser.displayName || currentUser.username || (isAdmin ? 'Rudhra Prarthana' : 'Writer');

    if (targetId) {
      const existing = await queryOne('SELECT * FROM content_articles WHERE id = ?;', [targetId]);
      if (existing) {
        if (!isAdmin && Number(existing.author_id) !== Number(authorId)) {
          return sendJson(res, { success: false, error: 'Access denied: You cannot publish this novel.' }, 403);
        }
        const updatedTitle = title || existing.title;
        const updatedContent = content || existing.content;

        if (!updatedTitle) {
          return sendJson(res, { success: false, error: 'Title cannot be empty.' }, 400);
        }

        await query(`
          UPDATE content_articles 
          SET title = ?, content = ?, status = 'published', is_published = 1, is_disabled = 0,
              published_at = COALESCE(published_at, NOW()), updated_at = NOW() 
          WHERE id = ?;
        `, [updatedTitle, updatedContent, targetId]);

        const slug = existing.unique_slug || String(targetId);
        const contentLink = `#thread?id=${encodeURIComponent(slug)}`;

        return sendJson(res, {
          success: true,
          id: targetId,
          uniqueSlug: slug,
          contentLink,
          message: 'Novel published successfully! Use the link below to share or post in categories.'
        }, 200);
      }
    }

    // Direct publish of new novel
    if (!title) {
      return sendJson(res, { success: false, error: 'Title cannot be empty.' }, 400);
    }
    const cleanSlug = `novel-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const ins = await query(`
      INSERT INTO content_articles (
        unique_slug, main_category_id, title, content, author_id, author_name,
        status, is_published, is_disabled, visibility, sort_order, published_at, created_at, updated_at
      ) VALUES (?, 'rudhra_prarthana_tamil_novels', ?, ?, ?, ?, 'published', 1, 0, 'public', 0, NOW(), NOW(), NOW());
    `, [cleanSlug, title, content, authorId, authorName]);

    const contentLink = `#thread?id=${encodeURIComponent(cleanSlug)}`;
    return sendJson(res, {
      success: true,
      id: ins.insertId,
      uniqueSlug: cleanSlug,
      contentLink,
      message: 'Novel published successfully! Use the link below to share or post in categories.'
    }, 200);
  }

  // 5. Toggle Novel Enable / Disable Status
  if ((pathname.startsWith('/novels/') || pathname.startsWith('/published-novels/')) &&
      (pathname.endsWith('/status') || pathname.endsWith('/toggle')) &&
      (method === 'PUT' || method === 'POST')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const id = parseInt(pathname.replace('/novels/', '').replace('/published-novels/', '').replace('/status', '').replace('/toggle', ''), 10);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());

    const article = await queryOne('SELECT * FROM content_articles WHERE id = ?;', [id]);
    if (!article) return sendJson(res, { success: false, error: 'Novel not found.' }, 404);

    if (!isAdmin && Number(article.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You can only manage your own novels.' }, 403);
    }

    const body = await readJsonBody(req);
    let targetStatus = body.status;
    if (!targetStatus) {
      targetStatus = (article.status === 'disabled' || article.is_disabled === 1) ? 'published' : 'disabled';
    }

    const isPublished = targetStatus === 'published' ? 1 : 0;
    const isDisabled = targetStatus === 'disabled' ? 1 : 0;

    await query(`
      UPDATE content_articles 
      SET status = ?, is_published = ?, is_disabled = ?, updated_at = NOW() 
      WHERE id = ?;
    `, [targetStatus, isPublished, isDisabled, id]);

    return sendJson(res, {
      success: true,
      message: `Novel status updated to ${targetStatus}.`,
      item: { id, status: targetStatus, isPublished: Boolean(isPublished), isDisabled: Boolean(isDisabled) }
    }, 200);
  }

  // 6. Delete Novel: Safely Move to Trash
  if ((pathname.startsWith('/novels/') || pathname.startsWith('/published-novels/')) &&
      (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const id = parseInt(pathname.replace('/novels/', '').replace('/published-novels/', '').replace('/delete', ''), 10);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());

    const article = await queryOne('SELECT * FROM content_articles WHERE id = ?;', [id]);
    if (!article) return sendJson(res, { success: false, error: 'Novel not found.' }, 404);

    if (!isAdmin && Number(article.author_id) !== Number(currentUser.id)) {
      return sendJson(res, { success: false, error: 'Access denied: You do not have permission to delete this novel.' }, 403);
    }

    // Move to Trash using existing Trash system
    try {
      await moveToTrash({
        itemType: 'content_article',
        itemId: id,
        title: article.title || 'Untitled Novel',
        ownerId: article.author_id,
        deletedBy: currentUser.id,
        deletedByName: currentUser.displayName || currentUser.username || (isAdmin ? 'Admin' : 'Writer'),
        originalLocation: article.main_category_id || 'rudhra_prarthana_tamil_novels',
        itemData: article
      });
    } catch (trashErr) {
      console.warn('Could not record novel in trash_items:', trashErr);
    }

    // Safely delete from active content_articles
    await query('DELETE FROM content_articles WHERE id = ?;', [id]);

    return sendJson(res, {
      success: true,
      message: 'Novel moved to Trash successfully.'
    }, 200);
  }

  // 7. Get Latest Saved Draft for Active User
  if ((pathname === '/novel-editor/latest-draft' || pathname === '/novels/latest-draft') && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const authorId = currentUser.id;
    const draft = await queryOne(`
      SELECT id, unique_slug, title, content, updated_at, created_at 
      FROM content_articles 
      WHERE author_id = ? AND status = 'draft' 
      ORDER BY updated_at DESC, id DESC 
      LIMIT 1;
    `, [authorId]);

    if (!draft) {
      return sendJson(res, { success: true, hasDraft: false }, 200);
    }

    return sendJson(res, {
      success: true,
      hasDraft: true,
      draft: {
        id: draft.id,
        slug: draft.unique_slug,
        title: draft.title,
        content: draft.content,
        updatedAt: draft.updated_at
      }
    }, 200);
  }

  if (pathname.startsWith('/admin/content/articles/') && !pathname.endsWith('/status') && !pathname.endsWith('/delete') && !pathname.endsWith('/toggle') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    let id = pathname.replace('/admin/content/articles/', '').trim();
    try {
      id = decodeURIComponent(id).trim();
    } catch (e) {}
    const result = await getContentArticle(id, currentUser, { incrementView: false });
    if (!result.success) return sendJson(res, result, 404);
    return sendJson(res, result, 200);
  }

  if ((pathname === '/admin/content/articles' || pathname === '/content/threads' || pathname === '/content/articles') && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || ['writer', 'author'].includes((currentUser.role || '').toLowerCase());
    // Only /admin/content/articles requires Admin or Writer role; /content/threads is open to all authenticated users (including Members)
    if (pathname === '/admin/content/articles' && !isAdmin && !isWriter) {
      return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required.' }, 403);
    }
    const body = await readJsonBody(req);
    body.authorId = currentUser.id;
    body.authorName = currentUser.displayName || currentUser.username || (isAdmin ? 'Rudhra Prarthana' : (isWriter ? 'Writer' : 'Member'));
    body.status = 'published';
    body.isPublished = 1;
    const result = await createContentArticle({ ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/content/articles/') && (pathname.endsWith('/status') || pathname.endsWith('/toggle')) && (method === 'PATCH' || method === 'POST')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const id = parseInt(pathname.replace('/admin/content/articles/', '').replace('/status', '').replace('/toggle', ''), 10);
    const isAdmin = currentUser.isAdmin === true;
    const isWriter = currentUser.isWriter === true || (currentUser.role || '').toLowerCase() === 'writer';
    if (!isAdmin && !isWriter) return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required.' }, 403);
    const body = await readJsonBody(req);
    if (!isAdmin && isWriter) {
      const access = await canWriterAccessContent(currentUser.id, 'content', id, 'write');
      if (!access.allowed) return sendJson(res, { success: false, error: access.reason }, 403);
    }
    const result = await toggleContentArticleStatus({ id, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if ((pathname.startsWith('/admin/content/articles/') || pathname.startsWith('/content/threads/')) && !pathname.endsWith('/status') && !pathname.endsWith('/toggle') && (method === 'PUT' || method === 'POST') && !pathname.endsWith('/delete')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const id = parseInt(pathname.replace('/admin/content/articles/', '').replace('/content/threads/', ''), 10);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || (currentUser.role || '').toLowerCase() === 'writer';
    
    // Check ownership for community thread editing
    const existing = await queryOne('SELECT * FROM content_articles WHERE id = ?;', [id]);
    if (!existing) return sendJson(res, { success: false, error: 'Thread or article not found.' }, 404);

    const isOwner = Number(existing.author_id) === Number(currentUser.id);
    if (!isAdmin && !isOwner) {
      if (!isWriter) {
        return sendJson(res, { success: false, error: 'Access denied: You can only edit your own threads.' }, 403);
      }
      const access = await canWriterAccessContent(currentUser.id, 'content', id, 'write');
      if (!access.allowed) return sendJson(res, { success: false, error: access.reason }, 403);
    }
    const body = await readJsonBody(req);
    const result = await updateContentArticle({ id, ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if ((pathname.startsWith('/admin/content/articles/') || pathname.startsWith('/content/threads/')) && (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const id = parseInt(pathname.replace('/admin/content/articles/', '').replace('/content/threads/', '').replace('/delete', ''), 10);
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || (currentUser.role || '').toLowerCase() === 'writer';

    // Check ownership for thread deletion
    const existing = await queryOne('SELECT * FROM content_articles WHERE id = ?;', [id]);
    if (!existing) return sendJson(res, { success: false, error: 'Thread or article not found.' }, 404);

    const isOwner = Number(existing.author_id) === Number(currentUser.id);
    if (!isAdmin && !isOwner) {
      if (!isWriter) {
        return sendJson(res, { success: false, error: 'Access denied: You can only delete your own threads.' }, 403);
      }
      const access = await canWriterAccessContent(currentUser.id, 'content', id, 'delete');
      if (!access.allowed) return sendJson(res, { success: false, error: access.reason }, 403);
    }
    const body = await readJsonBody(req);
    const result = await deleteContentArticle({ id, confirmTitle: body.confirmTitle || body.confirm || 'yes', adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // D. Fine-Grained Access Control Rules
  if (pathname === '/admin/content/access-rules' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const targetType = parsed.query.targetType;
    const targetId = parsed.query.targetId;
    const result = await getContentAccessRules({ targetType, targetId });
    return sendJson(res, result, 200);
  }

  if (pathname === '/admin/content/access-rules' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await addContentAccessRule({ ...body, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/content/access-rules/') && (method === 'DELETE' || pathname.endsWith('/delete'))) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const ruleId = parseInt(pathname.replace('/admin/content/access-rules/', '').replace('/delete', ''), 10);
    const result = await removeContentAccessRule({ ruleId, adminId: currentUser.id });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
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
  if ((pathname === '/forum/topics' || pathname === '/api/forum/topics') && method === 'GET') {
    const categoryId = parsed.query.category || null;
    const isPrivileged = currentUser && (currentUser.isAdmin === true || currentUser.role === 'admin' || currentUser.role === 'editor');
    const includeUnpublished = parsed.query.all === '1' && isPrivileged;
    const topics = await getForumTopicsFromDb(categoryId, { includeUnpublished });
    return sendJson(res, { success: true, topics }, 200);
  }

  // Admin Forum Topics Management
  if (pathname === '/admin/forum/topics' && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createForumTopicInDb({
      categoryId: body.categoryId,
      title: body.title,
      authorId: currentUser.id,
      content: body.content,
      image: body.image || null,
      isPublished: body.is_published !== undefined ? body.is_published : 1,
      isPinned: body.is_pinned !== undefined ? body.is_pinned : 0,
      sortOrder: body.sort_order || 0
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  if (pathname.startsWith('/admin/forum/topics/') && method === 'PUT') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const topicId = pathname.replace('/admin/forum/topics/', '').trim();
    const body = await readJsonBody(req);
    const result = await updateForumTopicInDb(topicId, body);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  if (pathname.startsWith('/admin/forum/topics/') && method === 'DELETE') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const topicId = pathname.replace('/admin/forum/topics/', '').trim();
    const permanent = parsed.query.permanent === '1';
    const result = await deleteForumTopicInDb(topicId, permanent);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // 31. Forum: Create New Topic (Regular logged-in members)
  if (pathname === '/forum/topics' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to create a topic.', requireLogin: true }, 401);
    }
    if (currentUser.permissions && currentUser.permissions.can_post_forum === false) {
      return sendJson(res, { success: false, error: 'Your forum posting privileges have been restricted by an administrator.' }, 403);
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
    if (currentUser.permissions && currentUser.permissions.can_post_forum === false) {
      return sendJson(res, { success: false, error: 'Your forum posting privileges have been restricted by an administrator.' }, 403);
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

  // 35.5. Notifications: Admin / Writer Broadcast Announcement
  if (pathname === '/notifications/announcement' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const isAdmin = currentUser.isAdmin === true || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase());
    const isWriter = currentUser.isWriter === true || ['writer', 'author'].includes((currentUser.role || '').toLowerCase());
    if (!isAdmin && !isWriter) {
      return sendJson(res, { success: false, error: 'Access denied: Admin or Writer permissions required to broadcast announcements.' }, 403);
    }
    const body = await readJsonBody(req);
    const title = (body.title || '').trim();
    const message = (body.message || '').trim();
    if (!title || !message) {
      return sendJson(res, { success: false, error: 'Title and message are required.' }, 400);
    }
    const result = await broadcastAnnouncement({
      actorId: currentUser.id,
      title,
      message,
      link: body.link || '#forms',
      targetRole: body.target || 'all'
    });
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

  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && !pathname.includes('/audit-logs') && !pathname.includes('/permissions') && !pathname.includes('/assignments') && !pathname.includes('/submissions') && method === 'GET') {
    const idStr = pathname.replace('/admin/writers/', '').trim();
    if (/^\d+$/.test(idStr)) {
      if (requireAdminOrEditor(currentUser, res)) return;
      const writerId = parseInt(idStr, 10);
      const writer = await getWriterDetails(writerId);
      if (!writer) return sendJson(res, { success: false, error: 'Writer not found' }, 404);
      return sendJson(res, { success: true, writer });
    }
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

  if (pathname.startsWith('/admin/writers/') && !pathname.includes('/status') && !pathname.includes('/profile') && !pathname.includes('/audit-logs') && !pathname.includes('/assignments') && method === 'DELETE') {
    const idStr = pathname.replace('/admin/writers/', '').trim();
    if (/^\d+$/.test(idStr)) {
      if (requireAdminOrEditor(currentUser, res)) return;
      const writerId = parseInt(idStr, 10);
      const result = await deleteWriterAccount(writerId, currentUser.id, 2);
      if (!result.success) return sendJson(res, result, 400);
      return sendJson(res, result, 200);
    }
  }

  // ==========================================
  // ONE-TO-ONE REAL-TIME PRIVATE CHAT API (WhatsApp-like Suite)
  // ==========================================

  // 1. Upload Chat Media (Images, Photos, & Voice Notes)
  if (pathname === '/chat/upload' && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const body = await readJsonBody(req);
    const base64Data = body.file || body.dataUrl || body.base64Data;

    if (!base64Data || typeof base64Data !== 'string') {
      return sendJson(res, { success: false, error: 'Valid file payload is required' }, 400);
    }

    const matches = base64Data.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/i);
    if (!matches) {
      return sendJson(res, { success: false, error: 'Invalid file format. Must be a base64 data URI.' }, 400);
    }

    const mimeType = matches[1].toLowerCase();
    const rawBase64 = matches[2];
    const buffer = Buffer.from(rawBase64, 'base64');

    let messageType = 'text';
    let ext = 'bin';

    if (mimeType.startsWith('image/')) {
      messageType = 'image';
      if (buffer.length > 8 * 1024 * 1024) {
        return sendJson(res, { success: false, error: 'Image size exceeds maximum limit of 8MB.' }, 400);
      }
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      else ext = 'jpg';
    } else if (mimeType.startsWith('audio/') || mimeType.includes('ogg') || mimeType.includes('webm')) {
      messageType = 'audio';
      if (buffer.length > 16 * 1024 * 1024) {
        return sendJson(res, { success: false, error: 'Voice message size exceeds maximum limit of 16MB.' }, 400);
      }
      if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) ext = 'm4a';
      else if (mimeType.includes('wav')) ext = 'wav';
      else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';
      else if (mimeType.includes('ogg')) ext = 'ogg';
      else ext = 'webm';
    } else {
      messageType = 'file';
      if (buffer.length > 16 * 1024 * 1024) {
        return sendJson(res, { success: false, error: 'File size exceeds maximum limit of 16MB.' }, 400);
      }
      if (mimeType.includes('pdf')) ext = 'pdf';
      else if (mimeType.includes('msword') || mimeType.includes('wordprocessingml')) ext = 'docx';
      else if (mimeType.includes('zip') || mimeType.includes('compressed')) ext = 'zip';
      else if (mimeType.includes('text/plain')) ext = 'txt';
      else ext = 'bin';
    }

    const safeName = `chat-${messageType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = path.resolve(__dirname, 'uploads/chat');

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, safeName), buffer);
      return sendJson(res, {
        success: true,
        url: `/uploads/chat/${safeName}`,
        messageType,
        meta: body.meta || null
      }, 200);
    } catch (err) {
      console.error('Failed to save chat upload:', err);
      return sendJson(res, { success: false, error: 'Failed to save attachment on server.' }, 500);
    }
  }

  // 2. Get List of User's Conversations
  if (pathname === '/chat/conversations' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const result = await getUserConversations(currentUser.id);
    return sendJson(res, result, 200);
  }

  // 3. Start / Get Conversation or Create Direct Message Conversation
  if (pathname === '/chat/conversations' && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    if (currentUser.permissions && currentUser.permissions.can_chat === false) {
      return sendJson(res, { success: false, error: 'Your chat privileges have been restricted by an administrator.' }, 403);
    }
    const body = await readJsonBody(req);
    // If multi-recipient or direct message composer attributes are supplied
    if (body.recipients || body.title !== undefined || (body.content !== undefined && !body.targetUserId)) {
      const result = await createDirectMessageConversation(currentUser.id, body);
      return sendJson(res, result, result.success ? 201 : 400);
    }
    if (!body.targetUserId) return sendJson(res, { success: false, error: 'targetUserId or recipients is required' }, 400);
    const result = await getOrCreateConversation(currentUser.id, body.targetUserId);
    return sendJson(res, result, result.success ? 200 : 400);
  }

  // 3b. Invite Participants to Conversation
  if (pathname.startsWith('/chat/conversations/') && pathname.endsWith('/invite') && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const convId = parseInt(pathname.replace('/chat/conversations/', '').replace('/invite', ''), 10);
    if (isNaN(convId)) return sendJson(res, { success: false, error: 'Invalid conversation ID' }, 400);
    const body = await readJsonBody(req);
    const result = await inviteParticipantsToConversation(convId, currentUser.id, body.recipients || body.users || []);
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // 4. Conversation Lock / Unlock (Restricting / Restoring messaging)
  if (pathname.startsWith('/chat/conversations/') && pathname.endsWith('/lock') && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const convId = parseInt(pathname.replace('/chat/conversations/', '').replace('/lock', ''), 10);
    if (isNaN(convId)) return sendJson(res, { success: false, error: 'Invalid conversation ID' }, 400);
    const body = await readJsonBody(req);
    const shouldLock = body.action !== undefined ? body.action === 'lock' : Boolean(body.lock);
    const result = await toggleConversationLock(convId, currentUser.id, shouldLock, body.reason, currentUser.role);
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // 5. Get Conversation Message History
  if (pathname.startsWith('/chat/conversations/') && !pathname.endsWith('/messages') && !pathname.endsWith('/lock') && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const convId = parseInt(pathname.replace('/chat/conversations/', ''), 10);
    if (isNaN(convId)) return sendJson(res, { success: false, error: 'Invalid conversation ID' }, 400);
    const limit = parsed.query.limit ? parseInt(parsed.query.limit, 10) : 80;
    const beforeId = parsed.query.beforeId ? parseInt(parsed.query.beforeId, 10) : null;
    const result = await getConversationMessages(convId, currentUser.id, { limit, beforeId });
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // 6. Send Message in Conversation (Text, Photo, or Voice note)
  if (pathname.startsWith('/chat/conversations/') && pathname.endsWith('/messages') && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    if (currentUser.permissions && currentUser.permissions.can_chat === false) {
      return sendJson(res, { success: false, error: 'Your chat privileges have been restricted by an administrator.' }, 403);
    }
    const convId = parseInt(pathname.replace('/chat/conversations/', '').replace('/messages', ''), 10);
    if (isNaN(convId)) return sendJson(res, { success: false, error: 'Invalid conversation ID' }, 400);
    const body = await readJsonBody(req);
    const result = await sendMessage(convId, currentUser.id, body);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  // 7. Edit Sent Message
  if (pathname.startsWith('/chat/messages/') && method === 'PUT') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const msgId = parseInt(pathname.replace('/chat/messages/', ''), 10);
    if (isNaN(msgId)) return sendJson(res, { success: false, error: 'Invalid message ID' }, 400);
    const body = await readJsonBody(req);
    const result = await editMessage(msgId, currentUser.id, body.content);
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // 8. Unsend / Delete Message
  if (pathname.startsWith('/chat/messages/') && method === 'DELETE') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const msgId = parseInt(pathname.replace('/chat/messages/', ''), 10);
    if (isNaN(msgId)) return sendJson(res, { success: false, error: 'Invalid message ID' }, 400);
    const result = await unsendMessage(msgId, currentUser.id, currentUser.role);
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // 9. Total Unread Chat Count
  if (pathname === '/chat/unread-count' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, totalUnread: 0 }, 401);
    const totalUnread = await getTotalUnreadChatCount(currentUser.id);
    return sendJson(res, { success: true, totalUnread }, 200);
  }

  // 10. Global Chat Availability Settings
  if (pathname === '/chat/settings' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const result = await getUserChatSettings(currentUser.id);
    return sendJson(res, { success: true, ...result }, 200);
  }

  if (pathname === '/chat/settings' && (method === 'POST' || method === 'PUT')) {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const body = await readJsonBody(req);
    const rawVal = body.isChatAvailable !== undefined ? body.isChatAvailable : body.is_chat_available;
    const isChatAvailable = rawVal !== false && rawVal !== 0 && rawVal !== '0';
    const result = await updateUserChatSettings(currentUser.id, isChatAvailable);
    return sendJson(res, result, 200);
  }

  // 11. Individual Chat Lock / Unlock (User-to-User)
  if (pathname === '/chat/lock' && method === 'POST') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const body = await readJsonBody(req);
    if (!body.targetUserId) return sendJson(res, { success: false, error: 'targetUserId is required' }, 400);
    const lock = body.action !== undefined ? body.action === 'lock' : Boolean(body.lock);
    const result = await toggleChatLock(currentUser.id, body.targetUserId, lock);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // 12. Search Eligible Users for Chat
  if (pathname === '/chat/users' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const result = await getEligibleChatUsers(currentUser.id, parsed.query.search || '');
    return sendJson(res, result, 200);
  }

  // ==========================================
  // ADMINISTRATOR WRITER CHAT AUDIT API
  // ==========================================

  // A. Admin: List Writers with Chat Conversations
  if (pathname === '/admin/writer-chats/writers' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const result = await getAdminWritersList(currentUser.id);
    if (!result.success) return sendJson(res, result, 403);
    return sendJson(res, result, 200);
  }

  // B. Admin: List Conversations for a specific Writer
  if (pathname === '/admin/writer-chats/conversations' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const writerId = parseInt(parsed.query.writerId, 10);
    if (isNaN(writerId)) return sendJson(res, { success: false, error: 'writerId query parameter is required' }, 400);
    const result = await getAdminWriterConversations(currentUser.id, writerId);
    if (!result.success) return sendJson(res, result, result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }

  // C. Admin: Inspect Writer Chat History (STRICT PRIVACY CHECK)
  if (pathname === '/admin/writer-chats/history' && method === 'GET') {
    if (!currentUser) return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    const conversationId = parseInt(parsed.query.conversationId, 10);
    if (isNaN(conversationId)) return sendJson(res, { success: false, error: 'conversationId query parameter is required' }, 400);
    const ipAddress = req.socket?.remoteAddress || req.headers['x-forwarded-for'];
    const result = await getAdminWriterChatHistory(currentUser.id, conversationId, { ipAddress });
    if (!result.success) return sendJson(res, result, result.code === 'PRIVACY_VIOLATION' || result.code === 'FORBIDDEN' ? 403 : 400);
    return sendJson(res, result, 200);
  }



  
  // ============================================================================
  // WRITER PERMISSIONS, ASSIGNMENTS & REVIEW QUEUE (Admin & Writer APIs)
  // ============================================================================

    // Admin: Writer Content Hierarchy Lookup (Categories, Subcategories, Novels, Stories, Audio)
  if ((pathname === '/admin/writers/content-lookup' || pathname === '/api/admin/writers/content-lookup') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const mainCategories = await query('SELECT id, title, icon, sort_order FROM forum_categories ORDER BY sort_order ASC, title ASC;');
    const subCategories = await query('SELECT id, main_category_id, title FROM content_subcategories WHERE is_active = 1 ORDER BY sort_order ASC, title ASC;');
    const novels = [];
    const shortStories = [];
    const audioNovels = [];
    return sendJson(res, {
      success: true,
      mainCategories,
      subCategories,
      novels,
      shortStories,
      audioNovels
    }, 200);
  }

  // Admin: Bulk Update Writer Permissions
  if ((pathname === '/admin/writers/bulk-permissions' || pathname === '/api/admin/writers/bulk-permissions') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const body = await readJsonBody(req);
    const writerIds = Array.isArray(body.writerIds) ? body.writerIds : [];
    const permsData = body.permissions || body;
    const result = await bulkUpdateWriterPermissions(writerIds, permsData, currentUser.id);
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Admin: Revoke Writer Access
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/revoke') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/revoke', ''), 10);
    const body = await readJsonBody(req).catch(() => ({}));
    const result = await revokeWriterAccess(writerId, currentUser.id, body.reason || 'Writer access revoked by administrator.');
    return sendJson(res, result, 200);
  }

  // Admin: Reactivate Writer Access
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/reactivate') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/reactivate', ''), 10);
    const result = await reactivateWriterAccess(writerId, currentUser.id);
    return sendJson(res, result, 200);
  }

  // Admin: Get Writer Permissions
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/permissions') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/permissions', ''), 10);
    const perms = await getWriterPermissions(writerId);
    return sendJson(res, { success: true, permissions: perms }, 200);
  }

  // Admin: Update Writer Permissions
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/permissions') && (method === 'PUT' || method === 'POST')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/permissions', ''), 10);
    const body = await readJsonBody(req);
    const result = await updateWriterPermissions(writerId, {
      ...body,
      actorId: currentUser.id
    });
    return sendJson(res, result, 200);
  }

  // Admin: Get Writer Assignments
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/assignments') && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/assignments', ''), 10);
    const assignments = await getWriterAssignments(writerId, parsed.query.status || 'all');
    return sendJson(res, { success: true, assignments }, 200);
  }

  // Admin: Create Writer Assignment
  if (pathname.startsWith('/admin/writers/') && pathname.endsWith('/assignments') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const writerId = parseInt(pathname.replace('/admin/writers/', '').replace('/assignments', ''), 10);
    const body = await readJsonBody(req);
    const result = await createWriterAssignment({
      writerId,
      contentType: body.contentType,
      contentId: body.contentId,
      title: body.title,
      instructions: body.instructions,
      deadline: body.deadline,
      actions: body.actions,
      assignedBy: currentUser.id
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 201);
  }

  // Admin: Update Assignment Status (e.g. revoke or complete)
  if (pathname.startsWith('/admin/writers/assignments/') && (method === 'PUT' || method === 'POST' || method === 'DELETE')) {
    if (requireAdminOrEditor(currentUser, res)) return;
    const parts = pathname.replace('/admin/writers/assignments/', '').split('/');
    const assignmentId = parseInt(parts[0], 10);
    if (method === 'DELETE') {
      await query('DELETE FROM writer_assignments WHERE id = ?;', [assignmentId]);
      return sendJson(res, { success: true, message: 'Assignment successfully removed.' }, 200);
    }
    const body = await readJsonBody(req).catch(() => ({}));
    const newStatus = body.status || 'revoked';
    const result = await updateWriterAssignmentStatus(assignmentId, newStatus, currentUser.id);
    return sendJson(res, result, 200);
  }

  // Admin: Get All Writer Submissions (Review Queue)
  if (pathname === '/admin/writers/submissions' && method === 'GET') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const statusFilter = parsed.query.status || 'all';
    const contentTypeFilter = parsed.query.contentType || 'all';
    const writerIdFilter = parsed.query.writerId ? parseInt(parsed.query.writerId, 10) : null;
    const submissions = await getAllSubmissions({
      status: statusFilter,
      writerId: writerIdFilter,
      contentType: contentTypeFilter
    });
    return sendJson(res, { success: true, submissions }, 200);
  }

  // Admin: Review a Submission (Approve & Publish, Approve & Schedule, Request Changes, Reject)
  if (pathname.startsWith('/admin/writers/submissions/') && pathname.endsWith('/review') && method === 'POST') {
    if (requireAdminOrEditor(currentUser, res)) return;
    const submissionId = parseInt(pathname.replace('/admin/writers/submissions/', '').replace('/review', ''), 10);
    const body = await readJsonBody(req);
    const result = await reviewSubmission({
      submissionId,
      action: body.action,
      adminNotes: body.adminNotes || body.reason || '',
      scheduledAt: body.scheduledAt || null,
      actorId: currentUser.id
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Writer: Get Enhanced Workspace Data
  if (pathname === '/writer/enhanced-workspace' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const data = await getEnhancedWriterWorkspaceData(currentUser.id);
    if (!data) return sendJson(res, { success: false, error: 'Workspace not found' }, 404);
    return sendJson(res, { success: true, ...data }, 200);
  }

  // Writer: Get My Active Assignments
  if (pathname === '/writer/assignments' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const assignments = await getWriterAssignments(currentUser.id, parsed.query.status || 'active');
    return sendJson(res, { success: true, assignments }, 200);
  }

  // Writer: Get My Submissions
  if (pathname === '/writer/submissions' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const submissions = await getAllSubmissions({
      writerId: currentUser.id,
      status: parsed.query.status || 'all'
    });
    return sendJson(res, { success: true, submissions }, 200);
  }

  // Writer: Submit Content for Review (or publish if independent publishing permitted)
  if (pathname === '/writer/submissions' && method === 'POST') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    const body = await readJsonBody(req);
    const result = await createOrUpdateSubmission({
      writerId: currentUser.id,
      contentType: body.contentType,
      contentId: body.contentId,
      title: body.title,
      parentId: body.parentId || null,
      scheduledAt: body.scheduledAt || null
    });
    if (!result.success) return sendJson(res, result, 400);
    return sendJson(res, result, 200);
  }

  // Writer: Get Permitted Short Stories (Legacy stub)
  if (pathname === '/writer/short-stories' && method === 'GET') {
    if (requireWriterOrAdmin(currentUser, res)) return;
    return sendJson(res, { success: true, stories: [] }, 200);
  }

  // Fallthrough to next middleware if not an API route
  next();
}
