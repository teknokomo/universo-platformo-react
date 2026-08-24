import { describe, expect, it } from 'vitest'
import {
    createPlayCanvasEditorNumericAssetId,
    createPlayCanvasEditorNumericIds,
    deriveUniqueNumericAssetIds,
    deriveUniqueNumericIds,
    hashToPositiveInt
} from './index'

const findCollidingKeyPair = (): [string, string] => {
    const baseIdByKey = new Map<number, string>()
    for (let index = 0; index < 500_000; index += 1) {
        const key = `asset:collide-probe-${index}`
        const baseId = hashToPositiveInt(key)
        const existingKey = baseIdByKey.get(baseId)
        if (existingKey !== undefined) return [existingKey, key]
        baseIdByKey.set(baseId, key)
    }
    throw new Error('No colliding key pair found within the search budget')
}

const deriveNumericIdsFromKeys = (keys: string[]): Map<string, number> => deriveUniqueNumericIds(keys.map((key) => ({ key })))

const pickNonCollidingKey = (avoidKeys: string[]): string => {
    for (let index = 0; index < 10_000; index += 1) {
        const key = `asset:stable-member-${index}`
        const baseId = hashToPositiveInt(key)
        if (avoidKeys.every((other) => hashToPositiveInt(other) !== baseId)) return key
    }
    throw new Error('No non-colliding member key found within the search budget')
}

describe('deriveUniqueNumericIds', () => {
    it('keeps every id a distinct positive integer below the hash ceiling', () => {
        const keys = ['self:user-a', 'owner:metahub-a', 'project:project-a', 'scene:scene-a']
        const assignment = deriveUniqueNumericIds(keys.map((key) => ({ key })))
        expect(assignment.size).toBe(keys.length)
        for (const id of assignment.values()) {
            expect(Number.isInteger(id)).toBe(true)
            expect(id).toBeGreaterThan(0)
            expect(id).toBeLessThanOrEqual(2_000_000_000)
        }
        expect(new Set(assignment.values()).size).toBe(keys.length)
    })

    it('resolves a forced base-id collision deterministically without changing the lexicographically smaller key', () => {
        const foundPair = findCollidingKeyPair()
        const [smallerKey, largerKey] = [...foundPair].sort()
        const baseId = hashToPositiveInt(smallerKey)
        expect(hashToPositiveInt(largerKey)).toBe(baseId)

        const assignment = deriveUniqueNumericIds([{ key: largerKey }, { key: smallerKey }])
        expect(assignment.get(smallerKey)).toBe(baseId)
        expect(assignment.get(largerKey)).not.toBe(baseId)
        expect(assignment.get(largerKey)).toBeGreaterThan(0)

        const reordered = deriveNumericIdsFromKeys([smallerKey, largerKey])
        expect(reordered.get(smallerKey)).toBe(assignment.get(smallerKey))
        expect(reordered.get(largerKey)).toBe(assignment.get(largerKey))

        let suffix = 1
        let expectedLargerId = hashToPositiveInt(`${largerKey}#${suffix}`)
        while (expectedLargerId === baseId) {
            suffix += 1
            expectedLargerId = hashToPositiveInt(`${largerKey}#${suffix}`)
        }
        expect(assignment.get(largerKey)).toBe(expectedLargerId)
    })

    it('keeps non-colliding members on their base ids when another member is remapped', () => {
        const foundPair = findCollidingKeyPair()
        const [collidingA, collidingB] = [...foundPair].sort()
        const stableKey = pickNonCollidingKey([collidingA, collidingB])
        const stableBaseId = hashToPositiveInt(stableKey)
        const assignment = deriveUniqueNumericIds([{ key: collidingB }, { key: stableKey }, { key: collidingA }])
        expect(assignment.get(stableKey)).toBe(stableBaseId)
        expect(assignment.get(collidingA)).not.toBe(assignment.get(collidingB))
    })

    it('never assigns an id reserved by a fixed upstream numeric id', () => {
        const [collidingA, collidingB] = findCollidingKeyPair()
        const reservedId = hashToPositiveInt(collidingA)
        const freeKey = 'asset:reserved-check'
        const assignment = deriveUniqueNumericIds([{ key: collidingA }, { key: collidingB }, { key: freeKey }], new Set([reservedId]))
        expect(assignment.get(freeKey)).not.toBe(reservedId)
        expect(assignment.size).toBe(3)
        expect(new Set(assignment.values()).size).toBe(3)
    })

    it('deduplicates repeated keys into one stable assignment', () => {
        const key = 'asset:duplicate-key'
        const assignment = deriveUniqueNumericIds([{ key }, { key }, { key }])
        expect(assignment.size).toBe(1)
        expect(assignment.get(key)).toBe(hashToPositiveInt(key))
    })
})

