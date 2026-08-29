import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { z } from 'zod'

export const upstreamRepository = 'https://github.com/playcanvas/editor'
export const upstreamTag = 'v2.30.4'
export const upstreamCommit = 'cf296bcb669bdcb168778bf2979160a9fe8f67de'
export const upstreamPackageVersion = '2.30.4'
export const nodeRequirement = '>=22.22.0'
export const artifactOutputRoot = 'dist/editor'
export const fullUpstreamUiMode = 'universo-full-upstream-ui'
export const artifactModes = ['artifact-only', 'universo-hosted', fullUpstreamUiMode]
export const defaultArtifactMode = fullUpstreamUiMode
export const manifestFileName = 'universo-artifact-manifest.json'
export const bridgeBootstrapFileName = 'universo-bridge-bootstrap.js'

const generatedSchemaCatalogPath = fileURLToPath(
    new URL('../../../universo-react-playcanvas-editor-backend/src/config/generated-schema-catalog.json', import.meta.url)
)
export const hostedSchemaCatalog = Object.freeze(JSON.parse(fs.readFileSync(generatedSchemaCatalogPath, 'utf8')))
const hostedSchemaCatalogJson = JSON.stringify(hostedSchemaCatalog)

const hostedEditorUrlSchema = z
    .object({
        api: z.string().min(1),
        home: z.string().min(1),
        frontend: z.string().url(),
        engine: z.string().url(),
        static: z.string().min(1),
        images: z.string().min(1),
        messenger: z.object({ ws: z.string().min(1) }).strict(),
        realtime: z.object({ http: z.string().min(1) }).strict(),
        relay: z.object({ ws: z.string().min(1) }).strict()
    })
    .strict()

export const hostedEditorConfigSchema = z
    .object({
        project: z
            .object({
                id: z.string().min(1),
                name: z.string().min(1),
                private: z.literal(true),
                permissions: z
                    .object({
                        read: z.array(z.string().min(1)).min(1),
                        write: z.array(z.string().min(1)).min(1),
                        admin: z.array(z.string().min(1)).max(0)
                    })
                    .strict(),
                settings: z.object({ engineV2: z.boolean() }).passthrough(),
                playUrl: z.string().min(1)
            })
            .strict(),
        scene: z.object({ id: z.string().min(1), uniqueId: z.string().min(1) }).strict(),
        self: z
            .object({
                id: z.string().min(1),
                username: z.string().min(1),
                branch: z.object({ id: z.string().min(1), name: z.string().min(1), merge: z.null() }).strict(),
                flags: z
                    .object({
                        openedEditor: z.literal(true),
                        superUser: z.literal(false),
                        tips: z.object({ howdoi: z.boolean() }).strict()
                    })
                    .strict()
            })
            .strict(),
        owner: z.object({ id: z.string().min(1), username: z.string().min(1), size: z.number().int().min(0) }).strict(),
        branch: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
        url: hostedEditorUrlSchema,
        aws: z.object({ s3Prefix: z.string() }).strict(),
        schema: z
            .object({
                version: z.literal(1),
                documents: z
                    .object({ asset: z.record(z.unknown()), scene: z.record(z.unknown()), settings: z.record(z.unknown()) })
                    .strict(),
                assetData: z.record(z.unknown())
            })
            .strict(),
        engineVersions: z.record(z.unknown()),
        sentry: z.object({ enabled: z.literal(false) }).strict(),
        accessToken: z.string().max(0),
        selfHosted: z.literal(true),
        universoHosted: z.literal(true),
        universoBridge: z.unknown().nullable()
    })
    .strict()

const getLocalizedName = (value, fallback) => {
    if (!value || typeof value !== 'object') return fallback
    const primary = typeof value._primary === 'string' ? value._primary : null
    const primaryContent = primary && value.locales?.[primary]?.content
    if (typeof primaryContent === 'string' && primaryContent.trim()) return primaryContent.trim()
    const first = Object.values(value.locales || {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : fallback
}

export const createHostedEditorConfig = (descriptor, artifactBaseUrl = 'http://127.0.0.1/editor/') => {
    const selectedProject = descriptor?.selectedProject || null
    const project = selectedProject?.project || null
    const projectId = typeof project?.id === 'string' && project.id ? project.id : 'universo-artifact-project'
    const sceneId =
        typeof selectedProject?.defaultSceneId === 'string' && selectedProject.defaultSceneId
            ? selectedProject.defaultSceneId
            : 'universo-artifact-scene'
    const projectName = getLocalizedName(project?.displayName, 'Universo Project')
    const base = new URL(artifactBaseUrl)

    const config = {
        project: {
            id: projectId,
            name: projectName,
            private: true,
            permissions: { read: [projectId], write: [projectId], admin: [] },
            settings: { engineV2: true },
            playUrl: '/'
        },
        scene: { id: sceneId, uniqueId: sceneId },
        self: {
            id: 'universo-editor-user',
            username: 'universo',
            branch: { id: 'universo-local-branch', name: 'Main', merge: null },
            flags: { openedEditor: true, superUser: false, tips: { howdoi: true } }
        },
        owner: { id: 'universo-owner', username: 'universo', size: 0 },
        branch: { id: 'universo-local-branch', name: 'Main' },
        url: {
            api: '/',
            home: '/',
            frontend: base.href,
            engine: new URL('js/playcanvas-engine.js', base).href,
            static: base.href.replace(/\/$/, ''),
            images: '/',
            messenger: { ws: 'ws://127.0.0.1/disabled' },
            realtime: { http: 'http://127.0.0.1/disabled' },
            relay: { ws: 'ws://127.0.0.1/disabled' }
        },
        aws: { s3Prefix: '' },
        schema: structuredClone(hostedSchemaCatalog),
        engineVersions: {},
        sentry: { enabled: false },
        accessToken: '',
        selfHosted: true,
        universoHosted: true,
        universoBridge: descriptor || null
    }

    return hostedEditorConfigSchema.parse(config)
}

const currentFile = fileURLToPath(import.meta.url)
export const packageRoot = path.resolve(path.dirname(currentFile), '..', '..')
export const repositoryRoot = path.resolve(packageRoot, '..', '..')
export const rootLockfilePath = path.join(repositoryRoot, 'pnpm-lock.yaml')
export const vendorRoot = path.join(packageRoot, 'vendor')
export const vendorSourceRoot = path.join(vendorRoot, 'playcanvas-editor')
export const upstreamManifestPath = path.join(vendorRoot, 'package.playcanvas-editor.json')
export const upstreamLicensePath = path.join(vendorRoot, 'LICENSE.playcanvas-editor')
export const noticePath = path.join(packageRoot, 'NOTICE.md')
export const artifactRoot = path.join(packageRoot, artifactOutputRoot)
export const artifactManifestPath = path.join(artifactRoot, manifestFileName)

const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export const inlineAjaxLoaderImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#8fa6ad" stroke-width="3" opacity=".3"/><path fill="none" stroke="#d7e3e7" stroke-linecap="round" stroke-width="3" d="M16 3a13 13 0 0 1 13 13"><animateTransform attributeName="transform" dur="0.8s" from="0 16 16" repeatCount="indefinite" to="360 16 16" type="rotate"/></path></svg>'
)
export const inlineBlankProjectImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260"><rect width="420" height="260" rx="12" fill="#222b2f"/><rect x="44" y="42" width="332" height="176" rx="8" fill="#2d393e" stroke="#4e626a"/><path d="M126 162h168M126 130h168M126 98h168" stroke="#7f969e" stroke-width="10" stroke-linecap="round"/><text x="210" y="235" fill="#d8e2e5" font-family="Arial, sans-serif" font-size="22" text-anchor="middle">New project</text></svg>'
)
export const inlinePlayCanvasTextImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="252" height="52" viewBox="0 0 252 52"><rect width="252" height="52" fill="none"/><text x="126" y="34" fill="#fff" font-family="Arial, sans-serif" font-size="30" font-weight="700" text-anchor="middle">PlayCanvas</text></svg>'
)
export const inlineRemoveIconImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#4f5f66"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-linecap="round" stroke-width="2"/></svg>'
)
export const inlineEditorLogoImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="18" viewBox="0 0 36 18"><rect width="36" height="18" fill="none"/><circle cx="9" cy="9" r="7" fill="#fff" opacity=".82"/><path d="M6 6h7l-4 7H5l3-4H6z" fill="#283238"/><circle cx="27" cy="9" r="7" fill="#e56f32"/><path d="M24 6h7l-4 7h-4l3-4h-2z" fill="#fff"/></svg>'
)
export const inlineHelpInstructionImage = svgDataUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" rx="10" fill="#20282c"/><rect x="36" y="34" width="408" height="202" rx="8" fill="#2c383d" stroke="#536870"/><path d="M96 101h288M96 135h224M96 169h264" stroke="#7f969e" stroke-width="12" stroke-linecap="round"/><text x="240" y="246" fill="#d8e2e5" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">PlayCanvas help media unavailable offline</text></svg>'
)
export const inlineEntityIconImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARwMHggJ/PchI7wAAAABJRU5ErkJggg=='

export const hostedArtifactImageReplacements = [
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/images\/play_text_252_white\.png/g, inlinePlayCanvasTextImage],
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/images\/editor_logo\.png/g, inlineEditorLogoImage],
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/images\/icons\/fa\/16x16\/remove\.png/g, inlineRemoveIconImage],
    [
        /(?:https:)?\/\/playcanvas\.com\/static-assets\/images\/(?:bcg_primary|help-controls|store-default-thumbnail(?:-480x320)?)\.(?:jpg|png)/g,
        inlineHelpInstructionImage
    ],
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/platform\/images\/loader(?:_transparent)?\.gif/g, inlineAjaxLoaderImage],
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/platform\/images\/logo\/playcanvas-logo-360\.jpg/g, inlinePlayCanvasTextImage],
    [/(?:\.\.\/)*static\/platform\/images\/ajax-loader\.gif/g, inlineAjaxLoaderImage],
    [/(?:\.\.\/)*static\/platform\/images\/loader_transparent\.gif/g, inlineAjaxLoaderImage],
    [/(?:\.\.\/)*static\/platform\/images\/home\/blank_project\.png/g, inlineBlankProjectImage],
    [/(?:https:)?\/\/playcanvas\.com\/static-assets\/instructions\/[^"'\\ )<]+/g, inlineHelpInstructionImage],
    [/`\$\{[^}]+\.url\.static\}\/platform\/images\/common\/ajax-loader\.gif`/g, `'${inlineAjaxLoaderImage}'`],
    [/`url\("\$\{[^}]+\.url\.static\}\/platform\/images\/common\/ajax-loader\.gif"\)`/g, `'url("${inlineAjaxLoaderImage}")'`],
    [/`\$\{[^}]+\.url\.static\}\/platform\/images\/common\/blank_project\.png`/g, `'${inlineBlankProjectImage}'`],
    [/`\/editor\/scene\/img\/entity-icons\/\$\{[^}]+\}\.png`/g, `'${inlineEntityIconImage}'`],
    [/`\/api\/users\/\$\{[^}]+\}\/thumbnail\?size=\$\{[^}]+\}`/g, `'${inlineEntityIconImage}'`],
    [/`\/api\/users\/\$\{[^}]+\}\/thumbnail\?size=[^`]+`/g, `'${inlineEntityIconImage}'`],
    [/`url\(\/api\/users\/\$\{[^}]+\}\/thumbnail\?size=[^`]+`/g, `'url(${inlineEntityIconImage})'`],
    [/`\$\{[^}]+\.url\.api\}\/users\/\$\{[^}]+\}\/thumbnail\?size=\$\{[^}]+\}`/g, `'${inlineEntityIconImage}'`],
    [/`\$\{[^}]+\.url\.api\}\/users\/\$\{[^}]+\}\/thumbnail\?size=[^`]+`/g, `'${inlineEntityIconImage}'`],
    [/`url\(\$\{[^}]+\.url\.api\}\/users\/\$\{[^}]+\}\/thumbnail\?size=[^`]+`/g, `'url(${inlineEntityIconImage})'`]
]

const patchableArtifactExtensions = new Set(['.html', '.js', '.css', '.json', '.map'])
const jsonPatchableArtifactExtensions = new Set(['.json', '.map'])

const replaceHostedArtifactImageReferences = (value) => {
    if (typeof value === 'string') {
        let updated = value
        for (const [pattern, replacement] of hostedArtifactImageReplacements) {
            updated = updated.replace(pattern, replacement)
        }
        return updated
    }
    if (Array.isArray(value)) {
        let changed = false
        const updated = value.map((entry) => {
            const next = replaceHostedArtifactImageReferences(entry)
            changed ||= next !== entry
            return next
        })
        return changed ? updated : value
    }
    if (value && typeof value === 'object') {
        let changed = false
        const updated = {}
        for (const [key, entry] of Object.entries(value)) {
            const next = replaceHostedArtifactImageReferences(entry)
            changed ||= next !== entry
            updated[key] = next
        }
        return changed ? updated : value
    }
    return value
}

const patchArtifactSource = (source, extension) => {
    if (jsonPatchableArtifactExtensions.has(extension)) {
        const parsed = JSON.parse(source)
        const updated = replaceHostedArtifactImageReferences(parsed)
        return updated === parsed ? source : `${JSON.stringify(updated, null, 2)}\n`
    }

    const withoutRemoteFonts =
        extension === '.css' ? source.replace(/@font-face\{[^{}]*playcanvas\.com\/static-assets\/fonts[^{}]*\}/g, '') : source
    return replaceHostedArtifactImageReferences(withoutRemoteFonts)
}

export const patchUniversoHostedArtifact = (targetRoot = artifactRoot) => {
    const patchedFiles = []
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const absolute = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(absolute)
                continue
            }
            const extension = path.extname(entry.name)
            if (!patchableArtifactExtensions.has(extension)) continue
            const source = fs.readFileSync(absolute, 'utf8')
            const updated = patchArtifactSource(source, extension)
            if (updated === source) continue
            fs.writeFileSync(absolute, updated)
            patchedFiles.push(path.relative(targetRoot, absolute))
        }
    }

    walk(targetRoot)
    return patchedFiles
}

export const resolveArtifactMode = (value = process.env.UNIVERSO_PLAYCANVAS_EDITOR_ARTIFACT_MODE) => {
    const mode = value?.trim() || defaultArtifactMode
    if (!artifactModes.includes(mode)) {
        throw new Error(`Unsupported PlayCanvas Editor artifact mode: ${mode}`)
    }
    return mode
}

export const createArtifactManifest = (builtAt = new Date().toISOString(), mode = resolveArtifactMode()) => ({
    upstreamRepository,
    upstreamTag,
    upstreamCommit,
    upstreamPackageVersion,
    nodeRequirement,
    outputRoot: artifactOutputRoot,
    mode,
    smokeMode: mode,
    baseStrategy: './',
    bridgeBootstrap: mode === 'universo-hosted' || mode === fullUpstreamUiMode ? bridgeBootstrapFileName : null,
    builtAt
})

export const assertNodeVersion = (version = process.versions.node) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(version)
    if (!match) {
        throw new Error(`Unsupported Node.js version string: ${version}`)
    }

    const [, majorRaw, minorRaw, patchRaw] = match
    const major = Number(majorRaw)
    const minor = Number(minorRaw)
    const patch = Number(patchRaw)
    const ok = major > 22 || (major === 22 && (minor > 22 || (minor === 22 && patch >= 0)))

    if (!ok) {
        throw new Error(`PlayCanvas Editor ${upstreamPackageVersion} requires Node.js ${nodeRequirement}; current version is ${version}`)
    }
}

export const assertVendorMetadata = () => {
    const upstreamManifest = JSON.parse(fs.readFileSync(upstreamManifestPath, 'utf8'))
    const notice = fs.readFileSync(noticePath, 'utf8')
    const license = fs.readFileSync(upstreamLicensePath, 'utf8')

    if (upstreamManifest.name !== '@playcanvas/editor') {
        throw new Error('Unexpected upstream package name')
    }
    if (upstreamManifest.version !== upstreamPackageVersion) {
        throw new Error(`Unexpected upstream package version: ${upstreamManifest.version}`)
    }
    if (upstreamManifest.engines?.node !== nodeRequirement) {
        throw new Error(`Unexpected upstream Node requirement: ${upstreamManifest.engines?.node}`)
    }
    if (!license.includes('Copyright (c) 2011-2026 PlayCanvas Ltd.')) {
        throw new Error('Upstream PlayCanvas copyright notice is missing from vendor license')
    }
    if (!notice.includes('Copyright (c) 2011-2026 PlayCanvas Ltd.')) {
        throw new Error('PlayCanvas copyright notice is missing from NOTICE.md')
    }
}

export const validateArtifactManifest = (manifest) => {
    const expected = createArtifactManifest(manifest?.builtAt, manifest?.mode)
    const allowedKeys = Object.keys(expected).sort()
    const actualKeys = Object.keys(manifest ?? {}).sort()

    if (JSON.stringify(actualKeys) !== JSON.stringify(allowedKeys)) {
        throw new Error(`Artifact manifest keys are not allowed: ${actualKeys.join(', ')}`)
    }

    for (const key of allowedKeys) {
        if (key === 'builtAt') {
            if (typeof manifest[key] !== 'string' || Number.isNaN(Date.parse(manifest[key]))) {
                throw new Error('Artifact manifest builtAt must be an ISO timestamp')
            }
            if (path.isAbsolute(manifest[key])) {
                throw new Error('Artifact manifest builtAt must not contain local absolute paths')
            }
            continue
        }
        if (manifest[key] !== expected[key]) {
            throw new Error(`Artifact manifest ${key} mismatch`)
        }
        if (typeof manifest[key] === 'string' && path.isAbsolute(manifest[key])) {
            throw new Error(`Artifact manifest ${key} must not contain local absolute paths`)
        }
    }
}

