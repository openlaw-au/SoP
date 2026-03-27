#!/bin/sh

# Build DATABASE_URL from JSON connection details if not already set
if [ -z "$DATABASE_URL" ] && [ -n "$DATABASE_CONNECTION_DETAILS" ]; then
  DB_HOST=$(echo "$DATABASE_CONNECTION_DETAILS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.host)")
  DB_PORT=$(echo "$DATABASE_CONNECTION_DETAILS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(d.port||5432))")
  DB_USER=$(echo "$DATABASE_CONNECTION_DETAILS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.username)")
  DB_PASS=$(echo "$DATABASE_CONNECTION_DETAILS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(encodeURIComponent(d.password))")
  DB_NAME=$(echo "$DATABASE_CONNECTION_DETAILS" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.dbname||'people_project')")
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
fi

# DIRECT_URL defaults to DATABASE_URL if not set
if [ -z "$DIRECT_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

exec node server.js
