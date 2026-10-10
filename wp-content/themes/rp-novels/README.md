# Rudhra Prarthana Novels — WordPress Custom Theme

A bespoke, lightweight, and modern WordPress novel community theme crafted for Tamil literary publishing and reader engagement.

---

## 🌟 Key Features

1. **Brand Identity & Responsive Artworks**:
   - Integrates the official **Rudhra Prarthana Novels** gold-on-navy circular logo.
   - Responsive artwork switching:
     - `desktopview.png` on desktop (`min-width: 769px`)
     - `mobileview.png` on mobile (`max-width: 768px`)
   - Centered content safe area framing the hero content without obscuring the ornate left floral motifs or the golden quill feather.

2. **Custom Post Types & Taxonomies**:
   - `novel`: Custom Post Type for novels with fields for Tamil title, author, audio URL, duration, rating, and featured status.
   - `chapter`: Custom Post Type for chapters linked to parent novels with chapter ordering and reading time calculations.
   - `rp_announcement`: Notice and ticker management.
   - Taxonomies: `genre`, `novel_status`, and `novel_category`.

3. **Immersive Chapter Reader**:
   - Focused 700–800px reading width for comfortable distraction-free reading.
   - Noto Sans Tamil typography with 1.95 line-height and drop cap styling.
   - Real-time reading controls: **A-**, **Reset**, **A+** font sizing.
   - Reading modes: **Light** (White), **Sepia** (Warm Parchment), **Dark** (Deep Navy).
   - Scroll progress indicator bar.
   - Adjacent chapter navigation (Previous / Next).
   - Bookmark reading position with local storage persistence.
   - Social sharing (WhatsApp, Facebook, Native copy).

4. **Community & Plugin Integrations**:
   - **wpForo Integration**: Custom styled categories (General, Announcements, Ongoing Novels, Completed Novels, Audio Novels, Short Stories, Review Junction, Tea Time, Memes/Fun, Author Discussion) with social reactions (❤️, 👍, 👏, 😂, 😮, 😢), quote replies, and member badges.
   - **Better Messages Integration**: Slide-over inbox, thread navigation, and message composer.
   - **Rank Math SEO & Schema.org**: Automated Schema.org `Book` and `BreadcrumbList` structured JSON-LD data.

5. **WordPress Admin CMS**:
   - Normal WordPress admin dashboard workflow for managing novels, chapters, announcements, categories, and members.

---

## 📁 Theme Directory Structure

```
wp-content/themes/rp-novels/
├── style.css                      # Theme header & root design tokens
├── functions.php                  # Setup, enqueues, nav menus, widget areas
├── header.php                     # Global header with logo & sticky nav
├── footer.php                     # Global footer with navy layout & links
├── front-page.php                 # Homepage with framed hero & grids
├── archive-novel.php              # Novel library template
├── single-novel.php               # Novel detail & chapter index
├── single-chapter.php             # Reader template with controls
├── 404.php                        # Literary 404 error page
├── index.php                      # Fallback template
├── inc/
│   ├── post-types.php             # CPTs: Novel, Chapter, Announcement
│   ├── taxonomies.php             # Taxonomies: Genre, Status, Category
│   ├── meta-boxes.php             # Admin metaboxes
│   ├── security.php               # Security headers & capability checks
│   ├── seo.php                    # Schema.org Book structured markup
│   └── helpers.php                # Chapter helpers & reading time
├── template-parts/
│   └── novel/
│       └── novel-card.php         # Reusable novel card component
└── assets/
    ├── css/                       # Modular CSS stylesheets
    ├── js/                        # Modular JavaScript controllers
    └── images/                    # logo.png, desktopview.png, mobileview.png
```

---

## 🚀 Installation Guide

1. Compress the `wp-content/themes/rp-novels` folder into a `.zip` file (e.g. `rp-novels.zip`).
2. Log in to your WordPress Admin Dashboard (`/wp-admin`).
3. Navigate to **Appearance > Themes > Add New > Upload Theme**.
4. Choose `rp-novels.zip` and click **Install Now**.
5. Click **Activate**.
6. Set your Front Page display:
   - Go to **Settings > Reading**.
   - Under **Your homepage displays**, select **A static page**.
   - Select your created homepage for **Homepage**.
