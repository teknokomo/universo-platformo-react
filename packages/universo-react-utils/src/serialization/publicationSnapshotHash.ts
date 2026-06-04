import { getCodenamePrimary } from '../vlc'
import type { ObjectSystemFieldsSnapshot, MetahubSnapshotVersionEnvelope } from '@universo-react/types'

type SnapshotRecord = Record<string, unknown>

export interface PublicationSnapshotHashInput {
    version?: unknown
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    metahubId?: unknown
    entityTypeDefinitions?: Record<string, unknown>
    entities?: Record<string, unknown>
    elements?: Record<string, unknown>
    optionValues?: Record<string, unknown>
    constants?: Record<string, unknown>
    fixedValues?: Record<string, unknown>
    sharedComponents?: unknown
    sharedFixedValues?: unknown
    sharedOptionValues?: unknown
    sharedEntityOverrides?: unknown
    systemFields?: Record<string, ObjectSystemFieldsSnapshot | SnapshotRecord>
    modules?: unknown
    packages?: unknown
    layouts?: unknown
    scopedLayouts?: unknown
    layoutZoneWidgets?: unknown
    layoutWidgetOverrides?: unknown
    defaultLayoutId?: unknown
    layoutConfig?: unknown
    settings?: unknown
    playcanvasProjects?: unknown
    playcanvasRuntimeManifests?: unknown
}

export interface NormalizePublicationSnapshotForHashOptions {
    defaultVersionEnvelope?: MetahubSnapshotVersionEnvelope
}

const asArray = <Value>(value: unknown): Value[] => (Array.isArray(value) ? (value as Value[]) : [])
const asRecord = (value: unknown): SnapshotRecord => (value && typeof value === 'object' ? (value as SnapshotRecord) : {})
const compareStrings = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const normalizeCodenameValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
        return value
    }

    return value && typeof value === 'object' ? value : ''
}

const resolveCodenameSortText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }

    return value && typeof value === 'object' ? getCodenamePrimary(value as Parameters<typeof getCodenamePrimary>[0]) : ''
}

const normalizeLayout = (layoutValue: unknown): Record<string, unknown> => {
    const layout = asRecord(layoutValue)

    return {
        id: typeof layout.id === 'string' ? layout.id : '',
        templateKey: layout.templateKey,
        name: layout.name ?? {},
        description: layout.description ?? null,
        config: layout.config ?? {},
        isDefault: Boolean(layout.isDefault),
        isActive: Boolean(layout.isActive),
        sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
    }
}

const normalizeModuleManifest = (manifestValue: unknown): Record<string, unknown> => {
    const manifest = asRecord(manifestValue)

    return {
        className: typeof manifest.className === 'string' ? manifest.className : '',
        sdkApiVersion: typeof manifest.sdkApiVersion === 'string' ? manifest.sdkApiVersion : '',
        moduleRole: typeof manifest.moduleRole === 'string' ? manifest.moduleRole : '',
        sourceKind: typeof manifest.sourceKind === 'string' ? manifest.sourceKind : '',
        capabilities: asArray<unknown>(manifest.capabilities)
            .map((capability) => String(capability ?? ''))
            .sort(compareStrings),
        methods: asArray<unknown>(manifest.methods)
            .map((methodValue) => {
                const method = asRecord(methodValue)

                return {
                    name: typeof method.name === 'string' ? method.name : '',
                    target: typeof method.target === 'string' ? method.target : '',
                    eventName: typeof method.eventName === 'string' ? method.eventName : null
                }
            })
            .sort((left, right) => {
                if ((left.target as string) !== (right.target as string)) {
                    return compareStrings(left.target as string, right.target as string)
                }
                if ((left.eventName as string | null) !== (right.eventName as string | null)) {
                    return compareStrings(String(left.eventName ?? ''), String(right.eventName ?? ''))
                }
                return compareStrings(left.name as string, right.name as string)
            }),
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : null
    }
}

