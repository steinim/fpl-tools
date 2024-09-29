#!/usr/bin/env node

// fpl.js

import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import teamCommand from './commands/team.js';
import fixturesCommand from './commands/fixtures.js';
import playerCommand from './commands/player.js';
import playersCommand from './commands/players.js';
import picksCommand from './commands/picks.js';
import searchPlayerCommand from './commands/searchPlayer.js';
import teamPlayersCommand from './commands/teamPlayers.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('fpl')
  .description('Fantasy Premier League data retrieval tool')
  .version('1.0.0');

// Team command
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

// Fixtures command
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

// Player command
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

// Players command
const players = program
  .command('players')
  .description('Retrieve detailed information about multiple players')
  .usage('[options]')
  .option('--id <player-ids...>', 'Player ID(s), can provide multiple IDs separated by spaces')
  .option('--file <path>', 'Path to a file containing player IDs (one per line)');

players.addHelpText(
  'after',
  `
Description:
  Retrieves detailed information about multiple players, including past performance and upcoming fixtures.
  You can provide multiple player IDs using the --id option or specify a file with player IDs using --file.
  The data is saved to output/player-<player-id>-<YYYY-MM-DD>.json for each player.
`
);

players.action(async (options) => {
  let playerIds = [];

  if (options.id) {
    playerIds = options.id;
  } else if (options.file) {
    try {
      const fileContent = fs.readFileSync(options.file, 'utf-8');
      playerIds = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');
    } catch (error) {
      console.error(`Error reading file "${options.file}":`, error.message);
      process.exit(1);
    }
  } else {
    console.error('Error: No player IDs provided.');
    process.exit(1);
  }

  for (const playerId of playerIds) {
    // Parameter Validation
    if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
      console.error(`Error: Player ID "${playerId}" must be a positive integer.`);
      continue; // Skip invalid player IDs
    }

    await playerCommand(playerId);
  }
});

// Picks command
const picks = program
  .command('picks')
  .description("Retrieve a manager's squad picks for a specific gameweek")
  .usage('[options]')
  .option('--id <team-id>', 'Team ID (defaults to myId from config.js)')
  .option('--gw <gameweek>', 'Gameweek number (defaults to current gameweek)');

picks.addHelpText(
  'after',
  `
Description:
  Retrieves the details of a manager's 15 players (squad picks) for the specified gameweek.
  If --id is not provided, the default team ID from the configuration (myId) is used.
  If --gw is not provided, the current gameweek is used.
  The data is saved to output/picks-<team-id>-GW<gameweek>-<YYYY-MM-DD>.json.
`
);

picks.action(async (options) => {
  const teamId = options.id || config.myId;
  let gameweek = options.gw;

  // Validate teamId
  if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
    console.error('Error: Team ID must be a positive integer.');
    process.exit(1);
  }

  await picksCommand(teamId, gameweek);
});

// Search-player command
const searchPlayer = program
  .command('search-player')
  .description('Search for a player ID based on name')
  .usage('--name <player-name>')
  .requiredOption('--name <player-name>', 'Player name to search for');

searchPlayer.addHelpText(
  'after',
  `
Description:
  Searches for players whose names match the provided input.
  Non-English characters are mapped to English equivalents (e.g., 'Ødegaard' becomes 'Odegaard').
  You can search using first names, last names, or both.
`
);

searchPlayer.action(async (options) => {
  const playerName = options.name;

  if (!playerName || typeof playerName !== 'string') {
    console.error('Error: Please provide a valid player name using --name.');
    process.exit(1);
  }

  await searchPlayerCommand(playerName);
});

// Team-players command
const teamPlayers = program
  .command('team-players')
  .description('List all players on a given team, ordered by total points per position')
  .usage('--team <team-name>')
  .requiredOption('--team <team-name>', 'Team name to list players from');

teamPlayers.addHelpText(
  'after',
  `
Description:
  Lists all players from the specified team, grouped by position.
  Players within each position are ordered by highest total points.
  Positions include Goalkeepers, Defenders, Midfielders, and Forwards.
`
);

teamPlayers.action(async (options) => {
  const teamName = options.team;

  if (!teamName || typeof teamName !== 'string') {
    console.error('Error: Please provide a valid team name using --team.');
    process.exit(1);
  }

  await teamPlayersCommand(teamName);
});

// Enhance the help output to list available commands
program.on('--help', () => {
  console.log('');
  console.log('Available Commands:');
  console.log('  team          Retrieve information about FPL teams');
  console.log('  fixtures      Retrieve fixtures for specified gameweeks');
  console.log('  player        Retrieve detailed information about a specific player');
  console.log('  players       Retrieve detailed information about multiple players');
  console.log("  picks         Retrieve a manager's squad picks for a specific gameweek");
  console.log('  search-player Search for a player ID based on name');
  console.log('  team-players  List all players on a given team, ordered by total points per position');
  console.log('');
  console.log('For more information on a specific command, use "fpl <command> --help"');
});

// Display help if no command is provided
if (!process.argv.slice(2).length) {
  program.help();
}

program.parse(process.argv);
