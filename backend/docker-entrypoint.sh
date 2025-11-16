#!/bin/bash
set -e

# Wait for Qdrant to be ready
echo "Waiting for Qdrant to be ready..."
QDRANT_HOST=${QDRANT_HOST:-localhost}
QDRANT_PORT=${QDRANT_PORT:-6333}

until curl -f http://${QDRANT_HOST}:${QDRANT_PORT}/health > /dev/null 2>&1; do
  echo "Qdrant is unavailable - sleeping"
  sleep 2
done

echo "Qdrant is ready - starting application"

# Run the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

