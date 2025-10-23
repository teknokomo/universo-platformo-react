import { describe, expect, it } from 'vitest'

import type { IFlowData } from '../../common/types'
import type { IUPDLData, IUPDLMultiScene, IUPDLScene, IUPDLSpace } from '@universo/types'
import { ARJSQuizBuilder } from '../ARJSQuizBuilder'

const createScene = (overrides: Partial<IUPDLScene>): IUPDLScene => ({
  spaceId: 'scene',
  spaceData: {},
  dataNodes: [],
  objectNodes: [],
  isLast: false,
  order: 0,
  ...overrides,
})

const createMultiScene = (scenes: IUPDLScene[]): IUPDLMultiScene => ({
  scenes,
  currentSceneIndex: 0,
  totalScenes: scenes.length,
  isCompleted: false,
})

const createSingleSceneFlow = (space: Partial<IUPDLSpace>): IFlowData => ({
  updlSpace: {
    id: 'quiz-space',
    name: 'Quiz Space',
    objects: [],
    ...space,
  },
})

describe('ARJSQuizBuilder', () => {
  it('renders lead collection form and points counter for multi-scene quizzes', async () => {
    const builder = new ARJSQuizBuilder()

    const multiScene: IUPDLMultiScene = createMultiScene([
      createScene({
        spaceId: 'auth',
        order: 0,
        nextSceneId: 'game',
        spaceData: {
          leadCollection: {
            collectName: true,
            collectEmail: false,
            collectPhone: false,
          },
        },
      }),
      createScene({
        spaceId: 'game',
        order: 1,
        nextSceneId: 'game-results',
        spaceData: {
          showPoints: true,
        },
        dataNodes: [
          {
            id: 'question-1',
            name: 'Question 1',
            dataType: 'Question',
            content: 'Who pilots the MMOOMM flagship?',
            isCorrect: true,
            enablePoints: true,
            pointsValue: 3,
          },
        ],
      }),
      createScene({
        spaceId: 'game-results',
        order: 2,
        isLast: true,
        isResultsScene: true,
      }),
    ])

    const multiSceneFlow: IFlowData = { multiScene }

    const html = await builder.build(multiSceneFlow)

    expect(html).toContain('id="lead-collection-form"')
    expect(html).toContain('id="multi-scene-quiz-container"')
    expect(html).toContain('id="points-counter"')
  })

  it('builds single-scene quiz markup from prepared UPDL space data', async () => {
    const builder = new ARJSQuizBuilder()

    const singleSceneData: IUPDLData[] = [
      {
        id: 'question-1',
        name: 'Question 1',
        dataType: 'Question',
        content: 'Select the correct AR marker',
        isCorrect: false,
        enablePoints: false,
        pointsValue: 0,
      },
      {
        id: 'answer-1',
        name: 'Answer 1',
        dataType: 'Answer',
        content: 'Hiro marker',
        isCorrect: true,
        enablePoints: true,
        pointsValue: 1,
      },
    ]

    const flowData: IFlowData = createSingleSceneFlow({
      cameras: [],
      lights: [],
      datas: singleSceneData,
    })

    const html = await builder.build(flowData, { markerType: 'preset', markerValue: 'hiro' })

    expect(html).toContain('<!-- AR.js Marker - Template: quiz -->')
    expect(html).toContain('window.canvasId')
    expect(html).toContain('Select the correct AR marker')
  })
})
