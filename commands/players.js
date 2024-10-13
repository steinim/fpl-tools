import fs from 'fs/promises'; // Added for file handling
import path from 'path';
import playerCommand from './player.js';
import config from '../config.js'; // Assuming config has `outputDir`

export default async function playersCommand(playerIds) {
  const allPlayersData = [];

  for (const playerId of playerIds) {
    try {
      // Parameter Validation
      if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
        console.error(`Error: Player ID "${playerId}" must be a positive integer.`);
        continue; // Skip invalid player IDs
      }

      const playerData = await playerCommand(playerId);

      if (playerData) {
        allPlayersData.push(playerData);
      }
    } catch (error) {
      console.error(`Error processing player ID ${playerId}:`, error.message);
    }
  }

  // If we have successfully fetched any player data, write it to a file
  if (allPlayersData.length > 0) {
    const outputDir = path.resolve(config.outputDir);
    const date = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const outputFile = path.join(outputDir, `players-all-${date}.json`);

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputFile, JSON.stringify(allPlayersData, null, 2));
      console.log(`All fetched player data saved to ${outputFile}`);
    } catch (error) {
      console.error('Error saving all players data:', error.message);
    }
  }
}
