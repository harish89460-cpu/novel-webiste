// Dynamic Content-Data Service for Rudhra Prarthana Novels
// Interfaces directly with the single consolidated MySQL SQL Database API

import { apiFetch } from './errors.js';

// In-memory cache for homepage content
let cachedHomepageData = null;

export function clearHomepageCache() {
  cachedHomepageData = null;
}

/**
 * Fetch novels list from the content hierarchy and articles
 */
export async function getNovelsList(filters = {}) {
  try {
    const res = await apiFetch('/api/content/hierarchy');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.hierarchy)) {
        const novels = [];
        for (const cat of data.hierarchy) {
          for (const sub of (cat.subcategories || [])) {
            for (const art of (sub.articles || [])) {
              const itemLink = '#thread?id=' + encodeURIComponent(art.uniqueSlug || art.id);
              novels.push({
                id: art.id,
                uniqueSlug: art.uniqueSlug || String(art.id),
                title: art.title,
                cover: art.coverImage || '/images/logo.png',
                author: art.authorName || 'Rudhra Prarthana',
                category: cat.title,
                genre: sub.title,
                views: art.viewsCount || 0,
                commentsCount: art.commentsCount || 0,
                readLink: itemLink,
                link: itemLink
              });
            }
          }
        }
        return novels;
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching novels list:', err.message);
  }
  return [];
}

/**
 * Get single novel/story by ID (includes articles and chapters)
 */
export async function getNovelById(id) {
  if (!id) return null;
  try {
    const res = await apiFetch('/api/content/articles/' + encodeURIComponent(id));
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.article) {
        const art = data.article;
        return {
          id: art.id,
          title: art.title,
          cover: art.coverImage || '/images/logo.png',
          author: art.authorName || 'Rudhra Prarthana',
          category: art.mainCategoryTitle || 'Novel',
          chapters: (art.children || []).map(ch => ({
            id: ch.id,
            num: ch.id,
            chapterNum: ch.id,
            episodeNumber: ch.id,
            title: ch.title,
            publishedAt: ch.publishedAt
          }))
        };
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching novel by ID:', err.message);
  }
  return null;
}

/**
 * Fetch formatted Sidebar Posts (Latest & Trending) from the MySQL API
 */
export async function getSidebarPosts() {
  try {
    const res = await apiFetch('/api/forum/posts');
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.latest || data.trending)) {
        return {
          latest: data.latest || [],
          trending: data.trending || []
        };
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching sidebar posts:', err.message);
  }

  return { latest: [], trending: [] };
}

/**
 * Fetch Forum Categories from the MySQL API
 */
export async function getForumCategories() {
  try {
    const res = await apiFetch('/api/forum/categories');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        return data.categories;
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching forum categories:', err.message);
  }

  return [];
}

/**
 * Fetch forum topics from the MySQL API
 */
export async function getForumTopics(categoryId = null) {
  try {
    const url = categoryId 
      ? `/api/forum/topics?category=${encodeURIComponent(categoryId)}`
      : '/api/forum/topics';
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.topics)) {
        return data.topics;
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching forum topics:', err.message);
  }

  return [];
}

/**
 * Fetch a single forum topic by ID from the MySQL API
 */
