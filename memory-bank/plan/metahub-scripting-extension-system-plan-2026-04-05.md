# Plan: Metahub Scripting/Extension System (GDExtension-analog)

> **Created**: 2026-04-05
> **Updated**: 2026-04-05 (implementation closure synced)
> **Status**: Implemented and validated
> **Complexity**: Level 4+ (Major/Cross-cutting)
> **Design**: [creative-metahub-scripting-extension-system.md](../creative/creative-metahub-scripting-extension-system.md)
> **Analogies**: GDExtension (Godot Engine), 1С:Предприятие 8.x module objects
> **First use case**: Space Quiz widget (10 questions, 4 answers, server-side scoring)

---

## Overview

Create a scripting/extension system for metahubs that allows users to write TypeScript scripts attached to metadata entities (catalogs, hubs, sets, enumerations, attributes, and metahub-global scope). Scripts run in isolated V8 sandboxes (`isolated-vm`), support server/client code separation via `@AtServer`/`@AtClient` decorators (analogous to `&НаСервере`/`&НаКлиенте` in 1С), and integrate with the existing publication/snapshot/sync pipeline.

> **Closure update (2026-04-05):** the approved delivery scope is implemented and validated. The live code keeps one deliberate safety refinement versus the early draft below: methods stay private unless explicitly decorated, and `@AtServerAndClient()` is the explicit dual-target opt-in. The detailed unchecked bullets in the body remain as historical design decomposition; the canonical completion state is the summary checklist at the end of this file.

The architecture must also preserve forward-compatible seams for:
- multiple modules per metadata entity,
- explicit module roles (`object`, `manager`, `widget`, `global`),
- multiple source kinds (`embedded` in v1, `external` and `visual` reserved for later),
- capability-based API exposure with deny-by-default runtime injection,
- stable SDK/API-version compatibility similar in spirit to GDExtension's contract-driven extension model.

The first practical use case is a **Space Quiz** dashboard widget — 10 space-themed questions, 4 answers each, server-side scoring to prevent cheating, auto-advance after correct answer.

---

## New Packages

| Package | Type | Location | Purpose |
|---------|------|----------|---------|
| `@universo/extension-sdk` | Source-only (peerDeps) | `packages/extension-sdk/base/` | Stable SDK contract for script authors: TypeScript types, decorators, registry metadata, `ExtensionScript` base class |
| `@universo/scripting-engine` | Built (tsdown) | `packages/scripting-engine/base/` | V8 isolate pool, event router, script compiler, RPC handler |

## Affected Existing Packages (8)

| Package | Scope of changes |
|---------|-----------------|
| `@universo/types` | Add `ScriptManifest`, `MetahubScriptSnapshot` types; extend snapshot schema |
| `@universo/schema-ddl` | Add `_mhb_scripts` to branch system tables; add `_app_scripts` to runtime tables |
| `@universo/metahubs-backend` | New `scripts` domain (controller/service/store); extend `SnapshotSerializer` |
| `@universo/metahubs-frontend` | New `scripts` domain (hooks/pages); CodeMirror 6 editor integration (already in project) |
| `@universo/applications-backend` | `scriptRpcRoutes`; extend `syncEngine` with `persistPublishedScripts()` |
| `@universo/apps-template-mui` | `quizWidget` case in `widgetRenderer`; `QuizWidget` component (standard React, no generic ScriptedWidgetHost in v1) |
| `@universo/universo-i18n` | New `scripting` and `quiz` i18n namespaces |
| `@universo/universo-migrations-platform` | Migration for `_app_scripts` in runtime schemas |

---

## Phase 1: SDK + Engine Foundation

### Step 1.1: Create `@universo/extension-sdk` package

- [ ] Create `packages/extension-sdk/base/` directory structure
- [ ] Create `package.json` with source-only pattern (peerDependencies, no `main` to dist)
- [ ] Add to `pnpm-workspace.yaml`
- [ ] Add centralized version to root `pnpm-workspace.yaml` `catalog:`

**Key files:**

```
packages/extension-sdk/base/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # barrel export
│   ├── types.ts                  # ExecutionTarget, LifecycleEvent, EventContext, ScriptContext
│   ├── decorators.ts             # @AtServer, @AtClient, @OnEvent, @AtServerAndClient
│   ├── ExtensionScript.ts        # abstract base class
│   ├── registry.ts               # SDK API version constant, module role helpers, metadata binding helpers
│   ├── widget.ts                 # WidgetExtension interface (WidgetRenderResult deferred to future phase)
│   └── apis/
│       ├── records.ts            # RecordAPI: typed get/query/save by attachment kind + codename
│       ├── metadata.ts           # MetadataAPI: resolve entities/attributes by kind + codename
│       ├── http.ts               # HttpAPI, HttpRequestOptions, HttpResponse
│       ├── state.ts              # StateAPI interface
│       ├── log.ts                # LogAPI interface
│       └── i18n.ts               # I18nAPI interface
└── README.md
```

> **GDExtension analogue in Universo:** the direct analogue is not a native shared library loader. It is the combination of:
> - `@universo/extension-sdk` as the stable host contract,
> - a versioned manifest (`sdkApiVersion`) produced at publish time,
> - registry metadata (module role, attachment kind, lifecycle handlers, declared capabilities),
> - and the runtime `ScriptEngine` that loads compiled bundles into isolated sandboxes.
>
> This keeps the same architectural principle as GDExtension: extensions integrate through an explicit host API contract, not through arbitrary access to engine internals.

**Code example — decorators.ts:**

```typescript
// Legacy experimental decorators (experimentalDecorators: true in backend tsconfig)
// These are NO-OP compile-time markers consumed by the AST transformer at publication time.
// The acorn AST walker extracts __decorate() calls syntactically from esbuild output —
// Reflect.defineMetadata is NOT used and NOT needed. Decorators never execute at runtime
// inside the V8 isolate sandbox. They exist only as type-safe annotations for script authors.
//
// NOTE: The project uses legacy decorator syntax (target, propertyKey, descriptor),
// NOT TC39 Stage 3 decorators (value, context). This matches the project's
// experimentalDecorators: true tsconfig and esbuild's legacy decorator support.

import type { LifecycleEvent } from './types'

export function AtServer(
  _target: any, _propertyKey: string, _descriptor: PropertyDescriptor
): void {
  // No-op marker: AST transformer identifies this decorator call in compiled output
}

export function AtClient(
  _target: any, _propertyKey: string, _descriptor: PropertyDescriptor
): void {
  // No-op marker: AST transformer identifies this decorator call in compiled output
}

export function OnEvent(event: LifecycleEvent): MethodDecorator {
  return (_target, _propertyKey, _descriptor) => {
    // No-op marker: AST transformer extracts the event name from the call expression
    void event // referenced to avoid unused-var lint warning
  }
}

export function AtServerAndClient(
  _target: any, _propertyKey: string, _descriptor: PropertyDescriptor
): void {
  // No-op marker — explicit dual-target exposure without making undecorated helpers public
}
```

