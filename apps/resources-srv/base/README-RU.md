# Сервис ресурсов (resources-srv)

Пакет рабочей области backend для управления переиспользуемыми ресурсами и их композициями в экосистеме Universo Platformo.

## API‑эндпоинты

### Категории
- `GET /resources/categories` – Получить список всех категорий
- `POST /resources/categories` – Создать категорию
- `GET /resources/categories/:id` – Получить сведения о категории
- `PUT /resources/categories/:id` – Обновить категорию
- `DELETE /resources/categories/:id` – Удалить категорию

### Ресурсы
- `GET /resources` – Получить список ресурсов
- `POST /resources` – Создать ресурс
- `GET /resources/:id` – Получить сведения о ресурсе
- `PUT /resources/:id` – Обновить ресурс
- `DELETE /resources/:id` – Удалить ресурс

### Ревизии
- `GET /resources/:id/revisions` – Получить список ревизий ресурса
- `POST /resources/:id/revisions` – Создать ревизию
- `GET /resources/:id/revisions/:revId` – Получить сведения о ревизии
- `DELETE /resources/:id/revisions/:revId` – Удалить ревизию

### Композиция
- `POST /resources/:id/children` – Добавить дочерний ресурс
- `DELETE /resources/:id/children/:childId` – Удалить дочерний ресурс
- `GET /resources/:id/tree` – Получить рекурсивное дерево композиции

## Модель данных

```ts
interface ResourceCategory {
  id: string
  slug: string
  parentCategory?: ResourceCategory
  titleEn: string
  titleRu: string
  descriptionEn?: string
  descriptionRu?: string
}

interface ResourceState { id: string; code: string; label: string }
interface StorageType { id: string; code: string; label: string }

interface Resource {
  id: string
  category: ResourceCategory
  state: ResourceState
  storageType: StorageType
  slug: string
  titleEn: string
  titleRu: string
  descriptionEn?: string
  descriptionRu?: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

interface ResourceRevisionData {
  categoryId: string
  stateId: string
  storageTypeId: string
  slug: string
  titleEn: string
  titleRu: string
  descriptionEn?: string
  descriptionRu?: string
  metadata: Record<string, any>
}

interface ResourceRevision {
  id: string
  resource: Resource
  version: number
  data: ResourceRevisionData
  authorId?: string
  createdAt: Date
}

interface ResourceComposition {
  id: string
  parentResource: Resource
  childResource: Resource
  quantity: number
  sortOrder: number
  isRequired: boolean
  config: Record<string, any>
}
```

## Разработка

```bash
pnpm install
pnpm --filter @universo/resources-srv build
```
