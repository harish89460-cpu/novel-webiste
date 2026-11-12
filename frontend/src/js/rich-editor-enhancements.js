// ==========================================================================
// Universal Rich-Text Editor Enhancements: Smart Link Previews & @Member Tagging
// Rudhra Prarthana Novels — Global Client Subsystem
// ==========================================================================

import { escapeHtml } from './comments.js';

let activePopover = null;
let activeEditor = null;
let membersCache = null;
let membersCacheTime = 0;

/**
 * Fetch and cache registered members for @mention autocomplete
 */
export async function getMembersForMention(query = '') {
  const now = Date.now();
  const cleanQ = (query || '').toLowerCase().trim();

  // Refresh cache if older than 60 seconds
  if (!membersCache || (now - membersCacheTime > 60000)) {
    try {
      const res = await fetch('/api/members/mentions');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.members)) {
          membersCache = data.members;
          membersCacheTime = now;
        }
      }
    } catch {
      // Fallback: try /api/members if /api/members/mentions not ready
      try {
        const res2 = await fetch('/api/members');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.success && Array.isArray(data2.members)) {
            membersCache = data2.members;
            membersCacheTime = now;
          }
        }
      } catch {}
    }
  }

  const list = membersCache || [];
  if (!cleanQ) {
    return list.slice(0, 8);
  }

  // Filter and rank matches
  return list.filter(m => {
    const uname = (m.username || '').toLowerCase();
    const dname = (m.displayName || '').toLowerCase();
    return uname.includes(cleanQ) || dname.includes(cleanQ);
  }).sort((a, b) => {
    const aU = (a.username || '').toLowerCase();
    const bU = (b.username || '').toLowerCase();
    if (aU.startsWith(cleanQ) && !bU.startsWith(cleanQ)) return -1;
    if (!aU.startsWith(cleanQ) && bU.startsWith(cleanQ)) return 1;
    return aU.localeCompare(bU);
  }).slice(0, 8);
}

/**
 * Extract YouTube Video ID from any URL or string
 */
export function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const str = rawUrl.trim();

  // 1. youtu.be/VIDEO_ID
  const m1 = str.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (m1) return m1[1];

  // 2. youtube.com/watch?v=VIDEO_ID or &v=VIDEO_ID
  const m2 = str.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/watch\?[^"'\s<>]*\bv=([a-zA-Z0-9_-]{11})/i);
  if (m2) return m2[1];

  // 3. youtube.com/embed/VIDEO_ID or youtube-nocookie.com/embed/VIDEO_ID
  const m3 = str.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (m3) return m3[1];

  // 4. youtube.com/shorts/VIDEO_ID or /live/VIDEO_ID or /v/VIDEO_ID
  const m4 = str.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/(?:shorts|live|v)\/([a-zA-Z0-9_-]{11})/i);
  if (m4) return m4[1];

  return null;
}

/**
 * Render responsive YouTube embed card
 */
export function renderYouTubeEmbedCard(videoId, originalUrl = '') {
  const safeId = escapeHtml(videoId);
  const watchUrl = originalUrl ? escapeHtml(originalUrl) : `https://www.youtube.com/watch?v=${safeId}`;
  return `
    <div class="rp-embed-card rp-embed-video-card" data-embed-type="youtube" data-video-id="${safeId}">
      <div class="rp-embed-video-wrap">
        <iframe 
          src="https://www.youtube-nocookie.com/embed/${safeId}" 
          title="YouTube video player"
          loading="lazy"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerpolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowfullscreen
          class="rp-embed-iframe">
        </iframe>
      </div>
      <div class="rp-embed-meta-bar">
        <span class="rp-embed-provider-badge youtube">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          YouTube Video
        </span>
        <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="rp-embed-external-link" title="Open in YouTube">
          Watch on YouTube ↗
        </a>
      </div>
    </div>
  `;
}

/**
 * Classify URL and extract embed parameters
 */
