import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const upstreamRepository = 'https://github.com/playcanvas/editor'
export const upstreamTag = 'v2.23.4'
export const upstreamCommit = 'c4916f4973963341984499f2d919f8bfd38e417c'
export const upstreamPackageVersion = '2.23.4'
export const nodeRequirement = '>=22.22.0'
export const artifactOutputRoot = 'dist/editor'
export const fullUpstreamUiMode = 'universo-full-upstream-ui'
export const artifactModes = ['artifact-only', 'universo-hosted', fullUpstreamUiMode]
export const defaultArtifactMode = fullUpstreamUiMode
export const manifestFileName = 'universo-artifact-manifest.json'
export const bridgeBootstrapFileName = 'universo-bridge-bootstrap.js'

const hostedEditorUrlSchema = z
    .object({
        api: z.string().min(1),
        home: z.string().min(1),
        frontend: z.string().url(),
        engine: z.string().url(),
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
        schema: z.object({ asset: z.unknown(), scene: z.unknown(), settings: z.unknown() }).passthrough(),
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
            images: '/',
            messenger: { ws: 'ws://127.0.0.1/disabled' },
            realtime: { http: 'http://127.0.0.1/disabled' },
            relay: { ws: 'ws://127.0.0.1/disabled' }
        },
        aws: { s3Prefix: '' },
        schema: {
            asset: { type: { $enum: ['script', 'texture', 'material', 'model', 'json', 'template'] } },
            animstategraphData: {},
            materialData: {},
            scene: {
                entities: {
                    $of: {
                        components: {
                            camera: { enabled: { $type: 'boolean', $default: true } },
                            light: { enabled: { $type: 'boolean', $default: true } },
                            render: { enabled: { $type: 'boolean', $default: true } },
                            script: {
                                enabled: { $type: 'boolean', $default: true },
                                scripts: { $type: 'array', $default: [] },
                                order: { $type: 'array', $default: [] }
                            }
                        }
                    }
                },
                settings: { physics: {}, render: {} }
            },
            settings: {
                width: { $type: 'number', $default: 1280, $scope: 'project' },
                height: { $type: 'number', $default: 720, $scope: 'project' },
                useLegacyScripts: { $type: 'boolean', $default: false, $scope: 'project' },
                editor: { $type: 'object', $default: {}, $scope: 'user' }
            }
        },
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
			  const observedEntityObservers = [];
			  let hostedEntityEditor = null;
			  let wrappedEditorCall = null;
			  let hydratingPersistedScene = false;

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
      const timeout = window.setTimeout(() => {
        pendingBridgeRequests.delete(requestId);
        reject(new Error('Bridge command timed out'));
      }, 15000);
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

	  const observerToJson = (value) => {
	    if (!value) return null;
	    try {
	      if (typeof value.latest === 'function') {
	        const latest = value.latest();
	        if (latest && latest !== value) return observerToJson(latest);
	      }
	      if (typeof value.json === 'function') return value.json();
	      if (typeof value.toJSON === 'function') return value.toJSON();
	      if (value.data && typeof value.data === 'object') return value.data;
	      if (value._data && typeof value._data === 'object') return value._data;
	      if (value.apiEntity?.observer && value.apiEntity.observer !== value) return observerToJson(value.apiEntity.observer);
	      if (value.observer && value.observer !== value) return observerToJson(value.observer);
	      if (value._observer && value._observer !== value) return observerToJson(value._observer);
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

  const scenePayloadEntitiesToObservers = (payload) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entities)) return [];
    return payload.entities
      .filter((entity) => entity && typeof entity === 'object' && typeof entity.id === 'string' && entity.id)
      .map((entity) =>
        createHostedEntityObserver({
          id: entity.id,
          resource_id: entity.id,
          name: entity.name,
          parent: entity.parentId,
          enabled: entity.enabled,
          components: entity.components
        })
      );
  };

  const rememberScenePayloadEntities = (payload) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entities)) return;
    for (const observer of scenePayloadEntitiesToObservers(payload)) {
      rememberEntityObserver(observer, observerToJson(observer));
    }
  };

  const realtimeEntityRecordToCreateData = (entity, id) => {
    if (!entity || typeof entity !== 'object') return null;
    const resourceId = typeof entity.resource_id === 'string' && entity.resource_id ? entity.resource_id : id;
    if (typeof resourceId !== 'string' || !resourceId) return null;
    return {
      resource_id: resourceId,
      name: typeof entity.name === 'string' && entity.name ? entity.name : resourceId === 'root' ? 'Root' : 'Entity',
      parent: typeof entity.parent === 'string' ? entity.parent : null,
      enabled: entity.enabled !== false,
      components: entity.components && typeof entity.components === 'object' ? entity.components : {},
      children: []
    };
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

  const hydratePersistedSceneEntities = () => {
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    const apiEntities = editorInstance?.api?.globals?.entities;
    const realtimeEntities = editorInstance?.api?.globals?.realtime?.scenes?.current?.data?.entities;
    if (!editorInstance || !apiEntities || !realtimeEntities || typeof realtimeEntities !== 'object' || Array.isArray(realtimeEntities)) {
      return false;
    }
    const entries = Object.entries(realtimeEntities)
      .map(([id, entity]) => realtimeEntityRecordToCreateData(entity, id))
      .filter(Boolean);
    if (!entries.length) return false;
    const existing = typeof apiEntities.get === 'function' ? (id) => apiEntities.get(id) : () => null;
    const root = entries.find((entity) => entity.resource_id === 'root' || entity.parent === null) || null;
    const ordered = [...(root ? [root] : []), ...entries.filter((entity) => entity !== root && entity.resource_id !== 'root')];
    let hydrated = 0;
    hydratingPersistedScene = true;
    try {
      for (const entity of ordered) {
        if (existing(entity.resource_id)) continue;
        const created = editorInstance.call('entities:new', {
          ...entity,
          noHistory: true,
          noSelect: true
        });
        rememberEntityObserver(created, entity);
        hydrated += 1;
      }
    } finally {
      hydratingPersistedScene = false;
    }
    marker.lastHydratedPersistedEntityCount = hydrated;
    marker.lastHydratedPersistedEntityIds = ordered.map((entity) => entity.resource_id);
    if (hydrated > 0) {
      markHydratedClean();
    }
    rebindUpstreamHierarchy();
    return hydrated > 0;
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

	  const getObserverValue = (observer, path) => {
	    const direct = readObserverPath(observer, path);
	    if (direct !== undefined) return direct;
	    const raw = observerToJson(observer);
	    return path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), raw);
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
      components: rawComponents && typeof rawComponents === 'object' ? rawComponents : undefined,
      children
    };
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
      components: input.components && typeof input.components === 'object' ? input.components : {}
    };
    return {
      apiEntity: { observer: null },
      data: entity,
      get: (path) => path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), entity),
      json: () => ({ ...entity }),
      toJSON: () => ({ ...entity })
    };
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
    return {
      id: String(id),
      name: typeof raw.name === 'string' ? raw.name : undefined,
      type,
      stableAssetId: typeof raw.uniqueId === 'string' ? raw.uniqueId : typeof raw.unique_id === 'string' ? raw.unique_id : undefined,
      mime: raw.file?.mimeType === 'application/json' ? 'application/json' : raw.file?.mime === 'application/json' ? 'application/json' : undefined,
	      metadata: raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined
	    };
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

  const serializeCurrentScene = () => {
    const fallbackPayload = marker.lastLoadedScene?.data?.payload || null;
    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
    if (!editorInstance) {
      return fallbackPayload || { schemaVersion: bridgeVersion, entities: [] };
	    }
    try {
      const projectSettings = safeEditorCall(editorInstance, 'settings:project');
      const cleanLoadedPayloadObservers = marker.dirty === true ? [] : scenePayloadEntitiesToObservers(fallbackPayload);
      const rawEntityObservers = mergeEntityObserverLists(
        safeEditorCall(editorInstance, 'entities:list'),
        safeEditorCall(editorInstance, 'entities:raw'),
        editorInstance.api?.globals?.entities?.raw,
        editorInstance.api?.globals?.entities?.root?.observer,
        observedEntityObservers,
        cleanLoadedPayloadObservers
      );
      const entitySerializationErrors = [];
      const entities = rawEntityObservers
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
      marker.lastSerializedEntityIds = entities.map((entity) => entity.id);
      marker.lastSerializedEntityCount = entities.length;
      marker.lastRawEntityObserverCount = rawEntityObservers.length;
      marker.lastObservedEntityObserverCount = observedEntityObservers.length;
      marker.lastEntitySerializationErrors = entitySerializationErrors.slice(-20);
      const assets = observerListToArray(safeEditorCall(editorInstance, 'assets:list') || safeEditorCall(editorInstance, 'assets:raw'))
        .map(serializeAsset)
        .filter(Boolean);
      return {
        schemaVersion: fallbackPayload?.schemaVersion || bridgeVersion,
        settings: projectSettings && typeof projectSettings.json === 'function' ? projectSettings.json() : fallbackPayload?.settings,
        entities,
        assets,
        metadata: {
          ...(fallbackPayload?.metadata && typeof fallbackPayload.metadata === 'object' ? fallbackPayload.metadata : {}),
          savedBy: 'universo-playcanvas-editor-bridge'
        }
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
        const restConfigUrl =
          window.config.universoBridge.compatibilityRestBaseUrl.replace(/\\/$/, '') +
          '/config?mode=universo-compatibility-rest-minimal';
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
        if (!marker.currentSceneChecksum) {
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
        }
        let csrfToken =
          typeof marker.compatibilityCsrfToken?.token === 'string' && marker.compatibilityCsrfToken.token
            ? marker.compatibilityCsrfToken.token
            : null;
        const csrfHeaderName =
          (typeof marker.compatibilityCsrfToken?.headerName === 'string' && marker.compatibilityCsrfToken.headerName) ||
          restConfig.csrf?.headerName ||
          'X-CSRF-Token';
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
        const sceneSaveUrl = restConfig.endpoints.scenes + '/' + encodeURIComponent(sceneId);
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
    window.__UNIVERSO_PLAYCANVAS_EDITOR_POST_MESSAGE__({
      type: 'bridge.dirtyState',
      dirty: false,
      sessionId: bridgeSessionId,
      nonce: bridgeNonce,
      source: 'universo-playcanvas-editor-artifact'
    });
  };

  const markHydratedClean = () => {
    marker.initialHydrationComplete = true;
    marker.ignoreDirtyUntil = Date.now() + 750;
    markClean();
  };

		  const markDirty = (options = {}) => {
    const force = options && options.force === true;
    if (!force && (!marker.initialHydrationComplete || Date.now() < (marker.ignoreDirtyUntil || 0))) {
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

	  const installEditorSaveAdapter = () => {
	    const editorInstance = window.editor && typeof window.editor.call === 'function' ? window.editor : null;
	    if (!editorInstance) {
	      window.setTimeout(installEditorSaveAdapter, 250);
	      return;
	    }
	    if (marker.editorSaveAdapterInstalled && marker.editorInstance === editorInstance) return;
	    if (marker.fullBootMode !== true) {
	      installHostedEntityAdapter(editorInstance);
	    }
	    marker.editorSaveAdapterInstalled = true;
	    marker.editorInstance = editorInstance;
	    editorInstance.universoBridge = marker;
	    if (typeof editorInstance.call === 'function' && editorInstance.call !== wrappedEditorCall) {
	      const upstreamCall = editorInstance.call.bind(editorInstance);
	      wrappedEditorCall = (methodName, ...args) => {
	        const result = upstreamCall(methodName, ...args);
	        if (methodName === 'entities:new') {
	          rememberEntityObserver(result, args[0] && typeof args[0] === 'object' ? args[0] : { name: 'Entity' });
          if (!hydratingPersistedScene) {
            markDirty({ force: true });
          }
	        }
	        return result;
	      };
	      editorInstance.call = wrappedEditorCall;
	      editorInstance.universoBridgeCallWrapped = true;
	      marker.editorCallWrapped = true;
	    }
	    if (typeof editorInstance.method === 'function') {
	      editorInstance.method('universo:bridge:serializeScene', serializeCurrentScene);
	      editorInstance.method('universo:bridge:saveScene', saveCurrentScene);
    }
	    if (typeof editorInstance.on === 'function') {
	      editorInstance.on('entities:add', (entity) => {
	        rememberEntityObserver(entity, { name: getObserverValue(entity, 'name') || 'Entity' });
        if (!hydratingPersistedScene) {
          markDirty();
        }
	      });
      editorInstance.on('entities:remove', (entity) => {
        forgetEntityObserver(entity);
        markDirty();
      });
      editorInstance.on('assets:add', markDirty);
      editorInstance.on('assets:remove', markDirty);
      editorInstance.on('load', markHydratedClean);
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
        rebindUpstreamHierarchy();
        markHydratedClean();
      });
      editorInstance.on('realtime:load:scene', () => {
        hydratePersistedSceneEntities();
        markHydratedClean();
      });
      editorInstance.on('realtime:scene:op', markDirty);
	    }
    const history = editorInstance.api?.globals?.history;
    if (history && typeof history.on === 'function' && !marker.historyDirtyAdapterInstalled) {
      history.on('add', markDirty);
      history.on('undo', markDirty);
      history.on('redo', markDirty);
      marker.historyDirtyAdapterInstalled = true;
    }
    const realtimeScene = editorInstance.api?.globals?.realtime?.scenes?.current;
    if (
      realtimeScene &&
      typeof realtimeScene.submitOp === 'function' &&
      realtimeScene.submitOp !== marker.wrappedRealtimeSceneSubmitOp
    ) {
      const upstreamSubmitOp = realtimeScene.submitOp.bind(realtimeScene);
      marker.wrappedRealtimeSceneSubmitOp = (op) => {
        const result = upstreamSubmitOp(op);
        markDirty();
        return result;
      };
      realtimeScene.submitOp = marker.wrappedRealtimeSceneSubmitOp;
    }
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
    if (!config.url?.frontend || !config.url?.engine || !config.schema?.scene || !config.schema?.settings) {
      throw new Error('Hosted Editor upstream boot config is incomplete');
    }
    return config;
  };

  const assertFullBootConfig = (config) => {
    if (!config || typeof config !== 'object') throw new Error('Full upstream Editor config is missing');
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
    if (!config.url?.frontend || !config.url?.engine || !config.schema?.scene || !config.schema?.settings) {
      throw new Error('Full upstream Editor upstream boot config is incomplete');
    }
    return config;
  };

  const resolveInitialConfig = (descriptor) => {
    if (descriptor?.compatibilityConfig?.mode === 'universo-full-upstream-ui') {
      marker.fullBootMode = true;
      marker.compatibilityConfig = descriptor.compatibilityConfig;
      marker.compatibilityConfigReady = true;
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

  const refreshFullBootAccessToken = async () => {
    if (marker.fullBootMode !== true) return window.config?.accessToken || null;
    if (marker.fullBootAccessTokenRefreshPromise) return marker.fullBootAccessTokenRefreshPromise;
    const refreshUrl = resolveFullBootTokenRefreshUrl();
    if (!refreshUrl) return window.config?.accessToken || null;
    marker.fullBootAccessTokenRefreshPromise = fetch(refreshUrl, {
      credentials: 'include',
      cache: 'no-store'
    })
      .then(async (response) => (response.ok ? (await response.json())?.item || null : null))
      .then((config) => {
        if (config?.mode === 'universo-full-upstream-ui' && typeof config.accessToken === 'string') {
          window.config.accessToken = config.accessToken;
          if (config.universoBridge && typeof config.universoBridge === 'object') {
            window.config.universoBridge = config.universoBridge;
          }
          marker.compatibilityConfig = window.config;
          marker.fullBootAccessTokenRefreshedAt = Date.now();
          return config.accessToken;
        }
        return window.config?.accessToken || null;
      })
      .catch((error) => {
        marker.fullBootAccessTokenRefreshError = error;
        return window.config?.accessToken || null;
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
    const hasRestConfig =
      compatibilityConfig?.auth?.scheme === 'signed-header' &&
      typeof compatibilityConfig.auth.accessToken === 'string' &&
      typeof compatibilityConfig.auth.headerName === 'string' &&
      typeof compatibilityConfig.endpoints?.assets === 'string';
    if (hasRestConfig) return compatibilityConfig;
    if (typeof window.config?.universoBridge?.compatibilityRestBaseUrl !== 'string') return null;
    const restConfigUrl =
      window.config.universoBridge.compatibilityRestBaseUrl.replace(/\\/$/, '') +
      '/config?mode=universo-compatibility-rest-minimal';
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
    return compatibilityConfig?.auth?.scheme === 'signed-header' &&
      typeof compatibilityConfig.auth.accessToken === 'string' &&
      typeof compatibilityConfig.auth.headerName === 'string' &&
      typeof compatibilityConfig.endpoints?.assets === 'string'
      ? compatibilityConfig
      : null;
  };

  const mapCompatibilityAssetToPlayCanvasAsset = (asset) => {
    const id = Number.isInteger(asset?.editorDocumentId) ? asset.editorDocumentId : null;
    if (!id) return null;
    const virtualPath = typeof asset.virtualPath === 'string' && asset.virtualPath.trim() ? asset.virtualPath.trim() : asset.name || 'asset';
    const filename = virtualPath.split('/').filter(Boolean).pop() || asset.name || String(id);
    return {
      id,
      uniqueId: String(id),
      item_id: id,
      branch_id: window.config?.self?.branch?.id || window.config?.scene?.id || null,
      project: window.config?.project?.id || null,
      type: typeof asset.type === 'string' && asset.type ? asset.type : 'json',
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
      path: [],
      tags: [],
      data: null,
      meta: null,
      preload: true,
      source: false
    };
  };

  const loadFullBootAssets = async () => {
    const restConfig = await resolveRestCompatibilityConfig();
    if (!restConfig) return [];
    const response = await fetch(restConfig.endpoints.assets, {
      method: 'GET',
      credentials: 'include',
      headers: {
        [restConfig.auth.headerName]: restConfig.auth.accessToken
      },
      cache: 'no-store'
    });
    if (!response.ok) return [];
    const body = await response.json();
    const assets = Array.isArray(body?.items) ? body.items.map(mapCompatibilityAssetToPlayCanvasAsset).filter(Boolean) : [];
    marker.fullBootAssetsById = Object.fromEntries(assets.map((asset) => [String(asset.id), asset]));
    return assets;
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
    window.fetch = (input, init) => {
      const requestUrl = typeof input === 'string' ? input : input?.url;
      if (typeof requestUrl === 'string') {
        try {
          const url = new URL(requestUrl, window.location.href);
          if (url.pathname === '/api/projects/' + numericProjectId + '/assets') {
            return loadFullBootAssets().then((assets) => createJsonResponse(assets));
          }
          const assetMatch = /^\/api\/assets\/([^/]+)$/.exec(url.pathname);
          if (assetMatch) {
            const assetId = decodeURIComponent(assetMatch[1]);
            const asset = marker.fullBootAssetsById?.[assetId];
            if (asset) return Promise.resolve(createJsonResponse(asset));
            return loadFullBootAssets().then((assets) => {
              const loaded = assets.find((item) => String(item.id) === assetId);
              return createJsonResponse(loaded || { error: 'notFound' }, loaded ? 200 : 404);
            });
          }
          if (url.pathname === '/api/projects/' + numericProjectId + '/scenes') {
            return Promise.resolve(
              createJsonResponse({
                result: [
                  {
                    id: window.config.scene.id,
                    uniqueId: window.config.scene.uniqueId,
                    name: window.config.project?.name || 'Main Scene',
                    project_id: window.config.project.id,
                    branch_id: window.config.self?.branch?.id || window.config.scene.id
                  }
                ]
              })
            );
          }
          if (numericSceneId && url.pathname === '/api/scenes/' + numericSceneId) {
            return Promise.resolve(
              createJsonResponse({
                id: window.config.scene.id,
                uniqueId: window.config.scene.uniqueId,
                name: window.config.project?.name || 'Main Scene',
                project_id: window.config.project.id,
                branch_id: window.config.self?.branch?.id || window.config.scene.id
              })
            );
          }
        } catch {}
      }
      return nativeFetch(input, init);
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
        images: '/',
        messenger: { ws: 'ws://127.0.0.1/disabled' },
        realtime: { http: 'http://127.0.0.1/disabled' },
        relay: { ws: 'ws://127.0.0.1/disabled' }
      },
      aws: { s3Prefix: '' },
      schema: {
        asset: { type: { $enum: ['script', 'texture', 'material', 'model', 'json', 'template'] } },
        animstategraphData: {},
        materialData: {},
        scene: {
          entities: {
            $of: {
              components: {
                camera: { enabled: { $type: 'boolean', $default: true } },
                light: { enabled: { $type: 'boolean', $default: true } },
                render: { enabled: { $type: 'boolean', $default: true } },
                script: {
                  enabled: { $type: 'boolean', $default: true },
                  scripts: { $type: 'array', $default: [] },
                  order: { $type: 'array', $default: [] }
                }
              }
            }
          },
          settings: { physics: {}, render: {} }
        },
        settings: {
          width: { $type: 'number', $default: 1280, $scope: 'project' },
          height: { $type: 'number', $default: 720, $scope: 'project' },
          useLegacyScripts: { $type: 'boolean', $default: false, $scope: 'project' },
          editor: { $type: 'object', $default: {}, $scope: 'user' }
        }
      },
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
    installFullBootFetchAdapter();
    installFullBootWebSocketDiagnostics();
    window.editor = window.editor || {};
	    window.editor.universoBridge = marker;
	    loadEditorBundle();
	        refreshEditorSaveAdapter();
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
    if (descriptor?.compatibilityConfig && typeof descriptor.compatibilityConfig === 'object') {
      marker.compatibilityConfig = descriptor.compatibilityConfig;
      marker.compatibilityConfigReady = true;
      if (window.config) {
        window.config.universoCompatibilityConfig = marker.compatibilityConfig;
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

	    void (async () => {
	      try {
        marker.compatibilityProtocol = await sendBridgeCommand('protocol.describe');
        if (window.config) {
          window.config.universoCompatibilityProtocol = marker.compatibilityProtocol?.data?.protocol || null;
        }
        marker.lastLoadedProject = await sendBridgeCommand('project.loadSelected');
        const loadedSelectedProject = applyLoadedProjectResponse(marker.lastLoadedProject);
        const activeProjectId = loadedSelectedProject?.project?.id || projectId;
        const activeSceneId = loadedSelectedProject?.defaultSceneId || sceneId;
        marker.lastSceneList = await sendBridgeCommand('scene.list', { projectId: activeProjectId });
        if (typeof activeSceneId === 'string' && activeSceneId) {
	        marker.lastLoadedScene = await sendBridgeCommand('scene.read', { projectId: activeProjectId, sceneId: activeSceneId });
          rememberScenePayloadEntities(marker.lastLoadedScene?.data?.payload);
          hydratePersistedSceneEntities();
          rebindUpstreamHierarchy();
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
    fs.writeFileSync(path.join(targetRoot, bridgeBootstrapFileName), `${source}\n`)
}

export const writeUniversoHostedEngineContract = (targetRoot) => {
    const jsRoot = path.join(targetRoot, 'js')
    fs.mkdirSync(jsRoot, { recursive: true })
    fs.writeFileSync(path.join(jsRoot, 'playcanvas-engine.js'), `export class Script {}\nexport default { Script };\n`)
    fs.writeFileSync(
        path.join(jsRoot, 'playcanvas-engine.d.ts'),
        `export class Script {}\ndeclare const pc: { Script: typeof Script };\nexport default pc;\n`
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
