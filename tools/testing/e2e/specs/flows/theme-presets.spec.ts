import { expect, test } from '../../fixtures/test'
import {
    createApplicationLayout,
    createApplicationWorkspace,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    createThemePreset,
    deleteThemePreset,
    disposeApiContext,
    exportThemePreset,
    getApplicationLayout,
    getLayout,
    getMarketingPageRuntime,
    getThemePreset,
    listApplicationLayouts,
    listApplicationWorkspaces,
    listLayouts,
    listPublicationApplications,
    listThemePresets,
    resetLayoutAppearance,
    setApplicationPublicEntryWorkspace,
    getApplication,
    syncApplicationSchema,
    syncPublication,
    updateLayoutAppearance,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { createLocalizedContent } from '@universo-react/utils'

const THEME_PRESET_TOKENS = {
    shared: {
        typography: { fontFamily: 'inter', baseSize: 16, scale: 1.2, weights: { regular: 400, medium: 500, bold: 700 } },
        spacing: { base: 8, density: 'comfortable' },
        shape: { borderRadius: 8, borderWidth: 1 },
        shadows: { scale: 'default' }
    },
    modes: {
        light: {
            primary: { main: '#027af2', contrastText: '#e5f2ff' },
            secondary: { main: '#9c27b0', contrastText: '#ffffff' },
            background: { default: '#fcfcfc', paper: '#f5f6fa' },
            text: { primary: '#0b0e14', secondary: '#47536b' },
            divider: '#e5e8ec'
        },
        dark: {
            primary: { main: '#027af2', contrastText: '#e5f2ff' },
            secondary: { main: '#9c27b0', contrastText: '#ffffff' },
            background: { default: '#05070a', paper: '#0c1017' },
            text: { primary: '#ffffff', secondary: '#94a0b8' },
            divider: '#202632'
        }
    }
} as const

type ThemePresetScope = { kind: 'metahub' | 'application'; id: string }
type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const metahubScope = (metahubId: string): ThemePresetScope => ({ kind: 'metahub', id: metahubId })
const applicationScope = (applicationId: string): ThemePresetScope => ({ kind: 'application', id: applicationId })

async function createThemeSpecMetahub(
    api: ApiContext,
    runManifest: { runId: string },
    label: string,
    options: { templateCodename?: string } = {}
) {
    const metahubName = `E2E ${runManifest.runId} ${label}`
    const metahubCodename = `${runManifest.runId}-${label}`
    const metahub = await createMetahub(api, {
        name: { en: metahubName },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', metahubCodename),
        ...(options.templateCodename ? { templateCodename: options.templateCodename } : {})
    })
    expect(metahub?.id).toBeTruthy()
    await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })
    return metahub
}

