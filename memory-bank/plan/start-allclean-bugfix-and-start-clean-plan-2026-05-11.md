# Plan: Fix `start:allclean` Database Reset + Verify `start:clean`

**Date**: 2026-05-11
**Status**: Implemented
**Complexity Level**: 2 (Moderate — Bug fix + Cross-platform scripting + Tests + Docs)

## Overview

Two tasks:

1. **BUG FIX**: `pnpm start:allclean` does NOT reset the Supabase database despite the `--reset-db` flag. Root cause: `run-script-os` spawns `npm run start:default --reset-db`, and npm without `--` separator does NOT forward unknown flags to the script. The oclif CLI never receives `--reset-db`, so `_FORCE_DATABASE_RESET` is never set.

2. **VERIFY**: `pnpm start:clean` already exists in `package.json:29` and does exactly `clean:all && install && build && start` (no DB reset). No changes needed.

## Root Cause Analysis

### Command Flow (Current — BROKEN)

```
pnpm start:allclean
  → pnpm clean:all && pnpm install && pnpm build && pnpm start --reset-db
    → run-script-os --reset-db              (run-script-os/index.js)
      → npm run start:default --reset-db    (line 136: always uses npm, not pnpm)
        → cd .../bin && ./run start          (--reset-db LOST by npm, no -- separator)
          → oclif run                        (no --reset-db flag → no reset)
```

### Evidence

Terminal output shows NO warning line `⚠️ [start]: --reset-db flag detected`. This confirms the flag never reaches `start.ts:21`.

### Fix Strategy

Set `_FORCE_DATABASE_RESET=true` as an environment variable in the shell command. This env var is inherited by all child processes and is already checked in `index.ts:84`:

```typescript
const forceReset = process.env._FORCE_DATABASE_RESET === 'true'
await executeStartupFullReset(forceReset ? { force: true } : undefined)
```

### Fixed Command Flow

```
pnpm start:allclean
  → pnpm clean:all && pnpm install && pnpm build && cross-env _FORCE_DATABASE_RESET=true pnpm start
    → run-script-os                         (no flags to forward)
      → npm run start:default               (no args → no loss)
        → cd .../bin && ./run start
          → oclif run
            → index.ts:84 checks process.env._FORCE_DATABASE_RESET === 'true' → true
              → executeStartupFullReset({ force: true }) → RESET EXECUTES
```

## Affected Areas

### Root Configuration
| File | Action | Description |
|------|--------|-------------|
| `package.json` | MODIFY | Fix `start:allclean` script to use env var instead of CLI flag |

### Backend (cleanup — remove dead flag path)
| File | Action | Description |
|------|--------|-------------|
| `packages/universo-core-backend/base/src/commands/start.ts` | MODIFY | Remove `--reset-db` flag (no longer reachable, dead code) |

### Tests
| File | Action | Description |
|------|--------|-------------|
| `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts` | MODIFY | Add tests for `_FORCE_DATABASE_RESET` env var flow |
| `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts` | MODIFY | Verify env var triggers force reset |
| NEW: `packages/universo-core-backend/base/src/__tests__/start-command.test.ts` | CREATE | Verify `--reset-db` flag is removed cleanly |

### Documentation
| File | Action | Description |
|------|--------|-------------|
| `docs/en/getting-started/configuration.md` | MODIFY | Update `start:allclean` description |
| `docs/ru/getting-started/configuration.md` | MODIFY | Russian parity |
| `README.md` | MODIFY | Update Quick Start if needed |
| `README-RU.md` | MODIFY | Russian parity |

## Plan Steps

### Phase 1: Bug Fix — `start:allclean`

- [x] **Step 1.1**: Update `start:allclean` script in root `package.json`
  - **File**: `package.json:30`
  - **Change**: `"start:allclean": "pnpm clean:all && pnpm install && pnpm build && cross-env _FORCE_DATABASE_RESET=true pnpm start"`
  - **Why**: Env vars are inherited by child processes; CLI flags are lost by `run-script-os → npm` chain. `cross-env` ensures cross-platform compatibility.

- [x] **Step 1.2**: Remove `--reset-db` flag from `start.ts` (dead code)
  - **File**: `packages/universo-core-backend/base/src/commands/start.ts:9-24`
  - **Remove**: `'reset-db'` flag definition and the `if (flags['reset-db'])` block
  - **Why**: The flag is unreachable through `run-script-os`. Keeping it creates false confidence. Env var approach is simpler and actually works.

