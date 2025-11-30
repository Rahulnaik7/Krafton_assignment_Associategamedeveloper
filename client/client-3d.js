// /**
//  * Enhanced 3D Game Client with Smooth Movement
//  * 
//  * Uses Three.js for 3D rendering and improved interpolation for ultra-smooth movement.
//  * Implements velocity-based interpolation and easing for natural motion.
//  */

// // Three.js is loaded via script tag - using global THREE object

// const SERVER_URL = 'ws://localhost:8080';
// const INTERPOLATION_BUFFER_SIZE = 5; // Increased buffer for smoother interpolation
// const INTERPOLATION_DELAY = 150; // Slightly increased for better buffering

// // Game state
// let gameState = {
//   localPlayerId: null,
//   localPlayer: null,
//   players: new Map(),
//   coins: new Map(),
//   worldSize: { width: 800, height: 600 },
//   connected: false,
//   gameStarted: false
// };

// // Smooth movement state for interpolation
// const smoothPlayers = new Map(); // playerId -> { targetX, targetY, currentX, currentY, velocityX, velocityY }

// // Visual effects
// const particles = [];
// const scorePopups = [];

// // Interpolation buffers
// const interpolationBuffers = new Map();

// // Input state
// const keys = {
//   w: false, a: false, s: false, d: false,
//   ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
// };

// // Three.js setup
// let scene, camera, renderer;
// let playerMeshes = new Map();
// let coinMeshes = new Map();
// let particleSystem;
// let clock = new THREE.Clock();

// // WebSocket connection
// let ws = null;

// // Initialize
// function init() {
//   setupThreeJS();
//   connectToServer();
//   setupInputHandlers();
//   animate();
//   updateUI();
// }

// // Setup Three.js scene
// function setupThreeJS() {
//   // Scene
//   scene = new THREE.Scene();
//   scene.background = new THREE.Color(0x0a0a1a);
//   scene.fog = new THREE.Fog(0x0a0a1a, 100, 1000);

//   // Camera
//   camera = new THREE.PerspectiveCamera(
//     75,
//     window.innerWidth / window.innerHeight,
//     0.1,
//     2000
//   );
//   camera.position.set(400, 300, 500);
//   camera.lookAt(400, 300, 0);

//   // Renderer
//   renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('gameCanvas') });
//   renderer.setSize(800, 600);
//   renderer.shadowMap.enabled = true;
//   renderer.shadowMap.type = THREE.PCFSoftShadowMap;

//   // Lighting
//   const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
//   scene.add(ambientLight);

//   const directionalLight = new THREE.DirectionalLight(0x00d4ff, 1);
//   directionalLight.position.set(400, 500, 300);
//   directionalLight.castShadow = true;
//   directionalLight.shadow.mapSize.width = 2048;
//   directionalLight.shadow.mapSize.height = 2048;
//   scene.add(directionalLight);

//   const pointLight1 = new THREE.PointLight(0xff00ff, 0.5, 1000);
//   pointLight1.position.set(200, 200, 200);
//   scene.add(pointLight1);

//   const pointLight2 = new THREE.PointLight(0x00ff88, 0.5, 1000);
//   pointLight2.position.set(600, 200, 200);
//   scene.add(pointLight2);

//   // Ground plane
//   const groundGeometry = new THREE.PlaneGeometry(800, 600);
//   const groundMaterial = new THREE.MeshStandardMaterial({
//     color: 0x1a1a2e,
//     roughness: 0.8,
//     metalness: 0.2
//   });
//   const ground = new THREE.Mesh(groundGeometry, groundMaterial);
//   ground.rotation.x = -Math.PI / 2;
//   ground.position.y = 0;
//   ground.receiveShadow = true;
//   scene.add(ground);

//   // Grid helper
//   const gridHelper = new THREE.GridHelper(800, 40, 0x00d4ff, 0x00d4ff);
//   gridHelper.material.opacity = 0.2;
//   gridHelper.material.transparent = true;
//   scene.add(gridHelper);

//   // Particle system
//   const particleGeometry = new THREE.BufferGeometry();
//   const particleCount = 1000;
//   const positions = new Float32Array(particleCount * 3);
  
//   for (let i = 0; i < particleCount * 3; i++) {
//     positions[i] = (Math.random() - 0.5) * 2000;
//   }
  
//   particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
//   const particleMaterial = new THREE.PointsMaterial({
//     color: 0x00d4ff,
//     size: 2,
//     transparent: true,
//     opacity: 0.6
//   });
//   particleSystem = new THREE.Points(particleGeometry, particleMaterial);
//   scene.add(particleSystem);

