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
                // Input connectors for other nodes
                {
                    label: 'Components',
                    name: 'components',
                    type: 'UPDLComponent',
                    description: 'Connect Component nodes to add behavior to this entity',
                    list: true,
                    optional: true
                },
                {
                    label: 'Events',
                    name: 'events',
                    type: 'UPDLEvent',
                    description: 'Connect Event nodes to define interactions with this entity',
                    list: true,
                    optional: true
                },
                // Entity configuration fields
                {
                    name: 'entityType',
                    type: 'string',
                    label: 'Entity Type',
                    description: 'Semantic type for the export template (e.g., Ship, Asteroid, Station)',
                    default: 'StaticObject'
                },
                {
                    name: 'transform',
                    type: 'json',
                    label: 'Transform',
                    description: 'Position, rotation and scale as a JSON object',
                    optional: true,
                    additionalParams: true,
                    default: '{"pos":[0,0,0], "rot":[0,0,0], "scale":[1,1,1]}'
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
        const entityType = (nodeData.inputs?.entityType as string) || 'StaticObject'

        let transform
        try {
            transform = nodeData.inputs?.transform
                ? JSON.parse(nodeData.inputs.transform as string)
                : { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
        } catch (error) {
            transform = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
        }

        const tags = (nodeData.inputs?.tags as string[]) || []

        // Connected components and events are handled by Flowise graph execution
        const components = nodeData.inputs?.components || []
        const events = nodeData.inputs?.events || []

        const id = `entity-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        return {
            id,
            type: 'UPDLEntity',
            entityType,
            transform,
            tags,
            components,
            events
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: EntityNode }
