# Projects Frontend (`@universo/projects-frontend`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend for managing   projects (Projects → Milestones → Tasks).

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- React Query + React Router v6
- i18next (EN/RU) + tsdown build

## Main Components

- **ProjectList**: List projects with CRUD 
- **ProjectDetail**: Detail page with Milestones and Tasks
- **MilestoneList**: Management milestones 
- **TaskList**: Management tasks

## API Integration

```typescript
import { ProjectsApi } from '@universo/projects-frontend';

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

## Related Documentation

- [Projects Backend](backend.md)
- [Projects Overview](README.md)
