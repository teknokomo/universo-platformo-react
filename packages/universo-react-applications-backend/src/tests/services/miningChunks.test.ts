/**
 * Unit tests for the pure mining chunk computation (mining TZ §9.3, plan B1).
 * The RNG is injected, so tests assert ranges, sums and unevenness — never
 * fixed masses (TZ §9.3: "не фиксировать конкретные массы").
 */
import { computeMiningChunks } from '../../services/miningChunks'

const BASE_BOUNDS = {
    chunksPerHitMin: 1,
    chunksPerHitMax: 3,
    chunkMassMinKg: 0.8,
    chunkMassMaxKg: 3.2,
    chunkMassSkew: 1.6
}

/** Deterministic RNG cycling through a fixed byte sequence. */
const sequenceRandom = (values: number[]) => {
    let index = 0
    return () => {
        const value = values[index % values.length]
        index += 1
        return value
    }
}

describe('computeMiningChunks (mining TZ §9.3)', () => {
    it('returns 1–3 chunks with masses inside the authored bounds and a matching total', () => {
        for (let seed = 0; seed < 200; seed += 1) {
            let state = (seed * 2654435761) % 4294967296
            const random = () => {
                state = (state * 1103515245 + 12345) % 2147483648
                return state / 2147483648
            }
            const result = computeMiningChunks(random, BASE_BOUNDS, 120, 40)
            expect(result.ok).toBe(true)
            if (!result.ok) continue
            expect(result.chunks.length).toBeGreaterThanOrEqual(1)
            expect(result.chunks.length).toBeLessThanOrEqual(3)
            for (const chunk of result.chunks) {
                expect(chunk.massKg).toBeGreaterThanOrEqual(0.8)
                expect(chunk.massKg).toBeLessThanOrEqual(3.2)
                // rounded to 0.1 kg — compare via the scaled integer to dodge
                // float-modulo error (2.1 % 0.1 ≈ 0.0999 in IEEE 754)
                expect(Math.abs(chunk.massKg * 10 - Math.round(chunk.massKg * 10))).toBeLessThan(1e-9)
                expect(chunk.scale).toBeGreaterThan(0)
                expect(chunk.scale).toBeLessThanOrEqual(0.9)
            }
            const sum = Math.round(result.chunks.reduce((acc, chunk) => acc + chunk.massKg, 0) * 10) / 10
            expect(result.totalKg).toBeCloseTo(sum, 5)
        }
    })

    it('produces at least two distinct masses across a shot series (uneven growth, TZ §14.3)', () => {
        const masses = new Set<number>()
        for (let seed = 0; seed < 50; seed += 1) {
            let state = (seed * 48271) % 2147483647
            const random = () => {
                state = (state * 48271) % 2147483647
                return state / 2147483647
            }
            const result = computeMiningChunks(random, BASE_BOUNDS, 500, 500)
            if (result.ok) for (const chunk of result.chunks) masses.add(chunk.massKg)
        }
        expect(masses.size).toBeGreaterThanOrEqual(2)
    })

    it('depletes on zero remainder and rejects when the cargo is already full (before any operation)', () => {
        expect(computeMiningChunks(() => 0.5, BASE_BOUNDS, 0, 40)).toEqual({ ok: false, reason: 'depleted' })
        expect(computeMiningChunks(() => 0.5, BASE_BOUNDS, 120, 0)).toEqual({ ok: false, reason: 'capacity' })
    })

    it('clamps the total to the remainder and makes the last chunk equal what is left', () => {
        // Small remainder: the raw draw is larger, so the result must scale down
        // to the remainder exactly and stay ≥ 0.1 kg.
        const tiny = computeMiningChunks(() => 0.9, BASE_BOUNDS, 0.4, 40)
        expect(tiny.ok).toBe(true)
        if (tiny.ok) {
            expect(tiny.totalKg).toBeCloseTo(0.4, 5)
            const sum = Math.round(tiny.chunks.reduce((acc, chunk) => acc + chunk.massKg, 0) * 10) / 10
            expect(sum).toBeCloseTo(0.4, 5)
        }
    })

    it('depletes when the rounded masses collapse below 0.1 kg instead of minting an empty operation', () => {
        // Sub-0.1 asteroid remainders: the clamped total would exceed the
        // remainder (0.05 → 0.1), so every path must refuse — the all-zero
        // rounding hole + over-mint regression guard.
        const result = computeMiningChunks(sequenceRandom([0.01, 0.02, 0.01]), BASE_BOUNDS, 0.05, 40)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('depleted')
        expect(computeMiningChunks(() => 0.5, BASE_BOUNDS, 0.05, 40).ok).toBe(false)
    })

    it('rejects capacity when the drawn total exceeds the remaining cargo space', () => {
        const result = computeMiningChunks(sequenceRandom([0.9, 0.95, 0.9, 0.95, 0.9]), BASE_BOUNDS, 120, 1)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.reason).toBe('capacity')
    })

    it('honors per-asteroid chunk bounds over the global constants', () => {
        const bounds = { ...BASE_BOUNDS, chunkMassMinKg: 2, chunkMassMaxKg: 2.5 }
        const result = computeMiningChunks(sequenceRandom([0.1, 0.5, 0.9]), bounds, 120, 40)
        expect(result.ok).toBe(true)
        if (result.ok) {
            for (const chunk of result.chunks) {
                expect(chunk.massKg).toBeGreaterThanOrEqual(2)
                expect(chunk.massKg).toBeLessThanOrEqual(2.5)
            }
        }
    })
})
