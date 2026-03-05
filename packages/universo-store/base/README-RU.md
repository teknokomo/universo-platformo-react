# Flowise Store

🚨 **ПРЕДУПРЕЖДЕНИЕ О LEGACY КОДЕ** 🚨  
Этот пакет является частью устаревшей архитектуры Flowise и запланирован к удалению/рефакторингу после завершения миграции Universo Platformo (планируется на Q2 2026). Новые функции следует разрабатывать в современных пакетах `@universo/*`.

## Обзор

Общая конфигурация Redux store для приложений Flowise, обеспечивающая централизованное управление состоянием в экосистеме legacy Flowise UI. Этот пакет управляет состоянием всего приложения, включая данные canvas, настройки кастомизации, уведомления и состояния диалогов.

## Информация о пакете

- **Пакет**: `@universo/store`
- **Версия**: `0.1.0` (legacy версия)
- **Тип**: Redux Store Library (Legacy)
- **Фреймворк**: Redux + React Context API
- **Зависимости**: Redux 5.0.1, React Redux peer dependency
- **Система сборки**: tsdown (TypeScript + ESM output)

## Ключевые особенности

### 🏪 Управление Store
- **Redux Store**: Централизованное управление состоянием с Redux
- **Комбинированные Reducers**: Модульная архитектура reducers
- **Context Providers**: Интеграция React Context для сложных операций
- **Action Creators**: Типобезопасные создатели действий для обновления состояния

### 🎨 Домены состояния
- **Canvas State**: Состояние flow редактора и отслеживание изменений
- **Customization State**: Настройки темы UI и макета
- **Notification State**: Управление snackbar и уведомлениями
- **Dialog State**: Состояние модальных и подтверждающих диалогов

### ⚛️ Интеграция с React
- **React Flow Context**: Продвинутые операции с flow (дублирование, удаление узлов/связей)
- **Confirm Context**: Управление модальными диалогами подтверждения
- **Redux Provider**: Интеграция store с React компонентами

## Структура Store

### Canvas Reducer
```javascript
// Управление состоянием Canvas
{
  isDirty: false,              // Отслеживание несохраненных изменений
  currentCanvas: null,         // Данные активного canvas
  canvasDialogShow: false,     // Состояние видимости диалога
  componentNodes: [],          // Доступные компоненты узлов
  componentCredentials: []     // Конфигурации учетных данных узлов
}
```

### Customization Reducer
```javascript
// Состояние кастомизации UI
{
  isOpen: false,              // Состояние меню
  fontFamily: 'Roboto',       // Типография
  borderRadius: 12,           // Радиус границ UI
  opened: true,               // Начальное состояние меню
  darkMode: false            // Предпочтение темы
}
```

### Система уведомлений
```javascript
// Управление snackbar уведомлениями
{
  notifications: []           // Очередь активных уведомлений
}
```

## Установка и настройка

### Предварительные требования
```bash
# Требуются peer dependencies
React ^18.3.1
React Redux ^9.1.0
```

### Установка
```bash
# Установка в workspace
pnpm install @universo/store

# Сборка пакета
pnpm build
```

## Использование

### Базовая настройка Store
```jsx
import { store } from '@universo/store'
import { Provider } from 'react-redux'

function App() {
  return (
    <Provider store={store}>
      <YourComponents />
    </Provider>
  )
}
```

### Использование Context Providers
```jsx
import { AbilityContextProvider } from '@universo/store'

function App() {
  return (
    <AbilityContextProvider>
      <YourComponents />
    </AbilityContextProvider>
  )
}
```

### Отправка Actions
```jsx
import { useDispatch } from 'react-redux'
import { SET_CANVAS, SET_DIRTY } from '@universo/store'

function CanvasComponent() {
  const dispatch = useDispatch()
  
  const updateCanvas = (canvasData) => {
    dispatch({ type: SET_CANVAS, canvas: canvasData })
    dispatch({ type: SET_DIRTY })
  }
}
```

### Использование React Flow Context
```jsx
import { useContext } from 'react'
import { flowContext } from '@universo/store'

function FlowToolbar() {
  const { duplicateNode, deleteNode } = useContext(flowContext)
  
  const handleDuplicate = (nodeId) => {
    duplicateNode(nodeId)
  }
}
```

## Архитектура

### Конфигурация Store
- **Создание Store**: Базовый Redux store с комбинированными reducers
- **Без Middleware**: Простой store без Redux Toolkit или middleware
- **Persistence**: Базовая конфигурация persister (установлена в 'Free')

### Структура Reducer
```
reducers/
├── canvasReducer.js       # Состояние Canvas и flow
├── customizationReducer.js # Настройки UI
└── notifierReducer.js     # Уведомления
```

### Архитектура Context
```
context/
├── ReactFlowContext.jsx       # Операции Flow
├── AbilityContext.jsx         # CASL ability context
└── AbilityContextProvider.jsx # Провайдер ability
```

## Типы действий

### Actions для Canvas
```javascript
SET_DIRTY                    // Отметить canvas как измененный
REMOVE_DIRTY                 // Отметить canvas как сохраненный
SET_CANVAS                   // Обновить текущий canvas
SHOW_CANVAS_DIALOG          // Показать диалог canvas
HIDE_CANVAS_DIALOG          // Скрыть диалог canvas
SET_COMPONENT_NODES         // Обновить доступные узлы
SET_COMPONENT_CREDENTIALS   // Обновить учетные данные
```