describe('deriveUniqueNumericAssetIds', () => {
    it('matches the single-asset derivation for non-colliding sets and stays unique under forced collisions', () => {
        const plainIds = ['019e9146-fd1b-7d1d-a858-d1e96485d901', '019e9147-16c4-738c-ab0f-b98c443ee676']
        const assignment = deriveUniqueNumericAssetIds(plainIds.map((assetId) => ({ assetId })))
        for (const assetId of plainIds) {
            expect(assignment.get(`asset:${assetId}`)).toBe(createPlayCanvasEditorNumericAssetId(assetId))
        }

        const [collidingA, collidingB] = findCollidingKeyPair()
        const collidedAssignment = deriveUniqueNumericAssetIds([
            { assetId: collidingA.replace(/^asset:/, '') },
            { assetId: collidingB.replace(/^asset:/, '') }
        ])
        expect(new Set(collidedAssignment.values()).size).toBe(2)
    })

    it('avoids reserved fixed upstream document ids', () => {
        const assetId = '019e9146-0000-7000-8000-00000000abcd'
        const reservedId = createPlayCanvasEditorNumericAssetId(assetId)
        const assignment = deriveUniqueNumericAssetIds([{ assetId }], new Set([reservedId]))
        expect(assignment.get(`asset:${assetId}`)).not.toBe(reservedId)
        expect(assignment.get(`asset:${assetId}`)).toBeGreaterThan(0)
    })
})

describe('createPlayCanvasEditorNumericIds', () => {
    it('derives the documented per-kind values for non-colliding inputs', () => {
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId: 'metahub-1',
            projectId: 'project-1',
            sceneId: 'scene-1',
            userId: 'user-1'
        })
        expect(numericIds.selfId).toBe(hashToPositiveInt('self:user-1'))
        expect(numericIds.ownerId).toBe(hashToPositiveInt('owner:metahub-1'))
        expect(numericIds.projectId).toBe(hashToPositiveInt('project:project-1'))
        expect(numericIds.sceneId).toBe(hashToPositiveInt('scene:scene-1'))
        expect(numericIds.settingsId).toBe(`project_${numericIds.projectId}`)
        expect(numericIds.storage).toEqual({ metahubId: 'metahub-1', projectId: 'project-1', sceneId: 'scene-1' })
    })

    it('keeps project, scene, and owner identity stable regardless of the requesting user', () => {
        const baseProjectId = hashToPositiveInt('project:project-1')
        const baseSceneId = hashToPositiveInt('scene:scene-1')
        const baseOwnerId = hashToPositiveInt('owner:metahub-1')
        for (const userId of ['user-1', 'user-2', 'someone-else-entirely']) {
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: 'metahub-1',
                projectId: 'project-1',
                sceneId: 'scene-1',
                userId
            })
            expect(numericIds.projectId).toBe(baseProjectId)
            expect(numericIds.sceneId).toBe(baseSceneId)
            expect(numericIds.ownerId).toBe(baseOwnerId)
            expect(numericIds.settingsId).toBe(`project_${baseProjectId}`)
        }
    })
})
