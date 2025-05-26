import type { Server as NetServer } from "http"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { Server as ServerIO } from "socket.io"

export const dynamic = "force-dynamic"

// Define types for better type safety
interface Player {
  id: string
  name: string
  socket: any
}

interface GameState {
  player1: { hp: number; score: number; bird: string | null }
  player2: { hp: number; score: number; bird: string | null }
  pipes: any[]
  gameStarted: boolean
  gameOver: boolean
}

interface GameRoom {
  players: Player[]
  gameState: GameState
}

// Global variable to store the Socket.io instance
let io: ServerIO

const SocketHandler = async (req: NextRequest) => {
  // Check if we're in a server environment
  if (typeof window !== 'undefined') {
    return new NextResponse("Socket.io not supported on client side", { status: 400 })
  }

  // Try to get the server from the global scope or create one
  if (!global.io) {
    try {
      // In Next.js App Router, we need to create our own HTTP server
      const { createServer } = await import('http')
      const { parse } = await import('url')
      
      // Create HTTP server if it doesn't exist
      if (!global.httpServer) {
        global.httpServer = createServer((req, res) => {
          const parsedUrl = parse(req.url!, true)
          // Handle basic HTTP requests here if needed
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('Socket.io server running')
        })
      }

      console.log("Socket is initializing")
      
      // Initialize Socket.io server
      io = new ServerIO(global.httpServer, {
        path: "/api/socket",
        addTrailingSlash: false,
        cors: {
          origin: process.env.NODE_ENV === 'development' 
            ? process.env.NEXTAUTH_URL || "https://your-domain.com"
            : ["http://localhost:3000", "http://127.0.0.1:3000"],
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling']
      })

      // Game rooms and player management with proper typing
      const gameRooms = new Map<string, GameRoom>()
      const waitingPlayers: Player[] = []

      io.on("connection", (socket) => {
        console.log("Player connected:", socket.id)

        // Handle matchmaking
        socket.on("findMatch", (playerData: { name: string }) => {
          console.log("Player looking for match:", playerData)

          // Validate player data
          if (!playerData?.name || typeof playerData.name !== 'string') {
            socket.emit("error", { message: "Invalid player data" })
            return
          }

          // Check if player is already in queue
          const existingPlayer = waitingPlayers.find(p => p.id === socket.id)
          if (existingPlayer) {
            socket.emit("error", { message: "Already in matchmaking queue" })
            return
          }

          // Add to waiting queue
          waitingPlayers.push({
            id: socket.id,
            name: playerData.name.trim(),
            socket: socket,
          })

          socket.emit("queueJoined", { position: waitingPlayers.length })

          // Try to match players
          if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift()!
            const player2 = waitingPlayers.shift()!

            const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

            // Create game room
            gameRooms.set(roomId, {
              players: [player1, player2],
              gameState: {
                player1: { hp: 100, score: 0, bird: null },
                player2: { hp: 100, score: 0, bird: null },
                pipes: [],
                gameStarted: false,
                gameOver: false,
              },
            })

            // Join players to room
            player1.socket.join(roomId)
            player2.socket.join(roomId)

            // Notify players of match found
            player1.socket.emit("matchFound", {
              roomId,
              opponent: player2.name,
              playerNumber: 1,
            })

            player2.socket.emit("matchFound", {
              roomId,
              opponent: player1.name,
              playerNumber: 2,
            })

            console.log(`Match created: ${roomId} with ${player1.name} vs ${player2.name}`)
          }
        })

        // Handle bird selection
        socket.on("selectBird", (data: { roomId: string; birdId: string }) => {
          if (!data?.roomId || !data?.birdId) {
            socket.emit("error", { message: "Invalid bird selection data" })
            return
          }

          const { roomId, birdId } = data
          const room = gameRooms.get(roomId)

          if (!room) {
            socket.emit("error", { message: "Room not found" })
            return
          }

          const playerIndex = room.players.findIndex((p: Player) => p.id === socket.id)
          if (playerIndex === -1) {
            socket.emit("error", { message: "Player not in room" })
            return
          }

          const playerKey = playerIndex === 0 ? "player1" : "player2"
          room.gameState[playerKey].bird = birdId

          // Notify room of selection
          io.to(roomId).emit("birdSelected", {
            playerNumber: playerIndex + 1,
            birdId,
          })

          // Check if both players have selected birds
          if (room.gameState.player1.bird && room.gameState.player2.bird) {
            room.gameState.gameStarted = true
            io.to(roomId).emit("gameStart", {
              player1Bird: room.gameState.player1.bird,
              player2Bird: room.gameState.player2.bird
            })
          }
        })

        // Handle game actions
        socket.on("gameAction", (data: { roomId: string; action: string; payload: any }) => {
          if (!data?.roomId || !data?.action) {
            socket.emit("error", { message: "Invalid game action data" })
            return
          }

          const { roomId, action, payload } = data
          const room = gameRooms.get(roomId)

          if (!room) {
            socket.emit("error", { message: "Room not found" })
            return
          }

          if (!room.gameState.gameStarted) {
            socket.emit("error", { message: "Game not started" })
            return
          }

          if (room.gameState.gameOver) {
            socket.emit("error", { message: "Game is over" })
            return
          }

          // Validate and process action
          switch (action) {
            case "move":
              // Broadcast movement to other player
              socket.to(roomId).emit("opponentMove", payload)
              break

            case "ability":
              // Process ability use
              const playerIndex = room.players.findIndex((p: Player) => p.id === socket.id)
              if (playerIndex !== -1) {
                io.to(roomId).emit("abilityUsed", {
                  playerNumber: playerIndex + 1,
                  ability: payload?.ability,
                  target: payload?.target,
                })
              }
              break

            case "damage":
              // Validate damage payload
              if (typeof payload?.target !== 'number' || typeof payload?.amount !== 'number' || payload.amount < 0) {
                socket.emit("error", { message: "Invalid damage data" })
                return
              }

              // Apply damage
              const targetPlayer = payload.target === 1 ? "player1" : "player2"
              if (room.gameState[targetPlayer]) {
                room.gameState[targetPlayer].hp = Math.max(0, room.gameState[targetPlayer].hp - payload.amount)

                io.to(roomId).emit("healthUpdate", {
                  player1HP: room.gameState.player1.hp,
                  player2HP: room.gameState.player2.hp,
                })

                // Check for game over
                if (room.gameState[targetPlayer].hp <= 0) {
                  const winner = payload.target === 1 ? 2 : 1
                  room.gameState.gameOver = true
                  io.to(roomId).emit("gameOver", {
                    winner,
                    reason: "HP depleted",
                  })
                  
                  // Clean up room after a delay
                  setTimeout(() => {
                    gameRooms.delete(roomId)
                  }, 5000)
                }
              }
              break

            default:
              socket.emit("error", { message: "Unknown action" })
          }
        })

        // Handle disconnection
        socket.on("disconnect", () => {
          console.log("Player disconnected:", socket.id)

          // Remove from waiting queue
          const waitingIndex = waitingPlayers.findIndex((p) => p.id === socket.id)
          if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1)
          }

          // Handle game room disconnection
          for (const [roomId, room] of gameRooms.entries()) {
            const playerIndex = room.players.findIndex((p: Player) => p.id === socket.id)
            if (playerIndex !== -1) {
              // Notify other player of disconnection
              socket.to(roomId).emit("opponentDisconnected")

              // Clean up room
              gameRooms.delete(roomId)
              break
            }
          }
        })
      })

      global.io = io

      // Start the server if not already running
      if (!global.serverStarted) {
        const port = process.env.SOCKET_PORT || 3001
        global.httpServer.listen(port, () => {
          console.log(`Socket.io server running on port ${port}`)
        })
        global.serverStarted = true
      }

    } catch (error) {
      console.error("Error initializing Socket.io:", error)
      return new NextResponse("Failed to initialize Socket.io", { status: 500 })
    }
  } else {
    console.log("Socket is already running")
  }

  return new NextResponse("Socket initialized", { status: 200 })
}

// Extend global object to include our server variables
declare global {
  var io: ServerIO | undefined
  var httpServer: NetServer | undefined
  var serverStarted: boolean | undefined
}

export { SocketHandler as GET, SocketHandler as POST }
