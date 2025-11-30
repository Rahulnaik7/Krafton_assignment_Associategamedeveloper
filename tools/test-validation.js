/**
 * Test Validation Script
 * 
 * Demonstrates server authority by attempting to fake a coin pickup.
 * The server should reject this attempt.
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8080';

console.log('=== Server Authority Validation Test ===\n');
console.log('This test demonstrates that the server rejects fake coin pickups.\n');

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('✓ Connected to server');
  console.log('Attempting to send fake coin pickup...\n');
  
  // Wait a moment for welcome message
  setTimeout(() => {
    // Attempt to fake a coin pickup
    ws.send(JSON.stringify({
      type: 'fakePickup',
      coinId: 999,
      playerId: 0
    }));
    
    console.log('Sent fake pickup message to server');
    console.log('Waiting for server response...\n');
  }, 500);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'welcome') {
    console.log(`✓ Received welcome message (Player ID: ${message.playerId})\n`);
  } else if (message.type === 'pickupRejected') {
    console.log('✓ SUCCESS: Server rejected the fake pickup!');
    console.log(`  Server message: "${message.message}"\n`);
    console.log('✓ Test passed: Server authority is working correctly.\n');
    ws.close();
    process.exit(0);
  } else if (message.type === 'error') {
    console.log(`Server error: ${message.message}\n`);
  } else {
    console.log(`Received: ${message.type}`);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  console.log('\nMake sure the server is running on port 8080');
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('\n✗ Test timeout: Server did not respond to fake pickup');
  console.log('  This might indicate the server is not properly validating pickups.\n');
  ws.close();
  process.exit(1);
}, 5000);

