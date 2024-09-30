// commands/players.js

import playerCommand from './player.js';

export default async function playersCommand(playerIds) {
  for (const playerId of playerIds) {
    try {
      // Parameter Validation
      if (!/^\d+$/.test(playerId) || parseInt(playerId, 10) <= 0) {
        console.error(`Error: Player ID "${playerId}" must be a positive integer.`);
        continue; // Skip invalid player IDs
      }

      await playerCommand(playerId);
    } catch (error) {
      console.error(`Error processing player ID ${playerId}:`, error.message);
    }
  }
}