export function parseSmartUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. YouTube formats:
    // - youtube.com/watch?v=VIDEO_ID
    // - youtu.be/VIDEO_ID
    // - youtube.com/shorts/VIDEO_ID
    // - youtube.com/embed/VIDEO_ID
    // - m.youtube.com/watch?v=VIDEO_ID
    const ytHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
    if (ytHosts.includes(host)) {
      if (pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return { type: 'youtube', videoId: v, url, host };
        }
      } else if (pathname.startsWith('/shorts/') || pathname.startsWith('/embed/')) {
        const parts = pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return { type: 'youtube', videoId: id, url, host };
        }
      }
    } else if (host === 'youtu.be') {
      const id = pathname.slice(1).split('?')[0].split('/')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return { type: 'youtube', videoId: id, url, host };
      }
    }

    // 2. Vimeo:
    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
      const match = pathname.match(/(?:\/video\/|\/)(\d+)/);
      if (match) {
        return { type: 'vimeo', videoId: match[1], url, host };
      }
    }

    // 3. Direct Image:
    if (/\.(jpe?g|png|gif|webp|svg)($|\?)/i.test(pathname)) {
      return { type: 'image', url, host };
    }

    // 4. Other safe web URL:
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { type: 'link', url, host };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Render single embed element (YouTube video player, Image, or Website card)
 */
export function renderSmartEmbed(item, instanceId = 'preview') {
  if (!item) return '';

  if (item.type === 'youtube') {
    return `
      <div class="rp-embed-card rp-embed-video-card" data-embed-type="youtube">
        <div class="rp-embed-video-wrap">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${escapeHtml(item.videoId)}" 
            title="YouTube video player"
            loading="lazy"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerpolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allowfullscreen
            class="rp-embed-iframe">
          </iframe>
        </div>
        <div class="rp-embed-meta-bar">
          <span class="rp-embed-provider-badge youtube">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            YouTube Video
          </span>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-embed-external-link">
            Watch on YouTube ↗
          </a>
        </div>
      </div>
    `;
  }

  if (item.type === 'vimeo') {
    return `
      <div class="rp-embed-card rp-embed-video-card" data-embed-type="vimeo">
        <div class="rp-embed-video-wrap">
          <iframe 
            src="https://player.vimeo.com/video/${escapeHtml(item.videoId)}" 
            title="Vimeo video player"
            loading="lazy"
            frameborder="0"
            allow="autoplay; fullscreen; picture-in-picture" 
            referrerpolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allowfullscreen
            class="rp-embed-iframe">
          </iframe>
        </div>
        <div class="rp-embed-meta-bar">
          <span class="rp-embed-provider-badge vimeo">Vimeo</span>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-embed-external-link">
            Watch on Vimeo ↗
          </a>
        </div>
      </div>
    `;
  }

  if (item.type === 'image') {
    return `
      <div class="rp-embed-card rp-embed-image-card">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-embed-img-link" title="Click to view full image in new tab">
          <img src="${escapeHtml(item.url)}" alt="Shared image preview" class="rp-embed-img" loading="lazy" onerror="this.closest('.rp-embed-image-card').style.display='none';" />
        </a>
      </div>
    `;
  }

  if (item.type === 'link') {
    const cardId = `lp-card-${instanceId}-${Math.random().toString(36).slice(2, 7)}`;
    return `
      <div class="rp-embed-card rp-embed-link-card" id="${cardId}" data-url="${escapeHtml(item.url)}">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-link-preview-box">
          <div class="rp-link-preview-details">
            <div class="rp-link-preview-host">
              <span class="rp-link-preview-globe">🌐</span>
              <span>${escapeHtml(item.host)}</span>
            </div>
            <div class="rp-link-preview-title">${escapeHtml(item.host)}</div>
            <div class="rp-link-preview-desc" style="display:none;"></div>
            <div class="rp-link-preview-bottom">
              <span class="rp-link-preview-url-text">${escapeHtml(item.url)}</span>
              <span class="rp-link-preview-arrow">↗</span>
            </div>
          </div>
        </a>
      </div>
    `;
  }

  return '';
}

/**
 * Client cache for OpenGraph metadata
 */
const metadataCache = new Map();

/**
 * Hydrate any link preview cards inside a container with server OpenGraph data
 */
export async function hydrateLinkPreviewCards(root = document) {
  if (!root) return;
  const cards = root.querySelectorAll('.rp-embed-link-card[data-url]');
  cards.forEach(async (card) => {
    const url = card.getAttribute('data-url');
    if (!url) return;

    if (metadataCache.has(url)) {
      populateMetadata(card, metadataCache.get(url));
      return;
    }

    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          metadataCache.set(url, data);
          populateMetadata(card, data);
        }
      }
    } catch {}
  });
}

