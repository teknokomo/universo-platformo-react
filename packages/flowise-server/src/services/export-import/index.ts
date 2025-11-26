import { StatusCodes } from 'http-status-codes'
import { In, QueryRunner } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { Assistant } from '../../database/entities/Assistant'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { CustomTemplate } from '../../database/entities/CustomTemplate'
import { DocumentStore } from '../../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../../database/entities/DocumentStoreFileChunk'
import { Tool } from '@universo/flowise-tools-srv'
import { Variable } from '../../database/entities/Variable'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import assistantService from '../assistants'
import canvasMessagesService from '../canvas-messages'
import canvasService from '../spacesCanvas'
import documenStoreService from '../documentstore'
import marketplacesService from '../marketplaces'
import variableService from '../variables'
import { Canvas, CanvasFlowResult } from '@universo/spaces-srv'

type ExportInput = {
    agentflow: boolean
    assistantCustom: boolean
    assistantOpenAI: boolean
    assistantAzure: boolean
    canvas?: boolean
    chat_message: boolean
    chat_feedback: boolean
    custom_template: boolean
    document_store: boolean
    tool: boolean
    variable: boolean
}

type ExportData = {
    AgentFlow: CanvasFlowResult[]
    AssistantCustom: Assistant[]
    AssistantFlow: CanvasFlowResult[]
    AssistantOpenAI: Assistant[]
    AssistantAzure: Assistant[]
    CanvasFlow: CanvasFlowResult[]
    ChatMessage: ChatMessage[]
    ChatMessageFeedback: ChatMessageFeedback[]
    CustomTemplate: CustomTemplate[]
    DocumentStore: DocumentStore[]
    DocumentStoreFileChunk: DocumentStoreFileChunk[]
    Tool: Tool[]
    Variable: Variable[]
}

