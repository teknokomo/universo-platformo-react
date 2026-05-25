/**
 * UUID utilities for Universo Platformo
 * Provides UUID v7 generation and validation functions
 */

import { uuidv7 } from 'uuidv7'

/**
 * Generate a time-ordered UUID v7
 * UUID v7 provides better database indexing performance compared to UUID v4
 * @returns UUID v7 string in standard format (e.g., "018c5f3e-1234-7890-abcd-0123456789ab")
 */
export function generateUuidV7(): string {
    return uuidv7()
}

/**
 * Validate if a string is a valid UUID (any version)
 * @param value - String to validate
 * @returns true if valid UUID format
 */
export function isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(value)
}

/**
 * Extract timestamp from UUID v7
 * UUID v7 encodes Unix timestamp in milliseconds in the first 48 bits
 * @param uuid - UUID v7 string
 * @returns Date object representing the timestamp, or null if invalid
 */
export function extractTimestampFromUuidV7(uuid: string): Date | null {
    if (!isValidUuid(uuid)) {
        return null
    }

    // Extract first 12 hex characters (48 bits = 6 bytes = 12 hex chars)
    const timestampHex = uuid.replace(/-/g, '').substring(0, 12)
    const timestampMs = parseInt(timestampHex, 16)

    // Validate timestamp is reasonable (after year 2000 and before year 3000)
    const minTimestamp = new Date('2000-01-01').getTime()
    const maxTimestamp = new Date('3000-01-01').getTime()

    if (timestampMs < minTimestamp || timestampMs > maxTimestamp) {
        return null
    }

    return new Date(timestampMs)
}
