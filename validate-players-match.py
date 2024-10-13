import pandas as pd
import json
import unidecode
from fuzzywuzzy import process

# File paths
fplform_data_path = './output/fplform-data.csv'
players_all_path = './output/players-all-2024-10-13.json'

# Load form data CSV with delimiter and strip leading/trailing spaces from column names
fplform_df = pd.read_csv(fplform_data_path, delimiter=';')
fplform_df.columns = fplform_df.columns.str.strip()

# Load players data JSON
with open(players_all_path, 'r') as f:
    players_all = json.load(f)

# Extract player IDs and names from players_all JSON
players_all_data = {
    player_entry['player']['id']: unidecode.unidecode(player_entry['player'].get("full_name", player_entry['player'].get("web_name"))).lower() 
    for player_entry in players_all
}

# Extract player IDs and names from fplform_df
fplform_players = {
    row['Player ID']: unidecode.unidecode(row['Player']).lower()
    for _, row in fplform_df.iterrows() if 'Player ID' in row
}

# Find matches and non-matches based on player IDs
matched_players = [player_id for player_id in fplform_players if player_id in players_all_data]
unmatched_players = [player_id for player_id in fplform_players if player_id not in players_all_data]

# Print the number of matched and unmatched players
print(f"Number of matched players: {len(matched_players)}")
print(f"Number of unmatched players: {len(unmatched_players)}")

# Print unmatched players for further inspection
print("Unmatched player IDs:", unmatched_players)


