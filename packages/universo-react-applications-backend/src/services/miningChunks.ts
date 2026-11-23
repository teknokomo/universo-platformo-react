/**
 * Pure mining chunk computation (mining TZ DOC-2026-006 §9.3) — no DB imports,
 * injectable RNG so tests assert ranges/sums/unevenness instead of fixed
 * masses. Guarantees:
 *
 * - 1..ChunksPerHitMax chunks, each mass in [ChunkMassMinKg, ChunkMassMaxKg]
 *   (per-asteroid bounds override the constants when authored), skewed toward
 *   smaller masses via the `base ^ (1/ChunkMassSkew)` exponent;
 * - every mass rounded to 0.1 kg; the returned `totalKg` equals the sum of the
 *   KEPT chunks and becomes `Operation.Quantity` and the remainder delta;
 * - when the raw total exceeds the asteroid remainder, masses are scaled down
 *   proportionally and the last chunk is clamped so `sum == remaining` exactly
 *   (TZ: the final chunk equals the remainder when it is below the min mass);
 * - capacity rejection happens BEFORE any Operation is created (FR-016/FR-017);
 * - `total < 0.1` (including an all-zero rounding outcome) depletes the shot
 *   rather than minting an empty operation.
 */

export interface MiningChunkBounds {
    chunksPerHitMin: number
    chunksPerHitMax: number
    chunkMassMinKg: number
    chunkMassMaxKg: number
    chunkMassSkew: number
}

export interface MiningChunk {
    id: string
    massKg: number
    scale: number
}

export type MiningChunkResult = { ok: true; chunks: MiningChunk[]; totalKg: number } | { ok: false; reason: 'depleted' | 'capacity' }

const roundToTenth = (value: number): number => Math.round(value * 10) / 10

const randomIntInclusive = (random: () => number, min: number, max: number): number => {
    const low = Math.ceil(min)
    const high = Math.floor(max)
    if (high <= low) return low
    return low + Math.floor(random() * (high - low + 1))
}

/** Chunk visuals scale with mass (TZ §11.3 example), capped away from full asteroid size. */
const chunkVisualScale = (massKg: number): number => Math.min(0.9, 0.35 + 0.18 * massKg)

/**
 * Proportionally scales the masses down to `targetKg` (re-rounded) and clamps
 * the last kept chunk so the sum equals `targetKg` exactly; zero-mass rounding
 * outcomes are dropped, and a fully-collapsed set collapses to a single chunk
 * of the remainder.
 */
const scaleDownToRemainder = (masses: number[], targetKg: number): number[] => {
    const rawTotal = masses.reduce((sum, mass) => sum + mass, 0)
    if (!(rawTotal > 0)) return [roundToTenth(targetKg)]
    const scaled = masses.map((mass) => roundToTenth(mass * (targetKg / rawTotal))).filter((mass) => mass > 0)
    if (scaled.length === 0) return [roundToTenth(targetKg)]
    const scaledSum = roundToTenth(scaled.reduce((sum, mass) => sum + mass, 0))
    const diff = roundToTenth(targetKg - scaledSum)
    const lastIndex = scaled.length - 1
    scaled[lastIndex] = roundToTenth(scaled[lastIndex] + diff)
    if (scaled[lastIndex] <= 0) {
        scaled.pop()
        if (scaled.length === 0) return [roundToTenth(targetKg)]
        const redistributedSum = roundToTenth(scaled.reduce((sum, mass) => sum + mass, 0))
        scaled[scaled.length - 1] = roundToTenth(targetKg - redistributedSum + scaled[scaled.length - 1])
    }
    return scaled
}

export function computeMiningChunks(
    random: () => number,
    bounds: MiningChunkBounds,
    remainingKg: number,
    capacityLeftKg: number
): MiningChunkResult {
    if (!(remainingKg > 0)) return { ok: false, reason: 'depleted' }
    if (!(capacityLeftKg > 0)) return { ok: false, reason: 'capacity' }

    const count = randomIntInclusive(random, bounds.chunksPerHitMin, bounds.chunksPerHitMax)
    const rawMasses = Array.from({ length: count }, () => {
        const base = bounds.chunkMassMinKg + random() * (bounds.chunkMassMaxKg - bounds.chunkMassMinKg)
        // TZ §9.3 skew: `base ^ (1/skew)` — a skew > 1 shifts the distribution
        // toward smaller masses, never below the configured mass floor.
        const skewed = Math.pow(Math.max(base, bounds.chunkMassMinKg), 1 / Math.max(bounds.chunkMassSkew, 1))
        return roundToTenth(Math.min(Math.max(skewed, bounds.chunkMassMinKg), bounds.chunkMassMaxKg))
    })

    let masses = rawMasses.filter((mass) => mass > 0)
    if (masses.length === 0) return { ok: false, reason: 'depleted' }

    let total = roundToTenth(masses.reduce((sum, mass) => sum + mass, 0))
    if (total > remainingKg) {
        masses = scaleDownToRemainder(masses, remainingKg)
        total = roundToTenth(masses.reduce((sum, mass) => sum + mass, 0))
    }
    // Sub-0.1 remainders cannot be honored under the 0.1 kg rounding: the
    // clamped total would exceed the asteroid remainder, so the shot depletes
    // instead of over-minting (TZ §9.3 `total < 0.1 → MINING_DEPLETED` + the
    // "last chunk equals the remainder" invariant).
    if (total < 0.1 || total > remainingKg + 1e-9) return { ok: false, reason: 'depleted' }
    if (total > capacityLeftKg) return { ok: false, reason: 'capacity' } // BEFORE any Operation (FR-016/FR-017)

    const chunks = masses.map((massKg, index) => ({ id: `chunk-${index + 1}`, massKg, scale: chunkVisualScale(massKg) }))
    return { ok: true, chunks, totalKg: total }
}
