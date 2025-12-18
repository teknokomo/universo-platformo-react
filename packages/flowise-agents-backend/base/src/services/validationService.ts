// Universo Platformo | Agents Backend - Validation Service
// Adapted from Flowise 3.0.12 validation service
// Validates AgentFlow canvas for configuration issues

import { StatusCodes } from 'http-status-codes'
import { DataSource, Repository } from 'typeorm'
import { z } from 'zod'
import { IValidationResult, IReactFlowNode, IReactFlowEdge, IComponentNodes, INodeParam, IFlowData } from '../types'

// Canvas entity import will be provided via config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasEntity = any

/**
 * Validation service configuration
 */
export interface ValidationServiceConfig {
    /** TypeORM DataSource or getter function */
    dataSource: DataSource | (() => DataSource)
    /** Component nodes pool or getter function (lazy access for runtime initialization) */
    componentNodes: IComponentNodes | (() => IComponentNodes)
    /** Canvas entity class for repository */
    canvasEntityClass: new () => CanvasEntity
}

/**
 * Custom error class for validation service
 */
export class ValidationServiceError extends Error {
    statusCode: number

    constructor(statusCode: number, message: string) {
        super(message)
        this.name = 'ValidationServiceError'
        this.statusCode = statusCode
    }
}

/**
 * Validation service interface
 */
export interface IValidationService {
    checkFlowValidation(canvasId: string, unikId?: string): Promise<IValidationResult[]>
}

/**
 * Check if a show condition is satisfied
 */
function checkShowCondition(condition: Record<string, unknown>, values: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(condition)) {
        if (values[key] !== expectedValue) {
            return false
        }
    }
    return true
}

/**
 * Check if a hide condition is satisfied
 */
function checkHideCondition(condition: Record<string, unknown>, values: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(condition)) {
        if (values[key] !== expectedValue) {
            return false
        }
    }
    return true
}

/**
 * Validate array parameter items
 */
function validateArrayItems(param: INodeParam, inputValue: Record<string, unknown>[], nodeIssues: string[]): void {
    if (!param.array || inputValue.length === 0) return

    inputValue.forEach((item, index) => {
        param.array!.forEach((arrayParam) => {
            let shouldValidate = true

            // Check show conditions
            if (arrayParam.show) {
                shouldValidate = false
                for (const [conditionKey, expectedValue] of Object.entries(arrayParam.show)) {
                    const isIndexCondition = conditionKey.includes('$index')
                    let actualValue: unknown

                    if (isIndexCondition) {
                        const normalizedKey = conditionKey.replace(/conditions\[\$index\]\.(\w+)/, '$1')
                        actualValue = item[normalizedKey]
                    } else {
                        actualValue = item[conditionKey]
                    }

                    let conditionMet = false
                    if (Array.isArray(expectedValue)) {
                        conditionMet = (expectedValue as unknown[]).includes(actualValue)
                    } else {
                        conditionMet = actualValue === expectedValue
                    }

                    if (conditionMet) {
                        shouldValidate = true
                        break
                    }
                }
            }

            // Check hide conditions (override show)
            if (shouldValidate && arrayParam.hide) {
                for (const [conditionKey, expectedValue] of Object.entries(arrayParam.hide)) {
                    const isIndexCondition = conditionKey.includes('$index')
                    let actualValue: unknown

                    if (isIndexCondition) {
                        const normalizedKey = conditionKey.replace(/conditions\[\$index\]\.(\w+)/, '$1')
                        actualValue = item[normalizedKey]
                    } else {
                        actualValue = item[conditionKey]
                    }

                    let shouldHide = false
                    if (Array.isArray(expectedValue)) {
                        shouldHide = (expectedValue as unknown[]).includes(actualValue)
                    } else {
                        shouldHide = actualValue === expectedValue
                    }

                    if (shouldHide) {
                        shouldValidate = false
                        break
                    }
                }
            }

            // Validate required fields
            if (shouldValidate) {
                const isOptional = arrayParam.optional === true
                const value = item[arrayParam.name]
                const isEmpty = value === undefined || value === null || value === '' || value === '<p></p>'

                if (!isOptional && isEmpty) {
                    nodeIssues.push(`${param.label} item #${index + 1}: ${arrayParam.label} is required`)
                }
            }
        })
    })
}

/**
 * Validate nested config parameters
 */
function validateNestedConfig(
    param: INodeParam,
    inputs: Record<string, unknown>,
    componentNodes: IComponentNodes,
    nodeIssues: string[]
): void {
    const configKey = `${param.name}Config`
    const componentName = inputs[param.name] as string
    const configValue = inputs[configKey] as Record<string, unknown>

    if (!componentName || !configValue) return

    const component = componentNodes[componentName]
    if (!component?.inputs) return

    for (const componentParam of component.inputs) {
        // Check show condition
        if (componentParam.show && !checkShowCondition(componentParam.show, configValue)) {
            continue
        }

        // Check hide condition
        if (componentParam.hide && checkHideCondition(componentParam.hide, configValue)) {
            continue
        }

        // Validate required parameter
        if (!componentParam.optional) {
            const nestedValue = configValue[componentParam.name]
            if (nestedValue === undefined || nestedValue === null || nestedValue === '') {
                nodeIssues.push(`${param.label} configuration: ${componentParam.label} is required`)
            }
        }
    }

    // Check credential requirement
    if (component.credential && !component.credential.optional) {
        if (!configValue.FLOWISE_CREDENTIAL_ID && !configValue.credential) {
            nodeIssues.push(`${param.label} requires a credential`)
        }
    }
}

/**
 * Factory function to create validation service
 */
