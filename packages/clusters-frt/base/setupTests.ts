import { setupServer } from 'msw/node'
import { handlers } from './src/__mocks__/handlers'
import { afterAll, afterEach, beforeAll } from 'vitest'

// Export shared setup from base config
export * from '@testing/frontend/setupTests'

// Setup MSW server for HTTP request mocking
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
    server.listen({
        onUnhandledRequest: 'warn' // Warn about unhandled requests during development
    })
})

// Reset handlers after each test to ensure test isolation
afterEach(() => {
    server.resetHandlers()
})

// Clean up after all tests are done
afterAll(() => {
    server.close()
})
