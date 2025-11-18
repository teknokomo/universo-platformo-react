# @universo/projects-frt

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

## Обзор

Фронтенд-приложение для управления проектами, вехами и задачами в экосистеме Universo Platformo. Projects Frontend предоставляет комплексные UI-процессы для управления трёхуровневой архитектурой Проекты → Вехи → Задачи с полной изоляцией данных и безопасностью.

## Информация о пакете

- **Пакет**: `@universo/projects-frt`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление проектами
- **Иерархическая организация**: Трёхуровневая архитектура (Проекты → Вехи → Задачи)
- **Полная изоляция данных**: Задачи и вехи из разных проектов полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа к проектам
- **Контекстная навигация**: Навигация с учётом проекта с хлебными крошками и сохранением сайдбара

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования задач

### 🔧 Технические функции
- **TypeScript-First**: Полная реализация на TypeScript со строгой типизацией
- **Интеграция React Query**: Продвинутая загрузка данных и кэширование
- **Интернационализация**: Английские и русские переводы с i18next
- **Валидация форм**: Комплексная валидация с обработкой ошибок
- **Интеграция API**: RESTful API клиент с аутентификацией

## Установка и настройка

### Предварительные требования
```bash
# Системные требования
Node.js >= 18.0.0
PNPM >= 8.0.0
```

### Установка
```bash
# Установить зависимости
pnpm install

# Собрать пакет
pnpm --filter @universo/projects-frt build

# Запустить в режиме разработки
pnpm --filter @universo/projects-frt dev
```

### Интеграция
```tsx
// Импорт компонентов в ваше React-приложение
import { ProjectList, ProjectBoard, projectsDashboard } from '@universo/projects-frt'

// Импорт i18n задач
import { projectsTranslations } from '@universo/projects-frt'

// Использование в маршрутах
<Route path="/projects" element={<ProjectList />} />
<Route path="/projects/:id/board" element={<ProjectBoard />} />
```

## Архитектура

### Трёхуровневая модель данных
- **Проекты**: Организационные единицы верхнего уровня, обеспечивающие полную изоляцию данных
- **Этапы**: Логические группировки внутри проектов (например, "Веб-сервисы", "Мобильные приложения")
- **Задачи**: Отдельные активы, принадлежащие конкретным вехам внутри проектов

### Стратегия изоляции данных
- Полное разделение между проектами - отсутствие видимости между ними
- Все операции поддерживают контекст проекта через URL-маршрутизацию
- Фронтенд и бэкенд валидация предотвращают создание сиротских задач
- Ролевой контроль доступа для разрешений проектов

## Использование

### Базовые компоненты
```tsx
import { ProjectList, ProjectBoard } from '@universo/projects-frt'

// Список проектов с возможностями управления
function ProjectsPage() {
  return <ProjectList />
}

// Панель управления и аналитика проекта
function ProjectBoardPage() {
  return <ProjectBoard />
}
```

### Интеграция API
```tsx
import { useApi } from '@universo/projects-frt/hooks'
import * as projectsApi from '@universo/projects-frt/api'

function ProjectData() {
  const { data: projects, isLoading } = useApi(
    projectsApi.getProjects
  )
  
  if (isLoading) return <div>Загрузка...</div>
  return <div>Найдено {projects?.length} проектов</div>
}
```

### Интеграция меню
```tsx
import { projectsDashboard } from '@universo/projects-frt'

// Добавить в навигационное меню
const menuItems = [
  ...otherMenuItems,
  projectsDashboard
]
```

## Структура файлов

```
packages/projects-frt/base/
├── src/
│   ├── api/              # Функции API клиента
│   │   ├── projects.ts   # CRUD операции проектов
│   │   ├── milestones.ts     # Управление вехами
│   │   ├── tasks.ts     # Операции с задачами
│   │   └── queryKeys.ts    # Ключи React Query
│   ├── hooks/            # Пользовательские React хуки
│   │   ├── useApi.ts       # Хук интеграции API
│   │   └── index.ts        # Экспорт хуков
│   ├── i18n/             # Интернационализация
│   │   ├── locales/        # Языковые файлы (en, ru)
│   │   │   ├── en.json     # Английские переводы
│   │   │   └── ru.json     # Русские переводы
│   │   └── index.ts        # Конфигурация i18n
│   ├── pages/            # Основные компоненты страниц
│   │   ├── ProjectList.tsx   # Основной компонент списка
│   │   ├── ProjectBoard.tsx  # Компонент панели управления
│   │   └── ProjectActions.ts # Определения действий
│   ├── menu-items/       # Конфигурация навигации
│   │   └── projectDashboard.ts
│   ├── types/            # Определения TypeScript
│   │   ├── index.ts        # Основные экспорты типов
│   │   └── types.ts        # Определения типов
│   ├── utils/            # Вспомогательные функции
│   └── index.ts          # Экспорты пакета
├── dist/                 # Скомпилированный вывод (CJS, ESM, types)
├── package.json
├── tsconfig.json
├── tsdown.config.ts      # Конфигурация сборки
├── vitest.config.ts      # Конфигурация тестов
├── README.md             # Английская документация
└── README-RU.md          # Данный файл
```

## Основные компоненты

### ProjectList
Основной компонент для отображения и управления проектами:

```tsx
import { ProjectList } from '@universo/projects-frt'

// Функции:
// - Пагинированный табличный вид с функцией поиска
// - Операции создания, редактирования, удаления
// - Ролевой контроль доступа
// - Отзывчивый дизайн с Material-UI
// - Поддержка интернационализации
```

