// Rudhra Prarthana Novels — Dynamic Social Media Link Previews & Open Graph Engine
// Generates professional Open Graph, Twitter Cards, and Schema.org metadata for
// WhatsApp, Facebook, Instagram, Twitter, and other social media crawlers.

import { queryOne } from './db.js';

const PRIMARY_PUBLIC_DOMAIN = 'https://frontend-snowy-five-81.vercel.app';
const SITE_NAME = 'Rudhra Prarthana Novels';
const SITE_BRAND_DOMAIN = 'rudhraprarthananovels.com';
const DEFAULT_LOGO_RELATIVE = '/images/logo.png';
const DEFAULT_FALLBACK_DESC = 'Explore captivating novels by author Rudhra Prarthana, enjoy comfortable distraction-free reading, audio novels, and join our vibrant reader community.';

/**
 * Clean HTML markup to produce plain text excerpt for previews
 */
function cleanExcerpt(rawHtml, maxLength = 180) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const text = rawHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 60 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Extract YouTube thumbnail or first <img> from raw content if no cover image
 */
function extractFirstImage(content) {
  if (!content || typeof content !== 'string') return null;

  // 1. YouTube video thumbnail
  const ytMatch = content.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 2. Direct HTML <img> src
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1].trim();
  }

  return null;
}

/**
 * Resolve absolute publicly accessible HTTPS URL
 */
