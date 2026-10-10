<?php
/**
 * Single Novel Detail Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
get_header();

$novel_id    = get_the_ID();
$tamil_title = get_post_meta($novel_id, '_rp_tamil_title', true);
$author_name = get_post_meta($novel_id, '_rp_author_name', true) ?: 'ருத்ரா பிரார்த்தனா';
$chapters    = rp_get_novel_chapters($novel_id);
$first_ch    = !empty($chapters) ? $chapters[0] : null;

$status_terms = get_the_terms($novel_id, 'novel_status');
$status_name  = (!empty($status_terms) && !is_wp_error($status_terms)) ? $status_terms[0]->name : 'Ongoing';
?>
<div class="container section">
  <div style="display:grid; grid-template-columns: 1fr; gap:var(--space-8); margin-bottom:var(--space-12);" class="novel-detail-grid">
    <div style="display:flex; flex-direction:column; gap:var(--space-4); max-width:320px;">
      <?php if (has_post_thumbnail()) : ?>
        <?php the_post_thumbnail('rp-novel-cover', array('style' => 'width:100%; aspect-ratio:2/3; border-radius:var(--radius-lg); object-fit:cover; border:2px solid var(--color-border); box-shadow:var(--shadow-md);')); ?>
      <?php else : ?>
        <div style="width:100%; aspect-ratio:2/3; background:var(--color-parchment); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; font-size:48px;">📖</div>
      <?php endif; ?>

      <div style="display:flex; gap:10px;">
        <?php if ($first_ch): ?>
          <a href="<?php echo esc_url(get_permalink($first_ch)); ?>" class="btn btn-gold" style="flex:1;">
            <?php _e('Read First Chapter', 'rp-novels'); ?>
          </a>
        <?php endif; ?>
        <button class="btn btn-outline" onclick="bookmarkChapter('<?php echo esc_js($novel_id); ?>', 1)" title="புக்மார்க்">🔖</button>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:var(--space-3);">
      <div style="display:flex; gap:8px;">
        <span class="novel-badge-status badge-<?php echo esc_attr(strtolower($status_name)); ?>" style="position:static;"><?php echo esc_html($status_name); ?></span>
      </div>

      <h1 style="font-family:var(--font-serif); font-size:2.5rem; color:var(--color-navy-deep);"><?php the_title(); ?></h1>
      <?php if ($tamil_title): ?>
        <h2 style="font-family:var(--font-tamil); font-size:1.8rem; color:var(--color-brown-literary);"><?php echo esc_html($tamil_title); ?></h2>
      <?php endif; ?>

      <div style="font-size:var(--text-sm); color:var(--color-text-muted);">
        <?php _e('எழுத்தாளர்:', 'rp-novels'); ?> <strong style="color:var(--color-navy-deep);"><?php echo esc_html($author_name); ?></strong> • 
        <?php _e('அத்தியாயங்கள்:', 'rp-novels'); ?> <strong><?php echo count($chapters); ?></strong>
      </div>

      <div style="margin:var(--space-4) 0; padding:var(--space-5); background:var(--color-card-bg); border-left:3px solid var(--color-gold); border-radius:0 var(--radius-md) var(--radius-md) 0; line-height:1.8;">
        <h4 style="font-size:14px; text-transform:uppercase; color:var(--color-gold-warm); margin-bottom:6px;"><?php _e('நாவல் சுருக்கம்', 'rp-novels'); ?></h4>
        <?php the_content(); ?>
      </div>

      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <button class="share-btn whatsapp" onclick="shareChapter('whatsapp', '<?php echo esc_js(get_the_title()); ?>')">WhatsApp</button>
        <button class="share-btn facebook" onclick="shareChapter('facebook', '<?php echo esc_js(get_the_title()); ?>')">Facebook</button>
        <button class="share-btn" onclick="shareChapter('copy', '<?php echo esc_js(get_the_title()); ?>')">Copy Link</button>
      </div>
    </div>
  </div>

  <!-- Chapters List -->
  <div class="section-header" style="border-top:1px solid var(--color-border); padding-top:var(--space-8);">
    <div class="section-heading-group">
      <span class="section-subtitle"><?php _e('அத்தியாயங்கள் பட்டியல்', 'rp-novels'); ?></span>
      <h3 class="section-title">Chapters (<?php echo count($chapters); ?>)</h3>
    </div>
  </div>

  <div style="display:flex; flex-direction:column; gap:12px;">
    <?php if (!empty($chapters)): ?>
      <?php foreach ($chapters as $ch): 
        $c_num = get_post_meta($ch->ID, '_rp_chapter_number', true) ?: '1';
      ?>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:#FFFFFF; border:1px solid var(--color-border); border-radius:var(--radius-md);">
          <div>
            <div style="font-weight:700; color:var(--color-navy-deep);"><?php echo esc_html($ch->post_title); ?></div>
            <div style="font-size:11px; color:var(--color-text-muted);"><?php echo get_the_date('', $ch->ID); ?> • <?php echo rp_calculate_reading_time($ch->post_content); ?></div>
          </div>
          <a href="<?php echo esc_url(get_permalink($ch->ID)); ?>" class="btn btn-outline btn-sm"><?php _e('வாசிக்க ➔', 'rp-novels'); ?></a>
        </div>
      <?php endforeach; ?>
    <?php else: ?>
      <p style="color:var(--color-text-muted);"><?php _e('இன்னும் அத்தியாயங்கள் சேர்க்கப்படவில்லை.', 'rp-novels'); ?></p>
    <?php endif; ?>
  </div>
</div>

<?php get_footer(); ?>
