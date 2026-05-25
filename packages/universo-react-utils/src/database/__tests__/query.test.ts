import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { queryMany, queryOne, queryOneOrThrow, executeCount, NotFoundError } from '../query'
import type { SqlQueryable } from '../manager'

function mockDb(rows: unknown[]): SqlQueryable {
    return { query: vi.fn().mockResolvedValue(rows) }
}

describe('queryMany', () => {
    it('returns typed array from db', async () => {
        const db = mockDb([{ id: 1 }, { id: 2 }])
        const result = await queryMany<{ id: number }>(db, 'SELECT * FROM t')
        expect(result).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('passes params to db.query', async () => {
        const db = mockDb([])
        await queryMany(db, 'SELECT * FROM t WHERE id = $1', [42])
        expect(db.query).toHaveBeenCalledWith('SELECT * FROM t WHERE id = $1', [42])
    })

    it('validates rows with Zod schema', async () => {
        const schema = z.object({ id: z.number(), name: z.string() })
        const db = mockDb([{ id: 1, name: 'Alice' }])
        const result = await queryMany(db, 'SELECT 1', [], schema)
        expect(result).toEqual([{ id: 1, name: 'Alice' }])
    })

    it('throws on Zod validation failure', async () => {
        const schema = z.object({ id: z.number() })
        const db = mockDb([{ id: 'not-a-number' }])
        await expect(queryMany(db, 'SELECT 1', [], schema)).rejects.toThrow()
    })
})

describe('queryOne', () => {
    it('returns first row', async () => {
        const db = mockDb([{ id: 1 }, { id: 2 }])
        const result = await queryOne<{ id: number }>(db, 'SELECT 1')
        expect(result).toEqual({ id: 1 })
    })

    it('returns null when empty', async () => {
        const db = mockDb([])
        const result = await queryOne(db, 'SELECT 1')
        expect(result).toBeNull()
    })
})

describe('queryOneOrThrow', () => {
    it('returns row when found', async () => {
        const db = mockDb([{ id: 1 }])
        const result = await queryOneOrThrow<{ id: number }>(db, 'SELECT 1')
        expect(result).toEqual({ id: 1 })
    })

    it('throws NotFoundError when row not found', async () => {
        const db = mockDb([])
        await expect(queryOneOrThrow(db, 'SELECT 1')).rejects.toThrow(NotFoundError)
        await expect(queryOneOrThrow(db, 'SELECT 1')).rejects.toThrow('Not found')
    })

    it('throws custom message', async () => {
        const db = mockDb([])
        await expect(queryOneOrThrow(db, 'SELECT 1', [], undefined, 'Entity missing')).rejects.toThrow('Entity missing')
    })

    it('throws custom error from factory', async () => {
        const db = mockDb([])
        const customError = new Error('Custom 404')
        await expect(queryOneOrThrow(db, 'SELECT 1', [], undefined, () => customError)).rejects.toBe(customError)
    })

    it('validates row with Zod schema', async () => {
        const schema = z.object({ id: z.number() })
        const db = mockDb([{ id: 'string' }])
        await expect(queryOneOrThrow(db, 'SELECT 1', [], schema)).rejects.toThrow()
    })
})

describe('executeCount', () => {
    it('returns count of affected rows', async () => {
        const db = mockDb([{ id: 1 }, { id: 2 }, { id: 3 }])
        const count = await executeCount(db, 'DELETE FROM t WHERE x > 0 RETURNING id')
        expect(count).toBe(3)
    })

    it('returns 0 when no rows affected', async () => {
        const db = mockDb([])
        const count = await executeCount(db, 'DELETE FROM t WHERE false RETURNING id')
        expect(count).toBe(0)
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 7.2 — Result normalization regression tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('result normalization regression', () => {
    it('queryMany always returns T[] — never raw object', async () => {
        const db = mockDb([{ id: 1 }])
        const result = await queryMany<{ id: number }>(db, 'SELECT 1')
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(1)
    })

    it('queryMany returns empty array — never undefined/null', async () => {
        const db = mockDb([])
        const result = await queryMany<{ id: number }>(db, 'SELECT 1')
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(0)
    })

    it('queryOne returns T | null — never raw wrapper or undefined', async () => {
        const db = mockDb([{ id: 1 }])
        const result = await queryOne<{ id: number }>(db, 'SELECT 1')
        expect(result).not.toBeUndefined()
        expect(result).toEqual({ id: 1 })
    })

    it('queryOne returns null for empty result — not undefined', async () => {
        const db = mockDb([])
        const result = await queryOne<{ id: number }>(db, 'SELECT 1')
        expect(result).toBeNull()
        expect(result).not.toBeUndefined()
    })

    it('queryOneOrThrow always returns T — never null/undefined', async () => {
        const db = mockDb([{ id: 1 }])
        const result = await queryOneOrThrow<{ id: number }>(db, 'SELECT 1')
        expect(result).toBeDefined()
        expect(result).not.toBeNull()
        expect(result).toEqual({ id: 1 })
    })

    it('executeCount always returns number — never NaN or undefined', async () => {
        const db = mockDb([])
        const count = await executeCount(db, 'DELETE FROM t RETURNING id')
        expect(typeof count).toBe('number')
        expect(Number.isNaN(count)).toBe(false)
    })

    it('Zod validation rejects malformed rows in queryMany', async () => {
        const schema = z.object({ id: z.number(), name: z.string() })
        const db = mockDb([{ id: 'not-a-number', name: 123 }])
        await expect(queryMany(db, 'SELECT 1', [], schema)).rejects.toThrow()
    })

    it('Zod validation rejects malformed rows in queryOneOrThrow', async () => {
        const schema = z.object({ id: z.string().uuid() })
        const db = mockDb([{ id: 'not-uuid' }])
        await expect(queryOneOrThrow(db, 'SELECT 1', [], schema)).rejects.toThrow()
    })
})
