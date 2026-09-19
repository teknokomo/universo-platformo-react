import type { Knex } from 'knex'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const createId = (): string => {
    const hex = (length: number) =>
        Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16))
            .join('')
            .padEnd(length, '0')
    // Time-ordered UUID v7-shaped identifier for test fixtures.
    return `${hex(8)}-${hex(4)}-7${hex(3)}-8${hex(3)}-${hex(12)}`
}

const isUniqueViolation = (error: unknown): boolean =>
    Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505')

describeIntegration('application alias PostgreSQL invariants (requires PostgreSQL)', () => {
    let knex: Knex
    let secondKnex: Knex
    const applicationId = createId()
    const otherApplicationId = createId()

    const insertAlias = (options: {
        applicationId: string
        alias: string
        isPrimary?: boolean
        releasedAt?: Date | null
        deleted?: boolean
    }) =>
        knex.raw(
            `
            INSERT INTO applications.obj_application_aliases (application_id, alias, is_primary, released_at, _upl_deleted, _app_deleted)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
            `,
            [
                options.applicationId,
                options.alias,
                options.isPrimary === true,
                options.releasedAt ?? null,
                options.deleted === true,
                options.deleted === true
            ]
        )

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 4 }
        })
        secondKnex = knexModule.default({
            client: 'pg',
            connection: DATABASE_TEST_URL,
            pool: { min: 1, max: 2 }
        })

        for (const id of [applicationId, otherApplicationId]) {
            await knex.raw(`INSERT INTO applications.obj_applications (id, name) VALUES (?, ?::jsonb)`, [
                id,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `alias-integration-${id}` } } })
            ])
        }
    })

    afterAll(async () => {
        if (knex) {
            await knex.raw(`DELETE FROM applications.obj_application_aliases WHERE application_id IN (?, ?)`, [
                applicationId,
                otherApplicationId
            ])
            await knex.raw(`DELETE FROM applications.obj_applications WHERE id IN (?, ?)`, [applicationId, otherApplicationId])
            await knex.destroy()
        }
        if (secondKnex) await secondKnex.destroy()
    })

    it('rejects a duplicate active alias globally across applications', async () => {
        const alias = `integration-dup-${Date.now().toString(36)}`
        await insertAlias({ applicationId, alias })

        await expect(insertAlias({ applicationId: otherApplicationId, alias })).rejects.toMatchObject({ code: '23505' })
    })

    it('keeps an unreleased name reserved while soft-deleted and reclaims it only after release', async () => {
        const alias = `integration-reserved-${Date.now().toString(36)}`
        await insertAlias({ applicationId, alias, deleted: true })

        // A soft-deleted but unreleased alias still reserves the name.
        await expect(insertAlias({ applicationId: otherApplicationId, alias })).rejects.toMatchObject({ code: '23505' })

        await knex.raw(
            `
            UPDATE applications.obj_application_aliases
            SET released_at = now()
            WHERE application_id = ? AND alias = ?
            `,
            [applicationId, alias]
        )

        // After an explicit release the name becomes claimable.
        await expect(insertAlias({ applicationId: otherApplicationId, alias })).resolves.toBeDefined()
    })

    it('rejects reserved, UUID-shaped and malformed aliases at the database level', async () => {
        await expect(insertAlias({ applicationId, alias: 'admin' })).rejects.toMatchObject({ code: '23514' })
        await expect(insertAlias({ applicationId, alias: '019ccefc-2f7b-7b36-82f4-85cdb1312272' })).rejects.toMatchObject({
            code: '23514'
        })
        await expect(insertAlias({ applicationId, alias: 'Upper-Case' })).rejects.toMatchObject({ code: '23514' })
    })

    it('allows at most one active primary alias per application', async () => {
        await knex.raw(`UPDATE applications.obj_application_aliases SET is_primary = false WHERE application_id = ?`, [applicationId])
        await insertAlias({ applicationId, alias: `integration-primary-a-${Date.now().toString(36)}`, isPrimary: true })

        await expect(
            insertAlias({ applicationId, alias: `integration-primary-b-${Date.now().toString(36)}`, isPrimary: true })
        ).rejects.toMatchObject({ code: '23505' })
    })

    it('never lets a released alias remain primary', async () => {
        await knex.raw(`UPDATE applications.obj_application_aliases SET is_primary = false WHERE application_id = ?`, [applicationId])
        const primaryAlias = `integration-released-${Date.now().toString(36)}`
        const inserted = await insertAlias({ applicationId, alias: primaryAlias, isPrimary: true })
        const aliasId = inserted.rows[0]?.id as string

        await expect(
            knex.raw(`UPDATE applications.obj_application_aliases SET released_at = now(), is_primary = true WHERE id = ?`, [aliasId])
        ).rejects.toMatchObject({ code: expect.stringMatching(/^235(05|14)$/) })
    })

    it('prevents hard-deleting an application that still owns aliases', async () => {
        await expect(knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])).rejects.toMatchObject({
            code: '23503'
        })
    })

    it('arbitrates concurrent claims through the unique index', async () => {
        const alias = `integration-race-${Date.now().toString(36)}`
        const insert = (connection: Knex) =>
            connection.raw(
                `
                INSERT INTO applications.obj_application_aliases (application_id, alias)
                VALUES (?, ?)
                RETURNING id
                `,
                [otherApplicationId, alias]
            )

        const results = await Promise.allSettled([insert(knex), insert(secondKnex)])
        const fulfilled = results.filter((result) => result.status === 'fulfilled')
        const rejected = results.filter((result) => result.status === 'rejected')

        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(isUniqueViolation((rejected[0] as PromiseRejectedResult).reason)).toBe(true)
    })

    it('arbitrates concurrent competing primary changes through the partial index', async () => {
        const unique = Date.now().toString(36)
        const firstAlias = `integration-race-primary-a-${unique}`
        const secondAlias = `integration-race-primary-b-${unique}`
        await insertAlias({ applicationId: otherApplicationId, alias: firstAlias })
        await insertAlias({ applicationId: otherApplicationId, alias: secondAlias })

        const promote = (connection: Knex, alias: string) =>
            connection.raw(
                `
                UPDATE applications.obj_application_aliases
                SET is_primary = true
                WHERE application_id = ? AND alias = ?
                RETURNING id
                `,
                [otherApplicationId, alias]
            )

        const results = await Promise.allSettled([promote(knex, firstAlias), promote(secondKnex, secondAlias)])
        const fulfilled = results.filter((result) => result.status === 'fulfilled')
        const rejected = results.filter((result) => result.status === 'rejected')

        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(isUniqueViolation((rejected[0] as PromiseRejectedResult).reason)).toBe(true)
    })
})
