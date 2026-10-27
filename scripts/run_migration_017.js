// Script: run_migration_017.js
// Applies Migration 017 for WhatsApp-like Chat Features (Images, Voice, Edit, Delete, Locks)

import { query, getDb } from '../backend/db.js';

async function run() {
  console.log('--- RUNNING MIGRATION 017: WhatsApp-like Chat Features ---');

  try {
    const dbName = process.env.DB_NAME || 'rp_novels_db';

    // 1. Check and add columns to messages table
    console.log('1. Checking messages columns...');
    const msgCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages';
    `, [dbName]);
    const msgColNames = msgCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!msgColNames.includes('message_type')) {
      await query(`ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) NOT NULL DEFAULT 'text' AFTER content;`);
      console.log('   ✓ Added message_type to messages');
    }
    if (!msgColNames.includes('attachment_url')) {
      await query(`ALTER TABLE messages ADD COLUMN attachment_url VARCHAR(500) NULL AFTER message_type;`);
      console.log('   ✓ Added attachment_url to messages');
    }
    if (!msgColNames.includes('attachment_meta')) {
      await query(`ALTER TABLE messages ADD COLUMN attachment_meta JSON NULL AFTER attachment_url;`);
      console.log('   ✓ Added attachment_meta to messages');
    }
    if (!msgColNames.includes('is_edited')) {
      await query(`ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) NOT NULL DEFAULT 0 AFTER attachment_meta;`);
      console.log('   ✓ Added is_edited to messages');
    }
    if (!msgColNames.includes('edited_at')) {
      await query(`ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL AFTER is_edited;`);
      console.log('   ✓ Added edited_at to messages');
    }
    if (!msgColNames.includes('is_deleted')) {
      await query(`ALTER TABLE messages ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER edited_at;`);
      console.log('   ✓ Added is_deleted to messages');
    }
    if (!msgColNames.includes('deleted_at')) {
      await query(`ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL AFTER is_deleted;`);
      console.log('   ✓ Added deleted_at to messages');
    }
    if (!msgColNames.includes('deleted_by')) {
      await query(`ALTER TABLE messages ADD COLUMN deleted_by INT NULL AFTER deleted_at;`);
      console.log('   ✓ Added deleted_by to messages');
    }

    // 2. Check and add columns to conversations table
    console.log('2. Checking conversations columns...');
    const convCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'conversations';
    `, [dbName]);
    const convColNames = convCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!convColNames.includes('is_locked')) {
      await query(`ALTER TABLE conversations ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER last_message_at;`);
      console.log('   ✓ Added is_locked to conversations');
    }
    if (!convColNames.includes('locked_by')) {
      await query(`ALTER TABLE conversations ADD COLUMN locked_by INT NULL AFTER is_locked;`);
      console.log('   ✓ Added locked_by to conversations');
    }
    if (!convColNames.includes('locked_reason')) {
      await query(`ALTER TABLE conversations ADD COLUMN locked_reason VARCHAR(255) NULL AFTER locked_by;`);
      console.log('   ✓ Added locked_reason to conversations');
    }
    if (!convColNames.includes('locked_at')) {
      await query(`ALTER TABLE conversations ADD COLUMN locked_at TIMESTAMP NULL AFTER locked_reason;`);
      console.log('   ✓ Added locked_at to conversations');
    }

    console.log('✓ Migration 017 completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration 017 error:', err);
    process.exit(1);
  }
}

run();
