import * as Server from '../index'
import * as DataSource from '../DataSource'
import logger from '../utils/logger'
import { BaseCommand } from './base'
import { getMultiplayerManager } from '@universo/multiplayer-colyseus-srv'
import { net, rateLimiting } from '@universo/utils'

export default class Start extends BaseCommand {
    async run(): Promise<void> {
        logger.info('Starting Flowise...')
        const host = process.env.HOST
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

        await net.ensurePortAvailable(port, host)
        await DataSource.init()
        await Server.start()

        // Start multiplayer server after main server is running
        setTimeout(async () => {
            const multiplayerManager = getMultiplayerManager()
            await multiplayerManager.start()
        }, 1000)
    }

    async catch(error: Error) {
        if (error.message.includes('already in use')) {
            logger.error(`❌ [server]: ${error.message}`)
        } else if (error.stack) {
            logger.error(error.stack)
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }

    async stopProcess() {
        try {
            logger.info(`Shutting down Flowise...`)

            // Stop multiplayer server first
            const multiplayerManager = getMultiplayerManager()
            await multiplayerManager.stop()

            const serverApp = Server.getInstance()
            if (serverApp) await serverApp.stopApp()

            // Close Redis client used by rate limiters (if any)
            await rateLimiting.RedisClientManager.close()
        } catch (error) {
            logger.error('There was an error shutting down Flowise...', error)
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
