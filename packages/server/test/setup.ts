// Jest test setup - mock problematic dependencies

declare module '@universo/uniks-srv' {
  export class UnikUser {
    id: string
    user_id: string
    unik_id: string
    role: string
  }
}

// Mock the entire server startup chain to avoid ES module issues
jest.mock('../src/index', () => ({}))
jest.mock('../src/utils/getRunningExpressApp', () => ({
  getRunningExpressApp: jest.fn(() => ({
    AppDataSource: {
      isInitialized: true,
      getRepository: jest.fn(),
      query: jest.fn()
    }
  }))
}))

// Mock UnikUser entity
jest.mock(
  '@universo/uniks-srv',
  () => ({
    UnikUser: class UnikUser {
      id!: string
      user_id!: string
      unik_id!: string
      role!: string
    }
  }),
  { virtual: true }
)

jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn()
  }

  return {
    __esModule: true,
    default: mockLogger,
    expressRequestLogger: jest.fn()
  }
})

jest.mock('../src/services/spacesCanvas', () => {
  const mockCanvas = {
    id: 'mock-canvas',
    name: 'Mock Canvas',
    flowData: '{}',
    createdDate: new Date(),
    updatedDate: new Date(),
    versionGroupId: 'vg',
    versionUuid: 'vu',
    versionLabel: 'v1',
    versionIndex: 1,
    isActive: true
  }

  return {
    __esModule: true,
    default: {
      getCanvasById: jest.fn(async () => mockCanvas),
      getCanvasByApiKey: jest.fn(async () => []),
      getAllCanvases: jest.fn(async () => []),
      checkIfCanvasIsValidForStreaming: jest.fn(async () => ({ isStreaming: true })),
      legacyService: {
        getChatflowById: jest.fn(async () => mockCanvas)
      }
    },
    canvasServiceConfig: {
      entities: {},
      dependencies: {}
    }
  }
})

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}