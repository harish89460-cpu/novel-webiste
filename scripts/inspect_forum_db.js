import { query } from '../backend/db.js';

async function inspectForum() {
  const tables = await query("SHOW TABLES LIKE '%forum%';");
  console.log('Forum tables:', tables);
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    const cols = await query('DESCRIBE ' + tableName);
    console.log('\n--- Table:', tableName, '---');
    console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Default: c.Default })));
    const rows = await query(`SELECT * FROM ${tableName} LIMIT 10`);
    console.log(`Sample rows (${rows.length}):`);
    console.log(rows);
  }
}

inspectForum().catch(console.error);
