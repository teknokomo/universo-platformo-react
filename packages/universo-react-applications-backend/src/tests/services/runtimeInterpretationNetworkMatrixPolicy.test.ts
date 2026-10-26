const mockLockPolicy = jest.fn()
const mockResolveRuntimeSurface = jest.fn()
const operationOrder: string[] = []

jest.mock('../../persistence/workspaceSettingsStore', () => ({
    ...jest.requireActual('../../persistence/workspaceSettingsStore'),
    lockInterpretationNetworkCellStylePolicy: (...args: unknown[]) => {
        operationOrder.push('lock-policy')
        return mockLockPolicy(...args)
    }
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => {
        operationOrder.push('resolve-surface')
        return mockResolveRuntimeSurface(...args)
    }
}))

import {
    resolveMatrixMutationSurface,
    type InterpretationNetworkMatrixMutationContext
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixPolicy'
import type { RuntimeSurfaceReady } from '../../shared/interpretationNetworkRuntimeContracts'

const policy = {
    allowedColors: ['#112233'],
    allowCustomColors: false,
    editable: { fillColor: true, textColor: false, borderColor: false, borderWidth: false, borderStyle: false }
}

const runtimeSurface = (cellStylePolicy = policy): RuntimeSurfaceReady => ({
    applicationId: 'application-1',
    schemaName: 'app_018f8a787b8f7c1da111222233334440',
    workspaceId: '018f8a78-7b8f-7c1d-a111-222233334410',
    featureState: 'ready',
    missing: [],
    layoutId: 'layout-1',
    widgetId: 'widget-1',
    widgetKey: 'interpretationNetworkWorkspace',
    structureMode: 'multiple',
    resolvedObjects: { Structure: 'structure-1', Interpretation: 'interpretation-1', Material: 'material-1', TableTemplate: 'template-1' },
    contracts: {
        Structure: { object: { id: 'structure-1', codename: 'Structure', table_name: 'structure' }, fields: {}, childFields: {} },
        Interpretation: {
            object: { id: 'interpretation-1', codename: 'Interpretation', table_name: 'interpretation' },
            fields: {},
            childFields: {}
        },
        Material: { object: { id: 'material-1', codename: 'Material', table_name: 'material' }, fields: {}, childFields: {} },
        TableTemplate: { object: { id: 'template-1', codename: 'TableTemplate', table_name: 'template' }, fields: {}, childFields: {} }
    },
    widgetConfig: { cellStylePolicy }
})

const mutationContext: InterpretationNetworkMatrixMutationContext = {
    applicationId: 'application-1',
    schemaName: 'app_018f8a787b8f7c1da111222233334440',
    workspaceId: '018f8a78-7b8f-7c1d-a111-222233334410',
    layoutId: 'layout-1',
    widgetId: 'widget-1',
    workspaceSettings: {
        applicationSettings: {},
        authContext: { applicationId: 'application-1', userId: 'user-1', role: 'owner' },
        runtimeTarget: {
            applicationId: 'application-1',
            targetKind: null,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334410',
            locale: 'en'
        },
        instanceKey: 'matrix-main'
    }
}

describe('resolveMatrixMutationSurface', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        operationOrder.length = 0
        mockLockPolicy.mockResolvedValue(undefined)
    })

    it('locks the workspace style policy before re-reading the active placement inside the mutation transaction', async () => {
        const expected = runtimeSurface()
        const refreshed = runtimeSurface({ ...policy, editable: { ...policy.editable, fillColor: false } })
        const tx = { query: jest.fn() }
        mockResolveRuntimeSurface.mockResolvedValue(refreshed)

        const result = await resolveMatrixMutationSurface(tx as never, mutationContext, expected)

        expect(result).toBe(refreshed)
        expect(operationOrder).toEqual(['lock-policy', 'resolve-surface'])
        expect(mockLockPolicy).toHaveBeenCalledWith(tx, mutationContext.schemaName, mutationContext.workspaceId)
        expect(mockResolveRuntimeSurface).toHaveBeenCalledWith(tx, { ...mutationContext, lockRuntimePlacement: true })
    })

    it('does not acquire a workspace lock when only the Application widget policy applies', async () => {
        const context = { ...mutationContext, workspaceId: null, workspaceSettings: undefined }
        const expected = runtimeSurface()
        mockResolveRuntimeSurface.mockResolvedValue(expected)

        await resolveMatrixMutationSurface({ query: jest.fn() } as never, context, expected)

        expect(mockLockPolicy).not.toHaveBeenCalled()
        expect(mockResolveRuntimeSurface).toHaveBeenCalledWith(expect.anything(), { ...context, lockRuntimePlacement: true })
    })

    it('rejects a changed placement or object mapping instead of applying data from the stale surface', async () => {
        mockResolveRuntimeSurface.mockResolvedValue(runtimeSurface({ ...policy, editable: { ...policy.editable, fillColor: false } }))
        const staleSurface = runtimeSurface()
        const changedPlacement = { ...staleSurface, widgetId: 'widget-replaced' } as never

        await expect(resolveMatrixMutationSurface({ query: jest.fn() } as never, mutationContext, changedPlacement)).rejects.toMatchObject({
            statusCode: 409
        })
    })
})
