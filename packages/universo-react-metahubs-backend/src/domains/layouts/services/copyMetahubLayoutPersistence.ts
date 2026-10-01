import { queryOne, type SqlQueryable } from '@universo-react/utils/database'
import { MetahubDomainError } from '../../shared/domainErrors'
import type { CopyMetahubLayoutParams, LayoutCopyOwnership, PreparedLayoutCopy } from './copyMetahubLayoutTypes'

export const insertCopiedLayout = async ({
    trx,
    layoutsQt,
    sourceLayoutId,
    ownership,
    preparedLayout,
    now,
    userId
}: {
    trx: SqlQueryable
    layoutsQt: string
    sourceLayoutId: string
    ownership: LayoutCopyOwnership
    preparedLayout: PreparedLayoutCopy
    now: Date
    userId: CopyMetahubLayoutParams['userId']
}): Promise<Record<string, unknown>> => {
    const createdLayout = await queryOne<Record<string, unknown>>(
        trx,
        `INSERT INTO ${layoutsQt} (
        scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
        _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by, _upl_version,
        _upl_archived, _upl_deleted, _upl_locked,
        _mhb_published, _mhb_archived, _mhb_deleted
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $11, $12, $13,
        $14, $14, $14,
        $15, $14, $14
    ) RETURNING *`,
        [
            ownership.isScopedLayout ? ownership.scopeEntityId : null,
            ownership.isScopedLayout ? ownership.baseLayoutId : null,
            ownership.templateKey,
            JSON.stringify(preparedLayout.name),
            preparedLayout.description ? JSON.stringify(preparedLayout.description) : null,
            JSON.stringify(preparedLayout.config),
            preparedLayout.isActive,
            false,
            preparedLayout.sortOrder,
            null,
            now,
            userId ?? null,
            1,
            false,
            true
        ]
    )

    if (!createdLayout) {
        throw new MetahubDomainError({
            message: 'Failed to create layout copy',
            statusCode: 500,
            code: 'SCHEMA_SYNC_FAILED',
            details: { operation: 'copy-layout', layoutId: sourceLayoutId }
        })
    }
    return createdLayout
}
