// Comprehensive Verification Suite for Auto-Detect Pasted Links & Embed Previews
import assert from 'node:assert';
import fs from 'node:fs';

// Setup minimal browser globals for Node.js execution of client functions
globalThis.window = {
  CURRENT_USER: null,
  IS_LOGGED_IN: false,
  addEventListener: () => {},
  removeEventListener: () => {},
  getSelection: () => null
};

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Simple DOMParser shim for node testing of extractCommentEmbeds / ensureAllUrlsLinked
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.childNodes = [];
    this.attributes = {};
    this.parentNode = null;
  }
  getAttribute(name) {
    return this.attributes[name.toLowerCase()] || null;
  }
  setAttribute(name, val) {
    this.attributes[name.toLowerCase()] = String(val);
  }
  removeAttribute(name) {
    delete this.attributes[name.toLowerCase()];
  }
  querySelectorAll(sel) {
    const results = [];
    const check = (node) => {
      if (node.nodeType === 1) {
        if (sel === 'a[href]' && node.tagName === 'A' && node.attributes['href']) {
          results.push(node);
        }
      }
      for (const ch of node.childNodes || []) check(ch);
    };
    check(this);
    return results;
  }
}

class MockTextNode {
  constructor(text = '') {
    this.nodeType = 3;
    this.nodeName = '#text';
    this.textContent = text;
    this.parentNode = null;
  }
}

globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
globalThis.NodeFilter = { SHOW_TEXT: 4 };

globalThis.DOMParser = class {
  parseFromString(str, type) {
    const body = new MockElement('body');
    // Extract <a> tags with hrefs
    const aRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = aRegex.exec(str)) !== null) {
      const a = new MockElement('a');
      a.setAttribute('href', m[1]);
      a.textContent = m[2];
      a.parentNode = body;
      body.childNodes.push(a);
    }
    // Also add text node for text scanning
    const textNode = new MockTextNode(str);
    textNode.parentNode = body;
    body.childNodes.push(textNode);
    return {
      body,
      querySelectorAll: (sel) => body.querySelectorAll(sel),
      createElement: (tag) => new MockElement(tag)
    };
  }
};

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createTreeWalker: (root) => {
    let index = 0;
    const textNodes = root.childNodes.filter(n => n.nodeType === 3);
    return {
      nextNode: () => {
        if (index < textNodes.length) return textNodes[index++];
        return null;
      }
    };
  },
  createElement: (tag) => new MockElement(tag)
};

// Now import the functions to test
const commentsJsPath = 'frontend/src/js/comments.js';
const commentsJsContent = fs.readFileSync(commentsJsPath, 'utf8');

import { sanitizeCommentHtml, addComment, getComments, fetchLinkPreview } from '../backend/comments.js';

