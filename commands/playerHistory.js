// commands/playerHistory.js

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import {
  getUnderstatPlayerId,
  getUnderstatPlayerStatsPerGameweek,
} from './utils.js';

// List of player IDs to collect data for
const playerIds = [201, 461, 350, 3, 328, 309, 317, 398, 58, 351, 129, 91, 442, 333, 116];


// Number of past gameweeks to collect data for
const NUM_PAST_GWS = 10;

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output CSV file
const outputCsv = path.resolve(__dirname, '..', 'data', 'player_history.csv');

(async () => {
  try {
    // Ensure the data directory exists
    const dataDir = path.resolve(__dirname, '..', 'data');
    try {
      await fs.access(dataDir);
    } catch (err) {
      await fs.mkdir(dataDir);
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
      // Fetch player summary data
      const playerSummaryUrl = `${config.apiBaseUrl}/element-summary/${playerId}/`;
      const playerSummaryResponse = await axios.get(playerSummaryUrl);
      const playerSummaryData = playerSummaryResponse.data;

      // Get player details
      const playerDetails = bootstrapData.elements.find(
        (p) => p.id === parseInt(playerId)
      );
      if (!playerDetails) {
        console.error(`Player with ID ${playerId} not found.`);
        continue;
      }

      // Get player full name
      const playerName = `${playerDetails.first_name} ${playerDetails.second_name}`;

      // Get Understat player ID
      //const understatPlayerId = await getUnderstatPlayerId(playerName);

      const understatPlayerId = await getUnderstatPlayerId(playerDetails);

      let understatStatsPerGW = {};
      if (understatPlayerId) {
        understatStatsPerGW = await getUnderstatPlayerStatsPerGameweek(understatPlayerId);
      } else {
        console.warn(`Understat player ID not found for "${playerName}"`);
      }

      // Loop through past gameweeks
      for (let gw = 1; gw <= NUM_PAST_GWS; gw++) {
        // Skip if no data for this gameweek
        const gwData = playerSummaryData.history.find((h) => h.round === gw);
        if (!gwData) continue;

        // Features before the gameweek
        //const form = parseFloat(gwData.form);
        // Features before the gameweek
        const form = parseFloat(playerDetails.form);


        // Calculate average points up to previous gameweeks
        const pastGWs = playerSummaryData.history.filter((h) => h.round < gw);
        const totalPoints = pastGWs.reduce((sum, game) => sum + game.total_points, 0);
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
    }

    console.log(`Historical data collection completed. Data is saved to ${outputCsv}`);
  } catch (error) {
    console.error('Error collecting historical data:', error.message);
  }
})();
