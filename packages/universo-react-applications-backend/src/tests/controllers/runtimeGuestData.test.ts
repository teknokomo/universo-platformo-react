import { normalizeQuestionRows } from '../../controllers/runtimeGuest/guestRuntimeData'

describe('normalizeQuestionRows', () => {
    it.each([null, undefined, '', '   '])('normalizes a missing block key (%s) to null for flat quizzes', (blockKey) => {
        const [question] = normalizeQuestionRows(
            [
                {
                    id: 'question-1',
                    Prompt: 'Question',
                    QuestionDescription: null,
                    QuestionType: null,
                    Explanation: null,
                    SortOrder: 1,
                    BlockKey: blockKey,
                    Options: []
                }
            ],
            {
                prompt: 'Prompt',
                description: 'QuestionDescription',
                questionType: 'QuestionType',
                explanation: 'Explanation',
                sortOrder: 'SortOrder',
                blockKey: 'BlockKey',
                options: 'Options'
            }
        )

        expect(question?.blockKey).toBeNull()
    })
})
