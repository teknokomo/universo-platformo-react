/**
 * DocumentStore Service
 *
 * Core CRUD operations for document stores.
 * Uses DI pattern - all dependencies passed via factory function.
 */

import { Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../database/entities/DocumentStoreFileChunk'
import { UpsertHistory } from '../database/entities/UpsertHistory'
import { DocstoreServiceDependencies } from '../di/config'
import { InternalFlowiseError } from '../errors/InternalFlowiseError'
import { getErrorMessage } from '../errors/utils'

export interface IDocumentStoreService {
    createDocumentStore(newDocumentStore: DocumentStore): Promise<DocumentStore>
    getAllDocumentStores(unikId?: string): Promise<DocumentStore[]>
    getDocumentStoreById(storeId: string, unikId?: string): Promise<DocumentStore>
    updateDocumentStore(documentStore: DocumentStore, updatedDocumentStore: Partial<DocumentStore>): Promise<DocumentStore>
    deleteDocumentStore(storeId: string, unikId?: string): Promise<{ deleted: number }>
    updateDocumentStoreUsage(canvasId: string, storeId: string | undefined, unikId: string): Promise<void>
}

/**
 * Factory function to create DocumentStore service with injected dependencies
 */
export function createDocumentStoreService(deps: DocstoreServiceDependencies): IDocumentStoreService {
    const { dataSource, logger } = deps
    const documentStoreRepository: Repository<DocumentStore> = dataSource.getRepository(DocumentStore)
    const fileChunkRepository: Repository<DocumentStoreFileChunk> = dataSource.getRepository(DocumentStoreFileChunk)
    const upsertHistoryRepository: Repository<UpsertHistory> = dataSource.getRepository(UpsertHistory)

    return {
        /**
         * Create a new document store
         */
        async createDocumentStore(newDocumentStore: DocumentStore): Promise<DocumentStore> {
            try {
                const documentStore = documentStoreRepository.create(newDocumentStore)
                const dbResponse = await documentStoreRepository.save(documentStore)
                logger.debug(`Created document store: ${dbResponse.id}`)
                return dbResponse
            } catch (error) {
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.createDocumentStore - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Get all document stores, optionally filtered by unikId
         */
        async getAllDocumentStores(unikId?: string): Promise<DocumentStore[]> {
            try {
                let query = documentStoreRepository.createQueryBuilder('docstore')

                // Universo Platformo | Added filtering by unikId
                if (unikId) {
                    query = query.where('docstore.unik_id = :unikId', { unikId })
                }

                const entities = await query.getMany()
                return entities
            } catch (error) {
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.getAllDocumentStores - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Get document store by ID, optionally filtered by unikId
         */
        async getDocumentStoreById(storeId: string, unikId?: string): Promise<DocumentStore> {
            try {
                let whereClause: Record<string, unknown> = { id: storeId }

                // Universo Platformo | Added filtering by unikId
                if (unikId) {
                    whereClause = {
                        id: storeId,
                        unik: { id: unikId }
                    }
                }

                const entity = await documentStoreRepository.findOne({
                    where: whereClause,
                    relations: ['unik']
                })

                if (!entity) {
                    throw new InternalFlowiseError(
                        StatusCodes.NOT_FOUND,
                        `Error: documentStoreService.getDocumentStoreById - Document store ${storeId} not found`
                    )
                }
                return entity
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.getDocumentStoreById - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Update an existing document store
         */
        async updateDocumentStore(documentStore: DocumentStore, updatedDocumentStore: Partial<DocumentStore>): Promise<DocumentStore> {
            try {
                const merged = documentStoreRepository.merge(documentStore, updatedDocumentStore)
                const dbResponse = await documentStoreRepository.save(merged)
                logger.debug(`Updated document store: ${dbResponse.id}`)
                return dbResponse
            } catch (error) {
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.updateDocumentStore - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Delete a document store and all associated data
         */
        async deleteDocumentStore(storeId: string, unikId?: string): Promise<{ deleted: number }> {
            try {
                let whereClause: Record<string, unknown> = { id: storeId }

                // Universo Platform | Added unikId filtering
                if (unikId) {
                    whereClause = {
                        id: storeId,
                        unik: { id: unikId }
                    }
                }

                // Find document with unikId filter
                const entity = await documentStoreRepository.findOne({
                    where: whereClause,
                    relations: ['unik']
                })

                if (!entity) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
                }

                // Delete all chunks associated with the store
                await fileChunkRepository.delete({ storeId: storeId })

                // Delete upsert history
                await upsertHistoryRepository.delete({ canvasId: storeId })

                // Delete the store with unikId filter if provided
                const result = await documentStoreRepository.delete(whereClause)

                logger.debug(`Deleted document store: ${storeId}`)
                return { deleted: result.affected || 0 }
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.deleteDocumentStore - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Update document store usage tracking (whereUsed field)
         */
        async updateDocumentStoreUsage(canvasId: string, storeId: string | undefined, unikId: string): Promise<void> {
            try {
                // Find all entities that have the canvasId in their whereUsed, filtered by unikId for security
                const entities = await documentStoreRepository.find({
                    where: { unik: { id: unikId } }
                })

                for (const entity of entities) {
                    const whereUsed: string[] = JSON.parse(entity.whereUsed || '[]')
                    const found = whereUsed.find((w: string) => w === canvasId)

                    if (found) {
                        if (!storeId) {
                            // Remove the canvasId from the whereUsed, as the store is being deleted
                            const index = whereUsed.indexOf(canvasId)
                            if (index > -1) {
                                whereUsed.splice(index, 1)
                                entity.whereUsed = JSON.stringify(whereUsed)
                                await documentStoreRepository.save(entity)
                            }
                        } else if (entity.id === storeId) {
                            // Do nothing, already found and updated
                        } else if (entity.id !== storeId) {
                            // Remove the canvasId from the whereUsed, as a new store is being used
                            const index = whereUsed.indexOf(canvasId)
                            if (index > -1) {
                                whereUsed.splice(index, 1)
                                entity.whereUsed = JSON.stringify(whereUsed)
                                await documentStoreRepository.save(entity)
                            }
                        }
                    } else {
                        if (entity.id === storeId) {
                            // Add the canvasId to the whereUsed
                            whereUsed.push(canvasId)
                            entity.whereUsed = JSON.stringify(whereUsed)
                            await documentStoreRepository.save(entity)
                        }
                    }
                }
            } catch (error) {
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: documentStoreService.updateDocumentStoreUsage - ${getErrorMessage(error)}`
                )
            }
        }
    }
}
