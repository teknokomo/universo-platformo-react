import type { QuizPlan } from '../../schemas/quiz'

export class ManualQuizParseError extends Error {
  issues: string[]

  constructor(message: string, issues: string[]) {
    super(message)
    this.name = 'ManualQuizParseError'
    this.issues = issues
  }
}

const QUESTION_RE = /^\s*(\d+)[.)]\s+(.*\S)\s*$/
const ANSWER_RE = /^\s*[-•]\s+(.+?)(?:\s*(✅|\[V\])\s*)?$/i

type DraftAnswer = { text: string; isCorrect: boolean; sourceLine: number }

export function parseManualQuizText(rawText: string): QuizPlan {
  const text = String(rawText || '')
  const trimmed = text.trim()
  if (!trimmed) {
    throw new ManualQuizParseError('Manual quiz text is empty', ['Add at least one question before applying.'])
  }

  const lines = text.split(/\r?\n/)
  const items: Array<{ question: string; answers: DraftAnswer[]; line: number; number: number }> = []
  const issues: string[] = []
  let current: { question: string; answers: DraftAnswer[]; line: number; number: number } | null = null
  let expectedNumber = 1

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    const qMatch = line.match(QUESTION_RE)
    if (qMatch) {
      const number = Number(qMatch[1])
      const questionText = qMatch[2].trim()
      if (!questionText) {
        issues.push(`Question ${number} has no text (line ${lineNumber}).`)
      }
      if (number !== expectedNumber) {
        issues.push(`Question numbering should be sequential. Expected ${expectedNumber}, found ${number} (line ${lineNumber}).`)
      }
      expectedNumber = number + 1
      current = {
        question: questionText.slice(0, 400),
        answers: [],
        line: lineNumber,
        number
      }
      items.push(current)
      return
    }

    const trimmedLine = line.trim()
    if (!trimmedLine) {
      return
    }

    const aMatch = line.match(ANSWER_RE)
    if (aMatch) {
      if (!current) {
        issues.push(`Answer defined before any question (line ${lineNumber}).`)
        return
      }
      const markerMatches = line.match(/✅|\[V\]/gi) || []
      if (markerMatches.length > 1) {
        issues.push(`Answer on line ${lineNumber} contains multiple correctness markers.`)
      }
      const answerText = aMatch[1].trim()
      if (!answerText) {
        issues.push(`Empty answer detected for question ${current.number} (line ${lineNumber}).`)
      }
      current.answers.push({
        text: answerText.slice(0, 400),
        isCorrect: Boolean(aMatch[2]),
        sourceLine: lineNumber
      })
      return
    }

    issues.push(`Unrecognized line format at ${lineNumber}: "${trimmedLine}".`)
  })

  if (!items.length) {
    issues.push('At least one question is required.')
  }

  if (items.length > 10) {
    issues.push('A maximum of 10 questions is allowed.')
  }

  items.forEach((item) => {
    if (item.answers.length < 2 || item.answers.length > 5) {
      issues.push(`Question ${item.number} must have between 2 and 5 answers.`)
    }
    const correctCount = item.answers.filter((a) => a.isCorrect).length
    if (correctCount === 0) {
      issues.push(`Question ${item.number} is missing a ✅ or [V] marker for the correct answer.`)
    }
    if (correctCount > 1) {
      issues.push(`Question ${item.number} has multiple answers marked as correct.`)
    }
  })

  if (issues.length) {
    throw new ManualQuizParseError('Manual quiz parsing failed', issues)
  }

  return {
    items: items.map((item) => ({
      question: item.question,
      answers: item.answers.map((ans) => ({ text: ans.text, isCorrect: ans.isCorrect }))
    }))
  }
}

export function describeManualError(error: ManualQuizParseError): { message: string; issues: string[] } {
  return {
    message: error.message || 'Manual quiz parsing failed',
    issues: Array.isArray(error.issues) && error.issues.length ? error.issues : ['Manual quiz parsing failed']
  }
}
