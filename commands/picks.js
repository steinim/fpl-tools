// commands/picks.js

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import config from '../config.js';
import { addTeamName, getCurrentGameweek } from './utils.js';

export default async function picksCommand(teamId, gameweek) {
  try {
    // Validate teamId
    if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
      throw new Error('Team ID must be a positive integer.');
    }

    if (!gameweek) {
      // Fetch current gameweek
      gameweek = await getCurrentGameweek();
      console.log(`Using current gameweek: ${gameweek}`);
    } else {
      const MAX_GAMEWEEK = 38; // Adjust based on the current season
      gameweek = parseInt(gameweek, 10);
      if (isNaN(gameweek) || gameweek <= 0 || gameweek > MAX_GAMEWEEK) {
        throw new Error(
          `Gameweek must be a number between 1 and ${MAX_GAMEWEEK}.`
        );
      }
    }

    const picksUrl = `${config.apiBaseUrl}/entry/${teamId}/event/${gameweek}/picks/`;
    const bootstrapUrl = `${config.apiBaseUrl}/bootstrap-static/`;

    // Fetch data
    const [picksResponse, bootstrapResponse] = await Promise.all([
      axios.get(picksUrl),
      axios.get(bootstrapUrl),
    ]);
    const picksData = picksResponse.data;
    const players = bootstrapResponse.data.elements;

    // Create team ID to name mapping
    const teamIdToName = {};
    bootstrapResponse.data.teams.forEach((team) => {
      teamIdToName[team.id] = team.name;
    });

    // Add player_name and team_name to each pick
    picksData.picks = picksData.picks.map((pick) => {
      const player = players.find((p) => p.id === pick.element);
      if (player) {
        pick.player_name = `${player.first_name} ${player.second_name}`;
        pick.team = player.team; // Add team ID to pick
        pick = addTeamName(pick, 'team', 'team_name', teamIdToName);
      }
      return pick;
    });

    // Ensure the output directory exists
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    // Save data to output/picks-<teamId>-GW<gameweek>-<date>.json
    const date = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const outputFile = path.join(
      outputDir,
      `picks-${teamId}-GW${gameweek}-${date}.json`
    );

    // Check if file exists and handle overwrite logic
    try {
      await fs.access(outputFile);
      // Prompt the user using inquirer with default 'yes'
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `File ${outputFile} already exists. Do you want to overwrite it?`,
          default: true, // Default is 'yes'
        },
      ]);

      if (!overwrite) {
        console.log(`Skipping ${outputFile}`);
        return;
      }
    } catch (err) {
      // File does not exist, proceed
    }

    // Write data to the file
    await fs.writeFile(outputFile, JSON.stringify(picksData, null, 2));
    console.log(`Data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving picks data:', error.message);
  }
}
