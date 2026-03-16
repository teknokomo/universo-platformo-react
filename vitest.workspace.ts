import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
    'packages/applications-frontend/base/vitest.config.ts',
    'packages/apps-template-mui/vitest.config.ts',
    'packages/metahubs-frontend/base/vitest.config.ts',
    'packages/profile-frontend/base/vitest.config.ts',
    'packages/start-frontend/base/vitest.config.ts',
    'packages/universo-types/base/vitest.config.ts',
    'packages/universo-utils/base/vitest.config.ts'
])