> **Important — decorator compilation pipeline:**
> 1. Script author writes TypeScript with `@AtServer`, `@AtClient`, `@OnEvent(...)` decorators
> 2. At publication time, `ScriptCompiler` runs esbuild to transpile TS → JS (with `experimentalDecorators` support, producing `__decorate()` helper calls)
> 3. `AstTransformer` uses acorn to parse the JS output and find `__decorate()` patterns to determine which methods are server-only, client-only, or event handlers
> 4. Transformer produces separate server/client bundles by splicing out the opposite-target methods
> 5. The decorator functions themselves are stripped and never shipped to the V8 isolate sandbox
> 6. `reflect-metadata` is NOT a dependency — no runtime metadata reflection is used

**Code example — ExtensionScript.ts:**

```typescript
import type { ScriptContext } from './types'

export abstract class ExtensionScript {
  protected ctx: ScriptContext = null as unknown as ScriptContext
  // ctx is injected at runtime by the scripting engine
}
```

> **SDK package constraints (IMPORTANT):**
> - `@universo/extension-sdk` is a **source-only** package — it has no build step and no `dist/` output
> - It is a **peerDependency** of `@universo/scripting-engine` (backend only)
> - **Frontend packages must NOT import `@universo/extension-sdk` directly** — the frontend `tsconfig.json` does not enable `experimentalDecorators` and decorator syntax will fail to compile through the frontend build pipeline
> - Script authors write TypeScript in the embedded CodeMirror editor; their code is compiled by `ScriptCompiler` (esbuild) on the server at publication time, not by the project's frontend tsc
> - SDK types are provided to the CodeMirror editor for autocompletion via a custom `CompletionSource` (string-based, no TS import required)
> - The compiled client-side script bundles (plain JavaScript) are served via the `/scripts/:scriptId/client` endpoint and loaded by the browser — no decorator syntax in the output
> - **The public SDK must not expose raw SQL execution in v1.** Script authors interact with metadata and records through domain-safe APIs by attachment kind and codename. Any low-level SQL bridge remains an internal engine seam only.

### Step 1.2: Create `@universo/scripting-engine` package

- [ ] Create `packages/scripting-engine/base/` directory structure
- [ ] Create `package.json` with built package pattern (tsdown, tsconfig)
- [ ] Add `isolated-vm` and `esbuild` as dependencies
- [ ] Add `acorn` for AST parsing
- [ ] Add to `pnpm-workspace.yaml`

**Key files:**

```
packages/scripting-engine/base/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── src/
│   ├── index.ts
│   ├── sandbox/
│   │   ├── IsolatePool.ts          # V8 isolate pool management (LRU eviction)
│   │   ├── RecordsBridge.ts        # internal bridge behind RecordAPI / MetadataAPI with RLS-scoped executor wrapper
│   │   └── HttpBridge.ts           # outbound HTTP with domain allowlist + private IP block
│   ├── router/
│   │   └── EventRouter.ts          # lifecycle event → script handler dispatch
│   ├── compiler/
│   │   ├── ScriptCompiler.ts       # esbuild transpile + acorn AST → server/client bundles
│   │   ├── AstTransformer.ts       # decorator metadata extraction + method splicing
│   │   └── types.ts                # ScriptManifest, CompiledScript, CompilationResult
│   ├── logging/
│   │   └── ScriptLogger.ts         # ring buffer log capture per application
│   ├── health/
│   │   └── ScriptHealthMonitor.ts   # failure counters, circuit breaker, cooldown windows
│   ├── engine/
│   │   └── ScriptEngine.ts         # top-level orchestrator (compile, dispatch, RPC)
│   └── __tests__/
│       ├── IsolatePool.test.ts
│       ├── RecordsBridge.test.ts
│       ├── ScriptCompiler.test.ts
│       ├── EventRouter.test.ts
│       └── ScriptEngine.test.ts
└── README.md
```

**Code example — IsolatePool.ts (key method):**

```typescript
import ivm from 'isolated-vm'

export const DEFAULT_ISOLATE_CONFIG: IsolateConfig = {
  memoryLimitMB: 32,
  cpuTimeoutMs: 1000,
  wallTimeoutMs: 5000,
  maxIsolates: 50,
  preWarmCount: 5,
}

async acquire(scriptId: string, compiledCode: string): Promise<ScriptIsolate> {
  const existing = this.pool.get(scriptId)
  if (existing && !existing.isolate.isDisposed) {
    existing.lastUsedAt = Date.now()
    return existing
  }
  if (this.pool.size >= this.config.maxIsolates) {
    this.evictLRU()
  }
  const isolate = new ivm.Isolate({
    memoryLimit: this.config.memoryLimitMB,
  })
  const context = await isolate.createContext()
  await this.injectSafeGlobals(context, scriptId)
  const module = await isolate.compileModule(compiledCode, {
    filename: `script://${scriptId}.js`
  })
  // ... store in pool and return
}
```

**Code example — RecordsBridge.ts (domain-safe record access):**

```typescript
export interface RecordLookupInput {
  attachmentKind: 'catalog' | 'hub' | 'set' | 'enumeration' | 'attribute' | 'constant'
  attachmentCodename: string
  recordId?: string
}

export class RecordsBridge {
  constructor(private readonly executor: DbExecutor) {}

  async getOne<T>(input: RecordLookupInput): Promise<T | null> {
    const runtimeBinding = await this.resolveAttachmentBinding(input.attachmentKind, input.attachmentCodename)
    if (!runtimeBinding) return null

    const result = await this.executor.query<T>(
      `SELECT * FROM "${runtimeBinding.runtimeSchema}"."${runtimeBinding.tableName}"
       WHERE id = $1 AND _upl_deleted = false
       LIMIT 1`,
      [input.recordId]
    )
    return result.rows[0] ?? null
  }

  async query<T>(input: {
    attachmentKind: RecordLookupInput['attachmentKind']
    attachmentCodename: string
    filters?: QueryFilter[]
    limit?: number
    offset?: number
  }): Promise<T[]> {
    const runtimeBinding = await this.resolveAttachmentBinding(input.attachmentKind, input.attachmentCodename)
    if (!runtimeBinding) return []

    const { sql, params } = this.buildSafeSelect(runtimeBinding, input.filters ?? [], input.limit ?? 50, input.offset ?? 0)
    const result = await this.executor.query<T>(sql, params)
    return result.rows
  }
}
```

> **Security constraint:** `RecordAPI` / `MetadataAPI` are the public scripting surface. Raw SQL is not part of the v1 extension SDK. This matches the original requirement to address data by metadata kind and codename, reduces sandbox attack surface, and avoids leaking the runtime schema model into user scripts.

### Step 1.3: Add shared types to `@universo/types`

- [ ] Add `ScriptManifest` and `EventHandlerManifest` types
- [ ] Add `MetahubScriptSnapshot` type for snapshot transport
- [ ] Extend `MetahubSnapshot` interface optionally with `scripts?: MetahubScriptSnapshot[]`

**Code example:**

```typescript
// packages/universo-types/base/src/common/scripts.ts