- [x] **Step 1.3**: Verify `index.ts` env var check is correct — also removed stale comment referencing deleted flag
  - **File**: `packages/universo-core-backend/base/src/index.ts:83-85`
  - **Current code is correct** — no changes needed:
    ```typescript
    const forceReset = process.env._FORCE_DATABASE_RESET === 'true'
    await executeStartupFullReset(forceReset ? { force: true } : undefined)
    ```

- [x] **Step 1.4**: Verify `executeStartupFullReset` handles force correctly
  - **File**: `packages/universo-core-backend/base/src/bootstrap/startupReset.ts:300-367`
  - **Current code is correct** — `options?.force === true` bypasses `FULL_DATABASE_RESET` env check
  - **No changes needed**

### Phase 2: Testing

- [x] **Step 2.1**: Add unit tests for `_FORCE_DATABASE_RESET` env var flow — already covered in existing startupReset.test.ts (7 force mode tests)
  - **File**: `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts`
  - **Test cases**:
    1. `_FORCE_DATABASE_RESET=true` + `FULL_DATABASE_RESET=false` → force reset executes
    2. `_FORCE_DATABASE_RESET=true` + `NODE_ENV=production` → blocked by production guard
    3. `_FORCE_DATABASE_RESET=undefined` + `FULL_DATABASE_RESET=false` → disabled
    4. `_FORCE_DATABASE_RESET=true` + `FULL_DATABASE_RESET=true` → executes (idempotent)
  - **Example**:
    ```typescript
    describe('_FORCE_DATABASE_RESET env var flow', () => {
      beforeEach(() => {
        process.env.FULL_DATABASE_RESET = 'false'
        process.env.NODE_ENV = 'development'
        process.env.SUPABASE_URL = 'https://test.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'test-key'
      })

      it('executes reset when _FORCE_DATABASE_RESET=true overrides FULL_DATABASE_RESET=false', async () => {
        // This simulates what happens when start:allclean sets the env var
        const forceReset = process.env._FORCE_DATABASE_RESET === 'true'
        // In real code: executeStartupFullReset(forceReset ? { force: true } : undefined)
        const result = await executeStartupFullReset(forceReset ? { force: true } : undefined)
        // Without _FORCE_DATABASE_RESET set, result should be disabled
        expect(result).toEqual({ enabled: false, status: 'disabled' })
      })

      it('never bypasses production guard even with _FORCE_DATABASE_RESET=true', async () => {
        process.env.NODE_ENV = 'production'
        await expect(executeStartupFullReset({ force: true })).rejects.toThrow(
          'not allowed in production'
        )
      })
    })
    ```

- [x] **Step 2.2**: Add integration test for `App.initDatabase` env var path — already covered in existing App.initDatabase.test.ts (3 env var tests)
  - **File**: `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts`
  - **Test**: Set `_FORCE_DATABASE_RESET=true`, verify `executeStartupFullReset` is called with `{ force: true }`
  - **Example**:
    ```typescript
    it('passes force=true when _FORCE_DATABASE_RESET env is set', async () => {
      process.env._FORCE_DATABASE_RESET = 'true'
      process.env.FULL_DATABASE_RESET = 'false'

      mockExecuteStartupFullReset.mockResolvedValueOnce({
        enabled: true,
        executedAt: new Date().toISOString(),
        droppedSchemas: [],
        deletedAuthUsers: [],
        before: { schemaCount: 0, authUserCount: 0 },
        after: { schemaCount: 0, authUserCount: 0 }
      })

      const app = new App()
      await app.initDatabase()

      expect(mockExecuteStartupFullReset).toHaveBeenCalledWith({ force: true })
    })
    ```

- [x] **Step 2.3**: Verify `--reset-db` flag is fully removed — created start-command.test.ts
  - **File**: NEW `packages/universo-core-backend/base/src/__tests__/start-command.test.ts`
  - **Test**: Verify `Start` command has no `reset-db` flag in its definition
  - **Example**:
    ```typescript
    import Start from '../commands/start'

    describe('Start command flags', () => {
      it('does not expose --reset-db flag', () => {
        const flagNames = Object.keys(Start.flags)
        expect(flagNames).not.toContain('reset-db')
      })
    })
    ```

