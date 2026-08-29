import { Script, type AppBase } from '@universo-react/playcanvas-engine'
import { isPortablePlayCanvasScriptDataUrl, type PlayCanvasRuntimeScriptManifest } from '@universo-react/types'

/**
 * Main-thread loader for published PlayCanvas script assets. Artifacts travel as
 * `text/javascript` data URLs; each artifact is hash-verified (lowercase hex
 * sha-256) before it is re-blobbed and imported, then every exported script class
 * registers into the application-scoped script registry so entities can attach it
 * by name. The worker module sandbox is intentionally not involved: script assets
 * need the live `pc` application, DOM canvas and document import map.
 */

export type ManifestScriptLoadFailureCode =
    | 'scriptFetchFailed'
    | 'scriptHashMismatch'
    | 'scriptNameInvalid'
    | 'scriptDuplicateName'
    | 'scriptRegistrationFailed'
    | 'scriptEntityMissing'
    | 'scriptComponentMissing'
    | 'scriptCreateFailed'

export class ManifestScriptAssetError extends Error {
    readonly code: ManifestScriptLoadFailureCode
    readonly scriptName: string

    constructor(code: ManifestScriptLoadFailureCode, scriptName: string) {
        super(`Manifest script asset "${scriptName}" failed: ${code}`)
        this.name = 'ManifestScriptAssetError'
        this.code = code
        this.scriptName = scriptName
    }
}

type ScriptClassCandidate = typeof Script & { scriptName: string; attributes?: unknown }

export const isPlayCanvasScriptClass = (value: unknown): value is ScriptClassCandidate => {
    if (typeof value !== 'function') {
        return false
    }
    const candidate = value as ScriptClassCandidate
    return (
        typeof candidate.scriptName === 'string' &&
        candidate.scriptName.trim().length > 0 &&
        typeof candidate.prototype === 'object' &&
        candidate.prototype instanceof Script
    )
}

const validateManifestScriptNames = (scripts: readonly PlayCanvasRuntimeScriptManifest[]): Set<string> => {
    const names = new Set<string>()
    for (const script of scripts) {
        const name = typeof script.scriptName === 'string' ? script.scriptName.trim() : ''
        if (!name || name !== script.scriptName) {
            throw new ManifestScriptAssetError('scriptNameInvalid', String(script.scriptName ?? ''))
        }
        if (names.has(name)) {
            throw new ManifestScriptAssetError('scriptDuplicateName', name)
        }
        names.add(name)
    }
    return names
}

const PLAYCANVAS_MODULE_FALLBACK_URL = '/vendor/playcanvas/playcanvas.mjs'

/**
 * Import maps are applied to module scripts, but browser implementations do
 * not consistently apply them to a `blob:` module's dependency graph. The
 * published artifact is hash-verified before this rewrite; resolving the
 * external engine specifier afterwards keeps the integrity check over the
 * stored bytes while making the browser import deterministic.
 */
