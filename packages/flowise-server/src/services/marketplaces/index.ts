import path from 'path'
import * as fs from 'fs'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { IReactFlowEdge, IReactFlowNode } from '../../Interface'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { DeleteResult } from 'typeorm'
import { CustomTemplate } from '@flowise/customtemplates-srv'

import canvasService from '../spacesCanvas'

type ITemplate = {
    badge: string
    description: string
    framework: string[]
    usecases: string[]
    nodes: IReactFlowNode[]
    edges: IReactFlowEdge[]
}

const getCategories = (fileDataObj: ITemplate) => {
    return Array.from(new Set(fileDataObj?.nodes?.map((node) => node.data.category).filter((category) => category)))
}

const resolveMarketplaceDir = (...segments: string[]) => {
    const candidate = path.join(__dirname, '..', '..', '..', ...segments)
    return fs.existsSync(candidate) ? candidate : null
}

const readTemplatesFromDir = (segments: string[], type: string) => {
    const dir = resolveMarketplaceDir(...segments)
    if (!dir) return []
    const jsonsInDir = fs.readdirSync(dir).filter((file) => path.extname(file) === '.json')
    return jsonsInDir.map((file, index) => {
        const filePath = path.join(dir, file)
        const fileData = fs.readFileSync(filePath)
        const fileDataObj = JSON.parse(fileData.toString()) as ITemplate
        return {
            id: index,
            templateName: file.split('.json')[0],
            flowData: fileData.toString(),
            badge: fileDataObj?.badge,
            framework: fileDataObj?.framework,
            usecases: fileDataObj?.usecases,
            categories: getCategories(fileDataObj),
            type,
            description: fileDataObj?.description || ''
        }
    })
}

// Get all templates for marketplaces
const getAllTemplates = async (unikId?: string) => {
    try {
        let templates: any[] = []

        // Canvas templates
        const canvasTemplates = readTemplatesFromDir(['marketplaces', 'canvases'], 'Canvas')
        templates = templates.concat(canvasTemplates)

        const toolsDir = resolveMarketplaceDir('marketplaces', 'tools')
        if (toolsDir) {
            const jsonsInDir = fs.readdirSync(toolsDir).filter((file) => path.extname(file) === '.json')
            jsonsInDir.forEach((file, index) => {
                const filePath = path.join(toolsDir, file)
                const fileData = fs.readFileSync(filePath)
                const fileDataObj = JSON.parse(fileData.toString())
                const template = {
                    ...fileDataObj,
                    id: index,
                    type: 'Tool',
                    framework: fileDataObj?.framework,
                    badge: fileDataObj?.badge,
                    usecases: fileDataObj?.usecases,
                    categories: [],
                    templateName: file.split('.json')[0]
                }
                templates.push(template)
            })
        }

        const agentflowsDir = resolveMarketplaceDir('marketplaces', 'agentflows')
        if (agentflowsDir) {
            const jsonsInDir = fs.readdirSync(agentflowsDir).filter((file) => path.extname(file) === '.json')
            jsonsInDir.forEach((file, index) => {
                const filePath = path.join(agentflowsDir, file)
                const fileData = fs.readFileSync(filePath)
                const fileDataObj = JSON.parse(fileData.toString())
                const template = {
                    id: index,
                    templateName: file.split('.json')[0],
                    flowData: fileData.toString(),
                    badge: fileDataObj?.badge,
                    framework: fileDataObj?.framework,
                    usecases: fileDataObj?.usecases,
                    categories: getCategories(fileDataObj),
                    type: 'Agentflow',
                    description: fileDataObj?.description || ''
                }
                templates.push(template)
            })
        }
        const sortedTemplates = templates.sort((a, b) => a.templateName.localeCompare(b.templateName))
        const FlowiseDocsQnAIndex = sortedTemplates.findIndex((tmp) => tmp.templateName === 'Flowise Docs QnA')
        if (FlowiseDocsQnAIndex > 0) {
            sortedTemplates.unshift(sortedTemplates.splice(FlowiseDocsQnAIndex, 1)[0])
        }
        const dbResponse = sortedTemplates
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: marketplacesService.getAllTemplates - ${getErrorMessage(error)}`
        )
    }
}

const deleteCustomTemplate = async (templateId: string, unikId: string): Promise<DeleteResult> => {
    try {
        const appServer = getRunningExpressApp()
        return await appServer.AppDataSource.getRepository(CustomTemplate).delete({ 
            id: templateId,
            unikId
        })
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: marketplacesService.deleteCustomTemplate - ${getErrorMessage(error)}`
        )
    }
}