export async function getForumTopicById(topicId) {
  try {
    const res = await apiFetch(`/api/forum/topics/${encodeURIComponent(topicId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.topic) {
        return data.topic;
      }
    }
  } catch (err) {
    console.warn(`[Content-Service] Error fetching topic ${topicId}:`, err.message);
  }

  return null;
}

/**
 * Create a new forum topic in the MySQL API
 */
export async function createForumTopic({ categoryId, title, content }) {
  try {
    const res = await apiFetch('/api/forum/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, title, content })
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Submit a reply to a forum topic in the MySQL API
 */
export async function addForumReply(topicId, content) {
  try {
    const res = await apiFetch(`/api/forum/topics/${encodeURIComponent(topicId)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch members directory from the MySQL API
 */
export async function getMembersList() {
  try {
    const res = await apiFetch('/api/members');
    if (res.ok) {
      const data = await res.json();
      if (data.members && Array.isArray(data.members)) {
        return { success: true, members: data.members };
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching members list:', err.message);
  }

  return { success: false, members: [] };
}

/**
 * Fetch single member profile from the MySQL API
 */
export async function getMemberProfile(memberParam) {
  try {
    const res = await apiFetch(`/api/members/${encodeURIComponent(memberParam)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.member) return data.member;
    }
  } catch (err) {
    console.warn(`[Content-Service] Error fetching member profile ${memberParam}:`, err.message);
  }

  return null;
}

/**
 * Fetch user notifications from the MySQL API
 */
export async function getNotifications() {
  try {
    const res = await apiFetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      if (data.notifications && Array.isArray(data.notifications)) {
        return data.notifications;
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching notifications:', err.message);
  }

  return [];
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(id) {
  try {
    const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  try {
    const res = await apiFetch('/api/notifications/read-all', { method: 'POST' });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch unread notification count
 */
export async function getUnreadNotificationsCount() {
  try {
    const res = await apiFetch('/api/notifications/unread-count');
    if (res.ok) {
      const data = await res.json();
      return Number(data.count || 0);
    }
  } catch {}
  return 0;
}

/**
 * Fetch VAPID Public Key for Web Push subscription
 */
export async function getVapidPublicKey() {
  try {
    const res = await apiFetch('/api/notifications/vapid-public-key');
    if (res.ok) {
      const data = await res.json();
      return data.publicKey || null;
    }
  } catch {}
  return null;
}

/**
 * Send Web Push subscription to backend
 */
export async function subscribePush(subscription) {
  try {
    const res = await apiFetch('/api/notifications/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription })
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Unregister Web Push subscription from backend
 */
export async function unsubscribePush(endpoint) {
  try {
    const res = await apiFetch('/api/notifications/push-unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Notification Preferences
 */
export async function getNotificationPreferences() {
  try {
    const res = await apiFetch('/api/notifications/preferences');
    if (res.ok) {
      const data = await res.json();
      return data.preferences || null;
    }
  } catch {}
  return null;
}

/**
 * Update Notification Preferences
 */
export async function updateNotificationPreferences(preferences) {
  try {
    const res = await apiFetch('/api/notifications/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences)
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch reading progress for a novel
 */
export async function getReadingProgress(novelId = null) {
  return [];
}

/**
 * Save reading progress for a novel chapter
 */
export async function saveReadingProgress(novelId, chapterNum, percentage = 100) {
  return { success: true };
}

/**
 * Get likes for a target
 */
export async function getLikes(targetType, targetId) {
  try {
    const res = await apiFetch(`/api/likes?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching likes:', err.message);
  }

  return { success: false, likesCount: 0, userLiked: false };
}

/**
 * Toggle like for a target
 */
export async function toggleLike(targetType, targetId) {
  try {
    const res = await apiFetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId })
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch published audio novels list for readers
 */
export async function getAudioNovelsList(filters = {}) {
  return [];
}

/**
 * Fetch a single audio novel by ID or slug with multi-part episodes
 */
export async function getAudioNovelDetail(idOrSlug) {
  return null;
}

/**
 * Fetch admin list of all audio novels (drafts + published)
 */
export async function getAdminAudioNovels(filters = {}) {
  return [];
}

/**
 * Create an audio novel (admin)
 */
export async function createAdminAudioNovel(audioData) {
  return { success: false, error: 'Audio Novels module removed' };
}

/**
 * Update an audio novel (admin)
 */
export async function updateAdminAudioNovel(id, audioData) {
  return { success: false, error: 'Audio Novels module removed' };
}

/**
 * Delete an audio novel (admin)
 */
export async function deleteAdminAudioNovel(id) {
  return { success: false, error: 'Audio Novels module removed' };
}

/**
 * Retrieve or generate persistent privacy-conscious guest visitor identifier
 * Stored in localStorage and cookie for long-term unique guest tracking
 */
export function getPersistentVisitorId() {
  if (typeof window === 'undefined') return null;
  let visitorId = localStorage.getItem('rp_visitor_id');
  if (!visitorId) {
    const match = document.cookie.match(/(?:^|;\s*)rp_visitor_id=([^;]*)/);
    if (match) visitorId = decodeURIComponent(match[1]);
  }
  if (!visitorId || !/^[a-zA-Z0-9_-]{10,64}$/.test(visitorId)) {
    visitorId = 'gst_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem('rp_visitor_id', visitorId);
      document.cookie = `rp_visitor_id=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}
  }
  return visitorId;
}

export function getGuestSessionId() {
  return getPersistentVisitorId();
}

/**
 * Ping backend presence heartbeat with guestId or auth token
 */
export async function pingPresenceHeartbeat() {
  try {
    const guestId = getPersistentVisitorId();
    const token = localStorage.getItem('rp_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (guestId) headers['X-Guest-Session-Id'] = guestId;

    const res = await apiFetch('/api/presence/ping', {
      method: 'POST',
      headers,
      body: JSON.stringify({ guestId })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Presence] Heartbeat error:', err.message);
  }
  return null;
}

/**
 * Fetch current online presence summary from MySQL
 */
export async function getOnlinePresence() {
  try {
    const token = localStorage.getItem('rp_auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await apiFetch('/api/presence', { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Presence] Fetch error:', err.message);
  }
  return null;
}

/**
 * Fetch live forum statistics (Total Members, Total Replies, Total Unique Guests) from MySQL
 */
export async function getForumLiveStats() {
  try {
    const visitorId = getPersistentVisitorId();
    const token = localStorage.getItem('rp_auth_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (visitorId) headers['X-Guest-Session-Id'] = visitorId;

    const url = visitorId ? `/api/forum/stats?visitorId=${encodeURIComponent(visitorId)}` : '/api/forum/stats';
    const res = await apiFetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.stats) {
        if (data.visitorId && !localStorage.getItem('rp_visitor_id')) {
          try {
            localStorage.setItem('rp_visitor_id', data.visitorId);
            document.cookie = `rp_visitor_id=${data.visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`;
          } catch {}
        }
        return data.stats;
      }
    }
  } catch (err) {
    console.warn('[Content-Service] Error fetching forum live stats:', err.message);
  }

  return { totalMembers: 0, totalReplies: 0, totalGuests: 0 };
}

/**
 * Start or resume a verified reading session for the logged-in member
 */
export async function startReadingSession(novelId, chapterNum, tabId = null) {
  return { success: true };
}

/**
 * Send heartbeat for active reading session
 */
export async function heartbeatReadingSession(novelId, chapterNum, tabId = null, secondsElapsed = 25) {
  return { success: true };
}

/**
 * Pause or stop a reading session
 */
export async function pauseOrStopReadingSession(novelId = null, chapterNum = null) {
  return { success: true };
}

/**
 * Fetch a member's reading activity (privacy protected)
 */
export async function getMemberReadingActivity(memberIdOrUsername) {
  return { readingTimeFormatted: '0 min', lastReadNovel: null };
}
