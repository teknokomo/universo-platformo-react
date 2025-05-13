// Universo Platformo | Constant values for UPDL Frontend
export const API_BASE_URL = process.env.API_URL || '/api'
export const UPDL_API_URL = `${API_BASE_URL}/updl`

// Exporter types
export const EXPORTER_TYPES = {
    ARJS: 'arjs',
    AFRAME: 'aframe',
    PLAYCANVAS: 'playcanvas',
    THREEJS: 'threejs',
    BABYLON: 'babylon'
} as const

// Node types
export const NODE_TYPES = {
    SCENE: 'scene',
    OBJECT: 'object',
    CAMERA: 'camera',
    LIGHT: 'light'
} as const

// Default values
export const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 5 }
export const DEFAULT_LIGHT_INTENSITY = 1.0
export const DEFAULT_OBJECT_COLOR = '#FF0000'

// Icons paths (updated to new assets structure)
export const ICONS_BASE_PATH = 'assets/icons'

export default {
    API_BASE_URL,
    UPDL_API_URL,
    EXPORTER_TYPES,
    NODE_TYPES,
    DEFAULT_CAMERA_POSITION,
    DEFAULT_LIGHT_INTENSITY,
    DEFAULT_OBJECT_COLOR,
    ICONS_BASE_PATH
}
