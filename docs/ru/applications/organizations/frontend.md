# Organizations Frontend (`@universo/organizations-frt`)

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

## Обзор

Frontend пакет модуля Organizations предоставляет полный пользовательский интерфейс для управления трёхуровневой структурой организаций (Organizations → Departments → Positions). Построен на React 18, TypeScript и Material-UI с поддержкой интернационализации.

## Технологический стек

- **React**: 18.x (с hooks)
- **TypeScript**: Полная типизация
- **UI Framework**: Material-UI (MUI) v5
- **State Management**: React Query для серверного состояния
- **Routing**: React Router v6
- **i18n**: i18next (EN/RU)
- **Forms**: React Hook Form + Zod валидация
- **Build**: tsdown (dual CJS + ESM)

## Архитектура пакета

```
packages/organizations-frt/base/
├── src/
│   ├── api/              # API клиенты
│   │   └── organizations.ts
│   ├── components/       # React компоненты
│   │   ├── OrganizationList.tsx
│   │   ├── OrganizationDetail.tsx
│   │   ├── OrganizationMembers.tsx
│   │   ├── DepartmentList.tsx
│   │   ├── PositionList.tsx
│   │   └── forms/
│   │       ├── OrganizationForm.tsx
│   │       ├── DepartmentForm.tsx
│   │       └── PositionForm.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useOrganizations.ts
│   │   ├── useDepartments.ts
│   │   └── usePositions.ts
│   ├── types/            # TypeScript типы
│   │   └── index.ts
│   └── i18n/             # Переводы
│       ├── en/
│       │   └── organizations.json
│       └── ru/
│           └── organizations.json
├── dist/                 # Compiled output
│   ├── index.js         # CJS
│   └── index.mjs        # ESM
├── package.json
├── tsconfig.json
└── tsconfig.esm.json
```

## Основные компоненты

### 1. OrganizationList

Список организаций с пагинацией, поиском и фильтрацией.

**Функции:**
- Отображение организаций в виде карточек или таблицы
- Поиск по названию
- Пагинация (10/25/50 элементов)
- Действия: создать, редактировать, удалить, просмотр членов

**Пример использования:**
```tsx
import { OrganizationList } from '@universo/organizations-frt';

function MyPage() {
  return <OrganizationList />;
}
```

### 2. OrganizationDetail

Детальная страница организации с вкладками.

**Вкладки:**
- **Обзор**: Основная информация (название, описание, slug)
- **Департаменты**: Список департаментов организации
- **Позиции**: Список позиций организации
- **Участники**: Управление членством пользователей

**Props:**
```tsx
interface OrganizationDetailProps {
  organizationId: string;
}
```

### 3. OrganizationMembers

Компонент управления членством пользователей.

**Функции:**
- Список участников с ролями (owner/admin/member)
- Добавление новых участников
- Изменение ролей
- Удаление участников
- Проверка прав доступа

**Роли:**
- `owner`: Полный доступ, передача владения
- `admin`: Управление участниками и настройками
- `member`: Просмотр и базовые операции

### 4. DepartmentList

Список департаментов с иерархией.

**Функции:**
- Отображение департаментов текущей организации
- Связь департаментов с организациями (many-to-many)
- CRUD операции
- Фильтрация по организации

### 5. PositionList

Список позиций с иерархией.

**Функции:**
- Отображение позиций с привязкой к департаментам и организациям
- CRUD операции
- Фильтрация по департаменту/организации
- Отображение метаданных позиции

## Формы

### OrganizationForm

Форма создания/редактирования организации.

**Поля:**
- `name` (обязательно): Название организации
- `description`: Описание
- `slug` (auto-generated): URL-дружественный идентификатор
- `metadata`: Дополнительные данные (JSON)

**Валидация:**
```typescript
const schema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  metadata: z.record(z.any()).optional()
});
```

### DepartmentForm

Форма департамента с выбором родительской организации.

**Поля:**
- `name`: Название департамента
- `description`: Описание
- `organizations`: Массив ID организаций (many-to-many)

### PositionForm

Форма позиции с выбором департамента и организации.

**Поля:**
- `name`: Название позиции
- `description`: Описание
- `departmentId`: ID департамента
- `organizationId`: ID организации
- `metadata`: Дополнительные данные

## Hooks

### useOrganizations

React Query hook для работы с организациями.

**Методы:**
```typescript
const {
  organizations,      // Список организаций
  isLoading,         // Загрузка
  error,             // Ошибка
  createOrganization,// Создать
  updateOrganization,// Обновить
  deleteOrganization,// Удалить
  refetch            // Обновить данные
} = useOrganizations();
```

**Кэширование:**
- React Query автоматически кэширует данные
- Stale time: 5 минут
- Cache time: 10 минут

### useDepartments

Hook для работы с департаментами.

```typescript
const {
  departments,
  isLoading,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = useDepartments(organizationId);
```

### usePositions

Hook для работы с позициями.

```typescript
const {
  positions,
  isLoading,
  createPosition,
  updatePosition,
  deletePosition
} = usePositions({ organizationId, departmentId });
```

## API клиент

### Конфигурация

