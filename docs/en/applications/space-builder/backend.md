# `packages/space-builder-srv` — Space Builder Backend — [Status: MVP]

Backend service for converting natural language requests into quiz plans and UPDL graphs via LLM providers.

## Purpose

Provides API for quiz plan generation, revision, and conversion into valid UPDL graphs using various LLM providers.

## Key Features

- **Meta-prompt system**: Generation of structured quiz plans
- **Provider integration**: Support for multiple LLM providers (OpenAI, OpenRouter, Groq, Cerebras, GigaChat, YandexGPT, Google)
- **JSON extraction & validation**: Zod output validation
- **Deterministic builder**: UPDL graph construction without LLM hallucinations
- **Test mode**: Test providers without user credentials

## API Endpoints

### Health Check

```
GET /api/v1/space-builder/health

Response: { ok: true }
```

### Configuration

```
GET /api/v1/space-builder/config

Response: {
  testMode: boolean,
  disableUserCredentials: boolean,
  items: Array<{
    id: string,
    provider: string,
    model: string,
    label: string
  }>
}
```

### Prepare Quiz Plan

```
POST /api/v1/space-builder/prepare

Body: {
  sourceText: string,              // 1-5000 chars
  additionalConditions?: string,   // 0-500 chars
  selectedChatModel: {
    provider: string,
    modelName: string,
    credentialId?: string
  },
  options: {
    questionsCount: number,        // 1-30
    answersPerQuestion: number     // 2-5
  }
}

Response: {
  quizPlan: {
    items: Array<{
      question: string,
      answers: Array<{
        text: string,
        isCorrect: boolean
      }>
    }>
  }
}
```

### Revise Quiz Plan

```
POST /api/v1/space-builder/revise

Body: {
  quizPlan: QuizPlan,
  instructions: string,            // 1-500 chars
  selectedChatModel: { ... }
}

Response: {
  quizPlan: QuizPlan
}
```

### Generate UPDL Graph

```
POST /api/v1/space-builder/generate

Body: {
  quizPlan: QuizPlan,
  selectedChatModel: { ... }
}

Response: {
  nodes: any[],
  edges: any[]
}
```

## Configuration

### Environment Variables

Test mode:
- `SPACE_BUILDER_TEST_MODE=true|false`
- `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true|false`

Enable providers:
- `SPACE_BUILDER_TEST_ENABLE_OPENAI`
- `SPACE_BUILDER_TEST_ENABLE_OPENROUTER`
- `SPACE_BUILDER_TEST_ENABLE_GROQ`
- `SPACE_BUILDER_TEST_ENABLE_CEREBRAS`
- `SPACE_BUILDER_TEST_ENABLE_GIGACHAT`
- `SPACE_BUILDER_TEST_ENABLE_YANDEXGPT`
- `SPACE_BUILDER_TEST_ENABLE_GOOGLE`
- `SPACE_BUILDER_TEST_ENABLE_CUSTOM`

Per-provider settings (example for OpenAI):
- `OPENAI_TEST_MODEL`
- `OPENAI_TEST_API_KEY`
- `OPENAI_TEST_BASE_URL` (optional)

## Architecture

### Deterministic Builder

- Final UPDL graph built by deterministic local builder from validated quiz plan
- No LLM step during graph construction
- Stable results, no hallucinations, reduced token usage
- Node names and coordinates assigned by builder for consistent layouts

### Provider System

- Universal interface for all LLM providers
- OpenAI-compatible endpoints
- Custom headers support for specific providers
- Automatic provider detection based on env vars

### Validation & Safety

- Zod schemas for input/output validation
- Node normalization for stable UI rendering
- Size checks (questionsCount, answersPerQuestion)
- Text field length validation

## Build

Single CJS build:

```bash
pnpm build --filter @universo/space-builder-srv
```

## Security

- All API keys resolved server-side
- No secrets on frontend
- JWT authentication for endpoints
- Retry mechanism for auth refresh

## Technologies

- **Express.js**: Web framework
- **Zod**: Schema validation
- **TypeScript**: Type safety
- **LLM Clients**: Integration with various AI providers

## See Also

- [Space Builder Frontend](./frontend.md) - UI component
- [Space Builder README](./README.md) - System overview
