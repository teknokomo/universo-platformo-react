import { z } from 'zod'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryOne, queryOneOrThrow } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    getLayoutZoneSettingDefinition,
    encodeLayoutConfigEnvelope,
    type ApplicationLayoutZone,
    applicationTemplateKeySchema,
    marketingPageConfigSchema,
    dashboardLayoutConfigSchema
} from '@universo-react/types'
import { OptimisticLockError } from '@universo-react/utils'
import { updateWithVersionCheck } from '../../../utils/optimisticLock'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import {
    type MetahubLayoutRow,
    type DbRow,
    layoutZoneSchema,
    rendererConfigInputSchema,
    layoutZoneSettingKeySchema,
    layoutZoneSettingValueSchema,
    decodeLayoutForStorage,
    withIndependentLayoutComposition,
    withOverlayLayoutComposition,
    patchSparseZoneSetting,
    createLayoutSchema,
    updateLayoutSchema
} from './layoutServiceContracts'
import { MetahubLayoutScopeVisibilityService } from './layoutScopeVisibilityService'

/** Provides the crud service operations used by the public layout service. */
export class MetahubLayoutCrudService extends MetahubLayoutScopeVisibilityService {
    async createLayout(metahubId: string, input: z.infer<typeof createLayoutSchema>, userId?: string | null): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const now = new Date()
        const scopeEntityId = input.scopeEntityId ?? null

        const isActive = input.isActive ?? true
        const isDefault = input.isDefault ?? false
        if (isDefault && !isActive) {
            throw this.createConflictError('Default layout must be active')
        }

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            if (scopeEntityId) {
                await this.assertScopeEntitySupportsLayout(tx, schemaName, scopeEntityId)
            }

            const baseLayout = await this.resolveCreateBaseLayout(
                tx,
                schemaName,
                scopeEntityId,
                input.baseLayoutId,
                Boolean(scopeEntityId && input.templateKey)
            )