function populateMetadata(card, data) {
  if (!card || !data) return;
  const linkBox = card.querySelector('.rp-link-preview-box');
  if (!linkBox) return;

  const titleEl = card.querySelector('.rp-link-preview-title');
  const descEl = card.querySelector('.rp-link-preview-desc');
  const hostEl = card.querySelector('.rp-link-preview-host span:last-child');

  if (data.title && titleEl) titleEl.textContent = data.title;
  if (data.siteName && hostEl) hostEl.textContent = data.siteName;
  if (data.description && descEl) {
    descEl.textContent = data.description;
    descEl.style.display = '-webkit-box';
  }

  if (data.image && !card.querySelector('.rp-link-preview-thumb-wrap')) {
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'rp-link-preview-thumb-wrap';
    const img = document.createElement('img');
    img.className = 'rp-link-preview-thumb';
    img.src = data.image;
    img.alt = data.title || 'Preview thumbnail';
    img.loading = 'lazy';
    img.onerror = () => thumbWrap.remove();
    thumbWrap.appendChild(img);
    linkBox.prepend(thumbWrap);
    linkBox.classList.add('has-thumb');
  }
}

/**
 * Universal content parser & renderer for Novel Viewer, Thread pages, and Previews.
 * Embeds YouTube videos directly, transforms standalone web links to preview cards,
 * ensures in-paragraph links are clickable and open safely in a new tab,
 * and preserves rich text formatting.
 */
