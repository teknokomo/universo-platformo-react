import { describe, expect, it } from 'vitest'
import { excludeActiveCollision, pointWithinCellCollision } from '../workspace/matrixCollisionDetection'

const droppableContainer = (id: string) => ({
    id,
    key: id,
    disabled: false,
    node: { current: null },
    rect: { current: null },
    data: { current: {} }
})

describe('matrix collision detection', () => {
    it('excludes the dragged origin while preserving intersected target priority', () => {
        expect(
            excludeActiveCollision(
                [
                    { id: 'source', data: { value: 0.8 } },
                    { id: 'target', data: { value: 0.2 } },
                    { id: 'other', data: { value: 0.1 } }
                ],
                'source'
            )
        ).toEqual([
            { id: 'target', data: { value: 0.2 } },
            { id: 'other', data: { value: 0.1 } }
        ])
    })

    it('prefers the cell under the pointer over broad rectangle intersections', () => {
        const collisions = pointWithinCellCollision({
            active: { id: 'source', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
            collisionRect: { top: 0, bottom: 64, left: 0, right: 100, width: 100, height: 64 },
            pointerCoordinates: { x: 145, y: 32 },
            droppableContainers: [droppableContainer('source'), droppableContainer('left-target'), droppableContainer('center-target')],
            droppableRects: new Map([
                ['source', { top: 0, bottom: 64, left: 0, right: 100, width: 100, height: 64 }],
                ['left-target', { top: 0, bottom: 64, left: 100, right: 130, width: 30, height: 64 }],
                ['center-target', { top: 0, bottom: 64, left: 130, right: 230, width: 100, height: 64 }]
            ])
        })

        expect(collisions.map((collision) => collision.id)).toEqual(['center-target'])
    })

    it('falls back to the dragged card center when pointer coordinates are unavailable', () => {
        const collisions = pointWithinCellCollision({
            active: { id: 'source', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
            collisionRect: { top: 0, bottom: 64, left: 140, right: 220, width: 80, height: 64 },
            pointerCoordinates: null,
            droppableContainers: [droppableContainer('source'), droppableContainer('target')],
            droppableRects: new Map([
                ['source', { top: 0, bottom: 64, left: 0, right: 100, width: 100, height: 64 }],
                ['target', { top: 0, bottom: 64, left: 130, right: 230, width: 100, height: 64 }]
            ])
        })

        expect(collisions.map((collision) => collision.id)).toEqual(['target'])
    })
})
