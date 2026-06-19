import type { ResolvedEntityType } from '@universo-react/types'
import {
    extractProjectBindingFromConfig,
    validateProjectBindingConfigForEntity
} from '../../domains/entities/controllers/entityControllerShared'

const baseUi: ResolvedEntityType['ui'] = {
    iconName: 'IconBox',
    tabs: ['general'],
    sidebarSection: 'objects',
    nameKey: 'metahubs:projects.title'
}

const buildType = (projectBindingEnabled: boolean): ResolvedEntityType =>
    ({
        kindKey: 'project',
        capabilities: {
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: false,
            optionValues: false,
            fixedValues: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: false,
            events: false,
            modules: false,
            blockContent: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: { enabled: true, prefix: 'proj' },
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: false,
            projectBinding: projectBindingEnabled ? { enabled: true, provider: 'playcanvasEditor', cardinality: 'single' } : false
        },
        ui: baseUi
    } as ResolvedEntityType)

describe('project binding config validation', () => {
    it('accepts a well-formed binding when the capability is enabled', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: null }
            })
        ).not.toThrow()
    })

    it('allows clearing the binding (unbind) with null', () => {
        expect(() => validateProjectBindingConfigForEntity(buildType(true), { projectBinding: null })).not.toThrow()
    })

    it('rejects a binding when the capability is not enabled', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(false), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world' }
            })
        ).toThrow(/not enabled/)
    })

    it('rejects an unsupported provider', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'unknownEditor', projectCodename: 'mmoomm_world' }
            })
        ).toThrow(/provider/)
    })

    it('rejects a binding without a project codename', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: '   ' }
            })
        ).toThrow(/project codename/)
    })

    it('rejects a non-string projectId', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: 12345 }
            })
        ).toThrow(/projectId must be a non-empty string/)
    })

    it('rejects an empty-string projectId', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: '   ' }
            })
        ).toThrow(/projectId must be a non-empty string/)
    })

    it('accepts an absent or null projectId (optional cached reference)', () => {
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world' }
            })
        ).not.toThrow()
        expect(() =>
            validateProjectBindingConfigForEntity(buildType(true), {
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: null }
            })
        ).not.toThrow()
    })

    it('extracts a normalized binding reference for cascade delete', () => {
        expect(
            extractProjectBindingFromConfig({
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: 'pid' }
            })
        ).toEqual({ provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: 'pid' })

        expect(extractProjectBindingFromConfig({})).toBeNull()
        expect(extractProjectBindingFromConfig(null)).toBeNull()
        expect(extractProjectBindingFromConfig({ projectBinding: { provider: 'playcanvasEditor', projectCodename: '' } })).toBeNull()
    })
})

describe('validateAndResolveProjectBinding (project-store resolution)', () => {
    const { validateAndResolveProjectBinding } =
        require('../../domains/entities/controllers/entityControllerShared') as typeof import('../../domains/entities/controllers/entityControllerShared')

    // `resolveProject` stands in for PlayCanvasProjectsService.resolveBoundProjectByCodename,
    // which resolves against the project-store schema (default branch) — the single
    // source of truth so validation never drifts from the store/cascade.
    const makeResolver = (row: { id: string } | null) => jest.fn(async () => row)

    it('accepts a well-formed binding when the project resolves', async () => {
        const resolveProject = makeResolver({ id: '019e8afa-0000-7000-8000-000000000001' })
        await expect(
            validateAndResolveProjectBinding({
                resolvedType: buildType(true),
                config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: null } },
                resolveProject
            })
        ).resolves.toBeUndefined()
        expect(resolveProject).toHaveBeenCalledTimes(1)
        expect(resolveProject).toHaveBeenCalledWith('mmoomm_world')
    })

    it('rejects a binding when the project does not resolve', async () => {
        const resolveProject = makeResolver(null)
        await expect(
            validateAndResolveProjectBinding({
                resolvedType: buildType(true),
                config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'missing_project', projectId: null } },
                resolveProject
            })
        ).rejects.toThrow(/non-existent or soft-deleted/)
    })

    it('rejects when the cached projectId does not match the resolved row', async () => {
        const resolveProject = makeResolver({ id: '019e8afa-0000-7000-8000-000000000099' })
        await expect(
            validateAndResolveProjectBinding({
                resolvedType: buildType(true),
                config: {
                    projectBinding: {
                        provider: 'playcanvasEditor',
                        projectCodename: 'mmoomm_world',
                        projectId: '019e8afa-0000-7000-8000-000000000001'
                    }
                },
                resolveProject
            })
        ).rejects.toThrow(/projectId does not match/)
    })

    it('does not resolve the project when the binding is absent or being cleared', async () => {
        const resolveProject = makeResolver(null)
        await expect(
            validateAndResolveProjectBinding({ resolvedType: buildType(true), config: {}, resolveProject })
        ).resolves.toBeUndefined()
        await expect(
            validateAndResolveProjectBinding({ resolvedType: buildType(true), config: { projectBinding: null }, resolveProject })
        ).resolves.toBeUndefined()
        expect(resolveProject).not.toHaveBeenCalled()
    })

    it('rejects a malformed payload before resolving the project (shape validation runs first)', async () => {
        const resolveProject = makeResolver(null)
        await expect(
            validateAndResolveProjectBinding({
                resolvedType: buildType(true),
                config: { projectBinding: { provider: 'unknownProvider', projectCodename: 'x' } },
                resolveProject
            })
        ).rejects.toThrow(/Unsupported project binding provider/)
        expect(resolveProject).not.toHaveBeenCalled()
    })
})
