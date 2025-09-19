import { describe, expect, it } from 'vitest'

import type { IFlowData, IUPDLMultiScene, IUPDLScene, IUPDLSpace } from '../../common/types'
import { ModeDetector } from '../ModeDetector'

const createScene = (overrides: Partial<IUPDLScene>): IUPDLScene => ({
  spaceId: 'default-space',
  spaceData: {},
  dataNodes: [],
  objectNodes: [],
  isLast: false,
  order: 0,
  ...overrides,
})

const createMultiSceneFlow = (multiScene: Partial<IUPDLMultiScene>): IFlowData => ({
  multiScene: {
    scenes: [],
    currentSceneIndex: 0,
    totalScenes: 0,
    isCompleted: false,
    ...multiScene,
  },
})

const createSingleSceneSpace = (space: Partial<IUPDLSpace>): IFlowData => ({
  updlSpace: {
    id: 'space-id',
    name: 'Single Scene Space',
    objects: [],
    ...space,
  },
})

describe('ModeDetector', () => {
  const multiplayerFlow: IFlowData = createMultiSceneFlow({
    totalScenes: 3,
    scenes: [
      createScene({
        spaceId: 'auth',
        order: 0,
        spaceData: {
          leadCollection: {
            collectName: true,
            collectEmail: false,
            collectPhone: false,
          },
          entities: [],
        },
      }),
      createScene({
        spaceId: 'game',
        order: 1,
        spaceData: {
          entities: [{ id: 'ship', components: [] }],
        },
        dataNodes: [
          {
            id: 'question-1',
            dataType: 'question',
            content: 'Launch?',
          },
        ],
      }),
      createScene({
        spaceId: 'results',
        order: 2,
        isLast: true,
      }),
    ],
  })

  it('detects multiplayer flows based on lead collection lobby', () => {
    const info = ModeDetector.detectMultiplayerMode(multiplayerFlow)

    expect(info.isMultiplayer).toBe(true)
    expect(info.authSpace?.spaceId).toBe('auth')
    expect(info.gameSpace?.spaceId).toBe('game')
  })

  it('prefers explicit game mode option over auto detection', () => {
    const optionMode = ModeDetector.determineGameMode(multiplayerFlow, { gameMode: 'singleplayer' })
    expect(optionMode).toBe('singleplayer')

    const autoMode = ModeDetector.determineGameMode(multiplayerFlow, {})
    expect(autoMode).toBe('multiplayer')
  })

  it('reports content availability for both single and multi scene flows', () => {
    const emptyFlow: IFlowData = {}
    expect(ModeDetector.hasContent(emptyFlow)).toBe(false)

    const singleSceneFlow = createSingleSceneSpace({
      entities: [{ id: 'entity', components: [] }],
      datas: [],
      components: [],
      events: [],
      actions: [],
      universo: [],
    })

    expect(ModeDetector.hasContent(singleSceneFlow)).toBe(true)
    expect(ModeDetector.hasContent(multiplayerFlow)).toBe(true)
  })
})