const normalizeModule = (scriptValue: unknown): Record<string, unknown> => {
    const module = asRecord(scriptValue)

    return {
        id: typeof module.id === 'string' ? module.id : '',
        codename: normalizeCodenameValue(module.codename),
        presentation: module.presentation ?? {},
        attachedToKind: typeof module.attachedToKind === 'string' ? module.attachedToKind : '',
        attachedToId: typeof module.attachedToId === 'string' ? module.attachedToId : null,
        moduleRole: typeof module.moduleRole === 'string' ? module.moduleRole : '',
        sourceKind: typeof module.sourceKind === 'string' ? module.sourceKind : '',
        sdkApiVersion: typeof module.sdkApiVersion === 'string' ? module.sdkApiVersion : '',
        sourceCode: typeof module.sourceCode === 'string' ? module.sourceCode : null,
        sourceStorage:
            module.sourceStorage && typeof module.sourceStorage === 'object'
                ? {
                      mode: typeof asRecord(module.sourceStorage).mode === 'string' ? asRecord(module.sourceStorage).mode : 'inline',
                      path: typeof asRecord(module.sourceStorage).path === 'string' ? asRecord(module.sourceStorage).path : null,
                      checksum:
                          typeof asRecord(module.sourceStorage).checksum === 'string' ? asRecord(module.sourceStorage).checksum : null,
                      content: typeof asRecord(module.sourceStorage).content === 'string' ? asRecord(module.sourceStorage).content : null
                  }
                : {
                      mode: typeof module.storageMode === 'string' ? module.storageMode : 'inline',
                      path: typeof module.sourcePath === 'string' ? module.sourcePath : null,
                      checksum: typeof module.sourceChecksum === 'string' ? module.sourceChecksum : null,
                      content: null
                  },
        manifest: normalizeModuleManifest(module.manifest),
        serverBundle: typeof module.serverBundle === 'string' ? module.serverBundle : null,
        clientBundle: typeof module.clientBundle === 'string' ? module.clientBundle : null,
        checksum: typeof module.checksum === 'string' ? module.checksum : '',
        isActive: module.isActive !== false,
        config: module.config ?? {}
    }
}

const normalizePackage = (packageValue: unknown): Record<string, unknown> => {
    const item = asRecord(packageValue)
    const source = asRecord(item.source)

    return {
        packageName: typeof item.packageName === 'string' ? item.packageName : '',
        version: typeof item.version === 'string' ? item.version : '',
        source: {
            kind: typeof source.kind === 'string' ? source.kind : '',
            packageName: typeof source.packageName === 'string' ? source.packageName : '',
            importName: typeof source.importName === 'string' ? source.importName : '',
            upstreamPackageName: typeof source.upstreamPackageName === 'string' ? source.upstreamPackageName : '',
            upstreamVersion: typeof source.upstreamVersion === 'string' ? source.upstreamVersion : '',
            runtimeTargets: asArray<unknown>(source.runtimeTargets)
                .map((target) => String(target ?? ''))
                .sort(compareStrings)
        },
        config: item.config === undefined ? undefined : item.config
    }
}

const normalizePlayCanvasRuntimeManifest = (manifestValue: unknown): Record<string, unknown> => {
    const manifest = asRecord(manifestValue)

    return {
        schemaVersion: typeof manifest.schemaVersion === 'string' ? manifest.schemaVersion : '1',
        projectId: typeof manifest.projectId === 'string' ? manifest.projectId : '',
        sceneId: typeof manifest.sceneId === 'string' ? manifest.sceneId : null,
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : '',
        assets: asArray<SnapshotRecord>(manifest.assets)
            .map((asset) => ({
                id: typeof asset.id === 'string' ? asset.id : '',
                type: typeof asset.type === 'string' ? asset.type : '',
                name: typeof asset.name === 'string' ? asset.name : '',
                url: typeof asset.url === 'string' ? asset.url : null,
                hash: typeof asset.hash === 'string' ? asset.hash : null,
                mime: typeof asset.mime === 'string' ? asset.mime : null,
                size: typeof asset.size === 'number' ? asset.size : null
            }))
            .sort((left, right) => compareStrings(String(left.id ?? ''), String(right.id ?? ''))),
        scripts: asArray<SnapshotRecord>(manifest.scripts)
            .map((script) => ({
                id: typeof script.id === 'string' ? script.id : '',
                scriptName: typeof script.scriptName === 'string' ? script.scriptName : '',
                scriptKind: typeof script.scriptKind === 'string' ? script.scriptKind : '',
                artifactUrl: typeof script.artifactUrl === 'string' ? script.artifactUrl : null,
                artifactHash: typeof script.artifactHash === 'string' ? script.artifactHash : null,
                moduleId: typeof script.moduleId === 'string' ? script.moduleId : null,
                moduleCodename: typeof script.moduleCodename === 'string' ? script.moduleCodename : null,
                attributes: script.attributes && typeof script.attributes === 'object' ? script.attributes : {},
                attributeValues: script.attributeValues && typeof script.attributeValues === 'object' ? script.attributeValues : {},
                sceneEntityStableId: typeof script.sceneEntityStableId === 'string' ? script.sceneEntityStableId : null
            }))
            .sort((left, right) => {
                if ((left.scriptName as string) !== (right.scriptName as string)) {
                    return compareStrings(left.scriptName as string, right.scriptName as string)
                }
                return compareStrings(String(left.id ?? ''), String(right.id ?? ''))
            }),
        metadata: manifest.metadata && typeof manifest.metadata === 'object' ? manifest.metadata : {}
    }
}