export const writeBridgeBootstrap = (targetRoot) => {
    const source = `(() => {
  const bridgeVersion = '1';
  const marker = {
    schemaVersion: bridgeVersion,
    ready: false,
    initialized: false,
    hydrationDirtySuppressionUntil: 0,
    userMutationSinceHydration: false,
    suppressedHydrationEntityRemovalIds: [],
    createdAt: new Date().toISOString()
  };
	  let initialized = false;
	  let fallbackTimer = null;
		  let trustedParentWindow = null;
		  let trustedParentOrigin = null;
		  let bootstrapRequestId = null;
		  let bridgeSessionId = null;
		  let bridgeNonce = null;
	  const pendingBridgeRequests = new Map();
		  const hostedEntityObservers = [];
		  const hostedAssetObservers = [];
		  const hostedAssetApiAssets = [];
			  const observedEntityObservers = [];
        let loadedScenePayloadEntityObservers = [];
			  let hostedEntityEditor = null;
			  let wrappedEditorCall = null;
        let wrappedEditorCallSource = null;
        let wrappedEditorEmit = null;
        let wrappedEditorEmitSource = null;
        let wrappedApiEntitiesCreate = null;
        let wrappedApiEntitiesCreateSource = null;
        let wrappedShareDbConnection = null;
        let editorCaptureInstalled = false;
        const repairedShareDbDocuments = new WeakSet();
	  const mmoommVisualMaterialRenderComponents = new WeakSet();
	  const mmoommVisualMaterialAssetReferences = new WeakSet();
		  const mmoommVisualMaterialEntitiesById = new Map();
				  let hydratingPersistedScene = false;
        let persistedSceneHydrationGeneration = 0;

	  window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__ = marker;
	  window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__ = (message) => {
	    if (window.parent && window.parent !== window) {
	      window.parent.postMessage(message, trustedParentOrigin && trustedParentOrigin !== 'null' ? trustedParentOrigin : '*');
	    }
	  };

	  const createUuidV7 = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const timestamp = BigInt(Date.now());
    bytes[0] = Number((timestamp >> 40n) & 0xffn);
    bytes[1] = Number((timestamp >> 32n) & 0xffn);
    bytes[2] = Number((timestamp >> 24n) & 0xffn);
    bytes[3] = Number((timestamp >> 16n) & 0xffn);
    bytes[4] = Number((timestamp >> 8n) & 0xffn);
    bytes[5] = Number(timestamp & 0xffn);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	    return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
	  };
	  bootstrapRequestId = createUuidV7();
  marker.bootstrapRequestId = bootstrapRequestId;

	  const sendBridgeCommand = (type, payload = {}) => {
		    if (!bridgeSessionId || !bridgeNonce) {
		      return Promise.reject(new Error('PlayCanvas Editor bridge session is not initialized'));
		    }
	    const requestId = createUuidV7();
	    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
		      ...payload,
		      type,
		      requestId,
		      sessionId: bridgeSessionId,
		      nonce: bridgeNonce,
		      source: 'universo-playcanvas-editor-artifact'
		    });
	    return new Promise((resolve, reject) => {
      // Loading a persisted scene reads and serializes the complete compatibility
      // payload. Large editor projects can legitimately take longer than the
      // short control-command budget, so keep a bounded but dedicated read budget
      // instead of treating a slow response as a failed bridge session.
      const timeoutMs = ['scene.list', 'scene.read', 'scene.save', 'asset.listMinimalForScene'].includes(type) ? 60_000 : 15_000;
      const timeout = window.setTimeout(() => {
        pendingBridgeRequests.delete(requestId);
        reject(new Error('Bridge command timed out'));
	      }, timeoutMs);
	      pendingBridgeRequests.set(requestId, { resolve, reject, timeout, type });
	    });
	  };

  const isUuidLike = (value) =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const applyLoadedProjectResponse = (response) => {
    const project = response?.data?.project;
    if (!project || typeof project.id !== 'string' || !project.id) return null;
    const defaultSceneId = typeof project.defaultSceneId === 'string' && project.defaultSceneId ? project.defaultSceneId : null;
    marker.selectedProject = {
      project,
      defaultSceneId
    };
    if (marker.fullBootMode !== true && window.config?.project) {
      window.config.project.id = project.id;
      window.config.project.name = getLocalizedName(project.displayName, window.config.project.name || 'Universo Project');
    }
    if (marker.fullBootMode !== true && defaultSceneId && window.config?.scene) {
      window.config.scene.id = defaultSceneId;
      window.config.scene.uniqueId = defaultSceneId;
    }
    return marker.selectedProject;
  };

  const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  const cloneScenePayloadSnapshot = (payload) => {
    if (!isPlainObject(payload)) return null;
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch {
      return { ...payload };
    }
  };

  const mergeRecordSnapshots = (base, next) => ({
    ...(isPlainObject(base) ? base : {}),
    ...(isPlainObject(next) ? next : {})
  });

  const mergeSceneMetadataSnapshots = (...metadataSnapshots) => {
    let merged = {};
    for (const metadata of metadataSnapshots) {
      if (!isPlainObject(metadata)) continue;
      const previousMmoomm = isPlainObject(merged.mmoomm) ? merged.mmoomm : {};
      const nextMmoomm = isPlainObject(metadata.mmoomm) ? metadata.mmoomm : {};
      merged = {
        ...merged,
        ...metadata,
        ...(Object.keys(previousMmoomm).length > 0 || Object.keys(nextMmoomm).length > 0
          ? {
              mmoomm: {
                ...previousMmoomm,
                ...nextMmoomm
              }
            }
          : {})
      };
    }
    return merged;
  };

  const mergeScenePayloadSnapshots = (...payloads) => {
    let merged = null;
    for (const payload of payloads) {
      if (!isPlainObject(payload)) continue;
      const next = cloneScenePayloadSnapshot(payload);
      if (!next) continue;
      merged = merged
        ? {
            ...merged,
            ...next,
            settings: mergeRecordSnapshots(merged.settings, next.settings),
            metadata: mergeSceneMetadataSnapshots(merged.metadata, next.metadata)
          }
        : next;
    }
    return merged;
  };

  const readLoadedScenePayload = (response = marker.lastLoadedScene) => {
    const candidates = [
      response?.data?.payload,
      response?.payload,
      response?.data?.item?.payload,
      response?.item?.payload,
      response?.data?.scene?.payload,
      response?.scene?.payload
    ];
    const payloads = [];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        payloads.push(candidate);
      }
    }
    return mergeScenePayloadSnapshots(...payloads);
  };

  const requestBootstrapInit = () => {
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
      type: 'editor.bootstrap.requestInit',
      bootstrapRequestId,
      bridgeVersion,
      source: 'universo-playcanvas-editor-artifact'
    });
  };

  const ensureSelectedProjectForSave = async () => {
    if (marker.selectedProject?.defaultSceneId) return marker.selectedProject;
    const response = await sendBridgeCommand('project.loadSelected');
    marker.lastLoadedProject = response;
    return applyLoadedProjectResponse(response) || marker.selectedProject || null;
  };

  marker.sendCommand = sendBridgeCommand;

	  const observerToJson = (value, visited = new Set()) => {
	    if (!value || visited.has(value)) return null;
	    visited.add(value);
	    try {
	      if (typeof value.latest === 'function') {
	        const latest = value.latest();
	        if (latest && latest !== value) return observerToJson(latest, visited);
	      }
	      if (typeof value.json === 'function') return value.json();
	      if (typeof value.toJSON === 'function') return value.toJSON();
	      if (value.data && typeof value.data === 'object') return value.data;
	      if (value._data && typeof value._data === 'object') return value._data;
	      if (value.apiEntity?.observer && value.apiEntity.observer !== value) return observerToJson(value.apiEntity.observer, visited);
	      if (value.observer && value.observer !== value) return observerToJson(value.observer, visited);
	      if (value._observer && value._observer !== value) return observerToJson(value._observer, visited);
	      return typeof value === 'object' ? value : null;
	    } catch {
	      return value && typeof value === 'object' ? value : null;
	    }
	  };

	  const normalizeEntityObserver = (value) => {
	    if (!value) return null;
	    if (value.apiEntity?.observer) return value.apiEntity.observer;
	    if (value.observer) return value.observer;
	    if (value._observer) return value._observer;
	    return value;
	  };

	  const readObserverPath = (observer, path) => {
	    if (!observer || typeof path !== 'string') return undefined;
	    if (typeof observer.get === 'function') {
	      try {
	        return observer.get(path);
	      } catch {
	        return undefined;
	      }
	    }
	    const data = observer.data && typeof observer.data === 'object' ? observer.data : observer._data && typeof observer._data === 'object' ? observer._data : observer;
	    return path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), data);
	  };

	  const getEntityObserverId = (observer) => {
	    const normalized = normalizeEntityObserver(observer);
	    return (
	      readObserverPath(normalized, 'resource_id') ||
	      readObserverPath(normalized, 'id') ||
	      normalized?.resource_id ||
	      normalized?.id ||
	      normalized?.apiEntity?.resource_id ||
	      normalized?.apiEntity?.id ||
	      readObserverPath(normalized?._observer, 'resource_id') ||
	      readObserverPath(normalized?._observer, 'id') ||
	      normalized?.apiEntity?.getGuid?.()
	    );
	  };

	  const observerListToArray = (value) => {
	    if (!value) return [];
	    if (Array.isArray(value)) return value;
	    if (typeof value.array === 'function') return value.array();
	    if (typeof value.json === 'function') {
	      const json = value.json();
	      if (Array.isArray(json)) return json;
	      if (json && typeof json === 'object') return Object.values(json);
	      return [];
	    }
	    if (Array.isArray(value.data)) return value.data;
	    if (value.data && typeof value.data === 'object') return Object.values(value.data);
	    return [];
	  };

  const rememberEntityObserver = (observer, fallbackData = null) => {
	    const normalized = normalizeEntityObserver(observer);
	    if (!normalized && (!fallbackData || typeof fallbackData !== 'object')) return;
	    const observerCandidate = normalized || createHostedEntityObserver(fallbackData);
	    const id = getEntityObserverId(observerCandidate);
	    const entityObserver =
	      typeof id === 'string' || typeof id === 'number'
	        ? observerCandidate
	        : fallbackData && typeof fallbackData === 'object'
	          ? createHostedEntityObserver(fallbackData)
	          : null;
	    if (!entityObserver) return;
	    const entityId = getEntityObserverId(entityObserver);
	    if (typeof entityId !== 'string' && typeof entityId !== 'number') return;
	    const key = String(entityId);
	    const existingIndex = observedEntityObservers.findIndex((existing) => {
	      const existingId = getEntityObserverId(existing);
	      return String(existingId) === key;
	    });
	    if (existingIndex >= 0) {
	      observedEntityObservers[existingIndex] = entityObserver;
	      return;
	    }
	    observedEntityObservers.push(entityObserver);
	  };

  const normalizePlayCanvasEntityComponents = (componentsInput) => {
    const components =
      componentsInput && typeof componentsInput === 'object' && !Array.isArray(componentsInput)
        ? { ...componentsInput }
        : {};
    if (components.render && typeof components.render === 'object' && !Array.isArray(components.render)) {
      const render = { ...components.render };
      render.enabled = render.enabled !== false;
      render.type = typeof render.type === 'string' && render.type ? render.type : 'box';
      render.asset = render.asset ?? null;
      render.materialAssets = Array.isArray(render.materialAssets) ? render.materialAssets : [null];
      render.layers = Array.isArray(render.layers) ? render.layers : [0];
      render.castShadows = render.castShadows !== false;
      render.receiveShadows = render.receiveShadows !== false;
      render.castShadowsLightmap = render.castShadowsLightmap !== false;
      render.lightmapped = render.lightmapped === true;
      render.isStatic = render.isStatic === true;
      render.batchGroupId = render.batchGroupId ?? null;
      render.rootBone = render.rootBone ?? null;
      components.render = render;
    }
    if (components.light && typeof components.light === 'object' && !Array.isArray(components.light)) {
      const light = { ...components.light };
      light.enabled = light.enabled !== false;
      light.type = typeof light.type === 'string' && light.type ? light.type : 'directional';
      light.color = Array.isArray(light.color) ? light.color : [1, 1, 1];
      light.intensity = Number.isFinite(light.intensity) ? light.intensity : 1;
      light.layers = Array.isArray(light.layers) ? light.layers : [0];
      components.light = light;
    }
    return components;
  };

  const normalizePersistedSceneEntities = (entitiesInput) => {
    const sourceEntities = Array.isArray(entitiesInput)
      ? entitiesInput
      : entitiesInput && typeof entitiesInput === 'object'
        ? Object.entries(entitiesInput).map(([id, entity]) => ({ id, entity }))
        : [];
    const normalized = [];
    const byId = new Map();

    for (const source of sourceEntities) {
      const raw = source && typeof source === 'object' && 'entity' in source ? source.entity : source;
      if (!raw || typeof raw !== 'object') continue;
      const fallbackId = source && typeof source === 'object' && typeof source.id === 'string' ? source.id : null;
      const resourceId =
        typeof raw.resource_id === 'string' && raw.resource_id
          ? raw.resource_id
          : typeof raw.id === 'string' && raw.id
            ? raw.id
            : fallbackId;
      if (typeof resourceId !== 'string' || !resourceId || byId.has(resourceId)) continue;
      const parent =
        typeof raw.parent === 'string' && raw.parent
          ? raw.parent
          : typeof raw.parentId === 'string' && raw.parentId
            ? raw.parentId
            : null;
      const entity = {
        id: resourceId,
        resource_id: resourceId,
        name: typeof raw.name === 'string' && raw.name ? raw.name : resourceId === 'root' ? 'Root' : 'Entity',
        parent,
        enabled: raw.enabled !== false,
        position: Array.isArray(raw.position) ? raw.position : [0, 0, 0],
        rotation: Array.isArray(raw.rotation) ? raw.rotation : [0, 0, 0],
        scale: Array.isArray(raw.scale) ? raw.scale : [1, 1, 1],
        components: normalizePlayCanvasEntityComponents(raw.components),
        metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : undefined,
        children: []
      };
      byId.set(resourceId, entity);
      normalized.push(entity);
    }

    if (!byId.has('root')) {
      const root = {
        id: 'root',
        resource_id: 'root',
        name: 'Root',
        parent: null,
        enabled: true,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        components: {},
        children: []
      };
      byId.set('root', root);
      normalized.unshift(root);
    }

    for (const entity of normalized) {
      if (entity.resource_id === 'root') {
        entity.parent = null;
        continue;
      }
      if (!entity.parent || entity.parent === entity.resource_id || !byId.has(entity.parent)) {
        entity.parent = 'root';
      }
    }

    for (const entity of normalized) {
      if (!entity.parent) continue;
      const parent = byId.get(entity.parent);
      if (parent && !parent.children.includes(entity.resource_id)) {
        parent.children.push(entity.resource_id);
      }
    }

    for (const entity of normalized) {
      const rawChildren = sourceEntities
        .map((source) => (source && typeof source === 'object' && 'entity' in source ? source.entity : source))
        .find((raw) => raw && typeof raw === 'object' && (raw.resource_id === entity.resource_id || raw.id === entity.resource_id))?.children;
      if (!Array.isArray(rawChildren)) continue;
      for (const childId of rawChildren) {
        if (typeof childId === 'string' && byId.has(childId) && !entity.children.includes(childId)) {
          entity.children.push(childId);
        }
      }
    }

    const root = normalized.find((entity) => entity.resource_id === 'root') || null;
    return [...(root ? [root] : []), ...normalized.filter((entity) => entity !== root)];
  };

  const normalizeRealtimeSceneEntitiesForUpstream = (entitiesInput) =>
    Object.fromEntries(
      normalizePersistedSceneEntities(entitiesInput).map((entity) => [
        entity.resource_id,
        {
          resource_id: entity.resource_id,
          name: entity.name,
          parent: entity.resource_id === 'root' ? null : entity.parent,
          enabled: entity.enabled,
          position: entity.position,
          rotation: entity.rotation,
          scale: entity.scale,
          components: entity.components,
          metadata: entity.metadata,
          children: Array.isArray(entity.children) ? entity.children.filter((child) => typeof child === 'string') : []
        }
      ])
    );

  const normalizeSceneRawDataForUpstream = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    const normalizedEntities = normalizeRealtimeSceneEntitiesForUpstream(data.entities);
    marker.lastNormalizedSceneRawEntityIds = Object.keys(normalizedEntities);
    return {
      ...data,
      entities: normalizedEntities
    };
  };

  const scenePayloadEntitiesToObservers = (payload) => {
    if (!payload || typeof payload !== 'object' || (!Array.isArray(payload.entities) && typeof payload.entities !== 'object')) return [];
    return normalizePersistedSceneEntities(payload.entities).map((entity) => createHostedEntityObserver(entity));
	  };

  const rememberScenePayloadEntities = (payload) => {
    if (!payload || typeof payload !== 'object' || (!Array.isArray(payload.entities) && typeof payload.entities !== 'object')) {
      loadedScenePayloadEntityObservers = [];
      marker.lastCleanLoadedScenePayload = null;
      marker.lastLoadedScenePayloadEntityIds = [];
      return;
    }
    const cleanPayloadSnapshot = cloneScenePayloadSnapshot(payload) || payload;
    loadedScenePayloadEntityObservers = scenePayloadEntitiesToObservers(cleanPayloadSnapshot);
    marker.lastCleanLoadedScenePayload = cleanPayloadSnapshot;
    marker.lastLoadedScenePayloadEntityIds = loadedScenePayloadEntityObservers
      .map((observer) => getEntityObserverId(observer))
      .filter(Boolean);
  };

  const clearLoadedScenePayloadObservers = (reason) => {
    loadedScenePayloadEntityObservers = [];
    marker.lastLoadedScenePayloadEntityIds = [];
    marker.lastLoadedScenePayloadClearedReason = reason;
    marker.lastLoadedScenePayloadClearedAt = Date.now();
  };

  const advancePersistedSceneHydrationGeneration = (reason) => {
    persistedSceneHydrationGeneration += 1;
    marker.persistedSceneHydrationGeneration = persistedSceneHydrationGeneration;
    marker.persistedSceneHydrationGenerationReason = reason;
    return persistedSceneHydrationGeneration;
  };

  const rebindUpstreamHierarchy = () => {
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    if (!editorInstance) return false;
    try {
	      const treeView = editorInstance.call('entities:hierarchy');
	      const rawEntities = editorInstance.call('entities:raw');
	      if (!treeView || !rawEntities) return false;
	      treeView.entities = rawEntities;
	      const hierarchyPanel = editorInstance.call('layout.hierarchy');
	      const overlay = hierarchyPanel?.dom?.querySelector?.('.progress-overlay');
	      if (overlay) {
	        overlay.hidden = true;
	        overlay.style.pointerEvents = 'none';
	        overlay.style.display = 'none';
	      }
	      const entityIds = typeof rawEntities.array === 'function'
        ? rawEntities.array().map((entity) => getEntityReferenceId(entity)).filter(Boolean)
        : [];
      marker.lastHierarchyRebindEntityIds = entityIds;
      marker.lastHierarchyRebindEntityCount = entityIds.length;
      return true;
    } catch (error) {
      marker.lastHierarchyRebindError = error && typeof error.message === 'string' ? error.message : String(error);
      return false;
    }
  };

  const markEntitiesLoadedForPersistedScene = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.call !== 'function') return;
    let upstreamLoaded = false;
    try {
      upstreamLoaded = editorInstance.call('entities:loaded') === true;
    } catch {
      upstreamLoaded = false;
    }
    if (!upstreamLoaded && typeof editorInstance.method === 'function') {
      try {
        if (typeof editorInstance.methodRemove === 'function') {
          editorInstance.methodRemove('entities:loaded');
        }
        editorInstance.method('entities:loaded', () => true);
      } catch (error) {
        marker.lastPersistedEntitiesLoadedMethodError =
          error && typeof error.message === 'string' ? error.message : String(error);
      }
    }
    if (marker.persistedEntitiesLoadEmitted === true || typeof editorInstance.emit !== 'function') return;
    marker.persistedEntitiesLoadEmitted = true;
    editorInstance.emit('entities:load');
  };

  const valueReferencesAsset = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') return value.length > 0 && value !== '0';
    return value !== null && value !== undefined;
  };

  const sceneComponentReferencesAssets = (components) => {
    if (!components || typeof components !== 'object' || Array.isArray(components)) return false;
    const render = components.render && typeof components.render === 'object' && !Array.isArray(components.render) ? components.render : null;
    if (render) {
      if (valueReferencesAsset(render.asset)) return true;
      if (valueReferencesAsset(render.materialAsset)) return true;
      if (Array.isArray(render.materialAssets) && render.materialAssets.some(valueReferencesAsset)) return true;
    }
    const model = components.model && typeof components.model === 'object' && !Array.isArray(components.model) ? components.model : null;
    if (model) {
      if (valueReferencesAsset(model.asset)) return true;
      if (valueReferencesAsset(model.materialAsset)) return true;
      const mapping = model.mapping && typeof model.mapping === 'object' ? Object.values(model.mapping) : [];
      if (mapping.some(valueReferencesAsset)) return true;
    }
    const collision = components.collision && typeof components.collision === 'object' && !Array.isArray(components.collision) ? components.collision : null;
    if (collision && (valueReferencesAsset(collision.asset) || valueReferencesAsset(collision.renderAsset))) return true;
    const sprite = components.sprite && typeof components.sprite === 'object' && !Array.isArray(components.sprite) ? components.sprite : null;
    if (sprite) {
      if (valueReferencesAsset(sprite.spriteAsset) || valueReferencesAsset(sprite.atlasAsset)) return true;
      const clips = sprite.clips && typeof sprite.clips === 'object' ? Object.values(sprite.clips) : [];
      if (clips.some((clip) => clip && typeof clip === 'object' && valueReferencesAsset(clip.spriteAsset))) return true;
    }
    const element = components.element && typeof components.element === 'object' && !Array.isArray(components.element) ? components.element : null;
    if (element && (valueReferencesAsset(element.textureAsset) || valueReferencesAsset(element.fontAsset))) return true;
    const sound = components.sound && typeof components.sound === 'object' && !Array.isArray(components.sound) ? components.sound : null;
    if (sound) {
      const slots = sound.slots && typeof sound.slots === 'object' ? Object.values(sound.slots) : [];
      if (slots.some((slot) => slot && typeof slot === 'object' && valueReferencesAsset(slot.asset))) return true;
    }
    const script = components.script && typeof components.script === 'object' && !Array.isArray(components.script) ? components.script : null;
    if (script) {
      const scripts = script.scripts && typeof script.scripts === 'object' ? Object.values(script.scripts) : [];
      if (scripts.some((item) => item && typeof item === 'object' && valueReferencesAsset(item.asset))) return true;
    }
    return false;
  };

  const loadedScenePayloadReferencesAssets = () => {
    const payload = readLoadedScenePayload();
    const payloadAssets = payload?.assets;
    if (Array.isArray(payloadAssets) && payloadAssets.length > 0) return true;
    const entries = normalizePersistedSceneEntities(payload?.entities);
    return entries.some((entity) => sceneComponentReferencesAssets(entity.components));
  };

  const markAssetsLoadedForAssetlessPersistedScene = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.call !== 'function') return;
    if (loadedScenePayloadReferencesAssets()) return;
    let upstreamLoaded = false;
    try {
      upstreamLoaded = editorInstance.call('assets:loaded') === true;
    } catch {
      upstreamLoaded = false;
    }
    if (!upstreamLoaded && typeof editorInstance.method === 'function') {
      try {
        if (typeof editorInstance.methodRemove === 'function') {
          editorInstance.methodRemove('assets:loaded');
        }
        editorInstance.method('assets:loaded', () => true);
      } catch (error) {
        marker.lastPersistedAssetsLoadedMethodError =
          error && typeof error.message === 'string' ? error.message : String(error);
      }
    }
    if (marker.persistedAssetsLoadEmitted === true || typeof editorInstance.emit !== 'function') return;
    marker.persistedAssetsLoadEmitted = true;
    editorInstance.emit('assets:load');
  };

  const toPersistedHydrationCreateData = (entity) => ({
    resource_id: entity.resource_id,
    name: entity.name,
    parent: entity.parent,
    enabled: entity.enabled,
    position: entity.position,
    rotation: entity.rotation,
    scale: entity.scale,
    components: entity.components,
    metadata: entity.metadata,
    noHistory: true,
      noSelect: true
  });

  const withEntityObserverLocalMutation = (observer, callback) => {
    const sync = observer?.sync && typeof observer.sync === 'object' ? observer.sync : null;
    const history = observer?.history && typeof observer.history === 'object' ? observer.history : null;
    const previousSyncEnabled = sync && 'enabled' in sync ? sync.enabled : undefined;
    const previousHistoryEnabled = history && 'enabled' in history ? history.enabled : undefined;
    try {
      if (sync && 'enabled' in sync) sync.enabled = false;
      if (history && 'enabled' in history) history.enabled = false;
      return callback();
    } finally {
      if (sync && previousSyncEnabled !== undefined) sync.enabled = previousSyncEnabled;
      if (history && previousHistoryEnabled !== undefined) history.enabled = previousHistoryEnabled;
    }
  };

  const writeEntityObserverPath = (observer, path, value) => {
    if (!observer || value === undefined || typeof observer.set !== 'function') return false;
    try {
      withEntityObserverLocalMutation(observer, () => observer.set(path, value));
      return true;
    } catch {
      return false;
    }
  };

  const readEntityObserverPath = (observer, path) => {
    if (!observer || typeof observer.get !== 'function') return undefined;
    try {
      return observer.get(path);
    } catch {
      return undefined;
    }
  };

  const readEntityObserverArrayPath = (observer, path) => {
    const value = readEntityObserverPath(observer, path);
    return Array.isArray(value) ? value : [];
  };

  const readMmoommVisualMaterialMetadata = (entity) => {
    const metadata = entity?.metadata;
    const mmoomm = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata.mmoomm : null;
    const visualMaterial = mmoomm && typeof mmoomm === 'object' && !Array.isArray(mmoomm) ? mmoomm.visualMaterial : null;
    return visualMaterial && typeof visualMaterial === 'object' && !Array.isArray(visualMaterial) ? visualMaterial : null;
  };

  const createColorLike = (sourceColor, tuple, alpha = 1) => {
    const ColorCtor = sourceColor && typeof sourceColor.constructor === 'function' ? sourceColor.constructor : null;
    if (!ColorCtor || !Array.isArray(tuple) || tuple.length < 3) return sourceColor;
    try {
      return new ColorCtor(Number(tuple[0]) || 0, Number(tuple[1]) || 0, Number(tuple[2]) || 0, alpha);
    } catch {
      return sourceColor;
    }
  };

  const createMmoommVisualMaterialFromExisting = (existingMaterial, visualMaterial) => {
    if (!existingMaterial || !visualMaterial) return null;
    const signature = JSON.stringify({
      diffuse: visualMaterial.diffuse,
      emissive: visualMaterial.emissive,
      emissiveIntensity: visualMaterial.emissiveIntensity,
      opacity: visualMaterial.opacity,
      blendType: visualMaterial.blendType,
      depthWrite: visualMaterial.depthWrite,
      useFog: visualMaterial.useFog
    });
    if (existingMaterial.__universoMmoommVisualMaterialSignature === signature) {
      return existingMaterial;
    }
    const material = typeof existingMaterial.clone === 'function' ? existingMaterial.clone() : existingMaterial;
    const opacity = Math.min(1, Math.max(0, Number(visualMaterial.opacity ?? 1)));
    const diffuse = Array.isArray(visualMaterial.diffuse) ? visualMaterial.diffuse : [1, 1, 1];
    material.diffuse = createColorLike(existingMaterial.diffuse, diffuse, opacity);
    material.opacity = opacity;
    material.depthWrite = visualMaterial.depthWrite === true;
    if (Array.isArray(visualMaterial.emissive)) {
      material.emissive = createColorLike(existingMaterial.emissive || existingMaterial.diffuse, visualMaterial.emissive, 1);
      material.emissiveIntensity = Math.max(0, Number(visualMaterial.emissiveIntensity ?? 1));
    }
    // PlayCanvas Editor v2.30.4 uses numeric blend constants internally; when the
    // constants are not available in the artifact scope, these stable values match
    // the Engine blend modes for normal alpha and additive glow.
    if (opacity < 1) {
      material.blendType = visualMaterial.blendType === 'additive' ? 1 : 2;
      material.depthWrite = false;
    }
    material.useFog = visualMaterial.useFog !== false;
    if (typeof material.update === 'function') {
      material.update();
    }
    material.__universoMmoommVisualMaterialOwned = material !== existingMaterial;
    material.__universoMmoommVisualMaterialSignature = signature;
    return material;
  };

  const applyMmoommVisualMaterialToEngineEntity = (editorInstance, entity) => {
    const visualMaterial = readMmoommVisualMaterialMetadata(entity);
    const resourceId = entity?.resource_id || entity?.id;
    if (!visualMaterial || !resourceId) return false;
    const engineEntity = readEngineRenderableEntity(editorInstance, resourceId, entity?.name);
    const meshInstances = engineEntity?.render?.meshInstances;
    if (!Array.isArray(meshInstances) || meshInstances.length === 0) return false;
    installMmoommVisualMaterialRenderHook(editorInstance, engineEntity, entity);
    let applied = 0;
    for (const meshInstance of meshInstances) {
      const previousMaterial = meshInstance?.material;
      const material = createMmoommVisualMaterialFromExisting(meshInstance?.material, visualMaterial);
      if (!material) continue;
      meshInstance.material = material;
      if (
        previousMaterial &&
        previousMaterial !== material &&
        previousMaterial.__universoMmoommVisualMaterialOwned === true &&
        typeof previousMaterial.destroy === 'function'
      ) {
        try {
          previousMaterial.destroy();
        } catch {}
      }
      applied += 1;
    }
    if (applied > 0) {
      marker.lastMmoommVisualMaterialAppliedCount = Number(marker.lastMmoommVisualMaterialAppliedCount || 0) + applied;
      if (typeof editorInstance?.call === 'function') {
        editorInstance.call('viewport:render');
      }
      return true;
    }
    return false;
  };

  const reapplyPersistedMmoommVisualMaterials = (editorInstance) => {
    if (!editorInstance) return 0;
    const entries = selectPersistedSceneEntriesForHydration(editorInstance);
    marker.lastPersistedVisualMaterialEntryCount = entries.filter((entity) => Boolean(readMmoommVisualMaterialMetadata(entity))).length;
    marker.lastPersistedVisualMaterialEntryNames = entries
      .filter((entity) => Boolean(readMmoommVisualMaterialMetadata(entity)))
      .slice(0, 12)
      .map((entity) => entity.name);
    let applied = 0;
    for (const entity of entries) {
      if (applyMmoommVisualMaterialToEngineEntity(editorInstance, entity)) applied += 1;
    }
    marker.lastMmoommVisualMaterialReapplyCount = Number(marker.lastMmoommVisualMaterialReapplyCount || 0) + applied;
    return applied;
  };

  const schedulePersistedMmoommVisualMaterialReapply = (editorInstance) => {
    if (!editorInstance) return;
    const generation = Number(marker.mmoommVisualMaterialReapplyGeneration || 0) + 1;
    marker.mmoommVisualMaterialReapplyGeneration = generation;
    // Entity component creation is deferred by the vendored viewport.  A scene
    // or asset event can therefore arrive before render mesh instances exist.
    // Retry for the full editor bootstrap window while discarding stale batches.
    for (const delay of [0, 100, 250, 500, 1_000, 2_000, 4_000, 8_000, 12_000, 16_000, 22_000]) {
      window.setTimeout(() => {
        if (marker.mmoommVisualMaterialReapplyGeneration !== generation) return;
        reapplyPersistedMmoommVisualMaterials(editorInstance);
      }, delay);
    }
  };

  const ensureEntityObserverArrayPath = (observer, path) => {
    if (!observer || typeof observer.set !== 'function') return false;
    const value = readEntityObserverPath(observer, path);
    if (Array.isArray(value)) return true;
    try {
      observer.set(path, []);
      return true;
    } catch {
      marker.lastPersistedEntityArrayRepairPath = path;
      return false;
    }
  };

  const materializePersistedSceneEntity = (editorInstance, entity) => {
    const apiEntities = editorInstance?.api?.globals?.entities;
    if (apiEntities && typeof apiEntities.serverAdd === 'function' && typeof apiEntities.get === 'function') {
      try {
        apiEntities.serverAdd({
          resource_id: entity.resource_id,
          name: entity.name,
          parent: entity.parent,
          enabled: entity.enabled,
          position: entity.position,
          rotation: entity.rotation,
          scale: entity.scale,
          components: entity.components,
          metadata: entity.metadata,
          children: Array.isArray(entity.children) ? entity.children.filter((child) => typeof child === 'string') : []
        });
        const added = apiEntities.get(entity.resource_id);
        return getApiEntityObserver(added);
      } catch (error) {
        marker.lastPersistedEntityServerAddError = error && typeof error.message === 'string' ? error.message : String(error);
      }
    }
    return editorInstance.call('entities:new', toPersistedHydrationCreateData(entity));
  };

  const linkPersistedSceneEntityParent = (existing, entity) => {
    if (!existing || !entity || entity.resource_id === 'root' || typeof entity.parent !== 'string') return false;
    const childObserver = getApiEntityObserver(existing(entity.resource_id));
    const parentObserver = getApiEntityObserver(existing(entity.parent));
    if (!childObserver || !parentObserver) return false;

    writeEntityObserverPath(childObserver, 'parent', entity.parent);
    const childEngineEntity = childObserver.entity;
    const parentEngineEntity = parentObserver.entity;
    if (!childEngineEntity || !parentEngineEntity || childEngineEntity.parent === parentEngineEntity) return true;
    try {
      if (childEngineEntity.parent && typeof childEngineEntity.parent.removeChild === 'function') {
        childEngineEntity.parent.removeChild(childEngineEntity);
      }
      if (typeof parentEngineEntity.addChild === 'function') {
        parentEngineEntity.addChild(childEngineEntity);
      }
    } catch (error) {
      marker.lastPersistedEntityParentLinkError = error && typeof error.message === 'string' ? error.message : String(error);
      return false;
    }
    return true;
  };

  const applyPersistedEntityToObserver = (observer, entity) => {
    if (!observer || !entity) return false;
    let updated = false;
    updated = writeEntityObserverPath(observer, 'name', entity.name) || updated;
    updated = writeEntityObserverPath(observer, 'enabled', entity.enabled) || updated;
    updated = writeEntityObserverPath(observer, 'position', entity.position) || updated;
    updated = writeEntityObserverPath(observer, 'rotation', entity.rotation) || updated;
    updated = writeEntityObserverPath(observer, 'scale', entity.scale) || updated;

    const components = entity.components && typeof entity.components === 'object' && !Array.isArray(entity.components) ? entity.components : null;
    if (components) {
      for (const [componentName, componentData] of Object.entries(components)) {
        updated = writeEntityObserverPath(observer, 'components.' + componentName, componentData) || updated;
      }
    }

    if (entity.metadata && typeof entity.metadata === 'object' && !Array.isArray(entity.metadata)) {
      updated = writeEntityObserverPath(observer, 'metadata', entity.metadata) || updated;
    }

    if (typeof entity.parent === 'string') {
      updated = writeEntityObserverPath(observer, 'parent', entity.parent) || updated;
    }
    if (Array.isArray(entity.children)) {
      updated = writeEntityObserverPath(observer, 'children', entity.children.filter((child) => typeof child === 'string')) || updated;
    }
    return updated;
  };

  const readEngineRenderableEntity = (editorInstance, id, name = null) => {
    if (!editorInstance || typeof editorInstance.call !== 'function' || !id) return null;
    let app = null;
    try {
      app = editorInstance.call('viewport:app');
    } catch {
      app = null;
    }
    if (!app?.root) return null;
    try {
      if (typeof app.root.findByGuid === 'function') {
        const byGuid = app.root.findByGuid(String(id));
        if (byGuid) return byGuid;
      }
    } catch {
      // Fall back to name lookup below; some Editor viewport roots expose only
      // the name finder during early import hydration.
    }
    try {
      return typeof app.root.findByName === 'function' && name ? app.root.findByName(String(name)) || null : null;
    } catch {
      return null;
    }
  };

  const installMmoommVisualMaterialRenderHook = (editorInstance, engineEntity, entity) => {
    const resourceId = entity?.resource_id || entity?.id;
    const render = engineEntity?.render;
    if (!resourceId || !render || typeof render !== 'object') return;
    mmoommVisualMaterialEntitiesById.set(String(resourceId), entity);
    const renderHooksInstalled = mmoommVisualMaterialRenderComponents.has(render);
    const reapply = () => {
      const latestEntity = mmoommVisualMaterialEntitiesById.get(String(resourceId));
      if (!latestEntity) return;
      // RenderComponent applies the referenced asset resource after a load or
      // unload. Re-apply the persisted MMOOMM metadata on the next task so the
      // upstream assignment cannot silently replace the scene-local material.
      window.setTimeout(() => {
        applyMmoommVisualMaterialToEngineEntity(editorInstance, latestEntity);
      }, 0);
    };

    const wrapAssetReferenceCallback = (reference, callbackName) => {
      if (!reference || typeof reference !== 'object') return false;
      const original = reference[callbackName];
      if (typeof original !== 'function') return false;
      if (original.__universoMmoommVisualMaterialWrapped === true) return true;
      try {
        const wrappedCallback = function (...args) {
          const result = original.apply(this, args);
          reapply();
          return result;
        };
        wrappedCallback.__universoMmoommVisualMaterialWrapped = true;
        reference[callbackName] = wrappedCallback;
        return true;
      } catch {
        return false;
      }
    };

    let wrappedAssetReference = false;
    const materialReferences = Array.isArray(render._materialReferences) ? render._materialReferences : [];
    for (const reference of materialReferences) {
      if (mmoommVisualMaterialAssetReferences.has(reference)) {
        wrappedAssetReference = true;
        continue;
      }
      let referenceWrapped = false;
      for (const callbackName of ['_onAssetLoad', '_onAssetAdd', '_onAssetRemove', '_onAssetUnload']) {
        referenceWrapped = wrapAssetReferenceCallback(reference, callbackName) || referenceWrapped;
      }
      if (referenceWrapped) {
        mmoommVisualMaterialAssetReferences.add(reference);
        wrappedAssetReference = true;
      }
    }

    let wrapped = false;
    if (!renderHooksInstalled) {
      for (const methodName of ['_onMaterialLoad', '_onMaterialRemove', '_onMaterialUnload', '_onSetMeshes']) {
        const original = render[methodName];
        if (typeof original !== 'function') continue;
        try {
          render[methodName] = function (...args) {
            const result = original.apply(this, args);
            reapply();
            return result;
          };
          wrapped = true;
        } catch {
          // Some vendored component instances can be sealed by the Editor; the
          // scheduled bridge reapply remains the safe fallback in that case.
        }
      }
    }
    if (!renderHooksInstalled && (wrapped || wrappedAssetReference)) {
      mmoommVisualMaterialRenderComponents.add(render);
    }
  };

  const entityHasExpectedEngineComponents = (editorInstance, entity) => {
    if (!entity || entity.resource_id === 'root') return true;
    const components = entity.components && typeof entity.components === 'object' && !Array.isArray(entity.components) ? entity.components : null;
    if (!components) return true;
    const engineEntity = readEngineRenderableEntity(editorInstance, entity.resource_id);
    if (!engineEntity) return false;
    if (components.render) {
      const meshInstances = engineEntity.render?.meshInstances;
      applyMmoommVisualMaterialToEngineEntity(editorInstance, entity);
      return Boolean(engineEntity.render) && Array.isArray(meshInstances) && meshInstances.length > 0;
    }
    return Object.keys(components).every((componentName) => Boolean(engineEntity[componentName]));
  };

  const getApiEntityObserver = (entity) => {
    if (!entity || typeof entity !== 'object') return null;
    return entity.observer || entity._observer || (typeof entity.set === 'function' && typeof entity.get === 'function' ? entity : null);
  };

  const readApiEntitiesArray = (apiEntities) => {
    const raw = apiEntities?.raw;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw.array === 'function') {
      try {
        return raw.array();
      } catch {
        return [];
      }
    }
    if (raw && typeof raw === 'object') return Object.values(raw);
    if (typeof apiEntities?.array === 'function') {
      try {
        return apiEntities.array();
      } catch {
        return [];
      }
    }
    return [];
  };

  const deleteStalePersistedSceneEntities = (editorInstance, apiEntities, expectedIds) => {
    const existingEntities = readApiEntitiesArray(apiEntities);
    if (!existingEntities.length) return 0;
    const staleEntities = existingEntities.filter((entity) => {
      const id = getEntityReferenceId(entity);
      return id && id !== 'root' && !expectedIds.has(id);
    });
    if (!staleEntities.length) return 0;
    marker.suppressedHydrationEntityRemovalIds = [
      ...(Array.isArray(marker.suppressedHydrationEntityRemovalIds) ? marker.suppressedHydrationEntityRemovalIds : []),
      ...staleEntities.map(getEntityReferenceId).filter(Boolean)
    ].slice(-256);
    try {
      const deletedByApiEntity = staleEntities.reduce((count, entity) => {
        const apiEntity = entity?.apiEntity || entity;
        if (!apiEntity || typeof apiEntity.delete !== 'function') return count;
        try {
          apiEntity.delete({ history: false, preserveEntityReferences: true });
          return count + 1;
        } catch (error) {
          marker.lastPersistedEntityCleanupError = error && typeof error.message === 'string' ? error.message : String(error);
          return count;
        }
      }, 0);
      if (deletedByApiEntity > 0) {
        return deletedByApiEntity;
      }
      if (typeof editorInstance.call === 'function') {
        const observers = staleEntities.map(getApiEntityObserver).filter(Boolean);
        if (!observers.length) return 0;
        editorInstance.call('entities:delete', observers);
      } else {
        return 0;
      }
      return staleEntities.length;
    } catch (error) {
      marker.lastPersistedEntityCleanupError = error && typeof error.message === 'string' ? error.message : String(error);
      return 0;
    }
  };

  const isEntityRealtimeOp = (op) => op && typeof op === 'object' && Array.isArray(op.p) && op.p[0] === 'entities';

  const recordSuppressedHydrationRealtimeOp = (op) => {
    marker.suppressedHydrationRealtimeOps = [
      ...(Array.isArray(marker.suppressedHydrationRealtimeOps) ? marker.suppressedHydrationRealtimeOps : []),
      op
    ].slice(-20);
  };

  const shouldSuppressHydrationRealtimeEntityOp = (op) =>
    isEntityRealtimeOp(op) && (hydratingPersistedScene || Date.now() < Number(marker.suppressHydrationRealtimeOpsUntil || 0));

  const getRealtimeDocumentData = (realtimeScene) => {
    const data = realtimeScene?._document?.data || realtimeScene?._document?._data || realtimeScene?.data || realtimeScene?._data;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  };

  const ensureObjectAtPath = (root, path) => {
    let current = root;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
      if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
    return current;
  };

  const ensureArrayAtPath = (root, path) => {
    if (!root || !Array.isArray(path) || path.length === 0) return false;
    const parent = ensureObjectAtPath(root, path.slice(0, -1));
    const key = path[path.length - 1];
    if (!parent || typeof parent !== 'object') return false;
    if (!Array.isArray(parent[key])) {
      parent[key] = [];
      marker.lastRealtimeEntityListRepairPath = path.join('.');
      marker.realtimeEntityListRepairCount = Number(marker.realtimeEntityListRepairCount || 0) + 1;
    }
    return true;
  };

  const ensureEntityDocumentShape = (documentData, entityId, entityValue = {}) => {
    if (!documentData || typeof entityId !== 'string' || !entityId) return null;
    if (!documentData.entities || typeof documentData.entities !== 'object' || Array.isArray(documentData.entities)) {
      documentData.entities = {};
    }
    const entities = documentData.entities;
    if (!entities[entityId] || typeof entities[entityId] !== 'object' || Array.isArray(entities[entityId])) {
      entities[entityId] = {
        resource_id: entityId,
        name: entityId === 'root' ? 'Root' : 'Entity',
        parent: entityId === 'root' ? null : 'root',
        enabled: true,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        components: {},
        children: [],
        ...(entityValue && typeof entityValue === 'object' && !Array.isArray(entityValue) ? entityValue : {})
      };
    }
    const entity = entities[entityId];
    if (!Array.isArray(entity.children)) entity.children = [];
    if (!Array.isArray(entity.tags)) entity.tags = [];
    entity.components = normalizePlayCanvasEntityComponents(entity.components);
    return entity;
  };

  const getRealtimeEntityChildId = (value) => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const id =
      typeof value.resource_id === 'string' || typeof value.resource_id === 'number'
        ? value.resource_id
        : typeof value.id === 'string' || typeof value.id === 'number'
          ? value.id
          : null;
    return id === null ? '' : String(id);
  };

  const ensureRealtimeSceneDocumentShape = (realtimeScene) => {
    const documentData = getRealtimeDocumentData(realtimeScene);
    if (!documentData) return false;
    if (!documentData.entities || typeof documentData.entities !== 'object' || Array.isArray(documentData.entities)) {
      documentData.entities = {};
    }
    const entities = documentData.entities;
    if (!entities.root || typeof entities.root !== 'object' || Array.isArray(entities.root)) {
      entities.root = {
        resource_id: 'root',
        name: 'Root',
        parent: null,
        enabled: true,
        components: {},
        children: []
      };
    }

    const entityIds = Object.keys(entities);
    for (const entityId of entityIds) {
      const rawEntity = entities[entityId];
      const entity = ensureEntityDocumentShape(documentData, entityId, rawEntity);
      if (!entity) continue;
      entity.resource_id = typeof entity.resource_id === 'string' && entity.resource_id ? entity.resource_id : entityId;
      if (entity.resource_id === 'root') {
        entity.parent = null;
      } else if (typeof entity.parent !== 'string' || !entity.parent || entity.parent === entity.resource_id || !entities[entity.parent]) {
        entity.parent = 'root';
      }
      entity.children = Array.isArray(entity.children) ? entity.children.map(getRealtimeEntityChildId).filter(Boolean) : [];
    }

    for (const entityId of Object.keys(entities)) {
      const entity = ensureEntityDocumentShape(documentData, entityId, entities[entityId]);
      if (!entity || entity.resource_id === 'root' || typeof entity.parent !== 'string') continue;
      const parent = ensureEntityDocumentShape(documentData, entity.parent, entities[entity.parent]);
      if (parent && Array.isArray(parent.children) && !parent.children.includes(entity.resource_id)) {
        parent.children.push(entity.resource_id);
      }
    }
    marker.realtimeSceneDocumentShapeRepairCount = Number(marker.realtimeSceneDocumentShapeRepairCount || 0) + 1;
    marker.lastRealtimeSceneDocumentEntityIds = Object.keys(documentData.entities);
    return true;
  };

  const repairRealtimeDocumentForEntityListOp = (realtimeScene, op) => {
    if (!isEntityRealtimeOp(op)) return;
    marker.lastRealtimeEntityOpPath = Array.isArray(op.p) ? op.p.join('.') : null;
    marker.recentRealtimeEntityOps = [
      ...(Array.isArray(marker.recentRealtimeEntityOps) ? marker.recentRealtimeEntityOps : []),
      { p: Array.isArray(op.p) ? op.p : null, keys: Object.keys(op).sort() }
    ].slice(-20);
    const documentData = getRealtimeDocumentData(realtimeScene);
    if (!documentData) return;
    ensureRealtimeSceneDocumentShape(realtimeScene);
    if (op.p.length === 2 && Object.prototype.hasOwnProperty.call(op, 'oi')) {
      ensureEntityDocumentShape(documentData, String(op.p[1]), op.oi);
      return;
    }
    const isListOp =
      op.p.length >= 4 &&
      Number.isInteger(op.p[op.p.length - 1]) &&
      (Object.prototype.hasOwnProperty.call(op, 'li') ||
        Object.prototype.hasOwnProperty.call(op, 'ld') ||
        Object.prototype.hasOwnProperty.call(op, 'lm'));
    if (!isListOp) return;
    const entityId = String(op.p[1]);
    ensureEntityDocumentShape(documentData, entityId);
    const path = op.p.slice(0, -1);
    const listPath = path.slice(1);
    ensureArrayAtPath(documentData.entities, listPath);
  };

  const repairRealtimeDocumentForSubmitArgs = (realtimeScene, args) => {
    const first = args?.[0];
    const ops = Array.isArray(first) ? first : [first];
    for (const op of ops) {
      repairRealtimeDocumentForEntityListOp(realtimeScene, op);
    }
  };

  const repairShareDbDocumentForSubmitArgs = (document, args) => {
    const documentData = document?.data;
    if (!documentData || typeof documentData !== 'object' || Array.isArray(documentData)) return;
    const first = args?.[0];
    const ops = Array.isArray(first) ? first : [first];
    for (const op of ops) {
      const isListOp =
        op &&
        typeof op === 'object' &&
        Array.isArray(op.p) &&
        op.p.length >= 2 &&
        Number.isInteger(op.p[op.p.length - 1]) &&
        (Object.prototype.hasOwnProperty.call(op, 'li') ||
          Object.prototype.hasOwnProperty.call(op, 'ld') ||
          Object.prototype.hasOwnProperty.call(op, 'lm'));
      if (!isListOp) continue;
      const listPath = op.p.slice(0, -1);
      ensureArrayAtPath(documentData, listPath);
      marker.lastShareDbDocumentListRepair = {
        collection: document.collection,
        id: document.id,
        path: listPath.join('.')
      };
      marker.shareDbDocumentListRepairCount = Number(marker.shareDbDocumentListRepairCount || 0) + 1;
    }
  };

  const wrapShareDbDocumentSubmitOp = (document) => {
    if (!document || typeof document !== 'object' || typeof document.submitOp !== 'function' || repairedShareDbDocuments.has(document)) {
      return document;
    }
    const upstreamSubmitOp = document.submitOp.bind(document);
    document.submitOp = (...args) => {
      repairShareDbDocumentForSubmitArgs(document, args);
      return upstreamSubmitOp(...args);
    };
    repairedShareDbDocuments.add(document);
    return document;
  };

  const installShareDbConnectionRepairAdapter = (connection) => {
    if (!connection || typeof connection.get !== 'function') return false;
    if (connection !== wrappedShareDbConnection) {
      const upstreamGet = connection.get.bind(connection);
      connection.get = (collection, id) => wrapShareDbDocumentSubmitOp(upstreamGet(collection, id));
      wrappedShareDbConnection = connection;
      marker.shareDbDocumentRepairAdapterInstalled = true;
    }
    const collections = connection.collections && typeof connection.collections === 'object' ? connection.collections : {};
    for (const documents of Object.values(collections)) {
      if (!documents || typeof documents !== 'object') continue;
      for (const document of Object.values(documents)) {
        wrapShareDbDocumentSubmitOp(document);
      }
    }
    return true;
  };

  const installShareDbDocumentRepairAdapter = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.call !== 'function') return false;
    let connection = null;
    try {
      connection = editorInstance.call('realtime:connection');
    } catch {
      connection = null;
    }
    return installShareDbConnectionRepairAdapter(connection);
  };

  const withSuppressedHydrationRealtimeOps = (editorInstance, callback) => {
    const realtimeScene = editorInstance?.api?.globals?.realtime?.scenes?.current;
    const previousEditorCall = typeof editorInstance?.call === 'function' ? editorInstance.call : null;
    marker.suppressHydrationRealtimeOpsUntil = Math.max(Number(marker.suppressHydrationRealtimeOpsUntil || 0), Date.now() + 1500);
    if (previousEditorCall) {
      editorInstance.call = (methodName, ...args) => {
        if (methodName === 'realtime:scene:op' && shouldSuppressHydrationRealtimeEntityOp(args[0])) {
          recordSuppressedHydrationRealtimeOp(args[0]);
          return undefined;
        }
        if (methodName === 'realtime:scene:op') {
          repairRealtimeDocumentForSubmitArgs(realtimeScene, args);
        }
        return previousEditorCall.apply(editorInstance, [methodName, ...args]);
      };
    }
    if (!realtimeScene || typeof realtimeScene.submitOp !== 'function') {
      try {
        return callback();
      } finally {
        marker.suppressHydrationRealtimeOpsUntil = Math.max(Number(marker.suppressHydrationRealtimeOpsUntil || 0), Date.now() + 1500);
        if (previousEditorCall && editorInstance.call !== previousEditorCall) {
          editorInstance.call = previousEditorCall;
        }
      }
    }
    const previousSubmitOp = realtimeScene.submitOp;
    realtimeScene.submitOp = (...args) => {
      if (!shouldSuppressHydrationRealtimeEntityOp(args[0])) {
        repairRealtimeDocumentForSubmitArgs(realtimeScene, args);
        return previousSubmitOp.apply(realtimeScene, args);
      }
      recordSuppressedHydrationRealtimeOp(args[0]);
      const maybeCallback = args.find((arg) => typeof arg === 'function');
      if (typeof maybeCallback === 'function') {
        window.setTimeout(() => maybeCallback(null), 0);
      }
      return undefined;
    };
    try {
      return callback();
    } finally {
      marker.suppressHydrationRealtimeOpsUntil = Math.max(Number(marker.suppressHydrationRealtimeOpsUntil || 0), Date.now() + 1500);
      if (previousEditorCall && editorInstance.call !== previousEditorCall) {
        editorInstance.call = previousEditorCall;
      }
      if (realtimeScene.submitOp !== previousSubmitOp) {
        realtimeScene.submitOp = previousSubmitOp;
      }
    }
  };

  const selectUsablePersistedSceneEntries = (entitiesInput) => {
    if (!entitiesInput || typeof entitiesInput !== 'object' || Array.isArray(entitiesInput)) return [];
    const entries = normalizePersistedSceneEntities(entitiesInput);
    return entries.some((entity) => entity.resource_id && entity.resource_id !== 'root') ? entries : [];
  };

  const selectPersistedSceneEntriesForHydration = (editorInstance) => {
    const realtimeEntities = editorInstance?.api?.globals?.realtime?.scenes?.current?.data?.entities;
    const realtimeEntries = selectUsablePersistedSceneEntries(realtimeEntities);
    const loadedPayload = readLoadedScenePayload();
    const payloadEntries = normalizePersistedSceneEntities(loadedPayload?.entities);
    marker.lastRealtimePersistedEntityCount = realtimeEntries.length;
    marker.lastPayloadPersistedEntityCount = payloadEntries.length;
    marker.lastPayloadVisualMaterialEntityCount = payloadEntries.filter((entity) => Boolean(readMmoommVisualMaterialMetadata(entity))).length;
    if (realtimeEntries.length === 0) return payloadEntries;
    if (payloadEntries.length === 0) return realtimeEntries;

    const payloadById = new Map(payloadEntries.map((entity) => [String(entity.resource_id), entity]));
    const payloadByName = new Map(payloadEntries.filter((entity) => entity.name).map((entity) => [entity.name, entity]));
    return realtimeEntries.map((entity) => {
      const fallback = payloadById.get(String(entity.resource_id)) || payloadByName.get(entity.name);
      if (!fallback) return entity;
      return {
        ...fallback,
        ...entity,
        components: {
          ...fallback.components,
          ...entity.components,
          ...(fallback.components?.render || entity.components?.render
            ? {
                render: {
                  ...fallback.components?.render,
                  ...entity.components?.render,
                  ...(fallback.components?.render?.materialAssets && !entity.components?.render?.materialAssets
                    ? { materialAssets: fallback.components.render.materialAssets }
                    : {})
                }
              }
            : {})
        },
        metadata: mergeSceneMetadataSnapshots(fallback.metadata, entity.metadata)
      };
    });
  };

  const hydratePersistedSceneEntities = () => {
    if (marker.dirty === true) {
      marker.skippedDirtyPersistedSceneHydration = true;
      marker.skippedDirtyPersistedSceneHydrationAt = Date.now();
      clearLoadedScenePayloadObservers('dirty-hydration-skip');
      advancePersistedSceneHydrationGeneration('dirty-hydration-skip');
      return false;
    }
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    const apiEntities = editorInstance?.api?.globals?.entities;
    if (!editorInstance || !apiEntities) {
      return false;
    }
    const entries = selectPersistedSceneEntriesForHydration(editorInstance);
    if (!entries.length) return false;
    const existing = typeof apiEntities.get === 'function' ? (id) => apiEntities.get(id) : () => null;
    const root = entries.find((entity) => entity.resource_id === 'root' || entity.parent === null) || null;
    const ordered = [...(root ? [root] : []), ...entries.filter((entity) => entity !== root && entity.resource_id !== 'root')];
    const expectedIds = new Set(ordered.map((entity) => entity.resource_id).filter(Boolean));
    let hydrated = 0;
    let materialized = 0;
    let parentLinks = 0;
    let deleted = 0;
    hydratingPersistedScene = true;
    try {
      withSuppressedHydrationRealtimeOps(editorInstance, () => {
        deleted = deleteStalePersistedSceneEntities(editorInstance, apiEntities, expectedIds);
        for (const entity of ordered) {
          const existingEntity = existing(entity.resource_id);
          const existingObserver = getApiEntityObserver(existingEntity);
          if (existingObserver) {
            applyPersistedEntityToObserver(existingObserver, entity);
            applyMmoommVisualMaterialToEngineEntity(editorInstance, entity);
            rememberEntityObserver(existingObserver, entity);
            materialized += 1;
            continue;
          }
          let created = null;
          try {
            created = materializePersistedSceneEntity(editorInstance, entity);
          } catch (error) {
            marker.lastPersistedEntityHydrationCreateError =
              error && typeof error.message === 'string' ? error.message : String(error);
            continue;
          }
          if (!created || !getEntityObserverId(created)) continue;
          applyPersistedEntityToObserver(created, entity);
          applyMmoommVisualMaterialToEngineEntity(editorInstance, entity);
          rememberEntityObserver(created, entity);
          hydrated += 1;
          materialized += 1;
        }
        for (const entity of ordered) {
          if (linkPersistedSceneEntityParent(existing, entity)) {
            parentLinks += 1;
          }
        }
      });
    } finally {
      hydratingPersistedScene = false;
    }
    marker.lastHydratedPersistedEntityCount = hydrated;
    marker.lastMaterializedPersistedEntityCount = materialized;
    marker.lastDeletedStalePersistedEntityCount = deleted;
    marker.lastPersistedEntityParentLinkCount = parentLinks;
    marker.lastHydratedPersistedEntityIds = ordered.map((entity) => entity.resource_id);
    if (materialized > 0) {
      markHydratedClean();
    }
    rebindUpstreamHierarchy();
    installHostedAssetAdapter(editorInstance, marker.lastCleanLoadedScenePayload);
    markAssetsLoadedForAssetlessPersistedScene(editorInstance);
    markEntitiesLoadedForPersistedScene(editorInstance);
    schedulePersistedMmoommVisualMaterialReapply(editorInstance);
    return materialized > 0;
  };

  const readExpectedPersistedSceneEntityIds = () => {
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    const entries = selectPersistedSceneEntriesForHydration(editorInstance);
    return entries.map((entity) => entity.resource_id).filter((id) => id && id !== 'root');
  };

  const persistedSceneEntitiesAreAvailable = (editorInstance) => {
    const apiEntities = editorInstance?.api?.globals?.entities;
    if (!apiEntities || typeof apiEntities.get !== 'function') return false;
    const entries = selectPersistedSceneEntriesForHydration(editorInstance);
    const expectedEntries = entries.filter((entity) => entity.resource_id && entity.resource_id !== 'root');
    return (
      expectedEntries.length > 0 &&
      expectedEntries.every((entity) => Boolean(apiEntities.get(entity.resource_id)) && entityHasExpectedEngineComponents(editorInstance, entity))
    );
  };

  const schedulePersistedSceneHydration = (attempts = 16, delay = 250, generation = persistedSceneHydrationGeneration) => {
    window.setTimeout(() => {
      if (generation !== persistedSceneHydrationGeneration || marker.dirty === true) {
        if (marker.dirty === true) {
          marker.skippedDirtyPersistedSceneHydration = true;
          marker.skippedDirtyPersistedSceneHydrationAt = Date.now();
          clearLoadedScenePayloadObservers('dirty-scheduled-hydration-skip');
          advancePersistedSceneHydrationGeneration('dirty-scheduled-hydration-skip');
        }
        return;
      }
      const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
      if (!editorInstance) {
        if (attempts > 1) schedulePersistedSceneHydration(attempts - 1, delay, generation);
        return;
      }
      hydratePersistedSceneEntities();
      schedulePersistedMmoommVisualMaterialReapply(editorInstance);
      rebindUpstreamHierarchy();
      if (
        attempts > 1 &&
        generation === persistedSceneHydrationGeneration &&
        marker.dirty !== true &&
        !persistedSceneEntitiesAreAvailable(editorInstance)
      ) {
        schedulePersistedSceneHydration(attempts - 1, delay, generation);
      }
    }, delay);
  };

	  const forgetEntityObserver = (observer) => {
	    const id = getEntityObserverId(observer);
	    if (typeof id !== 'string' && typeof id !== 'number') return;
	    const key = String(id);
	    const index = observedEntityObservers.findIndex((existing) => {
	      const existingId = getEntityObserverId(existing);
	      return String(existingId) === key;
	    });
    if (index >= 0) {
      observedEntityObservers.splice(index, 1);
    }
  };

  const mergeEntityObserverLists = (...lists) => {
    const merged = [];
    const seen = new Set();
    const rejected = [];
    for (const list of lists) {
      for (const observer of observerListToArray(list)) {
        const normalized = normalizeEntityObserver(observer);
        const id = getEntityObserverId(normalized);
        const key = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
        if (!key) {
          rejected.push({
            type: observer && typeof observer === 'object' ? observer.constructor?.name || 'object' : typeof observer,
            keys: observer && typeof observer === 'object' ? Object.keys(observer).slice(0, 12) : []
          });
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(normalized);
      }
    }
    marker.lastRejectedEntityObserverInputs = rejected.slice(-20);
    return merged;
  };

	  const getEntityReferenceId = (value) => {
	    if (typeof value === 'string' || typeof value === 'number') return String(value);
	    const id = getEntityObserverId(value);
	    return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
	  };

  const consumeSuppressedHydrationEntityRemoval = (entity) => {
    const entityId = getEntityReferenceId(entity);
    if (!entityId) return false;
    const suppressedIds = Array.isArray(marker.suppressedHydrationEntityRemovalIds)
      ? marker.suppressedHydrationEntityRemovalIds
      : [];
    if (!suppressedIds.includes(entityId)) return false;
    marker.suppressedHydrationEntityRemovalIds = suppressedIds.filter((id) => id !== entityId);
    return true;
  };

	  const getObserverValue = (observer, path) => {
	    const direct = readObserverPath(observer, path);
	    if (direct !== undefined) return direct;
	    const raw = observerToJson(observer);
	    return path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), raw);
	  };

	  const readVector3 = (observer, raw, path, fallback) => {
	    const value = getObserverValue(observer, path) || raw?.[path];
	    return Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))
	      ? value.map((item) => Number(item))
	      : fallback;
	  };

  const serializeEntity = (observer) => {
	    const normalized = normalizeEntityObserver(observer);
	    const raw =
	      normalized && typeof normalized === 'object'
	        ? normalized.data && typeof normalized.data === 'object'
	          ? normalized.data
	          : normalized._data && typeof normalized._data === 'object'
	            ? normalized._data
	            : normalized
	        : {};
	    const id = getEntityObserverId(normalized);
	    if (typeof id !== 'string' && typeof id !== 'number') return null;
	    const parentId = getObserverValue(normalized, 'parent') || raw.parent || raw.parent_id || null;
	    const rawChildren = getObserverValue(normalized, 'children') || raw.children;
	    const rawComponents = getObserverValue(normalized, 'components') || raw.components;
	    const rawMetadata = getObserverValue(normalized, 'metadata') || raw.metadata;
    const children = Array.isArray(rawChildren)
      ? rawChildren.map(getEntityReferenceId).filter(Boolean)
      : undefined;
	    const name = getObserverValue(normalized, 'name') || raw.name;
	    const enabled = getObserverValue(normalized, 'enabled');
	    return {
	      id: String(id),
	      name: typeof name === 'string' ? name : undefined,
	      parentId: typeof parentId === 'string' || typeof parentId === 'number' ? String(parentId) : null,
	      enabled: typeof enabled === 'boolean' ? enabled : typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
	      position: readVector3(normalized, raw, 'position', [0, 0, 0]),
	      rotation: readVector3(normalized, raw, 'rotation', [0, 0, 0]),
	      scale: readVector3(normalized, raw, 'scale', [1, 1, 1]),
	      components: rawComponents && typeof rawComponents === 'object' ? rawComponents : undefined,
	      metadata: rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata) ? rawMetadata : undefined,
      children
    };
  };

  const readSerializedVector3 = (value, fallback) =>
    Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))
      ? value.map((item) => Number(item))
      : fallback;

  const syncMmoommMetadataWithEntities = (metadata, entities) => {
    const currentMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    const mmoomm = currentMetadata.mmoomm && typeof currentMetadata.mmoomm === 'object' ? currentMetadata.mmoomm : null;
    const scene = mmoomm?.scene && typeof mmoomm.scene === 'object' ? mmoomm.scene : null;
    if (!scene) {
      return {
        ...currentMetadata,
        ...(mmoomm
          ? {
              mmoomm: {
                ...mmoomm,
                provenance: {
                  ...(mmoomm.provenance && typeof mmoomm.provenance === 'object' ? mmoomm.provenance : {}),
                  authoringFlow: 'playcanvas-editor-native-scene'
                }
              }
            }
          : {})
      };
    }

    const entityById = new Map(
      (Array.isArray(entities) ? entities : [])
        .filter((entity) => entity && typeof entity === 'object' && (typeof entity.id === 'string' || typeof entity.id === 'number'))
        .map((entity) => [String(entity.id), entity])
    );
    const objects = Array.isArray(scene.objects)
      ? scene.objects
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const id = typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : '';
            const entity = id ? entityById.get(id) : null;
            if (!entity) return item;
            const position = readSerializedVector3(entity.position, null);
            const scale = readSerializedVector3(entity.scale, null);
            return {
              ...item,
              ...(position ? { position: { x: position[0], y: position[1], z: position[2] } } : {}),
              ...(scale ? { scale: { x: scale[0], y: scale[1], z: scale[2] } } : {})
            };
          })
      : [];

    return {
      ...currentMetadata,
      mmoomm: {
        ...mmoomm,
        scene: {
          ...scene,
          objects
        },
        provenance: {
          ...(mmoomm.provenance && typeof mmoomm.provenance === 'object' ? mmoomm.provenance : {}),
          authoringFlow: 'playcanvas-editor-native-scene'
        }
      }
    };
  };

  const readCurrentSceneMetadata = (editorInstance) => {
    const candidates = [
      safeEditorCall(editorInstance, 'realtime:scene'),
      editorInstance?.api?.globals?.realtime?.scenes?.current,
      editorInstance?.api?.globals?.realtime?.scenes?.current?._document
    ];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (typeof candidate.get === 'function') {
        try {
          const value = candidate.get('metadata');
          if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        } catch {
          // Continue through other scene document shapes.
        }
      }
      if (candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)) {
        return candidate.metadata;
      }
      if (candidate.data?.metadata && typeof candidate.data.metadata === 'object' && !Array.isArray(candidate.data.metadata)) {
        return candidate.data.metadata;
      }
    }
    return null;
  };

	  const renderHostedEntities = () => {
	    if (!document.body) return;
	    let panel = document.querySelector('[data-universo-playcanvas-editor-hosted-entities]');
    if (!panel) {
      panel = document.createElement('aside');
      panel.setAttribute('data-universo-playcanvas-editor-hosted-entities', 'true');
      panel.setAttribute('aria-label', 'Scene entities');
      panel.setAttribute('aria-live', 'polite');
      panel.style.position = 'fixed';
	      panel.style.left = '12px';
	      panel.style.bottom = '12px';
      panel.style.zIndex = '2147483647';
      panel.style.maxWidth = '320px';
      panel.style.padding = '8px 10px';
      panel.style.borderRadius = '6px';
      panel.style.background = 'rgba(17, 24, 39, 0.92)';
      panel.style.color = '#ffffff';
      panel.style.font = '12px/1.4 Arial, sans-serif';
      panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.24)';
      document.body.appendChild(panel);
    }
	    const addButton = document.createElement('button');
	    addButton.type = 'button';
	    addButton.textContent = 'Add entity';
	    addButton.setAttribute('aria-label', 'Add entity');
	    addButton.style.display = 'block';
	    addButton.style.margin = '0 0 6px';
	    addButton.style.padding = '4px 8px';
	    addButton.style.border = '1px solid rgba(255, 255, 255, 0.32)';
	    addButton.style.borderRadius = '4px';
	    addButton.style.background = 'rgba(255, 255, 255, 0.12)';
	    addButton.style.color = '#ffffff';
	    addButton.style.cursor = 'pointer';
	    addButton.addEventListener('click', () => {
	      if (hostedEntityEditor && typeof hostedEntityEditor.call === 'function') {
	        hostedEntityEditor.call('entities:new', { noHistory: false, noSelect: false });
	      }
	    });
	    panel.replaceChildren(
	      addButton,
	      ...hostedEntityObservers.slice(-5).map((observer) => {
        const item = document.createElement('div');
        item.setAttribute('data-universo-playcanvas-editor-hosted-entity', 'true');
        item.textContent = observer.get('name') || 'Entity';
        return item;
      })
    );
  };

  const createHostedEntityObserver = (input = {}) => {
    const resourceId =
      typeof input.resource_id === 'string' && input.resource_id
        ? input.resource_id
        : typeof input.id === 'string' && input.id
          ? input.id
          : createUuidV7();
    const entity = {
      resource_id: resourceId,
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Entity',
      parent: typeof input.parent === 'string' ? input.parent : null,
      enabled: input.enabled !== false,
      position: Array.isArray(input.position) ? input.position : [0, 0, 0],
      rotation: Array.isArray(input.rotation) ? input.rotation : [0, 0, 0],
      scale: Array.isArray(input.scale) ? input.scale : [1, 1, 1],
      components: input.components && typeof input.components === 'object' ? input.components : {},
      metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : undefined,
      children: Array.isArray(input.children) ? input.children : []
    };
    const setPath = (path, value) => {
      const parts = String(path || '').split('.').filter(Boolean);
      if (!parts.length) return;
      let current = entity;
      for (const part of parts.slice(0, -1)) {
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
      markDirty({ force: true });
      renderHostedEntities();
    };
    return {
      apiEntity: { observer: null },
      data: entity,
      get: (path) => path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), entity),
      set: setPath,
      json: () => ({ ...entity }),
      toJSON: () => ({ ...entity })
    };
  };

  const createHostedAssetObserver = (input = {}, editorInstance = null) => {
    const numericId = Number(input.id ?? input.item_id);
    const id = Number.isInteger(numericId) && numericId > 0 ? numericId : String(input.id || input.stableAssetId || createUuidV7());
    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? input.metadata
        : input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
          ? input.meta
          : {};
    const editorDocument = metadata.editorDocument && typeof metadata.editorDocument === 'object' ? metadata.editorDocument : {};
    const data =
      input.data && typeof input.data === 'object'
        ? input.data
        : metadata.data && typeof metadata.data === 'object'
          ? metadata.data
          : null;
    const inputFile = input.file && typeof input.file === 'object' && !Array.isArray(input.file) ? input.file : null;
    const file = inputFile
      ? {
          filename: typeof inputFile.filename === 'string' ? inputFile.filename : undefined,
          hash: typeof inputFile.hash === 'string' ? inputFile.hash : undefined,
          size: Number.isFinite(Number(inputFile.size)) ? Number(inputFile.size) : 0,
          url: typeof inputFile.url === 'string' ? inputFile.url : undefined,
          mime: typeof inputFile.mime === 'string' ? inputFile.mime : undefined,
          mimeType: typeof inputFile.mimeType === 'string' ? inputFile.mimeType : undefined,
          variants: inputFile.variants && typeof inputFile.variants === 'object' ? inputFile.variants : null
        }
      : null;
    const path = Array.isArray(input.path)
      ? input.path.filter((ancestorId) => Number.isInteger(ancestorId) && ancestorId > 0)
      : Array.isArray(input.editorPathDocumentIds)
        ? input.editorPathDocumentIds.filter((ancestorId) => Number.isInteger(ancestorId) && ancestorId > 0)
        : [];
    const asset = {
      id,
      uniqueId:
        typeof input.uniqueId === 'number' || typeof input.uniqueId === 'string'
          ? input.uniqueId
          : typeof input.stableAssetId === 'number' || typeof input.stableAssetId === 'string'
            ? input.stableAssetId
            : id,
      item_id: id,
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Asset ' + id,
      type: typeof input.type === 'string' && input.type ? input.type : 'json',
      file,
      path,
      parentId: Number.isInteger(input.parentId) && input.parentId > 0 ? input.parentId : path.at(-1) || null,
      tags: Array.isArray(editorDocument.tags) ? editorDocument.tags.filter((tag) => typeof tag === 'string') : [],
      data,
      meta: input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta) ? input.meta : metadata,
      metadata,
      preload: typeof editorDocument.preload === 'boolean' ? editorDocument.preload : true,
      source: typeof editorDocument.source === 'boolean' ? editorDocument.source : false
    };
		  const AssetConstructor = editorInstance?.api?.Asset;
		  if (typeof AssetConstructor === 'function' && editorInstance?.api?.globals?.assets) {
		    return new AssetConstructor(asset).observer;
		  }
    const setPath = (path, value) => {
      const parts = String(path || '').split('.').filter(Boolean);
      if (!parts.length) return;
      let current = asset;
      for (const part of parts.slice(0, -1)) {
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
      markDirty({ force: true });
    };
    const getPath = (path) =>
      String(path || '')
        .split('.')
        .filter(Boolean)
        .reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), asset);
    const unsetPath = (path) => {
      const parts = String(path || '').split('.').filter(Boolean);
      if (!parts.length) return;
      let current = asset;
      for (const part of parts.slice(0, -1)) {
        if (!current || typeof current !== 'object') return;
        current = current[part];
      }
      if (!current || typeof current !== 'object') return;
      delete current[parts[parts.length - 1]];
      markDirty({ force: true });
    };
    const insertPath = (path, value, index) => {
      const target = getPath(path);
      if (!Array.isArray(target)) return;
      const requestedIndex = Number.isInteger(index) ? index : target.length;
      const insertIndex = Math.max(0, Math.min(requestedIndex, target.length));
      target.splice(insertIndex, 0, value);
      markDirty({ force: true });
    };
    const removeValue = (path, index) => {
      const target = getPath(path);
      if (!Array.isArray(target) || !Number.isInteger(index) || index < 0 || index >= target.length) return;
      target.splice(index, 1);
      markDirty({ force: true });
    };
    const observer = {
      data: asset,
      _data: asset,
      get: getPath,
      has: (path) => getPath(path) !== undefined,
      set: setPath,
      unset: unsetPath,
      insert: insertPath,
      removeValue,
      json: () => ({ ...asset }),
      toJSON: () => ({ ...asset }),
      on: () => observer,
      once: () => observer,
      off: () => observer,
      unbind: () => observer,
      load: () => Promise.resolve(observer),
      loadAndSubscribe: () => Promise.resolve(observer),
      initializeHistory: () => undefined,
      history: { enabled: false }
    };
    observer.apiAsset = observer;
    observer.observer = observer;
    return observer;
  };

  const installHostedAssetAdapter = (editorInstance, payloadOverride = null) => {
    const payload =
      payloadOverride && typeof payloadOverride === 'object' && !Array.isArray(payloadOverride)
        ? payloadOverride
        : marker.lastCleanLoadedScenePayload && typeof marker.lastCleanLoadedScenePayload === 'object'
        ? marker.lastCleanLoadedScenePayload
        : readLoadedScenePayload();
    const payloadAssets = Array.isArray(payload?.assets) ? payload.assets : [];
    const explicitAssets = Array.isArray(payloadOverride) ? payloadOverride : payloadAssets;
    const cachedFullBootAssets =
      marker.fullBootAssetsById && typeof marker.fullBootAssetsById === 'object' ? Object.values(marker.fullBootAssetsById) : [];
    const inputAssets = explicitAssets.length > 0 ? explicitAssets : cachedFullBootAssets;
    marker.hostedAssetInputCount = inputAssets.length;
    if (!editorInstance || typeof editorInstance.method !== 'function') {
      marker.hostedAssetAdapterSkippedReason = 'editor-unavailable';
      return false;
    }
    if (inputAssets.length === 0) {
      marker.hostedAssetAdapterSkippedReason = 'no-payload-assets';
      return marker.hostedAssetAdapterInstalled === true && hostedAssetObservers.length > 0;
    }
    const assetsApi = editorInstance.api?.globals?.assets;
    const AssetConstructor = editorInstance.api?.Asset;
    const canUseNativeAssets =
      assetsApi && typeof assetsApi.add === 'function' && typeof assetsApi.get === 'function' && typeof AssetConstructor === 'function';
    if (canUseNativeAssets) {
      for (const apiAsset of hostedAssetApiAssets.splice(0, hostedAssetApiAssets.length)) {
        try {
          if (assetsApi.get(apiAsset.get('id')) === apiAsset) assetsApi.remove(apiAsset);
        } catch {}
      }
      hostedAssetObservers.splice(0, hostedAssetObservers.length);
      const sceneLocalAssetKeys = new Set(getSceneLocalAssets().flatMap(getAssetIdentityKeys));
      for (const inputAsset of inputAssets) {
        const observer = createHostedAssetObserver(inputAsset, editorInstance);
        const apiAsset = observer?.apiAsset;
        const id = observer?.get?.('id');
        let existing = id === undefined || id === null ? null : assetsApi.get(id);
        const isSceneLocalAsset = getAssetIdentityKeys(inputAsset).some((key) => sceneLocalAssetKeys.has(key));
        // Full-upstream realtime can repopulate the API registry after the
        // compatibility scene has been mounted. A storage asset with the same
        // numeric id must not win over the scene-local document: removing it
        // lets the native Editor bridge rebuild the matching engine asset from
        // the authoritative scene data instead of retaining stale/default
        // material resources.
        if (existing && isSceneLocalAsset && existing !== apiAsset) {
          try {
            assetsApi.remove(existing);
          } catch {}
          existing = null;
        }
        const selectedObserver = existing?.observer || observer;
        if (!existing && apiAsset) {
          assetsApi.add(apiAsset);
          if (assetsApi.get(id) === apiAsset) hostedAssetApiAssets.push(apiAsset);
        }
        if (selectedObserver && !hostedAssetObservers.includes(selectedObserver)) hostedAssetObservers.push(selectedObserver);
      }
      // assets:raw and assets:list are native Editor methods backed by an
      // ObserverList. Never replace them with a plain object: picker and
      // asset-panel code calls ObserverList methods such as get and find.
      if (typeof editorInstance.methodRemove === 'function') {
        try {
          editorInstance.methodRemove('assets:loaded');
        } catch {}
      }
      editorInstance.method('assets:loaded', () => true);
    } else {
      hostedAssetObservers.splice(
        0,
        hostedAssetObservers.length,
        ...inputAssets.map((asset) => createHostedAssetObserver(asset, editorInstance))
      );
      if (typeof editorInstance.methodRemove === 'function') {
        for (const methodName of ['assets:list', 'assets:raw', 'assets:get', 'assets:loaded']) {
          try {
            editorInstance.methodRemove(methodName);
          } catch {}
        }
      }
      editorInstance.method('assets:list', () => hostedAssetObservers);
      const fallbackRawAssets = {
        data: hostedAssetObservers,
        array: () => hostedAssetObservers,
        get: (id) => hostedAssetObservers.find((asset) => String(asset.get('id')) === String(id)) || null,
        find: (predicate) => hostedAssetObservers.filter((asset) => predicate(asset.apiAsset || asset)),
        findOne: (predicate) => hostedAssetObservers.find((asset) => predicate(asset.apiAsset || asset)) || null,
        has: (asset) => hostedAssetObservers.includes(asset),
        on: () => fallbackRawAssets,
        once: () => fallbackRawAssets,
        off: () => fallbackRawAssets
      };
      editorInstance.method('assets:raw', () => fallbackRawAssets);
      editorInstance.method('assets:get', (id) => fallbackRawAssets.get(id));
      editorInstance.method('assets:loaded', () => true);
    }
    marker.hostedAssetAdapterInstalled = true;
    marker.hostedAssetAdapterSkippedReason = null;
    marker.hostedAssetObserverCount = hostedAssetObservers.length;
    if (!canUseNativeAssets && typeof editorInstance.emit === 'function') {
      for (const asset of hostedAssetObservers) {
        editorInstance.emit('assets:add', asset);
      }
    }
    if (marker.persistedAssetsLoadEmitted !== true && typeof editorInstance.emit === 'function') {
      marker.persistedAssetsLoadEmitted = true;
      editorInstance.emit('assets:load');
      editorInstance.emit('assets:load:all');
    }
    return true;
  };

  const editorMethodIsAvailable = (editorInstance, methodName, predicate) => {
    if (!editorInstance || typeof editorInstance.call !== 'function') return false;
    try {
      return predicate(editorInstance.call(methodName));
    } catch {
      return false;
    }
  };

  const installHostedEntityAdapter = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.method !== 'function') return false;
	    if (editorMethodIsAvailable(editorInstance, 'entities:list', Array.isArray)) {
	      return true;
	    }
	    if (marker.hostedEntityAdapterInstalled) return true;
	    hostedEntityEditor = editorInstance;
	    marker.hostedEntityAdapterInstalled = true;
    editorInstance.method('entities:list', () => hostedEntityObservers);
    editorInstance.method('entities:raw', () => ({
      data: hostedEntityObservers,
      array: () => hostedEntityObservers
    }));
    editorInstance.method('entities:new', (defaultData = {}) => {
      const observer = createHostedEntityObserver(defaultData && typeof defaultData === 'object' ? defaultData : {});
      observer.apiEntity.observer = observer;
      hostedEntityObservers.push(observer);
      renderHostedEntities();
      if (typeof editorInstance.emit === 'function') {
        editorInstance.emit('entities:add', observer, true);
      }
	      return observer;
	    });
	    renderHostedEntities();
	    return true;
	  };

	  const serializeAsset = (observer) => {
	    const raw = observerToJson(observer) || {};
	    const id = raw.id || getObserverValue(observer, 'id');
    const type = raw.type || getObserverValue(observer, 'type');
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof type !== 'string') return null;
    const data = raw.data && typeof raw.data === 'object' ? raw.data : getObserverValue(observer, 'data');
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : getObserverValue(observer, 'meta');
    const metadata =
      raw.metadata && typeof raw.metadata === 'object'
        ? raw.metadata
        : meta && typeof meta === 'object'
          ? meta
          : undefined;
    return {
      id: String(id),
      name: typeof raw.name === 'string' ? raw.name : undefined,
      type,
      stableAssetId: typeof raw.uniqueId === 'string' ? raw.uniqueId : typeof raw.unique_id === 'string' ? raw.unique_id : undefined,
      mime: raw.file?.mimeType === 'application/json' ? 'application/json' : raw.file?.mime === 'application/json' ? 'application/json' : undefined,
      data: data && typeof data === 'object' ? data : undefined,
      meta: meta && typeof meta === 'object' ? meta : undefined,
      metadata:
        metadata && typeof metadata === 'object'
          ? {
              ...metadata,
              ...(data && typeof data === 'object' && !metadata.data ? { data } : {})
            }
          : data && typeof data === 'object'
            ? { data }
            : undefined
	    };
	  };

  // Full-boot assets are mounted into the upstream Editor's global asset
  // registry so inspectors and pickers can resolve storage-backed files. They
  // are not scene-local data, however, and must never be written back into a
  // scene payload. Keep the filter identity-based because the Editor exposes
  // the realtime document id as a numeric id, while compatibility REST
  // payloads can carry the same value as item_id or metadata.
  const getAssetIdentityKeys = (asset) => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return [];
    const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata) ? asset.metadata : null;
    return [
      asset.id,
      asset.item_id,
      asset.uniqueId,
      asset.unique_id,
      asset.editorDocumentId,
      metadata?.editorDocumentId,
      metadata?.editor_document_id
    ]
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value));
  };

  const resolvePendingFullBootAssetDocuments = (editorInstance, assetsOverride = null) => {
    if (marker.fullBootMode !== true || !editorInstance || typeof editorInstance.call !== 'function') return 0;
    let connection = null;
    try {
      connection = editorInstance.call('realtime:connection');
    } catch {
      connection = null;
    }
    const documents = connection?.collections?.assets;
    if (!documents || typeof documents !== 'object') return 0;
    marker.fullBootAssetDocumentCount = Object.keys(documents).length;
    marker.fullBootAssetDocumentIds = Object.keys(documents).slice(0, 64);
    const assets = Array.isArray(assetsOverride)
      ? assetsOverride
      : marker.fullBootAssetsById && typeof marker.fullBootAssetsById === 'object'
        ? Object.values(marker.fullBootAssetsById)
        : [];
    if (!assets.length) return 0;
    const branchId = window.config?.self?.branch?.id || window.config?.branch?.id || null;
    let resolved = 0;
    for (const [documentId, document] of Object.entries(documents)) {
      if (!document || typeof document !== 'object') continue;
      if (document.__universoFullBootAssetResolved === true) {
        continue;
      }
      if (document.data !== undefined && document.data !== null) continue;
      const requestedId = String(documentId);
      const asset = assets.find((candidate) =>
        getAssetIdentityKeys(candidate).some((identityKey) => identityKey === requestedId)
      );
      if (!asset) continue;
      const documentData = {
        ...asset,
        item_id: String(asset.item_id ?? asset.id),
        ...(branchId ? { branch_id: branchId } : {})
      };
      try {
        if (typeof document._setType === 'function' && !document.type) document._setType('json0');
        if (typeof document._setData === 'function') {
          document._setData(documentData);
        } else {
          document.data = documentData;
        }
        if (document.version === null || typeof document.version !== 'number') document.version = 0;
        document.__universoFullBootAssetResolved = true;
        resolved += 1;
      } catch (error) {
        marker.lastFullBootAssetDocumentResolutionError =
          error && typeof error.message === 'string' ? error.message : String(error);
      }
    }
    marker.fullBootAssetDocumentsResolved = (Number(marker.fullBootAssetDocumentsResolved) || 0) + resolved;
    return resolved;
  };

  const getSceneLocalAssets = () =>
    marker.sceneLocalAssetsById && typeof marker.sceneLocalAssetsById === 'object'
      ? Object.values(marker.sceneLocalAssetsById)
      : [];

  const getFullBootStorageAssets = () =>
    marker.fullBootStorageAssetsById && typeof marker.fullBootStorageAssetsById === 'object'
      ? Object.values(marker.fullBootStorageAssetsById)
      : [];

  const rememberSceneLocalAssets = (assets) => {
    const byId = {};
    for (const asset of Array.isArray(assets) ? assets : []) {
      const id = asset?.id;
      if (typeof id !== 'string' && typeof id !== 'number') continue;
      byId[String(id)] = asset;
    }
    marker.sceneLocalAssetsById = byId;
    marker.sceneLocalAssetCount = Object.keys(byId).length;
    return Object.values(byId);
  };

  const mergeFullBootAssetSources = () => {
    const sceneAssets = getSceneLocalAssets();
    const storageAssets = getFullBootStorageAssets();
    const sceneIdentityKeys = new Set(sceneAssets.flatMap(getAssetIdentityKeys));
    const mergedById = new Map();
    for (const asset of [...sceneAssets, ...storageAssets]) {
      const id = asset?.id;
      if (typeof id !== 'string' && typeof id !== 'number') continue;
      const identityKeys = getAssetIdentityKeys(asset);
      const hasSceneIdentity = identityKeys.some((key) => sceneIdentityKeys.has(key));
      if (storageAssets.includes(asset) && hasSceneIdentity) continue;
      if (!mergedById.has(String(id))) mergedById.set(String(id), asset);
    }
    const merged = Object.fromEntries(mergedById);
    marker.fullBootAssetsById = merged;
    marker.fullBootAssetOrigin =
      sceneAssets.length > 0 ? (storageAssets.length > 0 ? 'mixed' : 'scene') : storageAssets.length > 0 ? 'rest' : 'none';
    return Object.values(merged);
  };

  let fullBootAssetProgressRetryTimer = null;
  const completeFullBootAssetProgress = () => {
    if (
      marker.fullBootMode !== true ||
      marker.fullBootAssetLoadState !== 'ready' ||
      marker.fullBootAssetProgressCompleted === true ||
      !window.editor ||
      typeof window.editor.call !== 'function'
    ) {
      return false;
    }
    try {
      const assetsPanel = window.editor.call('layout.assets');
      if (!assetsPanel?.progressBar || typeof assetsPanel.progressBar !== 'object') return false;
      window.editor.call('assets:progress', 1);
      marker.fullBootAssetProgressCompleted = true;
      marker.fullBootAssetProgressCompletedAt = Date.now();
      return true;
    } catch (error) {
      marker.lastFullBootAssetProgressError = error && typeof error.message === 'string' ? error.message : String(error);
      return false;
    }
  };
  const scheduleFullBootAssetProgressCompletion = () => {
    if (
      marker.fullBootMode !== true ||
      marker.fullBootAssetLoadState !== 'ready' ||
      marker.fullBootAssetProgressCompleted === true ||
      fullBootAssetProgressRetryTimer !== null
    ) {
      return;
    }
    let attempts = 0;
    const retry = () => {
      fullBootAssetProgressRetryTimer = null;
      if (completeFullBootAssetProgress() || marker.fullBootAssetProgressCompleted === true) return;
      attempts += 1;
      // Keep the retry bounded, but allow a slow editor reload to finish
      // wiring the AssetPanel after the compatibility list has resolved.
      if (attempts >= 600 || marker.fullBootAssetLoadState !== 'ready') return;
      fullBootAssetProgressRetryTimer = window.setTimeout(retry, 250);
    };
    retry();
  };

  const installMergedFullBootAssets = () => {
    const assets = mergeFullBootAssetSources();
    if (window.editor && typeof window.editor.method === 'function' && assets.length > 0) {
      installHostedAssetAdapter(window.editor, assets);
    }
    // The upstream launcher can miss its realtime-authenticated event when the
    // compatibility scene is hydrated before the launch listeners are wired.
    // In that case it still mounts the authoritative compatibility assets, but
    // leaves the AssetPanel progress observer at the initial 50% milestone.
    // Complete the normal progress contract after the durable REST asset list
    // resolves and once the panel instance is available. The bounded retry
    // handles the race where hydration finishes before the upstream layout.
    scheduleFullBootAssetProgressCompletion();
    return assets;
  };

  const getFullBootAssetIdentityKeys = () => {
    if (marker.fullBootMode !== true) return new Set();
    // A scene payload may intentionally carry embedded material/model assets.
    // loadFullBootAssets mounts those assets to satisfy the upstream Editor,
    // but they remain scene-local and must survive serialization.
    const sceneIdentityKeys = new Set(getSceneLocalAssets().flatMap(getAssetIdentityKeys));
    const mountedAssets = [...getFullBootStorageAssets(), ...hostedAssetObservers, ...hostedAssetApiAssets];
    return new Set(
      mountedAssets
        .flatMap(getAssetIdentityKeys)
        .filter((key) => !sceneIdentityKeys.has(key))
    );
  };

  const selectSceneLocalAssets = (fallbackAssets, editorAssets) => {
    const candidates = Array.isArray(fallbackAssets) ? fallbackAssets : editorAssets;
    const fullBootAssetKeys = getFullBootAssetIdentityKeys();
    // A full-boot reload can briefly expose the compatibility scene payload
    // before the realtime hydration marker is updated. Treat an explicit
    // fallback payload as scene-local by contract during that window; otherwise
    // the identity-based full-boot filter would remove every embedded asset and
    // the next save would silently persist an asset-less scene.
    const sceneLocalAssetKeys = new Set([
      ...getSceneLocalAssets().flatMap(getAssetIdentityKeys),
      ...(Array.isArray(fallbackAssets) ? fallbackAssets.flatMap(getAssetIdentityKeys) : [])
    ]);
    const seen = new Set();
    return candidates.filter((asset) => {
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return false;
      const id = asset.id;
      if (typeof id !== 'string' && typeof id !== 'number') return false;
      const identityKeys = getAssetIdentityKeys(asset);
      const isSceneLocal = identityKeys.some((key) => sceneLocalAssetKeys.has(key));
      if (!isSceneLocal && fullBootAssetKeys.size > 0 && identityKeys.some((key) => fullBootAssetKeys.has(key))) return false;
      if (Array.isArray(fallbackAssets) && sceneLocalAssetKeys.size > 0 && !isSceneLocal) return false;
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

	  const safeEditorCall = (editorInstance, methodName, ...args) => {
	    try {
	      return editorInstance.call(methodName, ...args);
	    } catch (error) {
	      marker.lastEditorCallError = {
	        methodName,
	        message: error && typeof error.message === 'string' ? error.message : String(error)
	      };
	      return null;
	    }
	  };

  const createDefaultSceneSettings = () => ({
    priority_scripts: [],
    physics: {
      gravity: [0, -9.81, 0]
    },
    render: {
      global_ambient: [0.2, 0.2, 0.2],
      skybox: null,
      fog: 'none',
      fog_start: 1,
      fog_end: 1000,
      fog_density: 0,
      fog_color: [0, 0, 0],
      exposure: 1,
      gamma_correction: 1,
      tonemapping: 0
    }
  });

  const normalizeSceneSettings = (...candidates) => {
    const defaults = createDefaultSceneSettings();
    const merged = candidates.reduce((current, candidate) => {
      const next = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
      const nextPriorityScripts = Array.isArray(next.priority_scripts) ? next.priority_scripts : current.priority_scripts;
      return {
        priority_scripts: nextPriorityScripts,
        physics: {
          ...(current.physics && typeof current.physics === 'object' ? current.physics : {}),
          ...(next.physics && typeof next.physics === 'object' ? next.physics : {})
        },
        render: {
          ...(current.render && typeof current.render === 'object' ? current.render : {}),
          ...(next.render && typeof next.render === 'object' ? next.render : {})
        }
      };
    }, defaults);
    return merged;
  };

  const serializeCurrentScene = () => {
    const cleanLoadedScenePayload =
      marker.lastCleanLoadedScenePayload && typeof marker.lastCleanLoadedScenePayload === 'object'
        ? marker.lastCleanLoadedScenePayload
        : null;
    const loadedScenePayload = readLoadedScenePayload();
    const fallbackPayloadCandidate =
      marker.dirty === true
        ? cleanLoadedScenePayload || loadedScenePayload || null
        : mergeScenePayloadSnapshots(cleanLoadedScenePayload, loadedScenePayload) || loadedScenePayload || cleanLoadedScenePayload || null;
    const fallbackPayload = (() => {
      if (!fallbackPayloadCandidate || !Array.isArray(loadedScenePayload?.assets)) return fallbackPayloadCandidate;
      // A clean realtime snapshot can legitimately omit compatibility-only
      // scene assets. If it has no assets field at all, carry the latest REST
      // scene payload forward so a subsequent save cannot erase those records.
      if (Object.prototype.hasOwnProperty.call(fallbackPayloadCandidate, 'assets')) return fallbackPayloadCandidate;
      return { ...fallbackPayloadCandidate, assets: loadedScenePayload.assets };
    })();
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    if (!editorInstance) {
      return fallbackPayload || { schemaVersion: bridgeVersion, entities: [] };
	    }
    try {
      const sceneSettings = safeEditorCall(editorInstance, 'sceneSettings');
      const cleanLoadedPayloadObservers = marker.dirty === true ? [] : loadedScenePayloadEntityObservers;
      const realtimeSceneEntities =
        editorInstance.api?.globals?.realtime?.scenes?.current?.data?.entities ||
        editorInstance.api?.globals?.realtime?.scenes?.current?._document?._data?.entities ||
        null;
      const realtimeSceneEntityObservers = scenePayloadEntitiesToObservers({
        schemaVersion: bridgeVersion,
        entities: realtimeSceneEntities
      });
      const rawEntityObservers = mergeEntityObserverLists(
        safeEditorCall(editorInstance, 'entities:list'),
        safeEditorCall(editorInstance, 'entities:raw'),
        editorInstance.api?.globals?.entities?.raw,
        readApiEntitiesArray(editorInstance.api?.globals?.entities),
        editorInstance.api?.globals?.entities?.root?.observer,
        observedEntityObservers,
        realtimeSceneEntityObservers,
        cleanLoadedPayloadObservers
      );
      const entitySerializationErrors = [];
      const serializedEntities = rawEntityObservers
        .map((observer) => {
          try {
            return serializeEntity(observer);
          } catch (error) {
            entitySerializationErrors.push({
              id: getEntityObserverId(observer) || null,
              message: error && typeof error.message === 'string' ? error.message : String(error)
            });
            return null;
          }
        })
        .filter(Boolean);
      // Keep the export contract rooted even when the upstream Editor omits its
      // synthetic root observer from entities:list/entities:raw after a dirty
      // native authoring flow.  Child entities without a persisted parent are
      // attached to this root so the runtime receives the same deterministic
      // hierarchy as a freshly loaded scene.
      const entities = (() => {
        const root = serializedEntities.find((entity) => entity.id === 'root');
        if (root) {
          return [root, ...serializedEntities.filter((entity) => entity !== root)];
        }
        const rootChildren = serializedEntities
          .filter((entity) => entity.parentId === null || entity.parentId === undefined || entity.parentId === 'root')
          .map((entity) => entity.id);
        return [
          {
            id: 'root',
            name: 'Root',
            parentId: null,
            enabled: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            components: {},
            children: rootChildren
          },
          ...serializedEntities.map((entity) =>
            entity.parentId === null || entity.parentId === undefined
              ? { ...entity, parentId: 'root' }
              : entity
          )
        ];
      })();
      marker.lastSerializedEntityIds = entities.map((entity) => entity.id);
      marker.lastSerializedEntityCount = entities.length;
      marker.lastRawEntityObserverCount = rawEntityObservers.length;
      marker.lastObservedEntityObserverCount = observedEntityObservers.length;
      marker.lastObservedEntityObserverIds = observedEntityObservers.map((observer) => getEntityObserverId(observer)).filter(Boolean);
      marker.lastEntitySerializationErrors = entitySerializationErrors.slice(-20);
      marker.lastSerializedMmoommVisualMaterialEntityCount = entities.filter((entity) =>
        applyMmoommVisualMaterialToEngineEntity(editorInstance, entity)
      ).length;
      if (Array.isArray(fallbackPayload?.assets) && fallbackPayload.assets.length > 0) {
        // Keep the compatibility scene's embedded assets authoritative across
        // a full-boot restart. The upstream realtime document does not carry
        // these scene-local records, so relying only on its asset registry would
        // turn a reload/save cycle into an asset-less scene overwrite.
        rememberSceneLocalAssets(fallbackPayload.assets);
      }
      installHostedAssetAdapter(editorInstance, fallbackPayload);
	      const editorAssets = observerListToArray(safeEditorCall(editorInstance, 'assets:list') || safeEditorCall(editorInstance, 'assets:raw'))
        .map(serializeAsset)
        .filter(Boolean);
	      // The Editor's hosted asset adapter contains the whole project asset
	      // registry, while a scene payload must contain only scene-local assets.
	      // Serializing the registry back into the scene creates a second copy of
	      // every storage asset (with its numeric realtime id as a string). On
	      // the next boot the backend quite correctly sees that copy alongside
	      // the storage row and rejects the project for a document-id collision.
	      // The loaded scene payload is authoritative for embedded assets; newly
	      // created storage assets are persisted by the asset API and are loaded
	      // through the full-boot asset endpoint on the next session.
	      const assets = selectSceneLocalAssets(fallbackPayload?.assets, editorAssets);
      marker.lastSerializedAssetCount = assets.length;
      marker.lastSerializedAssetIds = assets.map((asset) => asset.id).slice(0, 256);
      marker.lastSceneLocalAssetCount = getSceneLocalAssets().length;
      marker.lastFullBootStorageAssetCount = getFullBootStorageAssets().length;
      marker.lastFullBootAssetCount = marker.fullBootAssetsById ? Object.keys(marker.fullBootAssetsById).length : 0;
      const sceneMetadata = readCurrentSceneMetadata(editorInstance);
      const metadata = syncMmoommMetadataWithEntities(
        mergeSceneMetadataSnapshots(fallbackPayload?.metadata, sceneMetadata, { savedBy: 'universo-playcanvas-editor-bridge' }),
        entities
      );
      return {
        schemaVersion: fallbackPayload?.schemaVersion || bridgeVersion,
        settings: normalizeSceneSettings(
          fallbackPayload?.settings,
          sceneSettings && typeof sceneSettings.json === 'function' ? sceneSettings.json() : null
        ),
        entities,
        assets,
        metadata
      };
    } catch (error) {
      marker.serializeError = error;
      return fallbackPayload || { schemaVersion: bridgeVersion, entities: [] };
    }
  };

  const saveCurrentScene = async (payloadOverride) => {
    if (marker.saving && marker.saveCurrentScenePromise) {
      await marker.saveCurrentScenePromise.catch(() => null);
    }
    const selectedProject = (await ensureSelectedProjectForSave()) || null;
    const projectId = selectedProject?.project?.id;
    const sceneId = selectedProject?.defaultSceneId || window.config?.scene?.id;
    if (typeof projectId !== 'string' || !projectId || !isUuidLike(sceneId)) {
      throw new Error('PlayCanvas Editor bridge save requires a selected project and scene');
    }
    const payload = payloadOverride && typeof payloadOverride === 'object' ? payloadOverride : serializeCurrentScene();
    marker.saving = true;
    const savePromise = (async () => {
    try {
	      let compatibilityConfig =
	        marker.restCompatibilityConfig ||
	        (marker.restCompatibilityConfigPromise ? await marker.restCompatibilityConfigPromise.catch(() => null) : null) ||
	        marker.compatibilityConfig ||
	        (marker.compatibilityConfigPromise ? await marker.compatibilityConfigPromise.catch(() => null) : null);
	      let restConfig =
	        compatibilityConfig?.auth?.scheme === 'signed-header' &&
	        typeof compatibilityConfig.auth.accessToken === 'string' &&
	        typeof compatibilityConfig.auth.headerName === 'string' &&
	        typeof compatibilityConfig.endpoints?.scenes === 'string'
	          ? compatibilityConfig
	          : null;
      if (!restConfig && marker.fullBootMode === true && typeof window.config?.universoBridge?.compatibilityRestBaseUrl === 'string') {
        const restConfigUrl = appendArtifactOriginParams(
          window.config.universoBridge.compatibilityRestBaseUrl.replace(/\\/$/, '') +
            '/config?mode=universo-compatibility-rest-minimal'
        );
	        marker.restCompatibilityConfigPromise = fetch(restConfigUrl, {
	          credentials: 'include',
	          cache: 'no-store'
	        })
	          .then(async (response) => (response.ok ? (await response.json())?.item || null : null))
	          .then((config) => {
	            marker.restCompatibilityConfig = config;
	            return config;
	          })
	          .catch((error) => {
	            marker.restCompatibilityConfigError = error;
	            return null;
	          });
	        compatibilityConfig = await marker.restCompatibilityConfigPromise;
	        restConfig =
	          compatibilityConfig?.auth?.scheme === 'signed-header' &&
	          typeof compatibilityConfig.auth.accessToken === 'string' &&
	          typeof compatibilityConfig.auth.headerName === 'string' &&
	          typeof compatibilityConfig.endpoints?.scenes === 'string'
	            ? compatibilityConfig
	            : null;
	      }
      let response;
      if (
        restConfig?.auth?.scheme === 'signed-header' &&
        typeof restConfig.auth.accessToken === 'string' &&
        typeof restConfig.auth.headerName === 'string' &&
        typeof restConfig.endpoints?.scenes === 'string'
      ) {
        const refreshCurrentSceneChecksum = async () => {
          const sceneReadResponse = await fetch(restConfig.endpoints.scenes + '/' + encodeURIComponent(sceneId), {
            method: 'GET',
            credentials: 'include',
            headers: {
              [restConfig.auth.headerName]: restConfig.auth.accessToken
            },
            cache: 'no-store'
          })
            .then((readResponse) => (readResponse.ok ? readResponse.json() : null))
            .catch(() => null);
          marker.currentSceneChecksum =
            sceneReadResponse?.item?.scene?.checksum ||
            sceneReadResponse?.item?.checksum ||
            sceneReadResponse?.scene?.checksum ||
            sceneReadResponse?.checksum ||
            marker.currentSceneChecksum ||
            null;
        };
        if (marker.fullBootMode === true || !marker.currentSceneChecksum) {
          await refreshCurrentSceneChecksum();
        }
        const sceneSaveUrl = restConfig.endpoints.scenes + '/' + encodeURIComponent(sceneId);
        const sceneCsrfProof = resolveCompatibilityCsrfProof(sceneSaveUrl, restConfig);
        let csrfToken = sceneCsrfProof?.token || null;
        const csrfHeaderName = sceneCsrfProof?.headerName || restConfig.csrf?.headerName || 'X-CSRF-Token';
        if (!csrfToken) {
          const csrf = await fetch(restConfig.csrf?.tokenUrl || '/api/v1/auth/csrf', {
            credentials: 'include',
            cache: 'no-store'
          })
            .then((csrfResponse) => (csrfResponse.ok ? csrfResponse.json() : null))
            .catch(() => null);
          csrfToken =
            typeof csrf?.token === 'string'
              ? csrf.token
              : typeof csrf?.csrfToken === 'string'
                ? csrf.csrfToken
                : typeof csrf?.item?.token === 'string'
                  ? csrf.item.token
                  : null;
        }
        const sceneSaveHeaders = {
          [restConfig.auth.headerName]: restConfig.auth.accessToken,
          'content-type': 'application/json',
          ...(csrfToken ? { [csrfHeaderName]: csrfToken } : {})
        };
        const createSceneSaveBody = () =>
          JSON.stringify({
            requestId: createUuidV7(),
            expectedCurrentChecksum: marker.currentSceneChecksum || null,
            payload
          });
        let restResponse = await fetch(sceneSaveUrl, {
          method: 'PUT',
          credentials: 'include',
          headers: sceneSaveHeaders,
          body: createSceneSaveBody()
        });
        let body = await restResponse.json().catch(() => null);
        if (
          !restResponse.ok &&
          marker.fullBootMode === true &&
          body?.messageCode === 'playcanvas.files.path.currentChecksumMismatch' &&
          typeof body.actualCurrentChecksum === 'string'
        ) {
          marker.currentSceneChecksum = body.actualCurrentChecksum;
          restResponse = await fetch(sceneSaveUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: sceneSaveHeaders,
            body: createSceneSaveBody()
          });
          body = await restResponse.json().catch(() => null);
        }
        if (!restResponse.ok || !body?.ok) {
          const error = new Error('PlayCanvas Editor compatibility REST save failed');
          error.ok = false;
          error.status = restResponse.status;
          error.code =
            typeof body?.code === 'string' ? body.code : restResponse.status === 409 ? 'saveConflict' : 'saveFailed';
          error.requestId = typeof body?.requestId === 'string' ? body.requestId : undefined;
          error.response = body;
          window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
            type: 'bridge.saveError',
            ok: false,
            code: error.code,
            status: error.status,
            requestId: error.requestId,
            sessionId: bridgeSessionId,
            nonce: bridgeNonce,
            source: 'universo-playcanvas-editor-artifact'
          });
          throw error;
        }
        response = { ok: true, data: body.item, requestId: body.requestId };
        marker.lastCompatibilityRestSave = body;
      } else {
        if (marker.fullBootMode === true) {
          const saveStatus = await sendBridgeCommand('scene.saveStatus', {
            projectId,
            sceneId
          });
          marker.currentSceneChecksum =
            saveStatus?.data?.checksum || saveStatus?.data?.scene?.checksum || marker.currentSceneChecksum || null;
          marker.lastBridgeSaveStatus = saveStatus;
        }
        response = await sendBridgeCommand('scene.save', {
          projectId,
          sceneId,
          expectedCurrentChecksum: marker.currentSceneChecksum || null,
          payload
        });
        marker.lastBridgeSave = response;
      }
	      marker.lastSavedScene = response;
	      marker.currentSceneChecksum = response?.data?.checksum || response?.data?.scene?.checksum || marker.currentSceneChecksum || null;
	      rememberScenePayloadEntities(payload);
	      markClean();
	      return response;
    } finally {
      marker.saving = false;
      if (marker.saveCurrentScenePromise === savePromise) {
        marker.saveCurrentScenePromise = null;
      }
    }
    })();
    marker.saveCurrentScenePromise = savePromise;
    return savePromise;
  };

	  marker.serializeCurrentScene = serializeCurrentScene;
	  marker.saveCurrentScene = saveCurrentScene;

  const markClean = () => {
    marker.dirty = false;
    marker.userMutationSinceHydration = false;
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
      type: 'bridge.dirtyState',
      dirty: false,
      sessionId: bridgeSessionId,
      nonce: bridgeNonce,
      source: 'universo-playcanvas-editor-artifact'
    });
  };

  const markHydratedClean = () => {
    if (marker.userMutationSinceHydration === true && marker.dirty === true) return;
    marker.initialHydrationComplete = true;
    marker.ignoreDirtyUntil = Date.now() + 750;
    marker.hydrationDirtySuppressionUntil = Date.now() + 5000;
    markClean();
  };

  const markDirty = (options = {}) => {
    const force = options && options.force === true;
    const userInitiated = options && options.userInitiated === true;
    if (
      force &&
      !userInitiated &&
      marker.fullBootMode === true &&
      (marker.initialHydrationComplete !== true || Date.now() < (marker.hydrationDirtySuppressionUntil || 0))
    ) {
      marker.suppressedInitialDirtyEvents = (marker.suppressedInitialDirtyEvents || 0) + 1;
      return;
    }
    if (force) marker.userMutationSinceHydration = true;
    if (
      !userInitiated &&
      (!marker.initialHydrationComplete ||
        Date.now() < (marker.ignoreDirtyUntil || 0) ||
        Date.now() < (marker.hydrationDirtySuppressionUntil || 0))
    ) {
      marker.suppressedInitialDirtyEvents = (marker.suppressedInitialDirtyEvents || 0) + 1;
      return;
    }
    if (marker.dirty) return;
    marker.dirty = true;
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
	      type: 'bridge.dirtyState',
	      dirty: true,
	      sessionId: bridgeSessionId,
	      nonce: bridgeNonce,
	      source: 'universo-playcanvas-editor-artifact'
	    });
  };

    const installEditorCallBridgeWrapper = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.call !== 'function') return false;
    if (editorInstance.call === wrappedEditorCall && wrappedEditorCallSource) return true;
    const sourceCall = editorInstance.call;
    const upstreamCall = sourceCall.bind(editorInstance);
    wrappedEditorCall = (methodName, ...args) => {
      // The v2.30.4 full-boot launcher asks ShareDB for every asset document
      // after the project list request. Universo's compatibility asset list is
      // already authoritative and mounted in the native registry, while the
      // cloud ShareDB document ids are not guaranteed to be available to the
      // browser session. Resolve those listed ids from the compatibility
      // registry so the upstream progress observer can reach 100% and emit its
      // normal assets:load event. Unknown ids still use the upstream method.
      if (methodName === 'loadAsset' && marker.fullBootMode === true && typeof args[1] === 'function') {
        loadFullBootAssetForEditor(editorInstance, args[0], args[1]);
        return undefined;
      }
      // The upstream realtime sync clears the native registry on disconnect
      // and before a re-subscribe. In full-boot mode the REST compatibility
      // list is authoritative; clearing it would remove folders and scripts
      // from the visible tree even though the backend data still exists.
      // Allow the initial pre-compatibility clear, but suppress late clears
      // after the authoritative list has mounted.
      if (
        methodName === 'assets:clear' &&
        marker.fullBootMode === true &&
        marker.fullBootAssetLoadState === 'ready'
      ) {
        marker.fullBootAssetClearSuppressedCount =
          (Number(marker.fullBootAssetClearSuppressedCount) || 0) + 1;
        return undefined;
      }
      if (methodName === 'realtime:scene:op' && shouldSuppressHydrationRealtimeEntityOp(args[0])) {
        recordSuppressedHydrationRealtimeOp(args[0]);
        return undefined;
      }
      if (methodName === 'realtime:scene:op') {
        const realtimeScene = editorInstance.api?.globals?.realtime?.scenes?.current;
        repairRealtimeDocumentForSubmitArgs(realtimeScene, args);
      }
      // Once the compatibility asset list is authoritative, the upstream
      // realtime loader may report an intermediate progress value after our
      // synthetic completion (for example, 0.5 at the start of its own
      // subscription pass). Keep the user-facing panel at the completed state
      // instead of allowing that late callback to regress it indefinitely.
      const forceFullBootAssetProgress =
        methodName === 'assets:progress' &&
        marker.fullBootMode === true &&
        marker.fullBootAssetLoadState === 'ready' &&
        typeof args[0] === 'number' &&
        Number.isFinite(args[0]) &&
        args[0] < 1;
      const callArgs = forceFullBootAssetProgress ? [1, ...args.slice(1)] : args;
      const result = upstreamCall(methodName, ...callArgs);
      if (forceFullBootAssetProgress) {
        marker.fullBootAssetProgressCompleted = true;
        marker.fullBootAssetProgressCompletedAt = Date.now();
        marker.fullBootAssetProgressOverrideCount =
          (Number(marker.fullBootAssetProgressOverrideCount) || 0) + 1;
      }
      if (methodName === 'realtime:connection') {
        installShareDbConnectionRepairAdapter(result);
      }
      if (methodName === 'entities:new') {
        const inputData = args[0] && typeof args[0] === 'object' ? args[0] : { name: 'Entity' };
        rememberEntityObserver(result, inputData);
        rememberCreatedEntityInputFallback(inputData);
        if (!hydratingPersistedScene) {
          markDirty({ force: true, userInitiated: true });
        }
      }
      return result;
    };
    wrappedEditorCallSource = sourceCall;
    editorInstance.call = wrappedEditorCall;
    editorInstance.universoBridgeCallWrapped = true;
    marker.editorCallWrapped = true;
    marker.editorCallWrappedAt = Date.now();
    return true;
  };

  const rememberCreatedEntityInputFallback = (inputData) => {
    if (!inputData || typeof inputData !== 'object') return;
    const fallbackCreatedEntityId =
      typeof inputData.resource_id === 'string' && inputData.resource_id
        ? inputData.resource_id
        : typeof inputData.id === 'string' && inputData.id
          ? inputData.id
          : null;
    if (!fallbackCreatedEntityId || fallbackCreatedEntityId === 'root') return;
    const fallbackCreatedEntity = {
      ...inputData,
      resource_id: fallbackCreatedEntityId,
      id: fallbackCreatedEntityId,
      parent: typeof inputData.parent === 'string' ? inputData.parent : 'root',
      name: typeof inputData.name === 'string' && inputData.name ? inputData.name : 'Entity'
    };
    rememberEntityObserver(createHostedEntityObserver(fallbackCreatedEntity), fallbackCreatedEntity);
    marker.lastCreatedEntityFallbackId = fallbackCreatedEntityId;
  };

  const installApiEntitiesCreateBridgeWrapper = (editorInstance) => {
    const apiEntities = editorInstance?.api?.globals?.entities;
    if (!apiEntities || typeof apiEntities.create !== 'function') return false;
    if (apiEntities.create === wrappedApiEntitiesCreate && wrappedApiEntitiesCreateSource) return true;
    const sourceCreate = apiEntities.create;
    wrappedApiEntitiesCreate = function universoBridgeEntitiesCreate(data, options) {
      const result = sourceCreate.call(this, data, options);
      if (!hydratingPersistedScene) {
        rememberCreatedEntityInputFallback(data);
        markDirty({ force: true, userInitiated: true });
      }
      return result;
    };
    wrappedApiEntitiesCreateSource = sourceCreate;
    apiEntities.create = wrappedApiEntitiesCreate;
    marker.apiEntitiesCreateWrapped = true;
    marker.apiEntitiesCreateWrappedAt = Date.now();
    return true;
  };

  const installMessengerAssetUpdateAdapter = (editorInstance) => {
    if (!editorInstance || typeof editorInstance.on !== 'function' || marker.messengerAssetUpdateAdapterInstalled === true) return false;
    editorInstance.on('messenger:asset.update', (message) => {
      const assetData = message && typeof message === 'object' && message.asset && typeof message.asset === 'object' ? message.asset : null;
      if (!assetData) return;
      const currentBranchId = window.config?.self?.branch?.id;
      if (
        assetData.branchId !== undefined &&
        assetData.branchId !== null &&
        currentBranchId !== undefined &&
        currentBranchId !== null &&
        String(assetData.branchId) !== String(currentBranchId)
      ) {
        return;
      }
      const uniqueId = assetData.id;
      if (uniqueId === undefined || uniqueId === null) return;
      let asset = null;
      try {
        asset = editorInstance.call('assets:getUnique', uniqueId) || editorInstance.call('assets:get', uniqueId);
      } catch {
        asset = null;
      }
      if (!asset) {
        const listed = safeEditorCall(editorInstance, 'assets:list');
        const assets = Array.isArray(listed) ? listed : listed && typeof listed.array === 'function' ? listed.array() : [];
        asset = assets.find((candidate) => String(getObserverValue(candidate, 'id')) === String(uniqueId)) || null;
      }
      if (!asset || typeof asset.set !== 'function') return;
      if (typeof assetData.name === 'string' && assetData.name) {
        asset.set('name', assetData.name);
      }
      if (typeof assetData.fileFilename === 'string' && assetData.fileFilename && getObserverValue(asset, 'file')) {
        asset.set('file.filename', assetData.fileFilename);
      }
    });
    marker.messengerAssetUpdateAdapterInstalled = true;
    return true;
  };

  const installEditorSaveAdapter = () => {
	    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
	    if (!editorInstance) {
	      window.setTimeout(installEditorSaveAdapter, 250);
	      return;
	    }
    if (marker.editorSaveAdapterInstalled && marker.editorInstance === editorInstance) {
      installEditorCallBridgeWrapper(editorInstance);
      installShareDbDocumentRepairAdapter(editorInstance);
      installApiEntitiesCreateBridgeWrapper(editorInstance);
        installMessengerAssetUpdateAdapter(editorInstance);
        const currentRealtimeScene = editorInstance.api?.globals?.realtime?.scenes?.current;
        ensureRealtimeSceneDocumentShape(currentRealtimeScene);
        wrapShareDbDocumentSubmitOp(currentRealtimeScene?._document);
        return;
      }
	    if (marker.fullBootMode !== true) {
	      installHostedEntityAdapter(editorInstance);
	    }
    marker.editorSaveAdapterInstalled = true;
    marker.editorInstance = editorInstance;
    editorInstance.universoBridge = marker;
    installMessengerAssetUpdateAdapter(editorInstance);
    installShareDbDocumentRepairAdapter(editorInstance);
    if (typeof editorInstance.emit === 'function' && editorInstance.emit !== wrappedEditorEmit) {
      const sourceEmit = editorInstance.emit;
      const upstreamEmit = sourceEmit.bind(editorInstance);
      wrappedEditorEmit = (eventName, ...args) => {
        if (eventName === 'scene:raw') {
          args[0] = normalizeSceneRawDataForUpstream(args[0]);
        }
        return upstreamEmit(eventName, ...args);
      };
      wrappedEditorEmitSource = sourceEmit;
      editorInstance.emit = wrappedEditorEmit;
      marker.editorEmitWrapped = true;
    }
    installEditorCallBridgeWrapper(editorInstance);
	    if (typeof editorInstance.method === 'function') {
	      editorInstance.method('universo:bridge:serializeScene', serializeCurrentScene);
	      editorInstance.method('universo:bridge:saveScene', saveCurrentScene);
    }
		    if (typeof editorInstance.on === 'function') {
	      editorInstance.on('entities:add', (entity) => {
	        rememberEntityObserver(entity, { name: getObserverValue(entity, 'name') || 'Entity' });
        schedulePersistedMmoommVisualMaterialReapply(editorInstance);
        if (!hydratingPersistedScene) {
          markDirty({ force: true });
        }
	      });
      editorInstance.on('entities:remove', (entity) => {
        forgetEntityObserver(entity);
        if (!hydratingPersistedScene && !consumeSuppressedHydrationEntityRemoval(entity)) {
          markDirty({ force: true });
        }
      });
      editorInstance.on('assets:add', markDirty);
      editorInstance.on('assets:remove', markDirty);
      editorInstance.on('load', () => {
        if (marker.fullBootMode !== true) markHydratedClean();
      });
      if (!marker.mmoommVisualMaterialReapplyAdapterInstalled) {
        const reapplyVisualMaterials = () => {
          for (const delay of [0, 250, 1000, 3000]) {
            window.setTimeout(() => {
              reapplyPersistedMmoommVisualMaterials(editorInstance);
            }, delay);
          }
        };
        editorInstance.on('assets:load', reapplyVisualMaterials);
        editorInstance.on('assets:load:all', reapplyVisualMaterials);
        editorInstance.on('entities:load', reapplyVisualMaterials);
        marker.mmoommVisualMaterialReapplyAdapterInstalled = true;
      }
      if (marker.fullBootMode === true && !marker.fullBootAssetRegistryReconcileInstalled) {
        const reconcileFullBootAssets = () => {
          const assets = installMergedFullBootAssets();
          // ShareDB documents must be hydrated only after the upstream loader
          // has attached its load listeners. Hydrating them before
          // RealtimeAsset.loadAndSubscribe subscribes can emit the load
          // event synchronously and strand the editor progress bar at 50%.
          resolvePendingFullBootAssetDocuments(editorInstance, assets);
          schedulePersistedMmoommVisualMaterialReapply(editorInstance);
        };
        // The upstream realtime loader may clear and repopulate its native
        // asset registry after the compatibility scene has loaded. Re-mount
        // the merged scene/storage view only after that load settles so
        // scene-local material data remains the source of truth.
        editorInstance.on('assets:load', reconcileFullBootAssets);
        editorInstance.on('assets:load:all', reconcileFullBootAssets);
        marker.fullBootAssetRegistryReconcileInstalled = true;
      }
	      editorInstance.on('settings:project:load', () => {
	        marker.projectSettingsLoaded = true;
        if (marker.fullBootMode !== true) {
          markHydratedClean();
        }
	      });
      editorInstance.on('realtime:authenticated', () => {
        marker.realtimeAuthenticated = true;
      });
      editorInstance.on('scene:raw', () => {
        marker.realtimeSceneRawReceived = true;
        ensureRealtimeSceneDocumentShape(editorInstance.api?.globals?.realtime?.scenes?.current);
        rebindUpstreamHierarchy();
        if (marker.fullBootMode !== true && !marker.initialHydrationComplete) {
          markHydratedClean();
        }
      });
      editorInstance.on('realtime:load:scene', () => {
        const wasDirty = marker.dirty === true;
        ensureRealtimeSceneDocumentShape(editorInstance.api?.globals?.realtime?.scenes?.current);
        hydratePersistedSceneEntities();
        reapplyPersistedMmoommVisualMaterials(editorInstance);
        schedulePersistedMmoommVisualMaterialReapply(editorInstance);
        if (!wasDirty) {
          markHydratedClean();
        }
      });
	      editorInstance.on('realtime:scene:op', markDirty);
		    }
    const realtimeApi = editorInstance.api?.globals?.realtime;
    if (realtimeApi && typeof realtimeApi.on === 'function' && !marker.realtimeSceneErrorAdapterInstalled) {
      marker.realtimeSceneErrorAdapterInstalled = true;
      realtimeApi.on('error:scene', (error, sceneId) => {
        marker.lastRealtimeSceneError = error && typeof error.message === 'string' ? error.message : String(error);
        marker.lastRealtimeSceneErrorSceneId = sceneId;
        marker.lastRealtimeSceneErrorEntityOps = Array.isArray(marker.recentRealtimeEntityOps) ? marker.recentRealtimeEntityOps : [];
        marker.lastRealtimeSceneErrorEntityOpPath = marker.lastRealtimeEntityOpPath;
      });
    }
	    schedulePersistedSceneHydration();
    const history = editorInstance.api?.globals?.history;
    if (history && typeof history.on === 'function' && !marker.historyDirtyAdapterInstalled) {
      history.on('add', () => {
        if (!hydratingPersistedScene) markDirty({ force: true });
      });
      history.on('undo', () => markDirty({ force: true, userInitiated: true }));
      history.on('redo', () => markDirty({ force: true, userInitiated: true }));
      marker.historyDirtyAdapterInstalled = true;
    }
    const realtimeScene = editorInstance.api?.globals?.realtime?.scenes?.current;
    ensureRealtimeSceneDocumentShape(realtimeScene);
    if (
      realtimeScene &&
      typeof realtimeScene.submitOp === 'function' &&
      realtimeScene.submitOp !== marker.wrappedRealtimeSceneSubmitOp
    ) {
      const upstreamSubmitOp = realtimeScene.submitOp.bind(realtimeScene);
      marker.wrappedRealtimeSceneSubmitOp = (op) => {
        if (shouldSuppressHydrationRealtimeEntityOp(op)) {
          recordSuppressedHydrationRealtimeOp(op);
          return undefined;
        }
        repairRealtimeDocumentForSubmitArgs(realtimeScene, [op]);
        const result = upstreamSubmitOp(op);
        markDirty({ userInitiated: true });
        return result;
      };
      realtimeScene.submitOp = marker.wrappedRealtimeSceneSubmitOp;
      const realtimeDocument = realtimeScene._document;
      if (
        realtimeDocument &&
        typeof realtimeDocument.submitOp === 'function' &&
        realtimeDocument.submitOp !== marker.wrappedRealtimeSceneDocumentSubmitOp
      ) {
        const upstreamDocumentSubmitOp = realtimeDocument.submitOp.bind(realtimeDocument);
        marker.wrappedRealtimeSceneDocumentSubmitOp = (...args) => {
          repairRealtimeDocumentForSubmitArgs(realtimeScene, args);
          return upstreamDocumentSubmitOp(...args);
        };
        realtimeDocument.submitOp = marker.wrappedRealtimeSceneDocumentSubmitOp;
      }
    }
	  };

  // The full-upstream launcher starts its realtime asset loader from the
  // Editor's first load event. Polling for the instance after injecting the
  // bundle is racy: the launcher can create ShareDB documents before the
  // adapter is installed, leaving the assets progress bar at 50%.  Capture
  // the vendor assignment synchronously so the call wrapper is present before
  // any load handlers execute. Keep the accessor private to this bootstrap
  // and preserve the existing descriptor/value for non-Editor consumers.
  const installEarlyEditorCapture = () => {
    if (editorCaptureInstalled || marker.fullBootMode !== true || typeof window !== 'object') return false;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'editor');
    if (descriptor && descriptor.configurable === false) return false;
    let currentEditor = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : window.editor;
    try {
      Object.defineProperty(window, 'editor', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: () => currentEditor,
        set: (value) => {
          currentEditor = value;
          if (value && typeof value.call === 'function') {
            installEditorSaveAdapter();
          }
        }
      });
    } catch {
      return false;
    }
    editorCaptureInstalled = true;
    marker.editorCaptureInstalled = true;
    if (currentEditor && typeof currentEditor.call === 'function') {
      installEditorSaveAdapter();
    }
    return true;
  };

	  let editorAdapterRefreshCount = 0;
	  const refreshEditorSaveAdapter = () => {
	    installEditorSaveAdapter();
	    editorAdapterRefreshCount += 1;
	    if (editorAdapterRefreshCount < 40) {
	      window.setTimeout(refreshEditorSaveAdapter, 500);
	    }
	  };

  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveCurrentScene().catch((error) => {
        marker.saveError = error;
      });
    }
  });

	  const handleBridgeResponse = (responseMessage) => {
	    const requestId = typeof responseMessage?.requestId === 'string' ? responseMessage.requestId : '';
	    const pending = pendingBridgeRequests.get(requestId);
	    if (!pending) return;
	    if (
	      responseMessage.source !== 'universo-playcanvas-editor-host' ||
	      responseMessage.commandType !== pending.type ||
	      responseMessage.response?.requestId !== requestId
	    ) {
	      rejectParentMessage('invalid-bridge-response');
	      return;
	    }
	    pendingBridgeRequests.delete(requestId);
	    window.clearTimeout(pending.timeout);
    const response = responseMessage.response;
    if (response?.ok === false) {
      pending.reject(response);
      return;
    }
	    pending.resolve(response);
	  };

	  const isValidBootstrapDescriptor = (descriptor) => {
	    if (!descriptor || typeof descriptor !== 'object') return false;
	    const bridge = descriptor.bridge;
	    const expiresAtMs = Date.parse(bridge?.expiresAt || '');
	    return (
	      descriptor.schemaVersion === bridgeVersion &&
	      bridge &&
	      typeof bridge === 'object' &&
	      bridge.bridgeVersion === bridgeVersion &&
	      typeof bridge.sessionId === 'string' &&
	      isUuidLike(bridge.sessionId) &&
	      typeof bridge.nonce === 'string' &&
	      bridge.nonce.length >= 32 &&
	      bridge.writeMode === 'manager' &&
	      Number.isFinite(expiresAtMs) &&
	      expiresAtMs > Date.now() &&
	      Array.isArray(bridge.capabilities)
	    );
	  };

	  const isTrustedParentMessage = (event) => {
	    if (!window.parent || window.parent === window || event.source !== window.parent) return false;
	    if (!trustedParentWindow || !trustedParentOrigin) return false;
	    return event.source === trustedParentWindow && event.origin === trustedParentOrigin;
	  };

	  const rejectParentMessage = (reason) => {
	    marker.securityRejectedMessages = (marker.securityRejectedMessages || 0) + 1;
	    marker.lastRejectedMessageReason = reason;
	    marker.rejectedMessageReasons = [...(Array.isArray(marker.rejectedMessageReasons) ? marker.rejectedMessageReasons : []), reason].slice(-20);
	  };

  const getLocalizedName = (value, fallback) => {
    if (!value || typeof value !== 'object') return fallback;
    const primary = typeof value._primary === 'string' ? value._primary : null;
    const primaryContent = primary && value.locales?.[primary]?.content;
    if (typeof primaryContent === 'string' && primaryContent.trim()) return primaryContent.trim();
    const first = Object.values(value.locales || {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim());
    return typeof first?.content === 'string' ? first.content.trim() : fallback;
  };

  const assertHostedConfig = (config) => {
    if (!config || typeof config !== 'object') throw new Error('Hosted Editor config is missing');
    if (!config.project?.id || !config.project?.name) throw new Error('Hosted Editor project config is incomplete');
    if (!config.scene?.id || !config.scene?.uniqueId) throw new Error('Hosted Editor scene config is incomplete');
    if (!Array.isArray(config.project.permissions?.read) || !Array.isArray(config.project.permissions?.write)) {
      throw new Error('Hosted Editor permission config is incomplete');
    }
    if (!Array.isArray(config.project.permissions?.admin) || config.project.permissions.admin.length !== 0) {
      throw new Error('Hosted Editor config must not grant synthetic admin privileges');
    }
    if (config.self?.flags?.superUser !== false) {
      throw new Error('Hosted Editor config must not grant synthetic superUser privileges');
    }
    if (!config.url?.frontend || !config.url?.engine || config.schema?.version !== 1 || !config.schema?.documents?.scene || !config.schema?.documents?.settings) {
      throw new Error('Hosted Editor upstream boot config is incomplete');
    }
    return config;
  };

  const assertFullBootConfig = (config) => {
    if (!config || typeof config !== 'object') throw new Error('Full upstream Editor config is missing');
    if (config.url && typeof config.url === 'object' && !config.url.static && typeof config.url.frontend === 'string') {
      config.url.static = config.url.frontend.replace(/\\/$/, '');
    }
    if (config.mode !== 'universo-full-upstream-ui') throw new Error('Full upstream Editor config has an unsupported mode');
    if (!config.project?.id || !config.project?.name) throw new Error('Full upstream Editor project config is incomplete');
    if (!config.scene?.id || !config.scene?.uniqueId) throw new Error('Full upstream Editor scene config is incomplete');
    if (!config.accessToken || typeof config.accessToken !== 'string') throw new Error('Full upstream Editor access token is missing');
    const urlText = JSON.stringify(config.url || {});
    if (urlText.includes('/disabled')) throw new Error('Full upstream Editor config must not use disabled realtime endpoints');
    if (!config.url?.realtime?.http || !config.url?.messenger?.ws || !config.url?.relay?.ws) {
      throw new Error('Full upstream Editor WebSocket endpoints are incomplete');
    }
    if (!Array.isArray(config.wasmModules)) {
      throw new Error('Full upstream Editor wasmModules config must be an array');
    }
    const pages = config.pages;
    if (
      !pages ||
      typeof pages !== 'object' ||
      Array.isArray(pages) ||
      pages.fullEditor?.kind !== 'fullEditor' ||
      pages.codeEditor?.kind !== 'unavailable' ||
      pages.launchPage?.kind !== 'unavailable'
    ) {
      throw new Error('Full upstream Editor page variant descriptors are missing or mismatched');
    }
    if (!config.url?.frontend || !config.url?.engine || config.schema?.version !== 1 || !config.schema?.documents?.scene || !config.schema?.documents?.settings) {
      throw new Error('Full upstream Editor upstream boot config is incomplete');
    }
    return config;
  };

  const resolveInitialConfig = (descriptor) => {
    if (descriptor?.compatibilityConfig?.mode === 'universo-full-upstream-ui') {
      marker.fullBootMode = true;
      marker.compatibilityConfig = descriptor.compatibilityConfig;
      marker.compatibilityConfigReady = true;
      const proof = descriptor.compatibilityConfig.universoBridge?.compatibilityCsrfToken;
      if (proof && typeof proof === 'object' && typeof proof.token === 'string' && typeof proof.headerName === 'string') {
        marker.fullBootCompatibilityCsrfToken = { token: proof.token, headerName: proof.headerName };
      }
      return assertFullBootConfig(descriptor.compatibilityConfig);
    }
    marker.fullBootMode = false;
    return createHostedConfig(descriptor);
  };

  const createJsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });

  const resolveFullBootTokenRefreshUrl = () => {
    if (typeof window.config?.universoBridge?.tokenRefreshUrl === 'string') {
      return window.config.universoBridge.tokenRefreshUrl;
    }
    if (typeof window.config?.universoBridge?.compatibilityRestBaseUrl === 'string') {
      return window.config.universoBridge.compatibilityRestBaseUrl.replace(/\\/$/, '') + '/config?mode=universo-full-upstream-ui';
    }
    return null;
  };

  const appendArtifactOriginParams = (urlText) => {
    try {
      const url = new URL(urlText, window.location.href);
      const artifactBaseUrl = new URL('./', window.location.href).href;
      url.searchParams.set('artifactBaseUrl', artifactBaseUrl);
      url.searchParams.set('artifactOrigin', window.location.origin);
      if (typeof bridgeSessionId === 'string' && bridgeSessionId) {
        url.searchParams.set('bridgeSessionId', bridgeSessionId);
      }
      return url.href;
    } catch {
      return urlText;
    }
  };

  const applyRenewedEditorArtifactToken = (renewedToken) => {
    if (typeof renewedToken !== 'string' || !renewedToken) return false;
    const markerSegment = '/editor-artifact-token/';
    let locationBase = null;
    try {
      locationBase = new URL('./', window.location.href).href;
    } catch {
      locationBase = null;
    }
    const candidates = [window.config?.url?.frontend, locationBase];
    const currentBase = candidates.find((value) => typeof value === 'string' && value.includes(markerSegment));
    if (!currentBase) return false;
    const tokenStart = currentBase.indexOf(markerSegment) + markerSegment.length;
    const tokenEnd = currentBase.indexOf('/', tokenStart);
    if (tokenEnd === -1) return false;
    const previousToken = currentBase.slice(tokenStart, tokenEnd);
    if (!previousToken || previousToken === renewedToken) return false;
    const nextBase = currentBase.slice(0, tokenStart) + renewedToken + currentBase.slice(tokenEnd);
    if (!window.config || !window.config.url || typeof window.config.url !== 'object') return false;
    // Late-loaded workers/wasm/code-editor assets resolve their absolute URLs
    // from these captured bases, so all three must switch to the renewed
    // token together or late subresource loads would keep using the expired
    // one and rely on the short-lived server-side grace window.
    window.config.url.frontend = nextBase;
    window.config.url.engine = new URL('js/playcanvas-engine.js', nextBase).href;
    window.config.url.static = nextBase.replace(/\\/$/, '');
    marker.appliedEditorArtifactToken = renewedToken;
    marker.lastEditorArtifactTokenRenewalAt = Date.now();
    return true;
  };

  const readCompatibilityTokenClaims = (token) => {
    if (typeof token !== 'string') return null;
    const [encodedPayload, signature, extra] = token.split('.');
    if (!encodedPayload || !signature || extra) return null;
    try {
      const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  const isUsableFullBootAccessToken = (token) => {
    const claims = readCompatibilityTokenClaims(token);
    return (
      claims?.mode === 'universo-full-upstream-ui' &&
      typeof claims.expiresAt === 'number' &&
      claims.expiresAt - 30000 > Date.now()
    );
  };

  const isUsableRestCompatibilityConfig = (compatibilityConfig) => {
    const hasRestConfig =
      compatibilityConfig?.auth?.scheme === 'signed-header' &&
      typeof compatibilityConfig.auth.accessToken === 'string' &&
      typeof compatibilityConfig.auth.headerName === 'string' &&
      typeof compatibilityConfig.endpoints?.assets === 'string';
    if (!hasRestConfig) return false;
    const claims = readCompatibilityTokenClaims(compatibilityConfig.auth.accessToken);
    return !claims || typeof claims.origin !== 'string' || claims.origin === window.location.origin;
  };

  const refreshFullBootAccessToken = async (force = false) => {
    if (marker.fullBootMode !== true) return window.config?.accessToken || null;
    const existingToken =
      (typeof marker.compatibilityConfig?.accessToken === 'string' && marker.compatibilityConfig.accessToken) ||
      (typeof window.config?.accessToken === 'string' && window.config.accessToken) ||
      null;
    if (!force && isUsableFullBootAccessToken(existingToken)) {
      window.config.accessToken = existingToken;
      return existingToken;
    }
    if (marker.fullBootAccessTokenRefreshPromise) return marker.fullBootAccessTokenRefreshPromise;
    const refreshUrl = resolveFullBootTokenRefreshUrl();
    if (!refreshUrl) return force ? null : window.config?.accessToken || null;
    marker.fullBootAccessTokenRefreshPromise = fetch(appendArtifactOriginParams(refreshUrl), {
      credentials: 'include',
      cache: 'no-store'
    })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((body) => {
        const config = body?.item || null;
        if (config?.mode === 'universo-full-upstream-ui' && typeof config.accessToken === 'string') {
          window.config.accessToken = config.accessToken;
          if (config.universoBridge && typeof config.universoBridge === 'object') {
            window.config.universoBridge = config.universoBridge;
            const proof = config.universoBridge.compatibilityCsrfToken;
            if (proof && typeof proof === 'object' && typeof proof.token === 'string' && typeof proof.headerName === 'string') {
              marker.fullBootCompatibilityCsrfToken = { token: proof.token, headerName: proof.headerName };
            }
          }
          applyRenewedEditorArtifactToken(body?.artifactToken);
          marker.compatibilityConfig = window.config;
          marker.fullBootAccessTokenRefreshedAt = Date.now();
          return config.accessToken;
        }
        return force ? null : window.config?.accessToken || null;
      })
      .catch((error) => {
        marker.fullBootAccessTokenRefreshError = error;
        return force ? null : window.config?.accessToken || null;
      })
      .finally(() => {
        marker.fullBootAccessTokenRefreshPromise = null;
      });
    return marker.fullBootAccessTokenRefreshPromise;
  };

  const resolveRestCompatibilityConfig = async () => {
    let compatibilityConfig =
      marker.restCompatibilityConfig ||
      (marker.restCompatibilityConfigPromise ? await marker.restCompatibilityConfigPromise.catch(() => null) : null) ||
      null;
    if (isUsableRestCompatibilityConfig(compatibilityConfig)) return compatibilityConfig;
    if (typeof window.config?.universoBridge?.compatibilityRestBaseUrl !== 'string') return null;
    const restConfigUrl = appendArtifactOriginParams(
      window.config.universoBridge.compatibilityRestBaseUrl.replace(/\\/$/, '') +
        '/config?mode=universo-compatibility-rest-minimal'
    );
    marker.restCompatibilityConfigPromise = fetch(restConfigUrl, {
      credentials: 'include',
      cache: 'no-store'
    })
      .then(async (response) => (response.ok ? (await response.json())?.item || null : null))
      .then((config) => {
        marker.restCompatibilityConfig = config;
        return config;
      })
      .catch((error) => {
        marker.restCompatibilityConfigError = error;
        return null;
      });
    compatibilityConfig = await marker.restCompatibilityConfigPromise;
    return isUsableRestCompatibilityConfig(compatibilityConfig) ? compatibilityConfig : null;
  };

  const readPlainObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

  const normalizeCompatibilityMaterialData = (value) => {
    const data = readPlainObject(value);
    if (!data) return null;
    const normalized = { ...data };
    if (normalized.blendType === 'additive') normalized.blendType = 1;
    if (normalized.blendType === 'normal') normalized.blendType = 2;
    if (typeof normalized.opacity === 'number' && normalized.opacity < 1 && typeof normalized.alphaTest !== 'number') {
      normalized.alphaTest = 0;
    }
    if (typeof normalized.useFog !== 'boolean') normalized.useFog = true;
    if (typeof normalized.useLighting !== 'boolean') normalized.useLighting = true;
    if (typeof normalized.useSkybox !== 'boolean') normalized.useSkybox = false;
    if (typeof normalized.shader !== 'string') normalized.shader = 'blinn';
    return normalized;
  };

  const readCompatibilityAssetEditorDocument = (asset) => {
    const metadata = readPlainObject(asset?.metadata);
    const editorDocument = readPlainObject(metadata?.editorDocument);
    const data = editorDocument && Object.prototype.hasOwnProperty.call(editorDocument, 'data') ? editorDocument.data : metadata?.data;
    const meta = editorDocument && Object.prototype.hasOwnProperty.call(editorDocument, 'meta') ? editorDocument.meta : metadata?.meta;
    return { metadata, editorDocument, data, meta };
  };

  const parseCanonicalAssetDocumentId = (value) => {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
    }
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || value.length > 10) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : null;
  };

  const mapCompatibilityAssetToPlayCanvasAsset = (asset) => {
    const explicitEditorDocumentId = parseCanonicalAssetDocumentId(asset?.editorDocumentId);
    const stableAssetId = typeof asset?.stableAssetId === 'string' && asset.stableAssetId.trim() ? asset.stableAssetId.trim() : null;
    const embeddedAssetId = stableAssetId ? parseCanonicalAssetDocumentId(asset?.id) : null;
    const id = explicitEditorDocumentId ?? embeddedAssetId;
    if (!id) return null;
    const { metadata, editorDocument, data, meta } = readCompatibilityAssetEditorDocument(asset);
    const virtualPath = typeof asset.virtualPath === 'string' && asset.virtualPath.trim() ? asset.virtualPath.trim() : asset.name || 'asset';
    const filename = virtualPath.split('/').filter(Boolean).pop() || asset.name || String(id);
    const type = typeof asset.type === 'string' && asset.type ? asset.type : 'json';
    const editorData = type === 'material' ? normalizeCompatibilityMaterialData(data) : data ?? null;
    return {
      id,
      uniqueId: id,
      item_id: id,
      branch_id: window.config?.self?.branch?.id || window.config?.scene?.id || null,
      project: window.config?.project?.id || null,
      type,
      name: typeof asset.name === 'string' && asset.name ? asset.name : filename,
      file: asset.hash
        ? {
            filename,
            hash: asset.hash,
            size: Number.isInteger(asset.size) ? asset.size : 0,
            url: '',
            variants: null
          }
        : null,
      path: Array.isArray(asset.editorPathDocumentIds)
        ? asset.editorPathDocumentIds.filter((ancestorId) => Number.isInteger(ancestorId) && ancestorId > 0)
        : [],
      createdAt: typeof asset.createdAt === 'string' ? asset.createdAt : null,
      tags: Array.isArray(editorDocument?.tags) ? editorDocument.tags.filter((tag) => typeof tag === 'string') : [],
      data: editorData,
      meta: meta ?? null,
      metadata:
        metadata && typeof metadata === 'object'
          ? {
              ...metadata,
              ...(editorData && typeof editorData === 'object' && !metadata.data ? { data: editorData } : {})
            }
          : editorData && typeof editorData === 'object'
            ? { data: editorData }
            : undefined,
      preload: typeof editorDocument?.preload === 'boolean' ? editorDocument.preload : true,
      source: typeof editorDocument?.source === 'boolean' ? editorDocument.source : false
    };
  };

  const isRestCompatibilityAssetEndpointAllowed = (restConfig, assetsEndpoint) => {
    if (assetsEndpoint.origin === window.location.origin) return true;
    const endpoints = restConfig?.endpoints && typeof restConfig.endpoints === 'object' ? restConfig.endpoints : {};
    return Object.values(endpoints).some((endpoint) => {
      if (typeof endpoint !== 'string') return false;
      try {
        return new URL(endpoint, window.location.href).origin === assetsEndpoint.origin;
      } catch {
        return false;
      }
    });
  };

  const loadFullBootAssets = async () => {
    const loadedScenePayload = readLoadedScenePayload(marker.lastLoadedScene);
    const loadedSceneAssets = Array.isArray(loadedScenePayload?.assets)
      ? loadedScenePayload.assets.map(mapCompatibilityAssetToPlayCanvasAsset).filter(Boolean)
      : null;
    if (loadedSceneAssets) {
      rememberSceneLocalAssets(loadedSceneAssets);
      marker.lastLoadedSceneAssetCount = loadedSceneAssets.length;
      marker.lastLoadedSceneAssetIds = loadedSceneAssets.map((asset) => asset.id).slice(0, 256);
      installMergedFullBootAssets();
    }
    if (marker.fullBootAssetsPromise) {
      return marker.fullBootAssetsPromise.then(() => installMergedFullBootAssets());
    }
    if (marker.fullBootStorageAssetsById && typeof marker.fullBootStorageAssetsById === 'object') {
      return installMergedFullBootAssets();
    }
    marker.fullBootAssetLoadState = 'loading';
    const loadPromise = (async () => {
      const maxAttempts = 2;
      const createLoadError = (message, retryable = true) => {
        const error = new Error(message);
        error.retryable = retryable;
        return error;
      };
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        marker.fullBootAssetLoadAttempts = attempt;
        try {
          const restConfig = await resolveRestCompatibilityConfig();
          if (!restConfig) {
            throw createLoadError('Full-boot asset compatibility configuration could not be loaded');
          }

          let assetsEndpoint;
          try {
            assetsEndpoint = new URL(restConfig.endpoints.assets, window.location.href);
          } catch {
            throw createLoadError('Full-boot asset compatibility endpoint is invalid', false);
          }
          if (!isRestCompatibilityAssetEndpointAllowed(restConfig, assetsEndpoint)) {
            throw createLoadError('Full-boot asset compatibility endpoint is not allowlisted', false);
          }

          const createRequestInit = () =>
            marker.fullBootMode === true && typeof window.config?.accessToken === 'string'
              ? {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    [restConfig.auth.headerName]: window.config.accessToken
                  },
                  cache: 'no-store'
                }
              : withRestCompatibilityAuthHeaders(
                    {
                      method: 'GET',
                      credentials: 'include',
                      cache: 'no-store'
                    },
                    restConfig
                );
          const response = await fetch(restConfig.endpoints.assets, createRequestInit());
          if (response.status === 401) {
            marker.lastFullBootAssetLoadStatus = response.status;
            if (attempt >= maxAttempts) {
              throw createLoadError('Full-boot asset request remained unauthorized after token refresh', false);
            }
            marker.fullBootAssetLoadRefreshAttempts = (Number(marker.fullBootAssetLoadRefreshAttempts) || 0) + 1;
            const refreshedToken = await refreshFullBootAccessToken(true);
            if (!refreshedToken) {
              throw createLoadError('Full-boot asset access token refresh failed after an unauthorized response', false);
            }
            throw createLoadError('Full-boot asset request will retry after access token refresh');
          }
          if (!response.ok) {
            marker.lastFullBootAssetLoadStatus = response.status;
            throw createLoadError(
              'Full-boot asset request failed with status ' + response.status,
              response.status >= 500
            );
          }

          let body;
          try {
            body = await response.json();
          } catch {
            throw createLoadError('Full-boot asset request returned invalid JSON');
          }
          if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.items)) {
            throw createLoadError('Full-boot asset request returned an invalid items payload');
          }
          const seenAssetIds = new Set();
          const assets = body.items.map((asset) => {
            if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
              throw createLoadError('Full-boot asset request returned an invalid asset item');
            }
            const mappedAsset = mapCompatibilityAssetToPlayCanvasAsset(asset);
            if (!mappedAsset) {
              throw createLoadError('Full-boot asset request returned an unaddressable asset item');
            }
            if (seenAssetIds.has(mappedAsset.id)) {
              throw createLoadError('Full-boot asset request returned duplicate asset identifiers', false);
            }
            seenAssetIds.add(mappedAsset.id);
            return mappedAsset;
          });
          marker.fullBootStorageAssetsById = Object.fromEntries(assets.map((asset) => [String(asset.id), asset]));
          marker.fullBootAssetLoadState = 'ready';
          return installMergedFullBootAssets();
        } catch (error) {
          lastError = error;
          marker.lastFullBootAssetLoadError = error && typeof error.message === 'string' ? error.message : String(error);
          if (attempt >= maxAttempts || error?.retryable === false) {
            throw error;
          }
          marker.fullBootAssetLoadRetries = (Number(marker.fullBootAssetLoadRetries) || 0) + 1;
        }
      }
      throw lastError || new Error('Full-boot asset request did not return a response');
    })();
    const trackedPromise = loadPromise
      .catch((error) => {
        marker.fullBootAssetLoadState = 'failed';
        marker.lastFullBootAssetLoadError = error && typeof error.message === 'string' ? error.message : String(error);
        // A scene-local merge may have populated the derived map before the
        // remote asset request failed. Do not leave that empty/partial map
        // looking like a successful storage cache; the next call must retry
        // the compatibility request and rebuild the merged view.
        marker.fullBootAssetsById = null;
        marker.fullBootStorageAssetsById = null;
        if (marker.fullBootAssetsPromise === trackedPromise) marker.fullBootAssetsPromise = null;
        throw error;
      });
    marker.fullBootAssetsPromise = trackedPromise;
    return trackedPromise;
  };

  const loadFullBootAssetForEditor = (editorInstance, uniqueId, callback) => {
    if (marker.fullBootMode !== true || typeof callback !== 'function') return false;
    const requestedId = String(uniqueId ?? '');
    marker.fullBootAssetLoadRequests = (Number(marker.fullBootAssetLoadRequests) || 0) + 1;
    void loadFullBootAssets()
      .then((assets) => {
        const asset = assets.find((candidate) =>
          getAssetIdentityKeys(candidate).some((identityKey) => identityKey === requestedId)
        );
        if (!asset) {
          marker.lastFullBootAssetLoadMiss = requestedId;
          callback();
          return;
        }
        installHostedAssetAdapter(editorInstance, assets);
        const observer =
          safeEditorCall(editorInstance, 'assets:get', asset.id) ||
          safeEditorCall(editorInstance, 'assets:getUnique', asset.uniqueId ?? asset.id);
        marker.fullBootAssetLoadResolved = (Number(marker.fullBootAssetLoadResolved) || 0) + 1;
        callback(observer || undefined);
      })
      .catch((error) => {
        marker.lastFullBootAssetLoadError = error && typeof error.message === 'string' ? error.message : String(error);
        callback();
      });
    return true;
  };

  const createFullBootBranchPayload = () => {
    const configBranch = window.config?.self?.branch && typeof window.config.self.branch === 'object' ? window.config.self.branch : {};
    const projectBranch = window.config?.branch && typeof window.config.branch === 'object' ? window.config.branch : {};
    const id =
      typeof configBranch.id === 'string' && configBranch.id
        ? configBranch.id
        : typeof projectBranch.id === 'string' && projectBranch.id
          ? projectBranch.id
          : 'universo-local-branch';
    const name =
      typeof configBranch.name === 'string' && configBranch.name
        ? configBranch.name
        : typeof projectBranch.name === 'string' && projectBranch.name
          ? projectBranch.name
          : 'Main';
    return {
      ...projectBranch,
      ...configBranch,
      id,
      name,
      closed: configBranch.closed === true || projectBranch.closed === true,
      merge: configBranch.merge || projectBranch.merge || null,
      latestCheckpointId:
        typeof configBranch.latestCheckpointId === 'string' && configBranch.latestCheckpointId
          ? configBranch.latestCheckpointId
          : typeof projectBranch.latestCheckpointId === 'string' && projectBranch.latestCheckpointId
            ? projectBranch.latestCheckpointId
            : id
    };
  };

  const createFullBootProjectPayload = () => {
    const project = window.config?.project && typeof window.config.project === 'object' ? window.config.project : {};
    const branch = createFullBootBranchPayload();
    return {
      ...project,
      id: project.id,
      name: typeof project.name === 'string' && project.name ? project.name : 'Universo Project',
      description: typeof project.description === 'string' ? project.description : '',
      private: project.private !== false,
      private_assets: project.privateAssets === true || project.private_assets === true,
      privateAssets: project.privateAssets === true || project.private_assets === true,
      access_level: typeof project.access_level === 'string' ? project.access_level : 'write',
      owner: window.config?.owner?.id || project.owner || null,
      owner_id: window.config?.owner?.id || project.owner_id || null,
      thumbnails: project.thumbnails && typeof project.thumbnails === 'object' ? project.thumbnails : {},
      settings: project.settings && typeof project.settings === 'object' ? project.settings : {},
      masterBranch: typeof project.masterBranch === 'string' && project.masterBranch ? project.masterBranch : branch.id,
      primaryApp: project.primaryApp || null,
      playUrl: typeof project.playUrl === 'string' && project.playUrl ? project.playUrl : '/'
    };
  };

  const createFullBootUserPayload = (requestedUserId) => {
    const self = window.config?.self && typeof window.config.self === 'object' ? window.config.self : {};
    const owner = window.config?.owner && typeof window.config.owner === 'object' ? window.config.owner : {};
    const id = requestedUserId || self.id || owner.id || 'universo-editor-user';
    const username =
      typeof self.username === 'string' && self.username
        ? self.username
        : typeof owner.username === 'string' && owner.username
          ? owner.username
          : 'universo';
    return {
      id,
      username,
      email: typeof self.email === 'string' ? self.email : '',
      full_name: username,
      name: username,
      size: Number.isFinite(owner.size) ? owner.size : 0,
      thumbnails: {}
    };
  };

  const createFullBootConfigResponseBody = (mode) => {
    if (mode === 'universo-compatibility-rest-minimal') {
      const config = marker.restCompatibilityConfig || window.config?.universoRestCompatibilityConfig || null;
      return config ? { item: config } : null;
    }
    if (mode === 'universo-full-upstream-ui') {
      const config =
        marker.compatibilityConfig ||
        window.config?.universoCompatibilityConfig ||
        (window.config?.mode === 'universo-full-upstream-ui' ? window.config : null);
      return config ? { item: config } : null;
    }
    return null;
  };

  const createFullBootCloudApiResponse = (method, requestUrl) => {
    if (String(method || 'GET').toUpperCase() !== 'GET') return null;
    try {
      const url = new URL(requestUrl, window.location.href);
      if (/\\/config$/.test(url.pathname)) {
        const body = createFullBootConfigResponseBody(url.searchParams.get('mode'));
        if (body) return { status: 200, body };
      }
      if (!window.config?.project?.id) return null;
      const numericProjectId = String(window.config.project.id);
      const numericSceneId = String(window.config.scene?.uniqueId || window.config.scene?.id || '');
      if (url.pathname === '/api/projects/' + numericProjectId) {
        return { status: 200, body: createFullBootProjectPayload() };
      }
      if (url.pathname === '/api/projects/' + numericProjectId + '/branches') {
        const branch = createFullBootBranchPayload();
        const favoriteOnly = url.searchParams.get('favorite') === 'true';
        const closedOnly = url.searchParams.get('closed') === 'true';
        const result = closedOnly || (favoriteOnly && branch.id !== createFullBootProjectPayload().masterBranch) ? [] : [branch];
        return {
          status: 200,
          body: {
            result,
            pagination: { hasMore: false }
          }
        };
      }
      if (url.pathname === '/api/projects/' + numericProjectId + '/scenes') {
        return {
          status: 200,
          body: {
            result: [
              {
                id: window.config.scene.id,
                uniqueId: window.config.scene.uniqueId,
                name: window.config.project?.name || 'Main Scene',
                project_id: window.config.project.id,
                branch_id: window.config.self?.branch?.id || window.config.scene.id
              }
            ]
          }
        };
      }
      if (numericSceneId && url.pathname === '/api/scenes/' + numericSceneId) {
        return {
          status: 200,
          body: {
            id: window.config.scene.id,
            uniqueId: window.config.scene.uniqueId,
            name: window.config.project?.name || 'Main Scene',
            project_id: window.config.project.id,
            branch_id: window.config.self?.branch?.id || window.config.scene.id
          }
        };
      }
      if (url.pathname === '/api/projects/' + numericProjectId + '/assets') {
        return { status: 200, bodyPromise: loadFullBootAssets() };
      }
      const fullBootAssetMatch = /^\\/api\\/assets\\/([^/]+)$/.exec(url.pathname);
      if (fullBootAssetMatch) {
        const assetId = decodeURIComponent(fullBootAssetMatch[1]);
        return {
          status: 200,
          bodyPromise: loadFullBootAssets().then((assets) => assets.find((asset) => String(asset.id) === assetId) || { error: 'notFound' })
        };
      }
      const userMatch = /^\\/api\\/users\\/([^/?]+)$/.exec(url.pathname);
      if (userMatch) {
        return { status: 200, body: createFullBootUserPayload(decodeURIComponent(userMatch[1])) };
      }
      // Fail-safe for any other editor-api REST GET (for example the
      // v2.30.4 builds/apps/repositories/collaborators/activity endpoints
      // that the upstream Editor probes during boot or picker setup).
      // Without this branch the request falls through to native, the
      // static artifact server answers with HTML (200) or an empty body
      // (204), and the upstream editor-api Ajax loader throws an invalid
      // json error when it runs JSON.parse on that body. We are a
      // single-user, cloud-only no-op surface, so an empty list or empty
      // object is the correct compatibility answer. List-shaped paths get
      // a paginated empty result; everything else gets an empty object.
      if (/^\\/api\\/projects\\/[^/]+\\//.test(url.pathname) || /^\\/api\\/(projects|scenes|assets|branches|checkpoints|merge|jobs|store|apps)\\b/.test(url.pathname)) {
        const listShaped = /(builds|apps|repositories|collaborators|activity|branches|scenes|assets|checkpoints)(\\b|\\/|\\?|$)/.test(url.pathname);
        return {
          status: 200,
          body: listShaped ? { result: [], pagination: { hasMore: false, total: 0 } } : {}
        };
      }
    } catch {}
    return null;
  };

  const isRestCompatibilityEndpointUrl = (requestUrl, restConfig) => {
    if (!restConfig || typeof requestUrl !== 'string') return false;
    try {
      const url = new URL(requestUrl, window.location.href);
      const endpointUrls = [
        restConfig.endpoints?.assets,
        restConfig.endpoints?.scenes,
        restConfig.endpoints?.sourcefiles,
        restConfig.endpoints?.settings,
        restConfig.endpoints?.cloudOnly
      ].filter((value) => typeof value === 'string' && value);
      return endpointUrls.some((endpoint) => {
        try {
          const endpointUrl = new URL(endpoint, window.location.href);
          return url.origin === endpointUrl.origin && (url.pathname === endpointUrl.pathname || url.pathname.startsWith(endpointUrl.pathname + '/'));
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  };

  const isAssetCompatibilityRequestUrl = (requestUrl, restConfig = marker.restCompatibilityConfig) => {
    if (typeof requestUrl !== 'string') return false;
    try {
      const url = new URL(requestUrl, window.location.href);
      if (/^\\/api\\/assets(?:\\/|$)/.test(url.pathname)) return true;
      const endpoint = restConfig?.endpoints?.assets;
      if (typeof endpoint !== 'string' || !endpoint) return false;
      const endpointUrl = new URL(endpoint, window.location.href);
      return url.origin === endpointUrl.origin && (url.pathname === endpointUrl.pathname || url.pathname.startsWith(endpointUrl.pathname + '/'));
    } catch {
      return false;
    }
  };

  const resolveCompatibilityAccessToken = (requestUrl, restConfig) => {
    if (
      marker.fullBootMode === true &&
      isAssetCompatibilityRequestUrl(requestUrl, restConfig) &&
      typeof window.config?.accessToken === 'string' &&
      window.config.accessToken
    ) {
      return window.config.accessToken;
    }
    return typeof restConfig?.auth?.accessToken === 'string' ? restConfig.auth.accessToken : '';
  };

  const resolveCompatibilityCsrfProof = (requestUrl, restConfig) => {
    const fullBootAssetRequest = marker.fullBootMode === true && isAssetCompatibilityRequestUrl(requestUrl, restConfig);
    const candidate = fullBootAssetRequest ? marker.fullBootCompatibilityCsrfToken : null;
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.token === 'string' &&
      candidate.token &&
      typeof candidate.headerName === 'string' &&
      candidate.headerName
    ) {
      return candidate;
    }
    if (fullBootAssetRequest) return null;
    const configuredProof = restConfig?.csrf;
    if (
      configuredProof &&
      typeof configuredProof === 'object' &&
      typeof configuredProof.token === 'string' &&
      configuredProof.token &&
      typeof configuredProof.headerName === 'string' &&
      configuredProof.headerName
    ) {
      return {
        token: configuredProof.token,
        headerName: configuredProof.headerName
      };
    }
    const sessionProof = marker.compatibilityCsrfToken;
    if (
      sessionProof &&
      typeof sessionProof === 'object' &&
      typeof sessionProof.token === 'string' &&
      sessionProof.token &&
      typeof sessionProof.headerName === 'string' &&
      sessionProof.headerName
    ) {
      return sessionProof;
    }
    return null;
  };

  const withRestCompatibilityAuthHeaders = (init, restConfig, options = {}) => {
    if (
      !restConfig?.auth ||
      restConfig.auth.scheme !== 'signed-header' ||
      typeof restConfig.auth.headerName !== 'string' ||
      typeof restConfig.auth.accessToken !== 'string'
    ) {
      return init || {};
    }
    const accessToken =
      typeof options.accessToken === 'string' && options.accessToken
        ? options.accessToken
        : restConfig.auth.accessToken;
    const nextInit = { ...(init || {}) };
    const headers = new Headers(nextInit.headers || {});
    headers.set(restConfig.auth.headerName, accessToken);
    nextInit.headers = headers;
    return nextInit;
  };

  // Editor asset surface ("/api/assets*"): rewritten onto the Universo
  // compatibility REST router so metadata/create/delete/file-content reach our backend
  // with signed-header auth + CSRF instead of falling through to the platform
  // SPA fallback (which answers HTML with 200 — the original SyntaxError bug).
  const EDITOR_ASSET_COMPATIBILITY_ROUTES = [
    { re: /^\\/api\\/assets\\/?$/, methods: ['POST', 'DELETE'] },
    { re: /^\\/api\\/assets\\/([^/]+)$/, methods: ['GET', 'PUT'] },
    { re: /^\\/api\\/assets\\/([^/]+)\\/file\\/([^/?]+)$/, methods: ['GET'] }
  ];

  const resolveEditorAssetCompatibilityUrl = (method, requestUrl) => {
    const restConfig = marker.restCompatibilityConfig;
    const assetsEndpoint = restConfig?.endpoints?.assets;
    if (typeof assetsEndpoint !== 'string' || !assetsEndpoint || typeof requestUrl !== 'string') return null;
    const normalizedMethod = String(method || 'GET').toUpperCase();
    let pathname = '';
    let search = '';
    try {
      const parsed = new URL(requestUrl, window.location.href);
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      return null;
    }
    // Keep the file route explicit.  The generated bundle is evaluated in the
    // browser, where RegExp#source escaping is not a stable routing contract;
    // deriving the target shape from that string previously collapsed
    // '/file/:filename' into the metadata route and produced a 404.
    const fileMatch = /^\\/api\\/assets\\/([^/]+)\\/file\\/([^/?]+)$/.exec(pathname);
    if (fileMatch && normalizedMethod === 'GET') {
      const assetId = encodeURIComponent(decodeURIComponent(fileMatch[1]));
      const filename = encodeURIComponent(decodeURIComponent(fileMatch[2]));
      return assetsEndpoint + '/' + assetId + '/file/' + filename + search;
    }
    for (const route of EDITOR_ASSET_COMPATIBILITY_ROUTES) {
      const match = route.re.exec(pathname);
      if (!match || !route.methods.includes(normalizedMethod)) continue;
      const suffix = match.slice(1)
        .map((part) => encodeURIComponent(decodeURIComponent(part)))
        .join('/');
      return assetsEndpoint + (suffix ? '/' + suffix : '') + search;
    }
    // Any other editor asset-surface request under /api/assets must be answered
    // by the compatibility router with fail-closed JSON, never by the SPA
    // fallback. NOTE: the project-assets LIST (/api/projects/:id/assets) is
    // intentionally NOT rewritten — the full-boot adapter answers it
    // synthetically before this table runs for GET, and the editor never issues
    // other methods against that route.
    if (/^\\/api\\/assets\\b/.test(pathname)) {
      return assetsEndpoint + '/-unsupported';
    }
    // Keep the project-scoped asset surface fail-closed for non-GET calls as
    // well. The exact GET collection request is synthesized above; mutating
    // variants must never fall through to the artifact SPA HTML response.
    const projectAssetsPath = /^\\/api\\/projects\\/[^/]+\\/assets(?:\\/|$)/.test(pathname);
    const projectAssetsCollectionPath = /^\\/api\\/projects\\/[^/]+\\/assets\\/?$/.test(pathname);
    if (projectAssetsPath && !(projectAssetsCollectionPath && normalizedMethod === 'GET')) {
      return assetsEndpoint + '/-unsupported';
    }
    return null;
  };

  const withEditorAssetCsrfHeader = (init, method, requestUrl, restConfig = marker.restCompatibilityConfig) => {
    const normalizedMethod = String(method || 'GET').toUpperCase();
    if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return init || {};
    const proof = resolveCompatibilityCsrfProof(requestUrl, restConfig);
    const headerName = proof?.headerName || restConfig?.csrf?.headerName || 'X-CSRF-Token';
    const token = proof?.token || '';
    if (!token) return init || {};
    const nextInit = { ...(init || {}) };
    const headers = new Headers(nextInit.headers || {});
    if (!headers.has(headerName)) headers.set(headerName, token);
    nextInit.headers = headers;
    return nextInit;
  };

  const installFullBootXmlHttpRequestAuthAdapter = () => {
    if (
      marker.fullBootXmlHttpRequestAuthAdapterInstalled ||
      marker.fullBootMode !== true ||
      typeof window.XMLHttpRequest !== 'function'
    ) {
      return;
    }
    const NativeXMLHttpRequest = window.XMLHttpRequest;
    const SyntheticXMLHttpRequest = function UniversoFullBootXmlHttpRequest() {
      const native = new NativeXMLHttpRequest();
      const listeners = new Map();
      let synthetic = null;
      let requestMethod = 'GET';
      let requestUrl = '';
      let readyState = 0;
      let status = 0;
      let responseText = '';
      let response = '';
      const eventHandlerTypes = ['readystatechange', 'loadstart', 'progress', 'abort', 'error', 'load', 'timeout', 'loadend'];
      const eventHandlers = new Map();

      const createXmlHttpRequestEvent = (type, nativeEvent) => ({
        type,
        target: this,
        currentTarget: this,
        lengthComputable: Boolean(nativeEvent?.lengthComputable),
        loaded: typeof nativeEvent?.loaded === 'number' ? nativeEvent.loaded : 0,
        total: typeof nativeEvent?.total === 'number' ? nativeEvent.total : 0,
        nativeEvent: nativeEvent || null
      });

      const invokeEventHandler = (handler, event) => {
        if (typeof handler === 'function') {
          try {
            handler.call(this, event);
          } catch (error) {
            setTimeout(() => {
              throw error;
            }, 0);
          }
        }
      };

      const dispatchSyntheticEvent = (type) => {
        const event = createXmlHttpRequestEvent(type);
        invokeEventHandler(eventHandlers.get(type), event);
        const items = listeners.get(type);
        if (items) {
          for (const listener of Array.from(items)) {
            invokeEventHandler(listener, event);
          }
        }
      };

      const eventHandlerProperties = {};
      for (const type of eventHandlerTypes) {
        eventHandlerProperties['on' + type] = {
          get: () => eventHandlers.get(type) || null,
          set: (handler) => {
            if (typeof handler === 'function') {
              eventHandlers.set(type, handler);
              native['on' + type] = (event) => invokeEventHandler(handler, createXmlHttpRequestEvent(type, event));
            } else {
              eventHandlers.delete(type);
              native['on' + type] = null;
            }
          }
        };
      }

      Object.defineProperties(this, {
        ...eventHandlerProperties,
        readyState: { get: () => (synthetic ? readyState : native.readyState) },
        status: { get: () => (synthetic ? status : native.status) },
        responseText: { get: () => (synthetic ? responseText : native.responseText) },
        response: { get: () => (synthetic ? response : native.response) },
        responseURL: { get: () => (synthetic ? new URL(requestUrl, window.location.href).href : native.responseURL) },
        upload: { get: () => native.upload },
        withCredentials: {
          get: () => native.withCredentials,
          set: (value) => {
            native.withCredentials = value;
          }
        },
        timeout: {
          get: () => native.timeout,
          set: (value) => {
            native.timeout = value;
          }
        },
        responseType: {
          get: () => native.responseType,
          set: (value) => {
            native.responseType = value;
          }
        }
      });

      this.open = (method, url, ...args) => {
        requestMethod = method || 'GET';
        requestUrl = typeof url === 'string' ? url : String(url?.url || url || '');
        const compatibilityUrl = resolveEditorAssetCompatibilityUrl(requestMethod, requestUrl);
        if (compatibilityUrl) {
          requestUrl = compatibilityUrl;
        }
        this.__universoRestCompatibilityRequestUrl = requestUrl;
        synthetic = createFullBootCloudApiResponse(requestMethod, requestUrl);
        if (synthetic) {
          readyState = 1;
          return undefined;
        }
        return native.open(method, requestUrl, ...args);
      };

      this.send = (...args) => {
        const restConfig = marker.restCompatibilityConfig;
        const isCompatibilityRequest =
          !synthetic &&
          isRestCompatibilityEndpointUrl(this.__universoRestCompatibilityRequestUrl, restConfig) &&
          restConfig?.auth?.scheme === 'signed-header' &&
          typeof restConfig.auth.headerName === 'string' &&
          typeof restConfig.auth.accessToken === 'string';
        const normalizedSendMethod = String(requestMethod || 'GET').toUpperCase();
        const isCompatibilityWrite = isCompatibilityRequest && normalizedSendMethod !== 'GET' && normalizedSendMethod !== 'HEAD';
        const usesFullBootCredentials =
          marker.fullBootMode === true && isAssetCompatibilityRequestUrl(this.__universoRestCompatibilityRequestUrl, restConfig);
        // XMLHttpRequest appends repeated header values instead of replacing
        // them. Writes set the signed token only after the asynchronous refresh
        // below; setting it here as well would produce a comma-joined old/fresh token
        // and make the HMAC token fail closed at the backend.
        if (isCompatibilityRequest && !isCompatibilityWrite) {
          try {
            const accessToken = resolveCompatibilityAccessToken(this.__universoRestCompatibilityRequestUrl, restConfig);
            native.setRequestHeader(restConfig.auth.headerName, accessToken);
          } catch (error) {
            marker.lastXmlHttpRequestAuthHeaderError = error && typeof error.message === 'string' ? error.message : String(error);
          }
        }
        if (isCompatibilityWrite) {
            // Full-boot asset writes need a fresh full-boot token and proof;
            // source-file/settings writes use the REST token/proof issued by
            // the compatibility config. A session CSRF request remains the
            // same-origin fallback when a signed proof is unavailable.
            void Promise.all([
                usesFullBootCredentials ? refreshFullBootAccessToken().catch(() => null) : Promise.resolve(null),
                fetch(
                    restConfig.csrf?.tokenUrl ||
                        new URL('/api/v1/auth/csrf', restConfig.endpoints?.assets || window.location.href).toString(),
                    { credentials: 'include', cache: 'no-store' }
                )
                    .then((response) => (response.ok ? response.json() : null))
                    .catch(() => null)
            ])
                .then(([token, csrf]) => {
                    const freshToken = usesFullBootCredentials
                        ? (typeof token === 'string' && token) || resolveCompatibilityAccessToken(this.__universoRestCompatibilityRequestUrl, restConfig)
                        : restConfig.auth.accessToken;
                    try {
                        native.setRequestHeader(restConfig.auth.headerName, freshToken);
                    } catch (error) {
                        marker.lastXmlHttpRequestAuthHeaderError = error && typeof error.message === 'string' ? error.message : String(error);
                    }
                    // Prefer the proof bound to this request's token. A
                    // sandboxed cross-origin frame cannot send the host
                    // session cookie, so the fetched session token is only a
                    // same-origin fallback.
                    const proof = resolveCompatibilityCsrfProof(this.__universoRestCompatibilityRequestUrl, restConfig);
                    const csrfToken =
                        proof?.token ||
                        (typeof csrf?.token === 'string'
                            ? csrf.token
                            : typeof csrf?.csrfToken === 'string'
                            ? csrf.csrfToken
                            : '');
                    if (csrfToken) {
                        const csrfHeaderName = proof?.headerName || restConfig.csrf?.headerName || 'X-CSRF-Token';
                        try {
                            native.setRequestHeader(csrfHeaderName, csrfToken);
                        } catch (error) {
                            marker.lastXmlHttpRequestAuthHeaderError = error && typeof error.message === 'string' ? error.message : String(error);
                        }
                    }
                    return native.send(...args);
                })
                .catch((error) => {
                  marker.lastXmlHttpRequestAuthHeaderError =
                    error && typeof error.message === 'string' ? error.message : String(error);
                  try {
                    const fallbackToken = resolveCompatibilityAccessToken(this.__universoRestCompatibilityRequestUrl, restConfig);
                    native.setRequestHeader(restConfig.auth.headerName, fallbackToken);
                    const fallbackProof = resolveCompatibilityCsrfProof(this.__universoRestCompatibilityRequestUrl, restConfig);
                    const fallbackCsrfToken = fallbackProof?.token || '';
                    if (fallbackCsrfToken) {
                      const fallbackCsrfHeaderName = fallbackProof?.headerName || restConfig.csrf?.headerName || 'X-CSRF-Token';
                      native.setRequestHeader(fallbackCsrfHeaderName, fallbackCsrfToken);
                    }
                    return native.send(...args);
                  } catch (sendError) {
                    marker.lastXmlHttpRequestAuthHeaderError =
                      sendError && typeof sendError.message === 'string' ? sendError.message : String(sendError);
                    status = 0;
                    readyState = 4;
                    dispatchSyntheticEvent('error');
                    dispatchSyntheticEvent('loadend');
                    return undefined;
                  }
                });
          return undefined;
        }
        if (synthetic) {
          setTimeout(async () => {
            let body = synthetic.body;
            status = synthetic.status;
            try {
              body = await Promise.resolve(synthetic.bodyPromise || synthetic.body);
            } catch (error) {
              status = 500;
              body = { error: error && typeof error.message === 'string' ? error.message : String(error) };
            }
            responseText = JSON.stringify(body);
            response = responseText;
            readyState = 4;
            dispatchSyntheticEvent('readystatechange');
            dispatchSyntheticEvent('load');
            dispatchSyntheticEvent('loadend');
          }, 0);
          return undefined;
        }
        return native.send(...args);
      };

      this.setRequestHeader = (name, value) => {
        if (synthetic) return undefined;
        return native.setRequestHeader(name, value);
      };
      this.getResponseHeader = (name) => (synthetic && String(name).toLowerCase() === 'content-type' ? 'application/json' : native.getResponseHeader(name));
      this.getAllResponseHeaders = () => (synthetic ? 'content-type: application/json\\r\\n' : native.getAllResponseHeaders());
      this.overrideMimeType = (mimeType) => native.overrideMimeType(mimeType);
      this.abort = () => {
        if (synthetic) {
          status = 0;
          readyState = 4;
          dispatchSyntheticEvent('abort');
          dispatchSyntheticEvent('loadend');
          return undefined;
        }
        return native.abort();
      };
      this.addEventListener = (type, listener, options) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
        native.addEventListener(type, listener, options);
      };
      this.removeEventListener = (type, listener, options) => {
        listeners.get(type)?.delete(listener);
        native.removeEventListener(type, listener, options);
      };
      this.dispatchEvent = (event) => {
        if (synthetic) {
          dispatchSyntheticEvent(event?.type);
          return true;
        }
        return native.dispatchEvent(event);
      };
    };
    SyntheticXMLHttpRequest.UNSENT = NativeXMLHttpRequest.UNSENT;
    SyntheticXMLHttpRequest.OPENED = NativeXMLHttpRequest.OPENED;
    SyntheticXMLHttpRequest.HEADERS_RECEIVED = NativeXMLHttpRequest.HEADERS_RECEIVED;
    SyntheticXMLHttpRequest.LOADING = NativeXMLHttpRequest.LOADING;
    SyntheticXMLHttpRequest.DONE = NativeXMLHttpRequest.DONE;
    window.XMLHttpRequest = SyntheticXMLHttpRequest;
    marker.fullBootXmlHttpRequestAuthAdapterInstalled = true;
  };

  const rewriteFullBootAuthFrame = (value, token) => {
    if (!token || typeof value !== 'string') return value;
    if (value.startsWith('auth')) {
      try {
        const payload = JSON.parse(value.slice('auth'.length));
        if (payload && typeof payload === 'object' && typeof payload.accessToken === 'string') {
          return 'auth' + JSON.stringify({ ...payload, accessToken: token });
        }
      } catch {}
      return value;
    }
    try {
      const payload = JSON.parse(value);
      if (
        payload &&
        typeof payload === 'object' &&
        ((payload.t === 'authenticate' && typeof payload.token === 'string') ||
          (payload.name === 'authenticate' && typeof payload.token === 'string'))
      ) {
        return JSON.stringify({ ...payload, token });
      }
    } catch {}
    return value;
  };

  const installFullBootFetchAdapter = () => {
    if (marker.fullBootFetchAdapterInstalled || marker.fullBootMode !== true || !window.config?.project?.id) return;
    const nativeFetch = window.fetch.bind(window);
    const numericProjectId = String(window.config.project.id);
    const numericSceneId = String(window.config.scene?.uniqueId || window.config.scene?.id || '');
    const createFullBootFetchRequest = (input, init) => {
      if (typeof Request !== 'function') return null;
      try {
        if (input instanceof Request) return init === undefined ? input : new Request(input, init);
        if (typeof input === 'string' || (typeof URL === 'function' && input instanceof URL)) {
          return new Request(input, init);
        }
      } catch {}
      return null;
    };
    const createRewrittenFullBootFetchRequest = async (request, url, init) => {
      const headers = new Headers(init?.headers || request.headers || {});
      const requestInit = {
        ...(init || {}),
        method: request.method,
        headers,
        credentials: 'include',
        cache: request.cache,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        integrity: request.integrity,
        keepalive: request.keepalive,
        signal: request.signal
      };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        // Chromium treats a Request passed as the second RequestInit argument
        // as a dictionary and silently drops its body. Read a clone and pass
        // the bytes explicitly so URL rewrites preserve POST/PUT/DELETE data.
        requestInit.body = await request.clone().arrayBuffer();
      }
      return new Request(url, requestInit);
    };
    const createFullBootSyntheticFetchResponse = (url) => {
      if (url.hostname !== 'api.github.com') return null;
      if (url.pathname === '/rate_limit') {
        return { status: 200, body: { rate: { remaining: 0 } } };
      }
      if (url.pathname === '/repos/playcanvas/editor/issues') {
        return { status: 200, body: [] };
      }
      return null;
    };
    window.fetch = async (input, init) => {
      const fullBootRequest = createFullBootFetchRequest(input, init);
      const requestUrl = fullBootRequest?.url || (typeof input === 'string' ? input : input?.url);
      if (typeof requestUrl === 'string') {
        try {
          const url = new URL(requestUrl, window.location.href);
          const syntheticFetchResponse = createFullBootSyntheticFetchResponse(url);
          if (syntheticFetchResponse) {
            return createJsonResponse(syntheticFetchResponse.body, syntheticFetchResponse.status);
          }
          const requestMethod = String(fullBootRequest?.method || init?.method || 'GET').toUpperCase();
          const editorAssetCompatibilityUrl = resolveEditorAssetCompatibilityUrl(requestMethod, requestUrl);
          if (editorAssetCompatibilityUrl) {
            const usesFullBootCredentials =
              marker.fullBootMode === true && isAssetCompatibilityRequestUrl(editorAssetCompatibilityUrl, marker.restCompatibilityConfig);
            const compatibilityInit = withEditorAssetCsrfHeader(
              withRestCompatibilityAuthHeaders(
                fullBootRequest ? { headers: fullBootRequest.headers } : init,
                marker.restCompatibilityConfig,
                usesFullBootCredentials
                  ? { accessToken: typeof window.config?.accessToken === 'string' ? window.config.accessToken : '' }
                  : undefined
              ),
              requestMethod,
              editorAssetCompatibilityUrl,
              marker.restCompatibilityConfig
            );
            if (fullBootRequest) {
              const rewrittenInput = await createRewrittenFullBootFetchRequest(
                fullBootRequest,
                editorAssetCompatibilityUrl,
                compatibilityInit
              );
              return nativeFetch(rewrittenInput);
            }
            return nativeFetch(editorAssetCompatibilityUrl, { ...compatibilityInit, credentials: 'include' });
          }
          if (/\\/config$/.test(url.pathname)) {
            const body = createFullBootConfigResponseBody(url.searchParams.get('mode'));
            if (body) return createJsonResponse(body);
            return nativeFetch(input, init);
          }
          const cloudApiResponse = createFullBootCloudApiResponse('GET', requestUrl);
          if (cloudApiResponse) {
            return Promise.resolve(cloudApiResponse.bodyPromise || cloudApiResponse.body).then((body) =>
              createJsonResponse(body, cloudApiResponse.status)
            );
          }
          if (requestMethod === 'GET' && url.pathname === '/api/projects/' + numericProjectId + '/assets') {
            return loadFullBootAssets().then((assets) => createJsonResponse(assets));
          }
          const assetMatch = /^\\/api\\/assets\\/([^/]+)$/.exec(url.pathname);
          if (assetMatch) {
            const assetId = decodeURIComponent(assetMatch[1]);
            const asset = marker.fullBootAssetsById?.[assetId];
            if (asset) return Promise.resolve(createJsonResponse(asset));
            return loadFullBootAssets().then((assets) => {
              const loaded = assets.find((item) => String(item.id) === assetId);
              return createJsonResponse(loaded || { error: 'notFound' }, loaded ? 200 : 404);
            });
          }
        } catch {}
      }
      return resolveRestCompatibilityConfig().then((restConfig) => {
        if (isRestCompatibilityEndpointUrl(requestUrl, restConfig)) {
          return nativeFetch(
            fullBootRequest || input,
            withRestCompatibilityAuthHeaders(init, restConfig, {
              accessToken: resolveCompatibilityAccessToken(requestUrl, restConfig)
            })
          );
        }
        return nativeFetch(fullBootRequest || input, init);
      });
    };
    marker.fullBootFetchAdapterInstalled = true;
  };

  const installFullBootWebSocketDiagnostics = () => {
    if (marker.fullBootWebSocketDiagnosticsInstalled || marker.fullBootMode !== true || typeof window.WebSocket !== 'function') return;
    const NativeWebSocket = window.WebSocket;
    const sanitizeWebSocketUrl = (value) => {
      try {
        const parsed = new URL(value, window.location.href);
        parsed.searchParams.delete('access_token');
        return parsed.href;
      } catch {
        return String(value || '').replace(/([?&])access_token=[^&]*/g, '$1access_token=redacted');
      }
    };
    const isRelayWebSocketUrl = (value) => {
      const relayUrl = window.config?.url?.relay?.ws;
      try {
        const parsed = new URL(value, window.location.href);
        if (relayUrl) {
          const expected = new URL(relayUrl, window.location.href);
          if (parsed.origin === expected.origin && parsed.pathname === expected.pathname) return true;
        }
        return /\\/relay\\/?$/.test(parsed.pathname);
      } catch {
        return typeof value === 'string' && /\\/relay(?:\\?|$)/.test(value);
      }
    };
    window.WebSocket = function UniversoFullBootWebSocket(url, protocols) {
      const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      const urlText = typeof url === 'string' ? url : String(url?.url || url || '');
      const diagnosticUrl = sanitizeWebSocketUrl(urlText);
      const nativeSend = socket.send.bind(socket);
      socket.send = (data) => {
        if (typeof data === 'string') {
          const rewritten = rewriteFullBootAuthFrame(data, window.config?.accessToken || null);
          if (rewritten !== data || data.startsWith('auth') || data.includes('"authenticate"')) {
            void refreshFullBootAccessToken().then((token) => nativeSend(rewriteFullBootAuthFrame(data, token)));
            return;
          }
        }
        nativeSend(data);
      };
      marker.lastWebSocketUrl = diagnosticUrl;
      marker.webSocketEvents = [...(Array.isArray(marker.webSocketEvents) ? marker.webSocketEvents : []), { type: 'create', url: diagnosticUrl }].slice(-20);
      socket.addEventListener('open', () => {
        if (isRelayWebSocketUrl(urlText) && window.config?.accessToken) {
          socket.send(JSON.stringify({ t: 'authenticate', token: window.config.accessToken }));
        }
        marker.lastWebSocketOpenUrl = diagnosticUrl;
        marker.webSocketEvents = [...(Array.isArray(marker.webSocketEvents) ? marker.webSocketEvents : []), { type: 'open', url: diagnosticUrl }].slice(-20);
      });
      socket.addEventListener('close', (event) => {
        marker.lastWebSocketClose = {
          url: diagnosticUrl,
          code: event.code,
          reason: event.reason || '',
          wasClean: event.wasClean
        };
        marker.webSocketEvents = [
          ...(Array.isArray(marker.webSocketEvents) ? marker.webSocketEvents : []),
          { type: 'close', url: diagnosticUrl, code: event.code, reason: event.reason || '', wasClean: event.wasClean }
        ].slice(-20);
      });
      socket.addEventListener('error', () => {
        marker.lastWebSocketErrorUrl = diagnosticUrl;
        marker.webSocketEvents = [...(Array.isArray(marker.webSocketEvents) ? marker.webSocketEvents : []), { type: 'error', url: diagnosticUrl }].slice(-20);
      });
      return socket;
    };
    window.WebSocket.prototype = NativeWebSocket.prototype;
    window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    window.WebSocket.OPEN = NativeWebSocket.OPEN;
    window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
    window.WebSocket.CLOSED = NativeWebSocket.CLOSED;
    marker.fullBootWebSocketDiagnosticsInstalled = true;
  };

  const createHostedConfig = (descriptor) => {
    const selectedProject = descriptor?.selectedProject || null;
    const project = selectedProject?.project || null;
    const projectId = typeof project?.id === 'string' && project.id ? project.id : 'universo-artifact-project';
    const sceneId =
      typeof selectedProject?.defaultSceneId === 'string' && selectedProject.defaultSceneId
        ? selectedProject.defaultSceneId
        : 'universo-artifact-scene';
    const projectName = getLocalizedName(project?.displayName, 'Universo Project');
    const artifactBaseUrl = new URL('./', window.location.href).href;

    return assertHostedConfig({
      project: {
        id: projectId,
        name: projectName,
        private: true,
        permissions: { read: [projectId], write: [projectId], admin: [] },
        settings: { engineV2: true },
        playUrl: '/'
      },
      scene: { id: sceneId, uniqueId: sceneId },
      self: {
        id: 'universo-editor-user',
        username: 'universo',
        branch: { id: 'universo-local-branch', name: 'Main', merge: null },
        flags: { openedEditor: true, superUser: false, tips: { howdoi: true } }
      },
      owner: { id: 'universo-owner', username: 'universo', size: 0 },
      branch: { id: 'universo-local-branch', name: 'Main' },
      url: {
        api: '/',
        home: '/',
        frontend: artifactBaseUrl,
        engine: new URL('js/playcanvas-engine.js', artifactBaseUrl).href,
        static: artifactBaseUrl.replace(/\\/$/, ''),
        images: '/',
        messenger: { ws: 'ws://127.0.0.1/disabled' },
        realtime: { http: 'http://127.0.0.1/disabled' },
        relay: { ws: 'ws://127.0.0.1/disabled' }
      },
      aws: { s3Prefix: '' },
      schema: ${hostedSchemaCatalogJson},
      engineVersions: {},
      sentry: { enabled: false },
      accessToken: '',
      selfHosted: true,
      universoHosted: true,
      universoBridge: descriptor || null
    });
  };

  const installLateDomContentLoadedReplay = () => {
    if (marker.domContentLoadedReplayInstalled) return;
    const nativeAddEventListener = document.addEventListener.bind(document);
    document.addEventListener = (type, listener, options) => {
      nativeAddEventListener(type, listener, options);
      if (type !== 'DOMContentLoaded' || document.readyState === 'loading' || typeof listener !== 'function') return;
      queueMicrotask(() => {
        try {
          listener.call(document, new Event('DOMContentLoaded'));
        } catch (error) {
          setTimeout(() => {
            throw error;
          }, 0);
        }
      });
    };
    marker.domContentLoadedReplayInstalled = true;
  };

  const waitForUpstreamLayout = () =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
	      const timeoutMs = 60000;
      const requiredSelectors = [
        '#layout-toolbar',
        '#layout-hierarchy',
        '#layout-viewport',
        '#canvas-3d',
        '#layout-assets',
        '#layout-attributes'
      ];
      const poll = () => {
        const missingSelector = requiredSelectors.find((selector) => !document.querySelector(selector));
        if (!missingSelector) {
          marker.upstreamUiReady = true;
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          const error = new Error('PlayCanvas Editor upstream layout did not become ready');
          error.missingSelector = missingSelector;
          marker.upstreamUiError = {
            message: error.message,
            missingSelector
          };
          reject(error);
          return;
        }
        window.setTimeout(poll, 100);
      };
      poll();
    });

  const surfaceUnavailablePath = '/universo-surface-unavailable';
  const reportBlockedSurfaceNavigation = (blockedSurface) => {
    marker.lastBlockedSurfaceNavigation = { surface: blockedSurface, at: Date.now() };
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
      type: 'bridge.surfaceUnavailable',
      sessionId: bridgeSessionId,
      nonce: bridgeNonce,
      source: 'universo-playcanvas-editor-artifact',
      surface: blockedSurface
    });
  };
  const installSurfaceNavigationGuard = () => {
    // D4 enforcement: the built-in code editor and launch deep links must never
    // navigate the user into a raw 404. Both entry points go through
    // window.open, so intercepting it here keeps the vendor bundle untouched.
    if (typeof window.open !== 'function') return;
    const nativeWindowOpen = window.open.bind(window);
    window.open = function UniversoSurfaceGuardedOpen(url, target, features) {
      const urlText = typeof url === 'string' ? url : String(url == null ? '' : url);
      if (urlText.includes('/editor/code/')) {
        reportBlockedSurfaceNavigation('codeEditor');
        return null;
      }
      if (urlText.indexOf(surfaceUnavailablePath) === 0) {
        reportBlockedSurfaceNavigation('launchPage');
        return null;
      }
      return nativeWindowOpen(url, target, features);
    };
  };

  const postEditorReady = () => {
    if (marker.ready) return;
    marker.ready = true;
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
      type: 'editor.ready',
      bridgeVersion,
      sessionId: bridgeSessionId,
      nonce: bridgeNonce,
      source: 'universo-playcanvas-editor-artifact',
      selectedProject: marker.selectedProject
    });
  };

  const loadEditorBundle = () => {
    if (document.querySelector('script[data-universo-editor-bundle="true"]')) return;
    installLateDomContentLoadedReplay();
    const script = document.createElement('script');
    script.src = './js/editor.js';
    script.defer = true;
    script.dataset.universoEditorBundle = 'true';
    document.head.appendChild(script);
  };

  const applyBootstrapCompatibilityDescriptor = (descriptor) => {
    if (descriptor?.compatibilityConfig && typeof descriptor.compatibilityConfig === 'object') {
      marker.compatibilityConfig = descriptor.compatibilityConfig;
      marker.compatibilityConfigReady = true;
      const proof = descriptor.compatibilityConfig.universoBridge?.compatibilityCsrfToken;
      if (proof && typeof proof === 'object' && typeof proof.token === 'string' && typeof proof.headerName === 'string') {
        marker.fullBootCompatibilityCsrfToken = { token: proof.token, headerName: proof.headerName };
      }
      if (window.config) {
        window.config.universoCompatibilityConfig = marker.compatibilityConfig;
      }
    }
    if (descriptor?.restCompatibilityConfig && typeof descriptor.restCompatibilityConfig === 'object') {
      marker.restCompatibilityConfig = descriptor.restCompatibilityConfig;
      marker.restCompatibilityConfigReady = true;
      if (window.config) {
        window.config.universoRestCompatibilityConfig = marker.restCompatibilityConfig;
      }
    }
    if (
      descriptor?.compatibilityCsrfToken &&
      typeof descriptor.compatibilityCsrfToken === 'object' &&
      typeof descriptor.compatibilityCsrfToken.token === 'string' &&
      typeof descriptor.compatibilityCsrfToken.headerName === 'string'
    ) {
      marker.compatibilityCsrfToken = {
        token: descriptor.compatibilityCsrfToken.token,
        headerName: descriptor.compatibilityCsrfToken.headerName
      };
    }
  };

	  const initialize = (descriptor) => {
	    if (initialized) return;
	    initialized = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
	    marker.initialized = true;
	    marker.selectedProject = descriptor?.selectedProject || null;
	    bridgeSessionId = descriptor?.bridge?.sessionId || null;
	    bridgeNonce = descriptor?.bridge?.nonce || null;
	    window.config = resolveInitialConfig(descriptor);
    applyBootstrapCompatibilityDescriptor(descriptor);
    installFullBootFetchAdapter();
    installFullBootXmlHttpRequestAuthAdapter();
	    installFullBootWebSocketDiagnostics();
	    installSurfaceNavigationGuard();
	    window.editor = window.editor || {};
	    installEarlyEditorCapture();
	    window.editor.universoBridge = marker;
    const startEditorBundle = () => {
	      loadEditorBundle();
	          refreshEditorSaveAdapter();
    };
    if (marker.fullBootMode === true) {
      void resolveRestCompatibilityConfig().finally(startEditorBundle);
    } else {
      startEditorBundle();
    }
    if (marker.fullBootMode !== true) {
      postEditorReady();
	      bootstrapProjectStorage(descriptor);
    } else {
      void waitForUpstreamLayout()
        .then(() => {
          postEditorReady();
          bootstrapProjectStorage(descriptor);
        })
        .catch((error) => {
          marker.ready = false;
          marker.upstreamUiError = marker.upstreamUiError || {
            message: error instanceof Error ? error.message : String(error)
          };
        });
    }
	  };

  const bootstrapProjectStorage = (descriptor) => {
	    const selectedProject = descriptor?.selectedProject || null;
	    const projectId = selectedProject?.project?.id;
	    const sceneId = selectedProject?.defaultSceneId;
	    if (typeof projectId !== 'string' || !projectId) return;
    applyBootstrapCompatibilityDescriptor(descriptor);

	    void (async () => {
	      try {
	        marker.compatibilityProtocol = await sendBridgeCommand('protocol.describe');
        if (window.config) {
          window.config.universoCompatibilityProtocol = marker.compatibilityProtocol?.data?.protocol || null;
        }
	        marker.lastLoadedProject = await sendBridgeCommand('project.loadSelected');
        const loadedSelectedProject = applyLoadedProjectResponse(marker.lastLoadedProject);
        const activeProjectId = loadedSelectedProject?.project?.id || projectId;
	        const activeSceneIdCandidate = loadedSelectedProject?.defaultSceneId || sceneId;
	        const activeSceneId = typeof activeSceneIdCandidate === 'string' ? activeSceneIdCandidate : null;
        marker.lastSceneList = await sendBridgeCommand('scene.list', { projectId: activeProjectId });
		        if (activeSceneId) {
	        marker.lastLoadedScene = await sendBridgeCommand('scene.read', { projectId: activeProjectId, sceneId: activeSceneId });
          const loadedScenePayload = readLoadedScenePayload(marker.lastLoadedScene);
          if (marker.dirty === true) {
            marker.skippedDirtySceneReadPayload = true;
            marker.skippedDirtySceneReadPayloadAt = Date.now();
            clearLoadedScenePayloadObservers('dirty-scene-read-skip');
            advancePersistedSceneHydrationGeneration('dirty-scene-read-skip');
            if (marker.fullBootMode === true) {
              const sceneLocalAssets = Array.isArray(loadedScenePayload?.assets)
                ? loadedScenePayload.assets.map(mapCompatibilityAssetToPlayCanvasAsset).filter(Boolean)
                : [];
              rememberSceneLocalAssets(sceneLocalAssets);
              installMergedFullBootAssets();
              void loadFullBootAssets();
            }
          } else {
            rememberScenePayloadEntities(loadedScenePayload);
		            if (window.editor && typeof window.editor.call === 'function') {
		              installHostedAssetAdapter(window.editor, loadedScenePayload);
            }
                if (marker.fullBootMode === true) {
                  const sceneLocalAssets = Array.isArray(loadedScenePayload?.assets)
                    ? loadedScenePayload.assets.map(mapCompatibilityAssetToPlayCanvasAsset).filter(Boolean)
                    : [];
                  rememberSceneLocalAssets(sceneLocalAssets);
                  installMergedFullBootAssets();
                  void loadFullBootAssets();
                }
		            schedulePersistedSceneHydration();
          }
          marker.currentSceneChecksum =
            marker.lastLoadedScene?.data?.scene?.checksum || marker.lastLoadedScene?.data?.checksum || marker.currentSceneChecksum || null;
	        }
        const compatibilityConfigUrl =
          '/api/v1/metahub/' +
          encodeURIComponent(descriptor.metahubId || '') +
          '/playcanvas/editor-compatible/projects/' +
          encodeURIComponent(activeProjectId) +
          '/config';
        if (!marker.compatibilityConfig && descriptor.metahubId) {
          marker.compatibilityConfigReady = false;
          marker.compatibilityConfigPromise = fetch(compatibilityConfigUrl, {
            credentials: 'include',
            cache: 'no-store'
          })
            .then(async (compatibilityConfigResponse) => {
              if (!compatibilityConfigResponse.ok) return null;
              const compatibilityConfigBody = await compatibilityConfigResponse.json();
              return compatibilityConfigBody?.item || null;
            })
            .then((compatibilityConfig) => {
              marker.compatibilityConfig = compatibilityConfig;
              marker.compatibilityConfigReady = true;
              if (window.config) {
                window.config.universoCompatibilityConfig = marker.compatibilityConfig;
              }
              return compatibilityConfig;
            })
            .catch((error) => {
              marker.compatibilityConfigReady = false;
              marker.compatibilityConfigError = error;
              return null;
            });
          await marker.compatibilityConfigPromise;
	        }
	        installEditorSaveAdapter();
		      } catch (error) {
		        marker.storageError = error;
	      }
    })();
  };

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const escapeSelector = '[role="dialog"], [aria-modal="true"], input, textarea, select, [contenteditable="true"]';
    const target = event.target;
    const activeElement = document.activeElement;
    const escapeOwnedByEditor =
      target?.closest?.(escapeSelector) ||
      activeElement?.closest?.(escapeSelector);
    if (escapeOwnedByEditor) return;
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
	      type: 'bridge.focusBackLink',
	      sessionId: bridgeSessionId,
	      nonce: bridgeNonce,
	      source: 'universo-playcanvas-editor-artifact'
	    });
  });

	  window.addEventListener('message', (event) => {
	    const data = event.data;
	    if (data?.type === 'bridge.saveRequested') {
	      if (!isTrustedParentMessage(event)) {
	        rejectParentMessage('untrusted-save-request');
	        return;
	      }
	      if (
	        data.source !== 'universo-playcanvas-editor-host' ||
	        data.sessionId !== bridgeSessionId ||
	        data.nonce !== bridgeNonce
	      ) {
	        rejectParentMessage('invalid-save-request');
	        return;
	      }
	      void saveCurrentScene().catch((error) => {
	        marker.saveError = error;
	      });
	      return;
	    }
	    if (data?.type === 'bridge.response') {
	      if (!isTrustedParentMessage(event)) {
	        rejectParentMessage('untrusted-bridge-response');
	        return;
	      }
	      handleBridgeResponse(data);
	      return;
	    }
	    if (!data || data.type !== 'editor.bootstrap.init') return;
	    if (initialized) {
	      marker.duplicateBootstrapMessages = (marker.duplicateBootstrapMessages || 0) + 1;
	      return;
	    }
	    if (data.source !== 'universo-playcanvas-editor-host' || data.bootstrapRequestId !== bootstrapRequestId) {
	      rejectParentMessage('invalid-bootstrap-source');
	      return;
	    }
	    if (!window.parent || window.parent === window || event.source !== window.parent) {
	      rejectParentMessage('untrusted-bootstrap-source');
	      return;
	    }
	    if (typeof event.origin !== 'string' || !event.origin) {
	      rejectParentMessage('missing-bootstrap-origin');
	      return;
	    }
	    if (!isValidBootstrapDescriptor(data.descriptor)) {
	      rejectParentMessage('invalid-bootstrap-descriptor');
	      return;
	    }
	    trustedParentWindow = event.source;
	    trustedParentOrigin = event.origin;
	    marker.trustedParentOrigin = trustedParentOrigin;
	    initialize(data.descriptor || null);
	  });

  const embeddedInHost = window.parent && window.parent !== window;
  requestBootstrapInit();
  if (embeddedInHost) {
    let bootstrapRetryCount = 0;
    const bootstrapRetryTimer = window.setInterval(() => {
      if (initialized || bootstrapRetryCount >= 20) {
        window.clearInterval(bootstrapRetryTimer);
        return;
      }
      bootstrapRetryCount += 1;
      requestBootstrapInit();
    }, 500);
  }
  if (!embeddedInHost) {
    fallbackTimer = setTimeout(() => initialize(null), 750);
  }
})();`
    new vm.Script(source, { filename: bridgeBootstrapFileName })
    fs.writeFileSync(path.join(targetRoot, bridgeBootstrapFileName), `${source}\n`)
}

