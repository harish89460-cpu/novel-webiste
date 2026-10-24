# RESPONSIVE TEST REPORT: VIEWPORT-BY-VIEWPORT VERIFICATION
**Project:** Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)  
**Date:** October 14, 2026  
**Test Engine:** Microsoft Edge Headless (Blink Rendering Engine) via Chrome DevTools Protocol (CDP)  
**Status:** All 7 Viewports Passed (10/10 Verification Checklist Passed)

---

## 1. Executive Summary

This report documents the multi-viewport automated testing and visual layout verification performed on the **Rudhra Prarthana Novels** WordPress theme.

Every required breakpoint was tested for:
1. **Header layout and height consistency.**
2. **Logo dimensions, aspect ratio (1:1), and absence of overlap.**
3. **Site title visibility, text truncation, and wrapping.**
4. **Navigation icon sizing, spacing, and vertical alignment.**
5. **Hero heading position relative to header (no obscuring).**
6. **Hero description wrapping and artwork composition.**
7. **Hero button geometry (Explore Novels & Join Reader Forum).**
8. **Horizontal overflow (scrollWidth vs clientWidth).**
9. **Desktop navigation visibility vs mobile hamburger drawer.**
10. **Dual-language rendering (English & Tamil typography).**

---

## 2. Multi-Viewport Automated Metrics Matrix

| Viewport Tested | Device Category | Scroll Diff | Header Height | Logo Size | Overlaps | Hamburger | Action Buttons | Hero Title Clearance | Hero Buttons (W × H) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **320 × 568** | iPhone SE / Compact Mobile | **0px** | 61px | 34 × 34px | **None** | 36 × 36px | 36 × 36px | +89px below header | 296 × 48px (Stacked) |
| **360 × 800** | Android Standard | **0px** | 61px | 34 × 34px | **None** | 36 × 36px | 36 × 36px | +253px below header | 300 × 48px (Stacked) |
| **390 × 844** | iPhone 12/13/14 | **0px** | 61px | 36 × 36px | **None** | 38 × 38px | 38 × 38px | +275px below header | 300 × 48px (Stacked) |
| **768 × 1024** | iPad / Tablet Portrait | **0px** | 65px | 38 × 38px | **None** | 38 × 38px | 38 × 38px | +397px below header | 180 × 48px (Side-by-side) |
| **1024 × 768** | iPad / Tablet Landscape | **0px** | 73px | 44 × 44px | **None** | Hidden | 34 × 34px | +259px below header | 180 × 48px (Side-by-side) |
| **1366 × 768** | Standard Laptop | **0px** | 73px | 44 × 44px | **None** | Hidden | 34 × 34px | +246px below header | 180 × 48px (Side-by-side) |
| **1440 × 900** | Full Desktop Display | **0px** | 73px | 44 × 44px | **None** | Hidden | 36 × 36px | +312px below header | 180 × 48px (Side-by-side) |

*All viewports recorded 0px horizontal overflow (scrollWidth == clientWidth).*

---

## 3. Viewport-by-Viewport Detailed Analysis

### 3.1. 320 × 568 (iPhone SE / Compact Mobile)
* **Visual Baseline & Screenshot:** `320x568_iphone_se.png`
* **Header Height:** 61px (60px inner height + 1px gold border).
* **Logo Proportions:** Exactly 34 × 34px. Perfectly circular, centered in its wrapper with 1.5px gold accent ring.
* **Title Visibility:** "Rudhra Prarthana" renders cleanly without clipping; `overflow: hidden; text-overflow: ellipsis` active if font is scaled.
* **Header Controls:**
  * Hamburger button: 36 × 36px on left with 3 horizontal bars (18px × 2px).
  * Search button: 36 × 36px circular button on right with 16px SVG search icon.
  * Notification button: 36 × 36px circular button on right with 16px SVG bell icon.
* **Hero Section:**
  * "WELCOME" pill badge is clearly visible.
  * Hero title "Rudhra Prarthana Novels" starts at Y = 150px (89px clearance beneath header).
  * Subtitle text wraps comfortably to 3 lines without touching screen edges.
  * "Explore Novels ➔" (navy gold-border) and "Join Reader Forum" (translucent white) buttons stack vertically with equal width (296px) and height (48px).
* **Horizontal Overflow:** `0px` (`scrollWidth = 320px`, `clientWidth = 320px`).

### 3.2. 360 × 800 (Android Standard)
* **Visual Baseline & Screenshot:** `360x800_android.png`
* **Header Height:** 61px.
* **Logo Proportions:** 34 × 34px.
* **Title Visibility:** Full title renders with 170px available container width.
* **Hero Section:**
  * Title starts at Y = 314px (253px clearance below header).
  * Background image `mobileview.png` frames the page with flowers at the top and table/books at the bottom.
  * Buttons are 300 × 48px each, stacked with 10px vertical gap.
* **Horizontal Overflow:** `0px` (`scrollWidth = 360px`, `clientWidth = 360px`).

### 3.3. 390 × 844 (iPhone 12 / 13 / 14)
* **Visual Baseline & Screenshot:** `390x844_iphone14.png`
* **Header Height:** 61px.
* **Logo Proportions:** 36 × 36px.
* **Controls:** Hamburger 38 × 38px, Search 38 × 38px, Notification 38 × 38px.
* **Hero Section:**
  * Title starts at Y = 336px.
  * Beautiful artistic balance: flowers top right/left, lake/temple soft watermark in center, table and brass quill safely below the action buttons.
