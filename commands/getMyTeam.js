import axios from 'axios';

// Manager ID
const managerId = 2623803;  // Replace with your manager ID

// Fetch team data for gameweek 6
async function fetchTeamData(managerId) {
  try {
    const teamUrl = `https://fantasy.premierleague.com/api/entry/${managerId}/event/6/picks/`;
    const teamResponse = await axios.get(teamUrl);
    const teamData = teamResponse.data;

    const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const bootstrapResponse = await axios.get(bootstrapUrl);
    const playerData = bootstrapResponse.data.elements;

    const playerDetails = teamData.picks.map(pick => {
      const player = playerData.find(p => p.id === pick.element);
      const buying_price = player.now_cost / 10;  // Now_cost is in tenths of millions

      return {
        player_name: player.web_name,
        position: player.element_type,
        buying_price: buying_price,  // Use the current buying price as a proxy for selling price
        player_id: pick.element
      };
    });

    console.log(playerDetails);
  } catch (error) {
    console.error('Error fetching team data:', error.message);
  }
}

fetchTeamData(managerId);
