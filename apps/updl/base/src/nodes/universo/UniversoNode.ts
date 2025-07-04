// Universo Platformo | UPDL Universo Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * UniversoNode defines cross-system settings
 */
export class UniversoNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Universo',
            type: 'UPDLUniverso',
            icon: 'universo.svg',
            description: 'Universo platform configuration',
            inputs: [
                {
                    name: 'transports',
                    type: 'object',
                    label: 'Transports',
                    description: 'Transport layer settings',
                    optional: true,
                    additionalParams: true
                },
                {
                    name: 'discovery',
                    type: 'object',
                    label: 'Discovery',
                    description: 'Discovery settings',
                    optional: true,
                    additionalParams: true
                },
                {
                    name: 'security',
                    type: 'object',
                    label: 'Security',
                    description: 'Security configuration',
                    optional: true,
                    additionalParams: true
                }
            ]
        })
    }

    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        return this
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        const transports = (nodeData.inputs?.transports as any) || {}
        const discovery = (nodeData.inputs?.discovery as any) || {}
        const security = (nodeData.inputs?.security as any) || {}
        const id = `universo-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return {
            id,
            type: 'UPDLUniverso',
            transports,
            discovery,
            security
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: UniversoNode }
