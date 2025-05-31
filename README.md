# 🎮 Flappy Bird Battle - Multiplayer Combat Edition

A real-time multiplayer battle game combining the classic Flappy Bird mechanics with combat abilities and strategic bird selection. Players compete head-to-head in intense aerial battles using unique bird abilities while navigating challenging pipe obstacles.

Live Link: https://flappy-bird-battle.vercel.app

## 🚀 Features

### Core Gameplay
- **Real-time Multiplayer**: Live battles between two players using WebSocket connections
- **Split-screen Combat**: Dual-sided battlefield with pipes coming from both directions
- **Health System**: Each bird has HP that depletes from abilities and pipe collisions
- **Dynamic Scoring**: Points awarded for successfully navigating pipes
- **Multiple Win Conditions**: Defeat opponent by depleting HP, pipe collision, or survival

### Bird Selection System
- **4 Unique Birds**: Each with distinct stats and abilities
- **Bird Stealing**: Steal opponent's bird selection before they lock it in
- **Strategic Locking**: Secure your bird choice to prevent theft
- **Stat-based Strategy**: Choose birds based on HP, Speed, and Attack preferences

### Combat System
- **Unique Abilities**: Each bird has 4 different abilities (Normal, Signature, Ultimate, Universal)
- **Cooldown Management**: Strategic timing with different cooldown periods
- **Visual Effects**: Rich particle effects and ability indicators
- **Status Effects**: Slow, freeze, invulnerability, nightmare (reversed controls)

### Advanced Features
- **Matchmaking Queue**: Automatic opponent finding with queue position tracking
- **Reconnection System**: 30-second grace period for disconnected players
- **Data Persistence**: Multiple backup systems for game state preservation
- **Responsive UI**: Optimized for different screen sizes

## 🐦 Bird Roster

### Phoenix
- **HP**: 80 | **Speed**: 90 | **Attack**: 100
- **Normal (Q)**: Ember Shot - 10 damage projectile
- **Signature (E)**: Flame Wave - 20 AoE damage
- **Ultimate (X)**: Rebirth - Heal 50 HP (once per match)

### Frostbeak
- **HP**: 90 | **Speed**: 70 | **Attack**: 75
- **Normal (Q)**: Ice Shard - 8 damage + slow effect
- **Signature (E)**: Blizzard - Creates obstacle for opponent
- **Ultimate (X)**: Freeze Time - Freezes opponent for 3 seconds

### Thunderwing
- **HP**: 70 | **Speed**: 100 | **Attack**: 80
- **Normal (Q)**: Shock Bolt - 12 damage lightning
- **Signature (E)**: Wind Gust - Pushes opponent toward obstacles
- **Ultimate (X)**: Lightning Strike - 30 damage, chains to obstacles

### Shadowfeather
- **HP**: 60 | **Speed**: 85 | **Attack**: 90
- **Normal (Q)**: Shadow Strike - 15 damage stealth attack
- **Signature (E)**: Vanish - 2 seconds invulnerability
- **Ultimate (X)**: Nightmare - Reverses controls + disables abilities

### Universal Ability
- **Heal (C)**: All birds can heal 15 HP (10-second cooldown)

## 🎯 Game Controls

### Movement
- **W/S**: Vertical movement (Up/Down)
- **A/D**: Horizontal movement (Left/Right)

### Abilities
- **Q**: Normal Ability (6-second cooldown)
- **E**: Signature Ability (10-second cooldown)
- **C**: Universal Heal (10-second cooldown)
- **X**: Ultimate Ability (15-second cooldown)

### System
- **ESC**: Return to menu (when game ends)

## 🌐 WebSocket Architecture

### Connection Management
```javascript
// Client-side connection with fallback handling
const socketUrl = process.env.NODE_ENV === 'production' 
  ? 'https://flappy-bird-battle-production.up.railway.app'
  : 'http://localhost:3001'

const socket = io(socketUrl, {
  transports: ['polling'], // Force polling for stability
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5
})
```

### Real-time Events

#### Matchmaking Flow
1. **findMatch** - Player joins matchmaking queue
2. **queueJoined** - Queue position confirmation
3. **matchFound** - Opponent found, room created
4. **selectBird** - Bird selection phase
5. **birdSelected** - Bird choice broadcast
6. **playerReady** - Ready status updates
7. **gameStart** - Game begins

#### Game Events
- **gameAction** - Movement, abilities, damage, healing
- **opponentMove** - Real-time position sync
- **abilityUsed** - Ability activation broadcast
- **healthUpdate** - HP synchronization
- **gameOver** - Match conclusion

#### Connection Events
- **opponentDisconnected** - Handle disconnections
- **reconnection** - 30-second grace period
- **error** - Error handling and validation

### Server-Side Architecture

#### Room Management
```javascript
const gameRooms = new Map() // Active game rooms
const waitingPlayers = []   // Matchmaking queue

// Room structure
{
  players: [player1, player2],
  gameState: {
    player1: { hp: 100, score: 0, bird: null, isReady: false },
    player2: { hp: 100, score: 0, bird: null, isReady: false },
    gameStarted: false,
    gameOver: false
  }
}
```

