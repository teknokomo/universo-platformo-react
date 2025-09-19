export interface FlowDataServiceMock {
  getFlowData: jest.Mock<any, any>
}

export const createFlowDataServiceMock = (
  overrides: Partial<FlowDataServiceMock> = {}
): FlowDataServiceMock => {
  const mock: FlowDataServiceMock = {
    getFlowData: jest.fn()
  }

  return Object.assign(mock, overrides)
}

