// Universo Platformo | UPDL Action Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * ActionNode performs an action on a target entity
 */
export class ActionNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Action',
            type: 'UPDLAction',
            icon: 'action.svg',
            description: 'Action performed on a target',
            inputs: [
                {
                    name: 'actionType',
                    type: 'options',
                    label: 'Action Type',
                    description: 'Type of action',
                    options: [
                        { label: 'Animate', name: 'animate' },
                        { label: 'Sound', name: 'sound' },
                        { label: 'Custom', name: 'custom' }
                    ],
                    default: 'animate'
                },
                {
                    label: 'Target',
                    name: 'target',
                    type: 'UPDLEntity',
                    description: 'Target entity for the action',
                    optional: true
                },
                {
                    name: 'params',
                    type: 'object',
                    label: 'Params',
                    description: 'Additional parameters',
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
        const actionType = (nodeData.inputs?.actionType as string) || 'animate'
        const target = nodeData.inputs?.target || null
        const params = (nodeData.inputs?.params as any) || {}
        const id = `action-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return {
            id,
            type: 'UPDLAction',
            actionType,
            target,
            params
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: ActionNode }
