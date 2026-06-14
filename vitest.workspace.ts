import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
    'packages/universo-react-auth-frontend/vitest.config.ts',
    'packages/universo-react-admin-frontend/vitest.config.ts',
    'packages/universo-react-applications-frontend/vitest.config.ts',
    'packages/universo-react-apps-template-mui/vitest.config.ts',
    'packages/universo-react-block-editor/vitest.config.ts',
    'packages/universo-react-core-frontend/vitest.config.ts',
    'packages/universo-react-metapanel-frontend/vitest.config.ts',
    'packages/universo-react-metahubs-frontend/vitest.config.ts',
    'packages/universo-react-profile-frontend/vitest.config.ts',
    'packages/universo-react-modules-engine/vitest.config.ts',
    'packages/universo-react-playcanvas-editor-frontend/vitest.config.ts',
    'packages/universo-react-start-frontend/vitest.config.ts',
    'packages/universo-react-types/vitest.config.ts',
    'packages/universo-react-utils/vitest.config.ts',
    'tools/local-supabase/vitest.config.mjs'
])
