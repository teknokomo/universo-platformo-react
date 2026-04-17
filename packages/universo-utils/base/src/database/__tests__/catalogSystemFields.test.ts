import { describe, expect, it } from 'vitest'
import {
    buildCatalogSystemFieldDefinitionSeedRecord,
    deriveApplicationLifecycleContract,
    derivePlatformSystemFieldsContract,
    getCatalogSystemFieldDefinitions,
    getCatalogSystemFieldSeedInputs,
    getReservedCatalogSystemFieldCodenames,
    normalizeApplicationLifecycleContract,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    validateCatalogSystemFieldToggleSet
} from '../catalogSystemFields'

describe('catalogSystemFields', () => {
    it('exposes a unique registry derived from canonical system field names', () => {
        const definitions = getCatalogSystemFieldDefinitions()
        const keys = new Set(definitions.map((definition) => definition.key))
        const columns = new Set(definitions.map((definition) => definition.columnName))

        expect(definitions).toHaveLength(15)
        expect(keys.size).toBe(definitions.length)
        expect(columns.size).toBe(definitions.length)
        expect(definitions.find((definition) => definition.key === 'app.deleted')?.columnName).toBe('_app_deleted')
        expect(definitions.find((definition) => definition.key === 'upl.deleted')?.canDisable).toBe(true)
    })

    it('returns localized seed rows with default enabled state', () => {
        const rows = getCatalogSystemFieldSeedInputs()
        const deletedBy = rows.find((row) => row.key === 'app.deleted_by')

        expect(rows.every((row) => typeof row.name === 'object')).toBe(true)
        expect(rows.every((row) => row.enabled === true)).toBe(true)
        expect(deletedBy?.physicalType).toBe('uuid')
        expect(deletedBy?.dataType).toBe('STRING')
    })

    it('builds shared seed records and reserved codenames from the same registry', () => {
        const seedInput = getCatalogSystemFieldSeedInputs().find((row) => row.key === 'app.deleted')
        const record = buildCatalogSystemFieldDefinitionSeedRecord(seedInput!)
        const reserved = getReservedCatalogSystemFieldCodenames()

        expect(record).toMatchObject({
            key: 'app.deleted',
            codename: '_app_deleted',
            isSystem: true,
            isSystemManaged: true,
            isSystemEnabled: true
        })
        expect(reserved).toContain('_app_deleted')
        expect(new Set(reserved).size).toBe(reserved.length)
    })

    it('rejects invalid toggle combinations', () => {
        const result = validateCatalogSystemFieldToggleSet([
            { key: 'app.deleted', enabled: false },
            { key: 'app.deleted_at', enabled: true }
        ])

        expect(result.errors).toEqual([
            'System field app.deleted_at requires app.deleted',
            'System field app.deleted_by requires app.deleted'
        ])
    })

    it('derives hard delete when the soft-delete flag is disabled', () => {
        const contract = deriveApplicationLifecycleContract([
            { key: 'app.deleted', enabled: false },
            { key: 'app.deleted_at', enabled: false },
            { key: 'app.deleted_by', enabled: false }
        ])

        expect(contract.delete.mode).toBe('hard')
        expect(contract.delete.trackAt).toBe(false)
        expect(contract.delete.trackBy).toBe(false)
        expect(contract.publish.enabled).toBe(true)
    })

    it('keeps soft delete but suppresses optional audit fields independently', () => {
        const contract = deriveApplicationLifecycleContract([
            { key: 'app.deleted', enabled: true },
            { key: 'app.deleted_at', enabled: false },
            { key: 'app.deleted_by', enabled: true }
        ])

        expect(contract.delete.mode).toBe('soft')
        expect(contract.delete.trackAt).toBe(false)
        expect(contract.delete.trackBy).toBe(true)
    })

    it('derives platform archive/delete families from configurable upl states', () => {
        const contract = derivePlatformSystemFieldsContract([
            { key: 'upl.archived', enabled: false },
            { key: 'upl.archived_at', enabled: false },
            { key: 'upl.archived_by', enabled: false },
            { key: 'upl.deleted', enabled: true },
            { key: 'upl.deleted_at', enabled: false },
            { key: 'upl.deleted_by', enabled: true }
        ])

        expect(contract.archive).toEqual({ enabled: false, trackAt: false, trackBy: false })
        expect(contract.delete).toEqual({ enabled: true, trackAt: false, trackBy: true })
    })

    it('normalizes partial lifecycle contract defaults', () => {
        const contract = normalizeApplicationLifecycleContract({
            publish: { enabled: false },
            delete: { mode: 'soft', trackBy: false }
        })

        expect(contract.publish).toEqual({ enabled: false, trackAt: false, trackBy: false })
        expect(contract.archive).toEqual({ enabled: true, trackAt: true, trackBy: true })
        expect(contract.delete).toEqual({ mode: 'soft', trackAt: true, trackBy: false })
    })

    it('resolves lifecycle contract from runtime object config', () => {
        const contract = resolveApplicationLifecycleContractFromConfig({
            systemFields: {
                lifecycleContract: {
                    archive: { enabled: false },
                    delete: { mode: 'hard' }
                }
            }
        })

        expect(contract.publish).toEqual({ enabled: true, trackAt: true, trackBy: true })
        expect(contract.archive).toEqual({ enabled: false, trackAt: false, trackBy: false })
        expect(contract.delete).toEqual({ mode: 'hard', trackAt: false, trackBy: false })
    })

    it('resolves platform system-field contract from runtime object config', () => {
        const contract = resolvePlatformSystemFieldsContractFromConfig({
            systemFields: {
                fields: [
                    { key: 'upl.archived', enabled: false },
                    { key: 'upl.archived_at', enabled: false },
                    { key: 'upl.archived_by', enabled: false },
                    { key: 'upl.deleted', enabled: false },
                    { key: 'upl.deleted_at', enabled: false },
                    { key: 'upl.deleted_by', enabled: false }
                ]
            }
        })

        expect(contract.archive).toEqual({ enabled: false, trackAt: false, trackBy: false })
        expect(contract.delete).toEqual({ enabled: false, trackAt: false, trackBy: false })
    })
})
