// Universo Platformo | Player Schema for Colyseus
import { Schema, type } from "@colyseus/schema"

/**
 * Player state schema for multiplayer synchronization
 */
export class PlayerSchema extends Schema {
    @type("string") name: string = ""
    
    // Position
    @type("number") x: number = 0
    @type("number") y: number = 2
    @type("number") z: number = 0
    
    // Rotation
    @type("number") rx: number = 0
    @type("number") ry: number = 0
    @type("number") rz: number = 0
    
    // Game state
    @type("number") inventory: number = 0
    @type("number") credits: number = 0
    
    // Timestamps for interpolation
    @type("number") lastUpdate: number = Date.now()
}
