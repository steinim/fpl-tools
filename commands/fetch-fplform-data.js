import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import ora from 'ora';
import config from '../config.js';

async function fetchFplFormData() {
  const outputDir = path.resolve(config.outputDir);
  const outputFile = path.join(outputDir, 'fplform-data.csv');

  // Ensure the output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Function to convert array data to CSV with ';' separator
  function arrayToCSV(data, separator = ';') {
    return data.map(row => row.join(separator)).join('\n');
  }

  // Function to clean up and normalize header names
  function cleanHeader(header, tooltip) {
    const cleanedHeader = header.replace(/\n/g, ' ').trim();
    if (tooltip) {
      return `${cleanedHeader} (${tooltip.trim()})`;
    }
    return cleanedHeader;
  }

  const spinner = ora('Starting the data scraping process...').start(); // Start spinner

  try {
    spinner.text = 'Launching Puppeteer...';

    // Launch Puppeteer to emulate a browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Load the local HTML file in Puppeteer
    const localFilePath = path.resolve('fpl-form-webpage/FPL Player Predicted Points and Value _ FPL Form.html');
    const fileUrl = `file://${localFilePath}`;

    spinner.text = 'Loading the local HTML file in the browser...';
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Wait for the specific table with ID 'players' to appear in the DOM
    spinner.text = 'Waiting for the table to be fully rendered...';
    await page.waitForSelector('#players tbody tr');

    // Extract table headers and rows
    spinner.text = 'Extracting table data...';
    const tableData = await page.evaluate(() => {
      // Select the table
      const table = document.querySelector('#players');
      if (!table) {
        throw new Error('Table with id "players" not found.');
      }

      // Extract the headers from the table
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => {
        const headerText = th.childNodes[0]?.textContent.trim() || '';
        const tooltip = th.querySelector('span.tip.low')?.textContent.trim() || '';
        return { headerText, tooltip };
      });

      // Extract rows from the table body
      const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
        return Array.from(row.querySelectorAll('td')).map(col => col.textContent.trim());
      });

      return { headers, rows };
    });

    spinner.text = 'Cleaning up headers...';

    // Clean headers and filter to remove unnecessary columns
    let cleanedHeaders = tableData.headers
      .map(({ headerText, tooltip }) => cleanHeader(headerText, tooltip));

    // Remove '✔' column and 'for Info' column
    const indexesToRemove = [0, 2]; // Indexes for '✔' and 'for Info'
    cleanedHeaders = cleanedHeaders.filter((_, index) => !indexesToRemove.includes(index));

    spinner.text = 'Filtering and cleaning data rows...';

    // Clean data rows similarly, removing unnecessary columns
    const cleanedRows = tableData.rows.map(row => row.filter((_, index) => !indexesToRemove.includes(index)));

    // Verify that the number of headers matches the number of columns in each row
    const headerCount = cleanedHeaders.length;
    const validRows = cleanedRows.filter(row => row.length === headerCount);

    if (validRows.length !== cleanedRows.length) {
      console.warn('Some rows were removed due to column count mismatch with headers.');
    }

    spinner.text = 'Combining the data into CSV format...';

    // Combine the cleaned headers and rows
    const csvData = [cleanedHeaders, ...validRows];

    // Convert data to CSV format
    const csvOutput = arrayToCSV(csvData);

    spinner.text = 'Saving the CSV file...';

    // Save to CSV file
    await fs.writeFile(outputFile, csvOutput);

    spinner.succeed(`Data successfully saved to ${outputFile}`);

    // Close the browser
    await browser.close();
  } catch (error) {
    spinner.fail(`Error during data fetching and saving: ${error.message}`);
  } finally {
    spinner.stop();
  }
}

// Export the function as a default export
export default fetchFplFormData;
