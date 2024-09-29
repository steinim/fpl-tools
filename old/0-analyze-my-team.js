import axios from 'axios';
import puppeteer from 'puppeteer';
import fs from 'fs/promises'; // For file operations
import * as cheerio from 'cheerio'; 

// Fetch Fixture Difficulty Ratings (FDR) from the FPL API
async function getFDR() {
    try {
        const response = await axios.get('https://fantasy.premierleague.com/api/fixtures/');
        const fixtures = response.data;

        const fdrData = fixtures.map(fixture => ({
            homeTeam: fixture.team_h,
            awayTeam: fixture.team_a,
            homeTeamDifficulty: fixture.team_h_difficulty,
            awayTeamDifficulty: fixture.team_a_difficulty,
            event: fixture.event
        }));

        console.log('FDR Data fetched successfully');
        return fdrData;
    } catch (error) {
        console.error('Error fetching FDR data:', error);
        return [];
    }
}

// Fetch injury data from Premier Injuries
async function getInjuries() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.premierinjuries.com/');

    const injuryData = await page.evaluate(() => {
        const injuries = [];
        document.querySelectorAll('.injury-list tbody tr').forEach(row => {
            const player = row.querySelector('.player')?.innerText;
            const team = row.querySelector('.team')?.innerText;
            const injuryStatus = row.querySelector('.status')?.innerText;
            const returnDate = row.querySelector('.return')?.innerText;
            if (player && team && injuryStatus) {
                injuries.push({ player, team, injuryStatus, returnDate });
            }
        });
        return injuries;
    });

    console.log('Injury Data fetched successfully');
    await browser.close();
    return injuryData;
}

// Fetch expected goals (xG) and expected assists (xA) from Understat
async function getExpectedStats() {
    try {
        const response = await axios.get('https://understat.com/league/EPL');
        const html = response.data;

        // Load the HTML into cheerio to parse it
        const $ = cheerio.load(html);

        // Find the script tag that contains the players' data
        const scriptText = $('script').filter((i, el) => {
            return $(el).html().includes('var playersData');
        }).html();

        if (!scriptText) {
            throw new Error('Could not find playersData script.');
        }

        // Extract the JSON-like data inside the script tag
        const jsonStartIndex = scriptText.indexOf('JSON.parse(\'') + 'JSON.parse(\''.length;
        const jsonEndIndex = scriptText.indexOf('\')', jsonStartIndex);
        let jsonString = scriptText.slice(jsonStartIndex, jsonEndIndex);

        // Replace the escaped hex characters like \x5B with actual characters
        jsonString = jsonString.replace(/\\x([0-9A-Fa-f]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)));

        // Parse the string into a JSON object
        const playersData = JSON.parse(jsonString);

        const expectedStats = playersData.map(player => ({
            name: player.player_name,
            xG: player.xG,
            xA: player.xA
        }));

        console.log('Expected Stats (xG/xA) fetched successfully');
        return expectedStats;
    } catch (error) {
        console.error('Error fetching expected stats:', error);
        return [];
    }
}


// Mapping FPL team names to FPL API team IDs
const teamIdMapping = {
    'Arsenal': 1,
    'Aston Villa': 2,
    'Bournemouth': 3,
    'Brentford': 4,
    'Brighton': 5,
    'Chelsea': 6,
    'Crystal Palace': 7,
    'Everton': 8,
    'Fulham': 9,
    'Ipswich': 10,
    'Leicester': 11,  // Correct team ID for Leicester
    'Liverpool': 12,
    'Man City': 13,
    'Man Utd': 14,
    'Newcastle': 15,
    'Nottingham Forest': 16,
    'Southampton': 17, // Correct team ID for Southampton
    'Spurs': 18,
    'West Ham': 19,
    'Wolves': 20
};


// Refined player analysis
const analyzeTeam = async (players) => {
    const fdrData = await getFDR();
    const injuryData = await getInjuries();
    const expectedStats = await getExpectedStats();

    const teamAnalysis = players.map(player => {
        const fplTeamId = teamIdMapping[player.team]; // Map the player team to FDR team IDs

        // Filter the FDR data for the player's team
        const playerFDR = fdrData.filter(fixture => {
            return fixture.homeTeam === fplTeamId || fixture.awayTeam === fplTeamId;
        }).map(fixture => {
            return fixture.homeTeam === fplTeamId
                ? fixture.homeTeamDifficulty
                : fixture.awayTeamDifficulty;
        });

        // Log missing FDR data
        if (playerFDR.length === 0) {
            console.log(`Missing FDR for player: ${player.name}, Team: ${player.team}`);
        }

        const injuryStatus = injuryData.find(injury => injury.player === player.name)?.injuryStatus || 'Fit';
        const expectedStat = expectedStats.find(stat => stat.name === player.name) || { xG: 0, xA: 0 };

        return {
            playerName: player.name,
            team: player.team,
            FDR: playerFDR.length > 0 ? playerFDR : 'No FDR Data',
            injuryStatus: injuryStatus,
            xG: expectedStat.xG,
            xA: expectedStat.xA
        };
    });

    await fs.writeFile('output/0-my_team_analysis.json', JSON.stringify(teamAnalysis, null, 2));
    console.log('Team analysis saved to 0-my_team_analysis.json');
};


// My team
const team = [
    { name: 'Dean Henderson', team: 'Crystal Palace' },
    { name: 'Taylor Harwood-Bellis', team: 'Southampton' },
    { name: 'Joško Gvardiol', team: 'Man City' },
    { name: 'Gabriel Magalhães', team: 'Arsenal' },
    { name: 'Jarell Quansah', team: 'Liverpool' },
    { name: 'Valentín Barco', team: 'Nottingham Forest' },
    { name: 'Mohamed Salah', team: 'Liverpool' },
    { name: 'Harry Winks', team: 'Leicester' },
    { name: 'Diogo Jota', team: 'Liverpool' },
    { name: 'Anthony Gordon', team: 'Newcastle' },
    { name: 'Ollie Watkins', team: 'Aston Villa' },
    { name: 'Erling Haaland', team: 'Man City' },
    { name: 'João Pedro', team: 'Brighton' },
];

// Run the analysis
analyzeTeam(team).then(() => {
    console.log('Analysis complete.');
});
