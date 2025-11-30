#!/bin/bash

# Demo script to launch server and two clients
# This script starts the server and opens two browser windows for testing

echo "Starting Multiplayer Game Demo..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm first."
    exit 1
fi

# Install server dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "Installing server dependencies..."
    cd server
    npm install
    cd ..
fi

# Install client dependencies if needed
if [ ! -d "client/node_modules" ]; then
    echo "Installing client dependencies..."
    cd client
    npm install
    cd ..
fi

# Start server in background
echo "Starting game server..."
cd server
node index.js &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 2

# Start client server in background
echo "Starting client server..."
cd client
npx http-server -p 3000 -c-1 > /dev/null 2>&1 &
CLIENT_PID=$!
cd ..

# Wait for client server to start
sleep 2

# Open two browser windows
echo "Opening browser clients..."
if command -v open &> /dev/null; then
    # macOS
    open -n -a "Google Chrome" --args --new-window "http://localhost:3000"
    sleep 1
    open -n -a "Google Chrome" --args --new-window "http://localhost:3000"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "http://localhost:3000" &
    sleep 1
    xdg-open "http://localhost:3000" &
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start "http://localhost:3000"
    sleep 1
    start "http://localhost:3000"
else
    echo "Please open http://localhost:3000 in two browser windows manually"
fi

echo ""
echo "Demo started!"
echo "Server PID: $SERVER_PID"
echo "Client server PID: $CLIENT_PID"
echo ""
echo "To stop the demo, press Ctrl+C or run: kill $SERVER_PID $CLIENT_PID"
echo ""
echo "Waiting for Ctrl+C to stop..."

# Wait for interrupt
trap "echo ''; echo 'Stopping servers...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT
wait

