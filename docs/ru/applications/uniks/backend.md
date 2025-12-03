# `packages/uniks-backend` — Uniks Backend — [Статус: MVP]

Backend сервис для управления рабочими пространствами с TypeORM, RLS и расширенной ролевой моделью.

## Назначение

Предоставляет API для CRUD операций над рабочими пространствами, управления участниками и валидации ролей.

## Ключевые возможности

- **CRUD операции**: TypeORM repositories для всех операций
- **Валидация участия и ролей**: Централизованный сервис
- **RLS изоляция данных**: Через `uniks` схему PostgreSQL
- **Passport.js сессии**: + Supabase JWT валидация
- **Кэширование**: Разрешение участия для каждого запроса
- **Строгие роли**: owner/admin/editor/member

## API Endpoints

### Workspace Management

```
GET    /uniks              # Список workspaces пользователя
POST   /uniks              # Создать новый workspace
GET    /uniks/:id          # Детали workspace
PUT    /uniks/:id          # Обновить workspace
DELETE /uniks/:id          # Удалить workspace
```

### Member Management

```
POST   /uniks/members           # Добавить участника
DELETE /uniks/members/:userId   # Удалить участника
GET    /uniks/:id/members       # Список участников
```

## Архитектура базы данных

### Unik Entity

```typescript
@Entity({ schema: 'uniks', name: 'uniks' })
export class Unik {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ type: 'text' }) name!: string
    @Column({ type: 'text', nullable: true }) description?: string
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
    @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date
    @OneToMany(() => UnikUser, (uu) => uu.unik) memberships!: UnikUser[]
}
```

### UnikUser Entity

```typescript
@Entity({ schema: 'uniks', name: 'uniks_users' })
export class UnikUser {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ name: 'user_id', type: 'uuid' }) userId!: string
    @Column({ name: 'unik_id', type: 'uuid' }) unikId!: string
    @Column({ type: 'text' }) role!: UnikRole
    @ManyToOne(() => Unik) @JoinColumn({ name: 'unik_id' }) unik!: Unik
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
}
```

## Ролевая модель

| Роль | Назначение | Примеры |
|------|------------|--------|
| owner | Полный контроль | Удаление workspace, повышение ролей |
| admin | Административное управление | Добавление/удаление участников |
| editor | Вклад в контент | Создание/обновление ресурсов |
| member | Базовое участие | Просмотр и базовые действия |

## Безопасность

### Аутентификация & Авторизация

- Passport.js сессии + Supabase JWT bridge
- Контекст пользователя для каждого запроса
- Кэширование участия
- Role-based permission gates

### Защита данных

- RLS политики для видимости на основе участия
- TypeORM параметризация против SQL инъекций
- Валидация входных данных
- Санитизация сообщений об ошибках

## Разработка

```bash
pnpm build --filter @universo/uniks-backend
pnpm --filter @universo/uniks-backend dev
pnpm --filter @universo/uniks-backend test
```

## Технологии

- **Express.js**: Web framework
- **TypeORM**: Database ORM
- **PostgreSQL**: Primary database
- **Supabase**: Authentication
- **TypeScript**: Type safety

## См. также

- [Uniks Frontend](./frontend.md) - UI компонент
- [Uniks README](./README.md) - Общее описание системы
