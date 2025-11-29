# @universo/flowise-leads-frt

Фронтенд-модуль для управления лидами в Universo Platformo.

## Обзор

Это минимальный пакет, который предоставляет экспорты пространства имён для функциональности лидов. Фактические UI-компоненты остаются в `@flowise/template-mui` и будут перенесены в будущих итерациях.

## Информация о пакете

- **Пакет**: `@universo/flowise-leads-frt`
- **Версия**: `0.1.0`
- **Тип**: Frontend (Современный)
- **Фреймворк**: React, TypeScript
- **Зависимости**: `@universo/api-client`, `@flowise/template-mui`

## Текущее состояние

Этот пакет в настоящее время служит заглушкой для будущих UI-компонентов лидов. Фактические компоненты расположены в:

- **ViewLeadsDialog**: `@flowise/template-mui/ui-components/dialog/ViewLeadsDialog.jsx`
- **Leads**: `@flowise/template-mui/ui-components/extended/Leads.jsx`

## i18n пространства имён

Переводы расположены в `@universo/i18n`:
- `viewLeads` - Переводы диалога (`locales/*/dialogs/view-leads.json`)
- `canvas:configuration.leads` - Переводы конфигурации (`locales/*/views/canvas.json`)

## Установка

```bash
pnpm add @universo/flowise-leads-frt
```

## Экспорты

### Константы
- `LEADS_NAMESPACE` - Идентификатор пространства имён для функциональности лидов

### Типы (реэкспорт из @universo/flowise-leads-srv)
- `ILead` - Интерфейс сущности Lead
- `CreateLeadBody` - Тип тела запроса создания

## Структура файлов

```
packages/flowise-leads-frt/
├── base/
│   ├── src/
│   │   └── index.ts           # Точка входа с экспортами
│   ├── package.json
│   ├── README.md              # Английская документация
│   └── README-RU.md           # Этот файл
└── package.json               # Конфигурация воркспейса
```

## Планы на будущее

В будущих итерациях следующие компоненты будут перенесены в этот пакет:
- Компонент ViewLeadsDialog
- Компонент конфигурации Leads
- Выделенное i18n пространство имён

## Лицензия

Omsk Open License
