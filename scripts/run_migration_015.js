// Script: run_migration_015.js
// Executes database migration 015 for Admin Member Management & Security Audit Logs

import { query, getDb } from '../backend/db.js';

async function run() {
  console.log('--- RUNNING MIGRATION 015: Admin Member Management & Audit Logs ---');

  try {
    // 1. Modify users.status ENUM
    console.log('1. Updating users.status enum...');
    await query(`
      ALTER TABLE users 
      MODIFY COLUMN status ENUM('active','blocked','suspended','disabled','pending_deletion') NOT NULL DEFAULT 'active';
    `);
    console.log('   ✓ users.status ENUM updated');

    // 2. Check and add email_verified column
    console.log('2. Checking users.email_verified column...');
    const dbName = process.env.DB_NAME || 'rp_novels_db';
    const cols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified';
    `, [dbName]);

    if (!cols || cols.length === 0) {
      await query(`ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1 AFTER status;`);
      console.log('   ✓ users.email_verified added');
    } else {
      console.log('   ✓ users.email_verified already exists');
    }

    // 3. Create admin_audit_logs table
    console.log('3. Creating admin_audit_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT NOT NULL AUTO_INCREMENT,
        admin_id INT NOT NULL,
        target_user_id INT NULL,
        action VARCHAR(60) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        details TEXT NULL,
        metadata JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_admin_audit_admin (admin_id),
        KEY idx_admin_audit_target (target_user_id),
        KEY idx_admin_audit_action (action),
        KEY idx_admin_audit_created (created_at),
        CONSTRAINT fk_admin_audit_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✓ admin_audit_logs table verified');

    // 4. Record migration in schema_migrations if table exists
    try {
      await query(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES ('015', 'admin_member_management_and_audit', NOW())
        ON DUPLICATE KEY UPDATE applied_at = NOW();
      `);
      console.log('   ✓ schema_migrations updated with 015');
    } catch (_) {}

    console.log('=== MIGRATION 015 COMPLETED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('Migration 015 failed:', err);
    process.exit(1);
  }
}

run();
