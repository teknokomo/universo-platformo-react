/**
 * Node Provider Implementation
 *
 * Implements INodeProvider interface from @flowise/docstore-backend
 * by wrapping nodesPool from the running Express app.
 */

import type { INodeProvider, INodeMetadata, ICredentialMetadata, INodeInputParam } from '@flowise/docstore-backend'
import type { INode, INodeParams } from 'flowise-components'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'

/**
 * Convert INodeParams to INodeInputParam
 */
function convertNodeParams(params?: INodeParams[]): INodeInputParam[] | undefined {
    if (!params) return undefined

    return params.map((param) => ({
        type: param.type,
        name: param.name,
        label: param.label,
        description: param.description,
        // param.optional can be boolean | INodeDisplay | undefined in flowise-components
        // We need boolean | undefined for INodeInputParam
        optional: typeof param.optional === 'boolean' ? param.optional : undefined,
        default: param.default,
        options: param.options?.map((opt) => ({
            label: typeof opt === 'string' ? opt : opt.label,
            name: typeof opt === 'string' ? opt : opt.name
        })),
        rows: param.rows,
        placeholder: param.placeholder,
        additionalParams: param.additionalParams,
        list: param.list,
        acceptVariable: param.acceptVariable,
        credentialNames: param.credentialNames
    }))
}

/**
 * Convert INode to INodeMetadata
 */
function convertNodeToMetadata(node: INode): INodeMetadata {
    return {
        label: node.label,
        name: node.name,
        type: node.type,
        icon: node.icon,
        version: node.version,
        category: node.category,
        baseClasses: node.baseClasses,
        description: node.description,
        filePath: node.filePath,
        tags: node.tags,
        badge: node.badge,
        inputs: convertNodeParams(node.inputs)
    }
}

/**
 * Create a NodeProvider implementation that wraps nodesPool
 *
 * @returns INodeProvider implementation
 */
export function createNodeProvider(): INodeProvider {
    return {
        getComponentNodes(): Record<string, INodeMetadata> {
            const appServer = getRunningExpressApp()
            const componentNodes = appServer.nodesPool.componentNodes
            const result: Record<string, INodeMetadata> = {}

            for (const [name, node] of Object.entries(componentNodes)) {
                result[name] = convertNodeToMetadata(node as INode)
            }

            return result
        },

        getNode(nodeName: string): INodeMetadata | undefined {
            const appServer = getRunningExpressApp()
            const node = appServer.nodesPool.componentNodes[nodeName] as INode | undefined

            if (!node) return undefined

            return convertNodeToMetadata(node)
        },

        getNodesByCategory(category: string): INodeMetadata[] {
            const nodes = this.getComponentNodes()
            return Object.values(nodes).filter((n) => n.category === category)
        },

        getComponentCredentials(): Record<string, ICredentialMetadata> {
            const appServer = getRunningExpressApp()
            const componentCredentials = appServer.nodesPool.componentCredentials
            const result: Record<string, ICredentialMetadata> = {}

            for (const [name, cred] of Object.entries(componentCredentials)) {
                const credential = cred as { label: string; name: string; description?: string; inputs?: INodeParams[] }
                result[name] = {
                    label: credential.label,
                    name: credential.name,
                    description: credential.description,
                    inputs: convertNodeParams(credential.inputs)
                }
            }

            return result
        },

        async createNodeInstance(nodeName: string): Promise<unknown> {
            const appServer = getRunningExpressApp()
            const nodeComponent = appServer.nodesPool.componentNodes[nodeName] as INode | undefined

            if (!nodeComponent) {
                throw new Error(`Node ${nodeName} not found in componentNodes`)
            }

            const nodeInstanceFilePath = nodeComponent.filePath
            if (!nodeInstanceFilePath) {
                throw new Error(`Node ${nodeName} does not have a filePath`)
            }

            // Dynamically import and instantiate the node
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const nodeModule = require(nodeInstanceFilePath)
            const NodeClass = nodeModule.nodeClass || nodeModule.default

            if (!NodeClass) {
                throw new Error(`Node ${nodeName} module does not export a class`)
            }

            return new NodeClass()
        }
    }
}
