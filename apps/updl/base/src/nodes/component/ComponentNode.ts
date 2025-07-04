// Universo Platformo | UPDL Component Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * ComponentNode attaches behaviour to an entity
 */
export class ComponentNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Component',
            type: 'UPDLComponent',
            icon: 'component.svg',
            description: 'Component attached to an entity',
            inputs: [
                {
                    name: 'type',
                    type: 'string',
                    label: 'Component Type',
                    description: 'Type identifier of the component'
                },
                {
                    name: 'props',
                    type: 'object',
                    label: 'Props',
                    description: 'Component properties',
                    optional: true,
                    additionalParams: true
                },
                {
                    label: 'Target',
                    name: 'target',
                    type: 'UPDLEntity',
                    description: 'Entity to attach this component to',
                    optional: true
                }
            ]
        })
    }

    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        return this
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        const type = (nodeData.inputs?.type as string) || ''
        const props = (nodeData.inputs?.props as any) || {}
        const target = nodeData.inputs?.target || null
        const id = `component-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return {
            id,
            type: 'UPDLComponent',
            componentType: type,
            props,
            target
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: ComponentNode }
