# `packages/space-builder-backend` — Space Builder Backend — [Статус: MVP]

Backend сервис для преобразования естественноязыкового запроса в план викторины и UPDL граф через LLM провайдеров.

## Назначение

Предоставляет API для генерации планов викторин, их ревизии и преобразования в валидные UPDL графы с использованием различных LLM провайдеров.

## Ключевые возможности

- **Meta-prompt система**: Генерация структурированных планов викторин
- **Provider integration**: Поддержка множественных LLM провайдеров (OpenAI, OpenRouter, Groq, Cerebras, GigaChat, YandexGPT, Google)
- **JSON extraction & validation**: Zod валидация выходных данных
- **Deterministic builder**: Построение UPDL графов без галлюцинаций LLM
- **Test mode**: Тестовые провайдеры без пользовательских credentials

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

## Конфигурация

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

## Архитектура

### Deterministic Builder

- Финальный UPDL граф строится детерминированным локальным конструктором из валидированного плана викторины
- Нет LLM шага на этапе построения графа
- Стабильные результаты, отсутствие галлюцинаций, уменьшенное потребление токенов
- Имена узлов и координаты назначаются конструктором для согласованных layout'ов

### Provider System

- Универсальный интерфейс для всех LLM провайдеров
- OpenAI-совместимые endpoints
- Поддержка custom headers для специфических провайдеров
- Автоматическое определение доступных провайдеров на основе env vars

### Validation & Safety

- Zod схемы для валидации входных и выходных данных
- Нормализация узлов для стабильного UI рендеринга
- Проверка размеров (questionsCount, answersPerQuestion)
- Валидация длины текстовых полей

## Сборка

Single CJS build:

```bash
pnpm build --filter @universo/space-builder-backend
```

## Безопасность

- Все ключи API разрешаются на сервере
- Нет секретов на фронтенде
- JWT аутентификация для endpoints
- Retry механизм для auth refresh

## Технологии

- **Express.js**: Web framework
- **Zod**: Schema validation
- **TypeScript**: Типобезопасность
- **LLM Clients**: Интеграция с различными AI провайдерами

## См. также

- [Space Builder Frontend](./frontend.md) - UI компонент
- [Space Builder README](./README.md) - Общее описание системы
