# Plan: pnpm start:allclean Command Implementation

**Date**: 2026-05-07  
**Status**: Draft for Review  
**Complexity Level**: 2 (Moderate - Backend + CLI + Docs)

## Overview

Implement a new `pnpm start:allclean` command that performs a complete platform reset including full Supabase database cleanup. This command will work independently from the `FULL_DATABASE_RESET` environment variable, allowing developers to force a database reset without modifying `.env` files.

**Key distinction from existing commands:**
- `pnpm start:clean` → Cleans build artifacts, reinstalls dependencies, builds workspace, starts server (NO database reset)
- `pnpm start:allclean` → Same as `start:clean` + forces Supabase database reset (ignores `FULL_DATABASE_RESET` env var)

## Affected Areas

### Core Backend Files
| File | Action | Description |
|------|--------|-------------|
| `packages/universo-core-backend/base/src/bootstrap/startupReset.ts` | MODIFY | Add `force` parameter to bypass env var check |
| `packages/universo-core-backend/base/src/commands/start.ts` | MODIFY | Add `--reset-db` CLI flag |
| `packages/universo-core-backend/base/src/commands/base.ts` | MODIFY | Add `FULL_DATABASE_RESET` flag declaration |
| `packages/universo-core-backend/base/src/index.ts` | MODIFY | Pass force flag through to reset function |

### Root Configuration
| File | Action | Description |
|------|--------|-------------|
| `package.json` (root) | MODIFY | Add `start:allclean` script |

### Tests
| File | Action | Description |
|------|--------|-------------|
| `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts` | MODIFY | Add tests for force mode |
| `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts` | MODIFY | Add tests for CLI flag integration |
| NEW: E2E test for start:allclean | CREATE | Verify full command chain works |

### Documentation
| File | Action | Description |
|------|--------|-------------|
| `docs/en/getting-started/configuration.md` | MODIFY | Document `start:allclean` command |
| `docs/ru/getting-started/configuration.md` | MODIFY | Russian translation |
| `README.md` | MODIFY | Add command to Quick Start section |
| `README-RU.md` | MODIFY | Russian translation |
| `packages/universo-core-backend/base/.env.example` | MODIFY | Mention command alternative |

## Implementation Plan

### Phase 1: Core Backend Implementation

#### Step 1.1: Extend `executeStartupFullReset` Function
**File**: `packages/universo-core-backend/base/src/bootstrap/startupReset.ts`

Add optional `force` parameter to the function signature:

```typescript
// Add new options interface
export interface StartupResetOptions {
    force?: boolean  // When true, bypass FULL_DATABASE_RESET env var check
}

// Modify function signature
export async function executeStartupFullReset(
    options?: StartupResetOptions
): Promise<StartupResetReport | { enabled: false; status: 'disabled' }> {
    // Modify config parsing to respect force flag
    const envEnabled = parseEnvBoolean(process.env.FULL_DATABASE_RESET, false)
    const shouldExecute = options?.force === true || envEnabled
    
    if (!shouldExecute) {
        return { enabled: false, status: 'disabled' }
    }
    
    // Rest of the function remains the same...
    // Production guard still applies even with force=true
    assertNotProduction()
    
    // ... existing implementation
}
```

**Key decisions:**
- `force: true` bypasses ONLY the env var check
- Production guard (`NODE_ENV=production`) is NEVER bypassed (security-first)
- All other safety measures (advisory lock, schema validation) remain active

#### Step 1.2: Add `--reset-db` CLI Flag to Start Command
**File**: `packages/universo-core-backend/base/src/commands/start.ts`

```typescript
import { Flags } from '@oclif/core'

export default class Start extends BaseCommand {
    static flags = {
        ...BaseCommand.flags,
        'reset-db': Flags.boolean({
            description: 'Force full database reset on startup (ignores FULL_DATABASE_RESET env var)',
            default: false
        })
    }

    async run(): Promise<void> {
        const { flags } = await this.parse(Start)
        
        // Pass reset-db flag to the startup reset function
        if (flags['reset-db']) {
            process.env._FORCE_DATABASE_RESET = 'true'
        }
        
        logger.info('Starting Universo Platformo...')
        // ... rest of implementation
    }
}
```

#### Step 1.3: Add Flag Declaration to Base Command
**File**: `packages/universo-core-backend/base/src/commands/base.ts`

The `FULL_DATABASE_RESET` flag is NOT needed in base.ts because:
1. We don't want to expose it as a direct CLI flag
2. The `--reset-db` flag in start.ts handles the force mode
3. This provides cleaner separation of concerns

#### Step 1.4: Pass Force Flag Through App.initDatabase
**File**: `packages/universo-core-backend/base/src/index.ts`

```typescript
async initDatabase() {
    try {
        // Check for forced reset via CLI flag
        const forceReset = process.env._FORCE_DATABASE_RESET === 'true'
        
        await executeStartupFullReset(forceReset ? { force: true } : undefined)
        
        // ... rest of implementation
    }
    // ...
}
```

