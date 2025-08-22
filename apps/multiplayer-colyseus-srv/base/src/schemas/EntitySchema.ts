// Universo Platformo | Entity Schema for Colyseus
import { Schema, type } from "@colyseus/schema"

/**
 * Entity state schema for asteroids, stations, gates
 */
export class EntitySchema extends Schema {
    @type("string") entityType: string = ""
    @type("string") id: string = ""
    
    // Position
    @type("number") x: number = 0
    @type("number") y: number = 0
    @type("number") z: number = 0
    
    // Rotation (for gates and stations)
    @type("number") rx: number = 0
    @type("number") ry: number = 0
    @type("number") rz: number = 0
    
    // Scale
    @type("number") scaleX: number = 1
    @type("number") scaleY: number = 1
    @type("number") scaleZ: number = 1
    
    // Asteroid-specific properties
    @type("number") resourceLeft: number = 100
    @type("string") material: string = "iron"
    
    // Station-specific properties
    @type("number") buyPrice: number = 10

    // Gate-specific properties
    @type("string") targetWorld: string = ""

    // Visual properties from Flow
    @type("string") primitive: string = "box"
    @type("string") color: string = "#888888"

    // Last update timestamp
    @type("number") lastUpdate: number = Date.now()
}