const normalizePlayCanvasFileReference = (fileValue: unknown): Record<string, unknown> | null => {
    const file = asRecord(fileValue)
    if (!fileValue || typeof fileValue !== 'object') return null

    return {
        provider: typeof file.provider === 'string' ? file.provider : '',
        root: typeof file.root === 'string' ? file.root : '',
        path: typeof file.path === 'string' ? file.path : '',
        hash: typeof file.hash === 'string' ? file.hash : null,
        size: typeof file.size === 'number' ? file.size : null,
        mime: typeof file.mime === 'string' ? file.mime : null,
        storageClass: typeof file.storageClass === 'string' ? file.storageClass : null,
        status: typeof file.status === 'string' ? file.status : null,
        snapshotContentBase64: typeof file.snapshotContentBase64 === 'string' ? file.snapshotContentBase64 : null
    }
}

const normalizePlayCanvasProjectsSection = (sectionValue: unknown): Record<string, unknown> | undefined => {
    if (sectionValue === undefined) return undefined
    const section = asRecord(sectionValue)

    return {
        schemaVersion: typeof section.schemaVersion === 'number' || typeof section.schemaVersion === 'string' ? section.schemaVersion : 1,
        projects: asArray<SnapshotRecord>(section.projects)
            .map((project) => ({
                id: typeof project.id === 'string' ? project.id : '',
                schemaVersion: typeof project.schemaVersion === 'string' ? project.schemaVersion : '1',
                codename: normalizeCodenameValue(project.codename),
                displayName: project.displayName ?? {},
                description: project.description ?? null,
                packageRef: project.packageRef && typeof project.packageRef === 'object' ? project.packageRef : {},
                settings: project.settings && typeof project.settings === 'object' ? project.settings : {},
                defaultSceneId: typeof project.defaultSceneId === 'string' ? project.defaultSceneId : null,
                publicationConfig:
                    project.publicationConfig && typeof project.publicationConfig === 'object' ? project.publicationConfig : {}
            }))
            .sort((left, right) => compareStrings(String(left.id ?? ''), String(right.id ?? ''))),
        scenes: asArray<SnapshotRecord>(section.scenes)
            .map((scene) => ({
                id: typeof scene.id === 'string' ? scene.id : '',
                projectId: typeof scene.projectId === 'string' ? scene.projectId : '',
                codename: normalizeCodenameValue(scene.codename),
                displayName: scene.displayName ?? {},
                payloadSchemaVersion: typeof scene.payloadSchemaVersion === 'string' ? scene.payloadSchemaVersion : '1',
                payload: scene.payload && typeof scene.payload === 'object' ? scene.payload : null,
                payloadFile: normalizePlayCanvasFileReference(scene.payloadFile),
                checksum: typeof scene.checksum === 'string' ? scene.checksum : null,
                sortOrder: typeof scene.sortOrder === 'number' ? scene.sortOrder : 0,
                publish: scene.publish !== false
            }))
            .sort((left, right) => {
                if ((left.projectId as string) !== (right.projectId as string)) {
                    return compareStrings(left.projectId as string, right.projectId as string)
                }
                if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                    return (left.sortOrder as number) - (right.sortOrder as number)
                }
                return compareStrings(left.id as string, right.id as string)
            }),
        assets: asArray<SnapshotRecord>(section.assets)
            .map((asset) => ({
                id: typeof asset.id === 'string' ? asset.id : '',
                projectId: typeof asset.projectId === 'string' ? asset.projectId : '',
                stableAssetId: typeof asset.stableAssetId === 'string' ? asset.stableAssetId : '',
                type: typeof asset.type === 'string' ? asset.type : '',
                name: typeof asset.name === 'string' ? asset.name : '',
                virtualPath: asArray<unknown>(asset.virtualPath).map((part) => String(part ?? '')),
                file: normalizePlayCanvasFileReference(asset.file),
                metadata: asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {},
                publish: asset.publish !== false
            }))
            .sort((left, right) => {
                if ((left.projectId as string) !== (right.projectId as string)) {
                    return compareStrings(left.projectId as string, right.projectId as string)
                }
                return compareStrings(left.id as string, right.id as string)
            }),
        scriptAssets: asArray<SnapshotRecord>(section.scriptAssets)
            .map((script) => ({
                id: typeof script.id === 'string' ? script.id : '',
                assetId: typeof script.assetId === 'string' ? script.assetId : '',
                moduleId: typeof script.moduleId === 'string' ? script.moduleId : null,
                moduleCodename: typeof script.moduleCodename === 'string' ? script.moduleCodename : null,
                moduleSourcePath: typeof script.moduleSourcePath === 'string' ? script.moduleSourcePath : null,
                scriptName: typeof script.scriptName === 'string' ? script.scriptName : '',
                scriptKind: typeof script.scriptKind === 'string' ? script.scriptKind : '',
                parsedAttributes: script.parsedAttributes && typeof script.parsedAttributes === 'object' ? script.parsedAttributes : {},
                parseStatus: typeof script.parseStatus === 'string' ? script.parseStatus : '',
                parseDiagnostics: script.parseDiagnostics && typeof script.parseDiagnostics === 'object' ? script.parseDiagnostics : null
            }))
            .sort((left, right) => compareStrings(left.id as string, right.id as string)),
        sceneScriptBindings: asArray<SnapshotRecord>(section.sceneScriptBindings)
            .map((binding) => ({
                id: typeof binding.id === 'string' ? binding.id : '',
                sceneId: typeof binding.sceneId === 'string' ? binding.sceneId : '',
                sceneEntityStableId: typeof binding.sceneEntityStableId === 'string' ? binding.sceneEntityStableId : '',
                scriptAssetId: typeof binding.scriptAssetId === 'string' ? binding.scriptAssetId : '',
                scriptName: typeof binding.scriptName === 'string' ? binding.scriptName : '',
                attributeValues: binding.attributeValues && typeof binding.attributeValues === 'object' ? binding.attributeValues : {},
                bindingSchemaVersion: typeof binding.bindingSchemaVersion === 'string' ? binding.bindingSchemaVersion : '1',
                platformoEntityId: typeof binding.platformoEntityId === 'string' ? binding.platformoEntityId : null,
                sortOrder: typeof binding.sortOrder === 'number' ? binding.sortOrder : 0,
                enabled: binding.enabled !== false
            }))
            .sort((left, right) => compareStrings(left.id as string, right.id as string)),
        generatedArtifacts: asArray<SnapshotRecord>(section.generatedArtifacts)
            .map((artifact) => ({
                id: typeof artifact.id === 'string' ? artifact.id : '',
                scriptAssetId: typeof artifact.scriptAssetId === 'string' ? artifact.scriptAssetId : '',
                sourceModuleId: typeof artifact.sourceModuleId === 'string' ? artifact.sourceModuleId : null,
                sourceModuleCodename: typeof artifact.sourceModuleCodename === 'string' ? artifact.sourceModuleCodename : null,
                sourceModulePath: typeof artifact.sourceModulePath === 'string' ? artifact.sourceModulePath : null,
                sourceChecksum: typeof artifact.sourceChecksum === 'string' ? artifact.sourceChecksum : null,
                outputFile: normalizePlayCanvasFileReference(artifact.outputFile),
                scriptName: typeof artifact.scriptName === 'string' ? artifact.scriptName : '',
                moduleExportName: typeof artifact.moduleExportName === 'string' ? artifact.moduleExportName : null,
                scriptKind: typeof artifact.scriptKind === 'string' ? artifact.scriptKind : '',
                parseStatus: typeof artifact.parseStatus === 'string' ? artifact.parseStatus : '',
                generatedAt: typeof artifact.generatedAt === 'string' ? artifact.generatedAt : null,
                parsedAt: typeof artifact.parsedAt === 'string' ? artifact.parsedAt : null
            }))
            .sort((left, right) => compareStrings(left.id as string, right.id as string)),
        runtimeManifests: asArray<unknown>(section.runtimeManifests)
            .map(normalizePlayCanvasRuntimeManifest)
            .sort((left, right) => {
                if ((left.projectId as string) !== (right.projectId as string)) {
                    return compareStrings(left.projectId as string, right.projectId as string)
                }
                return compareStrings(String(left.sceneId ?? ''), String(right.sceneId ?? ''))
            })
    }
}

