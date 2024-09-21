import axios from 'axios';
import { promises as fs } from 'fs'; // fs.promises is the modern way in ES modules

// Fetch FPL players from the /bootstrap-static endpoint
async function fetchFPLPlayers() {
  const url = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  
  try {
    const { data } = await axios.get(url);
    const players = data.elements.map(player => ({
      fplId: player.id,
      name: player.web_name,
      team: data.teams.find(team => team.id === player.team).name,
      position: player.element_type,
    }));

    console.log(`Fetched ${players.length} players from FPL`);
    return players;
  } catch (error) {
    console.error('Error fetching FPL players:', error);
    return [];
  }
}

(async () => {
  const fplPlayers = await fetchFPLPlayers();
  await fs.writeFile('output/1-fpl_players.json', JSON.stringify(fplPlayers, null, 2));
})();
