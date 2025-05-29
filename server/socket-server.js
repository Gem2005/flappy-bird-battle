const { createServer } = require('http')
const { Server } = require('socket.io')

// FIXED: Declare variables BEFORE using them in the HTTP server
const gameRooms = new Map()
const waitingPlayers = []

// Create HTTP server with better error handling for Railway
const httpServer = createServer((req, res) => {
  // Enhanced headers for Railway deployment
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Enhanced health endpoint with more debugging info
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/health')) {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    })
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      rooms: gameRooms.size,
      waitingPlayers: waitingPlayers.length,
      port: process.env.PORT || 3001,
      env: process.env.NODE_ENV || 'production',
      server: 'socket.io',
      transports: ['polling', 'websocket'],
      cors: 'enabled'
    }))
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: 'Socket.io server running',
      status: 'ok',
      socketPath: '/socket.io/',
      availableEndpoints: ['/health', '/socket.io/']
    }))
  }
})

// Initialize Socket.io server with Railway-optimized config
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for Railway
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  // CRITICAL: Force polling first, then allow websocket upgrade
  transports: ['polling'], // Start with polling only
  allowEIO3: true,
  path: '/socket.io/',
  serveClient: false,
  pingTimeout: 60000,
  pingInterval: 25000,
  // Additional Railway-specific settings
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true, // Allow upgrade to websocket after polling works
})

// Enable transport debugging
io.engine.on("connection_error", (err) => {
  console.log('❌ Connection error:', err.req)
  console.log('❌ Error code:', err.code)
  console.log('❌ Error message:', err.message)
  console.log('❌ Error context:', err.context)
})

