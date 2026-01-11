#!/bin/bash
# Start automaker-Z.ai with 4000 series ports (to avoid conflict with main automaker on 3000 ports)
# Usage: ./start-local.sh

echo "Starting automaker-Z.ai on ports 4007 (UI) and 4008 (Server)..."
echo ""

# Export environment variables for the UI
export TEST_PORT=4007
export VITE_SERVER_URL=http://localhost:4008
export PORT=4008
export CORS_ORIGIN=http://localhost:4007

# Run the dev server
npm run dev
