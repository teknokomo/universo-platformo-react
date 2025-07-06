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
                // Input connector for actions
                {
                    label: 'Actions',
                    name: 'actions',
                    type: 'UPDLAction',
                    description: 'Connect Action nodes to execute when this event triggers',
                    list: true,
                    optional: true
                },
                // Event configuration
                {
                    name: 'eventType',
                    label: 'Event Type',
                    type: 'options',
                    description: 'Type of event that triggers the actions',
                    options: [
                        { label: 'On Start', name: 'onStart', description: 'Triggers when the scene/entity loads' },
                        { label: 'On Click', name: 'onClick', description: 'Triggers on mouse click' },
                        { label: 'On Collision Start', name: 'onCollisionStart', description: 'Triggers on collision enter' },
                        { label: 'On Timer', name: 'onTimer', description: 'Triggers after a delay' }
                    ],
                    default: 'onStart'
                },
                {
                    name: 'eventArgs',
                    label: 'Event Arguments (JSON)',
                    type: 'json',
                    description:
                        'Event-specific parameters (e.g., {"delay": 5000} for On Timer, {"targetTag": "Asteroid"} for On Collision)',
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
        const eventType = (nodeData.inputs?.eventType as string) || 'onStart'

        let eventArgs
        try {
            eventArgs = nodeData.inputs?.eventArgs ? JSON.parse(nodeData.inputs.eventArgs as string) : {}
        } catch (error) {
            eventArgs = {}
        }

        // Connected actions are handled by Flowise graph execution
        const actions = nodeData.inputs?.actions || []

        const id = `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        return {
            id,
            type: 'UPDLEvent',
            eventType,
            eventArgs,
            actions
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: EventNode }
