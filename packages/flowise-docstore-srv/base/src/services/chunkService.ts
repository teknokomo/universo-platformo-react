/**
 * Chunk Service
 *
 * Operations for document store file chunks.
 * Uses DI pattern - all dependencies passed via factory function.
 */

import { Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../database/entities/DocumentStoreFileChunk'
import { IDocumentStoreLoader, IDocumentStoreFileChunkPagedResponse } from '../Interface'
import { DocstoreServiceDependencies } from '../di/config'
import { InternalFlowiseError } from '../errors/InternalFlowiseError'
import { getErrorMessage } from '../errors/utils'

export interface IChunkService {
    getAllDocumentFileChunks(): Promise<DocumentStoreFileChunk[]>
    getDocumentStoreFileChunks(storeId: string, docId: string, pageNo?: number): Promise<IDocumentStoreFileChunkPagedResponse>
    deleteDocumentStoreFileChunk(storeId: string, docId: string, chunkId: string): Promise<IDocumentStoreFileChunkPagedResponse>
    editDocumentStoreFileChunk(
        storeId: string,
        docId: string,
        chunkId: string,
        content: string,
        metadata: Record<string, unknown>
    ): Promise<IDocumentStoreFileChunkPagedResponse>
}

const PAGE_SIZE = 50

/**
 * Factory function to create Chunk service with injected dependencies
 */
export function createChunkService(deps: DocstoreServiceDependencies): IChunkService {
    const { dataSource, logger } = deps
    const documentStoreRepository: Repository<DocumentStore> = dataSource.getRepository(DocumentStore)
    const fileChunkRepository: Repository<DocumentStoreFileChunk> = dataSource.getRepository(DocumentStoreFileChunk)

    /**
     * Internal helper to get chunks with pagination
     */
    async function getChunksInternal(storeId: string, docId: string, pageNo: number = 1): Promise<IDocumentStoreFileChunkPagedResponse> {
        const entity = await documentStoreRepository.findOneBy({ id: storeId })
        if (!entity) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: chunkService.getDocumentStoreFileChunks - Document store ${storeId} not found`
            )
        }

        const loaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders || '[]')

        let found: IDocumentStoreLoader | undefined
        if (docId !== 'all') {
            found = loaders.find((loader) => loader.id === docId)
            if (!found) {
                throw new InternalFlowiseError(
                    StatusCodes.NOT_FOUND,
                    `Error: chunkService.getDocumentStoreFileChunks - Document loader ${docId} not found`
                )
            }
        }

        if (found) {
            found.id = docId
            found.status = entity.status
        }

        let characters = 0
        if (docId === 'all') {
            loaders.forEach((loader) => {
                characters += loader.totalChars || 0
            })
        } else {
            characters = found?.totalChars || 0
        }

        const skip = (pageNo - 1) * PAGE_SIZE
        const take = PAGE_SIZE

        const whereCondition = docId === 'all' ? { storeId: storeId } : { docId: docId }

        const count = await fileChunkRepository.count({ where: whereCondition })
        const chunksWithCount = await fileChunkRepository.find({
            skip,
            take,
            where: whereCondition,
            order: { chunkNo: 'ASC' }
        })

        if (!chunksWithCount) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chunks with docId: ${docId} not found`)
        }

        const response: IDocumentStoreFileChunkPagedResponse = {
            chunks: chunksWithCount,
            count: count,
            file: found,
            currentPage: pageNo,
            storeName: entity.name,
            description: entity.description,
            docId: docId,
            characters
        }
        return response
    }

    return {
        /**
         * Get all document file chunks
         */
        async getAllDocumentFileChunks(): Promise<DocumentStoreFileChunk[]> {
            try {
                const entities = await fileChunkRepository.find()
                return entities
            } catch (error) {
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: chunkService.getAllDocumentFileChunks - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Get chunks for a specific loader or store with pagination
         */
        async getDocumentStoreFileChunks(
            storeId: string,
            docId: string,
            pageNo: number = 1
        ): Promise<IDocumentStoreFileChunkPagedResponse> {
            try {
                return await getChunksInternal(storeId, docId, pageNo)
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: chunkService.getDocumentStoreFileChunks - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Delete a specific chunk from document store
         */
        async deleteDocumentStoreFileChunk(storeId: string, docId: string, chunkId: string): Promise<IDocumentStoreFileChunkPagedResponse> {
            try {
                const entity = await documentStoreRepository.findOneBy({ id: storeId })
                if (!entity) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
                }

                const loaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders || '[]')
                const found = loaders.find((ldr) => ldr.id === docId)
                if (!found) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store loader ${docId} not found`)
                }

                const tbdChunk = await fileChunkRepository.findOneBy({ id: chunkId })
                if (!tbdChunk) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document Chunk ${chunkId} not found`)
                }

                await fileChunkRepository.delete(chunkId)

                found.totalChunks = (found.totalChunks || 0) - 1
                found.totalChars = (found.totalChars || 0) - tbdChunk.pageContent.length

                entity.loaders = JSON.stringify(loaders)
                await documentStoreRepository.save(entity)

                logger.debug(`Deleted chunk ${chunkId} from document store ${storeId}`)
                return await getChunksInternal(storeId, docId)
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: chunkService.deleteDocumentStoreFileChunk - ${getErrorMessage(error)}`
                )
            }
        },

        /**
         * Edit a specific chunk's content and metadata
         */
        async editDocumentStoreFileChunk(
            storeId: string,
            docId: string,
            chunkId: string,
            content: string,
            metadata: Record<string, unknown>
        ): Promise<IDocumentStoreFileChunkPagedResponse> {
            try {
                const entity = await documentStoreRepository.findOneBy({ id: storeId })
                if (!entity) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store ${storeId} not found`)
                }

                const loaders: IDocumentStoreLoader[] = JSON.parse(entity.loaders || '[]')
                const found = loaders.find((ldr) => ldr.id === docId)
                if (!found) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document store loader ${docId} not found`)
                }

                const editChunk = await fileChunkRepository.findOneBy({ id: chunkId })
                if (!editChunk) {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Document Chunk ${chunkId} not found`)
                }

                // Update char counts
                found.totalChars = (found.totalChars || 0) - editChunk.pageContent.length
                editChunk.pageContent = content
                editChunk.metadata = JSON.stringify(metadata)
                found.totalChars = (found.totalChars || 0) + content.length

                await fileChunkRepository.save(editChunk)
                entity.loaders = JSON.stringify(loaders)
                await documentStoreRepository.save(entity)

                logger.debug(`Edited chunk ${chunkId} in document store ${storeId}`)
                return await getChunksInternal(storeId, docId)
            } catch (error) {
                if (error instanceof InternalFlowiseError) {
                    throw error
                }
                throw new InternalFlowiseError(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    `Error: chunkService.editDocumentStoreFileChunk - ${getErrorMessage(error)}`
                )
            }
        }
    }
}
