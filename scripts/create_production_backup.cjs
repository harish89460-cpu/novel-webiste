// Database Backup Script for Rudhra Prarthana Novels
// Creates a complete, full-fidelity JSON and SQL dump of all tables and schemas

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonBackupPath = path.join(backupDir, `production_pre_cleanup_backup_${timestamp}.json`);
  const sqlBackupPath = path.join(backupDir, `production_pre_cleanup_backup_${timestamp}.sql`);

  console.log('Connecting to MySQL database rp_novels_db...');
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'rp_novels_db'
  });

  try {
    const [tables] = await conn.query('SHOW TABLES;');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`Found ${tableNames.length} tables to backup.`);

    const fullDump = {
      timestamp: new Date().toISOString(),
      database: 'rp_novels_db',
      tableCount: tableNames.length,
      tables: {}
    };

    let sqlDump = `-- Rudhra Prarthana Novels Pre-Cleanup Database Backup\n-- Generated: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const tableName of tableNames) {
      const [[createResult]] = await conn.query(`SHOW CREATE TABLE \`${tableName}\`;`);
      const createTableSql = createResult['Create Table'];
      sqlDump += `-- -----------------------------------------------------\n-- Table structure for ${tableName}\n-- -----------------------------------------------------\nDROP TABLE IF EXISTS \`${tableName}\`;\n${createTableSql};\n\n`;

      const [rows] = await conn.query(`SELECT * FROM \`${tableName}\`;`);
      fullDump.tables[tableName] = {
        rowCount: rows.length,
        rows
      };

      if (rows.length > 0) {
        sqlDump += `-- Dumping data for table ${tableName}\nLOCK TABLES \`${tableName}\` WRITE;\n`;
        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        for (const row of rows) {
          const values = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            return conn.escape(val);
          }).join(', ');
          sqlDump += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
        }
        sqlDump += `UNLOCK TABLES;\n\n`;
      }
      console.log(`  ✓ Backed up table ${tableName}: ${rows.length} rows`);
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    fs.writeFileSync(jsonBackupPath, JSON.stringify(fullDump, null, 2), 'utf8');
    fs.writeFileSync(sqlBackupPath, sqlDump, 'utf8');

    const jsonStats = fs.statSync(jsonBackupPath);
    const sqlStats = fs.statSync(sqlBackupPath);

    console.log('\n========================================================');
    console.log('DATABASE BACKUP COMPLETED SUCCESSFULLY');
    console.log(`JSON Backup: ${jsonBackupPath} (${(jsonStats.size / 1024).toFixed(2)} KB)`);
    console.log(`SQL Backup:  ${sqlBackupPath} (${(sqlStats.size / 1024).toFixed(2)} KB)`);
    console.log('========================================================');
  } finally {
    await conn.end();
  }
}

backupDatabase().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

