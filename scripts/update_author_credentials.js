import { getDb, loadEnv, hashPassword } from '../backend/db.js';

loadEnv();
const pool = getDb();
const { hash, salt } = hashPassword('Rudhra.pass');

await pool.query(
  'UPDATE users SET email = ?, password_hash = ?, salt = ?, role = ? WHERE id = 2 OR username = ?',
  ['digitalmarkservices.in@gmail.com', hash, salt, 'Admin', 'rudhra_author']
);

const [rows] = await pool.query('SELECT id, username, email, role, password_hash, salt FROM users WHERE id = 2');
console.log('Updated Author User in MySQL:');
console.log(rows[0]);
process.exit(0);
