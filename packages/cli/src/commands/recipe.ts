import { Command } from 'commander';

export const recipeCommand = new Command('recipe')
  .description('Recipe management')
  .action(() => {
    console.log('Recipe commands not implemented yet. Use --help to see available subcommands.');
  });

recipeCommand
  .command('list')
  .description('List/search recipes')
  .option('-q, --query <text>', 'Search query')
  .option('-t, --tag <tag...>', 'Filter by tags')
  .option('--cuisine <cuisine>', 'Filter by cuisine')
  .option('-l, --limit <n>', 'Limit results', '20')
  .action(() => {
    console.log('Not implemented yet: recipe list');
  });

recipeCommand
  .command('show <id>')
  .description('Show recipe details')
  .action((id) => {
    console.log(`Not implemented yet: recipe show ${id}`);
  });

recipeCommand
  .command('add')
  .description('Add a recipe manually')
  .requiredOption('--title <title>', 'Recipe title')
  .requiredOption('--instructions <text>', 'Recipe instructions')
  .option('--ingredient <ingredient...>', 'Ingredients (format: name:quantity:unit)')
  .option('--tag <tag...>', 'Tags to apply')
  .action(() => {
    console.log('Not implemented yet: recipe add');
  });

recipeCommand
  .command('import <url>')
  .description('Import recipe from URL')
  .option('--no-normalize', 'Skip ingredient normalization')
  .action((url) => {
    console.log(`Not implemented yet: recipe import ${url}`);
  });

recipeCommand
  .command('delete <id>')
  .description('Delete a recipe')
  .option('-f, --force', 'Skip confirmation')
  .action((id) => {
    console.log(`Not implemented yet: recipe delete ${id}`);
  });

recipeCommand
  .command('export <id>')
  .description('Export recipe to markdown')
  .option('-o, --output <file>', 'Output file path')
  .action((id) => {
    console.log(`Not implemented yet: recipe export ${id}`);
  });
