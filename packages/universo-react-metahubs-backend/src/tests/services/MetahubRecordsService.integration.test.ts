import { randomBytes } from 'node:crypto'
import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils/database'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import {
    MetahubRecordKeyDuplicateError,
    MetahubRecordReferencedError,
    MetahubRecordReferenceMissingError
} from '../../domains/shared/domainErrors'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`

const uuid = (suffix: string): string => `018f8a78-7b8f-7c1d-a111-2222333345${suffix}`

describeIntegration('Metahub records integrity integration (requires PostgreSQL)', () => {
    let knex: Knex
    let schemaName: string
    let executor: DbExecutor
    const metahubId = '018f8a78-7b8f-7c1d-a111-222233334500'
    const pricingObjectId = '018f8a78-7b8f-7c1d-a111-222233334501'
    const benefitObjectId = '018f8a78-7b8f-7c1d-a111-222233334502'
    const userId = uuid('ff')
    const tierId = uuid('10')
    const benefitId = uuid('11')

    const tierKeyComponent = {
        id: 'tier-key-component',
        codename: 'TierKey',
        dataType: 'STRING',
        isRequired: false,
        parentComponentId: null,
        validationRules: { maxLength: 64, unique: true, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' }
    }
    const rootTierRefComponent = {
        id: 'benefit-tier-ref-component',
        codename: 'TierRef',
        dataType: 'REF',
        isRequired: true,
        parentComponentId: null,
        objectCollectionId: benefitObjectId,
        targetEntityId: pricingObjectId,
        validationRules: {}
    }
    const tableParentComponent = {
        id: 'related-rows-component',
        codename: 'RelatedRows',
        dataType: 'TABLE',
        isRequired: false,
        parentComponentId: null,
        objectCollectionId: benefitObjectId,
        validationRules: {}
    }
    const tableChildTierRefComponent = {
        id: 'related-rows-tier-ref-component',
        codename: 'TierRef',
        dataType: 'REF',
        isRequired: false,
        parentComponentId: 'related-rows-component',
        objectCollectionId: benefitObjectId,
        targetEntityId: pricingObjectId,
        validationRules: {}
    }

    const createService = (components: unknown[] = [tierKeyComponent], allComponents: unknown[] = [rootTierRefComponent]) => {
        const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
        const objectsService = { findById: jest.fn().mockResolvedValue({ id: pricingObjectId }) }
        const componentsService = {
            findAllFlat: jest.fn().mockResolvedValue(components),
            getAllComponents: jest.fn().mockResolvedValue(allComponents)
        }
        return new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)
    }

    const insertElement = async (id: string, objectId: string, data: Record<string, unknown>, sortOrder: number): Promise<void> => {
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_mhb_elements')}
                (id, object_id, data, sort_order, owner_id, _upl_deleted, _mhb_deleted, _upl_version, _upl_created_at, _upl_updated_at)
             VALUES (?, ?, ?::jsonb, ?, NULL, false, false, 1, now(), now())`,
            [id, objectId, JSON.stringify(data), sortOrder]
        )
    }

    const activeTier = async (): Promise<boolean> => {
        const rows = (await knex.raw(`SELECT _upl_deleted FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [tierId])) as {
            rows: Array<{ _upl_deleted: boolean }>
        }
        return rows.rows[0]?._upl_deleted === false
    }

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 10 }
        })
        executor = createKnexExecutor(knex)
        schemaName = `mhb_${randomBytes(16).toString('hex')}_b1`

        await knex.raw(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_mhb_elements')} (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                object_id uuid NOT NULL,
                data jsonb NOT NULL DEFAULT '{}'::jsonb,
                sort_order integer NOT NULL,
                owner_id uuid NULL,
                _upl_created_at timestamptz NOT NULL DEFAULT now(),
                _upl_created_by uuid NULL,
                _upl_updated_at timestamptz NOT NULL DEFAULT now(),
                _upl_updated_by uuid NULL,
                _upl_deleted boolean NOT NULL DEFAULT false,
                _mhb_deleted boolean NOT NULL DEFAULT false,
                _upl_deleted_at timestamptz NULL,
                _upl_deleted_by uuid NULL,
                _mhb_deleted_at timestamptz NULL,
                _mhb_deleted_by uuid NULL,
                _upl_version integer NOT NULL DEFAULT 1
            )
        `)
        // Mirrors the production partial unique index from systemTableDefinitions
        // so soft-deleted rows stop reserving their sort order, exactly as in
        // the real schema.
        await knex.raw(
            `CREATE UNIQUE INDEX uidx_mhb_elements_object_sort_active ON ${qSchemaTable(
                schemaName,
                '_mhb_elements'
            )} (object_id, sort_order) WHERE _upl_deleted = false AND _mhb_deleted = false`
        )
    })

    afterAll(async () => {
        if (knex) {
            await knex.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
            await knex.destroy()
        }
    })

    beforeEach(async () => {
        await knex.raw(`TRUNCATE ${qSchemaTable(schemaName, '_mhb_elements')}`)
        await insertElement(tierId, pricingObjectId, { TierKey: 'pre-seed' }, 1)
        await insertElement(benefitId, benefitObjectId, { BenefitKey: 'pre-seed-benefit-1', TierRef: tierId }, 1)
    })

    it('refuses to delete a pricing tier while a benefit still references it and keeps the row active', async () => {
        const service = createService()

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).rejects.toBeInstanceOf(MetahubRecordReferencedError)
        await expect(activeTier()).resolves.toBe(true)
    })

    it('deletes the tier once the referencing benefit is removed', async () => {
        const service = createService()
        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [benefitId])

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()
        await expect(activeTier()).resolves.toBe(false)
    })

    it('rejects duplicate semantic keys against real storage and keeps the original row', async () => {
        const service = createService()

        await expect(service.create(metahubId, pricingObjectId, { data: { TierKey: 'pre-seed' } }, userId)).rejects.toBeInstanceOf(
            MetahubRecordKeyDuplicateError
        )

        const rows = await knex.raw(`SELECT count(*)::int AS count FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE object_id = ?`, [
            pricingObjectId
        ])
        expect((rows.rows[0] as { count: number }).count).toBe(1)
    })

    it('suggests a copy suffix for a taken key and allows creating the copied tier', async () => {
        const service = createService()

        await expect(service.suggestUniqueComponentValue(metahubId, pricingObjectId, 'TierKey', 'pre-seed', userId)).resolves.toBe(
            'pre-seed-copy'
        )

        const created = await service.create(metahubId, pricingObjectId, { data: { TierKey: 'pre-seed-copy' } }, userId)
        expect(created).toMatchObject({ data: { TierKey: 'pre-seed-copy' } })
    })

    it('ignores a same-named field in another object when checking root references', async () => {
        const foreignObjectId = uuid('20')
        const service = createService()
        // The only active row whose TierRef equals the tier id belongs to an
        // object that does not declare the TierRef component.
        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [benefitId])
        await insertElement(uuid('21'), foreignObjectId, { TierRef: tierId }, 1)

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()
        await expect(activeTier()).resolves.toBe(false)
    })

    it('blocks deletion when a TABLE child row references the tier and tolerates non-array table values', async () => {
        const service = createService(
            [tierKeyComponent, tableParentComponent, tableChildTierRefComponent],
            [tableParentComponent, tableChildTierRefComponent]
        )
        await insertElement(uuid('12'), benefitObjectId, { RelatedRows: [{ TierRef: tierId }] }, 2)
        await insertElement(uuid('13'), benefitObjectId, { RelatedRows: null }, 3)

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).rejects.toBeInstanceOf(MetahubRecordReferencedError)
        await expect(activeTier()).resolves.toBe(true)
    })

    it('ignores same-named TABLE child rows in objects that do not declare the component', async () => {
        const foreignObjectId = uuid('20')
        const service = createService(
            [tierKeyComponent, tableParentComponent, tableChildTierRefComponent],
            [tableParentComponent, tableChildTierRefComponent]
        )
        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [benefitId])
        await insertElement(uuid('21'), foreignObjectId, { RelatedRows: [{ TierRef: tierId }] }, 1)

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()
        await expect(activeTier()).resolves.toBe(false)
    })

    it('reordering a record mirrors the new position into data.SortOrder', async () => {
        const sortOrderComponent = {
            id: 'sort-order-component',
            codename: 'SortOrder',
            dataType: 'NUMBER',
            isRequired: false,
            parentComponentId: null,
            validationRules: { min: 0, max: 100 }
        }
        const service = createService([tierKeyComponent, sortOrderComponent])
        await knex.raw(`UPDATE ${qSchemaTable(schemaName, '_mhb_elements')} SET data = data || '{"SortOrder": 1}'::jsonb WHERE id = ?`, [
            tierId
        ])
        await insertElement(uuid('13'), pricingObjectId, { TierKey: 'seed', SortOrder: 2 }, 2)

        await service.reorderRecord(metahubId, pricingObjectId, tierId, 2, userId)

        const rows = (await knex.raw(
            `SELECT data, sort_order, _upl_version FROM ${qSchemaTable(
                schemaName,
                '_mhb_elements'
            )} WHERE object_id = ? ORDER BY sort_order ASC`,
            [pricingObjectId]
        )) as { rows: Array<{ data: Record<string, unknown>; sort_order: number; _upl_version: number }> }
        const movedRow = rows.rows.find((row) => row.data.TierKey === 'pre-seed')
        const otherRow = rows.rows.find((row) => row.data.TierKey === 'seed')
        // The mirrored SortOrder JSON must bump the optimistic version so a
        // stale editor holding the pre-reorder snapshot loses its write.
        expect(movedRow).toMatchObject({ sort_order: 2, data: { SortOrder: 2 }, _upl_version: 2 })
        expect(otherRow).toMatchObject({ sort_order: 1, data: { SortOrder: 1 }, _upl_version: 2 })
    })

    it('soft-deletes the row and frees its unique key for reuse', async () => {
        const service = createService()
        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [benefitId])

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()

        const rows = (await knex.raw(`SELECT _upl_deleted, _mhb_deleted FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [
            tierId
        ])) as { rows: Array<{ _upl_deleted: boolean; _mhb_deleted: boolean }> }
        expect(rows.rows[0]).toMatchObject({ _upl_deleted: true, _mhb_deleted: true })

        await expect(service.create(metahubId, pricingObjectId, { data: { TierKey: 'pre-seed' } }, userId)).resolves.toMatchObject({
            data: { TierKey: 'pre-seed' }
        })
    })

    it('ignores references from soft-deleted rows when deleting a target', async () => {
        const service = createService()
        await knex.raw(`UPDATE ${qSchemaTable(schemaName, '_mhb_elements')} SET _upl_deleted = true WHERE id = ?`, [benefitId])

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()
        await expect(activeTier()).resolves.toBe(false)
    })

    it('rejects a dangling REF against real storage and keeps the original row', async () => {
        const service = createService([tierKeyComponent, rootTierRefComponent], [rootTierRefComponent])

        await expect(
            service.create(metahubId, pricingObjectId, { data: { TierKey: 'growth', TierRef: uuid('99') } }, userId)
        ).rejects.toBeInstanceOf(MetahubRecordReferenceMissingError)

        const rows = (await knex.raw(
            `SELECT count(*)::int AS count FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE object_id = ?`,
            [pricingObjectId]
        )) as { rows: Array<{ count: number }> }
        expect(rows.rows[0].count).toBe(1)
    })

    it('serializes a REF writer against deletion of its target so no dangling REF is inserted', async () => {
        const service = createService([tierKeyComponent, rootTierRefComponent], [rootTierRefComponent])
        const deleteTx = await knex.transaction()
        let outcome: unknown = 'pending'
        try {
            // Mirror the delete lock acquisition: the target row is locked FOR
            // UPDATE before the reference scan.
            await deleteTx.raw(
                `SELECT id FROM ${qSchemaTable(schemaName, '_mhb_elements')}
                 WHERE id = ? AND _upl_deleted = false AND _mhb_deleted = false
                 FOR UPDATE`,
                [tierId]
            )

            const createPromise = service
                .create(metahubId, pricingObjectId, { data: { TierKey: 'blocked', TierRef: tierId } }, userId)
                .then(
                    (value) => {
                        outcome = value
                    },
                    (error) => {
                        outcome = error
                    }
                )

            await new Promise((resolve) => setTimeout(resolve, 250))
            // The writer waits on the shared target row; without FOR KEY SHARE
            // on the existence probe it would already have inserted a dangling REF.
            expect(outcome).toBe('pending')

            await deleteTx.raw(
                `UPDATE ${qSchemaTable(schemaName, '_mhb_elements')}
                 SET _upl_deleted = true, _mhb_deleted = true
                 WHERE id = ?`,
                [tierId]
            )
            await deleteTx.commit()

            await createPromise
            expect(outcome).toBeInstanceOf(MetahubRecordReferenceMissingError)

            const rows = (await knex.raw(
                `SELECT count(*)::int AS count FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE object_id = ?`,
                [pricingObjectId]
            )) as { rows: Array<{ count: number }> }
            expect(rows.rows[0].count).toBe(1)
        } finally {
            if (!deleteTx.isCompleted()) await deleteTx.rollback()
        }
    })

    it('serializes concurrent creates of the same unique key so exactly one wins', async () => {
        const service = createService()

        const results = await Promise.allSettled([
            service.create(metahubId, pricingObjectId, { data: { TierKey: 'growth' } }, userId),
            service.create(metahubId, pricingObjectId, { data: { TierKey: 'growth' } }, userId)
        ])

        const fulfilled = results.filter((result) => result.status === 'fulfilled')
        const rejected = results.filter((result) => result.status === 'rejected')
        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(MetahubRecordKeyDuplicateError)

        const rows = (await knex.raw(
            `SELECT count(*)::int AS count FROM ${qSchemaTable(
                schemaName,
                '_mhb_elements'
            )} WHERE object_id = ? AND data ->> 'TierKey' = 'growth'`,
            [pricingObjectId]
        )) as { rows: Array<{ count: number }> }
        expect(rows.rows[0].count).toBe(1)
    })

    it('keeps the copy suffix inside the component maxLength and creates the copy', async () => {
        const shortKeyComponent = {
            id: 'short-key-component',
            codename: 'TierKey',
            dataType: 'STRING',
            isRequired: false,
            parentComponentId: null,
            validationRules: { maxLength: 12, unique: true }
        }
        const service = createService([shortKeyComponent])
        await knex.raw(`UPDATE ${qSchemaTable(schemaName, '_mhb_elements')} SET data = '{"TierKey": "long-key-123"}'::jsonb WHERE id = ?`, [
            tierId
        ])

        const suggestion = await service.suggestUniqueComponentValue(metahubId, pricingObjectId, 'TierKey', 'long-key-123', userId, {
            maxLength: 12
        })
        expect(suggestion.length).toBeLessThanOrEqual(12)
        // The base is truncated on the separator boundary so the full "-copy"
        // suffix survives inside maxLength without doubling separators.
        expect(suggestion).toBe('long-ke-copy')

        await expect(service.create(metahubId, pricingObjectId, { data: { TierKey: suggestion } }, userId)).resolves.toMatchObject({
            data: { TierKey: suggestion }
        })
    })

    it('rejects duplicate and dangling updates without persisting any change', async () => {
        const readTier = async () => {
            const rows = (await knex.raw(`SELECT data, _upl_version FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [
                tierId
            ])) as { rows: Array<{ data: Record<string, unknown>; _upl_version: number }> }
            return rows.rows[0]
        }

        await insertElement(uuid('13'), pricingObjectId, { TierKey: 'seed' }, 2)
        const keyService = createService()
        await expect(keyService.update(metahubId, pricingObjectId, tierId, { data: { TierKey: 'seed' } }, userId)).rejects.toBeInstanceOf(
            MetahubRecordKeyDuplicateError
        )
        await expect(readTier()).resolves.toMatchObject({ data: { TierKey: 'pre-seed' }, _upl_version: 1 })

        const refService = createService([tierKeyComponent, rootTierRefComponent], [rootTierRefComponent])
        await expect(
            refService.update(metahubId, pricingObjectId, tierId, { data: { TierRef: uuid('99') } }, userId)
        ).rejects.toBeInstanceOf(MetahubRecordReferenceMissingError)
        await expect(readTier()).resolves.toMatchObject({ data: { TierKey: 'pre-seed' }, _upl_version: 1 })
    })

    it('checks only patched REF fields so legacy dangling references do not block unrelated edits', async () => {
        const service = createService([tierKeyComponent, rootTierRefComponent], [rootTierRefComponent])
        await knex.raw(
            `UPDATE ${qSchemaTable(schemaName, '_mhb_elements')} SET data = data || '{"TierRef": "${uuid('98')}"}'::jsonb WHERE id = ?`,
            [tierId]
        )

        await expect(
            service.update(metahubId, pricingObjectId, tierId, { data: { TierKey: 'pre-seed-renamed' } }, userId)
        ).resolves.toMatchObject({ data: { TierKey: 'pre-seed-renamed' } })

        await expect(service.update(metahubId, pricingObjectId, tierId, { data: { TierRef: uuid('98') } }, userId)).rejects.toBeInstanceOf(
            MetahubRecordReferenceMissingError
        )
    })

    it('allows deleting a record that references itself', async () => {
        const service = createService()
        // Drop the unrelated benefit reference first, then make the tier reference itself.
        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, '_mhb_elements')} WHERE id = ?`, [benefitId])
        await knex.raw(
            `UPDATE ${qSchemaTable(schemaName, '_mhb_elements')} SET data = data || '{"TierRef": "${tierId}"}'::jsonb WHERE id = ?`,
            [tierId]
        )

        await expect(service.delete(metahubId, pricingObjectId, tierId, userId)).resolves.toBeUndefined()
        await expect(activeTier()).resolves.toBe(false)
    })
})
