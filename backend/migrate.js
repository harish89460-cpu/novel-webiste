// Database Migration Runner for Rudhra Prarthana Novels
// Applies versioned SQL migrations to MySQL

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
export function loadEnv() {
  const envPath = fs.existsSync(path.resolve(__dirname, '.env'))
    ? path.resolve(__dirname, '.env')
    : path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();

export async function runMigrations() {
  loadEnv();
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root';
  const database = process.env.DB_NAME || 'rp_novels_db';

  console.log(`[Migration] Connecting to MySQL at ${host}:${port} as ${user}...`);

  // 1. Initial connection without database to create DB if needed
  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  await rootConn.query(`
    CREATE DATABASE IF NOT EXISTS \`${database}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
  `);
  await rootConn.end();

  // 2. Connect with target database
  const dbConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
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

  await dbConn.end();
  console.log('[Migration] All migrations completed successfully.');
}

// Allow direct execution: node server/migrate.js
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations().catch(err => {
    console.error('[Migration Error]:', err);
    process.exit(1);
  });
}
