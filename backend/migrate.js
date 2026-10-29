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

function splitSqlStatements(sql) {
  // Strip block comments /* ... */ and single-line comments -- ...
  const cleanedSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');

  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;

  for (let i = 0; i < cleanedSql.length; i++) {
    const char = cleanedSql[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      current += char;
      continue;
    }
    if (char === "'" && !inDouble && !inBacktick) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
    } else if (char === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
    } else if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (!appliedSet.has(version)) {
      console.log(`[Migration] Applying ${file}...`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = splitSqlStatements(sqlContent);
      for (let stmt of statements) {
        // Normalize MySQL syntax compatibility:
        stmt = stmt
          .replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN')
          .replace(/ADD INDEX IF NOT EXISTS/gi, 'ADD INDEX');
        try {
          await dbConn.query(stmt);
        } catch (stmtErr) {
          const benignCodes = [
            'ER_DUP_FIELDNAME',
            'ER_DUP_KEYNAME',
            'ER_TABLE_EXISTS_ERROR',
            'ER_CANT_DROP_FIELD_OR_KEY',
            'ER_DUP_ENTRY'
          ];
          if (benignCodes.includes(stmtErr.code)) {
            console.log(`[Migration] Notice in ${file}: ${stmtErr.code} - skipping duplicate definition`);
          } else {
            throw stmtErr;
          }
        }
      }
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
