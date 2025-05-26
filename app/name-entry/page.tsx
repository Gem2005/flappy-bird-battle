"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Search } from "lucide-react"

export default function NameEntryPage() {
  const [playerName, setPlayerName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleStartMatchmaking = async () => {
    if (!playerName.trim()) return

    setIsLoading(true)
    // Store player name in localStorage for later use
    localStorage.setItem("playerName", playerName.trim())

    // Simulate brief loading then redirect
    setTimeout(() => {
      window.location.href = "/matchmaking"
    }, 500)
  }

  const handleBack = () => {
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-800">Enter Your Name</h1>
            <p className="text-gray-600">Choose a name for battle</p>
          </div>

          {/* Name Input */}
          <div className="space-y-4">
            <div>
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-2">
                Player Name
              </label>
              <Input
                id="playerName"
                type="text"
                placeholder="Enter your battle name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="text-center text-lg py-3"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && playerName.trim()) {
                    handleStartMatchmaking()
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">{playerName.length}/20 characters</p>
            </div>

            <Button
              onClick={handleStartMatchmaking}
              disabled={!playerName.trim() || isLoading}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-lg"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </div>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  START MATCHMAKING
                </>
              )}
            </Button>
          </div>

          {/* Back Button */}
          <Button
            onClick={handleBack}
            variant="outline"
            className="w-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>

          {/* Tips */}
          <div className="text-center text-sm text-gray-600 space-y-1">
            <p>💡 Choose a memorable name</p>
            <p>🎮 Your opponents will see this name</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
