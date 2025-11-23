# Projects Backend (`@universo/projects-srv`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Backend для трёхуровневой структуры проектов с TypeORM и PostgreSQL.

## Модель данных

**Entities:**
- `Project`: id, name, slug, description, metadata
- `ProjectUser`: projectId, userId, role (owner/admin/member)
- `Milestone`: id, name, description, dueDate
- `MilestoneProject`: join table
- `Task`: id, name, description, status, assignedTo
- `TaskMilestone`, `TaskProject`: join tables

## REST API

```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id

GET    /api/v1/milestones?projectId=uuid
POST   /api/v1/milestones
GET    /api/v1/tasks?projectId=uuid&milestoneId=uuid
POST   /api/v1/tasks
```

## RLS Policies

```sql
CREATE POLICY "Users see their projects"
ON projects FOR SELECT
USING (
  id IN (
    SELECT project_id FROM projects_users
    WHERE user_id = auth.uid()
  )
);
```

## Связанная документация

- [Projects Frontend](frontend.md)
- [Projects Overview](README.md)