export const rewritePlayCanvasModuleSpecifier = (source: string): string => {
    if (typeof document === 'undefined' || !source.includes('playcanvas')) {
        return source
    }

    let mappedUrl: string | null = null
    const importMapElement = document.querySelector('script[type="importmap"]')
    if (importMapElement?.textContent) {
        try {
            const importMap = JSON.parse(importMapElement.textContent) as { imports?: Record<string, unknown> }
            const mappedSpecifier = importMap.imports?.playcanvas
            if (typeof mappedSpecifier === 'string' && mappedSpecifier.trim()) {
                mappedUrl = new URL(mappedSpecifier, document.baseURI).href
            }
        } catch {
            // Fall back to the stable core-frontend public asset below.
        }
    }

    const resolvedUrl = mappedUrl ?? new URL(PLAYCANVAS_MODULE_FALLBACK_URL, document.baseURI).href
    return source.replace(
        /(\b(?:from|import)\s*(?:\(\s*)?)(["'])playcanvas\2/g,
        (_match, prefix: string) => `${prefix}${JSON.stringify(resolvedUrl)}`
    )
}

export const computeScriptArtifactDigest = async (bytes: ArrayBuffer): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

export const loadManifestScripts = async (app: AppBase, scripts: readonly PlayCanvasRuntimeScriptManifest[]): Promise<string[]> => {
    validateManifestScriptNames(scripts)
    const registerScriptClass = app.scripts.add.bind(app.scripts)
    const addScriptSchema = (
        app.scripts as typeof app.scripts & {
            addSchema?: (name: string, schema: { attributes: Record<string, unknown> }) => void
        }
    ).addSchema?.bind(app.scripts)
    const registeredScriptNames = new Set<string>()
    for (const script of scripts) {
        if (!script.artifactUrl || !isPortablePlayCanvasScriptDataUrl(script.artifactUrl)) {
            throw new ManifestScriptAssetError('scriptFetchFailed', script.scriptName)
        }
        let bytes: ArrayBuffer
        try {
            const response = await fetch(script.artifactUrl, { cache: 'no-store' })
            if (!response.ok) {
                throw new Error(`Script artifact request failed with ${response.status}`)
            }
            bytes = await response.arrayBuffer()
        } catch {
            throw new ManifestScriptAssetError('scriptFetchFailed', script.scriptName)
        }
        const digest = await computeScriptArtifactDigest(bytes)
        if (digest !== script.artifactHash?.toLowerCase()) {
            throw new ManifestScriptAssetError('scriptHashMismatch', script.scriptName)
        }
        const source = new TextDecoder().decode(bytes)
        let blobUrl: string
        try {
            blobUrl = URL.createObjectURL(new Blob([rewritePlayCanvasModuleSpecifier(source)], { type: 'text/javascript' }))
        } catch {
            throw new ManifestScriptAssetError('scriptRegistrationFailed', script.scriptName)
        }
        try {
            let module: Record<string, unknown>
            try {
                module = (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>
            } catch {
                throw new ManifestScriptAssetError('scriptRegistrationFailed', script.scriptName)
            }
            const scriptClasses = Object.values(module).filter(isPlayCanvasScriptClass)
            const moduleScriptNames = new Set<string>()
            for (const scriptClass of scriptClasses) {
                const scriptName = scriptClass.scriptName.trim()
                if (moduleScriptNames.has(scriptName) || registeredScriptNames.has(scriptName)) {
                    throw new ManifestScriptAssetError('scriptDuplicateName', scriptName)
                }
                moduleScriptNames.add(scriptName)
            }
            // Publication validates one exported Script subclass per artifact.
            // Enforce the same exact-set contract in the browser so a stale or
            // hand-crafted artifact cannot smuggle an additional Script class
            // into the application-scoped registry.
            if (scriptClasses.length !== 1 || !moduleScriptNames.has(script.scriptName)) {
                throw new ManifestScriptAssetError('scriptRegistrationFailed', script.scriptName)
            }
            for (const exported of scriptClasses) {
                try {
                    const scriptName = exported.scriptName.trim()
                    // ESM assets extend the public `Script` base class directly,
                    // while the editor's classic pipeline wraps classes in
                    // `ScriptType`. Registering the static attribute declaration
                    // as a schema keeps ScriptComponent.create compatible with
                    // both forms when authored attribute values are present.
                    if (
                        Object.prototype.hasOwnProperty.call(exported, 'attributes') &&
                        exported.attributes !== null &&
                        typeof exported.attributes === 'object' &&
                        !Array.isArray(exported.attributes)
                    ) {
                        addScriptSchema?.(scriptName, { attributes: exported.attributes as Record<string, unknown> })
                    }
                    if (registerScriptClass(exported) === false) {
                        throw new Error('PlayCanvas rejected script registration')
                    }
                    registeredScriptNames.add(scriptName)
                } catch {
                    throw new ManifestScriptAssetError('scriptRegistrationFailed', script.scriptName)
                }
            }
        } finally {
            URL.revokeObjectURL(blobUrl)
        }
    }
    return Array.from(registeredScriptNames)
}

export const attachManifestScripts = (
    entities: Map<string, { script?: unknown; addComponent: (type: string) => unknown }>,
    scripts: readonly PlayCanvasRuntimeScriptManifest[]
): void => {
    validateManifestScriptNames(scripts)
    for (const script of scripts) {
        const stableId = script.sceneEntityStableId?.trim()
        const entity = stableId ? entities.get(stableId) : undefined
        if (!entity) {
            throw new ManifestScriptAssetError('scriptEntityMissing', script.scriptName)
        }
        type ScriptComponentHost = {
            create: (name: string, options?: { attributes?: Record<string, unknown> }) => unknown
        }
        let addedComponent: unknown = null
        if (!entity.script) {
            try {
                addedComponent = entity.addComponent('script')
            } catch {
                throw new ManifestScriptAssetError('scriptComponentMissing', script.scriptName)
            }
        }
        const scriptComponent = (entity.script ?? addedComponent) as ScriptComponentHost | undefined
        if (!scriptComponent || typeof scriptComponent.create !== 'function') {
            throw new ManifestScriptAssetError('scriptComponentMissing', script.scriptName)
        }
        try {
            const instance = scriptComponent.create(script.scriptName, { attributes: script.attributeValues ?? {} })
            if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) {
                throw new ManifestScriptAssetError('scriptCreateFailed', script.scriptName)
            }
        } catch (error) {
            if (error instanceof ManifestScriptAssetError) {
                throw error
            }
            throw new ManifestScriptAssetError('scriptCreateFailed', script.scriptName)
        }
    }
}
