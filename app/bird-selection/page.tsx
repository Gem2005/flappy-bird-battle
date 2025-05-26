"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Lock, Zap, Heart, Gauge, Sword, ArrowLeft, Clock } from "lucide-react"
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
  myName: string
}

// NEW: Bird selection states
interface BirdSelectionState {
  birdId: string | null
  playerNumber: number | null
  isLocked: boolean // NEW: Track if bird is locked (ready)
  timestamp: number // NEW: When bird was selected
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
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  
  // NEW: Track bird selection states
  const [birdSelections, setBirdSelections] = useState<Map<string, BirdSelectionState>>(new Map())

  // Memoize socket event handlers to prevent re-creation
  const setupSocketEvents = useCallback((socket: Socket) => {
    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id)
      setConnectionStatus('searching')
      setError(null)
      const name = localStorage.getItem("playerName") || "Player"
      socket.emit('findMatch', { name })
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      setError(`Connection failed: ${error.message}. Make sure the Socket.io server is running on port 3001.`)
      setConnectionStatus('connecting')
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason)
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })

    socket.on('queueJoined', (data) => {
      console.log('📝 Joined queue, position:', data.position)
      setQueuePosition(data.position)
      setConnectionStatus('searching')
    })

    socket.on('matchFound', (data: MatchData & { myName?: string }) => {
      console.log('🎯 Match found:', data)
      
      const currentPlayerName = localStorage.getItem("playerName") || "Player"
      const enhancedMatchData: MatchData = {
        roomId: data.roomId,
        opponent: data.opponent,
        playerNumber: data.playerNumber,
        myName: data.myName || currentPlayerName
      }
      
      setMatchData(enhancedMatchData)
      setPlayerName(enhancedMatchData.myName)
      setOpponentName(data.opponent)
      setConnectionStatus('selecting')
      setQueuePosition(null)
      
      console.log('👥 Names set - Me:', enhancedMatchData.myName, 'Opponent:', data.opponent)
    })

    // UPDATED: Handle bird selection with temporary reservation
    socket.on('birdSelected', (data: { playerNumber: number; birdId: string; isLocked: boolean; timestamp: number }) => {
      console.log('🐦 Bird selected by player:', data)
      
      setBirdSelections(currentSelections => {
        const newSelections = new Map(currentSelections)
        
        // Remove any previous selection by this player
        for (const [birdId, selection] of newSelections.entries()) {
          if (selection.playerNumber === data.playerNumber) {
            newSelections.delete(birdId)
          }
        }
        
        // Add new selection
        newSelections.set(data.birdId, {
          birdId: data.birdId,
          playerNumber: data.playerNumber,
          isLocked: data.isLocked,
          timestamp: data.timestamp
        })
        
        return newSelections
      })
      
      setMatchData(currentMatchData => {
        if (currentMatchData && data.playerNumber !== currentMatchData.playerNumber) {
          // Opponent selected/locked a bird
          setOpponentBird(data.birdId)
          setOpponentReady(data.isLocked)
          console.log('🐦 Opponent', data.isLocked ? 'locked' : 'selected', 'bird:', data.birdId)
        }
        return currentMatchData
      })
    })

    // Handle player ready status
    socket.on('playerReady', (data: { playerNumber: number; isReady: boolean }) => {
      console.log('✅ Player ready status:', data)
      
      setMatchData(currentMatchData => {
        if (currentMatchData && data.playerNumber !== currentMatchData.playerNumber) {
          setOpponentReady(data.isReady)
          console.log('✅ Opponent ready status:', data.isReady)
        }
        return currentMatchData
      })
    })

    // NEW: Handle bird theft/steal events
    socket.on('birdStolen', (data: { birdId: string; fromPlayer: number; toPlayer: number; timestamp: number }) => {
      console.log('🥷 Bird stolen:', data)
      
      setMatchData(currentMatchData => {
        if (currentMatchData) {
          if (data.fromPlayer === currentMatchData.playerNumber) {
            // My bird was stolen
            setSelectedBird(null)
            console.log('😱 My bird was stolen by opponent!')
          } else if (data.toPlayer === currentMatchData.playerNumber) {
            // I stole opponent's bird
            setSelectedBird(data.birdId)
            setOpponentBird(null)
            console.log('😈 I stole opponent\'s bird!')
          }
        }
        return currentMatchData
      })
    })

    socket.on('gameStart', (data: { player1Bird: string; player2Bird: string; ready: boolean }) => {
      console.log('🚀 Game starting with birds:', data)
      
      if (!data.ready) {
        console.log('⚠️ Game start received but not ready - ignoring')
        return
      }
      
      setMatchData(currentMatchData => {
        if (currentMatchData) {
          localStorage.setItem('matchData', JSON.stringify(currentMatchData))
        }
        return currentMatchData
      })
      
      setSelectedBird(currentBird => {
        if (currentBird) {
          localStorage.setItem('selectedBird', currentBird)
        }
        return currentBird
      })
      
      router.push('/game')
    })

    socket.on('bothPlayersSelected', (data) => {
      console.log('📝 Both players have selected birds, but waiting for ready status:', data)
    })

    socket.on('opponentDisconnected', () => {
      console.log('❌ Opponent disconnected')
      setError("Opponent disconnected. Returning to menu...")
      setTimeout(() => {
        router.push('/')
      }, 3000)
    })

    socket.on('error', (data) => {
      console.error('❌ Socket error:', data.message)
      setError(data.message)
    })
  }, [router])

  useEffect(() => {
    const name = localStorage.getItem("playerName") || "Player"
    setPlayerName(name)

    if (!socketRef.current) {
      console.log('🔌 Creating new socket connection...')
      
      socketRef.current = io(process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL || window.location.origin
        : 'http://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
      })

      setupSocketEvents(socketRef.current)
    }

    return () => {
      if (socketRef.current) {
        console.log('🔌 Component unmounting, disconnecting socket...')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [setupSocketEvents])

  // UPDATED: Handle bird selection with potential stealing
  const handleBirdSelect = useCallback((birdId: string) => {
    if (!matchData || isReady) return
    
    const currentSelection = birdSelections.get(birdId)
    
    // Check if bird is locked by opponent
    if (currentSelection && currentSelection.isLocked && currentSelection.playerNumber !== matchData.playerNumber) {
      console.log('🔒 Cannot select locked bird')
      return
    }
    
    // Allow stealing if bird is only selected (not locked) by opponent
    if (currentSelection && !currentSelection.isLocked && currentSelection.playerNumber !== matchData.playerNumber) {
      console.log('🥷 Stealing opponent\'s bird:', birdId)
    }
    
    console.log('🐦 Selecting bird:', birdId)
    setSelectedBird(birdId)
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('selectBird', {
        roomId: matchData.roomId,
        birdId: birdId,
        playerNumber: matchData.playerNumber,
        isLocked: false, // Only selected, not locked
        timestamp: Date.now()
      })
    } else {
      setError("Connection lost. Please refresh the page.")
    }
  }, [matchData, isReady, birdSelections])

  // UPDATED: Handle ready button - this locks the bird
  const handleReady = useCallback(() => {
    if (!selectedBird || !matchData || isReady) return
    
    console.log('🔒 Locking bird and becoming ready:', selectedBird)
    setIsReady(true)
    setConnectionStatus('ready')
    
    localStorage.setItem("selectedBird", selectedBird)
    
    if (socketRef.current && socketRef.current.connected) {
      // Send both bird lock and ready status
      socketRef.current.emit('selectBird', {
        roomId: matchData.roomId,
        birdId: selectedBird,
        playerNumber: matchData.playerNumber,
        isLocked: true, // NOW the bird is locked
        timestamp: Date.now()
      })
      
      socketRef.current.emit('playerReady', {
        roomId: matchData.roomId,
        birdId: selectedBird,
        playerNumber: matchData.playerNumber,
        isReady: true
      })
    } else {
      setError("Connection lost. Please refresh the page.")
    }
  }, [selectedBird, matchData, isReady])

  const handleBackToMenu = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    router.push('/')
  }, [router])

  const getStatColor = (value: number) => {
    if (value >= 90) return "text-green-600"
    if (value >= 75) return "text-yellow-600"
    return "text-red-600"
  }

  // NEW: Helper function to get bird status
  const getBirdStatus = (birdId: string) => {
    const selection = birdSelections.get(birdId)
    if (!selection || !matchData) return null
    
    const isMyBird = selectedBird === birdId
    const isOpponentBird = selection.playerNumber !== matchData.playerNumber
    const isLocked = selection.isLocked
    
    return {
      isMyBird,
      isOpponentBird,
      isLocked,
      // UPDATED: Can only steal if I'm not ready AND opponent bird is not locked
      canSteal: isOpponentBird && !isLocked && !isReady,
      playerNumber: selection.playerNumber
    }
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
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700">
                🔄 Retry Connection
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
                ? 'Connecting to Socket.io server...' 
                : `Looking for another player to battle...${queuePosition ? ` (Position in queue: ${queuePosition})` : ''}`
              }
            </p>
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                🔄 Refresh Connection
              </Button>
              <Button onClick={handleBackToMenu} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel & Back to Menu
              </Button>
            </div>
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
          <div className="mt-4 space-y-2">
            <Badge variant="outline" className="bg-white/20 text-white">
              Room: {matchData?.roomId ? matchData.roomId.slice(-8) : 'Connecting...'}
            </Badge>
            {socketRef.current?.connected && (
              <Badge variant="outline" className="bg-green-500/20 text-white">
                🟢 Connected to Server
              </Badge>
            )}
          </div>

          {/* NEW: Stealing feature explanation */}
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/90 text-sm">
              💡 <strong>Tip:</strong> You can steal birds that opponents have selected but not locked. 
              Lock your bird by clicking READY!
            </p>
          </div>

          {/* Status messages */}
          <div className="mt-4 space-y-2">
            {selectedBird && opponentBird && (
              <div className="text-white text-sm space-y-1">
                <p className="flex items-center justify-center space-x-2">
                  <span>✅ Both players have selected birds!</span>
                </p>
                <p className="text-white/80">
                  {!isReady && !opponentReady && "Both players need to click READY to start"}
                  {isReady && !opponentReady && "Waiting for opponent to ready up..."}
                  {!isReady && opponentReady && "Opponent is ready! Click READY to start"}
                  {isReady && opponentReady && "🚀 Starting battle..."}
                </p>
              </div>
            )}
            
            {selectedBird && !opponentBird && (
              <p className="text-white/80 text-sm">
                ⏳ Waiting for opponent to select their bird...
              </p>
            )}
            
            {!selectedBird && opponentBird && (
              <p className="text-white/80 text-sm">
                🐦 Opponent has selected their bird. Choose yours!
              </p>
            )}
          </div>
        </div>

        {/* Bird Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {birds.map((bird) => {
            const birdStatus = getBirdStatus(bird.id)
            const isSelected = selectedBird === bird.id
            const isOpponentSelected = birdStatus?.isOpponentBird && !birdStatus?.canSteal
            const canSteal = birdStatus?.canSteal
            const isLocked = birdStatus?.isLocked && birdStatus?.isOpponentBird
            const isDisabled = isReady || isLocked

            return (
              <Card
                key={bird.id}
                className={`p-6 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "ring-4 ring-green-500 bg-green-50"
                    : canSteal
                      ? "ring-2 ring-orange-400 bg-orange-50 hover:ring-orange-500"
                    : isLocked
                      ? "opacity-50 cursor-not-allowed bg-gray-100"
                    : isOpponentSelected
                      ? "opacity-75 bg-red-50"
                    : isDisabled
                      ? "opacity-50 cursor-not-allowed bg-gray-100"
                      : "hover:shadow-lg hover:scale-105 bg-white"
                }`}
                onClick={() => !isDisabled && handleBirdSelect(bird.id)}
              >
                {/* Bird Header */}
                <div className="text-center mb-4">
                  <div
                    className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${bird.color} flex items-center justify-center mb-2`}
                  >
                    <div className="text-white text-2xl">🐦</div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">{bird.name}</h3>

                  {/* UPDATED: Selection Status - hide steal indicators when player is ready */}
                  <div className="mt-2 space-y-1">
                    {isSelected && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {isReady ? "Locked" : "Selected"}
                      </Badge>
                    )}
                    
                    {/* UPDATED: Only show steal option if player is not ready */}
                    {canSteal && !isReady && (
                      <Badge variant="destructive" className="bg-orange-500">
                        <Clock className="w-3 h-3 mr-1" />
                        Can Steal!
                      </Badge>
                    )}
                    
                    {isLocked && (
                      <Badge variant="secondary">
                        <Lock className="w-3 h-3 mr-1" />
                        Opponent Locked
                      </Badge>
                    )}
                    
                    {/* UPDATED: Show different message based on player's ready status */}
                    {birdStatus?.isOpponentBird && !canSteal && !isLocked && (
                      <Badge variant="secondary" className="bg-red-100">
                        <Clock className="w-3 h-3 mr-1" />
                        {isReady ? "Opponent Selected" : "Opponent Selected"}
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

        {/* UPDATED: Action Buttons with clearer messaging */}
        <div className="text-center space-y-4">
          <Button
            onClick={handleReady}
            disabled={!selectedBird || isReady}
            size="lg"
            className={`font-semibold px-12 py-4 text-xl ${
              isReady 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {isReady ? (
              <>
                <Lock className="w-5 h-5 mr-2" />
                LOCKED & READY - Waiting for opponent...
              </>
            ) : selectedBird ? (
              <>
                <Lock className="w-5 h-5 mr-2" />
                LOCK BIRD & READY TO BATTLE
              </>
            ) : (
              "SELECT A BIRD FIRST"
            )}
          </Button>

          {/* UPDATED: Show different tip based on ready status */}
          {!isReady && (
            <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <p className="text-white/90 text-sm">
                💡 <strong>Tip:</strong> You can steal birds that opponents have selected but not locked. 
                Lock your bird by clicking READY!
              </p>
            </div>
          )}
          
          {isReady && (
            <div className="mt-4 bg-blue-500/20 backdrop-blur-sm rounded-lg p-3">
              <p className="text-white/90 text-sm">
                🔒 <strong>Locked:</strong> Your bird is secured! Waiting for opponent to ready up.
              </p>
            </div>
          )}

          <div>
            <Button onClick={handleBackToMenu} variant="outline" className="bg-white/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </div>

          {/* Only show when both are ready */}
          {isReady && opponentReady && selectedBird && opponentBird && (
            <p className="text-white font-semibold animate-pulse">
              🚀 Both players ready! Starting battle...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}