//   // Handle window resize
//   window.addEventListener('resize', () => {
//     camera.aspect = 800 / 600;
//     camera.updateProjectionMatrix();
//     renderer.setSize(800, 600);
//   });
// }

// // Connect to WebSocket server
// function connectToServer() {
//   ws = new WebSocket(SERVER_URL);

//   ws.onopen = () => {
//     console.log('Connected to server');
//     gameState.connected = true;
//     updateUI();
//   };

//   ws.onmessage = (event) => {
//     const message = JSON.parse(event.data);
//     handleServerMessage(message);
//   };

//   ws.onerror = (error) => {
//     console.error('WebSocket error:', error);
//     updateConnectionStatus('Connection error');
//   };

//   ws.onclose = () => {
//     console.log('Disconnected from server');
//     gameState.connected = false;
//     updateUI();
//     setTimeout(connectToServer, 2000);
//   };
// }

// // Handle messages from server
// function handleServerMessage(message) {
//   switch (message.type) {
//     case 'welcome':
//       gameState.localPlayerId = message.playerId;
//       gameState.worldSize = message.worldSize;
//       updateConnectionStatus(`Connected as Player ${message.playerId + 1} (${message.shape})`);
//       break;

//     case 'gameStarted':
//       gameState.gameStarted = true;
//       message.coins.forEach(coin => {
//         createCoinMesh(coin.id, coin.x, coin.y);
//       });
//       updateConnectionStatus('Game Started!');
//       break;

//     case 'snapshot':
//       handleSnapshot(message);
//       break;

//     case 'coinSpawned':
//       createCoinMesh(message.coin.id, message.coin.x, message.coin.y);
//       createCoinSpawnParticles(message.coin.x, message.coin.y);
//       break;

//     case 'coinCollected':
//       const collectedCoin = coinMeshes.get(message.coinId);
//       if (collectedCoin) {
//         createCollectionParticles(collectedCoin.position.x, collectedCoin.position.z, message.playerId);
//         createScorePopup(collectedCoin.position.x, collectedCoin.position.z, message.playerId);
//         scene.remove(collectedCoin);
//         coinMeshes.delete(message.coinId);
//       }
//       gameState.coins.delete(message.coinId);
//       const player = gameState.players.get(message.playerId);
//       if (player) {
//         player.score = message.newScore;
//       }
//       updateScores();
//       break;

//     case 'gameStopped':
//       gameState.gameStarted = false;
//       gameState.coins.clear();
//       coinMeshes.forEach(coin => scene.remove(coin));
//       coinMeshes.clear();
//       particles.length = 0;
//       updateConnectionStatus('Game stopped - waiting for players');
//       break;

//     case 'pickupRejected':
//       console.log('Server rejected pickup:', message.message);
//       break;

//     case 'error':
//       console.error('Server error:', message.message);
//       updateConnectionStatus(`Error: ${message.message}`);
//       break;
//   }
// }

// // Handle server snapshot with smooth interpolation
// function handleSnapshot(snapshot) {
//   const now = Date.now();

//   snapshot.players.forEach(serverPlayer => {
//     if (serverPlayer.id === gameState.localPlayerId) {
//       // Local player: smooth reconciliation
//       if (!gameState.localPlayer) {
//         gameState.localPlayer = { ...serverPlayer };
//         if (!smoothPlayers.has(serverPlayer.id)) {
//           smoothPlayers.set(serverPlayer.id, {
//             targetX: serverPlayer.x,
//             targetY: serverPlayer.y,
//             currentX: serverPlayer.x,
//             currentY: serverPlayer.y,
//             velocityX: 0,
//             velocityY: 0
//           });
//         }
//       } else {
//         // Smooth reconciliation - don't snap, interpolate
//         const smooth = smoothPlayers.get(serverPlayer.id);
//         if (smooth) {
//           smooth.targetX = serverPlayer.x;
//           smooth.targetY = serverPlayer.y;
//         }
//         gameState.localPlayer.score = serverPlayer.score;
//       }
//       gameState.players.set(serverPlayer.id, gameState.localPlayer);
//     } else {
//       // Remote player: add to interpolation buffer
//       if (!interpolationBuffers.has(serverPlayer.id)) {
//         interpolationBuffers.set(serverPlayer.id, []);
//       }

