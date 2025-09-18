import type { Request, Response } from 'express'
import { SpacesController } from '@/controllers/spacesController'
import { createSpaceFixture } from '@/tests/fixtures/spaces'

describe('SpacesController', () => {
  const createResponse = () => {
    const res: Partial<Response> = {}
    res.status = jest.fn().mockImplementation(() => res as Response)
    res.json = jest.fn().mockImplementation(() => res as Response)
    res.send = jest.fn().mockImplementation(() => res as Response)
    return res as Response & {
      status: jest.Mock
      json: jest.Mock
      send: jest.Mock
    }
  }

  const createRequest = (overrides: Partial<Request> = {}): Request => ({
    params: {},
    body: {},
    ...overrides
  }) as Request

  let controller: SpacesController
  let service: Record<string, jest.Mock>

  beforeEach(() => {
    service = {
      getSpacesForUnik: jest.fn(),
      createSpace: jest.fn(),
      reorderCanvases: jest.fn()
    }
    controller = new SpacesController(service as SpacesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('возвращает список пространств для уникального идентификатора', async () => {
    const spaces = [createSpaceFixture()]
    service.getSpacesForUnik.mockResolvedValue(spaces)

    const req = createRequest({ params: { unikId: 'unik-1' } })
    const res = createResponse()

    await controller.getSpaces(req, res)

    expect(service.getSpacesForUnik).toHaveBeenCalledWith('unik-1')
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { spaces }
    })
  })

  it('возвращает 400, если unikId отсутствует при запросе списка пространств', async () => {
    const req = createRequest()
    const res = createResponse()

    await controller.getSpaces(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unik ID is required'
    })
  })

  it('создаёт пространство и возвращает 201 при успешной транзакции', async () => {
    const space = createSpaceFixture()
    service.createSpace.mockResolvedValue(space)

    const req = createRequest({
      params: { unikId: 'unik-1' },
      body: { name: 'Space One' }
    })
    const res = createResponse()

    await controller.createSpace(req, res)

    expect(service.createSpace).toHaveBeenCalledWith('unik-1', { name: 'Space One' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: space,
      message: 'Space created successfully'
    })
  })

  it('возвращает 400, если имя пространства отсутствует или пустое', async () => {
    const req = createRequest({
      params: { unikId: 'unik-1' },
      body: { name: '  ' }
    })
    const res = createResponse()

    await controller.createSpace(req, res)

    expect(service.createSpace).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Space name is required'
    })
  })

  it('возвращает 500, если сервис выбрасывает ошибку транзакции', async () => {
    service.createSpace.mockRejectedValue(new Error('Transaction failed'))

    const req = createRequest({
      params: { unikId: 'unik-1' },
      body: { name: 'Space One' }
    })
    const res = createResponse()

    await controller.createSpace(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Transaction failed'
    })
  })

  it('валидирует структуру данных при изменении порядка канвасов', async () => {
    const req = createRequest({
      params: { unikId: 'unik-1', spaceId: 'space-1' },
      body: { canvasOrders: [{ canvasId: '', sortOrder: 0 }] }
    })
    const res = createResponse()

    await controller.reorderCanvases(req, res)

    expect(service.reorderCanvases).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid canvas order data'
    })
  })

  it('возвращает подтверждение успешного изменения порядка канвасов', async () => {
    service.reorderCanvases.mockResolvedValue(true)

    const req = createRequest({
      params: { unikId: 'unik-1', spaceId: 'space-1' },
      body: { canvasOrders: [{ canvasId: 'canvas-1', sortOrder: 1 }] }
    })
    const res = createResponse()

    await controller.reorderCanvases(req, res)

    expect(service.reorderCanvases).toHaveBeenCalledWith('unik-1', 'space-1', {
      canvasOrders: [{ canvasId: 'canvas-1', sortOrder: 1 }]
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Canvases reordered successfully' })
  })
})
