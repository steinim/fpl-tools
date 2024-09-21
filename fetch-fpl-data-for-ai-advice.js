import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs/promises'; // Use promises for file operations
import path from 'path'; // For getting the script name
import os from 'os'; // To detect the operating system

// Function to show the usage message
function showUsage() {
  console.log(`
  Usage: node fetch-fpl-data.js <email> <password> <manager_id> [--no-auth]

  Example: node fetch-fpl-data.js your_email@example.com your_password 565066
           node fetch-fpl-data.js your_email@example.com your_password 565066 --no-auth
  `);
}

// Get command-line arguments
const args = process.argv.slice(2);

if (args.length < 3 && !args.includes('--no-auth')) {
  showUsage();
  process.exit(1);
}

const email = args[0];
const password = args[1];
const managerId = args[2];
const noAuth = args.includes('--no-auth'); // Check if --no-auth flag is provided

// Get the name of the script without the directory and extension
const scriptName = path.basename(process.argv[1], path.extname(process.argv[1]));
const outputDirectory = 'output/';
const filePath = path.join(outputDirectory, `${scriptName}_${managerId}.json`);

// Helper function to simulate random delays
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create a standard delay function
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Determine Chromium/Chrome path based on OS
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

let chromiumPath;
if (isMac) {
  // Path for Chrome on macOS
  chromiumPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
} else if (isLinux) {
  // Path for Chromium on Linux
  chromiumPath = '/usr/bin/chromium-browser';
}

// Set headless mode based on OS (headless for Ubuntu, non-headless for macOS)
const headless = isLinux;  // true for Ubuntu, false for macOS

(async () => {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDirectory, { recursive: true });

    // Launch Puppeteer without Tor for public API requests
    const browser = await puppeteer.launch({
      headless: headless, // Use headless mode on Linux (Ubuntu), non-headless on macOS
      executablePath: chromiumPath, // Use system-installed Chromium/Chrome depending on OS
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    if (!noAuth) {
      // Set a user agent to mimic a real browser
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });

      // Add a random delay between actions to simulate human-like behavior
      await delay(randomDelay(1000, 3000)); // Wait between 1 and 3 seconds before interacting

      // Go to Fantasy Premier League main page
      await page.goto('https://fantasy.premierleague.com/', {
        waitUntil: 'networkidle2', // Wait until the page is fully loaded
      });

      // Perform login and authenticated requests if --no-auth is not provided
      const loggedIn = await page.$('a[href="/accounts/logout"]');

      if (!loggedIn) {
        console.log('Not logged in. Attempting to log in...');

        await page.goto('https://users.premierleague.com/accounts/login/', {
          waitUntil: 'networkidle2',
        });

        await page.waitForSelector('input[name="login"]');
        await page.type('input[name="login"]', email, { delay: randomDelay(100, 300) });

        await page.waitForSelector('input[name="password"]');
        await page.type('input[name="password"]', password, { delay: randomDelay(100, 300) });

        await delay(randomDelay(1000, 3000));

        await Promise.all([
          page.click('button[type="submit"]'),
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);

        console.log('Logged in successfully.');
      }

      await delay(randomDelay(1000, 3000));
      const cookies = await page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      await browser.close();

      const apiUrls = {
        myTeam: `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
        bootstrap: 'https://fantasy.premierleague.com/api/bootstrap-static/',
        fixtures: 'https://fantasy.premierleague.com/api/fixtures/',
        eventStatus: 'https://fantasy.premierleague.com/api/event-status/',
        entry: `https://fantasy.premierleague.com/api/entry/${managerId}/`,
      };

      async function fetchData(url) {
        await delay(randomDelay(1000, 5000));
        const response = await fetch(url, { headers: { 'Cookie': cookieString } });
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (error) {
          console.error('Invalid JSON response:', text);
          throw new Error('Expected JSON response but got HTML');
        }
      }

      const [myTeamData, bootstrapData, fixturesData, eventStatusData, entryData] = await Promise.all([
        fetchData(apiUrls.myTeam),
        fetchData(apiUrls.bootstrap),
        fetchData(apiUrls.fixtures),
        fetchData(apiUrls.eventStatus),
        fetchData(apiUrls.entry),
      ]);

      const fullData = {
        team: myTeamData,
        bootstrap: bootstrapData,
        fixtures: fixturesData,
        eventStatus: eventStatusData,
        entry: entryData,
      };

      await fs.writeFile(filePath, JSON.stringify(fullData, null, 2));
      console.log(`FPL data saved to ${filePath}`);
    } else {
      console.log('Fetching only public data as --no-auth is provided.');

      const publicApiUrls = {
        bootstrap: 'https://fantasy.premierleague.com/api/bootstrap-static/',
        fixtures: 'https://fantasy.premierleague.com/api/fixtures/',
        eventStatus: 'https://fantasy.premierleague.com/api/event-status/',
      };

      async function fetchPublicData(url) {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch (error) {
            console.error('Invalid JSON response:', text);
            throw new Error('Expected JSON response but got HTML');
          }
        } else {
          console.error(`Error fetching ${url}: ${response.statusText}`);
          throw new Error('Failed to fetch public data');
        }
      }

      const [bootstrapData, fixturesData, eventStatusData] = await Promise.all([
        fetchPublicData(publicApiUrls.bootstrap),
        fetchPublicData(publicApiUrls.fixtures),
        fetchPublicData(publicApiUrls.eventStatus),
      ]);

      const publicData = {
        bootstrap: bootstrapData,
        fixtures: fixturesData,
        eventStatus: eventStatusData,
      };

      await fs.writeFile(filePath, JSON.stringify(publicData, null, 2));
      console.log(`FPL public data saved to ${filePath}`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
