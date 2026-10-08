import assert from 'node:assert/strict'
import test from 'node:test'
import {
    findFirstSnapshotFixtureDifference,
    normalizeSnapshotFixtureVolatileValues,
    stableSnapshotFixtureStringify
} from './snapshotFixtureDrift.ts'

test('normalizes regenerated UUIDs while preserving their relationships', () => {
    const tracked = {
        objects: [
            { id: '019a1111-1111-7111-8111-111111111111', sourceId: '019a2222-2222-7222-8222-222222222222' },
            { id: '019a2222-2222-7222-8222-222222222222' }
        ]
    }
    const generated = {
        objects: [
            { id: '019b1111-1111-7111-8111-111111111111', sourceId: '019b2222-2222-7222-8222-222222222222' },
            { id: '019b2222-2222-7222-8222-222222222222' }
        ]
    }

    assert.equal(
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues(tracked)),
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues(generated))
    )
})

test('canonicalizes UUID-keyed maps independently of regenerated physical keys', () => {
    const tracked = {
        entities: {
            '019a1111-1111-7111-8111-111111111111': {
                id: '019a1111-1111-7111-8111-111111111111',
                kind: 'object',
                codename: 'Orders',
                tableName: 'obj_019a1111111171118111111111111111'
            },
            '019a2222-2222-7222-8222-222222222222': {
                id: '019a2222-2222-7222-8222-222222222222',
                kind: 'enumeration',
                codename: 'Status',
                tableName: 'enum_019a2222222272228222222222222222'
            }
        }
    }
    const regenerated = {
        entities: {
            '019b9999-9999-7999-8999-999999999999': {
                id: '019b9999-9999-7999-8999-999999999999',
                kind: 'enumeration',
                codename: 'Status',
                tableName: 'enum_019b9999999979998999999999999999'
            },
            '019b8888-8888-7888-8888-888888888888': {
                id: '019b8888-8888-7888-8888-888888888888',
                kind: 'object',
                codename: 'Orders',
                tableName: 'obj_019b8888888878888888888888888888'
            }
        }
    }

    assert.equal(
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues(tracked)),
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues(regenerated))
    )
})

test('preserves authored differences inside UUID-keyed maps', () => {
    const tracked = {
        entities: {
            '019a1111-1111-7111-8111-111111111111': {
                id: '019a1111-1111-7111-8111-111111111111',
                codename: 'Orders'
            }
        }
    }
    const regenerated = {
        entities: {
            '019b1111-1111-7111-8111-111111111111': {
                id: '019b1111-1111-7111-8111-111111111111',
                codename: 'Invoices'
            }
        }
    }

    assert.ok(
        findFirstSnapshotFixtureDifference(
            normalizeSnapshotFixtureVolatileValues(tracked),
            normalizeSnapshotFixtureVolatileValues(regenerated)
        )
    )
})

