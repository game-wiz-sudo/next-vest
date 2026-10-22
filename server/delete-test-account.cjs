const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(
  path.join(__dirname, 'nextvest.db')
);

db.pragma('foreign_keys = ON');

const email = 'kaludestiny194@gmail.com';

try {
  const user = db.prepare(`
    SELECT id, email
    FROM users
    WHERE email = ?
  `).get(email);

  if (!user) {
    console.log('No account found with that email.');
  } else {
    const deleteAccount = db.transaction(() => {
      db.prepare(`
        DELETE FROM email_verification_tokens
        WHERE user_id = ?
      `).run(user.id);

      return db.prepare(`
        DELETE FROM users
        WHERE id = ? AND email = ?
      `).run(user.id, email);
    });

    const result = deleteAccount();

    if (result.changes === 1) {
      console.log('Test account deleted successfully.');
      console.log(`Email: ${email}`);
      console.log('You can now register again.');
    } else {
      console.log('The account was not deleted.');
    }
  }
} catch (error) {
  console.error('Deletion failed:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}