//       const buffer = interpolationBuffers.get(serverPlayer.id);
//       buffer.push({
//         x: serverPlayer.x,
//         y: serverPlayer.y,
//         score: serverPlayer.score,
//         timestamp: now
//       });

//       if (buffer.length > INTERPOLATION_BUFFER_SIZE) {
//         buffer.shift();
//       }

//       if (!gameState.players.has(serverPlayer.id)) {
//         gameState.players.set(serverPlayer.id, {
//           x: serverPlayer.x,
//           y: serverPlayer.y,
//           score: serverPlayer.score,
//           shape: serverPlayer.shape,
//           interpolated: true
//         });
//         createPlayerMesh(serverPlayer.id, serverPlayer.shape);
//       } else {
//         const player = gameState.players.get(serverPlayer.id);
//         player.score = serverPlayer.score;
        
//         // Update smooth interpolation target
//         if (!smoothPlayers.has(serverPlayer.id)) {
//           smoothPlayers.set(serverPlayer.id, {
//             targetX: serverPlayer.x,
//             targetY: serverPlayer.y,
//             currentX: serverPlayer.x,
//             currentY: serverPlayer.y,
//             velocityX: 0,
//             velocityY: 0
//           });
//         } else {
//           const smooth = smoothPlayers.get(serverPlayer.id);
//           smooth.targetX = serverPlayer.x;
//           smooth.targetY = serverPlayer.y;
//         }
//       }
//     }
//   });

//   // Update coins
//   snapshot.coins.forEach(coin => {
//     if (!coinMeshes.has(coin.id)) {
//       createCoinMesh(coin.id, coin.x, coin.y);
//     }
//   });
// }

// // Smooth interpolation with velocity-based movement
// function smoothInterpolatePlayer(playerId) {
//   const buffer = interpolationBuffers.get(playerId);
//   if (!buffer || buffer.length < 2) return;

//   const player = gameState.players.get(playerId);
//   if (!player) return;

//   const now = Date.now() - INTERPOLATION_DELAY;
//   let older = null;
//   let newer = null;

//   for (let i = buffer.length - 1; i >= 0; i--) {
//     if (buffer[i].timestamp <= now) {
//       older = buffer[i];
//       if (i < buffer.length - 1) {
//         newer = buffer[i + 1];
//       }
//       break;
//     }
//   }

//   if (!older) {
//     const latest = buffer[buffer.length - 1];
//     updateSmoothTarget(playerId, latest.x, latest.y);
//     return;
//   }

//   if (!newer) {
//     updateSmoothTarget(playerId, older.x, older.y);
//     return;
//   }

//   const timeDiff = newer.timestamp - older.timestamp;
//   if (timeDiff === 0) {
//     updateSmoothTarget(playerId, older.x, older.y);
//     return;
//   }

//   // Linear interpolation
//   const t = (now - older.timestamp) / timeDiff;
//   const interpolatedX = older.x + (newer.x - older.x) * t;
//   const interpolatedY = older.y + (newer.y - older.y) * t;
  
//   updateSmoothTarget(playerId, interpolatedX, interpolatedY);
// }

// // Update smooth target with velocity calculation
// function updateSmoothTarget(playerId, targetX, targetY) {
//   if (!smoothPlayers.has(playerId)) {
//     smoothPlayers.set(playerId, {
//       targetX: targetX,
//       targetY: targetY,
//       currentX: targetX,
//       currentY: targetY,
//       velocityX: 0,
//       velocityY: 0
//     });
//   } else {
//     const smooth = smoothPlayers.get(playerId);
//     smooth.targetX = targetX;
//     smooth.targetY = targetY;
//   }
// }

// // Apply smooth movement with easing
// function applySmoothMovement(deltaTime) {
//   smoothPlayers.forEach((smooth, playerId) => {
//     const player = gameState.players.get(playerId);
//     if (!player) return;

//     // Calculate velocity towards target
//     const dx = smooth.targetX - smooth.currentX;
//     const dy = smooth.targetY - smooth.currentY;
//     const distance = Math.sqrt(dx * dx + dy * dy);

//     if (distance > 0.1) {
//       // Smooth acceleration/deceleration
//       const maxSpeed = 200; // pixels per second
//       const acceleration = 800; // pixels per second squared
      
//       // Calculate desired velocity
//       const desiredVx = (dx / distance) * maxSpeed;
//       const desiredVy = (dy / distance) * maxSpeed;
      
