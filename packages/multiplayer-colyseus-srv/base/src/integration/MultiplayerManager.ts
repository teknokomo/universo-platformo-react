// Universo Platformo | Multiplayer Manager
// Manages Colyseus server lifecycle within the main Flowise server

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import logger from '../utils/logger'
import { net } from '@universo/utils'

export class MultiplayerManager {
    private colyseusProcess: ChildProcess | null = null
    private isEnabled: boolean = false
    private port: number = 2567
    private host: string = 'localhost'

    constructor() {
        this.isEnabled = process.env.ENABLE_MULTIPLAYER_SERVER === 'true'
        this.port = parseInt(process.env.MULTIPLAYER_SERVER_PORT || '2567')
        this.host = process.env.MULTIPLAYER_SERVER_HOST || 'localhost'
    }

    /**
     * Start Colyseus multiplayer server if enabled
     */
    async start(): Promise<void> {
        if (!this.isEnabled) {
            logger.info('[Multiplayer] Multiplayer server is disabled')
            return
        }

        try {
            logger.info(`[Multiplayer] Starting Colyseus server on ${this.host}:${this.port}...`)

            // Path to multiplayer server (current package root)
            const multiplayerPath = path.resolve(__dirname, '../../')
            
            // Check if multiplayer server exists
            const fs = require('fs')
            if (!fs.existsSync(multiplayerPath)) {
                logger.warn(`[Multiplayer] Multiplayer server not found at ${multiplayerPath}`)
                logger.warn('[Multiplayer] Skipping multiplayer server startup')
                return
            }

            await net.ensurePortAvailable(this.port, this.host)

            // Start Colyseus server as child process
            this.colyseusProcess = spawn('pnpm', ['start'], {
                cwd: multiplayerPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    COLYSEUS_PORT: this.port.toString(),
                    COLYSEUS_HOST: this.host,
                    // Don't override main server PORT
                    PORT: undefined
                }
            })

            // Handle process output
            this.colyseusProcess.stdout?.on('data', (data) => {
                const output = data.toString().trim()
                if (output) {
                    logger.info(`[Multiplayer] ${output}`)
                }
            })

            this.colyseusProcess.stderr?.on('data', (data) => {
                const output = data.toString().trim()
                if (output) {
                    logger.error(`[Multiplayer] ${output}`)
                }
            })

            // Handle process events
            this.colyseusProcess.on('spawn', () => {
                logger.info(`[Multiplayer] ✅ Colyseus server started successfully on ${this.host}:${this.port}`)
            })

            this.colyseusProcess.on('error', (error) => {
                logger.error(`[Multiplayer] Failed to start Colyseus server: ${error.message}`)
            })

            this.colyseusProcess.on('exit', (code, signal) => {
                if (code !== null) {
                    logger.info(`[Multiplayer] Colyseus server exited with code ${code}`)
                } else if (signal !== null) {
                    logger.info(`[Multiplayer] Colyseus server killed with signal ${signal}`)
                }
                this.colyseusProcess = null
            })

            // Give the server a moment to start
            await new Promise(resolve => setTimeout(resolve, 3000))

        } catch (error) {
            logger.error(`[Multiplayer] Error starting Colyseus server: ${error}`)
        }
    }

    /**
     * Stop Colyseus multiplayer server
     */
    async stop(): Promise<void> {
        if (!this.colyseusProcess) {
            return
        }

        try {
            logger.info('[Multiplayer] Stopping Colyseus server...')
            
            // Try graceful shutdown first
            this.colyseusProcess.kill('SIGTERM')
            
            // Wait for graceful shutdown
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    // Force kill if graceful shutdown takes too long
                    if (this.colyseusProcess) {
                        logger.warn('[Multiplayer] Force killing Colyseus server...')
                        this.colyseusProcess.kill('SIGKILL')
                    }
                    resolve()
                }, 5000)

                this.colyseusProcess?.on('exit', () => {
                    clearTimeout(timeout)
                    resolve()
                })
            })

            this.colyseusProcess = null
            logger.info('[Multiplayer] ✅ Colyseus server stopped')

        } catch (error) {
            logger.error(`[Multiplayer] Error stopping Colyseus server: ${error}`)
        }
    }

    /**
     * Check if multiplayer server is running
     */
    isRunning(): boolean {
        return this.colyseusProcess !== null && !this.colyseusProcess.killed
    }

    /**
     * Get server status info
     */
    getStatus(): { enabled: boolean; running: boolean; host: string; port: number } {
        return {
            enabled: this.isEnabled,
            running: this.isRunning(),
            host: this.host,
            port: this.port
        }
    }
}

// Singleton instance
let multiplayerManager: MultiplayerManager | null = null

export function getMultiplayerManager(): MultiplayerManager {
    if (!multiplayerManager) {
        multiplayerManager = new MultiplayerManager()
    }
    return multiplayerManager
}
