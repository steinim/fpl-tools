import pandas as pd
import json

# Paths to input files
fplform_data_path = './output/fplform-data.csv'
players_all_path = './output/players-all-2024-10-13.json'
fixtures_path = './output/fixtures-1-38.json'
player_history_path = './data/player_history.csv'

# Extract team names from fplform-data.csv
fplform_df = pd.read_csv(fplform_data_path, delimiter=';')
team_names_from_fplform = fplform_df['Team'].unique().tolist()

# Extract team names from players-all-2024-10-13.json
with open(players_all_path, 'r') as players_file:
    players_data = json.load(players_file)
team_names_from_players_all = list(set(player['team_name'] for player in players_data if 'team_name' in player))

# Extract team names from fixtures-1-38.json
with open(fixtures_path, 'r') as fixtures_file:
    fixtures_data = json.load(fixtures_file)

# Assuming fixtures_data is a list of dictionaries
team_names_from_fixtures = set()
for fixture in fixtures_data:
    team_names_from_fixtures.add(fixture['team_h_name'].lower())
    team_names_from_fixtures.add(fixture['team_a_name'].lower())

team_names_from_fixtures = list(team_names_from_fixtures)

# Extract team names from player_history.csv
player_history_df = pd.read_csv(player_history_path)
team_names_from_player_history = player_history_df['team_name'].unique().tolist()

# Combine all team names
all_team_names = set(team_names_from_fplform + team_names_from_players_all + team_names_from_fixtures + team_names_from_player_history)

# Print all unique team names
print("All unique team names:")
for team_name in sorted(all_team_names):
    print(team_name)