export interface ScriptManifest {
  scriptId: string
  scriptCodename: string
  sdkApiVersion: string
  moduleRole: 'object' | 'manager' | 'widget' | 'global'
  attachmentKind: 'metahub' | 'hub' | 'catalog' | 'set' | 'enumeration' | 'attribute' | 'constant' | null
  sourceKind: 'embedded' | 'external' | 'visual'
  declaredCapabilities: Array<'records.read' | 'records.write' | 'metadata.read' | 'http' | 'state' | 'lifecycle' | 'rpc.client'>
  sourceHash: string
  compiledAt: string
  eventHandlers: EventHandlerManifest[]
  serverMethods: string[]
  clientMethods: string[]
  cpuTimeoutMs?: number
  memoryLimitMB?: number
}

export interface EventHandlerManifest {
  methodName: string
  event: string  // LifecycleEvent
  target: 'server' | 'client'
  priority?: number
}

export interface MetahubScriptSnapshot {
  id: string
  attachedToId: string | null
  attachedToKind: ScriptManifest['attachmentKind']
  moduleRole: ScriptManifest['moduleRole']
  sourceKind: ScriptManifest['sourceKind']
  codename: string
  name?: Record<string, unknown> | null
  description?: Record<string, unknown> | null
  compiledServerCode: string
  compiledClientCode: string
  manifest: ScriptManifest
  sourceHash: string
  executionTarget: 'server' | 'client' | 'server_and_client'
  sortOrder: number
}
```

### Step 1.4: Add `_mhb_scripts` table to `@universo/schema-ddl`

- [ ] Add `_mhb_scripts` as a system table definition in `SchemaGenerator`
- [ ] Include standard `_upl_*` and `_mhb_*` lifecycle fields
- [ ] Add unique codename index per attachment scope (`attached_to_kind`, `attached_to_id`, `module_role`)
- [ ] Add unit tests for the new table generation

> **Codename field type difference (by design):**
> - `_mhb_scripts.codename` is **JSONB** — stores the localized VLC (Value-Locale-Container) representation, consistent with all other branch-schema codename fields in the project
> - `_app_scripts.codename` is **TEXT** — stores the resolved primary English text, consistent with runtime tables where codenames are already resolved at publication time
> - `MetahubScriptSnapshot.codename` is `string` — carries the resolved text from branch (via `extractPrimaryText()`) through the snapshot into the runtime table
> - This matches the existing pattern: branch tables store JSONB codenames, runtime tables store resolved TEXT codenames

**Code example — table DDL:**

```sql
CREATE TABLE IF NOT EXISTS <schema>._mhb_scripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attached_to_kind VARCHAR(30),
  attached_to_id  UUID,
  module_role     VARCHAR(20) NOT NULL DEFAULT 'object',
  codename        JSONB NOT NULL,
  name            JSONB,
  description     JSONB,
  source_kind     VARCHAR(20) NOT NULL DEFAULT 'embedded',
  source_code     TEXT,
  source_descriptor JSONB,
  language        VARCHAR(20) NOT NULL DEFAULT 'typescript',
  execution_target VARCHAR(20) NOT NULL DEFAULT 'server_and_client',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_created_by UUID,
  _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_updated_by UUID,
  _upl_version    INTEGER NOT NULL DEFAULT 1,
  _upl_deleted    BOOLEAN NOT NULL DEFAULT false,
  _upl_deleted_at TIMESTAMPTZ,
  _upl_deleted_by UUID,
  _mhb_deleted    BOOLEAN NOT NULL DEFAULT false,
  _mhb_deleted_at TIMESTAMPTZ,
  _mhb_deleted_by UUID
);
```

> **Attachment model (IMPORTANT):** do not hardcode scripts to `_mhb_objects` only. The original requirement explicitly includes attributes, and the platform already has dedicated edit flows for attributes. The plan therefore uses a generic `attached_to_kind` + `attached_to_id` model so v1 can cover catalogs, hubs, sets, enumerations, attributes, and metahub-global scripts without a schema rewrite later.

> **Source model (IMPORTANT):**
> - v1 UI enables only `source_kind = 'embedded'`
> - `external` and `visual` are reserved values and not yet exposed in the UI
> - `source_descriptor` is the future seam for external file references or visual-program AST graphs
> - service-layer validation in v1 enforces: `source_kind === 'embedded'`, `language === 'typescript'`, and non-empty `source_code`

> **Capability model (IMPORTANT):**
> - every compiled script manifest carries `declaredCapabilities`
> - runtime API injection is deny-by-default: if a capability is not declared and allowed, the corresponding host API is not injected into the isolate
> - v1 capability allowlist by default:
>   - `object` / `manager` modules: `records.read`, `records.write`, `metadata.read`, `state`, `lifecycle`
>   - `widget` modules: `rpc.client`, `state`, `metadata.read`
>   - `global` modules: `metadata.read`, optional `http` only when explicitly enabled
> - publication-time validation rejects scripts that declare capabilities outside the allowed set for their module role

### Step 1.5: Unit tests for Phase 1

- [ ] IsolatePool: acquire, evict LRU, dispose, memory limit enforcement
- [ ] RecordsBridge: attachment resolution by kind/codename, RLS-safe query generation, pagination limits
- [ ] ScriptCompiler: TypeScript transpilation, decorator extraction, server/client bundle generation
- [ ] EventRouter: handler registration, priority dispatch, error capture
- [ ] ScriptEngine: end-to-end execute with mock isolate
- [ ] ScriptHealthMonitor: circuit breaker thresholds, cooldown reset, manifest capability enforcement

**Test strategy**: use Vitest (project standard). Mock `isolated-vm` for unit tests where V8 is not needed. Integration tests with real isolates in a separate test suite.

### Step 1.6: i18n namespaces for scripting

- [ ] Register `scripting` namespace in `@universo/universo-i18n`
- [ ] Create EN/RU translations for scripting domain

**Code example:**

```typescript
// packages/universo-i18n/base/src/namespaces/scripting.ts
import { registerNamespace } from '../registry'

