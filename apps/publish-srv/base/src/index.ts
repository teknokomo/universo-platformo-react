// Universo Platformo | Publish Server Module
// Main entry point for the publish server

import { startServer } from './server'

// Export server initializer
export * from './server'

// Start the server if this file is executed directly
if (require.main === module) {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001
    startServer(port)
}
