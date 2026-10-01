import {
    applicationTemplateKeySchema,
    isEnabledCapabilityConfig,
    decodeLayoutConfigEnvelope,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { qSchemaTable } from '@universo-react/database'
import { queryOne, type SqlQueryable } from '@universo-react/utils/database'
import { uuidV7Schema } from '@universo-react/utils'
import { MetahubDomainError } from '../../shared/domainErrors'
import type { LayoutCopyOwnership } from './copyMetahubLayoutTypes'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const copyOperationDetails = { operation: 'copy-layout' }

export const assertExpectedLayoutVersion = (row: Record<string, unknown>, expectedVersion: number | undefined): void => {
    if (expectedVersion === undefined) return
    const currentVersion = typeof row._upl_version === 'number' && row._upl_version > 0 ? row._upl_version : 1
    if (currentVersion !== expectedVersion) {
        throw new MetahubDomainError({
            message: 'Layout was modified by another request',
            statusCode: 409,
            code: 'CONFLICT',
            details: copyOperationDetails
        })
    }
}

export const resolveLayoutCopyOwnership = (sourceLayout: Record<string, unknown>): LayoutCopyOwnership => {
    const templateKey = applicationTemplateKeySchema.parse(sourceLayout.template_key)
    const rawScopeEntityId = sourceLayout.scope_entity_id
    const rawBaseLayoutId = sourceLayout.base_layout_id
    if (
        (rawScopeEntityId !== null && rawScopeEntityId !== undefined && !uuidV7Schema.safeParse(rawScopeEntityId).success) ||
        (rawBaseLayoutId !== null && rawBaseLayoutId !== undefined && !uuidV7Schema.safeParse(rawBaseLayoutId).success)
    ) {
        throw new MetahubDomainError({
            message: 'Layout ownership metadata is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }

    const scopeEntityId = typeof rawScopeEntityId === 'string' ? rawScopeEntityId : null
    const baseLayoutId = typeof rawBaseLayoutId === 'string' ? rawBaseLayoutId : null
    const isScopedLayout = scopeEntityId !== null
    if (baseLayoutId !== null && !isScopedLayout) {
        throw new MetahubDomainError({
            message: 'A layout base requires an entity scope owner',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }

    return {
        templateKey,
        scopeEntityId,
        baseLayoutId,
        isScopedLayout,
        isOverlayLayout: baseLayoutId !== null
    }
}

export const assertCopyScopeOwnerSupportsLayout = async (trx: SqlQueryable, schemaName: string, scopeEntityId: string): Promise<void> => {
    const objectsQt = qSchemaTable(schemaName, '_mhb_objects')
    const entityTypesQt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
    const scopeOwner = await queryOne<{ capabilities?: unknown }>(
        trx,
        `SELECT t.capabilities
           FROM ${objectsQt} o
           JOIN ${entityTypesQt} t
             ON t.kind_key = o.kind
            AND t._upl_deleted = false
            AND t._mhb_deleted = false
          WHERE o.id = $1
            AND o._upl_deleted = false
            AND o._mhb_deleted = false
          LIMIT 1`,
        [scopeEntityId]
    )
    if (!scopeOwner) {
        throw new MetahubDomainError({
            message: 'Layout scope owner is no longer available',
            statusCode: 409,
            code: 'CONFLICT',
            details: copyOperationDetails
        })
    }

    const capabilities = isRecord(scopeOwner.capabilities) ? scopeOwner.capabilities : {}
    if (!isEnabledCapabilityConfig(capabilities.layoutConfig as Parameters<typeof isEnabledCapabilityConfig>[0])) {
        throw new MetahubDomainError({
            message: 'Layout scope owner no longer supports custom layouts',
            statusCode: 409,
            code: 'CONFLICT',
            details: copyOperationDetails
        })
    }
}

export const lockAndValidateLayoutBase = async (
    trx: SqlQueryable,
    layoutsQt: string,
    baseLayoutId: string,
    sourceTemplateKey: ApplicationTemplateKey
): Promise<void> => {
    const baseLayout = await queryOne<{
        id: string
        scope_entity_id?: unknown
        base_layout_id?: unknown
        template_key?: unknown
        config?: unknown
    }>(
        trx,
        `SELECT id, scope_entity_id, base_layout_id, template_key, config FROM ${layoutsQt}
             WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             FOR UPDATE`,
        [baseLayoutId]
    )
    if (!baseLayout) {
        throw new MetahubDomainError({
            message: 'Layout base is no longer available',
            statusCode: 409,
            code: 'CONFLICT',
            details: copyOperationDetails
        })
    }

    let baseTemplateKey: ApplicationTemplateKey
    let baseEnvelope: ReturnType<typeof decodeLayoutConfigEnvelope>
    try {
        baseTemplateKey = applicationTemplateKeySchema.parse(baseLayout.template_key)
        baseEnvelope = decodeLayoutConfigEnvelope(baseLayout.config ?? {}, { templateKey: baseTemplateKey })
    } catch {
        throw new MetahubDomainError({
            message: 'Layout base configuration is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }

    const baseComposition = baseEnvelope.neutral.composition
    if (
        (baseLayout.scope_entity_id !== null && baseLayout.scope_entity_id !== undefined) ||
        (baseLayout.base_layout_id !== null && baseLayout.base_layout_id !== undefined) ||
        baseTemplateKey !== sourceTemplateKey ||
        !baseComposition ||
        baseComposition.mode !== 'independent' ||
        baseComposition.baseLayoutId !== null
    ) {
        throw new MetahubDomainError({
            message: 'Layout base ownership does not match the copied layout',
            statusCode: 409,
            code: 'CONFLICT',
            details: copyOperationDetails
        })
    }
}
