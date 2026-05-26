import type { EntityTypeCapabilities, EntityTypePresetManifest, EntityTypeUIConfig } from '@universo-react/types'
import { vlc } from './basic.template'

const componentSurface: NonNullable<EntityTypeUIConfig['resourceSurfaces']>[number] = {
    key: 'requisites',
    capability: 'dataSchema',
    routeSegment: 'requisites',
    title: vlc('Requisites', 'Реквизиты'),
    titleKey: 'metahubs:oneCCompatible.requisites.resourceTabTitle',
    fallbackTitle: 'Requisites',
    sharedTitle: vlc('Requisites', 'Реквизиты'),
    sharedTitleKey: 'metahubs:oneCCompatible.commonRequisites.resourceTabTitle',
    fallbackSharedTitle: 'Requisites'
}

const objectLikeCapabilities = (prefix: string): EntityTypeCapabilities => ({
    dataSchema: { enabled: true },
    records: { enabled: true },
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: { enabled: true, supportsFolders: true },
    nestedCollections: { enabled: true },
    relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
    actions: { enabled: true },
    events: { enabled: true },
    modules: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix },
    identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
    recordLifecycle: { enabled: true, allowCustomStates: true },
    posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
    ledgerSchema: false
})

const constantCapabilities = (prefix: string): EntityTypeCapabilities => ({
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: false,
    events: false,
    modules: false,
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix },
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
})

const registerCapabilities = (prefix: string): EntityTypeCapabilities => ({
    dataSchema: { enabled: true },
    records: { enabled: true },
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
    actions: { enabled: true },
    events: { enabled: true },
    modules: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix },
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: { enabled: true, allowProjections: true, allowRegistrarPolicy: true, allowManualFacts: false }
})

const runtimeUi = (iconName: string, sidebarOrder: number, nameKey: string): EntityTypeUIConfig => ({
    iconName,
    tabs: ['general', 'behavior', 'components', 'layout', 'modules'],
    sidebarSection: 'objects',
    sidebarOrder,
    nameKey,
    resourceSurfaces: [componentSurface]
})

const runtimePresentation = (pluralEn: string, pluralRu: string, singularEn: string, singularRu: string) => ({
    name: vlc(pluralEn, pluralRu),
    readiness: 'preview',
    dialogTitles: {
        create: vlc(`Create ${singularEn}`, `Создать ${singularRu}`),
        edit: vlc(`Edit ${singularEn}`, `Редактировать ${singularRu}`),
        copy: vlc(`Copy ${singularEn}`, `Копировать ${singularRu}`),
        delete: vlc(`Delete ${singularEn}`, `Удалить ${singularRu}`)
    }
})

export const oneCConstantPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-constant',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Constants', 'Константы'),
    description: vlc('Top-level single-value configuration values.', 'Константы верхнего уровня.'),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'constant'], icon: 'IconVariable' },
    entityType: {
        kindKey: 'constant',
        codename: vlc('Constant', 'Константа'),
        capabilities: constantCapabilities('const'),
        ui: runtimeUi('IconVariable', 70, 'metahubs:oneCCompatible.constants.title'),
        presentation: runtimePresentation('Constants', 'Константы', 'Constant', 'константу'),
        config: {
            singleValue: {
                kind: 'singleValue',
                dataType: 'STRING',
                scope: 'workspace',
                periodicity: 'none',
                allowRuntimeEdit: true,
                auditChanges: true
            }
        }
    },
    defaultInstances: [
        {
            codename: 'OrganizationName',
            name: vlc('Organization Name', 'Название организации'),
            description: vlc('Example top-level constant.', 'Пример константы верхнего уровня.'),
            components: [
                {
                    codename: 'Value',
                    dataType: 'STRING',
                    name: vlc('Value', 'Значение'),
                    isDisplayComponent: true,
                    sortOrder: 1
                }
            ],
            config: {
                singleValue: {
                    kind: 'singleValue',
                    dataType: 'STRING',
                    scope: 'workspace',
                    periodicity: 'none',
                    allowRuntimeEdit: true,
                    auditChanges: true
                }
            }
        }
    ]
}

