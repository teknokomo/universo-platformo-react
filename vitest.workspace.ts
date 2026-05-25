import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
    'packages/auth-frontend/vitest.config.ts',
    'packages/admin-frontend/vitest.config.ts',
    'packages/applications-frontend/vitest.config.ts',
    'packages/apps-template-mui/vitest.config.ts',
    'packages/universo-block-editor/vitest.config.ts',
    'packages/metapanel-frontend/vitest.config.ts',
    'packages/metahubs-frontend/vitest.config.ts',
    'packages/profile-frontend/vitest.config.ts',
    'packages/modules-engine/vitest.config.ts',
    'packages/start-frontend/vitest.config.ts',
    'packages/universo-types/vitest.config.ts',
    'packages/universo-utils/vitest.config.ts',
    'tools/local-supabase/vitest.config.mjs'
])
