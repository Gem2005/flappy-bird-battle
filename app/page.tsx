"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, HelpCircle, Gamepad2 } from "lucide-react"

export default function LandingPage() {
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  const handleStart = () => {
    window.location.href = "/name-entry"
  }

  if (showHowToPlay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 flex items-center justify-center p-4">
        <Card className="max-w-2xl p-8 bg-white/90 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">How to Play</h2>

          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="text-xl font-semibold mb-2">Controls:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <strong>W</strong> - Jump/Flap upward
                </li>
                <li>
                  <strong>S</strong> - Dive downward
                </li>
                <li>
                  <strong>A</strong> - Backdash (horizontal movement)
                </li>
                <li>
                  <strong>D</strong> - Forward dash (horizontal movement)
                </li>
                <li>
                  <strong>Q, E, C, X</strong> - Activate abilities
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Win Conditions:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Make your opponent crash into pipes</li>
                <li>Reduce opponent's HP to 0 using abilities</li>
                <li>Survive longer than your opponent</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Bird Abilities:</h3>
              <p>
                Each bird has unique Normal (Q), Signature (E), and Ultimate (X) abilities with different cooldowns and
                effects.
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button onClick={() => setShowHowToPlay(false)} variant="outline" className="flex-1">
              Back
            </Button>
            <Button onClick={handleStart} className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Start Game
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-10 w-16 h-16 bg-white/20 rounded-full animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <div
          className="absolute top-40 right-20 w-12 h-12 bg-white/15 rounded-full animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-32 left-1/4 w-20 h-20 bg-white/10 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "5s" }}
        />
        <div
          className="absolute top-1/3 right-1/3 w-8 h-8 bg-white/25 rounded-full animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "3.5s" }}
        />
      </div>

      <Card className="max-w-md w-full p-8 bg-white/90 backdrop-blur-sm shadow-2xl relative z-10">
        <div className="text-center space-y-6">
          {/* Game Title */}
          <div className="space-y-2">
            <Gamepad2 className="w-16 h-16 mx-auto text-orange-500" />
            <h1 className="text-4xl font-bold text-gray-800">Flappy Bird</h1>
            <h2 className="text-2xl font-semibold text-orange-600">BATTLE</h2>
            <p className="text-gray-600">Multiplayer Combat Edition</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              START
            </Button>

            <Button
              onClick={() => setShowHowToPlay(true)}
              variant="outline"
              size="lg"
              className="w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold py-4 text-lg"
            >
              <HelpCircle className="w-5 h-5 mr-2" />
              HOW TO PLAY
            </Button>
          </div>

          {/* Game Features */}
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Real-time multiplayer battles</p>
            <p>• 4 unique birds with special abilities</p>
            <p>• Competitive matchmaking</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