//       // Smooth velocity interpolation
//       const smoothFactor = Math.min(1, acceleration * deltaTime / maxSpeed);
//       smooth.velocityX += (desiredVx - smooth.velocityX) * smoothFactor;
//       smooth.velocityY += (desiredVy - smooth.velocityY) * smoothFactor;
      
//       // Apply velocity
//       smooth.currentX += smooth.velocityX * deltaTime;
//       smooth.currentY += smooth.velocityY * deltaTime;
      
//       // Update player position
//       player.x = smooth.currentX;
//       player.y = smooth.currentY;
//     } else {
//       // Close enough, snap to target
//       smooth.currentX = smooth.targetX;
//       smooth.currentY = smooth.targetY;
//       smooth.velocityX = 0;
//       smooth.velocityY = 0;
//       player.x = smooth.currentX;
//       player.y = smooth.currentY;
//     }
//   });
// }

// // Create 3D player mesh
// function createPlayerMesh(playerId, shape) {
//   let geometry, material;
//   const isLocal = playerId === gameState.localPlayerId;
  
//   if (shape === 'circle') {
//     geometry = new THREE.CylinderGeometry(15, 15, 30, 32);
//     material = new THREE.MeshStandardMaterial({
//       color: isLocal ? 0x00ff88 : 0x0088ff,
//       emissive: isLocal ? 0x00aa55 : 0x0044aa,
//       emissiveIntensity: 0.5,
//       metalness: 0.8,
//       roughness: 0.2
//     });
//   } else {
//     geometry = new THREE.BoxGeometry(30, 30, 30);
//     material = new THREE.MeshStandardMaterial({
//       color: isLocal ? 0x00ff88 : 0xff0088,
//       emissive: isLocal ? 0x00aa55 : 0xaa0044,
//       emissiveIntensity: 0.5,
//       metalness: 0.8,
//       roughness: 0.2
//     });
//   }
  
//   const mesh = new THREE.Mesh(geometry, material);
//   mesh.castShadow = true;
//   mesh.receiveShadow = true;
//   mesh.position.set(0, 15, 0);
  
//   // Add glow effect
//   const glowGeometry = shape === 'circle' 
//     ? new THREE.CylinderGeometry(18, 18, 32, 32)
//     : new THREE.BoxGeometry(33, 33, 33);
//   const glowMaterial = new THREE.MeshBasicMaterial({
//     color: isLocal ? 0x00ff88 : (shape === 'circle' ? 0x0088ff : 0xff0088),
//     transparent: true,
//     opacity: 0.3
//   });
//   const glow = new THREE.Mesh(glowGeometry, glowMaterial);
//   mesh.add(glow);
  
//   // Player label
//   const canvas = document.createElement('canvas');
//   const context = canvas.getContext('2d');
//   canvas.width = 128;
//   canvas.height = 64;
//   context.fillStyle = '#ffffff';
//   context.font = 'bold 48px Arial';
//   context.textAlign = 'center';
//   context.fillText(`P${playerId + 1}`, 64, 48);
  
//   const texture = new THREE.CanvasTexture(canvas);
//   const labelMaterial = new THREE.SpriteMaterial({ map: texture });
//   const label = new THREE.Sprite(labelMaterial);
//   label.position.set(0, 25, 0);
//   label.scale.set(50, 25, 1);
//   mesh.add(label);
  
//   playerMeshes.set(playerId, mesh);
//   scene.add(mesh);
// }

// // Create 3D coin mesh
// function createCoinMesh(coinId, x, y) {
//   const geometry = new THREE.CylinderGeometry(12, 12, 4, 32);
//   const material = new THREE.MeshStandardMaterial({
//     color: 0xFFD700,
//     emissive: 0xFFA500,
//     emissiveIntensity: 0.5,
//     metalness: 1.0,
//     roughness: 0.1
//   });
  
//   const mesh = new THREE.Mesh(geometry, material);
//   mesh.castShadow = true;
//   mesh.receiveShadow = true;
//   mesh.position.set(x, 2, y);
//   mesh.rotation.x = Math.PI / 2;
  
//   // Add glow
//   const glowGeometry = new THREE.CylinderGeometry(14, 14, 5, 32);
//   const glowMaterial = new THREE.MeshBasicMaterial({
//     color: 0xFFD700,
//     transparent: true,
//     opacity: 0.3
//   });
//   const glow = new THREE.Mesh(glowGeometry, glowMaterial);
//   glow.rotation.x = Math.PI / 2;
//   mesh.add(glow);
  
//   coinMeshes.set(coinId, mesh);
//   scene.add(mesh);
  
