import { fileURLToPath } from 'url';
import { pool } from './pool.js';

export async function dropTables() {
  console.log('⚠️ Dropping all tables...');
  const dropSql = `
    DROP TABLE IF EXISTS exchanges CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS connections CASCADE;
    DROP TABLE IF EXISTS swipes CASCADE;
    DROP TABLE IF EXISTS active_recommendations CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    DROP TABLE IF EXISTS user_bios CASCADE;
    DROP TABLE IF EXISTS profiles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `;
  try {
    await pool.query(dropSql);
    console.log('✅ All tables dropped successfully!');
  } catch (err) {
    console.error('❌ Failed to drop tables:', err);
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  dropTables()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

