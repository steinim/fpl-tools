import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

// Function to show the usage message
function showUsage() {
  console.log(`
  Usage: node login.js <email> <password> <manager_id>

  Example: node login.js your_email@example.com your_password 565066
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
      console.log("Not logged in. Attempting to log in...");

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

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieString,
      },
    });

    const data = await response.json();
    console.log(data);

  } catch (error) {
    console.error('An error occurred:', error);
  }
})();

