// Novel & Chapter Comments and Emoji Reactions Client Module
// Rudhra Prarthana Novels — Live Database Integration & WordPress-Style Rich-Text Editor

import { t } from './i18n.js';
import { showToast } from './reader.js';
import { apiFetch } from './errors.js';
import { getAvatarUrl } from './app.js';

// The seven allowed episode reactions as requested: ❤️ Love, 👍 Like, 😂 Laugh, 😮 Surprise, 😍 Adore, 😢 Sad, and 😭 Cry
export const ALLOWED_EMOJIS = ['❤️', '👍', '😂', '😮', '😍', '😢', '😭'];

export const EMOJI_LABELS = {
  '❤️': 'Love',
  '👍': 'Like',
  '😂': 'Laugh',
  '😮': 'Surprise',
  '😍': 'Adore',
  '😢': 'Sad',
  '😭': 'Cry'
};

// In-memory cache for fast UI updates
const reactionsCache = {};
const commentsCache = {};

function escapeQuotes(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Auto-detect and wrap URLs within text into clean, safe <a> links
 */
export function autoLinkifyText(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/gi;
  let lastIdx = 0;
  let match;
  let result = '';

  while ((match = urlRegex.exec(text)) !== null) {
    const before = text.substring(lastIdx, match.index);
    result += escapeHtml(before).replace(/\n/g, '<br>');

    let rawUrl = match[0];
    let trailingPunct = '';
    const punctMatch = rawUrl.match(/[.,!?)]+$/);
    if (punctMatch) {
      trailingPunct = punctMatch[0];
      rawUrl = rawUrl.slice(0, -trailingPunct.length);
    }

    let href = rawUrl;
    if (!/^https?:\/\//i.test(href)) {
      href = 'https://' + href;
    }

    const cleanHref = escapeHtml(href);
    result += `<a href="${cleanHref}" target="_blank" rel="noopener noreferrer" class="rp-comment-link">${escapeHtml(rawUrl)}</a>${escapeHtml(trailingPunct)}`;
    lastIdx = match.index + match[0].length;
  }

  const remaining = text.substring(lastIdx);
  result += escapeHtml(remaining).replace(/\n/g, '<br>');
  return result;
}

/**
 * Scan an HTML fragment and ensure all raw text URLs (not already in <a>) are safely linkified
 */
export function ensureAllUrlsLinked(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  const urlRegex = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/i;
  for (const tNode of textNodes) {
    if (tNode.parentNode && tNode.parentNode.nodeName.toLowerCase() === 'a') {
      continue;
    }
    const txt = tNode.textContent;
    if (urlRegex.test(txt)) {
      const span = doc.createElement('span');
      span.innerHTML = autoLinkifyText(txt);
      tNode.parentNode.replaceChild(span, tNode);
    }
  }

  return doc.body.innerHTML;
}

/**
 * Parse a URL and classify its embed provider (YouTube, Vimeo, direct image, or external link)
 */
export function parseEmbedInfo(rawUrl) {
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
    // - https://www.youtube.com/watch?v=VIDEO_ID
    // - https://youtu.be/VIDEO_ID
    // - https://www.youtube.com/shorts/VIDEO_ID
    // - https://www.youtube.com/embed/VIDEO_ID
    // - https://m.youtube.com/watch?v=VIDEO_ID
    // - https://music.youtube.com/watch?v=VIDEO_ID
    const ytHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
    if (ytHosts.includes(host)) {
      if (pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return { type: 'youtube', videoId: v, url };
        }
      } else if (pathname.startsWith('/shorts/')) {
        const parts = pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return { type: 'youtube', videoId: id, url };
        }
      } else if (pathname.startsWith('/embed/')) {
        const parts = pathname.split('/');
        const id = parts[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return { type: 'youtube', videoId: id, url };
        }
      }
    } else if (host === 'youtu.be') {
      const id = pathname.slice(1).split('?')[0].split('/')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return { type: 'youtube', videoId: id, url };
      }
    }

    // 2. Vimeo: vimeo.com/DIGITS or player.vimeo.com/video/DIGITS
    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const match = pathname.match(/^\/(\d+)/);
      if (match) {
        return { type: 'vimeo', videoId: match[1], url };
      }
    } else if (host === 'player.vimeo.com') {
      const match = pathname.match(/^\/video\/(\d+)/);
      if (match) {
        return { type: 'vimeo', videoId: match[1], url };
      }
    }

    // 3. Direct safely-loadable image URL
    if (/\.(jpe?g|png|gif|webp|svg)($|\?)/i.test(pathname)) {
      return { type: 'image', url };
    }

    // 4. Other safe website URL
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { type: 'link', url, hostname: host };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract all unique URLs from comment HTML content and categorize them
 */
export function extractCommentEmbeds(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const urlsFound = [];
  const seen = new Set();

  const addUrl = (u) => {
    if (!u || typeof u !== 'string') return;
    const clean = u.trim();
    if (!clean) return;
    if (clean.startsWith('/uploads/') || clean.includes('/uploads/comments/')) return;
    if (/^(javascript|data|vbscript|file|about):/i.test(clean)) return;
    if (!seen.has(clean)) {
      seen.add(clean);
      urlsFound.push(clean);
    }
  };

  // 1. From <a> href attributes
  doc.querySelectorAll('a[href]').forEach(a => {
    addUrl(a.getAttribute('href'));
  });

  // 2. From text nodes in case any raw URLs are present
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
  let tNode;
  const rawUrlRegex = /(https?:\/\/[^\s<"'>]+)/gi;
  while ((tNode = walker.nextNode())) {
    let m;
    while ((m = rawUrlRegex.exec(tNode.textContent)) !== null) {
      addUrl(m[0]);
    }
  }

  // Parse embed info for each URL
  const embeds = [];
  for (const u of urlsFound) {
    const info = parseEmbedInfo(u);
    if (info) embeds.push(info);
  }

  return embeds;
}

/**
 * Render single embed HTML for video, image, or website preview card
 */
function renderSingleEmbed(item, commentId, index) {
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
            YouTube
          </span>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-embed-external-link" title="Open in YouTube">
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
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-embed-external-link" title="Open in Vimeo">
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
    return `
      <div class="rp-embed-card rp-embed-link-card" id="link-preview-${commentId}-${index}" data-url="${escapeHtml(item.url)}">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="rp-link-preview-box">
          <div class="rp-link-preview-details">
            <div class="rp-link-preview-host">
              <span class="rp-link-preview-globe">🌐</span>
              <span>${escapeHtml(item.hostname)}</span>
            </div>
            <div class="rp-link-preview-title" id="lp-title-${commentId}-${index}">${escapeHtml(item.hostname)}</div>
            <div class="rp-link-preview-desc" id="lp-desc-${commentId}-${index}" style="display:none;"></div>
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
 * Render all embeds for a given comment
 */
export function renderCommentEmbeds(content, commentId) {
  const embeds = extractCommentEmbeds(content);
  if (!embeds || embeds.length === 0) return '';

  return `
    <div class="rp-comment-embeds" id="comment-embeds-${commentId}">
      ${embeds.map((item, index) => renderSingleEmbed(item, commentId, index)).join('')}
    </div>
  `;
}

// In-memory client cache for website OpenGraph previews
const clientLinkMetadataCache = new Map();

/**
 * Fetch and hydrate link preview cards with server-retrieved OpenGraph metadata
 */
export async function hydrateLinkPreviews(containerEl = document) {
  if (!containerEl) return;
  const cards = containerEl.querySelectorAll('.rp-embed-link-card[data-url]');

  cards.forEach(async (card) => {
    const rawUrl = card.getAttribute('data-url');
    if (!rawUrl) return;

    if (clientLinkMetadataCache.has(rawUrl)) {
      applyMetadataToCard(card, clientLinkMetadataCache.get(rawUrl));
      return;
    }

    try {
      const res = await apiFetch(`/api/link-preview?url=${encodeURIComponent(rawUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          clientLinkMetadataCache.set(rawUrl, data);
          applyMetadataToCard(card, data);
        }
      }
    } catch {
      // Safe fallback card is already shown
    }
  });
}

function applyMetadataToCard(card, data) {
  if (!card || !data) return;
  const linkBox = card.querySelector('.rp-link-preview-box');
  if (!linkBox) return;

  const titleEl = card.querySelector('.rp-link-preview-title');
  const descEl = card.querySelector('.rp-link-preview-desc');
  const hostEl = card.querySelector('.rp-link-preview-host span:last-child');

  if (data.title && titleEl) {
    titleEl.textContent = data.title;
  }
  if (data.siteName && hostEl) {
    hostEl.textContent = data.siteName;
  }
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
 * Automatically linkify preceding word when typing in contenteditable editor
 */
function autoLinkifyCaretWord(editorId) {
  const sel = window.getSelection();
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!sel || !editor || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;
  if (node.parentElement && node.parentElement.closest('a')) return;

  const textBefore = node.textContent.slice(0, range.startOffset);
  const match = textBefore.match(/(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)$/);
  if (match) {
    const rawUrl = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + rawUrl.length;

    let href = rawUrl;
    if (!/^https?:\/\//i.test(href)) {
      href = 'https://' + href;
    }

    try {
      new URL(href);
    } catch {
      return;
    }

    const fullText = node.textContent;
    const beforePart = fullText.slice(0, startIndex);
    const afterPart = fullText.slice(endIndex);

    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'rp-comment-link';
    a.textContent = rawUrl;

    const parent = node.parentNode;
    const beforeNode = document.createTextNode(beforePart);
    const afterNode = document.createTextNode(afterPart || '\u00A0');

    parent.insertBefore(beforeNode, node);
    parent.insertBefore(a, node);
    parent.insertBefore(afterNode, node);
    parent.removeChild(node);

    const newRange = document.createRange();
    newRange.setStart(afterNode, 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    saveEditorRange(editorId);
  }
}

// Saved Selection Ranges for cursor preservation across toolbar controls
const editorRanges = {};

/**
 * Save current selection range inside a specific editor
 */
function saveEditorRange(editorId) {
  const sel = window.getSelection();
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!sel || !editor || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    editorRanges[editorId] = range.cloneRange();
  }
}

/**
 * Restore saved selection range in a specific editor
 */
function restoreEditorRange(editorId) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!editor) return;

  editor.focus({ preventScroll: true });
  const saved = editorRanges[editorId];
  if (saved) {
    const sel = window.getSelection();
    if (sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(saved);
      } catch (err) {
        console.warn('Could not restore editor range:', err);
      }
    }
  }
}