const normalizeField = (fieldValue: unknown): Record<string, unknown> => {
    const field = asRecord(fieldValue)
    const sortOrder = typeof field.sortOrder === 'number' ? field.sortOrder : 0

    return {
        id: typeof field.id === 'string' ? field.id : '',
        codename: normalizeCodenameValue(field.codename),
        dataType: field.dataType,
        isRequired: Boolean(field.isRequired),
        isDisplayComponent: Boolean(field.isDisplayComponent),
        targetEntityId: typeof field.targetEntityId === 'string' ? field.targetEntityId : null,
        targetEntityKind: typeof field.targetEntityKind === 'string' ? field.targetEntityKind : null,
        targetConstantId: typeof field.targetConstantId === 'string' ? field.targetConstantId : null,
        presentation: field.presentation ?? {},
        validationRules: field.validationRules ?? {},
        uiConfig: field.uiConfig ?? {},
        sortOrder,
        parentComponentId: typeof field.parentComponentId === 'string' ? field.parentComponentId : null,
        childFields: field.childFields
            ? asArray<unknown>(field.childFields)
                  .map((childFieldValue) => {
                      const childField = normalizeField(childFieldValue)
                      const { parentComponentId: _parentComponentId, childFields: _childFields, ...normalizedChildField } = childField
                      return normalizedChildField
                  })
                  .sort((left, right) => {
                      if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                          return (left.sortOrder as number) - (right.sortOrder as number)
                      }
                      if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                          return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
                      }
                      return compareStrings(left.id as string, right.id as string)
                  })
            : undefined
    }
}

