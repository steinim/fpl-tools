#!/bin/bash

url="https://fantasy.premierleague.com/api/bootstrap-static/"

curl -o output/fpl_data.json $url

echo "Data fetched and saved to fpl_data.json"
