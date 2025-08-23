// Handler Manager for UPDL processing reuse between SP/MP modes
import type {
    IFlowData,
    ProcessedGameData,
    MultiplayerGameData,
    NetworkEntity,
    Transform,
    AuthScreenData,
    ColyseusServerConfig
} from '../../common/types'

// Import existing MMOOMM handlers
import { SpaceHandler } from './SpaceHandler'
import { EntityHandler } from './EntityHandler'
import { ComponentHandler } from './ComponentHandler'
import { EventHandler } from './EventHandler'
import { ActionHandler } from './ActionHandler'
import { DataHandler } from './DataHandler'
import { UniversoHandler } from './UniversoHandler'

/**
 * Interface for Handler Manager
 */
export interface IHandlerManager {
    processForSinglePlayer(flowData: IFlowData): ProcessedGameData
    processForMultiplayer(flowData: IFlowData): MultiplayerGameData
}

/**
 * Handler Manager
 * Manages UPDL processing and ensures consistency between SP/MP modes
 * Wraps existing UPDL handlers for reuse between single-player and multiplayer
 */
const DEBUG = !!(((globalThis as any)?.DEBUG_MULTIPLAYER) || ((globalThis as any)?.DEBUG_RENDER))

export class HandlerManager implements IHandlerManager {
    private spaceHandler: SpaceHandler
    private entityHandler: EntityHandler
    private componentHandler: ComponentHandler
    private eventHandler: EventHandler
    private actionHandler: ActionHandler
    private dataHandler: DataHandler
    private universoHandler: UniversoHandler
    // Lazy-loaded to avoid tight coupling
    private lightHandler?: any

    constructor() {
        // Initialize all UPDL handlers
        this.spaceHandler = new SpaceHandler()
        this.entityHandler = new EntityHandler()
        this.componentHandler = new ComponentHandler()
        this.eventHandler = new EventHandler()
        this.actionHandler = new ActionHandler()
        this.dataHandler = new DataHandler()
        this.universoHandler = new UniversoHandler()

        if (DEBUG) console.log('[HandlerManager] Initialized with all UPDL handlers')
    }

    /**
     * Process UPDL flow data for single-player mode
     * Uses existing handlers without network modifications
     */
    processForSinglePlayer(flowData: IFlowData): ProcessedGameData {
        if (DEBUG) console.log('[HandlerManager] Processing UPDL for single-player mode')

        try {
            // Extract nodes from flow data
            const nodes = this.extractNodes(flowData)

            // Process each node type using existing handlers
            const spaceData = this.processSpaces(nodes.spaces, { gameMode: 'singleplayer' })
            const entityData = this.processEntities(nodes.entities, { gameMode: 'singleplayer' })
            const componentData = this.processComponents(nodes.components, { gameMode: 'singleplayer' })
            const eventData = this.processEvents(nodes.events, { gameMode: 'singleplayer' })
            const actionData = this.processActions(nodes.actions, { gameMode: 'singleplayer' })
            const dataNodeData = this.processDataNodes(nodes.data, { gameMode: 'singleplayer' })
            const lightData = this.processLights((nodes as any).lights || [], { gameMode: 'singleplayer' })

            // Combine all processed data
            const processedData: ProcessedGameData = {
                entities: entityData.entities,
                spaces: spaceData.spaces,
                components: componentData.components,
                actions: actionData.actions,
                events: eventData.events,
                lights: lightData.lights
            }

            if (DEBUG) console.log('[HandlerManager] Single-player processing complete:', {
                entities: processedData.entities.length,
                spaces: processedData.spaces.length,
                components: processedData.components.length
            })

            return processedData

        } catch (error) {
            console.error('[HandlerManager] Error processing single-player data:', error)
            throw error
        }
    }

