import { describe, expect, it } from 'vitest'

import type { INodeData } from '../../interfaces'
import type { UPDLNodePort } from '../../../interfaces/UPDLInterfaces'
import { SpaceNode } from '../SpaceNode'

const createNodeData = (overrides?: Partial<INodeData>): INodeData => ({
  id: 'space-1',
  inputs: {},
  positionX: 0,
  positionY: 0,
  ...overrides,
})

const isUPDLNodePort = (value: unknown): value is UPDLNodePort => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'id' in value && 'name' in value && 'type' in value
}

type MetadataWithInputs = { inputs?: unknown }

const hasInputs = (metadata: unknown): metadata is MetadataWithInputs =>
  typeof metadata === 'object' && metadata !== null && 'inputs' in metadata

const extractInputPorts = (metadata: unknown): UPDLNodePort[] => {
  if (!hasInputs(metadata)) {
    return []
  }

  const { inputs } = metadata

  if (!Array.isArray(inputs)) {
    return []
  }

  return inputs.filter(isUPDLNodePort)
}

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

    const updlNode = node.toUPDLNode(createNodeData())

    const portIds = extractInputPorts(updlNode.metadata).map((port) => port.id)

    expect(portIds).toContain('spaces')
    expect(portIds).toContain('data')
    expect(portIds).toContain('entities')
    expect(portIds).toContain('universo')
  })
})