* **Horizontal Overflow:** `0px` (`scrollWidth = 390px`, `clientWidth = 390px`).

### 3.4. 768 × 1024 (iPad / Tablet Portrait)
* **Visual Baseline & Screenshot:** `768x1024_tablet_portrait.png`
* **Header Height:** 65px (64px inner + 1px border).
* **Logo Proportions:** 38 × 38px.
* **Title Visibility:** 538px wide title area.
* **Navigation:** Hamburger button (38 × 38px) manages navigation via slide-in drawer.
* **Hero Section:**
  * Title starts at Y = 462px.
  * Buttons transition to side-by-side alignment (180 × 48px each, 14px gap).
* **Horizontal Overflow:** `0px` (`scrollWidth = 768px`, `clientWidth = 768px`).

### 3.5. 1024 × 768 (iPad / Tablet Landscape)
* **Visual Baseline & Screenshot:** `1024x768_tablet_landscape.png`
* **Header Height:** 73px (72px inner + 1px border).
* **Logo Proportions:** 44 × 44px with 2px gold accent border. Tagline "NOVELS & COMMUNITY" visible below title.
* **Desktop Navigation:** Active. Hamburger button automatically hidden (`display: none`). Links: HOME, FORUM (with "NEW" badge), WHAT'S NEW, MEMBERS, PRATILIPI, CONTACT, YOUTUBE.
* **Action Area:** Search (34 × 34px), Notification (34 × 34px), Log In, and Register buttons.
* **Hero Section:**
  * Title starts at Y = 332px.
  * Desktop background `desktopview.png` active. Content safe frame constrained to 680px width, centered cleanly between the brass quill/books on the left and temple on the right.
* **Horizontal Overflow:** `0px` (`scrollWidth = 1009px`, `clientWidth = 1009px` excluding scrollbar).

### 3.6. 1366 × 768 (Standard Laptop)
* **Visual Baseline & Screenshot:** `1366x768_laptop.png`
* **Header Height:** 73px.
* **Logo Proportions:** 44 × 44px.
* **Layout:** Generous margins, horizontal nav centered, buttons aligned.
* **Hero Section:** Title starts at Y = 319px. Side-by-side action buttons at Y = 515px.
* **Horizontal Overflow:** `0px`.

### 3.7. 1440 × 900 (Desktop Standard)
* **Visual Baseline & Screenshot:** `1440x900_desktop.png`
* **Header Height:** 73px. Max-width container at 1440px.
* **Logo Proportions:** 44 × 44px.
* **Hero Section:**
  * Title starts at Y = 385px.
  * Center safe area allows 100% visibility of the stacked books, brass feather pot, and violet drapery on the left, and the temple with reflection on the right.
* **Horizontal Overflow:** `0px`.

---

## 4. Dual-Language & Unicode Verification (Tamil & English)

Automated tests verified the layout when toggling between English and Tamil (`html[lang="ta"]`):
* **320 × 568 (Tamil):** Overflow = 0px | Title text rendered gracefully within container.
* **360 × 800 (Tamil):** Overflow = 0px | All section headings, card badges, and reader metadata aligned.
* **390 × 844 (Tamil):** Overflow = 0px | Action icons remain pinned to right edge without wrapping.
* **768 × 1024 (Tamil):** Overflow = 0px | Full Tamil title and drawer navigation functional.
* **1440 × 900 (Tamil):** Overflow = 0px | Desktop navigation links render with appropriate Tamil letter-spacing (0px) and Noto Sans Tamil typography.

---

## 5. Verification Checklist Assessment

| Requirement | Target Criteria | Result | Notes |
| :--- | :--- | :---: | :--- |
| **Logo Alignment** | No overlap with site title or hamburger menu | **PASS** | Verified via bounding rect collision detection on all 7 viewports. |
| **Header Icons** | Consistent intended size & vertical alignment | **PASS** | 38×38px (mobile), 36×36px (small mobile), 34–36px (desktop). |
| **Hero Heading** | Completely visible below header | **PASS** | Header bottom = 61–73px; Hero title top = 150–462px. Clearance ≥ 89px. |
| **Description Wrapping** | Natural wrap without colliding with artwork | **PASS** | `max-width: 680px` on desktop and `max-width: 95%` on mobile. |
| **Action Buttons** | Consistently aligned with equal height | **PASS** | Standardized `48px` height on mobile; side-by-side on desktop. |
| **Background Artwork** | Preserves intended composition | **PASS** | Relative URLs normalized; text centered in open sky safe zone. |
| **Horizontal Scroll** | No horizontal scrolling at mobile widths | **PASS** | `scrollWidth == clientWidth` (0px difference across all tests). |
| **Desktop Layout** | Not accidentally constrained to mobile width | **PASS** | Expands fluidly up to 1440px container max. |
| **WordPress Isolation** | WP styles do not distort custom theme | **PASS** | Scoped resets exclude `#wpadminbar` and wpForo forum elements. |
| **Feature Integrity** | Navigation, login, reading still work | **PASS** | 15/15 access control tests passed; drawer and modals intact. |