    /**
     * Process UPDL flow data for multiplayer mode
     * Uses same base processing with network adaptations
     */
    processForMultiplayer(flowData: IFlowData): MultiplayerGameData {
        if (DEBUG) console.log('[HandlerManager] Processing UPDL for multiplayer mode')

        try {
            // Start with base single-player processing
            const baseData = this.processForSinglePlayer(flowData)

            // Extract nodes for multiplayer-specific processing
            const nodes = this.extractNodes(flowData)

            // Adapt entities for network synchronization
            const networkEntities = this.adaptEntitiesForNetwork(nodes.entities)

            // Generate player spawn point from space data
            const playerSpawnPoint = this.generatePlayerSpawnPoint(nodes.spaces)

            // Create auth screen data from space configuration
            const authScreenData = this.generateAuthScreenData(nodes.spaces)

            // Generate server configuration
            const serverConfig = this.generateServerConfig()

            // Combine into multiplayer data structure
            const multiplayerData: MultiplayerGameData = {
                ...baseData,
                networkEntities,
                playerSpawnPoint,
                authScreenData,
                serverConfig
            }

            if (DEBUG) console.log('[HandlerManager] Multiplayer processing complete:', {
                networkEntities: networkEntities.length,
                hasAuthScreen: !!authScreenData,
                serverConfig: serverConfig.host + ':' + serverConfig.port
            })

            return multiplayerData

        } catch (error) {
            console.error('[HandlerManager] Error processing multiplayer data:', error)
            throw error
        }
    }

    /**
     * Extract nodes from UPDL flow data
     * Handles both single space and multi-scene structures
     * FIXED: Properly handle data that's already processed by UPDLProcessor
     */
    private extractNodes(flowData: IFlowData): ExtractedNodes {
        if (DEBUG) console.log('[HandlerManager] Extracting nodes from flow data')
        if (DEBUG) console.log('[HandlerManager] Flow data structure:', {
            hasUpdlSpace: !!flowData.updlSpace,
            hasMultiScene: !!flowData.multiScene,
            hasFlowData: !!flowData.flowData,
            updlSpaceKeys: flowData.updlSpace ? Object.keys(flowData.updlSpace) : [],
            updlSpaceEntitiesCount: flowData.updlSpace?.entities?.length || 0
        })

        const nodes: ExtractedNodes = {
            spaces: [],
            entities: [],
            components: [],
            events: [],
            actions: [],
            data: [],
            universo: []
        }

        try {
            // Handle multi-scene structure
            if (flowData.multiScene?.scenes) {
                if (DEBUG) console.log('[HandlerManager] Processing multi-scene structure with', flowData.multiScene.scenes.length, 'scenes')

                flowData.multiScene.scenes.forEach((scene, index) => {
                    if (scene.spaceData) {
                        nodes.spaces.push(scene.spaceData)

                        // Extract entities from scene space data
                        if (scene.spaceData.entities) {
                            nodes.entities.push(...scene.spaceData.entities)
                        }
                        if (scene.spaceData.components) {
                            nodes.components.push(...scene.spaceData.components)
                        }
                        if (scene.spaceData.events) {
                            nodes.events.push(...scene.spaceData.events)
                        }
                        if (scene.spaceData.actions) {
                            nodes.actions.push(...scene.spaceData.actions)
                        }
                        if (scene.spaceData.datas) {
                            nodes.data.push(...scene.spaceData.datas)
                        }
                        if (scene.spaceData.universo) {
                            nodes.universo.push(...scene.spaceData.universo)
                        }
                    }
                })
            }

            // Handle single space structure (most common case)
            if (flowData.updlSpace) {
                if (DEBUG) console.log('[HandlerManager] Processing single space structure')
                if (DEBUG) console.log('[HandlerManager] UPDL Space contents:', {
                    entities: flowData.updlSpace.entities?.length || 0,
                    components: flowData.updlSpace.components?.length || 0,
                    events: flowData.updlSpace.events?.length || 0,
                    actions: flowData.updlSpace.actions?.length || 0,
                    datas: flowData.updlSpace.datas?.length || 0,
                    universo: flowData.updlSpace.universo?.length || 0,
                    firstEntity: flowData.updlSpace.entities?.[0] ? {
                        id: flowData.updlSpace.entities[0].id,
                        dataKeys: Object.keys(flowData.updlSpace.entities[0].data || {}),
                        entityType: flowData.updlSpace.entities[0].data?.entityType,
                        hasTransform: !!flowData.updlSpace.entities[0].data?.transform
                    } : null
                })

                nodes.spaces.push(flowData.updlSpace)

                if (flowData.updlSpace.entities) {
                    nodes.entities.push(...flowData.updlSpace.entities)
                }
                if (flowData.updlSpace.components) {
                    nodes.components.push(...flowData.updlSpace.components)
                }
                if (flowData.updlSpace.events) {
                    nodes.events.push(...flowData.updlSpace.events)
                }
                if (flowData.updlSpace.actions) {
                    nodes.actions.push(...flowData.updlSpace.actions)
                }
                // Include lights from UPDL space if present
                if ((flowData.updlSpace as any).lights) {
                    const updlLights = Array.isArray((flowData.updlSpace as any).lights)
                        ? (flowData.updlSpace as any).lights
                        : [(flowData.updlSpace as any).lights]
                    ;(nodes as any).lights = (nodes as any).lights || []
                    ;(nodes as any).lights.push(...updlLights)
                }

                if (flowData.updlSpace.datas) {
                    nodes.data.push(...flowData.updlSpace.datas)
                }
                if (flowData.updlSpace.universo) {
                    nodes.universo.push(...flowData.updlSpace.universo)
                }
            }

            if (DEBUG) console.log('[HandlerManager] Extracted nodes:', {
                spaces: nodes.spaces.length,
                entities: nodes.entities.length,
                components: nodes.components.length,
                events: nodes.events.length,
                actions: nodes.actions.length,
                data: nodes.data.length,
                universo: nodes.universo.length
            })

            // ADDED: Debug first entity if available
            if (DEBUG && nodes.entities.length > 0) {
                const firstEntity = nodes.entities[0]
                console.log('[HandlerManager] First entity details:', {
                    id: firstEntity.id,
                    dataKeys: Object.keys(firstEntity.data || {}),
                    entityType: firstEntity.data?.entityType,
                    transform: firstEntity.data?.transform,
                    hasTransform: !!firstEntity.data?.transform
                })
            }

            // Ensure lights key exists for downstream consumers
            return { lights: (nodes as any).lights || [], ...nodes } as any

        } catch (error) {
            console.error('[HandlerManager] Error extracting nodes:', error)
            return { lights: [], ...nodes } as any // Return empty structure with lights key on error
        }
    }

