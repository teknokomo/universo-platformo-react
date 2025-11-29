# @universo/flowise-assistants-frt

Фронтенд-пакет для Assistants в Universo Platformo.

## Описание

Этот пакет предоставляет React-компоненты для управления AI-ассистентами:
- Кастомные ассистенты (локальные, на основе инструментов)
- OpenAI-ассистенты
- Azure OpenAI-ассистенты

## Возможности

- AssistantDialog - Главный диалог для создания/редактирования OpenAI-ассистентов
- AddCustomAssistantDialog - Диалог для создания кастомных ассистентов
- LoadAssistantDialog - Диалог для загрузки существующих ассистентов
- CustomAssistantLayout - Лейаут для холста кастомного ассистента
- OpenAIAssistantLayout - Лейаут для холста OpenAI-ассистента

## Использование

```jsx
import { 
    AssistantDialog,
    AddCustomAssistantDialog,
    CustomAssistantLayout,
    OpenAIAssistantLayout
} from '@universo/flowise-assistants-frt'
```

## i18n

Пакет включает переводы для:
- Английский (en)
- Русский (ru)

Зарегистрируйте пространство имён в конфигурации i18n:
```jsx
import '@universo/flowise-assistants-frt/i18n'
```