#### Step 1.5: Add Root `start:allclean` Script
**File**: `package.json` (root)

```json
{
    "scripts": {
        "start:clean": "pnpm clean:all && pnpm install && pnpm build && pnpm start",
        "start:allclean": "pnpm clean:all && pnpm install && pnpm build && pnpm start --reset-db"
    }
}
```

**Why this approach:**
- Mirrors the existing `start:clean` pattern
- Uses `--reset-db` flag instead of modifying env files
- Clear naming: "allclean" implies "everything including database"
- No special handling needed for `start:windows` because `--reset-db` is passed through oclif

### Phase 2: Testing Strategy

#### Step 2.1: Unit Tests for Force Mode
**File**: `packages/universo-core-backend/base/src/__tests__/startupReset.test.ts`

Add test cases:

```typescript
describe('force mode', () => {
    beforeEach(() => {
        process.env.FULL_DATABASE_RESET = 'false'  // Env says no
        process.env.NODE_ENV = 'development'
        process.env.SUPABASE_URL = 'https://test.supabase.co'
        process.env.SERVICE_ROLE_KEY = 'test-key'
    })

    it('executes reset when force=true even if env var is false', async () => {
        const result = await executeStartupFullReset({ force: true })
        
        expect(result).toHaveProperty('enabled', true)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('FULL DATABASE RESET IS ENABLED')
        )
    })

    it('respects env var when force is undefined', async () => {
        const result = await executeStartupFullReset()
        
        expect(result).toEqual({ enabled: false, status: 'disabled' })
    })

    it('still blocks force reset in production', async () => {
        process.env.NODE_ENV = 'production'
        
        await expect(executeStartupFullReset({ force: true })).rejects.toThrow(
            'not allowed in production'
        )
    })

    it('force=true with env=true still works (idempotent)', async () => {
        process.env.FULL_DATABASE_RESET = 'true'
        
        const result = await executeStartupFullReset({ force: true })
        
        expect(result).toHaveProperty('enabled', true)
    })
})
```

#### Step 2.2: Integration Tests for CLI Flag
**File**: `packages/universo-core-backend/base/src/__tests__/App.initDatabase.test.ts`

Add test case:

```typescript
it('forces database reset when _FORCE_DATABASE_RESET env is set', async () => {
    process.env.FULL_DATABASE_RESET = 'false'
    process.env._FORCE_DATABASE_RESET = 'true'
    
    mockExecuteStartupFullReset.mockResolvedValueOnce({
        enabled: true,
        executedAt: '2026-05-07T00:00:00.000Z',
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

#### Step 2.3: E2E Test for Full Command Chain
**New File**: `tools/testing/e2e/tests/start-allclean.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('start:allclean command', () => {
    test('should reset database when run with --reset-db flag', async () => {
        // This test requires:
        // 1. Server started with --reset-db
        // 2. Verify database was reset (check logs or API response)
        // This is more of a manual/smoke test
    })
})
```

**Note**: Full E2E testing of `start:allclean` requires:
1. A test database that can be destroyed
2. Running the actual server process
3. This is best done as a manual smoke test or in a dedicated CI job

### Phase 3: Documentation Updates

#### Step 3.1: Update English Configuration Docs
**File**: `docs/en/getting-started/configuration.md`

Add new section after "Danger Zone: Full Database Reset":

```markdown
### Alternative: start:allclean Command

Instead of manually setting `FULL_DATABASE_RESET=true`, you can use the
`start:allclean` command which performs a complete reset without modifying
your `.env` file:

```bash
pnpm start:allclean
```

This command is equivalent to:

```bash
pnpm clean:all && pnpm install && pnpm build && pnpm start --reset-db
```

The `--reset-db` flag forces a database reset regardless of the
`FULL_DATABASE_RESET` environment variable value. All safety measures
(production guard, advisory lock, schema validation) remain active.

**When to use `start:allclean` vs `FULL_DATABASE_RESET`:**

| Scenario | Recommended Approach |
|----------|---------------------|
| One-time local reset | `pnpm start:allclean` |
| CI/CD pipeline reset | `FULL_DATABASE_RESET=true` in env |
| Repeated testing | `FULL_DATABASE_RESET=true` temporarily |
| After accidental data corruption | `pnpm start:allclean` |

**Important**: Both methods are blocked in production environments.
```

#### Step 3.2: Update Russian Configuration Docs
**File**: `docs/ru/getting-started/configuration.md`

Add corresponding Russian section:

```markdown
### Альтернатива: команда start:allclean

Вместо ручной установки `FULL_DATABASE_RESET=true` можно использовать
команду `start:allclean`, которая выполняет полный сброс без изменения
файла `.env`:

```bash
pnpm start:allclean
```

Эта команда эквивалентна:

```bash
pnpm clean:all && pnpm install && pnpm build && pnpm start --reset-db
```

