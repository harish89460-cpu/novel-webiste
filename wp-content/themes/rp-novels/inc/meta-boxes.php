<?php
/**
 * Custom Meta Boxes for WordPress Admin CMS
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

/**
 * Register Meta Boxes for Novels & Chapters
 */
function rp_novels_register_meta_boxes() {
    // Novel Meta Box
    add_meta_box(
        'rp_novel_details_mb',
        __('Novel Configuration & Literary Metadata', 'rp-novels'),
        'rp_novel_meta_box_callback',
        'novel',
        'normal',
        'high'
    );

    // Chapter Meta Box
    add_meta_box(
        'rp_chapter_details_mb',
        __('Chapter Relationship & Reading Settings', 'rp-novels'),
        'rp_chapter_meta_box_callback',
        'chapter',
        'side',
        'high'
    );
}
add_action('add_meta_boxes', 'rp_novels_register_meta_boxes');

/**
 * Novel Meta Box Callback
 */
function rp_novel_meta_box_callback($post) {
    wp_nonce_field('rp_save_novel_meta', 'rp_novel_meta_nonce');

    $tamil_title = get_post_meta($post->ID, '_rp_tamil_title', true);
    $author_name = get_post_meta($post->ID, '_rp_author_name', true) ?: 'ருத்ரா பிரார்த்தனா';
    $is_featured = get_post_meta($post->ID, '_rp_is_featured', true);
    $audio_url   = get_post_meta($post->ID, '_rp_audio_url', true);
    $audio_dur   = get_post_meta($post->ID, '_rp_audio_duration', true);
    ?>
    <table class="form-table" style="width:100%;">
        <tr>
            <th style="width:20%;"><label for="rp_tamil_title"><?php _e('Tamil Title (தமிழ்த் தலைப்பு):', 'rp-novels'); ?></label></th>
            <td><input type="text" id="rp_tamil_title" name="rp_tamil_title" value="<?php echo esc_attr($tamil_title); ?>" style="width:100%; font-size:16px;" placeholder="எ.கா: நெஞ்சம் மறப்பதில்லை"></td>
        </tr>
        <tr>
            <th><label for="rp_author_name"><?php _e('Author Name (எழுத்தாளர் பெயர்):', 'rp-novels'); ?></label></th>
            <td><input type="text" id="rp_author_name" name="rp_author_name" value="<?php echo esc_attr($author_name); ?>" style="width:100%;"></td>
        </tr>
        <tr>
            <th><label for="rp_is_featured"><?php _e('Featured Novel (சிறப்பு நாவல்):', 'rp-novels'); ?></label></th>
            <td><input type="checkbox" id="rp_is_featured" name="rp_is_featured" value="1" <?php checked($is_featured, '1'); ?>> <label for="rp_is_featured"><?php _e('Showcase in Hero & Featured grid', 'rp-novels'); ?></label></td>
        </tr>
        <tr>
            <th><label for="rp_audio_url"><?php _e('Audio File URL (ஒலி நாவல் இணைப்பு):', 'rp-novels'); ?></label></th>
            <td><input type="url" id="rp_audio_url" name="rp_audio_url" value="<?php echo esc_url($audio_url); ?>" style="width:100%;" placeholder="https://example.com/audio.mp3"></td>
        </tr>
        <tr>
            <th><label for="rp_audio_duration"><?php _e('Audio Duration:', 'rp-novels'); ?></label></th>
            <td><input type="text" id="rp_audio_duration" name="rp_audio_duration" value="<?php echo esc_attr($audio_dur); ?>" placeholder="4 மணி 25 நிமிடம்"></td>
        </tr>
    </table>
    <?php
}

/**
 * Chapter Meta Box Callback
 */
function rp_chapter_meta_box_callback($post) {
    wp_nonce_field('rp_save_chapter_meta', 'rp_chapter_meta_nonce');

    $parent_novel_id = get_post_meta($post->ID, '_rp_parent_novel_id', true);
    $chapter_num     = get_post_meta($post->ID, '_rp_chapter_number', true) ?: '1';

    $novels = get_posts(array(
        'post_type'      => 'novel',
        'posts_per_page' => -1,
        'post_status'    => 'publish'
    ));
    ?>
    <p>
        <label for="rp_parent_novel_id"><strong><?php _e('Select Novel (நாவலைத் தேர்வு செய்க):', 'rp-novels'); ?></strong></label><br>
        <select id="rp_parent_novel_id" name="rp_parent_novel_id" style="width:100%; margin-top:4px;">
            <option value=""><?php _e('-- Select Novel --', 'rp-novels'); ?></option>
            <?php foreach ($novels as $n): ?>
                <option value="<?php echo $n->ID; ?>" <?php selected($parent_novel_id, $n->ID); ?>>
                    <?php echo esc_html($n->post_title); ?>
                </option>
            <?php endforeach; ?>
        </select>
    </p>
    <p>
        <label for="rp_chapter_number"><strong><?php _e('Chapter Number (அத்தியாயம் எண்):', 'rp-novels'); ?></strong></label><br>
        <input type="number" id="rp_chapter_number" name="rp_chapter_number" value="<?php echo esc_attr($chapter_num); ?>" min="1" style="width:100%; margin-top:4px;">
    </p>
    <?php
}

/**
 * Save Meta Boxes Data
 */
function rp_novels_save_meta_boxes($post_id) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;

    // Save Novel Meta
    if (isset($_POST['rp_novel_meta_nonce']) && wp_verify_nonce($_POST['rp_novel_meta_nonce'], 'rp_save_novel_meta')) {
        if (isset($_POST['rp_tamil_title'])) update_post_meta($post_id, '_rp_tamil_title', sanitize_text_field($_POST['rp_tamil_title']));
        if (isset($_POST['rp_author_name'])) update_post_meta($post_id, '_rp_author_name', sanitize_text_field($_POST['rp_author_name']));
        update_post_meta($post_id, '_rp_is_featured', isset($_POST['rp_is_featured']) ? '1' : '0');
        if (isset($_POST['rp_audio_url'])) update_post_meta($post_id, '_rp_audio_url', esc_url_raw($_POST['rp_audio_url']));
        if (isset($_POST['rp_audio_duration'])) update_post_meta($post_id, '_rp_audio_duration', sanitize_text_field($_POST['rp_audio_duration']));
    }

    // Save Chapter Meta
    if (isset($_POST['rp_chapter_meta_nonce']) && wp_verify_nonce($_POST['rp_chapter_meta_nonce'], 'rp_save_chapter_meta')) {
        if (isset($_POST['rp_parent_novel_id'])) update_post_meta($post_id, '_rp_parent_novel_id', intval($_POST['rp_parent_novel_id']));
        if (isset($_POST['rp_chapter_number'])) update_post_meta($post_id, '_rp_chapter_number', intval($_POST['rp_chapter_number']));
    }
}
add_action('save_post', 'rp_novels_save_meta_boxes');