registerNamespace('scripting', {
  en: {
    scripts: {
      title: 'Scripts',
      create: 'New Script',
      edit: 'Edit Script',
      delete: 'Delete Script',
      deleteConfirm: 'Are you sure you want to delete this script?',
      codename: 'Codename',
      name: 'Name',
      description: 'Description',
      language: 'Language',
      executionTarget: 'Execution Target',
      server: 'Server',
      client: 'Client',
      serverAndClient: 'Server & Client',
      sourceCode: 'Source Code',
      validate: 'Validate',
      preview: 'Preview Compilation',
      compilationSuccess: 'Compilation successful',
      compilationError: 'Compilation failed',
      noScripts: 'No scripts yet',
      attachedTo: 'Attached to',
      global: 'Global Script',
      errors: {
        duplicateCodename: 'Script with this codename already exists',
        compilationFailed: 'Script compilation failed',
        executionFailed: 'Script execution failed',
        timeout: 'Script execution timed out',
        memoryLimit: 'Script exceeded memory limit',
      }
    }
  },
  ru: {
    scripts: {
      title: 'Скрипты',
      create: 'Новый скрипт',
      edit: 'Редактировать скрипт',
      delete: 'Удалить скрипт',
      deleteConfirm: 'Вы уверены, что хотите удалить этот скрипт?',
      codename: 'Кодовое имя',
      name: 'Название',
      description: 'Описание',
      language: 'Язык',
      executionTarget: 'Среда выполнения',
      server: 'Сервер',
      client: 'Клиент',
      serverAndClient: 'Сервер и клиент',
      sourceCode: 'Исходный код',
      validate: 'Проверить',
      preview: 'Предпросмотр компиляции',
      compilationSuccess: 'Компиляция успешна',
      compilationError: 'Ошибка компиляции',
      noScripts: 'Скриптов пока нет',
      attachedTo: 'Привязан к',
      global: 'Глобальный скрипт',
      errors: {
        duplicateCodename: 'Скрипт с таким кодовым именем уже существует',
        compilationFailed: 'Ошибка компиляции скрипта',
        executionFailed: 'Ошибка выполнения скрипта',
        timeout: 'Превышено время выполнения скрипта',
        memoryLimit: 'Скрипт превысил лимит памяти',
      }
    }
  }
})
```

---

## Phase 2: Metahub Integration (Script CRUD + Editor)

### Step 2.1: Scripts domain in `@universo/metahubs-backend`

- [ ] Create `domains/scripts/` directory following Controller–Service–Store pattern
- [ ] Implement `scriptsStore.ts` (CRUD against `_mhb_scripts` via `DbExecutor.query()`)
- [ ] Implement `scriptsService.ts` (business logic, codename validation, compilation preview)
- [ ] Implement `scriptsController.ts` (request handling, Zod validation)
- [ ] Implement `scriptsRoutes.ts` (thin route registration)
- [ ] Register routes in the metahub handler factory

**API endpoints:**

```
GET    /metahub/:metahubId/branch/:branchId/scripts              # list scripts
GET    /metahub/:metahubId/branch/:branchId/scripts/:scriptId     # get script detail
POST   /metahub/:metahubId/branch/:branchId/scripts               # create script
PATCH  /metahub/:metahubId/branch/:branchId/scripts/:scriptId     # update script
DELETE /metahub/:metahubId/branch/:branchId/scripts/:scriptId     # delete script
POST   /metahub/:metahubId/branch/:branchId/scripts/:scriptId/validate  # validate/compile preview
```

Supported create/update payload fields must include:
- `attachedToKind`: `metahub | hub | catalog | set | enumeration | attribute | constant`
- `attachedToId`: UUID or `null` for metahub-global scripts
- `moduleRole`: `object | manager | widget | global`
- `sourceKind`: `embedded` in v1
- `declaredCapabilities`: validated capability list constrained by `moduleRole`

**Code example — scriptsStore.ts:**

```typescript
import type { DbExecutor } from '@universo/utils'

export async function listScripts(
  executor: DbExecutor,
  schemaName: string,
  attachedToKind?: string,
  attachedToId?: string,
  moduleRole?: string
): Promise<ScriptRow[]> {
  const filters: string[] = []
  const params: unknown[] = []

  if (attachedToKind) {
    params.push(attachedToKind)
    filters.push(`attached_to_kind = $${params.length}`)
  } else {
    filters.push(`attached_to_kind IS NULL`)
  }

  if (attachedToId) {
    params.push(attachedToId)
    filters.push(`attached_to_id = $${params.length}`)
  } else {
    filters.push(`attached_to_id IS NULL`)
  }

  if (moduleRole) {
    params.push(moduleRole)
    filters.push(`module_role = $${params.length}`)
  }

  const result = await executor.query<ScriptRow>(
    `SELECT id, attached_to_kind, attached_to_id, module_role, source_kind,
            codename, name, description, source_code, language,
            execution_target, sort_order, _upl_created_at, _upl_updated_at
     FROM "${schemaName}"._mhb_scripts
     WHERE _upl_deleted = false AND _mhb_deleted = false
     ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY sort_order ASC, _upl_created_at ASC`,
    params
  )
  return result.rows
}

