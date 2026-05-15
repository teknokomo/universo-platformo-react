/** Global type augmentations for Universo Core Frontend */

interface Window {
    /** Optional base path injected at runtime (e.g. from reverse proxy config) */
    __APP_BASEPATH__?: string
}

interface ImportMetaEnv {
    readonly BASE_URL: string
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly SSR: boolean
    readonly VITE_PORT?: string
    readonly VITE_HOST?: string
}
