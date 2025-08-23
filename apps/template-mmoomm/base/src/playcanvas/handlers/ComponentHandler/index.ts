// Universo Platformo | MMOOMM Component Handler
// Handles Component nodes for MMO-specific components

import { BuildOptions } from '../../../common/types'

import physics from './components/physics'
import networking from './components/networking'
import audio from './components/audio'
import renderComponent from './components/render'
import custom from './components/custom'
import inventory from './components/inventory'
import trading from './components/trading'
import mineable from './components/mineable'
import portal from './components/portal'
import weapon from './components/weapon'

import renderAttachment from './attachments/render'
import inventoryAttachment from './attachments/inventory'
import tradingAttachment from './attachments/trading'
import mineableAttachment from './attachments/mineable'
import portalAttachment from './attachments/portal'
import weaponAttachment from './attachments/weapon'

const componentGenerators: Record<string, (id: string, props: any) => string> = {
    physics,
    networking,
    audio,
    render: renderComponent,
    custom,
    inventory,
    trading,
    mineable,
    portal,
    weapon
}

const attachmentGenerators: Record<string, (component: any, entityVar: string) => string> = {
    render: renderAttachment,
    inventory: inventoryAttachment,
    trading: tradingAttachment,
    mineable: mineableAttachment,
    portal: portalAttachment,
    weapon: weaponAttachment
}

export class ComponentHandler {
    process(components: any[], options: BuildOptions = {}): string {
        if (!components || components.length === 0) return ''

        return components.map((component) => this.processComponent(component, options)).join('\n')
    }

    attach(component: any, entityVar: string): string {
        // Normalize component type to lower-case for robustness (support raw nodes with data.inputs)
        const rawType = component?.data?.componentType ?? component?.data?.inputs?.componentType ?? 'custom'
        const type = String(rawType).toLowerCase()
        const generator = attachmentGenerators[type]
        return generator ? generator(component, entityVar) : `// TODO: attach component ${component.id} of type ${type}`
    }

    private processComponent(component: any, options: BuildOptions): string {
        // Normalize component type to lower-case for consistency (support raw nodes with data.inputs)
        const rawType = component?.data?.componentType ?? component?.data?.inputs?.componentType ?? 'custom'
        const componentType = String(rawType).toLowerCase()
        const componentId = component.id || `component_${Math.random().toString(36).substr(2, 9)}`
        const targetEntity = component.data?.targetEntity || 'default'
        // FIXED: Use component.data directly instead of component.data.properties
        const properties = component.data || {}

        return `
// MMO Component: ${componentId} (${componentType})
(function() {
    const componentData = {
        id: '${componentId}',
        type: '${componentType}',
        targetEntity: '${targetEntity}',
        properties: ${JSON.stringify(properties)}
    };

    ${this.generateComponentLogic(componentType, componentId, properties)}
})();
`
    }

    private generateComponentLogic(type: string, id: string, properties: any): string {
        const generator = componentGenerators[type] || componentGenerators['custom']
        return generator(id, properties)
    }
}
