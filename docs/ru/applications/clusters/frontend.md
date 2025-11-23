# Clusters Frontend (`@universo/clusters-frt`)

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и адаптируется для Universo Platformo.

## Обзор

Frontend пакет для управления трёхуровневой структурой кластеров (Clusters → Domains → Resources). Обеспечивает изоляцию ресурсов на уровне кластеров.

## Технологический стек

- **React** 18.x + **TypeScript**
- **Material-UI** v5
- **React Query** (серверное состояние)
- **React Router** v6
- **i18next** (EN/RU)
- **Build**: tsdown (CJS + ESM)

## Основные компоненты

### ClusterList
Список кластеров с пагинацией и поиском.

```tsx
import { ClusterList } from '@universo/clusters-frt';

<ClusterList />
```

**Функции:**
- Отображение кластеров пользователя
- Поиск по названию
- Пагинация (10/25/50)
- CRUD операции

### ClusterDetail
Детальная страница кластера с вкладками: Domains, Resources, Members.

### DomainList
Управление доменами кластера.

### ResourceList
Управление ресурсами домена/кластера.

## API Интеграция

```typescript
import { ClustersApi } from '@universo/clusters-frt';

const api = new ClustersApi();

// Кластеры
await api.getClusters({ page, limit, search });
await api.getCluster(id);
await api.createCluster(data);
await api.updateCluster(id, data);
await api.deleteCluster(id);

// Домены
await api.getDomains({ clusterId, page, limit });
await api.createDomain(data);

// Ресурсы
await api.getResources({ clusterId, domainId, page, limit });
await api.createResource(data);
```

## Hooks

### useClusters
```typescript
const {
  clusters,
  isLoading,
  createCluster,
  updateCluster,
  deleteCluster
} = useClusters();
```

### useDomains
```typescript
const {
  domains,
  isLoading,
  createDomain
} = useDomains(clusterId);
```

### useResources
```typescript
const {
  resources,
  isLoading,
  createResource
} = useResources({ clusterId, domainId });
```

## Интернационализация

**Русский** (`i18n/ru/clusters.json`):
```json
{
  "cluster": {
    "title": "Кластеры",
    "create": "Создать кластер"
  },
  "domain": {
    "title": "Домены"
  },
  "resource": {
    "title": "Ресурсы"
  }
}
```

**Использование:**
```tsx
const { t } = useTranslation('clusters');
<h1>{t('cluster.title')}</h1>
```

## Интеграция

**1. Добавить в package.json:**
```json
{
  "dependencies": {
    "@universo/clusters-frt": "workspace:*"
  }
}
```

**2. Добавить маршруты:**
```tsx
import { ClusterList, ClusterDetail } from '@universo/clusters-frt';

const routes = [
  { path: '/clusters', element: <ClusterList /> },
  { path: '/clusters/:id', element: <ClusterDetail /> }
];
```

**3. Добавить в меню:**
```tsx
{
  id: 'clusters',
  title: t('menu.clusters'),
  url: '/clusters',
  icon: icons.ClusterIcon
}
```

## Связанная документация

- [Clusters Backend](backend.md) - Backend API
- [Clusters Overview](README.md) - Общий обзор
- [@universo/template-mui](../../universo-template-mui/README.md) - UI компоненты
