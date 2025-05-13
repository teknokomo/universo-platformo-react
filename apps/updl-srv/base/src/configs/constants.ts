// Universo Platformo | Constants for UPDL server
export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
export const HOST = process.env.HOST || 'localhost'
export const EXPORTERS_ENABLED = ['arjs', 'aframe']

// Paths
export const PUBLIC_DIR = process.env.PUBLIC_DIR || 'public'
export const TEMPLATES_DIR = process.env.TEMPLATES_DIR || 'templates'

// API endpoints
export const API_PREFIX = '/api/updl'

export default {
    PORT,
    HOST,
    EXPORTERS_ENABLED,
    PUBLIC_DIR,
    TEMPLATES_DIR,
    API_PREFIX
}
