# План: Перечисления (Enumerations) для Метахабов и Приложений

Дата: 2026-02-18  
Режим: PLAN (без реализации)

## 1) Что дополнительно проверено

- Кодовые связи по `catalog`/`REF`/`kind` в:
  - `packages/metahubs-frontend/base/src/components/TargetEntitySelector.tsx`
  - `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`
  - `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
  - `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`
  - `packages/schema-ddl/base/src/naming.ts`
  - `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
  - `packages/apps-template-mui/src/api/api.ts`
  - `packages/apps-template-mui/src/components/dialogs/FormDialog.tsx`
- Live-проверка Supabase (проект `UP-test`, `osnvhnawsmyfduygsajj`):
  - в `mhb_*` и `app_*` сейчас фактически только `kind='catalog'`;
  - строгих CHECK-ограничений по `kind` в `_mhb_objects` не обнаружено;
  - `_app_attributes` уже поддерживает `target_object_id` и `target_object_kind`.
- Актуальная документация через Context7:
  - TanStack Query v5: key-factory, точечная invalidation, default options;
  - TypeORM: enum/json/jsonb модели и ограничения.
- Интернет-источники (паттерны):
  - 1C: перечисления как фиксированный набор значений;
  - PostgreSQL: enum-значения трудно изменять/удалять;
  - Material: выбор между dropdown/radio;
  - WHATWG: `required` + пустой placeholder в `select`.

## 2) Ключевые выводы и архитектурные решения

### Решение A (рекомендуемое)

Не использовать PostgreSQL `ENUM` для бизнес-перечислений (НДС, статусы и т.д.), а хранить их как данные:

- Design-time:
  - объект `kind='enumeration'` в `_mhb_objects`;
  - значения перечисления в отдельной таблице `_mhb_enum_values`.
- Runtime (app schema):
  - системная таблица `_app_enum_values`;
  - поля атрибутов `REF -> enumeration` хранят `UUID` значения перечисления;
  - FK из пользовательской таблицы на `_app_enum_values(id)` + серверная проверка, что значение относится к нужному enumeration object.

Почему так:
- гибко для миграций и шаблонов;
- безопасно для эволюции структуры;
- не дублируем значения JSONB по множеству колонок;
- сохраняем целостность ссылок и i18n/VLC.

### Решение B (отклонено)

Копировать тексты перечислений напрямую в каждое поле как JSONB без отдельной таблицы:
- выше риск рассинхронизации при изменениях перевода/порядка;
- сложнее фильтрация, аналитика, индексация;
- сложнее гарантировать целостность ссылок.

## 3) Обновлённый пошаговый план

## Фаза 0. Контракт и терминология
- [ ] Зафиксировать доменные термины: `Перечисление` (entity), `Значение` (value), `REF->enumeration`.
- [ ] Утвердить минимальный API-контракт:
  - [ ] `targetEntityKind: 'enumeration'`;
  - [ ] `uiConfig.enumPresentationMode: 'select' | 'radio' | 'label'`;
  - [ ] `uiConfig.defaultEnumValueId: string | null`.
- [ ] Утвердить правило `UUID v7` для всех новых записей значений перечислений.

## Фаза 1. Типы и shared-контракты (`@universo/types`)
- [ ] Добавить `MetaEntityKind.ENUMERATION` в `packages/universo-types/base/src/common/metahubs.ts`.
- [ ] Расширить `METAHUB_MENU_ITEM_KINDS` при необходимости (если хотим пункт меню для enumeration-объектов в menuWidget).
- [ ] Добавить типы:
  - [ ] `EnumerationValueDefinition`;
  - [ ] `EnumPresentationMode`;
  - [ ] `AttributeRefUiConfig` (default value + mode + readonly semantics).
- [ ] Подготовить backward-compatible парсинг `targetCatalogId -> targetEntityId`.

## Фаза 2. Backend metahubs: системные таблицы и сервисы
- [ ] Добавить таблицу `_mhb_enum_values` в `systemTableDefinitions.ts`:
  - [ ] `id uuid v7 PK`;
  - [ ] `object_id FK -> _mhb_objects(id) ON DELETE CASCADE`;
  - [ ] `codename`, `presentation JSONB(VLC)`, `sort_order`, `is_default`;
  - [ ] частичный unique `(object_id, codename)` для активных.