const convertExportInput = (body: any): ExportInput => {
    try {
        if (!body || typeof body !== 'object') throw new Error('Invalid ExportInput object in request body')
        if (body.agentflow && typeof body.agentflow !== 'boolean') throw new Error('Invalid agentflow property in ExportInput object')
        if (body.assistantCustom && typeof body.assistantCustom !== 'boolean')
            throw new Error('Invalid assistantCustom property in ExportInput object')
        if (body.assistantOpenAI && typeof body.assistantOpenAI !== 'boolean')
            throw new Error('Invalid assistantOpenAI property in ExportInput object')
        if (body.assistantAzure && typeof body.assistantAzure !== 'boolean')
            throw new Error('Invalid assistantAzure property in ExportInput object')
        if (body.canvas && typeof body.canvas !== 'boolean') throw new Error('Invalid canvas property in ExportInput object')
        if (body.chat_message && typeof body.chat_message !== 'boolean')
            throw new Error('Invalid chat_message property in ExportInput object')
        if (body.chat_feedback && typeof body.chat_feedback !== 'boolean')
            throw new Error('Invalid chat_feedback property in ExportInput object')
        if (body.custom_template && typeof body.custom_template !== 'boolean')
            throw new Error('Invalid custom_template property in ExportInput object')
        if (body.document_store && typeof body.document_store !== 'boolean')
            throw new Error('Invalid document_store property in ExportInput object')
        if (body.tool && typeof body.tool !== 'boolean') throw new Error('Invalid tool property in ExportInput object')
        if (body.variable && typeof body.variable !== 'boolean') throw new Error('Invalid variable property in ExportInput object')
        return body as ExportInput
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.convertExportInput - ${getErrorMessage(error)}`
        )
    }
}

const FileDefaultName = 'ExportData.json'
const exportData = async (exportInput: ExportInput, unikId: string): Promise<{ FileDefaultName: string } & ExportData> => {
    try {
        let AgentFlow: CanvasFlowResult[] =
            exportInput.agentflow === true
                ? await canvasService.getAllCanvases({ unikId, type: 'MULTIAGENT' })
                : []

        let AssistantCustom: Assistant[] =
            exportInput.assistantCustom === true ? await assistantService.getAllAssistants('CUSTOM', unikId) : []
        let AssistantFlow: CanvasFlowResult[] =
            exportInput.assistantCustom === true
                ? await canvasService.getAllCanvases({ unikId, type: 'ASSISTANT' })
                : []

        let AssistantOpenAI: Assistant[] =
            exportInput.assistantOpenAI === true ? await assistantService.getAllAssistants('OPENAI', unikId) : []

        let AssistantAzure: Assistant[] =
            exportInput.assistantAzure === true ? await assistantService.getAllAssistants('AZURE', unikId) : []

        const exportCanvasEntities = exportInput.canvas === true

        const CanvasFlow: CanvasFlowResult[] =
            exportCanvasEntities
                ? await canvasService.getAllCanvases({ unikId, type: 'CHATFLOW' })
                : []

        let ChatMessage: ChatMessage[] = exportInput.chat_message === true ? await canvasMessagesService.getAllMessages() : []

        let ChatMessageFeedback: ChatMessageFeedback[] =
            exportInput.chat_feedback === true ? await canvasMessagesService.getAllMessagesFeedback() : []

        let CustomTemplate: CustomTemplate[] =
            exportInput.custom_template === true ? await marketplacesService.getAllCustomTemplates(unikId) : []
        CustomTemplate = CustomTemplate.map((customTemplate) => ({ ...customTemplate, usecases: JSON.stringify(customTemplate.usecases) }))

        let DocumentStore: DocumentStore[] =
            exportInput.document_store === true ? await documenStoreService.getAllDocumentStores(unikId) : []

        let DocumentStoreFileChunk: DocumentStoreFileChunk[] =
            exportInput.document_store === true ? await documenStoreService.getAllDocumentFileChunks() : []

        let tools: Tool[] = exportInput.tool === true ? await getRunningExpressApp().AppDataSource.getRepository(Tool).find({ where: { unik: { id: unikId } } }) : []

        let Variable: Variable[] = exportInput.variable === true ? await variableService.getAllVariables(unikId) : []

        return {
            FileDefaultName,
            AgentFlow,
            AssistantCustom,
            AssistantFlow,
            AssistantOpenAI,
            AssistantAzure,
            CanvasFlow,
            ChatMessage,
            ChatMessageFeedback,
            CustomTemplate,
            DocumentStore,
            DocumentStoreFileChunk,
            Tool: tools,
            Variable
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.exportData - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForCanvasFlow(
    queryRunner: QueryRunner,
    originalData: ExportData,
    canvases: CanvasFlowResult[]
) {
    try {
        const ids = canvases.map((canvas) => canvas.id)
        const records = await queryRunner.manager.find(Canvas, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForCanvasFlow - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForAssistant(queryRunner: QueryRunner, originalData: ExportData, assistants: Assistant[]) {
    try {
        const ids = assistants.map((assistant) => assistant.id)
        const records = await queryRunner.manager.find(Assistant, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForAssistant - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForChatMessage(queryRunner: QueryRunner, originalData: ExportData, chatMessages: ChatMessage[]) {
    try {
        const chatmessageCanvasIds = chatMessages.map((chatMessage) => {
            return { id: chatMessage.canvasId, qty: 0 }
        })
        const originalDataCanvasIds = (originalData.CanvasFlow ?? []).map((flow) => flow.id)
        chatmessageCanvasIds.forEach((item) => {
            if (originalDataCanvasIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseCanvasIds = await (
            await queryRunner.manager.find(Canvas, {
                where: { id: In(chatmessageCanvasIds.map((chatmessageCanvasId) => chatmessageCanvasId.id)) }
            })
        ).map((canvas) => canvas.id)
        chatmessageCanvasIds.forEach((item) => {
            if (databaseCanvasIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const missingCanvasIds = chatmessageCanvasIds.filter((item) => item.qty === 0).map((item) => item.id)
        if (missingCanvasIds.length > 0) {
            chatMessages = chatMessages.filter((chatMessage) => !missingCanvasIds.includes(chatMessage.canvasId))
            originalData.ChatMessage = chatMessages
        }

        const ids = chatMessages.map((chatMessage) => chatMessage.id)
        const records = await queryRunner.manager.find(ChatMessage, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForChatMessage - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForChatMessageFeedback(
    queryRunner: QueryRunner,
    originalData: ExportData,
    chatMessageFeedbacks: ChatMessageFeedback[]
) {
    try {
        const feedbackCanvasIds = chatMessageFeedbacks.map((feedback) => {
            return { id: feedback.canvasId, qty: 0 }
        })
        const originalDataCanvasIds = (originalData.CanvasFlow ?? []).map((flow) => flow.id)
        feedbackCanvasIds.forEach((item) => {
            if (originalDataCanvasIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseCanvasIds = await (
            await queryRunner.manager.find(Canvas, {
                where: { id: In(feedbackCanvasIds.map((feedbackCanvasId) => feedbackCanvasId.id)) }
            })
        ).map((canvas) => canvas.id)
        feedbackCanvasIds.forEach((item) => {
            if (databaseCanvasIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const feedbackMessageIds = chatMessageFeedbacks.map((feedback) => {
            return { id: feedback.messageId, qty: 0 }
        })
        const originalDataMessageIds = originalData.ChatMessage.map((chatMessage) => chatMessage.id)
        feedbackMessageIds.forEach((item) => {
            if (originalDataMessageIds.includes(item.id)) {
                item.qty += 1
            }
        })
        const databaseMessageIds = await (
            await queryRunner.manager.find(ChatMessage, {
                where: { id: In(feedbackMessageIds.map((feedbackMessageId) => feedbackMessageId.id)) }
            })
        ).map((chatMessage) => chatMessage.id)
        feedbackMessageIds.forEach((item) => {
            if (databaseMessageIds.includes(item.id)) {
                item.qty += 1
            }
        })

        const missingCanvasIds = feedbackCanvasIds.filter((item) => item.qty === 0).map((item) => item.id)
        const missingMessageIds = feedbackMessageIds.filter((item) => item.qty === 0).map((item) => item.id)

        if (missingCanvasIds.length > 0 || missingMessageIds.length > 0) {
            chatMessageFeedbacks = chatMessageFeedbacks.filter(
                (feedback) => !missingCanvasIds.includes(feedback.canvasId) && !missingMessageIds.includes(feedback.messageId)
            )
            originalData.ChatMessageFeedback = chatMessageFeedbacks
        }

        const ids = chatMessageFeedbacks.map((chatMessageFeedback) => chatMessageFeedback.id)
        const records = await queryRunner.manager.find(ChatMessageFeedback, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForChatMessageFeedback - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForCustomTemplate(queryRunner: QueryRunner, originalData: ExportData, customTemplates: CustomTemplate[]) {
    try {
        const ids = customTemplates.map((customTemplate) => customTemplate.id)
        const records = await queryRunner.manager.find(CustomTemplate, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForCustomTemplate - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForDocumentStore(queryRunner: QueryRunner, originalData: ExportData, documentStores: DocumentStore[]) {
    try {
        const ids = documentStores.map((documentStore) => documentStore.id)
        const records = await queryRunner.manager.find(DocumentStore, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForDocumentStore - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForDocumentStoreFileChunk(
    queryRunner: QueryRunner,
    originalData: ExportData,
    documentStoreFileChunks: DocumentStoreFileChunk[]
) {
    try {
        const ids = documentStoreFileChunks.map((documentStoreFileChunk) => documentStoreFileChunk.id)
        const records = await queryRunner.manager.find(DocumentStoreFileChunk, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForDocumentStoreFileChunk - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForTool(queryRunner: QueryRunner, originalData: ExportData, tools: Tool[]) {
    try {
        const ids = tools.map((tool) => tool.id)
        const records = await queryRunner.manager.find(Tool, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForTool - ${getErrorMessage(error)}`
        )
    }
}

