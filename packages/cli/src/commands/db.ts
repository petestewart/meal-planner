import { Command } from 'commander';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  getAppliedMigrations,
  RecipeRepository,
  PlanRepository,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  printInfo,
  getGlobalOptions,
} from '../output.js';

export const dbCommand = new Command('db')
  .description('Database utilities')
  .action(() => {
    console.log('Database commands. Use --help to see available subcommands.');
  });

dbCommand
  .command('migrate')
  .description('Run pending migrations')
  .action(function (this: Command) {
    const globalOpts = getGlobalOptions(this as unknown as Parameters<typeof getGlobalOptions>[0]);

    try {
      const db = getDb({ dbPath: globalOpts.db });
      const beforeMigrations = getAppliedMigrations(db);
      const appliedCount = migrate(db, getDefaultMigrationsDir());
      const afterMigrations = getAppliedMigrations(db);

      if (globalOpts.json) {
        printJson({
          migrationsApplied: appliedCount,
          totalMigrations: afterMigrations.length,
          migrations: afterMigrations,
        });
      } else {
        if (appliedCount === 0) {
          printInfo('Database is up to date. No migrations needed.');
        } else {
          printSuccess(`Applied ${appliedCount} migration(s).`);
        }
        if (globalOpts.verbose) {
          console.log(`\nApplied migrations:`);
          for (const m of afterMigrations) {
            const isNew = !beforeMigrations.some((b) => b.version === m.version);
            console.log(`  - v${m.version} (applied ${m.appliedAt})${isNew ? ' (new)' : ''}`);
          }
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

dbCommand
  .command('backup')
  .description('Backup database')
  .option('-o, --output <file>', 'Output file path')
  .action(function (this: Command, options: { output?: string }) {
    const globalOpts = getGlobalOptions(this as unknown as Parameters<typeof getGlobalOptions>[0]);

    if (!options.output) {
      printError('Output file path is required. Use --output <file>');
      process.exit(1);
    }

    try {
      const db = getDb({ dbPath: globalOpts.db });
      const outputPath = resolve(options.output);

      // Use VACUUM INTO for safe backup (creates a consistent snapshot)
      db.exec(`VACUUM INTO '${outputPath.replace(/'/g, "''")}'`);

      // Get file size for reporting
      const stats = statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      if (globalOpts.json) {
        printJson({
          success: true,
          path: outputPath,
          sizeBytes: stats.size,
          sizeKB: parseFloat(sizeKB),
        });
      } else {
        printSuccess(`Created backup at ${outputPath} (size: ${sizeKB} KB)`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

dbCommand
  .command('stats')
  .description('Show database statistics')
  .action(function (this: Command) {
    const globalOpts = getGlobalOptions(this as unknown as Parameters<typeof getGlobalOptions>[0]);

    try {
      const db = getDb({ dbPath: globalOpts.db });
      const recipeRepo = new RecipeRepository(db);
      const planRepo = new PlanRepository(db);

      const recipes = recipeRepo.list({});
      const plans = planRepo.list({});
      const migrations = getAppliedMigrations(db);

      const stats = {
        recipes: recipes.length,
        plans: plans.length,
        migrations: migrations.length,
      };

      if (globalOpts.json) {
        printJson(stats);
      } else {
        console.log('Database Statistics:');
        console.log(`  Recipes: ${stats.recipes}`);
        console.log(`  Plans: ${stats.plans}`);
        console.log(`  Migrations applied: ${stats.migrations}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
