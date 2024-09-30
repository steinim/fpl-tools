// commands/utils.js

import axios from 'axios';
import * as cheerio from 'cheerio';
import { remove as removeDiacritics } from 'diacritics';
import stringSimilarity from 'string-similarity';
import config from '../config.js';

// Manual mapping of FPL player IDs to Understat player IDs
const manualUnderstatMapping = {
  // FPL player ID: Understat player ID

  // Joško Gvardiol
  661: 11958,

  // Gabriel Magalhães
  201: 9164,

  // Mohamed Salah
  250: 1250,

  // Diogo Jota
  309: 644,

  // Anthony Gordon
  350: 9401,

  // Ollie Watkins
  398: 2208,

  // Erling Haaland
  602: 10155,

  // João Pedro
  461: 11107,

  // Add more mappings as needed
};

export async function getUnderstatPlayerId(playerDetails) {
  try {
    const fplPlayerId = playerDetails.id;

    // Check manual mapping first
    if (manualUnderstatMapping[fplPlayerId]) {
      return manualUnderstatMapping[fplPlayerId];
    }

    // If manual mapping not found, proceed with name matching

    // Fetch the Understat players page
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

    // Prepare possible name variations
    const nameVariations = getPlayerNameVariations(playerDetails);

    // Normalize Understat player names and create a mapping
    const understatPlayersMap = {};
    playersData.forEach((player) => {
      const normalizedName = normalizeName(player.player_name);
      understatPlayersMap[normalizedName] = player;
    });

    // Attempt exact matches
    for (const name of nameVariations) {
      const normalizedInputName = normalizeName(name);
      if (understatPlayersMap[normalizedInputName]) {
        return understatPlayersMap[normalizedInputName].id;
      }
    }

    // If no exact match, attempt fuzzy matching
    const allUnderstatNames = Object.keys(understatPlayersMap);
    const normalizedInputNames = nameVariations.map((name) => normalizeName(name));

    let bestMatch = { target: '', rating: 0 };
    for (const inputName of normalizedInputNames) {
      const match = stringSimilarity.findBestMatch(inputName, allUnderstatNames).bestMatch;
      if (match.rating > bestMatch.rating) {
        bestMatch = match;
      }
    }

    if (bestMatch.rating > 0.6) { // Adjust threshold as needed
      return understatPlayersMap[bestMatch.target].id;
    } else {
      console.warn(`No Understat data found for player "${playerDetails.web_name}".`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching Understat player ID for "${playerDetails.web_name}":`, error.message);
    return null;
  }
}

export async function getUnderstatPlayerStatsPerGameweek(playerId) {
  try {
    const url = `https://understat.com/player/${playerId}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract matchesData JSON
    const scripts = $('script:not([src])');
    let matchesDataScript = null;
    scripts.each((i, script) => {
      const html = $(script).html();
      if (html.includes('matchesData')) {
        matchesDataScript = html;
      }
    });

    if (!matchesDataScript) {
      throw new Error('matchesData script not found');
    }

    // Extract JSON data
    const matchesData = extractJsonFromScript(matchesDataScript, 'matchesData');

    // Map data to gameweeks
    const statsPerGameweek = {};

    for (const match of matchesData) {
      const matchDate = new Date(match.datetime);
      const gw = await getGameweekFromDate(matchDate);
      if (!gw) continue;

      if (!statsPerGameweek[gw]) {
        statsPerGameweek[gw] = { xG: 0, xA: 0 };
      }

      statsPerGameweek[gw].xG += parseFloat(match.xG);
      statsPerGameweek[gw].xA += parseFloat(match.xA);
    }

    return statsPerGameweek;
  } catch (error) {
    console.error(`Error fetching Understat stats for player ID "${playerId}":`, error.message);
    return null;
  }
}

function getPlayerNameVariations(playerDetails) {
  const names = [];

  // Full name
  names.push(`${playerDetails.first_name} ${playerDetails.second_name}`);

  // Web name (often the name displayed in FPL)
  if (playerDetails.web_name) {
    names.push(playerDetails.web_name);
  }

  // Second name (surname)
  if (playerDetails.second_name) {
    names.push(playerDetails.second_name);
  }

  // Any known nicknames or common names (you can expand this list)
  const nicknameMapping = {
    'Gabriel': ['Gabriel Magalhaes'],
    'Jota': ['Diogo Jota'],
    'João Pedro': ['Joao Pedro'],
    'Henderson': ['Dean Henderson'],
    'Gvardiol': ['Josko Gvardiol'],
    'Salah': ['Mohamed Salah'],
    'Haaland': ['Erling Haaland'],
    'Watkins': ['Ollie Watkins'],
    'Gordon': ['Anthony Gordon'],
    // Add more mappings as needed
  };

  if (nicknameMapping[playerDetails.web_name]) {
    names.push(...nicknameMapping[playerDetails.web_name]);
  }

  return names;
}

function normalizeName(name) {
  // Remove diacritics and convert to lowercase
  return removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove non-letter characters
    .trim();
}

export function extractJsonFromScript(scriptContent, variableName) {
  try {
    const regex = new RegExp(`var\\s+${variableName}\\s+=\\s+JSON\\.parse\\('([^']+)'\\);`);
    const match = scriptContent.match(regex);
    if (!match) {
      throw new Error(`Unable to find variable ${variableName} in script content.`);
    }

    const encodedJsonString = match[1];

    // Decode escaped characters
    const decodedJsonString = encodedJsonString.replace(/\\x([0-9A-Fa-f]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });

    const jsonData = JSON.parse(decodedJsonString);
    return jsonData;
  } catch (error) {
    throw new Error(`Failed to parse JSON from Understat ${variableName}: ${error.message}`);
  }
}

export function addTeamName(obj, teamIdField, teamNameField, teamIdToName) {
  const teamId = obj[teamIdField];
  const teamName = teamIdToName[teamId] || `Team ${teamId}`;
  return { ...obj, [teamNameField]: teamName };
}

let gameweekDateMapping = null;

export async function getGameweekFromDate(date) {
  if (!gameweekDateMapping) {
    gameweekDateMapping = await buildGameweekDateMapping();
    if (!gameweekDateMapping) return null;
  }

  // Ensure the date is a Date object
  const targetDate = new Date(date);

  // Iterate over gameweeks to find where the date falls
  for (const [gameweek, dates] of Object.entries(gameweekDateMapping)) {
    if (targetDate >= dates.start && targetDate <= dates.end) {
      return parseInt(gameweek, 10);
    }
  }

  // If date is before all gameweeks
  const earliestGameweek = Math.min(...Object.keys(gameweekDateMapping).map(Number));
  if (targetDate < gameweekDateMapping[earliestGameweek].start) {
    return earliestGameweek;
  }

  // If date is after all gameweeks
  const latestGameweek = Math.max(...Object.keys(gameweekDateMapping).map(Number));
  if (targetDate > gameweekDateMapping[latestGameweek].end) {
    return latestGameweek;
  }

  // Date doesn't fall within any gameweek range
  return null;
}

export async function buildGameweekDateMapping() {
  // Fetch fixtures data
  const fixtures = await getFixturesData();
  if (!fixtures) return null;

  const gameweekDates = {};

  fixtures.forEach((fixture) => {
    const gameweek = fixture.event; // Gameweek number
    if (!gameweek) return; // Skip if event is null

    const kickoffTime = new Date(fixture.kickoff_time); // Fixture date

    if (!gameweekDates[gameweek]) {
      gameweekDates[gameweek] = {
        start: kickoffTime,
        end: kickoffTime,
      };
    } else {
      if (kickoffTime < gameweekDates[gameweek].start) {
        gameweekDates[gameweek].start = kickoffTime;
      }
      if (kickoffTime > gameweekDates[gameweek].end) {
        gameweekDates[gameweek].end = kickoffTime;
      }
    }
  });

  return gameweekDates;
}

let cachedFixtures = null;

export async function getFixturesData() {
  if (cachedFixtures) return cachedFixtures;

  try {
    const fixturesUrl = `${config.apiBaseUrl}/fixtures/`;
    const response = await axios.get(fixturesUrl);
    cachedFixtures = response.data;
    return cachedFixtures;
  } catch (error) {
    console.error('Error fetching fixtures data:', error.message);
    return null;
  }
}
