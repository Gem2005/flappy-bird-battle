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
  myName?: string
}

interface GameData {
  matchData: MatchData
  selectedBird: string
  opponentBird: string
  gameReady: boolean
  socketId?: string
}

export default function GamePage() {
  const gameRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const gameInstanceRef = useRef<any>(null)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchStatus, setMatchStatus] = useState<'loading' | 'connecting' | 'playing' | 'ended'>('loading')
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [gameStats, setGameStats] = useState<GameStats>({
    player1HP: 100,
    player2HP: 100,
    player1Score: 0,
    player2Score: 0,
  })

  const updateGameStats = useCallback((updater: (prev: GameStats) => GameStats) => {
    setGameStats(updater)
  }, [])

  // UPDATED: Load game with existing match data
  const loadGame = useCallback(async (gameInfo: GameData) => {
    try {
      console.log('🎮 Starting game load with existing match...', gameInfo)
      
      if (typeof window === "undefined") {
        throw new Error("Game can only run in browser environment")
      }

      // Wait for DOM to be ready
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(true)
        } else {
          window.addEventListener('load', resolve, { once: true })
        }
      })

      // Check game container exists with retry logic
      let retries = 0
      const maxRetries = 10
      
      while (!gameRef.current && retries < maxRetries) {
        console.log(`⏳ Waiting for game container... (attempt ${retries + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      if (!gameRef.current) {
        throw new Error("Game container not found after retries. Please refresh the page.")
      }

      console.log('✅ Game container found, loading Phaser...')

      // Clear any existing game content
      if (gameRef.current) {
        gameRef.current.innerHTML = ''
      }

      // Destroy existing game instance if it exists
      if (gameInstanceRef.current) {
        try {
          gameInstanceRef.current.destroy(true)
        } catch (e) {
          console.warn('Error destroying previous game instance:', e)
        }
        gameInstanceRef.current = null
      }

      // Dynamic import of Phaser
      const PhaserModule = await import("phaser")
      const Phaser = PhaserModule.default

      console.log('✅ Phaser loaded successfully')

      // Get player data
      const playerName = typeof window !== "undefined" 
        ? localStorage.getItem("playerName") || "Player"
        : "Player"      // Bird data definitions
      const birds = [
        {
          id: "phoenix",
          name: "Phoenix",
          hp: 80,
          speed: 90,
          attack: 100,
          color: "from-red-500 to-orange-500",
          abilities: {
            normal: { name: "Ember Shot", key: "Q", damage: 10, description: "10 damage projectile" },
            signature: { name: "Flame Wave", key: "E", effect: "20 AoE", description: "20 AoE damage wave" },
            ultimate: { name: "Rebirth", key: "X", effect: "Heal 50", description: "Heal 50 HP (once per match)" },
          },
        },
        {
          id: "frostbeak",
          name: "Frostbeak",
          hp: 90,
          speed: 70,
          attack: 75,
          color: "from-blue-500 to-cyan-500",
          abilities: {
            normal: { name: "Ice Shard", key: "Q", damage: 8, description: "8 damage + slow effect" },
            signature: { name: "Blizzard", key: "E", effect: "Obstacle", description: "Creates obstacle for opponent" },
            ultimate: { name: "Freeze Time", key: "X", effect: "Freeze 3s", description: "Freezes opponent for 3 seconds" },
          },
        },
        {
          id: "thunderwing",
          name: "Thunderwing",
          hp: 70,
          speed: 100,
          attack: 80,
          color: "from-yellow-500 to-purple-500",
          abilities: {
            normal: { name: "Shock Bolt", key: "Q", damage: 12, description: "12 damage lightning" },
            signature: { name: "Wind Gust", key: "E", effect: "Push", description: "Pushes opponent toward obstacles" },
            ultimate: {
              name: "Lightning Strike",
              key: "X",
              effect: "30 Chain",
              description: "30 damage, chains to obstacles",
            },
          },
        },
        {
          id: "shadowfeather",
          name: "Shadowfeather",
          hp: 60,
          speed: 85,
          attack: 90,
          color: "from-purple-500 to-gray-800",
          abilities: {
            normal: { name: "Shadow Strike", key: "Q", damage: 15, description: "15 damage stealth attack" },
            signature: { name: "Vanish", key: "E", effect: "Invuln 2s", description: "2 seconds invulnerability" },
            ultimate: {
              name: "Nightmare",
              key: "X",
              effect: "Reverse",
              description: "Reverses controls + disables abilities",
            },
          },
        },
      ]      // Create Phaser Scene class
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
        private playerNamesText: any
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
        private selectedBird: string
        private opponentBird: string
        private myBirdData: any
        private opponentBirdData: any
        private playerEffects: any = {}
        private rebirthUsed = false
        private effectIndicators: any[] = []

        constructor() {
          super({ key: "GameScene" })
          this.playerNumber = gameInfo.matchData.playerNumber
          this.roomId = gameInfo.matchData.roomId
          this.selectedBird = gameInfo.selectedBird
          this.opponentBird = gameInfo.opponentBird
          
          // Find bird data for both players
          this.myBirdData = birds.find(bird => bird.id === this.selectedBird) || birds[0]
          this.opponentBirdData = birds.find(bird => bird.id === this.opponentBird) || birds[0]
          
          console.log('🐦 Bird data loaded:', {
            my: this.myBirdData.name,
            opponent: this.opponentBirdData.name
          })
        }

        preload() {
          try {
            console.log('🎨 Creating game assets...')
            console.log('🐦 My bird:', this.selectedBird, 'Opponent bird:', this.opponentBird)
            
            // Create simple colored rectangles for birds based on selection
            this.add.graphics()
              .fillStyle(0xff6b6b)
              .fillRect(0, 0, 32, 32)
              .generateTexture("bird1", 32, 32)
              .destroy()

            this.add.graphics()
              .fillStyle(0x00FF00) // Bright green color for better visibility
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

            console.log('✅ Game assets created')
          } catch (err) {
            console.error("❌ Error in preload:", err)
          }
        }

        create() {
          try {
            console.log('🏗️ Creating game scene...')
            
            // Store scene reference globally for socket communication
            window.gameScene = this            // Create split screen divider
            this.add.graphics()
              .lineStyle(4, 0xffffff)
              .moveTo(800, 0)
              .lineTo(800, 800)
              .stroke()

            // Create background clouds
            for (let i = 0; i < 5; i++) {
              this.add
                .image(Phaser.Math.Between(0, 1600), Phaser.Math.Between(50, 150), "cloud")
                .setAlpha(0.3)
                .setScale(0.5)
            }            // Create players with physics and bird-specific stats - positioned at extreme sides
            this.player1 = this.physics.add.sprite(50, 325, "bird1")
            this.player1.setBounce(0.2)
            this.player1.setCollideWorldBounds(true)
            this.player1.setScale(1.5)
            this.player1.body.setSize(20, 20)
            this.player1.body.setGravityY(300) // Individual gravity for bird
            this.player1.hp = this.playerNumber === 1 ? this.myBirdData.hp : this.opponentBirdData.hp
            this.player1.score = 0

            this.player2 = this.physics.add.sprite(1550,325, "bird2")
            this.player2.setBounce(0.2)
            this.player2.setCollideWorldBounds(true)
            this.player2.setScale(1.5)
            this.player2.body.setSize(20, 20)
            this.player2.body.setGravityY(300) // Individual gravity for bird
            this.player2.hp = this.playerNumber === 2 ? this.myBirdData.hp : this.opponentBirdData.hp
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
            console.log('✅ Game scene created successfully')
          } catch (err) {
            console.error("❌ Error in create:", err)
          }
        }

        createUI() {
          try {
            // Player names based on player number
            const myName = playerName
            const opponentName = gameInfo.matchData.opponent            // Player 1 UI (left side) with proper depth
            this.add.text(20, 20, this.playerNumber === 1 ? myName : opponentName, {
              fontSize: "24px",
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)

            this.player1HPText = this.add.text(20, 50, "HP: 100", {
              fontSize: "20px",
              color: "#ff6b6b",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)

            this.player1ScoreText = this.add.text(20, 80, "Score: 0", {
              fontSize: "20px",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)            // Player 2 UI (right side) with proper depth
            this.add.text(820, 20, this.playerNumber === 2 ? myName : opponentName, {
              fontSize: "24px",
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)

            this.player2HPText = this.add.text(820, 50, "HP: 100", {
              fontSize: "20px",
              color: "#4ecdc4",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)

            this.player2ScoreText = this.add.text(820, 80, "Score: 0", {
              fontSize: "20px",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 2,
            }).setDepth(1000)// Show ability UI for current player
            const abilityUIX = this.playerNumber === 1 ? 20 : 820            // Bird-specific ability cooldown UI with improved visibility and consistent colors
            this.abilityTexts.q = this.add.text(abilityUIX, 120, `Q - ${this.myBirdData.abilities.normal.name}: Ready`, {
              fontSize: "18px",
              color: "#00ff00",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
              shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 2,
                fill: true
              }
            }).setDepth(1000)
            this.abilityTexts.e = this.add.text(abilityUIX, 145, `E - ${this.myBirdData.abilities.signature.name}: Ready`, {
              fontSize: "18px",
              color: "#00ff00",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
              shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 2,
                fill: true
              }
            }).setDepth(1000)
            this.abilityTexts.c = this.add.text(abilityUIX, 170, "C - Universal Heal: Ready", {
              fontSize: "18px",
              color: "#00ff00",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
              shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 2,
                fill: true
              }
            }).setDepth(1000)
            this.abilityTexts.x = this.add.text(abilityUIX, 195, `X - ${this.myBirdData.abilities.ultimate.name}: Ready`, {
              fontSize: "18px",
              color: "#00ff00",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
              shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 2,
                fill: true
              }
            }).setDepth(1000)            // Controls help with improved visibility and proper depth
            this.add.text(abilityUIX, 235, "Controls:", {
              fontSize: "18px",
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
              shadow: {
                offsetX: 1,
                offsetY: 1,
                color: "#000000",
                blur: 1,
                fill: true
              }
            }).setDepth(1000)
            this.add.text(abilityUIX, 260, "W/S: Up/Down", { 
              fontSize: "16px", 
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 1
            }).setDepth(1000)
            this.add.text(abilityUIX, 280, "A/D: Left/Right", { 
              fontSize: "16px", 
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 1
            }).setDepth(1000)
            this.add.text(abilityUIX, 300, "Q/E/C/X: Abilities", { 
              fontSize: "16px", 
              color: "#ffffff",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 1
            }).setDepth(1000)
          } catch (err) {
            console.error("Error in createUI:", err)
          }
        }

        setupControls() {
          try {
            // Create keyboard input
            this.cursors = this.input.keyboard?.createCursorKeys()
            this.wasd = this.input.keyboard?.addKeys('W,S,A,D,Q,E,C,X,ESC')

            // Get the player we should control
            const myPlayer = this.playerNumber === 1 ? this.player1 : this.player2            // Movement controls using WASD (with nightmare effect support)
            if (this.wasd && myPlayer) {
              this.wasd.W.on('down', () => {
                if (!this.gameOver && myPlayer && !this.playerEffects.frozen) {
                  // Reverse direction if nightmare effect is active
                  const velocityY = this.playerEffects.nightmare ? 250 : -250
                  myPlayer.setVelocityY(velocityY)
                  this.showAbilityEffect("↑", myPlayer.x, myPlayer.y - 30)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.S.on('down', () => {
                if (!this.gameOver && myPlayer && !this.playerEffects.frozen) {
                  // Reverse direction if nightmare effect is active
                  const velocityY = this.playerEffects.nightmare ? -250 : 250
                  myPlayer.setVelocityY(velocityY)
                  this.showAbilityEffect("↓", myPlayer.x, myPlayer.y + 30)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.A.on('down', () => {
                if (!this.gameOver && myPlayer && !this.playerEffects.frozen) {
                  // Reverse direction if nightmare effect is active
                  const velocityX = this.playerEffects.nightmare ? 150 : -150
                  myPlayer.setVelocityX(velocityX)
                  this.showAbilityEffect("←", myPlayer.x - 30, myPlayer.y)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })

              this.wasd.D.on('down', () => {
                if (!this.gameOver && myPlayer && !this.playerEffects.frozen) {
                  // Reverse direction if nightmare effect is active
                  const velocityX = this.playerEffects.nightmare ? -150 : 150
                  myPlayer.setVelocityX(velocityX)
                  this.showAbilityEffect("→", myPlayer.x + 30, myPlayer.y)
                  this.sendMovement('move', myPlayer.x, myPlayer.y, myPlayer.body.velocity.x, myPlayer.body.velocity.y)
                }
              })              // Ability controls with bird-specific cooldowns and effects
              this.wasd.Q.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.q <= 0 && !this.playerEffects.nightmare) {
                  this.useAbility("q", this.myBirdData.abilities.normal.name)
                  this.startCooldown("q", 6)
                }
              })

              this.wasd.E.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.e <= 0 && !this.playerEffects.nightmare) {
                  this.useAbility("e", this.myBirdData.abilities.signature.name)
                  this.startCooldown("e", 10)
                }
              })

              this.wasd.C.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.c <= 0) {
                  this.useAbility("c", "Universal Heal")
                  this.startCooldown("c", 10) // 10 second cooldown for universal heal
                }
              })

              this.wasd.X.on('down', () => {
                if (!this.gameOver && this.abilityCooldowns.x <= 0 && !this.playerEffects.nightmare) {
                  this.useAbility("x", this.myBirdData.abilities.ultimate.name)
                  this.startCooldown("x", 15)
                }
              })// Game menu controls
              this.wasd.ESC.on('down', () => {
                if (this.gameOver) {
                  window.location.href = "/matchmaking"
                }
              })
            }
          } catch (err) {
            console.error("Error in setupControls:", err)
          }
        }

        sendMovement(action: string, x: number, y: number, velocityX: number, velocityY: number) {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('gameAction', {
              roomId: this.roomId,
              action: 'move',
              payload: { action, x, y, velocityX, velocityY }
            })
          }
        }        startCooldown(ability: string, seconds: number) {
          try {
            this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns] = seconds
            
            if (this.cooldownTimers[ability]) {
              this.cooldownTimers[ability].remove()
            }

            // Get the correct ability name for display
            let abilityDisplayName = ability.toUpperCase()
            if (ability === "c") {
              abilityDisplayName = "C - Universal Heal"
            } else if (this.myBirdData) {
              switch (ability) {
                case "q":
                  abilityDisplayName = `Q - ${this.myBirdData.abilities.normal.name}`
                  break
                case "e":
                  abilityDisplayName = `E - ${this.myBirdData.abilities.signature.name}`
                  break
                case "x":
                  abilityDisplayName = `X - ${this.myBirdData.abilities.ultimate.name}`
                  break
              }
            }

            if (this.abilityTexts[ability]) {
              this.abilityTexts[ability].setText(`${abilityDisplayName}: ${seconds}s`)
            }

            this.cooldownTimers[ability] = this.time.addEvent({
              delay: 1000,
              callback: () => {
                this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns]--
                
                const cooldown = this.abilityCooldowns[ability as keyof typeof this.abilityCooldowns]
                const text = cooldown > 0 ? `${abilityDisplayName}: ${cooldown}s` : `${abilityDisplayName}: Ready`
                
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
        }        spawnPipes() {
          if (this.gameOver) return

          try {            
            const canvasHeight = 800;
            const canvasWidth = 1600;
            const pipeWidth = 64;
            const gap = 200; // Gap between top and bottom pipes
            const centerX = canvasWidth / 2; // 800
            const pipeY = Phaser.Math.Between(200, canvasHeight - 200); // vertical center of gap

            // Calculate actual visible heights
            const topPipeHeight = pipeY - gap / 2;
            const bottomPipeHeight = canvasHeight - (pipeY + gap / 2);

            // === LEFT SIDE PIPES ===
            const topPipeLeft = this.pipes.create(centerX, pipeY - gap / 2, "pipe")
                .setOrigin(0.5, 1)
                .setDisplaySize(pipeWidth, topPipeHeight)
                .setVelocityX(-120);
            topPipeLeft.body.setAllowGravity(false);
            topPipeLeft.body.setImmovable(true);
            topPipeLeft.side = "left";

            const bottomPipeLeft = this.pipes.create(centerX, pipeY + gap / 2, "pipe")
                .setOrigin(0.5, 0)
                .setDisplaySize(pipeWidth, bottomPipeHeight)
                .setVelocityX(-120);
            bottomPipeLeft.body.setAllowGravity(false);
            bottomPipeLeft.body.setImmovable(true);
            bottomPipeLeft.side = "left";

            // === RIGHT SIDE PIPES ===
            const topPipeRight = this.pipes.create(centerX, pipeY - gap / 2, "pipe")
                .setOrigin(0.5, 1)
                .setDisplaySize(pipeWidth, topPipeHeight)
                .setVelocityX(120);
            topPipeRight.body.setAllowGravity(false);
            topPipeRight.body.setImmovable(true);
            topPipeRight.side = "right";

            const bottomPipeRight = this.pipes.create(centerX, pipeY + gap / 2, "pipe")
                .setOrigin(0.5, 0)
                .setDisplaySize(pipeWidth, bottomPipeHeight)
                .setVelocityX(120);
            bottomPipeRight.body.setAllowGravity(false);
            bottomPipeRight.body.setImmovable(true);
            bottomPipeRight.side = "right";

            // Set up collisions for both players with all pipes (universal collision system)
            this.physics.add.overlap(this.player1, [topPipeLeft, bottomPipeLeft, topPipeRight, bottomPipeRight], () => {
              if (!this.gameOver && !this.playerEffects.invulnerable) {
                this.sendGameAction('damage', { target: 1, amount: 100 })
              }
            })

            this.physics.add.overlap(this.player2, [topPipeLeft, bottomPipeLeft, topPipeRight, bottomPipeRight], () => {
              if (!this.gameOver && !this.playerEffects.invulnerable) {
                this.sendGameAction('damage', { target: 2, amount: 100 })
              }
            })            // Clean up pipes that go off screen
            const allPipes = [topPipeLeft, bottomPipeLeft, topPipeRight, bottomPipeRight]
            allPipes.forEach((pipe: any) => {
              this.time.delayedCall(8000, () => {
                if (pipe && pipe.active) {
                  pipe.destroy()
                }
              })
            })
          } catch (err) {
            console.error("Error in spawnPipes:", err)
          }
        }useAbility(key: string, abilityName: string) {
          try {
            const myPlayer = this.playerNumber === 1 ? this.player1 : this.player2
            const opponentPlayer = this.playerNumber === 1 ? this.player2 : this.player1
            const targetPlayer = this.playerNumber === 1 ? 2 : 1

            // Universal C key healing (15 HP, works for all birds)
            if (key === "c") {
              this.showAbilityEffect("Universal Heal +15 HP", myPlayer.x, myPlayer.y - 60, "#00ff00")
              this.sendGameAction('heal', { target: this.playerNumber, amount: 15 })
              return
            }

            // Check if ability can pass through pipes (except for certain abilities)
            const abilitiesThatIgnorePipes = ["vanish", "rebirth", "freeze time", "nightmare"]
            const canPassThroughPipes = abilitiesThatIgnorePipes.some(ability => 
              abilityName.toLowerCase().includes(ability)) || this.checkAbilityPath(key)
            
            if (!canPassThroughPipes) {
              this.showAbilityEffect("Blocked by pipe!", myPlayer.x, myPlayer.y - 60, "#ff9900")
              return
            }

            // Bird-specific abilities based on selected bird
            switch (this.selectedBird) {
              case "phoenix":
                this.handlePhoenixAbilities(key, abilityName, myPlayer, opponentPlayer, targetPlayer)
                break
              case "frostbeak":
                this.handleFrostbeakAbilities(key, abilityName, myPlayer, opponentPlayer, targetPlayer)
                break
              case "thunderwing":
                this.handleThunderwingAbilities(key, abilityName, myPlayer, opponentPlayer, targetPlayer)
                break
              case "shadowfeather":
                this.handleShadowfeatherAbilities(key, abilityName, myPlayer, opponentPlayer, targetPlayer)
                break
              default:
                // Fallback to generic abilities
                this.handleGenericAbility(key, abilityName, targetPlayer)
                break
            }

            // Send ability notification to opponent
            this.sendGameAction('ability', { ability: key, target: targetPlayer, birdType: this.selectedBird })
          } catch (err) {
            console.error("Error in useAbility:", err)
          }
        }

        handlePhoenixAbilities(key: string, abilityName: string, myPlayer: any, opponentPlayer: any, targetPlayer: number) {
          switch (key) {
            case "q": // Ember Shot - 10 damage projectile
              this.showAbilityEffect("🔥 Ember Shot", myPlayer.x + 50, myPlayer.y, "#ff4500")
              this.sendGameAction('damage', { target: targetPlayer, amount: 10 })
              break
            case "e": // Flame Wave - 20 AoE damage
              this.showAbilityEffect("🌊 Flame Wave", 800, 400, "#ff6600")
              this.sendGameAction('damage', { target: targetPlayer, amount: 20 })
              break
            case "x": // Rebirth - Heal 50 HP (once per match)
              if (this.rebirthUsed) {
                this.showAbilityEffect("Rebirth already used!", myPlayer.x, myPlayer.y - 60, "#ff9900")
                return
              }
              this.rebirthUsed = true
              this.showAbilityEffect("🔥 REBIRTH +50 HP", myPlayer.x, myPlayer.y - 60, "#ff0000")
              this.sendGameAction('heal', { target: this.playerNumber, amount: 50 })
              break
          }
        }

        handleFrostbeakAbilities(key: string, abilityName: string, myPlayer: any, opponentPlayer: any, targetPlayer: number) {
          switch (key) {
            case "q": // Ice Shard - 8 damage + slow effect
              this.showAbilityEffect("❄️ Ice Shard", myPlayer.x + 50, myPlayer.y, "#00bfff")
              this.sendGameAction('damage', { target: targetPlayer, amount: 8 })
              this.applySlowEffect(opponentPlayer)
              break
            case "e": // Blizzard - Creates obstacle for opponent
              this.showAbilityEffect("🌨️ Blizzard Storm", opponentPlayer.x, opponentPlayer.y, "#87ceeb")
              this.createBlizzardObstacle(opponentPlayer)
              break
            case "x": // Freeze Time - Freezes opponent for 3 seconds
              this.showAbilityEffect("🧊 FREEZE TIME", opponentPlayer.x, opponentPlayer.y - 60, "#00ffff")
              this.applyFreezeEffect(opponentPlayer, 3000)
              break
          }
        }

        handleThunderwingAbilities(key: string, abilityName: string, myPlayer: any, opponentPlayer: any, targetPlayer: number) {
          switch (key) {
            case "q": // Shock Bolt - 12 damage lightning
              this.showAbilityEffect("⚡ Shock Bolt", myPlayer.x + 50, myPlayer.y, "#ffff00")
              this.sendGameAction('damage', { target: targetPlayer, amount: 12 })
              break
            case "e": // Wind Gust - Pushes opponent toward obstacles
              this.showAbilityEffect("💨 Wind Gust", opponentPlayer.x, opponentPlayer.y, "#87ceeb")
              this.applyWindGustEffect(opponentPlayer)
              break
            case "x": // Lightning Strike - 30 damage, chains to obstacles
              this.showAbilityEffect("⚡ LIGHTNING STRIKE", opponentPlayer.x, opponentPlayer.y - 60, "#ffff00")
              this.sendGameAction('damage', { target: targetPlayer, amount: 30 })
              this.createLightningChain(opponentPlayer)
              break
          }
        }

        handleShadowfeatherAbilities(key: string, abilityName: string, myPlayer: any, opponentPlayer: any, targetPlayer: number) {
          switch (key) {
            case "q": // Shadow Strike - 15 damage stealth attack
              this.showAbilityEffect("🌙 Shadow Strike", myPlayer.x + 50, myPlayer.y, "#4b0082")
              this.sendGameAction('damage', { target: targetPlayer, amount: 15 })
              break
            case "e": // Vanish - 2 seconds invulnerability
              this.showAbilityEffect("👻 VANISH", myPlayer.x, myPlayer.y - 60, "#9370db")
              this.applyInvulnerabilityEffect(myPlayer, 2000)
              break
            case "x": // Nightmare - Reverses controls + disables abilities
              this.showAbilityEffect("💀 NIGHTMARE", opponentPlayer.x, opponentPlayer.y - 60, "#800080")
              this.applyNightmareEffect(opponentPlayer, 5000)
              break
          }
        }

        handleGenericAbility(key: string, abilityName: string, targetPlayer: number) {
          let damage = 0
          switch (key) {
            case "q": damage = 10; break
            case "e": damage = 20; break
            case "x": damage = 30; break
          }
          
          if (damage > 0) {
            this.showAbilityEffect(abilityName, 800, 350, "#ffff00")
            this.sendGameAction('damage', { target: targetPlayer, amount: damage })
          }
        }

        // Effect application methods
        applySlowEffect(player: any) {
          if (!player) return
          this.playerEffects.slow = true
          player.body.setMaxVelocity(75, 150) // Reduced speed
          this.addEffectIndicator(player, "slow", 3000)
          setTimeout(() => {
            this.playerEffects.slow = false
            player.body.setMaxVelocity(150, 300) // Normal speed
            this.removeEffectIndicator(player, "slow")
          }, 3000)
        }

        createBlizzardObstacle(player: any) {
          if (!player) return
          const obstacle = this.add.graphics()
            .fillStyle(0x87ceeb)
            .fillRect(player.x - 50, player.y - 100, 100, 200)
          
          setTimeout(() => obstacle.destroy(), 4000)
        }

        applyFreezeEffect(player: any, duration: number) {
          if (!player) return
          this.playerEffects.frozen = true
          const originalVelocity = { x: player.body.velocity.x, y: player.body.velocity.y }
          player.setVelocity(0, 0)
          player.body.setEnable(false)
          this.addEffectIndicator(player, "frozen", duration)
          
          setTimeout(() => {
            this.playerEffects.frozen = false
            player.body.setEnable(true)
            this.removeEffectIndicator(player, "frozen")
          }, duration)
        }

        applyWindGustEffect(player: any) {
          if (!player) return
          player.setVelocity(100, -100) // Push toward obstacles
        }

        createLightningChain(player: any) {
          if (!player) return
          // Visual lightning effect
          const lightning = this.add.graphics()
            .lineStyle(4, 0xffff00)
            .moveTo(player.x, player.y)
            .lineTo(player.x + 200, player.y + 100)
          
          setTimeout(() => lightning.destroy(), 1000)
        }

        applyInvulnerabilityEffect(player: any, duration: number) {
          if (!player) return
          this.playerEffects.invulnerable = true
          player.setAlpha(0.5) // Visual indicator
          this.addEffectIndicator(player, "invulnerable", duration)
          
          setTimeout(() => {
            this.playerEffects.invulnerable = false
            player.setAlpha(1)
            this.removeEffectIndicator(player, "invulnerable")
          }, duration)
        }

        applyNightmareEffect(player: any, duration: number) {
          if (!player) return
          this.playerEffects.nightmare = true
          // Controls will be reversed in the control handlers
          this.addEffectIndicator(player, "nightmare", duration)
          
          setTimeout(() => {
            this.playerEffects.nightmare = false
            this.removeEffectIndicator(player, "nightmare")
          }, duration)
        }

        // Effect indicator management methods
        addEffectIndicator(player: any, effectType: string, duration: number) {
          if (!player) return

          const indicator = {
            player: player,
            effectType: effectType,
            startTime: Date.now(),
            duration: duration,
            text: null as any
          }

          // Create visual indicator text
          const effectColors = {
            slow: "#87ceeb",
            frozen: "#00ffff", 
            invulnerable: "#9370db",
            nightmare: "#800080"
          }

          const effectEmojis = {
            slow: "🧊",
            frozen: "❄️",
            invulnerable: "👻",
            nightmare: "💀"
          }

          try {
            indicator.text = this.add.text(player.x, player.y - 80, effectEmojis[effectType as keyof typeof effectEmojis] || "✨", {
              fontSize: "24px",
              color: effectColors[effectType as keyof typeof effectColors] || "#ffff00",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            }).setOrigin(0.5)

            this.effectIndicators.push(indicator)
          } catch (err) {
            console.error("Error creating effect indicator:", err)
          }
        }

        removeEffectIndicator(player: any, effectType: string) {
          this.effectIndicators = this.effectIndicators.filter(indicator => {
            if (indicator.player === player && indicator.effectType === effectType) {
              if (indicator.text) indicator.text.destroy()
              return false
            }
            return true
          })
        }

        updateEffectIndicators() {
          const currentTime = Date.now()
          
          this.effectIndicators = this.effectIndicators.filter(indicator => {
            const elapsed = currentTime - indicator.startTime
            
            if (elapsed >= indicator.duration) {
              // Remove expired indicators
              if (indicator.text) indicator.text.destroy()
              return false
            }
            
            // Update position to follow player
            if (indicator.text && indicator.player) {
              indicator.text.x = indicator.player.x
              indicator.text.y = indicator.player.y - 80
              
              // Fade effect near expiration
              const remaining = indicator.duration - elapsed
              if (remaining < 1000) {
                indicator.text.setAlpha(remaining / 1000)
              }
            }
            
            return true
          })
        }

        sendGameAction(action: string, payload: any) {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('gameAction', {
              roomId: this.roomId,
              action,
              payload
            })
          }
        }        handleOpponentAbility(ability: string, target: number, birdType?: string) {
          // Get bird-specific ability names
          const opponentBirdData = this.opponentBirdData
          let abilityName = "Unknown"
          
          if (ability === "c") {
            abilityName = "Universal Heal"
          } else if (opponentBirdData) {
            switch (ability) {
              case "q":
                abilityName = opponentBirdData.abilities.normal.name
                break
              case "e":
                abilityName = opponentBirdData.abilities.signature.name
                break
              case "x":
                abilityName = opponentBirdData.abilities.ultimate.name
                break
            }
          }
          
          // Show appropriate visual effect
          const color = this.getBirdAbilityColor(birdType || this.opponentBird, ability)
          this.showAbilityEffect(`Opponent used ${abilityName}`, 800, 450, color)
          
          // Apply any visual effects based on opponent's bird type
          if (birdType) {
            this.showOpponentAbilityEffect(birdType, ability)
          }
        }

        getBirdAbilityColor(birdType: string, ability: string): string {
          const colorMap: { [key: string]: { [key: string]: string } } = {
            phoenix: { q: "#ff4500", e: "#ff6600", x: "#ff0000", c: "#00ff00" },
            frostbeak: { q: "#00bfff", e: "#87ceeb", x: "#00ffff", c: "#00ff00" },
            thunderwing: { q: "#ffff00", e: "#87ceeb", x: "#ffff00", c: "#00ff00" },
            shadowfeather: { q: "#4b0082", e: "#9370db", x: "#800080", c: "#00ff00" }
          }
          
          return colorMap[birdType]?.[ability] || "#ff9900"
        }

        showOpponentAbilityEffect(birdType: string, ability: string) {
          const opponentPlayer = this.playerNumber === 1 ? this.player2 : this.player1
          if (!opponentPlayer) return

          // Show bird-specific visual effects
          switch (birdType) {
            case "phoenix":
              if (ability === "q") this.showAbilityEffect("🔥", opponentPlayer.x - 50, opponentPlayer.y, "#ff4500")
              else if (ability === "e") this.showAbilityEffect("🌊🔥", 800, 400, "#ff6600")
              else if (ability === "x") this.showAbilityEffect("🔥 Phoenix rises!", opponentPlayer.x, opponentPlayer.y - 60, "#ff0000")
              break
            case "frostbeak":
              if (ability === "q") this.showAbilityEffect("❄️", opponentPlayer.x - 50, opponentPlayer.y, "#00bfff")
              else if (ability === "e") this.showAbilityEffect("🌨️ Blizzard incoming!", 300, 300, "#87ceeb")
              else if (ability === "x") this.showAbilityEffect("🧊 Time frozen!", 800, 400, "#00ffff")
              break
            case "thunderwing":
              if (ability === "q") this.showAbilityEffect("⚡", opponentPlayer.x - 50, opponentPlayer.y, "#ffff00")
              else if (ability === "e") this.showAbilityEffect("💨 Wind incoming!", 300, 300, "#87ceeb")
              else if (ability === "x") this.showAbilityEffect("⚡ Lightning strikes!", 800, 400, "#ffff00")
              break
            case "shadowfeather":
              if (ability === "q") this.showAbilityEffect("🌙", opponentPlayer.x - 50, opponentPlayer.y, "#4b0082")
              else if (ability === "e") this.showAbilityEffect("👻 Enemy vanished!", opponentPlayer.x, opponentPlayer.y - 60, "#9370db")
              else if (ability === "x") this.showAbilityEffect("💀 Nightmare curse!", 800, 400, "#800080")
              break
          }
        }

        checkAbilityPath(abilityKey: string) {
          try {
            if (abilityKey === "c") return true

            const myPlayer = this.playerNumber === 1 ? this.player1 : this.player2
            const playerX = myPlayer.x
            const playerY = myPlayer.y
            const centerX = 800

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
          try {            this.gameOver = true
            this.gameOverText = this.add
              .text(800, 350, winner, {
                fontSize: "48px",
                color: "#ffffff",
                fontStyle: "bold",
                stroke: "#000000",
                strokeThickness: 4,
              })
              .setOrigin(0.5)

            this.add
              .text(800, 400, reason, {
                fontSize: "24px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
              })              .setOrigin(0.5)

            this.add
              .text(800, 450, "Press ESC to find new match", {
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

            // Update effect indicators
            this.updateEffectIndicators()
          } catch (err) {
            console.error("Error in update:", err)
          }
        }
      }      // Game configuration
      const config = {
        type: Phaser.AUTO,
        width: 1600,
        height: 800,
        parent: gameRef.current,
        backgroundColor: "#87CEEB",
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scene: GameScene,
      }

      console.log('🎮 Creating Phaser game instance...')
      
      // Create and start the game
      gameInstanceRef.current = new Phaser.Game(config)
      setGameLoaded(true)
      setMatchStatus('playing')
      
      console.log('✅ Game loaded successfully!')

    } catch (err) {
      console.error("❌ Failed to load game:", err)
      setError(`Failed to load game: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [updateGameStats])

  // UPDATED: Enhanced data recovery from multiple sources
  useEffect(() => {
    console.log('🎮 Game page mounted, checking for existing game data...')
    
    try {
      // Try multiple data sources in order of preference
      let gameDataSource = null
      let parsedGameData: GameData | null = null

      // 1. Check window.gameData first (most recent)
      if (typeof window !== 'undefined' && window.gameData) {
        console.log('📦 Found game data in window.gameData')
        parsedGameData = window.gameData
        gameDataSource = 'window.gameData'
      }
      
      // 2. Check window.gameBackup
      else if (typeof window !== 'undefined' && window.gameBackup?.gameData) {
        console.log('📦 Found game data in window.gameBackup')
        parsedGameData = window.gameBackup.gameData
        gameDataSource = 'window.gameBackup'
      }
      
      // 3. Check sessionStorage
      else {
        const sessionData = sessionStorage.getItem('gameData')
        if (sessionData) {
          console.log('📦 Found game data in sessionStorage')
          parsedGameData = JSON.parse(sessionData)
          gameDataSource = 'sessionStorage'
        }
      }

      // 4. Check localStorage as last resort
      if (!parsedGameData) {
        const storedGameData = localStorage.getItem('gameData')
        if (storedGameData) {
          console.log('📦 Found game data in localStorage')
          parsedGameData = JSON.parse(storedGameData)
          gameDataSource = 'localStorage'
        }
      }

      if (!parsedGameData) {
        console.log('❌ No game data found, redirecting to bird selection...')
        setError("No game data found. Please go through bird selection first.")
        return
      }

      console.log(`📦 Using game data from ${gameDataSource}:`, parsedGameData)
      
      if (!parsedGameData.gameReady || !parsedGameData.matchData) {
        console.log('❌ Invalid game data, redirecting...')
        setError("Invalid game data. Please restart the game.")
        return
      }

      setGameData(parsedGameData)
      setMatchStatus('connecting')

      // UPDATED: Enhanced socket preservation logic  
      const preservedSocket = (typeof window !== 'undefined' && window.gameSocket) || 
                             (typeof window !== 'undefined' && window.gameBackup?.socket)
      
      if (preservedSocket && preservedSocket.connected) {
        console.log('✅ Using preserved socket connection from bird selection')
        socketRef.current = preservedSocket
        
        // DON'T clear global references immediately - keep them for Strict Mode
        setupGameEventHandlers(preservedSocket, parsedGameData)
        
        preservedSocket.emit('joinGameRoom', {
          roomId: parsedGameData.matchData.roomId,
          playerNumber: parsedGameData.matchData.playerNumber,
          playerName: localStorage.getItem("playerName") || "Player"
        })
          } else {
        console.log('🔌 No preserved socket, creating new connection...')
        
        const socketUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_SOCKET_URL || 'https://flappy-bird-battle-production.up.railway.app')
          : 'http://localhost:3001'
        
        console.log('🔌 Connecting to socket URL:', socketUrl)
        
        socketRef.current = io(socketUrl, {
          transports: ['polling'], // Force polling only - no websocket
          forceNew: false,
          reconnection: true,
          timeout: 20000,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          upgrade: false, // DISABLE websocket upgrades
          rememberUpgrade: false // Don't remember websocket from previous sessions
        })

        const socket = socketRef.current

        socket.on('connect', () => {
          console.log('✅ Connected to server:', socket.id)
          
          socket.emit('joinGameRoom', {
            roomId: parsedGameData.matchData.roomId,
            playerNumber: parsedGameData.matchData.playerNumber,
            playerName: localStorage.getItem("playerName") || "Player"
          })
        })

        setupGameEventHandlers(socket, parsedGameData)
      }

    } catch (err) {
      console.error('❌ Error loading game:', err)
      setError("Failed to load game data")
    }

    return () => {
      console.log('🧹 Cleaning up game page...')
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (gameInstanceRef.current) {
        try {
          gameInstanceRef.current.destroy(true)
        } catch (e) {
          console.warn('Error destroying game instance:', e)
        }
        gameInstanceRef.current = null
      }
      // FIXED: Don't clear data on cleanup - let it persist for Strict Mode
      // Only clear localStorage, keep window and sessionStorage for backup
      localStorage.removeItem('gameData')
    }
  }, [])

  // NEW: Separate function to set up game event handlers
  const setupGameEventHandlers = useCallback((socket: Socket, gameData: GameData) => {
    // Handle game events
    socket.on('gameJoined', (data) => {
      console.log('✅ Joined game room successfully:', data)
      setMatchStatus('playing')
      
      // Start the game
      setTimeout(() => {
        loadGame(gameData)
      }, 1000)
    })

    socket.on('opponentMove', (data) => {
      if (window.gameScene) {
        const { action, x, y, velocityX, velocityY } = data
        if (action === 'move') {
          const opponentPlayer = gameData.matchData.playerNumber === 1 ? window.gameScene.player2 : window.gameScene.player1
          if (opponentPlayer) {
            opponentPlayer.setPosition(x, y)
            opponentPlayer.setVelocity(velocityX, velocityY)          }
        }
      }
    })

    socket.on('abilityUsed', (data) => {
      if (window.gameScene) {
        const { playerNumber, ability, target, birdType } = data
        if (playerNumber !== gameData.matchData.playerNumber) {
          window.gameScene.handleOpponentAbility(ability, target, birdType)
        }
      }
    })

    socket.on('healthUpdate', (data) => {
      updateGameStats((prev) => ({
        ...prev,
        player1HP: data.player1HP,
        player2HP: data.player2HP,
      }))
      
      // Update game objects HP
      if (window.gameScene) {
        if (window.gameScene.player1) window.gameScene.player1.hp = data.player1HP
        if (window.gameScene.player2) window.gameScene.player2.hp = data.player2HP
      }
    })

    socket.on('gameOver', (data) => {
      console.log('🏁 Game over:', data)
      if (window.gameScene) {
        const isWinner = data.winner === gameData.matchData.playerNumber
        window.gameScene.endGame(
          isWinner ? "You Win!" : "You Lose!",
          data.reason || "Game ended"
        )
      }
      setMatchStatus('ended')
    })

    socket.on('opponentDisconnected', () => {
      console.log('❌ Opponent disconnected')
      if (window.gameScene) {
        window.gameScene.endGame("You Win!", "Opponent disconnected")
      }
      setMatchStatus('ended')
    })

    socket.on('roomNotFound', () => {
      console.log('❌ Room not found')
      setError("Game room not found. The match may have expired.")
    })

    socket.on('error', (data) => {
      console.error('❌ Socket error:', data)
      setError(data.message || "Connection error occurred")
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      setError(`Connection failed: ${error.message}`)
    })
  }, [updateGameStats, loadGame])

  const handleBackToMenu = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    if (gameInstanceRef.current) {
      try {
        gameInstanceRef.current.destroy(true)
      } catch (e) {
        console.warn('Error destroying game instance:', e)
      }
    }
    localStorage.removeItem('gameData')
    window.location.href = "/"
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#D5B9FA] via-[#B083F9] to-[#8C5FD9] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-2xl font-bold text-red-600">Game Error</h2>
            <p className="text-gray-700">{error}</p>
            <div className="space-y-2">
              <Button onClick={() => window.location.href = "/bird-selection"} className="w-full">
                🔄 Go to Bird Selection
              </Button>
              <Button onClick={handleBackToMenu} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Menu
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (matchStatus === 'loading' || matchStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#B083F9] via-[#8C5FD9] to-[#D5B9FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
            <h2 className="text-2xl font-bold text-gray-800">
              {matchStatus === 'loading' ? 'Loading Game Data...' : 'Connecting to Battle...'}
            </h2>
            <p className="text-gray-600">
              {matchStatus === 'loading' 
                ? 'Preparing your battle arena...' 
                : `Joining battle against ${gameData?.matchData.opponent}...`
              }
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 flex flex-col items-center justify-center p-4">
      {!gameLoaded && matchStatus === 'playing' && (
        <div className="text-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-white">Loading Battle Arena...</p>
        </div>
      )}      {/* Always render game container */}
      <div
        ref={gameRef}
        className="border-4 border-white rounded-lg shadow-2xl"
        style={{ width: "1600px", height: "800px" }}
      />

      <div className="mt-4 text-center">
        <Button onClick={handleBackToMenu} variant="outline" className="bg-white/90">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Menu
        </Button>
      </div>

      {gameLoaded && gameData && (
        <div className="mt-4 text-white text-center text-sm">
          <p>🎮 Use WASD to move, Q/E/C/X for abilities</p>
          <p>⚔️ Real multiplayer battle against {gameData.matchData.opponent}!</p>
          <p>🐦 Your bird: {gameData.selectedBird} vs {gameData.opponentBird}</p>
        </div>
      )}
    </div>
  )
}

// Extend window type for global game scene access
declare global {
  interface Window {
    gameScene?: any
    gameSocket?: any
    gameData?: any
    gameBackup?: any
  }
}