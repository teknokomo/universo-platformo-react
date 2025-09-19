import { describe, expect, it } from 'vitest'

import { ModeDetector } from '../ModeDetector'

describe('ModeDetector', () => {
  const multiplayerFlow = {
    multiScene: {
      totalScenes: 3,
      scenes: [
        {
          spaceId: 'auth',
          spaceData: {
            leadCollection: {
              collectName: true,
              collectEmail: false,
              collectPhone: false,
            },
            entities: [],
          },
          dataNodes: [],
          objectNodes: [],
        },
        {
          spaceId: 'game',
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
          objectNodes: [],
        },
        {
          spaceId: 'results',
          spaceData: {},
          dataNodes: [],
          objectNodes: [],
        },
      ],
    },
  }

  it('detects multiplayer flows based on lead collection lobby', () => {
    const info = ModeDetector.detectMultiplayerMode(multiplayerFlow as any)

    expect(info.isMultiplayer).toBe(true)
    expect(info.authSpace?.spaceId).toBe('auth')
    expect(info.gameSpace?.spaceId).toBe('game')
  })

  it('prefers explicit game mode option over auto detection', () => {
    const optionMode = ModeDetector.determineGameMode(multiplayerFlow as any, { gameMode: 'singleplayer' })
    expect(optionMode).toBe('singleplayer')

    const autoMode = ModeDetector.determineGameMode(multiplayerFlow as any, {})
    expect(autoMode).toBe('multiplayer')
  })

  it('reports content availability for both single and multi scene flows', () => {
    const emptyFlow = {}
    expect(ModeDetector.hasContent(emptyFlow as any)).toBe(false)

    const singleSceneFlow = {
      updlSpace: {
        entities: [{ id: 'entity', components: [] }],
      },
    }

    expect(ModeDetector.hasContent(singleSceneFlow as any)).toBe(true)
    expect(ModeDetector.hasContent(multiplayerFlow as any)).toBe(true)
  })
})
