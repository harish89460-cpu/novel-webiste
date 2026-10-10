// REST API Middleware Handler for Rudhra Prarthana Novels
// Mounted on /api in Vite Connect middleware

import { parse as parseUrl } from 'node:url';
import {
  registerUser,
  loginUser,
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
  getReactions,
  toggleReaction
} from './comments.js';

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit for profile picture uploads
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
  return req.headers['x-auth-token'] || null;
}

export async function apiMiddleware(req, res, next) {
  const parsed = parseUrl(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method.toUpperCase();
  const token = extractToken(req);
  const currentUser = token ? getUserByToken(token) : null;

  // 1. Health Check
  if (pathname === '/health' || pathname === '/health/') {
    return sendJson(res, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // 2. Authentication: Register
  if (pathname === '/auth/register' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = registerUser(body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 3. Authentication: Login
  if (pathname === '/auth/login' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = loginUser(body);
    if (!result.success) {
      return sendJson(res, result, 401);
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
    const result = verifyPasswordResetOtp(body.email, body.otp);
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
    const result = completePasswordReset(body.email, body.resetToken, body.newPassword, body.confirmPassword);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 4. Authentication: Current Session User (Me)
  if (pathname === '/auth/me' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, { authenticated: false, isGuest: true, role: 'Guest' }, 200);
    }
    touchHeartbeat(currentUser.id);
    return sendJson(res, { authenticated: true, isGuest: false, user: currentUser }, 200);
  }

  // 5. Authentication: Logout
  if (pathname === '/auth/logout' && method === 'POST') {
    logoutUser(token);
    return sendJson(res, { success: true }, 200);
  }

  // 6. User Activity Status Toggle
  if (pathname === '/user/activity-status' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const isEnabled = Boolean(body.enabled);
    const result = setActivityStatus(currentUser.id, isEnabled);
    return sendJson(res, result, 200);
  }

  // 7. User Activity Heartbeat
  if (pathname === '/user/heartbeat' && method === 'POST') {
    if (currentUser) {
      touchHeartbeat(currentUser.id);
    }
    return sendJson(res, { success: true }, 200);
  }

  // 8. User Profile Update
  if (pathname === '/user/profile' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const body = await readJsonBody(req);
    const result = updateUserProfile(currentUser.id, body);
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 8. Members Directory with Activity Status (Privacy Protected)
  if (pathname === '/members' && method === 'GET') {
    const viewerId = currentUser ? currentUser.id : null;
    const members = getAllMembersWithStatus(viewerId);
    return sendJson(res, { success: true, members }, 200);
  }

  // 9. Chapter Content Access & Protection
  if (pathname === '/content/chapter' && method === 'GET') {
    const novelId = parsed.query.novel || 'nenjam-marappadhillai';
    const chNum = parseInt(parsed.query.ch || '1', 10);
    const result = getChapterContent({ novelId, chNum, user: currentUser });
    if (!result.allowed) {
      return sendJson(res, result, 403);
    }
    return sendJson(res, result, 200);
  }

  // 10. Audio Story Access & Protection
  if (pathname === '/content/audio' && method === 'GET') {
    const audioId = parsed.query.id || 'maaya-nadhi-theeram';
    const result = getAudioAccess({ audioId, user: currentUser });
    if (!result.allowed) {
      return sendJson(res, result, 403);
    }
    return sendJson(res, result, 200);
  }

  // 11. Comments: Get Comments (Public for both Guests & Members)
  if (pathname === '/comments' && method === 'GET') {
    const novelId = parsed.query.novel;
    const chapterNum = parseInt(parsed.query.ch || '0', 10);
    if (!novelId) {
      return sendJson(res, { success: false, error: 'novel is required' }, 400);
    }
    const comments = getComments({ novelId, chapterNum });
    return sendJson(res, { success: true, comments }, 200);
  }

  // 12. Comments: Add Comment (Registered Users Only)
  if (pathname === '/comments' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to post a comment.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const result = addComment({
      novelId: body.novelId,
      chapterNum: parseInt(body.chapterNum || '0', 10),
      userId: currentUser.id,
      content: body.content
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 201);
  }

  // 13. Comments: Update Comment (Owner or Admin/Moderator Only)
  if ((pathname.startsWith('/comments/') && method === 'PUT') || (pathname === '/comments/update' && method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to edit.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const commentId = parseInt(body.commentId || pathname.split('/').pop(), 10);
    const result = updateComment({
      commentId,
      userId: currentUser.id,
      userRole: currentUser.role,
      content: body.content
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 14. Comments: Delete Comment (Owner or Admin/Moderator Only)
  if ((pathname.startsWith('/comments/') && method === 'DELETE') || (pathname === '/comments/delete' && method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to delete.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    const commentId = parseInt(body.commentId || pathname.split('/').pop(), 10);
    const result = deleteComment({
      commentId,
      userId: currentUser.id,
      userRole: currentUser.role
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // 15. Reactions: Get Reactions (Public: Visible to Guests & Members)
  if (pathname === '/reactions' && method === 'GET') {
    const targetType = parsed.query.targetType || 'content';
    const targetId = parsed.query.targetId;
    if (!targetId) {
      return sendJson(res, { success: false, error: 'targetId is required' }, 400);
    }
    const userId = currentUser ? currentUser.id : null;
    const result = getReactions({ targetType, targetId, userId });
    return sendJson(res, result, 200);
  }

  // 16. Reactions: Toggle Reaction (Registered Users Only, Prevents Duplicates)
  if (pathname === '/reactions' && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to react.', requireLogin: true }, 401);
    }
    const body = await readJsonBody(req);
    if (!body.targetId || !body.emoji) {
      return sendJson(res, { success: false, error: 'targetId and emoji are required.' }, 400);
    }
    const targetType = body.targetType || 'content';
    const result = toggleReaction({
      targetType,
      targetId: body.targetId,
      userId: currentUser.id,
      emoji: body.emoji
    });
    if (!result.success) {
      return sendJson(res, result, 400);
    }
    return sendJson(res, result, 200);
  }

  // Fallthrough to next middleware if not an API route
  next();
}