export async function createScript(
  executor: DbExecutor,
  schemaName: string,
  data: CreateScriptInput,
  userId: string
): Promise<{ id: string }> {
  const id = generateUuidV7()
  await executor.query(
    `INSERT INTO "${schemaName}"._mhb_scripts
     (id, attached_to_kind, attached_to_id, module_role, source_kind,
      codename, name, description, source_code, language,
      execution_target, sort_order, _upl_created_by, _upl_updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
    [id, data.attachedToKind ?? null, data.attachedToId ?? null,
     data.moduleRole ?? 'object', data.sourceKind ?? 'embedded', JSON.stringify(data.codename),
     JSON.stringify(data.name ?? null), JSON.stringify(data.description ?? null),
     data.sourceCode ?? '', data.language ?? 'typescript',
     data.executionTarget ?? 'server_and_client', data.sortOrder ?? 0, userId]
  )
  return { id }
}
```

### Step 2.2: Extend `SnapshotSerializer`

- [ ] Add `scripts` section to `serializeSnapshot()` method
- [ ] Read `_mhb_scripts` from branch schema
- [ ] Compile scripts via `ScriptCompiler` during snapshot assembly
- [ ] Include compiled bundles + manifests in snapshot
- [ ] Handle compilation errors — block publication if any script fails to compile

**Code example — addition to SnapshotSerializer.ts:**

```typescript
// In serializeSnapshot():
const scriptRows = await scriptsStore.listScripts(executor, branchSchema)
const scriptSources = scriptRows.map(row => ({
  id: row.id,
  codename: extractPrimaryText(row.codename),
  sourceCode: row.source_code,
  language: row.language as 'typescript' | 'javascript',
  attachedTo: row.attached_to_id ? { entityId: row.attached_to_id, entityKind: row.attached_to_kind } : null,
  moduleRole: row.module_role,
  sourceKind: row.source_kind,
}))

const compiler = new ScriptCompiler()
const compilation = await compiler.compile(scriptSources)

if (compilation.errors.length > 0) {
  throw new CompilationBlockedError(compilation.errors)
}

snapshot.scripts = compilation.scripts.map(s => ({
  id: s.manifest.scriptId,
  attachedToId: scriptRows.find(r => r.id === s.manifest.scriptId)?.attached_to_id ?? null,
  attachedToKind: scriptRows.find(r => r.id === s.manifest.scriptId)?.attached_to_kind ?? null,
  moduleRole: scriptRows.find(r => r.id === s.manifest.scriptId)?.module_role ?? 'object',
  sourceKind: scriptRows.find(r => r.id === s.manifest.scriptId)?.source_kind ?? 'embedded',
  codename: s.manifest.scriptCodename,
  name: scriptRows.find(r => r.id === s.manifest.scriptId)?.name ?? null,
  description: scriptRows.find(r => r.id === s.manifest.scriptId)?.description ?? null,
  compiledServerCode: s.compiledServerCode,
  compiledClientCode: s.compiledClientCode,
  manifest: s.manifest,
  sourceHash: s.manifest.sourceHash,
  executionTarget: scriptRows.find(r => r.id === s.manifest.scriptId)?.execution_target
    ?? 'server_and_client',
  sortOrder: scriptRows.find(r => r.id === s.manifest.scriptId)?.sort_order ?? 0,
}))
```

### Step 2.3: Script editor UI in `@universo/metahubs-frontend`

- [ ] Create `domains/scripts/` directory with hooks, components, utils
- [ ] Add "Scripts" / "Модули" tab to entity editing dialogs using the existing `buildFormTabs()` + `TabConfig` pattern:
  - Add tab to `CatalogActions.tsx` (alongside General, Hubs, Layout tabs)
  - Add tab to `HubActions.tsx` (alongside General, Hubs tabs)
  - Add tab to `SetActions.tsx` and `EnumerationActions.tsx` similarly
  - Add tab to `AttributeActions.tsx` similarly (the original requirement explicitly includes attribute editing)
  - Tab content: compact `ScriptListInline` component showing script name, codename, execution target, with "Edit" / "Create" / "Delete" actions
- [ ] Implement `ScriptEditor` page (full-page CodeMirror 6 editor, reusing existing `@uiw/react-codemirror` + `@codemirror/lang-javascript`)
- [ ] Add "Global Scripts" navigation item to metahub sidebar (for scripts not attached to a specific object)
- [ ] TanStack Query hooks for script CRUD
- [ ] Add module-role selector in script create/edit form (`Object Module`, `Manager Module`, `Widget Module`, `Global Module`)
- [ ] Add capability preview/read-only section in script editor showing the effective allowed capabilities for the selected module role

**UI pattern — hybrid approach (tab + editor page):**

The "Scripts" tab in `EntityFormDialog` shows a compact inline list of scripts attached to the current object. Each row has an "Edit" button that navigates to the full-page script editor. This matches the existing UI pattern where entity dialogs show relationship lists inline, while detail editing happens on a dedicated page.

```typescript
// In CatalogActions.tsx buildFormTabs():
tabs.push({
  id: 'scripts',
  label: t('scripts.title'), // "Scripts" / "Скрипты"
  content: (
    <ScriptListInline
      metahubId={metahubId}
      branchId={branchId}
      attachedToKind='catalog'
      attachedToId={catalogId}
      onEdit={(scriptId) => navigate(
        `/metahub/${metahubId}/catalog/${catalogId}/scripts/${scriptId}`
      )}
    />
  ),
})
```

**Frontend routes (editor pages only — list is inline in entity dialog tabs):**

```
/metahub/:metahubId/scripts                                      # global scripts list page
/metahub/:metahubId/scripts/:scriptId                             # global script editor
/metahub/:metahubId/catalog/:catalogId/scripts/:scriptId          # catalog script editor
/metahub/:metahubId/hub/:hubId/scripts/:scriptId                  # hub script editor
/metahub/:metahubId/set/:setId/scripts/:scriptId                  # set script editor
/metahub/:metahubId/enumeration/:enumerationId/scripts/:scriptId  # enum script editor
/metahub/:metahubId/catalog/:catalogId/attributes/:attributeId/scripts/:scriptId  # attribute script editor
```

**Code example — useScripts hook:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../api'

export const scriptKeys = {
  all: (metahubId: string) => ['metahub', metahubId, 'scripts'] as const,
  list: (metahubId: string, attachedToKind?: string, attachedToId?: string, moduleRole?: string) =>
    [...scriptKeys.all(metahubId), 'list', { attachedToKind, attachedToId, moduleRole }] as const,
  detail: (metahubId: string, scriptId: string) =>
    [...scriptKeys.all(metahubId), 'detail', scriptId] as const,
}

export function useScriptsList(
  metahubId: string,
  branchId: string,
  attachedToKind?: string,
  attachedToId?: string,
  moduleRole?: string
) {
  return useQuery({
    queryKey: scriptKeys.list(metahubId, attachedToKind, attachedToId, moduleRole),
    queryFn: () => apiClient.get(
      `/metahub/${metahubId}/branch/${branchId}/scripts`,
      { params: { attachedToKind, attachedToId, moduleRole } }
    ).then(r => r.data),
    staleTime: 30_000, // 30 seconds
  })
}

export function useCreateScript(metahubId: string, branchId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateScriptInput) =>
      apiClient.post(`/metahub/${metahubId}/branch/${branchId}/scripts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptKeys.all(metahubId) })
    }
  })
}
```

**CodeMirror 6 integration**: Reuse the existing `@uiw/react-codemirror` (^4.23.0) and `@codemirror/lang-javascript` (^6.2.4) packages already in the project catalog. Add a custom `CompletionSource` via `@codemirror/autocomplete` to provide `@universo/extension-sdk` type completions (class names, decorator names, lifecycle event names). Use VSCode theme (`@uiw/codemirror-theme-vscode`) already in the catalog for consistent look. **Do NOT add Monaco Editor** — the project standardizes on CodeMirror 6.

### Step 2.4: Unit/integration tests for Phase 2

- [ ] scriptsStore: CRUD operations with mock executor
- [ ] scriptsService: codename validation, compilation preview
- [ ] SnapshotSerializer: scripts section included in snapshot
- [ ] Frontend: script list rendering, script editor save/validate

---

## Phase 3: Runtime Integration (Sync + RPC)

### Step 3.1: Add `_app_scripts` to runtime schema

- [ ] Create platform migration definition for `_app_scripts` table
- [ ] Register in `@universo/universo-migrations-platform`
- [ ] Table stores compiled scripts, manifests, and execution config

**Table DDL:**

```sql
CREATE TABLE IF NOT EXISTS <schema>._app_scripts (
  id                  UUID PRIMARY KEY,
  attached_to_kind    VARCHAR(30),
  attached_to_id      UUID,
  module_role         VARCHAR(20) NOT NULL DEFAULT 'object',
  codename            TEXT NOT NULL,
  compiled_server_code TEXT NOT NULL,
  compiled_client_code TEXT NOT NULL,
  manifest            JSONB NOT NULL,
  source_hash         TEXT NOT NULL,
  source_kind         VARCHAR(20) NOT NULL DEFAULT 'embedded',
  execution_target    VARCHAR(20) NOT NULL DEFAULT 'server_and_client',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  _app_owner_id       UUID,
  _app_access_level   VARCHAR(20) DEFAULT 'public',
  _upl_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_version        INTEGER NOT NULL DEFAULT 1
);
```

### Step 3.2: Extend `syncEngine` with script persistence

- [ ] Add `persistPublishedScripts()` function to `runPublishedApplicationRuntimeSync()`
- [ ] Diff existing `_app_scripts` vs snapshot scripts by source hash
- [ ] Upsert changed/new scripts, remove deleted ones

**Code example:**

```typescript
async function persistPublishedScripts(
  executor: DbExecutor,
  runtimeSchema: string,
  snapshotScripts: MetahubScriptSnapshot[]
): Promise<void> {
  // Get existing scripts
  const existing = await executor.query<{ id: string; source_hash: string }>(
    `SELECT id, source_hash FROM "${runtimeSchema}"._app_scripts`
  )
  const existingMap = new Map(existing.rows.map(r => [r.id, r.source_hash]))

  const snapshotIds = new Set(snapshotScripts.map(s => s.id))

  // Delete removed scripts
  const toDelete = [...existingMap.keys()].filter(id => !snapshotIds.has(id))
  if (toDelete.length) {
    await executor.query(
      `DELETE FROM "${runtimeSchema}"._app_scripts WHERE id = ANY($1::uuid[])`,
      [toDelete]
    )
  }

  // Upsert changed/new scripts
  for (const script of snapshotScripts) {
    if (existingMap.get(script.id) === script.sourceHash) continue // unchanged

    await executor.query(
      `INSERT INTO "${runtimeSchema}"._app_scripts
       (id, attached_to_kind, attached_to_id, module_role, codename,
        compiled_server_code, compiled_client_code, manifest, source_hash, source_kind,
        execution_target, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
        attached_to_kind = EXCLUDED.attached_to_kind,
        attached_to_id = EXCLUDED.attached_to_id,
        module_role = EXCLUDED.module_role,
        codename = EXCLUDED.codename,
        compiled_server_code = EXCLUDED.compiled_server_code,
        compiled_client_code = EXCLUDED.compiled_client_code,
        manifest = EXCLUDED.manifest,
        source_hash = EXCLUDED.source_hash,
        source_kind = EXCLUDED.source_kind,
        execution_target = EXCLUDED.execution_target,
        sort_order = EXCLUDED.sort_order,
        _upl_updated_at = now(),
        _upl_version = "${runtimeSchema}"._app_scripts._upl_version + 1`,
      [script.id, script.attachedToKind, script.attachedToId, script.moduleRole, script.codename,
       script.compiledServerCode, script.compiledClientCode,
       JSON.stringify(script.manifest), script.sourceHash, script.sourceKind,
       script.executionTarget, script.sortOrder]
    )
  }
}
```

### Step 3.3: Script RPC routes in `@universo/applications-backend`

- [ ] Create `scriptRpcRoutes.ts` with POST `/:applicationId/script-rpc` endpoint
- [ ] Zod validation for RPC body (`scriptId`, `method` regex-validated, `args` array)
- [ ] Use request-scoped `DbExecutor` for RLS enforcement
- [ ] Mount `ScriptEngine` singleton with `IsolatePool`

**Code example:**

```typescript
const scriptRpcBodySchema = z.object({
  scriptId: z.string().uuid(),
  method: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  args: z.array(z.unknown()).max(10)
})

router.post('/:applicationId/script-rpc',
  asyncHandler(async (req, res) => {
    const { applicationId } = req.params
    const body = scriptRpcBodySchema.parse(req.body)

    // Request-scoped executor for RLS
    const executor = getRequestDbExecutor(req, getDbExecutor())

    const engine = getScriptEngine()
    const result = await engine.executeServerMethod({
      applicationId,
      scriptId: body.scriptId,
      methodName: body.method,
      args: body.args,
      userId: req.user?.id ?? null,
      executor, // pass RLS-scoped executor
    })

    if (result.error) {
      res.status(400).json({
        success: false,
        error: { code: 'SCRIPT_EXECUTION_ERROR', message: result.error }
      })
      return
    }
    res.json({ success: true, result: result.value })
  })
)
```

### Step 3.4: Client script bundle endpoint

- [ ] Add GET `/:applicationId/scripts/:scriptId/client` endpoint
- [ ] Returns compiled client JavaScript bundle for browser execution
- [ ] Proper caching headers (ETag from sourceHash)

### Step 3.5: Tests for Phase 3

- [ ] persistPublishedScripts: upsert, delete, no-change skip
- [ ] Script RPC: valid method call, invalid method name, timeout
- [ ] ScriptEngine integration: E2E with real isolated-vm (separate test suite)
- [ ] CRUD hooks: before/after lifecycle events fire correctly, before-hook rejection cancels operation
- [ ] Capability gating: widget scripts cannot obtain write APIs, undeclared capabilities are not injected
- [ ] Health monitor: failing scripts trip circuit breaker and recover after cooldown

### Step 3.6: CRUD lifecycle hook injection in `@universo/applications-backend`

The scripting system must intercept element create/update/delete operations to fire lifecycle events (`OnBeforeElementCreate`, `OnAfterElementCreate`, etc.). Currently the applications-backend has no hook/interceptor pattern in its CRUD pipeline — store functions execute raw SQL directly.

- [ ] Create `ScriptLifecycleInterceptor` class in `@universo/scripting-engine`
- [ ] Add wrapper layer around element store operations in `@universo/applications-backend`
- [ ] Wire `EventRouter` lifecycle dispatch into the wrapper layer

**Design: Interceptor wrapper pattern**

The interceptor wraps existing store methods (not middleware). This avoids modifying the existing store contract and provides zero-overhead when no scripts are registered.

```typescript
// packages/scripting-engine/base/src/router/ScriptLifecycleInterceptor.ts

export class ScriptLifecycleInterceptor {
  constructor(
    private readonly eventRouter: EventRouter,
    private readonly scriptLoader: ScriptLoader
  ) {}

  /**
   * Wraps a create/update/delete store operation with lifecycle hooks.
   * Before-hooks are awaitable and can reject the operation (throw).
   * After-hooks are fire-and-forget with error logging.
   * 
   * @param operationType - 'Create' | 'Update' | 'Delete'
   * @param applicationId - runtime application context
   * @param attachment - the metadata attachment context the element belongs to
   * @param executor - DB executor (same transaction for before-hooks)
   * @param operation - the actual store function to wrap
   */
  async wrapOperation<T>(
    operationType: 'Create' | 'Update' | 'Delete',
    applicationId: string,
    attachment: { kind: 'catalog' | 'set' | 'enumeration' | 'hub'; id: string },
    executor: DbExecutor,
    elementData: Record<string, unknown>,
    operation: () => Promise<T>
  ): Promise<T> {
    const scripts = await this.scriptLoader.getScriptsForAttachment(applicationId, attachment)
    const hasBeforeHandlers = scripts.some(s =>
      s.manifest.eventHandlers.some(h => h.event === `OnBeforeElement${operationType}`)
    )
    const hasAfterHandlers = scripts.some(s =>
      s.manifest.eventHandlers.some(h => h.event === `OnAfterElement${operationType}`)
    )

    // Fast path: no scripts registered for this object — zero overhead
    if (!hasBeforeHandlers && !hasAfterHandlers) {
      return operation()
    }

    // Before-hooks: awaitable, same transaction, can throw to reject
    if (hasBeforeHandlers) {
      await this.eventRouter.dispatch({
        event: `OnBeforeElement${operationType}`,
        applicationId,
        attachment,
        data: elementData,
        executor, // same transaction — if hook throws, operation is rolled back
      })
    }

    // Execute the actual CRUD operation
    const result = await operation()

    // After-hooks: fire-and-forget, errors are logged but don't fail the operation
    if (hasAfterHandlers) {
      this.eventRouter.dispatchAsync({
        event: `OnAfterElement${operationType}`,
        applicationId,
        attachment,
        data: { ...elementData, result },
        executor,
      }).catch(err => {
        scriptLogger.error(`After${operationType} hook failed`, { applicationId, attachment, err })
      })
    }

    return result
  }
}
```

**Integration point in applications-backend:**

```typescript
// In the element CRUD routes/controller (applications-backend):

// Before (current code):
const result = await elementsStore.createElement(executor, schema, elementData)

// After (with interceptor):
const interceptor = getScriptLifecycleInterceptor()
const result = await interceptor.wrapOperation(
  'Create', applicationId, { kind: 'catalog', id: catalogObjectId }, executor, elementData,
  () => elementsStore.createElement(executor, schema, elementData)
)
```

**Key semantics:**
- **Before-hooks** run inside the same DB transaction. If a before-hook throws, the enclosing transaction rolls back and the element operation fails with a user-facing error message.
- **After-hooks** run asynchronously after the operation completes. Errors are logged to `ScriptLogger` but do not affect the response.
- **Zero-cost guard**: `ScriptLoader` caches script manifests per application. If no scripts have relevant event handlers, the wrapper calls the operation directly with no isolate creation.
- **ScriptLoader** reads from `_app_scripts` (runtime table, already synced at publication time) and caches manifests in memory with TTL invalidation.
- **Deterministic handler ordering**: lifecycle handlers execute by `priority ASC`, then `sortOrder ASC`, then `scriptCodename ASC` so the same publication always produces the same execution order.
- **Circuit breaker**: repeated failures for the same script/hook trip the script into a temporary disabled state for that application until cooldown expires; this prevents hot failure loops from degrading the whole runtime.

---

## Phase 4: Quiz Widget

### Step 4.1: Register `quizWidget` in `widgetRenderer.tsx`

- [ ] Add `case 'quizWidget':` to `renderWidget()` switch
- [ ] Create `QuizWidget.tsx` component with MUI Card/Button/LinearProgress

> **Note**: `ScriptedWidgetHost` (generic host for dynamically-rendered script-driven UI trees via `WidgetRenderResult`) is **deferred to a future phase** beyond this plan. For v1, `QuizWidget` is a standard hardcoded React component that calls server RPC methods for data and scoring. This avoids the complexity of a generic serializable UI tree renderer while delivering the full Quiz use case. The `widget.ts` types in `@universo/extension-sdk` should still define the `WidgetExtension` interface for future use, but `WidgetRenderResult` and `ScriptedWidgetHost` are not implemented in this plan.

**Code example — QuizWidget.tsx (key rendering):**

```typescript
export default function QuizWidget({ config }: { config: Record<string, unknown> }) {
  const { t } = useTranslation('quiz')
  const [state, setState] = useState<QuizState>(initialState)
  const appId = config.applicationId as string
  const scriptId = config.scriptId as string

  const callServer = useCallback(async (method: string, ...args: unknown[]) => {
    const response = await fetch(`/api/v1/app/${appId}/script-rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId, method, args })
    })
    const data = await response.json()
    if (!data.success) throw new Error(data.error?.message)
    return data.result
  }, [appId, scriptId])

  // Load questions on mount
  useEffect(() => {
    callServer('getQuestions').then(questions => {
      setState(prev => ({ ...prev, questions: questions as QuizQuestion[], loading: false }))
    })
  }, [callServer])

  // ... quiz UI rendering with answers, progress, scoring ...
}
```

### Step 4.2: Quiz i18n namespace

- [ ] Register `quiz` namespace in `@universo/universo-i18n`

**Code example:**

```typescript
registerNamespace('quiz', {
  en: {
    quiz: {
      title: 'Space Quiz',
      loading: 'Loading questions...',
      questionOf: 'Question {{current}} of {{total}}',
      complete: 'Quiz Complete!',
      excellent: 'Excellent! You really know your space!',
      good: 'Good job! Keep exploring the cosmos!',
      tryAgain: 'Nice try! Study up and try again!',
      score: 'Your Score',
      restart: 'Try Again',
      correct: 'Correct!',
      incorrect: 'Not quite...',
    }
  },
  ru: {
    quiz: {
      title: 'Космическая викторина',
      loading: 'Загрузка вопросов...',
      questionOf: 'Вопрос {{current}} из {{total}}',
      complete: 'Викторина завершена!',
      excellent: 'Отлично! Вы настоящий знаток космоса!',
      good: 'Хорошая работа! Продолжайте изучать космос!',
      tryAgain: 'Неплохо! Подучитесь и попробуйте снова!',
      score: 'Ваш результат',
      restart: 'Попробовать снова',
      correct: 'Правильно!',
      incorrect: 'Не совсем...',
    }
  }
})
```

### Step 4.3: Quiz template data (10 space questions)

- [ ] Create a template/seed with 10 space-themed quiz questions
- [ ] Each question: text, 4 answers, correct answer, difficulty, explanation
- [ ] Questions in EN and RU

### Step 4.4: Tests for Phase 4

- [ ] QuizWidget: renders questions, handles answer selection, shows score
- [ ] Server-side scoring: correct_answer not exposed to client, score validation

---

## Phase 5: Hardening & Documentation

### Step 5.1: Security hardening

- [ ] Sandbox escape testing (attempt eval, Function, Proxy)
- [ ] SQL injection via script — verify parameterized queries enforced
- [ ] Memory exhaustion — verify isolate OOM kills the isolate, not the process
- [ ] CPU exhaustion — verify timeout terminates execution
- [ ] SSRF mitigation — verify private IP ranges blocked in HTTP bridge
- [ ] RLS verification — scripts cannot access data outside their user's permission scope
- [ ] Capability enforcement — verify undeclared or disallowed APIs are absent from the isolate runtime
- [ ] SDK version mismatch — verify incompatible `sdkApiVersion` fails closed at publication or execution boundary

### Step 5.2: Performance benchmarks

- [ ] Isolate creation time (target: < 10ms)
- [ ] Script execution cold start (target: < 50ms for simple scripts)
- [ ] Script execution warm start (target: < 5ms for simple scripts)
- [ ] RPC round-trip time (target: < 100ms including network)
- [ ] Memory overhead per isolate (target: < 5MB idle)
- [ ] Circuit-breaker recovery latency (target: cooldown expiry + first healthy execution re-enables script without manual intervention)

### Step 5.3: E2E tests

- [ ] Full lifecycle: create script → edit → publish → sync → execute via RPC
- [ ] Quiz widget E2E: load quiz → answer questions → see score
- [ ] Error scenarios: script compilation failure blocks publication
- [ ] Import/export with scripts in snapshot

### Step 5.4: Documentation

- [ ] `packages/extension-sdk/base/README.md` — SDK API reference, decorator usage, lifecycle events
- [ ] `packages/scripting-engine/base/README.md` — engine architecture, configuration, deployment
- [ ] Update `docs/en/guides/` and `docs/ru/guides/` with scripting user guide (GitBook)
- [ ] Update `docs/en/api-reference/` with script RPC endpoint docs
- [ ] Update `docs/en/architecture/` with scripting system architecture diagram

### Step 5.5: Node.js runtime configuration

- [ ] Add `--no-node-snapshot` flag to server start scripts (required by isolated-vm on Node.js >= 20)
- [ ] Document in deployment guide
- [ ] Add validation check at startup if isolated-vm fails to load

---

## Potential Challenges

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| `isolated-vm` in maintenance mode | Medium | Library is stable (v6.1.2, 669K+ weekly downloads, used by Screeps/Fly.io/Algolia/Tripadvisor); V8 security updates come from Node.js itself; QuickJS-emscripten as fallback |
| AST transformation complexity | High | Start with simple `__decorate()` call pattern recognition via acorn in esbuild output; avoid full Babel transform |
| Attachment surface growth (`catalog` / `attribute` / `manager` / `global`) | Medium | Model attachment generically now (`attached_to_kind`, `attached_to_id`, `module_role`) instead of hardcoding `object_id` |
| Future external / visual sources | Medium | Keep `source_kind` + `source_descriptor` in schema and manifest now; v1 UI only enables `embedded` |
| Overprivileged script surface | Medium | Use manifest-declared capabilities with deny-by-default host API injection and role-based validation |
| CRUD lifecycle hook injection | Medium | Wrapper pattern around existing store methods — zero-cost when no scripts registered (manifest cache check). Before-hooks share the DB transaction for atomicity. After-hooks are fire-and-forget |
| Hot failure loops from broken scripts | Medium | ScriptHealthMonitor trips a circuit breaker after repeated failures and auto-recovers after cooldown |
| Snapshot size growth | Low | Compiled bundles are typically < 50KB per script; compress if needed |
| RPC latency perception | Low | Use TanStack Query cache; prefetch common data on mount |
| Branch schema migration | Medium | `_mhb_scripts` must be added to existing branch schemas; handle migration for pre-existing branches |
| Backward compatibility | Medium | `scripts` field is optional in snapshot; old snapshots work without scripts |
| `--no-node-snapshot` requirement | Low | Single configuration change; document clearly in README and Docker setup |
| Frontend decorator limitation | Low | Frontend tsconfig lacks `experimentalDecorators`; SDK is backend-only peerDep; script authors use embedded editor, not project tsc |
| Public scripting API drift | Medium | Version `ScriptManifest.sdkApiVersion` and reject execution when runtime host cannot satisfy the script's declared SDK contract |

---

## Dependencies Graph

```
@universo/extension-sdk (source-only, no deps)
         │
         ▼
