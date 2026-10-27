import fs from 'node:fs';

// 1. CSS to append to forum.css
const cssToAdd = `
/* ============================================================================
   CLICKABLE SUBTITLES & DEDICATED SUBPAGE STYLES
   ============================================================================ */

.forms-sub-title-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #1A0B2E;
  transition: all 0.2s ease;
  cursor: pointer;
}

.forms-sub-title-link:hover .forms-sub-title {
  color: #C89B3C;
  text-decoration: underline;
}

.forms-sub-link-arrow {
  font-size: 12px;
  color: #94A3B8;
  opacity: 0.7;
  transition: transform 0.2s ease, opacity 0.2s ease, color 0.2s ease;
}

.forms-sub-title-link:hover .forms-sub-link-arrow {
  transform: translateX(4px);
  opacity: 1;
  color: #C89B3C;
}

.forms-sub-badge-link {
  font-size: 11px;
  color: #B88635;
  font-weight: 700;
  text-decoration: none;
  background: #FAF7F2;
  border: 1px solid #E8DCCB;
  padding: 3px 9px;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.forms-sub-badge-link:hover {
  background: #C89B3C;
  color: #FFFFFF;
  border-color: #C89B3C;
}

/* Dedicated Subtitle Page Header */
.forms-subpage-header-bar {
  background: #FFFFFF;
  border: 1px solid #E8DCCB;
  border-radius: 12px;
  padding: 18px 24px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: 0 4px 15px rgba(26, 11, 46, 0.04);
}

.forms-subpage-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.forms-subpage-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #FAF7F2 0%, #F5EFEB 100%);
  border: 1px solid #E8DCCB;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.forms-subpage-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  color: #1A0B2E;
  margin: 0 0 4px;
}

.forms-subpage-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #64748B;
}

.forms-subpage-cat-tag {
  background: #FAF5EC;
  color: #B88635;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid #E8DCCB;
}

/* Subtitle Content Titles Card */
.forms-subpage-articles-card {
  background: #FFFFFF;
  border: 1px solid #EDE8E1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}

.forms-subpage-card-header {
  padding: 16px 20px;
  background: #FAF7F2;
  border-bottom: 1px solid #EDE8E1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.forms-subpage-card-title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  color: #1A0B2E;
  margin: 0;
}

.forms-subpage-card-hint {
  font-size: 12px;
  color: #64748B;
}

.forms-subpage-articles-list {
  display: flex;
  flex-direction: column;
}

.forms-subpage-article-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #F1ECE4;
  text-decoration: none;
  transition: all 0.2s ease;
  background: #FFFFFF;
}

.forms-subpage-article-row:last-child {
  border-bottom: none;
}

.forms-subpage-article-row:hover {
  background: #FFFDF9;
  padding-left: 24px;
}

.forms-subpage-row-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1A0B2E;
  margin-bottom: 6px;
  transition: color 0.2s ease;
}

.forms-subpage-article-row:hover .forms-subpage-row-title {
  color: #C89B3C;
}

.forms-subpage-row-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: #64748B;
  flex-wrap: wrap;
}

.forms-subpage-row-arrow {
  color: #B88635;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: #FAF5EC;
  border: 1px solid #E8DCCB;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.forms-subpage-article-row:hover .forms-subpage-row-arrow {
  background: #C89B3C;
  color: #FFFFFF;
  border-color: #C89B3C;
}

.forms-subpage-empty {
  padding: 50px 20px;
  text-align: center;
  color: #64748B;
}
`;

function updateCss(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');
  if (!css.includes('.forms-sub-title-link')) {
    css += '\n' + cssToAdd;
    fs.writeFileSync(filePath, css, 'utf8');
    console.log('Appended CSS to', filePath);
  }
}

updateCss('src/css/forum.css');
updateCss('frontend/src/css/forum.css');

