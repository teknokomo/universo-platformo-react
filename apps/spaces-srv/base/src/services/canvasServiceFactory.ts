import { DataSource } from 'typeorm'
import { ChatflowType } from '../types'
import { Canvas } from '../database/entities/Canvas'
import {
    CanvasService,
    CanvasServiceDependencies,
    CanvasServiceEntities,
    PublicCanvasResponse,
    CanvasScope
} from './canvasService'

export interface CanvasServiceFactoryOptions {
    getDataSource: () => DataSource
    entities: CanvasServiceEntities
    dependencies: CanvasServiceDependencies
}

export type CanvasFlowResult = Canvas

export interface CanvasServiceAdapter {
    readonly legacyService: CanvasService
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
    getSinglePublicCanvas: (canvasId: string) => Promise<PublicCanvasResponse>
}

export const createCanvasService = (options: CanvasServiceFactoryOptions): CanvasServiceAdapter => {
    const legacyService = new CanvasService(
        options.getDataSource,
        options.entities,
        options.dependencies
    )

    return {
        legacyService,
        checkIfCanvasIsValidForStreaming: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.checkIfCanvasIsValidForStreaming(canvasId, scope)
        },
        checkIfCanvasIsValidForUploads: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.checkIfCanvasIsValidForUploads(canvasId, scope)
        },
        deleteCanvas: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.deleteCanvas(canvasId, scope)
        },
        getAllCanvases: async ({ unikId, spaceId, type }: { unikId?: string; spaceId?: string; type?: ChatflowType }) => {
            return legacyService.getAllCanvases(type, { unikId, spaceId })
        },
        getCanvasByApiKey: async (apiKeyId: string, keyOnly?: string) => {
            return legacyService.getCanvasesByApiKey(apiKeyId, keyOnly)
        },
        getCanvasById: async (canvasId: string, scope?: CanvasScope) => {
            return legacyService.getCanvasById(canvasId, scope)
        },
        saveCanvas: async (canvasData: Partial<Canvas>, scope?: CanvasScope) => {
            return legacyService.saveCanvas(canvasData, scope)
        },
        importCanvases: async (canvases: Partial<Canvas>[], scope?: CanvasScope, queryRunner?: any) => {
            return legacyService.importCanvases(canvases, scope, queryRunner)
        },
        updateCanvas: async (canvasId: string, update: Partial<Canvas>, scope?: CanvasScope) => {
            const existing = await legacyService.getCanvasById(canvasId, scope)
            const updateEntity = new Canvas()
            Object.assign(updateEntity, update)
            updateEntity.id = canvasId
            return legacyService.updateCanvas(existing as Canvas, updateEntity, scope)
        },
        getSinglePublicCanvas: async (canvasId: string) => {
            return legacyService.getSinglePublicCanvas(canvasId)
        }
    }
}

export default createCanvasService