/**
 * Find if current cursor or selection is inside an anchor element in the editor
 */
function findActiveLink(editorId) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!editor) return null;
  const sel = window.getSelection();
  const range = editorRanges[editorId] || (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
  if (!range) return null;

  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node && node.closest) {
    const link = node.closest('a');
    if (link && editor.contains(link)) return link;
  }

  let ancestor = range.commonAncestorContainer;
  if (ancestor && ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;
  if (ancestor && ancestor.closest) {
    const link = ancestor.closest('a');
    if (link && editor.contains(link)) return link;
  }

  if (range.cloneContents) {
    const allLinks = editor.querySelectorAll('a');
    for (const l of allLinks) {
      if (range.intersectsNode && range.intersectsNode(l)) return l;
    }
  }

  return null;
}

/**
 * Validate and normalize hyperlink URL
 */
export function validateUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let url = input.trim();
  if (!url) return null;

  // Block dangerous schemes
  if (/^(javascript|data|vbscript|file|about):/i.test(url)) {
    return null;
  }

  // Prepend https:// if no protocol specified
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname;
    if (!host || (!host.includes('.') && host !== 'localhost')) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Render WordPress-Style Inline Link Popover Markup
 */
function renderLinkPopoverHtml(editorId) {
  return '';
}

/**
 * Render Compact Formatting Toolbar HTML for Comment or Reply Editor
 */
export function renderCommentToolbarHtml(editorId) {
  return `
    <div class="rp-comment-toolbar" id="rp-comment-toolbar-${editorId}" role="toolbar" aria-label="Comment formatting toolbar">
      <!-- Text Style -->
      <div class="rp-tb-group">
        <select class="rp-tb-select rp-tb-style-select" 
                onchange="applyTextStyle('${editorId}', this.value)" 
                title="Text Style" 
                aria-label="Text Style">
          <option value="p">Normal</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
      </div>

      <!-- Font Family -->
      <div class="rp-tb-group">
        <select class="rp-tb-select rp-tb-font-select" 
                onchange="applyFontFamily('${editorId}', this.value)" 
                title="Font Family" 
                aria-label="Font Family">
          <option value="inherit">Default Font</option>
          <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
          <option value="'Inter', sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Arial, sans-serif">Arial</option>
        </select>
      </div>

      <!-- Font Size -->
      <div class="rp-tb-group">
        <select class="rp-tb-select rp-tb-size-select" 
                onchange="applyFontSize('${editorId}', this.value)" 
                title="Font Size" 
                aria-label="Font Size">
          <option value="12px">Small</option>
          <option value="15px" selected>Normal</option>
          <option value="18px">Large</option>
          <option value="22px">Huge</option>
        </select>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Inline Styles: Bold, Italic, Underline, Strikethrough -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'bold');" title="Bold (Ctrl+B)" aria-label="Bold">
          <b>B</b>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'italic');" title="Italic (Ctrl+I)" aria-label="Italic">
          <i>I</i>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'underline');" title="Underline (Ctrl+U)" aria-label="Underline">
          <u>U</u>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'strikeThrough');" title="Strikethrough" aria-label="Strikethrough">
          <s>S</s>
        </button>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Alignment: Left, Center, Right -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'justifyLeft');" title="Align Left" aria-label="Align Left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'justifyCenter');" title="Align Center" aria-label="Align Center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'justifyRight');" title="Align Right" aria-label="Align Right">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Case Conversion: Upper / Lower -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn rp-tb-case-btn" onmousedown="event.preventDefault(); applyTextTransform('${editorId}', 'upper');" title="Uppercase (selected text)" aria-label="Uppercase">
          AA
        </button>
        <button type="button" class="rp-tb-btn rp-tb-case-btn" onmousedown="event.preventDefault(); applyTextTransform('${editorId}', 'lower');" title="Lowercase (selected text)" aria-label="Lowercase">
          aa
        </button>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Lists: Bulleted, Numbered -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'insertUnorderedList');" title="Bulleted list" aria-label="Bulleted list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
        </button>
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'insertOrderedList');" title="Numbered list" aria-label="Numbered list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h2v4"/><path d="M4 10h4"/><path d="M4 14h3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4v1h4"/></svg>
        </button>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Emoji Picker -->
      <div class="rp-tb-group" style="position:relative;">
        <button type="button" class="rp-tb-btn" id="rp-emoji-btn-${editorId}" onmousedown="event.preventDefault(); toggleCommentEmojiPicker('${editorId}');" title="Insert Emoji" aria-label="Insert Emoji">
          😀
        </button>
        <div class="rp-comment-emoji-tray" id="comment-emoji-tray-${editorId}" style="display:none;" role="menu">
          ${['❤️', '👍', '👏', '😂', '😮', '😍', '😢', '😭', '📚', '✨', '🌸', '☕', '🔥', '💡', '💖', '🙏'].map(em => `
            <button type="button" class="rp-comment-emoji-item" onmousedown="event.preventDefault(); insertCommentEmoji('${editorId}', '${em}');" title="${em}">${em}</button>
          `).join('')}
        </div>
      </div>

      <!-- Insert Image -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); triggerMediaUpload('${editorId}', 'image');" title="Insert Image (JPG, PNG, WebP)" aria-label="Insert Image">
          🖼️
        </button>
      </div>

      <!-- Insert GIF -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn rp-tb-gif-btn" onmousedown="event.preventDefault(); triggerMediaUpload('${editorId}', 'gif');" title="Insert Animated GIF" aria-label="Insert Animated GIF">
          <span class="rp-gif-badge">GIF</span>
        </button>
      </div>

      <span class="rp-tb-divider"></span>

      <!-- Remove Formatting -->
      <div class="rp-tb-group">
        <button type="button" class="rp-tb-btn rp-tb-clear-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${editorId}', 'removeFormat');" title="Clear formatting" aria-label="Clear formatting">
          🧹
        </button>
      </div>
    </div>
  `;
}

/**
 * Insert HTML or DOM Node exactly at the current cursor position
 */
function insertAtCursor(editorId, htmlContent) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!editor) return;

  restoreEditorRange(editorId);
  const sel = window.getSelection();

  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();

      // Create a fragment from html
      const el = document.createElement('div');
      el.innerHTML = htmlContent;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);

      // Move cursor after the inserted node
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      saveEditorRange(editorId);
      return;
    }
  }

  // Fallback if no active range inside editor
  editor.focus();
  document.execCommand('insertHTML', false, htmlContent);
  saveEditorRange(editorId);
}

/**
 * Format timestamp into relative display (e.g. "Just now", "5m ago", "Today")
 */
function formatCommentTime(isoStr) {
  if (!isoStr) return 'Just now';
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Just now';
  }
}

/**
 * Client-Side HTML Sanitizer for safely rendering formatted comments
 */
export function renderCommentHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Strip dangerous elements
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'meta', 'link', 'base'];
  dangerousTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Whitelist allowed elements
  const allowedTags = new Set([
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
    'p', 'br', 'div', 'span', 'ul', 'ol', 'li', 'blockquote',
    'code', 'pre', 'a', 'img', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentNode && node.parentNode.nodeName.toLowerCase() === 'a') {
        return;
      }
      const txt = node.textContent;
      const urlRegex = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/i;
      if (urlRegex.test(txt)) {
        const span = doc.createElement('span');
        span.innerHTML = autoLinkifyText(txt);
        node.parentNode.replaceChild(span, node);
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (!allowedTags.has(tagName)) {
        const parent = node.parentNode;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
        return;
      }

      const attrs = Array.from(node.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on')) {
          node.removeAttribute(attr.name);
          continue;
        }

        if (tagName === 'a') {
          if (attrName === 'href') {
            const val = attr.value.trim();
            if (!/^https?:\/\//i.test(val)) {
              node.removeAttribute('href');
            } else {
              node.setAttribute('target', '_blank');
              node.setAttribute('rel', 'noopener noreferrer');
              node.classList.add('rp-comment-link');
            }
          } else if (attrName !== 'target' && attrName !== 'rel' && attrName !== 'class' && attrName !== 'title') {
            node.removeAttribute(attr.name);
          }
        } else if (tagName === 'img') {
          if (attrName === 'src') {
            const val = attr.value.trim();
            if (!/^https?:\/\//i.test(val) && !val.startsWith('/uploads/') && !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(val)) {
              node.remove();
              return;
            }
            node.classList.add('rp-comment-img');
            node.setAttribute('loading', 'lazy');
          } else if (attrName !== 'alt' && attrName !== 'title' && attrName !== 'class' && attrName !== 'loading') {
            node.removeAttribute(attr.name);
          }
        } else if (attrName === 'style') {
          const styleVal = attr.value.toLowerCase();
          const cleanStyles = [];

          const alignMatch = styleVal.match(/text-align\s*:\s*(left|center|right|justify)/);
          if (alignMatch) cleanStyles.push(`text-align: ${alignMatch[1]}`);

          const fontMatch = styleVal.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/);
          if (fontMatch) {
            const f = fontMatch[1].trim();
            if (/^['"a-zA-Z0-9\s,-]+$/i.test(f) && !/javascript|expression/i.test(f)) {
              cleanStyles.push(`font-family: ${f}`);
            }
          }

          const transformMatch = styleVal.match(/text-transform\s*:\s*(uppercase|lowercase|capitalize|none)/);
          if (transformMatch) cleanStyles.push(`text-transform: ${transformMatch[1]}`);

          const colorMatch = styleVal.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
          if (colorMatch) {
            const c = colorMatch[1].trim();
            if (/^(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)|[a-z]+)$/i.test(c)) {
              cleanStyles.push(`color: ${c}`);
            }
          }

          const bgMatch = styleVal.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/);
          if (bgMatch) {
            const bg = bgMatch[1].trim();
            if (/^(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)|[a-z]+)$/i.test(bg)) {
              cleanStyles.push(`background-color: ${bg}`);
            }
          }

          const sizeMatch = styleVal.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/);
          if (sizeMatch) {
            const s = sizeMatch[1].trim();
            if (/^([0-9.]+(px|em|rem|%|pt)|small|medium|large|x-large|xx-large)$/i.test(s)) {
              cleanStyles.push(`font-size: ${s}`);
            }
          }

          if (cleanStyles.length > 0) {
            node.setAttribute('style', cleanStyles.join('; '));
          } else {
            node.removeAttribute('style');
          }
        } else {
          node.removeAttribute(attr.name);
        }
      }

      Array.from(node.childNodes).forEach(cleanNode);
    }
  };

  Array.from(doc.body.childNodes).forEach(cleanNode);
  return doc.body.innerHTML;
}

