export type GuestAssessmentResponseRecord = {
    id: string
    attemptId: string
    studentId: string
    quizId: string
    questionId: string
    selectedOptionIds: string[]
    isCorrect: boolean
    attemptNumber: number
    submittedAt: string
}

export function parseGuestAssessmentResponseRecord(row: Record<string, unknown>): GuestAssessmentResponseRecord {
    const requiredText = (key: string) => {
        const value = row[key]
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error(`E2E QuizResponses row is missing its required ${key} value`)
        }
        return value
    }

    let selectedOptionIds: unknown = row.selectedOptionIds
    if (typeof selectedOptionIds === 'string') {
        try {
            selectedOptionIds = JSON.parse(selectedOptionIds) as unknown
        } catch {
            throw new Error('E2E QuizResponses row has invalid SelectedOptionIds JSON')
        }
    }
    if (
        !Array.isArray(selectedOptionIds) ||
        selectedOptionIds.length === 0 ||
        selectedOptionIds.some((id) => typeof id !== 'string' || id.length === 0)
    ) {
        throw new Error('E2E QuizResponses row must contain a non-empty string array for SelectedOptionIds')
    }
    if (typeof row.isCorrect !== 'boolean') {
        throw new Error('E2E QuizResponses row must contain a boolean IsCorrect value')
    }

    const attemptNumber =
        typeof row.attemptNumber === 'number'
            ? row.attemptNumber
            : typeof row.attemptNumber === 'string' && row.attemptNumber.trim().length > 0
            ? Number(row.attemptNumber)
            : Number.NaN
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
        throw new Error('E2E QuizResponses row must contain a positive integer AttemptNumber')
    }

    const rawSubmittedAt = row.submittedAt
    const submittedAt =
        rawSubmittedAt instanceof Date ? (Number.isFinite(rawSubmittedAt.getTime()) ? rawSubmittedAt.toISOString() : null) : rawSubmittedAt
    if (typeof submittedAt !== 'string' || !Number.isFinite(Date.parse(submittedAt))) {
        throw new Error('E2E QuizResponses row must contain a valid SubmittedAt timestamp')
    }

    return {
        id: requiredText('id'),
        attemptId: requiredText('attemptId'),
        studentId: requiredText('studentId'),
        quizId: requiredText('quizId'),
        questionId: requiredText('questionId'),
        selectedOptionIds: selectedOptionIds as string[],
        isCorrect: row.isCorrect,
        attemptNumber,
        submittedAt
    }
}
