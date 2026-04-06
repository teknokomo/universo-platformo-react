import type { LifecycleEvent } from './types'

export type NoopMethodDecorator = (...args: unknown[]) => void

const createNoopDecorator = (): NoopMethodDecorator => () => undefined

export const AtServer = (): NoopMethodDecorator => createNoopDecorator()

export const AtClient = (): NoopMethodDecorator => createNoopDecorator()

export const AtServerAndClient = (): NoopMethodDecorator => createNoopDecorator()

export const OnEvent = (_eventName: LifecycleEvent): NoopMethodDecorator => createNoopDecorator()