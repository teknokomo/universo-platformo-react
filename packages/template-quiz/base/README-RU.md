# Template Quiz (Шаблон Квиза)

Шаблон квиза для AR.js и других 3D‑технологий в экосистеме Universo Platformo.

См. также: руководство по созданию приложений/пакетов:
- ../../../docs/ru/universo-platformo/shared-guides/creating-apps.md

## Обзор

Пакет предоставляет модульную систему генерации интерактивных AR‑квизов на базе AR.js. Поддерживает много-сценовые квизы, систему баллов, сбор лидов и аналитику.

## Возможности
- **Интеграция с AR.js**: генерация AR‑опыта с маркерным трекингом
- **Интерактивные квизы**: вопросы с вариантами ответов и визуальной обратной связью
- **Multi-scene**: цепочка вопросов в нескольких сценах
- **Система баллов**: опциональный подсчёт и отображение результата
- **Сбор лидов**: имя / email / телефон (конфигурируемо)
- **Интеграция аналитики**: фиксация завершений и результатов
- **UPDL узлы высокого уровня**: Entity + Component подход

## Установка
```bash
pnpm add @universo/template-quiz
```

### Зависимости
Использует общие пакеты экосистемы:
- `@universo-platformo/utils` – обработка UPDL и валидации
- `@universo-platformo/types` – общие типы

## Использование (пример)
```ts
import { ARJSQuizBuilder, getQuizTemplateConfig } from '@universo/template-quiz'

const builder = new ARJSQuizBuilder()
const config = getQuizTemplateConfig()

const html = await builder.build(flowData, {
  markerType: 'preset',
  markerValue: 'hiro',
  includeStartCollectName: true,
  includeEndScore: true
})
```

## Конфигурация шаблона
```ts
const cfg = getQuizTemplateConfig()
// { id, name, description, version, technology, features, defaults, ... }
```

## i18n
```ts
import { templateQuizTranslations, getTemplateQuizTranslations } from '@universo/template-quiz'
const ru = getTemplateQuizTranslations('ru')
```

## Архитектура
**Используемые UPDL узлы:** Space, Entity, Component, Event, Action, Data, Universo.

### BuildOptions
```ts
interface BuildOptions {
  markerType?: 'preset' | 'pattern'
  markerValue?: string
  includeStartCollectName?: boolean
  includeEndScore?: boolean
  generateAnswerGraphics?: boolean
  canvasId?: string
  arDisplayType?: 'marker' | 'wallpaper'
}
```

## Структуры данных (упрощённо)
```ts
interface QuizPlan { items: QuizItem[] }
interface QuizItem { question: string; answers: QuizAnswer[] }
interface QuizAnswer { text: string; isCorrect: boolean; pointsValue?: number; enablePoints?: boolean }
```

## Debug Logging
Система логирования по умолчанию «тихая».

**Основные принципы:**
- Подробные логи обёрнуты в `dbg()`.
- Два уровня управления:
  - Константа сборки: `const QUIZ_DEBUG = false` (можно сменить в исходнике перед сборкой).
  - Динамическое состояние: внутренний `QUIZ_DEBUG_STATE`.
- Публичный API для переключения в рантайме: `window.setQuizDebug(true | false)`.
- При выключенном режиме выводятся только критические ошибки (через `console.error`).
- События сохранения лида также скрыты пока режим не включён.

**Категории (при включённом debug):**
- `[MultiSceneQuiz]` – переходы сцен, нумерация
- `[PointsManager]` – начисление/сброс баллов
- `[LeadCollection]` – сбор данных и попытка сохранения
- `[QuizResults]` – финальный результат и диагностика вывода

**Пример включения в DevTools:**
```js
window.setQuizDebug(true)  // включить
window.setQuizDebug(false) // выключить
```

Чтобы включить по умолчанию для всех — измените константу `QUIZ_DEBUG` в генераторе скрипта (DataHandler) и пересоберите пакет.

## Сборка
```bash
pnpm build          # Все форматы
pnpm build:cjs      # CommonJS
pnpm build:esm      # ES Modules
pnpm build:types    # Типы
pnpm dev            # Режим разработки
```

## Линтинг
```bash
pnpm lint
pnpm lint:fix
```

## Интеграция
- Universo Platformo (основная платформа)
- Space Builder (генерация квизов)
- Publish System (регистрация и деплой)
- i18n система

## License
MIT (см. LICENSE)

## Вклад
См. CONTRIBUTING.md для деталей по процессу.
