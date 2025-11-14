/**
 * Setup file that runs BEFORE any test files are imported.
 * Use this to mock modules that need to be mocked before entity definitions are loaded.
 */

// Set test environment
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}

// This file intentionally left minimal - complex setup should go in setupAfterEnv.ts
