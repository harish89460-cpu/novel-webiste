<?php
/**
 * Header Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="profile" href="https://gmpg.org/xfn/11">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<!-- Announcement / Guest Bar (Hidden on Mobile) -->
<div class="announcement-bar" id="top-announcement-bar">
  <div class="ticker-content" id="top-ticker-content">
    <?php if (is_user_logged_in()): ?>
      <span class="announcement-badge"><?php _e('அறிவிப்பு', 'rp-novels'); ?></span>
      <span class="ticker-text"><?php echo esc_html(get_theme_mod('rp_announcement_text', 'ருத்ரா பிரார்த்தனாவின் புதிய நாவல் அத்தியாயங்கள் இப்போது நேரலையில்!')); ?></span>
    <?php else: ?>
      <span class="announcement-badge"><?php _e('நல்வரவு', 'rp-novels'); ?></span>
      <div class="guest-top-welcome">
        <span><?php _e('வணக்கம், வாசகரே! உங்கள் வாசிப்பு பயணத்தைத் தொடர உள்நுழையுங்கள்.', 'rp-novels'); ?></span>
        <a href="<?php echo esc_url(wp_login_url()); ?>" class="guest-top-btn"><?php _e('உள்நுழைய', 'rp-novels'); ?></a>
      </div>
    <?php endif; ?>
  </div>
</div>

<!-- Header -->
<header class="site-header">
  <div class="header-inner">
    <!-- 1. Mobile Hamburger (Left on Mobile, Hidden on Desktop) -->
    <button class="hamburger-btn" onclick="if(window.toggleMobileDrawer) toggleMobileDrawer();" aria-label="<?php esc_attr_e('Open Menu', 'rp-novels'); ?>">
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>

    <!-- 2. Brand Logo (Center/Left on Mobile, Left on Desktop) -->
    <a href="<?php echo esc_url(home_url('/')); ?>" class="brand-link">
      <?php if (has_custom_logo()): ?>
        <?php the_custom_logo(); ?>
      <?php else: ?>
        <img src="<?php echo esc_url(RP_NOVELS_URI . '/assets/images/logo.png'); ?>" alt="<?php bloginfo('name'); ?>" class="brand-logo">
      <?php endif; ?>
      <div class="brand-titles">
        <span class="brand-name"><?php bloginfo('name'); ?></span>
        <span class="brand-tagline">Novels & Community</span>
      </div>
    </a>

    <!-- 3. Desktop Navigation (Hidden on Mobile) -->
    <nav class="nav-desktop" aria-label="<?php esc_attr_e('Primary Menu', 'rp-novels'); ?>">
      <?php
      if (has_nav_menu('primary-menu')) {
        wp_nav_menu(array(
          'theme_location' => 'primary-menu',
          'container'      => false,
          'items_wrap'     => '%3$s',
          'fallback_cb'    => false,
        ));
      } else {
        echo '<a href="' . esc_url(home_url('/')) . '" class="nav-link active">Home</a>';
        echo '<a href="' . esc_url(home_url('/forum/')) . '" class="nav-link">Forum</a>';
        echo '<a href="' . esc_url(home_url('/members/')) . '" class="nav-link">Members</a>';
        echo '<a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="nav-link">Pratilipi</a>';
        echo '<a href="' . esc_url(home_url('/contact/')) . '" class="nav-link">Contact</a>';
        echo '<a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="nav-link" style="color:#C89B3C;">YouTube</a>';
      }
      ?>
    </nav>

    <!-- 4. Header Actions (Right: Language Switcher, Search, Notification, Desktop Login) -->
    <div class="header-actions">
      <!-- Unique Language Switcher (Displays opposite target language) -->
      <button class="lang-toggle-btn" id="lang-toggle-btn" onclick="if(window.toggleLanguage) toggleLanguage();" aria-label="<?php esc_attr_e('Switch Language', 'rp-novels'); ?>" title="<?php esc_attr_e('Switch Language', 'rp-novels'); ?>">
        தமிழ்
      </button>

      <!-- Search Trigger -->
      <button class="action-btn" onclick="if(window.openSearchModal) openSearchModal();" title="<?php esc_attr_e('Search', 'rp-novels'); ?>" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>

      <!-- Notification Trigger -->
      <button class="action-btn" onclick="if(window.toggleNotificationsDropdown) toggleNotificationsDropdown(event);" title="<?php esc_attr_e('Notifications', 'rp-novels'); ?>" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </button>

      <!-- Desktop User Auth / Profile Area (Hidden on Mobile) -->
      <div id="header-auth-container">
        <?php if (is_user_logged_in()): ?>
          <a href="<?php echo esc_url(home_url('/profile/')); ?>" class="user-profile-trigger">
            <?php echo get_avatar(get_current_user_id(), 32, '', '', array('class' => 'user-avatar-sm')); ?>
            <span class="user-name-sm"><?php echo esc_html(wp_get_current_user()->display_name); ?></span>
          </a>
        <?php else: ?>
          <a href="<?php echo esc_url(wp_login_url()); ?>" class="btn btn-gold btn-sm"><?php _e('Log In', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(wp_registration_url()); ?>" class="btn btn-outline btn-sm"><?php _e('Register', 'rp-novels'); ?></a>
        <?php endif; ?>
      </div>
    </div>
  </div>
</header>

<!-- Mobile Drawer -->
<div class="mobile-drawer" id="mobile-drawer">
  <div class="mobile-drawer-content">
    <div class="drawer-header">
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="<?php echo esc_url(RP_NOVELS_URI . '/assets/images/logo.png'); ?>" style="width:36px; height:36px; border-radius:50%;" alt="RP">
        <span style="font-family:var(--font-serif); font-size:1.15rem; font-weight:700; color:var(--color-navy-deep);">RP Novels</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="lang-toggle-btn drawer-lang-toggle" id="drawer-lang-toggle-btn" onclick="if(window.toggleLanguage) toggleLanguage();" aria-label="<?php esc_attr_e('Switch Language', 'rp-novels'); ?>" title="<?php esc_attr_e('Switch Language', 'rp-novels'); ?>">
          தமிழ்
        </button>
        <button class="drawer-close" onclick="closeMobileDrawer()">✕</button>
      </div>
    </div>
    <nav class="drawer-nav">
      <?php
      if (has_nav_menu('mobile-menu')) {
        wp_nav_menu(array(
          'theme_location' => 'mobile-menu',
          'container'      => false,
          'items_wrap'     => '%3$s',
        ));
      } else {
        echo '<a href="' . esc_url(home_url('/')) . '" class="drawer-nav-item">Home</a>';
        echo '<a href="' . esc_url(home_url('/forum/')) . '" class="drawer-nav-item">Forum</a>';
        echo '<a href="' . esc_url(home_url('/members/')) . '" class="drawer-nav-item">Members</a>';
        echo '<a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="drawer-nav-item">Pratilipi</a>';
        echo '<a href="' . esc_url(home_url('/contact/')) . '" class="drawer-nav-item">Contact</a>';
        echo '<a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="drawer-nav-item" style="color:#C89B3C;">▶ YouTube Channel</a>';
      }
      ?>
    </nav>

    <!-- Mobile Drawer Guest / Auth Card -->
    <div class="drawer-footer">
      <?php if (!is_user_logged_in()): ?>
        <div class="drawer-guest-card">
          <div class="drawer-guest-greeting">Welcome, Reader! 👋</div>
          <p class="drawer-guest-text"><?php _e('Log in to bookmark chapters, participate in discussions, and join the community.', 'rp-novels'); ?></p>
          <a href="<?php echo esc_url(wp_login_url()); ?>" class="btn btn-gold btn-sm" style="width:100%; display:block; text-align:center;">
            <?php _e('Log In', 'rp-novels'); ?>
          </a>
          <a href="<?php echo esc_url(wp_registration_url()); ?>" class="btn btn-outline btn-sm" style="width:100%; display:block; text-align:center; margin-top:8px;">
            <?php _e('Register', 'rp-novels'); ?>
          </a>
        </div>
      <?php else: ?>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <?php echo get_avatar(get_current_user_id(), 40, '', '', array('class' => 'user-avatar-sm', 'style' => 'width:40px; height:40px;')); ?>
          <div>
            <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);"><?php echo esc_html(wp_get_current_user()->display_name); ?></div>
            <div style="font-size:11px; color:var(--color-gold-warm); font-weight:700;">Member</div>
          </div>
        </div>
        <a href="<?php echo esc_url(wp_logout_url(home_url('/'))); ?>" class="btn btn-outline btn-sm" style="width:100%; display:block; text-align:center;">
          <?php _e('Log Out', 'rp-novels'); ?>
        </a>
      <?php endif; ?>
    </div>
  </div>
</div>

<main id="main-content" class="main-content">
