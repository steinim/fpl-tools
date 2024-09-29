import { promises as fs } from 'fs';
import axios from 'axios';

// Helper function to decode hex-encoded characters (e.g., \x22 becomes ")
function decodeHexString(encodedStr) {
  return encodedStr.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

// Function to clean and extract valid JSON from the JavaScript block
function extractShotsData(scriptContent) {
  try {
    const jsonStart = scriptContent.indexOf('JSON.parse(\'') + 12;  // Find the JSON start
    const jsonEnd = scriptContent.indexOf('\')', jsonStart);        // Find the JSON end
    const encodedJsonString = scriptContent.slice(jsonStart, jsonEnd);

    // Decode hex-encoded characters
    const decodedJsonString = decodeHexString(encodedJsonString);

    // Parse the decoded JSON string
    return JSON.parse(decodedJsonString);
  } catch (error) {
    throw new Error('Failed to parse JSON from Understat shotsData');
  }
}

// Fetch Understat xG and xA data for a specific player
async function fetchUnderstatData(playerId) {
  try {
    const url = `https://understat.com/player/${playerId}`;
    //console.log(`Fetching Understat data from: ${url}`);  // Debug URL
    const { data } = await axios.get(url);

    // Dynamically import cheerio
    const cheerio = await import('cheerio');
    const $ = cheerio.load(data);

    // Find the player stats located in a script tag
    let scriptContent = null;
    $('script').each((i, el) => {
      const scriptText = $(el).html();
      if (scriptText.includes('var shotsData')) {
        scriptContent = scriptText;
      }
    });

    if (!scriptContent) {
      throw new Error('shotsData script not found');
    }

    //console.log('Found shotsData script');  // Debug script found

    // Extract and parse shotsData
    const playerData = extractShotsData(scriptContent);

    // Compute the xG and xA for the player
    const xG = playerData.reduce((sum, game) => sum + parseFloat(game.xG), 0);
    const xA = playerData.reduce((sum, game) => sum + parseFloat(game.xA), 0);

    return { playerId, xG, xA };
  } catch (error) {
    console.error(`Error fetching Understat data for player ${playerId}: ${error.message}`);
    return null;
  }
}

// Enrich FPL players with advanced stats
async function enrichFPLWithAdvancedStats() {
  const mapping = JSON.parse(await fs.readFile('output/3-fpl_understat_mapping.json', 'utf-8'));
  const enrichedData = [];

  for (const player of mapping) {
    //console.log('Processing player:', player.fplName);  // Now use fplName correctly
    if (player.understatId) {
      //console.log(`Fetching data for player with Understat ID: ${player.understatId}`);  // Debug ID check
      const understatData = await fetchUnderstatData(player.understatId);
      //console.log('Enriching', player.fplName);  // This should now be printed correctly
      enrichedData.push({
        ...player,
        xG: understatData?.xG || 0,
        xA: understatData?.xA || 0
      });
    } else {
      enrichedData.push(player);
    }
  }

  await fs.writeFile('output/4-enriched_fpl_data.json', JSON.stringify(enrichedData, null, 2));
  console.log('Enriched FPL data saved to output/4-enriched_fpl_data.json');
}

(async () => {
  await enrichFPLWithAdvancedStats();
})();
