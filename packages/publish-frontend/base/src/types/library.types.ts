// Universo Platformo | Library Configuration Types
// LOCAL: Define constants directly to avoid runtime dependency on publish-backend

import type { ILibraryConfig as _ILibraryConfig } from '@universo/publish-backend'

// Library source type - matches server definition
export type LibrarySource = 'official' | 'kiberplano'

export type LibraryConfig = _ILibraryConfig

// Default library configuration (kept in sync with server constants)
export const DEFAULT_LIBRARY_CONFIG: LibraryConfig = {
    arjs: { version: '3.4.7', source: 'kiberplano' },
    aframe: { version: '1.7.1', source: 'kiberplano' }
}

// Available versions for libraries
export const AVAILABLE_VERSIONS = {
    arjs: ['3.4.7'],
    aframe: ['1.7.1']
}

// Available sources with display names
export const LIBRARY_SOURCES: Record<string, string> = {
    official: 'Официальный сервер',
    kiberplano: 'Сервер Kiberplano'
}
