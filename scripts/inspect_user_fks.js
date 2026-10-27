import { query } from '../backend/db.js';

async function main() {
  const fks = await query(`
    SELECT k.TABLE_NAME, k.COLUMN_NAME, k.CONSTRAINT_NAME, r.DELETE_RULE
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r 
      ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
    WHERE k.CONSTRAINT_SCHEMA = 'rp_novels_db' AND k.REFERENCED_TABLE_NAME = 'users';
  `);
  console.log('ALL FKS REFERENCING users(id):', fks);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

