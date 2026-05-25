import { useQuery } from '@tanstack/react-query'
import {
    hasModuleCapability,
    isClientModuleMethodTarget,
    type ApplicationModuleDefinition,
    type ModuleAttachmentKind
} from '@universo-react/types'
import { fetchWithCsrf } from '../../api/api'

export { isClientModuleMethodTarget }

export const filterRuntimeWidgetModules = (modules: ApplicationModuleDefinition[]): ApplicationModuleDefinition[] =>
    modules.filter(
        (module, index, array) =>
            module.moduleRole === 'widget' &&
            module.manifest.methods.some((method) => isClientModuleMethodTarget(method.target)) &&
            array.findIndex((candidate) => candidate.id === module.id) === index
    )

export const selectRuntimeWidgetModule = (
    modules: ApplicationModuleDefinition[],
    moduleCodename?: string | null
): ApplicationModuleDefinition | null => {
    if (moduleCodename) {
        return modules.find((module) => module.codename === moduleCodename) ?? null
    }

    return modules[0] ?? null
}

export const fetchRuntimeModules = async (params: {
    apiBaseUrl: string
    applicationId: string
    attachedToKind: 'metahub' | 'object'
    attachedToId?: string | null
}): Promise<ApplicationModuleDefinition[]> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const url = new URL(`${baseUrl}/applications/${params.applicationId}/runtime/modules`, window.location.origin)
    url.searchParams.set('attachedToKind', params.attachedToKind)
    if (params.attachedToId) {
        url.searchParams.set('attachedToId', params.attachedToId)
    }

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        throw new Error(`Failed to load runtime modules (${response.status})`)
    }

    const payload = (await response.json()) as { items?: ApplicationModuleDefinition[] }
    return Array.isArray(payload.items) ? payload.items : []
}

export const callRuntimeModuleMethod = async (params: {
    apiBaseUrl: string
    applicationId: string
    moduleId: string
    methodName: string
    args: unknown[]
}): Promise<unknown> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const response = await fetchWithCsrf(
        params.apiBaseUrl,
        `${baseUrl}/applications/${params.applicationId}/runtime/modules/${params.moduleId}/call`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ methodName: params.methodName, args: params.args })
        }
    )

    const payload = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string }
    if (!response.ok) {
        throw new Error(payload.error || `Runtime module call failed (${response.status})`)
    }

    return payload.result
}

export const fetchRuntimeClientBundle = async (params: {
    apiBaseUrl: string
    applicationId: string
    moduleId: string
}): Promise<string> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/applications/${params.applicationId}/runtime/modules/${params.moduleId}/client`, {
        credentials: 'include'
    })

    if (!response.ok) {
        throw new Error(`Failed to load runtime module bundle (${response.status})`)
    }

    return await response.text()
}

export const useRuntimeWidgetClientModule = (params: {
    queryKeyPrefix: string
    apiBaseUrl: string
    applicationId?: string
    objectCollectionId?: string | null
    moduleCodename?: string | null
    attachedToKind?: ModuleAttachmentKind
}) => {
    const modulesQuery = useQuery({
        queryKey: [
            params.queryKeyPrefix,
            'modules',
            params.applicationId,
            params.objectCollectionId,
            params.moduleCodename,
            params.attachedToKind
        ],
        enabled: Boolean(params.applicationId),
        queryFn: async () => {
            const shouldQueryObject = params.attachedToKind !== 'metahub' && Boolean(params.objectCollectionId)
            const shouldQueryMetahub = params.attachedToKind !== 'object'

            const [objectModules, metahubModules] = await Promise.all([
                shouldQueryObject
                    ? fetchRuntimeModules({
                          apiBaseUrl: params.apiBaseUrl,
                          applicationId: params.applicationId!,
                          attachedToKind: 'object',
                          attachedToId: params.objectCollectionId
                      })
                    : Promise.resolve([]),
                shouldQueryMetahub
                    ? fetchRuntimeModules({
                          apiBaseUrl: params.apiBaseUrl,
                          applicationId: params.applicationId!,
                          attachedToKind: 'metahub'
                      })
                    : Promise.resolve([])
            ])

            const items = filterRuntimeWidgetModules([...objectModules, ...metahubModules])
            const selected = selectRuntimeWidgetModule(items, params.moduleCodename)

            return { items, selected }
        }
    })

    const selectedModule = modulesQuery.data?.selected ?? null

    const clientBundleQuery = useQuery({
        queryKey: [params.queryKeyPrefix, 'bundle', params.applicationId, selectedModule?.id],
        enabled: Boolean(params.applicationId && selectedModule),
        queryFn: async () => {
            if (!params.applicationId || !selectedModule) {
                return null
            }

            return await fetchRuntimeClientBundle({
                apiBaseUrl: params.apiBaseUrl,
                applicationId: params.applicationId,
                moduleId: selectedModule.id
            })
        }
    })

    return {
        modulesQuery,
        selectedModule,
        clientBundleQuery,
        clientBundle: clientBundleQuery.data ?? null
    }
}

export const createClientModuleContext = (params: {
    apiBaseUrl: string
    applicationId: string
    module: ApplicationModuleDefinition
}): Record<string, unknown> => {
    const denyCapability = async (capability: string): Promise<never> => {
        throw new Error(`Module capability "${capability}" is not enabled for this module`)
    }

    return {
        applicationId: params.applicationId,
        moduleId: params.module.id,
        moduleCodename: params.module.codename,
        records: {
            list: async () => denyCapability('records.read'),
            get: async () => denyCapability('records.read'),
            findByCodename: async () => denyCapability('records.read'),
            create: async () => denyCapability('records.write'),
            update: async () => denyCapability('records.write'),
            delete: async () => denyCapability('records.write')
        },
        ledger: {
            list: async () => denyCapability('ledger.read'),
            facts: async () => denyCapability('ledger.read'),
            query: async () => denyCapability('ledger.read'),
            append: async () => denyCapability('ledger.write'),
            reverse: async () => denyCapability('ledger.write')
        },
        metadata: {
            getAttachedEntity: hasModuleCapability(params.module.manifest, 'metadata.read')
                ? async () => ({
                      kind: params.module.attachedToKind,
                      id: params.module.attachedToId ?? null
                  })
                : async () => denyCapability('metadata.read'),
            getByCodename: hasModuleCapability(params.module.manifest, 'metadata.read')
                ? async () => null
                : async () => denyCapability('metadata.read')
        },
        callServerMethod: hasModuleCapability(params.module.manifest, 'rpc.client')
            ? async (methodName: string, args: unknown[]) =>
                  callRuntimeModuleMethod({
                      apiBaseUrl: params.apiBaseUrl,
                      applicationId: params.applicationId,
                      moduleId: params.module.id,
                      methodName,
                      args
                  })
            : async () => denyCapability('rpc.client')
    }
}