const normalizeConstant = (constantValue: unknown): Record<string, unknown> => {
    const fixedValue = asRecord(constantValue)

    return {
        id: typeof fixedValue.id === 'string' ? fixedValue.id : '',
        codename: normalizeCodenameValue(fixedValue.codename),
        dataType: fixedValue.dataType,
        presentation: fixedValue.presentation ?? {},
        validationRules: fixedValue.validationRules ?? {},
        uiConfig: fixedValue.uiConfig ?? {},
        value: fixedValue.value ?? null,
        sortOrder: typeof fixedValue.sortOrder === 'number' ? fixedValue.sortOrder : 0
    }
}

const normalizeEnumerationValue = (valueValue: unknown): Record<string, unknown> => {
    const value = asRecord(valueValue)

    return {
        id: typeof value.id === 'string' ? value.id : '',
        codename: normalizeCodenameValue(value.codename),
        presentation: value.presentation ?? {},
        sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
        isDefault: Boolean(value.isDefault)
    }
}

const normalizeResourceSurface = (surfaceValue: unknown): Record<string, unknown> => {
    const surface = asRecord(surfaceValue)

    return {
        key: typeof surface.key === 'string' ? surface.key : '',
        capability: typeof surface.capability === 'string' ? surface.capability : '',
        routeSegment: typeof surface.routeSegment === 'string' ? surface.routeSegment : '',
        title: surface.title ?? null,
        titleKey: typeof surface.titleKey === 'string' ? surface.titleKey : null,
        fallbackTitle: typeof surface.fallbackTitle === 'string' ? surface.fallbackTitle : null
    }
}

