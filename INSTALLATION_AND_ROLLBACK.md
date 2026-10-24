# INSTALLATION, TESTING, AND ROLLBACK GUIDE
**Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)**
*Step-by-Step Deployment Instructions for WordPress Administrators without Hosting-File Access*

---

## 1. Context & Constraints

You have administrative access to the live WordPress Admin (`/wp-admin`), but you **do not** have:
- Direct cPanel, SSH, or FTP hosting-file credentials.
- The previous developer's original unpublished theme source code.
- Direct phpMyAdmin or MySQL console access.

This guide provides the safest, non-destructive deployment procedure designed specifically for this situation. It guarantees that existing database records, members, forum discussions, and legacy `rp_episode` content are preserved without risk of data loss.

---

## 2. Pre-Installation Backup (Mandatory First Step)

Before installing or activating any new theme, create a comprehensive backup using WordPress Admin plugins:

1. **Install an All-in-One Backup Plugin**:
   - In WordPress Admin, navigate to **Plugins > Add New**.
   - Search for **UpdraftPlus** (or **All-in-One WP Migration**).
   - Click **Install Now**, then **Activate**.
2. **Create Full Backup**:
   - Go to **Settings > UpdraftPlus Backups** (or the plugin's dashboard).
   - Click **Backup Now**.
   - Ensure both checkboxes are selected:
     - `Include your database in the backup`
     - `Include your files in the backup (plugins, themes, uploads)`
   - Click **Backup Now** and wait for completion.
   - Download the generated database and theme backup files to your local computer.

---

## 3. Theme Package Verification

Before uploading, verify the ZIP structure:
- **ZIP File Name**: `rp-novels-wordpress-theme.zip`
- **Internal Structure**: When unzipped, the ZIP must contain a single root folder named `rp-novels/` containing `style.css`, `functions.php`, `index.php`, etc.
  ```
  rp-novels-wordpress-theme.zip
  └── rp-novels/
      ├── style.css
      ├── functions.php
      ├── ...
  ```
- WordPress automatically extracts this folder into `wp-content/themes/rp-novels/`. If files were zipped without the parent folder, WordPress installation would error. Our build script guarantees this correct directory nesting.

---

## 4. Installation via WordPress Admin

### Step 1: Upload the Theme
1. In WordPress Admin, navigate to **Appearance > Themes**.
2. Click the **Add New Theme** button at the top of the page.
3. Click the **Upload Theme** button.
4. Click **Choose File** and select `rp-novels-wordpress-theme.zip`.
5. Click **Install Now**.
6. WordPress will unpack the archive, verify theme headers, and display:
   ```
   Installing Theme from uploaded file: rp-novels-wordpress-theme.zip
   Unpacking the package...
   Installing the theme...
   Theme installed successfully.
   ```

### Step 2: Live Preview (Do NOT Activate Immediately)
1. On the confirmation screen, click **Live Preview** (instead of Activate).
2. The WordPress Customizer will load the new theme in a private sandbox.
3. Verify:
   - Header logo, brand title, and navigation links appear correctly.
   - Hero section parchment artwork displays without missing images.
   - Novel cards render with genuine cover images, titles, and author badges.
   - The admin bar and footer load without visual breakage.
4. If everything looks correct, click **Activate & Publish**. If any issue appears, simply click the **✕** button in the Customizer to cancel without affecting the live site.

---

## 5. Hosting Upload Size Limitations & Workarounds

Some WordPress hosts enforce a strict maximum upload size (e.g., `2MB` or `8MB`). Because the theme package includes high-resolution parchment artwork and brand graphics (`~6MB`), your host might display:

> *The uploaded file exceeds the upload_max_filesize directive in php.ini.*

### Workaround 1: Check Media Upload Size in WP Admin
- Go to **Media > Add New**.
- Note the line: *Maximum upload file size: XX MB*.
- If the limit is **10MB or higher**, the theme will upload without issue.

### Workaround 2: Request Temporary Limit Increase from Host
- If the limit is below 8MB, submit a quick support ticket to your hosting provider:
  > *"Dear Support, please temporarily increase the PHP upload_max_filesize and post_max_size to 64M so I can upload our new theme via WordPress Admin. Thank you."*

---

## 6. Post-Activation Verification Checklist

Execute these checks immediately after activating the theme:

| Step | Verification Item | Expected Result | Verified? |
| :-: | :--- | :--- | :-: |
| **1** | **Homepage** | Hero artwork, typography, and novel sections render with gold/navy styling. | [ ] |
| **2** | **Novel Detail View** | Clicking any novel opens its details page with cover, synopsis, and chapter list. | [ ] |
| **3** | **Chapter Reader** | Opening an episode loads the distraction-free reader with font size buttons and theme toggles. | [ ] |
| **4** | **Legacy Episodes** | URLs pointing to `/episode/...` or legacy post types open smoothly without 404. | [ ] |
| **5** | **wpForo Community** | Navigating to `/forum/` loads the forum discussions, topics, and replies without broken styles. | [ ] |
| **6** | **Mobile Responsiveness** | Open site on a smartphone (or Chrome Device Mode at 390px): hamburger menu opens smoothly, zero horizontal overflow. | [ ] |
| **7** | **Admin Control Panel** | Go to **RP Novels > Homepage Sections** in `/wp-admin` to test section toggling. | [ ] |

---

## 7. Immediate Rollback & Recovery Procedure

If unexpected incompatibilities or plugin conflicts arise after activation:

### Immediate One-Click Reversion via WordPress Admin
1. Navigate to **Appearance > Themes**.
2. Locate your **previous active theme** (the theme you were using before).
3. Click **Activate** on the previous theme.
4. The website will immediately revert to the previous theme layout.
5. All database records, novel custom post types, and user comments created in the interim remain completely intact.

### Restoring from UpdraftPlus Backup (If Needed)
1. Go to **Settings > UpdraftPlus Backups**.
2. Locate the backup you created in **Section 2**.
3. Click **Restore**.
4. Select `Themes` and `Database` components.
5. Click **Restore** to roll back all files and settings to the exact moment prior to theme installation.
