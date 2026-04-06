# Creative Design: Metahub Scripting/Extension System (GDExtension-analog)

> **Created**: 2026-04-05
> **Status**: Design complete, ready for PLAN
> **Complexity**: Level 4+ (Major/Complex, cross-cutting)
> **Scope**: New packages `@universo/extension-sdk`, `@universo/scripting-engine`; touched packages: `metahubs-backend`, `metahubs-frontend`, `applications-backend`, `apps-template-mui`, `universo-types`, `schema-ddl`, `universo-i18n`
> **Analogies**: GDExtension (Godot Engine), 1С:Предприятие 8.x module objects

> **QA note (2026-04-05):** This creative document remains the alternative-analysis archive. The implementation source of truth is the corrected plan in `memory-bank/plan/metahub-scripting-extension-system-plan-2026-04-05.md`. Where they differ, the plan wins. Key superseded decisions include: Monaco Editor → CodeMirror 6, public raw SQL API → domain-safe RecordAPI/MetadataAPI, and object-only attachment → generic `attached_to_kind` / `attached_to_id` model with explicit `module_role` and `source_kind` seams.

---

## Table of Contents

- [A. SDK Package Design](#a-sdk-package-design-universoextension-sdk)
- [B. Scripting Engine](#b-scripting-engine-universoscripting-engine)
- [C. Data Model](#c-data-model)
- [D. Server/Client Code Splitting](#d-serverclient-code-splitting)
- [E. Quiz Widget Architecture](#e-quiz-widget-architecture)
- [F. Security Model](#f-security-model)

---

## A. SDK Package Design (`@universo/extension-sdk`)

### Design Topic: What TypeScript interfaces/types does the SDK expose to script authors?

#### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Decorator-based (like NestJS) | `@AtServer`, `@AtClient`, `@OnEvent('ElementCreated')` decorators on class methods | **Selected** — ergonomic, familiar to TS devs, enables AST-based server/client splitting |
| B. Register-based (like Godot GDScript) | `func _ready():`, `func _process():` convention naming | Rejected — too implicit, no type safety for event names |
| C. Object-literal (like Vue Options API) | `export default { server: { ... }, client: { ... } }` | Rejected — less discoverable, harder to type-check cross-references |

#### Decision: Decorator-based SDK with typed lifecycle events

**Rationale:**
- Decorators are compile-time markers — perfect for AST transformation to split server/client code
- TypeScript 5.x stage 3 decorators are stable; we can also support legacy decorators via esbuild
- Mirrors 1С's `&НаСервере` / `&НаКлиенте` directive model conceptually
- Full type safety for lifecycle events via discriminated union

#### SDK Type Definitions

```typescript
// packages/extension-sdk/base/src/types.ts

// ═══════════════════════════════════════
// Execution Context
// ═══════════════════════════════════════

/** Where a function runs */
export type ExecutionTarget = 'server' | 'client'

/** Lifecycle event names available in the platform */
export type LifecycleEvent =
  // Element CRUD lifecycle (server-side)
  | 'OnBeforeElementCreate'
  | 'OnAfterElementCreate'
  | 'OnBeforeElementUpdate'
  | 'OnAfterElementUpdate'
  | 'OnBeforeElementDelete'
  | 'OnAfterElementDelete'
  // Publication lifecycle (server-side)
  | 'OnAfterPublish'
  | 'OnAfterSync'
  // UI lifecycle (client-side)
  | 'OnBeforeDisplay'
  | 'OnAfterDisplay'
  | 'OnFormOpen'
  | 'OnFormClose'
  | 'OnFieldChange'
  // Widget lifecycle (client-side)
  | 'OnWidgetMount'
  | 'OnWidgetUnmount'
  | 'OnWidgetAction'
  // Scheduled (server-side)
  | 'OnSchedule'

/** Event payload varies by lifecycle event */
export interface ElementEventContext {
  entityId: string
  entityCodename: string
  catalogId: string
  elementId: string
  elementData: Record<string, unknown>
  userId: string | null
  schemaName: string
}

export interface FieldChangeEventContext {
  fieldCodename: string
  oldValue: unknown
  newValue: unknown
  formData: Record<string, unknown>
}

export interface WidgetEventContext {
  widgetId: string
  widgetKey: string
  config: Record<string, unknown>
  action?: string
  payload?: unknown
}

export interface PublicationEventContext {
  metahubId: string
  publicationId: string
  versionNumber: number
  applicationId?: string
}

export type EventContext =
  | { event: 'OnBeforeElementCreate' | 'OnAfterElementCreate' | 'OnBeforeElementUpdate' | 'OnAfterElementUpdate' | 'OnBeforeElementDelete' | 'OnAfterElementDelete'; data: ElementEventContext }
  | { event: 'OnBeforeDisplay' | 'OnAfterDisplay' | 'OnFormOpen' | 'OnFormClose'; data: ElementEventContext }
  | { event: 'OnFieldChange'; data: FieldChangeEventContext }
  | { event: 'OnWidgetMount' | 'OnWidgetUnmount' | 'OnWidgetAction'; data: WidgetEventContext }
  | { event: 'OnAfterPublish' | 'OnAfterSync'; data: PublicationEventContext }
  | { event: 'OnSchedule'; data: { triggeredAt: string } }

// ═══════════════════════════════════════
// Decorators
// ═══════════════════════════════════════

/**
 * Marks a method to execute ONLY on the server.
 * At build time, AST transformation strips @AtServer methods from the client bundle.
 * Calling an @AtServer method from client code generates an automatic RPC call.
 */
export declare function AtServer(target: any, propertyKey: string, descriptor: PropertyDescriptor): void

/**
 * Marks a method to execute ONLY on the client (browser).
 * At build time, AST transformation strips @AtClient methods from the server bundle.
 */
export declare function AtClient(target: any, propertyKey: string, descriptor: PropertyDescriptor): void

/**
 * Marks a method as a lifecycle event handler.
 * @param event - The lifecycle event to listen to
 */
export declare function OnEvent(event: LifecycleEvent): MethodDecorator

/**
 * Marks a method/class as usable on both server and client.
 * This is the default when no @AtServer/@AtClient decorator is present.
 */
export declare function AtServerAndClient(target: any, propertyKey: string, descriptor: PropertyDescriptor): void

// ═══════════════════════════════════════
// Built-in APIs (Sandbox Globals)
// ═══════════════════════════════════════

/** Database access API — available ONLY in @AtServer methods */
export interface DatabaseAPI {
  /** Execute a parameterized SQL query against the application runtime schema */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** Fetch a single row by ID from an entity table */
  findById(entityCodename: string, id: string): Promise<Record<string, unknown> | null>
  /** Fetch rows with basic filtering */
  findMany(entityCodename: string, filter?: QueryFilter): Promise<Record<string, unknown>[]>
  /** Insert a row */
  insertRow(entityCodename: string, data: Record<string, unknown>): Promise<{ id: string }>
  /** Update a row */
  updateRow(entityCodename: string, id: string, data: Record<string, unknown>): Promise<void>
  /** Delete a row */
  deleteRow(entityCodename: string, id: string): Promise<void>
}

export interface QueryFilter {
  where?: Record<string, unknown>
  orderBy?: { field: string; direction: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
}

/** HTTP client API — available in @AtServer methods */
export interface HttpAPI {
  fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse>
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  timeout?: number // ms, max 30000
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  json(): Promise<unknown>
  text(): Promise<string>
}

/** Logging API — available everywhere */
export interface LogAPI {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
}

/** State API — available in @AtClient methods */
export interface StateAPI {
  /** Get a reactive state value */
  get<T = unknown>(key: string): T | undefined
  /** Set a reactive state value (triggers re-renders in bound widgets) */
  set(key: string, value: unknown): void
  /** Subscribe to state changes */
  onChange(key: string, callback: (newValue: unknown, oldValue: unknown) => void): () => void
}

/** i18n API — available everywhere */
export interface I18nAPI {
  t(key: string, params?: Record<string, unknown>): string
  locale: string
}

/** Script context object — the `this` context or first argument */
export interface ScriptContext {
  /** Database access (server-only) */
  db: DatabaseAPI
  /** HTTP client (server-only) */
  http: HttpAPI
  /** Logging */
  log: LogAPI
  /** Reactive state (client-only) */
  state: StateAPI
  /** Internationalization */
  i18n: I18nAPI
  /** Current user info */
  user: { id: string; email?: string; displayName?: string } | null
  /** Current application context */
  app: { id: string; schemaName: string }
  /** Current metahub context */
  metahub: { id: string }
  /** RPC: call a server method from client */
  callServer<T = unknown>(methodName: string, ...args: unknown[]): Promise<T>
}

// ═══════════════════════════════════════
// Script Module Shape
// ═══════════════════════════════════════

/**
 * Base class that all extension scripts inherit from.
 * Provides typed access to platform APIs via `this.ctx`.
 *
 * Example usage:
 * ```typescript
 * import { ExtensionScript, AtServer, AtClient, OnEvent } from '@universo/extension-sdk'
 *
 * export default class ProductScript extends ExtensionScript {
 *   @OnEvent('OnBeforeElementCreate')
 *   @AtServer
 *   async validateProduct(event: ElementEventContext) {
 *     const existing = await this.ctx.db.findMany('products', {
 *       where: { sku: event.elementData.sku }
 *     })
 *     if (existing.length > 0) {
 *       throw new Error('Duplicate SKU')
 *     }
 *   }
 *
 *   @OnEvent('OnFormOpen')
 *   @AtClient
 *   async initForm(event: ElementEventContext) {
 *     const categories = await this.ctx.callServer('getCategories')
 *     this.ctx.state.set('categories', categories)
 *   }
 *
 *   @AtServer
 *   async getCategories(): Promise<string[]> {
 *     const rows = await this.ctx.db.findMany('categories')
 *     return rows.map(r => r.name as string)
 *   }
 * }
 * ```
 */
export abstract class ExtensionScript {
  protected ctx: ScriptContext = null as unknown as ScriptContext // injected at runtime
}

// ═══════════════════════════════════════
// Widget Extension Interface
// ═══════════════════════════════════════

/**
 * Interface for custom widget extensions.
 * Widgets are rendered in the dashboard and can have server-side logic.
 */
export interface WidgetExtension {
  /** Unique widget key for registration */
  widgetKey: string
  /** Display name (i18n key) */
  nameKey: string
  /** Allowed dashboard zones */
  allowedZones: ('left' | 'right' | 'center')[]
  /** Default widget config */
  defaultConfig: Record<string, unknown>
  /** Client-side render function — returns a serializable UI tree */
  render(ctx: ScriptContext, config: Record<string, unknown>): WidgetRenderResult
}

/** Simplified UI tree that the sandbox can produce */
export interface WidgetRenderResult {
  type: 'container' | 'text' | 'button' | 'input' | 'list' | 'progress' | 'image' | 'card' | 'grid'
  props?: Record<string, unknown>
  children?: (WidgetRenderResult | string)[]
  /** Event handler name (resolved to a method on the WidgetExtension) */
  onClick?: string
  onChange?: string
}
```

#### Trade-offs

| Aspect | Pro | Con |
|--------|-----|------|
| Decorator approach | Great DX, compile-time checkable, mirrors 1С pattern | Requires esbuild plugin for AST transform; decorators can be confusing to beginners |
| `ExtensionScript` base class | Provides `this.ctx` typing, familiar OOP model | Class inheritance vs. composition — less flexible than pure functions |
| `WidgetRenderResult` UI tree | Secure (no raw HTML/JSX from sandbox), serializable | Limited expressiveness; complex widgets need many nested nodes |

---

## B. Scripting Engine (`@universo/scripting-engine`)

### Design Topic 1: Sandbox Configuration (isolated-vm)

#### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Single isolate per application | One V8 isolate shared by all scripts in an application | Rejected — one script crash kills all; no per-script memory accounting |
| B. Isolate per script | Each script module gets its own isolate | **Selected** — fault isolation, per-script memory limits, clean lifecycle |
| C. Isolate per request | Fresh isolate for each event dispatch | Rejected — too expensive; isolate creation is ~5ms |

#### Decision: Pool of pre-warmed isolates, one per script module

```typescript
// packages/scripting-engine/base/src/sandbox/IsolatePool.ts

import ivm from 'isolated-vm'

export interface IsolateConfig {
  /** Maximum heap memory per isolate in MB. Default: 32 */
  memoryLimitMB: number
  /** Maximum CPU time per script execution in ms. Default: 1000 */
  cpuTimeoutMs: number
  /** Maximum wall-clock time per execution in ms. Default: 5000 */
  wallTimeoutMs: number
  /** Maximum number of concurrent isolates. Default: 50 */
  maxIsolates: number
  /** Pre-warm N isolates at startup. Default: 5 */
  preWarmCount: number
}

export const DEFAULT_ISOLATE_CONFIG: IsolateConfig = {
  memoryLimitMB: 32,
  cpuTimeoutMs: 1000,
  wallTimeoutMs: 5000,
  maxIsolates: 50,
  preWarmCount: 5,
}

export interface ScriptIsolate {
  isolate: ivm.Isolate
  context: ivm.Context
  scriptId: string
  compiledModule: ivm.Module
  createdAt: number
  lastUsedAt: number
  executionCount: number
}

/**
 * Manages a pool of V8 isolates for script execution.
 * Each application gets its own pool instance.
 */
export class IsolatePool {
  private pool = new Map<string, ScriptIsolate>()
  private config: IsolateConfig

  constructor(config?: Partial<IsolateConfig>) {
    this.config = { ...DEFAULT_ISOLATE_CONFIG, ...config }
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
      onCatastrophicError: (err) => {
        console.error(`[ScriptEngine] Isolate catastrophic error for script ${scriptId}:`, err)
      }
    })

    const context = await isolate.createContext()
    await this.injectGlobalAPIs(context, scriptId)

    const module = await isolate.compileModule(compiledCode, {
      filename: `script://${scriptId}.js`
    })

    const entry: ScriptIsolate = {
      isolate,
      context,
      scriptId,
      compiledModule: module,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      executionCount: 0
    }

    this.pool.set(scriptId, entry)
    return entry
  }

  private async injectGlobalAPIs(context: ivm.Context, scriptId: string): Promise<void> {
    const jail = context.global

    // Inject safe globals
    await jail.set('console', await this.createConsoleBridge(scriptId))
    await jail.set('setTimeout', undefined) // blocked
    await jail.set('setInterval', undefined) // blocked
    await jail.set('fetch', undefined) // blocked — use ctx.http instead
    await jail.set('eval', undefined) // blocked
    await jail.set('Function', undefined) // blocked

    // Inject platform API bridge (transferable references)
    await jail.set('__platformCallServer', new ivm.Reference(
      async (method: string, args: string) => {
        // Resolved by EventRouter at dispatch time
        return JSON.stringify({ error: 'Not bound' })
      }
    ))
  }

  private async createConsoleBridge(scriptId: string): Promise<Record<string, unknown>> {
    // Returns a frozen console-like object that forwards to host logger
    return Object.freeze({
      log: new ivm.Reference((...args: string[]) => {
        console.log(`[Script:${scriptId}]`, ...args)
      }),
      warn: new ivm.Reference((...args: string[]) => {
        console.warn(`[Script:${scriptId}]`, ...args)
      }),
      error: new ivm.Reference((...args: string[]) => {
        console.error(`[Script:${scriptId}]`, ...args)
      })
    })
  }

  private evictLRU(): void {
    let oldest: ScriptIsolate | null = null
    for (const entry of this.pool.values()) {
      if (!oldest || entry.lastUsedAt < oldest.lastUsedAt) {
        oldest = entry
      }
    }
    if (oldest) {
      oldest.isolate.dispose()
      this.pool.delete(oldest.scriptId)
    }
  }

  async dispose(): Promise<void> {
    for (const entry of this.pool.values()) {
      if (!entry.isolate.isDisposed) {
        entry.isolate.dispose()
      }
    }
    this.pool.clear()
  }
}
```

### Design Topic 2: Event Router

#### Decision: Registry-based event dispatch with priority ordering

```typescript
// packages/scripting-engine/base/src/router/EventRouter.ts

import type { LifecycleEvent, EventContext, ScriptContext } from '@universo/extension-sdk'
import type { IsolatePool } from '../sandbox/IsolatePool'
import type { CompiledScript } from '../compiler/types'

interface ScriptEventBinding {
  scriptId: string
  methodName: string
  priority: number
  target: 'server' | 'client'
}

/**
 * Routes lifecycle events to registered script handlers.
 *
 * Flow:
 * 1. At sync time, the router reads compiled script manifests
 *    and builds an event→handlers index.
 * 2. At runtime, when the platform emits a lifecycle event,
 *    the router looks up handlers, acquires isolates, and dispatches.
 */
export class EventRouter {
  /** event → ordered list of handlers */
  private bindings = new Map<LifecycleEvent, ScriptEventBinding[]>()

  constructor(
    private pool: IsolatePool,
    private scripts: Map<string, CompiledScript>
  ) {}

  /** Rebuild the event→handler index from compiled script manifests */
  rebuildIndex(): void {
    this.bindings.clear()
    for (const [scriptId, script] of this.scripts) {
      for (const handler of script.manifest.eventHandlers) {
        const list = this.bindings.get(handler.event) ?? []
        list.push({
          scriptId,
          methodName: handler.methodName,
          priority: handler.priority ?? 100,
          target: handler.target
        })
        this.bindings.set(handler.event, list)
      }
    }
    // Sort each list by priority (lower = earlier)
    for (const list of this.bindings.values()) {
      list.sort((a, b) => a.priority - b.priority)
    }
  }

  /** Dispatch a server-side lifecycle event */
  async dispatchServer(
    event: LifecycleEvent,
    context: Record<string, unknown>,
    scriptContext: Omit<ScriptContext, 'state' | 'callServer'>
  ): Promise<{ results: unknown[]; errors: ScriptError[] }> {
    const handlers = this.bindings.get(event)?.filter(h => h.target === 'server') ?? []
    const results: unknown[] = []
    const errors: ScriptError[] = []

    for (const handler of handlers) {
      try {
        const script = this.scripts.get(handler.scriptId)
        if (!script) continue

        const isolateEntry = await this.pool.acquire(
          handler.scriptId,
          script.compiledServerCode
        )

        const result = await isolateEntry.context.eval(
          `__dispatch("${handler.methodName}", ${JSON.stringify(context)})`,
          { timeout: script.manifest.cpuTimeoutMs ?? 1000 }
        )

        results.push(result)
        isolateEntry.executionCount++
      } catch (err) {
        errors.push({
          scriptId: handler.scriptId,
          methodName: handler.methodName,
          event,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString()
        })
      }
    }

    return { results, errors }
  }

  /** Build a client-side event dispatch payload for the frontend */
  getClientBindingsForEvent(event: LifecycleEvent): ClientEventBinding[] {
    const handlers = this.bindings.get(event)?.filter(h => h.target === 'client') ?? []
    return handlers.map(h => ({
      scriptId: h.scriptId,
      methodName: h.methodName,
      priority: h.priority
    }))
  }
}

export interface ScriptError {
  scriptId: string
  methodName: string
  event: LifecycleEvent
  error: string
  timestamp: string
}

export interface ClientEventBinding {
  scriptId: string
  methodName: string
  priority: number
}
```

### Design Topic 3: Script Compilation Pipeline

#### Decision: esbuild-based transpilation at publication time

```
┌─────────────────────────────────────────────────────────────────┐
│                    Publication Pipeline                          │
│                                                                 │
│  1. Read _mhb_scripts rows from branch schema                  │
│  2. For each script:                                            │
│     a. Parse TypeScript source via esbuild (strip types)        │
│     b. Extract decorator metadata via AST walker                │
│     c. Split into server bundle + client bundle                 │
│     d. Generate manifest.json with event bindings               │
│  3. Bundle all server scripts → one server.bundle.js            │
│  4. Bundle all client scripts → one client.bundle.js            │
│  5. Store bundles + manifests in snapshot.scripts                │
│  6. At sync time, persist to _app_scripts in runtime schema     │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// packages/scripting-engine/base/src/compiler/types.ts

export interface ScriptManifest {
  scriptId: string
  scriptCodename: string
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
  event: LifecycleEvent
  target: 'server' | 'client'
  priority?: number
}

export interface CompiledScript {
  manifest: ScriptManifest
  compiledServerCode: string
  compiledClientCode: string
  sourceMap?: string
}

export interface CompilationResult {
  scripts: CompiledScript[]
  errors: CompilationError[]
  warnings: string[]
}

export interface CompilationError {
  scriptId: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}
```

```typescript
// packages/scripting-engine/base/src/compiler/ScriptCompiler.ts

import * as esbuild from 'esbuild'
import type { CompilationResult, CompiledScript, ScriptManifest, EventHandlerManifest } from './types'

interface ScriptSource {
  id: string
  codename: string
  sourceCode: string
  language: 'typescript' | 'javascript'
  attachedTo?: { entityId: string; entityKind: string } | null
}

/**
 * Compiles TypeScript extension scripts into isolated server + client bundles.
 *
 * Pipeline:
 * 1. TypeScript → JavaScript (via esbuild, strip types only)
 * 2. AST scan for @AtServer/@AtClient/@OnEvent decorators → manifest
 * 3. Tree-shake: server bundle excludes @AtClient methods,
 *    client bundle excludes @AtServer methods and replaces them with RPC stubs
 * 4. Wrap in isolate-compatible module format
 */
export class ScriptCompiler {
  async compile(sources: ScriptSource[]): Promise<CompilationResult> {
    const scripts: CompiledScript[] = []
    const errors: CompilationError[] = []
    const warnings: string[] = []

    for (const source of sources) {
      try {
        const result = await this.compileSingle(source)
        scripts.push(result)
      } catch (err) {
        errors.push({
          scriptId: source.id,
          line: 0,
          column: 0,
          message: err instanceof Error ? err.message : String(err),
          severity: 'error'
        })
      }
    }

    return { scripts, errors, warnings }
  }

  private async compileSingle(source: ScriptSource): Promise<CompiledScript> {
    // Step 1: TypeScript → JavaScript
    const transpiled = await esbuild.transform(source.sourceCode, {
      loader: source.language === 'typescript' ? 'ts' : 'js',
      target: 'es2022',
      format: 'esm',
      sourcemap: 'inline'
    })

    // Step 2: Extract decorator metadata
    const manifest = this.extractManifest(source, transpiled.code)

    // Step 3: Generate server and client bundles
    const serverCode = this.buildServerBundle(transpiled.code, manifest)
    const clientCode = this.buildClientBundle(transpiled.code, manifest)

    return {
      manifest,
      compiledServerCode: serverCode,
      compiledClientCode: clientCode,
      sourceMap: transpiled.map
    }
  }

  private extractManifest(source: ScriptSource, jsCode: string): ScriptManifest {
    // Parse the transpiled JS to find decorator markers
    // esbuild preserves decorator calls as __decorate([...]) or direct calls
    // We use a simplified regex/AST scan for OnEvent, AtServer, AtClient
    const eventHandlers: EventHandlerManifest[] = []
    const serverMethods: string[] = []
    const clientMethods: string[] = []

    // (Implementation: walk the JS AST via acorn or a lightweight parser)
    // For the design, the contract is:
    // - @OnEvent('X') on a method → adds to eventHandlers[]
    // - @AtServer on a method → adds to serverMethods[]
    // - @AtClient on a method → adds to clientMethods[]
    // - No decorator → method appears in BOTH bundles

    return {
      scriptId: source.id,
      scriptCodename: source.codename,
      sourceHash: '', // computed from source
      compiledAt: new Date().toISOString(),
      eventHandlers,
      serverMethods,
      clientMethods
    }
  }

  private buildServerBundle(jsCode: string, manifest: ScriptManifest): string {
    // Remove @AtClient-only methods
    // Wrap in isolate module format:
    // (function(__dispatch, __ctx) { ... class ... __dispatch = ... })
    return `
(function(exports, __ctx) {
  "use strict";
  ${jsCode}
  // Event dispatch table
  const __handlers = {};
  ${manifest.eventHandlers.filter(h => h.target === 'server').map(h =>
    `__handlers["${h.methodName}"] = async (data) => { const inst = new exports.default(); inst.ctx = __ctx; return inst.${h.methodName}(data); };`
  ).join('\n  ')}
  exports.__dispatch = async function(method, data) { return __handlers[method]?.(JSON.parse(data)); };
  ${manifest.serverMethods.map(m =>
    `exports.${m} = async function(...args) { const inst = new exports.default(); inst.ctx = __ctx; return inst.${m}(...args); };`
  ).join('\n  ')}
})(this, __platformContext);
`
  }

  private buildClientBundle(jsCode: string, manifest: ScriptManifest): string {
    // Remove @AtServer-only methods, replace with RPC stubs
    // The RPC stub calls ctx.callServer(methodName, ...args)
    return `
(function(exports, __ctx) {
  "use strict";
  ${jsCode}
  // Replace server methods with RPC stubs
  ${manifest.serverMethods.map(m =>
    `exports.${m} = async function(...args) { return __ctx.callServer("${m}", ...args); };`
  ).join('\n  ')}
  // Client event dispatch table
  const __handlers = {};
  ${manifest.eventHandlers.filter(h => h.target === 'client').map(h =>
    `__handlers["${h.methodName}"] = async (data) => { const inst = new exports.default(); inst.ctx = __ctx; return inst.${h.methodName}(data); };`
  ).join('\n  ')}
  exports.__dispatch = async function(method, data) { return __handlers[method]?.(data); };
})(window.__universoScripts["${manifest.scriptId}"] = {}, __platformContext);
`
  }
}
```

### Design Topic 4: Server–Client RPC

#### Decision: HTTP POST-based RPC through existing Express routes

```
┌──────────────┐     POST /api/v1/app/:appId/script-rpc     ┌──────────────┐
│              │  ──────────────────────────────────────────> │              │
│   Browser    │   { scriptId, method, args: [...] }         │  Express     │
│  (Client     │                                             │  Server      │
│   Bundle)    │  <────────────────────────────────────────── │  (Script     │
│              │   { result: ..., error?: ... }               │   Engine)    │
└──────────────┘                                             └──────────────┘
```

```typescript
// packages/applications-backend/base/src/routes/scriptRpcRoutes.ts

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '@universo/metahubs-backend'

const scriptRpcBodySchema = z.object({
  scriptId: z.string().uuid(),
  method: z.string().min(1).max(100).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  args: z.array(z.unknown()).max(10)
})

export function createScriptRpcRoutes(getScriptEngine: () => ScriptEngine): Router {
  const router = Router()

  router.post('/:applicationId/script-rpc',
    asyncHandler(async (req, res) => {
      const { applicationId } = req.params
      const body = scriptRpcBodySchema.parse(req.body)

      const engine = getScriptEngine()
      const result = await engine.executeServerMethod({
        applicationId,
        scriptId: body.scriptId,
        methodName: body.method,
        args: body.args,
        userId: req.user?.id ?? null
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

  return router
}
```

### Design Topic 5: Error Handling & Logging

#### Decision: Structured error capture with per-script log buffer

```typescript
// packages/scripting-engine/base/src/logging/ScriptLogger.ts

export interface ScriptLogEntry {
  scriptId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: string
  executionId: string
  event?: string
  method?: string
}

/**
 * Captures script log output in a ring buffer per application.
 * Logs are queryable via admin API for debugging.
 */
export class ScriptLogBuffer {
  private buffer: ScriptLogEntry[] = []
  private readonly maxEntries: number

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries
  }

  push(entry: ScriptLogEntry): void {
    this.buffer.push(entry)
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift()
    }
  }

  query(filter?: { scriptId?: string; level?: string; since?: string }): ScriptLogEntry[] {
    let result = this.buffer
    if (filter?.scriptId) result = result.filter(e => e.scriptId === filter.scriptId)
    if (filter?.level) result = result.filter(e => e.level === filter.level)
    if (filter?.since) result = result.filter(e => e.timestamp >= filter.since)
    return result
  }

  clear(): void {
    this.buffer = []
  }
}
```

---

## C. Data Model

### Design Topic 1: Branch Schema `_mhb_scripts` Table

#### Decision: Script as first-class metahub object in branch schemas

```sql
-- New branch schema table: _mhb_scripts
-- Lives alongside _mhb_objects, _mhb_attributes, _mhb_elements, etc.

CREATE TABLE IF NOT EXISTS <schema>._mhb_scripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- References the metahub object this script is attached to (nullable = global script)
  object_id       UUID REFERENCES <schema>._mhb_objects(id) ON DELETE CASCADE,
  -- Script identification
  codename        JSONB NOT NULL,  -- VLC codename (matches platform codename pattern)
  name            JSONB,           -- VLC localized display name
  description     JSONB,           -- VLC localized description
  -- Script content
  source_code     TEXT NOT NULL DEFAULT '',
  language        VARCHAR(20) NOT NULL DEFAULT 'typescript',
  -- Execution config
  execution_target VARCHAR(20) NOT NULL DEFAULT 'server_and_client',
    -- CHECK (execution_target IN ('server', 'client', 'server_and_client'))
  -- Ordering
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Platform lifecycle fields
  _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_created_by UUID,
  _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_updated_by UUID,
  _upl_version    INTEGER NOT NULL DEFAULT 1,
  _upl_deleted    BOOLEAN NOT NULL DEFAULT false,
  _upl_deleted_at TIMESTAMPTZ,
  _upl_deleted_by UUID,
  -- Branch lifecycle fields
  _mhb_deleted    BOOLEAN NOT NULL DEFAULT false,
  _mhb_deleted_at TIMESTAMPTZ,
  _mhb_deleted_by UUID
);

-- Active scripts predicate (matches platform convention)
CREATE INDEX idx_mhb_scripts_active
  ON <schema>._mhb_scripts (object_id)
  WHERE _upl_deleted = false AND _mhb_deleted = false;

-- Unique codename per object scope
CREATE UNIQUE INDEX idx_mhb_scripts_codename_unique
  ON <schema>._mhb_scripts ((codename->>'en'), object_id)
  WHERE _upl_deleted = false AND _mhb_deleted = false;
```

#### Data Flow

```
┌──────────────┐    Publication     ┌──────────────────┐    Sync      ┌──────────────────┐
│  _mhb_scripts│ ─────────────────> │ snapshot.scripts  │ ──────────> │  _app_scripts     │
│  (branch)    │   compile + hash   │  (JSON in pub)    │  persist    │  (runtime schema) │
└──────────────┘                    └──────────────────┘             └──────────────────┘
```

### Design Topic 2: Snapshot Representation

#### Decision: New `scripts` section in MetahubSnapshot

```typescript
// Addition to MetahubSnapshot interface in SnapshotSerializer.ts

export interface MetahubScriptSnapshot {
  id: string
  objectId: string | null
  codename: string
  name?: Record<string, unknown> | null
  description?: Record<string, unknown> | null
  /** Compiled server-side JavaScript bundle */
  compiledServerCode: string
  /** Compiled client-side JavaScript bundle */
  compiledClientCode: string
  /** Script manifest (event bindings, method lists) */
  manifest: ScriptManifest
  /** Source code hash for diff detection */
  sourceHash: string
  executionTarget: 'server' | 'client' | 'server_and_client'
  sortOrder: number
}

// In MetahubSnapshot:
export interface MetahubSnapshot {
  // ... existing fields ...
  /** Compiled extension scripts with manifests */
  scripts?: MetahubScriptSnapshot[]
}
```

**Snapshot transport schema update** (in `universo-types/base/src/common/snapshots.ts`):

```typescript
// The .passthrough() on the snapshot already allows new fields.
// For explicit validation, add:
snapshot: z.object({
  // ... existing fields ...
  scripts: z.array(z.unknown()).optional(),
}).passthrough(),
```

### Design Topic 3: Runtime Storage

```sql
-- Runtime application schema table: _app_scripts
-- Persisted during sync from snapshot

CREATE TABLE IF NOT EXISTS <schema>._app_scripts (
  id                  UUID PRIMARY KEY,
  object_id           UUID,   -- references _app_objects(id)
  codename            TEXT NOT NULL,
  compiled_server_code TEXT NOT NULL,
  compiled_client_code TEXT NOT NULL,
  manifest            JSONB NOT NULL,
  source_hash         TEXT NOT NULL,
  execution_target    VARCHAR(20) NOT NULL DEFAULT 'server_and_client',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  -- Standard runtime lifecycle
  _app_owner_id       UUID,
  _app_access_level   VARCHAR(20) DEFAULT 'public',
  _upl_created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  _upl_version        INTEGER NOT NULL DEFAULT 1
);
```

### Design Topic 4: Script Editor UI (Metahub Designer)

#### Decision: Monaco Editor embedded in the metahub frontend

```
┌─────────────────────────────────────────────────────────────┐
│  Metahub Designer > Catalog: Products > Scripts             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ Script List   │  │  ProductValidation.ts              │   │
│  │               │  │  ┌──────────────────────────────┐  │   │
│  │ ▸ ProductVal. │  │  │ import { ExtensionScript,    │  │   │
│  │   OnInit      │  │  │   AtServer, OnEvent          │  │   │
│  │               │  │  │ } from '@universo/ext-sdk'   │  │   │
│  │               │  │  │                              │  │   │
│  │ [+ New Script]│  │  │ export default class Prod... │  │   │
│  │               │  │  │   @OnEvent('OnBeforeCreate') │  │   │
│  │               │  │  │   @AtServer                  │  │   │
│  │               │  │  │   async validate(ctx) {      │  │   │
│  │               │  │  │     ...                      │  │   │
│  │               │  │  │   }                          │  │   │
│  │               │  │  └──────────────────────────────┘  │   │
│  │               │  │                                    │   │
│  │               │  │  Errors: 0  Warnings: 0  Ln 5:3   │   │
│  └──────────────┘  └────────────────────────────────────┘   │
│                                                             │
│  [Validate] [Save] [Preview Compilation]                    │
└─────────────────────────────────────────────────────────────┘
```

**Frontend routes**: Add `/scripts` section under each metahub object (catalog, hub, set, enumeration) and a top-level `/scripts` for global scripts (not attached to specific object).

**TanStack Query integration**:

```typescript
// packages/metahubs-frontend/base/src/domains/scripts/hooks/useScripts.ts

export const scriptKeys = {
  all: (metahubId: string) => ['metahub', metahubId, 'scripts'] as const,
  list: (metahubId: string, objectId?: string) =>
    [...scriptKeys.all(metahubId), 'list', { objectId }] as const,
  detail: (metahubId: string, scriptId: string) =>
    [...scriptKeys.all(metahubId), 'detail', scriptId] as const,
  compilation: (metahubId: string, scriptId: string) =>
    [...scriptKeys.all(metahubId), 'compilation', scriptId] as const,
}
```

---

## D. Server/Client Code Splitting

### Design Topic: AST Transformation Strategy

#### Alternatives Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Full AST transform (Babel plugin) | Walk entire AST, remove decorated methods, insert RPC stubs | Rejected — heavy dependency, complex visitor code |
| B. esbuild + regex post-processing | esbuild strips types; regex removes marked methods | Rejected — fragile, breaks on edge cases |
| C. esbuild + lightweight acorn parse | esbuild types → JS; acorn walks class body; splices methods | **Selected** — fast, reliable, minimal deps |

#### Decision: esbuild transpile + acorn-based class method splicing

**Data flow:**

```
                    ┌──────────────────────┐
                    │   TypeScript Source   │
                    │  (with decorators)    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   esbuild transform  │
                    │  (strip types only)  │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   acorn parse JS     │
                    │  (extract decorator  │
                    │   metadata)          │
                    └────┬─────────┬───────┘
                         │         │
              ┌──────────▼──┐  ┌──▼──────────────┐
              │ Server      │  │ Client           │
              │ Bundle      │  │ Bundle           │
              │             │  │                  │
              │ - @AtServer │  │ - @AtClient      │
              │ - @OnEvent  │  │ - @OnEvent       │
              │   (server)  │  │   (client)       │
              │ - shared    │  │ - shared         │
              │             │  │ - RPC stubs for  │
              │             │  │   @AtServer      │
              └─────────────┘  └──────────────────┘
```

**Comparison with 1С and Next.js:**

| Feature | 1С:Предприятие | Next.js Server Actions | Universo Extension SDK |
|---------|----------------|----------------------|----------------------|
| Directive syntax | `&НаСервере` | `'use server'` | `@AtServer` decorator |
| Splitting unit | Module-level procedures | File-level | Method-level on class |
| RPC mechanism | Platform-internal / XDTO | HTTP POST / RSC protocol | HTTP POST `/script-rpc` |
| Code location | Separate client/server modules possible | Separate files or inline | Single file, split at compile |
| Type safety | Weakly typed (1С language) | TypeScript | TypeScript |
| Sandbox | Platform VM | Node.js process isolation | V8 Isolate (isolated-vm) |

**RPC call sequence:**

```
Client Widget                  Express Server                   V8 Isolate
     │                              │                               │
     │ ctx.callServer('getItems')   │                               │
     │────────────────────────────> │                               │
     │ POST /script-rpc             │                               │
     │ { scriptId, method, args }   │                               │
     │                              │ pool.acquire(scriptId)        │
     │                              │──────────────────────────────>│
     │                              │                               │
     │                              │ isolate.eval(__dispatch(...)) │
     │                              │──────────────────────────────>│
     │                              │                               │
     │                              │     return { items: [...] }   │
     │                              │<──────────────────────────────│
     │                              │                               │
     │  { result: { items: [...] }} │                               │
     │<──────────────────────────── │                               │
     │                              │                               │
```

---

## E. Quiz Widget Architecture

### Design Topic 1: How the Quiz Widget Uses the Scripting System

#### Decision: Quiz as a built-in widget + data-driven script

The quiz widget is the **first practical use case** demonstrating the scripting system. It combines:
1. A **built-in widget component** registered in `widgetRenderer.tsx` (like `detailsTable`, `productTree`)
2. A **data model** using existing metahub catalogs (quiz questions + answers as elements)
3. **Server-side scoring** via an `@AtServer` script to prevent cheating

```
┌──────────────────────────────────────────────────────────────┐
│                    Quiz Widget Architecture                   │
│                                                              │
│  ┌────────────┐     ┌────────────────┐     ┌──────────────┐ │
│  │ QuizWidget │────>│ QuizScript     │────>│ ScriptEngine │ │
│  │ (React)    │     │ (@AtServer:    │     │ (isolated-vm)│ │
│  │            │<────│  checkAnswer,  │<────│              │ │
│  │ State:     │     │  getScore)     │     │ DB access    │ │
│  │ - question │     │ (@AtClient:    │     │ via ctx.db   │ │
│  │ - score    │     │  nextQuestion) │     │              │ │
│  │ - timer    │     └────────────────┘     └──────────────┘ │
│  └────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

### Design Topic 2: Quiz Data Model

#### Decision: Use existing metahub catalog infrastructure

Rather than creating a separate quiz database schema, quiz data lives as **regular metahub catalog elements**:

```
Catalog: "SpaceQuiz" (kind: catalog)
  Attributes:
    - question: STRING (the question text)
    - answer_a: STRING
    - answer_b: STRING
    - answer_c: STRING
    - answer_d: STRING
    - correct_answer: STRING (enum: 'a'|'b'|'c'|'d')
    - difficulty: NUMBER (1-3)
    - explanation: STRING (shown after answering)
    - image_url: STRING (optional space image)

  Elements (10 quiz questions):
    [{ question: "Which planet is known as the Red Planet?",
       answer_a: "Venus", answer_b: "Mars",
       answer_c: "Jupiter", answer_d: "Saturn",
       correct_answer: "b", difficulty: 1,
       explanation: "Mars appears red due to iron oxide on its surface." },
     ...]
```

**Trade-off**: Using existing catalogs means quiz data travels through the standard publication/sync pipeline with zero new infrastructure. The cost is that quiz structure is "just attributes" without specialized quiz-type validation at the metahub level.

### Design Topic 3: Server-Side Scoring

#### Decision: Score calculation and answer validation happen exclusively on the server

```typescript
// Example QuizScript — lives in _mhb_scripts, attached to SpaceQuiz catalog

import { ExtensionScript, AtServer, AtClient, OnEvent } from '@universo/extension-sdk'
import type { WidgetEventContext } from '@universo/extension-sdk'

export default class QuizScript extends ExtensionScript {
  /**
   * Fetch quiz questions in randomized order.
   * Called from client on widget mount.
   */
  @AtServer
  async getQuestions(): Promise<QuizQuestion[]> {
    const rows = await this.ctx.db.findMany('space_quiz', {
      orderBy: [{ field: 'RANDOM()', direction: 'asc' }],
      limit: 10
    })

    // IMPORTANT: Strip correct_answer from what we send to client
    return rows.map(row => ({
      id: row.id as string,
      question: row.question as string,
      answers: {
        a: row.answer_a as string,
        b: row.answer_b as string,
        c: row.answer_c as string,
        d: row.answer_d as string,
      },
      difficulty: row.difficulty as number,
      imageUrl: row.image_url as string | null,
    }))
  }

  /**
   * Validate an answer server-side. Returns whether correct + explanation.
   * Client cannot cheat because correct_answer never leaves the server.
   */
  @AtServer
  async checkAnswer(questionId: string, selectedAnswer: string): Promise<AnswerResult> {
    const row = await this.ctx.db.findById('space_quiz', questionId)
    if (!row) throw new Error('Question not found')

    const correct = row.correct_answer === selectedAnswer
    return {
      correct,
      correctAnswer: row.correct_answer as string,
      explanation: row.explanation as string,
    }
  }

  /**
   * Submit final quiz score. Persists to a scores relationship if configured.
   */
  @AtServer
  async submitScore(score: number, totalQuestions: number): Promise<void> {
    if (!this.ctx.user) return

    // Optionally persist score (if a scores catalog exists)
    try {
      await this.ctx.db.insertRow('quiz_scores', {
        user_id: this.ctx.user.id,
        score,
        total_questions: totalQuestions,
        completed_at: new Date().toISOString()
      })
    } catch {
      // Scores catalog may not exist — fail silently
      this.ctx.log.warn('quiz_scores catalog not found, score not persisted')
    }
  }

  /**
   * Client-side: handle widget mount, load questions.
   */
  @OnEvent('OnWidgetMount')
  @AtClient
  async onMount(event: WidgetEventContext): Promise<void> {
    const questions = await this.ctx.callServer<QuizQuestion[]>('getQuestions')
    this.ctx.state.set('questions', questions)
    this.ctx.state.set('currentIndex', 0)
    this.ctx.state.set('score', 0)
    this.ctx.state.set('answered', false)
    this.ctx.state.set('finished', false)
  }

  @AtClient
  async selectAnswer(questionId: string, answer: string): Promise<void> {
    this.ctx.state.set('answered', true)
    const result = await this.ctx.callServer<AnswerResult>('checkAnswer', questionId, answer)

    if (result.correct) {
      const score = (this.ctx.state.get<number>('score') ?? 0) + 1
      this.ctx.state.set('score', score)
    }
    this.ctx.state.set('lastResult', result)

    // Auto-advance after 2 seconds
    setTimeout(() => this.nextQuestion(), 2000)
  }

  @AtClient
  nextQuestion(): void {
    const idx = (this.ctx.state.get<number>('currentIndex') ?? 0) + 1
    const questions = this.ctx.state.get<QuizQuestion[]>('questions') ?? []

    if (idx >= questions.length) {
      this.ctx.state.set('finished', true)
      const score = this.ctx.state.get<number>('score') ?? 0
      this.ctx.callServer('submitScore', score, questions.length)
      return
    }

    this.ctx.state.set('currentIndex', idx)
    this.ctx.state.set('answered', false)
    this.ctx.state.set('lastResult', null)
  }
}

interface QuizQuestion {
  id: string
  question: string
  answers: { a: string; b: string; c: string; d: string }
  difficulty: number
  imageUrl: string | null
}

interface AnswerResult {
  correct: boolean
  correctAnswer: string
  explanation: string
}
```

### Design Topic 4: Widget Integration with apps-template-mui Dashboard

#### Decision: New `quizWidget` case in widgetRenderer + `ScriptedWidget` wrapper

```typescript
// Addition to packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx

// New case in renderWidget():
case 'quizWidget':
  return <ScriptedQuizWidget key={widget.id} config={widget.config} />

// Or, more generically for any scripted widget:
case 'scriptedWidget':
  return (
    <ScriptedWidgetHost
      key={widget.id}
      scriptId={widget.config.scriptId as string}
      widgetKey={widget.config.widgetKey as string}
      config={widget.config}
    />
  )
```

```typescript
// packages/apps-template-mui/src/dashboard/components/ScriptedWidgetHost.tsx

import { useQuery, useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

interface ScriptedWidgetHostProps {
  scriptId: string
  widgetKey: string
  config: Record<string, unknown>
}

/**
 * Generic host component for script-driven widgets.
 * Manages client-side script state and renders the UI tree produced by scripts.
 *
 * For the Quiz use case, this is wrapped by a specialized QuizWidget
 * that provides the quiz-specific UI.
 */
export default function ScriptedWidgetHost({ scriptId, widgetKey, config }: ScriptedWidgetHostProps) {
  const [state, setState] = useState<Record<string, unknown>>({})

  // RPC helper
  const callServer = useCallback(async (method: string, ...args: unknown[]) => {
    const response = await fetch(`/api/v1/app/${config.applicationId}/script-rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId, method, args })
    })
    const data = await response.json()
    if (!data.success) throw new Error(data.error?.message ?? 'RPC failed')
    return data.result
  }, [scriptId, config.applicationId])

  // State API bridge
  const stateAPI = {
    get: <T,>(key: string): T | undefined => state[key] as T | undefined,
    set: (key: string, value: unknown) => setState(prev => ({ ...prev, [key]: value })),
    onChange: () => () => {} // simplified for host
  }

  // Mount: dispatch OnWidgetMount to client script
  useEffect(() => {
    // Load and execute client bundle for this script
    // (implementation loads compiled client code from /api/v1/app/:appId/scripts/:scriptId/client)
  }, [scriptId])

  // Render based on widget key and state
  return <QuizWidgetUI state={state} callServer={callServer} stateAPI={stateAPI} />
}
```

```typescript
// packages/apps-template-mui/src/dashboard/components/QuizWidget.tsx

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