export const oneCCatalogPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-catalog',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Catalogs', 'Справочники'),
    description: vlc(
        'Reference-like hierarchical catalogs with codes and predefined rows.',
        'Иерархические справочники с кодами и предопределенными строками.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'catalog'], icon: 'IconAddressBook' },
    entityType: {
        kindKey: 'catalog',
        codename: vlc('Catalog', 'Справочник'),
        capabilities: objectLikeCapabilities('cat'),
        ui: runtimeUi('IconAddressBook', 80, 'metahubs:oneCCompatible.catalogs.title'),
        presentation: runtimePresentation('Catalogs', 'Справочники', 'Catalog', 'справочник'),
        config: {
            catalogBehavior: {
                kind: 'catalog',
                code: { enabled: true, autoNumbering: true, unique: true, periodicity: 'none' },
                hierarchy: { mode: 'groups-and-items', ownerSubordination: true },
                predefinedRows: []
            }
        }
    },
    defaultInstances: [
        {
            codename: 'Products',
            name: vlc('Products', 'Номенклатура'),
            components: [
                { codename: 'Code', dataType: 'STRING', name: vlc('Code', 'Код'), sortOrder: 1, isDisplayComponent: true },
                { codename: 'Name', dataType: 'STRING', name: vlc('Name', 'Наименование'), sortOrder: 2, isDisplayComponent: true },
                { codename: 'Description', dataType: 'STRING', name: vlc('Description', 'Описание'), sortOrder: 3 }
            ],
            config: {
                catalogBehavior: {
                    kind: 'catalog',
                    code: { enabled: true, autoNumbering: true, unique: true, periodicity: 'none' },
                    hierarchy: { mode: 'groups-and-items', ownerSubordination: false },
                    predefinedRows: []
                }
            }
        }
    ]
}

export const oneCDocumentPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-document',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Documents', 'Документы'),
    description: vlc(
        'Transactional documents with numbering, lifecycle, tabular parts, and posting metadata.',
        'Транзакционные документы с нумерацией, жизненным циклом, табличными частями и проведением.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'document'], icon: 'IconFileInvoice' },
    entityType: {
        kindKey: 'document',
        codename: vlc('Document', 'Документ'),
        capabilities: objectLikeCapabilities('doc'),
        ui: runtimeUi('IconFileInvoice', 90, 'metahubs:oneCCompatible.documents.title'),
        presentation: runtimePresentation('Documents', 'Документы', 'Document', 'документ'),
        config: {
            documentBehavior: { kind: 'document', number: {}, date: {}, lifecycle: {}, immutability: 'posted' },
            documentPosting: { kind: 'documentPosting', movements: [], repostPolicy: 'replace-existing-batch' }
        }
    },
    defaultInstances: [
        {
            codename: 'GoodsReceipt',
            name: vlc('Goods Receipt', 'Поступление товаров'),
            components: [
                { codename: 'Number', dataType: 'STRING', name: vlc('Number', 'Номер'), sortOrder: 1, isDisplayComponent: true },
                {
                    codename: 'Date',
                    dataType: 'DATE',
                    name: vlc('Date', 'Дата'),
                    sortOrder: 2,
                    validationRules: { dateComposition: 'datetime' }
                },
                { codename: 'State', dataType: 'STRING', name: vlc('State', 'Состояние'), sortOrder: 3 },
                { codename: 'Comment', dataType: 'STRING', name: vlc('Comment', 'Комментарий'), sortOrder: 4 },
                {
                    codename: 'Goods',
                    dataType: 'TABLE',
                    name: vlc('Goods', 'Товары'),
                    sortOrder: 5,
                    childComponents: [
                        { codename: 'Product', dataType: 'STRING', name: vlc('Product', 'Номенклатура'), sortOrder: 1 },
                        { codename: 'Warehouse', dataType: 'STRING', name: vlc('Warehouse', 'Склад'), sortOrder: 2 },
                        { codename: 'Quantity', dataType: 'NUMBER', name: vlc('Quantity', 'Количество'), sortOrder: 3 }
                    ]
                }
            ],
            config: {
                documentBehavior: { kind: 'document', number: {}, date: {}, lifecycle: {}, immutability: 'posted' },
                documentPosting: {
                    kind: 'documentPosting',
                    movements: [
                        {
                            targetRegisterCodename: 'StockBalance',
                            sourceTableCodename: 'Goods',
                            dimensionMappings: { Product: 'Product', Warehouse: 'Warehouse' },
                            resourceMappings: { Quantity: 'Quantity' }
                        }
                    ],
                    repostPolicy: 'replace-existing-batch'
                }
            }
        }
    ]
}