async function waitForMetahubLayoutId(api: ApiContext, metahubId: string): Promise<string> {
    let layoutId: string | undefined
    await expect
        .poll(async () => {
            const response = (await listLayouts(api, metahubId, { limit: 20, offset: 0 })) as { items?: Array<{ id?: string }> }
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)
    if (!layoutId) {
        throw new Error(`Metahub ${metahubId} did not expose any layouts`)
    }
    return layoutId
}

async function waitForApplicationLayoutId(api: ApiContext, applicationId: string): Promise<string> {
    let layoutId: string | undefined
    await expect
        .poll(async () => {
            const response = (await listApplicationLayouts(api, applicationId, { limit: 20, offset: 0 })) as {
                items?: Array<{ id?: string }>
            }
            layoutId = response.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)
    if (!layoutId) {
        throw new Error(`Application ${applicationId} did not expose any managed layouts`)
    }
    return layoutId
}

test('@flow theme presets: metahub preset library, layout appearance, export, and FR-048 guard', async ({ runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const applicationName = `E2E ${runManifest.runId} theme presets app`
    try {
        const metahub = await createThemeSpecMetahub(api, runManifest, 'theme-presets-metahub')
        const metahubId = metahub.id
        const scope = metahubScope(metahubId)

        // 1. The scope lists the universo-default file preset and an empty DB library.
        const library = await listThemePresets(api, scope)
        expect(library.file.some((preset: { id: string }) => preset.id === 'universo-default')).toBe(true)
        expect(library.presets).toHaveLength(0)

        // 2. Create a DB preset from the universo-default tokens.
        const createResponse = await createThemePreset(api, scope, {
            codename: `${runManifest.runId}-flow-preset`.toLowerCase().slice(0, 64),
            name: { en: 'E2E Flow Preset' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(createResponse.ok).toBeTruthy()
        const created = await createResponse.json()
        expect(created.version).toBe(1)

        // 3. FR-048: a codename reserved by a file preset is rejected.
        const imposterResponse = await createThemePreset(api, scope, {
            codename: 'universo-default',
            name: { en: 'Imposter' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(imposterResponse.status).toBe(400)

        // 4. Create an application-scoped preset and apply it with optimistic concurrency.
        const publication = await createPublication(api, metahubId, {
            name: { en: `${applicationName} publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        expect(publication?.id).toBeTruthy()
        await recordCreatedPublication({ id: publication.id, metahubId, schemaName: publication.schemaName })
        await createPublicationVersion(api, metahubId, publication.id, {
            name: { en: `${applicationName} v1` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahubId, publication.id)
        await waitForPublicationReady(api, metahubId, publication.id)

        const linked = await createPublicationLinkedApplication(api, metahubId, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId)

        const appScope = applicationScope(applicationId)
        const appPresetResponse = await createThemePreset(api, appScope, {
            codename: `${runManifest.runId}-app-preset`.toLowerCase().slice(0, 64),
            name: { en: 'E2E App Preset' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(appPresetResponse.ok).toBeTruthy()
        const appPreset = await appPresetResponse.json()
        const fetchedPreset = await getThemePreset(api, appScope, appPreset.id)
        expect(fetchedPreset.id).toBe(appPreset.id)
        await createApplicationLayout(api, applicationId, {
            templateKey: 'dashboard',
            name: { en: 'Appearance flow layout' },
            isActive: true
        })

        const layoutId = await waitForApplicationLayoutId(api, applicationId)

        const layoutPayload = (await getApplicationLayout(api, applicationId, layoutId)) as { item?: { version?: number } }
        const layoutVersion = layoutPayload.item?.version ?? 1

        const applyResponse = await updateLayoutAppearance(api, appScope, layoutId, {
            appearance: { mode: 'dark', preset: { source: 'application', id: appPreset.id, version: appPreset.version }, overrides: {} },
            expectedVersion: layoutVersion
        })
        expect(applyResponse.ok).toBeTruthy()
        const applied = await applyResponse.json()
        expect(applied.appearance.preset.id).toBe(appPreset.id)
        expect(applied.appearance.resolved.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(applied.appearance.resolved.tokens.modes.dark.background.default).toBe('#05070a')

        // 5. Stale expectedVersion → 409.
        const staleResponse = await resetLayoutAppearance(api, appScope, layoutId, { expectedVersion: layoutVersion })
        expect(staleResponse.status).toBe(409)

        // 6. Export the DB preset as a theme file attachment.
        const exportResponse = await exportThemePreset(api, appScope, appPreset.id)
        expect(exportResponse.ok).toBeTruthy()
        expect(exportResponse.headers.get('content-disposition')).toContain('.theme.json')
        const envelope = await exportResponse.json()
        expect(envelope.schemaVersion).toBe(1)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow theme presets: FR-048 imposter codename is rejected with the reserved-file-codename body', async ({ runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createThemeSpecMetahub(api, runManifest, 'theme-preset-fr048')
        const scope = metahubScope(metahub.id)

        const imposterResponse = await createThemePreset(api, scope, {
            codename: 'universo-default',
            name: { en: 'Imposter' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(imposterResponse.status).toBe(400)
        const body = await imposterResponse.json()
        // Actual metahubs guard shape: 400 VALIDATION_ERROR with the FR-048
        // details spread at the top level (not nested under `details`), and
        // never the THEME_PRESET_INVALID code.
        expect(body.code).toBe('VALIDATION_ERROR')
        expect(body.reason).toBe('codename-reserved-by-file-preset')
        expect(body.codename).toBe('universo-default')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow theme presets: layout appearance reset drops the snapshot and bumps the version', async ({ runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const metahub = await createThemeSpecMetahub(api, runManifest, 'theme-preset-reset')
        const scope = metahubScope(metahub.id)
        const layoutId = await waitForMetahubLayoutId(api, metahub.id)

        const createResponse = await createThemePreset(api, scope, {
            codename: `${runManifest.runId}-reset-preset`.toLowerCase().slice(0, 64),
            name: { en: 'E2E Reset Preset' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(createResponse.ok).toBeTruthy()
        const preset = await createResponse.json()

        const layoutBefore = (await getLayout(api, metahub.id, layoutId)) as { version?: number; config?: Record<string, unknown> }
        const versionBefore = layoutBefore.version ?? 1

        const applyResponse = await updateLayoutAppearance(api, scope, layoutId, {
            appearance: { mode: 'dark', preset: { source: 'metahub', id: preset.id, version: preset.version }, overrides: {} },
            expectedVersion: versionBefore
        })
        expect(applyResponse.ok).toBeTruthy()
        const applied = await applyResponse.json()
        expect(applied.appearance.preset.id).toBe(preset.id)
        expect(applied.appearance.resolved.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(applied.version).toBe(versionBefore + 1)
        const appliedHash = applied.appearance.resolved.hash as string

        const resetResponse = await resetLayoutAppearance(api, scope, layoutId, { expectedVersion: applied.version })
        expect(resetResponse.ok).toBeTruthy()
        const reset = await resetResponse.json()
        expect(reset.layoutId).toBe(layoutId)
        expect(reset.version).toBe(versionBefore + 2)
        expect(reset.appearance).toBeNull()

        const layoutAfter = (await getLayout(api, metahub.id, layoutId)) as { version?: number; config?: Record<string, unknown> }
        expect(layoutAfter.version).toBe(versionBefore + 2)
        expect(layoutAfter.config?.appearance).toBeUndefined()
        // Sanity: the reset actually dropped the applied snapshot hash.
        expect(JSON.stringify(layoutAfter.config ?? {})).not.toContain(appliedHash)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow theme presets: in-use preset delete returns the usage list and deletes after reset', async ({ runManifest }) => {
    test.setTimeout(240_000)
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const applicationName = `E2E ${runManifest.runId} theme delete-in-use app`
    try {
        const metahub = await createThemeSpecMetahub(api, runManifest, 'theme-preset-delete-in-use')
        const metahubId = metahub.id

        const publication = await createPublication(api, metahubId, {
            name: { en: `${applicationName} publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        expect(publication?.id).toBeTruthy()
        await recordCreatedPublication({ id: publication.id, metahubId, schemaName: publication.schemaName })
        await createPublicationVersion(api, metahubId, publication.id, {
            name: { en: `${applicationName} v1` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahubId, publication.id)
        await waitForPublicationReady(api, metahubId, publication.id)

        const linked = await createPublicationLinkedApplication(api, metahubId, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId)

        const appScope = applicationScope(applicationId)
        const createResponse = await createThemePreset(api, appScope, {
            codename: `${runManifest.runId}-delete-preset`.toLowerCase().slice(0, 64),
            name: { en: 'E2E Delete Preset' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(createResponse.ok).toBeTruthy()
        const preset = await createResponse.json()

        await createApplicationLayout(api, applicationId, {
            templateKey: 'dashboard',
            name: { en: 'Delete-in-use layout' },
            isActive: true
        })
        const layoutId = await waitForApplicationLayoutId(api, applicationId)

        const layoutPayload = (await getApplicationLayout(api, applicationId, layoutId)) as { item?: { version?: number } }
        const layoutVersion = layoutPayload.item?.version ?? 1

        const applyResponse = await updateLayoutAppearance(api, appScope, layoutId, {
            appearance: { mode: 'dark', preset: { source: 'application', id: preset.id, version: preset.version }, overrides: {} },
            expectedVersion: layoutVersion
        })
        expect(applyResponse.ok).toBeTruthy()

        // First DELETE archives the still-referenced preset (route contract:
        // non-archived presets are archived, hard delete happens on a second call).
        const archiveResponse = await deleteThemePreset(api, appScope, preset.id, { expectedVersion: preset.version })
        expect(archiveResponse.ok).toBeTruthy()
        const archived = await archiveResponse.json()
        expect(archived.archived).toBe(true)

        // Second DELETE hits the in-use guard with the usage list in the body.
        const inUseResponse = await deleteThemePreset(api, appScope, preset.id, { expectedVersion: archived.version })
        expect(inUseResponse.status).toBe(409)
        const inUseBody = await inUseResponse.json()
        expect(inUseBody.code).toBe('THEME_PRESET_IN_USE')
        expect(inUseBody.details.presetId).toBe(preset.id)
        expect(inUseBody.details.usageCount).toBeGreaterThanOrEqual(1)
        expect(inUseBody.details.usageLayoutIds).toContain(layoutId)

        // Reset the layout, then the hard delete succeeds.
        const layoutAfterApply = (await getApplicationLayout(api, applicationId, layoutId)) as { item?: { version?: number } }
        const resetResponse = await resetLayoutAppearance(api, appScope, layoutId, {
            expectedVersion: layoutAfterApply.item?.version ?? layoutVersion + 1
        })
        expect(resetResponse.ok).toBeTruthy()

        const deleteResponse = await deleteThemePreset(api, appScope, preset.id, { expectedVersion: archived.version })
        expect(deleteResponse.ok).toBeTruthy()
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow theme presets: public marketing runtime carries resolved appearance without authoring state', async ({ runManifest }) => {
    test.setTimeout(300_000)
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const applicationName = `E2E ${runManifest.runId} theme public runtime app`
    try {
        const metahub = await createThemeSpecMetahub(api, runManifest, 'theme-preset-public-runtime', {
            templateCodename: 'marketing-page'
        })
        const metahubId = metahub.id
        const scope = metahubScope(metahubId)
        const layoutId = await waitForMetahubLayoutId(api, metahubId)

        const createResponse = await createThemePreset(api, scope, {
            codename: `${runManifest.runId}-public-preset`.toLowerCase().slice(0, 64),
            name: { en: 'E2E Public Preset' },
            tokens: THEME_PRESET_TOKENS
        })
        expect(createResponse.ok).toBeTruthy()
        const preset = await createResponse.json()

        const layoutBefore = (await getLayout(api, metahubId, layoutId)) as { version?: number }
        const applyResponse = await updateLayoutAppearance(api, scope, layoutId, {
            appearance: { mode: 'dark', preset: { source: 'metahub', id: preset.id, version: preset.version }, overrides: {} },
            expectedVersion: layoutBefore.version ?? 1
        })
        expect(applyResponse.ok).toBeTruthy()
        const applied = await applyResponse.json()
        const appliedHash = applied.appearance.resolved.hash as string
        expect(appliedHash).toMatch(/^sha256:[0-9a-f]{64}$/)

        // A workspace-enabled public application needs the publication to
        // auto-create it (public) and an explicit server-owned public-entry
        // workspace — the anonymous resolver never infers one.
        const publication = await createPublication(api, metahubId, {
            name: { en: `${applicationName} publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: applicationName },
            applicationNamePrimaryLocale: 'en',
            applicationIsPublic: true,
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        expect(publication?.id).toBeTruthy()
        await recordCreatedPublication({ id: publication.id, metahubId, schemaName: publication.schemaName })
        // runtimePolicy on the publication seeds its version 1 — creating an
        // explicit second version without the policy would be a downgrade 409.
        await syncPublication(api, metahubId, publication.id)
        await waitForPublicationReady(api, metahubId, publication.id)

        let applicationId: string | undefined
        await expect
            .poll(async () => {
                const linked = await listPublicationApplications(api, metahubId, publication.id)
                applicationId = (linked?.items ?? [])[0]?.id
                return typeof applicationId === 'string'
            })
            .toBe(true)
        if (typeof applicationId !== 'string') throw new Error('Publication did not link an application')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')

        // Public readiness for a workspace-enabled application requires one
        // explicit server-owned public-entry workspace.
        const workspaceList = await listApplicationWorkspaces(api, applicationId)
        const sharedWorkspace = (workspaceList?.items ?? []).find(
            (workspace: Record<string, unknown>) => workspace?.workspaceType !== 'personal' && !workspace?.personalUserId
        )
        const publicEntryWorkspaceId =
            (sharedWorkspace as { id?: string } | undefined)?.id ??
            (
                await createApplicationWorkspace(api, applicationId, {
                    name: createLocalizedContent('en', 'Public entry workspace'),
                    description: createLocalizedContent('en', 'Workspace used for anonymous public rendering')
                })
            )?.id
        if (typeof publicEntryWorkspaceId !== 'string') {
            throw new Error('Theme public-runtime spec could not prepare a public entry workspace')
        }
        await setApplicationPublicEntryWorkspace(api, applicationId, publicEntryWorkspaceId)

        // The application runtime route runs the same anonymous serializer
        // (toPublicConfig) over the synced effective layout; the full
        // anonymous materialization is covered by marketing-page-runtime.spec.
        const payload = (await getMarketingPageRuntime(api, applicationId, 'en')) as {
            templateKey?: string
            marketingPage?: { config?: { appearance?: { mode?: string; resolved?: { hash?: string; tokens?: Record<string, unknown> } } } }
        }
        expect(payload.templateKey).toBe('marketing-page')

        const appearance = payload?.marketingPage?.config?.appearance
        expect(appearance).toBeTruthy()
        expect(appearance.mode).toBe('dark')
        expect(appearance.resolved.hash).toBe(appliedHash)
        expect(appearance.resolved.tokens.modes.dark.background.default).toBe('#05070a')

        // Runtime boundary carries { mode, resolved } only — no preset
        // reference, no overrides, no internal preset ids anywhere.
        const serialized = JSON.stringify(payload)
        expect(serialized).not.toContain(preset.id)
        expect(serialized).not.toContain(preset.codename)
        expect(serialized).not.toContain('"overrides"')
        expect(appearance.preset).toBeUndefined()
    } finally {
        await disposeApiContext(api)
    }
})
