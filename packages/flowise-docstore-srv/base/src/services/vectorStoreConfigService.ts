/**
 * Vector Store Config Service
 *
 * Operations for saving and managing vector store configurations.
 * Uses DI pattern - all dependencies passed via factory function.
 */

import { Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../database/entities/DocumentStoreFileChunk'
import { DocumentStoreStatus } from '../Interface'
import { DocstoreServiceDependencies } from '../di/config'
import { InternalFlowiseError } from '../errors/InternalFlowiseError'
import { getErrorMessage } from '../errors/utils'

export interface IVectorStoreConfigService {
    saveVectorStoreConfig(data: Record<string, unknown>, isStrictSave?: boolean): Promise<DocumentStore>
    updateVectorStoreConfigOnly(data: Record<string, unknown>): Promise<DocumentStore | Record<string, unknown>>
}

/**
 * Factory function to create Vector Store Config service with injected dependencies
 */
export function createVectorStoreConfigService(deps: DocstoreServiceDependencies): IVectorStoreConfigService {
    const { dataSource, logger } = deps
    const documentStoreRepository: Repository<DocumentStore> = dataSource.getRepository(DocumentStore)
    const fileChunkRepository: Repository<DocumentStoreFileChunk> = dataSource.getRepository(DocumentStoreFileChunk)

    return {
        /**
         * Save vector store, embedding, and record manager configurations
         */
        async saveVectorStoreConfig(data: Record<string, unknown>, isStrictSave: boolean = true): Promise<DocumentStore> {
            try {
                const entity = await documentStoreRepository.findOneBy({
                    id: data.storeId as string
                })
                if (!entity) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store ${data.storeId} not found`)
                }

                // Handle embedding config
                if (data.embeddingName) {
                    entity.embeddingConfig = JSON.stringify({
                        config: data.embeddingConfig,
                        name: data.embeddingName
                    })
                } else if (entity.embeddingConfig && !data.embeddingName && !data.embeddingConfig) {
                    data.embeddingConfig = JSON.parse(entity.embeddingConfig)?.config
                    data.embeddingName = JSON.parse(entity.embeddingConfig)?.name
                    if (isStrictSave) entity.embeddingConfig = null
                } else if (!data.embeddingName && !data.embeddingConfig) {
                    entity.embeddingConfig = null
                }

                // Handle vector store config
                if (data.vectorStoreName) {
                    entity.vectorStoreConfig = JSON.stringify({
                        config: data.vectorStoreConfig,
                        name: data.vectorStoreName
                    })
                } else if (entity.vectorStoreConfig && !data.vectorStoreName && !data.vectorStoreConfig) {
                    data.vectorStoreConfig = JSON.parse(entity.vectorStoreConfig)?.config
                    data.vectorStoreName = JSON.parse(entity.vectorStoreConfig)?.name
                    if (isStrictSave) entity.vectorStoreConfig = null
                } else if (!data.vectorStoreName && !data.vectorStoreConfig) {
                    entity.vectorStoreConfig = null
                }

                // Handle record manager config
                if (data.recordManagerName) {
                    entity.recordManagerConfig = JSON.stringify({
                        config: data.recordManagerConfig,
                        name: data.recordManagerName
                    })
                } else if (entity.recordManagerConfig && !data.recordManagerName && !data.recordManagerConfig) {
                    data.recordManagerConfig = JSON.parse(entity.recordManagerConfig)?.config
                    data.recordManagerName = JSON.parse(entity.recordManagerConfig)?.name
                    if (isStrictSave) entity.recordManagerConfig = null
                } else if (!data.recordManagerName && !data.recordManagerConfig) {
                    entity.recordManagerConfig = null
                }

                // Update status if configurations are being set
                if (
                    entity.status !== DocumentStoreStatus.UPSERTED &&
                    (data.vectorStoreName || data.recordManagerName || data.embeddingName)
                ) {
                    entity.status = DocumentStoreStatus.SYNC
                }

                const savedEntity = await documentStoreRepository.save(entity)
                logger.debug(`Saved vector store config for document store ${data.storeId}`)
                return savedEntity
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: vectorStoreConfigService.saveVectorStoreConfig - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Update only the vector store configuration (not embedding or record manager)
         */
        async updateVectorStoreConfigOnly(data: Record<string, unknown>): Promise<DocumentStore | Record<string, unknown>> {
            try {
                const entity = await documentStoreRepository.findOneBy({
                    id: data.storeId as string
                })
                if (!entity) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store ${data.storeId} not found`)
                }

                if (data.vectorStoreName) {
                    entity.vectorStoreConfig = JSON.stringify({
                        config: data.vectorStoreConfig,
                        name: data.vectorStoreName
                    })

                    const updatedEntity = await documentStoreRepository.save(entity)
                    logger.debug(`Updated vector store config only for document store ${data.storeId}`)
                    return updatedEntity
                }
                return {}
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: vectorStoreConfigService.updateVectorStoreConfigOnly - ${getErrorMessage(error)}`
                )
            }
        }
    }
}
