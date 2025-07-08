#!/bin/bash

# Start server script for LodgeTix Reconcile Express server
# This script runs the server in the background on port 3006

echo "Starting LodgeTix Reconcile Express server..."

# Check if the server is already running on port 3006
if lsof -Pi :3006 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Server is already running on port 3006"
    echo "To stop it, run: ./stop-server.sh"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the server in the background using nohup
nohup npm run server > logs/server.log 2>&1 &

# Save the PID
echo $! > server.pid

echo "✅ Server started successfully!"
echo "📋 Process ID: $(cat server.pid)"
echo "📊 Server running at: http://localhost:3006"
echo "📄 Logs are being written to: logs/server.log"
echo ""
echo "To stop the server, run: ./stop-server.sh"
echo "To view logs in real-time, run: tail -f logs/server.log"