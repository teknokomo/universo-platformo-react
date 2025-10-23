# Сервис метавселенных (metaverses-srv)

Backend сервис для управления метавселенными, секциями и сущностями с полной изоляцией данных и валидацией в экосистеме Universo Platformo.

## Обзор

Сервис метавселенных реализует трёхуровневую архитектуру (Метавселенные → Секции → Сущности) со строгой изоляцией данных, комплексной валидацией и безопасным управлением связями. Все операции обеспечивают целостность данных через паттерн TypeORM Repository и ограничения PostgreSQL.

## Архитектура

### Связи сущностей
- **Метавселенные**: Независимые организационные единицы с полной изоляцией данных
- **Секции**: Логические группировки внутри метавселенных (обязательная привязка к метавселенной)
- **Сущности**: Отдельные активы внутри секций (обязательная привязка к секции)
- **Таблицы связей**: Отношения многие-ко-многим с CASCADE удалением и UNIQUE ограничениями

### Изоляция данных и безопасность
- Полная изоляция метавселенных - нет межметавселенского доступа к данным
- Обязательные ассоциации предотвращают осиротевшие сущности
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках

## API эндпоинты

### Метавселенные
- `GET /metaverses` – Список всех метавселенных
- `POST /metaverses` – Создать метавселенную
- `GET /metaverses/:id` – Получить детали метавселенной
- `PUT /metaverses/:id` – Обновить метавселенную
- `DELETE /metaverses/:id` – Удалить метавселенную (CASCADE удаляет секции/сущности)
- `GET /metaverses/:id/sections` – Получить секции в метавселенной
- `POST /metaverses/:id/sections/:sectionId` – Связать секцию с метавселенной (идемпотентно)
- `GET /metaverses/:id/entities` – Получить сущности в метавселенной
- `POST /metaverses/:id/entities/:entityId` – Связать сущность с метавселенной (идемпотентно)

### Секции
- `GET /sections` – Список всех секций
- `POST /sections` – Создать секцию (требует metaverseId)
- `GET /sections/:id` – Получить детали секции
- `PUT /sections/:id` – Обновить секцию
- `DELETE /sections/:id` – Удалить секцию (CASCADE удаляет сущности)
- `GET /sections/:id/entities` – Получить сущности в секции
- `POST /sections/:id/entities/:entityId` – Связать сущность с секцией (идемпотентно)

### Сущности
- `GET /entities` – Список всех сущностей
- `POST /entities` – Создать сущность (требует sectionId, опциональный metaverseId)
- `GET /entities/:id` – Получить детали сущности
- `PUT /entities/:id` – Обновить сущность
- `DELETE /entities/:id` – Удалить сущность

## Модель данных

### Основные сущности

```typescript
@Entity({ name: 'metaverses' })
export class Metaverse {
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

@Entity({ name: 'sections' })
export class Section {
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

@Entity({ name: 'entities' })
export class Entity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

### Таблицы связей (отношения многие-ко-многим)

```typescript
@Entity({ name: 'entities_metaverses' })
export class EntityMetaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metaverse_id' })
  metaverse: Metaverse

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (entity_id, metaverse_id)
}

@Entity({ name: 'entities_sections' })
export class EntitySection {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (entity_id, section_id)
}

@Entity({ name: 'sections_metaverses' })
export class SectionMetaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section

  @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metaverse_id' })
  metaverse: Metaverse

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (section_id, metaverse_id)
}
```

## Правила валидации

### Создание сущности
- `name` обязательно (непустая строка)
- `sectionId` обязательно и должно ссылаться на существующую секцию
- `metaverseId` опционально, но если указано, должно ссылаться на существующую метавселенную
- Атомарное создание связи сущность-секция
- Атомарное создание связи сущность-метавселенная (если указан metaverseId)

### Создание секции
- `name` обязательно (непустая строка)
- `metaverseId` обязательно и должно ссылаться на существующую метавселенную
- Атомарное создание связи секция-метавселенная

### Создание метавселенной
- `name` обязательно (непустая строка)
- Дополнительных ограничений нет

## Структура базы данных

```sql
-- Основные таблицы
CREATE TABLE metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы связей с CASCADE удалением и UNIQUE ограничениями
CREATE TABLE entities_metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  metaverse_id UUID NOT NULL REFERENCES metaverses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_id, metaverse_id)
);

CREATE TABLE entities_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_id, section_id)
);

CREATE TABLE sections_metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  metaverse_id UUID NOT NULL REFERENCES metaverses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, metaverse_id)
);
```

## Разработка

### Предварительные требования
- Node.js 18+
- Менеджер пакетов PNPM
- База данных PostgreSQL

### Команды
```bash
# Установка зависимостей (из корня проекта)
pnpm install

# Сборка сервиса
pnpm --filter @universo/metaverses-srv build

# Запуск тестов
pnpm --filter @universo/metaverses-srv test

# Проверка линтером
pnpm --filter @universo/metaverses-srv lint
```

### Примечания по безопасности
- На уровне приложения добавлены строгие проверки доступа (guards) по метавселенным/секциям/сущностям, чтобы исключить IDOR и межметавселенские утечки.
- Политики RLS в БД рассматриваются как дополнительный уровень защиты, однако при подключении через TypeORM они не активны без прокидывания контекста JWT запроса; полагаться только на RLS нельзя.
- Для `/entities`, `/metaverses` и `/sections` включено ограничение частоты запросов (rate limit).
- Применяются HTTP‑заголовки безопасности через Helmet (CSP отложена для API‑сценария).

### Настройка базы данных
Сервис использует TypeORM с PostgreSQL. Миграции автоматически регистрируются и могут быть запущены через систему миграций основного приложения.

### Переменные окружения
Настройте подключение к базе данных через конфигурацию окружения основного приложения.

## Связанная документация
- [Приложение Metaverses Frontend](../../../packages/metaverses-frt/base/README.md)
- [Документация приложения Metaverses](../../../docs/ru/applications/metaverses/README.md)

---

**Universo Platformo | Сервис Metaverses Backend**
