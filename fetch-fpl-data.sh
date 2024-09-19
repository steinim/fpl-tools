#!/bin/bash

url="https://fantasy.premierleague.com/api/bootstrap-static/"
output="output/${0}.json"

curl -o $output $url

echo "Data fetched and saved to $output"
