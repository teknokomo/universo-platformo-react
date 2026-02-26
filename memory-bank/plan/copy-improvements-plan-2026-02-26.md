# План доработки копирования: Метахабы, Приложения, Ветки

Дата: 2026-02-26  
Режим: PLAN (без реализации)  
Оценка сложности: Level 3 (Significant)

> Ключевое ограничение: легаси-совместимость не требуется, тестовая БД будет пересоздана.

---

## 1. Overview

Нужно доработать 3 связанных потока копирования:

1. Копирование метахаба: переименовать вкладку `Опции копирования` -> `Опции`.
2. Копирование приложения: добавить отдельную вкладку `Опции` с зависимыми настройками копирования коннектора/схемы/прав.
3. Копирование ветки метахаба: добавить вкладку `Опции` с master-опцией `Полное копирование` и селективным копированием групп сущностей.

Цель: сделать поведение предсказуемым, явно управляемым пользователем и безопасным по данным.

---

## 2. Дополнительный анализ и выявленные связи

## 2.1 Что подтверждено по коду

- Метахаб-копирование уже табовое, нужное переименование затрагивает UI + i18n (`metahubs-frontend`).
- Копирование приложения сейчас:
  - без вкладки опций;
  - копирует `copyAccess`;
  - всегда копирует коннекторы и `connectors_publications`;
  - при наличии source schema всегда клонирует `app_*` схему.
- Копирование ветки сейчас:
  - реализовано через `createBranch({ sourceBranchId })`;
  - делает полное `cloner.clone(copyData: true)` без селективных опций.

## 2.2 Что подтверждено по Supabase `UP-test`

- В `applications` есть актуальная цепочка: `application -> connector -> connector_publication -> publication -> active_version`.
- В branch schema метахаба есть системные таблицы:
  - `_mhb_objects`, `_mhb_attributes`, `_mhb_elements`, `_mhb_values`, `_mhb_settings`, `_mhb_layouts`, `_mhb_widgets`, `_mhb_migrations`.
- `catalog`-атрибуты реально могут ссылаться на `enumeration` (`REF` с `target_object_kind='enumeration'`), значит селективное отключение перечислений требует защитной обработки зависимостей.

## 2.3 Архитектурный нюанс

- `@universo/metahubs-backend` уже зависит от `@universo/applications-backend`.
- Обратную зависимость добавлять нельзя (получится цикл), поэтому для опции `Создать схему приложения` нельзя делать прямой вызов sync-логики из `applications-backend` через импорт из `metahubs-backend`.
- Безопасный вариант: оркестрация `copy -> sync` на frontend-уровне (или вынесение sync-core в отдельный общий пакет).

---

## 3. Affected Areas

## 3.1 Frontend

- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubActions.tsx`
- `packages/metahubs-frontend/base/src/domains/branches/ui/BranchActions.tsx`
- `packages/metahubs-frontend/base/src/domains/branches/ui/BranchList.tsx` (если унифицировать create/copy)
- `packages/metahubs-frontend/base/src/domains/branches/api/branches.ts`
- `packages/metahubs-frontend/base/src/types.ts`
- `packages/metahubs-frontend/base/src/i18n/locales/{ru,en}/metahubs.json`

- `packages/applications-frontend/base/src/pages/ApplicationActions.tsx`
- `packages/applications-frontend/base/src/pages/ApplicationList.tsx`
- `packages/applications-frontend/base/src/api/applications.ts`
- `packages/applications-frontend/base/src/hooks/mutations.ts`
- `packages/applications-frontend/base/src/i18n/locales/{ru,en}/applications.json`

## 3.2 Backend

- `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/branches/routes/branchesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`

## 3.3 Tests

- `packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts`
- `packages/applications-frontend/base/src/api/__tests__/apiWrappers.test.ts`
- `packages/applications-frontend/base/src/hooks/__tests__/mutations.test.tsx`
- `packages/applications-frontend/base/src/pages/__tests__/actionDescriptors.coverage.test.tsx`
- (добавить) тесты веток frontend/backend для новых copy-options.

---

## 4. План реализации (чеклист)

## Phase A — Метахаб: переименование вкладки

- [ ] A1. Переименовать i18n-ключ `metahubs.copy.optionsTab`:
  - RU: `Опции`
  - EN: `Options`
- [ ] A2. Проверить, что `MetahubActions` использует этот же ключ без дублирования fallback-строк.
- [ ] A3. Обновить snapshot/coverage тесты, если завязаны на текст вкладки.

## Phase B — Приложение: новая вкладка `Опции` и новая модель копирования

- [ ] B1. Расширить payload копирования приложения:
  - `copyConnector: boolean` (default `true`)
  - `createSchema: boolean` (default `false`, зависит от `copyConnector`)
  - `copyAccess: boolean` (default `false`)
- [ ] B2. Frontend UI (`ApplicationActions.tsx`):
  - Перевести copy-диалог на `tabs`.
  - Вкладка `Основное`: имя/описание.
  - Вкладка `Опции`: 3 чекбокса с зависимостями.
  - Если `copyConnector=false`, то `createSchema` disabled и принудительно `false`.
- [ ] B3. Backend (`applicationsRoutes.ts`) — изменить copy-flow:
  - Убрать "всегда копируем коннекторы".
  - Копировать коннекторы/связи только при `copyConnector=true`.
  - Не клонировать runtime schema по legacy-пути "по умолчанию".
  - Если `copyConnector=false`, выставлять copy в безопасное состояние (`schemaStatus=draft|outdated`, `lastSyncedPublicationVersionId=null`).
- [ ] B4. Оркестрация `createSchema`:
  - Рекомендовано: в `useCopyApplication` сделать последовательный процесс:
    1) `POST /applications/:id/copy`
    2) если `createSchema=true` -> `POST /application/:newApplicationId/sync`
  - При ошибке шага 2: вернуть ошибку пользователю + опционально компенсирующее удаление скопированного приложения (обсуждается).
- [ ] B5. i18n:
  - Добавить ключи `copy.optionsTab`, `copy.copyConnector`, `copy.createSchema`, helper-тексты disabled-состояний.
- [ ] B6. Обновить тесты API/hooks/action descriptors для нового payload и последовательной мутации.

## Phase C — Ветка метахаба: селективное копирование

- [ ] C1. Добавить модель опций копирования ветки:
  - `fullCopy` (default `true`)
  - `copyLayouts` (default `true`)
  - `copyHubs` (default `true`)
  - `copyCatalogs` (default `true`)
  - `copyEnumerations` (default `true`)
  - `copyMigrations` (default `true`)
  - (рекомендовано обсудить) `copySettings` (default `true`)
- [ ] C2. Frontend (`BranchActions.tsx`):
  - Добавить вкладку `Опции`.
  - Реализовать parent-child поведение:
    - `fullCopy=false` -> дочерние опции выключаются.
    - при снятии любой дочерней -> `fullCopy=false`.
    - при включении `fullCopy=true` -> все дочерние `true`.
  - Для частичного выбора показывать `indeterminate` на master-чекбоксе.
- [ ] C3. Backend schema + route validation:
  - Расширить `createBranchSchema` в `branchesRoutes.ts`.
  - Добавить `zod`-валидацию зависимостей опций.
- [ ] C4. Backend алгоритм копирования (в `MetahubBranchesService.createBranch`):
  - Базово клонировать схему source -> target.
  - Если частичное копирование: выполнить prune-шаги по группам сущностей в target schema в транзакции.
  - Очистку выполнять в безопасном порядке с учетом зависимостей:
    1) widgets/layouts
    2) elements/values
    3) attributes (включая ссылки на удаленные target-объекты)
    4) objects по kind
    5) migrations/settings
- [ ] C5. Защита от неконсистентных комбинаций:
  - Валидация перед prune: если выключены перечисления, но остаются catalog-атрибуты с REF на enumeration -> либо авто-удаление таких атрибутов, либо 400 с explain (рекомендуется обсудить UX).
- [ ] C6. Тесты:
  - backend unit/integration для комбинаций флагов;
  - frontend для состояния чекбоксов и payload.

## Phase D — Рефакторинг и качество

- [ ] D1. Вынести типы опций в `@universo/types` (общий контракт frontend/backend).
- [ ] D2. Вынести helpers зависимостей/нормализации опций в `@universo/utils`.
- [ ] D3. Проверка линтерами и сборкой целевых пакетов:
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/applications-frontend lint`
  - `pnpm --filter @universo/metahubs-backend lint`
  - `pnpm --filter @universo/applications-backend lint`
  - точечные тесты изменённых пакетов.

