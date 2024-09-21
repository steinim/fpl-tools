import { promises as fs } from 'fs';
import * as fuzzball from 'fuzzball'; // Fuzzy matching library

// Normalize names by converting to lowercase and removing accents, special characters, etc.
function normalizeName(name) {
  if (!name) return ''; // Return an empty string if the name is undefined or null
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(); // Remove special characters, accents, etc.
}

// Split names into first and last components for better matching
function splitName(name) {
  const parts = name.trim().split(' ');
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

// Load FPL and Understat player data
async function loadPlayerData() {
  const fplPlayers = JSON.parse(await fs.readFile('output/1-fpl_players.json', 'utf-8'));
  const understatPlayers = JSON.parse(await fs.readFile('output/2-understat_players.json', 'utf-8'));

  return { fplPlayers, understatPlayers };
}

// Fuzzy match FPL players with Understat players
async function mapFPLToUnderstat() {
  const { fplPlayers, understatPlayers } = await loadPlayerData();
  const playerMapping = [];

  fplPlayers.forEach(fplPlayer => {
    const normalizedFPLName = normalizeName(fplPlayer.name);
    const normalizedFPLTeam = normalizeName(fplPlayer.team);
    const fplNameParts = splitName(fplPlayer.name);

    const bestMatch = understatPlayers.reduce((best, understatPlayer) => {
      const normalizedUnderstatName = normalizeName(understatPlayer.name); // Changed from player_name to name
      const normalizedUnderstatTeam = normalizeName(understatPlayer.team); // Changed from team_title to team
      const understatNameParts = splitName(understatPlayer.name);

      // Fuzzy match normalized names and teams separately
      const nameScore = fuzzball.ratio(normalizedFPLName, normalizedUnderstatName);
      const teamScore = normalizedFPLTeam === normalizedUnderstatTeam ? 100 : 0;

      // Give extra weight to matching last names
      const lastNameScore = fuzzball.ratio(fplNameParts.lastName, understatNameParts.lastName);

      // Add penalties for positional mismatches (if applicable)
      const positionPenalty = fplPlayer.position !== understatPlayer.position ? 20 : 0;

      // Combined score (weighted heavily toward the team and last name)
      const totalScore = nameScore * 0.5 + teamScore * 0.4 + lastNameScore * 0.1 - positionPenalty;

      // Log the matching process for debugging
      console.log(`Matching FPL Player: ${fplPlayer.name} (${fplPlayer.team}) with Understat Player: ${understatPlayer.name} (${understatPlayer.team}), Total Score: ${totalScore}, Name Score: ${nameScore}, Last Name Score: ${lastNameScore}, Team Score: ${teamScore}, Position Penalty: ${positionPenalty}`);

      return totalScore > best.score ? { ...understatPlayer, score: totalScore } : best;
    }, { score: 0 });

    if (bestMatch.score > 70) {  // Adjusted the match threshold back to 70
      playerMapping.push({
        fplId: fplPlayer.fplId,
        fplName: fplPlayer.name,
        fplTeam: fplPlayer.team,
        understatId: bestMatch.id,
        understatName: bestMatch.name,
        understatTeam: bestMatch.team,
        matchScore: bestMatch.score
      });
      console.log(`Matched FPL player with Understat data: ${fplPlayer.name} -> ${bestMatch.name} (Score: ${bestMatch.score})`);
    } else {
      console.warn(`No strong match found for FPL player: ${fplPlayer.name} (${fplPlayer.team})`);
    }
  });

  console.log('FPL to Understat mapping complete');
  return playerMapping;
}

(async () => {
  const mapping = await mapFPLToUnderstat();
  await fs.writeFile('output/3-fpl_understat_mapping.json', JSON.stringify(mapping, null, 2));
  console.log('Player mapping saved to fpl_understat_mapping.json');
})();
