import {
    ICommonObject,
    IDatabaseEntity,
    INode,
    INodeData,
    INodeOptionsValue,
    INodeOutputsValue,
    INodeParams,
    IDocumentStoreData
} from '../../../src/Interface'
import { DataSource } from 'typeorm'
import { Document } from '@langchain/core/documents'
import { handleEscapeCharacters, safeGet, safeJSONParse } from '../../../src'

class DocStore_DocumentLoaders implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]
    outputs: INodeOutputsValue[]

    constructor() {
        this.label = 'Document Store'
        this.name = 'documentStore'
        this.version = 1.0
        this.type = 'Document'
        this.icon = 'dstore.svg'
        this.category = 'Document Loaders'
        this.description = `Load data from pre-configured document stores`
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'Select Store',
                name: 'selectedStore',
                type: 'asyncOptions',
                loadMethod: 'listStores'
            }
        ]
        this.outputs = [
            {
                label: 'Document',
                name: 'document',
                description: 'Array of document objects containing metadata and pageContent',
                baseClasses: [...this.baseClasses, 'json']
            },
            {
                label: 'Text',
                name: 'text',
                description: 'Concatenated string from pageContent of documents',
                baseClasses: ['string', 'json']
            }
        ]
    }

    //@ts-ignore
    loadMethods = {
        async listStores(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            const appDataSource = options.appDataSource as DataSource
            const databaseEntities = options.databaseEntities as IDatabaseEntity

            if (appDataSource === undefined || !appDataSource) {
                return returnData
            }

            const stores = await appDataSource.getRepository(databaseEntities['DocumentStore']).find()
            for (const store of stores) {
                const storeData = store as IDocumentStoreData
                if (safeGet(storeData, 'status', '') === 'SYNC') {
                    const obj = {
                        name: safeGet(storeData, 'id', ''),
                        label: safeGet(storeData, 'name', 'Unknown Store'),
                        description: safeGet(storeData, 'description', '')
                    }
                    returnData.push(obj)
                }
            }
            return returnData
        }
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const selectedStore = nodeData.inputs?.selectedStore as string
        const appDataSource = options.appDataSource as DataSource
        const databaseEntities = options.databaseEntities as IDatabaseEntity
        const chunks = await appDataSource
            .getRepository(databaseEntities['DocumentStoreFileChunk'])
            .find({ where: { storeId: selectedStore } })
        const output = nodeData.outputs?.output as string

        const finalDocs = []
        for (const chunk of chunks) {
            const chunkData = chunk as any
            const pageContent = safeGet(chunkData, 'pageContent', '')
            const metadataStr = safeGet(chunkData, 'metadata', '{}')
            const metadata = safeJSONParse(metadataStr, {})
            finalDocs.push(new Document({ pageContent, metadata }))
        }

        if (output === 'document') {
            return finalDocs
        } else {
            let finaltext = ''
            for (const doc of finalDocs) {
                finaltext += `${doc.pageContent}\n`
            }
            return handleEscapeCharacters(finaltext, false)
        }
    }
}

module.exports = { nodeClass: DocStore_DocumentLoaders }
