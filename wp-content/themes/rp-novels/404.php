<?php
/**
 * 404 Error Page Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
get_header();
?>
<div class="container section" style="min-height:70vh; display:flex; align-items:center; justify-content:center;">
  <div style="text-align:center; max-width:580px; padding:var(--space-8); background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-xl); box-shadow:var(--shadow-sm);">
    <div style="font-size:3.5rem; margin-bottom:var(--space-2);">🪶</div>
    <h1 style="font-family:var(--font-serif); font-size:4rem; color:var(--color-gold); line-height:1; margin-bottom:var(--space-2);">404</h1>
    <h2 style="font-family:var(--font-serif); font-size:1.8rem; color:var(--color-navy-deep); margin-bottom:var(--space-3);">
      <?php _e('Looks like this page has wandered into another chapter.', 'rp-novels'); ?>
    </h2>
    <p style="font-family:var(--font-tamil); color:var(--color-brown-literary); font-size:1.1rem; line-height:1.6; margin-bottom:var(--space-6);">
      நீங்கள் தேடிய பக்கம் வேறு ஏதோ ஒரு கற்பனை உலகில் தொலைந்துவிட்டது போலிருக்கிறது.
    </p>
    <a href="<?php echo esc_url(home_url('/')); ?>" class="btn btn-gold btn-lg">
      <?php _e('Return Home (முகப்புக்குச் செல்)', 'rp-novels'); ?> ➔
    </a>
  </div>
</div>
<?php get_footer(); ?>
