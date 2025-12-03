import { DataSource, DeleteResult, Repository } from 'typeorm'
import { StatusCodes } from 'http-status-codes'
import { CustomTemplate, ICustomTemplate } from '../database/entities'

/**
 * Error class for CustomTemplates service operations
 */
export class CustomTemplatesServiceError extends Error {
    constructor(message: string, public readonly statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR) {
        super(message)
        this.name = 'CustomTemplatesServiceError'
    }
}

/**
 * Configuration for CustomTemplates service
 */
export interface CustomTemplatesServiceConfig {
    dataSource: DataSource
}

/**
 * Response type for custom template API (extends ICustomTemplate with parsed fields)
 */
export interface ICustomTemplateResponse extends Omit<ICustomTemplate, 'usecases'> {
    usecases: string | string[]
    categories: string[]
    iconSrc?: string
    schema?: string
    func?: string
}

/**
 * Interface for CustomTemplates service operations
 */
export interface ICustomTemplatesService {
    getAll(unikId: string): Promise<ICustomTemplateResponse[]>
    getById(templateId: string, unikId: string): Promise<ICustomTemplateResponse | null>
    create(data: CreateCustomTemplateInput): Promise<ICustomTemplateResponse>
    delete(templateId: string, unikId: string): Promise<DeleteResult>
}

/**
 * Input type for creating a custom template
 */
export interface CreateCustomTemplateInput {
    name: string
    flowData: string
    unikId: string
    description?: string
    badge?: string
    framework?: string
    usecases?: string
    type?: string
}

/**
 * Parse usecases from template for display
 */
const parseUsecases = (usecases: string | undefined): string | string[] => {
    if (!usecases) return ''
    try {
        return JSON.parse(usecases)
    } catch {
        return usecases
    }
}

/**
 * Extract categories from flowData nodes
 */
const getCategories = (flowData: string): string[] => {
    try {
        const parsed = JSON.parse(flowData)
        const nodes = parsed?.nodes || []
        return Array.from(
            new Set(
                nodes
                    .map((node: { data?: { category?: string } }) => node.data?.category)
                    .filter((category: string | undefined): category is string => Boolean(category))
            )
        )
    } catch {
        return []
    }
}

/**
 * Transform template for API response
 */
const transformTemplateForResponse = (template: CustomTemplate): ICustomTemplateResponse => {
    const result: Omit<ICustomTemplate, 'usecases' | 'flowData'> & {
        usecases: string | string[]
        categories: string[]
        iconSrc?: string
        schema?: string
        func?: string
        flowData?: string
    } = {
        ...template,
        usecases: parseUsecases(template.usecases),
        categories: [],
        badge: template.badge || '',
        framework: template.framework || ''
    }

    if (template.type === 'Tool') {
        try {
            const flowData = JSON.parse(template.flowData)
            result.iconSrc = flowData.iconSrc
            result.schema = flowData.schema
            result.func = flowData.func
            result.categories = []
            delete result.flowData
        } catch {
            result.categories = []
        }
    } else {
        result.categories = getCategories(template.flowData)
    }

    return result as ICustomTemplateResponse
}

/**
 * Create CustomTemplates service instance
 */
export function createCustomTemplatesService(config: CustomTemplatesServiceConfig): ICustomTemplatesService {
    const { dataSource } = config

    const getRepository = (): Repository<CustomTemplate> => {
        return dataSource.getRepository(CustomTemplate)
    }

    const getAll = async (unikId: string): Promise<ICustomTemplateResponse[]> => {
        try {
            const templates = await getRepository().find({
                where: { unikId }
            })

            return templates.map(transformTemplateForResponse)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CustomTemplatesServiceError(`Error: customTemplatesService.getAll - ${message}`, StatusCodes.INTERNAL_SERVER_ERROR)
        }
    }

    const getById = async (templateId: string, unikId: string): Promise<ICustomTemplateResponse | null> => {
        try {
            const template = await getRepository().findOne({
                where: { id: templateId, unikId }
            })

            return template ? transformTemplateForResponse(template) : null
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CustomTemplatesServiceError(`Error: customTemplatesService.getById - ${message}`, StatusCodes.INTERNAL_SERVER_ERROR)
        }
    }

    const create = async (data: CreateCustomTemplateInput): Promise<ICustomTemplateResponse> => {
        try {
            const template = new CustomTemplate()
            template.name = data.name
            template.flowData = data.flowData
            template.description = data.description
            template.badge = data.badge
            template.framework = data.framework
            template.type = data.type

            // Serialize usecases if provided as string
            if (data.usecases) {
                template.usecases = typeof data.usecases === 'string' ? data.usecases : JSON.stringify(data.usecases)
            }

            // Set Unik ID
            template.unikId = data.unikId

            const entity = getRepository().create(template)
            const saved = await getRepository().save(entity)

            return transformTemplateForResponse(saved)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CustomTemplatesServiceError(`Error: customTemplatesService.create - ${message}`, StatusCodes.INTERNAL_SERVER_ERROR)
        }
    }

    const deleteTemplate = async (templateId: string, unikId: string): Promise<DeleteResult> => {
        try {
            return await getRepository().delete({
                id: templateId,
                unikId
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CustomTemplatesServiceError(`Error: customTemplatesService.delete - ${message}`, StatusCodes.INTERNAL_SERVER_ERROR)
        }
    }

    return {
        getAll,
        getById,
        create,
        delete: deleteTemplate
    }
}
