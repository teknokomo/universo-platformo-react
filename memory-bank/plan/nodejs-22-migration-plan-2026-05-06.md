# Node.js 22 Migration Plan

> Plan for upgrading the project from Node.js 20 to Node.js 22.6.0+ to enable autoskills tool support.

---

## Overview

The goal is to migrate the Universo Platformo project from Node.js 20.19.4 to Node.js 22.6.0 or higher. This migration is required to use the `autoskills` tool (https://github.com/midudev/autoskills) which automatically detects technology stacks and installs AI agent skills.

**Current State:**
- Node.js version: 20.19.4
- Required version: >= 22.6.0
- Key dependency: `isolated-vm` 5.0.4 (native addon, requires `--no-node-snapshot` flag)

**CRITICAL FINDING (QA Analysis):**
- `isolated-vm@5.0.4` requires Node.js `>=18.0.0` (supports Node.js 18-20)
- `isolated-vm@6.x` (latest: 6.1.2) requires Node.js `>=22.0.0` (mandatory for Node.js 22+)
- **Migration to Node.js 22 REQUIRES upgrade to isolated-vm@6.x**

---

## Affected Areas

### 1. Configuration Files
- `package.json` - engines field
- `pnpm-workspace.yaml` - no changes needed
- `.github/workflows/main.yml` - CI/CD Node.js version matrix
- `.nvmrc` - should be created at project root for developer consistency

### 2. Native Dependencies
- `isolated-vm` 5.0.4 → **MUST UPGRADE to 6.x** (6.1.2 recommended)
  - isolated-vm 5.x: Node.js >= 18.0.0 (does NOT support Node.js 22)
  - isolated-vm 6.x: Node.js >= 22.0.0 (REQUIRED for Node.js 22+)
  - This is a **BREAKING CHANGE** that requires testing
- AWS SDK packages - already support Node.js >= 20.0.0

### 3. Runtime Configuration
- Server startup scripts require `--no-node-snapshot` flag (already documented in techContext.md)
- Docker configurations (if any exist in the future)

### 4. Breaking Changes to Address

#### Node.js 22 Breaking Changes:
1. **Import Assertions → Import Attributes**
   - `import ... assert { type: 'json' }` → `import ... with { type: 'json' }`
   - Already verified: no usage in codebase

2. **HTTP Parser Changes**
   - Headers now preserve case
   - Use `req.headers.get()` for case-insensitive access
   - Low risk: Express handles this internally

3. **Promise Handling**
   - Unhandled promise rejections now terminate process with exit code 1
   - Need to verify error handling coverage

4. **ES Module Stricter Enforcement**
   - `require(esm)` is now stable but requires proper configuration
   - Using `module-sync` export condition for dual packages

5. **Deprecated API Removals**
   - `process.binding()` - not used
   - `require('sys')` - not used
   - `process.umask()` without arguments - not used

---

## Plan Steps

### Phase 1: Preparation and Risk Assessment

- [ ] **Step 1.1**: Create comprehensive dependency audit
  ```bash
  # Run dependency audit for Node.js 22 compatibility
  pnpm list --depth=inf 2>/dev/null | grep -E "isolated-vm|sharp|bcrypt|sqlite3|node-sass|better-sqlite3"
  ```
  - Expected: Only `isolated-vm` should appear
  - Risk Level: Low (isolated-vm 5.0.4 supports Node.js 22)

- [ ] **Step 1.2**: Verify isolated-vm compatibility ⚠️ **CRITICAL UPDATE**
  ```bash
  # Check isolated-vm version requirements
  npm view isolated-vm@5.0.4 engines
  # Output: { node: '>=18.0.0' } - Does NOT support Node.js 22!
  
  npm view isolated-vm@latest engines
  # Output: { node: '>=22.0.0' } - REQUIRED for Node.js 22
  ```
  - **IMPORTANT**: isolated-vm 5.0.4 does NOT support Node.js 22
  - Must upgrade to isolated-vm 6.x (6.1.2 recommended)
  - Breaking change between isolated-vm 5.x → 6.x needs verification
  - Risk Level: **HIGH** (requires dependency upgrade + testing)

- [ ] **Step 1.3**: Audit AWS SDK dependencies
  ```bash
  # AWS SDK packages require Node.js >= 20.0.0
  # Already verified in pnpm-lock.yaml
  ```
  - All `@aws-sdk/*` packages support Node.js >= 20.0.0
  - Node.js 22 is fully compatible
  - Risk Level: None

### Phase 2: Local Development Migration

- [ ] **Step 2.1**: Update package.json engines field
  ```json
  {
    "engines": {
      "node": ">=22.6.0",
      "pnpm": ">=9"
    }
  }
  ```
  - This enforces minimum Node.js version
  - Allows any Node.js 22.x or higher

- [ ] **Step 2.2**: Create .nvmrc file at project root
  ```
  22
  ```
  - Ensures consistent Node.js version across developers
  - nvm will automatically use this version

- [ ] **Step 2.3**: Verify server startup scripts
  - Check that `--no-node-snapshot` flag is present in:
    - `packages/universo-core-backend/base/bin/run` (start script)
    - Development scripts
    - Any Docker entrypoints
  - Already documented in `memory-bank/creative/creative-metahub-scripting-extension-system.md`

- [ ] **Step 2.4**: Install Node.js 22 locally
  ```bash
  # Using nvm
  nvm install 22
  nvm use 22
  
  # Verify version
  node --version
  # Expected: v22.x.x
  ```

- [ ] **Step 2.5**: Upgrade isolated-vm to version 6.x ⚠️ **NEW STEP REQUIRED**
  ```bash
  # Update scripting-engine package.json
  # Change: "isolated-vm": "5.0.4" → "isolated-vm": "^6.1.2"
  
  # Or use pnpm
  cd packages/scripting-engine/base
  pnpm add isolated-vm@^6.1.2
  ```
  - isolated-vm 6.x is specifically built for Node.js 22+
  - Check CHANGELOG for breaking changes between 5.x and 6.x
  - Test scripting engine runtime after upgrade

- [ ] **Step 2.6**: Clean install with new Node.js version
  ```bash
  # Remove existing node_modules and lock file artifacts
  pnpm clean:all
  
  # Fresh install
  pnpm install
  ```
  - Native addons like isolated-vm will be recompiled for Node.js 22
  - Monitor for compilation errors

### Phase 3: Build and Test Validation

- [ ] **Step 3.1**: Run full build
  ```bash
  pnpm build
  ```
  - Expected: All packages build successfully
  - Monitor for TypeScript compilation errors
  - Watch for native addon compilation issues

- [ ] **Step 3.2**: Run linting
  ```bash
  pnpm lint
  ```
  - Expected: No new lint errors
  - ESLint should work without changes

- [ ] **Step 3.3**: Run unit tests
  ```bash
  pnpm test:vitest
  ```
  - Expected: All unit tests pass
  - Monitor for test timeout issues

- [ ] **Step 3.4**: Run E2E smoke tests
  ```bash
  pnpm test:e2e:smoke
  ```
  - Expected: All smoke tests pass
  - Critical: Verify isolated-vm runtime works correctly

- [ ] **Step 3.5**: Run Playwright flow tests
  ```bash
  pnpm test:e2e:flows
  ```
  - Expected: All flow tests pass
  - Verifies full application stack

- [ ] **Step 3.6**: Verify scripting engine runtime
  ```bash
  # Run scripting engine benchmark
  cd packages/scripting-engine/base
  pnpm benchmark
  ```
  - Confirms isolated-vm works correctly under Node.js 22
  - Check benchmark results for performance changes

### Phase 4: CI/CD Pipeline Update

- [ ] **Step 4.1**: Update GitHub Actions workflow
  ```yaml
  # .github/workflows/main.yml
  strategy:
    matrix:
      platform: [ubuntu-latest]
      node-version: [22.x]  # Changed from 18.15.0
  ```
  - Single version matrix initially
  - Can expand to multi-version matrix if needed

- [ ] **Step 4.2**: Update pnpm version in CI (if needed)
  ```yaml
  - uses: pnpm/action-setup@v3
    with:
      version: 10.33.2  # Ensure compatible with Node.js 22
  ```

- [ ] **Step 4.3**: Verify CI build passes
  - Push to a test branch
  - Monitor GitHub Actions workflow
  - All checks should pass

### Phase 5: Production Deployment Preparation

- [ ] **Step 5.1**: Update deployment documentation
  - Document Node.js 22 requirement
  - Update Docker base images (if applicable)
  - Update environment setup guides

- [ ] **Step 5.2**: Create deployment checklist
  - [ ] Node.js 22 installed on production servers
  - [ ] `--no-node-snapshot` flag in startup scripts
  - [ ] Native addons recompiled for Node.js 22
  - [ ] Environment variables unchanged
  - [ ] Database migrations compatible

- [ ] **Step 5.3**: Staging environment test
  - Deploy to staging environment
  - Run full E2E test suite
  - Monitor for performance issues
  - Verify memory usage patterns

### Phase 6: Documentation and Knowledge Transfer

- [ ] **Step 6.1**: Update tech.md steering file
  ```markdown
  ## Node.js Version
  - **Required**: >= 22.6.0
  - **LTS**: Node.js 22 "Jod" (supported until April 2027)
  - **Critical**: Use `--no-node-snapshot` flag for isolated-vm compatibility
  ```

- [ ] **Step 6.2**: Update README.md
  - Update prerequisites section
  - Update installation instructions
  - Add Node.js 22 requirement note

- [ ] **Step 6.3**: Update memory-bank/techContext.md
  - Add Node.js 22 specific notes
  - Document any workarounds applied

- [ ] **Step 6.4**: Create migration guide for developers
  - Step-by-step local migration instructions
  - Troubleshooting common issues
  - Rollback procedure

---

## Potential Challenges

### 1. Native Addon Compilation ⚠️ **CRITICAL RISK**
**Risk**: `isolated-vm` 5.0.4 is NOT compatible with Node.js 22
**Mitigation**: 
- **MUST upgrade to isolated-vm 6.x** (specifically built for Node.js 22+)
- Verify isolated-vm 6.x API compatibility with scripting engine code
- Test all scripting engine functionality after upgrade
- Review isolated-vm CHANGELOG for breaking changes
- Fallback: Consider QuickJS-emscripten as alternative (documented in creative plan)

**Breaking Changes in isolated-vm 6.x** (to verify):
- Node.js requirement changed from >=18.0.0 to >=22.0.0
- V8 API changes may affect isolate configuration
- `--no-node-snapshot` flag requirement confirmed

### 2. Memory Usage Changes
**Risk**: Node.js 22 may have different memory characteristics
**Mitigation**:
- Monitor memory usage in staging
- Adjust heap limits if needed
- Profile with `--inspect` flag

### 3. Performance Regression
**Risk**: Some operations may be slower in Node.js 22
**Mitigation**:
- Run benchmark suite before/after migration
- Compare HTTP request throughput
- Compare startup time

### 4. ESM/CJS Interoperability
**Risk**: Mixed module imports may fail
**Mitigation**:
- Use `module-sync` export condition for dual packages
- Ensure consistent module system per package
- Test all import patterns

### 5. Unhandled Promise Rejections
**Risk**: Previously silent rejections now crash the process
**Mitigation**:
- Audit all async code paths
- Add explicit `.catch()` handlers
- Run with `--trace-warnings` during testing

---

## Design Notes

### Node.js 22 Benefits
1. **Performance**: ~35% improvement in HTTP requests/sec vs Node.js 20
2. **Startup**: ~32% faster startup time
3. **Memory**: ~15% lower memory usage
4. **ESM Import**: ~43% faster ESM import time
5. **Security**: Ongoing LTS support until April 2027

### autoskills Tool Benefits
1. **Automatic Tech Stack Detection**: Detects 46+ technologies including React, TypeScript, Supabase, Playwright
2. **Curated AI Skills**: Installs best practices skills for Cursor, Claude Code
3. **Monorepo Support**: Works with pnpm workspaces
4. **Security**: Skills are verified through curated registry

### Compatibility Verification Commands
```bash
# Check Node.js version compatibility
node --version

# Verify isolated-vm loads correctly
node -e "const ivm = require('isolated-vm'); console.log('isolated-vm OK');"

# Test with --no-node-snapshot flag
node --no-node-snapshot -e "const ivm = require('isolated-vm'); console.log('OK with flag');"

# Run autoskills after migration
npx autoskills --dry-run
```

---

## Dependencies

### Internal Dependencies
- None (this is a foundational infrastructure change)

### External Dependencies
- Node.js 22 LTS binaries for all target platforms
- isolated-vm prebuilt binaries or build tools (node-gyp, Python, C++ compiler)

### Team Coordination
- Notify all developers before migration
- Schedule migration during low-activity period
- Ensure rollback plan is documented

---

## Success Criteria

1. **Build Success**: `pnpm build` completes without errors
2. **Test Success**: All unit and E2E tests pass
3. **Runtime Success**: isolated-vm scripts execute correctly
4. **Performance**: No significant performance regression
5. **autoskills Success**: `npx autoskills` runs without Node.js version error

---

## Rollback Procedure

If critical issues are discovered:

1. **Immediate Rollback**:
   ```bash
   # Switch back to Node.js 20
   nvm install 20
   nvm use 20
   
   # Reinstall dependencies
   pnpm clean:all
   pnpm install
   
   # Rebuild
   pnpm build
   ```

2. **Revert Configuration Changes**:
   - Revert `package.json` engines field to `>=18.15.0 <19.0.0 || ^20`
   - Revert `.github/workflows/main.yml` to `node-version: [18.15.0]`
   - Delete `.nvmrc` file

3. **Document Issues**:
   - Record specific errors encountered
   - Note affected packages/features
   - Create GitHub issues for follow-up

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Preparation | 2-3 hours | None |
| Phase 2: Local Migration | 4-6 hours | Phase 1 complete |
| Phase 3: Validation | 3-5 hours | Phase 2 complete |
| Phase 4: CI/CD Update | 1-2 hours | Phase 3 complete |
| Phase 5: Production Prep | 2-4 hours | Phase 4 complete |
| Phase 6: Documentation | 1-2 hours | Phase 5 complete |
| **Total** | **13-22 hours** | |

**Note**: Timeline increased due to isolated-vm upgrade requirement.

---

## References

- [Node.js v20 to v22 Migration Guide](https://nodejs.org/fr/blog/migrations/v20-to-v22)
- [Node.js 22 Breaking Changes](https://markaicode.com/nodejs-20-to-22-migration-and-automated-upgrade/)
- [isolated-vm GitHub](https://github.com/laverdet/isolated-vm)
- [autoskills Documentation](https://github.com/midudev/autoskills)
- [Node.js LTS Schedule](https://endoflife.date/nodejs)
- [Node.js 22 Release Announcement](https://nodejs.org/en/blog/announcements/v22-release-announce)

---

## Checklist Summary

### Pre-Migration
- [ ] Review this plan and approve
- [ ] Create backup branch
- [ ] Notify team members
- [ ] **Review isolated-vm 6.x CHANGELOG for breaking changes**

### Migration
- [ ] Update package.json engines
- [ ] Create .nvmrc file
- [ ] Install Node.js 22
- [ ] **Upgrade isolated-vm to 6.x**
- [ ] Clean install dependencies
- [ ] Run full build
- [ ] Run all tests

### Post-Migration
- [ ] **Test scripting engine thoroughly**
- [ ] Update CI/CD workflow
- [ ] Update documentation
- [ ] Test autoskills tool
- [ ] Deploy to staging
- [ ] Monitor for issues

---

## QA Analysis Results (2026-05-06)

### Critical Findings

1. **isolated-vm Version Mismatch** ⚠️
   - Current version: 5.0.4 (requires Node.js >=18.0.0)
   - Required version: 6.x (requires Node.js >=22.0.0)
   - **Impact**: Migration to Node.js 22 is IMPOSSIBLE without upgrading isolated-vm
   - **Risk Level**: HIGH

2. **API Compatibility Verification Needed**
   - isolated-vm 6.x may have breaking API changes
   - Must test scripting engine after upgrade
   - Must verify isolate pool, sandbox configuration, and RPC calls

### Recommendations

1. **Before starting migration**:
   - Review isolated-vm 6.x CHANGELOG
   - Test isolated-vm 6.x in a separate branch
   - Verify all scripting engine tests pass with 6.x

2. **Migration sequence**:
   - First upgrade isolated-vm to 6.x on Node.js 20
   - Verify everything works
   - Then upgrade Node.js to 22

3. **Rollback plan**:
   - Keep isolated-vm 5.0.4 as fallback
   - Document all changes for quick revert

### Additional Issues Found

1. **GitHub Actions Node.js version outdated**
   - Current: 18.15.0
   - Should be: 20.x or 22.x
   - Recommended: Update to 22.x after migration

2. **Missing .nvmrc file**
   - No .nvmrc at project root
   - Should be created for consistency

### Positive Findings

1. **`--no-node-snapshot` flag already implemented**
   - `packages/universo-core-backend/base/bin/run` already handles this
   - No additional work needed

2. **No import assertions usage**
   - Codebase doesn't use `import ... assert { type: 'json' }`
   - No migration needed for this breaking change

3. **ESM packages are isolated**
   - Only `universo-i18n` and `universo-store` use `"type": "module"`
   - Limited scope for ESM-related issues

4. **Native addon dependencies are minimal**
   - Only `isolated-vm` and `sqlite3` in `onlyBuiltDependencies`
   - `sqlite3` is listed but not actively used (marked for removal)

### Overall Assessment

**Status**: ⚠️ **CRITICAL ISSUE FOUND**

The plan is fundamentally sound, but contains a **critical error**: it assumes isolated-vm 5.0.4 works with Node.js 22, which is incorrect. The migration requires upgrading isolated-vm to version 6.x first.

**Recommendation**: 
- **Do NOT proceed** with Node.js 22 migration until isolated-vm is upgraded to 6.x
- Test isolated-vm 6.x upgrade on current Node.js 20 first
- Only then proceed with Node.js 22 migration

**Updated Risk Level**: HIGH (was: Low)

---

*Created: 2026-05-06*
*Status: Draft - Pending Approval*
