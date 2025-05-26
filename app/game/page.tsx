"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { io, Socket } from "socket.io-client"

interface GameStats {
  player1HP: number
  player2HP: number
  player1Score: number
  player2Score: number
}

interface MatchData {
  roomId: string
  opponent: string
  playerNumber: number
}

export default function GamePage() {
  const gameRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchStatus, setMatchStatus] = useState<'searching' | 'found' | 'playing' | 'ended'>('searching')
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [gameStats, setGameStats] = useState<GameStats>({
    player1HP: 100,
    player2HP: 100,
    player1Score: 0,
    player2Score: 0,
  })

  // Memoize the setGameStats function to prevent recreating it on every render
  const updateGameStats = useCallback((updater: (prev: GameStats) => GameStats) => {
    setGameStats(updater)
  }, [])

  // Socket connection and matchmaking
  useEffect(() => {
    const playerName = typeof window !== "undefined" 
      ? localStorage.getItem("playerName") || "Player"
      : "Player"

    // Connect to Socket.io server
    socketRef.current = io(process.env.NODE_ENV === 'production' 
      ? process.env.NEXTAUTH_URL || window.location.origin
      : 'http://localhost:3001', {
      transports: ['websocket', 'polling']
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      // Start looking for a match
      socket.emit('findMatch', { name: playerName })
    })

    socket.on('queueJoined', (data) => {
      console.log('Joined queue, position:', data.position)
      setMatchStatus('searching')
    })

    socket.on('matchFound', (data: MatchData) => {
      console.log('Match found:', data)
      setMatchData(data)
      setMatchStatus('found')
      // Start the game after a short delay
      setTimeout(() => {
        setMatchStatus('playing')
        loadGame(data)
      }, 2000)
    })

    socket.on('opponentMove', (data) => {
      // Handle opponent movement
      if (window.gameScene && window.gameScene.player2) {
        const { action, x, y, velocityX, velocityY } = data
        if (action === 'move') {
          window.gameScene.player2.setPosition(x, y)
          window.gameScene.player2.setVelocity(velocityX, velocityY)
        }
      }
    })

    socket.on('abilityUsed', (data) => {
      // Handle opponent abilities
      if (window.gameScene) {
        const { playerNumber, ability, target } = data
        if (playerNumber !== (matchData?.playerNumber || 1)) {
          window.gameScene.handleOpponentAbility(ability, target)
        }
      }
    })

    socket.on('healthUpdate', (data) => {
      updateGameStats((prev) => ({
        ...prev,
        player1HP: data.player1HP,
        player2HP: data.player2HP,
      }))
    })

    socket.on('gameOver', (data) => {
      if (window.gameScene) {
        const isWinner = data.winner === (matchData?.playerNumber || 1)
        window.gameScene.endGame(
          isWinner ? "You Win!" : "You Lose!",
          data.reason
        )
      }
      setMatchStatus('ended')
    })

    socket.on('opponentDisconnected', () => {
      if (window.gameScene) {
        window.gameScene.endGame("You Win!", "Opponent disconnected")
      }
      setMatchStatus('ended')
    })

    socket.on('error', (data) => {
      console.error('Socket error:', data.message)
      setError(data.message)
    })

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [matchData?.playerNumber, updateGameStats])

  const loadGame = async (matchInfo: MatchData) => {
    try {
      // Check if we're in the browser
      if (typeof window === "undefined") return

      // Check if game container exists
      if (!gameRef.current) {
        setError("Game container not found")
        return
      }

      // Dynamic import of Phaser with proper default export access
      const PhaserModule = await import("phaser")
      const Phaser = PhaserModule.default

      // Get player data with fallback values
      const playerName = typeof window !== "undefined" 
        ? localStorage.getItem("playerName") || "Player"
        : "Player"

      // Create proper Phaser Scene class
      class GameScene extends Phaser.Scene {
        private player1: any
        private player2: any
        private pipes: any
        private gameStarted = false
        private gameOver = false
        private player1HPText: any
        private player2HPText: any
        private player1ScoreText: any
        private player2ScoreText: any
        private gameOverText: any
        private abilityTexts: any = {}
        private abilityCooldowns = {
          q: 0,
          e: 0,
          c: 0,
          x: 0,
        }
        private cursors: any
        private wasd: any
        private cooldownTimers: any = {}
        private playerNumber: number
        private roomId: string

        constructor() {
          super({ key: "GameScene" })
          this.playerNumber = matchInfo.playerNumber
          this.roomId = matchInfo.roomId
        }

        preload() {
          try {
            // Create simple colored rectangles for birds
            this.add.graphics()
              .fillStyle(0xff6b6b)
              .fillRect(0, 0, 32, 32)
              .generateTexture("bird1", 32, 32)
              .destroy()

            this.add.graphics()
              .fillStyle(0x4ecdc4)
              .fillRect(0, 0, 32, 32)
              .generateTexture("bird2", 32, 32)
              .destroy()

            // Create pipe texture
            this.add.graphics()
              .fillStyle(0x2ecc71)
              .fillRect(0, 0, 64, 400)
              .generateTexture("pipe", 64, 400)
              .destroy()

            // Create background elements
            this.add.graphics()
              .fillStyle(0xffffff)
              .fillRect(0, 0, 100, 50)
              .generateTexture("cloud", 100, 50)
              .destroy()
          } catch (err) {
            console.error("Error in preload:", err)
          }
        }

        create() {
          try {
            // Store scene reference globally for socket communication
            window.gameScene = this

            // Create split screen divider
            this.add.graphics()
              .lineStyle(4, 0xffffff)
              .moveTo(600, 0)
              .lineTo(600, 600)
              .stroke()

            // Create background clouds
            for (let i = 0; i < 5; i++) {
              this.add
                .image(Phaser.Math.Between(0, 1200), Phaser.Math.Between(50, 150), "cloud")
                .setAlpha(0.3)
                .setScale(0.5)
            }

            // Create players with physics
            this.player1 = this.physics.add.sprite(150, 300, "bird1")
            this.player1.setBounce(0.2)
            this.player1.setCollideWorldBounds(true)
            this.player1.setScale(1.5)
            this.player1.body.setSize(20, 20)
            this.player1.hp = 100
            this.player1.score = 0

            this.player2 = this.physics.add.sprite(750, 300, "bird2")
            this.player2.setBounce(0.2)
            this.player2.setCollideWorldBounds(true)
            this.player2.setScale(1.5)
            this.player2.body.setSize(20, 20)
            this.player2.hp = 100
            this.player2.score = 0

            // Create pipe groups
            this.pipes = this.physics.add.group()

            // Create UI
            this.createUI()

            // Set up keyboard controls
            this.setupControls()

            // Start spawning pipes
            this.time.addEvent({
              delay: 2000,
              callback: this.spawnPipes,
              callbackScope: this,
              loop: true,
            })

            this.gameStarted = true
          } catch (err) {
            console.error("Error in create:", err)
          }
        }

        createUI() {
          try {
            // Player names based on player number
            const myName = playerName
            const opponentName = matchInfo.opponent

            // Player 1 UI (left side)
            this.add.text(20, 20, this.playerNumber === 1 ? myName : opponentName, {
              fontSize: "24px",
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            })

            this.player1HPText = this.add.text(20, 50, "HP: 100", {
              fontSize: "20px",
              color: "#ff6b6b",
              stroke: "#000000",
              strokeThickness: 2,
            })

            this.player1ScoreText = this.add.text(20, 80, "Score: 0", {
              fontSize: "20px",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 2,
            })

            // Player 2 UI (right side)
            this.add.text(620, 20, this.playerNumber === 2 ? myName : opponentName, {
              fontSize: "24px",
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            })

            this.player2HPText = this.add.text(620, 50, "HP: 100", {
              fontSize: "20px",
              color: "#4ecdc4",
              stroke: "#000000",
              strokeThickness: 2,
            })

            this.player2ScoreText = this.add.text(620, 80, "Score: 0", {
              fontSize: "20px",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 2,
            })

            // Only show ability UI for the current player
            if (this.playerNumber === 1) {
              // Ability cooldown UI
              this.abilityTexts.q = this.add.text(20, 120, "Q: Ready", {
                fontSize: "16px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
              })
              this.abilityTexts.e = this.add.text(20, 140, "E: Ready", {
                fontSize: "16px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
              })
              this.abilityTexts.c = this.add.text(20, 160, "C: Ready", {
                fontSize: "16px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
              })
              this.abilityTexts.x = this.add.text(20, 180, "X: Ready", {
                fontSize: "16px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
              })

              // Controls help
              this.add.text(20, 220, "Controls:", {
                fontSize: "16px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 1,
              })
              this.add.text(20, 240, "W/S: Up/Down", { fontSize: "14px", color: "#ffffff" })
              this.add.text(20, 255, "A/D: Left/Right", { fontSize: "14px", color: "#ffffff" })
              this.add.text(20, 270, "Q/E/C/X: Abilities", { fontSize: "14px", color: "#ffffff" })
            }
          } catch (err) {
            console.error("Error in createUI:", err)
          }
        }

        setupControls() {
          try {
            // Create keyboard input
            this.cursors = this.input.keyboard?.createCursorKeys()
            this.wasd = this.input.keyboard?.addKeys('W,S,A,D,Q,E,C,X,R,ESC')

            // Get the player we should control
            const myPlayer = this.playerNumber === 1 ? this.player1 : this.player2

            // Movement controls using WASD
            if (this.wasd && myPlayer) {
              this.wasd.W.on('down', () => {
                if (!this.gameOver && myPlayer) {
                  myPlayer.setVelocityY(-250)
                  this.showAbilityEffect("↑", myPlayer.x, myPlayer.y - 30)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.S.on('down', () => {
                if (!this.gameOver && myPlayer) {
                  myPlayer.setVelocityY(250)
                  this.showAbilityEffect("↓", myPlayer.x, myPlayer.y + 30)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.A.on('down', () => {
                if (!this.gameOver && myPlayer) {
                  myPlayer.setVelocityX(-150)
                  this.showAbilityEffect("←", myPlayer.x - 30, myPlayer.y)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.D.on('down', () => {
                if (!this.gameOver && myPlayer) {
                  myPlayer.setVelocityX(150)
                  this.showAbilityEffect("→", myPlayer.x + 30, myPlayer.y)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              // Ability controls with proper cooldown timers
              this.wasd.Q.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.q <= 0) {
                  this.useAbility("q", "Ember Shot")
                  this.startCooldown("q", 6)
                }
              })

              this.wasd.E.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.e <= 0) {
                  this.useAbility("e", "Flame Wave")
                  this.startCooldown("e", 10)
                }
              })

              this.wasd.C.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.c <= 0) {
                  this.useAbility("c", "Heal")
                  this.startCooldown("c", 8)
                }
              })

              this.wasd.X.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.x <= 0) {
                  this.useAbility("x", "Ultimate")
                  this.startCooldown("x", 15)
                }
              })

              // Game restart and menu controls
              this.wasd.R.on('down', () => {
                if (this.gameOver) {
                  window.location.reload()
                }
              })

              this.wasd.ESC.on('down', () => {
                if (this.gameOver) {
                  window.location.href = "/"
                }
              })
            }
          } catch (err) {
            console.error("Error in setupControls:", err)
          }
        }

        sendMovement(action: string, x: number, y: number, velocityX: number, velocityY: number) {
          if (socketRef.current) {
            socketRef.current.emit('gameAction', {
              roomId: this.roomId,
              action: 'move',
              payload: { action, x, y, velocityX, velocityY }
            })
          }
        }

        startCooldown(ability: string, seconds: number) {
          try {
            this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns] = seconds
            
            if (this.cooldownTimers[ability]) {
              this.cooldownTimers[ability].remove()
            }

            if (this.abilityTexts[ability]) {
              this.abilityTexts[ability].setText(`${ability.toUpperCase()}: ${seconds}s`)
            }

            this.cooldownTimers[ability] = this.time.addEvent({
              delay: 1000,
              callback: () => {
                this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns]--
                
                const cooldown = this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns]
                const text = cooldown > 0 ? `${ability.toUpperCase()}: ${cooldown}s` : `${ability.toUpperCase()}: Ready`
                
                if (this.abilityTexts[ability]) {
                  this.abilityTexts[ability].setText(text)
                }

                if (cooldown <= 0) {
                  this.cooldownTimers[ability].remove()
                  delete this.cooldownTimers[ability]
                }
              },
              repeat: seconds - 1
            })
          } catch (err) {
            console.error("Error in startCooldown:", err)
          }
        }

        spawnPipes() {
          if (this.gameOver) return

          try {
            const gap = 180
            const pipeY = Phaser.Math.Between(150, 450)

            // Left side pipes (player 1)
            const topPipe1 = this.pipes.create(600, pipeY - gap / 2 - 200, "pipe")
            const bottomPipe1 = this.pipes.create(600, pipeY + gap / 2 + 200, "pipe")

            topPipe1.setVelocityX(-150)
            bottomPipe1.setVelocityX(-150)
            topPipe1.body.setSize(64, 400)
            bottomPipe1.body.setSize(64, 400)
            topPipe1.body.setImmovable(true)
            bottomPipe1.body.setImmovable(true)
            topPipe1.side = "left"
            bottomPipe1.side = "left"

            // Right side pipes (player 2)
            const topPipe2 = this.pipes.create(1200, pipeY - gap / 2 - 200, "pipe")
            const bottomPipe2 = this.pipes.create(1200, pipeY + gap / 2 + 200, "pipe")

            topPipe2.setVelocityX(-150)
            bottomPipe2.setVelocityX(-150)
            topPipe2.body.setSize(64, 400)
            bottomPipe2.body.setSize(64, 400)
            topPipe2.body.setImmovable(true)
            bottomPipe2.body.setImmovable(true)
            topPipe2.side = "right"
            bottomPipe2.side = "right"

            // Set up collisions
            this.physics.add.overlap(this.player1, [topPipe1, bottomPipe1], () => {
              if (!this.gameOver) {
                this.sendGameAction('damage', { target: 1, amount: 100 })
              }
            })

            this.physics.add.overlap(this.player2, [topPipe2, bottomPipe2], () => {
              if (!this.gameOver) {
                this.sendGameAction('damage', { target: 2, amount: 100 })
              }
            })
          } catch (err) {
            console.error("Error in spawnPipes:", err)
          }
        }

        useAbility(key: string, abilityName: string) {
          try {
            // Check if ability can pass through pipes
            const canPassThroughPipes = this.checkAbilityPath(key)
            
            if (!canPassThroughPipes) {
              this.showAbilityEffect("Blocked by pipe!", this.player1.x, this.player1.y - 60, "#ff9900")
              return
            }

            this.showAbilityEffect(abilityName, 300, 250, "#ffff00")

            // Send ability to server
            let damage = 0
            let heal = 0
            const targetPlayer = this.playerNumber === 1 ? 2 : 1

            switch (key) {
              case "q":
                damage = 10
                break
              case "e":
                damage = 20
                break
              case "c":
                heal = 25
                break
              case "x":
                damage = 30
                break
            }

            if (damage > 0) {
              this.sendGameAction('damage', { target: targetPlayer, amount: damage })
            } else if (heal > 0) {
              this.sendGameAction('heal', { target: this.playerNumber, amount: heal })
            }

            // Send ability notification
            this.sendGameAction('ability', { ability: key, target: targetPlayer })
          } catch (err) {
            console.error("Error in useAbility:", err)
          }
        }

        sendGameAction(action: string, payload: any) {
          if (socketRef.current) {
            socketRef.current.emit('gameAction', {
              roomId: this.roomId,
              action,
              payload
            })
          }
        }

        handleOpponentAbility(ability: string, target: number) {
          const abilityNames = {
            q: "Ember Shot",
            e: "Flame Wave",
            c: "Heal",
            x: "Ultimate"
          }
          
          const abilityName = abilityNames[ability as keyof typeof abilityNames] || "Unknown"
          this.showAbilityEffect(abilityName, 900, 250, "#ff9900")
        }

        checkAbilityPath(abilityKey: string) {
          try {
            if (abilityKey === "c") return true

            const myPlayer = this.playerNumber === 1 ? this.player1 : this.player2
            const playerX = myPlayer.x
            const playerY = myPlayer.y
            const centerX = 600

            let isBlocked = false
            
            this.pipes.children.entries.forEach((pipe: any) => {
              if (pipe.x > playerX && pipe.x < centerX) {
                const pipeTop = pipe.y - pipe.height / 2
                const pipeBottom = pipe.y + pipe.height / 2
                
                if (playerY >= pipeTop && playerY <= pipeBottom) {
                  isBlocked = true
                }
              }
            })

            return !isBlocked
          } catch (err) {
            console.error("Error in checkAbilityPath:", err)
            return true
          }
        }

        showAbilityEffect(text: string, x: number, y: number, color = "#ffff00") {
          try {
            const effectText = this.add
              .text(x, y, text, {
                fontSize: "20px",
                color: color,
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 2,
              })
              .setOrigin(0.5)

            this.tweens.add({
              targets: effectText,
              y: y - 50,
              alpha: 0,
              scale: 1.5,
              duration: 1000,
              onComplete: () => effectText.destroy(),
            })
          } catch (err) {
            console.error("Error in showAbilityEffect:", err)
          }
        }

        endGame(winner: string, reason: string) {
          try {
            this.gameOver = true
            this.gameOverText = this.add
              .text(600, 250, winner, {
                fontSize: "48px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 4,
              })
              .setOrigin(0.5)

            this.add
              .text(600, 300, reason, {
                fontSize: "24px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
              })
              .setOrigin(0.5)

            this.add
              .text(600, 350, "Press R to restart or ESC to menu", {
                fontSize: "18px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
              })
              .setOrigin(0.5)
          } catch (err) {
            console.error("Error in endGame:", err)
          }
        }

        update() {
          if (this.gameOver) return

          try {
            // Clean up pipes that are off screen and update score
            this.pipes.children.entries.forEach((pipe: any) => {
              if (pipe.x < -100) {
                if (pipe.side === "left" && !pipe.scored) {
                  this.player1.score++
                  updateGameStats((prev) => ({ ...prev, player1Score: prev.player1Score + 1 }))
                  pipe.scored = true
                } else if (pipe.side === "right" && !pipe.scored) {
                  this.player2.score++
                  updateGameStats((prev) => ({ ...prev, player2Score: prev.player2Score + 1 }))
                  pipe.scored = true
                }
                pipe.destroy()
              }
            })

            // Reset horizontal velocity gradually
            if (this.player1) {
              this.player1.setVelocityX(this.player1.body.velocity.x * 0.9)
            }
            if (this.player2) {
              this.player2.setVelocityX(this.player2.body.velocity.x * 0.9)
            }

            // Update UI with current stats
            if (this.player1HPText) this.player1HPText.setText(`HP: ${this.player1.hp}`)
            if (this.player2HPText) this.player2HPText.setText(`HP: ${this.player2.hp}`)
            if (this.player1ScoreText) this.player1ScoreText.setText(`Score: ${this.player1.score}`)
            if (this.player2ScoreText) this.player2ScoreText.setText(`Score: ${this.player2.score}`)
          } catch (err) {
            console.error("Error in update:", err)
          }
        }
      }

      // Game configuration
      const config = {
        type: Phaser.AUTO,
        width: 1200,
        height: 600,
        parent: gameRef.current,
        backgroundColor: "#87CEEB",
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 300 },
            debug: false,
          },
        },
        scene: GameScene,
      }

      // Create and start the game
      const game = new Phaser.Game(config)
      setGameLoaded(true)

      return () => {
        if (game) {
          game.destroy(true)
        }
      }
    } catch (err) {
      console.error("Failed to load game:", err)
      setError(`Failed to load game: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const handleBackToMenu = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    window.location.href = "/"
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-red-600">Game Error</h2>
            <p className="text-gray-700">{error}</p>
            <Button onClick={handleBackToMenu} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (matchStatus === 'searching') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-600 via-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
            <h2 className="text-2xl font-bold text-gray-800">Finding Opponent</h2>
            <p className="text-gray-600">Looking for another player to battle...</p>
            <Button onClick={handleBackToMenu} variant="outline" className="w-full mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel & Back to Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (matchStatus === 'found') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-600 via-blue-600 to-purple-600 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl">⚔️</div>
            <h2 className="text-2xl font-bold text-gray-800">Match Found!</h2>
            <p className="text-gray-600">
              You will battle against <span className="font-bold text-purple-600">{matchData?.opponent}</span>
            </p>
            <p className="text-sm text-gray-500">Starting game...</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {!gameLoaded && matchStatus === 'playing' && (
        <div className="text-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-white">Loading Battle Arena...</p>
        </div>
      )}

      <div
        ref={gameRef}
        className="border-4 border-white rounded-lg shadow-2xl"
        style={{ width: "1200px", height: "600px" }}
      />

      {gameLoaded && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-white text-center">
          <div className="bg-red-600/80 p-2 rounded">
            <p className="font-bold">
              {matchData?.playerNumber === 1 ? "You" : matchData?.opponent}: {gameStats.player1HP} HP
            </p>
            <p>Score: {gameStats.player1Score}</p>
          </div>
          <div className="bg-blue-600/80 p-2 rounded">
            <p className="font-bold">
              {matchData?.playerNumber === 2 ? "You" : matchData?.opponent}: {gameStats.player2HP} HP
            </p>
            <p>Score: {gameStats.player2Score}</p>
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <Button onClick={handleBackToMenu} variant="outline" className="bg-white/90">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Menu
        </Button>
      </div>

      {gameLoaded && (
        <div className="mt-4 text-white text-center text-sm">
          <p>🎮 Use WASD to move, Q/E/C/X for abilities</p>
          <p>⚔️ Real multiplayer battle against {matchData?.opponent}!</p>
        </div>
      )}
    </div>
  )
}

// Extend window type for global game scene access
declare global {
  interface Window {
    gameScene?: any
  }
}