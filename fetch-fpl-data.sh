#!/bin/bash

# Fetch general FPL data (players, teams, events, etc.)
# This endpoint returns static data that is common across the game, such as player details,
# team information, gameweeks, etc.

# Key Entries in the Response:
# - elements: This is the player database. Each player has the following important fields:
#   - id: Unique identifier for the player.
#   - first_name and second_name: The player’s full name.
#   - team: ID of the team the player plays for (cross-reference with the `teams` array).
#   - now_cost: The current price of the player (in tenths of a million, e.g., 100 = £10.0m).
#   - total_points: The total points the player has scored this season.
#   - element_type: Position of the player (1 = Goalkeeper, 2 = Defender, 3 = Midfielder, 4 = Forward).
#
# - teams: List of Premier League teams with these key fields:
#   - id: Unique team identifier (used to link players to teams).
#   - name: Full name of the team (e.g., "Manchester United").
#   - short_name: Abbreviated name of the team (e.g., "MUN").
#
# - events: Information about each gameweek, including:
#   - id: The gameweek number.
#   - name: The name of the gameweek (e.g., "Gameweek 1").
#   - deadline_time: The deadline for making team selections (in UTC).


url="https://fantasy.premierleague.com/api/bootstrap-static/"
output="output/${0}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
