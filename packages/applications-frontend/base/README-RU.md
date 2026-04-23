# @universo/applications-frontend

> 🏗️ **Современный пакет** - TypeScript-first архитектура с двойной системой сборки

Фронтенд-приложение для управления приложениями и коннекторами в экосистеме Universo Platformo.

## Информация о пакете

- **Пакет**: `@universo/applications-frontend`
- **Версия**: `0.1.0`
- **Тип**: React Frontend Package (Modern)
- **Фреймворк**: React 18 + TypeScript + Material-UI
- **Система сборки**: tsdown (двойная сборка - CJS + ESM)
- **Тестирование**: Vitest + React Testing Library

## Ключевые функции

### 🌍 Управление приложениями
- **Двухуровневая архитектура**: Приложения → Коннекторы (упрощённая по сравнению с Метахабами)
- **Полная изоляция данных**: Данные из разных приложений полностью разделены
- **Ролевой доступ**: Пользовательские роли и разрешения для контроля доступа
- **Контекстная навигация**: Навигация с учётом приложения с хлебными крошками

### 🗂️ Коннекторы
- **Коннекторы**: Контейнеры данных, определяющие структуру приложения
- **Гибкая схема**: Каждый коннектор может иметь свою конфигурацию

### 🧩 Макеты
- **Макеты приложения**: Администраторы приложения могут донастраивать макеты из metahub и создавать собственные макеты приложения.
- **Источник макета**: Карточки показывают, пришёл ли макет из публикации metahub или создан в приложении.
- **Runtime-safe переключатели**: Неактивные макеты и виджеты остаются редактируемыми, но не участвуют в runtime-рендеринге.

### 🎨 Пользовательский интерфейс
- **Интеграция Material-UI**: Согласованные UI-компоненты с современной системой дизайна
- **Адаптивный дизайн**: Оптимизирован для настольных и мобильных устройств
- **Табличное и карточное представление**: Гибкое отображение данных с пагинацией и поиском
- **Диалоговые формы**: Модальные формы для создания и редактирования сущностей

### 🔧 Технические функции
- **TypeScript-First**: Полная реализация на TypeScript со строгой типизацией
- **Интеграция React Query**: Продвинутая загрузка данных и кэширование с TanStack Query v5
- **Интернационализация**: Английские и русские переводы с i18next
- **Валидация форм**: Комплексная валидация с Zod схемами
- **Интеграция API**: RESTful API клиент с аутентификацией
- **Migration Guard**: Единый guard обновлений схемы с уровнями серьёзности

> **Документация по миграциям**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Установка и настройка

### Предварительные требования
```bash
# Системные требования
Node.js >= 18.0.0
PNPM >= 8.0.0
```

### Установка
```bash
# Установка зависимостей
pnpm install

# Сборка пакета
pnpm --filter @universo/applications-frontend build

# Запуск тестов
pnpm --filter @universo/applications-frontend test
```

### Интеграция
```tsx
// Импорт компонентов в React приложении
import { 
  ApplicationList, 
  ApplicationBoard, 
  ConnectorList,
  ApplicationLayouts,
  ApplicationMembers
} from '@universo/applications-frontend'

// Импорт i18n ресурсов (автоматическая регистрация namespace)
import '@universo/applications-frontend/i18n'

// Использование в роутах
<Route path="/applications" element={<ApplicationList />} />
<Route path="/application/:applicationId/board" element={<ApplicationBoard />} />
<Route path="/application/:applicationId/connectors" element={<ConnectorList />} />
<Route path="/application/:applicationId/layouts" element={<ApplicationLayouts />} />
<Route path="/application/:applicationId/access" element={<ApplicationMembers />} />
```

## Архитектура

### Двухуровневая модель сущностей
```
Application (верхнеуровневая организационная единица)
  └── Connector (контейнер данных)
```

### Ключевые компоненты
- **ApplicationList**: Основной список с поиском, пагинацией и CRUD операциями
- **ApplicationBoard**: Дашборд со статистикой и обзором
- **ConnectorList**: Управление коннекторами внутри приложения
- **ApplicationLayouts**: Управление макетами приложения, источниками, defaults, активностью и зонами виджетов
- **ApplicationMembers**: Управление доступом пользователей и ролями

### Структура директорий
```
packages/applications-frontend/base/
├── src/
│   ├── api/              # API клиент и query хуки
│   ├── components/       # Переиспользуемые UI компоненты
│   ├── constants/        # Ключи хранилища и константы
│   ├── hooks/            # Кастомные React хуки
│   ├── i18n/             # Переводы (en, ru)
│   ├── pages/            # Компоненты страниц
│   ├── types/            # TypeScript определения типов
│   └── utils/            # Утилитарные функции
├── dist/                 # Скомпилированный вывод (CJS + ESM)
└── package.json
```

## API эндпоинты

### Приложения
```
GET    /api/v1/applications                    # Список приложений
POST   /api/v1/applications                    # Создать приложение
GET    /api/v1/applications/:id                # Получить детали приложения
PUT    /api/v1/applications/:id                # Обновить приложение
DELETE /api/v1/applications/:id                # Удалить приложение
```

### Коннекторы
```
GET    /api/v1/applications/:id/connectors        # Список коннекторов
POST   /api/v1/applications/:id/connectors        # Создать коннектор
PUT    /api/v1/applications/:id/connectors/:cid   # Обновить коннектор
DELETE /api/v1/applications/:id/connectors/:cid   # Удалить коннектор
```

### Участники
```
GET    /api/v1/applications/:id/members        # Список участников
POST   /api/v1/applications/:id/members        # Пригласить участника
PUT    /api/v1/applications/:id/members/:mid   # Изменить роль участника
DELETE /api/v1/applications/:id/members/:mid   # Удалить участника
```

### Макеты
```
GET    /api/v1/applications/:id/layout-scopes          # Список разрешённых областей макетов
GET    /api/v1/applications/:id/layouts                # Список макетов
POST   /api/v1/applications/:id/layouts                # Создать макет приложения
PATCH  /api/v1/applications/:id/layouts/:layoutId      # Обновить metadata/default/active state макета
DELETE /api/v1/applications/:id/layouts/:layoutId      # Исключить metahub-макет или soft-delete макет приложения
POST   /api/v1/applications/:id/layouts/:layoutId/copy # Скопировать макет в макет приложения
```

## Роли и разрешения

| Роль    | Управление участниками | Управление прил. | Создание контента | Редактирование | Удаление |
|---------|------------------------|------------------|-------------------|----------------|----------|
| owner   | ✅                      | ✅                | ✅                 | ✅              | ✅        |
| admin   | ✅                      | ✅                | ✅                 | ✅              | ✅        |
| editor  | ❌                      | ❌                | ✅                 | ✅              | ❌        |
| member  | ❌                      | ❌                | ✅                 | ✅              | ✅        |

## Разработка

### Запуск тестов
```bash
pnpm --filter @universo/applications-frontend test
```

### Сборка
```bash
pnpm --filter @universo/applications-frontend build
```

### Линтинг
```bash
pnpm --filter @universo/applications-frontend lint
```

## Связанные пакеты

- `@universo/applications-backend` - Backend API для приложений
- `@universo/template-mui` - Общие UI компоненты
- `@universo/types` - Общие TypeScript типы
- `@universo/i18n` - Утилиты интернационализации

## Лицензия

Omsk Open License
