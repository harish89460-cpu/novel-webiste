<?php
/**
 * Single Chapter Reading Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
get_header();

$chapter_id      = get_the_ID();
$parent_novel_id = get_post_meta($chapter_id, '_rp_parent_novel_id', true);
$chapter_num     = get_post_meta($chapter_id, '_rp_chapter_number', true) ?: '1';
$parent_novel    = $parent_novel_id ? get_post($parent_novel_id) : null;
$author_name     = $parent_novel ? (get_post_meta($parent_novel->ID, '_rp_author_name', true) ?: 'ருத்ரா பிரார்த்தனா') : 'ருத்ரா பிரார்த்தனா';

$adjacent        = rp_get_adjacent_chapters($chapter_id, $parent_novel_id);
$prev_chapter    = $adjacent['prev'];
$next_chapter    = $adjacent['next'];
?>

<!-- Reading Progress Bar -->
<div class="reading-progress-track">
  <div class="reading-progress-bar"></div>
</div>

<div class="reader-page">
  <!-- Floating Reading Toolbar -->
  <div class="reader-toolbar">
    <div class="reader-toolbar-group">
      <button class="reader-tool-btn" onclick="adjustFontSize(-0.08)" title="சிறிய எழுத்து">A-</button>
      <button class="reader-tool-btn" onclick="adjustFontSize(0)" title="இயல்பு">Reset</button>
      <button class="reader-tool-btn" onclick="adjustFontSize(0.08)" title="பெரிய எழுத்து">A+</button>
    </div>

    <div class="reader-toolbar-group">
      <button class="mode-pill mode-pill-light active" data-mode="light" onclick="setReaderMode('light')"><?php _e('வெளிச்சம்', 'rp-novels'); ?></button>
      <button class="mode-pill mode-pill-sepia" data-mode="sepia" onclick="setReaderMode('sepia')"><?php _e('பழைய தாள்', 'rp-novels'); ?></button>
      <button class="mode-pill mode-pill-dark" data-mode="dark" onclick="setReaderMode('dark')"><?php _e('இருள்', 'rp-novels'); ?></button>
    </div>

    <div class="reader-toolbar-group">
      <button class="reader-tool-btn" onclick="bookmarkChapter('<?php echo esc_js($parent_novel_id); ?>', <?php echo esc_js($chapter_num); ?>)" title="புக்மார்க்">🔖</button>
    </div>
  </div>

  <!-- Focused 760px Reading Container -->
  <div class="reader-container">
    <div class="reader-header">
      <?php if ($parent_novel): ?>
        <a href="<?php echo esc_url(get_permalink($parent_novel)); ?>" class="reader-novel-crumb">
          <?php echo esc_html($parent_novel->post_title); ?>
        </a>
      <?php endif; ?>
      <div class="reader-chapter-number"><?php printf(__('அத்தியாயம் %s', 'rp-novels'), esc_html($chapter_num)); ?></div>
      <h1 class="reader-chapter-title"><?php the_title(); ?></h1>
      <div class="reader-meta-bar">
        <span>✍️ <?php echo esc_html($author_name); ?></span>
        <span>📅 <?php echo get_the_date(); ?></span>
        <span>⏱️ <?php echo rp_calculate_reading_time(get_the_content()); ?></span>
      </div>
    </div>

    <!-- Chapter Prose -->
    <article class="reader-body">
      <?php the_content(); ?>
    </article>

    <!-- Chapter End Ornament -->
    <div class="chapter-end-ornament">
      <span class="chapter-end-line"></span>
      <span>🪶 சுபம் 🪶</span>
      <span class="chapter-end-line"></span>
    </div>

    <!-- Bottom Navigation -->
    <div class="reader-bottom-nav">
      <?php if ($prev_chapter): ?>
        <a href="<?php echo esc_url(get_permalink($prev_chapter)); ?>" class="reader-nav-btn">
          ⬅ <?php _e('முந்தைய அத்தியாயம்', 'rp-novels'); ?>
        </a>
      <?php else: ?>
        <button class="reader-nav-btn" disabled>⬅ <?php _e('முந்தைய அத்தியாயம்', 'rp-novels'); ?></button>
      <?php endif; ?>

      <?php if ($parent_novel): ?>
        <a href="<?php echo esc_url(get_permalink($parent_novel)); ?>" class="reader-nav-btn">
          ☰ <?php _e('அத்தியாயங்கள் பட்டியல்', 'rp-novels'); ?>
        </a>
      <?php endif; ?>

      <?php if ($next_chapter): ?>
        <a href="<?php echo esc_url(get_permalink($next_chapter)); ?>" class="reader-nav-btn">
          <?php _e('அடுத்த அத்தியாயம்', 'rp-novels'); ?> ➔
        </a>
      <?php else: ?>
        <button class="reader-nav-btn" disabled><?php _e('அடுத்த அத்தியாயம்', 'rp-novels'); ?> ➔</button>
      <?php endif; ?>
    </div>

    <!-- Actions & Sharing -->
    <div class="reader-actions-bar">
      <button class="btn btn-gold btn-sm" onclick="bookmarkChapter('<?php echo esc_js($parent_novel_id); ?>', <?php echo esc_js($chapter_num); ?>)">
        🔖 <?php _e('வாசிப்பு நிலையைச் சேமி', 'rp-novels'); ?>
      </button>

      <div class="reader-share-group">
        <span style="font-size:12px; color:var(--color-text-muted);"><?php _e('பகிர்க:', 'rp-novels'); ?></span>
        <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '<?php echo esc_js(get_the_title()); ?>')">WhatsApp</button>
        <button class="share-btn facebook" onclick="shareChapter('facebook', '<?php echo esc_js(get_the_title()); ?>')">Facebook</button>
        <button class="share-btn" onclick="shareChapter('copy', '<?php echo esc_js(get_the_title()); ?>')">Copy Link</button>
      </div>
    </div>
  </div>
</div>

<?php get_footer(); ?>
