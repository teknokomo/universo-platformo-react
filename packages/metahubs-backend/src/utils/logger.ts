/**
 * Lightweight logger for metahubs-backend.
 *
 * Provides structured log methods with consistent tag prefixes.
 * Wraps console.* for now; can be replaced with winston/pino later
 * without touching call sites.
 */

export interface Logger {
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
}

export function createLogger(tag: string): Logger {
    const prefix = `[${tag}]`
    return {
        info: (message: string, ...args: unknown[]) => console.info(prefix, message, ...args),
        warn: (message: string, ...args: unknown[]) => console.warn(prefix, message, ...args),
        error: (message: string, ...args: unknown[]) => console.error(prefix, message, ...args)
    }
}
