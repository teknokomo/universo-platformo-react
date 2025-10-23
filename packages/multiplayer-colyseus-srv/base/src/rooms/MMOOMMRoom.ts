// Universo Platformo | MMOOMM Room for Colyseus
import { Room, Client } from "colyseus"
import { MMOOMMRoomState, PlayerSchema, EntitySchema } from "../schemas"

/**
 * MMOOMM Room handles multiplayer space gameplay
 */
export class MMOOMMRoom extends Room<MMOOMMRoomState> {
    maxClients = 16
    private static DEBUG_ENTITIES = false

    onCreate(options: any) {
        console.log('[MMOOMMRoom] Creating room with options:', options)

        // Initialize Colyseus state (required for 0.16.x)
        this.setState(new MMOOMMRoomState())

        // Initialize entities from UPDL data if provided
        this.initializeEntities(options.entities || [])

        // Setup message handlers
        this.onMessage("updateTransform", this.handleUpdateTransform.bind(this))
        this.onMessage("startMining", this.handleStartMining.bind(this))
        this.onMessage("sellAll", this.handleSellAll.bind(this))

        console.log('[MMOOMMRoom] Room created successfully')
    }

    onJoin(client: Client, options: any) {
        console.log(`[MMOOMMRoom] Player joining: ${client.sessionId}`)

        const player = new PlayerSchema()
        // Accept both playerName and name for compatibility
        player.name = options.playerName || options.name || `Player${client.sessionId.slice(0, 4)}`

        // Random spawn position in space
        player.x = (Math.random() - 0.5) * 100
        player.y = 2
        player.z = (Math.random() - 0.5) * 100

        // Starting resources
        player.inventory = 0
        player.credits = 100

        this.state.players.set(client.sessionId, player)
        this.state.currentPlayers++

        console.log(`[MMOOMMRoom] Player ${player.name} joined at position (${player.x}, ${player.y}, ${player.z})`)
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`[MMOOMMRoom] Player leaving: ${client.sessionId}`)

        this.state.players.delete(client.sessionId)
        this.state.currentPlayers--

