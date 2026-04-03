import { createHash } from 'node:crypto'
import type { MetahubSnapshotTransportEnvelope } from '@universo/types'
import { MetahubSnapshotTransportEnvelopeSchema, SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'
import { normalizePublicationSnapshotForHash } from '../serialization'
import type { PublicationSnapshotHashInput } from '../serialization'
import { stableStringify } from '../serialization'

type SnapshotTransportPayload = MetahubSnapshotTransportEnvelope['snapshot']

/** Dangerous keys that could enable prototype pollution */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Recursively sanitize an object by removing keys that could cause prototype pollution.
 * Must be applied before Zod parsing since Zod does not strip __proto__ keys.
 */
function sanitizeKeys(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(sanitizeKeys)
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !DANGEROUS_KEYS.has(key))
      .map(([key, val]) => [key, sanitizeKeys(val)])
  )
}

/**
 * Check maximum nesting depth of a JSON value.
 * Prevents stack overflow from deeply nested structures (DoS protection).
 */
function checkNestingDepth(value: unknown, maxDepth: number, currentDepth = 0): void {
  if (currentDepth > maxDepth) {
    throw new Error(`JSON nesting depth exceeds maximum of ${maxDepth}`)
  }
  if (typeof value !== 'object' || value === null) return
  if (Array.isArray(value)) {
    for (const item of value) {
      checkNestingDepth(item, maxDepth, currentDepth + 1)
    }
  } else {
    for (const val of Object.values(value)) {
      checkNestingDepth(val, maxDepth, currentDepth + 1)
    }
  }
}

/**
 * Compute deterministic SHA-256 hash of a snapshot.
 * Uses the SAME normalization as SnapshotSerializer.calculateHash() to ensure
 * hash compatibility between export and the existing publication pipeline.
 */
export function computeSnapshotHash(snapshot: Record<string, unknown>): string {
  const normalized = normalizePublicationSnapshotForHash(
    snapshot as PublicationSnapshotHashInput
  )
  const canonical = stableStringify(normalized)
  return createHash('sha256').update(canonical).digest('hex')
}

export function buildSnapshotEnvelope(params: {
  snapshot: SnapshotTransportPayload
  metahub: MetahubSnapshotTransportEnvelope['metahub']
  publication?: MetahubSnapshotTransportEnvelope['publication']
  sourceInstance?: string
}): MetahubSnapshotTransportEnvelope {
  const snapshotHash = computeSnapshotHash(params.snapshot)
  return {
    kind: 'metahub_snapshot_bundle',
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceInstance: params.sourceInstance,
    metahub: params.metahub,
    publication: params.publication,
    snapshot: params.snapshot,
    snapshotHash,
  }
}

/**
 * Validate an imported envelope — throws ZodError on invalid input.
 *
 * Security layers (defense-in-depth):
 * 1. Nesting depth check (DoS protection)
 * 2. Prototype pollution sanitization
 * 3. Zod structural validation (type + shape)
 * 4. Integrity check (SHA-256 hash verification)
 * 5. Entity count limit check
 */
export function validateSnapshotEnvelope(
  raw: unknown,
): MetahubSnapshotTransportEnvelope {
  // 0. Type guard
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Expected a JSON object')
  }

  // 1. Nesting depth check (before deep traversal)
  checkNestingDepth(raw, SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_JSON_NESTING_DEPTH)

  // 2. Prototype pollution sanitization
  const sanitized = sanitizeKeys(raw)

  // 3. Structural validation through Zod
  const envelope = MetahubSnapshotTransportEnvelopeSchema.parse(sanitized)

  // 4. Integrity check (not expressible in Zod)
  const expectedHash = computeSnapshotHash(envelope.snapshot as Record<string, unknown>)
  if (envelope.snapshotHash !== expectedHash) {
    throw new Error('Snapshot integrity check failed: hash mismatch')
  }

  // 5. Entity count limits
  const entities = (envelope.snapshot as Record<string, unknown>).entities
  if (entities && typeof entities === 'object') {
    const entityCount = Object.keys(entities).length
    if (entityCount > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES) {
      throw new Error(`Too many entities: ${entityCount} > ${SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES}`)
    }

    // 6. Per-entity field and element count limits
    for (const [entityId, entityRaw] of Object.entries(entities)) {
      if (typeof entityRaw !== 'object' || entityRaw === null) continue
      const entity = entityRaw as Record<string, unknown>

      if (Array.isArray(entity.fields)) {
        if (entity.fields.length > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_FIELDS_PER_ENTITY) {
          throw new Error(
            `Entity "${entityId}" has too many fields: ${entity.fields.length} > ${SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_FIELDS_PER_ENTITY}`
          )
        }
      }
    }

    const elements = (envelope.snapshot as Record<string, unknown>).elements
    if (elements && typeof elements === 'object') {
      for (const [entityId, elementsRaw] of Object.entries(elements)) {
        if (!Array.isArray(elementsRaw)) continue
        if (elementsRaw.length > SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ELEMENTS_PER_ENTITY) {
          throw new Error(
            `Entity "${entityId}" has too many elements: ${elementsRaw.length} > ${SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ELEMENTS_PER_ENTITY}`
          )
        }
      }
    }
  }

  return envelope
}
