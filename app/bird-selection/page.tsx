"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Lock, Zap, Heart, Gauge, Sword, ArrowLeft } from "lucide-react"
import { io, Socket } from "socket.io-client"
import { useRouter } from "next/navigation"

interface Bird {
  id: string
  name: string
  hp: number
  speed: number
  attack: number
  color: string
  abilities: {
    normal: { name: string; key: "Q"; damage: number; description: string }
    signature: { name: string; key: "E"; effect: string; description: string }
    ultimate: { name: string; key: "X"; effect: string; description: string }
  }
}

interface MatchData {
  roomId: string
  opponent: string
  playerNumber: number
}

const birds: Bird[] = [
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
]

export default function BirdSelectionPage() {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)
  const [selectedBird, setSelectedBird] = useState<string | null>(null)
  const [opponentBird, setOpponentBird] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState("")
  const [opponentName, setOpponentName] = useState("Waiting...")
  const [isReady, setIsReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'searching' | 'found' | 'selecting' | 'ready'>('connecting')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const name = localStorage.getItem("playerName") || "Player"
    setPlayerName(name)

    // Connect to Socket.io server
    socketRef.current = io(process.env.NODE_ENV === 'production' 
      ? process.env.NEXTAUTH_URL || window.location.origin
      : 'http://localhost:3001', {
      transports: ['websocket', 'polling']
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      setConnectionStatus('searching')
      // Start looking for a match
      socket.emit('findMatch', { name })
    })

    socket.on('queueJoined', (data) => {
      console.log('Joined queue, position:', data.position)
      setConnectionStatus('searching')
    })

    socket.on('matchFound', (data: MatchData) => {
      console.log('Match found:', data)
      setMatchData(data)
      setOpponentName(data.opponent)
      setConnectionStatus('selecting')
    })

    socket.on('birdSelected', (data: { playerNumber: number; birdId: string }) => {
      console.log('Bird selected by player:', data)
      
      if (matchData && data.playerNumber !== matchData.playerNumber) {
        // Opponent selected a bird
        setOpponentBird(data.birdId)
      }
    })

    socket.on('gameStart', (data: { player1Bird: string; player2Bird: string }) => {
      console.log('Game starting with birds:', data)
      
      // Store match data for the game
      localStorage.setItem('matchData', JSON.stringify(matchData))
      localStorage.setItem('selectedBird', selectedBird || 'phoenix')
      
      // Navigate to game
      router.push('/game')
    })

    socket.on('opponentDisconnected', () => {
      setError("Opponent disconnected. Returning to menu...")
      setTimeout(() => {
        router.push('/')
      }, 3000)
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
  }, [router, matchData, selectedBird])

  const handleBirdSelect = (birdId: string) => {
    if (!matchData || opponentBird === birdId || selectedBird === birdId) return
    
    setSelectedBird(birdId)
    setIsReady(false)
    
    // Send bird selection to server
    if (socketRef.current) {
      socketRef.current.emit('selectBird', {
        roomId: matchData.roomId,
        birdId: birdId
      })
    }
  }

  const handleReady = () => {
    if (!selectedBird || !matchData) return
    
    setIsReady(true)
    setConnectionStatus('ready')
    
    // Store selected bird
    localStorage.setItem("selectedBird", selectedBird)
    
    // The game will start automatically when both players are ready
    // This is handled by the server via the 'gameStart' event
  }

  const handleBackToMenu = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    router.push('/')
  }

  const getStatColor = (value: number) => {
    if (value >= 90) return "text-green-600"
    if (value >= 75) return "text-yellow-600"
    return "text-red-600"
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-600 via-red-500 to-red-400 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-2xl font-bold text-red-600">Connection Error</h2>
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

  // Loading/Searching state
  if (connectionStatus === 'connecting' || connectionStatus === 'searching') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-600 via-blue-600 to-blue-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
            <h2 className="text-2xl font-bold text-gray-800">
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Finding Opponent'}
            </h2>
            <p className="text-gray-600">
              {connectionStatus === 'connecting' 
                ? 'Connecting to server...' 
                : 'Looking for another player to battle...'
              }
            </p>
            <Button onClick={handleBackToMenu} variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel & Back to Menu
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Choose Your Fighter</h1>
          <div className="flex justify-center space-x-8 text-white">
            <div className="text-center">
              <p className="font-semibold">{playerName}</p>
              <Badge variant={isReady ? "default" : "secondary"}>
                {isReady ? "READY" : selectedBird ? "SELECTED" : "SELECTING"}
              </Badge>
            </div>
            <div className="text-2xl">VS</div>
            <div className="text-center">
              <p className="font-semibold">{opponentName}</p>
              <Badge variant={opponentReady ? "default" : "secondary"}>
                {opponentReady ? "READY" : opponentBird ? "SELECTED" : "SELECTING"}
              </Badge>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="mt-4">
            <Badge variant="outline" className="bg-white/20 text-white">
              Room: {matchData?.roomId ? matchData.roomId.slice(-8) : 'Connecting...'}
            </Badge>
          </div>
        </div>

        {/* Bird Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {birds.map((bird) => {
            const isSelected = selectedBird === bird.id
            const isOpponentSelected = opponentBird === bird.id
            const isLocked = isOpponentSelected

            return (
              <Card
                key={bird.id}
                className={`p-6 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "ring-4 ring-green-500 bg-green-50"
                    : isLocked
                      ? "opacity-50 cursor-not-allowed bg-gray-100"
                      : "hover:shadow-lg hover:scale-105 bg-white"
                }`}
                onClick={() => !isLocked && handleBirdSelect(bird.id)}
              >
                {/* Bird Header */}
                <div className="text-center mb-4">
                  <div
                    className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${bird.color} flex items-center justify-center mb-2`}
                  >
                    <div className="text-white text-2xl">🐦</div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{bird.name}</h3>

                  {/* Selection Status */}
                  <div className="mt-2">
                    {isSelected && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Selected
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="secondary">
                        <Lock className="w-3 h-3 mr-1" />
                        Opponent's Pick
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Heart className="w-4 h-4 text-red-500 mr-1" />
                      <span className="text-sm">HP</span>
                    </div>
                    <span className={`font-semibold ${getStatColor(bird.hp)}`}>{bird.hp}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Gauge className="w-4 h-4 text-blue-500 mr-1" />
                      <span className="text-sm">Speed</span>
                    </div>
                    <span className={`font-semibold ${getStatColor(bird.speed)}`}>{bird.speed}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Sword className="w-4 h-4 text-orange-500 mr-1" />
                      <span className="text-sm">Attack</span>
                    </div>
                    <span className={`font-semibold ${getStatColor(bird.attack)}`}>{bird.attack}%</span>
                  </div>
                </div>

                {/* Abilities */}
                <div className="space-y-2 text-xs">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-blue-600">Normal (Q)</span>
                      <Zap className="w-3 h-3" />
                    </div>
                    <p className="text-gray-600">{bird.abilities.normal.description}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-purple-600">Signature (E)</span>
                      <Zap className="w-3 h-3" />
                    </div>
                    <p className="text-gray-600">{bird.abilities.signature.description}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-red-600">Ultimate (X)</span>
                      <Zap className="w-3 h-3" />
                    </div>
                    <p className="text-gray-600">{bird.abilities.ultimate.description}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <Button
            onClick={handleReady}
            disabled={!selectedBird || isReady}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-12 py-4 text-xl"
          >
            {isReady ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                READY - Waiting for opponent...
              </>
            ) : selectedBird ? (
              "READY TO BATTLE"
            ) : (
              "SELECT A BIRD FIRST"
            )}
          </Button>

          <div>
            <Button onClick={handleBackToMenu} variant="outline" className="bg-white/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </div>

          {isReady && opponentBird && (
            <p className="text-white font-semibold animate-pulse">
              🚀 Both players ready! Starting battle...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}