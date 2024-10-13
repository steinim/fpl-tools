import pandas as pd
import json

# File paths
player_history_path = './data/player_history.csv'
fplform_data_path = './output/fplform-data.csv'
players_all_path = './output/players-all-2024-10-13.json'
fixtures_path = './output/fixtures-1-38.json'

# Load player history data
player_history_df = pd.read_csv(player_history_path)

# Load form data CSV with delimiter and strip leading/trailing spaces from column names
fplform_df = pd.read_csv(fplform_data_path, delimiter=';')
fplform_df.columns = fplform_df.columns.str.strip()

# Print columns to verify correct column names
print("fplform_df columns:", fplform_df.columns)

# Check if 'id' is in fplform_df columns, if not rename appropriately
if 'id' not in fplform_df.columns:
    print("The 'id' column was not found in fplform_df. Available columns:", fplform_df.columns)
    # Rename columns if a close match is found (example, depending on the actual column name)
    # Assuming column might be named 'player_id' or similar
    if 'player_id' in fplform_df.columns:
        fplform_df.rename(columns={'player_id': 'id'}, inplace=True)
    elif 'player ID' in fplform_df.columns:  # Example for variations
        fplform_df.rename(columns={'player ID': 'id'}, inplace=True)

# Load players data JSON
with open(players_all_path, 'r') as f:
    players_all = json.load(f)

# Load fixtures data
with open(fixtures_path, 'r') as f:
    fixtures = json.load(f)

# Initialize an empty list to store player data
consolidated_player_data = []

# Iterate through the players in the players_all JSON to start consolidating data
for player_entry in players_all:
    player = player_entry['player']
    player_id = player['id']

    # Initialize a dictionary to store all consolidated player information
    consolidated_player = {
        "player_id": player_id,
        "name": player.get("full_name", player.get("web_name")),
        "position": player.get("position"),
        "team": player.get("team_name"),
        "cost": player.get("now_cost"),
        "form": player.get("form"),
        "selected_by_percent": player.get("selected_by_percent"),
        "transfers_in_event": player.get("transfers_in_event"),
        "transfers_out_event": player.get("transfers_out_event"),
        "status": player.get("status"),
        "average_points": player.get("average_points"),
        "average_minutes": player.get("average_minutes"),
        "is_available": player.get("is_available"),
        "expected_points": player.get("expected_points")
    }

    # Add recent form data from fplform_df if available
    fplform_row = fplform_df[fplform_df['id'] == player_id]
    if not fplform_row.empty:
        consolidated_player['recent_form'] = fplform_row.iloc[0].get('Form (Over/under-performance over the last 4 gameweeks compared to predicted points)', 0)
        consolidated_player['probability_of_playing_next_round'] = fplform_row.iloc[0].get('Prob. of (Probability that the player will play at all in the next match)', 100)

    # Add player history data from player_history_df if available
    history_rows = player_history_df[player_history_df['id'] == player_id]
    if not history_rows.empty:
        # Example of calculating an aggregate: average points over all historical records
        average_total_points = history_rows['total_points'].mean()
        consolidated_player['average_historical_points'] = average_total_points

    # Add upcoming fixture difficulty
    if 'upcoming_fixtures' in player:
        fixture_difficulty_sum = sum([f['difficulty'] for f in player['upcoming_fixtures']])
        fixture_count = len(player['upcoming_fixtures'])
        consolidated_player['average_fixture_difficulty'] = fixture_difficulty_sum / fixture_count if fixture_count > 0 else 0

    # Append consolidated player data to the list
    consolidated_player_data.append(consolidated_player)

# Convert consolidated player data to a DataFrame
consolidated_df = pd.DataFrame(consolidated_player_data)

# Save the consolidated data to CSV for later use
consolidated_df_path = './output/consolidated_fpl_data.csv'
consolidated_df.to_csv(consolidated_df_path, index=False)

# Output the path to the consolidated file
print("Consolidated data saved to:", consolidated_df_path)

