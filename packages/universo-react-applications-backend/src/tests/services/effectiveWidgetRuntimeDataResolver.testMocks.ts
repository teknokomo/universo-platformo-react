jest.mock('../../persistence/widgetBindingRuntimeStore', () => {
    const actual = jest.requireActual(
        '../../persistence/widgetBindingRuntimeStore'
    ) as typeof import('../../persistence/widgetBindingRuntimeStore')
    return {
        ...actual,
        loadPublishedDashboardMenuEntities: jest.fn(),
        loadRuntimeWidgetBindingMetadata: jest.fn(),
        loadWidgetBindingRuntimeRecords: jest.fn()
    }
})

jest.mock('../../services/runtimeRowSupport/objectMetadata', () => {
    const actual = jest.requireActual(
        '../../services/runtimeRowSupport/objectMetadata'
    ) as typeof import('../../services/runtimeRowSupport/objectMetadata')
    return { ...actual, resolveRuntimeObjectCollectionByCodename: jest.fn() }
})

jest.mock('../../services/runtimeRowSupport/access', () => {
    const actual = jest.requireActual('../../services/runtimeRowSupport/access') as typeof import('../../services/runtimeRowSupport/access')
    return { ...actual, loadRuntimeRowByIdWithRecordAccess: jest.fn() }
})

jest.mock('../../services/runtimeRowSupport/runtimeObjectCatalog', () => {
    const actual = jest.requireActual(
        '../../services/runtimeRowSupport/runtimeObjectCatalog'
    ) as typeof import('../../services/runtimeRowSupport/runtimeObjectCatalog')
    return { ...actual, loadRuntimeReadableComponents: jest.fn() }
})

jest.mock('../../services/runtimeRowSupport/union/execution', () => {
    const actual = jest.requireActual(
        '../../services/runtimeRowSupport/union/execution'
    ) as typeof import('../../services/runtimeRowSupport/union/execution')
    return { ...actual, executeRuntimeRecordsUnionQuery: jest.fn() }
})
