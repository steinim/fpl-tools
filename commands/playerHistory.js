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
    }

    const currentGameweek = await getCurrentGameweek();
    const gameWeeksPlayed = currentGameweek;
    if (numPastGWs > gameWeeksPlayed) {
      console.error(`Error: Number of past gameweeks cannot exceed number of gameweeks played (${gameWeeksPlayed}).`);
      process.exit(1);
    }

    // Ensure the data directory exists
    const dataDir = path.resolve(config.dataDir);
    await fs.mkdir(dataDir, { recursive: true });

    const outputCsv = path.join(dataDir, 'player_history.csv');
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const noOwnershipFile = path.join(outputDir, 'players_no_ownership.txt');
    const noUnderstatFile = path.join(outputDir, 'players_no_understat.txt');
    await fs.writeFile(noOwnershipFile, '# Players with 0% ownership\n');
    await fs.writeFile(noUnderstatFile, '# Players without Understat data\n');

    // Handle file overwrite prompt
    try {
      await fs.access(outputCsv);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `File ${outputCsv} already exists. Do you want to overwrite it?`,
          default: true,
        },
      ]);
      if (!overwrite) {
        console.log('Skipping data collection.');
        return;
      }
    } catch (err) {
      // Proceed if file does not exist
    }

    // Write CSV header
    const htmlBasedHeaders = [
      'player_name', 'team_name', 'position', 'cost', 'form', 'probability_of_playing_next_round',
      'PP_GW', 'Val_GW', 'Points_So_Far', 'Official_Chance', 'Official_Availability',
      'Selected_By_Percent', 'Transfers_In_GW', 'Transfers_Out_GW'
    ];

    // Add dynamic Gameweek headers
    for (let i = 1; i <= numPastGWs; i++) {
      htmlBasedHeaders.push(`PP_GW${i}`, `Val_GW${i}`);
    }

    // Additional fields not in HTML but present in your dataset
    const additionalFields = [
      'id', 'code', 'cost_change_event', 'cost_change_start', 'total_points', 'minutes', 'goals_scored',
      'assists', 'clean_sheets', 'goals_conceded', 'penalties_saved', 'penalties_missed', 'yellow_cards',
      'red_cards', 'saves', 'bonus', 'bps', 'influence', 'creativity', 'threat', 'ict_index'
    ];

    const csvHeader = [...htmlBasedHeaders, ...additionalFields];
    await fs.writeFile(outputCsv, csvHeader.join(',') + '\n');

    // Fetch bootstrap data
    const bootstrapUrl = `${config.apiBaseUrl}/bootstrap-static/`;
    const bootstrapResponse = await axios.get(bootstrapUrl);
    const bootstrapData = bootstrapResponse.data;

    const teamIdToName = {};
    bootstrapData.teams.forEach((team) => {
      teamIdToName[team.id] = team.name;
    });

    // Process each player
    for (const playerId of playerIds) {
      try {
        const playerSummaryUrl = `${config.apiBaseUrl}/element-summary/${playerId}/`;
        const playerSummaryResponse = await axios.get(playerSummaryUrl);
        const playerSummaryData = playerSummaryResponse.data;

        const playerDetails = bootstrapData.elements.find((p) => p.id === parseInt(playerId, 10));
        if (!playerDetails) continue;

        const playerName = `${playerDetails.first_name} ${playerDetails.second_name}`;
        const teamName = teamIdToName[playerDetails.team];
        const position = ['GK', 'DEF', 'MID', 'FWD'][playerDetails.element_type - 1];
        const cost = playerDetails.now_cost / 10;
        const form = parseFloat(playerDetails.form);
        const selectedByPercent = playerDetails.selected_by_percent;

        if (playerDetails.selected_by_percent === '0.0') {
          await fs.appendFile(noOwnershipFile, `${playerName}: ${playerDetails.news || 'No news available'}\n`);
          continue;
        }

        console.log(`Processing player: ${playerName}`);

        // Get Understat player ID
        const understatPlayerId = await getUnderstatPlayerId(playerDetails);
        let understatStatsPerGW = {};
        if (understatPlayerId) {
          understatStatsPerGW = await getUnderstatPlayerStatsPerGameweek(understatPlayerId);
        } else {
          await fs.appendFile(noUnderstatFile, `${playerId},${playerName}\n`);
        }

        // Loop through past gameweeks
        for (let gw = 1; gw <= numPastGWs; gw++) {
          const gwData = playerSummaryData.history.find((h) => h.round === gw);
          if (!gwData) continue;

          const PP_GW = gwData.total_points;
          const Val_GW = (PP_GW / cost).toFixed(2);

          const row = [
            playerName, teamName, position, cost, form, playerDetails.chance_of_playing_next_round,
            PP_GW, Val_GW, playerDetails.total_points, playerDetails.chance_of_playing_this_round,
            playerDetails.status, selectedByPercent, playerDetails.transfers_in_event,
            playerDetails.transfers_out_event
          ];

          // Add additional fields
          additionalFields.forEach((field) => {
            row.push(playerDetails[field] || '');
          });

          await fs.appendFile(outputCsv, row.join(',') + '\n');
        }
      } catch (error) {
        console.error(`Error processing player ID ${playerId}:`, error.message);
      }
    }

    console.log(`Data saved to ${outputCsv}`);
    console.log(`Players with 0% ownership saved to ${noOwnershipFile}`);
    console.log(`Players without Understat data saved to ${noUnderstatFile}`);
  } catch (error) {
    console.error('Error collecting player data:', error.message);
  }
}
