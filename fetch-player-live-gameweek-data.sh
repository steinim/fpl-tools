#!/bin/bash

# Fetch live gameweek data (alternative method)
# Similar to the first endpoint but typically used to track points for individual players.

# Key Entries in the Response:
# - elements: List of players and their real-time performance stats.
#   - id: The player’s ID (cross-reference with the player list from the `bootstrap-static` endpoint).
#   - stats: Detailed performance data for the player during this gameweek, including:
#     - minutes: Minutes played in the gameweek.
#     - goals_scored: Goals scored in the gameweek.
#     - assists: Assists made in the gameweek.
#     - clean_sheets: Whether the player kept a clean sheet (goalkeeper/defender).
#     - total_points: Total points the player earned in this gameweek.
#
# - explain: Provides a detailed breakdown of how points were awarded to players.
#   - fixture: The specific match where the points were earned.
#   - stats: Array of stats (goals, assists, etc.) and the points awarded for each action.


if [ $# -lt 1 ]; then
  echo "Usage: $0 <player id>"
  exit 1
fi

id=${1}
url="https://fantasy.premierleague.com/api/event/${id}/live/"
output="output/$0_${id}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
