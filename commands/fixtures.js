// commands/fixtures.js

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';
import { addTeamName } from './utils.js';

export default async function fixturesCommand(fromGameweek, toGameweek) {
  try {
    const url = `${config.apiBaseUrl}/fixtures/`;
    const response = await axios.get(url);
    const allFixtures = response.data;

    // Filter fixtures based on the gameweek range
    const fixtures = allFixtures.filter(
      (fixture) =>
        fixture.event &&
        fixture.event >= fromGameweek &&
        fixture.event <= toGameweek
    );

    if (fixtures.length === 0) {
      console.log(
        `No fixtures found between gameweeks ${fromGameweek} and ${toGameweek}.`
      );
      return;
    }

    // Create team ID to name mapping
    const teamIdToName = {};
    const bootstrapData = await axios.get(
      `${config.apiBaseUrl}/bootstrap-static/`
    );
    bootstrapData.data.teams.forEach((team) => {
      teamIdToName[team.id] = team.name;
    });

    // Add team names to fixtures
    const fixturesWithTeamNames = fixtures.map((fixture) => {
      let updatedFixture = addTeamName(
        fixture,
        'team_h',
        'team_h_name',
        teamIdToName
      );
      updatedFixture = addTeamName(
        updatedFixture,
        'team_a',
        'team_a_name',
        teamIdToName
      );
      return updatedFixture;
    });

    // Ensure the output directory exists
    const outputDir = path.resolve(config.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    // Save data to output/fixtures-<from>-<to>.json
    const outputFile = path.join(
      outputDir,
      `fixtures-${fromGameweek}-${toGameweek}.json`
    );
    await fs.writeFile(
      outputFile,
      JSON.stringify(fixturesWithTeamNames, null, 2)
    );
    console.log(`Fixtures data saved to ${outputFile}`);
  } catch (error) {
    console.error('Error retrieving fixtures data:', error.message);
  }
}
