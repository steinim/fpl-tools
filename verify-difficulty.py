import json

# File path for fixtures data
fixtures_path = './output/fixtures-1-38.json'

# Load fixtures data JSON
with open(fixtures_path, 'r') as f:
    fixtures = json.load(f)

# Check if 'difficulty' is missing in any fixture
missing_difficulty = [fixture for fixture in fixtures if 'difficulty' not in fixture]

# Output the results
if missing_difficulty:
    print(f"Number of fixtures missing 'difficulty': {len(missing_difficulty)}")
    print("Example of a fixture missing 'difficulty':", missing_difficulty[0])
else:
    print("All fixtures contain the 'difficulty' key.")

