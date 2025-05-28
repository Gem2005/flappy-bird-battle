const { io } = require('socket.io-client');

// Try multiple possible Railway URLs
const POSSIBLE_URLS = [
  'https://flappy-bird-battle-production.up.railway.app',
  'https://flappy-bird-battle-server-production.up.railway.app', 
  'https://socket-server-production.up.railway.app',
  'https://flappybirdbattle-production.up.railway.app',
  'wss://flappy-bird-battle-production.up.railway.app'
];

async function testConnection(url) {
  return new Promise((resolve) => {
    console.log(`🔌 Testing: ${url}`);
    
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: false
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      resolve({ url, success: false, error: 'Timeout' });
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.disconnect();
      resolve({ url, success: true, socketId: socket.id });
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      resolve({ url, success: false, error: error.message });
    });
  });
}

async function testAllUrls() {
  console.log('Testing multiple Railway URL patterns...\n');
  
  for (const url of POSSIBLE_URLS) {
    const result = await testConnection(url);
    if (result.success) {
      console.log(`✅ SUCCESS: ${result.url}`);
      console.log(`Socket ID: ${result.socketId}\n`);
      return result.url;
    } else {
      console.log(`❌ FAILED: ${result.url} - ${result.error}\n`);
    }
  }
  
  console.log('❌ No working Railway URLs found');
  return null;
}

testAllUrls().then(workingUrl => {
  if (workingUrl) {
    console.log(`\n🎉 Found working URL: ${workingUrl}`);
    console.log('Update your environment variables with this URL!');
  }
  process.exit(workingUrl ? 0 : 1);
});
