import { Command } from 'commander';

export const prefsCommand = new Command('prefs')
  .description('Preferences management')
  .action(() => {
    console.log('Preferences commands not implemented yet. Use --help to see available subcommands.');
  });

prefsCommand
  .command('show')
  .description('Show all preferences')
  .action(() => {
    console.log('Not implemented yet: prefs show');
  });

prefsCommand
  .command('set <key> <value>')
  .description('Set a preference (e.g., dietary-restrictions, disliked-ingredients, default-servings, max-prep-time)')
  .action((key, value) => {
    console.log(`Not implemented yet: prefs set ${key} ${value}`);
  });

prefsCommand
  .command('clear <key>')
  .description('Clear a preference')
  .action((key) => {
    console.log(`Not implemented yet: prefs clear ${key}`);
  });
