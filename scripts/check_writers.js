import { query, queryOne, hashPassword } from '../backend/db.js';
import { createWriterAccount } from '../backend/writers.js';

async function main() {
  const writers = await query("SELECT id, username, email, role, status FROM users WHERE role = 'writer'");
  console.log('Current writers:', writers);

  // If no writer exists, create one with known credentials for testing
  let writer = writers.find(w => w.email === 'kavitha.writer@rpnovels.com');
  if (!writer) {
    const res = await createWriterAccount({
      fullName: 'Kavitha Ramasamy',
      email: 'kavitha.writer@rpnovels.com',
      password: 'WriterPassword123!',
      status: 'active',
      createdBy: 2
    });
    console.log('Created test writer:', res);
  } else {
    // Ensure password is WriterPassword123!
    const { hash, salt } = hashPassword('WriterPassword123!');
    await query("UPDATE users SET password_hash = ?, salt = ?, status = 'active' WHERE email = 'kavitha.writer@rpnovels.com'", [hash, salt]);
    console.log('Reset test writer password to WriterPassword123!');
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
