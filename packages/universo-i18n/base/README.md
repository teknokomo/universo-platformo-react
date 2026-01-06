# @universo/i18n

> 🌍 Centralized i18n instance for Universo Platformo monorepo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/i18n` |
| **Version** | See `package.json` |
| **Type** | TypeScript-first (Internationalization) |
| **Build** | ES module with types |
| **Purpose** | Unified translation system with full type safety |

## 🚀 Key Features

- ✅ **Single global instance** - Prevents multiple i18next instances
- ✅ **TypeScript first** - Full type safety
- ✅ **Automatic registration** - FRT packages register their namespaces on import
- ✅ **Side-effect initialization** - Just import and it works
- ✅ **Browser language detection** - Auto-detects user's language
- ✅ **Persistent language choice** - Saves to localStorage
- ✅ **Supported languages registry** - Central list in `supported-languages.json` used by apps and build tooling
- ✅ **Meta namespace** - Centralized metadata strings for HTML head synchronization

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

## TypeScript Type Safety

This package provides **full TypeScript type safety** for all translation keys using i18next's native Module Augmentation feature.

### Core Namespaces (Automatic)

Core namespaces (`common`, `header`, `spaces`, `roles`, `access`, `meta`) and view namespaces (e.g., `chatbot`, `admin`, `menu`) get automatic type checking:

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('chatbot')
  
  // ✅ Valid keys - autocomplete works
  t('share.title')
  t('embedBot.customization')
  
  // ❌ Compile error - key doesn't exist
  t('invalidKey')  // TypeScript error: Argument of type '"invalidKey"' is not assignable...
}
```

### Feature Package Namespaces (Typed Hooks)

Feature packages (`metaverses-frontend`, `uniks-frontend`, `publish-frontend`) provide typed hooks for their namespaces:

```typescript
// Instead of this (no type safety):
import { useTranslation } from '@universo/i18n'
const { t } = useTranslation('publish')

// Use this (full type safety):
import { usePublishTranslation } from '@universo/publish-frontend/i18n/types'
const { t } = usePublishTranslation()

// Now you get:
t('title')        // ✅ Autocomplete + type checking
t('description')  // ✅ Autocomplete + type checking
t('wrongKey')     // ❌ TypeScript compile error
```

**Available typed hooks:**
- `useMetaversesTranslation()` from `@universo/metaverses-frontend/i18n/types`
- `useUniksTranslation()` from `@universo/uniks-frontend/i18n/types`
- `usePublishTranslation()` from `@universo/publish-frontend/i18n/types`

## Supported Languages

Supported languages are defined in `src/supported-languages.json` and wired into i18next via `supportedLngs`. Frontends and build tooling (e.g., HTML injection) read this list to keep `lang` and meta tags consistent.

```json
[
  "en",
  "ru"
]
```

Update this list when adding new locales and keep translations in sync.

### How It Works

1. **Module Augmentation**: The `src/i18next.d.ts` file extends i18next's `CustomTypeOptions` interface with all namespace types
2. **JSON Type Imports**: TypeScript infers exact translation key structure from JSON files
3. **No Runtime Cost**: All type checking happens at compile time - zero performance impact
4. **IDE Integration**: Full autocomplete support in VS Code, WebStorm, and other TypeScript-aware editors

### Adding New Translation Keys

When you add a new key to a JSON file:

```json
// packages/universo-i18n/base/locales/en/views/chatbot.json
{
  "chatbot": {
    "share": {
      "title": "Share Chatbot",
      "newKey": "My New Translation"  // ← Added this
    }
  }
}
```

TypeScript automatically picks it up:

```typescript
const { t } = useTranslation('chatbot')
t('share.newKey')  // ✅ Immediately available with autocomplete
```

**No rebuild required** - TypeScript reads the JSON files directly.

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
// packages/my-frontend/base/src/i18n/index.ts
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

FRT packages (publish-frontend, analytics-frontend, etc.)
  └─ i18n/index.ts → calls registerNamespace()

App packages (flowise-ui, template-mui, etc.)
  → import '@universo/i18n'
```

## Base Namespaces

The following namespaces are included by default (EN + RU):

- `common`, `header`, `spaces`, `roles`, `access`, `meta`
- `admin`, `auth`, `canvas`, `canvases`, `chatbot`, `chatmessage`
- `flowList`, `menu`, `profile-menu`, `templates`
- Dialog namespaces such as `about`, `manageLinks`, `viewLeads`, etc.

> Module-specific namespaces (document-store, vector-store, assistants, tools, credentials, variables, api-keys, etc.) are **registered by their respective feature packages**. Import those packages (e.g., `import '@flowise/docstore-frontend/i18n'`) before rendering the related routes/components.

FRT packages add their own namespaces dynamically.

## Contributing

When contributing to this package:

1. Follow TypeScript best practices and maintain strict typing
2. Keep EN and RU translations synchronized
3. Update namespace types when adding new translation keys
4. Test typed hooks with real components
5. Update both EN and RU documentation
6. Follow the project's coding standards

## Related Documentation

- [Main Apps Documentation](../README.md)
- [Flowise UI](../flowise-ui/base/README.md)
- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)

---

_Universo Platformo | i18n Package_
