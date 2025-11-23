# Projects Frontend (`@universo/projects-frt`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Frontend для управления трёхуровневой структурой проектов (Projects → Milestones → Tasks).

## Технологический стек

- React 18 + TypeScript + Material-UI v5
- React Query + React Router v6
- i18next (EN/RU) + tsdown build

## Основные компоненты

- **ProjectList**: Список проектов с CRUD операциями
- **ProjectDetail**: Детальная страница с Milestones и Tasks
- **MilestoneList**: Управление этапами проекта
- **TaskList**: Управление задачами

## API Integration

```typescript
import { ProjectsApi } from '@universo/projects-frt';

await api.getProjects({ page, limit });
await api.createProject(data);
await api.getMilestones({ projectId });
await api.getTasks({ projectId, milestoneId });
```

## Hooks

```typescript
const { projects, createProject } = useProjects();
const { milestones, createMilestone } = useMilestones(projectId);
const { tasks, createTask } = useTasks({ projectId, milestoneId });
```

## Связанная документация

- [Projects Backend](backend.md)
- [Projects Overview](README.md)
