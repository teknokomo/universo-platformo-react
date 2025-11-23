# `packages/space-builder-frt` — Space Builder Frontend — [Статус: MVP]

Интерфейс для преобразования естественноязыкового запроса в валидный граф потока из UPDL узлов.

## Назначение

Предоставляет пользовательский интерфейс для генерации викторин на основе естественного языка с использованием LLM моделей. Поддерживает трехшаговый рабочий процесс: подготовка, предпросмотр и генерация.

## Ключевые возможности

- **UI генерации викторин**: FAB + MUI Dialog + i18n + React hooks
- **Трехшаговый workflow**: Prepare → Preview → Settings → Generate
- **Выбор модели**: Интеграция с credentials и тестовыми провайдерами
- **Режимы применения**: Append / Replace / Create New Space
- **Итеративная доработка**: Возможность уточнения плана викторины

## Архитектура

### Workflow

1. **Prepare**: Вставить учебный материал (1-5000 символов), опционально добавить дополнительные условия (0-500 символов), выбрать количество вопросов и ответов
2. **Preview**: Просмотр предложения викторины, возможность запроса изменений через поле "What to change?"
3. **Settings**: Выбор режима создания, настроек сбора имен и отображения финального счета
4. **Generate**: Построение UPDL графа из плана и применение к canvas

### Режимы применения (Creation mode)

- **Append**: Слияние с текущим canvas (ID remap + безопасный вертикальный offset)
- **Replace**: Очистка текущего canvas и установка сгенерированного графа
- **Create new space**: Открытие новой вкладки для нового пространства

## Компоненты

### SpaceBuilderFab

Главный компонент — плавающая кнопка действия с полным диалогом генерации.

```tsx
import { SpaceBuilderFab } from '@universo/space-builder-frt'

<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraphBelow(graph)
        if (mode === 'newSpace') return handleNewSpaceFromGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

### Hooks

- **useSpaceBuilder**: Главный хук для управления состоянием и логикой генерации
- **useModelSelection**: Управление выбором модели и конфигурацией
- **useQuizPlan**: Управление планом викторины и его ревизией

## Интеграция с i18n

```ts
import i18n from '@/i18n'
import { registerSpaceBuilderI18n } from '@universo/space-builder-frt'
registerSpaceBuilderI18n(i18n)
```

## Сборка

Dual build система (CJS + ESM) для оптимальной совместимости:

```bash
pnpm build --filter @universo/space-builder-frt
```

## Технологии

- **React**: UI framework
- **Material-UI**: Компоненты интерфейса
- **TypeScript**: Типобезопасность
- **i18next**: Интернационализация

## См. также

- [Space Builder Backend](./backend.md) - Backend компонент с API
- [Space Builder README](./README.md) - Общее описание системы
