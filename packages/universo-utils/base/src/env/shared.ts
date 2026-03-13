declare global {
    // Optional host-provided public env object for browser runtime overrides.
    // This keeps the helper declarative and avoids hard dependency on bundler-specific globals.
    var __UNIVERSO_PUBLIC_ENV__: Record<string, string | undefined> | undefined
}

type RuntimeEnvSource = Record<string, string | undefined> | NodeJS.ProcessEnv | undefined

export const getPublicRuntimeEnv = (): Record<string, string | undefined> | undefined => {
    if (typeof globalThis === 'undefined') {
        return undefined
    }

    return globalThis.__UNIVERSO_PUBLIC_ENV__
}

export const getProcessEnv = (): NodeJS.ProcessEnv | undefined => {
    if (typeof process === 'undefined') {
        return undefined
    }

    return process.env
}

export const resolveRuntimeEnvValue = (key: string, sources: RuntimeEnvSource[]): string | undefined => {
    for (const source of sources) {
        const candidate = source?.[key]
        if (typeof candidate === 'string' && candidate.length > 0) {
            return candidate
        }
    }

    return undefined
}

export const getBrowserOrigin = (): string | undefined => {
    if (typeof window === 'undefined') {
        return undefined
    }

    const { origin } = window.location
    return typeof origin === 'string' && origin.length > 0 ? origin : undefined
}