async function replaceDuplicateIdsForVariable(queryRunner: QueryRunner, originalData: ExportData, variables: Variable[]) {
    try {
        const ids = variables.map((variable) => variable.id)
        const records = await queryRunner.manager.find(Variable, {
            where: { id: In(ids) }
        })
        if (records.length < 0) return originalData
        for (let record of records) {
            const oldId = record.id
            const newId = uuidv4()
            originalData = JSON.parse(JSON.stringify(originalData).replaceAll(oldId, newId))
        }
        return originalData
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.replaceDuplicateIdsForVariable - ${getErrorMessage(error)}`
        )
    }
}

function reduceSpaceForCanvasFlowData(canvases: CanvasFlowResult[]) {
    return canvases.map((canvas) => {
        return { ...canvas, flowData: JSON.stringify(JSON.parse(canvas.flowData)) }
    })
}

const importData = async (importData: ExportData) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        importData.CanvasFlow = importData.CanvasFlow ?? []

        await queryRunner.connect()

        try {
            if (importData.AgentFlow.length > 0) {
                importData.AgentFlow = reduceSpaceForCanvasFlowData(importData.AgentFlow)
                importData = await replaceDuplicateIdsForCanvasFlow(queryRunner, importData, importData.AgentFlow)
            }
            if (importData.AssistantCustom.length > 0)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantCustom)
            if (importData.AssistantFlow.length > 0) {
                importData.AssistantFlow = reduceSpaceForCanvasFlowData(importData.AssistantFlow)
                importData = await replaceDuplicateIdsForCanvasFlow(queryRunner, importData, importData.AssistantFlow)
            }
            if (importData.AssistantOpenAI.length > 0)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantOpenAI)
            if (importData.AssistantAzure.length > 0)
                importData = await replaceDuplicateIdsForAssistant(queryRunner, importData, importData.AssistantAzure)
            if (importData.CanvasFlow.length > 0) {
                importData.CanvasFlow = reduceSpaceForCanvasFlowData(importData.CanvasFlow)
                importData = await replaceDuplicateIdsForCanvasFlow(queryRunner, importData, importData.CanvasFlow)
            }
            if (importData.ChatMessage.length > 0)
                importData = await replaceDuplicateIdsForChatMessage(queryRunner, importData, importData.ChatMessage)
            if (importData.ChatMessageFeedback.length > 0)
                importData = await replaceDuplicateIdsForChatMessageFeedback(queryRunner, importData, importData.ChatMessageFeedback)
            if (importData.CustomTemplate.length > 0)
                importData = await replaceDuplicateIdsForCustomTemplate(queryRunner, importData, importData.CustomTemplate)
            if (importData.DocumentStore.length > 0)
                importData = await replaceDuplicateIdsForDocumentStore(queryRunner, importData, importData.DocumentStore)
            if (importData.DocumentStoreFileChunk.length > 0)
                importData = await replaceDuplicateIdsForDocumentStoreFileChunk(queryRunner, importData, importData.DocumentStoreFileChunk)
            if (importData.Tool.length > 0) importData = await replaceDuplicateIdsForTool(queryRunner, importData, importData.Tool)
            if (importData.Variable.length > 0)
                importData = await replaceDuplicateIdsForVariable(queryRunner, importData, importData.Variable)

            await queryRunner.startTransaction()

            if (importData.AgentFlow.length > 0) await queryRunner.manager.save(Canvas, importData.AgentFlow)
            if (importData.AssistantFlow.length > 0) await queryRunner.manager.save(Canvas, importData.AssistantFlow)
            if (importData.AssistantCustom.length > 0) await queryRunner.manager.save(Assistant, importData.AssistantCustom)
            if (importData.AssistantOpenAI.length > 0) await queryRunner.manager.save(Assistant, importData.AssistantOpenAI)
            if (importData.AssistantAzure.length > 0) await queryRunner.manager.save(Assistant, importData.AssistantAzure)
            if (importData.CanvasFlow.length > 0) await queryRunner.manager.save(Canvas, importData.CanvasFlow)
            if (importData.ChatMessage.length > 0) await queryRunner.manager.save(ChatMessage, importData.ChatMessage)
            if (importData.ChatMessageFeedback.length > 0)
                await queryRunner.manager.save(ChatMessageFeedback, importData.ChatMessageFeedback)
            if (importData.CustomTemplate.length > 0) await queryRunner.manager.save(CustomTemplate, importData.CustomTemplate)
            if (importData.DocumentStore.length > 0) await queryRunner.manager.save(DocumentStore, importData.DocumentStore)
            if (importData.DocumentStoreFileChunk.length > 0)
                await queryRunner.manager.save(DocumentStoreFileChunk, importData.DocumentStoreFileChunk)
            if (importData.Tool.length > 0) await queryRunner.manager.save(Tool, importData.Tool)
            if (importData.Variable.length > 0) await queryRunner.manager.save(Variable, importData.Variable)

            await queryRunner.commitTransaction()
        } catch (error) {
            if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: exportImportService.importAll - ${getErrorMessage(error)}`
        )
    }
}

export default {
    convertExportInput,
    exportData,
    importData
}
