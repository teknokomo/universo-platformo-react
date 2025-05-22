// Universo Platformo | UPDL Server Main Entry Point
import express from 'express'
import cors from 'cors'
import router from './routes'
import { errorHandler } from './middlewares/errorHandler'
import { PORT } from './configs/constants'

/**
 * Initialize the UPDL server
 * @param app Express application or create new if not provided
 * @returns Configured Express application
 */
export function initializeUPDLServer(app?: express.Application): express.Application {
    // Create app if not provided
    const expressApp = app || express()

    // Set up middleware
    expressApp.use(cors())
    expressApp.use(express.json({ limit: '50mb' }))

    // Set up routes
    expressApp.use(router)

    // Add error handler - must be the last middleware
    expressApp.use(errorHandler)

    console.log('UPDL server initialized')

    return expressApp
}

/**
 * Start the server on the specified port
 * @param port Port to listen on
 * @returns Running server
 */
export function startServer(port = PORT): express.Application {
    const app = express()
    const configuredApp = initializeUPDLServer(app)

    app.listen(port, () => {
        console.log(`UPDL server listening on port ${port}`)
    })

    return configuredApp
}

// Start the server if this file is executed directly
if (require.main === module) {
    startServer()
}

export default {
    initializeUPDLServer,
    startServer
}
