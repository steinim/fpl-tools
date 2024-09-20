#!/bin/bash

# Fetch user team information from FPL API
# This endpoint provides detailed information about a user's team, including current and past gameweek performance.

# Key Entries in the Response:
# - id: Unique identifier for the FPL user's team.
# - player_first_name and player_last_name: The user's name.
# - current_event: The current gameweek number.
# - summary_overall_points: Total points scored by the user throughout the season.
# - summary_overall_rank: The user's current overall rank in FPL.
#
# - current: Array of the user's team for the current gameweek, including:
#   - element: The player’s ID (cross-reference with the `elements` array in `bootstrap-static`).
#   - position: The player's position in the formation (1 = goalkeeper, 2-5 = defenders, etc.).
#
# - leagues: Information about the leagues the user is participating in, including:
#   - id: Unique identifier for the league.
#   - name: The name of the league.
#   - entry_rank: The user's current rank in the league.


if [ $# -lt 1 ]; then
  echo "Usage: $0 <team id>"
  exit 1
fi

id=${1}
url="https://fantasy.premierleague.com/api/entry/${id}/"
output="output/$0_${id}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