export const writeUniversoHostedEngineContract = (targetRoot) => {
    const jsRoot = path.join(targetRoot, 'js')
    fs.mkdirSync(jsRoot, { recursive: true })
    // The vendored Editor probes this URL through a CommonJS-shaped Function
    // wrapper before enabling ESM script parsing. Keep the contract usable both
    // in that probe and when the artifact is loaded as a classic browser script.
    fs.writeFileSync(
        path.join(jsRoot, 'playcanvas-engine.js'),
        `(function (root) {\n  var pc = { Script: class Script {} };\n  if (typeof module !== 'undefined' && module.exports) module.exports = pc;\n  else root.pc = pc;\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n`
    )
    fs.writeFileSync(
        path.join(jsRoot, 'playcanvas-engine.d.ts'),
        `// The Editor's ESM attribute parser reads this file as a script and uses
// the top-level Script declaration as the identity for classes imported from
// the PlayCanvas module. The permissive members are intentional: the hosted
// artifact does not ship the full engine type surface, but the parser must still
// type-check authored ESM scripts before it can discover their Script subclasses.
export class Script {
  [key: string]: any;
  app: any;
  entity: any;
}
export class Quat {
  [key: string]: any;
  constructor(...args: any[]);
}
export class Vec3 {
  [key: string]: any;
  constructor(...args: any[]);
  x: any;
  y: any;
  z: any;
}
export class Color {
  [key: string]: any;
  constructor(...args: any[]);
}
export class Entity {
  [key: string]: any;
  constructor(...args: any[]);
}
export class StandardMaterial {
  [key: string]: any;
  constructor(...args: any[]);
}
declare const pc: { Script: typeof Script };
`
    )
}

