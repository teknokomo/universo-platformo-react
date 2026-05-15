import { expect, type Locator } from '@playwright/test'

export type HorizontalBounds = {
    left: number
    right: number
}

export type ElementBounds = HorizontalBounds & {
    top: number
    bottom: number
    width: number
    height: number
}

export async function getElementBounds(locator: Locator, label: string): Promise<ElementBounds> {
    await expect(locator, `${label} should be visible before geometry assertions`).toBeVisible()

    const box = await locator.boundingBox()
    if (!box) {
        throw new Error(`${label} did not return a bounding box`)
    }

    return {
        left: box.x,
        right: box.x + box.width,
        top: box.y,
        bottom: box.y + box.height,
        width: box.width,
        height: box.height
    }
}

export async function getHorizontalBounds(locator: Locator, label: string): Promise<HorizontalBounds> {
    const bounds = await getElementBounds(locator, label)

    return {
        left: bounds.left,
        right: bounds.right
    }
}

export async function expectHorizontalEdgesAligned(reference: Locator, target: Locator, tolerance = 2) {
    const [referenceBounds, targetBounds] = await Promise.all([
        getHorizontalBounds(reference, 'Reference locator'),
        getHorizontalBounds(target, 'Target locator')
    ])

    expect(
        Math.abs(referenceBounds.left - targetBounds.left),
        `Left edges differ: reference=${referenceBounds.left}, target=${targetBounds.left}`
    ).toBeLessThanOrEqual(tolerance)

    expect(
        Math.abs(referenceBounds.right - targetBounds.right),
        `Right edges differ: reference=${referenceBounds.right}, target=${targetBounds.right}`
    ).toBeLessThanOrEqual(tolerance)
}

export async function expectNotNarrowerThan(referenceBounds: HorizontalBounds, target: Locator, tolerance = 2) {
    const targetBounds = await getHorizontalBounds(target, 'Target locator')

    expect(
        targetBounds.left,
        `Target left edge is too far right: reference=${referenceBounds.left}, target=${targetBounds.left}`
    ).toBeLessThanOrEqual(referenceBounds.left + tolerance)

    expect(
        targetBounds.right,
        `Target right edge is too far left: reference=${referenceBounds.right}, target=${targetBounds.right}`
    ).toBeGreaterThanOrEqual(referenceBounds.right - tolerance)
}

export async function expectLeftEdgeAligned(reference: Locator, target: Locator, tolerance = 2) {
    const [referenceBounds, targetBounds] = await Promise.all([
        getElementBounds(reference, 'Reference locator'),
        getElementBounds(target, 'Target locator')
    ])

    expect(
        Math.abs(referenceBounds.left - targetBounds.left),
        `Left edges differ: reference=${referenceBounds.left}, target=${targetBounds.left}`
    ).toBeLessThanOrEqual(tolerance)
}

export async function expectRightEdgeAligned(reference: Locator, target: Locator, tolerance = 2) {
    const [referenceBounds, targetBounds] = await Promise.all([
        getElementBounds(reference, 'Reference locator'),
        getElementBounds(target, 'Target locator')
    ])

    expect(
        Math.abs(referenceBounds.right - targetBounds.right),
        `Right edges differ: reference=${referenceBounds.right}, target=${targetBounds.right}`
    ).toBeLessThanOrEqual(tolerance)
}

export async function expectHeightsAligned(reference: Locator, target: Locator, tolerance = 2) {
    const [referenceBounds, targetBounds] = await Promise.all([
        getElementBounds(reference, 'Reference locator'),
        getElementBounds(target, 'Target locator')
    ])

    expect(
        Math.abs(referenceBounds.height - targetBounds.height),
        `Heights differ: reference=${referenceBounds.height}, target=${targetBounds.height}`
    ).toBeLessThanOrEqual(tolerance)
}