export const oneCDocumentJournalPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-document-journal',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Document Journals', 'Журналы документов'),
    description: vlc(
        'Virtual journals over multiple document types using reusable union datasource metadata.',
        'Виртуальные журналы по нескольким типам документов на основе переиспользуемых union-источников.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'journal'], icon: 'IconNotebook' },
    entityType: {
        kindKey: 'document-journal',
        codename: vlc('Document Journal', 'Журнал документов'),
        capabilities: objectLikeCapabilities('jrnl'),
        ui: runtimeUi('IconNotebook', 100, 'metahubs:oneCCompatible.documentJournals.title'),
        presentation: runtimePresentation('Document Journals', 'Журналы документов', 'Document Journal', 'журнал документов'),
        config: {
            journalBehavior: {
                kind: 'journal',
                sources: [{ documentCodename: 'GoodsReceipt' }],
                defaultSort: [{ field: 'Date', direction: 'desc' }]
            }
        }
    },
    defaultInstances: [
        {
            codename: 'PurchasingDocuments',
            name: vlc('Purchasing Documents', 'Документы закупок'),
            components: [
                { codename: 'DocumentType', dataType: 'STRING', name: vlc('Document Type', 'Тип документа'), sortOrder: 1 },
                { codename: 'Number', dataType: 'STRING', name: vlc('Number', 'Номер'), sortOrder: 2, isDisplayComponent: true },
                { codename: 'Date', dataType: 'DATE', name: vlc('Date', 'Дата'), sortOrder: 3 },
                { codename: 'State', dataType: 'STRING', name: vlc('State', 'Состояние'), sortOrder: 4 }
            ],
            config: {
                journalBehavior: {
                    kind: 'journal',
                    sources: [{ documentCodename: 'GoodsReceipt' }],
                    defaultSort: [{ field: 'Date', direction: 'desc' }]
                }
            }
        }
    ]
}

export const oneCInformationRegisterPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-information-register',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Information Registers', 'Регистры сведений'),
    description: vlc(
        'Fact registers with dimensions, resources, periodicity, and registrar policy.',
        'Регистры фактов с измерениями, ресурсами, периодичностью и политикой регистратора.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'register'], icon: 'IconTable' },
    entityType: {
        kindKey: 'information-register',
        codename: vlc('Information Register', 'Регистр сведений'),
        capabilities: registerCapabilities('ireg'),
        ui: runtimeUi('IconTable', 110, 'metahubs:oneCCompatible.informationRegisters.title'),
        presentation: runtimePresentation('Information Registers', 'Регистры сведений', 'Information Register', 'регистр сведений'),
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'facts',
                periodicity: 'instant',
                registrarPolicy: 'both',
                movementDirection: 'none',
                dimensions: ['Product'],
                resources: ['Price'],
                projections: []
            }
        }
    },
    defaultInstances: [
        {
            codename: 'ProductPrices',
            name: vlc('Product Prices', 'Цены номенклатуры'),
            components: [
                { codename: 'Product', dataType: 'STRING', name: vlc('Product', 'Номенклатура'), sortOrder: 1, isRequired: true },
                { codename: 'Price', dataType: 'NUMBER', name: vlc('Price', 'Цена'), sortOrder: 2, isRequired: true },
                { codename: 'Period', dataType: 'DATE', name: vlc('Period', 'Период'), sortOrder: 3 }
            ],
            config: {
                registerBehavior: {
                    kind: 'register',
                    mode: 'facts',
                    periodicity: 'instant',
                    registrarPolicy: 'both',
                    movementDirection: 'none',
                    dimensions: ['Product'],
                    resources: ['Price'],
                    projections: []
                }
            }
        }
    ]
}

export const oneCAccumulationRegisterPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-accumulation-register',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Accumulation Registers', 'Регистры накопления'),
    description: vlc(
        'Balance registers with movement direction and synchronous projection metadata.',
        'Регистры остатков с направлением движения и метаданными синхронных проекций.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'register'], icon: 'IconChartBar' },
    entityType: {
        kindKey: 'accumulation-register',
        codename: vlc('Accumulation Register', 'Регистр накопления'),
        capabilities: registerCapabilities('areg'),
        ui: runtimeUi('IconChartBar', 120, 'metahubs:oneCCompatible.accumulationRegisters.title'),
        presentation: runtimePresentation('Accumulation Registers', 'Регистры накопления', 'Accumulation Register', 'регистр накопления'),
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'balance',
                periodicity: 'instant',
                registrarPolicy: 'registrar',
                movementDirection: 'in-out',
                dimensions: ['Product', 'Warehouse'],
                resources: ['Quantity'],
                projections: [{ codename: 'ByProductWarehouse', dimensions: ['Product', 'Warehouse'], resources: ['Quantity'] }]
            }
        }
    },
    defaultInstances: [
        {
            codename: 'StockBalance',
            name: vlc('Stock Balance', 'Остатки товаров'),
            components: [
                { codename: 'Product', dataType: 'STRING', name: vlc('Product', 'Номенклатура'), sortOrder: 1, isRequired: true },
                { codename: 'Warehouse', dataType: 'STRING', name: vlc('Warehouse', 'Склад'), sortOrder: 2, isRequired: true },
                { codename: 'Quantity', dataType: 'NUMBER', name: vlc('Quantity', 'Количество'), sortOrder: 3, isRequired: true },
                { codename: 'Direction', dataType: 'STRING', name: vlc('Direction', 'Направление'), sortOrder: 4 }
            ],
            config: {
                registerBehavior: {
                    kind: 'register',
                    mode: 'balance',
                    periodicity: 'instant',
                    registrarPolicy: 'registrar',
                    movementDirection: 'in-out',
                    dimensions: ['Product', 'Warehouse'],
                    resources: ['Quantity'],
                    projections: [{ codename: 'ByProductWarehouse', dimensions: ['Product', 'Warehouse'], resources: ['Quantity'] }]
                }
            }
        }
    ]
}

export const oneCChartOfAccountsPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-chart-of-accounts',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Charts of Accounts', 'Планы счетов'),
    description: vlc(
        'Preview accounting account hierarchy with typed chart behavior.',
        'Предварительная модель иерархии бухгалтерских счетов с типизированным поведением плана.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'accounting', 'preview'], icon: 'IconBinaryTree' },
    entityType: {
        kindKey: 'chart-of-accounts',
        codename: vlc('Chart of Accounts', 'План счетов'),
        capabilities: objectLikeCapabilities('acct'),
        ui: runtimeUi('IconBinaryTree', 130, 'metahubs:oneCCompatible.chartOfAccounts.title'),
        presentation: runtimePresentation('Charts of Accounts', 'Планы счетов', 'Chart of Accounts', 'план счетов'),
        config: {
            accountChartBehavior: {
                kind: 'accountChart',
                hierarchy: true,
                supportsOffBalance: true,
                supportsQuantity: true,
                supportsCurrency: true,
                subcontoCharacteristicChartCodename: 'SubcontoTypes'
            }
        }
    },
    defaultInstances: [
        {
            codename: 'MainChartOfAccounts',
            name: vlc('Main Chart of Accounts', 'Основной план счетов'),
            components: [
                { codename: 'Code', dataType: 'STRING', name: vlc('Code', 'Код'), sortOrder: 1, isDisplayComponent: true },
                { codename: 'Name', dataType: 'STRING', name: vlc('Name', 'Наименование'), sortOrder: 2, isDisplayComponent: true },
                { codename: 'AccountType', dataType: 'STRING', name: vlc('Account Type', 'Тип счета'), sortOrder: 3 }
            ],
            config: {
                accountChartBehavior: {
                    kind: 'accountChart',
                    hierarchy: true,
                    supportsOffBalance: true,
                    supportsQuantity: true,
                    supportsCurrency: true,
                    subcontoCharacteristicChartCodename: 'SubcontoTypes'
                }
            }
        }
    ]
}

export const oneCCharacteristicTypesPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-chart-of-characteristic-types',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Characteristic Type Charts', 'Планы видов характеристик'),
    description: vlc(
        'Preview dynamic characteristic governance for typed analytic dimensions.',
        'Предварительная модель динамических характеристик для типизированной аналитики.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'characteristics', 'preview'], icon: 'IconTags' },
    entityType: {
        kindKey: 'chart-of-characteristic-types',
        codename: vlc('Chart of Characteristic Types', 'План видов характеристик'),
        capabilities: objectLikeCapabilities('char'),
        ui: runtimeUi('IconTags', 140, 'metahubs:oneCCompatible.characteristicTypes.title'),
        presentation: runtimePresentation(
            'Characteristic Type Charts',
            'Планы видов характеристик',
            'Characteristic Type Chart',
            'план видов характеристик'
        ),
        config: {
            dynamicCharacteristic: {
                kind: 'dynamicCharacteristic',
                allowedDataTypes: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF'],
                valueCatalogCodename: 'Products'
            }
        }
    },
    defaultInstances: [
        {
            codename: 'SubcontoTypes',
            name: vlc('Subconto Types', 'Виды субконто'),
            components: [
                { codename: 'Name', dataType: 'STRING', name: vlc('Name', 'Наименование'), sortOrder: 1, isDisplayComponent: true },
                { codename: 'ValueType', dataType: 'STRING', name: vlc('Value Type', 'Тип значения'), sortOrder: 2 }
            ],
            config: {
                dynamicCharacteristic: {
                    kind: 'dynamicCharacteristic',
                    allowedDataTypes: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF'],
                    valueCatalogCodename: 'Products'
                }
            }
        }
    ]
}

export const oneCAccountingRegisterPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-accounting-register',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Accounting Registers', 'Регистры бухгалтерии'),
    description: vlc(
        'Preview debit/credit accounting register metadata with dimensions and resources.',
        'Предварительная модель регистров бухгалтерии с дебетом, кредитом, измерениями и ресурсами.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'accounting', 'register', 'preview'], icon: 'IconScale' },
    entityType: {
        kindKey: 'accounting-register',
        codename: vlc('Accounting Register', 'Регистр бухгалтерии'),
        capabilities: registerCapabilities('breg'),
        ui: runtimeUi('IconScale', 150, 'metahubs:oneCCompatible.accountingRegisters.title'),
        presentation: runtimePresentation('Accounting Registers', 'Регистры бухгалтерии', 'Accounting Register', 'регистр бухгалтерии'),
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'accounting',
                periodicity: 'instant',
                registrarPolicy: 'registrar',
                movementDirection: 'debit-credit',
                dimensions: ['DebitAccount', 'CreditAccount', 'Subconto'],
                resources: ['Amount'],
                projections: [{ codename: 'ByAccount', dimensions: ['DebitAccount', 'CreditAccount'], resources: ['Amount'] }]
            }
        }
    },
    defaultInstances: [
        {
            codename: 'AccountingEntries',
            name: vlc('Accounting Entries', 'Бухгалтерские записи'),
            components: [
                { codename: 'DebitAccount', dataType: 'STRING', name: vlc('Debit Account', 'Счет дебета'), sortOrder: 1 },
                { codename: 'CreditAccount', dataType: 'STRING', name: vlc('Credit Account', 'Счет кредита'), sortOrder: 2 },
                { codename: 'Amount', dataType: 'NUMBER', name: vlc('Amount', 'Сумма'), sortOrder: 3 }
            ],
            config: {
                registerBehavior: {
                    kind: 'register',
                    mode: 'accounting',
                    periodicity: 'instant',
                    registrarPolicy: 'registrar',
                    movementDirection: 'debit-credit',
                    dimensions: ['DebitAccount', 'CreditAccount'],
                    resources: ['Amount'],
                    projections: [{ codename: 'ByAccount', dimensions: ['DebitAccount', 'CreditAccount'], resources: ['Amount'] }]
                }
            }
        }
    ]
}