- [ ] Расширить `MetahubObjectsService`:
  - [ ] ввести generic-методы `createObject(kind)/updateObject(kind)` вместо catalog-only API;
  - [ ] сохранить совместимость текущих `createCatalog/updateCatalog`.
- [ ] Создать новый домен `enumerations` (routes + service) по шаблону `catalogs`, но со значениями вместо атрибутов.
- [ ] Добавить CRUD значений перечисления (`/enumeration/:id/values`).

## Фаза 3. Backend metahubs: REF-валидация и удаления
- [ ] В `attributesRoutes.ts` добавить валидацию `targetEntityKind === 'enumeration'`.
- [ ] Проверять существование enumeration через `_mhb_objects(kind='enumeration')`.
- [ ] Добавить блокирующие проверки удаления enumeration:
  - [ ] ссылки из атрибутов (`REF` на это enumeration);
  - [ ] безопасный ответ 409 с деталями blockers.
- [ ] Расширить logic для hub-association:
  - [ ] enumeration может добавляться в hubs аналогично catalogs (`config.hubs`).

## Фаза 4. Frontend metahubs: маршруты, меню, UI-потоки
- [ ] Добавить пункт `Перечисления` в оба меню:
  - [ ] `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`;
  - [ ] `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`.
- [ ] Добавить route `metahub/:metahubId/enumerations` в `MainRoutesMUI.tsx`.
- [ ] Реализовать `EnumerationList` и `EnumerationValuesList` (стартово через рефактор `CatalogList` + `ElementList` паттернов).
- [ ] Полная i18n:
  - [ ] `metahubs` namespace (en/ru);
  - [ ] `menu` namespace в `packages/universo-i18n`.

## Фаза 5. REF на перечисление в атрибутах
- [ ] В `TargetEntitySelector` добавить `enumeration` как поддерживаемый kind.
- [ ] Для `REF` показывать выбор:
  - [ ] Catalog;
  - [ ] Enumeration.
- [ ] Валидация формы атрибута:
  - [ ] `targetEntityKind` и `targetEntityId` обязательны для `REF`.
- [ ] Таб `Presentation`:
  - [ ] `enumPresentationMode` (`select/radio/label`);
  - [ ] `defaultEnumValueId`;
  - [ ] поведение `required + empty`.

## Фаза 6. Snapshot/Publication/Template
- [ ] Расширить `SnapshotSerializer`:
  - [ ] сериализация entities kind=`enumeration`;
  - [ ] сериализация values перечислений.
- [ ] Обновить `TemplateManifestValidator`:
  - [ ] поддержка `kind='enumeration'`;
  - [ ] контроль неоднозначных codename с учётом нового kind.
- [ ] Обновить `TemplateSeedExecutor` и `TemplateSeedMigrator`:
  - [ ] seed/migrate enumeration objects + values;
  - [ ] сохранить идемпотентность и dry-run.

## Фаза 7. Application schema и sync
- [ ] В `@universo/schema-ddl`:
  - [ ] добавить префикс `enumeration -> enum` в `naming.ts`;
  - [ ] добавить `_app_enum_values` в system tables;
  - [ ] для `REF->enumeration` создавать FK на `_app_enum_values(id)`.
- [ ] В `applicationSyncRoutes.ts`:
  - [ ] копировать enumeration values из снапшота в `_app_enum_values`;
  - [ ] не создавать отдельные пользовательские таблицы для enumeration objects.

## Фаза 8. Runtime backend (`applicationsRoutes.ts`)
- [ ] Снять catalog-only ограничения там, где это безопасно.
- [ ] Расширить `RuntimeDataType`/фильтры так, чтобы `REF` корректно читался.
- [ ] Для `PATCH` и bulk update:
  - [ ] разрешить `REF`;
  - [ ] проверять, что UUID значения принадлежит нужному enumeration object;
  - [ ] для `mode='label'` блокировать изменение (readonly).
- [ ] В ответ runtime добавлять `enumOptions` (id + локализованный label) для REF-полей на перечисления.

## Фаза 9. Runtime frontend (`apps-template-mui`)
- [ ] Обновить API-схему:
  - [ ] `dataType` включает `REF`;
  - [ ] `enumOptions` и `uiConfig.enumPresentationMode`.
- [ ] Обновить `FormDialog`:
  - [ ] `select` для mode=`select`;
  - [ ] `RadioGroup` для mode=`radio`;
  - [ ] readonly text для mode=`label`.
