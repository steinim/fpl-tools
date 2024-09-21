#!/bin/bash

# Fetch specific player summary from FPL API
# This endpoint gives detailed information about a player's performance history and upcoming fixtures.

# Key Entries in the Response:
# - history: Past performance data for the player, including the following:
#   - round: The gameweek number.
#   - total_points: Points earned by the player in that specific gameweek.
#   - goals_scored: Number of goals scored in that gameweek.
#   - assists: Assists provided by the player.
#   - minutes: Minutes played during the gameweek.
#   - value: The player's price at that time (in tenths of a million).
#
# - fixtures: Upcoming fixtures for the player.
#   - event: The gameweek number of the fixture.
#   - is_home: Whether the player’s team is playing at home (true/false).
#   - opponent_team: The ID of the opposing team (cross-reference with `teams` array).


if [ $# -lt 1 ]; then
  echo "Usage: $0 <player id>"
  exit 1
fi

id=${1}
url="https://fantasy.premierleague.com/api/element-summary/${id}/"
output="output/$0_${id}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