test('normalizes Dashboard placement instance keys while preserving generic instance keys', () => {
    const tracked = {
        snapshot: {
            layoutZoneWidgets: [{ instanceKey: '019a1111-1111-7111-8111-111111111111', widgetKey: 'detailsTable' }]
        },
        authored: { instanceKey: '019a2222-2222-7222-8222-222222222222' }
    }
    const regenerated = {
        snapshot: {
            layoutZoneWidgets: [{ instanceKey: '019b1111-1111-7111-8111-111111111111', widgetKey: 'detailsTable' }]
        },
        authored: { instanceKey: '019b2222-2222-7222-8222-222222222222' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (normalizedTracked as typeof tracked).snapshot.layoutZoneWidgets[0].instanceKey,
        (normalizedGenerated as typeof regenerated).snapshot.layoutZoneWidgets[0].instanceKey
    )
    assert.notEqual(
        (normalizedTracked as typeof tracked).authored.instanceKey,
        (normalizedGenerated as typeof regenerated).authored.instanceKey
    )
})

test('normalizes Editor.js block timestamps while preserving generic time values', () => {
    const tracked = {
        config: { blockContent: { data: { time: 1_791_249_607_245 } } },
        authored: { time: 1_791_249_607_245 }
    }
    const regenerated = {
        config: { blockContent: { data: { time: 1_791_251_088_642 } } },
        authored: { time: 1_791_251_088_642 }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal((normalizedTracked as typeof tracked).config.blockContent.data.time, '<numeric-timestamp>')
    assert.equal((normalizedGenerated as typeof regenerated).config.blockContent.data.time, '<numeric-timestamp>')
    assert.notEqual((normalizedTracked as typeof tracked).authored.time, (normalizedGenerated as typeof regenerated).authored.time)
})

test('normalizes generator compile time and derived runtime manifest checksum only in their transport paths', () => {
    const tracked = {
        sourceStorage: { lastCompileAt: '2026-10-06T01:22:18.249Z' },
        runtimeManifest: { checksum: 'a'.repeat(64), scene: 'main' },
        authored: { lastCompileAt: '2026-10-06T01:22:18.249Z', checksum: 'a'.repeat(64) }
    }
    const regenerated = {
        sourceStorage: { lastCompileAt: '2026-10-06T01:47:14.606Z' },
        runtimeManifest: { checksum: 'b'.repeat(64), scene: 'main' },
        authored: { lastCompileAt: '2026-10-06T01:47:14.606Z', checksum: 'b'.repeat(64) }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal((normalizedTracked as typeof tracked).sourceStorage.lastCompileAt, '<timestamp>')
    assert.equal((normalizedGenerated as typeof regenerated).sourceStorage.lastCompileAt, '<timestamp>')
    assert.equal((normalizedTracked as typeof tracked).runtimeManifest.checksum, '<runtime-manifest-checksum>')
    assert.equal((normalizedGenerated as typeof regenerated).runtimeManifest.checksum, '<runtime-manifest-checksum>')
    assert.notEqual(
        (normalizedTracked as typeof tracked).authored.lastCompileAt,
        (normalizedGenerated as typeof regenerated).authored.lastCompileAt
    )
    assert.notEqual((normalizedTracked as typeof tracked).authored.checksum, (normalizedGenerated as typeof regenerated).authored.checksum)
})

test('normalizes generated PlayCanvas asset storage paths while preserving authored paths', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                assets: [{ file: { path: 'playcanvas-projects/019a1111-1111-7111-8111-111111111111/assets/flight-control.mjs' } }]
            }
        },
        authored: { path: 'docs/019a1111-1111-7111-8111-111111111111/guide.md' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                assets: [{ file: { path: 'playcanvas-projects/019b1111-1111-7111-8111-111111111111/assets/flight-control.mjs' } }]
            }
        },
        authored: { path: 'docs/019b1111-1111-7111-8111-111111111111/guide.md' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (normalizedTracked as typeof tracked).snapshot.playcanvasProjects.assets[0].file.path,
        (normalizedGenerated as typeof regenerated).snapshot.playcanvasProjects.assets[0].file.path
    )
    assert.notEqual((normalizedTracked as typeof tracked).authored.path, (normalizedGenerated as typeof regenerated).authored.path)
})

test('normalizes PlayCanvas editor document ids only inside generated asset metadata', () => {
    const tracked = {
        snapshot: { playcanvasProjects: { assets: [{ metadata: { editorDocumentId: 982756532 } }] } },
        authored: { editorDocumentId: 982756532 }
    }
    const regenerated = {
        snapshot: { playcanvasProjects: { assets: [{ metadata: { editorDocumentId: 1065511563 } }] } },
        authored: { editorDocumentId: 1065511563 }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (
            normalizedTracked as unknown as {
                snapshot: { playcanvasProjects: { assets: Array<{ metadata: { editorDocumentId: string } }> } }
            }
        ).snapshot.playcanvasProjects.assets[0].metadata.editorDocumentId,
        '<editor-document-id>'
    )
    assert.equal(
        (
            normalizedGenerated as unknown as {
                snapshot: { playcanvasProjects: { assets: Array<{ metadata: { editorDocumentId: string } }> } }
            }
        ).snapshot.playcanvasProjects.assets[0].metadata.editorDocumentId,
        '<editor-document-id>'
    )
    assert.notEqual(
        (normalizedTracked as typeof tracked).authored.editorDocumentId,
        (normalizedGenerated as typeof regenerated).authored.editorDocumentId
    )
})

