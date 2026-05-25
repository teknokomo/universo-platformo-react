import { convertPgBindings } from '../pgBindings'

describe('convertPgBindings', () => {
    it('converts single $1 to ?', () => {
        const result = convertPgBindings('SELECT $1 AS val', ['abc'])
        expect(result).toEqual({ sql: 'SELECT ? AS val', bindings: ['abc'] })
    })

    it('converts multiple parameters $1, $2, $3', () => {
        const result = convertPgBindings('INSERT INTO t (a, b, c) VALUES ($1, $2, $3)', ['a', 'b', 'c'])
        expect(result).toEqual({
            sql: 'INSERT INTO t (a, b, c) VALUES (?, ?, ?)',
            bindings: ['a', 'b', 'c']
        })
    })

    it('handles repeated parameters ($3, $3 → duplicated bindings)', () => {
        const result = convertPgBindings('INSERT INTO t (a, b, c, c_copy) VALUES ($1, $2, $3, $3)', ['a', 'b', 'c'])
        expect(result).toEqual({
            sql: 'INSERT INTO t (a, b, c, c_copy) VALUES (?, ?, ?, ?)',
            bindings: ['a', 'b', 'c', 'c']
        })
    })

    it('preserves casts ($1::text → ?::text)', () => {
        const result = convertPgBindings("SELECT set_config('x', $1::text, false)", ['val'])
        expect(result).toEqual({
            sql: "SELECT set_config('x', ?::text, false)",
            bindings: ['val']
        })
    })

    it('preserves cast with ::uuid', () => {
        const result = convertPgBindings('SELECT * FROM t WHERE id = $1::uuid', ['abc-123'])
        expect(result).toEqual({
            sql: 'SELECT * FROM t WHERE id = ?::uuid',
            bindings: ['abc-123']
        })
    })

    it('handles mixed order and repeated refs ($1 AND $2 OR $1 → 3 bindings from 2 params)', () => {
        const result = convertPgBindings('SELECT * FROM t WHERE a = $1 AND b = $2 OR c = $1', ['x', 'y'])
        expect(result).toEqual({
            sql: 'SELECT * FROM t WHERE a = ? AND b = ? OR c = ?',
            bindings: ['x', 'y', 'x']
        })
    })

    it('passes through SQL without $N placeholders with no params', () => {
        const result = convertPgBindings('SELECT 1')
        expect(result).toEqual({ sql: 'SELECT 1', bindings: [] })
    })

    it('passes through SQL without $N placeholders with undefined params', () => {
        const result = convertPgBindings('SELECT 1', undefined)
        expect(result).toEqual({ sql: 'SELECT 1', bindings: [] })
    })

    it('passes through SQL without $N placeholders with empty params', () => {
        const result = convertPgBindings('SELECT 1', [])
        expect(result).toEqual({ sql: 'SELECT 1', bindings: [] })
    })

    it('passes through pure ? SQL with params unchanged', () => {
        const result = convertPgBindings('SELECT pg_try_advisory_xact_lock(?)', [12345])
        expect(result).toEqual({
            sql: 'SELECT pg_try_advisory_xact_lock(?)',
            bindings: [12345]
        })
    })

    it('throws on out-of-range parameter $5 with 1 param', () => {
        expect(() => convertPgBindings('SELECT $5', ['only-one'])).toThrow('Binding $5 references index 4 but only 1 params provided')
    })

    it('throws on $0 (zero-indexed)', () => {
        expect(() => convertPgBindings('SELECT $0', ['a'])).toThrow('Binding $0 references index -1 but only 1 params provided')
    })

    it('throws on mixed ?/$N placeholders', () => {
        expect(() => convertPgBindings('SELECT ? FROM t WHERE id = $1', ['a', 'b'])).toThrow('Mixed ?/$N placeholders')
    })

    it('handles empty SQL string with no params', () => {
        const result = convertPgBindings('')
        expect(result).toEqual({ sql: '', bindings: [] })
    })

    it('handles large parameter index ($10)', () => {
        const params = Array.from({ length: 10 }, (_, i) => `v${i + 1}`)
        const result = convertPgBindings('SELECT $10, $1', params)
        expect(result).toEqual({
            sql: 'SELECT ?, ?',
            bindings: ['v10', 'v1']
        })
    })

    it('handles null and undefined values in params', () => {
        const result = convertPgBindings('INSERT INTO t (a, b) VALUES ($1, $2)', [null, undefined])
        expect(result).toEqual({
            sql: 'INSERT INTO t (a, b) VALUES (?, ?)',
            bindings: [null, undefined]
        })
    })

    it('handles numeric and boolean values in params', () => {
        const result = convertPgBindings('INSERT INTO t (a, b) VALUES ($1, $2)', [42, true])
        expect(result).toEqual({
            sql: 'INSERT INTO t (a, b) VALUES (?, ?)',
            bindings: [42, true]
        })
    })

    it('keeps SQL injection payloads in bindings instead of interpolating them into SQL', () => {
        const payload = "'; DROP TABLE users; --"
        const result = convertPgBindings('SELECT * FROM auth.users WHERE email = $1 AND tenant_id = $2', [payload, 'tenant-1'])

        expect(result).toEqual({
            sql: 'SELECT * FROM auth.users WHERE email = ? AND tenant_id = ?',
            bindings: [payload, 'tenant-1']
        })
        expect(result.sql).not.toContain(payload)
    })
})
