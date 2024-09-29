// commands/team.js

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function (teamId) {
  // Validate teamId
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

    // Save data to output/team-<teamId>-<date>.json
    const date = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const outputFile = path.join(outputDir, `team-${teamId}-${date}.json`);

    // Check if file exists and handle overwrite logic
    if (fs.existsSync(outputFile)) {
      // Prompt the user using inquirer with default 'yes'
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `File ${outputFile} already exists. Do you want to overwrite it?`,
          default: true, // Default is 'yes'
        },
      ]);

      if (!overwrite) {
        console.log(`Skipping ${outputFile}`);
        return;
      }
    }

    // Write data to the file
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving team data:', error.message);
  }
}