/**
 * =============================================================================
 * 1. Episode Emoji Reactions Widget (Heart Like Button + 7 Emoji Reactions Picker)
 * =============================================================================
 */
export async function renderReactionsWidget(containerId, targetType, targetId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cacheKey = `${targetType}:${targetId}`;

  try {
    const res = await apiFetch(`/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      reactionsCache[cacheKey] = data;
    }
  } catch (err) {
    console.warn('Failed to load reactions:', err);
  }

  const reactionData = reactionsCache[cacheKey] || {
    counts: { '❤️': 0, '👍': 0, '😂': 0, '😮': 0, '😍': 0, '😢': 0, '😭': 0 },
    userReaction: null,
    total: 0
  };

  const counts = reactionData.counts || {};
  const userReaction = reactionData.userReaction;
  const totalCount = reactionData.total || Object.values(counts).reduce((a, b) => a + b, 0);

  // Top active emojis for live breakdown summary
  const topEmojis = ALLOWED_EMOJIS
    .filter(e => (counts[e] || 0) > 0)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .slice(0, 4);

  container.innerHTML = `
    <div class="rp-reactions-wrap" id="reactions-wrap-${containerId}">
      <div class="rp-like-widget-row">
        <!-- Thumbs-up Like Button Trigger (👍 Like) -->
        <div class="rp-like-trigger-wrap" id="like-trigger-wrap-${containerId}" onmouseenter="window.openEmojiPicker?.('${containerId}')" onmouseleave="window.closeEmojiPicker?.('${containerId}')">
          <button type="button" 
                  id="like-main-btn-${containerId}" 
                  class="rp-like-btn rp-heart-btn rp-thumb-btn ${userReaction ? 'active' : ''}" 
                  onclick="handleLikeButtonClick('${targetType}', '${targetId}', '${containerId}')"
                  aria-haspopup="true" 
                  aria-expanded="false"
                  title="${userReaction ? `You reacted ${userReaction} (${EMOJI_LABELS[userReaction] || 'Liked'}) — Click to unlike or change` : 'Click to like (👍 Like) or choose an emoji reaction'}">
            <span class="rp-heart-glyph rp-like-glyph" id="like-icon-${containerId}">
              ${userReaction || '👍'}
            </span>
            <span class="rp-like-label" id="like-label-${containerId}">
              ${userReaction && userReaction !== '👍' ? (EMOJI_LABELS[userReaction] || 'Liked') : 'Like'}
            </span>
            ${totalCount > 0 ? `<span class="rp-like-total-badge">${totalCount}</span>` : ''}
          </button>

          <!-- Hidden 7-Emoji Reaction Picker Tray (Revealed on Heart Click) -->
          <div class="rp-emoji-picker" id="emoji-picker-${containerId}" style="display:none;" role="menu" aria-label="Episode emoji reactions">
            ${ALLOWED_EMOJIS.map(emoji => {
              const isSelected = userReaction === emoji;
              const emojiCount = counts[emoji] || 0;
              const label = EMOJI_LABELS[emoji] || '';
              return `
                <button type="button" 
                        class="rp-emoji-option ${isSelected ? 'selected' : ''}" 
                        onclick="handleReactionSelect('${targetType}', '${targetId}', '${emoji}', '${containerId}')"
                        title="${label} (${emojiCount})"
                        aria-label="${label}">
                  <span class="rp-emoji-glyph">${emoji}</span>
                  <span class="rp-emoji-tooltip">${label}</span>
                  ${emojiCount > 0 ? `<span class="rp-emoji-count">${emojiCount}</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Live Reaction Breakdown Summary Pill -->
        ${totalCount > 0 ? `
          <div class="rp-reactions-summary-pill" title="Community reactions breakdown">
            <span class="rp-summary-emojis">${topEmojis.join(' ')}</span>
            <span class="rp-summary-count">${totalCount} reaction${totalCount === 1 ? '' : 's'}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Handle Like Button Click (Defaults to 👍 Like toggle)
 */
window.handleLikeButtonClick = async function(targetType, targetId, containerId) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    showToast('Please log in to like this chapter! ✨');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  // Toggle thumbs up reaction: if already reacted with 👍, remove it; otherwise set to 👍
  await window.handleReactionSelect(targetType, targetId, '👍', containerId);
};

window.openEmojiPicker = function(containerId) {
  const picker = document.getElementById(`emoji-picker-${containerId}`);
  const btn = document.getElementById(`like-main-btn-${containerId}`);
  if (picker) {
    picker.style.display = 'flex';
    btn?.setAttribute('aria-expanded', 'true');
  }
};

window.closeEmojiPicker = function(containerId) {
  const picker = document.getElementById(`emoji-picker-${containerId}`);
  const btn = document.getElementById(`like-main-btn-${containerId}`);
  if (picker) {
    picker.style.display = 'none';
    btn?.setAttribute('aria-expanded', 'false');
  }
};

/**
 * Toggle the Emoji Picker popover
 */
window.toggleEmojiPicker = function(containerId) {
  const picker = document.getElementById(`emoji-picker-${containerId}`);
  const btn = document.getElementById(`like-main-btn-${containerId}`);
  if (!picker) return;

  const isHidden = picker.style.display === 'none';

  // Close all open emoji pickers first
  document.querySelectorAll('.rp-emoji-picker').forEach(p => {
    p.style.display = 'none';
  });

  if (isHidden) {
    picker.style.display = 'flex';
    btn?.setAttribute('aria-expanded', 'true');

    // Close on outside click
    const handleOutsideClick = (e) => {
      const wrap = document.getElementById(`like-trigger-wrap-${containerId}`);
      if (wrap && !wrap.contains(e.target)) {
        picker.style.display = 'none';
        btn?.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', handleOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
  } else {
    picker.style.display = 'none';
    btn?.setAttribute('aria-expanded', 'false');
  }
};

/**
 * Handle Reaction Selection
 * - Selects reaction
 * - Changes reaction if different emoji chosen
 * - Removes reaction if same emoji chosen
 * - Enforces 1 reaction per episode per user
 */
window.handleReactionSelect = async function(targetType, targetId, emoji, containerId) {
  const isGuest = !window.IS_LOGGED_IN;

  if (isGuest) {
    showToast('Please log in to react to this chapter! ✨');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    const picker = document.getElementById(`emoji-picker-${containerId}`);
    if (picker) picker.style.display = 'none';
    return;
  }

  const cacheKey = `${targetType}:${targetId}`;
  const prevData = reactionsCache[cacheKey];
  const isRemoving = prevData && prevData.userReaction === emoji;

  // Immediately close picker for snappy UX
  const picker = document.getElementById(`emoji-picker-${containerId}`);
  if (picker) picker.style.display = 'none';

  try {
    const res = await apiFetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, emoji })
    });

    if (res.ok) {
      const data = await res.json();
      reactionsCache[cacheKey] = data;
      renderReactionsWidget(containerId, targetType, targetId);

      if (isRemoving) {
        showToast('Reaction removed.');
      } else {
        showToast(`Reacted with ${emoji} ${EMOJI_LABELS[emoji] || ''}!`);
      }
    }
  } catch (err) {
    console.error('Failed to update reaction:', err);
    showToast('Failed to update reaction.');
  }
};

/**
/**
 * =============================================================================
 * 2. Instagram-Style Modern Novel Comments & Threaded Replies Widget
 * =============================================================================
 */
function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

window._rpExpandedReplies = window._rpExpandedReplies || new Set();

export async function renderCommentsWidget(containerId, novelId, chapterNum = 0, targetPage = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const chStr = chapterNum !== undefined ? String(chapterNum).trim() : '0';
  const pageKey = `${containerId}:${novelId}:${chStr}`;
  window._commentsPageState = window._commentsPageState || {};

  let page = targetPage !== null && targetPage !== undefined ? Number(targetPage) : (window._commentsPageState[pageKey] || 1);
  if (isNaN(page) || page < 1) page = 1;

  let comments = [];
  let pagination = { page, limit: 7, total: 0, totalPages: 1 };

  try {
    const res = await apiFetch(`/api/comments?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(chStr)}&page=${page}&limit=7`);
    if (res.ok) {
      const data = await res.json();
      comments = data.comments || [];
      if (data.pagination) {
        pagination = data.pagination;
      } else {
        const total = Number(data.total || comments.length);
        pagination = { page, limit: 7, total, totalPages: Math.max(1, Math.ceil(total / 7)) };
      }
    }
  } catch (err) {
    console.warn('Failed to load comments:', err);
  }

  // Clamp page if out of bounds (e.g. after deletion)
  if (page > pagination.totalPages && pagination.totalPages >= 1) {
    page = pagination.totalPages;
    window._commentsPageState[pageKey] = page;
    return renderCommentsWidget(containerId, novelId, chapterNum, page);
  }
  window._commentsPageState[pageKey] = page;

  const totalCommentsCount = pagination.total;
  const isGuest = !window.IS_LOGGED_IN;
  const user = window.CURRENT_USER;
  const currentAvatar = getAvatarUrl(user?.avatar);
  const currentDisplayName = user ? (user.displayName || user.username) : 'Guest';

  container.innerHTML = `
    <div class="rp-ig-comments-card" id="ig-comments-wrap-${containerId}">
      <!-- Header -->
      <div class="rp-ig-header">
        <h2 class="rp-ig-title">
          <span>💬</span>
          <span>Comments</span>
          <span class="rp-ig-count-badge" id="ig-total-count-${containerId}">${totalCommentsCount}</span>
        </h2>
      </div>

      <!-- Comment Submission Form -->
      ${isGuest ? `
        <div class="rp-ig-guest-prompt">
          <div>
            <strong style="color:var(--color-navy-deep); font-size:14.5px;">Join the conversation</strong>
            <div style="font-size:12.5px; color:#64748B; margin-top:2px;">
              Log in to leave comments, reply to fellow members, and react to stories.
            </div>
          </div>
          <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">
            Log In to Comment
          </button>
        </div>
      ` : `
        <div class="rp-ig-form-container">
          <img src="${currentAvatar}" class="rp-ig-user-avatar" alt="${escapeQuotes(currentDisplayName)}" onerror="this.src='/profile.png';">
          <div class="rp-comment-editor-box" id="rp-comment-editor-box-${containerId}">
            
            <!-- Comment Formatting Toolbar -->
            <div class="rp-comment-toolbar" id="rp-comment-toolbar-${containerId}" role="toolbar" aria-label="Comment formatting toolbar">
              
              <!-- Text Style -->
              <div class="rp-tb-group">
                <select class="rp-tb-select rp-tb-style-select" 
                        onchange="applyTextStyle('${containerId}', this.value)" 
                        title="Text Style" 
                        aria-label="Text Style">
                  <option value="p">Normal</option>
                  <option value="h2">Heading</option>
                  <option value="h3">Subheading</option>
                </select>
              </div>

              <!-- Font Family -->
              <div class="rp-tb-group">
                <select class="rp-tb-select rp-tb-font-select" 
                        onchange="applyFontFamily('${containerId}', this.value)" 
                        title="Font Family" 
                        aria-label="Font Family">
                  <option value="inherit">Default Font</option>
                  <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
                  <option value="'Inter', sans-serif">Inter</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Arial, sans-serif">Arial</option>
                </select>
              </div>

              <!-- Font Size -->
              <div class="rp-tb-group">
                <select class="rp-tb-select rp-tb-size-select" 
                        onchange="applyFontSize('${containerId}', this.value)" 
                        title="Font Size" 
                        aria-label="Font Size">
                  <option value="12px">Small</option>
                  <option value="15px" selected>Normal</option>
                  <option value="18px">Large</option>
                  <option value="22px">Huge</option>
                </select>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Inline Styles: Bold, Italic, Underline, Strikethrough -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'bold');" title="Bold (Ctrl+B)" aria-label="Bold">
                  <b>B</b>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'italic');" title="Italic (Ctrl+I)" aria-label="Italic">
                  <i>I</i>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'underline');" title="Underline (Ctrl+U)" aria-label="Underline">
                  <u>U</u>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'strikeThrough');" title="Strikethrough" aria-label="Strikethrough">
                  <s>S</s>
                </button>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Alignment: Left, Center, Right -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'justifyLeft');" title="Align Left" aria-label="Align Left">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'justifyCenter');" title="Align Center" aria-label="Align Center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'justifyRight');" title="Align Right" aria-label="Align Right">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                </button>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Case Conversion: Upper / Lower -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn rp-tb-case-btn" onmousedown="event.preventDefault(); applyTextTransform('${containerId}', 'upper');" title="Uppercase (selected text)" aria-label="Uppercase">
                  AA
                </button>
                <button type="button" class="rp-tb-btn rp-tb-case-btn" onmousedown="event.preventDefault(); applyTextTransform('${containerId}', 'lower');" title="Lowercase (selected text)" aria-label="Lowercase">
                  aa
                </button>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Lists: Bulleted, Numbered -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'insertUnorderedList');" title="Bulleted list" aria-label="Bulleted list">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
                </button>
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'insertOrderedList');" title="Numbered list" aria-label="Numbered list">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h2v4"/><path d="M4 10h4"/><path d="M4 14h3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4v1h4"/></svg>
                </button>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Emoji Picker -->
              <div class="rp-tb-group" style="position:relative;">
                <button type="button" class="rp-tb-btn" id="rp-emoji-btn-${containerId}" onmousedown="event.preventDefault(); toggleCommentEmojiPicker('${containerId}');" title="Insert Emoji" aria-label="Insert Emoji">
                  😀
                </button>
                <div class="rp-comment-emoji-tray" id="comment-emoji-tray-${containerId}" style="display:none;" role="menu">
                  ${['❤️', '👍', '👏', '😂', '😮', '😍', '😢', '😭', '📚', '✨', '🌸', '☕', '🔥', '💡', '💖', '🙏'].map(em => `
                    <button type="button" class="rp-comment-emoji-item" onmousedown="event.preventDefault(); insertCommentEmoji('${containerId}', '${em}');" title="${em}">${em}</button>
                  `).join('')}
                </div>
              </div>

              <!-- Insert Image -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn" onmousedown="event.preventDefault(); triggerMediaUpload('${containerId}', 'image');" title="Insert Image (JPG, PNG, WebP)" aria-label="Insert Image">
                  🖼️
                </button>
              </div>

              <!-- Insert GIF -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn rp-tb-gif-btn" onmousedown="event.preventDefault(); triggerMediaUpload('${containerId}', 'gif');" title="Insert Animated GIF" aria-label="Insert Animated GIF">
                  <span class="rp-gif-badge">GIF</span>
                </button>
              </div>

              <span class="rp-tb-divider"></span>

              <!-- Remove Formatting -->
              <div class="rp-tb-group">
                <button type="button" class="rp-tb-btn rp-tb-clear-btn" onmousedown="event.preventDefault(); applyToolbarCommand('${containerId}', 'removeFormat');" title="Clear formatting" aria-label="Clear formatting">
                  🧹
                </button>
              </div>
            </div>

            <!-- Hidden file inputs for Image and GIF upload -->
            <input type="file" id="comment-image-input-${containerId}" style="display:none;" accept="image/jpeg,image/png,image/webp" onchange="handleCommentFileUpload(event, '${containerId}', 'image')" />
            <input type="file" id="comment-gif-input-${containerId}" style="display:none;" accept="image/gif" onchange="handleCommentFileUpload(event, '${containerId}', 'gif')" />

            <!-- Attachment Preview Tray -->
            <div class="rp-attachment-tray" id="rp-attachment-tray-${containerId}" style="display:none;"></div>

            <!-- ContentEditable Rich Text Comment Editor -->
            <div class="rp-rich-editor" 
                 id="comment-editor-${containerId}" 
                 contenteditable="true" 
                 role="textbox" 
                 aria-multiline="true" 
                 data-placeholder="Add a comment as @${escapeQuotes(currentDisplayName)}..."></div>

            <!-- Form Footer with Helper & Submit Button -->
            <div class="rp-ig-form-footer">
              <span class="rp-editor-tip">Press Ctrl+Enter to post • Rich text &amp; media enabled</span>
              <button type="button" 
                      id="ig-comment-submit-${containerId}" 
                      class="rp-ig-post-btn"
                      onclick="handleCommentSubmit('${escapeQuotes(novelId)}', '${escapeQuotes(chStr)}', '${escapeQuotes(containerId)}')">
                Post Comment
              </button>
            </div>
          </div>
        </div>
      `}
      <div class="rp-ig-feed" id="ig-feed-${containerId}">
        ${comments.length === 0 ? `
          <div class="rp-ig-empty-state">
            <div class="rp-ig-empty-icon">💭</div>
            <div class="rp-ig-empty-title">No comments yet</div>
            <p class="rp-ig-empty-desc">Be the first to share your thoughts on this story!</p>
          </div>
        ` : comments.map(c => renderSingleIgComment(c, novelId, chStr, containerId)).join('')}
      </div>

      <!-- Chronological Comments Pagination (7 entries per page) -->
      ${pagination.totalPages > 1 ? `
        <div class="rp-comments-pagination" role="navigation" aria-label="Comments pagination">
          <button type="button" 
                  class="rp-page-btn rp-page-prev" 
                  ${pagination.page <= 1 ? 'disabled' : ''} 
                  onclick="window.changeCommentsPage('${containerId}', '${escapeQuotes(novelId)}', '${escapeQuotes(chStr)}', ${pagination.page - 1})">
            ‹ Prev
          </button>
          <div class="rp-page-numbers">
            ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => `
              <button type="button" 
                      class="rp-page-num-btn ${p === pagination.page ? 'active' : ''}" 
                      onclick="window.changeCommentsPage('${containerId}', '${escapeQuotes(novelId)}', '${escapeQuotes(chStr)}', ${p})">
                ${p}
              </button>
            `).join('')}
          </div>
          <button type="button" 
                  class="rp-page-btn rp-page-next" 
                  ${pagination.page >= pagination.totalPages ? 'disabled' : ''} 
                  onclick="window.changeCommentsPage('${containerId}', '${escapeQuotes(novelId)}', '${escapeQuotes(chStr)}', ${pagination.page + 1})">
            Next ›
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // Attach listeners to newly rendered editor
  if (!isGuest) {
    attachEditorListeners(containerId);
    if (window.rpDraftAttachments && window.rpDraftAttachments[containerId]) {
      renderAttachmentPreview(containerId);
    }
  }

  // Hydrate external website link previews
  hydrateLinkPreviews(container);
}

/**
 * Render a single Instagram-style comment (or reply) in the single chronological timeline
 */
function renderSingleIgComment(c, novelId, chapterNum, containerId) {
  const authorAvatar = getAvatarUrl(c.avatar);
  const authorName = c.displayName || c.username;
  const timeDisplay = c.timeAgo || 'now';
  const fullDate = c.fullDate || '';
  const user = window.CURRENT_USER;

  const isOwner = Boolean(user && (String(user.id) === String(c.userId) || user.username === c.username));
  const isAdmin = Boolean(user && (user.isAdmin || (user.role && ['admin', 'administrator', 'editor'].includes(user.role.toLowerCase()))));
  const canManage = isOwner || isAdmin;
  const isPrivileged = Boolean(c.role && ['admin', 'administrator', 'editor'].includes(c.role.toLowerCase()));
  const isAuthor = Boolean(c.role && ['author', 'writer'].includes(c.role.toLowerCase()));

  let roleBadge = '';
  if (isPrivileged) {
    roleBadge = `<span class="rp-ig-role-badge admin">👑 Admin</span>`;
  } else if (isAuthor) {
    roleBadge = `<span class="rp-ig-role-badge author">✍️ Author</span>`;
  }

  const sanitizedContent = renderCommentHtml(c.content);
  const likesCount = Number(c.likesCount || 0);
  const hasLiked = Boolean(c.hasLiked);
  const heartIcon = hasLiked ? '❤️' : '🤍';
  const likeAria = hasLiked ? 'Unlike comment' : 'Like comment';

  const isReply = Boolean(c.parentId);
  const replyParentAuthor = c.parentAuthor || 'Author';

  return `
    <div class="rp-ig-comment-row ${isReply ? 'is-reply' : ''}" id="ig-comment-${c.id}">
      <div class="rp-ig-comment-main">
        <img src="${authorAvatar}" class="${isReply ? 'rp-ig-reply-avatar' : 'rp-ig-comment-avatar'}" alt="${escapeQuotes(authorName)}" onerror="this.src='/profile.png';">
        
        <div class="rp-ig-comment-bubble">
          ${isReply ? `
            <div class="rp-ig-reply-context-tag">
              <span class="rp-reply-arrow">↳</span> Replying to <strong>@${escapeHtml(replyParentAuthor)}</strong>
            </div>
          ` : ''}

          <!-- Text and Author line -->
          <div class="rp-ig-comment-text-wrap" id="ig-comment-text-${c.id}">
            <a href="#members" class="rp-ig-comment-author-name">${escapeHtml(authorName)}</a>
            ${roleBadge}
            <span>${sanitizedContent}</span>
          </div>

          <!-- Inline Media / URL Embed Previews -->
          ${renderCommentEmbeds(c.content, c.id)}

          <!-- Inline Edit Box (Hidden by Default) -->
          <div class="rp-ig-edit-box" id="ig-edit-box-${c.id}" style="display:none;">
            <textarea class="rp-ig-edit-textarea" id="ig-edit-textarea-${c.id}" rows="2">${stripHtml(c.content)}</textarea>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline btn-sm" onclick="handleCommentCancelEdit(${c.id})">Cancel</button>
              <button type="button" class="btn btn-gold btn-sm" onclick="handleCommentSave(${c.id}, '${escapeQuotes(novelId)}', '${escapeQuotes(chapterNum)}', '${escapeQuotes(containerId)}')">Save</button>
            </div>
          </div>

          <!-- Meta actions: Timestamp, Likes Count, Reply, Edit, Delete -->
          <div class="rp-ig-meta-bar" id="ig-meta-bar-${c.id}">
            <span class="rp-ig-meta-time" title="${escapeQuotes(fullDate)}">${escapeHtml(timeDisplay)}</span>
            
            <span class="rp-ig-meta-likes" id="ig-likes-count-${c.id}" style="${likesCount > 0 ? '' : 'display:none;'}">
              ${likesCount} ${likesCount === 1 ? 'like' : 'likes'}
            </span>

            <button type="button" class="rp-ig-meta-action" onclick="openCommentReply(${c.id}, '${escapeQuotes(authorName)}')">
              Reply
            </button>

            ${canManage ? `
              <button type="button" class="rp-ig-meta-action" onclick="handleCommentEdit(${c.id})">
                Edit
              </button>
              <button type="button" class="rp-ig-meta-action delete" onclick="handleCommentDelete(${c.id}, '${escapeQuotes(novelId)}', '${escapeQuotes(chapterNum)}', '${escapeQuotes(containerId)}')">
                Delete
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Right-side Heart Like Button -->
        <button type="button" 
                class="rp-ig-heart-btn ${hasLiked ? 'liked' : ''}" 
                id="ig-heart-btn-${c.id}" 
                title="${likeAria}" 
                aria-label="${likeAria}"
                onclick="handleCommentLike(${c.id}, '${escapeQuotes(novelId)}', '${escapeQuotes(chapterNum)}', '${escapeQuotes(containerId)}')">
          <span class="rp-ig-heart-icon">${heartIcon}</span>
        </button>
      </div>

      <!-- Inline Reply Box for this comment (Hidden by Default) -->
      <div class="rp-ig-inline-reply-box" id="ig-reply-box-${c.id}" style="display:none;">
        <div class="rp-ig-replying-pill">
          <span>Replying to <strong id="ig-reply-to-user-${c.id}">@${escapeHtml(authorName)}</strong></span>
          <button type="button" class="rp-ig-replying-cancel" onclick="closeCommentReply(${c.id})" title="Cancel reply">✕</button>
        </div>
        
        <div class="rp-comment-editor-box rp-reply-editor-box" id="rp-comment-editor-box-reply-${c.id}">
          ${renderCommentToolbarHtml(`reply-${c.id}`)}
          <input type="file" id="comment-image-input-reply-${c.id}" style="display:none;" accept="image/jpeg,image/png,image/webp" onchange="handleCommentFileUpload(event, 'reply-${c.id}', 'image')" />
          <input type="file" id="comment-gif-input-reply-${c.id}" style="display:none;" accept="image/gif" onchange="handleCommentFileUpload(event, 'reply-${c.id}', 'gif')" />
          <div class="rp-attachment-tray" id="rp-attachment-tray-reply-${c.id}" style="display:none;"></div>
          <div class="rp-rich-editor rp-reply-rich-editor" 
               id="comment-editor-reply-${c.id}" 
               contenteditable="true" 
               role="textbox" 
               aria-multiline="true" 
               data-placeholder="Write a reply to @${escapeQuotes(authorName)}..."></div>
        </div>

        <div class="rp-reply-actions-bar">
          <span class="rp-editor-tip">Press Ctrl+Enter to post • Formatting &amp; media enabled</span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="closeCommentReply(${c.id})">Cancel</button>
            <button type="button" 
                    id="ig-reply-submit-${c.id}" 
                    class="btn btn-gold btn-sm" 
                    onclick="handleReplySubmit(${c.id}, '${escapeQuotes(novelId)}', '${escapeQuotes(chapterNum)}', '${escapeQuotes(containerId)}')">
              Post Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.rpDraftAttachments = window.rpDraftAttachments || {};

/**
 * Attach selection & input listeners to maintain cursor position
 */
function attachEditorListeners(editorId) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (!editor) return;

  const handleUpdate = () => saveEditorRange(editorId);

  editor.addEventListener('keyup', handleUpdate);
  editor.addEventListener('mouseup', handleUpdate);
  editor.addEventListener('input', handleUpdate);
  editor.addEventListener('focus', handleUpdate);

  // Auto-detect pasted URLs and embed them directly into editor
  editor.addEventListener('paste', (e) => {
    const clipData = e.clipboardData || window.clipboardData;
    if (!clipData) return;
    const text = clipData.getData('text/plain');
    if (!text) return;

    const urlPattern = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/i;
    if (urlPattern.test(text)) {
      e.preventDefault();
      const linkifiedHtml = autoLinkifyText(text);
      insertAtCursor(editorId, linkifiedHtml);
      saveEditorRange(editorId);
    }
  });

  // Ctrl+Enter / Cmd+Enter keyboard shortcut to post & space/Enter URL auto-linkify
  editor.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      autoLinkifyCaretWord(editorId);
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const submitBtn = document.getElementById(`ig-comment-submit-${editorId}`) || 
                        document.getElementById(`ig-reply-submit-${editorId.replace('reply-', '')}`);
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
      }
    }
  });

  // Prevent default link navigation inside contenteditable editor
  editor.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && editor.contains(link)) {
      e.preventDefault();
    }
  });
}

/**
 * Toolbar Action Dispatcher
 */
window.applyToolbarCommand = function(editorId, command, value = null) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  restoreEditorRange(editorId);
  document.execCommand(command, false, value);
  saveEditorRange(editorId);
};

window.applyTextStyle = function(editorId, styleTag) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  restoreEditorRange(editorId);
  if (styleTag === 'h2') {
    document.execCommand('formatBlock', false, '<h2>');
  } else if (styleTag === 'h3') {
    document.execCommand('formatBlock', false, '<h3>');
  } else {
    document.execCommand('formatBlock', false, '<p>');
  }
  saveEditorRange(editorId);
};

window.applyFontFamily = function(editorId, fontName) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  restoreEditorRange(editorId);
  if (fontName === 'inherit') {
    document.execCommand('removeFormat', false, null);
  } else {
    document.execCommand('fontName', false, fontName);
  }
  saveEditorRange(editorId);
};

window.applyFontSize = function(editorId, size) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  restoreEditorRange(editorId);
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const span = document.createElement('span');
    span.style.fontSize = size;
    try {
      const range = sel.getRangeAt(0);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.selectAllChildren(span);
    } catch {
      document.execCommand('fontSize', false, size === '12px' ? '2' : size === '18px' ? '4' : '5');
    }
  }
  saveEditorRange(editorId);
};

window.applyTextTransform = function(editorId, mode) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  restoreEditorRange(editorId);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    showToast('Please select text to change case.');
    return;
  }
  const range = sel.getRangeAt(0);
  const text = range.toString();
  if (!text) return;
  const transformed = mode === 'upper' ? text.toUpperCase() : text.toLowerCase();
  document.execCommand('insertText', false, transformed);
  saveEditorRange(editorId);
};

window.toggleCommentEmojiPicker = function(editorId) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  const picker = document.getElementById(`comment-emoji-tray-${editorId}`);
  if (!picker) return;
  const isHidden = picker.style.display === 'none';
  document.querySelectorAll('.rp-comment-emoji-tray').forEach(p => p.style.display = 'none');
  if (isHidden) {
    saveEditorRange(editorId);
    picker.style.display = 'grid';
  } else {
    picker.style.display = 'none';
  }
};

window.insertCommentEmoji = function(editorId, emoji) {
  insertAtCursor(editorId, emoji);
  const picker = document.getElementById(`comment-emoji-tray-${editorId}`);
  if (picker) picker.style.display = 'none';
};

window.triggerMediaUpload = function(editorId, type) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }
  saveEditorRange(editorId);
  const input = document.getElementById(`comment-${type}-input-${editorId}`);
  if (input) input.click();
};

window.handleCommentFileUpload = async function(event, editorId, type) {
  const file = event.target.files?.[0];
  if (!file) return;

  const allowed = type === 'gif' ? ['image/gif'] : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast(type === 'gif' ? 'Please select a valid GIF file.' : 'Please select a JPG, PNG, or WebP image.');
    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('File size exceeds the 5MB limit.');
    event.target.value = '';
    return;
  }

  showToast(type === 'gif' ? 'Uploading GIF… 🎞️' : 'Uploading image… 📸');
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;
    try {
      const res = await apiFetch('/api/comments/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64Data, name: file.name })
      });
      const data = await res.json();
      const fileUrl = (res.ok && data.success && data.url) ? data.url : base64Data;

      window.rpDraftAttachments[editorId] = {
        url: fileUrl,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        type
      };

      renderAttachmentPreview(editorId);
      insertAtCursor(editorId, `<img src="${fileUrl}" alt="${escapeQuotes(file.name)}" class="rp-comment-img" loading="lazy" /><p><br></p>`);
      showToast(type === 'gif' ? 'GIF attached! 🎞️' : 'Image attached! 📸');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Failed to upload file.');
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

window.removeDraftAttachment = function(editorId) {
  const draft = window.rpDraftAttachments[editorId];
  if (draft && draft.url) {
    const editor = document.getElementById(`comment-editor-${editorId}`);
    if (editor) {
      const imgs = editor.querySelectorAll('img');
      imgs.forEach(img => {
        if (img.src.includes(draft.url) || img.getAttribute('src') === draft.url) {
          img.remove();
        }
      });
    }
  }
  delete window.rpDraftAttachments[editorId];
  renderAttachmentPreview(editorId);
  showToast('Attachment removed.');
};

function renderAttachmentPreview(editorId) {
  const tray = document.getElementById(`rp-attachment-tray-${editorId}`);
  if (!tray) return;
  const draft = window.rpDraftAttachments[editorId];
  if (!draft) {
    tray.style.display = 'none';
    tray.innerHTML = '';
    return;
  }

  tray.style.display = 'flex';
  tray.innerHTML = `
    <div class="rp-attachment-item">
      <img src="${draft.url}" class="rp-attachment-thumb" alt="${escapeQuotes(draft.name)}" />
      <div class="rp-attachment-info">
        <span class="rp-attachment-name">${escapeHtml(draft.name)}</span>
        <span class="rp-attachment-meta">${draft.type.toUpperCase()} • ${draft.size}</span>
      </div>
      <button type="button" class="rp-attachment-remove-btn" onclick="removeDraftAttachment('${editorId}')" title="Remove attachment">✕ Remove</button>
    </div>
  `;
}

/**
 * General Toolbar MouseDown handler preventing editor blur
 */
window.handleToolbarMouseDown = function(event, editorId, command, value = null) {
  event.preventDefault();
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  restoreEditorRange(editorId);
  document.execCommand(command, false, value);
  saveEditorRange(editorId);
};

/**
 * Apply Font Size to Selection
 */
window.applyEditorFontSize = function(editorId, sizeName) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  restoreEditorRange(editorId);
  const sizeMap = {
    'small': '12px',
    'medium': '15px',
    'large': '19px',
    'x-large': '23px'
  };
  const sizeValue = sizeMap[sizeName] || '15px';

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const span = document.createElement('span');
    span.style.fontSize = sizeValue;
    try {
      const range = sel.getRangeAt(0);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.selectAllChildren(span);
      saveEditorRange(editorId);
    } catch {
      document.execCommand('fontSize', false, sizeName === 'small' ? '2' : sizeName === 'large' ? '4' : '5');
    }
  }
};

/**
 * Apply Text Color to Selection
 */
window.applyEditorTextColor = function(editorId, colorHex) {
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  restoreEditorRange(editorId);
  document.execCommand('foreColor', false, colorHex);
  saveEditorRange(editorId);
};

window.handleColorSwatch = function(event, editorId, colorHex) {
  event.preventDefault();
  window.applyEditorTextColor(editorId, colorHex);
};

/**
 * Insert or Toggle Blockquote
 */
window.handleToolbarQuote = function(event, editorId) {
  event.preventDefault();
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  restoreEditorRange(editorId);
  const sel = window.getSelection();
  const selectedText = sel ? sel.toString().trim() : '';

  if (selectedText) {
    insertAtCursor(editorId, `<blockquote>${selectedText}</blockquote><p><br></p>`);
  } else {
    insertAtCursor(editorId, `<blockquote>Quote text here…</blockquote><p><br></p>`);
  }
};

/**
 * Insert or Toggle Inline Code / Code Snippet
 */
window.handleToolbarCode = function(event, editorId) {
  event.preventDefault();
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  restoreEditorRange(editorId);
  const sel = window.getSelection();
  const selectedText = sel ? sel.toString() : '';

  if (selectedText) {
    insertAtCursor(editorId, `<code>${selectedText}</code>`);
  } else {
    insertAtCursor(editorId, `<code>code</code>`);
  }
};

/**
 * Open WordPress-Style Link Inserter / Editor Popover
 */
window.openLinkPrompt = function(event, editorId, targetLink = null) {
  if (event) {
    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
  }

  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    if (typeof window.handleGuestCommentFocus === 'function') {
      window.handleGuestCommentFocus();
    }
    return;
  }

  const editor = document.getElementById(`comment-editor-${editorId}`);
  const popover = document.getElementById(`rp-link-popover-${editorId}`);
  if (!editor || !popover) return;

  // Toggle close if already open and no explicit target link clicked
  if (popover.style.display !== 'none' && !targetLink) {
    closeLinkPopover(editorId);
    return;
  }

  // Preserve editor selection range
  saveEditorRange(editorId);
  const range = editorRanges[editorId];

  const activeLink = targetLink || findActiveLink(editorId);
  popover._activeLink = activeLink;

  const urlInput = document.getElementById(`rp-link-url-${editorId}`);
  const textInput = document.getElementById(`rp-link-text-${editorId}`);
  const titleText = document.getElementById(`rp-link-title-text-${editorId}`);
  const applyBtn = document.getElementById(`rp-link-btn-apply-${editorId}`);
  const unlinkBtn = document.getElementById(`rp-link-btn-unlink-${editorId}`);
  const previewBtn = document.getElementById(`rp-link-preview-${editorId}`);

  if (activeLink) {
    const href = activeLink.getAttribute('href') || '';
    const text = activeLink.textContent || '';
    if (urlInput) urlInput.value = href;
    if (textInput) textInput.value = text;
    if (titleText) titleText.textContent = 'Edit Link';
    if (applyBtn) applyBtn.textContent = 'Update Link';
    if (unlinkBtn) unlinkBtn.style.display = 'inline-flex';
    if (previewBtn) {
      previewBtn.href = href;
      previewBtn.style.display = 'inline-flex';
    }
  } else {
    const selectedText = (range && !range.collapsed) ? range.toString().trim() : '';
    if (urlInput) urlInput.value = '';
    if (textInput) textInput.value = selectedText;
    if (titleText) titleText.textContent = 'Insert Link';
    if (applyBtn) applyBtn.textContent = 'Insert Link';
    if (unlinkBtn) unlinkBtn.style.display = 'none';
    if (previewBtn) {
      previewBtn.href = '#';
      previewBtn.style.display = 'none';
    }
  }

  popover.style.display = 'block';

  // Live URL update for preview button
  if (urlInput && previewBtn) {
    urlInput.oninput = () => {
      const val = urlInput.value.trim();
      if (/^https?:\/\//i.test(val)) {
        previewBtn.href = val;
        previewBtn.style.display = 'inline-flex';
      } else if (val.includes('.')) {
        previewBtn.href = 'https://' + val;
        previewBtn.style.display = 'inline-flex';
      } else {
        previewBtn.style.display = 'none';
      }
    };
  }

  // Focus input field smoothly
  setTimeout(() => {
    if (activeLink && textInput) {
      urlInput?.focus();
      urlInput?.select();
    } else if (urlInput?.value) {
      textInput?.focus();
    } else {
      urlInput?.focus();
    }
  }, 30);
};

/**
 * Close Link Popover and restore focus to editor
 */
window.closeLinkPopover = function(editorId) {
  const popover = document.getElementById(`rp-link-popover-${editorId}`);
  if (popover) {
    popover.style.display = 'none';
    popover._activeLink = null;
  }
  const editor = document.getElementById(`comment-editor-${editorId}`);
  if (editor) {
    restoreEditorRange(editorId);
    editor.focus({ preventScroll: true });
  }
};

/**
 * Apply Insert or Update Link at Cursor Position
 */
window.applyLinkInsert = function(editorId) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  const popover = document.getElementById(`rp-link-popover-${editorId}`);
  if (!editor || !popover) return;

  const urlInput = document.getElementById(`rp-link-url-${editorId}`);
  const textInput = document.getElementById(`rp-link-text-${editorId}`);
  const rawUrl = urlInput ? urlInput.value.trim() : '';
  let linkText = textInput ? textInput.value.trim() : '';

  if (!rawUrl) {
    showToast('Please enter a destination URL.');
    if (urlInput) urlInput.focus();
    return;
  }

  const cleanUrl = validateUrl(rawUrl);
  if (!cleanUrl) {
    showToast('Invalid URL. Please enter a valid web link (e.g. https://example.com).');
    if (urlInput) urlInput.focus();
    return;
  }

  // Restore range
  restoreEditorRange(editorId);
  const sel = window.getSelection();
  let range = editorRanges[editorId];

  // If editing an existing link:
  const activeLink = popover._activeLink || findActiveLink(editorId);
  if (activeLink && editor.contains(activeLink)) {
    activeLink.setAttribute('href', cleanUrl);
    activeLink.setAttribute('target', '_blank');
    activeLink.setAttribute('rel', 'noopener noreferrer');
    activeLink.className = 'rp-comment-link';
    if (linkText) {
      activeLink.textContent = linkText;
    }

    // Insert or find trailing space node so continuing to type stays outside the link
    let nextNode = activeLink.nextSibling;
    if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
      nextNode = document.createTextNode('\u00A0');
      activeLink.after(nextNode);
    }
    const newRange = document.createRange();
    newRange.setStart(nextNode, 1);
    newRange.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    saveEditorRange(editorId);
    editor.focus({ preventScroll: true });
    closeLinkPopover(editorId);
    showToast('Link updated! 🔗');
    return;
  }

  // New link insertion
  if (!linkText) {
    const selText = (range && !range.collapsed) ? range.toString().trim() : '';
    linkText = selText || cleanUrl;
  }

  const a = document.createElement('a');
  a.href = cleanUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'rp-comment-link';
  a.textContent = linkText;

  if (range && editor.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(a);

    const spaceNode = document.createTextNode('\u00A0');
    a.after(spaceNode);

    range.setStart(spaceNode, 1);
    range.setEnd(spaceNode, 1);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    // Safe fallback: append to editor without destroying existing comment text
    editor.focus({ preventScroll: true });
    editor.appendChild(a);
    const spaceNode = document.createTextNode('\u00A0');
    editor.appendChild(spaceNode);

    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  saveEditorRange(editorId);
  editor.focus({ preventScroll: true });
  closeLinkPopover(editorId);
  showToast('Link inserted! 🔗');
};

/**
 * Handle Unlinking / Removing Hyperlink
 */
window.handleEditorUnlink = function(editorId, targetLink = null) {
  const editor = document.getElementById(`comment-editor-${editorId}`);
  const popover = document.getElementById(`rp-link-popover-${editorId}`);
  if (!editor) return;

  restoreEditorRange(editorId);
  const link = targetLink || (popover ? popover._activeLink : null) || findActiveLink(editorId);
  if (link && editor.contains(link)) {
    const textNode = document.createTextNode(link.textContent);
    link.parentNode.replaceChild(textNode, link);

    const range = document.createRange();
    range.setStartAfter(textNode);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    saveEditorRange(editorId);
    editor.focus({ preventScroll: true });
    if (popover) closeLinkPopover(editorId);
    showToast('Link removed.');
    return;
  }

  // Fallback to execCommand unlink
  document.execCommand('unlink', false, null);
  saveEditorRange(editorId);
  if (popover) closeLinkPopover(editorId);
};

window.handleEditorUnlinkToolbar = function(event, editorId) {
  event.preventDefault();
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    if (typeof window.handleGuestCommentFocus === 'function') {
      window.handleGuestCommentFocus();
    }
    return;
  }
  window.handleEditorUnlink(editorId);
};

// Global click outside to dismiss active link popovers
if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', (e) => {
    const openPopovers = document.querySelectorAll('.rp-link-popover');
    openPopovers.forEach(popover => {
      if (popover.style.display !== 'none') {
        const editorWrapper = popover.closest('.rp-editor-wrapper');
        if (editorWrapper && !editorWrapper.contains(e.target)) {
          popover.style.display = 'none';
          popover._activeLink = null;
        }
      }
    });
  });
}


/**
 * Open Image Prompt Dialog (File Upload or URL) at Cursor Position
 */
window.openImagePrompt = function(event, editorId) {
  event.preventDefault();
  const isGuest = !window.IS_LOGGED_IN;
  if (isGuest) {
    window.handleGuestCommentFocus();
    return;
  }

  saveEditorRange(editorId);

  const choice = confirm('Click OK to upload an image file from your device, or CANCEL to enter an image URL.');
  if (choice) {
    const fileInput = document.getElementById(`comment-image-input-${editorId}`);
    if (fileInput) fileInput.click();
  } else {
    const imgUrl = prompt('Enter image URL (JPG, PNG, WebP, GIF):', 'https://');
    if (!imgUrl) return;
    const cleanUrl = imgUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      showToast('Image URL must start with http:// or https://');
      return;
    }
    insertAtCursor(editorId, `<img src="${cleanUrl}" alt="Comment image" class="rp-comment-img" loading="lazy" /><p><br></p>`);
    showToast('Image inserted at cursor! 📸');
  }
};

/**
 * Handle Image File Upload with Validation and Cursor Position Insertion
 */
window.handleImageFileSelected = async function(event, editorId) {
  const file = event.target.files?.[0];
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Invalid file format! Only JPG, PNG, WebP, and GIF images are allowed.');
    event.target.value = '';
    return;
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Image size exceeds 5MB limit. Please upload a smaller image.');
    event.target.value = '';
    return;
  }

  showToast('Uploading image…');

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result;

    try {
      const res = await apiFetch('/api/comments/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64Data, name: file.name })
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        insertAtCursor(editorId, `<img src="${data.url}" alt="${file.name}" class="rp-comment-img" loading="lazy" /><p><br></p>`);
        showToast('Image uploaded and inserted! 📸');
      } else {
        insertAtCursor(editorId, `<img src="${base64Data}" alt="Uploaded image" class="rp-comment-img" loading="lazy" /><p><br></p>`);
        showToast('Image inserted.');
      }
    } catch (err) {
      console.warn('Upload endpoint error, inserting as Data URL:', err);
      insertAtCursor(editorId, `<img src="${base64Data}" alt="Uploaded image" class="rp-comment-img" loading="lazy" /><p><br></p>`);
      showToast('Image inserted.');
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

window.handleGuestCommentFocus = function() {
  showToast('Please log in to post your comment! 💬');
  if (typeof window.openAuthModal === 'function') {
    window.openAuthModal('login');
  }
};

/**
 * Handle Comment Submit
 */
window.handleCommentSubmit = async function(novelId, chapterNum, containerId) {
  const isGuest = !window.IS_LOGGED_IN;

  if (isGuest) {
    showToast('Please log in to post a comment! 💬');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  const editor = document.getElementById(`comment-editor-${containerId}`);
  const input = document.getElementById(`ig-comment-input-${containerId}`);
  const submitBtn = document.getElementById(`ig-comment-submit-${containerId}`);

  let contentToPost = '';
  if (editor) {
    let html = editor.innerHTML.trim();
    const textContent = (editor.textContent || editor.innerText || '').trim();
    const hasImages = editor.querySelectorAll('img').length > 0;
    const draftAttachment = window.rpDraftAttachments && window.rpDraftAttachments[containerId];

    if (draftAttachment && !hasImages) {
      html += `<p><img src="${draftAttachment.url}" alt="${escapeQuotes(draftAttachment.name)}" class="rp-comment-img" loading="lazy" /></p>`;
    }

    if (!textContent && !hasImages && !draftAttachment) {
      showToast('Please enter your comment or attach an image/GIF.');
      return;
    }
    contentToPost = html;
  } else if (input) {
    contentToPost = input.value.trim();
    if (!contentToPost) {
      showToast('Please enter your comment.');
      return;
    }
  }

  contentToPost = ensureAllUrlsLinked(contentToPost);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }

  try {
    const res = await apiFetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novelId, chapterNum, content: contentToPost })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to post comment.');
      return;
    }

    if (editor) editor.innerHTML = '';
    if (input) input.value = '';
    if (window.rpDraftAttachments) {
      delete window.rpDraftAttachments[containerId];
    }
    showToast(t('comments_post_success') || 'Comment posted successfully! 💬');
    await renderCommentsWidget(containerId, novelId, chapterNum, 999999);
    setTimeout(() => {
      const feed = document.getElementById(`ig-feed-${containerId}`);
      if (feed && feed.lastElementChild) {
        feed.lastElementChild.scrollIntoView({ behavior: 'smooth' });
      }
    }, 250);
  } catch (err) {
    console.error('Comment submit error:', err);
    showToast('Network error posting comment.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Comment';
    }
  }
};

window.changeCommentsPage = async function(containerId, novelId, chapterNum, page) {
  window._commentsPageState = window._commentsPageState || {};
  const chStr = chapterNum !== undefined ? String(chapterNum).trim() : '0';
  const pageKey = `${containerId}:${novelId}:${chStr}`;
  window._commentsPageState[pageKey] = page;
  await renderCommentsWidget(containerId, novelId, chapterNum, page);
  const wrap = document.getElementById(`ig-comments-wrap-${containerId}`);
  if (wrap) {
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.openCommentReply = function(commentId, authorName) {
  if (!window.IS_LOGGED_IN) {
    showToast('Please log in to reply to comments.');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  // Close other open reply boxes
  document.querySelectorAll('.rp-ig-inline-reply-box').forEach(box => {
    box.style.display = 'none';
  });

  const replyBox = document.getElementById(`ig-reply-box-${commentId}`);
  if (replyBox) {
    replyBox.style.display = 'flex';
    const tagUser = document.getElementById(`ig-reply-to-user-${commentId}`);
    if (tagUser) tagUser.textContent = `@${authorName}`;
    
    const replyEditorId = `reply-${commentId}`;
    attachEditorListeners(replyEditorId);

    const editor = document.getElementById(`comment-editor-${replyEditorId}`);
    if (editor) {
      editor.focus();
      saveEditorRange(replyEditorId);
    }
  }
};

window.closeCommentReply = function(commentId) {
  const replyBox = document.getElementById(`ig-reply-box-${commentId}`);
  if (replyBox) {
    replyBox.style.display = 'none';
  }
  const replyEditorId = `reply-${commentId}`;
  if (window.rpDraftAttachments && window.rpDraftAttachments[replyEditorId]) {
    delete window.rpDraftAttachments[replyEditorId];
    renderAttachmentPreview(replyEditorId);
  }
  const editor = document.getElementById(`comment-editor-${replyEditorId}`);
  if (editor) {
    editor.innerHTML = '';
  }
};

window.handleReplySubmit = async function(parentId, novelId, chapterNum, containerId) {
  if (!window.IS_LOGGED_IN) {
    showToast('Please log in to post a reply.');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  const replyEditorId = `reply-${parentId}`;
  const editor = document.getElementById(`comment-editor-${replyEditorId}`);
  const input = document.getElementById(`ig-reply-input-${parentId}`);
  const submitBtn = document.getElementById(`ig-reply-submit-${parentId}`);

  let contentToPost = '';
  if (editor) {
    let html = editor.innerHTML.trim();
    const textContent = (editor.textContent || editor.innerText || '').trim();
    const hasImages = editor.querySelectorAll('img').length > 0;
    const draftAttachment = window.rpDraftAttachments && window.rpDraftAttachments[replyEditorId];

    if (draftAttachment && !hasImages) {
      html += `<p><img src="${draftAttachment.url}" alt="${escapeQuotes(draftAttachment.name)}" class="rp-comment-img" loading="lazy" /></p>`;
    }

    if (!textContent && !hasImages && !draftAttachment) {
      showToast('Please enter your reply or attach an image/GIF.');
      return;
    }
    contentToPost = html;
  } else if (input) {
    contentToPost = input.value.trim();
    if (!contentToPost) {
      showToast('Please enter your reply.');
      return;
    }
  }

  contentToPost = ensureAllUrlsLinked(contentToPost);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }

  try {
    const res = await apiFetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novelId,
        chapterNum,
        content: contentToPost,
        parentId
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to post reply.');
      return;
    }

    if (editor) editor.innerHTML = '';
    if (input) input.value = '';
    if (window.rpDraftAttachments) {
      delete window.rpDraftAttachments[replyEditorId];
    }
    window.closeCommentReply(parentId);

    showToast('Reply posted successfully! 💬');
    await renderCommentsWidget(containerId, novelId, chapterNum, 999999);
    setTimeout(() => {
      const feed = document.getElementById(`ig-feed-${containerId}`);
      if (feed && feed.lastElementChild) {
        feed.lastElementChild.scrollIntoView({ behavior: 'smooth' });
      }
    }, 250);
  } catch (err) {
    console.error('Reply submit error:', err);
    showToast('Network error posting reply.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Reply';
    }
  }
};

window.toggleReplies = function(commentId) {
  const list = document.getElementById(`ig-replies-list-${commentId}`);
  const textEl = document.getElementById(`ig-toggle-text-${commentId}`);
  if (!list) return;

  const isHidden = list.style.display === 'none';
  if (isHidden) {
    list.style.display = 'flex';
    window._rpExpandedReplies.add(commentId);
    if (textEl) textEl.textContent = 'Hide replies';
    hydrateLinkPreviews(list);
  } else {
    list.style.display = 'none';
    window._rpExpandedReplies.delete(commentId);
    const count = list.querySelectorAll('.rp-ig-comment-row.is-reply').length;
    if (textEl) textEl.textContent = `View ${count} ${count === 1 ? 'reply' : 'replies'}`;
  }
};

window.handleCommentLike = async function(commentId, novelId, chapterNum, containerId) {
  if (!window.IS_LOGGED_IN) {
    showToast('Please log in to like this comment.');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  const heartBtn = document.getElementById(`ig-heart-btn-${commentId}`);
  const heartIcon = heartBtn ? heartBtn.querySelector('.rp-ig-heart-icon') : null;
  const countEl = document.getElementById(`ig-likes-count-${commentId}`);

  const previouslyLiked = heartBtn ? heartBtn.classList.contains('liked') : false;
  const newLiked = !previouslyLiked;

  // Optimistic UI update
  if (heartBtn) {
    heartBtn.classList.toggle('liked', newLiked);
    if (heartIcon) heartIcon.textContent = newLiked ? '❤️' : '🤍';
    heartBtn.setAttribute('title', newLiked ? 'Unlike comment' : 'Like comment');
  }

  if (countEl) {
    let currentCount = parseInt(countEl.textContent || '0', 10);
    if (isNaN(currentCount)) currentCount = 0;
    const optimisticCount = Math.max(0, currentCount + (newLiked ? 1 : -1));
    countEl.textContent = `${optimisticCount} ${optimisticCount === 1 ? 'like' : 'likes'}`;
    countEl.style.display = optimisticCount > 0 ? '' : 'none';
  }

  try {
    const res = await apiFetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Revert optimistic update
      if (heartBtn) {
        heartBtn.classList.toggle('liked', previouslyLiked);
        if (heartIcon) heartIcon.textContent = previouslyLiked ? '❤️' : '🤍';
      }
      showToast(data.error || 'Failed to update like.');
      return;
    }

    // Reconcile with server response
    if (heartBtn) {
      heartBtn.classList.toggle('liked', Boolean(data.hasLiked));
      if (heartIcon) heartIcon.textContent = data.hasLiked ? '❤️' : '🤍';
    }
    if (countEl) {
      const serverCount = Number(data.likesCount || 0);
      countEl.textContent = `${serverCount} ${serverCount === 1 ? 'like' : 'likes'}`;
      countEl.style.display = serverCount > 0 ? '' : 'none';
    }
  } catch (err) {
    console.error('Like toggle error:', err);
    if (heartBtn) {
      heartBtn.classList.toggle('liked', previouslyLiked);
      if (heartIcon) heartIcon.textContent = previouslyLiked ? '❤️' : '🤍';
    }
    showToast('Network error.');
  }
};

window.handleCommentEdit = function(commentId) {
  const textEl = document.getElementById(`ig-comment-text-${commentId}`);
  const editBox = document.getElementById(`ig-edit-box-${commentId}`);
  const metaBar = document.getElementById(`ig-meta-bar-${commentId}`);
  if (textEl && editBox) {
    textEl.style.display = 'none';
    if (metaBar) metaBar.style.display = 'none';
    editBox.style.display = 'flex';
    const textarea = document.getElementById(`ig-edit-textarea-${commentId}`);
    if (textarea) textarea.focus();
  }
};

window.handleCommentCancelEdit = function(commentId) {
  const textEl = document.getElementById(`ig-comment-text-${commentId}`);
  const editBox = document.getElementById(`ig-edit-box-${commentId}`);
  const metaBar = document.getElementById(`ig-meta-bar-${commentId}`);
  if (textEl && editBox) {
    textEl.style.display = '';
    if (metaBar) metaBar.style.display = 'flex';
    editBox.style.display = 'none';
  }
};

window.handleCommentSave = async function(commentId, novelId, chapterNum, containerId) {
  const editInput = document.getElementById(`ig-edit-textarea-${commentId}`);
  const rawContent = editInput ? editInput.value.trim() : '';

  if (!rawContent) {
    showToast('Comment cannot be empty.');
    return;
  }

  const contentToSave = ensureAllUrlsLinked(autoLinkifyText(rawContent));

  try {
    const res = await apiFetch('/api/comments/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, content: contentToSave })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update.');
      return;
    }

    showToast(t('comments_update_success') || 'Comment updated successfully!');
    await renderCommentsWidget(containerId, novelId, chapterNum);
  } catch (err) {
    console.error('Comment save error:', err);
    showToast('Network error.');
  }
};

window.handleCommentDelete = async function(commentId, novelId, chapterNum, containerId) {
  if (!confirm(t('comments_delete_confirm') || 'Are you sure you want to delete this comment?')) {
    return;
  }

  try {
    const res = await apiFetch('/api/comments/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete.');
      return;
    }

    showToast(t('comments_delete_success') || 'Comment deleted.');
    await renderCommentsWidget(containerId, novelId, chapterNum);
  } catch (err) {
    console.error('Comment delete error:', err);
    showToast('Network error.');
  }
};

window.renderReactionsWidget = renderReactionsWidget;
window.renderCommentsWidget = renderCommentsWidget;