function toAbsoluteUrl(urlStr, baseUrl = PRIMARY_PUBLIC_DOMAIN) {
  if (!urlStr) return `${baseUrl}${DEFAULT_LOGO_RELATIVE}`;
  const trimmed = String(urlStr).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Determine caller host to preserve canonical public URL
 */
function resolveBaseUrl(req) {
  if (!req) return PRIMARY_PUBLIC_DOMAIN;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  
  if (host.includes('rudhraprarthananovels.com')) {
    return 'https://rudhraprarthananovels.com';
  }
  if (host.includes('vercel.app')) {
    return `https://${host}`;
  }
  return PRIMARY_PUBLIC_DOMAIN;
}

/**
 * Query database and build dynamic metadata
 */
export async function resolveContentMetadata(identifier, req = null) {
  const baseUrl = resolveBaseUrl(req);
  const logoUrl = `${baseUrl}${DEFAULT_LOGO_RELATIVE}`;
  const cleanId = identifier ? String(identifier).trim() : '';

  // Default fallback for homepage or unknown
  const fallback = {
    title: `${SITE_NAME} — Premium Literary Novel Community`,
    rawTitle: SITE_NAME,
    description: DEFAULT_FALLBACK_DESC,
    image: logoUrl,
    type: 'website',
    siteName: SITE_NAME,
    brandDomain: SITE_BRAND_DOMAIN,
    canonicalUrl: `${baseUrl}/share`,
    targetUrl: `${baseUrl}/#forms`,
    author: 'Rudhra Prarthana',
    category: 'Novels & Community'
  };

  if (!cleanId) return fallback;

  let decodedId = cleanId;
  try {
    decodedId = decodeURIComponent(cleanId).trim();
  } catch {}

  // 1. Try content_articles (Novels, Chapters, Forum Threads, Announcements)
  try {
    const article = await queryOne(`
      SELECT a.*, 
             m.title as main_category_title,
             s.title as sub_category_title,
             ps.title as parent_sub_category_title,
             p.avatar as author_avatar
      FROM content_articles a
      LEFT JOIN forum_categories m ON m.id = a.main_category_id
      LEFT JOIN content_subcategories s ON s.id = a.sub_category_id
      LEFT JOIN content_subcategories ps ON ps.id = s.parent_id
      LEFT JOIN profiles p ON p.user_id = a.author_id
      WHERE a.unique_slug = ? OR a.unique_slug = ? OR CAST(a.id AS CHAR) = ? OR CAST(a.id AS CHAR) = ?
      LIMIT 1;
    `, [cleanId, decodedId, cleanId, decodedId]);

    if (article) {
      const artTitle = article.title?.trim() || 'Untitled Release';
      const author = article.author_name?.trim() || 'Rudhra Prarthana';
      const category = article.sub_category_title || article.main_category_title || 'Novel';

      // Build rich description
      let excerpt = cleanExcerpt(article.summary);
      if (!excerpt) {
        excerpt = cleanExcerpt(article.content);
      }
      if (!excerpt || excerpt.length < 20) {
        excerpt = `${artTitle} — Written by ${author}. Explore discussions, episodes, and reader feedback on ${SITE_NAME}.`;
      }

      // Resolve best cover image
      let cover = article.cover_image?.trim() || null;
      if (!cover) {
        cover = extractFirstImage(article.content);
      }
      const absoluteImage = toAbsoluteUrl(cover, baseUrl);

      const shareSlug = article.unique_slug || article.id;
      const shareUrl = `${baseUrl}/share?id=${encodeURIComponent(shareSlug)}`;
      const targetUrl = `${baseUrl}/#thread?id=${encodeURIComponent(shareSlug)}`;

      const pageTitle = `${artTitle} — ${category ? category + ' — ' : ''}${SITE_NAME}`;

      return {
        title: pageTitle,
        rawTitle: artTitle,
        description: excerpt,
        image: absoluteImage,
        type: 'article',
        siteName: SITE_NAME,
        brandDomain: SITE_BRAND_DOMAIN,
        canonicalUrl: shareUrl,
        targetUrl: targetUrl,
        author: author,
        category: category,
        publishedTime: article.published_at || article.created_at
      };
    }
  } catch (err) {
    console.warn('[Share-Metadata] Article lookup error:', err.message);
  }

  // 2. Try content_subcategories (Novel series, specific sub-forums)
  try {
    const sub = await queryOne(`
      SELECT s.*, m.title as main_category_title
      FROM content_subcategories s
      LEFT JOIN forum_categories m ON m.id = s.main_category_id
      WHERE s.id = ? OR CAST(s.id AS CHAR) = ?
      LIMIT 1;
    `, [cleanId, cleanId]);

    if (sub) {
      const subTitle = sub.title?.trim() || 'Novel Series';
      const desc = cleanExcerpt(sub.description) || `Explore ${subTitle} by author Rudhra Prarthana with episode lists, reader reviews, and community discussions.`;
      const shareUrl = `${baseUrl}/share?id=${encodeURIComponent(sub.id)}`;
      const targetUrl = `${baseUrl}/#forms?sub=${encodeURIComponent(sub.id)}`;

      return {
        title: `${subTitle} — ${SITE_NAME}`,
        rawTitle: subTitle,
        description: desc,
        image: logoUrl,
        type: 'website',
        siteName: SITE_NAME,
        brandDomain: SITE_BRAND_DOMAIN,
        canonicalUrl: shareUrl,
        targetUrl: targetUrl,
        author: 'Rudhra Prarthana',
        category: sub.main_category_title || 'Novel Series'
      };
    }
  } catch (err) {
    console.warn('[Share-Metadata] Subcategory lookup error:', err.message);
  }

  // 3. Try forum_categories (Main categories)
  try {
    const cat = await queryOne(`
      SELECT * FROM forum_categories WHERE id = ? LIMIT 1;
    `, [cleanId]);

    if (cat) {
      const catTitle = cat.title?.trim() || 'Community Category';
      const shareUrl = `${baseUrl}/share?id=${encodeURIComponent(cat.id)}`;
      const targetUrl = `${baseUrl}/#forms?category=${encodeURIComponent(cat.id)}`;

      return {
        title: `${catTitle} — ${SITE_NAME}`,
        rawTitle: catTitle,
        description: `Explore novels, stories, audio releases, and member discussions in ${catTitle} on ${SITE_NAME}.`,
        image: logoUrl,
        type: 'website',
        siteName: SITE_NAME,
        brandDomain: SITE_BRAND_DOMAIN,
        canonicalUrl: shareUrl,
        targetUrl: targetUrl,
        author: 'Rudhra Prarthana',
        category: catTitle
      };
    }
  } catch (err) {
    console.warn('[Share-Metadata] Category lookup error:', err.message);
  }

  // 4. Try member profile
  try {
    const user = await queryOne(`
      SELECT u.id, u.username, u.role, p.display_name, p.bio, p.avatar
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE CAST(u.id AS CHAR) = ? OR u.username = ?
      LIMIT 1;
    `, [cleanId, cleanId]);

    if (user) {
      const displayName = user.display_name?.trim() || user.username;
      const shareUrl = `${baseUrl}/share?id=${encodeURIComponent(user.id)}`;
      const targetUrl = `${baseUrl}/#member?id=${encodeURIComponent(user.id)}`;
      const avatarUrl = toAbsoluteUrl(user.avatar, baseUrl);

      return {
        title: `${displayName} (@${user.username}) — ${SITE_NAME}`,
        rawTitle: displayName,
        description: cleanExcerpt(user.bio) || `View ${displayName}'s profile, published comments, and reading activity on ${SITE_NAME}.`,
        image: avatarUrl,
        type: 'profile',
        siteName: SITE_NAME,
        brandDomain: SITE_BRAND_DOMAIN,
        canonicalUrl: shareUrl,
        targetUrl: targetUrl,
        author: displayName,
        category: user.role || 'Member'
      };
    }
  } catch (err) {
    console.warn('[Share-Metadata] Member lookup error:', err.message);
  }

  return fallback;
}

/**
 * Escape HTML attributes and content for safe output
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate full HTML document with Open Graph, Twitter Cards, Schema.org, and instant client redirect
 */
export function renderShareHtml(meta) {
  const safeTitle = escapeHtml(meta.title);
  const safeRawTitle = escapeHtml(meta.rawTitle || meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.image);
  const safeUrl = escapeHtml(meta.canonicalUrl);
  const safeTargetUrl = escapeHtml(meta.targetUrl);
  const safeSiteName = escapeHtml(meta.siteName || SITE_NAME);
  const safeDomain = escapeHtml(meta.brandDomain || SITE_BRAND_DOMAIN);
  const safeAuthor = escapeHtml(meta.author || 'Rudhra Prarthana');
  const safeType = escapeHtml(meta.type || 'article');

  return `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${safeUrl}">
  <link rel="icon" type="image/png" href="/images/logo.png">

  <!-- Open Graph / Facebook / WhatsApp / Instagram -->
  <meta property="og:site_name" content="${safeSiteName}">
  <meta property="og:type" content="${safeType}">
  <meta property="og:title" content="${safeRawTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:alt" content="${safeRawTitle}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:locale" content="en_US">
  ${meta.publishedTime ? `<meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}">` : ''}
  ${meta.author ? `<meta property="article:author" content="${safeAuthor}">` : ''}

  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@rudhraprarthana">
  <meta name="twitter:creator" content="@rudhraprarthana">
  <meta name="twitter:title" content="${safeRawTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="twitter:image:alt" content="${safeRawTitle}">
  <meta name="twitter:url" content="${safeUrl}">

  <!-- WhatsApp & Messaging Embed Hints -->
  <meta itemprop="name" content="${safeRawTitle}">
  <meta itemprop="description" content="${safeDesc}">
  <meta itemprop="image" content="${safeImage}">

  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${meta.type === 'article' ? 'Article' : 'WebPage'}",
    "headline": "${safeRawTitle.replace(/"/g, '\\"')}",
    "description": "${safeDesc.replace(/"/g, '\\"')}",
    "image": "${safeImage}",
    "url": "${safeUrl}",
    "publisher": {
      "@type": "Organization",
      "name": "${safeSiteName.replace(/"/g, '\\"')}",
      "logo": {
        "@type": "ImageObject",
        "url": "${meta.image}"
      }
    },
    "author": {
      "@type": "Person",
      "name": "${safeAuthor.replace(/"/g, '\\"')}"
    }
  }
  </script>

  <!-- Immediate Client-Side Redirection for Browser Visitors -->
  <!-- Note: Social scrapers (WhatsApp/Facebook) ignore JS and crawl raw meta tags -->
  <script>
    (function() {
      var target = ${JSON.stringify(meta.targetUrl)};
      if (target) {
        window.location.replace(target);
      }
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeTargetUrl}">
  </noscript>

  <style>
    :root {
      --bg: #FAF5EC;
      --card-bg: #FFFFFF;
      --navy: #1A0B2E;
      --gold: #C89B3C;
      --text-muted: #64748B;
      --border: rgba(200, 155, 60, 0.3);
    }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--navy);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .preview-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(26, 11, 46, 0.12);
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      text-align: left;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(200, 155, 60, 0.2);
      background: rgba(200, 155, 60, 0.04);
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--gold);
      object-fit: cover;
    }
    .brand-name {
      font-weight: 700;
      font-size: 14px;
      color: var(--navy);
    }
    .brand-domain {
      font-size: 11px;
      color: var(--gold);
      margin-left: auto;
      font-weight: 600;
    }
    .cover-wrap {
      width: 100%;
      max-height: 280px;
      background: #1A0B2E;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .cover-img {
      width: 100%;
      height: auto;
      max-height: 280px;
      object-fit: cover;
      display: block;
    }
    .content-wrap {
      padding: 20px 22px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: var(--navy);
      margin: 0 0 10px;
      line-height: 1.35;
    }
    .desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.55;
      margin: 0 0 18px;
    }
    .cta-btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      padding: 12px 20px;
      background: linear-gradient(135deg, #C89B3C 0%, #B88635 100%);
      color: #FFFFFF;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(200, 155, 60, 0.35);
      transition: transform 0.15s ease;
    }
    .cta-btn:hover {
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="preview-card">
    <div class="brand-bar">
      <img src="${safeImage}" alt="${safeSiteName}" class="brand-logo" onerror="this.src='/images/logo.png'">
      <span class="brand-name">${safeSiteName}</span>
      <span class="brand-domain">${safeDomain}</span>
    </div>
    <div class="cover-wrap">
      <img src="${safeImage}" alt="${safeRawTitle}" class="cover-img" onerror="this.src='/images/logo.png'">
    </div>
    <div class="content-wrap">
      <h1 class="title">${safeRawTitle}</h1>
      <p class="desc">${safeDesc}</p>
      <a href="${safeTargetUrl}" class="cta-btn">Read on Rudhra Prarthana Novels →</a>
    </div>
  </div>
</body>
</html>`;
}
