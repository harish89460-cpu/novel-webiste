<?php
/**
 * Footer Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
?>
</main><!-- /#main-content -->

<!-- Site Footer (Premium Navy) -->
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <!-- Brand Summary -->
      <div class="footer-brand">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="<?php echo esc_url(RP_NOVELS_URI . '/assets/images/logo.png'); ?>" class="brand-logo" alt="<?php bloginfo('name'); ?>">
          <span class="brand-name"><?php bloginfo('name'); ?></span>
        </div>
        <p class="footer-desc">
          <?php echo esc_html(get_bloginfo('description') ?: 'இதயம் தொடும் குடும்ப நாவல்கள், மெல்லிய காதல் கதைகள் மற்றும் வாசகர்களின் பாசமிகு சங்கமம். வாசிப்பை நேசிக்கும் தமிழ் நெஞ்சங்களுக்கான பிரத்யேக இலக்கியக் கூடம்.'); ?>
        </p>
        <div class="footer-socials">
          <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="social-icon-btn" title="Rudhra Prarthana Audio Novels YouTube">▶</a>
          <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="social-icon-btn" title="Rudhra Prarthana Pratilipi Profile">📖</a>
          <a href="https://facebook.com" target="_blank" rel="noopener" class="social-icon-btn" title="Facebook">f</a>
          <a href="https://instagram.com" target="_blank" rel="noopener" class="social-icon-btn" title="Instagram">📸</a>
        </div>
      </div>

      <!-- Quick Navigation -->
      <div>
        <h4 class="footer-title"><?php _e('Quick Links', 'rp-novels'); ?></h4>
        <div class="footer-links">
          <a href="<?php echo esc_url(home_url('/')); ?>" class="footer-link"><?php _e('Home', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(home_url('/novels/')); ?>" class="footer-link"><?php _e('Novels', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(home_url('/forum/')); ?>" class="footer-link"><?php _e('Forum', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(home_url('/members/')); ?>" class="footer-link"><?php _e('Members', 'rp-novels'); ?></a>
          <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="footer-link"><?php _e('Pratilipi', 'rp-novels'); ?></a>
          <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="footer-link" style="color:var(--color-gold);"><?php _e('YouTube Channel', 'rp-novels'); ?></a>
        </div>
      </div>

      <!-- Legal Policies -->
      <div>
        <h4 class="footer-title"><?php _e('Legal & Policies', 'rp-novels'); ?></h4>
        <div class="footer-links">
          <a href="<?php echo esc_url(home_url('/privacy-policy/')); ?>" class="footer-link"><?php _e('Privacy Policy', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(home_url('/terms/')); ?>" class="footer-link"><?php _e('Terms of Service', 'rp-novels'); ?></a>
          <a href="<?php echo esc_url(home_url('/copyright/')); ?>" class="footer-link"><?php _e('Copyright Notice', 'rp-novels'); ?></a>
        </div>
      </div>

      <!-- Community CTA -->
      <div>
        <h4 class="footer-title"><?php _e('Community', 'rp-novels'); ?></h4>
        <p class="footer-community-desc" style="font-size:13px; color:var(--color-parchment); line-height:1.6; margin-bottom:14px;">
          <?php _e('Join our reader forum to share reviews, chapter predictions, and converse directly with author Rudhra Prarthana.', 'rp-novels'); ?>
        </p>
        <a href="<?php echo esc_url(wp_registration_url()); ?>" class="btn btn-gold btn-sm footer-join-btn"><?php _e('Join Free Today', 'rp-novels'); ?></a>
      </div>
    </div>

    <div class="footer-bottom">
      <div>&copy; <?php echo date('Y'); ?> <?php bloginfo('name'); ?>. <?php _e('All Rights Reserved.', 'rp-novels'); ?></div>
      <div style="font-size:11px; color:rgba(255,255,255,0.5);"><?php _e('Designed with literary elegance for Tamil novel lovers.', 'rp-novels'); ?></div>
    </div>
  </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