test('normalizes PlayCanvas editor document keys only inside generated asset metadata', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: { assets: [{ metadata: { editorDocumentKey: 'asset:019a1111-1111-7111-8111-111111111111' } }] }
        },
        authored: { editorDocumentKey: 'asset:019a1111-1111-7111-8111-111111111111' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: { assets: [{ metadata: { editorDocumentKey: 'asset:019b1111-1111-7111-8111-111111111111' } }] }
        },
        authored: { editorDocumentKey: 'asset:019b1111-1111-7111-8111-111111111111' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (normalizedTracked as typeof tracked).snapshot.playcanvasProjects.assets[0].metadata.editorDocumentKey,
        (normalizedGenerated as typeof regenerated).snapshot.playcanvasProjects.assets[0].metadata.editorDocumentKey
    )
    assert.notEqual(
        (normalizedTracked as typeof tracked).authored.editorDocumentKey,
        (normalizedGenerated as typeof regenerated).authored.editorDocumentKey
    )
})

test('normalizes generated PlayCanvas stable asset ids while preserving authored ids', () => {
    const tracked = {
        snapshot: { playcanvasProjects: { assets: [{ stableAssetId: 'editor-af1d8ad03750cc0c03bf80f834ca2979' }] } },
        authored: { stableAssetId: 'editor-af1d8ad03750cc0c03bf80f834ca2979' }
    }
    const regenerated = {
        snapshot: { playcanvasProjects: { assets: [{ stableAssetId: 'editor-3c24b154128714056e93bad613ffbbf1' }] } },
        authored: { stableAssetId: 'editor-3c24b154128714056e93bad613ffbbf1' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (normalizedTracked as typeof tracked).snapshot.playcanvasProjects.assets[0].stableAssetId,
        (normalizedGenerated as typeof regenerated).snapshot.playcanvasProjects.assets[0].stableAssetId
    )
    assert.notEqual(
        (normalizedTracked as typeof tracked).authored.stableAssetId,
        (normalizedGenerated as typeof regenerated).authored.stableAssetId
    )
})

test('normalizes UUIDs in generated PlayCanvas artifact output paths only', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                generatedArtifacts: [
                    {
                        outputFile: {
                            path: 'playcanvas-projects/019a1111-1111-7111-8111-111111111111/generated/019a2222-2222-7222-8222-222222222222.mjs'
                        }
                    }
                ]
            }
        },
        authored: { path: 'generated/019a2222-2222-7222-8222-222222222222.mjs' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                generatedArtifacts: [
                    {
                        outputFile: {
                            path: 'playcanvas-projects/019b1111-1111-7111-8111-111111111111/generated/019b2222-2222-7222-8222-222222222222.mjs'
                        }
                    }
                ]
            }
        },
        authored: { path: 'generated/019b2222-2222-7222-8222-222222222222.mjs' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        (normalizedTracked as typeof tracked).snapshot.playcanvasProjects.generatedArtifacts[0].outputFile.path,
        (normalizedGenerated as typeof regenerated).snapshot.playcanvasProjects.generatedArtifacts[0].outputFile.path
    )
    assert.notEqual((normalizedTracked as typeof tracked).authored.path, (normalizedGenerated as typeof regenerated).authored.path)
})

