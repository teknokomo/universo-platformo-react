import { Request } from 'express'
import * as path from 'path'
import {
    addArrayFilesToStorage,
    getFileFromUpload,
    IDocument,
    mapExtToInputField,
    mapMimeTypeToInputField,
    removeSpecificFileFromUpload,
    isValidUUID,
    isPathTraversal
} from 'flowise-components'
import { getRunningExpressApp } from './getRunningExpressApp'
import { getErrorMessage } from '../errors/utils'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'
import canvasService from '../services/spacesCanvas'

/**
 * Create attachment
 * @param {Request} req
 */
export const createFileAttachment = async (req: Request) => {
    const appServer = getRunningExpressApp()

    const canvasId = req.params.canvasId
    if (!canvasId || !isValidUUID(canvasId)) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid canvasId format - must be a valid UUID')
    }

    const chatId = req.params.chatId
    if (!chatId || !isValidUUID(chatId)) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid chatId format - must be a valid UUID')
    }

    // Check for path traversal attempts
    if (isPathTraversal(canvasId) || isPathTraversal(chatId)) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid path characters detected')
    }

    // Validate canvas exists and check API key
    try {
        await canvasService.getCanvasById(canvasId)
    } catch (error: any) {
        if (typeof error?.status === 'number' && error.status === StatusCodes.NOT_FOUND) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Canvas ${canvasId} not found`)
        }
        throw error
    }

    // Find FileLoader node
    const fileLoaderComponent = appServer.nodesPool.componentNodes['fileLoader']
    const fileLoaderNodeInstanceFilePath = fileLoaderComponent.filePath as string
    const fileLoaderNodeModule = await import(fileLoaderNodeInstanceFilePath)
    const fileLoaderNodeInstance = new fileLoaderNodeModule.nodeClass()
    const options = {
        retrieveAttachmentChatId: true,
        canvasId,
        // Temporary bridge for nodes still expecting chatflowid option
        chatflowid: canvasId,
        chatId
    }
    const files = (req.files as Express.Multer.File[]) || []
    const fileAttachments = []
    if (files.length) {
        const isBase64 = req.body.base64
        for (const file of files) {
            const fileBuffer = await getFileFromUpload(file.path ?? file.key)
            const fileNames: string[] = []

            // Address file name with special characters: https://github.com/expressjs/multer/issues/1104
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')

            const storagePath = await addArrayFilesToStorage(file.mimetype, fileBuffer, file.originalname, fileNames, canvasId, chatId)

            const fileInputFieldFromMimeType = mapMimeTypeToInputField(file.mimetype)

            const fileExtension = path.extname(file.originalname)

            const fileInputFieldFromExt = mapExtToInputField(fileExtension)

            let fileInputField = 'txtFile'

            if (fileInputFieldFromExt !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            } else if (fileInputFieldFromMimeType !== 'txtFile') {
                fileInputField = fileInputFieldFromExt
            }

            await removeSpecificFileFromUpload(file.path ?? file.key)

            try {
                const nodeData = {
                    inputs: {
                        [fileInputField]: storagePath
                    },
                    outputs: { output: 'document' }
                }

                let content = ''

                if (isBase64) {
                    content = fileBuffer.toString('base64')
                } else {
                    const documents: IDocument[] = await fileLoaderNodeInstance.init(nodeData, '', options)
                    content = documents.map((doc) => doc.pageContent).join('\n')
                }

                fileAttachments.push({
                    name: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    content
                })
            } catch (error) {
                throw new Error(`Failed operation: createFileAttachment - ${getErrorMessage(error)}`)
            }
        }
    }

    return fileAttachments
}
