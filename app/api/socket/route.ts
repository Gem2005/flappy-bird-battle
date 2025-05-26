import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SocketHandler = async (req: NextRequest) => {
  // This endpoint is no longer used for Socket.io
  // Socket.io is now handled by a separate server on port 3001
  return new NextResponse(
    JSON.stringify({
      message: "Socket.io is handled by a separate server",
      socketServerUrl: process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : process.env.SOCKET_SERVER_URL || 'ws://your-domain.com:3001',
      status: "Socket.io server running externally"
    }),
    { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
}

export { SocketHandler as GET, SocketHandler as POST }
