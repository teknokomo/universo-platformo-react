# Organizations Backend (`@universo/organizations-backend`)

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

## Обзор

Backend пакет модуля Organizations предоставляет RESTful API для управления трёхуровневой структурой организаций (Organizations → Departments → Positions). Построен на Express.js, TypeORM и PostgreSQL с полной поддержкой Row-Level Security (RLS).

## Технологический стек

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: TypeORM 0.3.x
- **Database**: PostgreSQL (через Supabase)
- **Authentication**: Passport.js + Supabase JWT
- **Validation**: class-validator, class-transformer
- **Security**: RLS policies, JWT verification
- **TypeScript**: Полная типизация

## Архитектура пакета

```
packages/organizations-backend/base/
├── src/
│   ├── database/
│   │   ├── entities/
│   │   │   ├── Organization.ts
│   │   │   ├── OrganizationUser.ts
│   │   │   ├── Department.ts
│   │   │   ├── DepartmentOrganization.ts
│   │   │   ├── Position.ts
│   │   │   ├── PositionDepartment.ts
│   │   │   └── PositionOrganization.ts
│   │   └── migrations/
│   │       └── postgres/
│   │           ├── index.ts
│   │           └── 1741500000000-AddOrganizationsDepartmentsPositions.ts
│   ├── routes/
│   │   └── organizationsRoutes.ts
│   ├── services/
│   │   ├── OrganizationService.ts
│   │   ├── DepartmentService.ts
│   │   └── PositionService.ts
│   ├── guards/
│   │   └── guards.ts
│   └── types/
│       └── index.ts
├── package.json
└── tsconfig.json
```

## Модель данных

### Entity-Relationship диаграмма

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│  Organization   │◄─────►│ OrganizationUser     │──────►│   AuthUser       │
│                 │       │                      │       │                  │
│ - id            │       │ - organizationId     │       │ - id             │
│ - name          │       │ - userId             │       │ - email          │
│ - slug          │       │ - role (enum)        │       │ - password       │
│ - description   │       │ - createdAt          │       └──────────────────┘
│ - metadata      │       └──────────────────────┘
│ - createdAt     │
└────────┬────────┘
         │
         │ many-to-many
         ▼
┌─────────────────┐       ┌──────────────────────┐
│   Department    │◄─────►│ DepartmentOrganization│
│                 │       │                      │
│ - id            │       │ - departmentId       │
│ - name          │       │ - organizationId     │
│ - description   │       └──────────────────────┘
│ - createdAt     │
└────────┬────────┘
         │
         │ many-to-many
         ▼
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│    Position     │◄─────►│  PositionDepartment  │       │ PositionOrganization │
│                 │       │                      │       │                      │
│ - id            │       │ - positionId         │◄──────┤ - positionId         │
│ - name          │       │ - departmentId       │       │ - organizationId     │
│ - description   │       └──────────────────────┘       └──────────────────────┘
│ - metadata      │
│ - createdAt     │
└─────────────────┘
```

### Entities

#### Organization

```typescript
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### OrganizationUser (Membership)

```typescript
@Entity('organizations_users')
@Unique(['organizationId', 'userId'])
export class OrganizationUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER
  })
  role: OrganizationRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => AuthUser)
  @JoinColumn({ name: 'user_id' })
  user: AuthUser;
}
```

**Роли:**
```typescript
export enum OrganizationRole {
  OWNER = 'owner',   // Полный контроль
  ADMIN = 'admin',   // Управление членами
  MEMBER = 'member'  // Базовый доступ
}
```

#### Department

```typescript
@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### DepartmentOrganization (Join Table)

```typescript
@Entity('departments_organizations')
@Unique(['departmentId', 'organizationId'])
export class DepartmentOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'department_id' })
  departmentId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
```

#### Position

```typescript
@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## REST API

### Organizations

**GET /api/v1/organizations**
Получить список организаций пользователя.

Query Parameters:
- `page` (default: 1)
- `limit` (default: 10)
- `search` (optional)

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "description": "Company description",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

**GET /api/v1/organizations/:id**
Получить организацию по ID.

**POST /api/v1/organizations**
Создать новую организацию.

Body:
```json
{
  "name": "New Organization",
  "description": "Optional description",
  "metadata": {}
}
```

**PATCH /api/v1/organizations/:id**
Обновить организацию.

**DELETE /api/v1/organizations/:id**
Удалить организацию (только owner).

### Organization Members

**GET /api/v1/organizations/:id/members**
Получить список участников.

