export function getRevisePrompt(input: { currentPlanJson: string; instructions: string }): string {
  return [
    'You are an expert educational editor.',
    'Task: Revise the given quiz plan JSON according to the user instructions.',
    '',
    'Hard rules:',
    '- Change ONLY what is explicitly requested by the user instructions.',
    '- Keep all other text IDENTICAL character-by-character.',
    '- Preserve the number of questions, and for each question PRESERVE the number of answers.',
    '- Ensure exactly one "isCorrect": true per question.',
    '- Do NOT add or remove questions or answers.',
    '- Output RAW JSON ONLY (no markdown, no comments).',
    '',
    'Current plan JSON:',
    input.currentPlanJson,
    '',
    'User instructions (MUST FOLLOW STRICTLY):',
    input.instructions
  ].join('\n')
}
