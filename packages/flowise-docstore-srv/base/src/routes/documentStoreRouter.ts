/**
 * DocumentStore Router
 *
 * Express router for document store endpoints.
 * Uses DI pattern - router created via factory function with injected controller.
 */

import { Router } from 'express'
import { IDocumentStoreController } from '../controllers/documentStoreController'

/**
 * Factory function to create DocumentStore router with injected controller
 */
export function createDocumentStoreRouter(controller: IDocumentStoreController): Router {
    const router = Router({ mergeParams: true })

    // ===============================
    // Document Store Routes
    // ===============================

    // Create document store
    router.post('/store', controller.createDocumentStore.bind(controller))

    // List all stores
    router.get('/store', controller.getAllDocumentStores.bind(controller))

    // Get specific store
    router.get('/store/:id', controller.getDocumentStoreById.bind(controller))

    // Update documentStore
    router.put('/store/:id', controller.updateDocumentStore.bind(controller))

    // Delete documentStore
    router.delete('/store/:id', controller.deleteDocumentStore.bind(controller))

    // ===============================
    // Loader Routes
    // ===============================

    // Delete loader from document store
    router.delete('/loader/:id/:loaderId', controller.deleteLoaderFromDocumentStore.bind(controller))

    // ===============================
    // Chunk Routes
    // ===============================

    // Delete specific file chunk from the store
    router.delete('/chunks/:storeId/:loaderId/:chunkId', controller.deleteDocumentStoreFileChunk.bind(controller))

    // Edit specific file chunk from the store
    router.put('/chunks/:storeId/:loaderId/:chunkId', controller.editDocumentStoreFileChunk.bind(controller))

    // Get all file chunks from the store
    router.get('/chunks/:storeId/:fileId/:pageNo', controller.getDocumentStoreFileChunks.bind(controller))

    // ===============================
    // Vector Store Config Routes
    // ===============================

    // Save the selected vector store config
    router.post('/vectorstore/save', controller.saveVectorStoreConfig.bind(controller))

    // Update the selected vector store config
    router.post('/vectorstore/update', controller.updateVectorStoreConfigOnly.bind(controller))

    return router
}
