// commands/player.js

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import * as cheerio from 'cheerio';
import { remove as removeDiacritics } from 'diacritics';
import config from '../config.js';
import { addTeamName, extractJsonFromScript } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (playerId) {
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
    const playerDetails = bootstrapData.elements.find((p) => p.id === parseInt(playerId));
    if (!playerDetails) {
      console.error(`Player with ID ${playerId} not found.`);
      return;
    }

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

    // Calculate recent form and minutes
    const N = 5; // Number of recent games to consider
    const recentHistory = playerSummaryData.history.slice(-N);

    const averagePoints =
      recentHistory.reduce((sum, game) => sum + game.total_points, 0) / N || 0;
    const averageMinutes =
      recentHistory.reduce((sum, game) => sum + game.minutes, 0) / N || 0;

    playerInfo.average_points = parseFloat(averagePoints.toFixed(2));
    playerInfo.average_minutes = parseFloat(averageMinutes.toFixed(2));

    // Check player availability
    const unavailableStatuses = ['i', 's', 'u']; // Injured, suspended, unavailable
    playerInfo.is_available = !unavailableStatuses.includes(playerDetails.status);

    // Add opponent_team_id and opponent_team_name to fixtures
    const fixturesWithTeamNames = playerSummaryData.fixtures.map((fixture) => {
      // Determine opponent team based on is_home
      const opponentTeamId = fixture.is_home ? fixture.team_a : fixture.team_h;
      // Add opponent_team field to fixture
      fixture.opponent_team = opponentTeamId;
      // Add opponent_team_name using addTeamName
      return addTeamName(fixture, 'opponent_team', 'opponent_team_name', teamIdToName);
    });

    // Aggregate upcoming fixture difficulty
    const M = 3; // Number of upcoming fixtures to consider
    const upcomingFixtures = fixturesWithTeamNames.slice(0, M);

    const totalDifficulty = upcomingFixtures.reduce((sum, fixture) => sum + fixture.difficulty, 0);
    const averageDifficulty = totalDifficulty / M || 0;

    playerInfo.upcoming_fixtures = upcomingFixtures;
    playerInfo.total_fixture_difficulty = totalDifficulty;
    playerInfo.average_fixture_difficulty = parseFloat(averageDifficulty.toFixed(2));

    // Fetch Understat player ID
    const understatPlayerId = await getUnderstatPlayerId(playerName);

    if (understatPlayerId) {
      // Fetch Understat stats
      const understatStats = await getUnderstatPlayerStats(understatPlayerId);

      if (understatStats) {
        playerInfo.xG = understatStats.xG;
        playerInfo.xA = understatStats.xA;
      } else {
        playerInfo.xG = null;
        playerInfo.xA = null;
      }
    } else {
      playerInfo.xG = null;
      playerInfo.xA = null;
    }

    // Simple predictive model
    function predictExpectedPoints(playerInfo) {
      // Define weights for each metric
      const weights = {
        form: 0.3,
        average_points: 0.2,
        average_minutes: 0.1,
        average_fixture_difficulty: -0.1, // Negative weight since higher difficulty reduces expected points
        xG: 0.2,
        xA: 0.1,
      };

      // Handle null values for xG and xA
      const xG = playerInfo.xG || 0;
      const xA = playerInfo.xA || 0;

      // Compute weighted sum
      const expectedPoints =
        weights.form * playerInfo.form +
        weights.average_points * playerInfo.average_points +
        weights.average_minutes * (playerInfo.average_minutes / 90) + // Normalize minutes
        weights.average_fixture_difficulty * playerInfo.average_fixture_difficulty +
        weights.xG * xG +
        weights.xA * xA;

      return parseFloat(expectedPoints.toFixed(2));
    }

    // Add expected points to playerInfo
    playerInfo.expected_points = predictExpectedPoints(playerInfo);

    // Combine data
    const combinedData = {
      player: playerInfo,
      history: playerSummaryData.history, // Past performance
      fixtures: fixturesWithTeamNames, // Upcoming fixtures with opponent team names
    };

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
    console.error('Error retrieving player data:', error.message);
  }
}

// Helper functions

function normalizeName(name) {
  // Remove diacritics and convert to lowercase
  return removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
}

async function getUnderstatPlayerId(playerName) {
  try {
    const url = 'https://understat.com/league/EPL';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract JavaScript data from the page
    const scripts = $('script:not([src])');
    let playersDataScript = null;

    scripts.each((i, script) => {
      const html = $(script).html();
      if (html.includes('playersData')) {
        playersDataScript = html;
      }
    });

    if (!playersDataScript) {
      throw new Error('playersData not found in the page.');
    }

    // Extract JSON from the script content
    const playersData = extractJsonFromScript(playersDataScript, 'playersData');
    if (!playersData) return null;

    // Normalize the player name
    const normalizedInputName = normalizeName(playerName);

    // Find the matching player
    const understatPlayer = playersData.find((player) => {
      const normalizedUnderstatName = normalizeName(player.player_name);
      return normalizedUnderstatName === normalizedInputName;
    });

    if (!understatPlayer) {
      console.warn(`No Understat data found for
 player "${playerName}".`);
      return null;
    }

    return understatPlayer.id;
  } catch (error) {
    console.error(`Error fetching Understat player ID for "${playerName}":`, error.message);
    return null;
  }
}

async function getUnderstatPlayerStats(playerId) {
  try {
    const url = `https://understat.com/player/${playerId}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract JavaScript data from the page
    const scripts = $('script:not([src])');
    let playerDataScript;
    scripts.each((i, script) => {
      const html = $(script).html();
      if (html.includes('matchesData')) {
        playerDataScript = html;
      }
    });

    if (!playerDataScript) {
      throw new Error('matchesData script not found');
    }

    // Extract playerData JSON using the utility function
    const playerData = extractJsonFromScript(playerDataScript, 'matchesData');

    // Sum xG and xA over all matches
    let totalxG = 0;
    let totalxA = 0;
    playerData.forEach((match) => {
      totalxG += parseFloat(match.xG);
      totalxA += parseFloat(match.xA);
    });

    return {
      xG: parseFloat(totalxG.toFixed(2)),
      xA: parseFloat(totalxA.toFixed(2)),
    };
  } catch (error) {
    console.error(`Error fetching Understat stats for player ID "${playerId}":`, error.message);
    return null;
  }
}

