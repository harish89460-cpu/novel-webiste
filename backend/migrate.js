// Database Migration Runner for Rudhra Prarthana Novels
// Applies versioned SQL migrations to MySQL

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { getDbConfig, loadEnv } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { loadEnv };

export async function runMigrations() {
  loadEnv();
  const config = getDbConfig();

  console.log(`[Migration] Connecting to MySQL at ${config.host}:${config.port} as ${config.user}...`);

  // 1. Initial connection without database to create DB if needed (optional for managed DBs)
  try {
    const rootConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      multipleStatements: true
    });

    await rootConn.query(`
      CREATE DATABASE IF NOT EXISTS \`${config.database}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci;
    `);
    await rootConn.end();
  } catch (err) {
    // If user lacks permission to create database (e.g. managed cloud DB), log note and continue
    console.log(`[Migration] Database creation check: ${err.message}. Proceeding to connect to \`${config.database}\`...`);
  }

  // 2. Connect with target database
  const dbConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
    multipleStatements: true
  });

  // 3. Schema migrations table to track applied versions
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const [appliedRows] = await dbConn.query('SELECT version FROM schema_migrations;');
  const appliedSet = new Set(appliedRows.map(r => r.version));

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (!appliedSet.has(version)) {
      console.log(`[Migration] Applying ${file}...`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await dbConn.query(sqlContent);
      await dbConn.query('INSERT INTO schema_migrations (version) VALUES (?);', [version]);
      console.log(`[Migration] Successfully applied ${file}`);
    } else {
      console.log(`[Migration] ${file} already applied, skipping.`);
    }
  }

  // 4. Verify Admin Account in new database (ensures existing credentials are initialized if empty)
  const [adminUser] = await dbConn.query('SELECT id, username, email FROM users WHERE id = 2 OR username = ?;', ['rudhra_author']);
  if (!adminUser || adminUser.length === 0) {
    console.log('[Migration] Initializing authorized production Admin account...');
    await dbConn.query(`
      INSERT INTO users (id, username, email, password_hash, salt, role, status)
      VALUES (
        2,
        'rudhra_author',
        'digitalmarkservices.in@gmail.com',
        'f1cc1a04c0dd59b722fab02a6bd51f05def265027bfca575380b460196be48c769ae19a624e5f7ac3badc7e51ebfb5a36db42820461fbf4eac140d2ab20af3ae',
        '5da387c064cfb089b6dbf2b56f348e8b',
        'Admin',
        'active'
      )
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        role = VALUES(role),
        status = VALUES(status);
    `);
    await dbConn.query(`
      INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
      VALUES (
        2,
        'Rudhra Prarthana',
        'ருத்ர பிரார்த்தனா',
        '/profile.png',
        'Official Administrator and Author of Rudhra Prarthana Novels',
        'ருத்ரா பிரார்த்தனா நாவல்களின் நிர்வாகி மற்றும் எழுத்தாளர்',
        'Author',
        'எழுத்தாளர்',
        'Jan 2024',
        0, 0, 0
      )
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
    `);
    await dbConn.query(`
      INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
      VALUES (2, 1, 0, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE is_enabled = 1;
    `);
    console.log('[Migration] Authorized production Admin account successfully initialized.');
  }

  await dbConn.end();
  console.log('[Migration] All migrations completed successfully.');
}

// Allow direct execution: node backend/migrate.js
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations().catch(err => {
    console.error('[Migration Error]:', err);
    process.exit(1);
  });
}
