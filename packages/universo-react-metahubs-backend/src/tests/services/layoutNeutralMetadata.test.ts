import { decodeLayoutConfigEnvelope } from '@universo-react/types'
import {
    MetahubLayoutsService,
    assignLayoutZoneWidgetSchema,
    createLayoutSchema,
    resetLayoutZoneSettingSchema,
    updateLayoutSchema,
    updateLayoutZoneSettingSchema,
    updateLayoutZoneWidgetConfigSchema
} from '../../domains/layouts/services/MetahubLayoutsService'

const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'

const createLayoutRow = (config: Record<string, unknown>, version = 3): Record<string, unknown> => ({
    id: layoutId,
    scope_entity_id: null,
    base_layout_id: null,
    template_key: 'marketing-page',
    name: { en: 'Marketing page' },
    description: null,
    config,
    is_active: true,
    is_default: true,
    sort_order: 0,
    version,
    _upl_version: version,
    _upl_created_at: '2026-09-12T00:00:00.000Z',
    _upl_updated_at: '2026-09-12T00:00:00.000Z'
})

const createService = (lockedRow: Record<string, unknown>) => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('pg_advisory_xact_lock(hashtext($1))')) return []
        if (sql.includes('SELECT id, scope_entity_id, base_layout_id') && sql.includes('FOR UPDATE')) {
            return [lockedRow]
        }
        if (sql.includes('UPDATE') && sql.includes('_mhb_layouts') && sql.includes('RETURNING *')) {
            const nextVersion = Number(lockedRow._upl_version ?? lockedRow.version ?? 1) + 1
            return [
                {
                    ...lockedRow,
                    config: JSON.parse(String(params?.[0])),
                    version: nextVersion,
                    _upl_version: nextVersion,
                    _upl_updated_at: '2026-09-12T00:01:00.000Z'
                }
            ]
        }
        throw new Error(`Unexpected SQL in layout neutral metadata test: ${sql}`)
    })
    const tx = { query }
    const executor = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
        isReleased: () => false
    }
    const schemaService = { ensureSchema: jest.fn(async () => schemaName) }
    return { service: new MetahubLayoutsService(executor as never, schemaService as never), query }
}

describe('metahub layout neutral metadata', () => {
    it('rejects reserved metadata from every renderer-config mutation schema', () => {
        const reservedConfig = {
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null }
            }
        }

        expect(createLayoutSchema.safeParse({ name: { en: 'Layout' }, config: reservedConfig }).success).toBe(false)
        expect(updateLayoutSchema.safeParse({ config: reservedConfig, expectedVersion: 1 }).success).toBe(false)
        expect(
            assignLayoutZoneWidgetSchema.safeParse({
                zone: 'marketing-header',
                widgetKey: 'marketing.brand',
                config: reservedConfig,
                expectedVersion: 1
            }).success
        ).toBe(false)
        expect(updateLayoutZoneWidgetConfigSchema.safeParse({ config: reservedConfig, expectedVersion: 1 }).success).toBe(false)
    })

    it('updates one sparse zone setting while preserving renderer config and composition', async () => {
        const initialConfig = {
            appearance: 'keep-me',
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null },
                zoneSettings: { 'marketing-header': { position: 'fixed' } }
            }
        }
        const { service, query } = createService(createLayoutRow(initialConfig))

        const result = await service.updateLayoutZoneSetting('metahub-1', layoutId, 'marketing-header', 'position', 'flow', 'user-1', 3)

        const updateCall = query.mock.calls.find(([sql]) => String(sql).trimStart().startsWith('UPDATE'))
        const persistedConfig = JSON.parse(String(updateCall?.[1]?.[0])) as Record<string, unknown>
        expect(persistedConfig).toMatchObject({ appearance: 'keep-me' })
        expect(decodeLayoutConfigEnvelope(persistedConfig, { templateKey: 'marketing-page' }).neutral).toEqual({
            composition: { mode: 'independent', baseLayoutId: null },
            zoneSettings: { 'marketing-header': { position: 'flow' } }
        })
        expect(result.config).toMatchObject({ appearance: 'keep-me' })
        expect(query.mock.calls.find(([sql]) => String(sql).includes('FOR UPDATE'))?.[0]).toContain('FOR UPDATE')
        expect(updateCall?.[0]).toContain('COALESCE(_upl_version, 1) = $5')
        expect(updateCall?.[1]?.[4]).toBe(3)
    })

    it('resets only the local sparse setting and exposes the registry default again', async () => {
        const initialConfig = {
            appearance: 'keep-me',
            __layout: {
                composition: { mode: 'independent', baseLayoutId: null },
                zoneSettings: { 'marketing-header': { position: 'flow' } }
            }
        }
        const { service, query } = createService(createLayoutRow(initialConfig, 4))

        await service.resetLayoutZoneSetting('metahub-1', layoutId, 'marketing-header', 'position', 'user-1', 4)

        const updateCall = query.mock.calls.find(([sql]) => String(sql).trimStart().startsWith('UPDATE'))
        const persistedConfig = JSON.parse(String(updateCall?.[1]?.[0])) as Record<string, unknown>
        const neutral = decodeLayoutConfigEnvelope(persistedConfig, { templateKey: 'marketing-page' }).neutral
        expect(persistedConfig).toMatchObject({ appearance: 'keep-me' })
        expect(neutral).toEqual({ composition: { mode: 'independent', baseLayoutId: null } })
    })

    it('checks the locked layout version before writing a sparse setting', async () => {
        const { service, query } = createService(createLayoutRow({}, 4))

        await expect(
            service.updateLayoutZoneSetting('metahub-1', layoutId, 'marketing-header', 'position', 'flow', 'user-1', 3)
        ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' })
        expect(query).toHaveBeenCalledTimes(2)
    })

    it('rejects settings that are not registered for the selected layout zone', async () => {
        const { service, query } = createService(createLayoutRow({}, 4))

        await expect(
            service.updateLayoutZoneSetting('metahub-1', layoutId, 'marketing-header', 'unsupported', 'fixed', 'user-1', 4)
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
        expect(query).toHaveBeenCalledTimes(2)

        const resetFixture = createService(createLayoutRow({}, 4))
        await expect(
            resetFixture.service.resetLayoutZoneSetting('metahub-1', layoutId, 'marketing-header', 'unsupported', 'user-1', 4)
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
        expect(resetFixture.query).toHaveBeenCalledTimes(2)
    })

    it('requires the dedicated route payloads to carry a positive OCC version', () => {
        expect(
            updateLayoutZoneSettingSchema.safeParse({
                zone: 'marketing-header',
                settingKey: 'position',
                value: 'flow',
                expectedVersion: 1
            }).success
        ).toBe(true)
        expect(
            resetLayoutZoneSettingSchema.safeParse({
                zone: 'marketing-header',
                settingKey: 'position',
                expectedVersion: 0
            }).success
        ).toBe(false)
    })
})
