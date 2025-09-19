import { describe, expect, it } from 'vitest'

import { ARJSQuizBuilder } from '../ARJSQuizBuilder'

describe('ARJSQuizBuilder', () => {
  it('renders lead collection form and points counter for multi-scene quizzes', async () => {
    const builder = new ARJSQuizBuilder()

    const multiScene = {
      totalScenes: 3,
      currentSceneIndex: 0,
      isCompleted: false,
      scenes: [
        {
          spaceId: 'auth',
          order: 0,
          isLast: false,
          isResultsScene: false,
          nextSceneId: 'game',
          spaceData: {
            leadCollection: {
              collectName: true,
              collectEmail: false,
              collectPhone: false,
            },
          },
          dataNodes: [],
          objectNodes: [],
        },
        {
          spaceId: 'game',
          order: 1,
          isLast: false,
          isResultsScene: false,
          nextSceneId: 'game-results',
          spaceData: {
            showPoints: true,
          },
          dataNodes: [
            {
              id: 'question-1',
              dataType: 'question',
              content: 'Who pilots the MMOOMM flagship?',
              isCorrect: true,
              enablePoints: true,
              pointsValue: 3,
            },
          ],
          objectNodes: [],
        },
        {
          spaceId: 'game-results',
          order: 2,
          isLast: true,
          isResultsScene: true,
          nextSceneId: undefined,
          spaceData: {},
          dataNodes: [],
          objectNodes: [],
        },
      ],
    }

    const html = await builder.build({ multiScene })

    expect(html).toContain('id="lead-collection-form"')
    expect(html).toContain('id="multi-scene-quiz-container"')
    expect(html).toContain('id="points-counter"')
  })

  it('builds single-scene quiz markup from prepared UPDL space data', async () => {
    const builder = new ARJSQuizBuilder()

    const flowData = {
      updlSpace: {
        objects: [],
        cameras: [],
        lights: [],
        datas: [
          {
            id: 'question-1',
            dataType: 'Question',
            content: 'Select the correct AR marker',
            isCorrect: false,
            enablePoints: false,
            pointsValue: 0,
          },
          {
            id: 'answer-1',
            dataType: 'Answer',
            content: 'Hiro marker',
            isCorrect: true,
            enablePoints: true,
            pointsValue: 1,
          },
        ],
      },
    }

    const html = await builder.build(flowData as any, { markerType: 'preset', markerValue: 'hiro' })

    expect(html).toContain('<!-- AR.js Marker - Template: quiz -->')
    expect(html).toContain('window.canvasId')
    expect(html).toContain('Select the correct AR marker')
  })
})
