# @universo/storages-srv

> 🏗️ **Современный пакет** - TypeScript-first архитектура с Express.js и TypeORM

Бэкенд сервис для управления хранилищами, контейнерами и слотами с полной изоляцией данных и валидацией.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend Service Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Современная с Express.js + TypeORM

## Ключевые функции

### Трёхуровневая архитектура
- **хранилищы**: Независимые организационные единицы с полной изоляцией данных
- **контейнеры**: Логические группировки внутри хранилищов (обязательная привязка к хранилищу)
- **слоты**: Отдельные активы внутри контейнеров (обязательная привязка к контейнеру)
- **Таблицы связей**: Отношения многие-ко-многим с CASCADE удалением и UNIQUE ограничениями

### Изоляция данных и безопасность
- Полная изоляция хранилищов - нет межкластерного доступа к данным
- Обязательные ассоциации предотвращают сиротские слоты
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках
- Авторизация на уровне приложения с защитой хранилищов/контейнеров/слотов
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
pnpm --filter @universo/storages-srv build
```

## Использование

### Интеграция Express Router
```typescript
import express from 'express'
import { storagesRouter } from '@universo/storages-srv'

const app = express()

// Подключение маршрутов хранилищов
app.use('/api/storages', storagesRouter)
app.use('/api/containers', containersRouter) 
app.use('/api/slots', slotsRouter)

app.listen(3000)
```

### Настройка TypeORM
```typescript
import { getDataSource } from '@universo/storages-srv/database'
import { storage, container, slot } from '@universo/storages-srv/slots'

// Инициализация подключения к базе данных
const dataSource = await getDataSource()

// Использование репозиториев
const clusterRepo = dataSource.getRepository(storage)
const storages = await clusterRepo.find()
```

## Справочник API

### Эндпоинты хранилищов
```http
GET    /storages                      # Список всех хранилищов
POST   /storages                      # Создать хранилищ
GET    /storages/:id                  # Получить детали хранилища
PUT    /storages/:id                  # Обновить хранилищ
DELETE /storages/:id                  # Удалить хранилищ (CASCADE)

# Связи хранилищов
GET    /storages/:id/containers         # Получить контейнеры в хранилище
POST   /storages/:id/containers/:domainId  # Связать контейнер (идемпотентно)
GET    /storages/:id/slots         # Получить слоты в хранилище
POST   /storages/:id/slots/:resourceId   # Связать слот (идемпотентно)
```

### Эндпоинты контейнеров
```http
GET    /containers                        # Список всех контейнеров
POST   /containers                        # Создать контейнер (требует clusterId)
GET    /containers/:id                    # Получить детали контейнера
PUT    /containers/:id                    # Обновить контейнер
DELETE /containers/:id                    # Удалить контейнер (CASCADE)

# Связи контейнеров
GET    /containers/:id/slots           # Получить слоты в контейнере
POST   /containers/:id/slots/:resourceId # Связать слот (идемпотентно)
```

### Эндпоинты слотов
```http
GET    /slots                        # Список всех слотов
POST   /slots                        # Создать слот (требует domainId)
GET    /slots/:id                    # Получить детали слота
PUT    /slots/:id                    # Обновить слот
DELETE /slots/:id                    # Удалить слот
```

### Примеры запросов/ответов

#### Создать хранилищ
```http
POST /storages
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

#### Создать слот с привязкой к контейнеру
```http
POST /slots
Content-Type: application/json

{
  "name": "Аватар игрока",
  "description": "3D модель персонажа",
  "domainId": "660e8400-e29b-41d4-a716-446655440001",
  "clusterId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Модель данных

### Основные сущности
```typescript
@slot({ name: 'storages' })
export class storage {
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

@slot({ name: 'containers' })
export class container {
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

@slot({ name: 'slots' })
export class slot {
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
@slot({ name: 'resources_clusters' })
export class ResourceCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => slot, { onDelete: 'CASCADE' })
  slot: slot

  @ManyToOne(() => storage, { onDelete: 'CASCADE' })
  storage: storage

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE ограничение на (resource_id, cluster_id)
}

@slot({ name: 'resources_domains' })
export class ResourceDomain {
  // Аналогичная структура для связи слотов и контейнеров
}

@slot({ name: 'domains_clusters' })  
export class DomainCluster {
  // Аналогичная структура для связи контейнеров и хранилищов
}
```

## Валидация и бизнес-правила

### Валидация входных данных
```typescript
import { z } from 'zod'

// Схема валидации слота
const createResourceSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  domainId: z.string().uuid('Требуется валидный ID контейнера'),
  clusterId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Схема валидации контейнера
const createDomainSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  clusterId: z.string().uuid('Требуется валидный ID хранилища')
})
```

### Бизнес-правила
- **Создание слота**: Требует валидный `domainId`, опциональный `clusterId`
- **Создание контейнера**: Требует валидный `clusterId` для привязки
- **Создание хранилища**: Самостоятельная сущность, без зависимостей
- **Атомарные операции**: Все создания связей транзакционны
- **CASCADE удаление**: Удаление родительских сущностей удаляет всех потомков
- **Уникальность**: Таблицы связей предотвращают дублирование отношений

## Схема базы данных

### Интеграция миграций
```typescript
// миграции автоматически регистрируются через центральную систему
import { clusterMigrations } from '@universo/storages-srv/migrations'

// Регистрация сущностей в flowise-server
export * from '@universo/storages-srv/slots'
```

### Структура основных таблиц
```sql
-- Основные сущности с UUID первичными ключами
CREATE TABLE storages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы связей с CASCADE и UNIQUE ограничениями
CREATE TABLE resources_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, domain_id)  -- Предотвращает дублирование
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
│   ├── storages.ts   # CRUD операции хранилищов
│   ├── containers.ts     # Управление контейнерами
│   └── slots.ts     # Операции с слотами
├── database/           # Слой базы данных
│   ├── slots/       # Сущности TypeORM
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
describe('storageService', () => {
  test('создаёт хранилищ с валидными данными', async () => {
    const storage = await storageService.create({
      name: 'Тестовый хранилищ',
      description: 'Тестовое описание'
    })
    expect(storage.name).toBe('Тестовый хранилищ')
  })
})

// Интеграционные тесты для контроллеров
describe('POST /storages', () => {
  test('возвращает 201 с валидным payload', async () => {
    const response = await request(app)
      .post('/storages')
      .send({ name: 'Тестовый хранилищ' })
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
- Авторизация на уровне приложения с защитой хранилищов/контейнеров/слотов
- Предотвращение IDOR (Insecure Direct Object Reference) атак
- Предотвращение межкластерного доступа
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
- [`@universo/storages-frt`](../storages-frt/base/README.md) - Фронтенд клиент
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Сервис аутентификации
- [`@universo/utils`](../universo-utils/base/README.md) - Общие утилиты

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления хранилищами*
