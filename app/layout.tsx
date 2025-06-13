import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SocketProvider } from "@/components/socket-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Flappy Bird Battle - Multiplayer Combat Edition",
  description: "Real-time multiplayer Flappy Bird with combat abilities and bird selection",
  generator: 'v0.dev',
  icons: {
    icon: '/motif@.png',
    shortcut: '/motif@.png',
    apple: '/motif@.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  )
}
