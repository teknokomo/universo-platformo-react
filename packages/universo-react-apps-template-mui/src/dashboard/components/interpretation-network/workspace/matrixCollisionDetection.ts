import { closestCenter, rectIntersection, type Collision, type CollisionDetection, type UniqueIdentifier } from '@dnd-kit/core'

export const excludeActiveCollision = (collisions: Collision[], activeId: UniqueIdentifier): Collision[] =>
    collisions.filter((collision) => collision.id !== activeId)

const pointWithinRect = (point: { x: number; y: number }, rect: { top: number; left: number; width: number; height: number }): boolean =>
    point.x >= rect.left && point.x <= rect.left + rect.width && point.y >= rect.top && point.y <= rect.top + rect.height

const distanceToRectCenter = (
    point: { x: number; y: number },
    rect: { top: number; left: number; width: number; height: number }
): number => {
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return Math.hypot(point.x - centerX, point.y - centerY)
}

export const pointWithinCellCollision: CollisionDetection = ({
    active,
    collisionRect,
    droppableContainers,
    droppableRects,
    pointerCoordinates
}) => {
    const point = pointerCoordinates ?? {
        x: collisionRect.left + collisionRect.width / 2,
        y: collisionRect.top + collisionRect.height / 2
    }
    const collisions = droppableContainers.flatMap((container) => {
        if (container.id === active.id) return []
        const rect = droppableRects.get(container.id)
        if (!rect || !pointWithinRect(point, rect)) return []
        return [
            {
                id: container.id,
                data: {
                    droppableContainer: container,
                    value: distanceToRectCenter(point, rect)
                }
            }
        ]
    })

    return collisions.sort((left, right) => {
        const leftValue = typeof left.data?.value === 'number' ? left.data.value : Number.POSITIVE_INFINITY
        const rightValue = typeof right.data?.value === 'number' ? right.data.value : Number.POSITIVE_INFINITY
        return leftValue - rightValue
    })
}

export const matrixCollisionDetection: CollisionDetection = (args) => {
    const pointCollisions = pointWithinCellCollision(args)
    if (pointCollisions.length > 0) return pointCollisions

    const intersections = excludeActiveCollision(rectIntersection(args), args.active.id)
    if (intersections.length > 0) return intersections

    return excludeActiveCollision(closestCenter(args), args.active.id)
}