---

## 5. Примеры безопасного кода (для реализации)

## 5.1 Zod: зависимые опции копирования приложения

```ts
const applicationCopyOptionsSchema = z
  .object({
    copyConnector: z.boolean().default(true),
    createSchema: z.boolean().default(false),
    copyAccess: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (!value.copyConnector && value.createSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['createSchema'],
        message: 'createSchema requires copyConnector=true'
      })
    }
  })
```

## 5.2 React: parent-child чекбоксы с `indeterminate`

```tsx
const childKeys = ['copyLayouts', 'copyHubs', 'copyCatalogs', 'copyEnumerations', 'copyMigrations'] as const
const allChildrenOn = childKeys.every((k) => values[k] === true)
const someChildrenOn = childKeys.some((k) => values[k] === true)

<FormControlLabel
  control={
    <Checkbox
      checked={allChildrenOn}
      indeterminate={!allChildrenOn && someChildrenOn}
      onChange={(e) => {
        const checked = e.target.checked
        childKeys.forEach((k) => setValue(k, checked))
      }}
    />
  }
  label={t('branches.copy.fullCopy', 'Полное копирование')}
/>
```

## 5.3 TanStack Query: последовательная мутация copy -> sync

```ts
const mutation = useMutation({
  mutationFn: async ({ id, data }: CopyApplicationParams) => {
    const copied = (await applicationsApi.copyApplication(id, data)).data
    if (data?.createSchema) {
      await connectorsApi.syncApplication(copied.id, false)
    }
    return copied
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
  }
})
```

## 5.4 Backend: транзакция + безопасная чистка групп в branch schema

```ts
await ds.transaction(async (tx) => {
  if (!options.copyLayouts) {
    await knex.withSchema(schemaName).table('_mhb_widgets').where({ _upl_deleted: false, _mhb_deleted: false }).del()
    await knex.withSchema(schemaName).table('_mhb_layouts').where({ _upl_deleted: false, _mhb_deleted: false }).del()
  }

  if (!options.copyMigrations) {
    await knex.withSchema(schemaName).table('_mhb_migrations').where({ _upl_deleted: false, _mhb_deleted: false }).del()
  }

  // Далее: prune objects/attributes/elements/values в согласованном порядке.
})
```

---

## 6. Potential Challenges и как закрыть

- Риск: `createSchema` для приложения требует sync-логики из другого backend-модуля.
  - Митигировать: фронтенд-оркестрация copy->sync (без циклической зависимости пакетов).
- Риск: селективное копирование ветки может оставить "висячие" ссылки.
  - Митигировать: строгая backend-валидация + deterministic prune order.
- Риск: UX-путаница при master/child опциях.
  - Митигировать: `indeterminate`, disabled-helper текст, единый reducer состояния.
- Риск: регресс по старым тестам копирования.
  - Митигировать: обновить ожидания payload и явно добавить кейсы новых флагов.

---

## 7. Design Notes (Level 3)

- UI-дизайн вкладки `Опции` для веток и приложений стоит зафиксировать отдельно (CREATIVE), чтобы согласовать:
  - microcopy для disabled/зависимых состояний;
  - порядок пунктов и helper-тексты;
  - поведение при конфликтных комбинациях.
- После реализации нужен ARCHIVE с описанием новой модели копирования и матрицей флагов.

---

## 8. Dependencies / Coordination

- Межпакетные контракты:
  - `applications-frontend` <-> `applications-backend` (copy payload),
  - `applications-frontend` <-> `metahubs-backend` (`/application/:id/sync`),
  - `metahubs-frontend` <-> `metahubs-backend` (branch copy options).
- i18n:
  - ключи в доменных namespace + использование `common` из `@universo/i18n` где возможно.
- UUID:
  - использовать текущий UUID v7 pipeline (как и сейчас в БД/DDL).

---

