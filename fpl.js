#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import teamCommand from './commands/team.js';
import config from './config.json'; // Import configuration

const program = new Command();

program
  .name('fpl')
  .description('Fantasy Premier League data retrieval tool')
  .version('1.0.0');

program
  .command('team')
  .description('Retrieve information about FPL teams')
  .option('--id <team-ids...>', 'Team ID(s), can be multiple IDs separated by spaces')
  .option('--file <path>', 'Path to a file containing team IDs (one per line)')
  .option('--help', 'Display help for the team command')
  .action(async (options) => {
    if (options.help) {
      console.log(`
Usage: fpl team [--id <team-ids...>] [--file <path>]

Options:
  --id <team-ids...>  Team ID(s), can provide multiple IDs separated by spaces
  --file <path>       Path to a file containing team IDs (one per line)
  --help              Display help for the team command

Description:
  Retrieves information about specific FPL teams based on the provided team IDs.
  You can provide multiple team IDs using the --id option or specify a file with team IDs using --file.
  If no team IDs are provided, the default IDs from the configuration are used.
  The data is saved to output/team-<team-id>-<timestamp>.json.
      `);
      process.exit(0);
    }

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

program.parse(process.argv);
