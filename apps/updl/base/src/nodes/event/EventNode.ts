// Universo Platformo | UPDL Event Node
import { INodeData, ICommonObject } from '../interfaces'
import { BaseUPDLNode } from '../base/BaseUPDLNode'

/**
 * EventNode describes an event emitted by an entity or component
 */
export class EventNode extends BaseUPDLNode {
    constructor() {
        super({
            name: 'Event',
            type: 'UPDLEvent',
            icon: 'event.svg',
            description: 'Event definition for UPDL flows',
            inputs: [
                {
                    name: 'eventType',
                    type: 'options',
                    label: 'Event Type',
                    description: 'Type of event',
                    options: [
                        { label: 'Click', name: 'click' },
                        { label: 'Hover', name: 'hover' },
                        { label: 'Custom', name: 'custom' }
                    ],
                    default: 'click'
                },
                {
                    label: 'Source',
                    name: 'source',
                    type: 'UPDLEntity',
                    description: 'Entity emitting the event',
                    optional: true
                }
            ]
        })
    }

    async init(nodeData: INodeData, input: string = ''): Promise<any> {
        return this
    }

    async run(nodeData: INodeData, input: string, options?: ICommonObject): Promise<any> {
        const eventType = (nodeData.inputs?.eventType as string) || 'click'
        const source = nodeData.inputs?.source || null
        const id = `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return {
            id,
            type: 'UPDLEvent',
            eventType,
            source
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: EventNode }