#### Event Handlers
- **Connection validation** with CORS and transport optimization
- **Matchmaking logic** with automatic pairing
- **Bird selection** with stealing mechanics
- **Game state synchronization** across clients
- **Cleanup routines** for stale rooms and disconnected players

## 🏗️ Technical Architecture

### Frontend Stack
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **Phaser 3** - Game engine for real-time gameplay
- **Socket.io Client** - WebSocket communication
- **Lucide Icons** - UI iconography

### Backend Infrastructure
- **Node.js** - Server runtime
- **Socket.io Server** - Real-time communication
- **Railway** - Production deployment
- **HTTP Server** - Health checks and CORS handling

### Key Components

#### Game Engine Integration
```typescript
// Phaser game configuration
const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 600,
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scene: GameScene
}
```

#### State Management
- **React State** for UI components
- **Phaser Scene** for game logic
- **Socket Events** for real-time sync
- **LocalStorage/SessionStorage** for persistence

#### Data Flow
1. **User Input** → Phaser Scene Handler
2. **Scene Handler** → Socket Event Emission
3. **Server Processing** → Game State Update
4. **State Broadcast** → Opponent Sync
5. **UI Updates** → Visual Feedback

## 🚀 Deployment

### Production Environment
- **Platform**: Railway
- **Domain**: https://flappy-bird-battle-production.up.railway.app
- **Transport**: Polling (optimized for Railway)
- **CORS**: Enabled for all origins
- **Health Monitoring**: `/health` endpoint

### Development Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start socket server
cd server && node socket-server.js
```

### Environment Configuration
```bash
# Production
NEXT_PUBLIC_SOCKET_URL=https://flappy-bird-battle-production.up.railway.app
NODE_ENV=production
PORT=3001

# Development  
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NODE_ENV=development
```

## 🔧 Game Systems

### Collision Detection
- **Pipe Collision**: Instant 100 damage (usually fatal)
- **Ability Range**: Line-of-sight checks with pipe blocking
- **Boundary Physics**: World bounds prevent out-of-screen movement

### Effect System
- **Visual Indicators**: Floating emojis and status icons
- **Status Effects**: Timed debuffs with cleanup
- **Animation**: Tween-based effect presentations

### Persistence Layer
- **Multi-source Backup**: Window, SessionStorage, LocalStorage
- **Socket Preservation**: Maintains connections across page transitions
- **Game State Recovery**: Automatic restoration after disconnects

## 🎨 UI/UX Features

### Responsive Design
- **Mobile-friendly**: Touch-optimized controls
- **Desktop-optimized**: Keyboard shortcuts
- **Cross-platform**: Consistent experience across devices

### Visual Feedback
- **Real-time Health Bars**: Live HP tracking
- **Cooldown Timers**: Visual ability status
- **Status Effects**: Clear effect indicators
- **Score Tracking**: Live score updates

### Navigation Flow
```
Landing Page → Name Entry → Matchmaking → Bird Selection → Game → Results
     ↑                                                              ↓
     ←——————————————————— Back to Menu ——————————————————————————→
```

## 🛡️ Error Handling

### Client-Side
- **Connection Failures**: Automatic reconnection with backoff
- **Game State Loss**: Multiple recovery mechanisms
- **Invalid Actions**: Graceful degradation
- **Network Issues**: Offline detection and handling

### Server-Side
- **Room Validation**: Existence and player membership checks
- **Action Validation**: Input sanitization and bounds checking
- **Memory Management**: Automatic cleanup of stale resources
- **Graceful Shutdown**: Proper connection termination

## 📊 Performance Optimizations

### Network
- **Polling Transport**: Optimized for Railway deployment
- **Event Batching**: Reduced message frequency
- **Selective Updates**: Only changed data transmission

### Game Engine
- **Object Pooling**: Reuse of game objects
- **Efficient Rendering**: Optimized draw calls
- **Memory Management**: Proper cleanup and disposal

### Data Management
- **State Normalization**: Efficient data structures
- **Selective Persistence**: Only critical data stored
- **Garbage Collection**: Proactive memory cleanup

## 🧪 Testing & Debugging

### Development Tools
- **Health Endpoint**: `/health` for server status
- **Console Logging**: Comprehensive debug output
- **Error Boundaries**: Graceful error handling
- **Development Flags**: Debug mode for testing

### Connection Testing
```javascript
// Test WebSocket connectivity
const testSocket = io('ws://localhost:3001', {
  transports: ['polling', 'websocket']
})
```

---

## 🎯 Future Enhancements

- **Tournament Mode**: Bracket-style competitions
- **Spectator Mode**: Watch ongoing battles
- **Custom Birds**: User-created bird abilities
- **Leaderboards**: Global ranking system
- **Replay System**: Match recording and playback

---

**Built with ❤️ using modern web technologies for an engaging multiplayer gaming experience.**