const normalizeEntityTypeDefinition = (kindKey: string, definitionValue: unknown): Record<string, unknown> => {
    const definition = asRecord(definitionValue)
    const ui = asRecord(definition.ui)

    return {
        id: typeof definition.id === 'string' ? definition.id : '',
        kindKey: typeof definition.kindKey === 'string' ? definition.kindKey : kindKey,
        codename: normalizeCodenameValue(definition.codename),
        presentation: definition.presentation ?? {},
        components: definition.components ?? {},
        ui: {
            iconName: typeof ui.iconName === 'string' ? ui.iconName : '',
            tabs: asArray<string>(ui.tabs).sort(compareStrings),
            sidebarSection: typeof ui.sidebarSection === 'string' ? ui.sidebarSection : 'objects',
            sidebarOrder: typeof ui.sidebarOrder === 'number' ? ui.sidebarOrder : null,
            nameKey: typeof ui.nameKey === 'string' ? ui.nameKey : '',
            descriptionKey: typeof ui.descriptionKey === 'string' ? ui.descriptionKey : null,
            resourceSurfaces: asArray<unknown>(ui.resourceSurfaces)
                .map(normalizeResourceSurface)
                .sort((left, right) => {
                    if ((left.capability as string) !== (right.capability as string)) {
                        return compareStrings(left.capability as string, right.capability as string)
                    }
                    return compareStrings(left.key as string, right.key as string)
                })
        },
        config: definition.config ?? {},
        published: definition.published === true
    }
}

const compareBySortOrderCodenameAndId = (left: Record<string, unknown>, right: Record<string, unknown>): number => {
    if ((left.sortOrder as number) !== (right.sortOrder as number)) {
        return (left.sortOrder as number) - (right.sortOrder as number)
    }
    if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
        return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
    }
    return compareStrings(String(left.id ?? ''), String(right.id ?? ''))
}