- [ ] Логика пустого значения:
  - [ ] если `required=true`, пустой вариант запрещён;
  - [ ] если `required=false`, опционально отображать пустой пункт.

## Фаза 10. Тесты и обратная совместимость
- [ ] Unit-тесты:
  - [ ] сериализация/десериализация snapshot с enumeration;
  - [ ] валидация REF->enumeration;
  - [ ] проверка `defaultEnumValueId`.
- [ ] Integration-тесты:
  - [ ] metahubs routes (CRUD enumerations/values, blockers, hubs association);
  - [ ] application sync/runtime CRUD для REF enumeration.
- [ ] Regression:
  - [ ] каталоги/хабы работают без изменений;
  - [ ] старые snapshots читаются корректно.

## Фаза 11. Rollout и безопасность миграции
- [ ] Выпуск в 2 шага:
  - [ ] Шаг 1: backend + schema + read support;
  - [ ] Шаг 2: UI write support.
- [ ] Feature-flag (опционально) на запись `REF->enumeration` до завершения UI/runtime.
- [ ] Мониторинг ошибок:
  - [ ] 400/409 по enum-валидации;
  - [ ] метрики кэша TanStack Query на экранах перечислений.

## 4) Примеры безопасного кода (эталон для реализации)

### Пример 1. Безопасная валидация запроса создания значения перечисления (Zod + whitelist)

```ts
import { z } from 'zod'

export const createEnumerationValueSchema = z.object({
  codename: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.record(z.string().min(1)).refine((v) => Object.keys(v).length > 0),
  sortOrder: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().optional()
})
```

### Пример 2. Parameterized SQL + проверка принадлежности enum-значения нужному enumeration

```ts
const row = await manager.query(
  `
    SELECT id
    FROM ${schemaIdent}._app_enum_values
    WHERE id = $1
      AND object_id = $2
      AND COALESCE(_upl_deleted, false) = false
      AND COALESCE(_app_deleted, false) = false
    LIMIT 1
  `,
  [enumValueId, targetEnumerationObjectId]
)

if (row.length === 0) {
  return res.status(400).json({ error: 'Enumeration value does not belong to target enumeration' })
}
```

### Пример 3. Безопасный runtime рендер контролов по presentation mode

```tsx
switch (field.uiConfig?.enumPresentationMode) {
  case 'radio':
    return <RadioGroup /* options from enumOptions */ />
  case 'label':
    return <Typography>{selectedLabel ?? '—'}</Typography>
  case 'select':
  default:
    return <Select /* options from enumOptions */ />
}
```

## 5) Риски и как их закрываем

- Риск: неполный охват catalog-only веток.
  - Контроль: grep-чеклист по `kind='catalog'`, `targetCatalogId`, `RUNTIME_WRITABLE_TYPES`.
- Риск: сломать runtime CRUD из-за `REF`.
  - Контроль: staged rollout + feature flag + интеграционные тесты.
- Риск: рассинхрон i18n.
  - Контроль: обязательное добавление ключей в `metahubs` и `menu` namespaces одновременно.
- Риск: неоднозначность codename в templates.
  - Контроль: обязательный `targetEntityKind` для ссылок на enumeration в template seed.

## 6) Acceptance criteria (Definition of Done)

- [ ] В меню метахаба есть пункт `Перечисления` и рабочие маршруты.
- [ ] Можно создать enumeration, значения (VLC), назначить hubs.
- [ ] Атрибут `REF` может ссылаться на catalog или enumeration.
- [ ] Для `REF->enumeration` работают mode=`select|radio|label` и `defaultEnumValueId`.
- [ ] Публикация/синхронизация переносят enumeration values в приложение.
- [ ] Runtime формы корректно читают/пишут `REF->enumeration`.
- [ ] Все новые тексты интернационализированы (EN/RU).
- [ ] Тесты проходят, backward compatibility подтверждена.

## 7) Источники (для архитектурных решений)

- 1C Developer Network, Enumerations: https://1c-dn.com/library/tutorials/practical_developer_guide_understanding_enumerations/
- PostgreSQL enum docs (ограничения эволюции): https://www.postgresql.org/docs/current/datatype-enum.html
- Material selection controls: https://m1.material.io/components/selection-controls.html
- WHATWG select/required placeholder semantics: https://html.spec.whatwg.org/multipage/form-elements.html
