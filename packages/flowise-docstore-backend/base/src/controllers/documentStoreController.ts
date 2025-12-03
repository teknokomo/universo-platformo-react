/**
 * DocumentStore Controller
 *
 * Handles HTTP requests for document store operations.
 * Uses DI pattern - controller created via factory function with injected services.
 */

import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { DocumentStore } from '../database/entities/DocumentStore'
import { DocumentStoreDTO } from '../dto/DocumentStoreDTO'
import { InternalFlowiseError } from '../errors/InternalFlowiseError'
import { IDocumentStoreService } from '../services/documentStoreService'
import { IChunkService } from '../services/chunkService'
import { ILoaderService } from '../services/loaderService'
import { IVectorStoreConfigService } from '../services/vectorStoreConfigService'

/**
 * Access control function type - allows injection of custom access control logic
 */
export type AccessControlFn = (req: Request, res: Response, unikId: string, options?: { errorMessage?: string }) => Promise<string | null>

/**
 * Controller dependencies interface
 */
export interface IDocumentStoreControllerDeps {
    documentStoreService: IDocumentStoreService
    chunkService: IChunkService
    loaderService: ILoaderService
    vectorStoreConfigService: IVectorStoreConfigService
    ensureUnikMembership?: AccessControlFn
}

/**
 * Controller interface - all methods that can be used as route handlers
 */
export interface IDocumentStoreController {
    createDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    getAllDocumentStores(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    getDocumentStoreById(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    updateDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    deleteDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    deleteLoaderFromDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    getDocumentStoreFileChunks(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    deleteDocumentStoreFileChunk(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    editDocumentStoreFileChunk(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    saveVectorStoreConfig(req: Request, res: Response, next: NextFunction): Promise<Response | void>
    updateVectorStoreConfigOnly(req: Request, res: Response, next: NextFunction): Promise<Response | void>
}

const ACCESS_DENIED_MESSAGE = 'Access denied: You do not have permission to access this Unik'

/**
 * Factory function to create DocumentStore controller with injected dependencies
 */
export function createDocumentStoreController(deps: IDocumentStoreControllerDeps): IDocumentStoreController {
    const { documentStoreService, chunkService, loaderService, vectorStoreConfigService, ensureUnikMembership } = deps

    return {
        /**
         * Create a new document store
         */
        async createDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.body === 'undefined') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.createDocumentStore - body not provided!'
                    )
                }

                const body = req.body
                const unikId = req.params.unikId

                if (unikId && ensureUnikMembership) {
                    body.unik = { id: unikId }
                    const userId = await ensureUnikMembership(req, res, unikId, {
                        errorMessage: ACCESS_DENIED_MESSAGE
                    })
                    if (!userId) return
                }

                const docStore = DocumentStoreDTO.toEntity(body)
                const apiResponse = await documentStoreService.createDocumentStore(docStore)
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Get all document stores
         */
        async getAllDocumentStores(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                const unikId = req.params.unikId

                if (unikId && ensureUnikMembership) {
                    const userId = await ensureUnikMembership(req, res, unikId, {
                        errorMessage: ACCESS_DENIED_MESSAGE
                    })
                    if (!userId) return
                }

                const apiResponse = await documentStoreService.getAllDocumentStores(unikId)
                return res.json(DocumentStoreDTO.fromEntities(apiResponse))
            } catch (error) {
                next(error)
            }
        },

        /**
         * Get document store by ID
         */
        async getDocumentStoreById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.id === 'undefined' || req.params.id === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.getDocumentStoreById - id not provided!'
                    )
                }

                const unikId = req.params.unikId

                if (unikId && ensureUnikMembership) {
                    const userId = await ensureUnikMembership(req, res, unikId, {
                        errorMessage: ACCESS_DENIED_MESSAGE
                    })
                    if (!userId) return
                }

