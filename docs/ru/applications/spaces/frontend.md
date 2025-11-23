# Spaces Frontend (`@universo/spaces-frt`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Frontend для управления Flow-холстами (canvases) и пространствами.

## Технологический стек

- React 18 + TypeScript + Material-UI v5
- React Query + React Flow (canvas editor)
- i18next (EN/RU)

## Основные компоненты

- **SpaceList**: Список пространств пользователя
- **SpaceEditor**: Canvas редактор (React Flow)
- **NodePalette**: Палитра UPDL узлов
- **SpaceSettings**: Настройки пространства

## API Integration

```typescript
import { SpacesApi } from '@universo/spaces-frt';

await api.getSpaces({ page, limit });
await api.createSpace(data);
await api.getSpace(id);
await api.updateSpaceCanvas(id, canvasData);
```

## Hooks

```typescript
const { spaces, createSpace } = useSpaces();
const { space, updateCanvas } = useSpace(spaceId);
```

## Canvas Format

```json
{
  "nodes": [...],
  "edges": [...],
  "metadata": {...}
}
```

## Связанная документация

- [Spaces Backend](backend.md)
- [Spaces Overview](README.md)
- [UPDL](../updl/README.md)
