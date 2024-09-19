#!/bin/bash

if [ $# -lt 1 ]; then
  echo "Usage: $0 <team id>"
  exit 1
fi

id=${1}
url="https://fantasy.premierleague.com/api/entry/${id}/"
output="output/$0_${id}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
