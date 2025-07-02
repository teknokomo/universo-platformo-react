// Universo Platformo | Library Configuration Types
// LOCAL: Define constants directly to avoid runtime dependency on publish-srv

import type { ILibrarySource as _ILibrarySource, ILibraryConfig as _ILibraryConfig } from '@universo/publish-srv'

export type LibrarySource = _ILibrarySource
export type LibraryConfig = _ILibraryConfig

// Default library configuration (kept in sync with server constants)
export const DEFAULT_LIBRARY_CONFIG: LibraryConfig = {
    arjs: { version: '3.4.7', source: 'official' },
    aframe: { version: '1.7.1', source: 'official' }
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
