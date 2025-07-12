// Universo Platformo | PlayCanvas MMOOMM Template Configuration
// Configuration for Multi-user virtual worlds with real-time synchronization

import { TemplateConfig } from '../../../common/types'

export const MMOOMMTemplateConfig: TemplateConfig = {
    id: 'mmoomm',
    name: 'playcanvasTemplates.mmoomm.name',
    description: 'playcanvasTemplates.mmoomm.description',
    version: '0.1.0',
    technology: 'playcanvas',
    supportedNodes: [
        'Space', // Multi-scene container
        'Entity', // Network-aware objects
        'Component', // MMO-specific components
        'Event', // Real-time events
        'Action', // Network actions
        'Data', // Shared data synchronization
        'Universo' // Network gateway to Kiberplano
    ],
    features: [
        'playcanvas-2.9.0',
        'networking',
        'real-time-sync',
        'multi-user',
        'universo-gateway',
        'websocket-protocol',
        'mmoomm-systems',
        'script-system',
        'modular-scripts',
        'script-registry'
    ],
    defaults: {
        maxPlayers: 10,
        networkProtocol: 'websocket',
        syncRate: 20, // Hz
        spaceType: 'persistent',
        enableVoiceChat: false,
        enableTextChat: true,
        worldPersistence: true,
        scriptSystem: {
            enableBuiltInScripts: true,
            defaultRotationSpeed: 20,
            scriptRegistrySize: 50
        }
    }
}
