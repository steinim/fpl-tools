import axios from 'axios';
import { promises as fs } from 'fs';

// Function to fetch FPL player data
async function fetchFPLPlayerData() {
  try {
    // Fetch player data from the FPL API
    const response = await axios.get('https://fantasy.premierleague.com/api/bootstrap-static/');
    const playerData = response.data.elements; // 'elements' contains player data

    // Extract relevant information (player name, cost, points)
    const playersWithCostAndPoints = playerData.map(player => ({
      id: player.id,
      name: `${player.first_name} ${player.second_name}`,
      team: player.team,
      cost: player.now_cost / 10, // Cost is in tenths, so divide by 10
      total_points: player.total_points,
      position: player.element_type, // Position (1 = GK, 2 = DEF, 3 = MID, 4 = FWD)
    }));

    // Save the result to a JSON file
    await fs.writeFile('8-fpl_players_cost_points.json', JSON.stringify(playersWithCostAndPoints, null, 2));
    console.log('Player data with costs and points saved to output/8-fpl_players_cost_points.json');
  } catch (error) {
    console.error('Error fetching FPL player data:', error);
  }
}

(async () => {
  await fetchFPLPlayerData();
})();