test('normalizes generated PlayCanvas scene wrappers while preserving authored integrity fields', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                scenes: [
                    {
                        checksum: 'a'.repeat(64),
                        payload: { title: 'Authored scene' },
                        payloadFile: {
                            path: 'playcanvas-projects/019a1111-1111-7111-8111-111111111111/scenes/019a2222-2222-7222-8222-222222222222.json',
                            hash: 'b'.repeat(64),
                            snapshotContentBase64: 'generated-a',
                            size: 3709
                        }
                    }
                ]
            }
        },
        authored: {
            checksum: 'a'.repeat(64),
            hash: 'b'.repeat(64),
            snapshotContentBase64: 'generated-a',
            path: 'scenes/019a2222-2222-7222-8222-222222222222.json'
        }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                scenes: [
                    {
                        checksum: 'c'.repeat(64),
                        payload: { title: 'Authored scene' },
                        payloadFile: {
                            path: 'playcanvas-projects/019b1111-1111-7111-8111-111111111111/scenes/019b2222-2222-7222-8222-222222222222.json',
                            hash: 'd'.repeat(64),
                            snapshotContentBase64: 'generated-b',
                            size: 3709
                        }
                    }
                ]
            }
        },
        authored: {
            checksum: 'c'.repeat(64),
            hash: 'd'.repeat(64),
            snapshotContentBase64: 'generated-b',
            path: 'scenes/019b2222-2222-7222-8222-222222222222.json'
        }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal(
        stableSnapshotFixtureStringify((normalizedTracked as typeof tracked).snapshot),
        stableSnapshotFixtureStringify((normalizedGenerated as typeof regenerated).snapshot)
    )
    assert.ok(
        findFirstSnapshotFixtureDifference(
            (normalizedTracked as typeof tracked).authored,
            (normalizedGenerated as typeof regenerated).authored
        ),
        'generic authored checksum/hash/base64/path values remain drift-significant'
    )
})

test('normalizes generated PlayCanvas runtime-manifest scene assets without hiding script asset drift', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [
                    {
                        assets: [
                            {
                                id: 'scene:019a1111-1111-7111-8111-111111111111',
                                name: 'scene:019a1111-1111-7111-8111-111111111111',
                                type: 'scene',
                                mime: 'application/json',
                                size: 339628,
                                hash: 'a'.repeat(64),
                                url: 'data:application/json;base64,generated-a'
                            },
                            {
                                id: 'flight-control',
                                name: 'flight-control.mjs',
                                type: 'script',
                                mime: 'text/javascript',
                                size: 42,
                                hash: 'b'.repeat(64),
                                url: 'data:text/javascript;base64,YQ=='
                            }
                        ]
                    }
                ]
            }
        }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [
                    {
                        assets: [
                            {
                                id: 'scene:019b1111-1111-7111-8111-111111111111',
                                name: 'scene:019b1111-1111-7111-8111-111111111111',
                                type: 'scene',
                                mime: 'application/json',
                                size: 339628,
                                hash: 'c'.repeat(64),
                                url: 'data:application/json;base64,generated-b'
                            },
                            {
                                id: 'flight-control',
                                name: 'flight-control.mjs',
                                type: 'script',
                                mime: 'text/javascript',
                                size: 42,
                                hash: 'd'.repeat(64),
                                url: 'data:text/javascript;base64,YQ=='
                            }
                        ]
                    }
                ]
            }
        }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        stableSnapshotFixtureStringify(normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].assets[0]),
        stableSnapshotFixtureStringify(normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].assets[0])
    )
    assert.notEqual(
        normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].assets[1].hash,
        normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].assets[1].hash,
        'script asset hashes remain drift-significant'
    )
})

test('normalizes generated editor asset ids only inside PlayCanvas runtime manifests', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [{ assets: [{ id: 'editor-af1d8ad03750cc0c03bf80f834ca2979', type: 'script' }] }]
            }
        },
        authored: { id: 'editor-af1d8ad03750cc0c03bf80f834ca2979' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [{ assets: [{ id: 'editor-3c24b154128714056e93bad613ffbbf1', type: 'script' }] }]
            }
        },
        authored: { id: 'editor-3c24b154128714056e93bad613ffbbf1' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].assets[0].id,
        normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].assets[0].id
    )
    assert.notEqual(normalizedTracked.authored.id, normalizedGenerated.authored.id)
})

test('normalizes scene entity stable ids only inside PlayCanvas runtime-manifest scripts', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [
                    { scripts: [{ sceneEntityStableId: '019a1111-1111-7111-8111-111111111111', scriptName: 'flightControl' }] }
                ]
            }
        },
        authored: { sceneEntityStableId: '019a1111-1111-7111-8111-111111111111' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                runtimeManifests: [
                    { scripts: [{ sceneEntityStableId: '019b1111-1111-7111-8111-111111111111', scriptName: 'flightControl' }] }
                ]
            }
        },
        authored: { sceneEntityStableId: '019b1111-1111-7111-8111-111111111111' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].scripts[0].sceneEntityStableId,
        normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].scripts[0].sceneEntityStableId
    )
    assert.notEqual(normalizedTracked.authored.sceneEntityStableId, normalizedGenerated.authored.sceneEntityStableId)
})

