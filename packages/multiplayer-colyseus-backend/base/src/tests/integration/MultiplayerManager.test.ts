import { EventEmitter } from 'events'

const spawnMock = jest.fn()
const existsSyncMock = jest.fn()
const MULTIPLAYER_PATH = '/workspace/universo-platformo-react/packages/multiplayer-colyseus-backend/base'
const resolveMock = jest.fn(() => MULTIPLAYER_PATH)

jest.mock('path', () => ({
  __esModule: true,
  default: {
    resolve: resolveMock
  }
}))

jest.mock('child_process', () => ({
  spawn: spawnMock
}))

jest.mock('fs', () => ({
  existsSync: existsSyncMock
}))

const { MultiplayerManager } = require('../../integration/MultiplayerManager') as typeof import('../../integration/MultiplayerManager')

describe('MultiplayerManager', () => {
  const originalEnv = { ...process.env }

  const createChildProcessMock = () => {
    const eventHandlers: Record<string, Array<(...args: any[]) => void>> = {}
    const child: any = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        eventHandlers[event] = eventHandlers[event] || []
        eventHandlers[event].push(handler)
        return child
      }),
      kill: jest.fn(),
      killed: false
    }

    return { child, eventHandlers }
  }

  beforeEach(() => {
    jest.useFakeTimers()
    resolveMock.mockImplementation(() => MULTIPLAYER_PATH)
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = { ...originalEnv }
    spawnMock.mockReset()
    existsSyncMock.mockReset()
    resolveMock.mockReset()
  })

  it('не запускает сервер когда он выключен', async () => {
    process.env.ENABLE_MULTIPLAYER_SERVER = 'false'
    const manager = new MultiplayerManager()

    await manager.start()

    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('запускает сервер colyseus при включенном флаге', async () => {
    process.env.ENABLE_MULTIPLAYER_SERVER = 'true'
    process.env.MULTIPLAYER_SERVER_PORT = '9999'
    process.env.MULTIPLAYER_SERVER_HOST = '0.0.0.0'
    existsSyncMock.mockReturnValue(true)

    const { child, eventHandlers } = createChildProcessMock()
    spawnMock.mockReturnValue(child)

    const manager = new MultiplayerManager()
    const startPromise = manager.start()
    jest.runAllTimers()
    await startPromise

    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [cmd, args, options] = spawnMock.mock.calls[0]
    expect(cmd).toBe('pnpm')
    expect(args).toEqual(['start'])
    expect(options?.cwd).toBe(MULTIPLAYER_PATH)
    expect(options?.env).toEqual(
      expect.objectContaining({
        COLYSEUS_PORT: '9999',
        COLYSEUS_HOST: '0.0.0.0'
      })
    )
    expect(eventHandlers['spawn']).toBeDefined()
  })

  it('останавливает запущенный процесс', async () => {
    process.env.ENABLE_MULTIPLAYER_SERVER = 'true'
    existsSyncMock.mockReturnValue(true)

    const { child, eventHandlers } = createChildProcessMock()
    child.kill.mockImplementation((signal: string) => {
      if (signal === 'SIGTERM') {
        eventHandlers['exit']?.forEach(fn => fn(0, null))
      }
    })

    spawnMock.mockReturnValue(child)

    const manager = new MultiplayerManager()
    const startPromise = manager.start()
    jest.runAllTimers()
    await startPromise
    const stopPromise = manager.stop()
    jest.runAllTimers()
    await stopPromise

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    expect(manager.isRunning()).toBe(false)
  })
})
