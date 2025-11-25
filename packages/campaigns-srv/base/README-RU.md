# @universo/campaigns-srv

> 🏗️ **Современный пакет** - TypeScript-first архитектура с Express.js и TypeORM

Бэкенд сервис для управления кампаниями, мероприятиями и активностями с полной изоляцией данных и валидацией.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend Service Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Современная с Express.js + TypeORM

## Ключевые функции

### Трёхуровневая архитектура
- **кампании**: Независимые организационные единицы с полной изоляцией данных
- **мероприятия**: Логические группировки внутри кампаний (обязательная привязка к кампании)
- **активности**: Отдельные активы внутри мероприятий (обязательная привязка к мероприятию)
- **Таблицы связей**: Отношения многие-ко-многим с CASCADE удалением и UNIQUE ограничениями

### Изоляция данных и безопасность
- Полная изоляция кампаний - нет между кампаниями доступа к данным
- Обязательные ассоциации предотвращают сиротские активности
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках
- Авторизация на уровне приложения с защитой кампаний/мероприятий/активностей
- Защита от DoS атак с ограничением частоты запросов

### Интеграция с базой данных
- Паттерн TypeORM Repository для всех операций с данными
- PostgreSQL с поддержкой JSONB для метаданных
- Автоматизированные миграции через центральный реестр
- CASCADE удаление связей с UNIQUE ограничениями

## Установка

```bash
# Установка из корня workspace
pnpm install

# Сборка пакета
pnpm --filter @universo/campaigns-srv build
```

## Использование

### Интеграция Express Router
```typescript
import express from 'express'
import { campaignsRouter } from '@universo/campaigns-srv'

const app = express()

// Подключение маршрутов кампаний
app.use('/api/campaigns', campaignsRouter)
app.use('/api/events', eventsRouter) 
app.use('/api/activities', activitiesRouter)

app.listen(3000)
```

### Настройка TypeORM
```typescript
import { getDataSource } from '@universo/campaigns-srv/database'
import { campaign, event, activity } from '@universo/campaigns-srv/activities'

// Инициализация подключения к базе данных
const dataSource = await getDataSource()

// Использование репозиториев
const campaignRepo = dataSource.getRepository(campaign)
const campaigns = await campaignRepo.find()
```

## Справочник API

### Эндпоинты кампаний
```http
GET    /campaigns                      # Список всех кампаний
POST   /campaigns                      # Создать кампанию
GET    /campaigns/:id                  # Получить детали кампании
PUT    /campaigns/:id                  # Обновить кампанию
DELETE /campaigns/:id                  # Удалить кампанию (CASCADE)

# Связи кампаний
GET    /campaigns/:id/events         # Получить мероприятия в кампании
POST   /campaigns/:id/events/:eventId  # Связать мероприятие (идемпотентно)
GET    /campaigns/:id/activities         # Получить активности в кампании
POST   /campaigns/:id/activities/:activityId   # Связать активность (идемпотентно)
```

### Эндпоинты мероприятий
```http
GET    /events                        # Список всех мероприятий
POST   /events                        # Создать мероприятие (требует campaignId)
GET    /events/:id                    # Получить детали мероприятия
PUT    /events/:id                    # Обновить мероприятие
DELETE /events/:id                    # Удалить мероприятие (CASCADE)

# Связи мероприятий
GET    /events/:id/activities           # Получить активности в мероприятии
POST   /events/:id/activities/:activityId # Связать активность (идемпотентно)
```

### Эндпоинты активностей
```http
GET    /activities                        # Список всех активностей
POST   /activities                        # Создать активность (требует eventId)
GET    /activities/:id                    # Получить детали активности
PUT    /activities/:id                    # Обновить активность
DELETE /activities/:id                    # Удалить активность
```

### Примеры запросов/ответов

#### Создать кампанию
```http
POST /campaigns
Content-Type: application/json

{
  "name": "Игровая вселенная",
  "description": "Виртуальные игровые миры и активы"
}
```

Ответ:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Игровая вселенная", 
    "description": "Виртуальные игровые миры и активы",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Создать активность с привязкой к мероприятию
