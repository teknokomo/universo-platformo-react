# Управление рабочими пространствами (Uniks)

Система управления рабочими пространствами Uniks предоставляет функциональность для создания, организации и администрирования коллаборативных рабочих сред внутри экосистемы Universo Platformo.

> Эта страница обновлена для новой архитектуры: Passport.js + Supabase сессии, TypeORM репозитории, схема `uniks` и строгая модель ролей.

## Обновлённый обзор архитектуры

```
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│   uniks-frontend   │◄──►│   uniks-backend    │◄──►│  Main Server    │
│ (Frontend)    │    │ (Workspace API)│    │ (platform core)│
└───────────────┘    └────────────────┘    └────────────────┘
        │                    │                      │
        ▼                    ▼                      ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│   React/MUI   │    │  TypeORM +     │    │  Passport.js +  │
│   i18n(ts)    │    │  PostgreSQL    │    │  Supabase Auth  │
└───────────────┘    └────────────────┘    └────────────────┘
                         │
                         ▼
                 Схема `uniks` + RLS
```

## Ключевые изменения (2025 Q3)

| Область | Было | Стало |
|---------|------|-------|
| Хранение данных | Supabase REST таблицы `user_uniks` | Схема `uniks` с таблицами `uniks.uniks`, `uniks.uniks_users` + TypeORM |
| Контроль доступа | Роли implicit (owner/member) | Строгие роли: owner, admin, editor, member |
| Доступ к БД | Через Supabase JS клиент | Через TypeORM репозитории + RLS на уровне Postgres |
| Аутентификация | Только Supabase JWT | Passport.js сессионный мост + Supabase валидация |
| Политики безопасности | role='authenticated' | Политики EXISTS membership + минимально необходимые привилегии |

## Схема данных

### Таблица рабочих пространств
```sql
CREATE TABLE uniks.uniks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Таблица членства
```sql
CREATE TABLE uniks.uniks_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unik_id UUID REFERENCES uniks.uniks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, unik_id)
);
```

### Политики RLS (пример)
```sql
ALTER TABLE uniks.uniks ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniks.uniks_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY uniks_select_members ON uniks.uniks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM uniks.uniks_users mu
    WHERE mu.unik_id = uniks.id AND mu.user_id = auth.uid()
  ));
```

## Ролевая модель

| Роль | Назначение | Примеры действий |
|------|------------|------------------|
| owner | Абсолютный контроль | Удаление workspace, повышение ролей |
| admin | Администрирование | Добавление/удаление участников, изменение метаданных |
| editor | Контент | Создание/редактирование ресурсов внутри workspace |
| member | Доступ | Просмотр и базовые операции |

## Паттерн проверки доступа
```typescript
const userId = req.user?.id
const allowed = ['admin','owner'] as const
const membership = await WorkspaceAccessService.ensure(userId, unikId, allowed)
// membership содержит актуальную роль и кэшируется на время запроса
```

## Структура фронтенда (`uniks-frontend`)
- Список рабочих пространств
- Детальная страница + управление участниками
- Диалог создания/редактирования
- i18n EN/RU

## Структура бэкенда (`uniks-backend`)
- Express роуты `/uniks`, `/uniks/:id/members`
- TypeORM сущности `Unik`, `UnikUser`
- Сервис доступа `WorkspaceAccessService`
- Middleware сессий Passport.js

## API (обновлённый)
```
GET    /uniks                 # Список доступных пользователю
POST   /uniks                 # Создание (создатель становится owner)
GET    /uniks/:id             # Детали
PUT    /uniks/:id             # Обновление (admin/owner)
DELETE /uniks/:id             # Удаление (owner)

GET    /uniks/:id/members     # Список участников (любой member)
POST   /uniks/:id/members     # Добавить участника (admin/owner)
PUT    /uniks/:id/members/:userId  # Изменить роль (owner)
DELETE /uniks/:id/members/:userId  # Удалить (owner)
```

## Миграция с устаревшей модели
1. Обновить существующую миграцию `AddUniks` (не создавать новую)
2. Переименовать `user_uniks` -> `uniks.uniks_users`
3. Добавить схему `uniks`
4. Включить RLS + политики
5. Перейти на репозитории TypeORM в коде сервисов

## Best Practices
- Не делать прямые SQL в контроллерах — только через репозитории
- Кэширование членства внутри одного запроса
- Ошибки доступа возвращать统一 (401/403) без утечки деталей
- Логи ошибок без экспонирования внутренних идентификаторов

## Диагностика проблем
| Симптом | Проверка |
|---------|----------|
| 403 при валидном участнике | Роль входит ли в allowed? RLS включен? |
| Пустой список workspaces | Пользователь не добавлен в `uniks_users` |
| Ошибка схемы 42P01 | Выполнен ли шаг миграции создания схемы? |

## План расширений
- Гранулярные разрешения (feature flags per workspace)
- Аудит лог действий участников
- Кэш Redis для membership snapshot'ов
- Массовые операции приглашений

---
Обновлено: 2025-09-21
