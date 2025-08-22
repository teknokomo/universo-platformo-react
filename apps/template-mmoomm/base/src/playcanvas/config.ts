// Universo Platformo | PlayCanvas MMOOMM Template Configuration
// Configuration for Multi-user virtual worlds with real-time synchronization

import { TemplateConfig } from '../common/types'

export const MMOOMMTemplateConfig: TemplateConfig = {
    id: 'mmoomm-playcanvas',
    name: 'templateMmoomm.playcanvasTemplates.mmoomm.name',
    description: 'templateMmoomm.playcanvasTemplates.mmoomm.description',
    version: '0.1.0',
    technology: 'playcanvas',
    supportedTechnologies: ['playcanvas'],
    supportedNodes: ['Space', 'Entity', 'Component', 'Event', 'Action', 'Data', 'Universo'],
    features: ['multiplayer', 'colyseus', 'real-time-sync', 'auth-screen'],
    defaults: {
        gameMode: 'singleplayer',
        multiplayer: {
            serverHost: 'localhost',
            serverPort: 2567,
            roomName: 'mmoomm'
        }
    }
}
