import type { SelectQueryBuilder, Repository, ObjectLiteral } from 'typeorm'

/**
 * Platform-level soft delete field names (_upl_*)
 */
export interface UplSoftDeleteFields {
    _uplDeleted: boolean
    _uplDeletedAt?: Date
    _uplDeletedBy?: string
}

/**
 * Options for soft delete query helpers
 */
export interface SoftDeleteOptions {
    /** Include soft-deleted records (default: false) */
    includeDeleted?: boolean
    /** Only return soft-deleted records (for trash view) */
    onlyDeleted?: boolean
}

/**
 * Adds platform-level soft delete filter to a query builder.
 * By default, excludes soft-deleted records.
 *
 * @param qb - TypeORM SelectQueryBuilder
 * @param alias - Entity alias used in the query
 * @param options - Filter options
 * @returns The modified query builder
 *
 * @example
 * const query = repo.createQueryBuilder('a')
 * applySoftDeleteFilter(query, 'a') // excludes deleted
 * applySoftDeleteFilter(query, 'a', { onlyDeleted: true }) // trash view
 */
export function applySoftDeleteFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    options: SoftDeleteOptions = {}
): SelectQueryBuilder<T> {
    const { includeDeleted = false, onlyDeleted = false } = options

    if (onlyDeleted) {
        return qb.andWhere(`${alias}._upl_deleted = :isDeleted`, { isDeleted: true })
    }

    if (!includeDeleted) {
        return qb.andWhere(`${alias}._upl_deleted = :isDeleted`, { isDeleted: false })
    }

    return qb
}

/**
 * Performs a platform-level soft delete on an entity.
 * Sets _upl_deleted=true, _upl_deleted_at=now(), _upl_deleted_by=userId
 *
 * @param repo - TypeORM Repository
 * @param id - Entity ID to soft delete
 * @param userId - ID of user performing the deletion
 * @returns Update result
 *
 * @example
 * await softDelete(applicationRepo, applicationId, currentUserId)
 */
export async function softDelete<T extends ObjectLiteral>(repo: Repository<T>, id: string, userId?: string): Promise<void> {
    await repo
        .createQueryBuilder()
        .update()
        .set({
            _upl_deleted: true,
            _upl_deleted_at: () => 'NOW()',
            _upl_deleted_by: userId ?? null
        } as unknown as T)
        .where('id = :id', { id })
        .execute()
}

/**
 * Restores a platform-level soft-deleted entity.
 * Sets _upl_deleted=false, _upl_deleted_at=null, _upl_deleted_by=null
 *
 * @param repo - TypeORM Repository
 * @param id - Entity ID to restore
 * @returns Update result
 *
 * @example
 * await restoreDeleted(applicationRepo, applicationId)
 */
export async function restoreDeleted<T extends ObjectLiteral>(repo: Repository<T>, id: string): Promise<void> {
    await repo
        .createQueryBuilder()
        .update()
        .set({
            _upl_deleted: false,
            _upl_deleted_at: null,
            _upl_deleted_by: null
        } as unknown as T)
        .where('id = :id', { id })
        .execute()
}

/**
 * Permanently deletes soft-deleted records older than specified days.
 * Use with caution - this is irreversible.
 *
 * @param repo - TypeORM Repository
 * @param olderThanDays - Delete records soft-deleted more than N days ago
 * @returns Number of records permanently deleted
 *
 * @example
 * const count = await purgeOldDeleted(applicationRepo, 30) // purge after 30 days
 */
export async function purgeOldDeleted<T extends ObjectLiteral>(repo: Repository<T>, olderThanDays: number): Promise<number> {
    const result = await repo
        .createQueryBuilder()
        .delete()
        .where('_upl_deleted = :isDeleted', { isDeleted: true })
        .andWhere('_upl_deleted_at < NOW() - INTERVAL :days DAY', { days: olderThanDays })
        .execute()

    return result.affected ?? 0
}

/**
 * Counts soft-deleted records (trash count).
 *
 * @param repo - TypeORM Repository
 * @returns Number of soft-deleted records
 */
export async function countDeleted<T extends ObjectLiteral>(repo: Repository<T>): Promise<number> {
    return repo.createQueryBuilder().where('_upl_deleted = :isDeleted', { isDeleted: true }).getCount()
}

/**
 * Base where clause for active (non-deleted) records.
 * Useful for simple findOne/findMany operations.
 *
 * @example
 * const app = await repo.findOne({ where: { id, ...notDeleted() } })
 */
export function notDeleted(): { _upl_deleted: false } {
    return { _upl_deleted: false }
}

/**
 * Base where clause for deleted records (trash view).
 *
 * @example
 * const trashedItems = await repo.find({ where: { ...onlyDeleted() } })
 */
export function onlyDeleted(): { _upl_deleted: true } {
    return { _upl_deleted: true }
}