## 9. Рекомендованный порядок внедрения

1. Metahub tab rename (быстрая часть, низкий риск).  
2. Application options + новый backend contract (без createSchema orchestration).  
3. Добавить createSchema orchestration copy->sync.  
4. Branch selective copy (самый сложный этап) + полные тесты.  
5. Полная валидация, lint/test/build, затем ARCHIVE.

---

## 10. Внешние паттерны и источники

- MUI Tabs: https://mui.com/material-ui/react-tabs/  
- MUI Checkbox (indeterminate): https://mui.com/material-ui/react-checkbox/  
- WAI-ARIA Tabs pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/  
- TanStack Query invalidation from mutations: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations  
- Zod refine/superRefine: https://zod.dev  
- PostgreSQL advisory locks: https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS  

---

## 11. QA Addendum (2026-02-26)

This addendum supersedes conflicting points in sections 4-6.

### 11.1 Requirement coverage verdict

The plan covers most of the original request, but not fully.  
The gaps below must be fixed before implementation starts.

### 11.2 Mandatory corrections to the plan

- Remove `copySettings` from MVP branch copy options.
  - Reason: not explicitly requested; adds unnecessary UI and behavioral scope.
- Treat Phase D (`@universo/types`, `@universo/utils` extraction) as optional post-MVP hardening.
  - Reason: this refactor is valuable but not required to satisfy the user story.
- Application copy must reset runtime schema state for every copied application when schema is not explicitly created.
  - Required reset fields: `schemaStatus`, `schemaSyncedAt`, `schemaError`, `schemaSnapshot`, `appStructureVersion`, `lastSyncedPublicationVersionId`.
  - Reason: runtime schema cloning is removed by requirement; keeping previous sync metadata is inconsistent and unsafe.
- Keep `copy -> sync` orchestration for `createSchema=true`, but do not default to compensating delete on sync failure.
  - Preferred behavior: keep the copied application, show a warning ("application copied, schema sync failed"), and provide a retry path.
  - Reason: destructive compensation can remove a successful copy and surprise users.
- Branch copy options must apply to both copy entry points:
  - row/card "Copy" action dialog in `BranchActions.tsx`;
  - create dialog with non-empty `sourceBranchId` in `BranchList.tsx`.
  - Reason: otherwise users can bypass options via create-from-source flow.
- Branch dependency rules must be explicit in backend validation:
  - If `copyHubs=false` and (`copyCatalogs=true` or `copyEnumerations=true`), either:
    - reject with `400` and machine-readable code, or
    - normalize catalog/enumeration hub bindings safely.
  - If `copyEnumerations=false`, remove or reject catalog attributes that reference enumerations.
  - Enumeration group must include `_mhb_values` consistently.
- Branch prune implementation must use a single DB transaction context for all prune SQL.
  - Do not mix `ds.transaction(...)` with non-transactional `knex` calls.
  - Reason: partial prune on failure can leave an inconsistent copied schema.

### 11.3 Updated implementation checkpoints

- Phase B update:
  - Extend copy payload with `copyConnector`, `createSchema`, `copyAccess`.
  - Disable and force `createSchema=false` when `copyConnector=false`.
  - Copy connectors/publication links only when `copyConnector=true`.
  - Never clone `app_*` schema inside copy route.
  - Always initialize copied app runtime metadata to "not synced yet" before optional sync.
  - If `createSchema=true`, run `POST /application/:newApplicationId/sync` after successful copy.
- Phase C update:
  - MVP options list: `fullCopy`, `copyLayouts`, `copyHubs`, `copyCatalogs`, `copyEnumerations`, `copyMigrations`.
  - Apply same options UX in both branch copy entry points.
  - Add strict backend validation for incompatible option combinations.
  - Clone source schema, then prune selected groups in deterministic order inside one transaction.
  - Add route/service tests for option combinations and validation error codes.

### 11.4 Additional QA notes

- Existing branch frontend tests are minimal; add dedicated tests for options UI state machine.
- Existing backend route tests do not cover new branch copy-option contracts; add them before merge.
- Continue using existing `EntityFormDialog` tab infrastructure and current menu action patterns; no new reusable UI component is needed for this scope.
