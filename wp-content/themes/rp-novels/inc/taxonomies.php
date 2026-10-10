<?php
/**
 * Custom Taxonomies for Rudhra Prarthana Novels
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

function rp_novels_register_taxonomies() {
    // 1. Genre Taxonomy
    $genre_labels = array(
        'name'              => _x('Genres', 'taxonomy general name', 'rp-novels'),
        'singular_name'     => _x('Genre', 'taxonomy singular name', 'rp-novels'),
        'search_items'      => __('Search Genres', 'rp-novels'),
        'all_items'         => __('All Genres', 'rp-novels'),
        'edit_item'         => __('Edit Genre', 'rp-novels'),
        'update_item'       => __('Update Genre', 'rp-novels'),
        'add_new_item'      => __('Add New Genre', 'rp-novels'),
        'new_item_name'     => __('New Genre Name', 'rp-novels'),
        'menu_name'         => __('Genres (வகைகள்)', 'rp-novels'),
    );
    register_taxonomy('genre', array('novel'), array(
        'hierarchical'      => true,
        'labels'            => $genre_labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'genre'),
        'show_in_rest'      => true,
    ));

    // 2. Novel Status Taxonomy (Ongoing, Completed, Audio)
    $status_labels = array(
        'name'              => _x('Novel Statuses', 'taxonomy general name', 'rp-novels'),
        'singular_name'     => _x('Novel Status', 'taxonomy singular name', 'rp-novels'),
        'menu_name'         => __('Status (நிலை)', 'rp-novels'),
    );
    register_taxonomy('novel_status', array('novel'), array(
        'hierarchical'      => true,
        'labels'            => $status_labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'status'),
        'show_in_rest'      => true,
    ));

    // 3. Novel Category (Ongoing Novels, Completed Novels, Audio Novels, Short Stories)
    $category_labels = array(
        'name'              => _x('Novel Categories', 'taxonomy general name', 'rp-novels'),
        'singular_name'     => _x('Novel Category', 'taxonomy singular name', 'rp-novels'),
        'menu_name'         => __('Categories (பிரிவுகள்)', 'rp-novels'),
    );
    register_taxonomy('novel_category', array('novel'), array(
        'hierarchical'      => true,
        'labels'            => $category_labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'novel-category'),
        'show_in_rest'      => true,
    ));
}
add_action('init', 'rp_novels_register_taxonomies');
