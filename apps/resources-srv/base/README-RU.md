# Сервис ресурсов (resources-srv)

Backend сервис для управления кластерами, доменами и ресурсами с полной изоляцией данных и валидацией в экосистеме Universo Platformo.

## Обзор

Сервис ресурсов реализует трёхуровневую архитектуру (Кластеры → Домены → Ресурсы) со строгой изоляцией данных, комплексной валидацией и безопасным управлением связями. Все операции обеспечивают целостность данных через паттерн TypeORM Repository и ограничения PostgreSQL.

## Архитектура

### Связи сущностей
- **Кластеры**: Независимые организационные единицы с полной изоляцией данных
- **Домены**: Логические группировки внутри кластеров (обязательная привязка к кластеру)
- **Ресурсы**: Отдельные активы внутри доменов (обязательная привязка к домену)
- **Таблицы связей**: Отношения многие-ко-многим с CASCADE удалением и UNIQUE ограничениями

### Изоляция данных и безопасность
- Полная изоляция кластеров - нет межкластерного доступа к данным
- Обязательные ассоциации предотвращают осиротевшие сущности
- Идемпотентные операции для управления связями
- Комплексная валидация входных данных с понятными сообщениями об ошибках

## API эндпоинты

### Кластеры
- `GET /clusters` – Список всех кластеров
- `POST /clusters` – Создать кластер
- `GET /clusters/:id` – Получить детали кластера
- `PUT /clusters/:id` – Обновить кластер
- `DELETE /clusters/:id` – Удалить кластер (CASCADE удаляет домены/ресурсы)
- `GET /clusters/:id/domains` – Получить домены в кластере
- `POST /clusters/:id/domains/:domainId` – Связать домен с кластером (идемпотентно)
- `GET /clusters/:id/resources` – Получить ресурсы в кластере
- `POST /clusters/:id/resources/:resourceId` – Связать ресурс с кластером (идемпотентно)

### Домены
- `GET /domains` – Список всех доменов
- `POST /domains` – Создать домен (требует clusterId)
- `GET /domains/:id` – Получить детали домена
- `PUT /domains/:id` – Обновить домен
- `DELETE /domains/:id` – Удалить домен (CASCADE удаляет ресурсы)
- `GET /domains/:id/resources` – Получить ресурсы в домене
- `POST /domains/:id/resources/:resourceId` – Связать ресурс с доменом (идемпотентно)

### Ресурсы
- `GET /resources` – Список всех ресурсов
- `POST /resources` – Создать ресурс (требует domainId, опциональный clusterId)
- `GET /resources/:id` – Получить детали ресурса
- `PUT /resources/:id` – Обновить ресурс
- `DELETE /resources/:id` – Удалить ресурс

## Модель данных

### Основные сущности

```typescript
@Entity({ name: 'clusters' })
export class Cluster {
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

@Entity({ name: 'domains' })
export class Domain {
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

@Entity({ name: 'resources' })
export class Resource {
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
@Entity({ name: 'resources_clusters' })
export class ResourceCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource

  @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (resource_id, cluster_id)
}

@Entity({ name: 'resources_domains' })
export class ResourceDomain {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Resource, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (resource_id, domain_id)
}

@Entity({ name: 'domains_clusters' })
export class DomainCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Domain, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain

  @ManyToOne(() => Cluster, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: Cluster

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE ограничение на (domain_id, cluster_id)
}
```

## Правила валидации

### Создание ресурса
- `name` обязательно (непустая строка)
- `domainId` обязательно и должно ссылаться на существующий домен
- `clusterId` опционально, но если указано, должно ссылаться на существующий кластер
- Атомарное создание связи ресурс-домен
- Атомарное создание связи ресурс-кластер (если указан clusterId)

### Создание домена
- `name` обязательно (непустая строка)
- `clusterId` обязательно и должно ссылаться на существующий кластер
- Атомарное создание связи домен-кластер

### Создание кластера
- `name` обязательно (непустая строка)
- Дополнительных ограничений нет

## Структура базы данных

```sql
-- Основные таблицы
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы связей с CASCADE удалением и UNIQUE ограничениями
CREATE TABLE resources_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, cluster_id)
);

CREATE TABLE resources_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource_id, domain_id)
);

CREATE TABLE domains_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(domain_id, cluster_id)
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
pnpm --filter @universo/resources-srv build

# Запуск тестов
pnpm --filter @universo/resources-srv test

# Проверка линтером
pnpm --filter @universo/resources-srv lint
```

### Примечания по безопасности
- На уровне приложения добавлены строгие проверки доступа (guards) по кластерам/доменам/ресурсам, чтобы исключить IDOR и межкластерные утечки.
- Политики RLS в БД рассматриваются как дополнительный уровень защиты, однако при подключении через TypeORM они не активны без прокидывания контекста JWT запроса; полагаться только на RLS нельзя.
- Для `/resources`, `/clusters` и `/domains` включено ограничение частоты запросов (rate limit).
- Применяются HTTP‑заголовки безопасности через Helmet (CSP отложена для API‑сценария).

### Настройка базы данных
Сервис использует TypeORM с PostgreSQL. Миграции автоматически регистрируются и могут быть запущены через систему миграций основного приложения.

### Переменные окружения
Настройте подключение к базе данных через конфигурацию окружения основного приложения.

## Связанная документация
- [Приложение Resources Frontend](../../../apps/resources-frt/base/README.md)
- [Документация приложения Resources](../../../docs/ru/applications/resources/README.md)

---

**Universo Platformo | Сервис Resources Backend**
