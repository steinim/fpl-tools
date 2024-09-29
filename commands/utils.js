// commands/utils.js

// Utility function to add a team name to an object based on a team ID
export function addTeamName(obj, teamIdField, teamNameField, teamIdToName) {
  const teamId = obj[teamIdField];
  if (teamId === undefined || teamId === null) {
    console.warn(
      `Warning: teamId is undefined for field "${teamIdField}" in object:`,
      obj
    );
    return { ...obj, [teamNameField]: "Unknown Team" };
  }
  const teamName = teamIdToName[teamId] || `Team ${teamId}`;
  return { ...obj, [teamNameField]: teamName };
}

// Function to extract JSON-like data from a JavaScript block
export function extractJsonFromScript(scriptContent, variableName) {
  try {
    const jsonStart = scriptContent.indexOf(`JSON.parse('`) + 12;  // Find the start of the JSON
    const jsonEnd = scriptContent.indexOf(`')`, jsonStart);        // Find the end of the JSON string
    const encodedJsonString = scriptContent.slice(jsonStart, jsonEnd);

    // Decode hex-encoded characters (e.g., \x22 becomes ")
    const decodedJsonString = encodedJsonString.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Return the parsed JSON object
    return JSON.parse(decodedJsonString);
  } catch (error) {
    throw new Error(`Failed to parse JSON from Understat ${variableName}`);
  }
}


// Function to decode any escaped characters in the JSON string
export function decodeEscapedJson(encodedStr) {
  return encodedStr.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}
