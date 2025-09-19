import { describe, expect, it } from 'vitest'

import { SpaceNode } from '../SpaceNode'

describe('SpaceNode', () => {
  it('exposes lead collection toggles described in the README', () => {
    const node = new SpaceNode()

    const collectName = node.inputs.find((input) => input.name === 'collectLeadName')
    const collectEmail = node.inputs.find((input) => input.name === 'collectLeadEmail')
    const collectPhone = node.inputs.find((input) => input.name === 'collectLeadPhone')

    expect(collectName?.type).toBe('boolean')
    expect(collectEmail?.type).toBe('boolean')
    expect(collectPhone?.type).toBe('boolean')
    expect(collectName?.additionalParams).toBe(true)
  })

  it('maps connection ports for core UPDL nodes when converted to UPDL format', () => {
    const node = new SpaceNode()

    const updlNode = node.toUPDLNode({
      id: 'space-1',
      inputs: {},
      positionX: 0,
      positionY: 0,
    } as any)

    const portIds = updlNode.metadata?.inputs?.map((port: any) => port.id) ?? []

    expect(portIds).toContain('spaces')
    expect(portIds).toContain('data')
    expect(portIds).toContain('entities')
    expect(portIds).toContain('universo')
  })
})
