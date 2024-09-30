// commands/teamPlayers.js

import axios from 'axios';
import { remove as removeDiacritics } from 'diacritics';
import config from '../config.js';

export default async function teamPlayersCommand(teamName) {
  try {
    // Fetch all players and teams from the API
    const url = `${config.apiBaseUrl}/bootstrap-static/`;
    const response = await axios.get(url);
    const players = response.data.elements;
    const teams = response.data.teams;
    console.log(teams);


    // Normalize the input team name
    const normalizedInputTeamName = normalizeName(teamName);

    // Find the team ID that matches the team name
    const team = teams.find((team) => {
      const normalizedTeamName = normalizeName(team.name);
      return normalizedTeamName === normalizedInputTeamName;
    });

    if (!team) {
      console.error(`Team "${teamName}" not found.`);
      return;
    }

    const teamId = team.id;

    // Filter players by team ID
    const teamPlayers = players.filter((player) => player.team === teamId);

    if (teamPlayers.length === 0) {
      console.log(`No players found for team "${team.name}".`);
      return;
    }

    // Map element_type to position names
    const positions = {
      1: 'Goalkeepers',
      2: 'Defenders',
      3: 'Midfielders',
      4: 'Forwards',
    };

    const playersByPosition = teamPlayers.reduce((acc, player) => {
      const positionName = positions[player.element_type];
      if (!acc[positionName]) {
        acc[positionName] = [];
      }
      acc[positionName].push(player);
      return acc;
    }, {});

    // Sort players within each position by total points
    for (const position in playersByPosition) {
      playersByPosition[position].sort(
        (a, b) => b.total_points - a.total_points
      );
    }

    // Display the results
    console.log(`Players for team "${team.name}" (ID: ${team.id}):\n`);

    for (const position of [
      'Goalkeepers',
      'Defenders',
      'Midfielders',
      'Forwards',
    ]) {
      if (playersByPosition[position]) {
        console.log(`${position}:`);
        playersByPosition[position].forEach((player) => {
          console.log(
            `- ${player.web_name} (Total Points: ${player.total_points})`
          );
        });
        console.log(''); // Empty line for readability
      }
    }
  } catch (error) {
    console.error('Error fetching team players:', error.message);
  }
}

// Helper function to normalize names
function normalizeName(name) {
  // Remove diacritics, convert to lowercase, and trim
  return removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove non-letter characters
    .trim();
}
