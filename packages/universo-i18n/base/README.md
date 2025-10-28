# @universo/i18n

Centralized i18n instance for Universo Platformo monorepo.

## Features

- ✅ **Single global instance** - Prevents multiple i18next instances
- ✅ **TypeScript first** - Full type safety
- ✅ **Automatic registration** - FRT packages register their namespaces on import
- ✅ **Side-effect initialization** - Just import and it works
- ✅ **Browser language detection** - Auto-detects user's language
- ✅ **Persistent language choice** - Saves to localStorage

## Usage

### In your app entry point

```typescript
// Just import for side-effect initialization
import '@universo/i18n'
```

### In React components

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('myNamespace')
  return <div>{t('myKey')}</div>
}
```

### Using Common Translations

The `common` namespace provides universal UI translations that are shared across all packages:

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('myNamespace')
  
  return (
    <div>
      {/* Access common translations directly */}
      <button>{t('common.save')}</button>
      <button>{t('common.cancel')}</button>
      
      {/* Use pagination translations with interpolation */}
      <p>{t('common.pagination.showing', { start: 1, end: 10, total: 100 })}</p>
      
      {/* Table column headers */}
      <th>{t('common.table.actions')}</th>
      <th>{t('common.table.name')}</th>
    </div>
  )
}
```

**Available Common Sections:**
- `common.actions.*` - UI actions (save, cancel, delete, edit, create, add, back, close, invite, refresh, remove)
- `common.pagination.*` - Pagination (showing, noResults, page, rowsPerPage)
- `common.table.*` - Table columns (actions, name, description, id, role, sections, entities, added, email)
- `common.dialog.*` - Dialog labels (title, description, required)
- `common.list.*` - List states (searchPlaceholder)
- `common.crud.*` - CRUD operations (nameRequired)
- `common.saving`, `common.deleting` - Action states

### Registering namespace from FRT package

```typescript
// packages/my-frt/base/src/i18n/index.ts
import { registerNamespace } from '@universo/i18n/registry'
import type { NamespaceTranslations } from '@universo/i18n/types'

import enMyApp from './locales/en/myApp.json'
import ruMyApp from './locales/ru/myApp.json'

export const myAppTranslations: NamespaceTranslations = {
  en: { myApp: enMyApp },
  ru: { myApp: ruMyApp }
}

// Auto-register on import
registerNamespace('my-app', myAppTranslations)

export default myAppTranslations
```

### Direct instance access

```typescript
import i18n from '@universo/i18n'

// Change language
i18n.changeLanguage('ru')

// Get translation
i18n.t('translation:key')
```

## Architecture

```
@universo/i18n (core package)
  ├─ instance.ts (singleton + base translations)
  ├─ registry.ts (registerNamespace API)
  └─ locales/ (base translations from flowise-ui)

FRT packages (publish-frt, analytics-frt, etc.)
  └─ i18n/index.ts → calls registerNamespace()

App packages (flowise-ui, template-mui, etc.)
  → import '@universo/i18n'
```

## Base Namespaces

The following namespaces are included by default:

- `translation` - Main translations
- `auth` - Authentication
- `admin` - Admin panel
- `menu` - Menu items
- `assistants` - AI assistants
- `vector-store` - Vector store
- `document-store` - Document store
- `credentials` - Credentials
- `api-keys` - API keys
- `variables` - Variables
- `tools` - Tools
- `templates` - Templates
- `canvases` - Canvases
- `chatmessage` - Chat messages
- `flowList` - Flow lists

FRT packages add their own namespaces dynamically.
