// Universo Platformo | Rotator PlayCanvas Script
// Simplified rotation animation script for MMOOMM template

import { BaseScript } from './BaseScript'

/**
 * Simple rotator script for smooth Y-axis rotation animation
 * Extracted from PlayCanvasMMOOMMBuilder for better modularity
 */
export class RotatorScript extends BaseScript {
    private speed: number

    constructor(speed: number = 20) {
        super()
        this.speed = speed
    }

    /**
     * Get script name for PlayCanvas registration
     */
    getName(): string {
        return 'rotator'
    }

    /**
     * Generate PlayCanvas script code for Y-axis rotation
     */
    generateScript(): string {
        return `
// Rotator Script - Smooth Y-axis rotation animation
const RotatorScript = pc.createScript('rotator');
RotatorScript.prototype.update = function(dt) {
    this.entity.rotate(0, ${this.speed} * dt, 0); // Rotate ${this.speed} degrees per second
};`
    }

    /**
     * Create a default Y-axis rotator for demo mode
     * Static factory method for MVP use case
     */
    static createDefault(): RotatorScript {
        return new RotatorScript(20) // Matches original implementation
    }
}
