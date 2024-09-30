// commands/searchPlayer.js

import axios from 'axios';
import { remove as removeDiacritics } from 'diacritics';
import inquirer from 'inquirer';
import config from '../config.js';

export default async function searchPlayerCommand(playerName) {
  try {
    // Fetch all players from the API
    const url = `${config.apiBaseUrl}/bootstrap-static/`;
    const response = await axios.get(url);
    const players = response.data.elements;

    // Normalize the input player name
    const normalizedInputName = normalizeName(playerName);

    // Search for matching players
    const matches = players.filter((player) => {
      const fullName = `${player.first_name} ${player.second_name}`;
      const normalizedFullName = normalizeName(fullName);
      const normalizedFirstName = normalizeName(player.first_name);
      const normalizedLastName = normalizeName(player.second_name);

      return (
        normalizedFullName.includes(normalizedInputName) ||
        normalizedFirstName.includes(normalizedInputName) ||
        normalizedLastName.includes(normalizedInputName)
      );
    });

    if (matches.length === 0) {
      console.log(`No players found matching "${playerName}".`);
      return;
    }

    if (matches.length === 1) {
      const player = matches[0];
      console.log(`Found 1 player matching "${playerName}":`);
      console.log(
        `- ID: ${player.id}, Name: ${player.first_name} ${player.second_name}`
      );
    } else {
      // Present a list for the user to select
      const choices = matches.map((player) => ({
        name: `${player.first_name} ${player.second_name} (ID: ${player.id})`,
        value: player.id,
      }));

      const { selectedPlayerId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedPlayerId',
          message: `Found ${matches.length} players matching "${playerName}". Select a player:`,
          choices,
        },
      ]);

      const selectedPlayer = matches.find(
        (player) => player.id === selectedPlayerId
      );
      console.log(
        `You selected: ID ${selectedPlayer.id}, Name: ${selectedPlayer.first_name} ${selectedPlayer.second_name}`
      );
    }
  } catch (error) {
    console.error('Error searching for player:', error.message);
  }
}

// Helper function to normalize names
function normalizeName(name) {
  // Remove diacritics and convert to lowercase
  return removeDiacritics(name).toLowerCase();
}
