import { promises as fs } from 'fs';
import * as fuzzball from 'fuzzball';

// Helper function to normalize player names (remove special characters and spaces)
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// Function to match FPL players to Understat players
async function mapFPLToUnderstat() {
  // Load FPL and Understat data
  const fplPlayers = JSON.parse(await fs.readFile('output/1-fpl_players.json', 'utf-8'));
  const understatPlayers = JSON.parse(await fs.readFile('output/2-understat_players.json', 'utf-8'));

  const combinedData = [];

  // Iterate through each FPL player
  fplPlayers.forEach(fplPlayer => {
    const fplName = fplPlayer.name;
    const fplTeam = fplPlayer.team;

    // Normalize FPL player name and team for comparison
    const normalizedFPLName = normalizeName(fplName);
    const normalizedFPLTeam = normalizeName(fplTeam);

    // Find the best matching Understat player based on name and team
    const bestMatch = understatPlayers.reduce((best, understatPlayer) => {
      const understatName = understatPlayer.name;
      const understatTeam = understatPlayer.team;

      // Normalize Understat player name and team for comparison
      const normalizedUnderstatName = normalizeName(understatName);
      const normalizedUnderstatTeam = normalizeName(understatTeam);

      // Calculate fuzziness score for both name and team
      const nameScore = fuzzball.ratio(normalizedFPLName, normalizedUnderstatName);
      const teamScore = fuzzball.ratio(normalizedFPLTeam, normalizedUnderstatTeam);

      // Total score is the average of name and team scores
      const totalScore = (nameScore + teamScore) / 2;

      // Return the best match based on the highest score
      if (!best || totalScore > best.score) {
        return { ...understatPlayer, score: totalScore };
      }
      return best;
    }, null);

    // Only include matches above a certain score threshold (e.g., 70)
    if (bestMatch && bestMatch.score >= 70) {
      combinedData.push({
        fplId: fplPlayer.fplId,
        fplName: fplPlayer.name,
        fplTeam: fplPlayer.team,
        understatId: bestMatch.understatId,
        understatName: bestMatch.name,
        understatTeam: bestMatch.team,
        matchScore: bestMatch.score
      });
    }
  });

  // Save the combined data to a new JSON file
  await fs.writeFile('output/3-fpl_understat_mapping.json', JSON.stringify(combinedData, null, 2));
  console.log('Combined FPL and Understat data saved to output/3-fpl_understat_mapping.json');
}

// Execute the mapping function
(async () => {
  await mapFPLToUnderstat();
})();
