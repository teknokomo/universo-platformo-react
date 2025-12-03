import { SpaceBuilderService } from '../../services/SpaceBuilderService'
import { callProvider } from '../../services/providers/ModelFactory'
import { ManualQuizParseError } from '../../services/parsers/manualQuiz'

jest.mock('../../services/providers/ModelFactory', () => ({
  callProvider: jest.fn()
}))

describe('SpaceBuilderService', () => {
  const service = new SpaceBuilderService()
  const callProviderMock = callProvider as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('подготавливает план викторины из markdown-JSON ответа провайдера', async () => {
    const rawPlan = {
      items: [
        {
          question: 'Question 1',
          answers: [
            { text: 'Answer 1', isCorrect: true },
            { text: 'Answer 2', isCorrect: false }
          ]
        },
        {
          question: 'Question 2',
          answers: [
            { text: 'Answer 3', isCorrect: false },
            { text: 'Answer 4', isCorrect: true }
          ]
        }
      ]
    }

    const markdownResponse = ['```json', JSON.stringify(rawPlan, null, 2), '```'].join('\n')
    callProviderMock.mockResolvedValueOnce(markdownResponse)

    const plan = await service.proposeQuiz({
      sourceText: 'Material',
      selectedChatModel: { provider: 'openai', modelName: 'gpt-4o', credentialId: 'cred-1' },
      options: { questionsCount: 2, answersPerQuestion: 2 }
    })

    expect(plan.items).toHaveLength(2)
    expect(plan.items[0].answers).toHaveLength(2)
    expect(plan.items[1].answers[1].isCorrect).toBe(true)
  })

  it('распознаёт план, даже если провайдер вернул строку с экранированным JSON', async () => {
    const rawPlan = {
      items: [
        {
          question: 'Double encoded',
          answers: [
            { text: 'Yes', isCorrect: true },
            { text: 'No', isCorrect: false }
          ]
        }
      ]
    }

    callProviderMock.mockResolvedValueOnce(JSON.stringify(JSON.stringify(rawPlan)))

    const plan = await service.proposeQuiz({
      sourceText: 'Material',
      selectedChatModel: { provider: 'openai', modelName: 'gpt-4o', credentialId: 'cred-2' },
      options: { questionsCount: 1, answersPerQuestion: 2 }
    })

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].question).toBe('Double encoded')
    expect(plan.items[0].answers[0].isCorrect).toBe(true)
  })

  it('генерирует граф при валидном JSON от провайдера', async () => {
    callProviderMock.mockResolvedValueOnce(
      JSON.stringify({
        nodes: [
          { id: 'node-1', data: { name: 'Data', label: 'Node', inputs: {} } }
        ],
        edges: []
      })
    )

    const result = await service.generate({
      question: 'Build quiz',
      selectedChatModel: { provider: 'openai', modelName: 'gpt', credentialId: 'cred-1' }
    })

    expect(callProviderMock).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt',
      credentialId: 'cred-1',
      prompt: expect.stringContaining('Build quiz')
    })
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toEqual([])
    expect(result.nodes[0]).toMatchObject({ id: 'node-1', data: { name: 'Data' } })
  })

  it('конвертирует план викторины в граф с предсказуемой структурой', async () => {
    const plan = {
      items: [
        {
          question: 'Q1',
          answers: [
            { text: 'A1', isCorrect: true },
            { text: 'A2', isCorrect: false }
          ]
        }
      ]
    }

    const result = await service.generateFromPlan({
      quizPlan: plan,
      selectedChatModel: { provider: 'openai', modelName: 'gpt' }
    })

    expect(result.nodes.some(node => node.data.inputs?.dataType === 'question')).toBe(true)
    expect(result.edges.length).toBeGreaterThan(0)
  })

  it('нормализует ручной текст без вызова провайдера', async () => {
    const manualText = ['1. Question one', '- Answer A ✅', '- Answer B'].join('\n')

    const plan = await service.normalizeManualQuiz({
      rawText: manualText,
      selectedChatModel: {}
    })

    expect(callProviderMock).not.toHaveBeenCalled()
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].answers.find((a) => a.isCorrect)?.text).toBe('Answer A')
  })

  it('бросает ManualQuizParseError без fallback и использует провайдера с fallback', async () => {
    const invalidText = ['1. Broken question', '- Answer A', '- Answer B'].join('\n')

    await expect(
      service.normalizeManualQuiz({
        rawText: invalidText,
        selectedChatModel: {}
      })
    ).rejects.toBeInstanceOf(ManualQuizParseError)

    callProviderMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            question: 'Fallback question',
            answers: [
              { text: 'Fallback A', isCorrect: true },
              { text: 'Fallback B', isCorrect: false }
            ]
          }
        ]
      })
    )

    const plan = await service.normalizeManualQuiz({
      rawText: invalidText,
      selectedChatModel: { provider: 'openai', modelName: 'gpt-4o' },
      fallbackToLLM: true
    })

    expect(callProviderMock).toHaveBeenCalledTimes(1)
    expect(plan.items[0].question).toBe('Fallback question')
    expect(plan.items[0].answers[0].isCorrect).toBe(true)
  })
})