io.on("connection", (socket) => {
  console.log(`✅ Player connected: ${socket.id} via ${socket.conn.transport.name}`)
  
  // Log transport upgrades
  socket.conn.on("upgrade", () => {
    console.log(`⬆️ Upgraded to ${socket.conn.transport.name}`)
  })

  socket.conn.on("upgradeError", (err) => {
    console.log(`❌ Upgrade error: ${err}`)
  })

  // FIXED: Variables are now accessible here
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/health')) {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    })
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      rooms: gameRooms.size,
      waitingPlayers: waitingPlayers.length,
      port: process.env.PORT || 3001,
      env: process.env.NODE_ENV || 'production'
    }))
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: 'Socket.io server running',
      status: 'ok',
      socketPath: '/socket.io/'
    }))
  }

  socket.on("findMatch", (playerData) => {
    console.log("Player looking for match:", playerData)

    if (!playerData?.name || typeof playerData.name !== 'string') {
      socket.emit("error", { message: "Invalid player data" })
      return
    }

    const existingPlayer = waitingPlayers.find(p => p.id === socket.id)
    if (existingPlayer) {
      socket.emit("error", { message: "Already in matchmaking queue" })
      return
    }

    waitingPlayers.push({
      id: socket.id,
      name: playerData.name.trim(),
      socket: socket,
    })

    socket.emit("queueJoined", { position: waitingPlayers.length })

    if (waitingPlayers.length >= 2) {
      const player1 = waitingPlayers.shift()
      const player2 = waitingPlayers.shift()

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      // Enhanced game state to track ready status
      gameRooms.set(roomId, {
        players: [player1, player2],
        gameState: {
          player1: { 
            hp: 100, 
            score: 0, 
            bird: null, 
            isReady: false,
            name: player1.name // ADDED: Store player name in game state
          },
          player2: { 
            hp: 100, 
            score: 0, 
            bird: null, 
            isReady: false,
            name: player2.name // ADDED: Store player name in game state
          },
          pipes: [],
          gameStarted: false,
          gameOver: false,
        },
      })

      player1.socket.join(roomId)
      player2.socket.join(roomId)

      // FIXED: Send correct names to each player
      player1.socket.emit("matchFound", {
        roomId,
        opponent: player2.name, // Player 1 sees Player 2's name as opponent
        playerNumber: 1,
        myName: player1.name // Player 1 sees their own name
      })

      player2.socket.emit("matchFound", {
        roomId,
        opponent: player1.name, // Player 2 sees Player 1's name as opponent
        playerNumber: 2,
        myName: player2.name // Player 2 sees their own name
      })

      console.log(`Match created: ${roomId} with ${player1.name} (Player 1) vs ${player2.name} (Player 2)`)
    }
  })

  // UPDATED: Bird selection with stealing mechanism
  socket.on("selectBird", (data) => {
    if (!data?.roomId || !data?.birdId) {
      socket.emit("error", { message: "Invalid bird selection data" })
      return
    }

    const { roomId, birdId, playerNumber, isLocked, timestamp } = data
    const room = gameRooms.get(roomId)

    if (!room) {
      socket.emit("error", { message: "Room not found" })
      return
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id)
    if (playerIndex === -1) {
      socket.emit("error", { message: "Player not in room" })
      return
    }

    const playerKey = playerIndex === 0 ? "player1" : "player2"
    const opponentKey = playerIndex === 0 ? "player2" : "player1"
    
    // Check if opponent has this bird locked
    if (room.gameState[opponentKey].bird === birdId && room.gameState[opponentKey].isReady) {
      socket.emit("error", { message: "Bird is locked by opponent" })
      return
    }

    // Check if we're stealing from opponent
    let stolenFrom = null
    if (room.gameState[opponentKey].bird === birdId && !room.gameState[opponentKey].isReady) {
      stolenFrom = playerIndex === 0 ? 2 : 1
      console.log(`Player ${playerIndex + 1} stole bird ${birdId} from Player ${stolenFrom}`)
      
      // Clear opponent's bird
      room.gameState[opponentKey].bird = null
      
      // Notify about theft
      io.to(roomId).emit("birdStolen", {
        birdId,
        fromPlayer: stolenFrom,
        toPlayer: playerIndex + 1,
        timestamp
      })
    }

    // Clear any previous bird selection by this player
    if (room.gameState[playerKey].bird && room.gameState[playerKey].bird !== birdId) {
      console.log(`Player ${playerIndex + 1} changed from ${room.gameState[playerKey].bird} to ${birdId}`)
    }

    // Set new bird selection
    room.gameState[playerKey].bird = birdId
    room.gameState[playerKey].isReady = isLocked

    // Notify all players about bird selection
    io.to(roomId).emit("birdSelected", {
      playerNumber: playerIndex + 1,
      birdId,
      isLocked,
      timestamp
    })

    console.log(`Player ${playerIndex + 1} (${room.gameState[playerKey].name}) ${isLocked ? 'locked' : 'selected'} bird: ${birdId}`)

    // Check if both players are ready (locked their birds)
    if (room.gameState.player1.bird && room.gameState.player2.bird && 
        room.gameState.player1.isReady && room.gameState.player2.isReady && 
        !room.gameState.gameStarted) {
      
      console.log(`Starting game in room ${roomId} - both players ready and locked!`)
      
      room.gameState.gameStarted = true
      
      io.to(roomId).emit("gameStart", {
        player1Bird: room.gameState.player1.bird,
        player2Bird: room.gameState.player2.bird,
        player1Name: room.gameState.player1.name,
        player2Name: room.gameState.player2.name,
        ready: true
      })

      console.log(`🚀 Game started: ${roomId} with ${room.gameState.player1.name} (${room.gameState.player1.bird}) vs ${room.gameState.player2.name} (${room.gameState.player2.bird})`)
    }
  })

  // Handle player ready status
  socket.on("playerReady", (data) => {
    if (!data?.roomId || !data?.birdId) {
      socket.emit("error", { message: "Invalid ready data" })
      return
    }

    const { roomId, birdId, playerNumber, isReady } = data
    const room = gameRooms.get(roomId)

    if (!room) {
      socket.emit("error", { message: "Room not found" })
      return
    }

    const playerIndex = room.players.findIndex(p => p.id === socket.id)
    if (playerIndex === -1) {
      socket.emit("error", { message: "Player not in room" })
      return
    }

    const playerKey = playerIndex === 0 ? "player1" : "player2"
    
    // Update player ready status and ensure bird is set
    room.gameState[playerKey].isReady = isReady
    room.gameState[playerKey].bird = birdId

    console.log(`Player ${playerIndex + 1} (${room.gameState[playerKey].name}) ready status: ${isReady} with bird: ${birdId} in room ${roomId}`)

    // Notify all players about ready status
    io.to(roomId).emit("playerReady", {
      playerNumber: playerIndex + 1,
      isReady: isReady,
      playerName: room.gameState[playerKey].name
    })

    // Only start game when BOTH players are ready AND have birds
    const player1Ready = room.gameState.player1.isReady && room.gameState.player1.bird
    const player2Ready = room.gameState.player2.isReady && room.gameState.player2.bird

    if (player1Ready && player2Ready && !room.gameState.gameStarted) {
      console.log(`Starting game in room ${roomId} - both players ready!`)
      console.log(`Player 1 (${room.gameState.player1.name}): ${room.gameState.player1.bird} - Ready: ${room.gameState.player1.isReady}`)
      console.log(`Player 2 (${room.gameState.player2.name}): ${room.gameState.player2.bird} - Ready: ${room.gameState.player2.isReady}`)
      
      room.gameState.gameStarted = true
      
      io.to(roomId).emit("gameStart", {
        player1Bird: room.gameState.player1.bird,
        player2Bird: room.gameState.player2.bird,
        player1Name: room.gameState.player1.name,
        player2Name: room.gameState.player2.name,
        ready: true // Safety flag
      })

      console.log(`🚀 Game started: ${roomId} with ${room.gameState.player1.name} (${room.gameState.player1.bird}) vs ${room.gameState.player2.name} (${room.gameState.player2.bird})`)
    }
  })

  socket.on("gameAction", (data) => {
    if (!data?.roomId || !data?.action) {
      socket.emit("error", { message: "Invalid game action data" })
      return
    }

    const { roomId, action, payload } = data
    const room = gameRooms.get(roomId)

    if (!room || !room.gameState.gameStarted || room.gameState.gameOver) {
      return
    }

    switch (action) {
      case "move":
        // Forward movement to opponent
        socket.to(roomId).emit("opponentMove", payload)
        break

      case "ability":
        const playerIndex = room.players.findIndex(p => p.id === socket.id)
        if (playerIndex !== -1) {
          io.to(roomId).emit("abilityUsed", {
            playerNumber: playerIndex + 1,
            ability: payload?.ability,
            target: payload?.target,
          })
        }
        break

      case "damage":
        if (typeof payload?.target !== 'number' || typeof payload?.amount !== 'number') {
          return
        }

        const targetPlayer = payload.target === 1 ? "player1" : "player2"
        if (room.gameState[targetPlayer]) {
          room.gameState[targetPlayer].hp = Math.max(0, room.gameState[targetPlayer].hp - payload.amount)

          io.to(roomId).emit("healthUpdate", {
            player1HP: room.gameState.player1.hp,
            player2HP: room.gameState.player2.hp,
          })

          if (room.gameState[targetPlayer].hp <= 0) {
            const winner = payload.target === 1 ? 2 : 1
            const winnerName = winner === 1 ? room.gameState.player1.name : room.gameState.player2.name
            const loserName = winner === 1 ? room.gameState.player2.name : room.gameState.player1.name
            
            room.gameState.gameOver = true
            io.to(roomId).emit("gameOver", {
              winner,
              winnerName,
              loserName,
              reason: "HP depleted",
            })
            
            console.log(`Game over in room ${roomId}: ${winnerName} wins against ${loserName}`)
            setTimeout(() => gameRooms.delete(roomId), 5000)
          }
        }
        break

      case "heal":
        if (typeof payload?.target !== 'number' || typeof payload?.amount !== 'number') {
          return
        }

        const healTargetPlayer = payload.target === 1 ? "player1" : "player2"
        if (room.gameState[healTargetPlayer]) {
          room.gameState[healTargetPlayer].hp = Math.min(100, room.gameState[healTargetPlayer].hp + payload.amount)

          io.to(roomId).emit("healthUpdate", {
            player1HP: room.gameState.player1.hp,
            player2HP: room.gameState.player2.hp,
          })
        }
        break
    }
  })

  // FIXED: Handle joining existing game room with reconstruction
  socket.on("joinGameRoom", (data) => {
    const { roomId, playerNumber, playerName } = data
    
    if (!roomId || !playerNumber || !playerName) {
      socket.emit("error", { message: "Invalid game join data" })
      return
    }

    let room = gameRooms.get(roomId)
    
    if (!room) {
      console.log(`❌ Room ${roomId} not found, attempting reconstruction...`)
      
      // ADDED: Try to reconstruct room for valid players
      if (roomId.startsWith('room_') && playerNumber >= 1 && playerNumber <= 2) {
        console.log(`🔧 Reconstructing room ${roomId} for ${playerName}`)
        
        room = {
          players: [
            { 
              id: playerNumber === 1 ? socket.id : 'unknown', 
              name: playerNumber === 1 ? playerName : 'Opponent',
              socket: playerNumber === 1 ? socket : null
            },
            { 
              id: playerNumber === 2 ? socket.id : 'unknown', 
              name: playerNumber === 2 ? playerName : 'Opponent',
              socket: playerNumber === 2 ? socket : null
            }
          ],
          gameState: {
            player1: { 
              hp: 100, 
              score: 0, 
              bird: null, 
              isReady: true, // Assume ready since coming from bird selection
              name: playerNumber === 1 ? playerName : 'Opponent'
            },
            player2: { 
              hp: 100, 
              score: 0, 
              bird: null, 
              isReady: true,
              name: playerNumber === 2 ? playerName : 'Opponent'
            },
            pipes: [],
            gameStarted: true, // Game should start immediately
            gameOver: false,
          },
        }
        
        gameRooms.set(roomId, room)
        console.log(`✅ Reconstructed room ${roomId}`)
      } else {
        socket.emit("roomNotFound")
        return
      }
    }

    // UPDATED: More flexible player matching
    let playerIndex = room.players.findIndex(p => p.id === socket.id)
    
    if (playerIndex === -1) {
      // Try to find by player number or name
      playerIndex = room.players.findIndex(p => 
        p.name === playerName || 
        (playerNumber === 1 && room.players.indexOf(p) === 0) ||
        (playerNumber === 2 && room.players.indexOf(p) === 1)
      )
      
      if (playerIndex === -1) {
        // Assign to correct slot based on playerNumber
        playerIndex = playerNumber - 1
      }
      
      // Update player info
      if (room.players[playerIndex]) {
        room.players[playerIndex].id = socket.id
        room.players[playerIndex].socket = socket
        room.players[playerIndex].name = playerName
      }
    }

    // Join the room
    socket.join(roomId)
    
    console.log(`✅ Player ${playerName} joined game room ${roomId} as player ${playerNumber}`)
    
    socket.emit("gameJoined", {
      roomId,
      playerNumber,
      gameState: room.gameState
    })

    // Notify other players in room
    socket.to(roomId).emit("playerJoined", {
      playerNumber,
      playerName
    })
  })

  // UPDATED: Don't immediately delete rooms on disconnect
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id)

    // Remove from waiting queue
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id)
    if (waitingIndex !== -1) {
      const removedPlayer = waitingPlayers.splice(waitingIndex, 1)[0]
      console.log(`Removed ${removedPlayer.name} from waiting queue, ${waitingPlayers.length} players remaining`)
    }

    // Handle disconnection from active games
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id)
      if (playerIndex !== -1) {
        const disconnectedPlayerName = room.gameState[playerIndex === 0 ? 'player1' : 'player2'].name
        console.log(`❌ ${disconnectedPlayerName} disconnected from room ${roomId}`)
        
        // CHANGED: Mark player as disconnected instead of deleting room immediately
        room.players[playerIndex].id = 'disconnected'
        room.players[playerIndex].socket = null
        
        // Give players 30 seconds to reconnect before notifying opponent
        setTimeout(() => {
          const currentRoom = gameRooms.get(roomId)
          if (currentRoom && currentRoom.players[playerIndex].id === 'disconnected') {
            // Player didn't reconnect, notify opponent and clean up
            socket.to(roomId).emit("opponentDisconnected", {
              disconnectedPlayer: disconnectedPlayerName
            })
            
            console.log(`🗑️ Terminating room ${roomId} due to player timeout`)
            gameRooms.delete(roomId)
          }
        }, 30000) // 30 second grace period
        
        break
      }
    }
  })
})

