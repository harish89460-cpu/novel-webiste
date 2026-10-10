<?php
/**
 * Register Custom Post Types: Novels, Chapters, Announcements
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

function rp_novels_register_cpts() {
    // 1. Novels Custom Post Type
    $novel_labels = array(
        'name'               => _x('Novels', 'post type general name', 'rp-novels'),
        'singular_name'      => _x('Novel', 'post type singular name', 'rp-novels'),
        'menu_name'          => _x('Novels', 'admin menu', 'rp-novels'),
        'name_admin_bar'     => _x('Novel', 'add new on admin bar', 'rp-novels'),
        'add_new'            => _x('Add New Novel', 'novel', 'rp-novels'),
        'add_new_item'       => __('Add New Novel', 'rp-novels'),
        'new_item'           => __('New Novel', 'rp-novels'),
        'edit_item'          => __('Edit Novel', 'rp-novels'),
        'view_item'          => __('View Novel', 'rp-novels'),
        'all_items'          => __('All Novels', 'rp-novels'),
        'search_items'       => __('Search Novels', 'rp-novels'),
        'not_found'          => __('No novels found.', 'rp-novels'),
        'not_found_in_trash' => __('No novels found in Trash.', 'rp-novels')
    );

    $novel_args = array(
        'labels'             => $novel_labels,
        'public'             => true,
        'publicly_queryable' => true,
        'show_ui'            => true,
        'show_in_menu'       => true,
        'query_var'          => true,
        'rewrite'            => array('slug' => 'novels'),
        'capability_type'    => 'post',
        'has_archive'        => true,
        'hierarchical'       => false,
        'menu_position'      => 5,
        'menu_icon'          => 'dashicons-book',
        'supports'           => array('title', 'editor', 'thumbnail', 'excerpt', 'author', 'comments', 'custom-fields'),
        'show_in_rest'       => true,
    );
    register_post_type('novel', $novel_args);

    // 2. Chapters Custom Post Type
    $chapter_labels = array(
        'name'               => _x('Chapters', 'post type general name', 'rp-novels'),
        'singular_name'      => _x('Chapter', 'post type singular name', 'rp-novels'),
        'menu_name'          => _x('Chapters (அத்தியாயங்கள்)', 'admin menu', 'rp-novels'),
        'add_new'            => __('Add Chapter', 'rp-novels'),
        'add_new_item'       => __('Add New Chapter', 'rp-novels'),
        'edit_item'          => __('Edit Chapter', 'rp-novels'),
        'view_item'          => __('View Chapter', 'rp-novels'),
        'all_items'          => __('All Chapters', 'rp-novels'),
        'search_items'       => __('Search Chapters', 'rp-novels'),
    );

    $chapter_args = array(
        'labels'             => $chapter_labels,
        'public'             => true,
        'publicly_queryable' => true,
        'show_ui'            => true,
        'show_in_menu'       => 'edit.php?post_type=novel',
        'query_var'          => true,
        'rewrite'            => array('slug' => 'chapter'),
        'capability_type'    => 'post',
        'has_archive'        => false,
        'hierarchical'       => false,
        'supports'           => array('title', 'editor', 'thumbnail', 'author', 'comments', 'custom-fields'),
        'show_in_rest'       => true,
    );
    register_post_type('chapter', $chapter_args);

    // 3. Announcements Custom Post Type
    $announcement_labels = array(
        'name'          => _x('Announcements', 'post type general name', 'rp-novels'),
        'singular_name' => _x('Announcement', 'post type singular name', 'rp-novels'),
        'menu_name'     => _x('Announcements', 'admin menu', 'rp-novels'),
        'add_new'       => __('Add Announcement', 'rp-novels'),
    );

    $announcement_args = array(
        'labels'        => $announcement_labels,
        'public'        => true,
        'show_ui'       => true,
        'menu_position' => 6,
        'menu_icon'     => 'dashicons-megaphone',
        'supports'      => array('title', 'editor'),
        'show_in_rest'  => true,
    );
    register_post_type('rp_announcement', $announcement_args);
}
add_action('init', 'rp_novels_register_cpts');
