# Multiplayer State Synchronization Game

A complete implementation of a multiplayer game demonstrating server authority, client-side interpolation, and network latency simulation. Built as a solution for the Associate Game Developer Test.

## Architecture Overview

This project implements a **server-authoritative** multiplayer game architecture with the following components:

### Server (`/server`)
- **Authoritative Game State**: Server maintains canonical positions, scores, and coin states
- **Input Validation**: Server validates all player inputs to prevent cheating (teleportation, impossible movements)
- **Collision Detection**: Server checks coin collection proximity before awarding points
- **Network Latency Simulation**: All messages (client→server and server→client) are delayed by ~200ms with jitter
- **Game Loop**: Runs at 20 Hz, broadcasts snapshots at 10 Hz

### Client (`/client`)
- **Client-Side Prediction**: Local player movement is predicted immediately for responsiveness
- **Server Reconciliation**: Local player position is reconciled with authoritative server snapshots
- **Interpolation**: Remote players are smoothly interpolated between server snapshots to handle latency
- **Input Handling**: Captures keyboard input and sends velocity vectors to server

### Key Features

1. **Server Authority**
   - Server maintains all game state
   - Clients send only input intent (velocity vectors)
   - Server validates all actions (movement, coin collection)
   - Prevents client-side cheating

2. **Network Latency Simulation**
   - ~200ms latency on all messages (configurable in `server/index.js`)
   - ±10ms jitter for realism
   - Implemented via message queuing with `setTimeout`

3. **Smooth Interpolation**
   - Remote players use linear interpolation between buffered snapshots
   - 100ms interpolation delay to account for network latency
   - Maintains smooth movement despite 200ms round-trip latency

4. **Security & Validation**
   - Server checks coin collection proximity (30px radius)
   - Server validates input to prevent teleports (max distance per tick)
   - Clients cannot self-report pickups (tested in validation script)

## Project Structure

```
Krafton/
├── server/
│   ├── index.js          # Authoritative game server
│   └── package.json      # Server dependencies
├── client/
│   ├── index.html        # Client UI
│   ├── client.js         # Client logic (input, rendering, interpolation)
│   └── package.json      # Client dependencies
├── tools/
│   ├── demo.sh           # Demo script (macOS/Linux)
│   ├── demo.bat          # Demo script (Windows)
│   └── test-validation.js # Server authority test
└── README.md             # This file
```

## How to Run

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   cd ../client
   npm install
   ```

2. **Start the server:**
   ```bash
   cd server
   npm start
   ```
   Server will run on `ws://localhost:8080`

3. **Start the client server:**
   ```bash
   cd client
   npm start
   ```
   Client will be available at `http://localhost:3000`

4. **Open two browser windows:**
   - Navigate to `http://localhost:3000` in two separate windows
   - Game starts automatically when two players connect

### Using Demo Scripts

**macOS/Linux:**
```bash
./tools/demo.sh
```

**Windows:**
```cmd
tools\demo.bat
```

The demo script will:
- Install dependencies if needed
- Start the game server
- Start the client server
- Open two browser windows automatically

## Network Latency Simulation

Latency is simulated in the networking layer:

- **Location**: `server/index.js` - `LatencySimulator` class
- **Default**: 200ms (configurable via `SIMULATED_LATENCY` constant)
- **Jitter**: ±10ms random variation
- **Implementation**: Messages are queued with `setTimeout` before sending/receiving

To change the latency, edit `server/index.js`:
```javascript
const SIMULATED_LATENCY = 200; // Change this value (in milliseconds)
```

## Interpolation Approach

The client uses **linear interpolation** for remote players:

1. **Snapshot Buffering**: Server snapshots are buffered (up to 3 snapshots)
2. **Interpolation Delay**: 100ms delay to account for network latency
3. **Linear Interpolation**: Position is interpolated between two buffered snapshots based on timestamp
4. **Extrapolation Fallback**: If no newer snapshot exists, uses most recent position

**Why this approach?**
- Simple and effective for smooth movement
- Handles variable network latency well
- Low computational overhead
- Works well with the 200ms simulated latency

**Implementation details:**
- See `client/client.js` - `interpolatePlayer()` function
- Interpolation buffer size: 3 snapshots
- Interpolation delay: 100ms

## Testing Server Authority

A validation script demonstrates that the server rejects fake coin pickups:

```bash
# Make sure server is running first
cd server
npm start

# In another terminal:
node tools/test-validation.js
```

Expected output:
```
✓ SUCCESS: Server rejected the fake pickup!
  Server message: "Server authority: only server can validate coin pickups"
✓ Test passed: Server authority is working correctly.
```

## Game Rules

- **Players**: 2 players maximum
- **Shapes**: First player = circle, second player = square
- **Movement**: WASD or Arrow keys
- **Coins**: Spawn every 3 seconds at random positions
- **Collection**: Player must be within 30px of coin (validated by server)
- **Scoring**: Only server can award points (validates proximity)

## Controls

- **W / ↑**: Move up
- **S / ↓**: Move down
- **A / ←**: Move left
- **D / →**: Move right

## Demo Recording Instructions

To record a demo video:

1. **Using OBS Studio:**
   - Start OBS Studio
   - Add "Window Capture" source (select browser window)
   - Add "Display Capture" if you want to show both windows
   - Click "Start Recording"
   - Run the demo script
   - Play the game for 30-60 seconds showing:
     - Two players moving smoothly
     - Coins spawning and being collected
     - Scores updating
   - Stop recording

2. **Manual Steps:**
   - Start server: `cd server && npm start`
   - Start client: `cd client && npm start`
   - Open two browser windows to `http://localhost:3000`
   - Move both players around
   - Collect coins and observe score updates
   - Show that movement is smooth despite latency

## Assumptions

1. **Network**: Assumes reliable WebSocket connection (no packet loss simulation)
2. **Players**: Maximum 2 players (as per spec)
3. **World**: Fixed 800x600 world size
4. **Shapes**: Simple geometric shapes (circle/square) for players
5. **Coins**: Circular coins that disappear on collection
6. **Latency**: Constant 200ms with small jitter (no variable latency simulation)
7. **Browser**: Modern browser with WebSocket and Canvas support

## Technical Details

### Server Tick Rate
- **Game Loop**: 20 Hz (50ms per tick)
- **Snapshot Rate**: 10 Hz (100ms between snapshots)
- **Coin Spawn**: Every 3 seconds

### Client Rendering
- **Render Loop**: Browser `requestAnimationFrame` (~60 FPS)
- **Input Rate**: Sends input at render rate
- **Interpolation**: Updates every frame for smooth movement

### Security Measures
- Input validation: Maximum movement distance per tick
- Coin collection: Server checks 30px proximity
- No client-side state authority: Clients cannot modify scores or positions directly

## Troubleshooting

**Server won't start:**
- Check if port 8080 is available
- Ensure Node.js is installed: `node --version`

**Clients can't connect:**
- Verify server is running
- Check browser console for WebSocket errors
- Ensure firewall allows connections to localhost:8080

**Movement feels laggy:**
- This is expected with 200ms latency
- Local player should feel responsive (client-side prediction)
- Remote player should be smooth (interpolation)

**Coins not collecting:**
- Server validates proximity (30px radius)
- Make sure you're close enough to the coin
- Check server console for validation messages

## License

MIT License - See LICENSE file (if provided)

## Author

Built as a solution for the Associate Game Developer Test - Multiplayer State Synchronization.

