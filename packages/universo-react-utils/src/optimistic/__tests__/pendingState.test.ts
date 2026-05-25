import { describe, it, expect } from 'vitest'
import {
    isPendingEntity,
    getPendingAction,
    makePendingMarkers,
    stripPendingMarkers,
    type PendingAction,
    type MaybePending
} from '../pendingState'

describe('pendingState', () => {
    describe('isPendingEntity', () => {
        it('returns true for entity with __pending: true', () => {
            expect(isPendingEntity({ __pending: true, __pendingAction: 'create' })).toBe(true)
        })

        it('returns true for entity with __pending: true regardless of action', () => {
            expect(isPendingEntity({ __pending: true, __pendingAction: 'delete' })).toBe(true)
            expect(isPendingEntity({ __pending: true, __pendingAction: 'update' })).toBe(true)
            expect(isPendingEntity({ __pending: true, __pendingAction: 'copy' })).toBe(true)
        })

        it('returns false for regular entities', () => {
            expect(isPendingEntity({ id: '1', name: 'test' })).toBe(false)
        })

        it('returns false for null/undefined', () => {
            expect(isPendingEntity(null)).toBe(false)
            expect(isPendingEntity(undefined)).toBe(false)
        })

        it('returns false for __pending: false', () => {
            expect(isPendingEntity({ __pending: false })).toBe(false)
        })

        it('returns false for primitives', () => {
            expect(isPendingEntity(42)).toBe(false)
            expect(isPendingEntity('string')).toBe(false)
            expect(isPendingEntity(true)).toBe(false)
        })
    })

    describe('getPendingAction', () => {
        it('returns the pending action for pending entities', () => {
            expect(getPendingAction({ __pending: true, __pendingAction: 'create' })).toBe('create')
            expect(getPendingAction({ __pending: true, __pendingAction: 'update' })).toBe('update')
            expect(getPendingAction({ __pending: true, __pendingAction: 'delete' })).toBe('delete')
            expect(getPendingAction({ __pending: true, __pendingAction: 'copy' })).toBe('copy')
        })

        it('returns undefined for non-pending entities', () => {
            expect(getPendingAction({ id: '1' })).toBeUndefined()
        })

        it('returns undefined for null/undefined', () => {
            expect(getPendingAction(null)).toBeUndefined()
            expect(getPendingAction(undefined)).toBeUndefined()
        })
    })

    describe('makePendingMarkers', () => {
        it('creates markers for create action', () => {
            const markers = makePendingMarkers('create')
            expect(markers).toEqual({ __pending: true, __pendingAction: 'create' })
        })

        it('creates markers for all valid actions', () => {
            const actions: PendingAction[] = ['create', 'update', 'delete', 'copy']
            for (const action of actions) {
                const markers = makePendingMarkers(action)
                expect(markers.__pending).toBe(true)
                expect(markers.__pendingAction).toBe(action)
            }
        })

        it('returns object with correct shape', () => {
            const markers = makePendingMarkers('create')
            expect(markers).toHaveProperty('__pending', true)
            expect(markers).toHaveProperty('__pendingAction', 'create')
        })
    })

    describe('stripPendingMarkers', () => {
        it('removes __pending and __pendingAction from entity', () => {
            const entity: { id: string; name: string } & MaybePending = {
                id: '1',
                name: 'test',
                __pending: true,
                __pendingAction: 'create'
            }
            const stripped = stripPendingMarkers(entity)
            expect(stripped).toEqual({ id: '1', name: 'test' })
            expect('__pending' in stripped).toBe(false)
            expect('__pendingAction' in stripped).toBe(false)
        })

        it('works on entities without markers', () => {
            const entity = { id: '1', name: 'test' } as { id: string; name: string } & MaybePending
            const stripped = stripPendingMarkers(entity)
            expect(stripped).toEqual({ id: '1', name: 'test' })
        })

        it('preserves all other properties', () => {
            const entity = {
                id: '1',
                name: 'test',
                description: 'desc',
                sortOrder: 5,
                __pending: true,
                __pendingAction: 'update' as const
            }
            const stripped = stripPendingMarkers(entity)
            expect(stripped).toEqual({ id: '1', name: 'test', description: 'desc', sortOrder: 5 })
        })
    })
})
