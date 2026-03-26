#!/bin/sh

# Build DATABASE_URL from individual vars if not already set
if [ -z "$DATABASE_URL" ] && [ -n "$DATABASE_USERNAME" ] && [ -n "$DATABASE_PASSWORD" ] && [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_NAME" ]; then
  DATABASE_PORT="${DATABASE_PORT:-5432}"
  export DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}?sslmode=require"
fi

# DIRECT_URL defaults to DATABASE_URL if not set
if [ -z "$DIRECT_URL" ]; then
  export DIRECT_URL="$DATABASE_URL"
fi

exec node server.js
