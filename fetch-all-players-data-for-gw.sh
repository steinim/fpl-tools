#!/bin/bash

if [ $# -lt 1 ]; then
  echo "Usage: $0 <gw>"
  exit 1
fi

gw=${1}
url=" https://fantasy.premierleague.com/api/event/${gw}/live/"
output="output/$0_gw${gw}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
