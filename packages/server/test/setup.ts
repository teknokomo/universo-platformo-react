// Jest test setup - mock problematic dependencies

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
jest.mock('@universo/uniks-srv', () => ({
  UnikUser: class UnikUser {
    id!: string
    user_id!: string
    unik_id!: string
    role!: string
  }
}))

// Mock ChatFlow entity
const mockChatFlow = class ChatFlow {
  id!: string
}

jest.mock('../src/database/entities/ChatFlow', () => ({
  ChatFlow: mockChatFlow
}))

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}