export const injectBridgeBootstrap = (targetRoot) => {
    const indexPath = path.join(targetRoot, 'index.html')
    if (!fs.existsSync(indexPath)) {
        throw new Error('Cannot inject PlayCanvas Editor bridge bootstrap because index.html is missing')
    }
    const html = fs.readFileSync(indexPath, 'utf8')
    if (html.includes(bridgeBootstrapFileName)) {
        return
    }
    const scriptTag = `<script src="./${bridgeBootstrapFileName}" defer></script>`
    const nextHtml = html.includes('</head>') ? html.replace('</head>', `  ${scriptTag}\n</head>`) : `${scriptTag}\n${html}`
    fs.writeFileSync(indexPath, nextHtml)
}

const createHostedWebSocketShim = (mode) =>
    mode === 'universo-hosted'
        ? `const NativeWebSocket = window.WebSocket;
window.WebSocket = class UniversoHostedWebSocket extends EventTarget {
  static CONNECTING = NativeWebSocket.CONNECTING;
  static OPEN = NativeWebSocket.OPEN;
  static CLOSING = NativeWebSocket.CLOSING;
  static CLOSED = NativeWebSocket.CLOSED;

  constructor(url, protocols) {
    const value = typeof url === 'string' ? url : String(url);
    if (!value.includes('/disabled')) {
      return new NativeWebSocket(url, protocols);
    }
    super();
    this.url = value;
    this.protocol = '';
    this.extensions = '';
    this.binaryType = 'blob';
    this.bufferedAmount = 0;
    this.readyState = NativeWebSocket.CONNECTING;
  }

  close() {
    this.readyState = NativeWebSocket.CLOSED;
  }

  send() {}
};
window.WebSocket.CONNECTING = NativeWebSocket.CONNECTING;
window.WebSocket.OPEN = NativeWebSocket.OPEN;
window.WebSocket.CLOSING = NativeWebSocket.CLOSING;
window.WebSocket.CLOSED = NativeWebSocket.CLOSED;`
        : ''

