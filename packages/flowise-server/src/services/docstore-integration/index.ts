/**
 * DocumentStore Service Integration
 *
 * This module integrates @flowise/docstore-srv services into flowise-server.
 * It provides factory functions that create services with proper dependencies.
 */

import { createDocumentStoreService, type IDocumentStoreService, type DocstoreServiceDependencies } from '@flowise/docstore-srv'
import { getDataSource } from '../../DataSource'
import logger from '../../utils/logger'

// Singleton instance
let documentStoreServiceInstance: IDocumentStoreService | null = null

/**
 * Create logger adapter for docstore-srv
 */
function createLoggerAdapter() {
    return {
        debug: (message: string) => logger.debug(`[DocStore] ${message}`),
        info: (message: string) => logger.info(`[DocStore] ${message}`),
        warn: (message: string) => logger.warn(`[DocStore] ${message}`),
        error: (message: string) => logger.error(`[DocStore] ${message}`)
    }
}

/**
 * Get or create DocumentStore service instance
 * Uses lazy initialization to avoid circular dependencies
 */
export function getDocumentStoreService(): IDocumentStoreService {
    if (!documentStoreServiceInstance) {
        const deps: DocstoreServiceDependencies = {
            dataSource: getDataSource(),
            logger: createLoggerAdapter()
        }
        documentStoreServiceInstance = createDocumentStoreService(deps)
    }
    return documentStoreServiceInstance
}

/**
 * Reset service instance (useful for testing)
 */
export function resetDocumentStoreService(): void {
    documentStoreServiceInstance = null
}