    /**
     * Process spaces using SpaceHandler
     */
    private processSpaces(spaces: any[], options: any): { spaces: any[] } {
        const processedSpaces = spaces.map(space => {
            const spaceScript = this.spaceHandler.process(space, options)
            return {
                id: space.id || 'default-space',
                script: spaceScript,
                data: space
            }
        })

        return { spaces: processedSpaces }
    }

    /**
     * Process entities using EntityHandler
     */
    private processEntities(entities: any[], options: any): { entities: any[] } {
        // Generate script per entity to avoid duplications
        const processedEntities = entities.map(entity => ({
            id: entity.id || 'default-entity',
            script: this.entityHandler.process([entity], options),
            data: entity,
            transform: entity.data?.transform || { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }))

        return { entities: processedEntities }
    }

    /**
     * Process lights using LightHandler (optional)
     */
    private processLights(lights: any[], options: any): { lights: any[] } {
        if (!lights || lights.length === 0) return { lights: [] }

        if (!this.lightHandler) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { LightHandler } = require('./LightHandler')
            this.lightHandler = new LightHandler()
        }

        const processedLights = lights.map((light: any) => ({
            id: light.id || 'default-light',
            script: this.lightHandler.processOne(light, options),
            data: light
        }))

        return { lights: processedLights }
    }