export const writeUniversoHostedShell = (targetRoot, { mode = defaultArtifactMode } = {}) => {
    if (mode !== 'universo-hosted' && mode !== fullUpstreamUiMode) {
        throw new Error(`Unsupported hosted shell mode: ${mode}`)
    }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>PlayCanvas Editor</title>
  <link rel="stylesheet" href="./css/editor.css">
  <script>
const universoArtifactBaseUrl = new URL('./', window.location.href).href;
const NativeWorker = window.Worker;
window.Worker = class UniversoHostedWorker extends NativeWorker {
  constructor(url, options) {
    const value = typeof url === 'string' ? url : String(url);
    const nextUrl = value.startsWith('/editor/scene/js/') ? new URL(value.replace('/editor/scene/js/', 'js/'), universoArtifactBaseUrl).href : url;
    super(nextUrl, options);
  }
};
${createHostedWebSocketShim(mode)}
const hostedServiceWorkerRegistration = { active: null, installing: null, waiting: null };
const nativeServiceWorker = navigator.serviceWorker;
const hostedServiceWorker = {
  controller: null,
  ready: Promise.resolve(hostedServiceWorkerRegistration),
  getRegistrations: async () => [],
  getRegistration: async () => undefined,
  register: async () => hostedServiceWorkerRegistration,
  addEventListener: nativeServiceWorker?.addEventListener?.bind(nativeServiceWorker) ?? (() => {}),
  removeEventListener: nativeServiceWorker?.removeEventListener?.bind(nativeServiceWorker) ?? (() => {})
};
Object.defineProperty(navigator, 'serviceWorker', {
  configurable: true,
  value: hostedServiceWorker
});
window.editor = window.editor || {};
  </script>
  <script src="./${bridgeBootstrapFileName}" defer></script>
</head>
<body data-universo-playcanvas-editor-hosted="true">
  <noscript>PlayCanvas Editor requires JavaScript.</noscript>
</body>
</html>
`
    fs.writeFileSync(path.join(targetRoot, 'index.html'), html)
}

export const assertNoNestedPackageManifests = (root = packageRoot) => {
    const violations = []
    const ignoredDirs = new Set(['node_modules', 'dist', 'build', '.turbo', '.tmp', 'coverage'])

    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (ignoredDirs.has(entry.name)) continue
                walk(path.join(dir, entry.name))
                continue
            }
            if (entry.name !== 'package.json') continue
            const filePath = path.join(dir, entry.name)
            if (path.resolve(filePath) !== path.join(packageRoot, 'package.json')) {
                violations.push(path.relative(root, filePath))
            }
        }
    }

    walk(root)

    if (violations.length > 0) {
        throw new Error(`Nested package manifests are not allowed: ${violations.join(', ')}`)
    }
}

export const assertBuildScriptsDoNotInstall = (scriptRoot = path.join(packageRoot, 'scripts')) => {
    const scriptFiles = []
    const ignoredFiles = new Set(['playcanvas-editor-artifact.mjs'])
    const forbiddenPatterns = [
        /\bnpm\s+(?:install|i|ci|add|exec|x)\b/,
        /\bpnpm\s+(?:install|i|add|dlx|exec\s+(?:npm|pnpm|yarn|npx))\b/,
        /\byarn(?:\s+(?:install|add|dlx|exec))?\b/,
        /\bnpx(?:\s+\S+)?\b/,
        /\bbun\s+(?:install|i|add|x)\b/,
        /\bbunx(?:\s+\S+)?\b/,
        /\bcorepack\s+(?:prepare\b[\s\S]*?--activate\b|enable\b|install\b|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)\b|exec\s+(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)\b)/,
        /\b(?:exec|execSync)\s*\(\s*['"`][\s\S]*?\b(?:npm\s+(?:install|i|ci|add|exec|x)|pnpm\s+(?:install|i|add|dlx|exec)|yarn(?:\s+(?:install|add|dlx|exec))?|npx(?:\s+\S+)?|bun\s+(?:install|i|add|x)|bunx(?:\s+\S+)?|corepack\s+(?:prepare|enable|install|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)|exec\s+(?:npm|pnpm|yarn))|git\s+(?:clone|fetch|pull|submodule\s+update))\b[\s\S]*?['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]npm['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|ci|add|exec|x)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]pnpm['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|add|dlx)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]pnpm['"`]\s*,\s*\[[\s\S]*?['"`]exec['"`][\s\S]*?['"`](?:npm|pnpm|yarn|npx)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]yarn['"`]\s*,\s*(?:\[\s*\]|\[[\s\S]*?['"`](?:install|add|dlx|exec)['"`])/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]npx['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]bun['"`]\s*,\s*\[[\s\S]*?['"`](?:install|i|add|x)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]bunx['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]corepack['"`]\s*,\s*\[[\s\S]*?['"`](?:prepare|enable|install)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]corepack['"`]\s*,\s*\[[\s\S]*?['"`](?:npm|pnpm|yarn)['"`][\s\S]*?['"`](?:install|i|ci|add|dlx|exec)['"`]/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`](?:sh|bash)['"`]\s*,\s*\[[\s\S]*?['"`](?:-c|-lc)['"`][\s\S]*?['"`][\s\S]*?\b(?:npm\s+(?:install|i|ci|add|exec|x)|pnpm\s+(?:install|i|add|dlx|exec)|yarn(?:\s+(?:install|add|dlx|exec))?|npx(?:\s+\S+)?|bun\s+(?:install|i|add|x)|bunx(?:\s+\S+)?|corepack\s+(?:prepare|enable|install|(?:npm|pnpm|yarn)\s+(?:install|i|ci|add|dlx|exec)|exec\s+(?:npm|pnpm|yarn))|git\s+(?:clone|fetch|pull|submodule\s+update))\b[\s\S]*?['"`]/,
        /\bgit\s+(?:clone|fetch|pull|submodule\s+update)\b/,
        /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*['"`]git['"`]\s*,\s*\[[\s\S]*?['"`](?:clone|fetch|pull|submodule)['"`]/
    ]

    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const entryPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(entryPath)
                continue
            }
            if (entry.name.endsWith('.mjs') && !ignoredFiles.has(entry.name)) {
                scriptFiles.push(entryPath)
            }
        }
    }

    walk(scriptRoot)

    for (const scriptPath of scriptFiles) {
        const source = fs.readFileSync(scriptPath, 'utf8')
        const relativeScriptPath = path.relative(packageRoot, scriptPath)
        for (const forbidden of forbiddenPatterns) {
            if (forbidden.test(source)) {
                throw new Error(`${relativeScriptPath} must not run unpinned install or network source commands`)
            }
        }
    }
}

export const readRootLockfileHash = () => {
    const content = fs.readFileSync(rootLockfilePath)
    return crypto.createHash('sha256').update(content).digest('hex')
}

export const assertRootLockfileHash = (expectedHash) => {
    const actualHash = readRootLockfileHash()
    if (actualHash !== expectedHash) {
        throw new Error('PlayCanvas Editor build must not mutate pnpm-lock.yaml')
    }
}

export const makeExternalTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'universo-playcanvas-editor-'))

export const writeSafeUnavailablePage = (targetRoot) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PlayCanvas Editor Artifact Unavailable</title>
  <style>
    :root { color-scheme: light dark; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #172033; }
    main { max-width: 760px; padding: 32px; line-height: 1.5; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { margin: 0 0 12px; overflow-wrap: anywhere; }
    [data-locale-panel][hidden] { display: none; }
    code { background: rgba(30, 41, 59, 0.08); padding: 2px 6px; border-radius: 4px; }
    canvas { display: block; width: min(100%, 560px); height: 180px; margin: 0 0 24px; border-radius: 6px; background: #101828; }
  </style>

</head>
<body>
  <main>
    <canvas width="560" height="180" aria-label="PlayCanvas Editor artifact preview"></canvas>
    <section lang="en" data-locale-panel="en" aria-labelledby="playcanvas-editor-artifact-title-en">
      <h1 id="playcanvas-editor-artifact-title-en">PlayCanvas Editor artifact is available</h1>
      <p>The editor files are ready. Project saving, assets, and collaboration are not connected in this integration step yet.</p>
    </section>
    <section lang="ru" data-locale-panel="ru" hidden aria-labelledby="playcanvas-editor-artifact-title-ru">
      <h1 id="playcanvas-editor-artifact-title-ru">Артефакт PlayCanvas Editor доступен</h1>
      <p>Файлы редактора готовы. Сохранение проектов, ассеты и совместная работа пока не подключены на этом шаге интеграции.</p>
    </section>
  </main>
  <script>
const canvas = document.querySelector('canvas');
const params = new URLSearchParams(window.location.search);
const locale = params.get('locale') === 'ru' ? 'ru' : 'en';
document.documentElement.lang = locale;
for (const panel of document.querySelectorAll('[data-locale-panel]')) {
  panel.hidden = panel.getAttribute('data-locale-panel') !== locale;
}
if (canvas) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1d4ed8');
  gradient.addColorStop(0.5, '#14b8a6');
  gradient.addColorStop(1, '#f59e0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = '600 22px Arial, sans-serif';
  ctx.fillText('PlayCanvas Editor', 28, 58);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Artifact-only integration surface', 28, 92);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
}
  </script>
</body>
</html>
`
    fs.writeFileSync(path.join(targetRoot, 'index.html'), html)
}