export function createValidationService(config: ValidationServiceConfig): IValidationService {
    const { dataSource, componentNodes, canvasEntityClass } = config

    // Helper to resolve dataSource (supports both direct value and getter)
    const getDataSource = (): DataSource => {
        return typeof dataSource === 'function' ? dataSource() : dataSource
    }

    // Helper to resolve componentNodes (supports both direct value and getter)
    const getComponentNodes = (): IComponentNodes => {
        return typeof componentNodes === 'function' ? componentNodes() : componentNodes
    }

    const getRepository = (): Repository<CanvasEntity> => {
        return getDataSource().getRepository(canvasEntityClass)
    }

    const checkFlowValidation = async (canvasId: string, unikId?: string): Promise<IValidationResult[]> => {
        try {
            // Build query conditions
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const whereCondition: any = { id: canvasId }
            if (unikId) {
                whereCondition.unikId = unikId
            }

            // Fetch canvas
            const canvas = await getRepository().findOne({
                where: whereCondition
            })

            if (!canvas) {
                throw new ValidationServiceError(StatusCodes.NOT_FOUND, 'Canvas not found')
            }

            // Parse flow data
            let flowData: IFlowData
            try {
                flowData = typeof canvas.flowData === 'string' ? JSON.parse(canvas.flowData) : canvas.flowData
            } catch {
                throw new ValidationServiceError(StatusCodes.BAD_REQUEST, 'Invalid flow data format')
            }

            const nodes: IReactFlowNode[] = flowData.nodes || []
            const edges: IReactFlowEdge[] = flowData.edges || []
            const validationResults: IValidationResult[] = []

            // Create set of connected nodes
            const connectedNodes = new Set<string>()
            edges.forEach((edge) => {
                connectedNodes.add(edge.source)
                connectedNodes.add(edge.target)
            })

            // Validate each node
            for (const node of nodes) {
                // Skip sticky notes
                if (node.data.name === 'stickyNoteAgentflow') continue

                const nodeIssues: string[] = []

                // Check if node is connected
                if (!connectedNodes.has(node.id)) {
                    nodeIssues.push('This node is not connected to anything')
                }

                // Validate input parameters
                const inputParams = node.data.inputParams || []
                const inputs = (node.data.inputs || {}) as Record<string, unknown>

                for (const param of inputParams) {
                    // Check show condition
                    if (param.show && !checkShowCondition(param.show, inputs)) {
                        continue
                    }

                    // Check hide condition
                    if (param.hide && checkHideCondition(param.hide, inputs)) {
                        continue
                    }

                    // Check required parameter
                    if (!param.optional) {
                        const inputValue = inputs[param.name]
                        if (inputValue === undefined || inputValue === null || inputValue === '') {
                            nodeIssues.push(`${param.label} is required`)
                        }
                    }

                    // Check array parameters
                    if (param.type === 'array' && Array.isArray(inputs[param.name])) {
                        validateArrayItems(param, inputs[param.name] as Record<string, unknown>[], nodeIssues)
                    }

                    // Check credential requirements
                    if (param.name === 'credential' && !param.optional) {
                        if (!inputs[param.name]) {
                            nodeIssues.push('Credential is required')
                        }
                    }

                    // Check nested config parameters
                    validateNestedConfig(param, inputs, getComponentNodes(), nodeIssues)
                }

                // Add to results if issues found
                if (nodeIssues.length > 0) {
                    validationResults.push({
                        id: node.id,
                        label: node.data.label || node.data.name,
                        name: node.data.name,
                        issues: nodeIssues
                    })
                }
            }

            // Check for hanging edges
            for (const edge of edges) {
                const sourceExists = nodes.some((n) => n.id === edge.source)
                const targetExists = nodes.some((n) => n.id === edge.target)

                if (!sourceExists || !targetExists) {
                    if (!sourceExists && targetExists) {
                        const targetNode = nodes.find((n) => n.id === edge.target)
                        if (targetNode) {
                            const existing = validationResults.find((r) => r.id === edge.target)
                            if (existing) {
                                existing.issues.push(`Connected to non-existent source node ${edge.source}`)
                            } else {
                                validationResults.push({
                                    id: targetNode.id,
                                    label: targetNode.data.label || targetNode.data.name,
                                    name: targetNode.data.name,
                                    issues: [`Connected to non-existent source node ${edge.source}`]
                                })
                            }
                        }
                    } else if (sourceExists && !targetExists) {
                        const sourceNode = nodes.find((n) => n.id === edge.source)
                        if (sourceNode) {
                            const existing = validationResults.find((r) => r.id === edge.source)
                            if (existing) {
                                existing.issues.push(`Connected to non-existent target node ${edge.target}`)
                            } else {
                                validationResults.push({
                                    id: sourceNode.id,
                                    label: sourceNode.data.label || sourceNode.data.name,
                                    name: sourceNode.data.name,
                                    issues: [`Connected to non-existent target node ${edge.target}`]
                                })
                            }
                        }
                    } else {
                        validationResults.push({
                            id: edge.id,
                            label: `Edge ${edge.id}`,
                            name: 'edge',
                            issues: ['Disconnected edge - both source and target nodes do not exist']
                        })
                    }
                }
            }

            return validationResults
        } catch (error) {
            if (error instanceof ValidationServiceError) {
                throw error
            }
            throw new ValidationServiceError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        }
    }

    return {
        checkFlowValidation
    }
}

// Zod schema for validation response
export const validationResultSchema = z.object({
    id: z.string(),
    label: z.string(),
    name: z.string(),
    issues: z.array(z.string())
})

export const validationResponseSchema = z.array(validationResultSchema)