### Actions для кастомизации
```javascript
SET_MENU                    // Установить состояние меню
MENU_TOGGLE                 // Переключить меню
MENU_OPEN                   // Открыть меню
SET_FONT_FAMILY            // Обновить типографию
SET_BORDER_RADIUS          // Обновить радиус границ
SET_LAYOUT                 // Обновить макет
SET_DARKMODE               // Переключить темный режим
```

### Actions для уведомлений
```javascript
ENQUEUE_SNACKBAR           // Добавить уведомление
CLOSE_SNACKBAR             // Закрыть уведомление
REMOVE_SNACKBAR            // Удалить уведомление
```

## Структура файлов

```
packages/flowise-store/
├── base/                   # Реализация пакета
│   ├── src/
│   │   ├── actions.js      # Типы действий и создатели
│   │   ├── reducer.jsx     # Комбинированные reducers
│   │   ├── index.jsx       # Создание store
│   │   ├── index.ts        # TypeScript экспорты
│   │   ├── constant.js     # Константы
│   │   ├── config.js       # Конфигурация
│   │   ├── context/        # React contexts
│   │   │   ├── ReactFlowContext.jsx
│   │   │   ├── AbilityContext.jsx
│   │   │   └── AbilityContextProvider.jsx
│   │   └── reducers/       # Отдельные reducers
│   │       ├── canvasReducer.js
│   │       ├── customizationReducer.js
│   │       └── notifierReducer.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsdown.config.ts    # Конфигурация сборки
│   └── LICENSE-Flowise.md
└── README.md              # Этот файл
```

## Статус Legacy и план миграции

### Текущее состояние (2024)
- ✅ **Функциональный**: Работающий Redux store для legacy Flowise UI
- ✅ **Интегрированный**: Используется `flowise-ui` и связанными компонентами
- ⚠️ **Заморожен**: Никаких новых функций, только режим поддержки
- ⚠️ **Устарел**: Использует legacy паттерны Redux без Redux Toolkit

### График миграции
- **Q1 2025**: Оценка современных альтернатив управления состоянием
- **Q2 2025**: Начало миграции к современным решениям состояния
- **Q3 2025**: Создание современного управления состоянием в пакетах `@universo/*`
- **Q4 2025**: Прекращение использования legacy store
- **Q1 2026**: Завершение миграции к современному управлению состоянием
- **Q2 2026**: Удаление legacy пакета store

### Стратегия замены
1. **Современное управление состоянием**: Замена на Redux Toolkit или Zustand
2. **Оптимизация Context**: Миграция React contexts к современным паттернам
3. **Миграция TypeScript**: Полная реализация TypeScript
4. **Производительность**: Реализация нормализации состояния и селекторов
5. **Developer Experience**: Добавление интеграции DevTools и улучшенной отладки

## Зависимости

### Основные зависимости
```json
{
  "redux": "^5.0.1"
}
```

### Peer Dependencies
```json
{
  "react": "^18.3.1",
  "react-redux": "^9.1.0"
}
```

### Dev Dependencies
```json
{
  "tsdown": "^0.15.7",
  "typescript": "^5.8.3"
}
```

## Разработка

### Локальная разработка
```bash
# Установка зависимостей
pnpm install

# Сборка в режиме разработки
pnpm dev

# Сборка для продакшн
pnpm build

# Очистка артефактов сборки
pnpm clean
```

### Добавление новых функций (Legacy пакет)
⚠️ **Важно**: Это legacy код. Новое управление состоянием следует реализовывать в современных пакетах `@universo/*` когда это возможно.

Если вы должны изменить этот legacy пакет:
1. Следуйте существующим паттернам Redux
2. Поддерживайте обратную совместимость
3. Добавьте соответствующие уведомления об устаревании
4. Документируйте путь миграции для нового состояния

## Точки интеграции

### Интеграция Legacy пакетов
- **flowise-ui**: Основной потребитель store
- **flowise-chatmessage**: Использует систему уведомлений
- **flowise-template-mui**: Может использовать состояние кастомизации

### Соображения современных пакетов
- **Будущая интеграция**: Будет заменена современным управлением состоянием
- **Путь миграции**: Постепенный переход к новым паттернам состояния
- **Совместимость**: Обеспечение плавной миграции для зависимых пакетов

## Известные ограничения

1. **Нет Redux Toolkit**: Использует legacy паттерны Redux
2. **Смешанные JS/JSX**: Несовместимые расширения файлов
3. **Базовый Store**: Нет middleware или продвинутых функций Redux
4. **Ограниченный TypeScript**: Частичная реализация TypeScript
5. **Нет Persistence**: Мок конфигурация persister

## Внесение вклада

⚠️ **Уведомление о Legacy пакете**: Этот пакет находится в режиме поддержки. Для новых вкладов:
1. Рассмотрите реализацию управления состоянием в современных пакетах `@universo/*`
2. Следуйте существующим паттернам Redux, если изменения необходимы
3. Поддерживайте обратную совместимость с существующими потребителями
4. Документируйте путь миграции для любых новых требований состояния

## Лицензия

SEE LICENSE IN LICENSE-Flowise.md - Apache License Version 2.0

---

**Поддержка миграции**: Если вам нужна помощь в миграции управления состоянием из этого legacy пакета к современным альтернативам, пожалуйста, обратитесь к документации по миграции или создайте issue для получения руководства.