import { fileURLToPath } from 'url';
import { dropTables } from './drop.js';
import { migrate } from './migrate.js';
import { pool } from './pool.js';

export async function resetDatabase() {
  console.log('🔄 Resetting database...');
  await dropTables();
  await migrate();
  console.log('✨ Database reset complete!');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

