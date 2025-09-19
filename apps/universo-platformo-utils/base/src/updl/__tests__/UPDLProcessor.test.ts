import { describe, expect, it } from 'vitest'

import { UPDLProcessor } from '../UPDLProcessor'

describe('UPDLProcessor', () => {
  it('builds a single UPDL space with entity relationships preserved', () => {
    const flowData = {
      nodes: [
        {
          id: 'space-1',
          data: {
            name: 'Space',
            inputs: {
              name: 'Main Space',
              showPoints: true,
            },
          },
        },
        {
          id: 'entity-1',
          data: {
            name: 'Entity',
            inputs: {
              name: 'Player',
              entityType: 'avatar',
              transform: { position: { x: 1, y: 2, z: 3 } },
            },
          },
        },
        {
          id: 'component-1',
          data: {
            name: 'Component',
            inputs: {
              componentType: 'render',
              color: '#ffaa00',
            },
          },
        },
        {
          id: 'event-1',
          data: {
            name: 'Event',
            inputs: {
              eventType: 'onClick',
            },
          },
        },
        {
          id: 'action-1',
          data: {
            name: 'Action',
            inputs: {
              actionType: 'navigate',
              target: 'results',
            },
          },
        },
        {
          id: 'data-1',
          data: {
            name: 'Data',
            inputs: {
              dataType: 'Question',
              content: 'How many moons does Mars have?',
              pointsValue: 10,
              enablePoints: true,
            },
          },
        },
      ],
      edges: [
        { id: 'edge-entity-space', source: 'entity-1', target: 'space-1' },
        { id: 'edge-component-entity', source: 'component-1', target: 'entity-1' },
        { id: 'edge-event-entity', source: 'event-1', target: 'entity-1' },
        { id: 'edge-action-event', source: 'action-1', target: 'event-1' },
        { id: 'edge-data-space', source: 'data-1', target: 'space-1' },
      ],
    }

    const { updlSpace } = UPDLProcessor.processFlowData(JSON.stringify(flowData))

    expect(updlSpace).toBeDefined()
    expect(updlSpace?.entities).toHaveLength(1)
    const [entity] = updlSpace!.entities!
    expect(entity.components).toHaveLength(1)
    expect(entity.components[0].componentType).toBe('render')
    expect(entity.events).toHaveLength(1)
    expect(entity.events[0].eventType).toBe('onClick')
    expect(entity.events[0].actions).toHaveLength(1)
    expect(entity.events[0].actions?.[0].actionType).toBe('navigate')
    expect(updlSpace?.datas?.[0].pointsValue).toBe(10)
    expect(updlSpace?.showPoints).toBe(true)
  })

  it('detects multi-scene flows and propagates lead collection + scoring flags', () => {
    const flowData = {
      nodes: [
        {
          id: 'space-auth',
          data: {
            name: 'Space',
            inputs: {
              name: 'Auth Scene',
              collectLeadName: true,
            },
          },
        },
        {
          id: 'space-game',
          data: {
            name: 'Space',
            inputs: {
              name: 'Game Scene',
              showPoints: true,
            },
          },
        },
        {
          id: 'entity-game',
          data: {
            name: 'Entity',
            inputs: {
              name: 'Spaceship',
            },
          },
        },
        {
          id: 'data-auth',
          data: {
            name: 'Data',
            inputs: {
              dataType: 'Lead',
              content: 'collect lead data',
            },
          },
        },
        {
          id: 'data-game',
          data: {
            name: 'Data',
            inputs: {
              dataType: 'Question',
              content: 'What is MMOOMM?',
              enablePoints: true,
              pointsValue: 5,
            },
          },
        },
      ],
      edges: [
        { id: 'edge-auth-game', source: 'space-auth', target: 'space-game' },
        { id: 'edge-auth-data', source: 'data-auth', target: 'space-auth' },
        { id: 'edge-game-data', source: 'data-game', target: 'space-game' },
        { id: 'edge-entity-space', source: 'entity-game', target: 'space-game' },
      ],
    }

    const { multiScene } = UPDLProcessor.processFlowData(JSON.stringify(flowData))

    expect(multiScene).toBeDefined()
    expect(multiScene?.totalScenes).toBe(3)
    expect(multiScene?.scenes[0].spaceData.leadCollection.collectName).toBe(true)
    expect(multiScene?.scenes[1].spaceData.showPoints).toBe(true)
    expect(multiScene?.scenes[1].dataNodes[0].pointsValue).toBe(5)
    expect(multiScene?.scenes[2].isResultsScene).toBe(true)
  })
})
