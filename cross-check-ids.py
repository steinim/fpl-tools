# File paths
import pandas as pd
import json
import unidecode

# File paths
fplform_data_path = './output/fplform-data.csv'
players_all_path = './output/players-all-2024-10-13.json'

# Load form data CSV with delimiter and strip leading/trailing spaces from column names
fplform_df = pd.read_csv(fplform_data_path, delimiter=';')
fplform_df.columns = fplform_df.columns.str.strip()

# Load players data JSON
with open(players_all_path, 'r') as f:
    players_all = json.load(f)

# Player IDs to print
player_ids_to_check = [568, 369, 311, 3, 99, 78, 17, 230, 82, 351, 447, 521, 54, 270, 228]

# Extract players from fplform_df by Player ID
print("Players from fplform-data.csv:")
for player_id in player_ids_to_check:
    player_row = fplform_df[fplform_df['Player ID'] == player_id]
    if not player_row.empty:
        print(player_row[['Player ID', 'Player']].values[0])
    else:
        print(f"Player ID {player_id} not found in fplform-data.csv")

# Extract players from players-all JSON
print("\nPlayers from players-all-2024-10-13.json:")
for player_id in player_ids_to_check:
    player_entry = next((player for player in players_all if player['player']['id'] == player_id), None)
    if player_entry:
        player_name = player_entry['player'].get("full_name", player_entry['player'].get("web_name"))
        print(player_entry['player']['id'], player_name)
    else:
        print(f"Player ID {player_id} not found in players-all-2024-10-13.json")
fplform_data_path = './output/fplform-data.csv'
