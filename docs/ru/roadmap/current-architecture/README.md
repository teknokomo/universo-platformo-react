# Текущая архитектура Universo Platformo

## Краткое описание

Анализ текущего состояния Universo Platformo на момент достижения Alpha статуса (v0.21.0-alpha). Платформа состоит из 6 рабочих приложений, построенных поверх модифицированной базы Flowise 2.2.8 с сохранением обратной совместимости.

## Содержание

- [Обзор архитектуры](#обзор-архитектуры)
- [Существующие приложения](#существующие-приложения)
- [Packages анализ](#packages-анализ)
- [Паттерны интеграции](#паттерны-интеграции)
- [Ограничения текущей архитектуры](#ограничения-текущей-архитектуры)

## Обзор архитектуры

### Общая структура проекта

```
universo-platformo-react/
├── packages/                  # Оригинальные компоненты Flowise
│   ├── components/            # Узлы и учетные данные
│   ├── server/                # Основной Express сервер
│   ├── ui/                    # React интерфейс Flowise
│   └── universo-rest-docs/     # Swagger документация
├── packages/                      # Расширения Universo Platformo
│   ├── updl/                  # Система узлов UPDL
│   ├── publish-frontend/           # Фронтенд публикации
│   ├── publish-backend/           # Бэкенд публикации
│   ├── profile-frontend/           # Фронтенд профилей
│   ├── profile-backend/           # Бэкенд профилей
│   └── analytics-frontend/         # Фронтенд аналитики
└── docs/                      # Документация
```

### Архитектурные принципы

1. **Минимальные изменения ядра**: Сохранение оригинального кода Flowise
2. **Модульность**: Каждое приложение самодостаточно
3. **Обратная совместимость**: Поддержка существующих Flowise функций
4. **Workspace пакеты**: Переиспользование кода между приложениями

## Существующие приложения

### 1. UPDL (Universal Platform Definition Language)

**Расположение**: `packages/updl/base/`

**Функциональность**:
- 7 высокоуровневых абстрактных узлов
- Универсальное описание 3D/AR/VR пространств
- Интеграция с системой узлов Flowise

**Ключевые узлы**:
- **Space**: Корневой контейнер для 3D окружений
- **Entity**: Игровые объекты с трансформацией и поведением
- **Component**: Присоединяемые поведения и свойства
- **Event**: Система триггеров для взаимодействий
- **Action**: Исполняемые поведения и реакции
- **Data**: Хранение информации и функциональность квизов
- **Universo**: Глобальная связность и сетевые функции

**Архитектура**:
```typescript
interface UPDLNode {
    id: string;
    type: 'Space' | 'Entity' | 'Component' | 'Event' | 'Action' | 'Data' | 'Universo';
    properties: Record<string, any>;
    connections: Connection[];
}
```

### 2. Publish Frontend (publish-frontend)

**Расположение**: `packages/publish-frontend/base/`

**Функциональность**:
- Экспорт UPDL в AR.js и PlayCanvas
- Шаблонная система (Quiz, MMOOMM)
- Клиентская обработка UPDL

**Ключевые компоненты**:
- **UPDLProcessor**: Обработка flowData в AR.js/PlayCanvas
- **ARJSBuilder**: Генерация AR.js приложений
- **PlayCanvasBuilder**: Генерация PlayCanvas проектов
- **MMOOMMTemplate**: Космический MMO шаблон

**Архитектура**:
```typescript
class UPDLProcessor {
    processFlow(flowData: any): ProcessedFlow;
    generateARJS(flow: ProcessedFlow): string;
    generatePlayCanvas(flow: ProcessedFlow): PlayCanvasProject;
}
```

### 3. Publish Backend (publish-backend)

**Расположение**: `packages/publish-backend/base/`
**Workspace пакет**: `@universo/publish-backend`

**Функциональность**:
- API для получения flowData
- Источник истины для UPDL типов
- Асинхронная инициализация маршрутов

**Ключевые сервисы**:
- **FlowDataService**: Получение данных потоков
- **PublicationController**: REST API контроллеры
- **TypeDefinitions**: Общие UPDL типы

### 4. Profile Frontend (profile-frontend)

**Расположение**: `packages/profile-frontend/base/`

**Функциональность**:
- Управление профилями пользователей
- JWT авторизация с Supabase
- Мобильно-адаптивный дизайн

**Ключевые функции**:
- Обновление email и пароля
- Управление настройками профиля
- Интеграция с системой авторизации

### 5. Profile Backend (profile-backend)

**Расположение**: `packages/profile-backend/base/`
**Workspace пакет**: `@universo/profile-backend`

**Функциональность**:
- Безопасные API для данных пользователей
- SQL функции с SECURITY DEFINER
- Асинхронная инициализация маршрутов

### 6. Analytics Frontend (analytics-frontend)

**Расположение**: `packages/analytics-frontend/base/`

**Функциональность**:
- Отслеживание производительности квизов
- Сбор лидов
- Аналитические дашборды

## Packages анализ

### packages/flowise-components

**Текущее состояние**: Монолитный пакет с узлами Flowise

**Содержимое**:
- LangChain узлы (агенты, цепочки, инструменты)
- Векторные хранилища
- Загрузчики документов
- Разделители текста
- AI модели и провайдеры

**Проблемы**:
- Все узлы в одном пакете
- Сложность добавления новых категорий
- Зависимости между несвязанными узлами

**Предложения по рефакторингу**:
```
packages/flowise-components → packages/
├── langchain-nodes-backend/       # LangChain специфичные узлы
├── ai-models-backend/             # AI модели и провайдеры
├── vector-stores-backend/         # Векторные хранилища
├── document-loaders-backend/      # Загрузчики документов
└── tools-backend/                 # Инструменты и утилиты
```

### packages/flowise-core-backend/base

**Текущее состояние**: Монолитный Express сервер

**Содержимое**:
- REST API маршруты
- База данных (TypeORM)
- Система авторизации
- Выполнение потоков
- WebSocket соединения

**Проблемы**:
- Все функции в одном сервере
- Сложность масштабирования
- Тесная связанность компонентов

**Предложения по рефакторингу**:
```
packages/flowise-core-backend/base → packages/
├── workflow-engine-backend/       # Движок выполнения потоков
├── api-gateway-backend/           # Единая точка входа
├── auth-core-backend/             # Базовая авторизация
├── database-backend/              # Управление базой данных
└── websocket-backend/             # WebSocket соединения
```

### packages/flowise-core-frontend/base

**Текущее состояние**: Монолитное React приложение

**Содержимое**:
- Редактор потоков (React Flow)
- Палитра узлов
- Панель управления
- Настройки и конфигурация

**Предложения по рефакторингу**:
```
packages/flowise-core-frontend/base → packages/
├── workflow-editor-frontend/       # Редактор потоков
├── node-palette-frontend/          # Палитра узлов
├── dashboard-frontend/             # Основная панель
└── settings-frontend/              # Настройки
```

## Паттерны интеграции

### Workspace пакеты

**Текущий паттерн**:
```json
{
  "dependencies": {
    "@universo/publish-backend": "workspace:*",
    "@universo/profile-backend": "workspace:*"
  }
}
```

**Преимущества**:
- Переиспользование кода
- Типобезопасность между пакетами
- Единая система сборки

### API интеграция

**Текущий паттерн**:
```typescript
// Frontend API клиент
class PublicationApi {
    async getFlowData(flowId: string): Promise<FlowData> {
        return fetch(`/api/v1/publication/flows/${flowId}`);
    }
}

// Backend маршрут
router.get('/flows/:id', async (req, res) => {
    const flowData = await FlowDataService.getById(req.params.id);
    res.json(flowData);
});
```

### Интеграция с Flowise

**Текущий паттерн**:
```typescript
// Регистрация UPDL узлов в Flowise
export const setupBuilders = () => {
    // Интеграция с существующей системой узлов
    registerUPDLNodes();
    registerPublishBuilders();
};
```

## Ограничения текущей архитектуры

### Масштабируемость

1. **Монолитный сервер**: Все API в одном процессе
2. **Единая база данных**: Все данные в одной схеме
3. **Отсутствие горизонтального масштабирования**

### Производительность

1. **Клиентская обработка UPDL**: Вся обработка в браузере
2. **Отсутствие кэширования**: Нет распределенного кэша
3. **Синхронные операции**: Блокирующие операции в API

### Безопасность

1. **Единая точка отказа**: Компрометация сервера = компрометация всего
2. **Ограниченная изоляция**: Приложения не изолированы друг от друга
3. **Отсутствие rate limiting**: Нет защиты от DDoS

### Разработка

1. **Тесная связанность**: Изменения в одном компоненте влияют на другие
2. **Сложность тестирования**: Сложно тестировать компоненты изолированно
3. **Длительная сборка**: Все приложения собираются вместе

## Связанные страницы

- [Существующие приложения](existing-apps.md)
- [Анализ packages](packages-analysis.md)
- [Паттерны интеграции](integration-patterns.md)
- [Целевая архитектура](../target-architecture/README.md)

## Статус анализа

- [x] Анализ существующих приложений
- [x] Анализ packages структуры
- [x] Выявление ограничений
- [x] Предложения по улучшению

---
*Последнее обновление: 5 августа 2025*
