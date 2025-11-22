# @universo/organizations-srv

> 🏗️ **Современный пакет** - TypeScript-first архитектура с Express.js и TypeORM

Бэкенд сервис для управления организациями, отделами и должностями с полной изоляцией данных и валидацией.

## Информация о пакете

- **Версия**: 0.1.0
- **Тип**: Backend Service Package (TypeScript)
- **Статус**: ✅ Активная разработка
- **Архитектура**: Современная с Express.js + TypeORM

## Ключевые функции

### Трёхуровневая архитектура
- **Организации**: Независимые организационные единицы с полной изоляцией данных
- **Отделы**: Логические группировки внутри организаций (обязательная привязка к организации)
- **Должности**: Отдельные активы внутри отделов (обязательная привязка к отделу)
- **Таблицы связей**: Отношения многие-ко-многим с CASCADE удалением и UNIQUE ограничениями

### Изоляция данных и безопасность
- Полная изоляция организаций - нет межорганизационного доступа к данным
- Обязательные ассоциации предотвращают сиротские должности
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках
- Авторизация на уровне приложения с защитой организаций/отделов/должностей
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
pnpm --filter @universo/organizations-srv build
```

## Использование

### Интеграция Express Router
```typescript
import express from 'express'
import { organizationsRouter } from '@universo/organizations-srv'

const app = express()

// Подключение маршрутов организаций
app.use('/api/organizations', organizationsRouter)
app.use('/api/departments', departmentsRouter) 
app.use('/api/positions', positionsRouter)

app.listen(3000)
```

### Настройка TypeORM
```typescript
import { getDataSource } from '@universo/organizations-srv/database'
import { Organization, Department, Position } from '@universo/organizations-srv/entities'

// Инициализация подключения к базе данных
const dataSource = await getDataSource()

// Использование репозиториев
const organizationRepo = dataSource.getRepository(Organization)
const organizations = await organizationRepo.find()
```

## Справочник API

### Эндпоинты организаций
```http
GET    /organizations                      # Список всех организаций
POST   /organizations                      # Создать организацию
GET    /organizations/:id                  # Получить детали организации
PUT    /organizations/:id                  # Обновить организацию
DELETE /organizations/:id                  # Удалить организацию (CASCADE)

# Связи организаций
GET    /organizations/:id/departments         # Получить отделы в организации
POST   /organizations/:id/departments/:departmentId  # Связать отдел (идемпотентно)
GET    /organizations/:id/positions         # Получить должности в организации
POST   /organizations/:id/positions/:positionId   # Связать должность (идемпотентно)
```

### Эндпоинты отделов
```http
GET    /departments                        # Список всех отделов
POST   /departments                        # Создать отдел (требует organizationId)
GET    /departments/:id                    # Получить детали отдела
PUT    /departments/:id                    # Обновить отдел
DELETE /departments/:id                    # Удалить отдел (CASCADE)

# Связи отделов
GET    /departments/:id/positions           # Получить должности в отделе
POST   /departments/:id/positions/:positionId # Связать должность (идемпотентно)
```

### Эндпоинты должностей
```http
GET    /positions                        # Список всех должностей
POST   /positions                        # Создать должность (требует departmentId)
GET    /positions/:id                    # Получить детали должности
PUT    /positions/:id                    # Обновить должность
DELETE /positions/:id                    # Удалить должность
```

### Примеры запросов/ответов

#### Создать организацию
```http
POST /organizations
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

#### Создать должность с привязкой к отделу
```http
POST /positions
Content-Type: application/json

{
  "name": "Аватар игрока",
  "description": "3D модель персонажа",
  "departmentId": "660e8400-e29b-41d4-a716-446655440001",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "model": "character.fbx",
    "animations": ["idle", "walk", "run"]
  }
}
```

## Модель данных

### Основные сущности
```typescript
@Entity({ name: 'organizations' })
export class Organization {
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

@Entity({ name: 'departments' })
export class Department {
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

@Entity({ name: 'positions' })
export class Position {
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
@Entity({ name: 'position_organizations' })
export class PositionOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Position, { onDelete: 'CASCADE' })
  position: Position

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization

  @CreateDateColumn()
  createdAt: Date
  
  // UNIQUE ограничение на (position_id, organization_id)
}

@Entity({ name: 'position_departments' })
export class PositionDepartment {
  // Аналогичная структура для связи должностей и отделов
}

@Entity({ name: 'department_organizations' })  
export class DepartmentOrganization {
  // Аналогичная структура для связи отделов и организаций
}
```

## Валидация и бизнес-правила

### Валидация входных данных
```typescript
import { z } from 'zod'

// Схема валидации должности
const createPositionSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  departmentId: z.string().uuid('Требуется валидный ID отдела'),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
})

// Схема валидации отдела
const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  description: z.string().optional(),
  organizationId: z.string().uuid('Требуется валидный ID организации')
})
```

### Бизнес-правила
- **Создание должности**: Требует валидный `departmentId` (ID отдела), опциональный `organizationId` (ID организации)
- **Создание отдела**: Требует валидный `organizationId` (ID организации) для привязки
- **Создание организации**: Самостоятельная сущность, без зависимостей
- **Атомарные операции**: Все создания связей транзакционны
- **CASCADE удаление**: Удаление родительских сущностей удаляет всех потомков
- **Уникальность**: Таблицы связей предотвращают дублирование отношений

## Схема базы данных

### Интеграция миграций
```typescript
// миграции автоматически регистрируются через центральную систему
import { clusterMigrations } from '@universo/organizations-srv/migrations'

// Регистрация сущностей в flowise-server
export * from '@universo/organizations-srv/positions'
```

### Структура основных таблиц
```sql
-- Основные сущности с UUID первичными ключами
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы связей с CASCADE и UNIQUE ограничениями
CREATE TABLE position_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(position_id, department_id)  -- Предотвращает дублирование
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
│   ├── organizations.ts   # CRUD операции организаций
│   ├── departments.ts     # Управление отделами
│   └── positions.ts     # Операции с должностями
├── database/           # Слой базы данных
│   ├── positions/       # Сущности TypeORM
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
describe('ClusterService', () => {
  test('создаёт организацию с валидными данными', async () => {
    const organization = await clusterService.create({
      name: 'Тестовая организация',
      description: 'Тестовое описание'
    })
    expect(organization.name).toBe('Тестовая организация')
  })
})

// Интеграционные тесты для контроллеров
describe('POST /organizations', () => {
  test('возвращает 201 с валидным payload', async () => {
    const response = await request(app)
      .post('/organizations')
      .send({ name: 'Тестовая организация' })
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
- Авторизация на уровне приложения с защитоя организаций/отделов/должностей
- Предотвращение IDOR (Insecure Direct Object Reference) атак
- Предотвращение межорганизацияного доступа
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
- [`@universo/organizations-frt`](../organizations-frt/base/README.md) - Фронтенд клиент
- [`@universo/auth-srv`](../auth-srv/base/README.md) - Сервис аутентификации
- [`@universo/utils`](../universo-utils/base/README.md) - Общие утилиты

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления организациями*
