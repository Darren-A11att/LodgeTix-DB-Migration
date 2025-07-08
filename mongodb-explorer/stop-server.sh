#!/bin/bash

# Stop server script for LodgeTix Reconcile Express server

if [ -f server.pid ]; then
    PID=$(cat server.pid)
    
    # Check if the process is still running
    if ps -p $PID > /dev/null; then
        echo "Stopping LodgeTix Reconcile Express server (PID: $PID)..."
        kill $PID
        
        # Wait for process to terminate
        sleep 2
        
        # Force kill if still running
        if ps -p $PID > /dev/null; then
            echo "Force stopping server..."
            kill -9 $PID
        fi
        
        echo "✅ Server stopped successfully!"
    else
        echo "⚠️  Server process (PID: $PID) is not running"
    fi
    
    # Clean up PID file
    rm server.pid
else
    echo "⚠️  No server.pid file found"
    echo "Checking for any process running on port 3006..."
    
    # Try to find and kill any process on port 3006
    PID=$(lsof -ti:3006)
    if [ ! -z "$PID" ]; then
        echo "Found process $PID running on port 3006"
        kill $PID
        echo "✅ Process stopped"
    else
        echo "No process found running on port 3006"
    fi
fi