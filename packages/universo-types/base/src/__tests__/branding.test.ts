import { describe, expect, it } from 'vitest'

import { brand } from '../common/branding'
import { UpIntentType } from '../common/enums'
import { UP_PROTOCOL_VERSION } from '../protocol/version'

describe('Universo Platformo types', () => {
  it('keeps brand helper as a transparent identity at runtime', () => {
    const branded = brand<'entity', 'EntityId'>('entity-42')
    expect(branded).toBe('entity-42')
  })

  it('exposes canonical intent constants used by networking DTOs', () => {
    const intents = Object.values(UpIntentType)
    expect(intents).toContain('use_module')
    expect(new Set(intents).size).toBe(intents.length)
  })

  it('locks protocol version to a semantic version string', () => {
    expect(UP_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/)
  })
})