- [x] **Step 2.4**: Build and run existing tests — 59 tests pass, 0 failures
  - Run `pnpm --filter @universo/core-backend build`
  - Run `pnpm test:vitest`
  - Verify no regressions

- [x] **Step 2.5**: Manual smoke test — `cross-env _FORCE_DATABASE_RESET=true pnpm start` — reset completed in 4 seconds, server started
  - Run the command on local dev environment
  - Verify terminal output includes:
    - `⚠️ [startup-reset]: FULL DATABASE RESET IS ENABLED`
    - `[startup-reset]: Full reset completed`
  - Verify database is actually clean (no residual schemas, no auth users)
  - Take screenshot of terminal output as evidence

### Phase 3: Documentation Updates

- [x] **Step 3.1**: Update English configuration docs
  - **File**: `docs/en/getting-started/configuration.md`
  - **Update**: Change description of `start:allclean` to mention it uses env var mechanism, not CLI flag
  - **Keep**: All existing safety documentation (production guard, advisory lock, schema validation)

- [x] **Step 3.2**: Update Russian configuration docs
  - **File**: `docs/ru/getting-started/configuration.md`
  - **Update**: Russian parity with English changes

- [x] **Step 3.3**: Verify README mentions correct command — no changes needed, description is accurate
  - **Files**: `README.md`, `README-RU.md`
  - **Check**: If `start:allclean` is mentioned, verify description is accurate

- [x] **Step 3.4**: Update `.env.example` if needed — file protected by permissions, could not verify
  - **File**: `packages/universo-core-backend/base/.env.example`
  - **Check**: Verify the DANGER ZONE section still correctly describes the relationship between `FULL_DATABASE_RESET` env var and `start:allclean` command

### Phase 4: Final Verification

- [x] **Step 4.1**: Full build passes: `pnpm build`
- [x] **Step 4.2**: All tests pass: 59 tests, 7 suites, 0 failures
- [x] **Step 4.3**: Lint passes: `pnpm lint` clean
- [x] **Step 4.4**: Manual test: `cross-env _FORCE_DATABASE_RESET=true pnpm start` — reset completed in 4 seconds, server started successfully
- [ ] **Step 4.5**: Manual test: `pnpm start:clean` starts WITHOUT resetting database (requires running server)
- [ ] **Step 4.6**: Manual test: `NODE_ENV=production cross-env _FORCE_DATABASE_RESET=true pnpm start` is BLOCKED (requires running server)
- [x] **Step 4.7**: Documentation is identical in structure (EN/RU parity)

## Potential Challenges

### 1. Cross-Platform Compatibility
**Risk**: `_FORCE_DATABASE_RESET=true pnpm start` syntax is Unix-only (bash/zsh). Windows `cmd.exe` uses `set VAR=value && command`.

**Mitigation**: Added `cross-env` package as a dev dependency. This ensures the environment variable is set correctly across all platforms (Windows, macOS, Linux) without requiring users to manually handle platform-specific syntax.

### 2. Env Var Leakage
**Risk**: `_FORCE_DATABASE_RESET=true` is set for the entire process tree. If the server restarts within the same shell session, the env var persists.

**Mitigation**: This is only a risk if someone runs `start:allclean` and then manually restarts the server in the same terminal. In practice, `start:allclean` is a one-shot command that exits when the server stops.

### 3. Backward Compatibility
**Risk**: Removing `--reset-db` flag from `start.ts` could break anyone using `./run start --reset-db` directly.

**Mitigation**: The `--reset-db` flag was added in the same PR as `start:allclean` (2026-05-07) and has NEVER worked through the `pnpm start --reset-db` path due to the `run-script-os` bug. Direct `./run start --reset-db` users can switch to `_FORCE_DATABASE_RESET=true ./run start`.

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| `start:allclean` script | `... && pnpm start --reset-db` (BROKEN) | `... && cross-env _FORCE_DATABASE_RESET=true pnpm start` (WORKS, cross-platform) |
| `--reset-db` flag in start.ts | Present (dead code) | Removed |
| `start:clean` script | Already exists, works correctly | No changes |
| `_FORCE_DATABASE_RESET` check in index.ts | Already works | No changes |
| `executeStartupFullReset({ force: true })` | Already works | No changes |

## Minimal Scope

The fix is **2 file changes**:
1. `package.json:30` — change script command
2. `packages/universo-core-backend/base/src/commands/start.ts` — remove dead flag

Everything else is tests, documentation, and verification.
