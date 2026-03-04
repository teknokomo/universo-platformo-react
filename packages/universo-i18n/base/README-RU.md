# @universo/i18n

> 🌍 Централизованный экземпляр i18n для монорепозитория Universo Platformo

## Информация о пакете

| Поле | Значение |
|------|----------|
| **Имя пакета** | `@universo/i18n` |
| **Версия** | Смотрите `package.json` |
| **Тип** | TypeScript-first (Интернационализация) |
| **Сборка** | ES модуль с типами |
| **Назначение** | Единая система переводов с полной типобезопасностью |

## 🚀 Ключевые возможности

- ✅ **Единый глобальный экземпляр** - Предотвращает множественные экземпляры i18next
- ✅ **TypeScript first** - Полная типобезопасность
- ✅ **Автоматическая регистрация** - FRT пакеты регистрируют свои пространства имен при импорте
- ✅ **Инициализация побочными эффектами** - Просто импортируйте, и всё работает
- ✅ **Определение языка браузера** - Автоматически определяет язык пользователя
- ✅ **Постоянный выбор языка** - Сохраняет в localStorage
- ✅ **Реестр поддерживаемых языков** - Централизованный список в `supported-languages.json`, используется приложениями и сборкой
- ✅ **Пространство имен meta** - Централизованные строки метаданных для синхронизации HTML head

## Использование

### В точке входа приложения

```typescript
// Просто импортируйте для инициализации побочным эффектом
import '@universo/i18n'
```

### В React компонентах

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('myNamespace')
  return <div>{t('myKey')}</div>
}
```

## Типобезопасность TypeScript

Этот пакет обеспечивает **полную типобезопасность TypeScript** для всех ключей переводов, используя нативную функцию Module Augmentation от i18next.

### Основные пространства имен (Автоматические)

Основные пространства имен (`common`, `header`, `spaces`, `roles`, `access`, `meta`) и пространства представлений (например, `chatbot`, `admin`, `menu`) получают автоматическую проверку типов:

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('chatbot')
  
  // ✅ Валидные ключи - автодополнение работает
  t('share.title')
  t('embedBot.customization')
  
  // ❌ Ошибка компиляции - ключ не существует
  t('invalidKey')  // Ошибка TypeScript: Argument of type '"invalidKey"' is not assignable...
}
```

### Пространства имен пакетов функций (Типизированные хуки)

Пакеты функций (`metaverses-frontend`, `uniks-frontend`, `publish-frontend`) предоставляют типизированные хуки для своих пространств имен:

```typescript
// Вместо этого (без типобезопасности):
import { useTranslation } from '@universo/i18n'
const { t } = useTranslation('publish')

// Используйте это (полная типобезопасность):
import { usePublishTranslation } from '@universo/publish-frontend/i18n/types'
const { t } = usePublishTranslation()

// Теперь вы получаете:
t('title')        // ✅ Автодополнение + проверка типов
t('description')  // ✅ Автодополнение + проверка типов
t('wrongKey')     // ❌ Ошибка компиляции TypeScript
```

**Доступные типизированные хуки:**
- `useMetaversesTranslation()` из `@universo/metaverses-frontend/i18n/types`
- `useUniksTranslation()` из `@universo/uniks-frontend/i18n/types`
- `usePublishTranslation()` из `@universo/publish-frontend/i18n/types`

## Поддерживаемые языки

Поддерживаемые языки определены в `src/supported-languages.json` и подключены в i18next через `supportedLngs`. Приложения и инструменты сборки (например, подстановка в HTML) используют этот список, чтобы синхронизировать `lang` и мета-теги.

```json
[
  "en",
  "ru"
]
```

Обновляйте этот список при добавлении новых локалей и держите переводы синхронизированными.

### Как это работает

1. **Module Augmentation**: Файл `src/i18next.d.ts` расширяет интерфейс `CustomTypeOptions` от i18next всеми типами пространств имен
2. **Импорт типов JSON**: TypeScript выводит точную структуру ключей переводов из JSON файлов
3. **Без затрат времени выполнения**: Вся проверка типов происходит во время компиляции - нулевое влияние на производительность
4. **Интеграция IDE**: Полная поддержка автодополнения в VS Code, WebStorm и других TypeScript-совместимых редакторах

