import { createGuestSessionIdempotencyMigrationDefinition } from '../../platform/migrations'

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim()

describe('guest-session idempotency migration', () => {
    const upSql = normalizeSql(createGuestSessionIdempotencyMigrationDefinition.up.map(({ sql }) => sql).join('\n'))

    it('uses a schema-qualified platform table with a UUIDv7 persisted identifier and unique hashed key', () => {
        expect(createGuestSessionIdempotencyMigrationDefinition.id).toBe('CreateGuestSessionIdempotency1800000000300')
        expect(upSql).toContain('CREATE TABLE IF NOT EXISTS applications.obj_guest_session_idempotency')
        expect(upSql).toContain('id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7()')
        expect(upSql).toContain('idempotency_key_hash VARCHAR(64) NOT NULL UNIQUE')
        expect(upSql).toContain('expires_at TIMESTAMPTZ NOT NULL')
        expect(upSql).toContain('guest_session_idempotency_expires_at_idx ON applications.obj_guest_session_idempotency (expires_at)')
        expect(upSql).toContain('REFERENCES applications.obj_applications(id) ON DELETE CASCADE')
        expect(upSql).toContain('guest_session_idempotency_id_uuid_v7_ck')
    })

    it('constrains key and payload digests and authenticated-encryption fields', () => {
        expect(upSql).toContain("idempotency_key_hash ~ '^[a-f0-9]{64}$'")
        expect(upSql).toContain("payload_hash ~ '^[a-f0-9]{64}$'")
        expect(upSql).toContain('octet_length(secret_nonce) = 12')
        expect(upSql).toContain('octet_length(secret_ciphertext) > 0')
        expect(upSql).toContain('octet_length(secret_auth_tag) = 16')
        expect(upSql).not.toContain('idempotency_key VARCHAR')
    })

    it('keeps the table private to service_role through RLS and explicit grants', () => {
        expect(upSql).toContain('ALTER TABLE applications.obj_guest_session_idempotency ENABLE ROW LEVEL SECURITY')
        expect(upSql).toContain('REVOKE ALL ON TABLE applications.obj_guest_session_idempotency FROM PUBLIC, anon, authenticated')
        expect(upSql).toContain('GRANT ALL ON TABLE applications.obj_guest_session_idempotency TO service_role')
    })

    it('drops the idempotency table on migration rollback', () => {
        expect(normalizeSql(createGuestSessionIdempotencyMigrationDefinition.down.map(({ sql }) => sql).join('\n'))).toContain(
            'DROP TABLE IF EXISTS applications.obj_guest_session_idempotency'
        )
    })
})
