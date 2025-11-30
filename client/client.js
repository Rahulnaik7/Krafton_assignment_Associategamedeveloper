/**
 * Enhanced Game Client
 * 
 * Handles input, rendering, interpolation, and network communication.
 * Implements client-side prediction for local player and interpolation for remote players.
 * Enhanced with particle effects, trails, and visual improvements.
 */

const SERVER_URL = 'ws://localhost:8080';
const INTERPOLATION_BUFFER_SIZE = 5; // Increased for smoother interpolation
const INTERPOLATION_DELAY = 150; // Slightly increased for better buffering

// Game state
let gameState = {
  localPlayerId: null,
  localPlayer: null,
  players: new Map(),
  coins: new Map(),
  worldSize: { width: 800, height: 600 },
  connected: false,
  gameStarted: false
};

// Visual effects
const particles = [];
const playerTrails = new Map(); // playerId -> [{ x, y, life }, ...]
const scorePopups = [];
let coinRotation = 0;
let backgroundOffset = 0;

// Interpolation buffers
const interpolationBuffers = new Map();

// Smooth movement state for ultra-smooth interpolation
const smoothPlayers = new Map(); // playerId -> { targetX, targetY, currentX, currentY, velocityX, velocityY }

// Input state
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// WebSocket connection
let ws = null;

// Initialize
function init() {
  connectToServer();
  setupInputHandlers();
  startRenderLoop();
  updateUI();
}

// Connect to WebSocket server
function connectToServer() {
  ws = new WebSocket(SERVER_URL);

  ws.onopen = () => {
    console.log('Connected to server');
    gameState.connected = true;
    updateUI();
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('Connection error');
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    gameState.connected = false;
    updateUI();
    setTimeout(connectToServer, 2000);
  };
}

// Handle messages from server
function handleServerMessage(message) {
  switch (message.type) {
    case 'welcome':
      gameState.localPlayerId = message.playerId;
      gameState.worldSize = message.worldSize;
      // Initialize smooth movement for local player
      smoothPlayers.set(message.playerId, {
        targetX: 0,
        targetY: 0,
        currentX: 0,
        currentY: 0,
        velocityX: 0,
        velocityY: 0
      });
      updateConnectionStatus(`Connected as Player ${message.playerId + 1} (${message.shape})`);
      break;

    case 'gameStarted':
      gameState.gameStarted = true;
      message.coins.forEach(coin => {
        gameState.coins.set(coin.id, { x: coin.x, y: coin.y, rotation: Math.random() * Math.PI * 2 });
      });
      updateConnectionStatus('Game Started!');
      break;

    case 'snapshot':
      handleSnapshot(message);
      break;

    case 'coinSpawned':
      gameState.coins.set(message.coin.id, { 
        x: message.coin.x, 
        y: message.coin.y, 
        rotation: Math.random() * Math.PI * 2 
      });
      // Spawn effect particles
      createCoinSpawnParticles(message.coin.x, message.coin.y);
      break;

    case 'coinCollected':
      const collectedCoin = gameState.coins.get(message.coinId);
      if (collectedCoin) {
        createCollectionParticles(collectedCoin.x, collectedCoin.y, message.playerId);
        createScorePopup(collectedCoin.x, collectedCoin.y, message.playerId);
      }
      gameState.coins.delete(message.coinId);
      const player = gameState.players.get(message.playerId);
      if (player) {
        player.score = message.newScore;
      }
      updateScores();
      break;

    case 'gameStopped':
      gameState.gameStarted = false;
      gameState.coins.clear();
      particles.length = 0;
      playerTrails.clear();
      updateConnectionStatus('Game stopped - waiting for players');
      break;

    case 'pickupRejected':
      console.log('Server rejected pickup:', message.message);
      break;

    case 'error':
      console.error('Server error:', message.message);
      updateConnectionStatus(`Error: ${message.message}`);
      break;
  }
}

