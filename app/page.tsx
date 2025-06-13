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
      <div className="min-h-screen bg-gradient-to-b from-[#D5B9FA] via-[#B083F9] to-[#8C5FD9] flex items-center justify-center p-4 overflow-y-auto">
        <Card className="max-w-4xl p-8 bg-white/95 backdrop-blur-sm my-8">
          <h2 className="text-4xl font-bold text-center mb-8 text-gray-800">Complete Game Guide</h2>

          <div className="grid md:grid-cols-2 gap-8 text-gray-700">
            {/* Game Overview */}
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4 text-orange-600">🎮 Game Overview</h3>
              <p className="text-lg mb-4">
                Flappy Bird Battle is a real-time multiplayer combat game where two players battle head-to-head using unique birds with special abilities. Navigate through obstacles while attacking your opponent to emerge victorious!
              </p>
            </div>

            {/* Controls */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-blue-600">🎯 Controls</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2">Movement:</h4>
                  <ul className="space-y-1 text-sm">
                    <li><span className="bg-gray-200 px-2 py-1 rounded font-mono">W</span> - Move Up</li>
                    <li><span className="bg-gray-200 px-2 py-1 rounded font-mono">S</span> - Move Down</li>
                    <li><span className="bg-gray-200 px-2 py-1 rounded font-mono">A</span> - Move Left</li>
                    <li><span className="bg-gray-200 px-2 py-1 rounded font-mono">D</span> - Move Right</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2">Abilities:</h4>
                  <ul className="space-y-1 text-sm">
                    <li><span className="bg-blue-200 px-2 py-1 rounded font-mono">Q</span> - Normal Ability (6s cooldown)</li>
                    <li><span className="bg-purple-200 px-2 py-1 rounded font-mono">E</span> - Signature Ability (10s cooldown)</li>
                    <li><span className="bg-green-200 px-2 py-1 rounded font-mono">C</span> - Universal Heal (10s cooldown)</li>
                    <li><span className="bg-red-200 px-2 py-1 rounded font-mono">X</span> - Ultimate Ability (15s cooldown)</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2">System:</h4>
                  <ul className="space-y-1 text-sm">
                    <li><span className="bg-gray-200 px-2 py-1 rounded font-mono">ESC</span> - Return to menu (when game ends)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Win Conditions */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-green-600">🏆 Win Conditions</h3>
              <div className="space-y-3">
                <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-400">
                  <h4 className="font-semibold text-red-700">HP Depletion</h4>
                  <p className="text-sm text-red-600">Reduce opponent's health to 0 using abilities</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-400">
                  <h4 className="font-semibold text-orange-700">Pipe Collision</h4>
                  <p className="text-sm text-orange-600">Force opponent to crash into obstacles</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                  <h4 className="font-semibold text-blue-700">Survival</h4>
                  <p className="text-sm text-blue-600">Outlast your opponent's endurance</p>
                </div>
              </div>
            </div>

            {/* Bird Roster */}
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4 text-purple-600">🐦 Bird Roster & Abilities</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Phoenix */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 p-4 rounded-lg border-2 border-red-200">
                  <h4 className="text-xl font-bold text-red-700 mb-2">🔥 Phoenix</h4>
                  <div className="text-sm mb-3">
                    <span className="bg-red-100 px-2 py-1 rounded mr-2">HP: 80</span>
                    <span className="bg-yellow-100 px-2 py-1 rounded mr-2">Speed: 90</span>
                    <span className="bg-orange-100 px-2 py-1 rounded">Attack: 100</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Q - Ember Shot:</strong> 10 damage projectile</li>
                    <li><strong>E - Flame Wave:</strong> 20 AoE damage</li>
                    <li><strong>X - Rebirth:</strong> Heal 50 HP (once per match)</li>
                  </ul>
                  <p className="text-xs text-red-600 mt-2 italic">Strategy: Glass cannon with high damage output</p>
                </div>

                {/* Frostbeak */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border-2 border-blue-200">
                  <h4 className="text-xl font-bold text-blue-700 mb-2">❄️ Frostbeak</h4>
                  <div className="text-sm mb-3">
                    <span className="bg-blue-100 px-2 py-1 rounded mr-2">HP: 90</span>
                    <span className="bg-cyan-100 px-2 py-1 rounded mr-2">Speed: 70</span>
                    <span className="bg-indigo-100 px-2 py-1 rounded">Attack: 75</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Q - Ice Shard:</strong> 8 damage + slow effect</li>
                    <li><strong>E - Blizzard:</strong> Creates obstacles for opponent</li>
                    <li><strong>X - Freeze Time:</strong> Freezes opponent for 3 seconds</li>
                  </ul>
                  <p className="text-xs text-blue-600 mt-2 italic">Strategy: Tank with crowd control abilities</p>
                </div>

                {/* Thunderwing */}
                <div className="bg-gradient-to-br from-yellow-50 to-purple-50 p-4 rounded-lg border-2 border-yellow-200">
                  <h4 className="text-xl font-bold text-yellow-700 mb-2">⚡ Thunderwing</h4>
                  <div className="text-sm mb-3">
                    <span className="bg-yellow-100 px-2 py-1 rounded mr-2">HP: 70</span>
                    <span className="bg-purple-100 px-2 py-1 rounded mr-2">Speed: 100</span>
                    <span className="bg-yellow-100 px-2 py-1 rounded">Attack: 80</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Q - Shock Bolt:</strong> 12 damage lightning</li>
                    <li><strong>E - Wind Gust:</strong> Pushes opponent toward obstacles</li>
                    <li><strong>X - Lightning Strike:</strong> 30 damage, chains to obstacles</li>
                  </ul>
                  <p className="text-xs text-yellow-600 mt-2 italic">Strategy: Speed demon with environmental control</p>
                </div>

                {/* Shadowfeather */}
                <div className="bg-gradient-to-br from-purple-50 to-gray-50 p-4 rounded-lg border-2 border-purple-200">
                  <h4 className="text-xl font-bold text-purple-700 mb-2">🌙 Shadowfeather</h4>
                  <div className="text-sm mb-3">
                    <span className="bg-purple-100 px-2 py-1 rounded mr-2">HP: 60</span>
                    <span className="bg-gray-100 px-2 py-1 rounded mr-2">Speed: 85</span>
                    <span className="bg-purple-100 px-2 py-1 rounded">Attack: 90</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Q - Shadow Strike:</strong> 15 damage stealth attack</li>
                    <li><strong>E - Vanish:</strong> 2 seconds invulnerability</li>
                    <li><strong>X - Nightmare:</strong> Reverses controls + disables abilities</li>
                  </ul>
                  <p className="text-xs text-purple-600 mt-2 italic">Strategy: Assassin with disruption tactics</p>
                </div>
              </div>

              {/* Universal Ability */}
              <div className="mt-4 bg-green-50 p-4 rounded-lg border-2 border-green-200">
                <h4 className="text-lg font-bold text-green-700 mb-2">💚 Universal Ability (All Birds)</h4>
                <p className="text-sm"><strong>C - Heal:</strong> Restore 15 HP (10-second cooldown)</p>
              </div>
            </div>

            {/* Game Flow */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-indigo-600">🔄 Game Flow</h3>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start">
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold mr-3 mt-0.5">1</span>
                  <div>
                    <strong>Matchmaking:</strong> Enter your name and join the queue
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold mr-3 mt-0.5">2</span>
                  <div>
                    <strong>Bird Selection:</strong> Choose your bird and lock it in (you can steal opponent's bird before they lock!)
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold mr-3 mt-0.5">3</span>
                  <div>
                    <strong>Battle Phase:</strong> Navigate pipes while using abilities to defeat your opponent
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold mr-3 mt-0.5">4</span>
                  <div>
                    <strong>Victory:</strong> Win by depleting opponent's HP, causing pipe collision, or outlasting them
                  </div>
                </li>
              </ol>
            </div>

            {/* Strategy Tips */}
            <div>
              <h3 className="text-2xl font-bold mb-4 text-teal-600">💡 Strategy Tips</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-teal-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-teal-700">Cooldown Management</h4>
                  <p className="text-teal-600">Time your abilities strategically - don't waste them!</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-teal-700">Positioning</h4>
                  <p className="text-teal-600">Stay mobile and use the environment to your advantage</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-teal-700">Bird Synergy</h4>
                  <p className="text-teal-600">Match your playstyle - aggressive, defensive, or hit-and-run</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-teal-700">Status Effects</h4>
                  <p className="text-teal-600">Use slows, freezes, and pushes to control the battlefield</p>
                </div>
              </div>
            </div>

            {/* Status Effects */}
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4 text-pink-600">🎭 Status Effects</h3>
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <h4 className="font-bold text-blue-700">Slow</h4>
                  <p className="text-blue-600">Reduced movement speed</p>
                </div>
                <div className="bg-cyan-50 p-3 rounded-lg text-center">
                  <h4 className="font-bold text-cyan-700">Freeze</h4>
                  <p className="text-cyan-600">Cannot move or use abilities</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                  <h4 className="font-bold text-yellow-700">Invulnerable</h4>
                  <p className="text-yellow-600">Immune to all damage</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <h4 className="font-bold text-purple-700">Nightmare</h4>
                  <p className="text-purple-600">Reversed controls</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <Button onClick={() => setShowHowToPlay(false)} variant="outline" className="flex-1">
              Back to Menu
            </Button>
            <Button onClick={handleStart} className="flex-1 bg-[#B083F9] hover:bg-[#8C5FD9]">
              <Play className="w-4 h-4 mr-2" />
              Start Playing!
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D5B9FA] via-[#B083F9] to-[#8C5FD9] flex items-center justify-center p-4 relative overflow-hidden">
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
          {/* Kreo Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src="/kreo logo@3.png" 
              alt="Kreo Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Game Title */}
          <div className="space-y-2">
            <Gamepad2 className="w-16 h-16 mx-auto text-[#B083F9]" />
            <h1 className="text-4xl font-bold text-gray-800">Flappy Bird</h1>
            <h2 className="text-2xl font-semibold text-[#8C5FD9]">BATTLE</h2>
            <p className="text-gray-600">Multiplayer Combat Edition</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full bg-[#B083F9] hover:bg-[#8C5FD9] text-white font-semibold py-4 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              START
            </Button>

            <Button
              onClick={() => setShowHowToPlay(true)}
              variant="outline"
              size="lg"
              className="w-full border-2 border-[#B083F9] text-[#8C5FD9] hover:bg-[#D5B9FA]/20 font-semibold py-4 text-lg"
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