export function renderRichArticleContent(rawContent, options = {}) {
  if (!rawContent || typeof rawContent !== 'string') return '';
  let content = rawContent.trim();
  if (!content) return '';

  // 1. If plain text without block tags, wrap paragraphs in <p>
  const hasBlockTags = /<(?:p|div|h[1-6]|blockquote|pre|ul|ol|table|section|article)\b/i.test(content);
  if (!hasBlockTags) {
    content = content
      .split(/\r?\n\r?\n+/)
      .filter(Boolean)
      .map(para => `<p>${para.replace(/\r?\n/g, '<br>')}</p>`)
      .join('');
  }

  // 2. Parse using DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const body = doc.body;

  // Track processed video IDs in this article to avoid duplicate embedded players for the same video in one block
  const processedVideoIds = new Set();

  // Helper to test if an element contains only a URL or whitespace
  const isOnlyUrl = (el, url) => {
    if (!el) return false;
    const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
    const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();
    const cleanText = text.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();
    return cleanText === cleanUrl || cleanText === '';
  };

  // 3. Process existing <a> tags
  const anchors = Array.from(body.querySelectorAll('a[href]'));
  for (const a of anchors) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href) continue;

    // A. Check if internal hash or route
    if (href.startsWith('#') || href.startsWith('/#')) {
      a.setAttribute('target', '_self');
      continue;
    }

    // Ensure external links have safe attributes and styling
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    if (!a.classList.contains('rp-mention-tag')) {
      a.classList.add('reader-inline-link');
    }

    // B. Check if href is YouTube URL
    const ytId = extractYouTubeVideoId(href);
    if (ytId) {
      const parent = a.parentElement;
      const isSoloInParent = parent && (parent.tagName.toLowerCase() === 'p' || parent.tagName.toLowerCase() === 'div') && isOnlyUrl(parent, href);

      if (isSoloInParent && !processedVideoIds.has(ytId)) {
        processedVideoIds.add(ytId);
        const cardWrapper = doc.createElement('div');
        cardWrapper.innerHTML = renderYouTubeEmbedCard(ytId, href);
        const newCard = cardWrapper.firstElementChild;
        if (newCard && parent.parentNode) {
          parent.replaceWith(newCard);
        }
      } else if (!processedVideoIds.has(ytId)) {
        processedVideoIds.add(ytId);
        // Anchor with custom text inside paragraph: preserve link and insert embed card right after paragraph
        const cardWrapper = doc.createElement('div');
        cardWrapper.innerHTML = renderYouTubeEmbedCard(ytId, href);
        const newCard = cardWrapper.firstElementChild;
        if (newCard) {
          if (parent && parent.parentNode) {
            parent.after(newCard);
          } else if (a.parentNode) {
            a.after(newCard);
          }
        }
      }
      continue;
    }

    // C. Non-YouTube external link:
    // If standalone in its parent paragraph, add clickable link preview card
    const parent = a.parentElement;
    const isSolo = parent && (parent.tagName.toLowerCase() === 'p' || parent.tagName.toLowerCase() === 'div') && isOnlyUrl(parent, href);
    if (isSolo && /^https?:\/\//i.test(href)) {
      try {
        const parsed = new URL(href);
        const cardWrapper = doc.createElement('div');
        cardWrapper.innerHTML = renderSmartEmbed({ type: 'link', url: href, host: parsed.hostname });
        const newCard = cardWrapper.firstElementChild;
        if (newCard && parent.parentNode) {
          parent.replaceWith(newCard);
        }
      } catch {}
    }
  }

  // 4. Process text nodes for raw URLs (standalone or in-sentence)
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
  const textNodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip if inside <a>, <script>, <style>, <iframe>, or .rp-embed-card
    if (node.parentElement && (
      node.parentElement.closest('a') ||
      node.parentElement.closest('script') ||
      node.parentElement.closest('style') ||
      node.parentElement.closest('iframe') ||
      node.parentElement.closest('.rp-embed-card')
    )) {
      continue;
    }
    if (node.nodeValue && /(?:https?:\/\/|www\.)[^\s<>"']+/i.test(node.nodeValue)) {
      textNodesToProcess.push(node);
    }
  }

  for (const tNode of textNodesToProcess) {
    const parent = tNode.parentElement;
    if (!parent) continue;

    const val = tNode.nodeValue;
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<>"']*)/gi;
    let match;
    let lastIdx = 0;
    const fragment = doc.createDocumentFragment();
    let hasReplaced = false;

    // Check if the entire parent is solo URL
    const isSoloText = parent && (parent.tagName.toLowerCase() === 'p' || parent.tagName.toLowerCase() === 'div') && parent.childNodes.length === 1;

    while ((match = urlRegex.exec(val)) !== null) {
      hasReplaced = true;
      const textBefore = val.slice(lastIdx, match.index);
      if (textBefore) fragment.appendChild(doc.createTextNode(textBefore));

      let matchedUrl = match[0];
      const fullUrl = /^https?:\/\//i.test(matchedUrl) ? matchedUrl : 'https://' + matchedUrl;
      const ytId = extractYouTubeVideoId(fullUrl);

      if (ytId && isSoloText && !processedVideoIds.has(ytId)) {
        processedVideoIds.add(ytId);
        const cardWrapper = doc.createElement('div');
        cardWrapper.innerHTML = renderYouTubeEmbedCard(ytId, fullUrl);
        const newCard = cardWrapper.firstElementChild;
        if (newCard && parent.parentNode) {
          parent.replaceWith(newCard);
          fragment.textContent = '';
        }
        break;
      } else if (ytId) {
        const link = doc.createElement('a');
        link.href = fullUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'reader-inline-link';
        link.textContent = matchedUrl;
        fragment.appendChild(link);

        if (!processedVideoIds.has(ytId)) {
          processedVideoIds.add(ytId);
          const cardWrapper = doc.createElement('div');
          cardWrapper.innerHTML = renderYouTubeEmbedCard(ytId, fullUrl);
          const newCard = cardWrapper.firstElementChild;
          if (newCard && parent && parent.parentNode) {
            parent.after(newCard);
          }
        }
      } else {
        // Other website URL
        if (isSoloText) {
          try {
            const parsed = new URL(fullUrl);
            const cardWrapper = doc.createElement('div');
            cardWrapper.innerHTML = renderSmartEmbed({ type: 'link', url: fullUrl, host: parsed.hostname });
            const newCard = cardWrapper.firstElementChild;
            if (newCard && parent.parentNode) {
              parent.replaceWith(newCard);
              fragment.textContent = '';
              break;
            }
          } catch {}
        }

        const link = doc.createElement('a');
        link.href = fullUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'reader-inline-link';
        link.textContent = matchedUrl;
        fragment.appendChild(link);
      }
      lastIdx = urlRegex.lastIndex;
    }

    if (hasReplaced && fragment.childNodes.length > 0) {
      const rest = val.slice(lastIdx);
      if (rest) fragment.appendChild(doc.createTextNode(rest));
      if (tNode.parentNode) {
        parent.replaceChild(fragment, tNode);
      }
    }
  }

  // 5. Transform existing standalone iframes to responsive wrapper
  body.querySelectorAll('iframe').forEach(iframe => {
    if (!iframe.closest('.rp-embed-video-wrap')) {
      const src = iframe.getAttribute('src') || '';
      const ytId = extractYouTubeVideoId(src);
      if (ytId) {
        const cardWrapper = doc.createElement('div');
        cardWrapper.innerHTML = renderYouTubeEmbedCard(ytId, src);
        const newCard = cardWrapper.firstElementChild;
        if (newCard && iframe.parentNode) {
          iframe.replaceWith(newCard);
        }
      } else {
        iframe.classList.add('rp-embed-iframe');
        const wrap = doc.createElement('div');
        wrap.className = 'rp-embed-video-wrap';
        if (iframe.parentNode) {
          iframe.parentNode.insertBefore(wrap, iframe);
          wrap.appendChild(iframe);
        }
      }
    }
  });

  return body.innerHTML;
}