// Start server with Railway-specific configuration
const PORT = process.env.PORT || 3001

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Socket.io server running on port ${PORT}`)
  console.log(`🌐 Server bound to 0.0.0.0:${PORT}`)
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/health`)
  console.log(`🎮 Socket.io endpoint: http://0.0.0.0:${PORT}/socket.io/`)
  console.log(`🚀 Transports: polling (primary), websocket (upgrade)`)
})

// Enhanced error handling for Railway
httpServer.on('error', (err) => {
  console.error('❌ Server error:', err)
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`)
    process.exit(1)
  }
  if (err.code === 'EACCES') {
    console.error(`❌ Permission denied on port ${PORT}`)
    process.exit(1)
  }
})

httpServer.on('listening', () => {
  const address = httpServer.address()
  console.log(`🚀 Server successfully listening on ${address.address}:${address.port}`)
  console.log(`📡 Railway URL should be: https://flappy-bird-battle-production.up.railway.app`)
})

// Add connection monitoring
httpServer.on('connection', (socket) => {
  console.log(`🔌 New HTTP connection from ${socket.remoteAddress}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Socket.io server...')
  console.log(`📊 Final stats: ${gameRooms.size} active rooms, ${waitingPlayers.length} waiting players`)
  
  io.close(() => {
    httpServer.close(() => {
      console.log('✅ Server shut down gracefully')
      process.exit(0)
    })
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  console.log(`📊 Final stats: ${gameRooms.size} active rooms, ${waitingPlayers.length} waiting players`)
  
  io.close(() => {
    httpServer.close(() => {
      console.log('✅ Server shut down gracefully')
      process.exit(0)
    })
  })
})

// Periodic cleanup of stale rooms
setInterval(() => {
  let cleanedRooms = 0
  const now = Date.now()
  
  for (const [roomId, room] of gameRooms.entries()) {
    // Clean up rooms older than 30 minutes
    const roomAge = now - parseInt(roomId.split('_')[1])
    if (roomAge > 30 * 60 * 1000) {
      gameRooms.delete(roomId)
      cleanedRooms++
    }
  }
  
  if (cleanedRooms > 0) {
    console.log(`🧹 Cleaned up ${cleanedRooms} stale room(s)`)
  }
}, 5 * 60 * 1000) // Check every 5 minutes