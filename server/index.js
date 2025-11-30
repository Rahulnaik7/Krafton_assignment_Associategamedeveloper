/**
 * Authoritative Game Server
 * 
 * This server maintains canonical game state and validates all client actions.
 * Implements server authority with simulated network latency.
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = 8080;
const TICK_RATE = 20; // 20 Hz (50ms per tick)
const SNAPSHOT_RATE = 10; // 10 Hz (100ms between snapshots)
const SIMULATED_LATENCY = 200; // ms
const COIN_SPAWN_INTERVAL = 3000; // 3 seconds
const COIN_COLLECTION_RADIUS = 30; // pixels
const PLAYER_SPEED = 3; // pixels per tick
const MAX_PLAYERS = 2;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Game state
let gameState = {
  players: new Map(), // playerId -> { x, y, score, shape }
  coins: [],
  gameStarted: false,
  nextCoinId: 0,
  nextPlayerId: 0
};

// Latency simulation: queue messages with delay
class LatencySimulator {
  constructor(latencyMs) {
    this.latencyMs = latencyMs;
  }

  // Delay sending a message
  sendDelayed(ws, message, callback) {
    const jitter = Math.random() * 20 - 10; // ±10ms jitter
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        if (callback) callback();
      }
    }, this.latencyMs + jitter);
  }

  // Delay processing received message
  processDelayed(message, callback) {
    const jitter = Math.random() * 20 - 10;
    setTimeout(() => {
      callback(message);
    }, this.latencyMs + jitter);
  }
}

const latencySim = new LatencySimulator(SIMULATED_LATENCY);

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Helper: Calculate distance between two points
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Helper: Clamp value between min and max
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Helper: Validate player input (prevent teleportation)
function validateInput(currentX, currentY, newX, newY) {
  const maxDistance = PLAYER_SPEED * 2; // Allow some tolerance for network timing
  const dist = distance(currentX, currentY, newX, newY);
  return dist <= maxDistance;
}

// Spawn a new coin at random position
function spawnCoin() {
  const coin = {
    id: gameState.nextCoinId++,
    x: Math.random() * (WORLD_WIDTH - 40) + 20,
    y: Math.random() * (WORLD_HEIGHT - 40) + 20
  };
  gameState.coins.push(coin);
  return coin;
}

// Check coin collection and update scores
function checkCoinCollections() {
  for (const [playerId, player] of gameState.players) {
    for (let i = gameState.coins.length - 1; i >= 0; i--) {
      const coin = gameState.coins[i];
      const dist = distance(player.x, player.y, coin.x, coin.y);
      
      if (dist < COIN_COLLECTION_RADIUS) {
        // Server validates: player is close enough
        player.score++;
        gameState.coins.splice(i, 1);
        
        // Notify all clients about the collection
        broadcast({
          type: 'coinCollected',
          coinId: coin.id,
          playerId: playerId,
          newScore: player.score
        });
      }
    }
  }
}

// Broadcast message to all connected clients with latency
function broadcast(message, excludePlayerId = null) {
  const data = JSON.stringify(message);
  gameState.players.forEach((player, playerId) => {
    if (playerId !== excludePlayerId && player.ws) {
      latencySim.sendDelayed(player.ws, message);
    }
  });
}

// Send game snapshot to all clients
function sendSnapshot() {
  const snapshot = {
    type: 'snapshot',
    players: Array.from(gameState.players.entries()).map(([id, p]) => ({
      id: id,
      x: p.x,
      y: p.y,
      score: p.score,
      shape: p.shape
    })),
    coins: gameState.coins.map(c => ({ id: c.id, x: c.x, y: c.y })),
    timestamp: Date.now()
  };
  
  broadcast(snapshot);
}

// Game tick: update authoritative state
let tickCount = 0;
function gameTick() {
  if (!gameState.gameStarted || gameState.players.size < MAX_PLAYERS) {
    return;
  }

  // Check coin collections (server authority)
  checkCoinCollections();

  // Send snapshot at snapshot rate
  if (tickCount % (TICK_RATE / SNAPSHOT_RATE) === 0) {
    sendSnapshot();
  }

  tickCount++;
}

// Start game loop
setInterval(gameTick, 1000 / TICK_RATE);

// Spawn coins periodically
setInterval(() => {
  if (gameState.gameStarted && gameState.players.size === MAX_PLAYERS) {
    const coin = spawnCoin();
    broadcast({
      type: 'coinSpawned',
      coin: { id: coin.id, x: coin.x, y: coin.y }
    });
  }
}, COIN_SPAWN_INTERVAL);

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Check if we can accept more players
  if (gameState.players.size >= MAX_PLAYERS) {
    latencySim.sendDelayed(ws, {
      type: 'error',
      message: 'Game is full'
    });
    ws.close();
    return;
  }

  // Create new player
  const playerId = gameState.nextPlayerId++;
  const shape = playerId === 0 ? 'circle' : 'square'; // First player = circle, second = square
  const startX = Math.random() * (WORLD_WIDTH - 100) + 50;
  const startY = Math.random() * (WORLD_HEIGHT - 100) + 50;

  gameState.players.set(playerId, {
    x: startX,
    y: startY,
    score: 0,
    shape: shape,
    ws: ws
  });

  // Send welcome message with player info
  latencySim.sendDelayed(ws, {
    type: 'welcome',
    playerId: playerId,
    shape: shape,
    worldSize: { width: WORLD_WIDTH, height: WORLD_HEIGHT }
  });

  // If we now have 2 players, start the game
  if (gameState.players.size === MAX_PLAYERS && !gameState.gameStarted) {
    gameState.gameStarted = true;
    // Spawn initial coins
    for (let i = 0; i < 3; i++) {
      spawnCoin();
    }
    broadcast({
      type: 'gameStarted',
      coins: gameState.coins.map(c => ({ id: c.id, x: c.x, y: c.y }))
    });
  }

  // Handle incoming messages with latency simulation
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Simulate latency on received messages
      latencySim.processDelayed(message, (delayedMessage) => {
        handleClientMessage(playerId, delayedMessage);
      });
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Player ${playerId} disconnected`);
    gameState.players.delete(playerId);
    
    // If players drop below 2, stop the game
    if (gameState.players.size < MAX_PLAYERS) {
      gameState.gameStarted = false;
      gameState.coins = [];
      broadcast({ type: 'gameStopped' });
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for player ${playerId}:`, error);
  });
});

// Handle client messages (with server authority)
function handleClientMessage(playerId, message) {
  const player = gameState.players.get(playerId);
  if (!player) return;

  switch (message.type) {
    case 'input':
      // Client sends input intent (velocity/direction)
      // Server applies movement authoritatively
      const { vx, vy } = message;
      
      // Validate input (prevent impossible teleports)
      const newX = clamp(player.x + vx * PLAYER_SPEED, 0, WORLD_WIDTH);
      const newY = clamp(player.y + vy * PLAYER_SPEED, 0, WORLD_HEIGHT);
      
      if (validateInput(player.x, player.y, newX, newY)) {
        player.x = newX;
        player.y = newY;
      }
      // If invalid, server ignores the input (no response needed)
      break;

    case 'fakePickup':
      // Security test: client tries to fake a coin pickup
      // Server should reject this - only server validates pickups
      console.log(`Player ${playerId} attempted fake pickup - REJECTED`);
      latencySim.sendDelayed(player.ws, {
        type: 'pickupRejected',
        message: 'Server authority: only server can validate coin pickups'
      });
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
  console.log(`Simulated latency: ${SIMULATED_LATENCY}ms`);
  console.log(`Tick rate: ${TICK_RATE} Hz`);
  console.log(`Snapshot rate: ${SNAPSHOT_RATE} Hz`);
});

