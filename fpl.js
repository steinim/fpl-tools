#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import teamCommand from './commands/team.js';
import fixturesCommand from './commands/fixtures.js';
import playerCommand from './commands/player.js'; // Import the player command
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('fpl')
  .description('Fantasy Premier League data retrieval tool')
  .version('1.0.0');

// Team command with detailed help
const team = program
  .command('team')
  .description('Retrieve information about FPL teams')
  .usage('[options]')
  .option('--id <team-ids...>', 'Team ID(s), can provide multiple IDs separated by spaces')
  .option('--file <path>', 'Path to a file containing team IDs (one per line)');

team.addHelpText(
  'after',
  `
Description:
  Retrieves information about specific FPL teams based on the provided team IDs.
  You can provide multiple team IDs using the --id option or specify a file with team IDs using --file.
  If no team IDs are provided, the default IDs from the configuration are used.
  If the output file already exists, you will be prompted to choose whether to overwrite it.
  The data is saved to output/team-<team-id>-<YYYY-MM-DD>.json.
`
);

team.action(async (options) => {
  let teamIds = [];

  if (options.id) {
    teamIds = options.id;
  } else if (options.file) {
    try {
      const fileContent = fs.readFileSync(options.file, 'utf-8');
      teamIds = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');
    } catch (error) {
      console.error(`Error reading file "${options.file}":`, error.message);
      process.exit(1);
    }
  } else if (config.defaultTeamIds && config.defaultTeamIds.length > 0) {
    teamIds = config.defaultTeamIds;
  } else {
    console.error('Error: No team IDs provided and no default team IDs configured.');
    process.exit(1);
  }

  for (const teamId of teamIds) {
    // Parameter Validation
    if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
      console.error(`Error: Team ID "${teamId}" must be a positive integer.`);
      continue; // Skip invalid team IDs
    }

    await teamCommand(teamId);
  }
});

// Fixtures command with detailed help
const fixtures = program
  .command('fixtures')
  .description('Retrieve fixtures for specified gameweeks')
  .usage('--from <gameweek> --to <gameweek>')
  .requiredOption('--from <gameweek>', 'Starting gameweek number (inclusive)')
  .requiredOption('--to <gameweek>', 'Ending gameweek number (inclusive)');

fixtures.addHelpText(
  'after',
  `
Description:
  Retrieves fixture information for the specified range of gameweeks.
  Both --from and --to options are required and must be valid gameweek numbers.
  The data is saved to output/fixtures-<from>-<to>.json.
`
);

fixtures.action(async (options) => {
  const fromGameweek = parseInt(options.from, 10);
  const toGameweek = parseInt(options.to, 10);

  // Parameter Validation
  const MAX_GAMEWEEK = 38; // Adjust based on the current season

  if (
    isNaN(fromGameweek) ||
    isNaN(toGameweek) ||
    fromGameweek <= 0 ||
    toGameweek <= 0 ||
    fromGameweek > toGameweek ||
    fromGameweek > MAX_GAMEWEEK ||
    toGameweek > MAX_GAMEWEEK
  ) {
    console.error(`Error: Please provide valid gameweek numbers between 1 and ${MAX_GAMEWEEK}.`);
    process.exit(1);
  }

  await fixturesCommand(fromGameweek, toGameweek);
});

// Player command with detailed help
const player = program
  .command('player')
  .description('Retrieve detailed information about a specific player')
  .usage('--id <player-id>')
  .requiredOption('--id <player-id>', 'Player ID');

player.addHelpText(
  'after',
  `
Description:
  Retrieves in-depth information about a specific player, including past performance and upcoming fixtures.
  The data is saved to output/player-<player-id>-<YYYY-MM-DD>.json.
`
);

player.action(async (options) => {
  const playerId = options.id;

  // Parameter Validation
  if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
    console.error('Error: Player ID must be a positive integer.');
    process.exit(1);
  }

  await playerCommand(playerId);
});

// Enhance the help output to list available commands
program.on('--help', () => {
  console.log('');
  console.log('Available Commands:');
  console.log('  team       Retrieve information about FPL teams');
  console.log('  fixtures   Retrieve fixtures for specified gameweeks');
  console.log('  player     Retrieve detailed information about a specific player');
  console.log('');
  console.log('For more information on a specific command, use "fpl <command> --help"');
});

// Display help if no command is provided
if (!process.argv.slice(2).length) {
  program.help();
}

program.parse(process.argv);
