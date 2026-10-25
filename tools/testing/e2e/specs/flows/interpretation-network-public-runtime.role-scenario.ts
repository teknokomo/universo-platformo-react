import { createLocalizedContent } from '@universo-react/utils'
import {
    createApplicationWorkspace,
    listApplicationWorkspaces,
    sendWithCsrf,
    setApplicationPublicEntryWorkspace
} from '../../support/backend/api-session.mjs'
import type { ApiContext } from '../../support/interpretationNetworkRuntime'
import {
    createMaterialForCell,
    ensureSystemStructure,
    findMatrixRowByTitle,
    getMatrixRows,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    setPrimaryMaterialForCell,
    uuidV7Pattern
} from '../../support/interpretationNetworkFocused'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import { recordCreatedApplication, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import type { E2ERunManifest } from '../../fixtures/test'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { PUBLIC_MULTILINE_CELL_DESCRIPTION, type PublicRuntimeScenario } from './interpretation-network-public-runtime.helpers'

type BootstrapApi = Awaited<ReturnType<typeof import('../../support/backend/bootstrap.mjs').createBootstrapApiContext>>

export const preparePublicRoleScenario = async (
    api: ApiContext,
    bootstrapApi: BootstrapApi,
    runManifest: E2ERunManifest
): Promise<PublicRuntimeScenario> => {
    const imported = await importInterpretationNetworkSnapshot(api, {
        snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
        label: `public-roles-${runManifest.runId}`,
        isPublic: true
    })
    await recordCreatedMetahub({
        id: imported.metahub.id,
        name: 'Interpretation Network public roles',
        codename: `interpretation-network-public-roles-${runManifest.runId}`
    })
    await recordCreatedApplication({ id: imported.applicationId })

    await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })

    const listedWorkspaces = (await listApplicationWorkspaces(api, imported.applicationId)) as {
        items?: Array<{
            id?: string
            workspaceType?: string
            type?: string
            personalUserId?: string | null
            name?: { locales?: Record<string, { content?: string }> }
        }>
    }
    const existingSharedWorkspace = listedWorkspaces.items?.find(
        (workspace) =>
            (workspace.workspaceType === 'shared' || workspace.type === 'shared') &&
            workspace.personalUserId == null &&
            typeof workspace.id === 'string'
    )
    const createdWorkspace = existingSharedWorkspace
        ? undefined
        : ((await createApplicationWorkspace(api, imported.applicationId, {
              name: createLocalizedContent('en', 'Interpretation Network public roles'),
              description: createLocalizedContent('en', 'Workspace for the public access and role acceptance journey')
          })) as { id?: string })
    const workspaceId = existingSharedWorkspace?.id ?? createdWorkspace?.id
    if (typeof workspaceId !== 'string') {
        throw new Error('The public role scenario could not prepare a shared Workspace')
    }

    await setApplicationPublicEntryWorkspace(api, imported.applicationId, workspaceId)
    const system = await ensureSystemStructure(api, imported.applicationId, workspaceId)
    const runtimeIds = await resolveRuntimeIds(api, imported.applicationId, workspaceId)
    const matrixRows = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
    const rootCell = findMatrixRowByTitle(matrixRows, 'Universe')
    if (rootCell.cellId !== system.rootCellId) {
        throw new Error('The public role scenario resolved a different root CellId than the system aggregate')
    }
    if (!uuidV7Pattern.test(rootCell.rowId)) {
        throw new Error('The public role scenario could not validate the root Matrix aggregate row ID')
    }
    const rootAggregate = matrixRows.find((row) => row.id === rootCell.rowId)
    if (!rootAggregate) {
        throw new Error('The public role scenario could not resolve the root aggregate by its validated row ID')
    }
    const rootCellVersion = Number(rootAggregate._upl_version ?? 0)
    if (!Number.isSafeInteger(rootCellVersion) || rootCellVersion <= 0) {
        throw new Error('The public role scenario could not resolve the version of the system root aggregate')
    }

    const runtimeQuery = new URLSearchParams({
        workspaceId,
        targetKind: 'object',
        entityTypeId: runtimeIds.entityTypeId,
        layoutId: runtimeIds.layoutId,
        widgetId: runtimeIds.widgetId,
        instanceKey: runtimeIds.instanceKey,
        locale: 'en',
        themeVariant: 'light'
    })
    const descriptionResponse = await sendWithCsrf(
        api,
        'PATCH',
        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells/${rootCell.cellId}?${runtimeQuery}`,
        {
            interpretationId: system.interpretationId,
            data: { CellDescription: createLocalizedContent('en', PUBLIC_MULTILINE_CELL_DESCRIPTION) },
            expectedCellVersion: rootCellVersion
        }
    )
    if (!descriptionResponse.ok) {
        throw new Error(
            `Setting the public role Matrix description failed with ${descriptionResponse.status}: ${await descriptionResponse.text()}`
        )
    }
    const describedMatrixRows = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
    const describedRootCell = findMatrixRowByTitle(describedMatrixRows, 'Universe')
    if (
        describedRootCell.cellId !== rootCell.cellId ||
        describedRootCell.rowId !== rootCell.rowId ||
        !uuidV7Pattern.test(describedRootCell.rowId)
    ) {
        throw new Error('The public role scenario could not validate the updated root aggregate identity')
    }
    const describedRootAggregate = describedMatrixRows.find((row) => row.id === describedRootCell.rowId)
    if (!describedRootAggregate) {
        throw new Error('The public role scenario could not resolve the updated root aggregate by its row ID')
    }
    const describedRootCellVersion = Number(describedRootAggregate._upl_version ?? 0)
    if (!Number.isSafeInteger(describedRootCellVersion) || describedRootCellVersion <= 0) {
        throw new Error('The public role scenario could not resolve the updated root aggregate version')
    }

    const primaryMaterial = await createMaterialForCell(api, imported.applicationId, runtimeIds, {
        interpretationId: system.interpretationId,
        cellId: rootCell.cellId,
        title: 'Public primary material',
        description: 'This material opens first in the anonymous read-only view.'
    })
    await setPrimaryMaterialForCell(api, imported.applicationId, runtimeIds, {
        interpretationId: system.interpretationId,
        cellId: rootCell.cellId,
        materialId: primaryMaterial.id,
        expectedCellVersion: describedRootCellVersion
    })

    const aliasToken = runManifest.runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(-30)
    const aliasSuffix = aliasToken || 'playwright'
    const alias = `network-roles-${aliasSuffix}`
    const secondaryAlias = `network-roles-alt-${aliasSuffix}`
    for (const [applicationAlias, makePrimary] of [
        [alias, true],
        [secondaryAlias, false]
    ] as const) {
        const response = await sendWithCsrf(bootstrapApi, 'POST', '/api/v1/application-aliases', {
            applicationId: imported.applicationId,
            alias: applicationAlias,
            makePrimary
        })
        if (!response.ok) {
            throw new Error(`Creating public role alias failed with ${response.status}: ${await response.text()}`)
        }
    }

    return {
        applicationId: imported.applicationId,
        publicEntryWorkspaceId: workspaceId,
        alias,
        secondaryAlias
    }
}
