# Resources Service (resources-srv)

Backend workspace package for managing reusable resources and their compositions in the Universo Platformo ecosystem.

## API Endpoints

### Categories
- `GET /resources/categories` – List all categories
- `POST /resources/categories` – Create a category
- `GET /resources/categories/:id` – Get category details
- `PUT /resources/categories/:id` – Update category
- `DELETE /resources/categories/:id` – Delete category

### Resources
- `GET /resources` – List resources
- `POST /resources` – Create a resource
- `GET /resources/:id` – Get resource details
- `PUT /resources/:id` – Update resource
- `DELETE /resources/:id` – Delete resource

### Revisions
- `GET /resources/:id/revisions` – List resource revisions
- `POST /resources/:id/revisions` – Create a revision
- `GET /resources/:id/revisions/:revId` – Get revision details
- `DELETE /resources/:id/revisions/:revId` – Delete revision

### Composition
- `POST /resources/:id/children` – Add child resource
- `DELETE /resources/:id/children/:childId` – Remove child resource
- `GET /resources/:id/tree` – Fetch recursive composition tree

## Data Model

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

interface ResourceRevision {
  id: string
  resource: Resource
  version: number
  data: any
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

## Development

```bash
pnpm install
pnpm --filter @universo/resources-srv build
```
