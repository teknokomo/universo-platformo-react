import { createEconomyIdempotencyMigrationDefinition } from '../../platform/migrations'

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim()

describe('economy idempotency migration', () => {
    const upSql = normalizeSql(createEconomyIdempotencyMigrationDefinition.up.map(({ sql }) => sql).join('\n'))

    it('uses a schema-qualified platform table with a UUIDv7 persisted identifier and scope-bound unique key', () => {
        expect(createEconomyIdempotencyMigrationDefinition.id).toBe('CreateEconomyIdempotency1800000000370')
        expect(upSql).toContain('CREATE TABLE IF NOT EXISTS applications.obj_economy_idempotency')
        expect(upSql).toContain('id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7()')
        expect(upSql).toContain('UNIQUE (application_id, user_id, key_hash)')
        expect(upSql).toContain('expires_at TIMESTAMPTZ NOT NULL')
        expect(upSql).toContain('economy_idempotency_expires_at_idx ON applications.obj_economy_idempotency (expires_at)')
        expect(upSql).toContain('REFERENCES applications.obj_applications(id) ON DELETE CASCADE')
        expect(upSql).toContain('economy_idempotency_id_uuid_v7_ck')
    })

    it('constrains the key digest format and the stored response status code range', () => {
        expect(upSql).toContain("key_hash ~ '^[a-f0-9]{64}$'")
        expect(upSql).toContain('status_code BETWEEN 200 AND 599')
        expect(upSql).toContain('body_fingerprint TEXT NOT NULL')
        expect(upSql).toContain('response JSONB NOT NULL')
        expect(upSql).not.toContain('idempotency_key VARCHAR')
    })

    it('keeps the table private to service_role through RLS and explicit grants', () => {
        expect(upSql).toContain('ALTER TABLE applications.obj_economy_idempotency ENABLE ROW LEVEL SECURITY')
        expect(upSql).toContain('REVOKE ALL ON TABLE applications.obj_economy_idempotency FROM PUBLIC, anon, authenticated')
        expect(upSql).toContain('GRANT ALL ON TABLE applications.obj_economy_idempotency TO service_role')
    })

    it('drops the idempotency table on migration rollback', () => {
        expect(normalizeSql(createEconomyIdempotencyMigrationDefinition.down.map(({ sql }) => sql).join('\n'))).toContain(
            'DROP TABLE IF EXISTS applications.obj_economy_idempotency'
        )
    })
})
