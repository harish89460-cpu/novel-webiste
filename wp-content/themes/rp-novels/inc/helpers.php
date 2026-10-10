<?php
/**
 * Helper Functions for Rudhra Prarthana Novels
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

/**
 * Get all chapters for a given novel ID, ordered by chapter number
 */
function rp_get_novel_chapters($novel_id) {
    return get_posts(array(
        'post_type'      => 'chapter',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
        'meta_key'       => '_rp_chapter_number',
        'orderby'        => 'meta_value_num',
        'order'          => 'ASC',
        'meta_query'     => array(
            array(
                'key'     => '_rp_parent_novel_id',
                'value'   => $novel_id,
                'compare' => '='
            )
        )
    ));
}

/**
 * Calculate Reading Time in Minutes
 */
function rp_calculate_reading_time($content) {
    $word_count = mb_strlen(wp_strip_all_tags($content), 'UTF-8');
    // Approximate 350 Tamil characters per minute
    $minutes = ceil($word_count / 350);
    return max(1, $minutes) . ' நிமிடங்கள்';
}

/**
 * Get Adjacent Chapters (Previous / Next)
 */
function rp_get_adjacent_chapters($current_chapter_id, $parent_novel_id) {
    $all_chapters = rp_get_novel_chapters($parent_novel_id);
    $prev = null;
    $next = null;
    $count = count($all_chapters);

    for ($i = 0; $i < $count; $i++) {
        if ($all_chapters[$i]->ID === $current_chapter_id) {
            if ($i > 0) $prev = $all_chapters[$i - 1];
            if ($i < $count - 1) $next = $all_chapters[$i + 1];
            break;
        }
    }

    return array('prev' => $prev, 'next' => $next);
}
