import { DataSource } from 'typeorm'
import { ChatflowType } from '../types'
import { Canvas } from '../database/entities/Canvas'
import {
    LegacyChatflowsService,
    LegacyChatflowDependencies,
    LegacyChatflowEntities,
    LegacyChatflowPublicCanvas,
    CanvasScope
} from './legacyChatflowsService'

export interface CanvasServiceFactoryOptions {
    getDataSource: () => DataSource
    entities: LegacyChatflowEntities
    dependencies: LegacyChatflowDependencies
}

export type CanvasFlowResult = Canvas

export interface CanvasService {
    readonly legacyService: LegacyChatflowsService
    checkIfCanvasIsValidForStreaming: (
        canvasId: string,
        scope?: CanvasScope
    ) => Promise<{ isStreaming: boolean }>
    checkIfCanvasIsValidForUploads: (canvasId: string, scope?: CanvasScope) => Promise<any>
    deleteCanvas: (canvasId: string, scope?: CanvasScope) => Promise<any>
    getAllCanvases: (params: { unikId?: string; spaceId?: string; type?: ChatflowType }) => Promise<CanvasFlowResult[]>
    getCanvasByApiKey: (apiKeyId: string, keyOnly?: string) => Promise<CanvasFlowResult[]>
    getCanvasById: (canvasId: string, scope?: CanvasScope) => Promise<CanvasFlowResult>
    saveCanvas: (canvasData: Partial<Canvas>, scope?: CanvasScope) => Promise<CanvasFlowResult>
    importCanvases: (canvases: Partial<Canvas>[], scope?: CanvasScope, queryRunner?: any) => Promise<any>
    updateCanvas: (canvasId: string, update: Partial<Canvas>, scope?: CanvasScope) => Promise<CanvasFlowResult>
    getSinglePublicCanvas: (canvasId: string) => Promise<LegacyChatflowPublicCanvas>
}

export const createCanvasService = (options: CanvasServiceFactoryOptions): CanvasService => {
    const legacyService = new LegacyChatflowsService(
        options.getDataSource,
        options.entities,
        options.dependencies
    )

    return {
        legacyService,
        checkIfCanvasIsValidForStreaming: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.checkIfChatflowIsValidForStreaming(canvasId, scope)
        },
        checkIfCanvasIsValidForUploads: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.checkIfChatflowIsValidForUploads(canvasId, scope)
        },
        deleteCanvas: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.deleteChatflow(canvasId, scope)
        },
        getAllCanvases: async ({ unikId, spaceId, type }: { unikId?: string; spaceId?: string; type?: ChatflowType }) => {
            return legacyService.getAllChatflows(type, { unikId, spaceId })
        },
        getCanvasByApiKey: async (apiKeyId: string, keyOnly?: string) => {
            return legacyService.getChatflowByApiKey(apiKeyId, keyOnly)
        },
        getCanvasById: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.getChatflowById(canvasId, scope)
        },
        saveCanvas: async (canvasData: Partial<Canvas>, scope?: CanvasScope) => {
            return legacyService.saveChatflow(canvasData, scope)
        },
        importCanvases: async (canvases: Partial<Canvas>[], scope?: CanvasScope, queryRunner?: any) => {
            return legacyService.importChatflows(canvases, scope, queryRunner)
        },
        updateCanvas: async (canvasId: string, update: Partial<Canvas>, scope?: CanvasScope) => {
            const existing = await legacyService.getChatflowById(canvasId, scope)
            const updateEntity = new Canvas()
            Object.assign(updateEntity, update)
            updateEntity.id = canvasId
            return legacyService.updateChatflow(existing as Canvas, updateEntity, scope)
        },
        getSinglePublicCanvas: async (canvasId: string) => {
            return legacyService.getSinglePublicChatflow(canvasId)
        }
    }
}

export default createCanvasService
