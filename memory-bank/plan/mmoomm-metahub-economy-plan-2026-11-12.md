# Plan: MMOOMM Metahub Economy MVP (Standard Ledgers)

> Created: 2026-11-12
> Status: Draft v2 (QA-revised 2026-11-12 — full-coverage audit + architecture/security/uniformity audit applied)
> Research: `memory-bank/research/mmoomm-metahub-economy-research-2026-11-12.md` (Reviewed, QA'd) — **required input**
> Brief: QA-refined Manager brief "MMOOMM Metahub Economy MVP" (2026-11-12, cross-project); source TZ DOC-2026-005
> Complexity: Level 4 (cross-package feature: types + applications-backend + realtime + apps-template-mui + generator/E2E + docs)

## Overview

Add an economy MVP to the canonical MMOOMM app: `Nomenclature` / `Wallet` / `Operation` objects, `OperationType` / `Unit` enumerations, an `EconomyConstants` set, two registrar-fed register entities (`WalletLedger`, `InventoryLedger` as **object-kind entities with `ledgerSchema`**, the LMS pattern), a **`MmoommEconomyPostingModule`** server module (the `beforePost` brain that composes ledger movements), and a `economyPanel` dashboard widget. Trades (sell ore / buy fuel) run as server-authoritative REST routes that (a) validate station proximity against the **same-process Colyseus room state** via a read-only room query, (b) ensure a per-user wallet under an advisory transaction lock **before any balance read**, (c) create the `Operation` row and post it through the existing transactional-posting machinery (single transaction; the `beforePost` module writes ledger movements), and (d) accept the standardized `Idempotency-Key` header with replay/conflict semantics ported from the guest-session intake precedent (platform-schema store with per-application/user scoping). `GET /runtime/economy/summary` computes balance, cargo, capacity, market prices and recent operations **server-side** (per-user injection; the panel never queries raw client-filtered projections) and bootstraps the once-only StarterGrant so the granted state is visible at first entry (TZ §6.1). All texts are i18n'd (EN/RU) on day one; all new row identities are UUID v7.

**Owner-confirmed contract for this implementation (fresh-database, no-legacy):**

-   The test database will be deleted and recreated; new metahubs/applications are created fresh. No backfill, no compatibility projections, no legacy code in touched paths.
-   **No platform schema version bump and no metahub-template version bump.** Consequence: the `playcanvas` template manifest is NOT changed (TZ FR-001's template-preset route is superseded — see D1); new tables arrive via new platform migrations (mirroring `1800000000300-CreateGuestSessionIdempotency.sql.ts`), which do not bump any version.
-   **Note vs TZ §13 ("Новых SQL-таблиц нет") — owner-confirm:** the only new SQL tables are platform infrastructure (`applications.obj_economy_idempotency` per D7, `_app_constants` per D3) — **no balance/cargo state tables**; balances and stock remain ledger projections only, preserving the TZ §7/§13 intent. Flagged alongside D1/D2 for owner confirmation.
-   Serious refactoring of existing packages is allowed where it removes duplication or fixes platform gaps (posting core extraction, `_app_constants` materialization).
-   Modern stack rules to honor everywhere: centralized dependency versions via `pnpm-workspace.yaml` catalogs (`"catalog:"`); TanStack Query for all new frontend data fetching; shared UI primitives stay in `packages/universo-react-template-mui` (runtime widgets in the isolated `packages/universo-react-apps-template-mui` with no dependency on `universo-react-metahubs-*`/`universo-react-applications-*`); shared authoring labels in `packages/universo-react-i18n`; shared types in `packages/universo-react-types`; shared helpers in `packages/universo-react-utils`; everything i18n'd immediately (EN base + full RU parity); UUID v7 identity.

## Affected Areas

| Area                 | Files / packages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared types         | `packages/universo-react-types/src/common/economyRuntime.ts` (new: summary DTO zod incl. types-local uuid-v7 schema, `ECONOMY_*` code whitelist + HTTP status map), `dashboardWidgetConfigSchemas.ts` (+`economyPanelConfigSchema`), `dashboardWidgetRegistry.ts` (+entry)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Applications backend | `controllers/runtimeRowCommandHandlers/posting.ts` (extract pure core), `controllers/runtimeRowWriteHandlers/create.ts` (reuse as-is), `persistence/economyIdempotencyStore.ts` (new, guest three-module split), `services/runtimeEconomyService.ts` (new — summary + trade + wallet-ensure), `services/economyIdempotencyMaintenance.ts` (new, 15-min interval, guest precedent), `controllers/runtimeEconomyController.ts` (new), `routes/applicationsRoutes.ts` (+3 routes with per-route limiters), `realtime/applicationsRealtimeRuntime.ts` (+read-only room method + room-query export), `platform/migrations/<next>-CreateEconomyIdempotency.sql.ts` (new) + `platform/migrations/index.ts` + `platform/systemAppDefinition.ts` (register, `bootstrapPhase: 'post_schema_generation'`), `ddl/applicationWorkspacesSchema.ts` + `services/applicationSyncEngine.ts` / `publishedApplicationSnapshotEntities.ts` (`_app_constants` materialization), `src/tests/**` (new jest suites) |
| Shared schema-ddl    | `packages/universo-react-schema-ddl/src/systemTables.ts` (+`_app_constants`), schema generation for the new system table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Runtime template     | `packages/universo-react-apps-template-mui/src/dashboard/components/EconomyPanelWidget.tsx` (new, composing `RuntimeWidgetStatus` + existing primitives), `widgetRenderer.tsx` (+case), `src/api/api.ts` (+`fetchRuntimeEconomySummary`, trade POSTs with `Idempotency-Key`), `src/i18n/locales/{en,ru}/apps.json` (+`runtime.economyErrors.*`, widget labels)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Layout editor        | `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/` — verify generic widget editor coverage for `economyPanel` (config has sane defaults); add editor fields only if the metahubs-side dialog requires explicit registration (`PlayCanvasCanvasWidgetEditorDialog.tsx` precedent)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| i18n shared          | `packages/universo-react-i18n/src/locales/{en,ru}/core/common.json` (+`common.layouts.widgets.economyPanel` + binding/presentation groups)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Generator / E2E      | `tools/testing/e2e/support/mmoommAppGeneratorData.ts` (+economy codenames/constants **+ posting-module source**), `support/mmoomm-app-export/metahub-authoring.ts` (+economy authoring helpers incl. Ledger-schema tab, Behavior tab, posting-module authoring), `support/mmoomm-app-export/runtime-authoring.ts` (+panel placement step), `generate-mmoomm-app-export.ts` (+calls), `mmoommAppContentContract.ts` / `.shared.ts` (assertDomainModel extensions incl. posting module assertion), `specs/flows/snapshot-import-mmoomm-app-economy.spec.ts` (new, @flow @slow), `support/mmoommEconomyProof.ts` (new)                                                                                                                                                                                                                                                                                                                                                                         |
| Fixtures             | `tools/fixtures/metahubs-mmoomm-app-snapshot.json` — regenerated only (never hand-edited); `snapshotHash` recomputed by the export pipeline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Docs                 | `docs/en/guides/mmoomm-economy.md` + `docs/ru/guides/mmoomm-economy.md` (new, GitBook), both `SUMMARY.md` (+1 line each), screenshots via a dedicated capture script into `docs/{en,ru}/.gitbook/assets/mmoomm-economy/`, `docs/{en,ru}/guides/ledgers.md` (+economy cross-link), package READMEs (applications-backend, apps-template-mui, types, metahubs-backend, tools/testing/e2e + README-RU)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tests                | Jest (applications-backend unit + PG integration), Vitest (types, apps-template-mui), Playwright (runtime journey + visual + docs screenshots), contract/drift node checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Pinned Decisions (research-grounded; deviations flagged for owner confirmation)

1. **D1 — Register kind: object + `ledgerSchema` (research variant B). DEVIATION from TZ FR-001/FR-009/FR-010 (ledger preset in template) — owner-confirm.** The owner's "no metahub-template version bump" constraint makes the template-preset route impossible (any manifest change creates a new template version via `TemplateSeeder.updateTemplateIfChanged`). Variant B is the production-proven LMS pattern, runtime-equivalent (kind-agnostic `LEDGER_CAPABILITY_CONDITION`), and matches the `universo-platform-architecture` blocking rule. `WalletLedger`/`InventoryLedger` are object-kind entities with `config.ledger`, created by the generator through the UI. The registrar is the `Operation` object (`recordBehavior.posting`, `targetLedgers`).
2. **D2 — Proximity: REST trade + same-process room bridge. REFINEMENT of research RD2 (which preferred a room-message trade) — owner-confirm.** The trade originates from the dashboard `economyPanel` (React), not the PlayCanvas client, so a pure room-message flow would force the panel to hold a second room connection. Instead: `POST /runtime/economy/sell|buy` resolves the user's live flight room server-side and reads the authoritative ship position from it — spoof-resistant (position never client-supplied), zero room→DB write plumbing, zero roomOptions/`parseRoomOptions`/HMAC changes, and the whole posting pipeline stays on the Tier 1 request executor. The room round-trip is in-process (sub-ms) and safe inside the trade transaction. No active flight session ⇒ `409 ECONOMY_NOT_AT_STATION`. Member-mode only (`resolveRuntimeSchema` 401s without a userId).
3. **D3 — Economy constants: materialize `_app_constants`.** The published app schema has NO constants table today (Set fixed values exist only inside the publication snapshot JSONB and as baked `ui_config.setConstantRef` refs on `_app_components`). This plan adds `_app_constants` as a generated system table populated at sync from `snapshot.constants` — a small, reusable platform gap fix; the economy service reads `EconomyConstants` rows with the request-scoped executor. **Fail-soft rule:** constant reads return `ECONOMY_MARKET_DISABLED` when `_app_constants` is absent in a pre-existing app schema (`ensureSystemTables` runs only on generation and FK-migration paths). Fallback (if sync complexity exceeds the B2 checkpoint): read baked `setConstantRef` rows. Flagged for owner confirmation (new table, TZ §13 note above).
4. **D4 — economyPanel: fixed widget kind** (research RD5 as amended by QA). **FR-031 note:** the panel contains no SQL and no direct table reads; its single data source is the summary endpoint, which itself aggregates through the generic ledger projection machinery (`queryProjection`) with server-injected per-user filters — the security-correct reading of FR-031 per research RD5/RQ5. Config schema `{ title?, showRecentOperations? }`-minimal + `.strict()`; placement zones `['center','right']`, placed in the **right** zone; trade buttons POST with `Idempotency-Key` (uuid v7 generated per logical click, reused until the response settles).
5. **D5 — Posting reuse via pure-core extraction + the posting module is authored data, not platform code.** Extract `runRecordStateCommandCore({ ctx, objectCollection, attrs, rowId, command, expectedVersion, recordCommandService, postingMovementService }) → { responsePayload, afterLifecycleRequest }` from `posting.ts:117-285` (the HTTP shell keeps body parsing, `UpdateFailure`→res mapping, `dispatchRuntimeLifecycleAfterCommit`, response sending). The economy route composes, inside ONE transaction: create (via `executeCreateRowTransaction` assembly) → `runRecordStateCommandCore({ ..., command: 'post' })`. Ledger movements are produced by **`MmoommEconomyPostingModule`** — a metahub-attached server module (lifecycle capability) authored by the generator through the Modules tab and wired via `posting.moduleCodename` on the Operation's Behavior tab; `beforePost` reads `payload.previousRow` + economy constants via `ctx.records` and returns the TZ FR-015 movements (StarterGrant/Sell/Buy). Without this module posting produces zero movements — it is a first-class deliverable, verified by contract + E2E.
6. **D6 — Wallet identity & scoping.** `Wallet.OwnerKey = ctx.userId` (Supabase auth UUID); one wallet per (owner, currency) enforced by check-then-create under `acquireAdvisoryXactLock(tx, `${userId}:${currency}`)` from `@universo-react/utils/database` (locks.ts:20) — never raw inline `pg_advisory_xact_lock` SQL. `Wallet` and `Operation` carry `config.runtimeRecordAccess = { mode: 'ownerOnly', ownerColumnName: '_upl_created_by' }` (auto-stamped on create; LMS precedent).
7. **D7 — HTTP idempotency: `Idempotency-Key` header** + store `applications.obj_economy_idempotency` in the **platform applications schema** (the `obj_` prefix precedent — `rel_` is reserved for relation entities in app schemas; the guest table `applications.obj_guest_session_idempotency` is the mirror). Columns: `id uuid default $uuid_v7 pk`, `application_id uuid not null`, `user_id uuid not null`, `workspace_id uuid null`, `key_hash varchar(64) not null`, `body_fingerprint text not null`, `response jsonb not null`, `status_code int not null`, `created_at timestamptz`, `expires_at timestamptz not null`; **`UNIQUE (application_id, user_id, key_hash)`** (scoped keys — a leaked key can never replay another user/application's response). Clone the guest migration's hardening verbatim (uuid-v7 + format CHECKs, `expires_at` index, `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, `GRANT ALL ... TO service_role`). Key format: **UUID v7** (new parser — the guest 43-char base64url rule is guest-specific). Semantics: same key+same body → replay stored response; same key+different body → `409 ECONOMY_IDEMPOTENCY_CONFLICT`. Purge mirrors both precedents: on-request `purgeExpiredEconomyIdempotency(...)` before the gate + a 15-min interval maintenance service (`guestSessionIdempotencyMaintenance.ts` precedent).
8. **D8 — Projection permission gap: economy-scoped now, platform fix as decision point.** Balances are read ONLY through the economy summary service (server-side injected filters). The platform-level fix (add `ensureRuntimePermission` to `runtimeLedgersController` facts/query endpoints) is Phase H — optional, gated on an LMS-consumer audit.
9. **D9 — Errors**: stable codes `ECONOMY_NOT_AT_STATION | ECONOMY_UNKNOWN_NOMENCLATURE | ECONOMY_INVALID_QUANTITY | ECONOMY_INSUFFICIENT_CARGO | ECONOMY_INSUFFICIENT_FUNDS | ECONOMY_CAPACITY_EXCEEDED | ECONOMY_MARKET_DISABLED | ECONOMY_IDEMPOTENCY_CONFLICT | ECONOMY_POSTING_FAILED` thrown as `UpdateFailure(status, { error, code })`. **HTTP status mapping per TZ §8.4:** 409 — NOT_AT_STATION / INSUFFICIENT_CARGO / INSUFFICIENT_FUNDS / CAPACITY_EXCEEDED / MARKET_DISABLED / IDEMPOTENCY_CONFLICT; 404 — UNKNOWN_NOMENCLATURE; 422 — INVALID_QUANTITY (and any client-supplied forbidden field); 500 — POSTING_FAILED. Frontend maps codes → `runtime.economyErrors.*` i18n (EN/RU) with English fallback (`LAYOUT_RUNTIME_ERROR_CODES` precedent). Logging: **console-based structured log objects** (`operationId/applicationId/principalId`) consistent with existing services — no new logging dependency.
10. **D10 — Stack rules**: TanStack Query for the panel (query key `[...(details?.runtimeQueryKeyPrefix ?? ['economy']), 'economy-summary', apiBaseUrl, applicationId, { locale, workspaceId }]`, `useMutation` with localized `onError` — copy `ReportDetailsTableWidget.tsx:164-196` / `useMaterialMutations.ts:87-141`); row ids from DB defaults (`INSERT … RETURNING id`, `$uuid_v7`), `generateUuidV7()` only for generated keys/idempotency-adjacent values, external ids validated with the **types-local** uuid-v7 schema (see A1 — types stays zod-only, no `@universo-react/utils` import: utils depends on types, so `uuidV7Schema` from utils would be a circular dependency).
11. **D11 — StarterGrant timing: summary bootstrap grants.** TZ §6.1 shows the granted state (1000 CR / 10 kg) at FIRST entry, so `getEconomySummary` performs the same ensureWalletForUser + once-only StarterGrant operation inside its own advisory-locked transaction **before** computing the payload (a documented side-effecting GET; replay-safe — the StarterGrant `Operation` exists exactly once per user, guarded by the lock and the once-only check). Grant-only-on-first-trade was rejected: it contradicts TZ §6.1. The trade flow reuses the same primitives (no grant logic duplication).

## UI Contract — `economyPanel` (mui-runtime-ux skill)

-   **Role/semantics**: read-only economic state for the current member + two trade actions. Displayed sections: Wallet (currency code + formatted balance), Cargo (per-nomenclature rows: localized name, quantity + unit label, mass contribution), Capacity (used/max kg + MUI `LinearProgress`), Market (per-nomenclature: side label Sell/Buy, price, unit; quantity `TextField type="number"` min 0 step 0.1 inline), Recent operations (last 5: localized type label, quantity, total, locale-formatted timestamp). **No raw IDs anywhere** (WalletKey/OwnerKey/UUIDs/nomenclature codes are mapped to localized names server-side; codes never render).
-   **Controls**: quantity inputs `TextField type="number"` with localized helper text; action buttons `Button variant="contained"`, disabled with localized tooltip when `atStation=false`; trade buttons additionally gated on `details.permissions?.editContent` (mirroring `ReportDetailsTableWidget`'s permission gate); no dialogs on this surface (no `StandardDialog` needed).
-   **Status/empty/error rendering**: reuse **`RuntimeWidgetStatus`** (`apps-template-mui/src/dashboard/components/RuntimeWidgetStatus.tsx:7-36` — Skeleton/Alert loading-empty-error) + `LinearProgress` (already used by `QuizWidget.tsx:13`) + localized empty states ("No operations yet") — zero bespoke primitives beyond the panel body.
-   **Hidden/system-owned fields**: ownerKey, walletId, raw balance facts (only formatted display values), prices from the server payload (client never computes).
-   **Validation/localization**: quantity ≤ 0 blocked client-side AND server-side (`ECONOMY_INVALID_QUANTITY`); every error renders via `t('runtime.economyErrors.<code>', { defaultValue: message })`; every string has EN + RU entries (`apps.json` runtime + shared `common.json` authoring label `layouts.widgets.economyPanel`).
-   **Responsive/browser proof**: no page-level horizontal overflow at 1920×1080 / 1280×800 / 390×844; panel in right zone collapses gracefully under the canvas on narrow viewports; screenshots captured in E2E for EN/RU × light/dark (Phase G) — visual claims are asserted from screenshots, never assumed.
-   **Testids** (data-testid): `economy-panel`, `economy-balance`, `economy-cargo-list`, `economy-capacity-bar`, `economy-market-list`, `economy-sell-quantity`, `economy-sell-button`, `economy-buy-quantity`, `economy-buy-button`, `economy-operations-list`, `economy-error`.

## Plan Steps

### Phase A — Shared types, widget registry, i18n keys (`packages/universo-react-types`, `packages/universo-react-i18n`)

-   [ ] A1. `packages/universo-react-types/src/common/economyRuntime.ts` — strict zod schemas + inferred types. **Types stays zod-only**: define `economyUuidV7Schema` locally, mirroring `playCanvasEditorUuidV7Schema` (`types/src/common/playcanvasEditorBridge.ts:71-76`): `z.string().uuid().refine((v) => v[14] === '7', { message: 'Expected UUID v7' })` — do NOT import `uuidV7Schema` from `@universo-react/utils` (utils depends on types → circular).
    ```ts
    export const economyErrorCodeSchema = z.enum([
        'ECONOMY_NOT_AT_STATION',
        'ECONOMY_UNKNOWN_NOMENCLATURE',
        'ECONOMY_INVALID_QUANTITY',
        'ECONOMY_INSUFFICIENT_CARGO',
        'ECONOMY_INSUFFICIENT_FUNDS',
        'ECONOMY_CAPACITY_EXCEEDED',
        'ECONOMY_MARKET_DISABLED',
        'ECONOMY_IDEMPOTENCY_CONFLICT',
        'ECONOMY_POSTING_FAILED'
    ] as const)
    export const economyErrorStatusByCode: Record<EconomyErrorCode, 404 | 409 | 422 | 500> = {
        ECONOMY_NOT_AT_STATION: 409,
        ECONOMY_UNKNOWN_NOMENCLATURE: 404,
        ECONOMY_INVALID_QUANTITY: 422,
        ECONOMY_INSUFFICIENT_CARGO: 409,
        ECONOMY_INSUFFICIENT_FUNDS: 409,
        ECONOMY_CAPACITY_EXCEEDED: 409,
        ECONOMY_MARKET_DISABLED: 409,
        ECONOMY_IDEMPOTENCY_CONFLICT: 409,
        ECONOMY_POSTING_FAILED: 500
    } // TZ §8.4
    export const economyCargoEntrySchema = z.object({
        nomenclatureCode: z.string().min(1),
        nomenclatureName: z.string().min(1),
        quantity: z.number(),
        unit: z.string().min(1),
        massKg: z.number().nonnegative()
    }) // display-ready: names resolved server-side, codes only as stable keys
    export const economySummarySchema = z
        .object({
            wallet: z.object({ currency: z.string().min(1), balance: z.number() }),
            cargo: z.array(economyCargoEntrySchema),
            capacity: z.object({ usedKg: z.number(), maxKg: z.number() }),
            market: z.array(
                z.object({
                    nomenclatureCode: z.string(),
                    nomenclatureName: z.string(),
                    side: z.enum(['sell', 'buy']),
                    price: z.number(),
                    unit: z.string()
                })
            ),
            operations: z.array(
                z.object({ id: economyUuidV7Schema, type: z.string(), quantity: z.number(), total: z.number(), occurredAt: z.string() })
            ),
            atStation: z.boolean(),
            stationName: z.string().nullable()
        })
        .strict() // superset of TZ §8.1 (additive: names/atStation/stationName) — no TZ field removed
    ```
-   [ ] A2. `economyPanelConfigSchema` in `dashboardWidgetConfigSchemas.ts` (`z.object({ title: z.string().min(1).optional(), showRecentOperations: z.boolean().default(true) }).strict()`) + `DASHBOARD_WIDGET_CONFIG_SCHEMAS` entry; `registerWidget('economyPanel', ['center', 'right'], { multiInstance: false, ...policy })` in `dashboardWidgetRegistry.ts` mirroring `resourcePreview`'s zone policy (`dashboardWidgetRegistry.ts:634-636` — `overviewCards`/`detailsTable` are center-only and cannot serve this payload).
-   [ ] A3. Shared i18n: `common.layouts.widgets.economyPanel` (+`widgetBindings`/`widgetPresentation` groups per the per-widget invariants loop) in `packages/universo-react-i18n/src/locales/{en,ru}/core/common.json` — BOTH locales required (the parity test loads the real files).
-   [ ] A4. Update parity gates: `retainedDashboardKeys` in `dashboardWidgetRegistry.test.ts:28-58`; **field-ownership inventory row** in `memory-bank/research/dashboard-complete-entity-backed-widgets-field-ownership-2026-10-02.md` (+ `Inventory self-check` count).
-   [ ] A5. Run `pnpm --filter @universo-react/types test` — all parity tests green. Plus a types-package unit test asserting `ledgerConfigSchema` accepts the economy register configs (registrar/appendOnly/instant, `registrarKinds: ['object']`, the four projections with `period: 'day'`, default keyFields) and rejects `registrarKinds: ['ledger']` for these registers (TZ §14.1 first item).

### Phase B — Applications backend: economy service, routes, posting core, idempotency store

-   [ ] B1. Posting core extraction (pure refactor, HTTP shell unchanged): `runRecordStateCommandCore({ ctx, objectCollection, attrs, rowId, command, expectedVersion, recordCommandService, postingMovementService }) → { responsePayload, afterLifecycleRequest }` from `posting.ts:117-285` (verified free of req/res coupling); the shell keeps parsing, error mapping, `dispatchRuntimeLifecycleAfterCommit`, response sending (`posting.ts:286-295`). Route-level jest suite for post/unpost/void must stay green (contract describe at `applicationsRoutes.test.ts:~11030`).
-   [ ] B2. `_app_constants` system table (D3): `schema-ddl/src/systemTables.ts` + generation; sync writes `snapshot.constants` groups (`applicationSyncContracts.ts:31-42,63`) into it; columns `{ id uuid default $uuid_v7, group_id uuid, codename jsonb, data_type text, value_json jsonb, sort_order int }` + system cols. Fail-soft read rule per D3. **Checkpoint**: if sync-side complexity exceeds ~1 day, fall back to baked `setConstantRef` reads and record the deviation.
-   [ ] B3. Migration for the idempotency store (D7): `platform/migrations/<next-free>-CreateEconomyIdempotency.sql.ts` in the **platform applications schema** (`applications.obj_economy_idempotency`, columns + scoping + hardening per D7). **Registration surface (guest precedent):** export from `platform/migrations/index.ts`, add to the migrations array in `platform/systemAppDefinition.ts` with `bootstrapPhase: 'post_schema_generation'`; `packages/universo-react-migrations-platform` picks it up automatically via `loadPlatformMigrationsFromSystemApps` (only its parity test count may need updating). **No `targetBusinessTables` entry** (platform applications-schema table, guest precedent).
-   [ ] B4. `services/runtimeEconomyService.ts` — pure, ctx-taking, fully parameterized SQL over **per-component physical columns**. Storage facts: runtime entity tables store each field in its own column `cmp_<fieldId>` (names resolved as `attr.column_name` from `_app_components` via `resolveRuntimeObjectCollection` / `loadRuntimeObjectAttrs`); table names are `obj_<entityId>`; the active-row condition comes from `buildRuntimeActiveRowCondition(...)` with the workspace placeholder replaced (`create.ts:676-682` pattern); **never reference a `data` jsonb column and never hardcode `obj_wallet`**.
    ```ts
    // Wallet ensure: check-then-create under an advisory transaction lock (D6) — FIRST in the trade tx
    export async function ensureWalletForUser(ctx: RuntimeSchemaContext, currency: string): Promise<WalletRow> {
        return ctx.manager.transaction(async (tx) => {
            await acquireAdvisoryXactLock(tx, `${ctx.userId}:${currency}`) // @universo-react/utils/database, locks.ts:20
            const existing = await tx.query(
                `SELECT id FROM ${qSchemaTable(
                    ctx.schemaIdent,
                    walletCollection.tableName
                )} WHERE ${activeCondition} AND ${ownerColumn} = $1`,
                [ctx.userId]
            )
            if (existing.rows.length > 0) return existing.rows[0]
            return createEconomyRow(tx, ctx, walletCollection, { OwnerKey: ctx.userId, Currency: currency, Status: 'Active' })
        })
    }
    ```
    `createEconomyRow` wraps the full assembly: `resolveRuntimeObjectCollection` → `buildCreateScalarColumnValues` → `validateCreatePendingRow` → table-data/touched-components entries → `normalizeRuntimeRecordBehavior` → `executeCreateRowTransaction` (all exported; `create.ts:338-592`, throws `UpdateFailure`, `INSERT ... RETURNING id`); the returned `afterCreateLifecycleRequest` is dispatched post-commit via `dispatchRuntimeLifecycleAfterCommit` (`create.ts:830`) — kept, not dropped.
-   [ ] B4a. `getEconomySummary(ctx)` in the same service: resolve constants (`_app_constants`, fail-soft), station row (name), market list (side/price/unit from nomenclature + constants); wallet balance via `queryProjection({ executor: ctx.manager, schemaName: ctx.schemaName, ledgerId, currentWorkspaceId, projectionCodename: 'walletBalance', filters: { WalletKey, Currency } })` — **server-injected filters, parameterized, fail-closed** (`runtimeLedgersService.ts:402-421`); cargo via `stockBalance` + nomenclature mass math; capacity used/max; last 5 Operations via ownerOnly record read; `atStation`/`stationName` via the Phase C room bridge (null → `atStation=false, stationName=null`); **StarterGrant bootstrap per D11**; zod-validate output against `economySummarySchema` before returning.
-   [ ] B5. Trade flow (`sell` / `buy`), one transaction, **order fixed to kill the TOCTOU window**: ① idempotency gate (B7) → ② resolve economy config (constants, station row, nomenclature rows) → ③ proximity check via room bridge (Phase C): distance `position ↔ targetObjects[stationId]` ≤ `MarketRadiusMeters`, else `UpdateFailure(409, { code: 'ECONOMY_NOT_AT_STATION' })` → ④ **`ensureWalletForUser` — acquires the per-user+currency advisory transaction lock FIRST, before any balance read** → ⑤ server-side validation computed AFTER the lock is held (all reads now observe every committed concurrent trade for this user): quantity > 0 (`ECONOMY_INVALID_QUANTITY`), cargo/funds/capacity/market (`ECONOMY_INSUFFICIENT_CARGO` / `ECONOMY_INSUFFICIENT_FUNDS` / `ECONOMY_CAPACITY_EXCEEDED` / `ECONOMY_MARKET_DISABLED`) → ⑥ (first action) once-only StarterGrant — inside the SAME advisory-locked transaction → ⑦ create `Operation` row (`createEconomyRow` assembly) → ⑧ `runRecordStateCommandCore({ ..., command: 'post' })` (movements by `MmoommEconomyPostingModule.beforePost`, TZ FR-014…FR-017) → ⑨ re-read summary and return `{ operationId, walletBalance, cargo }` (TZ §8.2). All failures throw `UpdateFailure` → whole transaction rolls back (no partial facts, FR-014).
-   [ ] B6. `controllers/runtimeEconomyController.ts` + routes in `applicationsRoutes.ts` (already routeSources-registered → auto-documented): `GET /:applicationId/runtime/economy/summary`, `POST /:applicationId/runtime/economy/sell`, `POST /:applicationId/runtime/economy/buy`. **Per-route limiters (repo convention is per-route, no router-level mount):** summary → `readLimiter`; sell/buy → `writeLimiter`. **Permissions:** trade routes call `ensureRuntimePermission(res, ctx, 'editContent')` (posting precedent, `posting.ts:102`); summary follows the runtime read convention (no content permission) because it is server-scoped to `ctx.userId` via ownerOnly filters. Body schemas strict `{ stationId: economyUuidV7Schema, nomenclatureCode: z.string().min(1).max(64), quantity: z.number() }`; client-supplied `ownerKey|walletId|balance|price|status` rejected 422 before any DB work (TZ FR-023); errors only as `{ error, code }` with D9 status mapping (no SQL/UUID leakage — TZ §11).
-   [ ] B7. Idempotency gate + store (D7), three-module split mirroring the guest precedent: `persistence/economyIdempotencyStore.ts` (store on DbExecutor: `findEconomyIdempotency`, `saveEconomyIdempotency`, `purgeExpiredEconomyIdempotency` — all `RETURNING`/fail-closed), `services/runtimeEconomyService` gate integration, `services/economyIdempotencyMaintenance.ts` (15-min interval, batched deletes). Gate: parse+validate key (UUID v7 → 400 on malformed), hash (sha256 hex, raw key never stored), fingerprint = HMAC(canonical body), scoped lookup by `(application_id, user_id, key_hash)`, hit+fingerprint-equal → replay stored `{status, body}`; hit+mismatch → `409 ECONOMY_IDEMPOTENCY_CONFLICT`; miss → run handler inside the same transaction, then INSERT the response row (atomic with the trade — crash-safe replay).
-   [ ] B8. Tests (Jest):
    -   unit: `runtimeEconomyService.test.ts` (validation matrix, capacity/funds/cargo math, StarterGrant once-only inside the lock, movement composition for StarterGrant/Sell/Buy, `ECONOMY_POSTING_FAILED` → 500 `{error, code}` shape without internals); idempotency store (replay/conflict/expiry/scoped-unique);
    -   unit: **posting-module reverse semantics** — void/unpost of a posted `Operation` emits compensating WalletLedger/InventoryLedger facts (negated amounts, distinct source line ids), original facts preserved, projections revert (FR-017, TZ §14.1);
    -   PG integration (`*.integration.test.ts`, `DATABASE_TEST_URL` gate, `withRollback`): real posting through the authored module, idempotency unique-index behavior, workspace-RLS positive path (Tier 1 executor), second-user isolation, zero-row fail-closed asserts, **partial-failure rollback** (force a failure between movement appends via a test hook → transaction rolls back, Operation stays Draft, zero facts persisted — FR-014), **double-spend regression**: two concurrent same-user sells on the same funds → exactly one succeeds, no negative balance (TOCTOU guard), **unpost integration**: posted trade unposted → balance/stock projections revert exactly; repeated unpost fails closed.
    -   Run: `pnpm run test:applications-integration:local-supabase`.

### Phase C — Realtime room bridge (read-only)

-   [ ] C1. `FixedTickSceneRoom.describeShipForUser(userId: string)` — public read-only method returning plain JSON-serializable data (`remoteRoomCall` JSON-round-trips args; returns pass through for local rooms): `userShips.get(userId) → ships.get(shipId)` → `{ position: {x,y,z}, stations: [{ id, position }] }` from `roomOptions.targetObjects`; `null` for absent/viewer-only users (no ship). No state mutation. (`identify_local_ship` only echoes a shipId to the client — cannot serve a server-side bridge; new method is genuinely required.)
-   [ ] C2. Export `queryFixedTickRoomsForApplication(applicationId): Promise<RoomSummary[]>` from `applicationsRealtimeRuntime.ts`: `matchMaker.query({ name: ROOM_NAME })` → filter `metadata.scopeId.startsWith(`${applicationId}:`)` → collect `{ roomId, scopeId }`; expose via the runtime handle so `core-backend` stays the only wiring point.
-   [ ] C3. `services/runtimeFlightRoomBridge.ts`: iterate live rooms → `remoteRoomCall(roomId, 'describeShipForUser', [ctx.userId])` → first non-null wins; every call `try/catch`-wrapped (room-disposed race → treat as no session). Clients can never invoke room methods directly (only registered `onMessage` types exist) — server-internal only.
-   [ ] C4. Explicitly OUT: room-message trade, roomOptions changes, `parseRoomOptions`/HMAC changes, room→DB writes.

### Phase D — Runtime widget (`packages/universo-react-apps-template-mui`)

-   [ ] D1. `src/api/api.ts`: `fetchRuntimeEconomySummary(apiBaseUrl, applicationId, signal)` (GET, credentials include, zod-parse via `economySummarySchema`), `postEconomyTrade(apiBaseUrl, applicationId, kind: 'sell'|'buy', body, idempotencyKey)` (POST with `Idempotency-Key` header via `fetchWithCsrf`, `api/client.ts:238`).
-   [ ] D2. `EconomyPanelWidget.tsx` — TanStack Query per D10:
    ```tsx
    const summary = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? ['economy']),
            'economy-summary',
            apiBaseUrl,
            applicationId,
            { locale, workspaceId }
        ],
        queryFn: ({ signal }) => fetchRuntimeEconomySummary(apiBaseUrl, applicationId, signal),
        enabled: Boolean(applicationId) && canFetch,
        refetchInterval: 15_000
    })
    const trade = useMutation({
        mutationFn: (input: { kind: 'sell' | 'buy'; nomenclatureCode: string; quantity: number }) =>
            postEconomyTrade(apiBaseUrl, applicationId, input.kind, input, idempotencyKeyRef.current),
        onSuccess: () => {
            idempotencyKeyRef.current = generateUuidV7()
            queryClient.invalidateQueries({ queryKey: ['economy'] })
        },
        onError: (e) => setLastError(localizeEconomyError(e, t)) // t('runtime.economyErrors.<code>', { defaultValue })
    })
    ```
    Sections per UI Contract; status/empty/error via `RuntimeWidgetStatus`; `atStation=false` + `details.permissions?.editContent` gate the trade buttons; `LinearProgress` capacity bar; quantity validated client-side.
-   [ ] D3. `widgetRenderer.tsx` case + lazy import (mirror the `playcanvasCanvas` case style at `:321-326`).
-   [ ] D4. i18n: `apps.json` EN/RU — `dashboard.widget.economy.*` labels + `runtime.economyErrors.*` dictionary (all 9 codes + generic fallback). Zero untranslated strings.
-   [ ] D5. Vitest: component tests (mock api module) — renders sections from a fixture summary; disabled-state from `atStation:false` + permission gate; error mapping (code → localized string; **real locale resources loaded**, EN + RU); `widgetPlacementGraph` strict-config contract passes.

### Phase E — Layout editor coverage (metahubs-frontend, minimal)

-   [ ] E1. Verify the generic widget editor covers `economyPanel` in `LayoutDetails.tsx` widget dialog (registry-driven config fields); if the metahubs side requires per-widget dialog registration (the `PlayCanvasCanvasWidgetEditorDialog` precedent), add a minimal editor with the two optional config fields + testids.
-   [ ] E2. `layouts.widgets.economyPanel` label renders in the Add-widget picker (EN/RU) — covered by the shared-locale parity test (A3).

### Phase F — Product-file generator (tools/testing/e2e, UI-first)

-   [ ] F1. `mmoommAppGeneratorData.ts`: economy codenames/constants module (`NOMENCLATURE_CODE`, `WALLET_CODE`, `OPERATION_CODE`, `OPERATION_TYPE_ENUM`, `UNIT_ENUM`, `ECONOMY_CONSTANTS_CODE`, `WALLET_LEDGER_CODE`, `INVENTORY_LEDGER_CODE`, constant values `CR/1000/10/10/5/100/80`, localized labels) **+ `economyPostingModuleSource`** (the `MmoommEconomyPostingModule` source string, mirroring the `serverModuleSource` pattern at `mmoommAppGeneratorData.ts:30-63`).
-   [ ] F2. `metahub-authoring.ts` new helpers (order-sensitive per research RQ7):
    1. `createEconomyObjectsThroughBrowser` — Nomenclature (Code/Name/Unit/MassPerUnit/VolumePerUnit/BasePrice/Status), Wallet (OwnerKey/Currency/Status), Operation (OperationType/Wallet/Station/Nomenclature/Quantity/UnitPrice/OccurredAt/Status) via `createStandardEntityThroughBrowser` + data-schema component steps;
    2. `createEconomyEnumerationsThroughBrowser` (OperationType: StarterGrant/Sell/Buy/Mine/Fee; Unit: Kg/Liter/Unit/M3) — reuse `createMovementCommandsThroughBrowser` pattern;
    3. `createEconomyConstantsThroughBrowser` (EconomyConstants set + 7 fixed values) — reuse `createSimulationConstantsThroughBrowser` pattern;
    4. `configureLedgerRegisterThroughBrowser` — for WalletLedger/InventoryLedger: create object → add components → reopen edit dialog → **Ledger schema tab**: enable "Use this entity as a ledger", mode facts, mutation appendOnly, source registrar, periodicity instant, registrarKinds `['object']`, effectiveDateField `OccurredAt`; components — **WalletLedger**: WalletKey, Currency, OperationType, Amount, OccurredAt, SourceObjectId, SourceRowId, SourceLineId; **InventoryLedger**: OwnerKey, StationCode, NomenclatureCode, Quantity, Cost, OccurredAt, SourceObjectId, SourceRowId, SourceLineId; fieldRoles with `sum` aggregates per TZ §7.4/§7.5; projections — `walletBalance` (balance; WalletKey, Currency; Amount), `walletTurnover` (turnover; WalletKey, Currency; Amount; **period day**), `stockBalance` (balance; OwnerKey, NomenclatureCode; Quantity, Cost), `stockTurnover` (turnover; OwnerKey, NomenclatureCode; Quantity, Cost; **period day**); idempotency keyFields default (`source_object_id/source_row_id/source_line_id`) — wait for `PATCH /api/v1/metahub/:id/entity/:entityId` (`expectedVersion` handling);
    5. `createEconomyPostingModuleThroughBrowser` — author `MmoommEconomyPostingModule` via the Modules tab using the existing `createRuntimeModuleThroughBrowser` helper (paste `economyPostingModuleSource` into `testid=entity-modules-editor-shell`, wait for `POST /api/v1/metahub/:id/modules`): moduleRole `module`, capabilities `['lifecycle']` (+ `metadata.read` for constants/records reads), a `@AtServer()` `beforePost` handler reading `payload.previousRow` (OperationType/Quantity/Wallet/Nomenclature/Station) + economy constants via `ctx.records`, returning the WalletLedger/InventoryLedger movements exactly per TZ FR-015 (StarterGrant +50 CR & +10 kg / Sell +Quantity×OrePrice & −Quantity / Buy −Quantity×FuelPrice & +Quantity). **Must exist BEFORE step 6** (target selection/module codename).
    6. `configureOperationPostingThroughBrowser` — Behavior tab: mode transactional, posting manual, `posting.targetLedgers` = both registers, **`posting.moduleCodename = 'MmoommEconomyPostingModule'`**, states Draft(initial)/Posted/Voided, **record display prefix `OP-`**, **`recordBehavior.immutability: 'posted'`** (real config field; docs' `immutableWhenPosted` is stale drift), effectiveDate `OccurredAt`;
    7. `addFlightStationMarketComponentsThroughBrowser` + seed rows via `createRecord` API helper (API, not UI — no records grid exists): FlightStation components MarketEnabled (BOOLEAN, true), MarketFeePercent (NUMBER, 0) **and FlightStation row values `{ MarketEnabled: true, MarketFeePercent: 0 }`** (TZ §7.6); Nomenclature/ORE `{ Ore, Kg, mass 1, volume 0.001, price 10 }`, Nomenclature/FUEL `{ Fuel, Liter, mass 0.8, volume 0.001, price 5 }`.
-   [ ] F3. `runtime-authoring.ts`: `configureEconomyPanelThroughBrowser` — Add widget → economyPanel → right zone → save → verify via `listLayoutZoneWidgets` (pattern: `configurePlayCanvasCanvasWidgetThroughBrowser`).
-   [ ] F4. `generate-mmoomm-app-export.ts`: invoke F2/F3 steps in the correct order before publication/export.
-   [ ] F5. Contracts: `mmoommAppFixtureContract.shared.ts` (+economy codename constants), `assertDomainModel` (+required entities, enum options, set values, ledger configs present, posting targetLedgers = both registers, **posting module record exists and is attached to Operation**), new widget placement assertion (right zone, isActive); keep "exactly 2 playcanvasCanvas" and primary-nav assertions intact.

### Phase G — Fixture regeneration + runtime economy journey E2E + visual proof

-   [ ] G1. Regenerate the canonical fixture via the UI-first generator (local Supabase minimal):
        `pnpm run test:e2e:mmoomm-app-fixture-generator:local-supabase` (writes `.artifacts`; `UPDATE_MMOOMM_APP_FIXTURE=1` to promote) → `pnpm run check:mmoomm-app-fixture-drift -- tools/testing/e2e/.artifacts/generated-metahubs-mmoomm-app-snapshot.json` → `pnpm run check:mmoomm-app-fixture-contract`.
-   [ ] G2. New `specs/flows/snapshot-import-mmoomm-app-economy.spec.ts` (`@flow @slow`), copying the runtime-spec skeleton (api-session/bootstrap/run-manifest/mmoommAppSnapshotImport helpers): import fixture → publish/sync → open app as user A:
    -   **first open shows the granted state** (D11): 1000 CR / 10 kg ore (TZ §6.1) — assert via UI testids **and** `withE2eDatabaseClient` SQL checks on the app schema: wallet row (`_upl_created_by` = user A), StarterGrant Operation row posted, ledger facts with source ids, `_app_record_state='posted'`;
    -   sell 5 ORE → 1050 CR / 5 kg (UI + DB); buy 2 FUEL → 1040 CR / 2 L / mass 6.6; reload → state persists;
    -   second user B (bootstrap-context creation, per runtime-spec precedent): own 1000 CR / 10 kg; A's trades do not affect B; **B's summary payload contains no A rows** (cross-user read assertion);
    -   negative matrix (TZ FR-029 + §8.4): quantity ≤ 0 → 422 `ECONOMY_INVALID_QUANTITY`; unknown `nomenclatureCode` → 404 `ECONOMY_UNKNOWN_NOMENCLATURE`; sell more than owned → 409 `ECONOMY_INSUFFICIENT_CARGO`; buy beyond balance → 409 `ECONOMY_INSUFFICIENT_FUNDS`; buy beyond `MaxCargoMassKg` → 409 `ECONOMY_CAPACITY_EXCEEDED`; station `MarketEnabled=false` case → 409 `ECONOMY_MARKET_DISABLED` (seed a disabled-station variant in F2.7); direct ledger append → 403 `LEDGER_REGISTRAR_ONLY`; repeat POST with same `Idempotency-Key` → replayed response + single Operation row in DB; same key different body → 409 `ECONOMY_IDEMPOTENCY_CONFLICT`; trade payload carrying `ownerKey`/`price` → 422; out-of-station (before flying) → 409 `ECONOMY_NOT_AT_STATION` with buttons disabled. **Acceptance rule: all nine `ECONOMY_*` codes exercised by at least one test.**
-   [ ] G3. Visual verification (screenshots — never assume rendering):
    -   viewport matrix via `expectRuntimeUxViewportMatrix` with custom viewports `[{ width: 1280, height: 800 }, { width: 390, height: 844 }]` + the standard 1920×1080;
    -   `applyBrowserPreferences(page, { language: 'ru' })` / `switchRuntimeLocale(page, 'ru')` for RU; capture EN/RU × light/dark with `page.screenshot({ path: testInfo.outputPath(...) })` + `testInfo.attach` (artifact convention) — **inspect the PNGs** in `test-results` to confirm real layout, then promote a curated set;
    -   committed docs screenshots via a **dedicated capture script** (pattern: `capturePlayCanvasEditorUpgradeScreenshots.mjs` + a `docs:<topic>:screenshots` root script running the `generators` project) writing `docs/{en,ru}/.gitbook/assets/mmoomm-economy/*.png`, each referenced from the guide (asset-coverage check requires it);
    -   optional visual baseline for the panel region: `toHaveScreenshot` files in the spec's `-snapshots/` folder (`maxDiffPixelRatio: 0.01`), update via `pnpm test:e2e:visual:update`.
-   [ ] G4. Full gate: `pnpm run test:e2e:mmoomm-app-gate:local-supabase` (generator → drift → runtime). If other fixtures are touched (they should NOT be), run the six-fixture gate `pnpm run test:e2e:dashboard-fixtures:regenerate:verify:local-supabase`.
-   [ ] G5. Manual acceptance checklist (recorded in the PR description; TZ §14.4): 3D scene and flight loop behave as before (fly, arrive, multi-ship — existing mmoomm-app gate runtime specs pass unchanged); `economyPanel` in the right zone does not overlap the PlayCanvas canvas at 1920×1080 / 1280×800 / 390×844 (screenshot evidence from G3); EN/RU spot check.

### Phase H — Platform projection-permission fix (decision point — recommend SEPARATE follow-up)

-   [ ] H1 (optional, owner decision): add `ensureRuntimePermission` to `runtimeLedgersController` `listFacts`/`queryProjection`/`getProjection` and server-side per-user injection support to `queryProjection`. **Risk**: LMS runtime flows read these endpoints today without content permissions — audit first; if clean, ship in this PR; otherwise track as a dedicated follow-up with its own spec updates. Economy does NOT depend on this phase (summary service owns balance reads).

### Phase I — Docs, READMEs, i18n coverage, full verification

-   [ ] I1. Docs GitBook: `docs/en/guides/mmoomm-economy.md` + `docs/ru/guides/mmoomm-economy.md` (twins, structure mirroring `guides/ledgers.md`): overview, entity model (registers as object+ledgerSchema), posting module (authored data, not platform code), trading loop, station proximity & flight-session semantics, idempotency, per-user isolation, error codes table (§8.4 with statuses), E2E screenshots (referenced assets); register in BOTH `SUMMARY.md` Guides sections; update `docs/{en,ru}/guides/ledgers.md` with an economy cross-link; validate `pnpm docs:i18n:check && pnpm docs:gitbook-screenshot-assets:check` (+ Prettier).
-   [ ] I2. READMEs: `packages/universo-react-applications-backend/README.md` (Runtime endpoints + Economy section: routes, idempotency store, room bridge, posting module), `packages/universo-react-apps-template-mui/README.md` (Economy panel widget section), `packages/universo-react-types/README.md` (economy contracts near "Object And Ledger Contracts"), `packages/universo-react-metahubs-backend/README.md` (Economy template contract + integration-tests entry), `tools/testing/e2e/README.md` + `README-RU.md` (new economy gate/spec/capture script in Run Modes / Snapshot Generators).
-   [ ] I3. i18n coverage gates: `pnpm --filter <pkg> lint` for touched packages; i18n key coverage check — zero missing EN/RU keys.
-   [ ] I4. Full verification ladder:
    1. `pnpm --filter @universo-react/types test && pnpm --filter @universo-react/utils test`
    2. `pnpm --filter @universo-react/applications-backend test` (Jest unit) + `pnpm run test:applications-integration:local-supabase`
    3. `pnpm --filter @universo-react/apps-template-mui test` (+ `typecheck: tsc -p tsconfig.typecheck.json`)
    4. `pnpm run check:mmoomm-app-fixture-contract && pnpm run check:mmoomm-app-fixture-drift`
    5. `pnpm run test:e2e:mmoomm-app-gate:local-supabase`
    6. Root `pnpm build` (cross-package consistency; rest-docs routeSources gate runs inside)
    7. Thermos review via the `autoreview` tool (`.agents/skills/thermos*`) before PR; no CRITICAL blockers allowed to merge.
-   [ ] I5. Memory Bank: progress/tasks entries; verify no schema/template version changed (`CURRENT_SCHEMA_SNAPSHOT_VERSION` untouched; no template manifest diff).

## Code Examples (quality / performance / safety patterns to follow)

**Runtime storage shape (QA-corrected):** runtime entity tables store each field in its own physical column `cmp_<fieldId>` (resolved as `attr.column_name` from `_app_components`); table names are `obj_<entityId>` resolved via `resolveRuntimeObjectCollection`; the active-row condition comes from `buildRuntimeActiveRowCondition(...)` with the workspace placeholder replaced; **never reference a `data` jsonb column** (runtime code has zero `data->>` reads).

**Parameterized, schema-qualified SQL only (AGENTS.md §2.6):**

```ts
const rows = await executor.query(
  `SELECT id, ${quoteIdentifier(priceAttr.column_name)} AS base_price, ${quoteIdentifier(codeAttr.column_name)} AS code
     FROM ${qSchemaTable(ctx.schemaIdent, nomenclatureCollection.tableName)}          -- obj_<entityId>, from @universo-react/database
    WHERE ${activeCondition}                                                          -- buildRuntimeActiveRowCondition + workspace placeholder bound
      AND ${quoteIdentifier(codeAttr.column_name)} = ANY($1::text[])`, [codes])       -- $1 bind — never interpolation
```

**Balance reads (server-injected, fail-closed):**

```ts
const { rows } = await ledgerService.queryProjection({
    executor: ctx.manager,
    schemaName: ctx.schemaName,
    ledgerId: walletLedgerId,
    currentWorkspaceId: ctx.currentWorkspaceId,
    projectionCodename: 'walletBalance',
    filters: { WalletKey: walletKey, Currency: constants.currencyCode } // never client-supplied
})
```

**Locks via the exported helper (never inline SQL):** `await acquireAdvisoryXactLock(tx, `${ctx.userId}:${currency}`)` (`@universo-react/utils/database`, `locks.ts:20`) — the same lock guards wallet-ensure, the once-only StarterGrant check, and the post-lock validation window.

**Fail-closed mutations (AGENTS.md §2.7):** every UPDATE/DELETE in the economy service and idempotency store uses `RETURNING` and throws a mapped `UpdateFailure` when zero rows are affected.

**Idempotency gate (guest semantics, scoped):**

```ts
const keyHash = sha256Hex(idempotencyKey) // raw key never stored; key validated as UUID v7 first
const fingerprint = hmacCanonicalBody(body) // port of guestSessionIdempotency.ts:42-54
await acquireAdvisoryXactLock(tx, `economy-idem:${keyHash}`)
const hit = await economyIdempotencyStore.findScoped(tx, { applicationId, userId: ctx.userId, keyHash, fingerprint })
if (hit) {
    if (!hit.matches) throw new UpdateFailure(409, { error: '...', code: 'ECONOMY_IDEMPOTENCY_CONFLICT' })
    return res.status(hit.statusCode).json(hit.response) // replay
}
// ...run the trade handler inside the same transaction, then store the response row (atomic with the trade)
```

**Room bridge (read-only, race-safe):**

```ts
export async function describeFlightContext(applicationId: string, userId: string): Promise<FlightContext | null> {
    const rooms = await queryFixedTickRoomsForApplication(applicationId) // matchMaker.query({ name: ROOM_NAME }) + scopeId prefix filter
    for (const room of rooms) {
        try {
            const ctx = await remoteRoomCall(room.roomId, 'describeShipForUser', [userId]) // local room → direct call (MatchMaker.ts:383-413)
            if (ctx) return ctx // plain JSON only: { position, stations: [{ id, position }] }
        } catch {
            /* room disposed between query and call → treat as no session */
        }
    }
    return null
}
```

## Potential Challenges & Mitigations

1. **Ledger/Behavior tab authoring via UI has no E2E precedent** (research RQ7): new helpers must select by label/role (no data-testids inside `LedgerSchemaFields`/`RecordBehaviorFields`) — mitigation: add focused testids to those two components as part of Phase F (small frontend change, covered by component tests).
2. **The posting module is authored data** (QA Fix 1): if the generator's module authoring or the `beforePost` payload shape misbehaves, E2E fails loudly at G2 — the module source is versioned in `mmoommAppGeneratorData.ts` and asserted by the contract (F5), so failures are debuggable; unit-test the module logic directly against `dispatchRuntimeLifecycle` payloads (B8).
3. **`_app_constants` sync touch-point** (D3): if snapshot-constants materialization turns out to touch more of the sync engine than expected, fall back to baked `setConstantRef` reads (checkpoint at B2) — economy logic is isolated behind `runtimeEconomyService` either way; reads fail soft on pre-existing schemas.
4. **Room-lifecycle races** (C3): rooms autoDispose; `matchMaker.query` → `remoteRoomCall` can race disposal — every call is `try/catch`-wrapped and null-typed; the trade returns `ECONOMY_NOT_AT_STATION` rather than a 5xx.
5. **`remoteRoomCall` JSON round-trips args/returns** — the room method returns plain JSON-serializable objects only (no Schema class instances).
6. **Idempotency replay vs posting atomicity**: the response row is stored INSIDE the same transaction as the trade; a crash between commit and response delivery still replays correctly on retry.
7. **Fixture drift surface**: economy additions touch many fixture sections — drift normalization already covers uuid/hash/timestamp tokens; only genuinely new volatile shapes would need `normalizeVolatileValues` extensions (checked at G1).
8. **Maintainability**: keep `runtimeEconomyService.ts` lean (well under the 1104-line `runtimeLedgersService.ts`) by splitting the idempotency store into `persistence/economyIdempotencyStore.ts` + `services/economyIdempotencyMaintenance.ts` (guest three-module precedent); `runtimeEconomyService`/`runtimeEconomyController` match the existing `runtime*Service`/`runtime*Controller` naming.
9. **Performance NFR (TZ §12)**: summary ≤ 300 ms — projection aggregation is on-the-fly SQL over per-entity tables with workspace + active conditions; at MVP scale (~10³ facts) trivially met; trades ≤ 500 ms — single transaction, ≤ 6 statements + an in-process room round-trip (sub-ms). Structured console-log objects carry `operationId/applicationId/principalId`, no secrets.
10. **Do NOT touch**: flight scripts (`flight-control`, `follow-camera`, `remote-ships`), PlayCanvas Editor/Engine versions, collaboration/Code Editor/VCS/MCP, other fixtures, `CURRENT_SCHEMA_SNAPSHOT_VERSION`, template manifests.

## Rollback (TZ §13)

-   Revert the PR; the fixture is NOT hand-restored — re-regenerate from the previous commit via `pnpm run test:e2e:mmoomm-app-fixture-generator:local-supabase` + `UPDATE_MMOOMM_APP_FIXTURE=1` (never hand-edit).
-   DB: the `CreateEconomyIdempotency` migration ships a `down` (drop `applications.obj_economy_idempotency`); `_app_constants` removal is covered by the fresh-database contract (test DB deleted and recreated — no persistent economy state to migrate back). Platform projections/tables are additive and unused by other flows until Phase H ships.

## Dependencies

-   Phases are ordered: A → B/C (parallelizable after A) → D (after A+B API shape) → E/F (after A) → G (after all) → I. H is independent.
-   Cross-package lockstep: types schema + apps-template-mui renderer + metahubs-frontend label must land together (registry parity tests enforce it).
-   Local Supabase (docker) required for G; hosted E2E env otherwise unaffected.

## Out of Scope (unchanged from TZ §15)

Mining/resource nodes, player-to-player market, contracts/taxes/dynamic prices/multi-currency (`Mine` stays an enum value only), binary assets, Editor/Engine upgrades, anonymous access, changes to flight mechanics, hand-editing fixtures.

## Decision Points for Owner Review

1. **D1 deviation** — registers as object+`ledgerSchema` (no template change) instead of the TZ's ledger-preset-in-template (FR-001). Forced by the "no template version bump" constraint; aligned with the architecture skill and the LMS precedent.
2. **D2 refinement** — proximity via REST + same-process room bridge instead of a room-message trade (research's primary). Rationale: dashboard-driven UX, no room→DB write plumbing, Tier 1 posting pipeline, simplest E2E; equally spoof-resistant.
3. **D3 + D7 vs TZ §13** — two new platform-infrastructure tables (`_app_constants`, `applications.obj_economy_idempotency`); no balance/cargo state tables (TZ §7 intent preserved).
4. **D11** — StarterGrant bootstrap in the summary GET (side-effecting GET documented) so TZ §6.1's first-entry state holds.
5. **Phase H** — ship the platform projection-permission fix in this PR or track separately (LMS-consumer audit decides).

## Links

-   Research artifact (required input): `memory-bank/research/mmoomm-metahub-economy-research-2026-11-12.md`
-   Manager brief: local hand-off spec for the MMOOMM Metahub Economy MVP (TZ DOC-2026-005; stored outside the repository in the local manager workspace)
-   Plan-mode/QA skills applied: `universo-platform-architecture`, `mui-runtime-ux-patterns` (UI Contract), `runtime-ux-qa` (verdict framing), `playwright-best-practices` (Phase G gates/commands), `thermos` (rubric framing), `research-before-plan`
