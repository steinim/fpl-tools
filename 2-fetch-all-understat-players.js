import * as cheerio from 'cheerio'; 
import axios from 'axios';
import { promises as fs } from 'fs';

// Helper function to convert hex-encoded characters (e.g., \x22 -> ") in the string
function decodeHexString(encodedStr) {
  return encodedStr.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

// Fetch all Understat players for the EPL (or other leagues if needed)
async function fetchUnderstatPlayers() {
  const leagues = ['epl']; // Add more leagues if needed
  let allPlayers = [];

  for (const league of leagues) {
    const url = `https://understat.com/league/${league}/2024`;
    
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      // Find the correct <script> tag that contains player data
      let scriptContent = null;
      $('script').each((i, el) => {
        const scriptText = $(el).html();
        if (scriptText.includes('var playersData')) {
          scriptContent = scriptText;
        }
      });

      if (!scriptContent) {
        throw new Error(`Player data script not found for ${league}`);
      }

      // Extract the hex-encoded JSON string
      const jsonDataStart = scriptContent.indexOf('JSON.parse(\'') + 12;
      const jsonDataEnd = scriptContent.indexOf('\')', jsonDataStart);
      let encodedJsonString = scriptContent.slice(jsonDataStart, jsonDataEnd);

      // Decode hex-encoded characters (e.g., \x22 becomes ")
      const decodedJsonString = decodeHexString(encodedJsonString);

      // Parse the decoded JSON string
      let playerData;
      try {
        playerData = JSON.parse(decodedJsonString);
      } catch (jsonError) {
        console.error('Error parsing decoded JSON data:', jsonError);
        return [];
      }

      // Map the players into a more usable format
      const players = playerData.map(player => ({
        understatId: player.id,
        name: player.player_name,
        team: player.team_title
      }));

      allPlayers = allPlayers.concat(players);
    } catch (error) {
      console.error(`Error fetching Understat players for ${league}:`, error.message);
    }
  }

  console.log(`Fetched ${allPlayers.length} players from Understat`);
  return allPlayers;
}

// Helper function to convert encoded hex strings to their actual characters
(async () => {
  const understatPlayers = await fetchUnderstatPlayers();
  await fs.writeFile('output/2-understat_players.json', JSON.stringify(understatPlayers, null, 2));
})();
