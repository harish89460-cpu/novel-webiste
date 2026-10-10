<?php
/**
 * Template Name: Front Page
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
get_header();
?>

<!-- Hero Section Framed with Desktop/Mobile Parchment Artwork -->
<section class="hero-section">
  <div class="hero-content-frame">
    <div class="hero-badge">
      <span class="hero-badge-icon">👑</span>
      <span><?php _e('தமிழ் இலக்கிய நாவல் தளம்', 'rp-novels'); ?></span>
    </div>

    <h1 class="hero-title">
      Rudhra Prarthana Novels
    </h1>

    <div class="hero-divider">
      <span class="hero-divider-line"></span>
      <span class="hero-divider-glyph">🪶</span>
      <span class="hero-divider-line"></span>
    </div>

    <p class="hero-subtitle">
      "Read. Discover. Discuss. Connect."<br>
      <?php _e('இதயம் தொடும் தமிழ் நாவல்கள், புதிய அத்தியாயங்கள் மற்றும் வாசகர்களின் பாசமிகு கலந்துரையாடல் தளம்.', 'rp-novels'); ?>
    </p>

    <div class="hero-actions">
      <a href="<?php echo esc_url(home_url('/novels/')); ?>" class="btn btn-primary btn-lg">
        <span><?php _e('Explore Novels', 'rp-novels'); ?></span>
        <span>➔</span>
      </a>
      <a href="<?php echo esc_url(home_url('/forum/')); ?>" class="btn btn-outline btn-lg" style="background:rgba(255,255,255,0.85);">
        <span><?php _e('Forum', 'rp-novels'); ?></span>
      </a>
    </div>

    <!-- Literary Stats Strip -->
    <div class="hero-stats-strip">
      <div class="stat-item">
        <span class="stat-number">16+</span>
        <span class="stat-label"><?php _e('வெற்றி நாவல்கள்', 'rp-novels'); ?></span>
      </div>
      <div style="width:1px; height:28px; background:var(--color-border);"></div>
      <div class="stat-item">
        <span class="stat-number">350K+</span>
        <span class="stat-label"><?php _e('வாசகப் பெருமக்கள்', 'rp-novels'); ?></span>
      </div>
      <div style="width:1px; height:28px; background:var(--color-border);"></div>
      <div class="stat-item">
        <span class="stat-number">20K+</span>
        <span class="stat-label"><?php _e('மன்ற விவாதங்கள்', 'rp-novels'); ?></span>
      </div>
    </div>
  </div>
</section>

<!-- Featured Novels Section -->
<section class="section">
  <div class="container">
    <div class="section-header">
      <div class="section-heading-group">
        <span class="section-subtitle"><?php _e('சிறப்புப் படைப்புகள்', 'rp-novels'); ?></span>
        <h2 class="section-title">Featured Novels</h2>
      </div>
      <a href="<?php echo esc_url(home_url('/novels/')); ?>" class="section-link"><?php _e('அனைத்து நாவல்களும் ➔', 'rp-novels'); ?></a>
    </div>

    <div class="novel-grid novel-grid-4">
      <?php
      $featured_query = new WP_Query(array(
        'post_type'      => 'novel',
        'posts_per_page' => 4,
        'meta_key'       => '_rp_is_featured',
        'meta_value'     => '1'
      ));

      if ($featured_query->have_posts()) :
        while ($featured_query->have_posts()) : $featured_query->the_post();
          get_template_part('template-parts/novel/novel-card');
        endwhile;
        wp_reset_postdata();
      else :
        // Fallback default message
        echo '<p style="color:var(--color-text-muted);">' . __('No featured novels available.', 'rp-novels') . '</p>';
      endif;
      ?>
    </div>
  </div>
</section>

<!-- Author Spotlight -->
<section class="section section-bg-alt">
  <div class="container">
    <div class="author-spotlight">
      <div class="author-photo-wrap">
        <img src="<?php echo esc_url(RP_NOVELS_URI . '/assets/images/logo.png'); ?>" class="author-photo" alt="Rudhra Prarthana">
        <div class="author-badge">👑 முதன்மை ஆசிரியர்</div>
      </div>
      <div class="author-info">
        <span class="section-subtitle"><?php _e('எழுத்தாளர் அறிமுகம்', 'rp-novels'); ?></span>
        <h2 class="author-name">Rudhra Prarthana</h2>
        <p class="author-bio">
          <?php _e('Celebrated Tamil author who captures deep family values, pure romance, and authentic life journeys with emotional storytelling.', 'rp-novels'); ?>
        </p>
        <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
          <a href="<?php echo esc_url(home_url('/novels/')); ?>" class="btn btn-gold btn-sm"><?php _e('Novels', 'rp-novels'); ?></a>
          <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Pratilipi</a>
          <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="btn btn-outline btn-sm">YouTube</a>
        </div>
      </div>
    </div>
  </div>
</section>

<?php get_footer(); ?>
