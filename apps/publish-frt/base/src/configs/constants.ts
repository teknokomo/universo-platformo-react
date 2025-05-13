// Universo Platformo | Constants and configuration for publish-frt

// API endpoints
export const API_ENDPOINTS = {
    PUBLISH: '/publish/projects',
    LIST_PROJECTS: '/publish/projects',
    PROJECT_DETAILS: (id: string) => `/publish/projects/${id}`
}

// Supported platforms
export const PLATFORMS = {
    ARJS: 'arjs',
    AFRAME: 'aframe',
    PLAYCANVAS: 'playcanvas'
}

// Default publish options
export const DEFAULT_PUBLISH_OPTIONS = {
    isPublic: true
}
