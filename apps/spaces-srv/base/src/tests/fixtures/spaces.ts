import { Canvas } from '@/database/entities/Canvas'
import { Space } from '@/database/entities/Space'
import { SpaceCanvas } from '@/database/entities/SpaceCanvas'
const baseDate = new Date('2024-01-01T00:00:00.000Z')

export const createSpaceFixture = (overrides: Partial<Space> = {}): Space => ({
  id: 'space-1',
  name: 'Space One',
  description: 'Primary space fixture',
  visibility: 'private',
  createdDate: baseDate,
  updatedDate: baseDate,
  unikId: 'unik-1',
  unik: { id: 'unik-1' },
  spaceCanvases: [],
  ...overrides
})

export const createCanvasFixture = (overrides: Partial<Canvas> = {}): Canvas => ({
  id: 'canvas-1',
  name: 'Canvas One',
  flowData: '{}',
  deployed: false,
  isPublic: false,
  apikeyid: undefined,
  chatbotConfig: undefined,
  apiConfig: undefined,
  analytic: undefined,
  speechToText: undefined,
  followUpPrompts: undefined,
  category: undefined,
  type: 'CHATFLOW',
  createdDate: baseDate,
  updatedDate: baseDate,
  spaceCanvases: [],
  ...overrides
})

export const createSpaceCanvasFixture = (
  overrides: Partial<SpaceCanvas> = {}
): SpaceCanvas => ({
  id: 'space-canvas-1',
  sortOrder: 1,
  createdDate: baseDate,
  space: createSpaceFixture(),
  canvas: createCanvasFixture(),
  ...overrides
})
