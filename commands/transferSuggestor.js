import axios from 'axios';

// Manager ID and bank budget
const managerId = 2623803;
const bank = 0.2;  // £0.2 million in the bank

// Fetch team data and suggest 2 position-valid transfers
async function fetchTeamData(managerId) {
  try {
    const teamUrl = `https://fantasy.premierleague.com/api/entry/${managerId}/event/6/picks/`;
    const teamResponse = await axios.get(teamUrl);
    const teamData = teamResponse.data;

    const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const bootstrapResponse = await axios.get(bootstrapUrl);
    const playerData = bootstrapResponse.data.elements;

    // Calculate total team value
    let totalTeamValue = 0;

    // Get player details for current team
    const currentTeam = teamData.picks.map(pick => {
      const player = playerData.find(p => p.id === pick.element);
      const playerPrice = player.now_cost / 10;  // Convert to millions

      // Add player price to total team value
      totalTeamValue += playerPrice;

      return {
        player_name: player.web_name,
        position: player.element_type,  // 1 = GK, 2 = DEF, 3 = MID, 4 = FWD
        price: playerPrice,
        player_id: pick.element
      };
    });

    // Calculate total available budget
    const availableBudget = totalTeamValue + bank;

    // Suggest transfers based on position, form, and budget
    const underperformers = currentTeam.filter(player => player.price < 7);  // Example criteria for underperformers
    const replacements = playerData.filter(player => player.now_cost / 10 <= availableBudget && player.form > 5);  // Example criteria for replacements

    const transferSuggestions = [];
    for (let i = 0; i < 2 && i < underperformers.length; i++) {
      const outPlayer = underperformers[i];

      // Find replacement with the same position who is NOT already in the team
      const inPlayer = replacements.find(
        player => player.element_type === outPlayer.position &&
                  !currentTeam.some(teamPlayer => teamPlayer.player_id === player.id) &&  // Exclude players already in the team
                  player.now_cost / 10 <= availableBudget
      );

      if (inPlayer) {
        transferSuggestions.push({
          out_player: outPlayer.player_name,
          in_player: inPlayer.web_name,
          out_position: outPlayer.position,
          in_position: inPlayer.element_type,
          out_price: outPlayer.price,
          in_price: inPlayer.now_cost / 10,
          available_budget: availableBudget
        });
      }
    }

    // Display transfer suggestions
    console.log('Transfer Suggestions:', transferSuggestions);
    console.log('Total Team Value:', totalTeamValue, 'M');
    console.log('Available Budget:', availableBudget, 'M');
  } catch (error) {
    console.error('Error fetching team data:', error.message);
  }
}

fetchTeamData(managerId);