Response:
```json
{
  "data": [
    {
      "userId": "uuid",
      "role": "admin",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**POST /api/v1/organizations/:id/members**
Добавить участника.

Body:
```json
{
  "userId": "uuid",
  "role": "member"
}
```

**PATCH /api/v1/organizations/:orgId/members/:userId**
Изменить роль участника.

Body:
```json
{
  "role": "admin"
}
```

**DELETE /api/v1/organizations/:orgId/members/:userId**
Удалить участника.

### Departments

**GET /api/v1/departments**
Получить список департаментов.

Query:
- `organizationId` (required)
- `page`, `limit`

**POST /api/v1/departments**
Создать департамент.

Body:
```json
{
  "name": "Engineering",
  "description": "Tech department",
  "organizationIds": ["org-uuid"]
}
```

**PATCH /api/v1/departments/:id**
Обновить департамент.

**DELETE /api/v1/departments/:id**
Удалить департамент.

### Positions

**GET /api/v1/positions**
Получить список позиций.

Query:
- `organizationId` (optional)
- `departmentId` (optional)
- `page`, `limit`

**POST /api/v1/positions**
Создать позицию.

Body:
```json
{
  "name": "Senior Developer",
  "description": "Lead engineering role",
  "departmentId": "dept-uuid",
  "organizationId": "org-uuid",
  "metadata": {
    "level": "senior",
    "salary_range": "100k-150k"
  }
}
```

**PATCH /api/v1/positions/:id**
Обновить позицию.

**DELETE /api/v1/positions/:id**
Удалить позицию.

## Services

### OrganizationService

Бизнес-логика для организаций.

```typescript
class OrganizationService {
  async create(data: CreateOrganizationDto, userId: string) {
    // 1. Создать организацию
    const org = await orgRepo.save({
      name: data.name,
      slug: generateSlug(data.name),
      description: data.description
    });
    
    // 2. Добавить создателя как owner
    await orgUserRepo.save({
      organizationId: org.id,
      userId,
      role: OrganizationRole.OWNER
    });
    
    return org;
  }

  async getByUser(userId: string, options: PaginationOptions) {
    return orgUserRepo
      .createQueryBuilder('ou')
      .leftJoin('ou.organization', 'org')
      .where('ou.userId = :userId', { userId })
      .andWhere('org.deletedAt IS NULL')
      .skip(options.offset)
      .take(options.limit)
      .getMany();
  }

  async addMember(orgId: string, userId: string, role: OrganizationRole, requesterId: string) {
    // 1. Проверить права (только admin/owner)
    await this.checkPermission(orgId, requesterId, 'admin');
    
    // 2. Добавить участника
    return orgUserRepo.save({
      organizationId: orgId,
      userId,
      role
    });
  }
}
```

### DepartmentService

Управление департаментами.

```typescript
class DepartmentService {
  async create(data: CreateDepartmentDto) {
    const dept = await deptRepo.save({
      name: data.name,
      description: data.description
    });
    
    // Связать с организациями (many-to-many)
    await deptOrgRepo.save(
      data.organizationIds.map(orgId => ({
        departmentId: dept.id,
        organizationId: orgId
      }))
    );
    
    return dept;
  }
}
```

## Row-Level Security (RLS)

### Политики безопасности

**Organizations:**
```sql
-- Пользователи видят только свои организации
CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id FROM organizations_users
    WHERE user_id = auth.uid()
  )
);

-- Только owner может удалить
CREATE POLICY "Only owners can delete"
ON organizations FOR DELETE
USING (
  id IN (
    SELECT organization_id FROM organizations_users
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);
```

**OrganizationUsers:**
```sql
-- Пользователи видят участников своих организаций
CREATE POLICY "View organization members"
ON organizations_users FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organizations_users
    WHERE user_id = auth.uid()
  )
);
```

**Departments & Positions:**
Аналогично - изоляция по organizationId через join таблицы.

### Реализация в коде

```typescript
import { getDataSource } from '@universo/flowise-server/src/DataSource';

// RLS автоматически применяется через Supabase JWT
const organizations = await getDataSource()
  .getRepository(Organization)
  .find(); // Вернёт только организации пользователя
```

## Guards (Middleware)

### Access Guards

```typescript
import { createAccessGuards } from './guards';

const { requireOrganizationAccess } = createAccessGuards();