// Handle server snapshot
function handleSnapshot(snapshot) {
  const now = Date.now();

  snapshot.players.forEach(serverPlayer => {
    if (serverPlayer.id === gameState.localPlayerId) {
      // Local player: smooth reconciliation
      if (!gameState.localPlayer) {
        gameState.localPlayer = { ...serverPlayer };
        if (!smoothPlayers.has(serverPlayer.id)) {
          smoothPlayers.set(serverPlayer.id, {
            targetX: serverPlayer.x,
            targetY: serverPlayer.y,
            currentX: serverPlayer.x,
            currentY: serverPlayer.y,
            velocityX: 0,
            velocityY: 0
          });
        }
      } else {
        // Smooth reconciliation - don't snap, interpolate
        const smooth = smoothPlayers.get(serverPlayer.id);
        if (smooth) {
          smooth.targetX = serverPlayer.x;
          smooth.targetY = serverPlayer.y;
        }
        gameState.localPlayer.score = serverPlayer.score;
      }
      gameState.players.set(serverPlayer.id, gameState.localPlayer);
    } else {
      if (!interpolationBuffers.has(serverPlayer.id)) {
        interpolationBuffers.set(serverPlayer.id, []);
      }

      const buffer = interpolationBuffers.get(serverPlayer.id);
      buffer.push({
        x: serverPlayer.x,
        y: serverPlayer.y,
        score: serverPlayer.score,
        timestamp: now
      });

      if (buffer.length > INTERPOLATION_BUFFER_SIZE) {
        buffer.shift();
      }

      if (!gameState.players.has(serverPlayer.id)) {
        gameState.players.set(serverPlayer.id, {
          x: serverPlayer.x,
          y: serverPlayer.y,
          score: serverPlayer.score,
          shape: serverPlayer.shape,
          interpolated: true
        });
        // Initialize smooth movement
        smoothPlayers.set(serverPlayer.id, {
          targetX: serverPlayer.x,
          targetY: serverPlayer.y,
          currentX: serverPlayer.x,
          currentY: serverPlayer.y,
          velocityX: 0,
          velocityY: 0
        });
      } else {
        const player = gameState.players.get(serverPlayer.id);
        player.score = serverPlayer.score;
        // Update smooth interpolation target
        if (!smoothPlayers.has(serverPlayer.id)) {
          smoothPlayers.set(serverPlayer.id, {
            targetX: serverPlayer.x,
            targetY: serverPlayer.y,
            currentX: serverPlayer.x,
            currentY: serverPlayer.y,
            velocityX: 0,
            velocityY: 0
          });
        } else {
          const smooth = smoothPlayers.get(serverPlayer.id);
          smooth.targetX = serverPlayer.x;
          smooth.targetY = serverPlayer.y;
        }
      }
    }
  });

  gameState.coins.clear();
  snapshot.coins.forEach(coin => {
    if (!gameState.coins.has(coin.id)) {
      gameState.coins.set(coin.id, { 
        x: coin.x, 
        y: coin.y, 
        rotation: Math.random() * Math.PI * 2 
      });
    }
  });
}

// Smooth interpolation with velocity-based movement
function interpolatePlayer(playerId) {
  const buffer = interpolationBuffers.get(playerId);
  if (!buffer || buffer.length < 2) return;

  const player = gameState.players.get(playerId);
  if (!player) return;

  const now = Date.now() - INTERPOLATION_DELAY;

  let older = null;
  let newer = null;

  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].timestamp <= now) {
      older = buffer[i];
      if (i < buffer.length - 1) {
        newer = buffer[i + 1];
      }
      break;
    }
  }

  if (!older) {
    const latest = buffer[buffer.length - 1];
    updateSmoothTarget(playerId, latest.x, latest.y);
    return;
  }

  if (!newer) {
    updateSmoothTarget(playerId, older.x, older.y);
    return;
  }

  const timeDiff = newer.timestamp - older.timestamp;
  if (timeDiff === 0) {
    updateSmoothTarget(playerId, older.x, older.y);
    return;
  }

  // Linear interpolation
  const t = (now - older.timestamp) / timeDiff;
  const interpolatedX = older.x + (newer.x - older.x) * t;
  const interpolatedY = older.y + (newer.y - older.y) * t;
  
  updateSmoothTarget(playerId, interpolatedX, interpolatedY);
}

// Update smooth target with velocity calculation
function updateSmoothTarget(playerId, targetX, targetY) {
  if (!smoothPlayers.has(playerId)) {
    smoothPlayers.set(playerId, {
      targetX: targetX,
      targetY: targetY,
      currentX: targetX,
      currentY: targetY,
      velocityX: 0,
      velocityY: 0
    });
  } else {
    const smooth = smoothPlayers.get(playerId);
    smooth.targetX = targetX;
    smooth.targetY = targetY;
  }
}

