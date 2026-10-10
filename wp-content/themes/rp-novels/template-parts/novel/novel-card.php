<?php
/**
 * Template Part: Reusable Novel Card Component
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;

$tamil_title = get_post_meta(get_the_ID(), '_rp_tamil_title', true);
$author_name = get_post_meta(get_the_ID(), '_rp_author_name', true) ?: 'ருத்ரா பிரார்த்தனா';
$chapters    = rp_get_novel_chapters(get_the_ID());
$status_terms = get_the_terms(get_the_ID(), 'novel_status');
$status_name  = (!empty($status_terms) && !is_wp_error($status_terms)) ? $status_terms[0]->name : 'Ongoing';
?>
<div class="novel-card">
  <div class="novel-card-cover">
    <?php if (has_post_thumbnail()) : ?>
      <?php the_post_thumbnail('rp-novel-cover', array('class' => 'novel-card-img', 'loading' => 'lazy')); ?>
    <?php else : ?>
      <div style="width:100%; height:100%; background:var(--color-parchment); display:flex; align-items:center; justify-content:center; color:var(--color-gold); font-size:40px;">📖</div>
    <?php endif; ?>
    <span class="novel-badge-status badge-<?php echo esc_attr(strtolower($status_name)); ?>"><?php echo esc_html($status_name); ?></span>
  </div>
  <div class="novel-card-body">
    <h3 class="novel-card-title"><?php the_title(); ?></h3>
    <?php if ($tamil_title): ?>
      <div class="novel-card-tamil-title"><?php echo esc_html($tamil_title); ?></div>
    <?php endif; ?>
    <div class="novel-card-author">✍️ <?php echo esc_html($author_name); ?></div>
    <div class="novel-card-desc"><?php the_excerpt(); ?></div>
    <div class="novel-card-meta">
      <span class="novel-card-meta-item">📖 <?php echo count($chapters); ?> <?php _e('அத்தியாயங்கள்', 'rp-novels'); ?></span>
      <span class="novel-card-meta-item">★ 5.0</span>
    </div>
  </div>
  <div class="novel-card-footer">
    <a href="<?php the_permalink(); ?>" class="btn btn-gold" style="width:100%;"><?php _e('Read Now', 'rp-novels'); ?></a>
  </div>
</div>
