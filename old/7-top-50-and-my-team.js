import { promises as fs } from 'fs';

// Function to extract the 50 top players + your team players
async function extractTopPlayers() {
  // Load the required data files
  const enrichedFPLData = JSON.parse(await fs.readFile('output/4-enriched_fpl_data.json', 'utf-8'));
  const myTeamData = JSON.parse(await fs.readFile('output/0-my-team.json', 'utf-8'));

  // Extract the 'picks' array from my team data
  const myTeamPlayers = myTeamData.picks.map(pick => pick.element);

  // Combine the top 50 players based on their xG (or any other stat you prefer)
  const topPlayers = enrichedFPLData
    .sort((a, b) => (b.xG + b.xA) - (a.xG + a.xA)) // Sort by combined xG + xA stats
    .slice(0, 50); // Get top 50 players

  // Filter out your team players from the enriched data
  const myTeam = enrichedFPLData.filter(player => myTeamPlayers.includes(player.fplId));

  // Combine the top 50 players with my team players (avoiding duplicates)
  const combinedPlayers = [...topPlayers, ...myTeam].filter(
    (player, index, self) => self.findIndex(p => p.fplId === player.fplId) === index
  );

  // Save the combined players data to a file
  await fs.writeFile('output/top_players_with_my_team.json', JSON.stringify(combinedPlayers, null, 2));
  console.log('Top players and my team data saved to output/top_players_with_my_team.json');
}

(async () => {
  await extractTopPlayers();
})();