### ProjectBoard  
Компонент панели управления для аналитики проектов:

```tsx
import { ProjectBoard } from '@universo/projects-frt'

// Функции:
// - Специфичная для проекта панель управления
// - Аналитика и статистика
// - Интерактивная визуализация данных
// - Контекстно-зависимая навигация
```

## Интеграция API

### Базовые операции API
```typescript
import * as projectsApi from '@universo/projects-frt/api'

// Получить все проекты
const projects = await projectsApi.getProjects()

// Получить конкретный проект
const project = await projectsApi.getProject(id)

// Создать новый проект
const newProject = await projectsApi.createProject({
  name: 'Мой проект',
  description: 'Описание проекта'
})

// Обновить проект
const updated = await projectsApi.updateProject(id, data)

// Удалить проект
await projectsApi.deleteProject(id)
```

### Операции в контексте проекта
```typescript
// Получить вехи для конкретного проекта
const milestones = await projectsApi.getProjectMilestones(projectId)

// Получить задачи для конкретного проекта  
const tasks = await projectsApi.getProjectTasks(projectId)

// Связать веха с проектом
await projectsApi.addMilestoneToProject(projectId, milestoneId)
```

### Интеграция React Query
```typescript
import { useQuery } from '@tanstack/react-query'
import { projectsQueryKeys } from '@universo/projects-frt/api'

function useProjects() {
  return useQuery({
    queryKey: projectsQueryKeys.all,
    queryFn: projectsApi.getProjects
  })
}
```

## Разработка

### Предварительные требования
- Node.js 18+
- pnpm 8+
- TypeScript 5+

### Доступные скрипты
```bash
# Разработка
pnpm dev              # Запуск сервера разработки
pnpm build            # Сборка для продакшена (двойная CJS/ESM)
pnpm build:watch      # Сборка в режиме наблюдения

# Тестирование
pnpm test             # Запуск тестового пакета Vitest
pnpm test:watch       # Запуск тестов в режиме наблюдения
pnpm test:coverage    # Генерация отчёта покрытия

# Качество кода
pnpm lint             # Запуск ESLint
pnpm lint:fix         # Исправление ошибок ESLint
pnpm type-check       # Проверка типов TypeScript
```

### Система сборки
Данный пакет использует `tsdown` для двойного вывода сборки:
- **CommonJS**: `dist/index.js` (для совместимости с устаревшими системами)
- **ES Modules**: `dist/index.mjs` (для современных сборщиков)
- **Типы**: `dist/index.d.ts` (объявления TypeScript)

### Рекомендации по разработке

#### Архитектурные паттерны
- **Трёхуровневая модель**: Проекты → Этапы → Задачи
- **Изоляция данных**: Строгие границы контекста между проектами
- **React Query**: Централизованная загрузка и кэширование данных
- **Material-UI**: Согласованное использование библиотеки компонентов

#### Управление контекстом
```typescript
// Всегда поддерживать контекст проекта
const projectContext = useProjectContext()
const milestones = useMilestones(projectContext.id)
```

#### Валидация форм
```typescript
// Валидация обязательных полей
const taskSchema = z.object({
  name: z.string().min(1),
  milestoneId: z.string().min(1), // Обязательно - нет пустой опции
  description: z.string().optional()
})
```

## Тестирование

### Структура тестов
```
src/
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── utils/
└── vitest.config.ts
```

### Подход к тестированию
```typescript
// Тестирование компонентов с React Testing Library
import { render, screen } from '@testing-library/react'
import { ProjectList } from '../ProjectList'

test('отображает список проектов', () => {
  render(<ProjectList />)
  expect(screen.getByText('Проекты')).toBeInTheDocument()
})
```

### Запуск тестов
```bash
pnpm test                    # Запуск всех тестов
pnpm test:watch              # Режим наблюдения
pnpm test:coverage           # С покрытием
pnpm test -- --reporter=verbose  # Подробный вывод
```

## Конфигурация

### Переменные окружения
```bash
# Конфигурация API
VITE_API_URL=http://localhost:3000
VITE_API_VERSION=v1

# Аутентификация
VITE_AUTH_ENABLED=true
VITE_AUTH_PROVIDER=supabase
```

### Конфигурация TypeScript
Пакет использует строгую конфигурацию TypeScript:
- Включены строгие проверки null
- Нет неявных типов any
- Строгие типы функций
- Включены все строгие опции компилятора

## Участие в разработке

### Стиль кода
- Следуйте конфигурации ESLint
- Используйте Prettier для форматирования
- Предпочитайте TypeScript вместо JavaScript
- Используйте функциональные компоненты с хуками

### Процесс Pull Request
1. Создайте feature ветку от `main`
2. Реализуйте изменения с тестами
3. Обновите документацию
4. Запустите полный тестовый пакет
5. Отправьте PR с описанием

### Соглашение о коммитах
Следуйте соглашению conventional commits:
```bash
feat(projects): добавить функцию поиска
fix(api): обработка пустого ответа
docs(readme): обновить руководство по установке
```

## Связанные пакеты
- [`@universo/projects-srv`](../projects-srv/base/README.md) - Бэкенд сервис
- [`@universo/template-mui`](../universo-template-mui/base/README.md) - UI компоненты
- [`@universo/types`](../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления проектами*