//   gameState.coins.set(coinId, { x, y, rotation: Math.random() * Math.PI * 2 });
// }

// // Particle effects
// function createCollectionParticles(x, y, playerId) {
//   const colors = playerId === 0 
//     ? [0x00ff88, 0x00d4ff, 0x88ffaa] 
//     : [0xff00ff, 0xff88ff, 0xffaaff];
  
//   for (let i = 0; i < 20; i++) {
//     const geometry = new THREE.SphereGeometry(2, 8, 8);
//     const material = new THREE.MeshBasicMaterial({
//       color: colors[Math.floor(Math.random() * colors.length)],
//       transparent: true,
//       opacity: 1
//     });
//     const particle = new THREE.Mesh(geometry, material);
//     particle.position.set(x, 5, y);
    
//     const velocity = new THREE.Vector3(
//       (Math.random() - 0.5) * 10,
//       Math.random() * 5 + 2,
//       (Math.random() - 0.5) * 10
//     );
    
//     particles.push({
//       mesh: particle,
//       velocity: velocity,
//       life: 1.0,
//       decay: 0.02
//     });
    
//     scene.add(particle);
//   }
// }

// function createCoinSpawnParticles(x, y) {
//   for (let i = 0; i < 15; i++) {
//     const geometry = new THREE.SphereGeometry(1.5, 8, 8);
//     const material = new THREE.MeshBasicMaterial({
//       color: 0xFFD700,
//       transparent: true,
//       opacity: 1
//     });
//     const particle = new THREE.Mesh(geometry, material);
//     particle.position.set(x, 2, y);
    
//     const velocity = new THREE.Vector3(
//       (Math.random() - 0.5) * 5,
//       Math.random() * 3,
//       (Math.random() - 0.5) * 5
//     );
    
//     particles.push({
//       mesh: particle,
//       velocity: velocity,
//       life: 1.0,
//       decay: 0.015
//     });
    
//     scene.add(particle);
//   }
// }

// function updateParticles(deltaTime) {
//   for (let i = particles.length - 1; i >= 0; i--) {
//     const p = particles[i];
//     p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));
//     p.velocity.y -= 20 * deltaTime; // Gravity
//     p.life -= p.decay;
//     p.mesh.material.opacity = p.life;
    
//     if (p.life <= 0) {
//       scene.remove(p.mesh);
//       particles.splice(i, 1);
//     }
//   }
// }

// // Score popups
// function createScorePopup(x, y, playerId) {
//   const canvas = document.createElement('canvas');
//   const context = canvas.getContext('2d');
//   canvas.width = 128;
//   canvas.height = 64;
//   context.fillStyle = playerId === 0 ? '#00ff88' : '#ff00ff';
//   context.font = 'bold 48px Arial';
//   context.textAlign = 'center';
//   context.fillText('+1', 64, 48);
  
//   const texture = new THREE.CanvasTexture(canvas);
//   const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
//   const sprite = new THREE.Sprite(material);
//   sprite.position.set(x, 10, y);
//   sprite.scale.set(50, 25, 1);
  
//   scorePopups.push({
//     sprite: sprite,
//     life: 1.0,
//     velocityY: 5
//   });
  
//   scene.add(sprite);
// }

// function updateScorePopups(deltaTime) {
//   for (let i = scorePopups.length - 1; i >= 0; i--) {
//     const popup = scorePopups[i];
//     popup.sprite.position.y += popup.velocityY;
//     popup.velocityY *= 0.95;
//     popup.life -= 0.02;
//     popup.sprite.material.opacity = popup.life;
    
//     if (popup.life <= 0) {
//       scene.remove(popup.sprite);
//       scorePopups.splice(i, 1);
//     }
//   }
// }

// // Input handling
// function setupInputHandlers() {
//   document.addEventListener('keydown', (e) => {
//     if (keys.hasOwnProperty(e.key)) {
//       keys[e.key] = true;
//       e.preventDefault();
//     }
//   });

//   document.addEventListener('keyup', (e) => {
//     if (keys.hasOwnProperty(e.key)) {
//       keys[e.key] = false;
//       e.preventDefault();
//     }
//   });
// }

// function getInputVelocity() {
//   let vx = 0;
//   let vy = 0;

//   if (keys.w || keys.ArrowUp) vy -= 1;
//   if (keys.s || keys.ArrowDown) vy += 1;
//   if (keys.a || keys.ArrowLeft) vx -= 1;
//   if (keys.d || keys.ArrowRight) vx += 1;

