// Universo Platformo | Browser environment configuration utilities
// Prefer host-provided overrides, then Vite import.meta.env, then process/window fallbacks.

import { getBrowserOrigin, getProcessEnv, getPublicRuntimeEnv, resolveRuntimeEnvValue } from './shared'

export * from './adminConfig'
export * from './numberParsing'

type BrowserImportMetaEnv = Record<string, string | boolean | undefined>

const getImportMetaEnv = (): BrowserImportMetaEnv | undefined => {
    return (import.meta as ImportMeta & { env?: BrowserImportMetaEnv }).env
}

const getRuntimeEnvValue = (key: string): string | undefined => {
    return resolveRuntimeEnvValue(key, [getPublicRuntimeEnv(), getImportMetaEnv(), getProcessEnv()])
}

export const getApiBaseURL = (): string => {
    return getRuntimeEnvValue('VITE_API_BASE_URL') || getBrowserOrigin() || 'http://localhost:3000'
}

export const getUIBaseURL = (): string => {
    return getRuntimeEnvValue('VITE_UI_BASE_URL') || getBrowserOrigin() || 'http://localhost:3000'
}

export const getEnv = (key: string, fallback = ''): string => {
    return getRuntimeEnvValue(key) ?? fallback
}

export const isDevelopment = (): boolean => {
    return getEnv('MODE', getEnv('NODE_ENV', 'production')) === 'development'
}

export const isProduction = (): boolean => {
    return getEnv('MODE', getEnv('NODE_ENV', 'production')) === 'production'
}