### Добавление новых ключей переводов

Когда вы добавляете новый ключ в JSON файл:

```json
// packages/universo-i18n/base/locales/ru/views/chatbot.json
{
  "chatbot": {
    "share": {
      "title": "Поделиться чатботом",
      "newKey": "Мой новый перевод"  // ← Добавлено это
    }
  }
}
```

TypeScript автоматически подхватывает его:

```typescript
const { t } = useTranslation('chatbot')
t('share.newKey')  // ✅ Сразу доступен с автодополнением
```

**Пересборка не требуется** - TypeScript читает JSON файлы напрямую.

### Использование общих переводов

Пространство имен `common` предоставляет универсальные переводы UI, которые используются во всех пакетах:

```typescript
import { useTranslation } from '@universo/i18n'

export const MyComponent = () => {
  const { t } = useTranslation('myNamespace')
  
  return (
    <div>
      {/* Прямой доступ к общим переводам */}
      <button>{t('common.save')}</button>
      <button>{t('common.cancel')}</button>
      
      {/* Использование переводов пагинации с интерполяцией */}
      <p>{t('common.pagination.showing', { start: 1, end: 10, total: 100 })}</p>
      
      {/* Заголовки столбцов таблицы */}
      <th>{t('common.table.actions')}</th>
      <th>{t('common.table.name')}</th>
    </div>
  )
}
```

**Доступные общие разделы:**
- `common.actions.*` - UI действия (save, cancel, delete, edit, create, add, back, close, invite, refresh, remove)
- `common.pagination.*` - Пагинация (showing, noResults, page, rowsPerPage)
- `common.table.*` - Столбцы таблицы (actions, name, description, id, role, sections, entities, added, email)
- `common.dialog.*` - Метки диалогов (title, description, required)
- `common.list.*` - Состояния списков (searchPlaceholder)
- `common.crud.*` - CRUD операции (nameRequired)
- `common.saving`, `common.deleting` - Состояния действий

### Регистрация пространства имен из FRT пакета

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

// Автоматическая регистрация при импорте
registerNamespace('my-app', myAppTranslations)

export default myAppTranslations
```

### Прямой доступ к экземпляру

```typescript
import i18n from '@universo/i18n'

// Смена языка
i18n.changeLanguage('ru')

// Получение перевода
i18n.t('translation:key')
```

## Архитектура

```
@universo/i18n (основной пакет)
  ├─ instance.ts (синглтон + базовые переводы)
  ├─ registry.ts (API registerNamespace)
  └─ locales/ (базовые переводы из flowise-ui)

FRT пакеты (publish-frontend, analytics-frontend, и т.д.)
  └─ i18n/index.ts → вызывает registerNamespace()

Пакеты приложений (flowise-ui, template-mui, и т.д.)
  → import '@universo/i18n'
```

## Базовые пространства имен

Следующие пространства имен включены по умолчанию (EN + RU):

- `common`, `header`, `spaces`, `roles`, `access`, `meta`
- `admin`, `auth`, `canvas`, `canvases`, `chatbot`, `chatmessage`
- `flowList`, `menu`, `profile-menu`, `templates`
- Диалоги вроде `about`, `manageLinks`, `viewLeads` и др.

> Специализированные пространства (document-store, vector-store, assistants, tools, credentials, variables, api-keys и т.д.) **регистрируются самими функциональными пакетами**. Перед рендерингом соответствующих страниц импортируйте эти пакеты.

FRT пакеты добавляют свои собственные пространства имён динамически.

## Вклад в разработку

При вкладе в этот пакет:

1. Следуйте лучшим практикам TypeScript и поддерживайте строгую типизацию
2. Сохраняйте синхронизацию переводов EN и RU
3. Обновляйте типы пространств имён при добавлении новых ключей переводов
4. Тестируйте типизированные хуки с реальными компонентами
5. Обновляйте документацию EN и RU
6. Следуйте стандартам кодирования проекта

## Связанная документация

- [Документация основных приложений](../README-RU.md)
- [Flowise UI](../flowise-ui/base/README-RU.md)
- [Документация i18next](https://www.i18next.com/)
- [Документация react-i18next](https://react.i18next.com/)

---

_Universo Platformo | Пакет i18n_
