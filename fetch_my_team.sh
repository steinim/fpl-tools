#!/bin/bash

if [ $# -lt 1 ]; then
  echo "Usage: $0 <email> <password>"
  exit 1
fi

# Set the login credentials
EMAIL="<YOUR EMAIL>"
PASSWORD="<YOUR PASSWORD>"
LOGIN_URL="https://users.premierleague.com/accounts/login/"
REDIRECT_URL="https://fantasy.premierleague.com/a/login"

# Create a cookie file to store session cookies
COOKIE_FILE="cookies.txt"

# Set the data to be sent in the POST request
PAYLOAD="login=$EMAIL&password=$PASSWORD&redirect_uri=$REDIRECT_URL&app=plfpl-web"

# Use curl to perform the login request
curl -s -c $COOKIE_FILE -d "$PAYLOAD" "$LOGIN_URL"

# The session is now saved in cookies.txt, and further requests can use it.
# For example, to access a protected page, use:
# curl -b $COOKIE_FILE "PROTECTED_PAGE_URL"

