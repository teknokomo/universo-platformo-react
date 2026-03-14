import { convertPgBindings } from '../pgBindings'

/**
 * SQL compilation regression tests.
 * Validates that convertPgBindings correctly handles all SQL patterns
 * used across the codebase stores (metahubs, applications, admin, profile).
 *
 * These tests don't need a real database — they only verify the SQL/param
 * rewriting is safe, complete, and won't cause binding mismatches at runtime.
 */

describe('SQL compilation regression — representative store patterns', () => {
    describe('simple CRUD patterns', () => {
        it('SELECT with single parameter', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT m.id, m.name FROM metahubs.metahubs m WHERE m.id = $1', ['uuid-1'])
            expect(sql).toBe('SELECT m.id, m.name FROM metahubs.metahubs m WHERE m.id = ?')
            expect(params).toEqual(['uuid-1'])
        })

        it('INSERT with multiple parameters and RETURNING', () => {
            const { sql, bindings: params } = convertPgBindings(
                'INSERT INTO metahubs.metahubs (name, codename, is_public, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
                ['My Hub', 'my-hub', false, 'user-1']
            )
            expect(sql).toBe('INSERT INTO metahubs.metahubs (name, codename, is_public, user_id) VALUES (?, ?, ?, ?) RETURNING id')
            expect(params).toEqual(['My Hub', 'my-hub', false, 'user-1'])
        })

        it('UPDATE with SET and WHERE', () => {
            const { sql, bindings: params } = convertPgBindings(
                'UPDATE metahubs.metahubs SET name = $1, updated_at = NOW() WHERE id = $2 AND _upl_deleted IS NULL',
                ['New Name', 'uuid-1']
            )
            expect(sql).toBe('UPDATE metahubs.metahubs SET name = ?, updated_at = NOW() WHERE id = ? AND _upl_deleted IS NULL')
            expect(params).toEqual(['New Name', 'uuid-1'])
        })

        it('soft DELETE pattern', () => {
            const { sql, bindings: params } = convertPgBindings(
                'UPDATE metahubs.metahubs SET _upl_deleted = NOW(), _upl_deleted_by = $2 WHERE id = $1 AND _upl_deleted IS NULL',
                ['uuid-1', 'user-1']
            )
            expect(sql).toBe('UPDATE metahubs.metahubs SET _upl_deleted = NOW(), _upl_deleted_by = ? WHERE id = ? AND _upl_deleted IS NULL')
            expect(params).toEqual(['user-1', 'uuid-1'])
        })
    })

    describe('type cast patterns', () => {
        it('$N::text cast', () => {
            const { sql, bindings: params } = convertPgBindings("SELECT set_config('request.jwt.claims', $1::text, true)", [
                '{"sub":"user-1"}'
            ])
            expect(sql).toBe("SELECT set_config('request.jwt.claims', ?::text, true)")
            expect(params).toEqual(['{"sub":"user-1"}'])
        })

        it('$N::uuid cast', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT * FROM profiles WHERE user_id = $1::uuid', [
                '550e8400-e29b-41d4-a716-446655440000'
            ])
            expect(sql).toBe('SELECT * FROM profiles WHERE user_id = ?::uuid')
            expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000'])
        })

        it('$N::jsonb cast for settings', () => {
            const { sql, bindings: params } = convertPgBindings('UPDATE profiles SET settings = $1::jsonb WHERE user_id = $2', [
                '{"theme":"dark"}',
                'user-1'
            ])
            expect(sql).toBe('UPDATE profiles SET settings = ?::jsonb WHERE user_id = ?')
            expect(params).toEqual(['{"theme":"dark"}', 'user-1'])
        })
    })

    describe('complex JOIN and subquery patterns', () => {
        it('applications with JOIN on users', () => {
            const { sql, bindings: params } = convertPgBindings(
                `SELECT a.id, a.name 
                FROM applications.applications a
                LEFT JOIN applications.applications_users au ON a.id = au.application_id
                WHERE au.user_id = $1 AND a._upl_deleted IS NULL`,
                ['user-1']
            )
            expect(sql).toContain('WHERE au.user_id = ? AND')
            expect(params).toEqual(['user-1'])
        })

        it('connector-publication multi-table pattern', () => {
            const { sql, bindings: params } = convertPgBindings(
                `SELECT c.id, cp.publication_id
                FROM applications.connectors c
                JOIN applications.connectors_publications cp ON c.id = cp.connector_id
                WHERE c.application_id = $1 AND c.id = $2 AND c._upl_deleted IS NULL`,
                ['app-1', 'conn-1']
            )
            expect(sql).toContain('c.application_id = ? AND c.id = ?')
            expect(params).toEqual(['app-1', 'conn-1'])
        })

        it('repeated parameter reference ($1 used twice)', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT * FROM admin.roles WHERE created_by = $1 OR updated_by = $1', [
                'user-1'
            ])
            expect(sql).toBe('SELECT * FROM admin.roles WHERE created_by = ? OR updated_by = ?')
            expect(params).toEqual(['user-1', 'user-1'])
        })
    })

    describe('JSONB and VLC patterns', () => {
        it('JSONB containment query', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT * FROM metahubs.publications WHERE metadata @> $1::jsonb', [
                '{"status":"published"}'
            ])
            expect(sql).toBe('SELECT * FROM metahubs.publications WHERE metadata @> ?::jsonb')
            expect(params).toEqual(['{"status":"published"}'])
        })

        it('VLC name insert pattern', () => {
            const { sql, bindings: params } = convertPgBindings(
                `INSERT INTO applications.connectors (application_id, name, description, sort_order, _upl_created_by)
                VALUES ($1, $2::jsonb, $3::jsonb, $4, $5) RETURNING *`,
                ['app-1', '{"en":"Connector"}', null, 0, 'user-1']
            )
            expect(sql).toContain('VALUES (?, ?::jsonb, ?::jsonb, ?, ?)')
            expect(params).toEqual(['app-1', '{"en":"Connector"}', null, 0, 'user-1'])
        })
    })

    describe('passthrough patterns (? already used)', () => {
        it('already uses ? placeholders', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT * FROM profiles WHERE user_id = ?', ['user-1'])
            expect(sql).toBe('SELECT * FROM profiles WHERE user_id = ?')
            expect(params).toEqual(['user-1'])
        })

        it('no parameters', () => {
            const { sql, bindings: params } = convertPgBindings(
                'SELECT COUNT(*) AS count FROM metahubs.metahubs WHERE _upl_deleted IS NULL'
            )
            expect(sql).toBe('SELECT COUNT(*) AS count FROM metahubs.metahubs WHERE _upl_deleted IS NULL')
            expect(params).toEqual([])
        })
    })

    describe('edge cases from stores', () => {
        it('LIMIT/OFFSET with high parameter indices', () => {
            const { sql, bindings: params } = convertPgBindings(
                'SELECT * FROM metahubs.metahubs WHERE is_public = $1 AND _upl_deleted IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3',
                [true, 25, 50]
            )
            expect(sql).toBe(
                'SELECT * FROM metahubs.metahubs WHERE is_public = ? AND _upl_deleted IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?'
            )
            expect(params).toEqual([true, 25, 50])
        })

        it('CTE (WITH clause) pattern', () => {
            const { sql, bindings: params } = convertPgBindings(
                `WITH ranked AS (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY metahub_id ORDER BY version DESC) AS rn
                    FROM metahubs.publications_versions
                    WHERE metahub_id = $1
                )
                SELECT * FROM ranked WHERE rn = 1`,
                ['metahub-1']
            )
            expect(sql).toContain('WHERE metahub_id = ?')
            expect(params).toEqual(['metahub-1'])
        })

        it('advisory lock hash pattern', () => {
            const { sql, bindings: params } = convertPgBindings('SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0))', ['lock-key'])
            expect(sql).toBe('SELECT pg_try_advisory_xact_lock(hashtextextended(?, 0))')
            expect(params).toEqual(['lock-key'])
        })

        it('dollar-quoted function body not confused with $N', () => {
            const { sql, bindings: params } = convertPgBindings("SELECT set_config('request.jwt.claims', $1::text, true)", ['claims-json'])
            expect(params).toEqual(['claims-json'])
            expect(sql).not.toContain('$1')
        })
    })
})