export const oneCCalculationTypesPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-chart-of-calculation-types',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Calculation Type Charts', 'Планы видов расчета'),
    description: vlc('Preview calculation type dependency graph metadata.', 'Предварительная модель графа зависимостей видов расчета.'),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'calculation', 'preview'], icon: 'IconCalculator' },
    entityType: {
        kindKey: 'chart-of-calculation-types',
        codename: vlc('Chart of Calculation Types', 'План видов расчета'),
        capabilities: objectLikeCapabilities('calc'),
        ui: runtimeUi('IconCalculator', 160, 'metahubs:oneCCompatible.calculationTypes.title'),
        presentation: runtimePresentation('Calculation Type Charts', 'Планы видов расчета', 'Calculation Type Chart', 'план видов расчета'),
        config: {
            calculationTypeGraph: {
                kind: 'calculationTypeGraph',
                baseTypes: [],
                displacementTypes: [],
                leadingTypes: []
            }
        }
    },
    defaultInstances: [
        {
            codename: 'PayrollCalculationTypes',
            name: vlc('Payroll Calculation Types', 'Виды расчета зарплаты'),
            components: [
                { codename: 'Name', dataType: 'STRING', name: vlc('Name', 'Наименование'), sortOrder: 1, isDisplayComponent: true },
                { codename: 'Formula', dataType: 'STRING', name: vlc('Formula', 'Формула'), sortOrder: 2 }
            ],
            config: {
                calculationTypeGraph: {
                    kind: 'calculationTypeGraph',
                    baseTypes: [],
                    displacementTypes: [],
                    leadingTypes: []
                }
            }
        }
    ]
}

export const oneCCalculationRegisterPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'one-c-calculation-register',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: vlc('Calculation Registers', 'Регистры расчета'),
    description: vlc(
        'Preview calculation register metadata for action/base periods and recalculation.',
        'Предварительная модель регистров расчета с периодами действия, базовыми периодами и перерасчетом.'
    ),
    meta: { author: 'universo-platformo', tags: ['preset', '1c-compatible', 'calculation', 'register', 'preview'], icon: 'IconAbacus' },
    entityType: {
        kindKey: 'calculation-register',
        codename: vlc('Calculation Register', 'Регистр расчета'),
        capabilities: registerCapabilities('creg'),
        ui: runtimeUi('IconAbacus', 170, 'metahubs:oneCCompatible.calculationRegisters.title'),
        presentation: runtimePresentation('Calculation Registers', 'Регистры расчета', 'Calculation Register', 'регистр расчета'),
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'calculation',
                periodicity: 'month',
                registrarPolicy: 'registrar',
                movementDirection: 'none',
                dimensions: ['Employee', 'CalculationType'],
                resources: ['Result'],
                projections: [{ codename: 'ByEmployeePeriod', dimensions: ['Employee', 'CalculationType'], resources: ['Result'] }]
            }
        }
    },
    defaultInstances: [
        {
            codename: 'PayrollCalculations',
            name: vlc('Payroll Calculations', 'Расчеты зарплаты'),
            components: [
                { codename: 'Employee', dataType: 'STRING', name: vlc('Employee', 'Сотрудник'), sortOrder: 1 },
                { codename: 'CalculationType', dataType: 'STRING', name: vlc('Calculation Type', 'Вид расчета'), sortOrder: 2 },
                { codename: 'Result', dataType: 'NUMBER', name: vlc('Result', 'Результат'), sortOrder: 3 }
            ],
            config: {
                registerBehavior: {
                    kind: 'register',
                    mode: 'calculation',
                    periodicity: 'month',
                    registrarPolicy: 'registrar',
                    movementDirection: 'none',
                    dimensions: ['Employee', 'CalculationType'],
                    resources: ['Result'],
                    projections: [{ codename: 'ByEmployeePeriod', dimensions: ['Employee', 'CalculationType'], resources: ['Result'] }]
                }
            }
        }
    ]
}

export const oneCCompatibleCorePresets = [
    oneCConstantPreset,
    oneCCatalogPreset,
    oneCDocumentPreset,
    oneCDocumentJournalPreset,
    oneCInformationRegisterPreset,
    oneCAccumulationRegisterPreset
] as const

export const oneCCompatiblePreviewPresets = [
    oneCChartOfAccountsPreset,
    oneCCharacteristicTypesPreset,
    oneCAccountingRegisterPreset,
    oneCCalculationTypesPreset,
    oneCCalculationRegisterPreset
] as const

export const oneCCompatibleAllPresets = [...oneCCompatibleCorePresets, ...oneCCompatiblePreviewPresets] as const
