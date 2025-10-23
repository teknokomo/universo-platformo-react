// Example usage of HandlerManager for UPDL processing
import { HandlerManager } from './HandlerManager'
import type { IFlowData } from '../../common/types'

/**
 * Example: Processing UPDL flow data for single-player mode
 */
export function exampleSinglePlayerProcessing() {
    const handlerManager = new HandlerManager()

    // Example UPDL flow data with space and entities
    const flowData: IFlowData = {
        updlSpace: {
            id: 'space-station-alpha',
            name: 'Space Station Alpha',
            spaceType: 'root',
            objects: [], // Required field
            entities: [
                {
                    id: 'player-ship',
                    data: {
                        entityType: 'ship',
                        transform: {
                            position: { x: 0, y: 5, z: 10 },
                            rotation: { x: 0, y: 0, z: 0 },
                            scale: { x: 2, y: 1, z: 3 }
                        },
                        networked: false
                    }
                },
                {
                    id: 'mining-station',
                    data: {
                        entityType: 'station',
                        transform: {
                            position: { x: 50, y: 0, z: 0 },
                            rotation: { x: 0, y: 45, z: 0 },
                            scale: { x: 5, y: 5, z: 5 }
                        }
                    }
                },
                {
                    id: 'asteroid-field',
                    data: {
                        entityType: 'asteroid',
                        transform: {
                            position: { x: -30, y: 0, z: 20 },
                            scale: { x: 3, y: 3, z: 3 }
                        }
                    }
                }
            ],
            components: [
                {
                    id: 'ship-inventory',
                    data: {
                        componentType: 'inventory',
                        targetEntity: 'player-ship',
                        maxSlots: 20,
                        allowedItems: ['ore', 'fuel', 'equipment']
                    }
                }
            ],
            events: [
                {
                    id: 'mining-complete',
                    data: {
                        eventType: 'custom',
                        trigger: 'action',
                        networked: false
                    }
                }
            ],
            actions: [
                {
                    id: 'dock-at-station',
                    data: {
                        actionType: 'teleport',
                        target: 'player-ship',
                        parameters: {
                            x: 45, y: 0, z: 0
                        }
                    }
                }
            ],
            datas: [
                {
                    id: 'player-credits',
                    data: {
                        key: 'credits',
                        value: 1000,
                        scope: 'local',
                        sync: false
                    }
                }
            ]
        }
    }

    // Process for single-player mode
    const processedData = handlerManager.processForSinglePlayer(flowData)

    console.log('Single-player processing result:', {
        entitiesCount: processedData.entities.length,
        spacesCount: processedData.spaces.length,
        componentsCount: processedData.components.length,
        eventsCount: processedData.events.length,
        actionsCount: processedData.actions.length
    })

    return processedData
}

/**
 * Example: Processing UPDL flow data for multiplayer mode
 */
export function exampleMultiplayerProcessing() {
    const handlerManager = new HandlerManager()

    // Example UPDL flow data for multiplayer space
    const flowData: IFlowData = {
        updlSpace: {
            id: 'mmo-sector-7',
            name: 'Sector 7 - Multiplayer Zone',
            spaceType: 'root',
            description: 'Join other players in this mining sector',
            objects: [], // Required field
            leadCollection: {
                collectName: true,
                collectEmail: false,
                collectPhone: false
            },
            entities: [
                {
                    id: 'central-station',
                    data: {
                        entityType: 'station',
                        transform: {
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 10, y: 10, z: 10 }
                        },
                        networked: true
                    }
                },
                {
                    id: 'mining-ship-1',
                    data: {
                        entityType: 'ship',
                        transform: {
                            position: { x: 20, y: 5, z: 15 }
                        },
                        networked: true
                    }
                },
                {
                    id: 'asteroid-belt',
                    data: {
                        entityType: 'asteroid',
                        transform: {
                            position: { x: -50, y: 0, z: 30 },
                            scale: { x: 8, y: 8, z: 8 }
                        },
                        networked: false // Static environment object
                    }
                },
                {
                    id: 'jump-gate',
                    data: {
                        entityType: 'gate',
                        transform: {
                            position: { x: 100, y: 0, z: 0 },
                            scale: { x: 15, y: 15, z: 5 }
                        },
                        networked: true
                    }
                }
            ],
            components: [
                {
                    id: 'station-trading',
                    data: {
                        componentType: 'trading',
                        targetEntity: 'central-station',
                        buyPrices: { ore: 10, fuel: 5 },
                        sellPrices: { equipment: 50 }
                    }
                },
                {
                    id: 'gate-portal',
                    data: {
                        componentType: 'portal',
                        targetEntity: 'jump-gate',
                        destination: 'sector-8',
                        activationDistance: 10
                    }
                }
            ],
            events: [
                {
                    id: 'player-joined-sector',
                    data: {
                        eventType: 'player_joined',
                        networked: true
                    }
                }
            ],
            datas: [
                {
                    id: 'sector-ore-count',
                    data: {
                        key: 'available_ore',
                        value: 5000,
                        scope: 'space',
                        sync: true
                    }
                }
            ]
        }
    }

    // Process for multiplayer mode
    const multiplayerData = handlerManager.processForMultiplayer(flowData)

    console.log('Multiplayer processing result:', {
        entitiesCount: multiplayerData.entities.length,
        networkEntitiesCount: multiplayerData.networkEntities.length,
        networkedEntities: multiplayerData.networkEntities.filter(e => e.networked).length,
        authScreenTitle: multiplayerData.authScreenData.title,
        serverConfig: `${multiplayerData.serverConfig.host}:${multiplayerData.serverConfig.port}`,
        playerSpawnPoint: multiplayerData.playerSpawnPoint.position
    })

    return multiplayerData
}