// Apply smooth movement with easing (called every frame)
function applySmoothMovement(deltaTime) {
  smoothPlayers.forEach((smooth, playerId) => {
    const player = gameState.players.get(playerId);
    if (!player) return;

    // Calculate velocity towards target
    const dx = smooth.targetX - smooth.currentX;
    const dy = smooth.targetY - smooth.currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0.1) {
      // Smooth acceleration/deceleration
      const maxSpeed = 200; // pixels per second
      const acceleration = 800; // pixels per second squared
      
      // Calculate desired velocity
      const desiredVx = (dx / distance) * maxSpeed;
      const desiredVy = (dy / distance) * maxSpeed;
      
      // Smooth velocity interpolation
      const smoothFactor = Math.min(1, acceleration * deltaTime / maxSpeed);
      smooth.velocityX += (desiredVx - smooth.velocityX) * smoothFactor;
      smooth.velocityY += (desiredVy - smooth.velocityY) * smoothFactor;
      
      // Apply velocity
      smooth.currentX += smooth.velocityX * deltaTime;
      smooth.currentY += smooth.velocityY * deltaTime;
      
      // Update player position
      player.x = smooth.currentX;
      player.y = smooth.currentY;
    } else {
      // Close enough, snap to target
      smooth.currentX = smooth.targetX;
      smooth.currentY = smooth.targetY;
      smooth.velocityX = 0;
      smooth.velocityY = 0;
      player.x = smooth.currentX;
      player.y = smooth.currentY;
    }
  });
}

// Particle system
function createCollectionParticles(x, y, playerId) {
  const colors = playerId === 0 
    ? ['#00ff88', '#00d4ff', '#88ffaa'] 
    : ['#ff00ff', '#ff88ff', '#ffaaff'];
  
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
}

function createCoinSpawnParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1.0,
      decay: 0.015,
      size: 2 + Math.random() * 3,
      color: '#FFD700'
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= p.decay;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// Player trails
function updateTrails() {
  gameState.players.forEach((player, playerId) => {
    if (!playerTrails.has(playerId)) {
      playerTrails.set(playerId, []);
    }
    
    const trail = playerTrails.get(playerId);
    trail.push({ x: player.x, y: player.y, life: 1.0 });
    
    // Limit trail length
    if (trail.length > 15) {
      trail.shift();
    }
    
    // Update trail life
    trail.forEach(point => {
      point.life -= 0.05;
    });
    
    // Remove dead trail points
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].life <= 0) {
        trail.splice(i, 1);
      }
    }
  });
}

function drawTrails() {
  playerTrails.forEach((trail, playerId) => {
    if (trail.length < 2) return;
    
    const player = gameState.players.get(playerId);
    if (!player) return;
    
    const isLocal = playerId === gameState.localPlayerId;
    const color = isLocal ? '#00ff88' : '#ff00ff';
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    trail.forEach((point, i) => {
      ctx.globalAlpha = point.life * 0.5;
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  });
}

// Score popups
function createScorePopup(x, y, playerId) {
  scorePopups.push({
    x: x,
    y: y,
    text: '+1',
    life: 1.0,
    vy: -2,
    color: playerId === 0 ? '#00ff88' : '#ff00ff'
  });
}

function updateScorePopups() {
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const popup = scorePopups[i];
    popup.y += popup.vy;
    popup.life -= 0.02;
    popup.vy *= 0.95;
    
    if (popup.life <= 0) {
      scorePopups.splice(i, 1);
    }
  }
}

function drawScorePopups() {
  scorePopups.forEach(popup => {
    ctx.save();
    ctx.globalAlpha = popup.life;
    ctx.fillStyle = popup.color;
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.restore();
  });
}

// Input handling
function setupInputHandlers() {
  document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = true;
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });
}

function getInputVelocity() {
  let vx = 0;
  let vy = 0;

  if (keys.w || keys.ArrowUp) vy -= 1;
  if (keys.s || keys.ArrowDown) vy += 1;
  if (keys.a || keys.ArrowLeft) vx -= 1;
  if (keys.d || keys.ArrowRight) vx += 1;

  if (vx !== 0 && vy !== 0) {
    vx *= 0.707;
    vy *= 0.707;
  }

  return { vx, vy };
}

function sendInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !gameState.gameStarted) {
    return;
  }

  const { vx, vy } = getInputVelocity();
  
  if (vx !== 0 || vy !== 0) {
    // Client-side prediction with smooth movement
    if (gameState.localPlayer) {
      const smooth = smoothPlayers.get(gameState.localPlayerId);
      if (smooth) {
        smooth.currentX = Math.max(0, Math.min(
          gameState.worldSize.width,
          smooth.currentX + vx * 3
        ));
        smooth.currentY = Math.max(0, Math.min(
          gameState.worldSize.height,
          smooth.currentY + vy * 3
        ));
        gameState.localPlayer.x = smooth.currentX;
        gameState.localPlayer.y = smooth.currentY;
      }
    }

    ws.send(JSON.stringify({
      type: 'input',
      vx: vx,
      vy: vy
    }));
  }
}

