// @meals/core - Domain logic and repositories
export const version = '0.1.0';

// Database connection
export { getDb, closeDb, isDbOpen } from './db/connection.js';
export type { Database, DbOptions } from './db/connection.js';

// Database migrations
export {
  migrate,
  getAppliedMigrations,
  getDefaultMigrationsDir,
} from './db/migrate.js';
