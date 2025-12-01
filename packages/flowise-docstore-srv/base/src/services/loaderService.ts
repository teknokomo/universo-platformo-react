/**
 * Loader Service
 *
 * Operations for document loaders - adding, removing, processing.
 * Uses DI pattern - all dependencies passed via factory function.
 */

import { Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { v4 as uuidv4 } from 'uuid'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../database/entities/DocumentStoreFileChunk'
import { DocumentStoreStatus, IDocumentStoreLoader, IDocumentStoreLoaderForPreview, addLoaderSource } from '../Interface'
import { DocstoreServiceDependencies } from '../di/config'
import { InternalFlowiseError } from '../errors/InternalFlowiseError'
import { getErrorMessage } from '../errors/utils'

export const DOCUMENT_STORE_BASE_FOLDER = 'docustore'

export interface ILoaderService {
    deleteLoaderFromDocumentStore(storeId: string, docId: string): Promise<DocumentStore>
    saveProcessingLoader(data: IDocumentStoreLoaderForPreview): Promise<IDocumentStoreLoader>
}

/**
 * Factory function to create Loader service with injected dependencies
 */
export function createLoaderService(deps: DocstoreServiceDependencies): ILoaderService {
    const { dataSource, logger } = deps
    const documentStoreRepository: Repository<DocumentStore> = dataSource.getRepository(DocumentStore)
    const fileChunkRepository: Repository<DocumentStoreFileChunk> = dataSource.getRepository(DocumentStoreFileChunk)

    return {
        /**
         * Delete a loader from document store
         */
        async deleteLoaderFromDocumentStore(storeId: string, docId: string): Promise<DocumentStore> {
            try {
                const entity = await documentStoreRepository.findOneBy({ id: storeId })
                if (!entity) {
                    throw new InternalFlowiseError(
                        StatusCodes.NOT_FOUND,
                        `Error: loaderService.deleteLoaderFromDocumentStore - Document store ${storeId} not found`
                    )
                }

                const existingLoaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders || '[]')
                const found = existingLoaders.find((loader) => loader.id === docId)

                if (found) {
                    // Note: File storage removal should be handled by the caller
                    // This service only handles database operations

                    const index = existingLoaders.indexOf(found)
                    if (index > -1) {
                        existingLoaders.splice(index, 1)
                    }

                    // Remove the chunks
                    await fileChunkRepository.delete({ docId: found.id })

                    entity.loaders = JSON.stringify(existingLoaders)
                    const results = await documentStoreRepository.save(entity)
                    logger.debug(`Deleted loader ${docId} from document store ${storeId}`)
                    return results
                } else {
                    throw new InternalFlowiseError(
                        StatusCodes.INTERNAL_SERVER_ERROR,
                        `Unable to locate loader in Document Store ${entity.name}`
                    )
                }
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: loaderService.deleteLoaderFromDocumentStore - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Save a loader that is being processed (set status to SYNCING)
         */
        async saveProcessingLoader(data: IDocumentStoreLoaderForPreview): Promise<IDocumentStoreLoader> {
            try {
                const entity = await documentStoreRepository.findOneBy({ id: data.storeId })
                if (!entity) {
                    throw new InternalFlowiseError(
                        StatusCodes.NOT_FOUND,
                        `Error: loaderService.saveProcessingLoader - Document store ${data.storeId} not found`
                    )
                }

                const existingLoaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders || '[]')
                const newDocLoaderId = data.id ?? uuidv4()
                const found = existingLoaders.find((ldr) => ldr.id === newDocLoaderId)

                if (found) {
                    const foundIndex = existingLoaders.findIndex((ldr) => ldr.id === newDocLoaderId)

                    // Merge with existing data
                    if (!data.loaderId) data.loaderId = found.loaderId
                    if (!data.loaderName) data.loaderName = found.loaderName
                    if (!data.loaderConfig) data.loaderConfig = found.loaderConfig
                    if (!data.splitterId) data.splitterId = found.splitterId
                    if (!data.splitterName) data.splitterName = found.splitterName
                    if (!data.splitterConfig) data.splitterConfig = found.splitterConfig
                    if (found.credential) {
                        data.credential = found.credential
                    }

                    const loader: IDocumentStoreLoader = {
                        ...found,
                        loaderId: data.loaderId,
                        loaderName: data.loaderName,
                        loaderConfig: data.loaderConfig,
                        splitterId: data.splitterId,
                        splitterName: data.splitterName,
                        splitterConfig: data.splitterConfig,
                        totalChunks: 0,
                        totalChars: 0,
                        status: DocumentStoreStatus.SYNCING
                    }
                    if (data.credential) {
                        loader.credential = data.credential
                    }

                    existingLoaders[foundIndex] = loader
                    entity.loaders = JSON.stringify(existingLoaders)
                } else {
                    const loader: IDocumentStoreLoader = {
                        id: newDocLoaderId,
                        loaderId: data.loaderId,
                        loaderName: data.loaderName,
                        loaderConfig: data.loaderConfig,
                        splitterId: data.splitterId,
                        splitterName: data.splitterName,
                        splitterConfig: data.splitterConfig,
                        totalChunks: 0,
                        totalChars: 0,
                        status: DocumentStoreStatus.SYNCING
                    }
                    if (data.credential) {
                        loader.credential = data.credential
                    }
                    existingLoaders.push(loader)
                    entity.loaders = JSON.stringify(existingLoaders)
                }

                await documentStoreRepository.save(entity)

                const newLoaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders)
                const newLoader = newLoaders.find((ldr) => ldr.id === newDocLoaderId)
                if (!newLoader) {
                    throw new Error(`Loader ${newDocLoaderId} not found`)
                }
                newLoader.source = addLoaderSource(newLoader, true)

                logger.debug(`Saved processing loader ${newDocLoaderId} for document store ${data.storeId}`)
                return newLoader
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: loaderService.saveProcessingLoader - ${getErrorMessage(error)}`
                )
            }
        }
    }
}
