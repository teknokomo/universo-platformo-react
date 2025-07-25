import { ICommonObject, IDatabaseEntity, INode, INodeData, INodeOptionsValue, INodeParams, IToolData } from '../../../src/Interface'
import { convertSchemaToZod, getBaseClasses, getVars, safeGet, hasProperty } from '../../../src/utils'
import { DynamicStructuredTool } from './core'
import { z } from 'zod'
import { DataSource } from 'typeorm'

class CustomTool_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'Custom Tool'
        this.name = 'customTool'
        this.version = 3.0
        this.type = 'CustomTool'
        this.icon = 'customtool.svg'
        this.category = 'Tools'
        this.description = `Use custom tool you've created in Flowise within chatflow`
        this.inputs = [
            {
                label: 'Select Tool',
                name: 'selectedTool',
                type: 'asyncOptions',
                loadMethod: 'listTools'
            },
            {
                label: 'Return Direct',
                name: 'returnDirect',
                description: 'Return the output of the tool directly to the user',
                type: 'boolean',
                optional: true
            },
            {
                label: 'Custom Tool Name',
                name: 'customToolName',
                type: 'string',
                hidden: true
            },
            {
                label: 'Custom Tool Description',
                name: 'customToolDesc',
                type: 'string',
                hidden: true
            },
            {
                label: 'Custom Tool Schema',
                name: 'customToolSchema',
                type: 'string',
                hidden: true
            },
            {
                label: 'Custom Tool Func',
                name: 'customToolFunc',
                type: 'string',
                hidden: true
            }
        ]
        this.baseClasses = [this.type, 'Tool', ...getBaseClasses(DynamicStructuredTool)]
    }

    //@ts-ignore
    loadMethods = {
        async listTools(_: INodeData, options: ICommonObject): Promise<INodeOptionsValue[]> {
            const returnData: INodeOptionsValue[] = []

            const appDataSource = options.appDataSource as DataSource
            const databaseEntities = options.databaseEntities as IDatabaseEntity

            if (appDataSource === undefined || !appDataSource) {
                return returnData
            }

            const tools = await appDataSource.getRepository(databaseEntities['Tool']).find()

            for (let i = 0; i < tools.length; i += 1) {
                const tool = tools[i] as IToolData
                const data = {
                    label: safeGet(tool, 'name', 'Unknown Tool'),
                    name: safeGet(tool, 'id', ''),
                    description: safeGet(tool, 'description', '')
                } as INodeOptionsValue
                returnData.push(data)
            }
            return returnData
        }
    }

    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<DynamicStructuredTool> {
        const selectedToolId = nodeData.inputs?.selectedTool as string
        const customToolFunc = nodeData.inputs?.customToolFunc as string
        const customToolName = nodeData.inputs?.customToolName as string
        const customToolDesc = nodeData.inputs?.customToolDesc as string
        const customToolSchema = nodeData.inputs?.customToolSchema as string
        const customToolReturnDirect = nodeData.inputs?.returnDirect as boolean

        const appDataSource = options.appDataSource as DataSource
        const databaseEntities = options.databaseEntities as IDatabaseEntity

        try {
            const tool = (await appDataSource.getRepository(databaseEntities['Tool']).findOneBy({
                id: selectedToolId
            })) as IToolData | null

            if (!tool) throw new Error(`Tool ${selectedToolId} not found`)

            const obj = {
                name: safeGet(tool, 'name', 'Unknown Tool'),
                description: safeGet(tool, 'description', ''),
                schema: z.object(convertSchemaToZod(safeGet(tool, 'schema', {}))),
                code: safeGet(tool, 'func', '')
            }

            if (customToolFunc) obj.code = customToolFunc
            if (customToolName) obj.name = customToolName
            if (customToolDesc) obj.description = customToolDesc
            if (customToolSchema) {
                try {
                    const zodSchemaFunction = new Function('z', `return ${customToolSchema}`)
                    obj.schema = zodSchemaFunction(z)
                } catch (error) {
                    console.warn('Invalid custom tool schema, using default:', error)
                }
            }

            const variables = await getVars(appDataSource, databaseEntities, nodeData)

            const flow = { chatflowId: options.chatflowid }

            const dynamicStructuredTool = new DynamicStructuredTool(obj)
            dynamicStructuredTool.setVariables(variables)
            dynamicStructuredTool.setFlowObject(flow)
            dynamicStructuredTool.returnDirect = customToolReturnDirect

            return dynamicStructuredTool
        } catch (e) {
            throw new Error(e instanceof Error ? e.message : 'Unknown error in CustomTool initialization')
        }
    }
}

module.exports = { nodeClass: CustomTool_Tools }