test('normalizes scene entity stable ids only inside PlayCanvas scene-script bindings', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: {
                sceneScriptBindings: [{ sceneEntityStableId: '019a1111-1111-7111-8111-111111111111', scriptName: 'flightControl' }]
            }
        },
        authored: { sceneEntityStableId: '019a1111-1111-7111-8111-111111111111' }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: {
                sceneScriptBindings: [{ sceneEntityStableId: '019b1111-1111-7111-8111-111111111111', scriptName: 'flightControl' }]
            }
        },
        authored: { sceneEntityStableId: '019b1111-1111-7111-8111-111111111111' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        normalizedTracked.snapshot.playcanvasProjects.sceneScriptBindings[0].sceneEntityStableId,
        normalizedGenerated.snapshot.playcanvasProjects.sceneScriptBindings[0].sceneEntityStableId
    )
    assert.notEqual(normalizedTracked.authored.sceneEntityStableId, normalizedGenerated.authored.sceneEntityStableId)
})

test('normalizes only the derived PlayCanvas runtime-manifest checksum path', () => {
    const tracked = {
        snapshot: { playcanvasProjects: { runtimeManifests: [{ checksum: 'a'.repeat(64) }] } },
        authored: { checksum: 'a'.repeat(64) }
    }
    const regenerated = {
        snapshot: { playcanvasProjects: { runtimeManifests: [{ checksum: 'b'.repeat(64) }] } },
        authored: { checksum: 'b'.repeat(64) }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].checksum,
        normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].checksum
    )
    assert.notEqual(normalizedTracked.authored.checksum, normalizedGenerated.authored.checksum)
})

test('normalizes only the derived PlayCanvas runtime source-project checksum path', () => {
    const tracked = {
        snapshot: {
            playcanvasProjects: { runtimeManifests: [{ metadata: { sourceProjectChecksum: 'a'.repeat(64) } }] }
        },
        authored: { sourceProjectChecksum: 'a'.repeat(64) }
    }
    const regenerated = {
        snapshot: {
            playcanvasProjects: { runtimeManifests: [{ metadata: { sourceProjectChecksum: 'b'.repeat(64) } }] }
        },
        authored: { sourceProjectChecksum: 'b'.repeat(64) }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked) as typeof tracked
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated) as typeof regenerated

    assert.equal(
        normalizedTracked.snapshot.playcanvasProjects.runtimeManifests[0].metadata.sourceProjectChecksum,
        normalizedGenerated.snapshot.playcanvasProjects.runtimeManifests[0].metadata.sourceProjectChecksum
    )
    assert.notEqual(normalizedTracked.authored.sourceProjectChecksum, normalizedGenerated.authored.sourceProjectChecksum)
})

test('does not normalize authored content changes or array reordering', () => {
    const tracked = { rows: [{ name: 'Lunar logistics' }, { name: 'Learning design' }] }
    const changed = { rows: [{ name: 'Lunar operations' }, { name: 'Learning design' }] }
    const reordered = { rows: [{ name: 'Learning design' }, { name: 'Lunar logistics' }] }

    assert.ok(
        findFirstSnapshotFixtureDifference(normalizeSnapshotFixtureVolatileValues(tracked), normalizeSnapshotFixtureVolatileValues(changed))
    )
    assert.ok(
        findFirstSnapshotFixtureDifference(
            normalizeSnapshotFixtureVolatileValues(tracked),
            normalizeSnapshotFixtureVolatileValues(reordered)
        )
    )
})

