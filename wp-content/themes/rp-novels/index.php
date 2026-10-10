<?php
/**
 * Main Fallback Template
 *
 * @package RP_Novels
 */
if (!defined('ABSPATH')) exit;
get_header();
?>
<div class="container section">
  <?php if (have_posts()) : ?>
    <div class="novel-grid">
      <?php while (have_posts()) : the_post(); ?>
        <article class="novel-card">
          <div class="novel-card-body">
            <h2 class="novel-card-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
            <div class="novel-card-author"><?php the_author(); ?> • <?php echo get_the_date(); ?></div>
            <div class="novel-card-desc"><?php the_excerpt(); ?></div>
          </div>
          <div class="novel-card-footer">
            <a href="<?php the_permalink(); ?>" class="btn btn-outline btn-sm"><?php _e('Read More', 'rp-novels'); ?></a>
          </div>
        </article>
      <?php endwhile; ?>
    </div>
  <?php else : ?>
    <p><?php _e('No content found.', 'rp-novels'); ?></p>
  <?php endif; ?>
</div>
<?php get_footer(); ?>
