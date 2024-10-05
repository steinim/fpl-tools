// commands/playerHistory.js

import axios from 'axios';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import config from '../config.js';
import {
  getUnderstatPlayerId,
  getUnderstatPlayerStatsPerGameweek,
  getCurrentGameweek
} from './utils.js';
import { exit } from 'process';

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

    // Construct the data directory path
    const dataDir = path.resolve(config.dataDir);
    await fs.mkdir(dataDir, { recursive: true });

    let outputCsv = path.join(dataDir, 'player_history.csv');
    
    // Ensure the output directory exists
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });
    // Output text files
    const noOwnershipFile = path.join(outputDir, 'players_no_ownership.txt');
    const noUnderstatFile = path.join(outputDir, 'players_no_understat.txt');
    await fs.writeFile(noOwnershipFile, '# Players with 0% ovnership\n');
    await fs.writeFile(noUnderstatFile, '# Players without Understat data\n');
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
        // Find a unique filename for player_history
        let fileCounter = 1;
        while (existsSync(outputCsv)) {
          outputCsv = path.join(dataDir, `player_history-${fileCounter}.csv`);
          fileCounter++;
        }
        // Ask if the user wants to create and write to a new file
        const { writeToNewFile } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'writeToNewFile',
            message: 'Do you want to create a new file and write to it?',
            default: true, // Default is 'yes'
          },
        ]);
        if (!writeToNewFile) {
          // Ask if the user wants to continue without overwriting
          const { continueWithoutOverwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueWithoutOverwrite',
              message: 'Do you want to run the command without writing to a file?',
              default: true, // Default is 'yes'
            },
          ]);
        if (!writeToNewFile && !continueWithoutOverwrite) {
          console.log('Skipping data collection.');
          return;
        }
      }
    }
    } catch (err) {
      // Proceed
    }

    // Fetch bootstrap data once
    const bootstrapUrl = `${config.apiBaseUrl}/bootstrap-static/`;
    const bootstrapResponse = await axios.get(bootstrapUrl);
    const bootstrapData = bootstrapResponse.data;

    // Create CSV header dynamically from the first object in bootstrapData
    const firstPlayer = bootstrapData.elements[0];
    const csvHeader = Object.keys(firstPlayer).map((key) => {
      // Normalize the key name for the CSV header
      return key.replace(/_/g, ' '); // Replace underscores with spaces
    });

    // Fetch Understat data for one player to get the available headers
    let understatHeaders = [];
    const samplePlayerId = playerIds[0]; // You can choose any player for this
    const understatPlayerId = await getUnderstatPlayerId(
      bootstrapData.elements.find((p) => p.id === parseInt(samplePlayerId, 10))
    );
    if (understatPlayerId) {
      const understatStats = await getUnderstatPlayerStatsPerGameweek(
        understatPlayerId
      );
      if (understatStats && Object.keys(understatStats).length > 0) {
        const firstGameweekData = understatStats[Object.keys(understatStats)[0]];
        understatHeaders = Object.keys(firstGameweekData).map(
          (key) => `understat_${key}` // Add a prefix to Understat headers
        );
      }
    }

    // Combine all headers
    csvHeader.push(...understatHeaders); // Add Understat headers
    csvHeader.push(...Object.keys(firstPlayer).map(key => key.replace(/_/g, ' '))); // Add bootstrap data headers
    console.log(csvHeader);

    // Write CSV header to file
    await fs.writeFile(outputCsv, csvHeader.join(',') + '\n');

    // Map element_type to position name
    const positions = {
      1: 'GK',
      2: 'DEF',
      3: 'MID',
      4: 'FWD',
    };

    const teamIdToName = {};
    bootstrapData.teams.forEach((team) => {
      teamIdToName[team.id] = team.name;
    });

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
        const playerName = `${playerDetails.first_name} ${playerDetails.second_name}` || '"unknown player name"';

        if (playerDetails.selected_by_percent === '0.0') {
          const noOwnershipPlayer = `${playerName}: `;
          await fs.appendFile(noOwnershipFile, noOwnershipPlayer);
          console.log(`Ownership of ${playerName} is 0%. Skipping.`);
          if (playerDetails.news) {
            await fs.appendFile(noOwnershipFile, `: ${playerDetails.news}\n`);
            console.log(`News: ${playerDetails.news}`);
          } else {
            await fs.appendFile(noOwnershipFile, ': No news available. \n');
            console.log(`No news available for player with ID ${playerId} (${playerName}).`);
          }
          continue;          
        }

        console.log(`Processing player with ID ${playerId} (${playerName}).`);

        // Get Understat player ID
        const understatPlayerId = await getUnderstatPlayerId(playerDetails);

        let understatStatsPerGW = {};
        if (understatPlayerId) {
          understatStatsPerGW = await getUnderstatPlayerStatsPerGameweek(
            understatPlayerId
          );
        } else {
          await fs.appendFile(noUnderstatFile, `${playerId},${playerName}\n`);
          console.warn(`Understat player ID not found for player with ID ${playerId} (${playerName}).`);
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
          //console.log(`xG: ${xG.toFixed(2)}, xA: ${xA.toFixed(2)} for player ID ${playerId} (${playerName}) in gameweek: ${gw}`);

          // Actual points in the gameweek
          const actualPoints = gwData.total_points;

// Write to CSV
const csvRow = [];
csvHeader.forEach((header) => {
  // Access data based on the header
  switch (header) {
    case 'player_id':
      csvRow.push(playerId);
      break;
    case 'player_name':
      csvRow.push(playerName);
      break;
    case 'gameweek':
      csvRow.push(gw);
      break;
    case 'form':
      csvRow.push(form.toFixed(2)); // Assuming form is a number
      break;
    case 'average_points':
      csvRow.push(averagePoints.toFixed(2));
      break;
    case 'xG':
    case 'xA':
    case 'average_minutes':
    case 'fixture_difficulty':
    case 'actual_points':
      csvRow.push(eval(header).toFixed(2)); // Access variables directly
      break;
    case 'team_name':
      csvRow.push(teamIdToName[playerDetails.team]);
      break;
    default:
      // For Understat headers
      if (header.startsWith('understat_')) {
        const understatKey = header.replace('understat_', '');
        csvRow.push(
          (understatStatsPerGW[gw]?.[understatKey] || 0).toFixed(2)
        );
      } else {
        // For Bootstrap data headers
        const bootstrapKey = header.replace(' ', '_');
        csvRow.push(playerDetails[bootstrapKey] || ''); 
      }
  }
});

await fs.appendFile(outputCsv, csvRow.join(',') + '\n');
        }
      } catch (error) {
        console.error(`Error processing player ID ${playerId} (${playerName}):`, error.message);
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