// Enhanced rendering with delta time
function render(deltaTime = 1/60) {
  // Clear with gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0a0a1a');
  gradient.addColorStop(0.5, '#1a0a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid background
  drawGrid();

  if (!gameState.gameStarted) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Orbitron';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00d4ff';
    ctx.fillText('Waiting for players...', canvas.width / 2, canvas.height / 2);
    ctx.restore();
    return;
  }

  // Update visual effects
  coinRotation += 0.05;
  backgroundOffset += 0.5;
  updateParticles();
  updateTrails();
  updateScorePopups();

  // Draw trails first (behind everything)
  drawTrails();

  // Interpolate remote players
  gameState.players.forEach((player, playerId) => {
    if (playerId !== gameState.localPlayerId && player.interpolated) {
      interpolatePlayer(playerId);
    }
  });
  
  // Apply smooth movement to all players
  applySmoothMovement(deltaTime);

  // Draw coins with animation
  drawCoins();

  // Draw players with enhanced visuals
  drawPlayers();

  // Draw particles
  drawParticles();

  // Draw score popups
  drawScorePopups();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
  ctx.lineWidth = 1;
  
  const gridSize = 50;
  const offset = backgroundOffset % gridSize;
  
  ctx.beginPath();
  for (let x = -offset; x < canvas.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = -offset; y < canvas.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

function drawCoins() {
  gameState.coins.forEach((coin, coinId) => {
    coin.rotation += 0.1;
    
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.rotate(coin.rotation);
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
    glowGradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    glowGradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
    glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#FFD700';
    
    // Main coin
    const coinGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, 18);
    coinGradient.addColorStop(0, '#FFD700');
    coinGradient.addColorStop(0.5, '#FFA500');
    coinGradient.addColorStop(1, '#FF8C00');
    
    ctx.fillStyle = coinGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(-5, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Pulsing effect
    const pulse = Math.sin(coin.rotation * 2) * 0.1 + 1;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });
}

function drawPlayers() {
  gameState.players.forEach((player, playerId) => {
    const isLocal = playerId === gameState.localPlayerId;
    
    ctx.save();
    
    // Player glow
    if (isLocal) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#00ff88';
    } else {
      ctx.shadowBlur = 20;
      ctx.shadowColor = player.shape === 'circle' ? '#0088ff' : '#ff0088';
    }
    
    // Player body with gradient
    if (player.shape === 'circle') {
      const gradient = ctx.createRadialGradient(
        player.x - 5, player.y - 5, 0,
        player.x, player.y, 25
      );
      if (isLocal) {
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(1, '#00aa55');
      } else {
        gradient.addColorStop(0, '#0088ff');
        gradient.addColorStop(1, '#0044aa');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 25, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(player.x - 8, player.y - 8, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const gradient = ctx.createLinearGradient(
        player.x - 25, player.y - 25,
        player.x + 25, player.y + 25
      );
      if (isLocal) {
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(1, '#00aa55');
      } else {
        gradient.addColorStop(0, '#ff0088');
        gradient.addColorStop(1, '#aa0044');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(player.x - 25, player.y - 25, 50, 50);
      
      // Inner highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(player.x - 15, player.y - 15, 20, 20);
    }
    
    // Player ID label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Orbitron';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#000';
    ctx.fillText(`P${playerId + 1}`, player.x, player.y - 35);
    
    ctx.restore();
  });
}

// Render loop
function startRenderLoop() {
  let lastTime = performance.now();
  
  function loop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    sendInput();
    render();
    requestAnimationFrame(loop);
  }
  
  requestAnimationFrame(loop);
}

// UI updates
function updateUI() {
  updateConnectionStatus();
  updateScores();
}

function updateConnectionStatus(message) {
  const statusEl = document.getElementById('connectionStatus');
  if (message) {
    statusEl.textContent = message;
  } else if (gameState.connected) {
    statusEl.textContent = gameState.gameStarted 
      ? '⚡ Game in progress ⚡' 
      : 'Connected - waiting for game to start';
  } else {
    statusEl.textContent = 'Connecting...';
  }
}

function updateScores() {
  const scores = Array.from(gameState.players.values());
  const score1 = scores[0] ? scores[0].score : 0;
  const score2 = scores[1] ? scores[1].score : 0;
  
  const score1El = document.getElementById('score1');
  const score2El = document.getElementById('score2');
  
  if (score1El.textContent !== score1.toString()) {
    score1El.style.transform = 'scale(1.3)';
    setTimeout(() => {
      score1El.style.transform = 'scale(1)';
    }, 200);
  }
  if (score2El.textContent !== score2.toString()) {
    score2El.style.transform = 'scale(1.3)';
    setTimeout(() => {
      score2El.style.transform = 'scale(1)';
    }, 200);
  }
  
  score1El.textContent = score1;
  score2El.textContent = score2;
}

// Initialize on load
window.addEventListener('load', init);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendFakePickup };
}

function sendFakePickup() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'fakePickup',
      coinId: 999
    }));
    console.log('Attempted fake pickup - server should reject');
  }
}
