import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs/promises'; // Use promises for file operations
import path from 'path'; // For getting the script name

// Function to show the usage message
function showUsage() {
  console.log(`
  Usage: node fetch-fpl-data.js <email> <password> <manager_id>

  Example: node fetch-fpl-data.js your_email@example.com your_password 565066
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
const outputDirectory = 'output/';
const filePath = path.join(outputDirectory, `${scriptName}_${managerId}.json`);

(async () => {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDirectory, { recursive: true });

    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch({
      headless: true, // Run in headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // These options are often necessary for cloud server environments
    });

    const page = await browser.newPage();

    // Set a user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });

    // Go to Fantasy Premier League main page
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
      await page.type('input[name="login"]', email, { delay: 100 }); // Simulate human-like typing with delay

      await page.waitForSelector('input[name="password"]');
      await page.type('input[name="password"]', password, { delay: 100 }); // Simulate human-like typing with delay

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
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    await browser.close();

    // URLs for the FPL API endpoints
    const apiUrls = {
      myTeam: `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
      bootstrap: 'https://fantasy.premierleague.com/api/bootstrap-static/',
      fixtures: 'https://fantasy.premierleague.com/api/fixtures/',
      eventStatus: 'https://fantasy.premierleague.com/api/event-status/',
      gameSettings: 'https://fantasy.premierleague.com/api/game-settings/',
      entry: `https://fantasy.premierleague.com/api/entry/${managerId}/`,
    };

    // Function to fetch API data with proper cookies
    async function fetchData(url) {
      const response = await fetch(url, {
        headers: { 'Cookie': cookieString },
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (error) {
        console.error('Invalid JSON response:', text);
        throw new Error('Expected JSON response but got HTML');
      }
    }

    // Fetch data from all relevant APIs
    const [myTeamData, bootstrapData, fixturesData, eventStatusData, gameSettingsData, entryData] = await Promise.all([
      fetchData(apiUrls.myTeam),
      fetchData(apiUrls.bootstrap),
      fetchData(apiUrls.fixtures),
      fetchData(apiUrls.eventStatus),
      fetchData(apiUrls.gameSettings),
      fetchData(apiUrls.entry),
    ]);

    // Merge all the data into one object
    const fullData = {
      team: myTeamData, // Detailed team data including picks, bench, captain
      bootstrap: bootstrapData, // General player stats and prices
      fixtures: fixturesData, // All upcoming fixtures
      eventStatus: eventStatusData, // Current gameweek and deadlines
      gameSettings: gameSettingsData, // Game rules and settings
      entry: entryData, // Basic team information and history
    };

    // Write the full data to a JSON file
    await fs.writeFile(filePath, JSON.stringify(fullData, null, 2)); // Pretty print JSON
    console.log(`FPL data saved to ${filePath}`);

  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
