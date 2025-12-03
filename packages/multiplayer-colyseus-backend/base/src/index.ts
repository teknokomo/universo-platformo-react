// Universo Platformo | Colyseus Multiplayer Server
import { Server } from "colyseus"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { createServer } from "http"
import { MMOOMMRoom } from "./rooms/MMOOMMRoom"



/**
 * Colyseus server for Universo MMOOMM multiplayer
 */
const port = process.env.MULTIPLAYER_SERVER_PORT
    ? parseInt(process.env.MULTIPLAYER_SERVER_PORT)
    : process.env.COLYSEUS_PORT
    ? parseInt(process.env.COLYSEUS_PORT)
    : process.env.PORT
    ? parseInt(process.env.PORT)
    : 2567

// Create HTTP server
const httpServer = createServer()

// Initialize Colyseus server with explicit WebSocket transport
const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer })
})

// Register MMOOMM room
gameServer.define("mmoomm", MMOOMMRoom)

// Start server
httpServer.listen(port, () => {
    console.log(`🚀 Universo MMOOMM Multiplayer Server listening on port ${port}`)
    console.log(`📡 WebSocket endpoint: ws://localhost:${port}`)
    console.log(`🎮 Room type: "mmoomm"`)
    console.log(`👥 Max players per room: 16`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Colyseus server...')
    gameServer.gracefullyShutdown()
})

process.on('SIGINT', () => {
    console.log('🛑 Shutting down Colyseus server...')
    gameServer.gracefullyShutdown()
})
