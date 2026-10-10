<?php
/**
 * Rudhra Prarthana Novels Theme Functions
 *
 * @package RP_Novels
 * @version 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

// Theme Constants
define('RP_NOVELS_VERSION', '1.0.0');
define('RP_NOVELS_DIR', get_template_directory());
define('RP_NOVELS_URI', get_template_directory_uri());

/**
 * Theme Setup
 */
function rp_novels_setup() {
    // Localization
    load_theme_textdomain('rp-novels', RP_NOVELS_DIR . '/languages');

    // Title tag & thumbnails
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_image_size('rp-novel-cover', 600, 900, true);
    add_image_size('rp-novel-thumb', 300, 450, true);

    // Custom Logo
    add_theme_support('custom-logo', array(
        'height'      => 120,
        'width'       => 120,
        'flex-height' => true,
        'flex-width'  => true,
    ));

    // HTML5 support
    add_theme_support('html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script'
    ));

    // Register Navigation Menus
    register_nav_menus(array(
        'primary-menu' => __('Primary Navigation', 'rp-novels'),
        'mobile-menu'  => __('Mobile Navigation', 'rp-novels'),
        'footer-menu'  => __('Footer Navigation', 'rp-novels'),
    ));
}
add_action('after_setup_theme', 'rp_novels_setup');

/**
 * Enqueue Theme Scripts and Styles
 */
function rp_novels_enqueue_assets() {
    // Google Fonts
    wp_enqueue_style(
        'rp-google-fonts',
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Noto+Sans+Tamil:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
        array(),
        null
    );

    // Main Compiled Stylesheet
    wp_enqueue_style(
        'rp-main-style',
        RP_NOVELS_URI . '/assets/css/main.css',
        array(),
        RP_NOVELS_VERSION
    );

    // WordPress Root style.css
    wp_enqueue_style(
        'rp-theme-style',
        get_stylesheet_uri(),
        array('rp-main-style'),
        RP_NOVELS_VERSION
    );

    // Main Frontend Application Script
    wp_enqueue_script(
        'rp-main-script',
        RP_NOVELS_URI . '/assets/js/main.js',
        array('jquery'),
        RP_NOVELS_VERSION,
        true
    );

    // Localize Script for AJAX & Nonces
    wp_localize_script('rp-main-script', 'rpNovelsData', array(
        'ajaxUrl'   => admin_url('admin-ajax.php'),
        'restUrl'   => get_rest_url(null, 'rp-novels/v1/'),
        'nonce'     => wp_create_nonce('rp_novels_secure_nonce'),
        'siteUrl'   => home_url('/'),
        'isLoggedIn'=> is_user_logged_in(),
        'userId'    => get_current_user_id()
    ));
}
add_action('wp_enqueue_scripts', 'rp_novels_enqueue_assets');

/**
 * Register Sidebar and Widget Areas
 */
function rp_novels_widgets_init() {
    register_sidebar(array(
        'name'          => __('Forum Sidebar', 'rp-novels'),
        'id'            => 'forum-sidebar',
        'description'   => __('Sidebar widgets displayed on forum and community pages.', 'rp-novels'),
        'before_widget' => '<div id="%1$s" class="forum-widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));
}
add_action('widgets_init', 'rp_novels_widgets_init');

// Include Core Theme Modules
require_once RP_NOVELS_DIR . '/inc/post-types.php';
require_once RP_NOVELS_DIR . '/inc/taxonomies.php';
require_once RP_NOVELS_DIR . '/inc/meta-boxes.php';
require_once RP_NOVELS_DIR . '/inc/security.php';
require_once RP_NOVELS_DIR . '/inc/seo.php';
require_once RP_NOVELS_DIR . '/inc/helpers.php';
