<?php
/**
 * SEO & Schema.org Structured Data
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

/**
 * Output Schema.org Book and Breadcrumb Structured Data in wp_head
 */
function rp_novels_output_structured_data() {
    if (is_singular('novel')) {
        global $post;
        $author_name = get_post_meta($post->ID, '_rp_author_name', true) ?: 'Rudhra Prarthana';
        $tamil_title = get_post_meta($post->ID, '_rp_tamil_title', true);
        $thumb_url   = get_the_post_thumbnail_url($post->ID, 'rp-novel-cover') ?: '';

        $schema = array(
            '@context'      => 'https://schema.org',
            '@type'         => 'Book',
            'name'          => get_the_title($post),
            'alternateName' => $tamil_title,
            'author'        => array(
                '@type' => 'Person',
                'name'  => $author_name
            ),
            'description'   => wp_strip_all_tags(get_the_excerpt($post)),
            'image'         => $thumb_url,
            'url'           => get_permalink($post),
            'inLanguage'    => 'ta',
            'publisher'     => array(
                '@type' => 'Organization',
                'name'  => 'Rudhra Prarthana Novels'
            )
        );

        echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . '</script>' . "\n";
    }
}
add_action('wp_head', 'rp_novels_output_structured_data');
