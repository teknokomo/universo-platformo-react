export function getNormalizePrompt(input: { rawText: string }): string {
  return [
    'You are a meticulous quiz normalizer.',
    'The user provides numbered quiz questions with bullet answers.',
    'Your task is to convert the text into strict JSON that matches this schema:',
    '{ "items": [ { "question": string, "answers": [ { "text": string, "isCorrect": boolean } ] } ] }.',
    '',
    'Hard requirements:',
    '- Keep questions in the original order and trim whitespace.',
    '- Each question must have between 2 and 5 answers.',
    '- Exactly one answer per question must have "isCorrect": true.',
    '- The ✅ emoji or the token [V] marks the correct answer; remove the marker from text but set isCorrect true.',
    '- If a question has no explicit marker, infer the best answer and set it as correct.',
    '- Limit question and answer text to 400 characters.',
    '- Output RAW JSON ONLY with no markdown or prose.',
    '',
    'User supplied text:',
    input.rawText
  ].join('\n')
}
