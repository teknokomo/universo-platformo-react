import type { DataSource, EntityManager } from 'typeorm'

/**
 * Interface for requests with RLS-enabled database context.
 * Used by ensureAuthWithRls middleware.
 */
export interface RequestWithDbContext {
    dbContext?: {
        manager: EntityManager
        queryRunner: import('typeorm').QueryRunner
    }
}

/**
 * Gets the appropriate EntityManager for the request.
 * Returns RLS-enabled manager if available (from ensureAuthWithRls middleware),
 * otherwise falls back to the default DataSource manager.
 *
 * @param req - Express request object (may have dbContext attached)
 * @param dataSource - TypeORM DataSource for fallback
 * @returns EntityManager - either RLS-scoped or default
 *
 * @example
 * ```typescript
 * router.get('/items', async (req, res) => {
 *     const manager = getRequestManager(req, getDataSource())
 *     const items = await manager.find(Item, { where: { active: true } })
 *     res.json(items)
 * })
 * ```
 */
export function getRequestManager(req: unknown, dataSource: DataSource): EntityManager {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}
