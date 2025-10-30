#!/usr/bin/env sh
PORT=${PORT:-8000}
echo "Starting Daphne on port $PORT"
exec daphne -b 0.0.0.0 -p "$PORT" race_management.asgi:application
