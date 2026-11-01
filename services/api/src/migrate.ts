import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { loadConfig } from './config';
import { logger } from './logger';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const filenames = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const filename of filenames) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      );
      if (alreadyApplied.rows.length > 0) {
        logger.info('Migration already applied', { filename });
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
          filename,
        ]);
        await client.query('COMMIT');
        logger.info('Migration applied', { filename });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const config = loadConfig();
  if (!config.databaseUrl) {
    console.error('DATABASE_URL is required to run migrations.');
    process.exit(1);
  }
  runMigrations(config.databaseUrl)
    .then(() => {
      logger.info('Migrations complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
