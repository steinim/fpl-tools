import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.json'; // Import configuration

// Reconstruct __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (teamId) {
  // Validate teamId again in case the function is called from elsewhere
  if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
    throw new Error('Team ID must be a positive integer.');
  }

  const url = `${config.apiBaseUrl}/entry/${teamId}/`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    // Ensure the output directory exists
    const outputDir = path.resolve(__dirname, '..', config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Save data to output/team-<teamId>-<timestamp>.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `team-${teamId}-${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

    console.log(`Data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving team data:', error.message);
  }
}