const getAllCustomTemplates = async (unikId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const templates: any[] = await appServer.AppDataSource.getRepository(CustomTemplate).find({
            where: {
                unikId
            }
        })
        
        templates.map((template) => {
            template.usecases = template.usecases ? JSON.parse(template.usecases) : ''
            if (template.type === 'Tool') {
                template.flowData = JSON.parse(template.flowData)
                template.iconSrc = template.flowData.iconSrc
                template.schema = template.flowData.schema
                template.func = template.flowData.func
                template.categories = []
                template.flowData = undefined
            } else {
                template.categories = getCategories(JSON.parse(template.flowData))
            }
            if (!template.badge) {
                template.badge = ''
            }
            if (!template.framework) {
                template.framework = ''
            }
        })
        return templates
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: marketplacesService.getAllCustomTemplates - ${getErrorMessage(error)}`
        )
    }
}

const saveCustomTemplate = async (body: any): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let flowDataStr = ''
        let derivedFramework = ''
        const customTemplate = new CustomTemplate()
        Object.assign(customTemplate, body)
        
        // Set Unik ID
        if (body.unikId) {
            customTemplate.unikId = body.unikId
            delete body.unikId
        }

        if (body.canvasId) {
            const canvas = await canvasService.getCanvasById(body.canvasId)
            const flowData = JSON.parse(canvas.flowData)
            const { framework, exportJson } = _generateExportFlowData(flowData)
            flowDataStr = JSON.stringify(exportJson)
            customTemplate.framework = framework
        } else if (body.tool) {
            const flowData = {
                iconSrc: body.tool.iconSrc,
                schema: body.tool.schema,
                func: body.tool.func
            }
            customTemplate.framework = ''
            customTemplate.type = 'Tool'
            flowDataStr = JSON.stringify(flowData)
        }
        customTemplate.framework = derivedFramework
        if (customTemplate.usecases) {
            customTemplate.usecases = JSON.stringify(customTemplate.usecases)
        }
        const repo = appServer.AppDataSource.getRepository(CustomTemplate)
        const entity = repo.create(customTemplate) as CustomTemplate
        entity.flowData = flowDataStr
        const flowTemplate = await repo.save(entity)
        return flowTemplate
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: marketplacesService.saveCustomTemplate - ${getErrorMessage(error)}`
        )
    }
}

const _generateExportFlowData = (flowData: any) => {
    const nodes = flowData.nodes
    const edges = flowData.edges

    let framework = 'Langchain'
    for (let i = 0; i < nodes.length; i += 1) {
        nodes[i].selected = false
        const node = nodes[i]

        const newNodeData = {
            id: node.data.id,
            label: node.data.label,
            version: node.data.version,
            name: node.data.name,
            type: node.data.type,
            baseClasses: node.data.baseClasses,
            tags: node.data.tags,
            category: node.data.category,
            description: node.data.description,
            inputParams: node.data.inputParams,
            inputAnchors: node.data.inputAnchors,
            inputs: {},
            outputAnchors: node.data.outputAnchors,
            outputs: node.data.outputs,
            selected: false
        }

        if (node.data.tags && node.data.tags.length) {
            if (node.data.tags.includes('LlamaIndex')) {
                framework = 'LlamaIndex'
            }
        }

        // Remove password, file & folder
        if (node.data.inputs && Object.keys(node.data.inputs).length) {
            const nodeDataInputs: any = {}
            for (const input in node.data.inputs) {
                const inputParam = node.data.inputParams.find((inp: any) => inp.name === input)
                if (inputParam && inputParam.type === 'password') continue
                if (inputParam && inputParam.type === 'file') continue
                if (inputParam && inputParam.type === 'folder') continue
                nodeDataInputs[input] = node.data.inputs[input]
            }
            newNodeData.inputs = nodeDataInputs
        }

        nodes[i].data = newNodeData
    }
    const exportJson = {
        nodes,
        edges
    }
    return { exportJson, framework }
}

export default {
    getAllTemplates,
    getAllCustomTemplates,
    saveCustomTemplate,
    deleteCustomTemplate
}
