import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs/promises'; // Use promises for file operations
import path from 'path'; // For getting the script name

// Function to show the usage message
function showUsage() {
  console.log(`
  Usage: node fetch-my-team.js <email> <password> <manager_id>

  Example: node fetch-my-team.js your_email@example.com your_password 565066
  `);
}

// Get command-line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  showUsage();
  process.exit(1);
}

const email = args[0];
const password = args[1];
const managerId = args[2];

// Get the name of the script without the directory and extension
const scriptName = path.basename(process.argv[1], path.extname(process.argv[1]));
// Write the enriched team data to a file using the script name and manager ID
const filePath = `output/${scriptName}_${managerId}.json`;

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: false }); // Set to false to see browser actions
    const page = await browser.newPage();

    // Go to Fantasy Premier League main page (or any page that would show you're logged in)
    await page.goto('https://fantasy.premierleague.com/', {
      waitUntil: 'networkidle2', // Wait until the page is fully loaded
    });

    // Check if already logged in by looking for a logged-in element (like profile or logout button)
    const loggedIn = await page.$('a[href="/accounts/logout"]'); // Replace with actual selector for logout or profile

    if (!loggedIn) {
      console.log('Not logged in. Attempting to log in...');

      // If not logged in, go to the login page
      await page.goto('https://users.premierleague.com/accounts/login/', {
        waitUntil: 'networkidle2', // Wait for the login page to be fully loaded
      });

      // Wait for the login form fields
      await page.waitForSelector('input[name="login"]');
      await page.type('input[name="login"]', email);

      await page.waitForSelector('input[name="password"]');
      await page.type('input[name="password"]', password);

      // Submit the form
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
      ]);

      console.log('Logged in successfully.');
    } else {
      console.log('Already logged in.');
    }

    // After logging in (or if already logged in), extract cookies
    const cookies = await page.cookies();
    await browser.close();

    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const apiUrl = `https://fantasy.premierleague.com/api/my-team/${managerId}/`;

    const teamResponse = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieString,
      },
    });

    const teamData = await teamResponse.json();
    console.log(teamData);

    // Fetch bootstrap-static data to get player names
    const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const bootstrapteamResponse = await fetch(bootstrapUrl);
    const bootstrapData = await bootstrapteamResponse.json();

    // Create a map of players by their element (player id)
    const playerMap = {};
    bootstrapData.elements.forEach(player => {
      playerMap[player.id] = {
        first_name: player.first_name,
        second_name: player.second_name,
      };
    });

    // Add first_name and second_name to the picks based on the element ID
    teamData.picks.forEach(pick => {
      const playerInfo = playerMap[pick.element];
      if (playerInfo) {
        pick.first_name = playerInfo.first_name;
        pick.second_name = playerInfo.second_name;
      }
    });

       await fs.writeFile(filePath, JSON.stringify(teamData, null, 2)); // Write to file with pretty JSON
   
       console.log(`Team data with player names saved to ${filePath}`);


  } catch (error) {
    console.error('An error occurred:', error);
  }
})();

