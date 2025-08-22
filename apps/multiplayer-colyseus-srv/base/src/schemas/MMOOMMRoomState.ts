// Universo Platformo | MMOOMM Room State Schema for Colyseus
import { Schema, MapSchema, type } from "@colyseus/schema"
import { PlayerSchema } from "./PlayerSchema"
import { EntitySchema } from "./EntitySchema"

/**
 * Main room state containing all players and entities
 */
export class MMOOMMRoomState extends Schema {
    @type({ map: PlayerSchema }) 
    players = new MapSchema<PlayerSchema>()
    
    @type({ map: EntitySchema }) 
    asteroids = new MapSchema<EntitySchema>()
    
    @type({ map: EntitySchema }) 
    stations = new MapSchema<EntitySchema>()
    
    @type({ map: EntitySchema }) 
    gates = new MapSchema<EntitySchema>()
    
    // Room metadata
    @type("string") roomName: string = "MMOOMM Space"
    @type("number") maxPlayers: number = 16
    @type("number") currentPlayers: number = 0
    @type("number") createdAt: number = Date.now()
}