async function runVerification() {
  const {
    autoLinkifyText,
    parseEmbedInfo,
    extractCommentEmbeds,
    renderCommentEmbeds,
    renderCommentToolbarHtml
  } = await import('../frontend/src/js/comments.js');
  console.log('====================================================');
  console.log('Starting Verification Suite for Link Previews & Auto-Detect');
  console.log('====================================================\n');

  // Test 1: Link Button Removal from Toolbar
  console.log('[Test 1] Verifying link-insertion button removal from toolbar...');
  const toolbarHtml = renderCommentToolbarHtml('test-editor');
  assert(!toolbarHtml.includes('openLinkPrompt'), 'Link button prompt should not exist in toolbar');
  assert(!toolbarHtml.includes('🔗'), 'Link button emoji should not exist in toolbar');
  assert(!toolbarHtml.includes('Insert Link'), 'Insert Link text should not exist in toolbar');

  // Confirm other controls remain intact
  assert(toolbarHtml.includes('bold'), 'Bold button must remain');
  assert(toolbarHtml.includes('italic'), 'Italic button must remain');
  assert(toolbarHtml.includes('underline'), 'Underline button must remain');
  assert(toolbarHtml.includes('strikeThrough'), 'Strikethrough button must remain');
  assert(toolbarHtml.includes('justifyLeft'), 'Justify Left button must remain');
  assert(toolbarHtml.includes('insertUnorderedList'), 'Bulleted list button must remain');
  assert(toolbarHtml.includes('toggleCommentEmojiPicker'), 'Emoji picker must remain');
  assert(toolbarHtml.includes("triggerMediaUpload('test-editor', 'image')"), 'Image upload must remain');
  assert(toolbarHtml.includes("triggerMediaUpload('test-editor', 'gif')"), 'GIF upload must remain');
  assert(toolbarHtml.includes('removeFormat'), 'Clear formatting must remain');
  console.log('✓ Passed: Link button removed and all other toolbar controls preserved.\n');

  // Test 2: Auto-detecting pasted links & preserving text
  console.log('[Test 2] Verifying auto-linkify of pasted text & multiple URLs...');
  const textWithUrls = 'Hello readers! Check out https://www.youtube.com/watch?v=dQw4w9WgXcQ and this picture https://example.com/cover.png for reference.';
  const linkified = autoLinkifyText(textWithUrls);
  assert(linkified.includes('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"'), 'YouTube link must be created');
  assert(linkified.includes('<a href="https://example.com/cover.png"'), 'Image link must be created');
  assert(linkified.includes('Hello readers! Check out'), 'Text before URL must be preserved');
  assert(linkified.includes('and this picture'), 'Text between URLs must be preserved');
  assert(linkified.includes('for reference.'), 'Text after URLs must be preserved');
  console.log('✓ Passed: Text and multiple URLs entered together are preserved and linkified.\n');

  // Test 3: YouTube URL Formats
  console.log('[Test 3] Verifying YouTube URL detection and video ID extraction...');
  const ytCases = [
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
    { url: 'https://youtu.be/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
    { url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expectedId: 'dQw4w9WgXcQ' }
  ];

  for (const tc of ytCases) {
    const info = parseEmbedInfo(tc.url);
    assert(info, `Expected embed info for ${tc.url}`);
    assert.strictEqual(info.type, 'youtube');
    assert.strictEqual(info.videoId, tc.expectedId);
  }
  console.log('✓ Passed: All common YouTube formats (watch, youtu.be, shorts, mobile, embed) correctly recognized.\n');

  // Test 4: Vimeo, Image, and Other Website URLs
  console.log('[Test 4] Verifying Vimeo & Image URL detection...');
  const vimeoInfo = parseEmbedInfo('https://vimeo.com/76979871');
  assert(vimeoInfo && vimeoInfo.type === 'vimeo' && vimeoInfo.videoId === '76979871', 'Vimeo embed info failed');

  const imgInfo = parseEmbedInfo('https://images.unsplash.com/photo-test.jpg');
  assert(imgInfo && imgInfo.type === 'image', 'Direct image embed info failed');

  const websiteInfo = parseEmbedInfo('https://en.wikipedia.org/wiki/Novel');
  assert(websiteInfo && websiteInfo.type === 'link' && websiteInfo.hostname === 'en.wikipedia.org', 'Website embed info failed');
  console.log('✓ Passed: Vimeo, Direct Image, and General Website URLs correctly categorized.\n');

  // Test 5: Embed HTML Security (Iframe sandboxing, referrerpolicy, trusted origin)
  console.log('[Test 5] Verifying secure embed rendering restrictions...');
  const commentWithYt = '<p>Must listen! <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="rp-comment-link">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></p>';
  const embedsHtml = renderCommentEmbeds(commentWithYt, 101);
  assert(embedsHtml.includes('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'Must use youtube-nocookie secure origin');
  assert(embedsHtml.includes('sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"'), 'Must have sandbox attribute');
  assert(embedsHtml.includes('referrerpolicy="strict-origin-when-cross-origin"'), 'Must have strict referrer policy');
  assert(embedsHtml.includes('loading="lazy"'), 'Must have lazy loading');
  assert(embedsHtml.includes('Watch on YouTube ↗'), 'Must provide safe clickable source link');
  console.log('✓ Passed: Secure iframe sandboxing and restrictions verified.\n');

  // Test 6: Server Sanitization (Prevent XSS and unauthorized iframes)
  console.log('[Test 6] Verifying server-side sanitization against XSS & arbitrary iframes...');
  const maliciousInput = '<p>Check this <iframe src="http://attacker.com/malicious"></iframe> <script>alert(1)</script> <a href="javascript:alert(1)">bad link</a></p>';
  const cleanServerHtml = sanitizeCommentHtml(maliciousInput);
  assert(!cleanServerHtml.includes('<iframe'), 'Server must strip arbitrary iframes');
  assert(!cleanServerHtml.includes('<script'), 'Server must strip scripts');
  assert(!cleanServerHtml.includes('javascript:'), 'Server must strip javascript: links');
  console.log('✓ Passed: Arbitrary iframes and scripts rejected by server sanitization.\n');

  // Test 7: SSRF & Private Network Protection for Link Preview Service
  console.log('[Test 7] Verifying backend SSRF & private IP protection...');
  const blockedHosts = [
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://10.0.0.1/admin',
    'http://192.168.1.1/router',
    'http://169.254.169.254/latest/meta-data',
    'javascript:alert(1)',
    'file:///etc/passwd'
  ];

  for (const blocked of blockedHosts) {
    const res = await fetchLinkPreview(blocked);
    assert.strictEqual(res.success, false, `SSRF check failed to block: ${blocked}`);
  }
  console.log('✓ Passed: All private IPs, link-local, loopback, and unsafe protocols blocked.\n');

  // Test 8: End-to-End Novel Comment Flow with URL and Embeds in Database
  console.log('[Test 8] Testing live comment submission, storage, and retrieval with URLs...');
  const testNovelId = 'nenjam-marappadhillai';
  const testUserId = 28; // Registered user Harish
  const commentContent = `<p>Check out our novel trailer <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="rp-comment-link">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a> and cover <a href="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c.jpg" class="rp-comment-link">https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c.jpg</a></p>`;

  const addResult = await addComment({
    novelId: testNovelId,
    chapterNum: 0,
    userId: testUserId,
    content: commentContent
  });
  assert(addResult.success, 'addComment failed: ' + (addResult.error || ''));

  const createdId = addResult.comment.id;
  console.log(`Created test comment ID: ${createdId}`);

  try {
    // Retrieve comments
    const comments = await getComments({ novelId: testNovelId, chapterNum: 0 });
    const retrieved = comments.find(c => c.id === createdId);
    assert(retrieved, 'Created comment could not be found');

    // Verify embed parsing on retrieved comment
    const retrievedEmbeds = extractCommentEmbeds(retrieved.content);
    assert.strictEqual(retrievedEmbeds.length, 2, 'Expected 2 extracted embeds');
    assert.strictEqual(retrievedEmbeds[0].type, 'youtube');
    assert.strictEqual(retrievedEmbeds[0].videoId, 'dQw4w9WgXcQ');
    assert.strictEqual(retrievedEmbeds[1].type, 'image');

    const renderedHtml = renderCommentEmbeds(retrieved.content, retrieved.id);
    assert(renderedHtml.includes('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'Retrieved comment must render YouTube player');
    assert(renderedHtml.includes('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c.jpg'), 'Retrieved comment must render image preview');

    console.log('✓ Passed: End-to-end comment creation, retrieval, and embed rendering verified.\n');
  } finally {
    // Clean up test comment to preserve pristine DB
    const { query } = await import('../backend/db.js');
    await query('DELETE FROM comments WHERE id = ?', [createdId]);
    console.log(`Cleaned up test comment ${createdId} successfully.`);
  }

  console.log('====================================================');
  console.log('ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
