import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (fromGameweek, toGameweek) {
  try {
    const url = `${config.apiBaseUrl}/fixtures/`;
    const response = await axios.get(url);
    const allFixtures = response.data;

    // Filter fixtures based on the gameweek range
    const fixtures = allFixtures.filter(
      (fixture) => fixture.event >= fromGameweek && fixture.event <= toGameweek
    );

    if (fixtures.length === 0) {
      console.log(`No fixtures found between gameweeks ${fromGameweek} and ${toGameweek}.`);
      return;
    }

    // Ensure the output directory exists
    const outputDir = path.resolve(__dirname, '..', config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Save data to output/fixtures-<from>-<to>.json
    const outputFile = path.join(outputDir, `fixtures-${fromGameweek}-${toGameweek}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(fixtures, null, 2));
    console.log(`Fixtures data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving fixtures data:', error.message);
  }
}