// В маршруте
router.delete(
  '/organizations/:id',
  requireOrganizationAccess('owner'), // Только owner
  async (req, res) => {
    await organizationService.delete(req.params.id);
    res.status(204).send();
  }
);
```

**Доступные guards:**
```typescript
requireOrganizationAccess('owner' | 'admin' | 'member')
requireDepartmentAccess()
requirePositionAccess()
```

### Проверка прав

```typescript
async function checkPermission(
  orgId: string,
  userId: string,
  requiredRole: 'owner' | 'admin'
) {
  const membership = await orgUserRepo.findOne({
    where: { organizationId: orgId, userId }
  });
  
  if (!membership) {
    throw new UnauthorizedError('Not a member');
  }
  
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const requiredLevel = roleHierarchy[requiredRole];
  const userLevel = roleHierarchy[membership.role];
  
  if (userLevel < requiredLevel) {
    throw new ForbiddenError('Insufficient permissions');
  }
}
```

## Миграции

### Основная миграция

`1741500000000-AddOrganizationsDepartmentsPositions.ts`:

```typescript
export class AddOrganizationsDepartmentsPositions1741500000000 {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Создать таблицы
    await queryRunner.query(`
      CREATE TABLE organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 2. Включить RLS
    await queryRunner.query(`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;`);
    
    // 3. Создать политики
    await queryRunner.query(`
      CREATE POLICY "Users see their orgs"
      ON organizations FOR SELECT
      USING (
        id IN (
          SELECT organization_id FROM organizations_users
          WHERE user_id = auth.uid()
        )
      );
    `);
    
    // ... остальные таблицы и политики
  }
}
```

### Регистрация миграций

`packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts`:

```typescript
import { postgresMigrations as orgMigrations } from '@universo/organizations-backend/base/src/database/migrations/postgres';

export const postgresMigrations = [
  ...existingMigrations,
  ...orgMigrations
];
```

## Интеграция

### Регистрация в flowise-server

**1. Entities:**
```typescript
// packages/flowise-core-backend/base/src/database/entities/index.ts
import {
  Organization,
  OrganizationUser,
  Department,
  DepartmentOrganization,
  Position,
  PositionDepartment,
  PositionOrganization
} from '@universo/organizations-backend';

export const entities = [
  ...existingEntities,
  Organization,
  OrganizationUser,
  Department,
  DepartmentOrganization,
  Position,
  PositionDepartment,
  PositionOrganization
];
```

**2. Routes:**
```typescript
// packages/flowise-core-backend/base/src/routes/index.ts
import { registerOrganizationsRoutes } from '@universo/organizations-backend';

export function registerRoutes(app: Express) {
  registerOrganizationsRoutes(app);
  // ... другие маршруты
}
```

**3. Dependencies:**
```json
{
  "dependencies": {
    "@universo/organizations-backend": "workspace:*"
  }
}
```

## Тестирование

### Unit тесты

```typescript
import { OrganizationService } from './OrganizationService';

describe('OrganizationService', () => {
  let service: OrganizationService;
  
  beforeEach(() => {
    service = new OrganizationService();
  });
  
  test('creates organization with owner', async () => {
    const result = await service.create(
      { name: 'Test Org' },
      'user-id'
    );
    
    expect(result.slug).toBe('test-org');
    // Проверить, что создан OrganizationUser с role='owner'
  });
});
```

### Integration тесты

```typescript
import request from 'supertest';
import { app } from '../app';

describe('Organizations API', () => {
  test('POST /organizations', async () => {
    const response = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ name: 'New Org' });
    
    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('new-org');
  });
});
```

## Производительность

### Индексы

```sql
CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_org_users_user ON organizations_users(user_id);
CREATE INDEX idx_org_users_org ON organizations_users(organization_id);
CREATE INDEX idx_dept_org_org ON departments_organizations(organization_id);
CREATE INDEX idx_pos_dept_dept ON positions_departments(department_id);
```

### Кэширование

Используется Redis для кэширования частых запросов:

```typescript
import { redisClient } from '@universo/flowise-server';

async function getCachedOrganizations(userId: string) {
  const cacheKey = `orgs:${userId}`;
  const cached = await redisClient.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const orgs = await organizationService.getByUser(userId);
  await redisClient.setex(cacheKey, 300, JSON.stringify(orgs)); // 5 min
  
  return orgs;
}
```

## Безопасность

### Валидация ввода

```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const orgLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // 100 запросов
});

router.use('/api/v1/organizations', orgLimiter);
```

## Мониторинг

### Логирование

```typescript
import { logger } from '@universo/flowise-server';

logger.info('Organization created', {
  organizationId: org.id,
  userId: req.user.id
});
```

### Метрики

```typescript
import { metrics } from '@universo/flowise-server';

metrics.increment('organizations.created');
metrics.timing('organizations.query_time', duration);
```

## Связанная документация

- [Organizations Frontend](frontend.md) - Frontend компоненты
- [Organizations Overview](README.md) - Общий обзор
- [TypeORM Documentation](https://typeorm.io/) - ORM документация
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security) - Row-Level Security
