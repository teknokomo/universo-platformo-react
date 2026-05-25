import * as Server from '../index'
import { initKnex } from '@universo/database'
import logger from '../utils/logger'
import { BaseCommand } from './base'
import { net, rateLimiting } from '@universo/utils'

export default class Start extends BaseCommand {
    async run(): Promise<void> {
        await this.parse(Start)

        logger.info('Starting Universo Platformo...')
        const host = process.env.HOST
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

        await net.ensurePortAvailable(port, host)
        initKnex()
        await Server.start()
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
            logger.info('Shutting down Universo Platformo...')

            const serverApp = Server.getInstance()
            if (serverApp) await serverApp.stopApp()

            // Close Redis client used by rate limiters (if any)
            await rateLimiting.RedisClientManager.close()
        } catch (error) {
            logger.error('There was an error shutting down...', error)
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
