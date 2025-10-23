// Universo Platformo | Base PlayCanvas Script
// Simplified base class for PlayCanvas scripts in MMOOMM template

/**
 * Simplified abstract base class for PlayCanvas scripts
 * Provides minimal interface for MVP implementation
 */
export abstract class BaseScript {
    /**
     * Generate the PlayCanvas script code
     * @returns Generated PlayCanvas script code as string
     */
    abstract generateScript(): string

    /**
     * Get script name for PlayCanvas registration
     * @returns Script name
     */
    abstract getName(): string
}
