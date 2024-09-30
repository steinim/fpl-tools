// commands/playerHistory.js

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import config from '../config.js';
import {
  getUnderstatPlayerId,
  getUnderstatPlayerStatsPerGameweek,
  addTeamName,
  getCurrentGameweek
} from './utils.js';

export default async function playerHistoryCommand(playerIds, numPastGWs) {
  try {
    // Validate and parse inputs
    if (!playerIds || playerIds.length === 0) {
      console.error('Error: No player IDs provided.');
      process.exit(1);
    }

    numPastGWs = parseInt(numPastGWs, 10);
    if (isNaN(numPastGWs) || numPastGWs <= 0) {
      console.error('Error: Number of past gameweeks must be a positive integer.');
      process.exit(1);
    }
    if (numPastGWs > 38) {
      console.error('Error: Number of past gameweeks cannot exceed 38.');
      process.exit(1);
    };
    const currentGameweek = await getCurrentGameweek();
    const gameWeeksPlayed = currentGameweek - 1;
    if (numPastGWs > gameWeeksPlayed) {
      console.error(`Error: Number of past gameweeks cannot exceed number of gameweeks played (${gameWeeksPlayed}).`);
      process.exit(1);
    }

    // Ensure the data directory exists
    const dataDir = path.resolve(config.dataDir);
    await fs.mkdir(dataDir, { recursive: true });
    // Output CSV files
    const outputCsv = path.join(dataDir, 'player_history.csv');
    
    // Ensure the output directory exists
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });
    // Output text files
    const noOwnershipFile = path.join(outputDir, 'players_no_ownership.txt');
    const noUnderstatFile = path.join(outputDir, 'players_no_understat.txt');
    await fs.writeFile(noOwnershipFile, '# Players with 0% ovnership\n');
    await fs.writeFile(noUnderstatFile, '# Players without Understat data\n');

    // Check if file exists and handle overwrite logic
    try {
      await fs.access(outputCsv);
      // Prompt the user using inquirer with default 'yes'
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `File ${outputCsv} already exists. Do you want to overwrite it?`,
          default: true, // Default is 'yes'
        },
      ]);

      if (!overwrite) {
        console.log('Skipping data collection.');
        return;
      }
    } catch (err) {
      // File does not exist, proceed
    }

    // Write CSV header
    const csvHeader = [
      'player_id',
      'gameweek',
      'form',
      'average_points',
      'xG',
      'xA',
      'average_minutes',
      'fixture_difficulty',
      'actual_points',
    ];
    await fs.writeFile(outputCsv, csvHeader.join(',') + '\n');

    // Fetch bootstrap data once
    const bootstrapUrl = `${config.apiBaseUrl}/bootstrap-static/`;
    const bootstrapResponse = await axios.get(bootstrapUrl);
    const bootstrapData = bootstrapResponse.data;

    // Create team ID to name mapping
    const teamIdToName = {};
    bootstrapData.teams.forEach((team) => {
      teamIdToName[team.id] = team.name;
    });

    // Map element_type to position name
    const positions = {
      1: 'Goalkeeper',
      2: 'Defender',
      3: 'Midfielder',
      4: 'Forward',
    };

    // Loop through each player
    for (const playerId of playerIds) {
      try {
        // Validate playerId
        if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
          console.error(`Error: Player ID "${playerId}" must be a positive integer.`);
          continue;
        }

        // Fetch player summary data
        const playerSummaryUrl = `${config.apiBaseUrl}/element-summary/${playerId}/`;
        const playerSummaryResponse = await axios.get(playerSummaryUrl);
        const playerSummaryData = playerSummaryResponse.data;

        // Get player details
        const playerDetails = bootstrapData.elements.find(
          (p) => p.id === parseInt(playerId, 10)
        );
        if (!playerDetails) {
          console.error(`Player with ID ${playerId} not found.`);
          continue;
        }

        // Get player full name
        const playerName = `${playerDetails.first_name} ${playerDetails.second_name}`;

        if (playerDetails.selected_by_percent === '0.0') {
          const noOwnershipPlayer = `${playerName}: `;
          await fs.appendFile(noOwnershipFile, noOwnershipPlayer);
          console.log(`Ownership of ${playerName} is 0%. Skipping.`);
          if (playerDetails.news) {
            await fs.appendFile(noOwnershipFile, `: ${playerDetails.news}\n`);
            console.log(`News: ${playerDetails.news}`);
          } else {
            await fs.appendFile(noOwnershipFile, ': No news available. \n');
            console.log(`No news available for ${playerName}.`);
          }
          continue;          
        }

        console.log(`Processing player: ${playerName}`);

        // Get Understat player ID
        const understatPlayerId = await getUnderstatPlayerId(playerDetails);

        let understatStatsPerGW = {};
        if (understatPlayerId) {
          understatStatsPerGW = await getUnderstatPlayerStatsPerGameweek(
            understatPlayerId
          );
        } else {
          await fs.appendFile(noUnderstatFile, `${playerId},${playerName}\n`);
          console.warn(`Understat player ID not found for "${playerName}"`);
        }

        // Loop through past gameweeks
        for (let gw = 1; gw <= numPastGWs; gw++) {
          // Skip if no data for this gameweek
          const gwData = playerSummaryData.history.find((h) => h.round === gw);
          if (!gwData) continue;

          // Features before the gameweek
          const form = parseFloat(playerDetails.form);

          // Calculate average points up to previous gameweeks
          const pastGWs = playerSummaryData.history.filter((h) => h.round < gw);
          const totalPoints = pastGWs.reduce(
            (sum, game) => sum + game.total_points,
            0
          );
          const gamesPlayed = pastGWs.length;
          const averagePoints = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

          // Calculate average minutes up to previous gameweeks
          const totalMinutes = pastGWs.reduce((sum, game) => sum + game.minutes, 0);
          const averageMinutes = gamesPlayed > 0 ? totalMinutes / gamesPlayed : 0;

          // Fixture difficulty for the upcoming gameweek
          const fixture = playerSummaryData.fixtures.find((f) => f.event === gw);
          const fixtureDifficulty = fixture ? fixture.difficulty : 3; // Default difficulty

          // xG and xA for the gameweek
          const understatStats = understatStatsPerGW[gw] || { xG: 0, xA: 0 };
          const xG = understatStats.xG;
          const xA = understatStats.xA;
          console.log(`xG: ${xG}, xA: ${xA} for player: ${playerName} in gameweek: ${gw}`);

          // Actual points in the gameweek
          const actualPoints = gwData.total_points;

          // Write to CSV
          const csvRow = [
            playerId,
            gw,
            form,
            averagePoints.toFixed(2),
            xG.toFixed(2),
            xA.toFixed(2),
            averageMinutes.toFixed(2),
            fixtureDifficulty,
            actualPoints,
          ];
          await fs.appendFile(outputCsv, csvRow.join(',') + '\n');
        }
      } catch (error) {
        console.error(`Error processing player ID ${playerId}:`, error.message);
        continue;
      }
    }

    console.log(
      `Historical data collection completed. Data is saved to ${outputCsv}`
    );
    console.log(
      `Players with 0% ownership is saved to ${noOwnershipFile}`
    );
    console.log(
      `Players without Understat data is saved to ${noUnderstatFile}`
    );
  } catch (error) {
    console.error('Error collecting historical data:', error.message);
  }
}