interface QuizWidgetUIProps {
  state: Record<string, unknown>
  callServer: (method: string, ...args: unknown[]) => Promise<unknown>
  stateAPI: { get: <T>(key: string) => T | undefined; set: (key: string, value: unknown) => void }
}

export default function QuizWidgetUI({ state, callServer, stateAPI }: QuizWidgetUIProps) {
  const { t } = useTranslation('quiz')

  const questions = (state.questions as QuizQuestion[]) ?? []
  const currentIndex = (state.currentIndex as number) ?? 0
  const score = (state.score as number) ?? 0
  const finished = state.finished as boolean
  const answered = state.answered as boolean
  const lastResult = state.lastResult as AnswerResult | null

  const currentQuestion = questions[currentIndex]
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  if (finished) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5">{t('quiz.complete')}</Typography>
          <Typography variant="h3" sx={{ my: 2 }}>
            {score} / {questions.length}
          </Typography>
          <Typography variant="body1">
            {score >= questions.length * 0.8
              ? t('quiz.excellent')
              : score >= questions.length * 0.5
              ? t('quiz.good')
              : t('quiz.tryAgain')}
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (!currentQuestion) {
    return <Typography>{t('quiz.loading')}</Typography>
  }

  return (
    <Card>
      <LinearProgress variant="determinate" value={progress} />
      <CardContent>
        <Typography variant="overline">
          {t('quiz.questionOf', { current: currentIndex + 1, total: questions.length })}
        </Typography>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {currentQuestion.question}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(['a', 'b', 'c', 'd'] as const).map((key) => (
            <Button
              key={key}
              variant={answered && lastResult?.correctAnswer === key ? 'contained' : 'outlined'}
              color={
                answered
                  ? lastResult?.correctAnswer === key
                    ? 'success'
                    : 'inherit'
                  : 'primary'
              }
              disabled={answered}
              onClick={() => {
                callServer('checkAnswer', currentQuestion.id, key).then((result) => {
                  stateAPI.set('answered', true)
                  stateAPI.set('lastResult', result)
                  if ((result as AnswerResult).correct) {
                    stateAPI.set('score', score + 1)
                  }
                })
              }}
              sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              {key.toUpperCase()}. {currentQuestion.answers[key]}
            </Button>
          ))}
        </Box>

        {answered && lastResult && (
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            {lastResult.explanation}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

// Types (shared with QuizScript)
interface QuizQuestion {
  id: string; question: string
  answers: { a: string; b: string; c: string; d: string }
  difficulty: number; imageUrl: string | null
}
interface AnswerResult { correct: boolean; correctAnswer: string; explanation: string }
```

**Dashboard layout widget registration** (in `metahubs-backend/.../layoutDefaults.ts`):

```typescript
// Add to DASHBOARD_LAYOUT_WIDGETS array:
{ key: 'quizWidget', allowedZones: ['center', 'right'] }
```

---

## F. Security Model

### Design Topic 1: Sandbox Globals Allow/Deny

#### Decision: Strict allowlist — nothing by default

```
┌────────────────────────────────────────────────────────────┐
│                    V8 Isolate Sandbox                       │
│                                                            │
│  ALLOWED (injected via Reference/Callback):                │
│  ✅ console.log/warn/error (bridged to host logger)        │
│  ✅ JSON.parse / JSON.stringify (V8 built-in)              │
│  ✅ Math.* (V8 built-in)                                   │
│  ✅ Date (V8 built-in, but no system clock access)         │
│  ✅ Promise (V8 built-in)                                  │
│  ✅ Map / Set / WeakMap / WeakSet (V8 built-in)            │
│  ✅ Array / Object / String / Number (V8 built-in)         │
│  ✅ TextEncoder / TextDecoder (injected polyfill)          │
│  ✅ __platformCallServer (RPC bridge, Reference)           │
│  ✅ __platformDB (DB bridge, Reference, server-only)       │
│  ✅ __platformHTTP (HTTP bridge, Reference, server-only)   │
│                                                            │
│  DENIED (set to undefined on context global):              │
│  ❌ setTimeout / setInterval / setImmediate                │
│  ❌ fetch / XMLHttpRequest / WebSocket                     │
│  ❌ eval / Function constructor                            │
│  ❌ require / import (dynamic)                             │
│  ❌ process / global / globalThis (redefined)              │
│  ❌ Buffer / fs / net / child_process / os                 │
│  ❌ SharedArrayBuffer / Atomics                            │
│  ❌ Proxy / Reflect (prevent sandbox escape)               │
│  ❌ WeakRef / FinalizationRegistry                         │
└────────────────────────────────────────────────────────────┘
```

### Design Topic 2: Resource Limits

```typescript
export interface ScriptResourceLimits {
  /** V8 heap memory per isolate */
  memoryLimitMB: 32                 // 32 MB per script isolate
  /** CPU time per single execution */
  cpuTimeoutMs: 1000                // 1 second hard limit
  /** Wall-clock time per execution (includes async waits) */
  wallTimeoutMs: 5000               // 5 seconds
  /** Max concurrent isolates per application */
  maxIsolatesPerApp: 20
  /** Max compiled script size (bytes) */
  maxCompiledSizeBytes: 512 * 1024  // 512 KB per bundle
  /** Max source code size (bytes) */
  maxSourceSizeBytes: 256 * 1024    // 256 KB per script
  /** Max DB queries per execution */
  maxDbQueriesPerExecution: 50
  /** Max HTTP requests per execution (server-side) */
  maxHttpRequestsPerExecution: 5
  /** Max RPC calls per client-side execution */
  maxRpcCallsPerExecution: 20
  /** HTTP request timeout (ms) */
  httpRequestTimeoutMs: 10_000      // 10 seconds
  /** Max HTTP response body size (bytes) */
  maxHttpResponseSizeBytes: 1 * 1024 * 1024  // 1 MB
}
```

### Design Topic 3: Data Access Control (RLS Through Scripts)

#### Decision: Scripts inherit the request user's RLS context

```
┌──────────────────────────────────────────────────────────────────┐
│                    RLS Enforcement Chain                          │
│                                                                  │
│  1. Client → POST /script-rpc (with session cookie)              │
│  2. Express middleware: ensureAuthWithRls(req)                   │
│     → pins connection, sets request.jwt.claims                   │
│  3. Script engine receives request-scoped DbExecutor             │
│  4. ctx.db.query() → executor.query() → RLS-protected SQL       │
│  5. Scripts CANNOT:                                              │
│     - Bypass RLS (no raw knex access)                           │
│     - Access schemas outside their application                   │
│     - Execute DDL (CREATE, ALTER, DROP)                          │
│     - Access system tables (_app_migrations, _app_objects, etc.) │
│  6. SQL is whitelist-validated:                                  │
│     - Only SELECT, INSERT, UPDATE, DELETE on business tables     │
│     - Parameterized queries only ($1, $2, ...)                  │
│     - No dynamic table/column names from user input              │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
// packages/scripting-engine/base/src/sandbox/DatabaseBridge.ts

import type { DbExecutor } from '@universo/utils'

const ALLOWED_SQL_PREFIXES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH']
const BLOCKED_SQL_KEYWORDS = [
  'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE',
  'COPY', 'EXECUTE', 'DO', 'SET', 'RESET', 'LOAD',
  '_app_migrations', '_app_objects', '_app_scripts',
  '_mhb_', 'pg_', 'information_schema'
]

/**
 * Database bridge for script execution.
 * Wraps the request-scoped DbExecutor with SQL validation.
 */
export class DatabaseBridge {
  private queryCount = 0
  private readonly maxQueries: number

  constructor(
    private executor: DbExecutor,
    private schemaName: string,
    maxQueries = 50
  ) {
    this.maxQueries = maxQueries
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    this.validateQuery(sql)
    this.queryCount++

    if (this.queryCount > this.maxQueries) {
      throw new Error(`Script exceeded max query limit (${this.maxQueries})`)
    }

    // Prefix with schema search_path
    const result = await this.executor.query<T>(
      `SET LOCAL search_path = '${this.schemaName}'; ${sql}`,
      params
    )
    return result.rows ?? result as unknown as T[]
  }

  private validateQuery(sql: string): void {
    const normalized = sql.trim().toUpperCase()

    const hasAllowedPrefix = ALLOWED_SQL_PREFIXES.some(p => normalized.startsWith(p))
    if (!hasAllowedPrefix) {
      throw new Error(`SQL operation not allowed: ${normalized.substring(0, 20)}...`)
    }

    for (const blocked of BLOCKED_SQL_KEYWORDS) {
      if (normalized.includes(blocked.toUpperCase())) {
        throw new Error(`SQL contains blocked keyword: ${blocked}`)
      }
    }
  }
}
```

### Design Topic 4: Attack Vectors & Mitigations

| Attack Vector | Risk Level | Mitigation |
|--------------|-----------|------------|
| **Infinite loop / CPU exhaustion** | High | `cpuTimeoutMs: 1000` enforced by V8 isolate; `wallTimeoutMs: 5000` as backup |
| **Memory exhaustion (heap bombing)** | High | `memoryLimitMB: 32` per isolate; V8 kills isolate on OOM |
| **Prototype pollution** | Medium | `Proxy` and `Reflect` blocked; `Object.freeze` on injected APIs |
| **SQL injection** | High | Parameterized queries only; SQL keyword whitelist; no dynamic table names |
| **RLS bypass** | Critical | Scripts receive request-scoped executor; no raw pool access; system tables blocked |
| **SSRF (via HTTP API)** | Medium | HTTP allowlist for target domains (configurable per application); private IP ranges blocked |
| **Sandbox escape** | Critical | `isolated-vm` uses V8 process-level isolation; no `eval`, no `Function`, no `Proxy`; `--no-node-snapshot` flag |
| **Resource starvation (many scripts)** | Medium | `maxIsolatesPerApp: 20`; LRU eviction; pool-level memory cap |
| **Timing attacks** | Low | No high-resolution timers (`performance.now` blocked); `Date` is approximated |
| **Data exfiltration** | Medium | No `fetch`/`XMLHttpRequest`; server HTTP API has domain allowlist; log output rate-limited |
| **ReDoS** | Medium | V8's RegExp has built-in backtracking limits; `cpuTimeoutMs` as safety net |
| **Path traversal** | Low | No filesystem access at all; all data through structured APIs |

---

## Summary of Design Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| **SDK** | Decorator-based (`@AtServer`, `@AtClient`, `@OnEvent`) class model | Mirrors 1С directives; compile-time splittable; full type safety |
| **Sandbox** | `isolated-vm` with per-script isolates, pooled | Fault isolation + memory accounting; battle-tested V8 security |
| **Event System** | Registry-based router with priority ordering | Simple, predictable, debuggable; no global event bus |
| **Compilation** | esbuild + acorn at publication time | Fast (ms-level); outputs stored in snapshot |
| **RPC** | HTTP POST through existing Express routes | Reuses auth/CSRF/RLS middleware; no WebSocket overhead |
| **Data Model** | `_mhb_scripts` table in branch schemas | Follows existing `_mhb_*` pattern; normal publication flow |
| **Client Rendering** | `WidgetRenderResult` UI tree (not raw JSX) | Secure serialization boundary; no XSS from sandbox |
| **Quiz** | Regular catalog data + `QuizScript` + `quizWidget` | Zero custom DB infrastructure; demonstrates entire stack |
| **Security** | Strict allowlist globals, SQL validation, RLS inheritance | Defense-in-depth; scripts are untrusted by default |

---

## New Packages Required

| Package | Type | Purpose |
|---------|------|---------|
| `@universo/extension-sdk` | Source-only (peerDeps) | TypeScript types, decorators, base classes for script authors |
| `@universo/scripting-engine` | Built (tsdown) | V8 isolate management, event routing, compilation, RPC handler |

## Existing Packages Touched

| Package | Changes |
|---------|---------|
| `@universo/types` | Add `ScriptManifest`, `MetahubScriptSnapshot` types; extend snapshot schema |
| `@universo/schema-ddl` | Add `_mhb_scripts` to system table generation; add `_app_scripts` to runtime tables |
| `@universo/metahubs-backend` | New `scripts` domain (controller/service/store); extend `SnapshotSerializer` |
| `@universo/metahubs-frontend` | New `scripts` domain (hooks/pages); Monaco editor integration |
| `@universo/applications-backend` | `scriptRpcRoutes`; extend `syncEngine` with `persistPublishedScripts()` |
| `@universo/apps-template-mui` | `quizWidget` case in `widgetRenderer`; `QuizWidget` + `ScriptedWidgetHost` components |
| `@universo/universo-i18n` | New `scripting` and `quiz` namespaces |
| `@universo/universo-migrations-platform` | Migration for `_app_scripts` in runtime schemas |

---

## Node.js Runtime Requirement

**CRITICAL**: `isolated-vm` requires the Node.js startup flag `--no-node-snapshot` on Node.js ≥ 20. This must be added to:
- `package.json` → `"start": "node --no-node-snapshot server.js"`
- Development scripts and Docker entrypoints
- Documented in package README

---

## Implementation Order (recommended for PLAN phase)

1. **Phase 1 — SDK + Engine foundation** (2-3 weeks)
   - Create `@universo/extension-sdk` package with types/decorators
   - Create `@universo/scripting-engine` with IsolatePool + EventRouter
   - Add `_mhb_scripts` table to schema-ddl

2. **Phase 2 — Metahub integration** (2 weeks)
   - Scripts CRUD domain in metahubs-backend
   - Script editor UI in metahubs-frontend (Monaco)
   - Extend SnapshotSerializer

3. **Phase 3 — Runtime integration** (2 weeks)
   - `_app_scripts` table and sync
   - Script RPC routes in applications-backend
   - ScriptedWidgetHost in apps-template-mui

4. **Phase 4 — Quiz widget** (1 week)
   - QuizWidget component
   - QuizScript example
   - Space quiz template data

5. **Phase 5 — Hardening** (1-2 weeks)
   - Security audit of sandbox
   - Performance benchmarks
   - E2E tests for script lifecycle
   - Error recovery and logging

Total estimated scope: 8-10 weeks for a production-ready MVP.
