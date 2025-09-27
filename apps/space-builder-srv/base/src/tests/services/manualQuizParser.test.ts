import { ManualQuizParseError, parseManualQuizText } from '../../services/parsers/manualQuiz'

describe('parseManualQuizText', () => {
  it('парсит вопросы с маркером ✅ и [V]', () => {
    const text = [
      '1. Первый вопрос',
      '- Ответ 1 ✅',
      '- Ответ 2',
      '',
      '2) Второй вопрос',
      '- Вариант А',
      '- Вариант B [V]'
    ].join('\n')

    const plan = parseManualQuizText(text)

    expect(plan.items).toHaveLength(2)
    expect(plan.items[0].answers[0].isCorrect).toBe(true)
    expect(plan.items[1].answers[1].isCorrect).toBe(true)
  })

  it('сообщает об ошибках, если нет правильного ответа', () => {
    const text = ['1. Вопрос', '- Ответ 1', '- Ответ 2'].join('\n')

    expect(() => parseManualQuizText(text)).toThrow(ManualQuizParseError)
    try {
      parseManualQuizText(text)
    } catch (err) {
      if (err instanceof ManualQuizParseError) {
        expect(err.issues.some((issue) => issue.includes('missing'))).toBe(true)
      }
    }
  })

  it('валидация отлавливает ответы без вопроса', () => {
    const text = ['- Ответ без вопроса ✅'].join('\n')

    expect(() => parseManualQuizText(text)).toThrow(ManualQuizParseError)
  })
})
