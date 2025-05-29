"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  connectionError: string | null
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
})

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}

interface SocketProviderProps {
  children: React.ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    // Get the socket URL with better fallback logic
    const getSocketUrl = () => {
      if (process.env.NODE_ENV === "development") {
        return "http://localhost:3001"
      }

      // Check for environment variable first
      if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        console.log('🔌 Using NEXT_PUBLIC_SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL)
        return process.env.NEXT_PUBLIC_SOCKET_URL
      }

      // Fallback to Railway URL (but this seems to be the issue)
      console.warn('⚠️ No NEXT_PUBLIC_SOCKET_URL found, using Railway fallback')
      return 'https://flappy-bird-battle-production.up.railway.app'
    }

    const socketUrl = getSocketUrl()
    console.log('🔌 Connecting to socket URL:', socketUrl)
    
    const socketInstance = io(socketUrl, {
      transports: ['polling'], // Force polling only
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      upgrade: false, // Disable websocket upgrades
      rememberUpgrade: false,
      // Add connection timeout
      forceNew: true
    })

    socketInstance.on("connect", () => {
      console.log("✅ Connected to server:", socketInstance.id)
      setIsConnected(true)
      setConnectionError(null)
    })

    socketInstance.on("disconnect", (reason) => {
      console.log("❌ Disconnected from server:", reason)
      setIsConnected(false)
    })

    socketInstance.on("connect_error", (error) => {
      console.error("❌ Connection error:", error)
      setConnectionError(`Connection failed: ${error.message}`)
      setIsConnected(false)
    })

    // Add timeout handling
    const connectionTimeout = setTimeout(() => {
      if (!socketInstance.connected) {
        console.error("❌ Connection timeout")
        setConnectionError("Connection timeout - server may be unavailable")
      }
    }, 30000) // 30 second timeout

    setSocket(socketInstance)

    return () => {
      clearTimeout(connectionTimeout)
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  )
}