    /**
     * Process components using ComponentHandler
     */
    private processComponents(components: any[], options: any): { components: any[] } {
        const componentScript = this.componentHandler.process(components, options)

        const processedComponents = components.map(component => ({
            id: component.id || 'default-component',
            script: componentScript,
            data: component
        }))

        return { components: processedComponents }
    }

    /**
     * Process events using EventHandler
     */
    private processEvents(events: any[], options: any): { events: any[] } {
        const eventScript = this.eventHandler.process(events, options)

        const processedEvents = events.map(event => ({
            id: event.id || 'default-event',
            script: eventScript,
            data: event
        }))

        return { events: processedEvents }
    }

    /**
     * Process actions using ActionHandler
     */
    private processActions(actions: any[], options: any): { actions: any[] } {
        const actionScript = this.actionHandler.process(actions, options)

        const processedActions = actions.map(action => ({
            id: action.id || 'default-action',
            script: actionScript,
            data: action
        }))

        return { actions: processedActions }
    }

    /**
     * Process data nodes using DataHandler
     */
    private processDataNodes(dataNodes: any[], options: any): { data: any[] } {
        const dataScript = this.dataHandler.process(dataNodes, options)

        const processedData = dataNodes.map(dataNode => ({
            id: dataNode.id || 'default-data',
            script: dataScript,
            data: dataNode
        }))

        return { data: processedData }
    }

    /**
     * Adapt entities for network synchronization in multiplayer mode
     * FIXED: Extract data from entity.data.inputs where UPDL stores the actual data
     */
    private adaptEntitiesForNetwork(entities: any[]): NetworkEntity[] {
        console.log('[HandlerManager] Adapting', entities.length, 'entities for network')

        // Helper: extract color from attached Render component
        const getRenderColorFromComponents = (entityData: any): any => {
            try {
                const comps = Array.isArray(entityData.components) ? entityData.components : []
                const renderComp = comps.find((c: any) => String(c?.data?.componentType || '').toLowerCase() === 'render')
                if (!renderComp) return undefined
                const d = renderComp.data || {}
                const p = d.props || {}
                return d.color ?? p.color ?? (p.material && p.material.color)
            } catch {
                return undefined
            }
        }

        return entities.map(entity => {
            // FIXED: Extract data from entity.data.inputs instead of entity.data
            const entityInputs = entity.data?.inputs || {}
            const entityData = entity.data || {}
            const transform = entityData.transform || {}
            const entityType = entityData.entityType || entityInputs.entityType || 'static'

            console.log(`[HandlerManager] Processing entity ${entity.id}:`, {
                entityType,
                entityDataType: entityData.entityType,
                inputsEntityType: entityInputs.entityType,
                hasTransform: !!transform,
                hasInputs: !!entityInputs,
                inputsKeys: Object.keys(entityInputs),
                entityDataKeys: Object.keys(entityData),
                fullEntityData: entityData,
                fullInputsData: entityInputs
            })

            // Determine if entity should be networked
            const shouldNetwork = this.shouldEntityBeNetworked(entityType)

            // Extract transform from inputs if not in entityData (multi-scene case)
            const inputsTransform = entityInputs.transform || {}
            const finalTransform = transform.position ? transform : inputsTransform

            const renderColor = getRenderColorFromComponents(entityData)

            const chosenColor = (entityInputs.color || entityData.color || renderColor || '#ffffff') as any
            const networkEntity: NetworkEntity = {
                id: entity.id || `entity_${Math.random().toString(36).substr(2, 9)}`,
                type: this.mapEntityTypeToNetwork(entityType),
                transform: {
                    position: [
                        finalTransform.position?.x || 0,
                        finalTransform.position?.y || 0,
                        finalTransform.position?.z || 0
                    ],
                    rotation: [
                        finalTransform.rotation?.x || 0,
                        finalTransform.rotation?.y || 0,
                        finalTransform.rotation?.z || 0
                    ],
                    scale: [
                        finalTransform.scale?.x || 1,
                        finalTransform.scale?.y || 1,
                        finalTransform.scale?.z || 1
                    ]
                },
                visual: {
                    model: (entityInputs.model || entityData.model || 'box'),
                    texture: entityInputs.texture || entityData.texture,
                    // Prefer explicit entity color, then Render component color, then fallback
                    color: chosenColor
                },
                networked: shouldNetwork,
                // Include component data for server processing
                components: entityData.components || [],
                // Include additional entity properties for server
                entityType: entityType,
                position: finalTransform.position,
                scale: finalTransform.scale
            }

            if ((((globalThis as any)?.DEBUG_MULTIPLAYER) || ((globalThis as any)?.DEBUG_RENDER))) {
                console.log(`[HandlerManager] Created network entity:`, {
                    id: networkEntity.id,
                    type: networkEntity.type,
                    networked: networkEntity.networked,
                    position: networkEntity.transform.position,
                    componentsCount: networkEntity.components?.length || 0,
                    visualColor: chosenColor
                })
            }

            return networkEntity
        })
    }

