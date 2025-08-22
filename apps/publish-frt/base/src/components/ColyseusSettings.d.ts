// Universo Platformo | ColyseusSettings TypeScript Declarations
// Type declarations for JSX component with validation support

import React from 'react'

export interface ColyseusSettings {
    serverHost: string
    serverPort: number
    roomName: string
}

export interface ColyseusSettingsProps {
    settings?: ColyseusSettings
    onChange: (settings: ColyseusSettings) => void
    visible?: boolean
}

export interface ColyseusValidationErrors {
    serverHost?: string
    serverPort?: string
    roomName?: string
}

/**
 * Validates server host format (localhost, IP address, or domain name)
 */
export declare function isValidHost(host: string): boolean

/**
 * Validates port number (1-65535)
 */
export declare function isValidPort(port: number): boolean

/**
 * Validates room name format (3-32 chars, alphanumeric, underscore, hyphen)
 */
export declare function isValidRoomName(roomName: string): boolean

declare const ColyseusSettings: React.FC<ColyseusSettingsProps>

export default ColyseusSettings