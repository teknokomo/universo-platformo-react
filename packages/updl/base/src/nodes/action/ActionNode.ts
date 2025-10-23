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
            description: 'Performs a gameplay action, like moving an entity or setting data.',
            inputs: [
                // Action configuration
                {
                    name: 'actionType',
                    label: 'Action Type',
                    type: 'options',
                    options: [
                        { label: 'Move', name: 'move' },
                        { label: 'Rotate', name: 'rotate' },
                        { label: 'Shoot', name: 'shoot' },
                        { label: 'SetData', name: 'setData' },
                        { label: 'LoadSpace', name: 'loadSpace' },
                        { label: 'Destroy', name: 'destroy' },
                        // Universo Platformo | Space MMO actions
                        { label: 'Mine', name: 'mine' },
                        { label: 'Trade', name: 'trade' },
                        { label: 'Travel', name: 'travel' },
                        { label: 'Dock', name: 'dock' },
                        { label: 'Undock', name: 'undock' },
                        { label: 'AddToInventory', name: 'addToInventory' },
                        { label: 'RemoveFromInventory', name: 'removeFromInventory' }
                    ],
                    default: 'move',
                    additionalParams: true
                },
                {
                    name: 'targetId',
                    label: 'Target Entity ID',
                    type: 'string',
                    description: 'ID or tag of target Entity. If empty, action applies to the event source entity.',
                    placeholder: 'player, enemy_1, #boss',
                    optional: true,
                    additionalParams: true
                },

                // Parameters for Move/Rotate
                {
                    name: 'vector',
                    label: 'Vector',
                    type: 'json',
                    description: 'JSON object with x, y, z values for translation or rotation',
                    placeholder: '{ "x": 0, "y": 1, "z": 0 }',
                    show: {
                        'inputs.actionType': ['move', 'rotate']
                    },
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'duration',
                    label: 'Duration (s)',
                    type: 'number',
                    description: 'Time in seconds to complete the action',
                    default: 1,
                    show: {
                        'inputs.actionType': ['move', 'rotate']
                    },
                    additionalParams: true,
                    optional: true
                },

                // Parameters for SetData
                {
                    name: 'dataKey',
                    label: 'Data Key',
                    type: 'string',
                    placeholder: 'score, health, ammo',
                    show: {
                        'inputs.actionType': ['setData']
                    },
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'dataValue',
                    label: 'Data Value',
                    type: 'string',
                    description: 'Value to set. Can be a literal or a variable expression (e.g., {{current_score + 10}}).',
                    placeholder: '100, "game_over", {{player_health}}',
                    show: {
                        'inputs.actionType': ['setData']
                    },
                    additionalParams: true,
                    optional: true
                },

                // Parameters for LoadSpace
                {
                    name: 'spaceId',
                    label: 'Space ID',
                    type: 'string',
                    description: 'ID of the Space to load',
                    placeholder: 'level_2, main_menu',
                    show: {
                        'inputs.actionType': ['loadSpace']
                    },
                    additionalParams: true,
                    optional: true
                },

                // Universo Platformo | Parameters for Space MMO actions
                {
                    name: 'resourceType',
                    label: 'Resource Type',
                    type: 'string',
                    description: 'Type of resource to mine or trade',
                    placeholder: 'asteroidMass, ore, fuel',
                    show: {
                        'inputs.actionType': ['mine', 'trade', 'addToInventory', 'removeFromInventory']
                    },
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'amount',
                    label: 'Amount',
                    type: 'number',
                    description: 'Amount of resource or currency',
                    default: 1,
                    show: {
                        'inputs.actionType': ['mine', 'trade', 'addToInventory', 'removeFromInventory']
                    },
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'targetWorldId',
                    label: 'Target World ID',
                    type: 'string',
                    description: 'ID of the target world for travel',
                    placeholder: 'kubio, konkordo, triumfo',
                    show: {
                        'inputs.actionType': ['travel']
                    },
                    additionalParams: true,
                    optional: true
                },
                {
                    name: 'stationId',
                    label: 'Station ID',
                    type: 'string',
                    description: 'ID of the station for docking',
                    placeholder: 'station_espero, station_alpha',
                    show: {
                        'inputs.actionType': ['dock', 'undock']
                    },
                    additionalParams: true,
                    optional: true
                }

                // No parameters needed for Shoot or Destroy, they are contextual
            ]
        })
    }

    async run(nodeData: INodeData): Promise<ICommonObject> {
        const actionType = (nodeData.inputs?.actionType as string) || 'move'
        const targetId = (nodeData.inputs?.targetId as string) || '' // Default to self
        const vectorStr = (nodeData.inputs?.vector as string) || '{}'
        const duration = (nodeData.inputs?.duration as number) || 1
        const dataKey = (nodeData.inputs?.dataKey as string) || ''
        const dataValue = (nodeData.inputs?.dataValue as string) || ''
        const spaceId = (nodeData.inputs?.spaceId as string) || ''

        // Universo Platformo | Space MMO action parameters
        const resourceType = (nodeData.inputs?.resourceType as string) || ''
        const amount = Number(nodeData.inputs?.amount) || 1
        const targetWorldId = (nodeData.inputs?.targetWorldId as string) || ''
        const stationId = (nodeData.inputs?.stationId as string) || ''

        let vector = {}
        try {
            vector = JSON.parse(vectorStr)
        } catch (e) {
            // Ignore parsing errors, use default empty object
        }

        const obj = {
            type: 'UPDLAction',
            name: 'Action',
            args: {
                actionType,
                targetId,
                params: {
                    vector,
                    duration,
                    dataKey,
                    dataValue,
                    spaceId,
                    // Space MMO parameters
                    resourceType,
                    amount,
                    targetWorldId,
                    stationId
                }
            }
        }

        return obj
    }
}
