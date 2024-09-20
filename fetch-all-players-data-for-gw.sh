#!/bin/bash

# Fetch live gameweek data from FPL API
# This endpoint returns real-time stats for all players during the specified gameweek.

# Key Entries in the Response:
# - elements: This array contains detailed stats for each player in the current gameweek.
#   - id: The player’s unique identifier (useful to cross-reference with other endpoints).
#   - stats: Detailed statistics for the player in this gameweek.
#     - minutes: Number of minutes played.
#     - goals_scored: Goals scored by the player.
#     - assists: Assists made by the player.
#     - clean_sheets: Indicates whether the player kept a clean sheet (goalkeepers/defenders).
#     - bonus: Bonus points awarded to the player.
#     - total_points: The total points the player earned in this gameweek.
#
# - explain: Provides breakdown of how points were earned for each player.
#   - fixture: The specific match where the points were earned.
#   - stats: Array of actions (goals, assists, etc.) and the points awarded for each action.



if [ $# -lt 1 ]; then
  echo "Usage: $0 <gw>"
  exit 1
fi

gw=${1}
url=" https://fantasy.premierleague.com/api/event/${gw}/live/"
output="output/$0_gw${gw}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
