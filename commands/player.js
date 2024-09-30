// commands/player.js

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import config from '../config.js';
import {
  addTeamName,
  getUnderstatPlayerId,
  getUnderstatPlayerStatsPerGameweek,
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function main(playerId) {
  console.log(`Starting data retrieval for player ID ${playerId}...`);

  // Validate playerId
  if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
    throw new Error('Player ID must be a positive integer.');
  }

  const playerSummaryUrl = `${config.apiBaseUrl}/element-summary/${playerId}/`;
  const bootstrapUrl = `${config.apiBaseUrl}/bootstrap-static/`;

  try {
    // Fetch data
    const [playerSummaryResponse, bootstrapResponse] = await Promise.all([
      axios.get(playerSummaryUrl),
      axios.get(bootstrapUrl),
    ]);

    const playerSummaryData = playerSummaryResponse.data;
    const bootstrapData = bootstrapResponse.data;

    // Get player details
    const playerDetails = bootstrapData.elements.find(
      (p) => p.id === parseInt(playerId)
    );
    if (!playerDetails) {
      console.error(`Player with ID ${playerId} not found.`);
      return;
    }
    console.log(`Found player with ID ${playerId}.`);

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

    // Add additional player info
    const playerName = `${playerDetails.first_name} ${playerDetails.second_name}`;
    const playerInfo = {
      id: playerDetails.id,
      first_name: playerDetails.first_name,
      second_name: playerDetails.second_name,
      web_name: playerDetails.web_name,
      full_name: playerName,
      team: playerDetails.team,
      team_name: teamIdToName[playerDetails.team],
      element_type: playerDetails.element_type,
      position: positions[playerDetails.element_type],
      form: parseFloat(playerDetails.form),
      selected_by_percent: parseFloat(playerDetails.selected_by_percent),
      transfers_in_event: playerDetails.transfers_in_event,
      transfers_out_event: playerDetails.transfers_out_event,
      now_cost: playerDetails.now_cost / 10, // Convert to millions
      status: playerDetails.status,
    };

    console.log(`Added additional player info for ${playerName}.`);

    // Calculate recent form and minutes
    const N = 5; // Number of recent games to consider
    const recentHistory = playerSummaryData.history.slice(-N);

    const averagePoints =
      recentHistory.reduce((sum, game) => sum + game.total_points, 0) / N || 0;
    const averageMinutes =
      recentHistory.reduce((sum, game) => sum + game.minutes, 0) / N || 0;

    playerInfo.average_points = parseFloat(averagePoints.toFixed(2));
    playerInfo.average_minutes = parseFloat(averageMinutes.toFixed(2));

    console.log(`Calculated recent form and minutes for ${playerName}.`);

    // Check player availability
    const unavailableStatuses = ['i', 's', 'u']; // Injured, suspended, unavailable
    playerInfo.is_available = !unavailableStatuses.includes(playerDetails.status);

    console.log(`Checked player availability for ${playerName}.`);

    // Add opponent_team_id and opponent_team_name to fixtures
    const fixturesWithTeamNames = playerSummaryData.fixtures.map((fixture) => {
      // Determine opponent team based on is_home
      const opponentTeamId = fixture.is_home ? fixture.team_a : fixture.team_h;
      console.log(`Found opponent team ID for ${playerName}: ${opponentTeamId}`);
      // Add opponent_team field to fixture
      fixture.opponent_team = opponentTeamId;
      // Add opponent_team_name using addTeamName
      const fixtureWithTeamName = addTeamName(
        fixture,
        'opponent_team',
        'opponent_team_name',
        teamIdToName
      );
      console.log(
        `Adding opponent team information to the game where ${playerInfo.full_name} plays against ${fixtureWithTeamName.opponent_team_name} in ${fixture.event_name}.`
      );
      return fixtureWithTeamName;
    });

    console.log(`Added opponent team information to fixtures for ${playerName}.`);

    // Aggregate upcoming fixture difficulty
    const M = 3; // Number of upcoming fixtures to consider
    const upcomingFixtures = fixturesWithTeamNames.slice(0, M);

    const totalDifficulty = upcomingFixtures.reduce(
      (sum, fixture) => sum + fixture.difficulty,
      0
    );
    const averageDifficulty = totalDifficulty / M || 0;

    playerInfo.upcoming_fixtures = upcomingFixtures;
    playerInfo.total_fixture_difficulty = totalDifficulty;
    playerInfo.average_fixture_difficulty = parseFloat(
      averageDifficulty.toFixed(2)
    );

    console.log(`Calculated upcoming fixture difficulty for ${playerName}.`);

    // Fetch Understat player ID
    const understatPlayerId = await getUnderstatPlayerId(playerDetails);

    if (understatPlayerId) {
      // Fetch Understat stats per gameweek
      const understatStatsPerGW = await getUnderstatPlayerStatsPerGameweek(
        understatPlayerId
      );

      if (understatStatsPerGW) {
        // Sum up xG and xA
        const totalxG = Object.values(understatStatsPerGW).reduce(
          (sum, gw) => sum + gw.xG,
          0
        );
        const totalxA = Object.values(understatStatsPerGW).reduce(
          (sum, gw) => sum + gw.xA,
          0
        );

        playerInfo.xG = parseFloat(totalxG.toFixed(2));
        playerInfo.xA = parseFloat(totalxA.toFixed(2));

        console.log(`Fetched Understat xG and xA for ${playerName}.`);
      } else {
        playerInfo.xG = 0;
        playerInfo.xA = 0;
        console.log(`Failed to fetch Understat xG and xA for ${playerName}.`);
      }
    } else {
      playerInfo.xG = 0;
      playerInfo.xA = 0;
      console.log(`Couldn't find Understat player ID for ${playerName}.`);
    }

    // Function to get predicted points using the Flask API
    async function getPredictedPoints(playerInfo) {
      try {
        const response = await axios.post(
          'http://127.0.0.1:5000/predict',
          {
            features: {
              form: playerInfo.form,
              average_points: playerInfo.average_points,
              xG: playerInfo.xG || 0,
              xA: playerInfo.xA || 0,
              average_minutes: playerInfo.average_minutes,
              fixture_difficulty: playerInfo.average_fixture_difficulty,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(
          `Predicted points for ${playerInfo.full_name}: ${response.data.predicted_points}`
        );
        return response.data.predicted_points;
      } catch (error) {
        console.error('Error getting predicted points:', error.message);
        return null;
      }
    }

    // Get predicted points from the Flask API
    playerInfo.expected_points = await getPredictedPoints(playerInfo);

    console.log(`Fetched details for player: ${playerInfo.full_name}`);

    // Combine data
    const combinedData = {
      player: playerInfo,
      history: playerSummaryData.history, // Past performance
      fixtures: fixturesWithTeamNames, // Upcoming fixtures with opponent team names
    };

    console.log(
      `Combined player info, history, and fixtures for player: ${playerInfo.full_name}`
    );

    // Ensure the output directory exists
    const outputDir = path.resolve(__dirname, '..', config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Save data to output/player-<playerId>-<date>.json
    const date = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const outputFile = path.join(outputDir, `player-${playerId}-${date}.json`);

    // Check if file exists and handle overwrite logic
    if (fs.existsSync(outputFile)) {
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
    }

    // Write data to the file
    fs.writeFileSync(outputFile, JSON.stringify(combinedData, null, 2));
    console.log(`Data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving player data:', error);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The script is being run directly
  const playerId = process.argv[2]; // Get player ID from command-line arguments
  if (!playerId) {
    console.error('Please provide a player ID as a command-line argument.');
    process.exit(1);
  }
  (async () => {
    await main(playerId);
  })();
}
