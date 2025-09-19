import React from 'react'

export const DndContext = ({ children }: { children?: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>
export const DragOverlay = ({ children }: { children?: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>
export const closestCenter = () => undefined
export const KeyboardSensor = function KeyboardSensorMock() {
  return {}
}
export const PointerSensor = function PointerSensorMock() {
  return {}
}
export const useSensor = () => ({} as Record<string, unknown>)
export const useSensors = () => [] as unknown[]
