"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Users, Clock } from "lucide-react"

export default function MatchmakingPage() {
  const [searchTime, setSearchTime] = useState(0)
  const [playerName, setPlayerName] = useState("")

  useEffect(() => {
    // Get player name from localStorage
    const name = localStorage.getItem("playerName") || "Player"
    setPlayerName(name)

    // Start timer
    const timer = setInterval(() => {
      setSearchTime((prev) => prev + 1)
    }, 1000)

    // Simulate finding a match after 3-8 seconds
    const matchTimeout = setTimeout(
      () => {
        window.location.href = "/bird-selection"
      },
      Math.random() * 5000 + 3000,
    )

    return () => {
      clearInterval(timer)
      clearTimeout(matchTimeout)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleCancel = () => {
    window.location.href = "/name-entry"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D5B9FA] via-[#B083F9] to-[#8C5FD9] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm shadow-2xl">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <Users className="w-16 h-16 mx-auto text-[#B083F9]" />
            <h1 className="text-3xl font-bold text-gray-800">Finding Opponent</h1>
            <p className="text-gray-600">Searching for a worthy challenger...</p>
          </div>

          {/* Player Info */}
          <div className="bg-[#D5B9FA]/20 rounded-lg p-4">
            <p className="text-sm text-gray-600">Playing as:</p>
            <p className="text-xl font-semibold text-[#8C5FD9]">{playerName}</p>
          </div>

          {/* Search Status */}
          <div className="space-y-4">
            {/* Animated Loading */}
            <div className="flex justify-center">
              <div className="flex space-x-2">
                <div
                  className="w-3 h-3 bg-[#B083F9] rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-3 h-3 bg-[#B083F9] rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-3 h-3 bg-[#B083F9] rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>

            <p className="text-lg font-medium text-gray-700">SEARCHING FOR OPPONENT...</p>

            {/* Timer */}
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <Clock className="w-5 h-5" />
              <span className="text-xl font-mono">{formatTime(searchTime)}</span>
            </div>
          </div>

          {/* Status Messages */}
          <div className="space-y-2 text-sm text-gray-600">
            {searchTime < 5 && <p>🔍 Scanning for players...</p>}
            {searchTime >= 5 && searchTime < 10 && <p>⚡ Expanding search range...</p>}
            {searchTime >= 10 && <p>🌍 Searching globally...</p>}
          </div>

          {/* Cancel Button */}
          <Button
            onClick={handleCancel}
            variant="outline"
            className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel Matchmaking
          </Button>

          {/* Tips */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>💡 Average wait time: 30 seconds</p>
            <p>🎯 Matching by skill level</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
