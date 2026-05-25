export interface DbSession {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
    isReleased(): boolean
}

export interface DbExecutor {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
    transaction<T>(callback: (executor: DbExecutor) => Promise<T>): Promise<T>
    isReleased(): boolean
}

/**
 * Minimal read-only SQL contract for persistence stores.
 * Accepts any object that can execute raw parameterized SQL.
 */
export interface SqlQueryable {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
}

export interface CreateDbSessionOptions {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
    isReleased(): boolean
}

export interface CreateDbExecutorOptions {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
    transaction<T>(callback: (executor: DbExecutor) => Promise<T>): Promise<T>
    isReleased(): boolean
}

/**
 * Interface for requests with RLS-enabled database context.
 * Used by ensureAuthWithRls middleware.
 */
export interface RequestDbContext {
    session: DbSession
    executor: DbExecutor
    isReleased(): boolean
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T[]>
}

export interface RequestWithDbContext {
    dbContext?: RequestDbContext
}

export function createDbSession(options: CreateDbSessionOptions): DbSession {
    return {
        query: <T = unknown>(sql: string, parameters?: unknown[]) => options.query<T>(sql, parameters),
        isReleased: () => options.isReleased()
    }
}

export function createDbExecutor(options: CreateDbExecutorOptions): DbExecutor {
    return {
        query: <T = unknown>(sql: string, parameters?: unknown[]) => options.query<T>(sql, parameters),
        transaction: <T>(callback: (executor: DbExecutor) => Promise<T>) => options.transaction(callback),
        isReleased: () => options.isReleased()
    }
}

/**
 * Creates a neutral request-scoped database context.
 */
export function createRequestDbContext(session: DbSession, executor: DbExecutor): RequestDbContext {
    return {
        session,
        executor,
        isReleased: () => session.isReleased(),
        query: <T = unknown>(sql: string, parameters?: unknown[]) => session.query<T>(sql, parameters)
    }
}

/**
 * Returns the normalized request-scoped database context if available.
 */
export function getRequestDbContext(req: unknown): RequestDbContext | undefined {
    return (req as RequestWithDbContext).dbContext
}

/**
 * Returns the request-scoped database session if available.
 */
export function getRequestDbSession(req: unknown): DbSession | undefined {
    return getRequestDbContext(req)?.session
}

/**
 * Returns the request-scoped database executor if available, otherwise falls back
 * to the provided fallback executor.
 */
export function getRequestDbExecutor(req: unknown, fallback: DbExecutor): DbExecutor {
    return getRequestDbContext(req)?.executor ?? fallback
}