```http
POST /activities
Content-Type: application/json

{
  "name": "Аватар игрока",
  "description": "3D модель персонажа",
  "eventId": "660e8400-e29b-41d4-a716-446655440001",
  "campaignId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Модель данных

### Основные сущности
```typescript
@activity({ name: 'campaigns' })
export class campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@activity({ name: 'events' })
export class event {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@activity({ name: 'activities' })
export class activity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>  // Поддержка JSONB для метаданных

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

### Таблицы связей
```typescript
// Отношения многие-ко-многим с CASCADE удалением
@activity({ name: 'activities_campaigns' })
export class ActivityCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => activity, { onDelete: 'CASCADE' })
  activity: activity

  @ManyToOne(() => campaign, { onDelete: 'CASCADE' })
  campaign: campaign

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE ограничение на (activity_id, campaign_id)
}

@activity({ name: 'activities_events' })
export class ActivityEvent {
  // Аналогичная структура для связи активностей и мероприятий
}

@activity({ name: 'events_campaigns' })  
export class EventCampaign {
  // Аналогичная структура для связи мероприятий и кампаний
}
```

## Валидация и бизнес-правила

### Валидация входных данных
```typescript
import { z } from 'zod'

// Схема валидации активноста
const createActivitySchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  eventId: z.string().uuid('Требуется валидный ID мероприятиа'),
  campaignId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Схема валидации мероприятиа
const createEventSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  campaignId: z.string().uuid('Требуется валидный ID кампании')
})
```

### Бизнес-правила
- **Создание активноста**: Требует валидный `eventId`, опциональный `campaignId`
- **Создание мероприятиа**: Требует валидный `campaignId` для привязки
- **Создание кампании**: Самостоятельная сущность, без зависимостей
- **Атомарные операции**: Все создания связей транзакционны
- **CASCADE удаление**: Удаление родительских сущностей удаляет всех потомков
- **Уникальность**: Таблицы связей предотвращают дублирование отношений

## Схема базы данных

### Интеграция миграций
```typescript
// миграции автоматически регистрируются через центральную систему
import { campaignsMigrations } from '@universo/campaigns-srv/migrations'

// Регистрация сущностей в flowise-server
export * from '@universo/campaigns-srv/activities'
```

### Структура основных таблиц
```sql
-- Основные сущности с UUID первичными ключами
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы связей с CASCADE и UNIQUE ограничениями
CREATE TABLE activities_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(activity_id, event_id)  -- Предотвращает дублирование
);
```

## Разработка

### Предварительные требования
- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- TypeScript 5+

### Доступные скрипты
```bash
# Разработка
pnpm build              # Компиляция TypeScript
pnpm dev                # Разработка с режимом наблюдения
pnpm clean              # Очистка директории dist

# Тестирование  
pnpm test               # Запуск тестового пакета Jest
pnpm test:watch         # Запуск тестов в режиме наблюдения

# Качество кода
pnpm lint               # Запуск ESLint
pnpm type-check         # Проверка компиляции TypeScript
```

### Структура проекта
```
src/
├── controllers/        # Контроллеры маршрутов
│   ├── campaigns.ts   # CRUD операции кампаний
│   ├── events.ts     # Управление мероприятиями
│   └── activities.ts     # Операции с активностями
├── database/           # Слой базы данных
│   ├── activities/       # Сущности TypeORM
│   ├── migrations/     # Миграции базы данных
│   └── repositories/   # Пользовательские репозитории
├── middleware/         # Middleware Express
│   ├── auth.ts         # Аутентификация
│   ├── validation.ts   # Валидация запросов
│   └── rateLimiter.ts  # Ограничение частоты запросов
├── routes/             # Маршруты Express
├── services/           # Бизнес-логика
├── types/              # Определения TypeScript
└── index.ts           # Экспорты пакета
```

### Стратегия тестирования
```typescript
// Юнит-тесты для сервисов
describe('campaignService', () => {
  test('создаёт кампанию с валидными данными', async () => {
    const campaign = await campaignService.create({
      name: 'Тестовая кампания',
      description: 'Тестовое описание'
    })
    expect(campaign.name).toBe('Тестовая кампания')
  })
})

// Интеграционные тесты для контроллеров
describe('POST /campaigns', () => {
  test('возвращает 201 с валидным payload', async () => {
    const response = await request(app)
      .post('/campaigns')
      .send({ name: 'Тестовая кампания' })
    expect(response.status).toBe(201)
  })
})
```

## Безопасность и продакшен

### Ограничение частоты запросов
```typescript
// Разработка: хранилище в памяти
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // ограничение каждого IP до 100 запросов за windowMs
  standardHeaders: true
})

// Продакшен: рекомендуется Redis хранилище
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'rate-limit:'
})
```

### Аутентификация и авторизация
- Авторизация на уровне приложения с защитой кампаний/мероприятий/активностей
- Предотвращение IDOR (Insecure Direct Object Reference) атак
- Предотвращение между кампаниями доступа
- Валидация JWT токенов для защищённых маршрутов

### Безопасность базы данных
- Параметризованные запросы TypeORM предотвращают SQL инъекции
- Политики RLS базы данных как дополнительная защита
- CASCADE удаление ограничений поддерживает ссылочную целостность
- UNIQUE ограничения предотвращают дублирование связей

## Конфигурация

### Переменные окружения
```bash
# База данных
DATABASE_URL=postgresql://user:pass@localhost:5432/universo
DATABASE_SSL=false

# Ограничение частоты запросов
REDIS_URL=redis://localhost:6379

# Безопасность
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

### Конфигурация TypeScript
- Включён строгий режим
- Цель ES2022 с совместимостью Node.js 18
- Сопоставление путей для чистых импортов
- Генерация файлов объявлений для использования библиотеки

## Развёртывание

### Поддержка Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --prod
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Проверки состояния
```typescript
// Эндпоинт состояния для балансировщиков нагрузки
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
})
```

## Связанные пакеты
- [`@universo/campaigns-frt`](../campaigns-frt/base/README.md) - Фронтенд клиент
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Сервис аутентификации
- [`@universo/types`](../universo-types/base/README.md) - Общие типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления кампаниями*
