// Universo Platformo | Publish Module | Express Server
// Server for handling UPDL flow publishing operations

import express from 'express'
import path from 'path'
import cors from 'cors'
import publishRoutes from './routes/publishRoutes'

/**
 * Initialize the publish server
 * @param app Express application or create new if not provided
 * @returns Configured Express application
 */
export function initializePublishServer(app?: express.Application): express.Application {
    // Create app if not provided
    const expressApp = app || express()

    // Set up middleware
    expressApp.use(cors())
    expressApp.use(express.json({ limit: '50mb' }))

    // Set up static directory for published content
    const publicDir = path.resolve(process.cwd(), 'public')
    expressApp.use(express.static(publicDir))

    // Set up routes
    expressApp.use('/api/v1/publish', publishRoutes)

    // Serve published content
    expressApp.get('/p/:id', (req, res) => {
        res.sendFile(path.join(publicDir, 'p', req.params.id, 'index.html'))
    })

    // Add error handler
    expressApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Publish server error:', err)
        res.status(500).json({
            error: 'Internal server error',
            details: err instanceof Error ? err.message : String(err)
        })
    })

    console.log('Publish server initialized')

    return expressApp
}

/**
 * Start the server on the specified port
 * @param port Port to listen on
 * @returns Running server
 */
export function startServer(port = 3001): express.Application {
    const app = express()
    const configuredApp = initializePublishServer(app)

    app.listen(port, () => {
        console.log(`Publish server listening on port ${port}`)
    })

    return configuredApp
}

// Start the server if this file is executed directly
if (require.main === module) {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
    startServer(port)
}