```typescript
import { OrganizationsApi } from '@universo/organizations-frt';

const api = new OrganizationsApi({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  timeout: 10000
});
```

### Методы

**Organizations:**
```typescript
api.getOrganizations({ page, limit, search })
api.getOrganization(id)
api.createOrganization(data)
api.updateOrganization(id, data)
api.deleteOrganization(id)
api.getOrganizationMembers(id)
api.addOrganizationMember(id, { userId, role })
api.updateOrganizationMemberRole(orgId, userId, role)
api.removeOrganizationMember(orgId, userId)
```

**Departments:**
```typescript
api.getDepartments({ organizationId, page, limit })
api.createDepartment(data)
api.updateDepartment(id, data)
api.deleteDepartment(id)
```

**Positions:**
```typescript
api.getPositions({ organizationId, departmentId, page, limit })
api.createPosition(data)
api.updatePosition(id, data)
api.deletePosition(id)
```

## Интернационализация

### Структура переводов

**Русский** (`i18n/ru/organizations.json`):
```json
{
  "organization": {
    "title": "Организации",
    "create": "Создать организацию",
    "edit": "Редактировать организацию",
    "delete": "Удалить организацию"
  },
  "department": {
    "title": "Департаменты",
    "create": "Создать департамент"
  },
  "position": {
    "title": "Позиции",
    "create": "Создать позицию"
  },
  "members": {
    "title": "Участники",
    "add": "Добавить участника",
    "role": {
      "owner": "Владелец",
      "admin": "Администратор",
      "member": "Участник"
    }
  }
}
```

**Английский** (`i18n/en/organizations.json`): аналогично с переводом.

### Использование

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('organizations');
  
  return <h1>{t('organization.title')}</h1>;
}
```

## Интеграция в приложение

### Добавление в Flowise UI

**1. Установка зависимости:**
```json
{
  "dependencies": {
    "@universo/organizations-frt": "workspace:*"
  }
}
```

**2. Импорт компонентов:**
```tsx
// В flowise-ui/src/index.jsx
import {
  OrganizationList,
  OrganizationDetail
} from '@universo/organizations-frt';
```

**3. Добавление маршрутов:**
```tsx
// В template-mui/src/routes/MainRoutesMUI.tsx
import { OrganizationList, OrganizationDetail } from '@universo/organizations-frt';

const routes = [
  {
    path: '/organizations',
    element: <OrganizationList />
  },
  {
    path: '/organizations/:id',
    element: <OrganizationDetail />
  }
];
```

**4. Добавление в меню:**
```tsx
// В template-mui/src/config/menuConfigs.ts
export const getOrganizationMenuItems = (t) => [
  {
    id: 'organizations',
    title: t('menu.organizations'),
    type: 'item',
    url: '/organizations',
    icon: icons.OrganizationIcon
  }
];
```

## Стилизация

### Кастомизация темы

```tsx
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@universo/template-mui';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2'
    }
  }
});

<ThemeProvider theme={theme}>
  <OrganizationList />
</ThemeProvider>
```

### CSS классы

Используются CSS модули и styled-components:

```tsx
import { styled } from '@mui/material/styles';

const OrganizationCard = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius
}));
```

## Безопасность

### Проверка прав доступа

```tsx
import { useAuth } from '@universo/auth-frt';

function SecureComponent() {
  const { user, hasPermission } = useAuth();
  
  if (!hasPermission('organization:write')) {
    return <AccessDenied />;
  }
  
  return <OrganizationForm />;
}
```

### RLS интеграция

Frontend автоматически отправляет Supabase JWT в заголовках:

```typescript
axios.interceptors.request.use(config => {
  const token = getSupabaseToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

## Тестирование

### Unit тесты

```tsx
import { render, screen } from '@testing-library/react';
import { OrganizationList } from './OrganizationList';

test('renders organization list', () => {
  render(<OrganizationList />);
  expect(screen.getByText('Организации')).toBeInTheDocument();
});
```

### Интеграционные тесты

```tsx
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient();

test('creates organization', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationForm onSubmit={mockSubmit} />
    </QueryClientProvider>
  );
  // ... тест создания
});
```

## Производительность

### Оптимизации

1. **Lazy loading**: Компоненты загружаются по требованию
2. **Мemoization**: React.memo для тяжелых компонентов
3. **Виртуализация**: react-window для длинных списков
4. **Debounce**: Поиск с задержкой 300ms
5. **Кэширование**: React Query автоматически кэширует

### Bundle size

```
@universo/organizations-frt
├── CJS: 15.18 kB
└── ESM: 14.04 kB
```

## Roadmap

- [ ] Drag & drop для изменения иерархии
- [ ] Bulk операции (массовое удаление/редактирование)
- [ ] Экспорт в CSV/Excel
- [ ] Визуализация иерархии (org chart)
- [ ] Настраиваемые поля метаданных
- [ ] Webhooks для событий

## Связанная документация

- [Organizations Backend](backend.md) - Backend API
- [Organizations Overview](README.md) - Общий обзор
- [@universo/template-mui](../../universo-template-mui/README.md) - UI компоненты
- [@universo/auth-frt](../auth/frontend.md) - Аутентификация