/**
 * Transform text/HTML: safely convert @username and links into clickable, styled elements
 */
export function formatRichContent(content) {
  if (!content || typeof content !== 'string') return '';

  let html = content;

  // 1. Preserve existing <a class="rp-mention-tag" ...> or convert raw @username into clickable tags
  // Regex matches @username when not already inside an <a> tag
  html = html.replace(/(^|[\s>(])@([a-zA-Z0-9_]{3,30})/g, (match, prefix, uname) => {
    return `${prefix}<a href="#member?id=${encodeURIComponent(uname)}" class="rp-mention-tag" data-username="${uname}">@${uname}</a>`;
  });

  // 2. Ensure all external links have target="_blank" rel="noopener noreferrer"
  html = html.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["']([^>]*)>/gi, (match, href, rest) => {
    const cleanRest = rest.replace(/target=["'][^"']*["']/gi, '').replace(/rel=["'][^"']*["']/gi, '');
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="rp-comment-link"${cleanRest}>`;
  });

  return html;
}

/**
 * Close any active mention popover
 */
export function closeMentionPopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

/**
 * Universal Smart Editor Attacher:
 * Provides @Member Tagging & Real-Time Paste Link Detection for ANY Contenteditable or Textarea
 */
export function setupSmartEditor(target, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el || el._rp_smart_editor_attached) return;
  el._rp_smart_editor_attached = true;

  const isContentEditable = el.getAttribute('contenteditable') === 'true';
  const editorId = el.id || `editor-${Math.random().toString(36).slice(2, 7)}`;

  // Find or create preview tray container
  let previewTray = null;
  if (options.previewTray) {
    previewTray = typeof options.previewTray === 'string' ? document.querySelector(options.previewTray) : options.previewTray;
  }
  if (!previewTray) {
    const parent = el.closest('.rp-rich-editor-wrap, .dm-input-box, .thread-composer-box, .novel-editor-surface-wrap, .editor-canvas-wrap, .writer-editor-body') || el.parentElement;
    if (parent) {
      previewTray = parent.querySelector('.rp-editor-preview-tray');
      if (!previewTray) {
        previewTray = document.createElement('div');
        previewTray.className = 'rp-editor-preview-tray';
        previewTray.style.display = 'none';
        // Insert right below the editor or above submit button
        if (el.nextSibling) {
          parent.insertBefore(previewTray, el.nextSibling);
        } else {
          parent.appendChild(previewTray);
        }
      }
    }
  }

  let mentionState = {
    active: false,
    query: '',
    startIndex: -1,
    selectedIndex: 0,
    matches: []
  };

  // --------------------------------------------------------------------------
  // A. REAL-TIME LINK DETECTION ON PASTE
  // --------------------------------------------------------------------------
  el.addEventListener('paste', async (e) => {
    const pastedText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (!pastedText) return;

    const urlRegex = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/gi;
    const matches = pastedText.match(urlRegex);

    if (matches && matches.length > 0) {
      const firstUrl = matches[0];
      const embedInfo = parseSmartUrl(firstUrl);

      if (embedInfo && previewTray) {
        previewTray.style.display = 'flex';
        previewTray.innerHTML = `
          <div class="rp-editor-preview-tray-header">
            <span>🔗 Attached Link Preview</span>
            <button type="button" class="rp-editor-preview-tray-dismiss" title="Dismiss Preview">✕ Remove Preview</button>
          </div>
          <div class="rp-editor-preview-tray-body">
            ${renderSmartEmbed(embedInfo, editorId)}
          </div>
        `;

        const dismissBtn = previewTray.querySelector('.rp-editor-preview-tray-dismiss');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            previewTray.style.display = 'none';
            previewTray.innerHTML = '';
          });
        }

        // Hydrate web link previews
        hydrateLinkPreviewCards(previewTray);
      }
    }
  });

  // --------------------------------------------------------------------------
  // B. @MEMBER TAGGING AUTOCOMPLETE (CONTENTEDITABLE & TEXTAREA)
  // --------------------------------------------------------------------------

  function getCaretCoordinates() {
    if (isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(false);
      let rect = range.getBoundingClientRect();

      // Fallback if zero rect
      if (rect.width === 0 && rect.height === 0) {
        const span = document.createElement('span');
        span.appendChild(document.createTextNode('\u200b'));
        range.insertNode(span);
        rect = span.getBoundingClientRect();
        span.parentNode.removeChild(span);
      }

      return {
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(12, Math.min(rect.left + window.scrollX, window.innerWidth - 305))
      };
    } else {
      const rect = el.getBoundingClientRect();
      return {
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(12, Math.min(rect.left + window.scrollX, window.innerWidth - 305))
      };
    }
  }

  function getQueryBeforeCaret() {
    if (isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return null;

      const text = node.textContent.slice(0, range.startOffset);
      const atIdx = text.lastIndexOf('@');
      if (atIdx === -1) return null;

      // Ensure @ is at start of word or line
      if (atIdx > 0 && !/[\s\(\[\{]/.test(text[atIdx - 1])) {
        return null;
      }

      const q = text.slice(atIdx + 1);
      // Stop if whitespace exists in query
      if (/\s/.test(q)) return null;

      return { query: q, atIndex: atIdx, node };
    } else {
      const pos = el.selectionStart || 0;
      const text = el.value.slice(0, pos);
      const atIdx = text.lastIndexOf('@');
      if (atIdx === -1) return null;

      if (atIdx > 0 && !/[\s\(\[\{]/.test(text[atIdx - 1])) {
        return null;
      }

      const q = text.slice(atIdx + 1);
      if (/\s/.test(q)) return null;

      return { query: q, atIndex: atIdx, pos };
    }
  }

  async function updateMentionPopover() {
    const info = getQueryBeforeCaret();
    if (!info) {
      closeMentionPopover();
      mentionState.active = false;
      return;
    }

    mentionState.active = true;
    mentionState.query = info.query;
    mentionState.info = info;

    const matches = await getMembersForMention(info.query);
    mentionState.matches = matches;
    mentionState.selectedIndex = 0;

    if (matches.length === 0) {
      if (activePopover) closeMentionPopover();
      return;
    }

    renderMentionPopover(matches);
  }

  function renderMentionPopover(matches) {
    if (!activePopover) {
      activePopover = document.createElement('div');
      activePopover.className = 'rp-mention-popover';
      document.body.appendChild(activePopover);

      // Prevent popover clicks from stealing editor focus
      activePopover.addEventListener('mousedown', (e) => e.preventDefault());
    }

    const coords = getCaretCoordinates();
    if (coords) {
      activePopover.style.top = `${coords.top}px`;
      activePopover.style.left = `${coords.left}px`;
    }

    activePopover.innerHTML = `
      <div class="rp-mention-popover-header">
        <span>Mention Member</span>
        <span>${matches.length} found</span>
      </div>
      ${matches.map((m, idx) => {
        const isSelected = idx === mentionState.selectedIndex;
        const role = (m.role || 'Member').toLowerCase();
        let roleBadge = `<span class="rp-mention-role-badge ${role}">${escapeHtml(m.role || 'Member')}</span>`;
        return `
          <div class="rp-mention-item ${isSelected ? 'active' : ''}" data-index="${idx}">
            <img src="${escapeHtml(m.avatar || '/profile.png')}" class="rp-mention-avatar" alt="${escapeHtml(m.username)}" onerror="this.src='/profile.png';">
            <div class="rp-mention-info">
              <span class="rp-mention-name">${escapeHtml(m.displayName || m.username)}</span>
              <span class="rp-mention-username">@${escapeHtml(m.username)}</span>
            </div>
            ${roleBadge}
          </div>
        `;
      }).join('')}
    `;

    // Click on suggestion
    activePopover.querySelectorAll('.rp-mention-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(item.getAttribute('data-index'), 10);
        selectMention(matches[idx]);
      });
    });
  }

  function selectMention(member) {
    if (!member) return;

    if (isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !mentionState.info) return;

      const node = mentionState.info.node;
      const atIdx = mentionState.info.atIndex;
      const text = node.textContent;
      const beforeAt = text.slice(0, atIdx);
      const afterCaret = text.slice(sel.getRangeAt(0).startOffset);

      // Create rich mention pill
      const mentionLink = document.createElement('a');
      mentionLink.href = `#member?id=${encodeURIComponent(member.id)}`;
      mentionLink.className = 'rp-mention-tag';
      mentionLink.setAttribute('data-user-id', String(member.id));
      mentionLink.setAttribute('data-username', member.username);
      mentionLink.setAttribute('contenteditable', 'false');
      mentionLink.textContent = `@${member.displayName || member.username}`;

      // Space after mention
      const spaceNode = document.createTextNode('\u00A0');

      node.textContent = beforeAt;
      const parent = node.parentNode;
      const nextSibling = node.nextSibling;

      parent.insertBefore(mentionLink, nextSibling);
      parent.insertBefore(spaceNode, mentionLink.nextSibling);

      if (afterCaret) {
        const afterNode = document.createTextNode(afterCaret);
        parent.insertBefore(afterNode, spaceNode.nextSibling);
      }

      // Move caret after the space
      const newRange = document.createRange();
      newRange.setStartAfter(spaceNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      el.focus();
    } else {
      if (!mentionState.info) return;
      const val = el.value;
      const atIdx = mentionState.info.atIndex;
      const pos = mentionState.info.pos;
      const beforeAt = val.slice(0, atIdx);
      const afterPos = val.slice(pos);

      const mentionText = `@${member.username} `;
      el.value = beforeAt + mentionText + afterPos;

      const newPos = beforeAt.length + mentionText.length;
      el.selectionStart = newPos;
      el.selectionEnd = newPos;
      el.focus();
    }

    closeMentionPopover();
    mentionState.active = false;

    // Trigger input event to update autosave / word counts
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Handle typing & popover keyboard navigation
  el.addEventListener('keydown', (e) => {
    if (!mentionState.active || !activePopover) {
      if (e.key === '@') {
        setTimeout(updateMentionPopover, 20);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionState.selectedIndex = (mentionState.selectedIndex + 1) % mentionState.matches.length;
      renderMentionPopover(mentionState.matches);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionState.selectedIndex = (mentionState.selectedIndex - 1 + mentionState.matches.length) % mentionState.matches.length;
      renderMentionPopover(mentionState.matches);
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionState.matches[mentionState.selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        selectMention(mentionState.matches[mentionState.selectedIndex]);
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionPopover();
      mentionState.active = false;
      return;
    }
  });

  el.addEventListener('input', () => {
    updateMentionPopover();
  });

  el.addEventListener('keyup', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
    updateMentionPopover();
  });

  el.addEventListener('blur', () => {
    setTimeout(() => {
      // Small timeout so clicks inside popover are registered before closing
      if (document.activeElement !== el) {
        closeMentionPopover();
        mentionState.active = false;
      }
    }, 200);
  });
}

/**
 * Global initialization: scan and enhance all rich text areas and comment boxes
 */
export function initAllRichEditors(root = document) {
  if (!root) return;

  const selectorList = [
    '.rp-rich-editor',
    '.thread-composer-content-area',
    '#tc-content-area',
    '#modal-edit-content',
    '#thread-content-input',
    '#novel-editor-surface',
    '#we-canvas',
    '#editor-surface',
    '#story-field-content',
    '.dm-editor-content',
    '#dm-editor-content',
    '#story-comment-input',
    '#topic-reply-input',
    '.rp-ig-edit-textarea'
  ];

  selectorList.forEach(sel => {
    root.querySelectorAll(sel).forEach(el => {
      setupSmartEditor(el);
    });
  });

  // Also hydrate any link previews rendered on the page
  hydrateLinkPreviewCards(root);
}

// Global click outside popover to close
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (activePopover && !activePopover.contains(e.target)) {
      closeMentionPopover();
    }
  });

  // Automatic observer for dynamic elements
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          initAllRichEditors(node);
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.setupSmartEditor = setupSmartEditor;
  window.initAllRichEditors = initAllRichEditors;
  window.parseSmartUrl = parseSmartUrl;
  window.renderSmartEmbed = renderSmartEmbed;
  window.formatRichContent = formatRichContent;
  window.extractYouTubeVideoId = extractYouTubeVideoId;
  window.renderYouTubeEmbedCard = renderYouTubeEmbedCard;
  window.renderRichArticleContent = renderRichArticleContent;
  window.hydrateLinkPreviewCards = hydrateLinkPreviewCards;
}