Флаг `--reset-db` принудительно выполняет сброс базы данных независимо от
значения переменной окружения `FULL_DATABASE_RESET`. Все меры безопасности
(защита от production, advisory lock, валидация схем) сохраняются.

**Когда использовать `start:allclean` или `FULL_DATABASE_RESET`:**

| Сценарий | Рекомендуемый подход |
|----------|---------------------|
| Разовый локальный сброс | `pnpm start:allclean` |
| Сброс в CI/CD пайплайне | `FULL_DATABASE_RESET=true` в env |
| Повторяющееся тестирование | `FULL_DATABASE_RESET=true` временно |
| После случайного повреждения данных | `pnpm start:allclean` |

**Важно**: Оба метода блокируются в production-окружениях.
```

#### Step 3.3: Update Root README
**File**: `README.md`

Add to "Getting Started" section after "Start the application":

```markdown
### Reset Database

To perform a complete reset (clean build + database wipe):

```bash
pnpm start:allclean
```

This is useful for:
- Local development when you need a fresh database
- Testing migrations from scratch
- Recovering from data corruption

**Warning**: This command destroys all data. Never run in production.
```

#### Step 3.4: Update Russian README
**File**: `README-RU.md`

Add corresponding Russian section:

```markdown
### Сброс базы данных

Для выполнения полного сброса (чистая сборка + очистка базы):

```bash
pnpm start:allclean
```

Это полезно для:
- Локальной разработки, когда нужна чистая база данных
- Тестирования миграций с нуля
- Восстановления после повреждения данных

**Предупреждение**: Эта команда уничтожает все данные. Никогда не запускайте в production.
```

#### Step 3.5: Update .env.example
**File**: `packages/universo-core-backend/base/.env.example`

Update the DANGER ZONE section:

```env
############################################################################################################
########################################### DANGER ZONE ####################################################
############################################################################################################

# WARNING: FULL_DATABASE_RESET will COMPLETELY DESTROY all platform data on startup.
# It is STRONGLY RECOMMENDED to create a database backup before enabling this option.
# This action is IRREVERSIBLE. NEVER enable in production.
#
# Alternative: Use `pnpm start:allclean` for one-time reset without modifying this file.
#
FULL_DATABASE_RESET=false
```

## Potential Challenges

### 1. Oclif Flag Parsing
**Risk**: The `--reset-db` flag needs to work across different platforms (Windows, Linux, macOS).

**Mitigation**: Use the existing `run-script-os` pattern that's already in place for `start` and `start-worker` commands. The flag will be passed through oclif's standard flag parsing.

### 2. Environment Variable vs Flag Priority
**Risk**: Confusion about whether flag overrides env var or vice versa.

**Decision**: `--reset-db` flag ALWAYS forces reset (unless in production). This is intentional - the flag is explicit user intent.

### 3. Production Safety
**Risk**: Someone might accidentally run `start:allclean` in production.

**Mitigation**: 
- Production guard (`NODE_ENV=production`) is NEVER bypassed
- Clear warning in documentation
- Consider adding an extra confirmation step in production (future enhancement)

### 4. Test Database for E2E
**Risk**: E2E tests need a test database that can be destroyed.

**Mitigation**: 
- Use the existing E2E test infrastructure
- Mark database reset tests as `@smoke` or separate category
- Document that full E2E of `start:allclean` requires manual testing

## Dependencies

- No external package dependencies required
- Uses existing oclif CLI framework
- Uses existing `executeStartupFullReset` infrastructure

## Verification Checklist

After implementation:

- [ ] `pnpm --filter @universo/core-backend build` passes
- [ ] `pnpm --filter @universo/core-backend lint` passes
- [ ] Unit tests pass: `pnpm test:vitest`
- [ ] Manual test: `pnpm start:allclean` resets database
- [ ] Manual test: `FULL_DATABASE_RESET=false pnpm start:allclean` still resets
- [ ] Manual test: `NODE_ENV=production pnpm start:allclean` is blocked
- [ ] Documentation is updated in both English and Russian
- [ ] README files have identical structure (same line count)

## Rollback Plan

If issues arise:
1. Remove `start:allclean` script from root `package.json`
2. Remove `--reset-db` flag from `start.ts`
3. Revert `startupReset.ts` changes
4. Revert documentation changes

All changes are additive, so rollback is straightforward.

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Core Implementation | 1-2 hours |
| Phase 2: Testing | 1 hour |
| Phase 3: Documentation | 30 minutes |
| Review & Verification | 30 minutes |
| **Total** | **3-4 hours** |

## Summary

This plan implements `pnpm start:allclean` as a safe, convenient way to perform complete platform resets during development. The implementation:

1. **Follows existing patterns** - mirrors the `start:clean` command structure
2. **Maintains security** - production guard is never bypassed
3. **Preserves all safety measures** - advisory lock, schema validation, etc.
4. **Provides clear documentation** - both English and Russian
5. **Includes comprehensive testing** - unit, integration, and manual E2E

The approach is minimal and focused - a single flag parameter that flows through the existing reset infrastructure, with clear documentation for users.
