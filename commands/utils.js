// commands/utils.js

import axios from 'axios';
import * as cheerio from 'cheerio';
import { remove as removeDiacritics } from 'diacritics';
import stringSimilarity from 'string-similarity';
import config, { manualFplUnderstatMapping } from '../config.js';

export async function getUnderstatPlayerId(playerDetails) {
  try {
    const fplPlayerId = playerDetails.id;

    // Check manual mapping first
    if (manualFplUnderstatMapping[fplPlayerId]) {
      return manualFplUnderstatMapping[fplPlayerId];
    }

    // If manual mapping not found, proceed with name matching

    // Fetch the Understat players page
    const url = 'https://understat.com/league/EPL/';
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
      const match = stringSimilarity.findBestMatch(inputName, allUnderstatNames)
        .bestMatch;
      if (match.rating > bestMatch.rating) {
        bestMatch = match;
      }
    }

    if (bestMatch.rating > 0.6) {
      // Adjust threshold as needed
      return understatPlayersMap[bestMatch.target].id;
    } else {
      console.warn(`No Understat data found for player "${playerDetails.web_name}" playing for team "${playerDetails.team_code}".`);
      return null;
    }
  } catch (error) {
    console.error(
      `Error fetching Understat player ID for "${playerDetails.web_name} playing for team "${playerDetails.team_code}":`,
      error.message
    );
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
    if (!matchesData) return null;

    // Map data to gameweeks
    const statsPerGameweek = {};

    for (const match of matchesData) {
      if (match.season !== config.season)  continue;
      const matchDate = new Date(match.date);
      const gw = await getGameweekFromDate(matchDate);
      if (!gw) continue;

      if (!statsPerGameweek[gw]) {
        //console.log(`No stats found for gameweek ${gw} for player ID ${playerId}`);
        statsPerGameweek[gw] = { xG: 0, xA: 0 };
      }

      statsPerGameweek[gw].xG += parseFloat(match.xG);
      statsPerGameweek[gw].xA += parseFloat(match.xA);
      //console.log(`Stats for player ID ${playerId} in gameweek ${gw}:  `, statsPerGameweek[gw]);
    }

    return statsPerGameweek;
  } catch (error) {
    console.error(
      `Error fetching Understat stats for player ID "${playerId}":`,
      error.message
    );
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
    Gabriel: ['Gabriel Magalhaes'],
    Jota: ['Diogo Jota'],
    'João Pedro': ['Joao Pedro'],
    Henderson: ['Dean Henderson'],
    Gvardiol: ['Josko Gvardiol'],
    Salah: ['Mohamed Salah'],
    Haaland: ['Erling Haaland'],
    Watkins: ['Ollie Watkins'],
    Gordon: ['Anthony Gordon'],
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
    const regex = new RegExp(
      `var\\s+${variableName}\\s+=\\s+JSON\\.parse\\('([^']+)'\\);`
    );
    const match = scriptContent.match(regex);
    if (!match) {
      throw new Error(`Unable to find variable ${variableName} in script content.`);
    }

    const encodedJsonString = match[1];

    // Decode escaped characters
    const decodedJsonString = encodedJsonString.replace(
      /\\x([0-9A-Fa-f]{2})/g,
      (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }
    );

    const jsonData = JSON.parse(decodedJsonString);
    return jsonData;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from Understat ${variableName}: ${error.message}`
    );
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
    //console.log(gameweekDateMapping);
  }
  const gw1Date = new Date(gameweekDateMapping[1].start);

  // Ensure the date is a Date object and set time part to 0
  const targetDate = new Date(date).setHours(0,0,0,0);

  // Iterate over gameweeks to find where the date falls
  for (const [gameweek, dates] of Object.entries(gameweekDateMapping)) {

    const startDate = new Date(dates.start).setHours(0,0,0,0);
    const endDate = new Date(dates.end).setHours(0,0,0,0);

    if (targetDate >= startDate && targetDate <= endDate) {
      return parseInt(gameweek, 10);
    }
  }

  // If date is before all gameweeks
  const earliestGameweek = Math.min(
    ...Object.keys(gameweekDateMapping).map(Number)
  );
  if (targetDate < gameweekDateMapping[earliestGameweek].start) {
    return earliestGameweek;
  }

  // If date is after all gameweeks
  const latestGameweek = Math.max(
    ...Object.keys(gameweekDateMapping).map(Number)
  );
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
  // console.log(gameweekDates);
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

// Moved from picks.js
export async function getCurrentGameweek() {
  const url = `${config.apiBaseUrl}/bootstrap-static/`;
  try {
    const response = await axios.get(url);
    const data = response.data;
    const currentEvent = data.events.find((event) => event.is_current);
    if (currentEvent) {
      return currentEvent.id;
    } else {
      throw new Error('Could not determine current gameweek.');
    }
  } catch (error) {
    throw new Error('Failed to fetch current gameweek: ' + error.message);
  }
}