    /**
     * Determine if entity type should be networked
     */
    private shouldEntityBeNetworked(entityType: string): boolean {
        const networkedTypes = ['ship', 'station', 'player', 'interactive', 'vehicle']
        return networkedTypes.includes(entityType)
    }

    /**
     * Map entity type to network entity type
     */
    private mapEntityTypeToNetwork(entityType: string): 'ship' | 'station' | 'asteroid' | 'gate' {
        const typeMap: Record<string, 'ship' | 'station' | 'asteroid' | 'gate'> = {
            'ship': 'ship',
            'player': 'ship',
            'vehicle': 'ship',
            'station': 'station',
            'interactive': 'station',
            'asteroid': 'asteroid',
            'static': 'asteroid',
            'gate': 'gate',
            'portal': 'gate'
        }

        return typeMap[entityType] || 'asteroid'
    }

    /**
     * Generate player spawn point from space data
     */
    private generatePlayerSpawnPoint(spaces: any[]): Transform {
        // Use first space or default spawn point
        const firstSpace = spaces[0]
        const spawnData = firstSpace?.data?.playerSpawn || {}

        return {
            position: [
                spawnData.position?.x || 0,
                spawnData.position?.y || 5,
                spawnData.position?.z || 10
            ],
            rotation: [
                spawnData.rotation?.x || 0,
                spawnData.rotation?.y || 0,
                spawnData.rotation?.z || 0
            ],
            scale: [1, 1, 1]
        }
    }

    /**
     * Generate auth screen data from space configuration
     */
    private generateAuthScreenData(spaces: any[]): AuthScreenData {
        const firstSpace = spaces[0]
        const leadCollection = firstSpace?.leadCollection || {}

        return {
            collectName: leadCollection.collectName || true,
            title: firstSpace?.name || 'Enter MMOOMM Space',
            description: firstSpace?.description || 'Enter your name to join the multiplayer space',
            placeholder: 'Enter your name...'
        }
    }

    /**
     * Generate server configuration for Colyseus
     * ENHANCED: Better environment variable handling and validation
     */
    private generateServerConfig(): ColyseusServerConfig {
        // Use environment variables or defaults (frontend doesn't have access to process.env)
        // These should be passed from the main application or use browser-safe defaults
        const host = 'localhost' // Will be overridden by main app if needed
        const port = 2567 // Will be overridden by main app if needed
        const protocol = host === 'localhost' ? 'ws' : 'wss'

        const config: ColyseusServerConfig = {
            host,
            port,
            roomName: 'mmoomm',
            protocol: protocol as 'ws' | 'wss'
        }

        console.log('[HandlerManager] Generated server config:', config)
        return config
    }
}

/**
 * Interface for extracted nodes from UPDL flow data
 */
interface ExtractedNodes {
    spaces: any[]
    entities: any[]
    components: any[]
    events: any[]
    actions: any[]
    data: any[]
    universo: any[]
    lights?: any[]
}
