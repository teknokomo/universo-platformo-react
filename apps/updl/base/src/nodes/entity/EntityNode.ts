// Universo Platformo | UPDL Entity Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * EntityNode represents a runtime entity instance with transform data
 */
export class EntityNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Entity',
            type: 'UPDLEntity',
            icon: 'entity.svg',
            description: 'Entity instance with transform and tags',
            inputs: [
                {
                    name: 'transform',
                    type: 'object',
                    label: 'Transform',
                    description: 'Position, rotation and scale',
                    optional: true,
                    additionalParams: true
                },
                {
                    name: 'tags',
                    type: 'string',
                    label: 'Tags',
                    description: 'Tags for this entity',
                    list: true,
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
        const transform = (nodeData.inputs?.transform as any) || {}
        const tags = (nodeData.inputs?.tags as string[]) || []
        const id = `entity-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return {
            id,
            type: 'UPDLEntity',
            transform,
            tags
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: EntityNode }
