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
                    name: 'componentType',
                    label: 'Component Type',
                    type: 'options',
                    description: 'Type of component to attach',
                    options: [
                        { label: 'Render', name: 'render' },
                        { label: 'Script', name: 'script' },
                        // Universo Platformo | Space MMO components
                        { label: 'Inventory', name: 'inventory' },
                        { label: 'Weapon', name: 'weapon' },
                        { label: 'Trading', name: 'trading' },
                        { label: 'Mineable', name: 'mineable' },
                        { label: 'Portal', name: 'portal' }
                    ],
                    default: 'render'
                },
                // Fields for Render Component
                {
                    name: 'primitive',
                    label: 'Primitive Shape',
                    type: 'options',
                    description: 'Basic 3D shape to render',
                    options: [
                        { label: 'Box', name: 'box' },
                        { label: 'Sphere', name: 'sphere' },
                        { label: 'Torus', name: 'torus' },
                        { label: 'Cylinder', name: 'cylinder' }
                    ],
                    default: 'box',
                    additionalParams: true,
                    show: { 'inputs.componentType': ['render'] }
                },
                {
                    name: 'color',
                    label: 'Color (HEX)',
                    type: 'string',
                    description: 'Color of the rendered primitive',
                    default: '#FFFFFF',
                    additionalParams: true,
                    show: { 'inputs.componentType': ['render'] }
                },
                // Fields for Script Component
                {
                    name: 'scriptName',
                    label: 'Script Name',
                    type: 'string',
                    description: 'Name of the script file (e.g., playerController.js)',
                    default: 'myScript.js',
                    additionalParams: true,
                    show: { 'inputs.componentType': ['script'] }
                },
                // Universo Platformo | Fields for Inventory Component
                {
                    name: 'maxCapacity',
                    label: 'Max Capacity (m³)',
                    type: 'number',
                    description: 'Maximum cargo capacity in cubic meters',
                    default: 20,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['inventory'] }
                },
                {
                    name: 'currentLoad',
                    label: 'Current Load (m³)',
                    type: 'number',
                    description: 'Current cargo load in cubic meters',
                    default: 0,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['inventory'] }
                },
                // Fields for Weapon Component
                {
                    name: 'fireRate',
                    label: 'Fire Rate (shots/sec)',
                    type: 'number',
                    description: 'Weapon fire rate in shots per second',
                    default: 2,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['weapon'] }
                },
                {
                    name: 'damage',
                    label: 'Damage',
                    type: 'number',
                    description: 'Damage per shot',
                    default: 1,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['weapon'] }
                },
                // Fields for Trading Component
                {
                    name: 'pricePerTon',
                    label: 'Price Per Ton (Inmo)',
                    type: 'number',
                    description: 'Trading price per ton in Inmo currency',
                    default: 10,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['trading'] }
                },
                {
                    name: 'interactionRange',
                    label: 'Interaction Range',
                    type: 'number',
                    description: 'Range for trading interaction',
                    default: 8,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['trading'] }
                },
                // Fields for Mineable Component
                {
                    name: 'resourceType',
                    label: 'Resource Type',
                    type: 'string',
                    description: 'Type of resource that can be mined',
                    default: 'asteroidMass',
                    additionalParams: true,
                    show: { 'inputs.componentType': ['mineable'] }
                },
                {
                    name: 'maxYield',
                    label: 'Max Yield (tons)',
                    type: 'number',
                    description: 'Maximum resource yield in tons',
                    default: 3,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['mineable'] }
                },
                {
                    name: 'asteroidVolume',
                    label: 'Asteroid Volume (m³)',
                    type: 'number',
                    description: 'Physical volume of the asteroid',
                    default: 5,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['mineable'] }
                },
                {
                    name: 'hardness',
                    label: 'Hardness',
                    type: 'number',
                    description: 'Mining difficulty (1=soft, 5=very hard)',
                    default: 1,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['mineable'] }
                },
                // Fields for Portal Component
                {
                    name: 'targetWorld',
                    label: 'Target World',
                    type: 'string',
                    description: 'Target world for portal transportation',
                    default: 'konkordo',
                    additionalParams: true,
                    show: { 'inputs.componentType': ['portal'] }
                },
                {
                    name: 'cooldownTime',
                    label: 'Cooldown Time (ms)',
                    type: 'number',
                    description: 'Portal cooldown time in milliseconds',
                    default: 2000,
                    additionalParams: true,
                    show: { 'inputs.componentType': ['portal'] }
                },
                // Generic props for advanced use
                {
                    name: 'props',
                    label: 'Additional Properties (JSON)',
                    type: 'json',
                    description: 'Additional component properties as JSON',
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
        const componentType = (nodeData.inputs?.componentType as string) || 'render'

        // Basic component fields
        const primitive = (nodeData.inputs?.primitive as string) || 'box'
        const color = (nodeData.inputs?.color as string) || '#FFFFFF'
        const scriptName = (nodeData.inputs?.scriptName as string) || 'myScript.js'

        // Universo Platformo | Space MMO component fields
        const maxCapacity = Number(nodeData.inputs?.maxCapacity) || 20
        const currentLoad = Number(nodeData.inputs?.currentLoad) || 0
        const fireRate = Number(nodeData.inputs?.fireRate) || 2
        const damage = Number(nodeData.inputs?.damage) || 1
        const pricePerTon = Number(nodeData.inputs?.pricePerTon) || 10
        const interactionRange = Number(nodeData.inputs?.interactionRange) || 8
        const resourceType = (nodeData.inputs?.resourceType as string) || 'asteroidMass'
        const maxYield = Number(nodeData.inputs?.maxYield) || 3
        const asteroidVolume = Number(nodeData.inputs?.asteroidVolume) || 5
        const hardness = Number(nodeData.inputs?.hardness) || 1
        const targetWorld = (nodeData.inputs?.targetWorld as string) || 'konkordo'
        const cooldownTime = Number(nodeData.inputs?.cooldownTime) || 2000

        let props
        try {
            props = nodeData.inputs?.props ? JSON.parse(nodeData.inputs.props as string) : {}
        } catch (error) {
            props = {}
        }

        const id = `component-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        return {
            id,
            type: 'UPDLComponent',
            componentType,
            // Basic component properties
            primitive,
            color,
            scriptName,
            // Space MMO component properties
            maxCapacity,
            currentLoad,
            fireRate,
            damage,
            pricePerTon,
            interactionRange,
            resourceType,
            maxYield,
            asteroidVolume,
            hardness,
            targetWorld,
            cooldownTime,
            // Additional properties
            props
        }
    }
}