                const apiResponse = await documentStoreService.getDocumentStoreById(req.params.id, unikId)
                return res.json(DocumentStoreDTO.fromEntity(apiResponse))
            } catch (error) {
                next(error)
            }
        },

        /**
         * Update document store
         */
        async updateDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.id === 'undefined' || req.params.id === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.updateDocumentStore - storeId not provided!'
                    )
                }

                if (typeof req.body === 'undefined') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.updateDocumentStore - body not provided!'
                    )
                }

                const unikId = req.params.unikId

                if (unikId && ensureUnikMembership) {
                    const userId = await ensureUnikMembership(req, res, unikId, {
                        errorMessage: ACCESS_DENIED_MESSAGE
                    })
                    if (!userId) return
                }

                const store = await documentStoreService.getDocumentStoreById(req.params.id, unikId)
                if (!store) {
                    throw new InternalFlowiseError(
                        StatusCodes.NOT_FOUND,
                        `Error: documentStoreController.updateDocumentStore - DocumentStore ${req.params.id} not found`
                    )
                }

                const body = req.body
                if (unikId) {
                    body.unik = { id: unikId }
                }

                const updateDocStore = new DocumentStore()
                Object.assign(updateDocStore, body)
                const apiResponse = await documentStoreService.updateDocumentStore(store, updateDocStore)
                return res.json(DocumentStoreDTO.fromEntity(apiResponse))
            } catch (error) {
                next(error)
            }
        },

        /**
         * Delete document store
         */
        async deleteDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.id === 'undefined' || req.params.id === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.deleteDocumentStore - storeId not provided!'
                    )
                }

                const unikId = req.params.unikId

                if (unikId && ensureUnikMembership) {
                    const userId = await ensureUnikMembership(req, res, unikId, {
                        errorMessage: ACCESS_DENIED_MESSAGE
                    })
                    if (!userId) return
                }

                const apiResponse = await documentStoreService.deleteDocumentStore(req.params.id, unikId)
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Delete loader from document store
         */
        async deleteLoaderFromDocumentStore(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                const storeId = req.params.id
                const loaderId = req.params.loaderId

                if (!storeId || !loaderId) {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.deleteLoaderFromDocumentStore - missing storeId or loaderId.'
                    )
                }

                const apiResponse = await loaderService.deleteLoaderFromDocumentStore(storeId, loaderId)
                return res.json(DocumentStoreDTO.fromEntity(apiResponse))
            } catch (error) {
                next(error)
            }
        },

        /**
         * Get document store file chunks with pagination
         */
        async getDocumentStoreFileChunks(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.getDocumentStoreFileChunks - storeId not provided!'
                    )
                }

                if (typeof req.params.fileId === 'undefined' || req.params.fileId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.getDocumentStoreFileChunks - fileId not provided!'
                    )
                }

                const page = req.params.pageNo ? parseInt(req.params.pageNo) : 1
                const apiResponse = await chunkService.getDocumentStoreFileChunks(req.params.storeId, req.params.fileId, page)
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Delete specific file chunk from store
         */
        async deleteDocumentStoreFileChunk(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.deleteDocumentStoreFileChunk - storeId not provided!'
                    )
                }

                if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.deleteDocumentStoreFileChunk - loaderId not provided!'
                    )
                }

                if (typeof req.params.chunkId === 'undefined' || req.params.chunkId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.deleteDocumentStoreFileChunk - chunkId not provided!'
                    )
                }

                const apiResponse = await chunkService.deleteDocumentStoreFileChunk(
                    req.params.storeId,
                    req.params.loaderId,
                    req.params.chunkId
                )
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Edit specific file chunk
         */
        async editDocumentStoreFileChunk(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.params.storeId === 'undefined' || req.params.storeId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.editDocumentStoreFileChunk - storeId not provided!'
                    )
                }

                if (typeof req.params.loaderId === 'undefined' || req.params.loaderId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.editDocumentStoreFileChunk - loaderId not provided!'
                    )
                }

                if (typeof req.params.chunkId === 'undefined' || req.params.chunkId === '') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.editDocumentStoreFileChunk - chunkId not provided!'
                    )
                }

                const body = req.body
                if (typeof body === 'undefined') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.editDocumentStoreFileChunk - body not provided!'
                    )
                }

                const apiResponse = await chunkService.editDocumentStoreFileChunk(
                    req.params.storeId,
                    req.params.loaderId,
                    req.params.chunkId,
                    body.pageContent,
                    body.metadata
                )
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Save vector store configuration
         */
        async saveVectorStoreConfig(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.body === 'undefined') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.saveVectorStoreConfig - body not provided!'
                    )
                }

                const body = req.body
                const apiResponse = await vectorStoreConfigService.saveVectorStoreConfig(body)
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        },

        /**
         * Update vector store config only
         */
        async updateVectorStoreConfigOnly(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
            try {
                if (typeof req.body === 'undefined') {
                    throw new InternalFlowiseError(
                        StatusCodes.PRECONDITION_FAILED,
                        'Error: documentStoreController.updateVectorStoreConfigOnly - body not provided!'
                    )
                }

                const body = req.body
                const apiResponse = await vectorStoreConfigService.updateVectorStoreConfigOnly(body)
                return res.json(apiResponse)
            } catch (error) {
                next(error)
            }
        }
    }
}
