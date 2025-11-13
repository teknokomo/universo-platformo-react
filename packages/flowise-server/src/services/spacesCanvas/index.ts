import { removeFolderFromStorage } from 'flowise-components'
import { FLOWISE_COUNTER_STATUS, FLOWISE_METRIC_COUNTERS } from '../../Interface.Metrics'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import documentStoreService from '../documentstore'
import { constructGraphs, getEndingNodes, getTelemetryFlowObj, isFlowValidForStream } from '../../utils'
import { containsBase64File, updateFlowDataWithFilePaths } from '../../utils/fileRepository'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { utilGetUploadsConfig } from '../../utils/getUploadsConfig'
import logger from '../../utils/logger'
import { createCanvasService } from '@universo/spaces-srv'

export const canvasServiceConfig = {
    entities: {
        chatMessage: ChatMessage,
        chatMessageFeedback: ChatMessageFeedback,
        upsertHistory: UpsertHistory
    },
    dependencies: {
        errorFactory: (status: number, message: string) => new InternalFlowiseError(status, message),
        removeFolderFromStorage,
        updateDocumentStoreUsage: (canvasId: string, usage: string | undefined, unikId: string) =>
            documentStoreService.updateDocumentStoreUsage(canvasId, usage, unikId),
        containsBase64File: ({ flowData }: { flowData: string }) => containsBase64File({ flowData } as any),
        updateFlowDataWithFilePaths,
        constructGraphs,
        getEndingNodes,
        isFlowValidForStream,
        getTelemetryFlowObj,
        telemetry: {
            sendTelemetry: async (eventName: string, payload: Record<string, unknown>, orgId?: string) => {
                const telemetry = getRunningExpressApp().telemetry
                if (telemetry) {
                    await telemetry.sendTelemetry(eventName, payload, orgId)
                }
            }
        },
        metricsProvider: {
            incrementCounter: (metric: string, labels?: Record<string, unknown>) => {
                const metrics = getRunningExpressApp().metricsProvider
                metrics?.incrementCounter(metric as FLOWISE_METRIC_COUNTERS, labels)
            }
        },
        metricsConfig: {
            canvasCreatedCounter: FLOWISE_METRIC_COUNTERS.CANVAS_CREATED,
            agentflowCreatedCounter: FLOWISE_METRIC_COUNTERS.AGENTFLOW_CREATED,
            successStatusLabel: FLOWISE_COUNTER_STATUS.SUCCESS
        },
        logger,
        getUploadsConfig: utilGetUploadsConfig
    }
}

const canvasService = createCanvasService({
    getDataSource: () => getRunningExpressApp().AppDataSource,
    entities: canvasServiceConfig.entities,
    dependencies: canvasServiceConfig.dependencies
})

export default canvasService
