import { Command } from 'commander';

export const planCommand = new Command('plan')
  .description('Weekly plan management')
  .action(() => {
    console.log('Plan commands not implemented yet. Use --help to see available subcommands.');
  });

planCommand
  .command('create <week>')
  .description('Create a new weekly plan (week format: YYYY-Wnn, this-week, or next-week)')
  .action((week) => {
    console.log(`Not implemented yet: plan create ${week}`);
  });

planCommand
  .command('show [week]')
  .description('Show current plan')
  .action((week) => {
    console.log(`Not implemented yet: plan show ${week ?? 'current'}`);
  });

planCommand
  .command('suggest [week]')
  .description('Get AI suggestions to fill empty slots')
  .option('--max-prep <minutes>', 'Maximum prep time in minutes')
  .option('--cuisine <cuisine...>', 'Preferred cuisines')
  .action((week) => {
    console.log(`Not implemented yet: plan suggest ${week ?? 'current'}`);
  });

planCommand
  .command('set <week> <day> <meal> <recipe-id>')
  .description('Set a specific meal (day: mon-sun, meal: breakfast/lunch/dinner)')
  .action((week, day, meal, recipeId) => {
    console.log(`Not implemented yet: plan set ${week} ${day} ${meal} ${recipeId}`);
  });

planCommand
  .command('swap <week> <day> <meal>')
  .description('Swap a meal (get alternatives)')
  .option('-r, --reason <text>', 'Reason for swapping')
  .action((week, day, meal) => {
    console.log(`Not implemented yet: plan swap ${week} ${day} ${meal}`);
  });

planCommand
  .command('activate <week>')
  .description('Mark plan as active')
  .action((week) => {
    console.log(`Not implemented yet: plan activate ${week}`);
  });

planCommand
  .command('export [week]')
  .description('Export plan to markdown')
  .option('-o, --output <file>', 'Output file path')
  .action((week) => {
    console.log(`Not implemented yet: plan export ${week ?? 'current'}`);
  });
