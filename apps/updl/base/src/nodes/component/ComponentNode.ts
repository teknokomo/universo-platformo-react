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
                        { label: 'Script', name: 'script' }
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
                    show: { 'inputs.componentType': ['render'] }
                },
                {
                    name: 'color',
                    label: 'Color (HEX)',
                    type: 'string',
                    description: 'Color of the rendered primitive',
                    default: '#FFFFFF',
                    show: { 'inputs.componentType': ['render'] }
                },
                // Fields for Script Component
                {
                    name: 'scriptName',
                    label: 'Script Name',
                    type: 'string',
                    description: 'Name of the script file (e.g., playerController.js)',
                    default: 'myScript.js',
                    show: { 'inputs.componentType': ['script'] }
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
        const primitive = (nodeData.inputs?.primitive as string) || 'box'
        const color = (nodeData.inputs?.color as string) || '#FFFFFF'
        const scriptName = (nodeData.inputs?.scriptName as string) || 'myScript.js'

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
            primitive,
            color,
            scriptName,
            props
        }
    }
}

// Universo Platformo | Export class as nodeClass for Flowise compatibility
module.exports = { nodeClass: ComponentNode }
