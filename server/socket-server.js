const { createServer } = require('http')
const { Server } = require('socket.io')
const { BIRD_CONFIGS, UNIVERSAL_ABILITY } = require('./bird-config')
const GameLogic = require('./game-logic')

// Initialize game logic
const gameLogic = new GameLogic()

// FIXED: Declare variables BEFORE using them in the HTTP server
const gameRooms = new Map()
const waitingPlayers = []

// Set game rooms reference in game logic
gameLogic.setGameRooms(gameRooms)

// Helper function to calculate damage
function calculateDamage(attacker, baseDamage) {
  const attackModifier = attacker.attack / 100
  return Math.floor(baseDamage * attackModifier)
}

// Helper function to deal damage
function dealDamage(player, damage) {
  // Check for invulnerability
  if (player.statusEffects?.has('invulnerable')) {
    return 0
  }

  const actualDamage = Math.min(damage, player.hp)
  player.hp = Math.max(0, player.hp - damage)
  return actualDamage
}

// Helper function to heal player
function healPlayer(player, healAmount) {
  const actualHeal = Math.min(healAmount, player.maxHp - player.hp)
  player.hp += actualHeal
  return actualHeal
}

// Helper function to apply status effects
function applyStatusEffect(player, effect, duration) {
  if (!player.statusEffects) player.statusEffects = new Map()
  
  const endTime = Date.now() + duration
  player.statusEffects.set(effect, endTime)

  // Auto-remove after duration
  setTimeout(() => {
    if (player.statusEffects) {
      player.statusEffects.delete(effect)
    }
  }, duration)
}