/**
 * Example: Processing multi-scene UPDL structure
 */
export function exampleMultiSceneProcessing() {
    const handlerManager = new HandlerManager()

    // Example multi-scene flow data
    const flowData: IFlowData = {
        multiScene: {
            scenes: [
                {
                    spaceId: 'tutorial-scene-1',
                    spaceData: {
                        id: 'tutorial-scene-1',
                        name: 'Tutorial: Basic Controls',
                        objects: [], // Required field
                        entities: [
                            {
                                id: 'tutorial-ship',
                                data: {
                                    entityType: 'ship',
                                    transform: {
                                        position: { x: 0, y: 0, z: 0 }
                                    }
                                }
                            }
                        ],
                        components: [],
                        events: [],
                        actions: [],
                        datas: []
                    },
                    dataNodes: [],
                    objectNodes: [],
                    isLast: false,
                    order: 0
                },
                {
                    spaceId: 'tutorial-scene-2',
                    spaceData: {
                        id: 'tutorial-scene-2',
                        name: 'Tutorial: Mining Operations',
                        objects: [], // Required field
                        entities: [
                            {
                                id: 'tutorial-asteroid',
                                data: {
                                    entityType: 'asteroid',
                                    transform: {
                                        position: { x: 10, y: 0, z: 0 }
                                    }
                                }
                            }
                        ],
                        components: [
                            {
                                id: 'asteroid-mineable',
                                data: {
                                    componentType: 'mineable',
                                    targetEntity: 'tutorial-asteroid',
                                    oreType: 'iron',
                                    oreAmount: 100
                                }
                            }
                        ],
                        events: [],
                        actions: [],
                        datas: []
                    },
                    dataNodes: [],
                    objectNodes: [],
                    isLast: true,
                    order: 1
                }
            ],
            currentSceneIndex: 0,
            totalScenes: 2,
            isCompleted: false
        }
    }

    // Process multi-scene structure
    const processedData = handlerManager.processForSinglePlayer(flowData)

    console.log('Multi-scene processing result:', {
        totalEntities: processedData.entities.length,
        totalSpaces: processedData.spaces.length,
        totalComponents: processedData.components.length,
        sceneEntities: processedData.entities.map(e => e.id),
        spaceNames: processedData.spaces.map(s => s.data?.name || s.id)
    })

    return processedData
}

/**
 * Example: Demonstrating consistent processing between SP and MP modes
 */
export function exampleConsistentProcessing() {
    const handlerManager = new HandlerManager()

    // Same UPDL flow data for both modes
    const flowData: IFlowData = {
        updlSpace: {
            id: 'consistency-test',
            name: 'Consistency Test Space',
            objects: [], // Required field
            entities: [
                {
                    id: 'test-ship',
                    data: {
                        entityType: 'ship',
                        transform: {
                            position: { x: 5, y: 2, z: 8 }
                        }
                    }
                }
            ],
            components: [
                {
                    id: 'test-inventory',
                    data: {
                        componentType: 'inventory',
                        targetEntity: 'test-ship',
                        maxSlots: 10
                    }
                }
            ]
        }
    }

    // Process for both modes
    const singlePlayerData = handlerManager.processForSinglePlayer(flowData)
    const multiplayerData = handlerManager.processForMultiplayer(flowData)

    // Verify consistency
    const consistency = {
        sameEntityCount: singlePlayerData.entities.length === multiplayerData.entities.length,
        sameComponentCount: singlePlayerData.components.length === multiplayerData.components.length,
        sameSpaceCount: singlePlayerData.spaces.length === multiplayerData.spaces.length,
        entityIdsMatch: singlePlayerData.entities.every(e =>
            multiplayerData.entities.some(me => me.id === e.id)
        ),
        multiplayerHasNetworkData: multiplayerData.networkEntities.length > 0,
        multiplayerHasAuthScreen: !!multiplayerData.authScreenData,
        multiplayerHasServerConfig: !!multiplayerData.serverConfig
    }

    console.log('Consistency check:', consistency)

    return {
        singlePlayerData,
        multiplayerData,
        consistency
    }
}

// Export all examples for use in other modules
export const HandlerManagerExamples = {
    singlePlayer: exampleSinglePlayerProcessing,
    multiplayer: exampleMultiplayerProcessing,
    multiScene: exampleMultiSceneProcessing,
    consistency: exampleConsistentProcessing
}