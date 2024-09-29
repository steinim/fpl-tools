import fetch from 'node-fetch';
import fs from 'fs/promises';

// Function to fetch fixtures from the FPL API
async function fetchFixtures() {
    const url = 'https://fantasy.premierleague.com/api/fixtures/';
    
    try {
        // Fetch all the fixtures
        const response = await fetch(url);
        const fixtures = await response.json();

        // Filter fixtures for gameweek 6 onwards
        const gw6OnwardsFixtures = fixtures.filter(fixture => fixture.event >= 6);

        // Log the results to console
        console.log(`Fetched ${gw6OnwardsFixtures.length} fixtures from Gameweek 6 onwards.`);

        // Save the filtered fixtures to a file
        await fs.writeFile('fixtures_gw6_onwards.json', JSON.stringify(gw6OnwardsFixtures, null, 2));
        console.log('Fixtures saved to fixtures_gw6_onwards.json');
    } catch (error) {
        console.error('Error fetching fixtures:', error.message);
    }
}

// Run the function
fetchFixtures();
