#!/usr/bin/env node

// fpl.js

import { Command } from 'commander';
import fs from 'fs/promises';
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
program
  .command('team')
  .description('Retrieve information about FPL teams')
  .usage('[options]')
  .option('-i, --id <team-ids...>', 'Team ID(s), can provide multiple IDs separated by spaces')
  .option('-f, --file <path>', 'Path to a file containing team IDs (one per line)')
  .action(async (options) => {
    try {
      let teamIds = [];

      if (options.id) {
        teamIds = options.id;
      } else if (options.file) {
        const fileContent = await fs.readFile(options.file, 'utf-8');
        teamIds = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');
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
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Fixtures command
program
  .command('fixtures')
  .description('Retrieve fixtures for specified gameweeks')
  .usage('--from <gameweek> --to <gameweek>')
  .requiredOption('--from <gameweek>', 'Starting gameweek number (inclusive)')
  .requiredOption('--to <gameweek>', 'Ending gameweek number (inclusive)')
  .action(async (options) => {
    try {
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
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Player command
program
  .command('player')
  .description('Retrieve detailed information about a specific player')
  .usage('--id <player-id>')
  .requiredOption('-i, --id <player-id>', 'Player ID')
  .action(async (options) => {
    try {
      const playerId = options.id;

      // Parameter Validation
      if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
        console.error('Error: Player ID must be a positive integer.');
        process.exit(1);
      }

      await playerCommand(playerId);
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Players command
program
  .command('players')
  .description('Retrieve detailed information about multiple players')
  .usage('[options]')
  .option('-i, --id <player-ids...>', 'Player ID(s), can provide multiple IDs separated by spaces')
  .option('-f, --file <path>', 'Path to a file containing player IDs (one per line)')
  .action(async (options) => {
    try {
      let playerIds = [];

      if (options.id) {
        playerIds = options.id;
      } else if (options.file) {
        const fileContent = await fs.readFile(options.file, 'utf-8');
        playerIds = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');
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
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Picks command
program
  .command('picks')
  .description("Retrieve a manager's squad picks for a specific gameweek")
  .usage('[options]')
  .option('-i, --id <team-id>', 'Team ID (defaults to myId from config.js)')
  .option('-g, --gw <gameweek>', 'Gameweek number (defaults to current gameweek)')
  .action(async (options) => {
    try {
      const teamId = options.id || config.myId;
      const gameweek = options.gw;

      // Validate teamId
      if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
        console.error('Error: Team ID must be a positive integer.');
        process.exit(1);
      }

      await picksCommand(teamId, gameweek);
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Search-player command
program
  .command('search-player')
  .description('Search for a player ID based on name')
  .usage('--name <player-name>')
  .requiredOption('-n, --name <player-name>', 'Player name to search for')
  .action(async (options) => {
    try {
      const playerName = options.name;

      if (!playerName || typeof playerName !== 'string') {
        console.error('Error: Please provide a valid player name using --name.');
        process.exit(1);
      }

      await searchPlayerCommand(playerName);
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
  });

// Team-players command
program
  .command('team-players')
  .description('List all players on a given team, ordered by total points per position')
  .usage('--team <team-name>')
  .requiredOption('-t, --team <team-name>', 'Team name to list players from')
  .action(async (options) => {
    try {
      const teamName = options.team;

      if (!teamName || typeof teamName !== 'string') {
        console.error('Error: Please provide a valid team name using --team.');
        process.exit(1);
      }

      await teamPlayersCommand(teamName);
    } catch (error) {
      console.error('An error occurred:', error.message);
    }
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
