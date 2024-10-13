import pandas as pd
import json

# Paths to input files
fplform_data_path = './output/fplform-data.csv'
players_all_path = './output/players-all-2024-10-13.json'
fixtures_path = './output/fixtures-1-38.json'
player_history_path = './data/player_history.csv'

# Load fplform-data.csv
fplform_df = pd.read_csv(fplform_data_path, delimiter=';')

# Load players-all-2024-10-13.json
with open(players_all_path, 'r') as players_file:
    players_data = json.load(players_file)
players_all_df = pd.json_normalize(players_data)

# Load fixtures-1-38.json
with open(fixtures_path, 'r') as fixtures_file:
    fixtures_data = json.load(fixtures_file)
fixtures_df = pd.json_normalize(fixtures_data)

# Load player_history.csv
player_history_df = pd.read_csv(player_history_path)

# Standardize team names mapping
def standardize_team_name(name):
    team_mapping = {
        'arsenal': 'Arsenal', 'ars': 'Arsenal',
        'aston villa': 'Aston Villa', 'avl': 'Aston Villa',
        'bournemouth': 'Bournemouth', 'bou': 'Bournemouth',
        'brentford': 'Brentford', 'bre': 'Brentford',
        'brighton': 'Brighton', 'bha': 'Brighton',
        'chelsea': 'Chelsea', 'che': 'Chelsea',
        'crystal palace': 'Crystal Palace', 'cry': 'Crystal Palace',
        'everton': 'Everton', 'eve': 'Everton',
        'fulham': 'Fulham', 'ful': 'Fulham',
        'ipswich': 'Ipswich', 'ips': 'Ipswich',
        'leicester': 'Leicester', 'lei': 'Leicester',
        'liverpool': 'Liverpool', 'liv': 'Liverpool',
        'man city': 'Man City', 'mci': 'Man City',
        'man utd': 'Man Utd', 'mun': 'Man Utd',
        'newcastle': 'Newcastle', 'new': 'Newcastle',
        "nott'm forest": "Nott'm Forest", 'nfo': "Nott'm Forest",
        'southampton': 'Southampton', 'sou': 'Southampton',
        'spurs': 'Spurs', 'tot': 'Spurs', 'tottenham': 'Spurs',
        'west ham': 'West Ham', 'whu': 'West Ham',
        'wolves': 'Wolves', 'wol': 'Wolves', 'wolverhampton': 'Wolves'
    }
    return team_mapping.get(name.lower(), name)

# Standardize team names in fplform_df
fplform_df['Team'] = fplform_df['Team'].apply(standardize_team_name)

# Standardize team names in players_all_df
players_all_df['player.team_name'] = players_all_df['player.team_name'].apply(standardize_team_name)

# Standardize team names in fixtures_df
fixtures_df['team_h_name'] = fixtures_df['team_h_name'].apply(standardize_team_name)
fixtures_df['team_a_name'] = fixtures_df['team_a_name'].apply(standardize_team_name)

# Step 1: Merge fplform_df and players_all_df using Player ID
combined_df_1 = fplform_df.merge(players_all_df, left_on='Player ID', right_on='player.id', how='left', suffixes=('_fplform', '_players'))
combined_df_1.to_csv('./output/combined_step_1.csv', index=False)
print(f"Number of records after merging fplform and players_all: {len(combined_df_1)}")

# Step 2: Merge the result with player_history_df using Player ID
combined_df_2 = combined_df_1.merge(player_history_df, left_on='Player ID', right_on='id', how='left', suffixes=('', '_history'))
combined_df_2.to_csv('./output/combined_step_2.csv', index=False)
print(f"Number of records after merging with player_history: {len(combined_df_2)}")

# Step 3: Calculate average fixture difficulty for each team
fixtures_df['Difficulty'] = (fixtures_df['team_h_difficulty'] + fixtures_df['team_a_difficulty']) / 2
average_difficulty = fixtures_df.groupby('team_h_name')['Difficulty'].mean().reset_index()
combined_df_3 = combined_df_2.merge(average_difficulty, left_on='Team', right_on='team_h_name', how='left')
combined_df_3.to_csv('./output/combined_step_3.csv', index=False)
print(f"Number of records after merging with average fixture difficulty: {len(combined_df_3)}")

# Print columns to verify available column names
print("Combined DataFrame columns:")
print(combined_df_3.columns)

# Separate players with missing critical data (e.g., Player ID, Team, Position, Cost)
critical_columns = ['Player ID', 'Team', 'Pos (Position)', 'Cost (Player\'s current price)', 'player.position', 'player.now_cost']
missing_data_players = combined_df_3[combined_df_3[critical_columns].isna().any(axis=1)]
missing_data_players.to_csv('./output/missing_data_players.csv', index=False)
print(f"Number of players with missing data: {len(missing_data_players)}")
print("Players with missing data saved to ./output/missing_data_players.csv")

# Filter out players with complete critical data
complete_data_players = combined_df_3.dropna(subset=critical_columns)
complete_data_players.to_csv('./output/complete_fpl_data.csv', index=False)
print(f"Number of players with complete data: {len(complete_data_players)}")
print("Players with complete data saved to ./output/complete_fpl_data.csv")