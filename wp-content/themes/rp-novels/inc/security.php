<?php
/**
 * Security, Permissions, and Content Protection
 *
 * @package RP_Novels
 */

if (!defined('ABSPATH')) exit;

/**
 * Enforce Content Protection Headers & Body Attributes
 */
function rp_novels_security_headers() {
    // Prevent MIME-sniffing
    header('X-Content-Type-Options: nosniff');
    // Prevent Clickjacking
    header('X-Frame-Options: SAMEORIGIN');
    // Referrer policy
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
add_action('send_headers', 'rp_novels_security_headers');

/**
 * Capability Verification for Novel & Chapter Management
 */
function rp_can_user_edit_novel($user_id, $novel_id) {
    if (user_can($user_id, 'administrator') || user_can($user_id, 'editor')) {
        return true;
    }
    $post = get_post($novel_id);
    return ($post && (int)$post->post_author === (int)$user_id && user_can($user_id, 'publish_posts'));
}

/**
 * Sanitize Custom Request Inputs
 */
function rp_sanitize_array($data) {
    $clean = array();
    foreach ($data as $key => $val) {
        $clean[sanitize_key($key)] = is_array($val) ? rp_sanitize_array($val) : sanitize_text_field($val);
    }
    return $clean;
}