            if (isDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 3)
                await tx.query<{ id: string }>(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE _upl_deleted = false AND _mhb_deleted = false AND ${scopeClause.sql}`,
                    [now, userId ?? null, ...scopeClause.params]
                )
            }

            const baseTemplateKey = baseLayout ? applicationTemplateKeySchema.parse(baseLayout.template_key) : null
            const isIndependentScopedLayout = Boolean(
                scopeEntityId && input.templateKey && (!baseTemplateKey || input.templateKey !== baseTemplateKey)
            )
            const templateKey = input.templateKey ?? baseTemplateKey ?? 'dashboard'
            const decodedInputEnvelope = decodeLayoutForStorage(templateKey, input.config ?? {})
            const skipDefaultWidgetSeed =
                templateKey === 'dashboard' &&
                ((input.config === undefined && scopeEntityId === null) || decodedInputEnvelope.neutral.skipDefaultZoneWidgetSeed === true)
            const inputEnvelope = {
                ...decodedInputEnvelope,
                neutral: skipDefaultWidgetSeed
                    ? { ...decodedInputEnvelope.neutral, skipDefaultZoneWidgetSeed: true }
                    : decodedInputEnvelope.neutral
            }
            const baseEnvelope =
                baseLayout && !isIndependentScopedLayout ? decodeLayoutForStorage(templateKey, baseLayout.config ?? {}) : null
            const baseRendererConfig = baseEnvelope?.rendererConfig ?? {}
            let nextConfig: Record<string, unknown>

            if (scopeEntityId && !isIndependentScopedLayout) {
                // Renderer configuration keeps the existing whole-layout
                // inheritance behavior. Neutral zone settings stay sparse:
                // only values explicitly supplied by this scoped row survive.
                nextConfig = encodeLayoutConfigEnvelope(
                    {
                        rendererConfig: { ...baseRendererConfig, ...inputEnvelope.rendererConfig },
                        neutral: inputEnvelope.neutral
                    },
                    { templateKey }
                )
                if (baseLayout?.id) {
                    nextConfig = withOverlayLayoutComposition(templateKey, nextConfig, String(baseLayout.id))
                }
            } else {
                const rendererConfig = inputEnvelope.rendererConfig
                nextConfig = encodeLayoutConfigEnvelope({ rendererConfig, neutral: inputEnvelope.neutral }, { templateKey })
                nextConfig = withIndependentLayoutComposition(templateKey, nextConfig)
            }
            if (templateKey === 'marketing-page') {
                const parsedConfig = marketingPageConfigSchema.safeParse(decodeLayoutForStorage(templateKey, nextConfig).rendererConfig)
                if (!parsedConfig.success) {
                    throw new MetahubValidationError('Marketing layout configuration is invalid')
                }
                const neutral = decodeLayoutForStorage(templateKey, nextConfig).neutral
                nextConfig = encodeLayoutConfigEnvelope({ rendererConfig: parsedConfig.data, neutral }, { templateKey })
            } else {
                const decoded = decodeLayoutForStorage(templateKey, nextConfig)
                const parsedConfig = dashboardLayoutConfigSchema.safeParse(decoded.rendererConfig)
                if (!parsedConfig.success) {
                    throw new MetahubValidationError('Dashboard layout configuration is invalid')
                }
                nextConfig = encodeLayoutConfigEnvelope(
                    { rendererConfig: parsedConfig.data ?? {}, neutral: decoded.neutral },
                    { templateKey }
                )
            }
            const created = await queryOneOrThrow<DbRow>(
                tx,
                `INSERT INTO ${lt} (scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $12, 1, false, false, false, true, false, false)
                 RETURNING *`,
                [
                    scopeEntityId,
                    isIndependentScopedLayout ? null : baseLayout?.id ?? null,
                    templateKey,
                    JSON.stringify(input.name),
                    input.description ? JSON.stringify(input.description) : null,
                    JSON.stringify(nextConfig),
                    isActive,
                    isDefault,
                    input.sortOrder ?? 0,
                    null,
                    now,
                    userId ?? null
                ]
            )

            if (!scopeEntityId && !this.shouldSkipDefaultZoneWidgetSeed(nextConfig)) {
                await this.ensureDefaultZoneWidgets(tx, schemaName, String(created.id), userId ?? null)
            }
            return this.mapRow(created)
        })
    }

    async updateLayout(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof updateLayoutSchema>,
        userId?: string | null
    ): Promise<MetahubLayoutRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const now = new Date()

        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        // BUG-3 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            if (!existing) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }

            const scopeEntityId = typeof existing.scope_entity_id === 'string' ? existing.scope_entity_id : null
            const existingTemplateKey = applicationTemplateKeySchema.parse(existing.template_key)
            const nextTemplateKey = input.templateKey ?? existingTemplateKey

            if (nextTemplateKey !== existingTemplateKey) {
                throw this.createConflictError('Layout template cannot change after creation')
            }

            if (input.config !== undefined) {
                rendererConfigInputSchema.parse(input.config)
            }
            const currentEnvelope = decodeLayoutForStorage(existingTemplateKey, existing.config ?? {})
            const inputEnvelope = decodeLayoutForStorage(existingTemplateKey, input.config ?? {})
            let nextConfig = encodeLayoutConfigEnvelope(
                {
                    rendererConfig: input.config !== undefined ? inputEnvelope.rendererConfig : currentEnvelope.rendererConfig,
                    neutral: currentEnvelope.neutral
                },
                { templateKey: existingTemplateKey }
            )
            if (typeof existing.scope_entity_id === 'string' && typeof existing.base_layout_id === 'string') {
                nextConfig = withOverlayLayoutComposition(existingTemplateKey, nextConfig, String(existing.base_layout_id))
            } else {
                nextConfig = withIndependentLayoutComposition(existingTemplateKey, nextConfig)
            }
            if (existingTemplateKey === 'marketing-page') {
                const parsedConfig = marketingPageConfigSchema.safeParse(
                    decodeLayoutForStorage(existingTemplateKey, nextConfig).rendererConfig
                )
                if (!parsedConfig.success) {
                    throw new MetahubValidationError('Marketing layout configuration is invalid')
                }
                nextConfig = encodeLayoutConfigEnvelope(
                    { rendererConfig: parsedConfig.data, neutral: decodeLayoutForStorage(existingTemplateKey, nextConfig).neutral },
                    { templateKey: existingTemplateKey }
                )
            } else {
                const decoded = decodeLayoutForStorage(existingTemplateKey, nextConfig)
                const parsedConfig = dashboardLayoutConfigSchema.safeParse(decoded.rendererConfig)
                if (!parsedConfig.success) {
                    throw new MetahubValidationError('Dashboard layout configuration is invalid')
                }
                nextConfig = encodeLayoutConfigEnvelope(
                    { rendererConfig: parsedConfig.data ?? {}, neutral: decoded.neutral },
                    { templateKey: existingTemplateKey }
                )
            }

            const nextIsActive = input.isActive ?? Boolean(existing.is_active)
            const nextIsDefault = input.isDefault ?? Boolean(existing.is_default)

            if (nextIsDefault && !nextIsActive) {
                throw this.createConflictError('Default layout must be active')
            }

            // Prevent unsetting the last default layout.
            if (Boolean(existing.is_default) && !nextIsDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_default = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const defaultCount = countRow?.count ?? 0
                if (Number.isFinite(defaultCount) && defaultCount <= 1) {
                    throw this.createConflictError('At least one default layout is required')
                }
            }

            // Prevent deactivating the last active layout.
            if (!nextIsActive) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            if (nextIsDefault) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 4)
                await tx.query<{ id: string }>(
                    `UPDATE ${lt} SET is_default = false, _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE ${ACTIVE} AND id != $3 AND ${scopeClause.sql}`,
                    [now, userId ?? null, layoutId, ...scopeClause.params]
                )
            }

            const updateData: Record<string, unknown> = {
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null
            }
            if (input.templateKey) updateData.template_key = input.templateKey
            if (input.name !== undefined) updateData.name = JSON.stringify(input.name)
            if (input.description !== undefined)
                updateData.description = input.description != null ? JSON.stringify(input.description) : null
            if (input.config !== undefined || existingTemplateKey === 'marketing-page') {
                updateData.config = nextConfig != null ? JSON.stringify(nextConfig) : null
            }
            if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder
            if (input.isActive !== undefined) updateData.is_active = nextIsActive
            if (input.isDefault !== undefined) updateData.is_default = nextIsDefault

            const updated = await updateWithVersionCheck({
                executor: tx,
                schemaName,
                tableName: '_mhb_layouts',
                entityId: layoutId,
                entityType: 'layout',
                expectedVersion: input.expectedVersion,
                updateData,
                wrapInTransaction: false
            })

            return this.mapRow(updated)
        })
    }

    async updateLayoutZoneSetting(
        metahubId: string,
        layoutId: string,
        zone: ApplicationLayoutZone,
        settingKey: string,
        value: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<MetahubLayoutRow> {
        const parsedZone = layoutZoneSchema.parse(zone)
        const parsedSettingKey = layoutZoneSettingKeySchema.parse(settingKey)
        const parsedValue = layoutZoneSettingValueSchema.parse(value)
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const locked = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!locked) throw this.createNotFoundError('Layout not found')
            this.assertExpectedLayoutVersion(locked, expectedVersion)
            const templateKey = this.assertLayoutSupportsWidgets(locked)
            const settingDefinition = getLayoutZoneSettingDefinition(templateKey, parsedZone, parsedSettingKey)
            if (settingDefinition?.kind !== 'enum' || !settingDefinition.options.includes(parsedValue)) {
                throw new MetahubValidationError('Layout zone setting is invalid', {
                    templateKey,
                    zone: parsedZone,
                    settingKey: parsedSettingKey,
                    value: parsedValue
                })
            }

            let nextConfig: Record<string, unknown>
            try {
                nextConfig = patchSparseZoneSetting(templateKey, locked.config ?? {}, parsedZone, parsedSettingKey, parsedValue)
                if (this.isScopedEntityLayout(locked)) {
                    nextConfig = withOverlayLayoutComposition(templateKey, nextConfig, String(locked.base_layout_id))
                } else {
                    nextConfig = withIndependentLayoutComposition(templateKey, nextConfig)
                }
            } catch {
                throw new MetahubValidationError('Layout zone setting is invalid', {
                    templateKey,
                    zone: parsedZone,
                    settingKey: parsedSettingKey,
                    value: parsedValue
                })
            }

            const updatedRows = await tx.query<DbRow>(
                `UPDATE ${lt}
                    SET config = $1,
                        _upl_updated_at = $2,
                        _upl_updated_by = $3,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                  WHERE id = $4
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                    AND COALESCE(_upl_version, 1) = $5
                  RETURNING *`,
                [JSON.stringify(nextConfig), new Date(), userId ?? null, layoutId, expectedVersion]
            )
            if (!updatedRows[0]) throw this.createConflictError('Layout was modified by another request')
            return this.mapRow(updatedRows[0])
        })
    }

    async resetLayoutZoneSetting(
        metahubId: string,
        layoutId: string,
        zone: ApplicationLayoutZone,
        settingKey: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<MetahubLayoutRow> {
        const parsedZone = layoutZoneSchema.parse(zone)
        const parsedSettingKey = layoutZoneSettingKeySchema.parse(settingKey)
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const locked = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!locked) throw this.createNotFoundError('Layout not found')
            this.assertExpectedLayoutVersion(locked, expectedVersion)
            const templateKey = this.assertLayoutSupportsWidgets(locked)
            const settingDefinition = getLayoutZoneSettingDefinition(templateKey, parsedZone, parsedSettingKey)
            if (!settingDefinition) {
                throw new MetahubValidationError('Layout zone setting is invalid', {
                    templateKey,
                    zone: parsedZone,
                    settingKey: parsedSettingKey
                })
            }

            let nextConfig: Record<string, unknown>
            try {
                nextConfig = patchSparseZoneSetting(templateKey, locked.config ?? {}, parsedZone, parsedSettingKey, undefined)
                if (this.isScopedEntityLayout(locked)) {
                    nextConfig = withOverlayLayoutComposition(templateKey, nextConfig, String(locked.base_layout_id))
                } else {
                    // Reset removes only this local sparse key. The registry
                    // default becomes effective until a value is explicitly
                    // owned again by the layout.
                    nextConfig = withIndependentLayoutComposition(templateKey, nextConfig, { materializeDefaults: false })
                }
            } catch {
                throw new MetahubValidationError('Layout zone setting is invalid', {
                    templateKey,
                    zone: parsedZone,
                    settingKey: parsedSettingKey
                })
            }

            const updatedRows = await tx.query<DbRow>(
                `UPDATE ${lt}
                    SET config = $1,
                        _upl_updated_at = $2,
                        _upl_updated_by = $3,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                  WHERE id = $4
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                    AND COALESCE(_upl_version, 1) = $5
                  RETURNING *`,
                [JSON.stringify(nextConfig), new Date(), userId ?? null, layoutId, expectedVersion]
            )
            if (!updatedRows[0]) throw this.createConflictError('Layout was modified by another request')
            return this.mapRow(updatedRows[0])
        })
    }

    async deleteLayout(metahubId: string, layoutId: string, expectedVersion: number, userId?: string | null): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
        const now = new Date()

        // BUG-2 fix: All reads + writes inside a single transaction to prevent TOCTOU races
        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const existing = await queryOne<DbRow>(tx, `SELECT * FROM ${lt} WHERE id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            if (!existing) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            const scopeEntityId = typeof existing.scope_entity_id === 'string' ? existing.scope_entity_id : null
            if (existing.is_default) {
                throw this.createConflictError('Cannot delete default layout')
            }

            if (!scopeEntityId) {
                const [dependentScopedLayout] = await tx.query<{ id: string }>(
                    `SELECT id FROM ${lt}
                     WHERE base_layout_id = $1 AND ${ACTIVE}
                     LIMIT 1`,
                    [layoutId]
                )

                if (dependentScopedLayout?.id) {
                    throw this.createConflictError('Cannot delete a global layout that is used by scoped layouts')
                }
            }

            if (existing.is_active) {
                const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId, 1)
                const [countRow] = await tx.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM ${lt} WHERE ${ACTIVE} AND is_active = true AND ${scopeClause.sql}`,
                    scopeClause.params
                )
                const activeCount = countRow?.count ?? 0
                if (Number.isFinite(activeCount) && activeCount <= 1) {
                    throw this.createConflictError('At least one active layout is required')
                }
            }

            await tx.query(
                `UPDATE ${ot} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE layout_id = $3 AND ${ACTIVE}`,
                [now, userId ?? null, layoutId]
            )

            // Cascade: soft-delete all zone widgets belonging to this layout
            await tx.query(
                `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE layout_id = $3 AND ${ACTIVE}`,
                [now, userId ?? null, layoutId]
            )

            // Soft-delete the layout itself
            const actualVersion = Number(existing._upl_version ?? 1)
            if (actualVersion !== expectedVersion) {
                throw new OptimisticLockError({
                    entityId: layoutId,
                    entityType: 'layout',
                    expectedVersion,
                    actualVersion,
                    updatedAt: new Date(existing._upl_updated_at as string),
                    updatedBy: (existing._upl_updated_by as string | null) ?? null
                })
            }

            const deletedRows = await tx.query<{ id: string }>(
                `UPDATE ${lt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                    _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                 WHERE id = $3 AND ${ACTIVE} AND COALESCE(_upl_version, 1) = $4
                 RETURNING id`,
                [now, userId ?? null, layoutId, expectedVersion]
            )
            if (deletedRows.length !== 1) {
                throw new OptimisticLockError({
                    entityId: layoutId,
                    entityType: 'layout',
                    expectedVersion,
                    actualVersion,
                    updatedAt: new Date(existing._upl_updated_at as string),
                    updatedBy: (existing._upl_updated_by as string | null) ?? null
                })
            }
        })
    }
}