@universo/scripting-engine
├── isolated-vm
├── esbuild
├── acorn
├── @universo/extension-sdk (peerDep)
└── @universo/types (peerDep)
         │
    ┌────┴────────┐
    ▼             ▼
metahubs-     applications-
backend       backend
(compile      (runtime
 at publish)   exec + RPC)
    │             │
    ▼             ▼
metahubs-     apps-template-
frontend      mui
(editor UI)   (quiz widget)
```

---

## Validation Criteria

Before considering implementation complete:

1. `pnpm build` passes with 0 errors (all packages including new ones)
2. All Vitest unit/integration tests pass
3. E2E: script creation → publication → sync → RPC execution → quiz widget renders
4. Security: sandbox escape attempts fail closed
5. Performance: cold start < 50ms, warm execution < 5ms
6. i18n: all user-facing text has EN + RU translations
7. Documentation: README files, GitBook pages, API reference updated
8. Backward compatibility: snapshots without scripts import without errors

---

## Implementation Checklist (Summary)

### Phase 1 — SDK + Engine Foundation
- [x] Step 1.1: Create `@universo/extension-sdk` package
- [x] Step 1.2: Create `@universo/scripting-engine` package
- [x] Step 1.3: Add shared types to `@universo/types`
- [x] Step 1.4: Add `_mhb_scripts` table to `@universo/schema-ddl`
- [x] Step 1.5: Unit tests for Phase 1
- [x] Step 1.6: i18n namespaces for scripting

### Phase 2 — Metahub Integration
- [x] Step 2.1: Scripts domain in `@universo/metahubs-backend`
- [x] Step 2.2: Extend `SnapshotSerializer`
- [x] Step 2.3: Script editor UI in `@universo/metahubs-frontend`
- [x] Step 2.4: Tests for Phase 2

### Phase 3 — Runtime Integration
- [x] Step 3.1: Add `_app_scripts` to runtime schema
- [x] Step 3.2: Extend `syncEngine` with script persistence
- [x] Step 3.3: Script RPC routes in `@universo/applications-backend`
- [x] Step 3.4: Client script bundle endpoint
- [x] Step 3.5: Tests for Phase 3

### Phase 4 — Quiz Widget
- [x] Step 4.1: Register `quizWidget` in `widgetRenderer.tsx`
- [x] Step 4.2: Quiz i18n namespace
- [x] Step 4.3: Quiz template data (10 space questions)
- [x] Step 4.4: Tests for Phase 4

### Phase 5 — Hardening & Documentation
- [x] Step 5.1: Security hardening
- [x] Step 5.2: Performance benchmarks
- [x] Step 5.3: E2E tests
- [x] Step 5.4: Documentation (README, GitBook, API reference)
- [x] Step 5.5: Node.js runtime configuration
