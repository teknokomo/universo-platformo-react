import type { Request } from 'express'
import type { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm'
import type { RequestWithDbContext } from '@universo/auth-backend'

/**
 * Get the EntityManager for a request, preferring RLS-enabled context if available.
 *
 * When using createEnsureAuthWithRls middleware, requests will have a dedicated
 * QueryRunner with PostgreSQL session variables set for RLS. This function
 * ensures you use the correct manager.
 *
 * @param req - Express request (may have dbContext from RLS middleware)
 * @param dataSource - Fallback TypeORM DataSource
 * @returns EntityManager (RLS-enabled if available, otherwise default)
 */
export function getRequestManager(req: Request, dataSource: DataSource): EntityManager {
    const rlsContext = (req as RequestWithDbContext).dbContext
    return rlsContext?.manager ?? dataSource.manager
}

/**
 * Get a TypeORM repository for a request, using RLS context if available.
 *
 * Convenience wrapper around getRequestManager for common repository access pattern.
 *
 * Usage:
 * ```ts
 * const unikRepo = getRepositoryForReq(req, dataSource, Unik)
 * const uniks = await unikRepo.find({ where: { name: 'test' } })
 * ```
 *
 * @param req - Express request
 * @param dataSource - TypeORM DataSource
 * @param entity - Entity class or schema name
 * @returns Repository for the entity
 */
export function getRepositoryForReq<Entity extends ObjectLiteral>(
    req: Request,
    dataSource: DataSource,
    entity: EntityTarget<Entity>
): Repository<Entity> {
    const manager = getRequestManager(req, dataSource)
    return manager.getRepository(entity)
}
