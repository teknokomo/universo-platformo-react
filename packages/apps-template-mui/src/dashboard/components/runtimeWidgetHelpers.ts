import { useQuery } from '@tanstack/react-query'
import {
    hasScriptCapability,
    isClientScriptMethodTarget,
    type ApplicationScriptDefinition,
    type ScriptAttachmentKind
} from '@universo/types'
import { fetchWithCsrf } from '../../api/api'

export { isClientScriptMethodTarget }

export const filterRuntimeWidgetScripts = (scripts: ApplicationScriptDefinition[]): ApplicationScriptDefinition[] =>
    scripts.filter(
        (script, index, array) =>
            script.moduleRole === 'widget' &&
            script.manifest.methods.some((method) => isClientScriptMethodTarget(method.target)) &&
            array.findIndex((candidate) => candidate.id === script.id) === index
    )

export const selectRuntimeWidgetScript = (
    scripts: ApplicationScriptDefinition[],
    scriptCodename?: string | null
): ApplicationScriptDefinition | null => {
    if (scriptCodename) {
        return scripts.find((script) => script.codename === scriptCodename) ?? null
    }

    return scripts[0] ?? null
}

export const fetchRuntimeScripts = async (params: {
    apiBaseUrl: string
    applicationId: string
    attachedToKind: 'metahub' | 'catalog'
    attachedToId?: string | null
}): Promise<ApplicationScriptDefinition[]> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const url = new URL(`${baseUrl}/applications/${params.applicationId}/runtime/scripts`, window.location.origin)
    url.searchParams.set('attachedToKind', params.attachedToKind)
    if (params.attachedToId) {
        url.searchParams.set('attachedToId', params.attachedToId)
    }

    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
        throw new Error(`Failed to load runtime scripts (${response.status})`)
    }

    const payload = (await response.json()) as { items?: ApplicationScriptDefinition[] }
    return Array.isArray(payload.items) ? payload.items : []
}

export const callRuntimeScriptMethod = async (params: {
    apiBaseUrl: string
    applicationId: string
    scriptId: string
    methodName: string
    args: unknown[]
}): Promise<unknown> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const response = await fetchWithCsrf(
        params.apiBaseUrl,
        `${baseUrl}/applications/${params.applicationId}/runtime/scripts/${params.scriptId}/call`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ methodName: params.methodName, args: params.args })
        }
    )

    const payload = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string }
    if (!response.ok) {
        throw new Error(payload.error || `Runtime script call failed (${response.status})`)
    }

    return payload.result
}

export const fetchRuntimeClientBundle = async (params: {
    apiBaseUrl: string
    applicationId: string
    scriptId: string
}): Promise<string> => {
    const baseUrl = params.apiBaseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/applications/${params.applicationId}/runtime/scripts/${params.scriptId}/client`, {
        credentials: 'include'
    })

    if (!response.ok) {
        throw new Error(`Failed to load runtime script bundle (${response.status})`)
    }

    return await response.text()
}

export const useRuntimeWidgetClientScript = (params: {
    queryKeyPrefix: string
    apiBaseUrl: string
    applicationId?: string
    linkedCollectionId?: string | null
    scriptCodename?: string | null
    attachedToKind?: ScriptAttachmentKind
}) => {
    const scriptsQuery = useQuery({
        queryKey: [
            params.queryKeyPrefix,
            'scripts',
            params.applicationId,
            params.linkedCollectionId,
            params.scriptCodename,
            params.attachedToKind
        ],
        enabled: Boolean(params.applicationId),
        queryFn: async () => {
            const shouldQueryCatalog = params.attachedToKind !== 'metahub' && Boolean(params.linkedCollectionId)
            const shouldQueryMetahub = params.attachedToKind !== 'catalog'

            const [catalogScripts, metahubScripts] = await Promise.all([
                shouldQueryCatalog
                    ? fetchRuntimeScripts({
                          apiBaseUrl: params.apiBaseUrl,
                          applicationId: params.applicationId!,
                          attachedToKind: 'catalog',
                          attachedToId: params.linkedCollectionId
                      })
                    : Promise.resolve([]),
                shouldQueryMetahub
                    ? fetchRuntimeScripts({
                          apiBaseUrl: params.apiBaseUrl,
                          applicationId: params.applicationId!,
                          attachedToKind: 'metahub'
                      })
                    : Promise.resolve([])
            ])

            const items = filterRuntimeWidgetScripts([...catalogScripts, ...metahubScripts])
            const selected = selectRuntimeWidgetScript(items, params.scriptCodename)

            return { items, selected }
        }
    })

    const selectedScript = scriptsQuery.data?.selected ?? null

    const clientBundleQuery = useQuery({
        queryKey: [params.queryKeyPrefix, 'bundle', params.applicationId, selectedScript?.id],
        enabled: Boolean(params.applicationId && selectedScript),
        queryFn: async () => {
            if (!params.applicationId || !selectedScript) {
                return null
            }

            return await fetchRuntimeClientBundle({
                apiBaseUrl: params.apiBaseUrl,
                applicationId: params.applicationId,
                scriptId: selectedScript.id
            })
        }
    })

    return {
        scriptsQuery,
        selectedScript,
        clientBundleQuery,
        clientBundle: clientBundleQuery.data ?? null
    }
}

export const createClientScriptContext = (params: {
    apiBaseUrl: string
    applicationId: string
    script: ApplicationScriptDefinition
}): Record<string, unknown> => {
    const denyCapability = async (capability: string): Promise<never> => {
        throw new Error(`Script capability "${capability}" is not enabled for this module`)
    }

    return {
        applicationId: params.applicationId,
        scriptId: params.script.id,
        scriptCodename: params.script.codename,
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
            getAttachedEntity: hasScriptCapability(params.script.manifest, 'metadata.read')
                ? async () => ({
                      kind: params.script.attachedToKind,
                      id: params.script.attachedToId ?? null
                  })
                : async () => denyCapability('metadata.read'),
            getByCodename: hasScriptCapability(params.script.manifest, 'metadata.read')
                ? async () => null
                : async () => denyCapability('metadata.read')
        },
        callServerMethod: hasScriptCapability(params.script.manifest, 'rpc.client')
            ? async (methodName: string, args: unknown[]) =>
                  callRuntimeScriptMethod({
                      apiBaseUrl: params.apiBaseUrl,
                      applicationId: params.applicationId,
                      scriptId: params.script.id,
                      methodName,
                      args
                  })
            : async () => denyCapability('rpc.client')
    }
}
