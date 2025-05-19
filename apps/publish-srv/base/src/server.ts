// Universo Platformo | Publish Module | Express Server
// Server for handling UPDL flow publishing operations

import express from 'express'
import path from 'path'
import cors from 'cors'
import publishRoutes from './routes/publishRoutes'
import { errorHandler } from './middlewares/errorHandler'

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

    // Set up API routes
    expressApp.use('/api/publish', publishRoutes)

    // Маршрут '/p/:id' теперь обрабатывается в основном приложении через React Router
    // Закомментировано, чтобы избежать конфликтов
    /*
    expressApp.get('/p/:id', (req, res) => {
        res.sendFile(path.join(publicDir, 'p', req.params.id, 'index.html'))
    })
    */

    // Serve UPDL published content
    expressApp.get('/published/:id', (req, res) => {
        res.sendFile(path.join(publicDir, 'published', req.params.id))
    })

    // Add error handler - must be the last middleware
    expressApp.use(errorHandler)

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

    // Если publish-srv запускается как часть основного приложения,
    // этот вызов не должен использоваться
    if (require.main === module) {
        app.listen(port, () => {
            console.log(`Publish server listening on port ${port}`)
        })
    }

    return configuredApp
}

// Start the server if this file is executed directly
if (require.main === module) {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
    startServer(port)
}
