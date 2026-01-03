import { Command } from 'commander';

export const groceryCommand = new Command('grocery')
  .description('Grocery list generation')
  .action(() => {
    console.log('Grocery commands not implemented yet. Use --help to see available subcommands.');
  });

groceryCommand
  .command('generate [week]')
  .description('Generate grocery list for a week')
  .option('--include-pantry', 'Include items already in pantry')
  .option('--group-by <method>', 'Group by: category, recipe, or aisle', 'category')
  .action((week) => {
    console.log(`Not implemented yet: grocery generate ${week ?? 'current'}`);
  });

groceryCommand
  .command('export [week]')
  .description('Export grocery list')
  .option('-o, --output <file>', 'Output file path')
  .option('--format <fmt>', 'Output format: md, txt, or json', 'md')
  .action((week) => {
    console.log(`Not implemented yet: grocery export ${week ?? 'current'}`);
  });
