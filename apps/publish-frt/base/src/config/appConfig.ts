// Universo Platformo | Centralized Application Configuration
// Manages all environment-based settings for the publish-frt application

import { DEFAULT_LIBRARY_CONFIG, LibraryConfig } from '../types/library.types'

// Universo Platformo | Extend Window interface for debug utilities
declare global {
    interface Window {
        universoDebug?: {
            getConfig: () => AppConfig
            getConfigInfo: () => any
            getLibrarySources: () => { aframeSrc: string; arjsSrc: string }
        }
    }
}

export interface DemoConfig {
    enabled: boolean
    demoUrl: string
}

export interface DebugConfig {
    enabled: boolean
    verboseLogging: boolean
}

export interface AppConfig {
    demo: DemoConfig
    debug: DebugConfig
    nodeEnv: string
}

/**
 * Centralized application configuration
 * Note: Library configuration now handled by LibraryConfig types
 */
export const appConfig: AppConfig = {
    // Demo mode configuration
    demo: {
        enabled: false,
        demoUrl: 'https://plano.universo.pro/'
    },

    // Debug and development configuration
    debug: {
        enabled: true,
        verboseLogging: false
    },

    // Environment mode
    nodeEnv: 'development'
}

/**
 * Initialize configuration (legacy compatibility)
 * NOTE: Library configuration now handled by user UI selections
 */
export async function initializeAppConfig() {
    debugLog('App configuration initialized', getAppConfigInfo())

    // Universo Platformo | Expose debug utilities to browser console
    if (typeof window !== 'undefined') {
        window.universoDebug = {
            getConfig: () => appConfig,
            getConfigInfo: getAppConfigInfo,
            getLibrarySources: () => getLibrarySources()
        }
        console.log('🔧 Universo Debug Tools available: window.universoDebug')
    }
}

/**
 * Get library source URLs based on default configuration
 * NOTE: This is fallback only - production uses user-selected libraryConfig
 * @param libraryConfig Optional user configuration, defaults to official sources
 * @returns Object with aframeSrc and arjsSrc URLs
 */
export function getLibrarySources(libraryConfig?: LibraryConfig): { aframeSrc: string; arjsSrc: string } {
    const config = libraryConfig || DEFAULT_LIBRARY_CONFIG

    const baseUrls = {
        official: {
            aframe: 'https://aframe.io/releases',
            arjs: 'https://raw.githack.com/AR-js-org/AR.js'
        },
        kiberplano: {
            aframe: './assets/libs', // Local files served by our server
            arjs: './assets/libs'
        }
    }

    const aframePath =
        config.aframe.source === 'kiberplano'
            ? `${baseUrls.kiberplano.aframe}/aframe/${config.aframe.version}/aframe.min.js`
            : `${baseUrls.official.aframe}/${config.aframe.version}/aframe.min.js`

    const arjsPath =
        config.arjs.source === 'kiberplano'
            ? `${baseUrls.kiberplano.arjs}/arjs/${config.arjs.version}/aframe-ar.js`
            : `${baseUrls.official.arjs}/${config.arjs.version}/aframe/build/aframe-ar.js`

    return {
        aframeSrc: aframePath,
        arjsSrc: arjsPath
    }
}

/**
 * Get current application configuration info for debugging
 * @returns Configuration summary object
 */
export function getAppConfigInfo() {
    const sources = getLibrarySources()
    return {
        environment: appConfig.nodeEnv,
        demoMode: appConfig.demo.enabled,
        debugMode: appConfig.debug.enabled,
        defaultSources: sources
    }
}

/**
 * Utility function to conditionally log debug information
 * @param message Debug message
 * @param data Optional data to log
 */
export function debugLog(message: string, data?: any) {
    if (appConfig.debug.enabled) {
        if (data !== undefined) {
            console.log(`[DEBUG] ${message}`, data)
        } else {
            console.log(`[DEBUG] ${message}`)
        }
    }
}