export const normalizePublicationSnapshotForHash = (
    snapshot: PublicationSnapshotHashInput,
    options: NormalizePublicationSnapshotForHashOptions = {}
): Record<string, unknown> => {
    const snapshotSystemFields =
        snapshot.systemFields && typeof snapshot.systemFields === 'object'
            ? (snapshot.systemFields as Record<string, ObjectSystemFieldsSnapshot | SnapshotRecord>)
            : null

    const entityTypeDefinitions = Object.entries(snapshot.entityTypeDefinitions ?? {})
        .map(([kindKey, definition]) => normalizeEntityTypeDefinition(kindKey, definition))
        .sort((left, right) => compareStrings(String(left.kindKey ?? ''), String(right.kindKey ?? '')))

    const entities = Object.values(snapshot.entities ?? {})
        .map((entityValue) => {
            const entity = asRecord(entityValue)
            const entityId = typeof entity.id === 'string' ? entity.id : ''

            return {
                id: entityId,
                kind: typeof entity.kind === 'string' ? entity.kind : '',
                codename: normalizeCodenameValue(entity.codename),
                tableName:
                    typeof entity.physicalTableName === 'string'
                        ? entity.physicalTableName
                        : typeof entity.tableName === 'string'
                        ? entity.tableName
                        : undefined,
                presentation: entity.presentation ?? {},
                config: entity.config ?? {},
                systemFields: snapshotSystemFields?.[entityId] ?? null,
                hubs: asArray<string>(entity.hubs).sort(compareStrings),
                fields: asArray<unknown>(entity.fields)
                    .map(normalizeField)
                    .sort((left, right) => {
                        if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                            return (left.sortOrder as number) - (right.sortOrder as number)
                        }
                        if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                            return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
                        }
                        return compareStrings(left.id as string, right.id as string)
                    })
            }
        })
        .sort((left, right) => {
            if (left.kind !== right.kind) return compareStrings(left.kind, right.kind)
            if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
            }
            return compareStrings(left.id, right.id)
        })

    const elements = Object.entries(snapshot.elements ?? {})
        .map(([objectId, list]) => ({
            objectId,
            elements: asArray<SnapshotRecord>(list)
                .map((element) => ({
                    id: typeof element.id === 'string' ? element.id : '',
                    data: element.data ?? {},
                    sortOrder: typeof element.sortOrder === 'number' ? element.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    return compareStrings(left.id, right.id)
                })
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const optionValues = Object.entries(snapshot.optionValues ?? {})
        .map(([objectId, list]) => ({
            objectId,
            values: asArray<SnapshotRecord>(list).map(normalizeEnumerationValue).sort(compareBySortOrderCodenameAndId)
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const fixedValues = Object.entries(snapshot.fixedValues ?? snapshot.constants ?? {})
        .map(([objectId, list]) => ({
            objectId,
            constants: asArray<SnapshotRecord>(list).map(normalizeConstant).sort(compareBySortOrderCodenameAndId)
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const sharedComponents = asArray<unknown>(snapshot.sharedComponents).map(normalizeField).sort(compareBySortOrderCodenameAndId)

    const sharedFixedValues = asArray<unknown>(snapshot.sharedFixedValues).map(normalizeConstant).sort(compareBySortOrderCodenameAndId)

    const sharedOptionValues = asArray<unknown>(snapshot.sharedOptionValues)
        .map(normalizeEnumerationValue)
        .sort(compareBySortOrderCodenameAndId)

    const sharedEntityOverrides = asArray<SnapshotRecord>(snapshot.sharedEntityOverrides)
        .map((override) => ({
            id: typeof override.id === 'string' ? override.id : '',
            entityKind: typeof override.entityKind === 'string' ? override.entityKind : '',
            sharedEntityId: typeof override.sharedEntityId === 'string' ? override.sharedEntityId : '',
            targetObjectId: typeof override.targetObjectId === 'string' ? override.targetObjectId : '',
            isExcluded: override.isExcluded === true,
            isActive: typeof override.isActive === 'boolean' ? override.isActive : null,
            sortOrder: typeof override.sortOrder === 'number' ? override.sortOrder : null
        }))
        .sort((left, right) => {
            if ((left.entityKind as string) !== (right.entityKind as string)) {
                return compareStrings(left.entityKind as string, right.entityKind as string)
            }
            if ((left.targetObjectId as string) !== (right.targetObjectId as string)) {
                return compareStrings(left.targetObjectId as string, right.targetObjectId as string)
            }
            if ((left.sortOrder as number | null) !== (right.sortOrder as number | null)) {
                return Number(left.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.sortOrder ?? Number.MAX_SAFE_INTEGER)
            }
            if ((left.sharedEntityId as string) !== (right.sharedEntityId as string)) {
                return compareStrings(left.sharedEntityId as string, right.sharedEntityId as string)
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const modules = asArray<unknown>(snapshot.modules)
        .map(normalizeModule)
        .sort((left, right) => {
            if ((left.attachedToKind as string) !== (right.attachedToKind as string)) {
                return compareStrings(left.attachedToKind as string, right.attachedToKind as string)
            }
            if ((left.attachedToId as string | null) !== (right.attachedToId as string | null)) {
                return compareStrings(String(left.attachedToId ?? ''), String(right.attachedToId ?? ''))
            }
            if ((left.moduleRole as string) !== (right.moduleRole as string)) {
                return compareStrings(left.moduleRole as string, right.moduleRole as string)
            }
            if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const packages = asArray<unknown>(snapshot.packages)
        .map(normalizePackage)
        .sort((left, right) => {
            if ((left.packageName as string) !== (right.packageName as string)) {
                return compareStrings(left.packageName as string, right.packageName as string)
            }
            return compareStrings(left.version as string, right.version as string)
        })

    const playcanvasRuntimeManifests =
        snapshot.playcanvasRuntimeManifests === undefined
            ? undefined
            : asArray<unknown>(snapshot.playcanvasRuntimeManifests)
                  .map(normalizePlayCanvasRuntimeManifest)
                  .sort((left, right) => {
                      if ((left.projectId as string) !== (right.projectId as string)) {
                          return compareStrings(left.projectId as string, right.projectId as string)
                      }
                      return compareStrings(String(left.sceneId ?? ''), String(right.sceneId ?? ''))
                  })
    const playcanvasProjects = normalizePlayCanvasProjectsSection(snapshot.playcanvasProjects)

    const layouts = asArray<unknown>(snapshot.layouts)
        .map(normalizeLayout)
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
            return compareStrings(left.id, right.id)
        })

    const scopedLayouts = asArray<unknown>(snapshot.scopedLayouts)
        .map((layoutValue) => {
            const layout = asRecord(layoutValue)

            return {
                ...normalizeLayout(layout),
                scopeEntityId: typeof layout.scopeEntityId === 'string' ? layout.scopeEntityId : '',
                scopeEntityKind: typeof layout.scopeEntityKind === 'string' ? layout.scopeEntityKind : null,
                baseLayoutId: typeof layout.baseLayoutId === 'string' ? layout.baseLayoutId : ''
            }
        })
        .sort((left, right) => {
            if ((left.scopeEntityId as string) !== (right.scopeEntityId as string)) {
                return compareStrings(left.scopeEntityId as string, right.scopeEntityId as string)
            }
            if ((left.scopeEntityKind as string | null) !== (right.scopeEntityKind as string | null)) {
                return compareStrings(String(left.scopeEntityKind ?? ''), String(right.scopeEntityKind ?? ''))
            }
            if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                return (left.sortOrder as number) - (right.sortOrder as number)
            }
            if ((left.isDefault as boolean) !== (right.isDefault as boolean)) {
                return left.isDefault ? -1 : 1
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const layoutZoneWidgets = asArray<SnapshotRecord>(snapshot.layoutZoneWidgets)
        .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            layoutId: typeof item.layoutId === 'string' ? item.layoutId : '',
            zone: typeof item.zone === 'string' ? item.zone : '',
            widgetKey: item.widgetKey,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: item.config ?? {},
            isActive: Boolean(item.isActive)
        }))
        .sort((left, right) => {
            if (left.layoutId !== right.layoutId) return compareStrings(left.layoutId, right.layoutId)
            if (left.zone !== right.zone) return compareStrings(left.zone, right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            return compareStrings(left.id, right.id)
        })

    const layoutWidgetOverrides = asArray<unknown>(snapshot.layoutWidgetOverrides)
        .map((itemValue) => {
            const item = asRecord(itemValue)

            return {
                id: typeof item.id === 'string' ? item.id : '',
                layoutId: typeof item.layoutId === 'string' ? item.layoutId : '',
                baseWidgetId: typeof item.baseWidgetId === 'string' ? item.baseWidgetId : '',
                zone: typeof item.zone === 'string' ? item.zone : null,
                sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : null,
                config: item.config && typeof item.config === 'object' ? item.config : null,
                isActive: typeof item.isActive === 'boolean' ? item.isActive : null,
                isDeletedOverride: item.isDeletedOverride === true
            }
        })
        .sort((left, right) => {
            if ((left.layoutId as string) !== (right.layoutId as string)) {
                return compareStrings(left.layoutId as string, right.layoutId as string)
            }
            if ((left.baseWidgetId as string) !== (right.baseWidgetId as string)) {
                return compareStrings(left.baseWidgetId as string, right.baseWidgetId as string)
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const systemFields = snapshotSystemFields
        ? Object.entries(snapshotSystemFields)
              .map(([entityId, value]) => {
                  const record = asRecord(value)
                  const fields = asArray<SnapshotRecord>(record.fields)
                      .map((field) => ({ ...field }))
                      .sort((left, right) => compareStrings(String(left.key ?? ''), String(right.key ?? '')))

                  return {
                      entityId,
                      fields,
                      lifecycleContract: record.lifecycleContract
                  }
              })
              .sort((left, right) => compareStrings(left.entityId, right.entityId))
        : []
    const settings = asArray<SnapshotRecord>(snapshot.settings)
        .map((setting) => ({
            key: typeof setting.key === 'string' ? setting.key : '',
            value: setting.value && typeof setting.value === 'object' ? setting.value : {}
        }))
        .filter((setting) => setting.key.length > 0)
        .sort((left, right) => compareStrings(left.key, right.key))

    return {
        version: snapshot.version,
        versionEnvelope: snapshot.versionEnvelope ?? options.defaultVersionEnvelope,
        metahubId: snapshot.metahubId,
        entityTypeDefinitions,
        entities,
        elements,
        optionValues,
        fixedValues,
        sharedComponents,
        sharedFixedValues,
        sharedOptionValues,
        sharedEntityOverrides,
        systemFields,
        modules,
        packages,
        ...(playcanvasProjects === undefined ? {} : { playcanvasProjects }),
        ...(playcanvasRuntimeManifests === undefined ? {} : { playcanvasRuntimeManifests }),
        layouts,
        scopedLayouts,
        layoutZoneWidgets,
        layoutWidgetOverrides,
        defaultLayoutId: snapshot.defaultLayoutId ?? null,
        layoutConfig: snapshot.layoutConfig ?? {},
        settings
    }
}
