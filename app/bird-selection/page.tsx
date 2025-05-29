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

interface BirdSelectionState {
  birdId: string | null
  playerNumber: number | null
  isLocked: boolean
  timestamp: number
}

interface GameData {
  matchData: MatchData
  selectedBird: string
  opponentBird: string
  gameReady: boolean
  socketId?: string
  preserveSocket: boolean
  timestamp: number
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
  const isNavigatingRef = useRef(false)
  const componentMountedRef = useRef(false)
  const socketCreatedRef = useRef(false)
  const gameDataPersistRef = useRef<GameData | null>(null) // Persistent storage
  
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
  const [isNavigatingToGame, setIsNavigatingToGame] = useState(false)
  const [birdSelections, setBirdSelections] = useState<Map<string, BirdSelectionState>>(new Map())

  const setupSocketEvents = useCallback((socket: Socket) => {
    // Clear existing listeners
    socket.removeAllListeners()
    
    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id)
      if (componentMountedRef.current && !isNavigatingRef.current) {
        setConnectionStatus('searching')
        setError(null)
        const name = localStorage.getItem("playerName") || "Player"
        socket.emit('findMatch', { name })
      }
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      if (componentMountedRef.current && !isNavigatingRef.current) {
        setError(`Connection failed: ${error.message}. Make sure the Socket.io server is running on port 3001.`)
        setConnectionStatus('connecting')
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason)
      if (reason === 'io server disconnect' && componentMountedRef.current && !isNavigatingRef.current) {
        socket.connect()
      }
    })

    socket.on('queueJoined', (data) => {
      console.log('📝 Joined queue, position:', data.position)
      if (componentMountedRef.current && !isNavigatingRef.current) {
        setQueuePosition(data.position)
        setConnectionStatus('searching')
      }
    })

    socket.on('matchFound', (data: MatchData & { myName?: string }) => {
      console.log('🎯 Match found:', data)
      
      if (!componentMountedRef.current || isNavigatingRef.current) return
      
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
      
      // Store match data in multiple places for persistence
      localStorage.setItem('matchData', JSON.stringify(enhancedMatchData))
      sessionStorage.setItem('matchData', JSON.stringify(enhancedMatchData))
      
      console.log('👥 Names set - Me:', enhancedMatchData.myName, 'Opponent:', data.opponent)
    })

    socket.on('birdSelected', (data: { playerNumber: number; birdId: string; isLocked: boolean; timestamp: number }) => {
      console.log('🐦 Bird selected by player:', data)
      
      if (!componentMountedRef.current || isNavigatingRef.current) return
      
      setBirdSelections(currentSelections => {
        const newSelections = new Map(currentSelections)
        
        for (const [birdId, selection] of newSelections.entries()) {
          if (selection.playerNumber === data.playerNumber) {
            newSelections.delete(birdId)
          }
        }
        
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
          setOpponentBird(data.birdId)
          setOpponentReady(data.isLocked)
          console.log('🐦 Opponent', data.isLocked ? 'locked' : 'selected', 'bird:', data.birdId)
        }
        return currentMatchData
      })
    })

    socket.on('playerReady', (data: { playerNumber: number; isReady: boolean }) => {
      console.log('✅ Player ready status:', data)
      
      if (!componentMountedRef.current || isNavigatingRef.current) return
      
      setMatchData(currentMatchData => {
        if (currentMatchData && data.playerNumber !== currentMatchData.playerNumber) {
          setOpponentReady(data.isReady)
          console.log('✅ Opponent ready status:', data.isReady)
        }
        return currentMatchData
      })
    })

    socket.on('birdStolen', (data: { birdId: string; fromPlayer: number; toPlayer: number; timestamp: number }) => {
      console.log('🥷 Bird stolen:', data)
      
      if (!componentMountedRef.current || isNavigatingRef.current) return
      
      setMatchData(currentMatchData => {
        if (currentMatchData) {
          if (data.fromPlayer === currentMatchData.playerNumber) {
            setSelectedBird(null)
            console.log('😱 My bird was stolen by opponent!')
          } else if (data.toPlayer === currentMatchData.playerNumber) {
            setSelectedBird(data.birdId)
            setOpponentBird(null)
            console.log('😈 I stole opponent\'s bird!')
          }
        }
        return currentMatchData
      })
    })

    socket.on('gameStart', (data: { player1Bird: string; player2Bird: string; player1Name: string; player2Name: string; ready: boolean }) => {
      console.log('🚀 Game starting with birds:', data)
      
      // Prevent duplicate processing
      if (!data.ready || !componentMountedRef.current || isNavigatingRef.current) {
        console.log('⚠️ Game start ignored - not ready or already navigating')
        return
      }
      
      const currentMatchData = matchData || JSON.parse(localStorage.getItem('matchData') || 'null')
      const currentSelectedBird = selectedBird || localStorage.getItem('selectedBird')
      
      if (!currentMatchData || !currentSelectedBird) {
        console.error('❌ Missing match data or selected bird when starting game')
        if (componentMountedRef.current) {
          setError("Missing game data. Please try again.")
        }
        return
      }
      
      const myBird = currentSelectedBird
      const opponentBird = currentMatchData.playerNumber === 1 ? data.player2Bird : data.player1Bird
      
      const gameData: GameData = {
        matchData: currentMatchData,
        selectedBird: myBird,
        opponentBird: opponentBird,
        gameReady: true,
        socketId: socketRef.current?.id,
        preserveSocket: true,
        timestamp: Date.now()
      }
      
      // Store game data in multiple persistent locations
      localStorage.setItem('gameData', JSON.stringify(gameData))
      sessionStorage.setItem('gameData', JSON.stringify(gameData))
      gameDataPersistRef.current = gameData
      
      console.log('📦 Stored game data in multiple locations:', gameData)
      
      // Set navigation flags immediately
      isNavigatingRef.current = true
      setIsNavigatingToGame(true)
      
      // Store socket and game data globally
      if (typeof window !== 'undefined') {
        window.gameSocket = socketRef.current
        window.gameData = gameData
        window.socketPreserved = true
        
        // Also store in a global backup object that persists across renders
        window.gameBackup = {
          gameData,
          socket: socketRef.current,
          timestamp: Date.now()
        }
      }
      
      // Navigate after ensuring everything is stored
      setTimeout(() => {
        if (componentMountedRef.current && isNavigatingRef.current) {
          console.log('🚀 Navigating to game page...')
          router.push('/game')
        }
      }, 200)
    })

    socket.on('bothPlayersSelected', (data) => {
      console.log('📝 Both players have selected birds, but waiting for ready status:', data)
    })

    socket.on('opponentDisconnected', () => {
      console.log('❌ Opponent disconnected')
      
      if (!isNavigatingRef.current && componentMountedRef.current) {
        setError("Opponent disconnected. Returning to menu...")
        setTimeout(() => {
          if (componentMountedRef.current && !isNavigatingRef.current) {
            router.push('/')
          }
        }, 3000)
      }
    })

    socket.on('error', (data) => {
      console.error('❌ Socket error:', data.message)
      if (componentMountedRef.current && !isNavigatingRef.current) {
        setError(data.message)
      }
    })
  }, [router, matchData, selectedBird])

  // Main initialization effect
  useEffect(() => {
    console.log('🔌 Component initializing...')
    componentMountedRef.current = true
    
    const name = localStorage.getItem("playerName") || "Player"
    setPlayerName(name)
    
    // Create socket only if needed
    if (!socketRef.current && !socketCreatedRef.current) {
      console.log('🔌 Creating new socket connection...')
      socketCreatedRef.current = true
      
      const socketUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.NEXT_PUBLIC_SOCKET_URL || 'https://flappy-bird-battle-production.up.railway.app')
        : 'http://localhost:3001'
      
      console.log('🔌 Connecting to socket URL:', socketUrl)
      
      socketRef.current = io(socketUrl, {
        transports: ['polling'], // FORCE polling only - no websocket
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        upgrade: false, // DISABLE websocket upgrades
        rememberUpgrade: false
      })

      setupSocketEvents(socketRef.current)
    }

    return () => {
      console.log('🧹 Component cleanup...')
      componentMountedRef.current = false
      
      // Only disconnect if not preserving
      if (socketRef.current && !isNavigatingRef.current && 
          !(typeof window !== 'undefined' && window.socketPreserved)) {
        console.log('🔌 Disconnecting socket...')
        socketRef.current.disconnect()
        socketRef.current = null
        socketCreatedRef.current = false
      } else {
        console.log('✅ Socket preserved for game transition')
      }
    }
  }, [])

  // Update event handlers when dependencies change
  useEffect(() => {
    if (socketRef.current && componentMountedRef.current && !isNavigatingRef.current) {
      setupSocketEvents(socketRef.current)
    }
  }, [setupSocketEvents])

  const handleBirdSelect = useCallback((birdId: string) => {
    if (!matchData || isReady || !componentMountedRef.current || isNavigatingRef.current) return
    
    const currentSelection = birdSelections.get(birdId)
    
    if (currentSelection && currentSelection.isLocked && currentSelection.playerNumber !== matchData.playerNumber) {
      console.log('🔒 Cannot select locked bird')
      return
    }
    
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
        isLocked: false,
        timestamp: Date.now()
      })
    } else {
      setError("Connection lost. Please refresh the page.")
    }
  }, [matchData, isReady, birdSelections])

  const handleReady = useCallback(() => {
    if (!selectedBird || !matchData || isReady || !componentMountedRef.current || isNavigatingRef.current) return
    
    console.log('🔒 Locking bird and becoming ready:', selectedBird)
    setIsReady(true)
    setConnectionStatus('ready')
    
    // Store selected bird in multiple locations
    localStorage.setItem("selectedBird", selectedBird)
    sessionStorage.setItem("selectedBird", selectedBird)
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('selectBird', {
        roomId: matchData.roomId,
        birdId: selectedBird,
        playerNumber: matchData.playerNumber,
        isLocked: true,
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
    console.log('🔙 Going back to menu...')
    
    componentMountedRef.current = false
    isNavigatingRef.current = false
    
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      socketCreatedRef.current = false
    }
    
    // Clear all stored data
    if (typeof window !== 'undefined') {
      window.gameSocket = null
      window.gameData = null
      window.gameBackup = null
      window.socketPreserved = false
    }
    
    localStorage.removeItem('gameData')
    sessionStorage.removeItem('gameData')
    gameDataPersistRef.current = null
    
    router.push('/')
  }, [router])

  const getStatColor = (value: number) => {
    if (value >= 90) return "text-green-600"
    if (value >= 75) return "text-yellow-600"
    return "text-red-600"
  }

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
      canSteal: isOpponentBird && !isLocked && !isReady,
      playerNumber: selection.playerNumber
    }
  }

  // Loading state during game transition
  if (isNavigatingToGame) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-600 via-blue-600 to-purple-600 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">🚀</div>
            <h2 className="text-2xl font-bold text-gray-800">Starting Battle!</h2>
            <p className="text-gray-600">
              Preparing battle arena with your selected birds...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        </Card>
      </div>
    )
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

          {/* Tips and status messages */}
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

                  {/* Selection Status */}
                  <div className="mt-2 space-y-1">
                    {isSelected && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {isReady ? "Locked" : "Selected"}
                      </Badge>
                    )}
                    
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
                    
                    {birdStatus?.isOpponentBird && !canSteal && !isLocked && (
                      <Badge variant="secondary" className="bg-red-100">
                        <Clock className="w-3 h-3 mr-1" />
                        Opponent Selected
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

declare global {
  interface Window {
    gameSocket?: any
    gameData?: any
    gameBackup?: any
    socketPreserved?: boolean
  }
}