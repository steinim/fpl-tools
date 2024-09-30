// commands/team.js

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import config from '../config.js';

export default async function teamCommand(teamId) {
  try {
    // Validate teamId
    if (!/^\d+$/.test(teamId) || parseInt(teamId, 10) <= 0) {
      throw new Error('Team ID must be a positive integer.');
    }

    const url = `${config.apiBaseUrl}/entry/${teamId}/`;

    const response = await axios.get(url);
    const data = response.data;

    // Ensure the output directory exists
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    // Save data to output/team-<teamId>-<date>.json
    const date = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const outputFile = path.join(outputDir, `team-${teamId}-${date}.json`);

    // Check if file exists and handle overwrite logic
    try {
      await fs.access(outputFile);
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
    } catch (err) {
      // File does not exist, proceed
    }

    // Write data to the file
    await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving team data:', error.message);
  }
}
