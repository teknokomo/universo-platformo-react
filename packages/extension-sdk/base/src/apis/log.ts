export interface LogAPI {
    debug(message: string, metadata?: unknown): void
    info(message: string, metadata?: unknown): void
    warn(message: string, metadata?: unknown): void
    error(message: string, metadata?: unknown): void
}