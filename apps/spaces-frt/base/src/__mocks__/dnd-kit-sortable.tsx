import React from 'react'

export const SortableContext = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="sortable-context">{children}</div>
)
export const sortableKeyboardCoordinates = () => []
export const horizontalListSortingStrategy = () => undefined
export const useSortable = () => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => undefined,
  transform: null,
  transition: null,
  isDragging: false,
})