//   if (vx !== 0 && vy !== 0) {
//     vx *= 0.707;
//     vy *= 0.707;
//   }

//   return { vx, vy };
// }

// function sendInput() {
//   if (!ws || ws.readyState !== WebSocket.OPEN || !gameState.gameStarted) {
//     return;
//   }

//   const { vx, vy } = getInputVelocity();
  
//   if (vx !== 0 || vy !== 0) {
//     // Client-side prediction with smooth movement
//     if (gameState.localPlayer) {
//       const smooth = smoothPlayers.get(gameState.localPlayerId);
//       if (smooth) {
//         smooth.currentX = Math.max(0, Math.min(
//           gameState.worldSize.width,
//           smooth.currentX + vx * 3
//         ));
//         smooth.currentY = Math.max(0, Math.min(
//           gameState.worldSize.height,
//           smooth.currentY + vy * 3
//         ));
//         gameState.localPlayer.x = smooth.currentX;
//         gameState.localPlayer.y = smooth.currentY;
//       }
//     }

//     ws.send(JSON.stringify({
//       type: 'input',
//       vx: vx,
//       vy: vy
//     }));
//   }
// }

// // Animation loop
// function animate() {
//   requestAnimationFrame(animate);
  
//   const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time
  
//   // Update smooth movement
//   if (gameState.gameStarted) {
//     // Interpolate remote players
//     gameState.players.forEach((player, playerId) => {
//       if (playerId !== gameState.localPlayerId && player.interpolated) {
//         smoothInterpolatePlayer(playerId);
//       }
//     });
    
//     // Apply smooth movement
//     applySmoothMovement(deltaTime);
    
//     // Update player meshes
//     playerMeshes.forEach((mesh, playerId) => {
//       const player = gameState.players.get(playerId);
//       if (player) {
//         mesh.position.x = player.x;
//         mesh.position.z = player.y;
//         mesh.rotation.y += deltaTime * 2; // Rotate players
//       }
//     });
    
//     // Update coin meshes
//     coinMeshes.forEach((mesh, coinId) => {
//       const coin = gameState.coins.get(coinId);
//       if (coin) {
//         coin.rotation += deltaTime * 3;
//         mesh.rotation.z = coin.rotation;
//         mesh.position.y = 2 + Math.sin(coin.rotation * 2) * 2; // Bobbing animation
//       }
//     });
    
//     // Update particles
//     updateParticles(deltaTime);
//     updateScorePopups(deltaTime);
//   }
  
//   // Rotate particle system
//   particleSystem.rotation.y += deltaTime * 0.1;
  
//   // Send input
//   sendInput();
  
//   // Render
//   renderer.render(scene, camera);
// }

// // UI updates
// function updateUI() {
//   updateConnectionStatus();
//   updateScores();
// }

// function updateConnectionStatus(message) {
//   const statusEl = document.getElementById('connectionStatus');
//   if (message) {
//     statusEl.textContent = message;
//   } else if (gameState.connected) {
//     statusEl.textContent = gameState.gameStarted 
//       ? '⚡ Game in progress ⚡' 
//       : 'Connected - waiting for game to start';
//   } else {
//     statusEl.textContent = 'Connecting...';
//   }
// }

// function updateScores() {
//   const scores = Array.from(gameState.players.values());
//   const score1 = scores[0] ? scores[0].score : 0;
//   const score2 = scores[1] ? scores[1].score : 0;
  
//   const score1El = document.getElementById('score1');
//   const score2El = document.getElementById('score2');
  
//   if (score1El.textContent !== score1.toString()) {
//     score1El.style.transform = 'scale(1.3)';
//     setTimeout(() => {
//       score1El.style.transform = 'scale(1)';
//     }, 200);
//   }
//   if (score2El.textContent !== score2.toString()) {
//     score2El.style.transform = 'scale(1.3)';
//     setTimeout(() => {
//       score2El.style.transform = 'scale(1)';
//     }, 200);
//   }
  
//   score1El.textContent = score1;
//   score2El.textContent = score2;
// }

// // Initialize on load
// window.addEventListener('load', init);

// // Export for testing
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = { sendFakePickup };
// }

// function sendFakePickup() {
//   if (ws && ws.readyState === WebSocket.OPEN) {
//     ws.send(JSON.stringify({
//       type: 'fakePickup',
//       coinId: 999
//     }));
//     console.log('Attempted fake pickup - server should reject');
//   }
// }