        console.log(`[MMOOMMRoom] Player left, current players: ${this.state.currentPlayers}`)
    }

    onDispose() {
        console.log('[MMOOMMRoom] Room disposed')
    }

    /**
     * Initialize entities (asteroids, stations, gates) from UPDL data
     * ENHANCED: Better entity data processing with validation and logging
     */
    private initializeEntities(entities: any[]) {
        if (MMOOMMRoom.DEBUG_ENTITIES) console.log('[MMOOMMRoom] Initializing entities:', {
            count: entities.length,
            entities: entities.map(e => ({
                id: e.id,
                type: e.type,
                entityType: e.entityType,
                position: e.position,
                transform: e.transform,
                components: e.components?.length || 0,
                networked: e.networked
            }))
        })

        // Create default entities if none provided
        if (entities.length === 0) {
            if (MMOOMMRoom.DEBUG_ENTITIES) console.log('[MMOOMMRoom] No entities provided, creating default entities')
            this.createDefaultEntities()
            return
        }

        // Process Flow entities with enhanced data extraction
        entities.forEach((entity, index) => {
            if (MMOOMMRoom.DEBUG_ENTITIES) console.log(`[MMOOMMRoom] Processing entity ${index}:`, {
                id: entity.id,
                type: entity.type,
                entityType: entity.entityType,
                position: entity.position,
                transform: entity.transform,
                scale: entity.scale,
                visual: entity.visual,
                components: entity.components,
                networked: entity.networked
            })

            const entitySchema = new EntitySchema()
            entitySchema.id = entity.id || `entity_${index}`

            // Use entityType from multiple possible sources
            entitySchema.entityType = entity.entityType || entity.type || 'asteroid'

            // Position from transform or direct position
            const position = entity.transform?.position || entity.position
            if (position) {
                if (Array.isArray(position)) {
                    entitySchema.x = position[0] || 0
                    entitySchema.y = position[1] || 0
                    entitySchema.z = position[2] || 0
                } else {
                    entitySchema.x = position.x || 0
                    entitySchema.y = position.y || 0
                    entitySchema.z = position.z || 0
                }
            } else {
                // Random position if no position data
                entitySchema.x = (Math.random() - 0.5) * 200
                entitySchema.y = 0
                entitySchema.z = (Math.random() - 0.5) * 200
            }

            // Scale from transform or direct scale
            const scale = entity.transform?.scale || entity.scale
            if (scale) {
                if (Array.isArray(scale)) {
                    entitySchema.scaleX = scale[0] || 1
                    entitySchema.scaleY = scale[1] || 1
                    entitySchema.scaleZ = scale[2] || 1
                } else {
                    entitySchema.scaleX = scale.x || 1
                    entitySchema.scaleY = scale.y || 1
                    entitySchema.scaleZ = scale.z || 1
                }
            } else {
                entitySchema.scaleX = 1
                entitySchema.scaleY = 1
                entitySchema.scaleZ = 1
            }

            // Visual properties from Flow
            if (entity.visual) {
                entitySchema.primitive = entity.visual.model || entity.visual.primitive || 'box'
                entitySchema.color = entity.visual.color || '#888888'
            } else {
                entitySchema.primitive = 'box'
                entitySchema.color = '#888888'
            }

            // Component-based properties from Flow with enhanced processing
            const components = entity.components || []
            const mineableComponent = components.find((c: any) =>
                c.data?.componentType === 'mineable' || c.type === 'mineable'
            )
            const tradingComponent = components.find((c: any) =>
                c.data?.componentType === 'trading' || c.type === 'trading'
            )

            if (MMOOMMRoom.DEBUG_ENTITIES) console.log(`[MMOOMMRoom] Entity ${entity.id} components:`, {
                total: components.length,
                mineable: !!mineableComponent,
                trading: !!tradingComponent,
                mineableData: mineableComponent?.data,
                tradingData: tradingComponent?.data,
                componentTypes: components.map((c: any) => c.data?.componentType || c.type)
            })

            // Type-specific properties based on entityType and components
            if (entitySchema.entityType === 'asteroid' || mineableComponent) {
                const mineableData = mineableComponent?.data || {}
                entitySchema.resourceLeft = mineableData.maxYield || 100
                entitySchema.material = mineableData.resourceType || 'asteroidMass'
                this.state.asteroids.set(entitySchema.id, entitySchema)
                console.log(`[MMOOMMRoom] Added asteroid: ${entitySchema.id} with ${entitySchema.resourceLeft} ${entitySchema.material}`)
            } else if (entitySchema.entityType === 'station' || tradingComponent) {
                const tradingData = tradingComponent?.data || {}
                entitySchema.buyPrice = tradingData.pricePerTon || 10
                this.state.stations.set(entitySchema.id, entitySchema)
                console.log(`[MMOOMMRoom] Added station: ${entitySchema.id} with buy price ${entitySchema.buyPrice}`)
            } else if (entitySchema.entityType === 'gate') {
                entitySchema.targetWorld = entity.targetWorld || 'unknown'
                this.state.gates.set(entitySchema.id, entitySchema)
                console.log(`[MMOOMMRoom] Added gate: ${entitySchema.id} to ${entitySchema.targetWorld}`)
            } else if (entitySchema.entityType === 'ship') {
                // Ships are handled as players, skip for now
                if (MMOOMMRoom.DEBUG_ENTITIES) console.log(`[MMOOMMRoom] Skipping ship entity ${entitySchema.id} (handled as player)`)
            } else {
                // Default to asteroid for unknown types
                entitySchema.resourceLeft = 50
                entitySchema.material = 'unknown'
                this.state.asteroids.set(entitySchema.id, entitySchema)
                if (MMOOMMRoom.DEBUG_ENTITIES) console.log(`[MMOOMMRoom] Added unknown entity ${entitySchema.id} as asteroid (default)`)
            }
        })

        console.log(`[MMOOMMRoom] Initialized ${this.state.asteroids.size} asteroids, ${this.state.stations.size} stations, ${this.state.gates.size} gates`)
    }

    /**
     * Create default entities for empty rooms
     */
    private createDefaultEntities() {
        // Create some default asteroids
        for (let i = 0; i < 5; i++) {
            const asteroid = new EntitySchema()
            asteroid.id = `asteroid_${i}`
            asteroid.entityType = 'asteroid'
            asteroid.x = (Math.random() - 0.5) * 150
            asteroid.y = 0
            asteroid.z = (Math.random() - 0.5) * 150
            asteroid.resourceLeft = 100
            asteroid.material = ['iron', 'copper', 'gold'][Math.floor(Math.random() * 3)]
            this.state.asteroids.set(asteroid.id, asteroid)
        }

        // Create a default station
        const station = new EntitySchema()
        station.id = 'station_0'
        station.entityType = 'station'
        station.x = 0
        station.y = 0
        station.z = 50
        station.buyPrice = 10
        this.state.stations.set(station.id, station)

        console.log('[MMOOMMRoom] Created default entities: 5 asteroids, 1 station')
    }

    /**
     * Handle player transform updates
     */
    private handleUpdateTransform(client: Client, data: any) {
        const player = this.state.players.get(client.sessionId)
        if (!player || !data) return

        // Debug logging for incoming updates (throttled by time)
        const DEBUG_UPDATES = false
        if (DEBUG_UPDATES) {
            try {
                if (!((player as any)._lastLogTs)) (player as any)._lastLogTs = 0
                const now = Date.now()
                if (now - (player as any)._lastLogTs > 1000) {
                    console.log(`[MMOOMMRoom] updateTransform from ${client.sessionId}:`, {
                        x: data.x, y: data.y, z: data.z, rx: data.rx, ry: data.ry, rz: data.rz
                    })
                    ;(player as any)._lastLogTs = now
                }
            } catch {}
        }

        // Update player position and rotation with validation
        if (typeof data.x === 'number') player.x = Math.max(-500, Math.min(500, data.x))
        if (typeof data.y === 'number') player.y = Math.max(-100, Math.min(100, data.y))
        if (typeof data.z === 'number') player.z = Math.max(-500, Math.min(500, data.z))
        if (typeof data.rx === 'number') player.rx = data.rx
        if (typeof data.ry === 'number') player.ry = data.ry
        if (typeof data.rz === 'number') player.rz = data.rz

        player.lastUpdate = Date.now()
    }

    /**
     * Handle mining requests (server-authoritative)
     */
    private handleStartMining(client: Client, data: any) {
        const player = this.state.players.get(client.sessionId)
        if (!player) return

        // Find nearest asteroid
        const nearestAsteroid = this.findNearestAsteroid(player.x, player.y, player.z)
        if (!nearestAsteroid) return

        const distance = this.calculateDistance(player, nearestAsteroid)
        const miningRange = 75 // Mining range

        if (distance <= miningRange && nearestAsteroid.resourceLeft > 0) {
            // Mine resources
            const mineAmount = 1.5
            nearestAsteroid.resourceLeft = Math.max(0, nearestAsteroid.resourceLeft - mineAmount)
            player.inventory += mineAmount
            nearestAsteroid.lastUpdate = Date.now()

            console.log(`[MMOOMMRoom] Player ${player.name} mined ${mineAmount} from ${nearestAsteroid.id}, remaining: ${nearestAsteroid.resourceLeft}`)
        }
    }

    /**
     * Handle selling all inventory at nearest station
     */
    private handleSellAll(client: Client) {
        const player = this.state.players.get(client.sessionId)
        if (!player || player.inventory <= 0) return

        // Find nearest station
        const nearestStation = this.findNearestStation(player.x, player.y, player.z)
        if (!nearestStation) return

        const distance = this.calculateDistance(player, nearestStation)
        const tradingRange = 50 // Trading range

        if (distance <= tradingRange) {
            // Sell all inventory
            const sellAmount = player.inventory
            const totalCredits = sellAmount * nearestStation.buyPrice

            player.credits += totalCredits
            player.inventory = 0

            console.log(`[MMOOMMRoom] Player ${player.name} sold ${sellAmount} units for ${totalCredits} credits`)
        }
    }

    /**
     * Find nearest asteroid to player
     */
    private findNearestAsteroid(x: number, y: number, z: number): EntitySchema | null {
        let nearest: EntitySchema | null = null
        let minDistance = Infinity

        this.state.asteroids.forEach((asteroid) => {
            if (asteroid.resourceLeft <= 0) return // Skip depleted asteroids

            const distance = Math.sqrt(
                Math.pow(asteroid.x - x, 2) +
                Math.pow(asteroid.y - y, 2) +
                Math.pow(asteroid.z - z, 2)
            )

            if (distance < minDistance) {
                minDistance = distance
                nearest = asteroid
            }
        })

        return nearest
    }

    /**
     * Find nearest station to player
     */
    private findNearestStation(x: number, y: number, z: number): EntitySchema | null {
        let nearest: EntitySchema | null = null
        let minDistance = Infinity

        this.state.stations.forEach((station) => {
            const distance = Math.sqrt(
                Math.pow(station.x - x, 2) +
                Math.pow(station.y - y, 2) +
                Math.pow(station.z - z, 2)
            )

            if (distance < minDistance) {
                minDistance = distance
                nearest = station
            }
        })

        return nearest
    }

    /**
     * Calculate distance between player and entity
     */
    private calculateDistance(player: PlayerSchema, entity: EntitySchema): number {
        return Math.sqrt(
            Math.pow(entity.x - player.x, 2) +
            Math.pow(entity.y - player.y, 2) +
            Math.pow(entity.z - player.z, 2)
        )
    }
}