// Helper function to execute ability effects
function executeAbility(room, caster, ability, abilityType, casterIndex) {
  const opponentIndex = casterIndex === 0 ? 1 : 0
  const opponentKey = opponentIndex === 0 ? "player1" : "player2"
  const opponent = room.gameState[opponentKey]

  const result = {
    success: true,
    effects: [],
    damage: 0,
    healing: 0
  }

  switch (ability.type) {
    case 'projectile':
    case 'lightning':
    case 'stealth':
      // Direct damage abilities
      const damage = calculateDamage(caster, ability.damage)
      const actualDamage = dealDamage(opponent, damage)
      result.damage = actualDamage
      result.effects.push({
        type: 'damage',
        target: opponentIndex + 1,
        amount: actualDamage
      })
      break

    case 'aoe':
      // Area of effect damage
      const aoeDamage = calculateDamage(caster, ability.damage)
      const actualAoeDamage = dealDamage(opponent, aoeDamage)
      result.damage = actualAoeDamage
      result.effects.push({
        type: 'aoe_damage',
        target: opponentIndex + 1,
        amount: actualAoeDamage
      })
      break

    case 'heal':
      // Healing abilities
      const healAmount = ability.heal
      const actualHeal = healPlayer(caster, healAmount)
      result.healing = actualHeal
      result.effects.push({
        type: 'heal',
        target: casterIndex + 1,
        amount: actualHeal
      })
      break

    case 'disable':
    case 'invulnerability':
    case 'control':
      // Status effect abilities
      const target = ability.statusEffect === 'invulnerable' ? caster : opponent
      const targetIndex = ability.statusEffect === 'invulnerable' ? casterIndex : opponentIndex
      applyStatusEffect(target, ability.statusEffect, ability.statusDuration)
      result.effects.push({
        type: 'status_effect',
        target: targetIndex + 1,
        effect: ability.statusEffect,
        duration: ability.statusDuration
      })
      break

    case 'push':
      // Environmental manipulation
      result.effects.push({
        type: 'push',
        target: opponentIndex + 1,
        force: ability.pushForce
      })
      break

    case 'obstacle':
      // Create obstacles
      result.effects.push({
        type: 'create_obstacle',
        target: opponentIndex + 1,
        duration: ability.duration
      })
      break

    case 'chain':
      // Chain lightning damage
      const chainDamage = calculateDamage(caster, ability.damage)
      const actualChainDamage = dealDamage(opponent, chainDamage)
      result.damage = actualChainDamage
      result.effects.push({
        type: 'chain_damage',
        target: opponentIndex + 1,
        amount: actualChainDamage,
        chainRange: ability.chainRange
      })
      break
  }

  // Apply status effects from normal abilities
  if (ability.statusEffect && ability.statusDuration && ability.type !== 'disable' && ability.type !== 'invulnerability' && ability.type !== 'control') {
    applyStatusEffect(opponent, ability.statusEffect, ability.statusDuration)
    result.effects.push({
      type: 'status_effect',
      target: opponentIndex + 1,
      effect: ability.statusEffect,
      duration: ability.statusDuration
    })
  }

  return result
}

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
  } else if (req.url === '/birds' || req.url === '/api/birds') {
    // Bird configurations endpoint
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    })
    res.end(JSON.stringify({ 
      birds: BIRD_CONFIGS,
      universal: UNIVERSAL_ABILITY
    }))
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      message: 'Socket.io server running',
      status: 'ok',
      socketPath: '/socket.io/',
      availableEndpoints: ['/health', '/socket.io/', '/birds']
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
  // CRITICAL: Force polling ONLY - no websocket
  transports: ['polling'], // ONLY polling, no websocket
  allowEIO3: true,
  path: '/socket.io/',
  serveClient: false,
  pingTimeout: 60000,
  pingInterval: 25000,
  // Additional Railway-specific settings
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: false, // DISABLE websocket upgrades completely
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
            name: player1.name,
            statusEffects: new Map(),
            abilityCooldowns: new Map(),
            ultimateUsesLeft: Infinity
          },
          player2: { 
            hp: 100, 
            score: 0, 
            bird: null, 
            isReady: false,
            name: player2.name,
            statusEffects: new Map(),
            abilityCooldowns: new Map(),
            ultimateUsesLeft: Infinity
          },
          pipes: [],
          gameStarted: false,
          gameOver: false,
        },
      })

      player1.socket.join(roomId)
      player2.socket.join(roomId)

      player1.socket.emit("matchFound", {
        roomId,
        opponent: player2.name,
        playerNumber: 1,
        myName: player1.name
      })

      player2.socket.emit("matchFound", {
        roomId,
        opponent: player1.name,
        playerNumber: 2,
        myName: player2.name
      })

      console.log(`Match created: ${roomId} with ${player1.name} (Player 1) vs ${player2.name} (Player 2)`)
    }
  })

  // UPDATED: Bird selection with stealing mechanism and server-side validation
  socket.on("selectBird", (data) => {
    if (!data?.roomId || !data?.birdId) {
      socket.emit("error", { message: "Invalid bird selection data" })
      return
    }

    const { roomId, birdId, playerNumber, isLocked, timestamp } = data
    
    // Validate bird type
    if (!gameLogic.isValidBird(birdId)) {
      socket.emit("error", { message: "Invalid bird type" })
      return
    }

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

    // Set new bird selection and initialize player stats
    room.gameState[playerKey].bird = birdId
    room.gameState[playerKey].isReady = isLocked
    
    // Initialize player with bird stats if locked
    if (isLocked) {
      const birdConfig = gameLogic.getBirdConfig(birdId)
      room.gameState[playerKey].hp = birdConfig.stats.hp
      room.gameState[playerKey].maxHp = birdConfig.stats.hp
      room.gameState[playerKey].speed = birdConfig.stats.speed
      room.gameState[playerKey].attack = birdConfig.stats.attack
      room.gameState[playerKey].ultimateUsesLeft = birdConfig.abilities.ultimate.usesPerMatch || Infinity
    }

    // Notify all players about bird selection
    io.to(roomId).emit("birdSelected", {
      playerNumber: playerIndex + 1,
      birdId,
      isLocked,
      timestamp,
      birdConfig: gameLogic.getBirdConfig(birdId)
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

  // Handle ability usage
  socket.on("useAbility", (data) => {
    const { roomId, abilityType } = data
    const playerId = socket.id

    if (!roomId || !abilityType) {
      socket.emit("error", { message: "Invalid ability data" })
      return
    }

    const room = gameRooms.get(roomId)
    if (!room || !room.gameState.gameStarted || room.gameState.gameOver) {
      socket.emit("error", { message: "Invalid game state" })
      return
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) {
      socket.emit("error", { message: "Player not found in room" })
      return
    }

    const playerKey = playerIndex === 0 ? "player1" : "player2"
    const player = room.gameState[playerKey]
    
    if (!player.bird) {
      socket.emit("error", { message: "No bird selected" })
      return
    }

    // Check if player has status effects that prevent ability use
    if (player.statusEffects?.has('freeze') || player.statusEffects?.has('nightmare')) {
      socket.emit("abilityError", { error: "Unable to use abilities due to status effect" })
      return
    }

    const birdConfig = gameLogic.getBirdConfig(player.bird)
    let ability

    // Handle universal heal ability
    if (abilityType === 'universal') {
      ability = UNIVERSAL_ABILITY.heal
    } else {
      ability = birdConfig.abilities[abilityType]
    }

    if (!ability) {
      socket.emit("abilityError", { error: "Invalid ability" })
      return
    }

    // Check cooldown
    const cooldownKey = `${abilityType}`
    const lastUsed = player.abilityCooldowns?.get(cooldownKey) || 0
    const now = Date.now()
    
    if (now - lastUsed < ability.cooldown) {
      socket.emit("abilityError", {
        error: "Ability on cooldown",
        remainingCooldown: ability.cooldown - (now - lastUsed)
      })
      return
    }

    // Check ultimate uses
    if (abilityType === 'ultimate' && player.ultimateUsesLeft <= 0) {
      socket.emit("abilityError", { error: "Ultimate already used" })
      return
    }

    // Execute ability
    const result = executeAbility(room, player, ability, abilityType, playerIndex)
    
    if (result.success) {
      // Set cooldown
      if (!player.abilityCooldowns) player.abilityCooldowns = new Map()
      player.abilityCooldowns.set(cooldownKey, now)
      
      // Decrease ultimate uses
      if (abilityType === 'ultimate') {
        player.ultimateUsesLeft--
      }

      // Broadcast ability usage to both players
      io.to(roomId).emit("abilityUsed", {
        playerId,
        playerNumber: playerIndex + 1,
        abilityType,
        abilityName: ability.name,
        effects: result.effects,
        damage: result.damage,
        healing: result.healing
      })

      // Update game state
      io.to(roomId).emit("gameStateUpdate", {
        player1: {
          hp: room.gameState.player1.hp,
          isAlive: room.gameState.player1.hp > 0,
          statusEffects: room.gameState.player1.statusEffects ? Array.from(room.gameState.player1.statusEffects.entries()) : []
        },
        player2: {
          hp: room.gameState.player2.hp,
          isAlive: room.gameState.player2.hp > 0,
          statusEffects: room.gameState.player2.statusEffects ? Array.from(room.gameState.player2.statusEffects.entries()) : []
        }
      })

      // Check for game over
      if (room.gameState.player1.hp <= 0 || room.gameState.player2.hp <= 0) {
        const winner = room.gameState.player1.hp > 0 ? 1 : 2
        const winnerName = winner === 1 ? room.gameState.player1.name : room.gameState.player2.name
        const loserName = winner === 1 ? room.gameState.player2.name : room.gameState.player1.name
        
        room.gameState.gameOver = true
        io.to(roomId).emit("gameOver", {
          winner,
          winnerName,
          loserName,
          reason: "HP depleted"
        })
        
        console.log(`Game over in room ${roomId}: ${winnerName} wins against ${loserName} (ability damage)`)
        setTimeout(() => gameRooms.delete(roomId), 5000)
      }
    } else {
      socket.emit("abilityError", {
        error: result.error,
        remainingCooldown: result.remainingCooldown
      })
    }
  })

  // Handle bird configuration requests
  socket.on("getBirdConfigs", () => {
    socket.emit("birdConfigs", {
      birds: BIRD_CONFIGS,
      universal: UNIVERSAL_ABILITY
    })
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
        ready: true
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
        // Legacy ability handling - redirect to new useAbility handler
        if (payload?.ability) {
          socket.emit("useAbility", {
            roomId,
            abilityType: payload.ability
          })
        }
        break

      case "damage":
        if (typeof payload?.target !== 'number' || typeof payload?.amount !== 'number') {
          return
        }

        const targetPlayer = payload.target === 1 ? "player1" : "player2"
        if (room.gameState[targetPlayer]) {
          // Check for invulnerability before applying damage
          if (room.gameState[targetPlayer].statusEffects?.has('invulnerable')) {
            return
          }

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
          const maxHp = room.gameState[healTargetPlayer].maxHp || 100
          room.gameState[healTargetPlayer].hp = Math.min(maxHp, room.gameState[healTargetPlayer].hp + payload.amount)

          io.to(roomId).emit("healthUpdate", {
            player1HP: room.gameState.player1.hp,
            player2HP: room.gameState.player2.hp,
          })
        }
        break

      case "pipeCollision":
        // Handle pipe collision damage
        if (typeof payload?.target !== 'number') {
          return
        }

        const collisionTargetPlayer = payload.target === 1 ? "player1" : "player2"
        if (room.gameState[collisionTargetPlayer]) {
          // Pipe collision deals massive damage (usually fatal)
          room.gameState[collisionTargetPlayer].hp = 0

          io.to(roomId).emit("healthUpdate", {
            player1HP: room.gameState.player1.hp,
            player2HP: room.gameState.player2.hp,
          })

          const winner = payload.target === 1 ? 2 : 1
          const winnerName = winner === 1 ? room.gameState.player1.name : room.gameState.player2.name
          const loserName = winner === 1 ? room.gameState.player2.name : room.gameState.player1.name
          
          room.gameState.gameOver = true
          io.to(roomId).emit("gameOver", {
            winner,
            winnerName,
            loserName,
            reason: "Pipe collision",
          })
          
          console.log(`Game over in room ${roomId}: ${winnerName} wins against ${loserName} (pipe collision)`)
          setTimeout(() => gameRooms.delete(roomId), 5000)
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
              isReady: true,
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
            gameStarted: true,
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