test('normalizes UUID, snapshot hash and timestamp transport fields only', () => {
    const tracked = {
        id: '019a1111-1111-7111-8111-111111111111',
        createdAt: '2026-10-01T12:00:00.000Z',
        snapshotHash: 'a'.repeat(64),
        authoredContentHash: 'a'.repeat(64)
    }
    const regenerated = {
        id: '019b1111-1111-7111-8111-111111111111',
        createdAt: '2026-10-02T12:00:00.000Z',
        snapshotHash: 'b'.repeat(64),
        authoredContentHash: 'b'.repeat(64)
    }

    assert.ok(
        findFirstSnapshotFixtureDifference(
            normalizeSnapshotFixtureVolatileValues(tracked),
            normalizeSnapshotFixtureVolatileValues(regenerated)
        ),
        'authored hashes outside the snapshot envelope remain part of drift comparison'
    )
    assert.equal(
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues({ ...tracked, authoredContentHash: undefined })),
        stableSnapshotFixtureStringify(normalizeSnapshotFixtureVolatileValues({ ...regenerated, authoredContentHash: undefined }))
    )
})

test('preserves UUID-backed semantic placement identities and authored text', () => {
    const tracked = {
        id: '019a1111-1111-7111-8111-111111111111',
        instanceKey: '019a2222-2222-7222-8222-222222222222',
        sceneEntityStableId: '019a3333-3333-7333-8333-333333333333',
        externalId: '019a5555-5555-7555-8555-555555555555',
        description: 'Authored reference 019a4444-4444-7444-8444-444444444444'
    }
    const regenerated = {
        id: '019b1111-1111-7111-8111-111111111111',
        instanceKey: '019b2222-2222-7222-8222-222222222222',
        sceneEntityStableId: '019b3333-3333-7333-8333-333333333333',
        externalId: '019b5555-5555-7555-8555-555555555555',
        description: 'Authored reference 019b4444-4444-7444-8444-444444444444'
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal((normalizedTracked as typeof tracked).id, (normalizedGenerated as typeof regenerated).id)
    assert.equal((normalizedTracked as typeof tracked).instanceKey, tracked.instanceKey)
    assert.equal((normalizedTracked as typeof tracked).sceneEntityStableId, tracked.sceneEntityStableId)
    assert.equal((normalizedTracked as typeof tracked).externalId, tracked.externalId)
    assert.equal((normalizedTracked as typeof tracked).description, tracked.description)
    assert.ok(findFirstSnapshotFixtureDifference(normalizedTracked, normalizedGenerated))
})

test('normalizes timestamps only in recognized transport timestamp fields', () => {
    const tracked = {
        createdAt: '2026-10-01T12:00:00.000Z',
        generatedAt: 1_791_001_234_567,
        time: 1_791_001_234_567,
        authoredText: '2026-10-01T12:00:00.000Z',
        score: 1_791_001_234_567
    }
    const regenerated = {
        createdAt: '2026-10-02T12:00:00.000Z',
        generatedAt: 1_791_087_634_567,
        time: 1_791_087_634_567,
        authoredText: '2026-10-02T12:00:00.000Z',
        score: 1_791_087_634_567
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.equal((normalizedTracked as typeof tracked).createdAt, '<timestamp>')
    assert.equal((normalizedTracked as unknown as { generatedAt: string }).generatedAt, '<numeric-timestamp>')
    assert.equal((normalizedTracked as typeof tracked).time, tracked.time)
    assert.ok(findFirstSnapshotFixtureDifference(normalizedTracked, normalizedGenerated))
})

test('normalizes volatile IDs in a stable key order without allowing unknown UUID fields', () => {
    const tracked = {
        second: { id: '019a2222-2222-7222-8222-222222222222' },
        first: { id: '019a1111-1111-7111-8111-111111111111' },
        externalId: '019a3333-3333-7333-8333-333333333333'
    }
    const regenerated = {
        externalId: '019b3333-3333-7333-8333-333333333333',
        first: { id: '019b1111-1111-7111-8111-111111111111' },
        second: { id: '019b2222-2222-7222-8222-222222222222' }
    }

    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(regenerated)

    assert.ok(findFirstSnapshotFixtureDifference(normalizedTracked, normalizedGenerated))
    assert.equal((normalizedTracked as typeof tracked).externalId, tracked.externalId)
    assert.equal((normalizedGenerated as typeof regenerated).externalId, regenerated.externalId)
})
