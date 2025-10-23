export function getPreparePrompt(input: { sourceText: string; questionsCount: number; answersPerQuestion: number; additionalConditions?: string }): string {
  const { sourceText, questionsCount, answersPerQuestion, additionalConditions } = input
  return [
    'You are an expert educational methodologist.',
    'Task: From the given study material, produce a multiple-choice quiz plan as RAW JSON only.',
    'Rules:',
    `- Create exactly ${questionsCount} questions.`,
    `- Each question MUST have exactly ${answersPerQuestion} answers.`,
    '- Exactly one answer MUST have "isCorrect": true.',
    '- Answers must be plausible and derived from the material; avoid ambiguous phrasing.',
    '- Output RAW JSON ONLY (no markdown, no comments).',
    '',
    ...(additionalConditions && additionalConditions.trim()
      ? [
          'Constraints (MUST FOLLOW STRICTLY):',
          additionalConditions.trim(),
          '- Do not echo constraints in the output.',
          '- If constraints conflict with the material, prefer constraints while preserving counts and the JSON schema.',
          ''
        ]
      : []),
    'Output schema:',
    '{ "items": [ { "question": "string", "answers": [ { "text": "string", "isCorrect": boolean } ] } ] }',
    '',
    'Material:',
    sourceText
  ].join('\n')
}
