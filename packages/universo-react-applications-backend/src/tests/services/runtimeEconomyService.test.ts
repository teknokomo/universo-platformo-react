/**
 * Unit tests for the runtime economy service (MMOOMM plan B8, TZ §14.1).
 *
 * The service runs against a SQL-routing mock executor (same style as the
 * route contract suites): the shared posting core, the create-row assembly and
 * the idempotency store stay real; only the flight room bridge is module-mocked
 * and the ledger projection/lifecycle-dispatch/posting-movement boundaries are
 * jest-spied. Ledger facts themselves are covered by the PG integration suite.
 */
const mockDescribeFlightContext = jest.fn<Promise<unknown>, [string, string]>()

jest.mock('../../services/runtimeFlightRoomBridge', () => ({
    __esModule: true,
    describeFlightContext: (applicationId: string, userId: string, workspaceId: string | null) =>
        mockDescribeFlightContext(applicationId, userId, workspaceId)
}))

import type { DbExecutor } from '@universo-react/utils'
import { createMockDbExecutor } from '../utils/dbMocks'
import { UpdateFailure, type RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { ROLE_PERMISSIONS } from '../../routes/guards'
import { RuntimeLedgerService } from '../../services/runtimeLedgersService'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { RuntimePostingMovementService } from '../../services/runtimePostingMovements'
import {
    createRuntimeEconomyService,
    fingerprintEconomyTradeBody,
    hashEconomyIdempotencyKey,
    parseEconomyIdempotencyKey
} from '../../services/runtimeEconomyService'
import { MARKET_SIDE_CONFIGS, REQUIRED_CONSTANT_CODES, throwEconomyFailure, toFiniteNumber } from '../../services/runtimeEconomySupport'

const SCHEMA_NAME = 'app_019a0000000070008000000000e0c0'
const SCHEMA_IDENT = `"${SCHEMA_NAME}"`

const USER_A = '019a0000-0000-7000-8000-0000000000a1'
const USER_B = '019a0000-0000-7000-8000-0000000000a2'
const APPLICATION_ID = '019a0000-0000-7000-8000-0000000000b1'
const SET_ID = '019a0000-0000-7000-8000-0000000000c1'
const NOMENCLATURE_OBJECT_ID = '019a0000-0000-7000-8000-0000000000c2'
const WALLET_OBJECT_ID = '019a0000-0000-7000-8000-0000000000c3'
const OPERATION_OBJECT_ID = '019a0000-0000-7000-8000-0000000000c4'
const STATION_OBJECT_ID = '019a0000-0000-7000-8000-0000000000c5'
const OPERATION_TYPE_ENUM_ID = '019a0000-0000-7000-8000-0000000000c6'
const STATUS_ENUM_ID = '019a0000-0000-7000-8000-0000000000c7'
const STARTER_TYPE_VALUE_ID = '019a0000-0000-7000-8000-0000000000d1'
const SELL_TYPE_VALUE_ID = '019a0000-0000-7000-8000-0000000000d2'
const BUY_TYPE_VALUE_ID = '019a0000-0000-7000-8000-0000000000d3'
const ACTIVE_STATUS_VALUE_ID = '019a0000-0000-7000-8000-0000000000d4'
const UNIT_ENUM_ID = '019a0000-0000-7000-8000-0000000000d5'
const KG_UNIT_VALUE_ID = '019a0000-0000-7000-8000-0000000000d6'
const LITER_UNIT_VALUE_ID = '019a0000-0000-7000-8000-0000000000d7'
const ORE_ROW_ID = '019a0000-0000-7000-8000-0000000000e1'
const FUEL_ROW_ID = '019a0000-0000-7000-8000-0000000000e2'
const STATION_ROW_ID = '019a0000-0000-7000-8000-0000000000e3'
const EXISTING_WALLET_ID = '019a0000-0000-7000-8000-0000000000e4'
const EXISTING_GRANT_ID = '019a0000-0000-7000-8000-0000000000e5'
const CREATED_WALLET_ID = '019a0000-0000-7000-8000-0000000000e6'
const CREATED_OPERATION_ID = '019a0000-0000-7000-8000-0000000000e7'
const WALLET_LEDGER_ID = '019a0000-0000-7000-8000-0000000000f1'
const INVENTORY_LEDGER_ID = '019a0000-0000-7000-8000-0000000000f2'

const OPERATION_BEHAVIOR_CONFIG = {
    recordBehavior: {
        mode: 'transactional',
        numbering: { enabled: false, scope: 'workspace', periodicity: 'none' },
        effectiveDate: { enabled: true, defaultToNow: true },
        lifecycle: { enabled: true, states: [] },
        posting: { mode: 'manual', targetLedgers: ['WalletLedger', 'InventoryLedger'] },
        immutability: 'posted'
    }
}

const attr = (overrides: Record<string, unknown>) => ({
    id: '019a0000-0000-7000-8000-000000000101',
    codename: 'Field',
    column_name: 'field',
    data_type: 'STRING',
    is_required: false,
    validation_rules: {},
    target_object_id: null,
    target_object_kind: null,
    ui_config: {},
    ...overrides
})

const NOMENCLATURE_ATTRS = [
    attr({ id: '019a0000-0000-7000-8000-000000000111', codename: 'Code', column_name: 'code', data_type: 'STRING', is_required: true }),
    attr({ id: '019a0000-0000-7000-8000-000000000112', codename: 'Name', column_name: 'name', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000113', codename: 'Unit', column_name: 'unit', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000114', codename: 'MassPerUnit', column_name: 'mass_per_unit', data_type: 'NUMBER' })
]

const WALLET_ATTRS = [
    attr({
        id: '019a0000-0000-7000-8000-000000000121',
        codename: 'OwnerKey',
        column_name: 'owner_key',
        data_type: 'STRING',
        is_required: true
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000122',
        codename: 'Currency',
        column_name: 'currency',
        data_type: 'STRING',
        is_required: true
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000123',
        codename: 'Status',
        column_name: 'status_id',
        data_type: 'REF',
        target_object_id: STATUS_ENUM_ID,
        target_object_kind: 'enumeration'
    })
]

const OPERATION_ATTRS = [
    attr({
        id: '019a0000-0000-7000-8000-000000000131',
        codename: 'OperationType',
        column_name: 'operation_type_id',
        data_type: 'REF',
        is_required: true,
        target_object_id: OPERATION_TYPE_ENUM_ID,
        target_object_kind: 'enumeration'
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000132',
        codename: 'Wallet',
        column_name: 'wallet_id',
        data_type: 'REF',
        is_required: true,
        target_object_id: WALLET_OBJECT_ID,
        target_object_kind: 'object'
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000133',
        codename: 'Station',
        column_name: 'station_id',
        data_type: 'REF',
        is_required: true,
        target_object_id: STATION_OBJECT_ID,
        target_object_kind: 'object'
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000134',
        codename: 'Nomenclature',
        column_name: 'nomenclature_id',
        data_type: 'REF',
        is_required: true,
        target_object_id: NOMENCLATURE_OBJECT_ID,
        target_object_kind: 'object'
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000135',
        codename: 'Quantity',
        column_name: 'quantity',
        data_type: 'NUMBER',
        is_required: true
    }),
    attr({ id: '019a0000-0000-7000-8000-000000000136', codename: 'UnitPrice', column_name: 'unit_price', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-000000000138', codename: 'TotalPrice', column_name: 'total_price', data_type: 'NUMBER' }),
    // Mining TZ §10.2/§10.3: server-stamped STRING discriminators (physical TEXT).
    attr({ id: '019a0000-0000-7000-8000-000000000139', codename: 'OperationKind', column_name: 'operation_kind', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-00000000013a', codename: 'AsteroidCode', column_name: 'asteroid_code', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000137', codename: 'OccurredAt', column_name: 'occurred_at', data_type: 'DATE' })
]

const STATION_ATTRS = [
    attr({ id: '019a0000-0000-7000-8000-000000000141', codename: 'Name', column_name: 'name', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000142', codename: 'MarketEnabled', column_name: 'market_enabled', data_type: 'BOOLEAN' })
]

// ── Mining belt stubs (mining TZ §7.2/§7.4) ──
const ASTEROID_OBJECT_ID = '019a0000-0000-7000-8000-0000000000c8'
const MINING_SET_ID = '019a0000-0000-7000-8000-0000000000c9'
const DEPLETED_STATUS_VALUE_ID = '019a0000-0000-7000-8000-0000000000d8'
const MINE_TYPE_VALUE_ID = '019a0000-0000-7000-8000-0000000000d9'
const ASTEROID_ROW_A_ID = '019a0000-0000-7000-8000-0000000000e8'
const ASTEROID_ROW_B_ID = '019a0000-0000-7000-8000-0000000000e9'

const ASTEROID_ATTRS = [
    attr({ id: '019a0000-0000-7000-8000-000000000151', codename: 'Code', column_name: 'code', data_type: 'STRING', is_required: true }),
    attr({ id: '019a0000-0000-7000-8000-000000000152', codename: 'Name', column_name: 'name', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000153', codename: 'ResourceCode', column_name: 'resource_code', data_type: 'STRING' }),
    attr({ id: '019a0000-0000-7000-8000-000000000154', codename: 'PositionX', column_name: 'position_x', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-000000000155', codename: 'PositionY', column_name: 'position_y', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-000000000156', codename: 'PositionZ', column_name: 'position_z', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-000000000157', codename: 'Scale', column_name: 'scale', data_type: 'NUMBER' }),
    attr({
        id: '019a0000-0000-7000-8000-000000000158',
        codename: 'TotalQuantityKg',
        column_name: 'total_quantity_kg',
        data_type: 'NUMBER'
    }),
    attr({
        id: '019a0000-0000-7000-8000-000000000159',
        codename: 'RemainingQuantityKg',
        column_name: 'remaining_quantity_kg',
        data_type: 'NUMBER',
        ui_config: { serverOwned: true }
    }),
    attr({
        id: '019a0000-0000-7000-8000-00000000015a',
        codename: 'Status',
        column_name: 'status_id',
        data_type: 'REF',
        target_object_id: STATUS_ENUM_ID,
        target_object_kind: 'enumeration'
    }),
    attr({ id: '019a0000-0000-7000-8000-00000000015b', codename: 'VisualVariant', column_name: 'visual_variant', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-00000000015c', codename: 'ChunkMinKg', column_name: 'chunk_min_kg', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-00000000015d', codename: 'ChunkMaxKg', column_name: 'chunk_max_kg', data_type: 'NUMBER' }),
    attr({ id: '019a0000-0000-7000-8000-00000000015e', codename: 'LastMinedAt', column_name: 'last_mined_at', data_type: 'DATE' })
]

const ATTRS_BY_OBJECT_ID: Record<string, Array<Record<string, unknown>>> = {
    [NOMENCLATURE_OBJECT_ID]: NOMENCLATURE_ATTRS,
    [WALLET_OBJECT_ID]: WALLET_ATTRS,
    [OPERATION_OBJECT_ID]: OPERATION_ATTRS,
    [STATION_OBJECT_ID]: STATION_ATTRS,
    [ASTEROID_OBJECT_ID]: ASTEROID_ATTRS
}

const OBJECT_ROWS: Record<string, Record<string, unknown>> = {
    Nomenclature: {
        id: NOMENCLATURE_OBJECT_ID,
        kind: 'object',
        codename: 'Nomenclature',
        table_name: 'nomenclature',
        config: null
    },
    Wallet: { id: WALLET_OBJECT_ID, kind: 'object', codename: 'Wallet', table_name: 'wallet', config: null },
    Operation: {
        id: OPERATION_OBJECT_ID,
        kind: 'object',
        codename: 'Operation',
        table_name: 'operation',
        config: OPERATION_BEHAVIOR_CONFIG
    },
    FlightStation: { id: STATION_OBJECT_ID, kind: 'object', codename: 'FlightStation', table_name: 'station', config: null },
    Asteroid: { id: ASTEROID_OBJECT_ID, kind: 'object', codename: 'Asteroid', table_name: 'asteroid', config: null }
}

const ENUM_VALUES_BY_OBJECT_ID: Record<string, Array<Record<string, unknown>>> = {
    [OPERATION_TYPE_ENUM_ID]: [
        { id: STARTER_TYPE_VALUE_ID, codename: 'StarterGrant' },
        { id: SELL_TYPE_VALUE_ID, codename: 'Sell' },
        { id: BUY_TYPE_VALUE_ID, codename: 'Buy' },
        { id: MINE_TYPE_VALUE_ID, codename: 'Mine' }
    ],
    [STATUS_ENUM_ID]: [
        { id: ACTIVE_STATUS_VALUE_ID, codename: 'Active' },
        { id: DEPLETED_STATUS_VALUE_ID, codename: 'Depleted' }
    ],
    [UNIT_ENUM_ID]: [
        { id: KG_UNIT_VALUE_ID, codename: 'Kg' },
        { id: LITER_UNIT_VALUE_ID, codename: 'Liter' }
    ]
}

const ECONOMY_CONSTANTS = [
    {
        id: '019a0000-0000-7000-8000-000000000201',
        group_id: SET_ID,
        codename: 'CurrencyCode',
        data_type: 'string',
        value_json: 'CR',
        sort_order: 1
    },
    {
        id: '019a0000-0000-7000-8000-000000000202',
        group_id: SET_ID,
        codename: 'StartingBalance',
        data_type: 'number',
        value_json: 1000,
        sort_order: 2
    },
    {
        id: '019a0000-0000-7000-8000-000000000203',
        group_id: SET_ID,
        codename: 'StartingOreKg',
        data_type: 'number',
        value_json: 10,
        sort_order: 3
    },
    {
        id: '019a0000-0000-7000-8000-000000000204',
        group_id: SET_ID,
        codename: 'OrePricePerKg',
        data_type: 'number',
        value_json: 10,
        sort_order: 4
    },
    {
        id: '019a0000-0000-7000-8000-000000000205',
        group_id: SET_ID,
        codename: 'FuelPricePerLiter',
        data_type: 'number',
        value_json: 5,
        sort_order: 5
    },
    {
        id: '019a0000-0000-7000-8000-000000000206',
        group_id: SET_ID,
        // Aligned with the shipped generator constants (mmoommAppGeneratorData).
        codename: 'MaxCargoMassKg',
        data_type: 'number',
        value_json: 100,
        sort_order: 6
    },
    {
        id: '019a0000-0000-7000-8000-000000000207',
        group_id: SET_ID,
        codename: 'MarketRadiusMeters',
        data_type: 'number',
        value_json: 80,
        sort_order: 7
    }
]

const ORE_NOMENCLATURE_ROW = {
    id: ORE_ROW_ID,
    code: 'ORE',
    name_value: 'Ore',
    unit_value: 'Kg',
    mass_per_unit: 1
}
const FUEL_NOMENCLATURE_ROW = {
    id: FUEL_ROW_ID,
    code: 'FUEL',
    name_value: 'Fuel',
    unit_value: 'Liter',
    mass_per_unit: 0.8
}

// Mining TZ §7.4 constants — aligned with the shipped generator values.
const MINING_CONSTANTS = [
    {
        id: '019a0000-0000-7000-8000-000000000210',
        group_id: MINING_SET_ID,
        codename: 'MiningRadiusMeters',
        data_type: 'number',
        value_json: 80,
        sort_order: 1
    },
    {
        id: '019a0000-0000-7000-8000-000000000211',
        group_id: MINING_SET_ID,
        codename: 'MiningCooldownMs',
        data_type: 'number',
        value_json: 350,
        sort_order: 2
    },
    {
        id: '019a0000-0000-7000-8000-000000000212',
        group_id: MINING_SET_ID,
        codename: 'ChunksPerHitMin',
        data_type: 'number',
        value_json: 1,
        sort_order: 3
    },
    {
        id: '019a0000-0000-7000-8000-000000000213',
        group_id: MINING_SET_ID,
        codename: 'ChunksPerHitMax',
        data_type: 'number',
        value_json: 3,
        sort_order: 4
    },
    {
        id: '019a0000-0000-7000-8000-000000000214',
        group_id: MINING_SET_ID,
        codename: 'ChunkMassMinKg',
        data_type: 'number',
        value_json: 0.8,
        sort_order: 5
    },
    {
        id: '019a0000-0000-7000-8000-000000000215',
        group_id: MINING_SET_ID,
        codename: 'ChunkMassMaxKg',
        data_type: 'number',
        value_json: 3.2,
        sort_order: 6
    },
    {
        id: '019a0000-0000-7000-8000-000000000216',
        group_id: MINING_SET_ID,
        codename: 'ChunkMassSkew',
        data_type: 'number',
        value_json: 1.6,
        sort_order: 7
    },
    {
        id: '019a0000-0000-7000-8000-000000000217',
        group_id: MINING_SET_ID,
        codename: 'ChunkVisualLifetimeMs',
        data_type: 'number',
        value_json: 900,
        sort_order: 8
    },
    {
        id: '019a0000-0000-7000-8000-000000000218',
        group_id: MINING_SET_ID,
        codename: 'MiningStatePollMs',
        data_type: 'number',
        value_json: 2000,
        sort_order: 9
    }
]

const buildAsteroidRow = (overrides: Record<string, unknown> = {}) => ({
    id: ASTEROID_ROW_A_ID,
    code_value: 'AST-01',
    name_value: 'Asteroid A-01',
    resource_code_value: 'ORE',
    position_x: -249,
    position_y: 7,
    position_z: 274,
    scale_value: 7,
    total_quantity: 120,
    remaining_quantity: 120,
    status_value: ACTIVE_STATUS_VALUE_ID,
    visual_variant: 1,
    chunk_min_kg: 0.8,
    chunk_max_kg: 3.2,
    ...overrides
})

const ASTEROID_ROWS_DEFAULT = [
    buildAsteroidRow(),
    buildAsteroidRow({
        id: ASTEROID_ROW_B_ID,
        code_value: 'AST-02',
        name_value: 'Asteroid A-02',
        position_x: 50,
        position_y: -3,
        position_z: -18,
        scale_value: 9,
        total_quantity: 160,
        remaining_quantity: 160,
        visual_variant: 2
    })
]

// Ship parked at the belt vicinity point (UX round 2026-11-23: the belt lives
// 450-465 m from the station, so mining fires happen from a dedicated vantage
// ~27 m off AST-01), far from the station — the trade legs of the suite see
// the station proximity context instead.
const MINING_FLIGHT_CONTEXT = {
    position: { x: -230, y: 3, z: 255 },
    stations: [{ id: STATION_ROW_ID, position: { x: 72, y: 0, z: -48 } }]
}

const STATION_PROXIMITY_CONTEXT = {
    position: { x: 0, y: 0, z: 0 },
    stations: [{ id: STATION_ROW_ID, position: { x: 10, y: 0, z: 0 } }]
}

// Spies are module-scope so `buildService` can wire the default projections
// from the stub state; they are installed/restored in beforeEach/afterEach.
let listLedgersSpy: jest.Spied<typeof RuntimeLedgerService.prototype.listLedgers>
let queryProjectionSpy: jest.Spied<typeof RuntimeLedgerService.prototype.queryProjection>
let dispatchLifecycleEventSpy: jest.Spied<typeof RuntimeModulesService.prototype.dispatchLifecycleEvent>
let appendMovementsSpy: jest.Spied<typeof RuntimePostingMovementService.prototype.appendMovements>

const buildCtx = (executor: DbExecutor, userId: string = USER_A): RuntimeSchemaContext => ({
    schemaName: SCHEMA_NAME,
    schemaIdent: SCHEMA_IDENT,
    manager: executor,
    userId,
    role: 'owner',
    permissions: { ...ROLE_PERMISSIONS.owner } as RuntimeSchemaContext['permissions'],
    workflowCapabilities: {},
    currentWorkspaceId: null,
    workspacesEnabled: false,
    baseApplicationSettings: {},
    applicationSettings: {}
})

interface EconomyStubState {
    walletRows: Array<Record<string, unknown>>
    grantRows: Array<Record<string, unknown>>
    nomenclatureRows: Array<Record<string, unknown>>
    stationRows: Array<Record<string, unknown>>
    postSourceRow: Record<string, unknown> | null
    postUpdatedRow: Record<string, unknown> | null
    insertedOperationId: string
    insertedWalletId: string
    idempotencyStored: Array<Record<string, unknown>> | null
    /** Simulates losing the scoped-unique race: the response INSERT stores nothing. */
    idempotencyInsertConflicts: boolean
    /** Rows served to idempotency lookups AFTER the losing response INSERT. */
    idempotencyPostSaveStored: Array<Record<string, unknown>> | null
    walletBalance: number
    cargoRows: Array<Record<string, unknown>>
    /** Mining belt rows (mutated by the fire UPDATE handler). */
    asteroidRows: Array<Record<string, unknown>>
    /** Rows served to the per-user cooldown probe (`SELECT 1 … LIMIT 1`); the
     * function form receives the probe params so tests can key rows by the
     * `_upl_created_by` bind ($1) like the real query does. */
    miningCooldownRows: Array<Record<string, unknown>> | ((params: unknown[]) => Array<Record<string, unknown>>)
    /** Runtime constant rows (`_app_constants`) — overridable to drive the
     * sanity-check failure paths without touching the shared module stubs. */
    constantsRows: Array<Record<string, unknown>>
    /** Capture of the fire remainder UPDATE parameters (assertion helper). */
    lastAsteroidUpdate: { totalKg: number; depletedValueId: string; rowId: string } | null
}

const buildStubState = (overrides: Partial<EconomyStubState> = {}): EconomyStubState => ({
    walletRows: [{ id: EXISTING_WALLET_ID }],
    grantRows: [{ id: EXISTING_GRANT_ID }],
    nomenclatureRows: [ORE_NOMENCLATURE_ROW, FUEL_NOMENCLATURE_ROW],
    stationRows: [{ id: STATION_ROW_ID, name_value: 'Hub station', market_enabled: true }],
    postSourceRow: null,
    postUpdatedRow: null,
    insertedOperationId: CREATED_OPERATION_ID,
    insertedWalletId: CREATED_WALLET_ID,
    idempotencyStored: null,
    idempotencyInsertConflicts: false,
    idempotencyPostSaveStored: null,
    walletBalance: 1000,
    cargoRows: [{ NomenclatureCode: 'ORE', Quantity: 10 }],
    asteroidRows: ASTEROID_ROWS_DEFAULT,
    miningCooldownRows: [],
    constantsRows: [...ECONOMY_CONSTANTS, ...MINING_CONSTANTS],
    lastAsteroidUpdate: null,
    ...overrides
})

/**
 * SQL-router mock (route-contract style): economy metadata, entity tables,
 * posting core and the idempotency store all run real SQL against canned rows.
 */
const IDEMPOTENCY_ROW_ID = '019a0000-0000-7000-8000-0000000000f9'

const routeEconomyQueries = (state: EconomyStubState) => {
    let idempotencySelectCount = 0
    return async (sql: string, params?: unknown[]): Promise<unknown[]> => {
        const statement = String(sql)

        if (statement.includes('pg_advisory_xact_lock')) return []

        if (statement.includes('INSERT INTO')) {
            if (statement.includes('obj_economy_idempotency')) {
                return state.idempotencyInsertConflicts ? [] : [{ id: IDEMPOTENCY_ROW_ID }]
            }
            if (statement.includes(`."wallet"`)) return [{ id: state.insertedWalletId }]
            if (statement.includes(`."operation"`)) return [{ id: state.insertedOperationId }]
            return []
        }

        if (statement.includes('._app_constants')) return state.constantsRows

        if (statement.includes('._app_objects')) {
            if (statement.includes("kind = 'set'")) {
                return [{ id: String(params?.[0]) === 'MiningConstants' ? MINING_SET_ID : SET_ID }]
            }
            if (statement.includes('ledgerSchema')) {
                if (statement.includes('id = $1')) {
                    const ledgerRow =
                        params?.[0] === WALLET_LEDGER_ID
                            ? {
                                  id: WALLET_LEDGER_ID,
                                  kind: 'ledger',
                                  codename: 'WalletLedger',
                                  table_name: 'led_wallet',
                                  config: { ledger: { fieldRoles: [], projections: [], idempotency: { keyFields: [] } } }
                              }
                            : {
                                  id: INVENTORY_LEDGER_ID,
                                  kind: 'ledger',
                                  codename: 'InventoryLedger',
                                  table_name: 'led_inventory',
                                  config: { ledger: { fieldRoles: [], projections: [], idempotency: { keyFields: [] } } }
                              }
                    return [ledgerRow]
                }
                return []
            }
            if (statement.includes('LOWER(') && statement.includes("kind = 'object'")) {
                const row = OBJECT_ROWS[String(params?.[0])]
                return row ? [row] : []
            }
            return []
        }

        if (statement.includes('._app_components')) return ATTRS_BY_OBJECT_ID[String(params?.[0])] ?? []

        if (statement.includes('._app_values')) {
            if (statement.includes('id = $1') && statement.includes('object_id = $2')) return [{ id: String(params?.[0]) }]
            if (statement.includes('object_id = $1')) {
                const requestedCodename = String(params?.[1] ?? '').toLowerCase()
                return (ENUM_VALUES_BY_OBJECT_ID[String(params?.[0])] ?? []).filter(
                    (value) => String(value.codename).toLowerCase() === requestedCodename
                )
            }
            if (statement.includes('id = ANY')) {
                const requested = (params?.[0] as string[]) ?? []
                return Object.values(ENUM_VALUES_BY_OBJECT_ID)
                    .flat()
                    .filter((value) => requested.includes(String(value.id)))
            }
            return []
        }

        if (statement.includes(`FROM ${SCHEMA_IDENT}."wallet"`)) return state.walletRows

        if (statement.includes(`FROM ${SCHEMA_IDENT}."nomenclature"`)) {
            const requestedCodes = (params?.[0] as string[]) ?? []
            return state.nomenclatureRows.filter((row) => requestedCodes.includes(String(row.code)))
        }

        if (statement.includes(`FROM ${SCHEMA_IDENT}."station"`)) return state.stationRows

        // Mining belt: FOR UPDATE fire loader filters by code; the plain SELECT
        // serves the state snapshot; the fire UPDATE mutates the stub rows with
        // the TZ §9.4 conditional semantics (remaining >= total else zero rows).
        if (statement.includes(`UPDATE ${SCHEMA_IDENT}."asteroid"`)) {
            const totalKg = Number(params?.[0])
            const depletedValueId = String(params?.[1])
            const rowId = String(params?.[2])
            state.lastAsteroidUpdate = { totalKg, depletedValueId, rowId }
            const row = state.asteroidRows.find((item) => String(item.id) === rowId)
            if (!row) return []
            const remaining = Number(row.remaining_quantity)
            if (!(remaining >= totalKg)) return []
            row.remaining_quantity = Math.round((remaining - totalKg) * 10) / 10
            if (row.remaining_quantity <= 0) row.status_value = depletedValueId
            return [{ id: rowId, remaining_quantity: row.remaining_quantity }]
        }

        if (statement.includes(`FROM ${SCHEMA_IDENT}."asteroid"`)) {
            if (statement.includes('FOR UPDATE')) {
                const requestedCode = String(params?.[0] ?? '')
                return state.asteroidRows.filter((row) => String(row.code_value) === requestedCode)
            }
            return state.asteroidRows
        }

        if (statement.includes(`UPDATE ${SCHEMA_IDENT}."operation"`)) return state.postUpdatedRow ? [state.postUpdatedRow] : []

        if (statement.includes(`FROM ${SCHEMA_IDENT}."operation"`)) {
            if (statement.includes('FOR UPDATE')) return state.postSourceRow ? [state.postSourceRow] : []
            if (statement.includes('SELECT *')) {
                // loadRuntimeRowById after the create insert.
                return state.postSourceRow ? [state.postSourceRow] : []
            }
            // Per-user mining cooldown probe (SELECT 1 … LIMIT 1). The
            // function form keys rows by the owner bind ($1) like the real
            // query, enabling cross-user isolation tests.
            if (statement.includes('SELECT 1')) {
                return typeof state.miningCooldownRows === 'function' ? state.miningCooldownRows(params ?? []) : state.miningCooldownRows
            }
            // StarterGrant existence probe (SELECT id ... LIMIT 1).
            return state.grantRows
        }

        if (statement.includes('obj_economy_idempotency')) {
            if (statement.includes('DELETE FROM')) return []
            idempotencySelectCount += 1
            if (state.idempotencyPostSaveStored && idempotencySelectCount > 1) return state.idempotencyPostSaveStored
            return state.idempotencyStored ?? []
        }

        return []
    }
}

const buildService = (state: EconomyStubState) => {
    const { executor } = createMockDbExecutor()
    executor.query.mockImplementation(routeEconomyQueries(state))
    const ctx = buildCtx(executor)
    // Default ledger projections follow the stub state; individual tests may
    // re-stub `queryProjectionSpy` for specific balance/cargo combinations.
    queryProjectionSpy.mockImplementation(async (params) => {
        if (params.projectionCodename === 'walletBalance') {
            return {
                projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                rows: [{ Amount: state.walletBalance }],
                limit: 100,
                offset: 0
            } as never
        }
        return {
            projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
            rows: state.cargoRows,
            limit: 100,
            offset: 0
        } as never
    })
    const service = createRuntimeEconomyService({
        getDbExecutor: () => executor,
        query: async (_req, sql, parameters) => executor.query(sql, parameters)
    })
    return { executor, ctx, service }
}

describe('runtimeEconomyService', () => {
    beforeEach(() => {
        mockDescribeFlightContext.mockReset()
        mockDescribeFlightContext.mockResolvedValue(STATION_PROXIMITY_CONTEXT)

        listLedgersSpy = jest.spyOn(RuntimeLedgerService.prototype, 'listLedgers').mockResolvedValue([
            { id: WALLET_LEDGER_ID, codename: 'WalletLedger' },
            { id: INVENTORY_LEDGER_ID, codename: 'InventoryLedger' }
        ] as never)
        queryProjectionSpy = jest.spyOn(RuntimeLedgerService.prototype, 'queryProjection').mockImplementation(async (params) => {
            if (params.projectionCodename === 'walletBalance') {
                return {
                    projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                    rows: [{ Amount: 1000 }],
                    limit: 100,
                    offset: 0
                } as never
            }
            return {
                projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                rows: [],
                limit: 100,
                offset: 0
            } as never
        })
        dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
        appendMovementsSpy = jest.spyOn(RuntimePostingMovementService.prototype, 'appendMovements')
    })

    afterEach(() => {
        listLedgersSpy.mockRestore()
        queryProjectionSpy.mockRestore()
        dispatchLifecycleEventSpy.mockRestore()
        appendMovementsSpy.mockRestore()
    })

    describe('error mapping (D9 / TZ §8.4)', () => {
        it('maps every stable economy code to its documented HTTP status', () => {
            const expected: Record<string, number> = {
                ECONOMY_NOT_AT_STATION: 409,
                ECONOMY_UNKNOWN_NOMENCLATURE: 404,
                ECONOMY_INVALID_QUANTITY: 422,
                ECONOMY_INSUFFICIENT_CARGO: 409,
                ECONOMY_INSUFFICIENT_FUNDS: 409,
                ECONOMY_CAPACITY_EXCEEDED: 409,
                ECONOMY_MARKET_DISABLED: 409,
                ECONOMY_IDEMPOTENCY_CONFLICT: 409,
                ECONOMY_POSTING_FAILED: 500
            }
            for (const [code, status] of Object.entries(expected)) {
                try {
                    throwEconomyFailure(code as never, `boom: ${code}`)
                    throw new Error(`expected ${code} to throw`)
                } catch (error) {
                    expect(error).toBeInstanceOf(UpdateFailure)
                    expect(error).toMatchObject({ statusCode: status, body: { error: `boom: ${code}`, code } })
                }
            }
        })

        it('converts numeric strings and rejects garbage through toFiniteNumber', () => {
            expect(toFiniteNumber('12.5')).toBe(12.5)
            expect(toFiniteNumber(7)).toBe(7)
            expect(toFiniteNumber('NaN')).toBeNull()
            expect(toFiniteNumber(undefined)).toBeNull()
        })

        it('declares one market side per price constant (ORE sell / FUEL buy)', () => {
            expect(MARKET_SIDE_CONFIGS).toHaveLength(2)
            expect(MARKET_SIDE_CONFIGS.map((config) => `${config.nomenclatureCode}:${config.side}`)).toEqual(['ORE:sell', 'FUEL:buy'])
            expect(REQUIRED_CONSTANT_CODES).toContain('OrePricePerKg')
            expect(REQUIRED_CONSTANT_CODES).toContain('FuelPricePerLiter')
        })
    })

    describe('idempotency codecs', () => {
        it('accepts UUID v7 keys, lowercases them and rejects everything else', () => {
            expect(parseEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000aa')).toEqual({
                kind: 'ok',
                key: '019a0000-0000-7000-8000-0000000000aa'
            })
            expect(parseEconomyIdempotencyKey('019A0000-0000-7000-8000-0000000000AA')).toEqual({
                kind: 'ok',
                key: '019a0000-0000-7000-8000-0000000000aa'
            })
            expect(parseEconomyIdempotencyKey(undefined)).toEqual({ kind: 'absent' })
            expect(parseEconomyIdempotencyKey('   ')).toEqual({ kind: 'absent' })
            expect(parseEconomyIdempotencyKey('not-a-uuid')).toEqual({ kind: 'malformed' })
            expect(parseEconomyIdempotencyKey('019a0000-0000-4000-8000-0000000000aa')).toEqual({ kind: 'malformed' })
        })

        it('hashes keys with sha256 and fingerprints canonicalized bodies', () => {
            const hash = hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000aa')
            expect(hash).toMatch(/^[a-f0-9]{64}$/)

            const direct = fingerprintEconomyTradeBody('sell', {
                stationId: '019a0000-0000-7000-8000-0000000000bb',
                nomenclatureCode: 'ORE',
                quantity: 5
            })
            const reordered = fingerprintEconomyTradeBody('sell', {
                quantity: 5,
                nomenclatureCode: 'ORE',
                stationId: '019a0000-0000-7000-8000-0000000000bb'
            })
            expect(direct).toMatch(/^[a-f0-9]{64}$/)
            expect(direct).toBe(reordered)
            expect(direct).not.toBe(fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 6 }))
            // Endpoint identity is part of the payload: one key can never replay across /sell and /buy.
            expect(direct).not.toBe(
                fingerprintEconomyTradeBody('buy', {
                    stationId: '019a0000-0000-7000-8000-0000000000bb',
                    nomenclatureCode: 'ORE',
                    quantity: 5
                })
            )
        })
    })

    describe('executeTrade validation matrix', () => {
        it('rejects non-positive quantities with 422 ECONOMY_INVALID_QUANTITY before any row work', async () => {
            const harness = buildService(buildStubState())
            for (const quantity of [0, -1]) {
                await expect(
                    harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity })
                ).rejects.toMatchObject({
                    statusCode: 422,
                    body: { code: 'ECONOMY_INVALID_QUANTITY' }
                })
            }
            expect(harness.executor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'))).toHaveLength(0)
        })

        it('rejects unknown nomenclature with 404 ECONOMY_UNKNOWN_NOMENCLATURE', async () => {
            const harness = buildService(buildStubState({ nomenclatureRows: [] }))
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity: 1 })
            ).rejects.toMatchObject({ statusCode: 404, body: { code: 'ECONOMY_UNKNOWN_NOMENCLATURE' } })
        })

        it('rejects trades when the station market is disabled with 409 ECONOMY_MARKET_DISABLED', async () => {
            const harness = buildService(
                buildStubState({ stationRows: [{ id: STATION_ROW_ID, name_value: 'Closed hub', market_enabled: false }] })
            )
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity: 1 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_MARKET_DISABLED' } })
        })

        it('rejects trades away from the station with 409 ECONOMY_NOT_AT_STATION', async () => {
            mockDescribeFlightContext.mockResolvedValue(null)
            const harness = buildService(buildStubState())
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity: 1 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_NOT_AT_STATION' } })
        })

        it('rejects selling more cargo than owned with 409 ECONOMY_INSUFFICIENT_CARGO', async () => {
            const harness = buildService(buildStubState())
            queryProjectionSpy.mockImplementation(async (params) => {
                if (params.projectionCodename === 'stockBalance') {
                    return {
                        projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                        rows: [],
                        limit: 100,
                        offset: 0
                    } as never
                }
                return {
                    projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                    rows: [{ Amount: 1000 }],
                    limit: 100,
                    offset: 0
                } as never
            })
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity: 11 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_INSUFFICIENT_CARGO' } })
        })

        it('rejects buying without funds with 409 ECONOMY_INSUFFICIENT_FUNDS', async () => {
            const harness = buildService(buildStubState())
            queryProjectionSpy.mockImplementation(async (params) => {
                if (params.projectionCodename === 'walletBalance') {
                    return {
                        projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                        rows: [{ Amount: 4 }],
                        limit: 100,
                        offset: 0
                    } as never
                }
                return {
                    projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                    rows: [],
                    limit: 100,
                    offset: 0
                } as never
            })
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'buy', { nomenclatureCode: 'FUEL', quantity: 2 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_INSUFFICIENT_FUNDS' } })
        })

        it('rejects buys beyond cargo capacity with 409 ECONOMY_CAPACITY_EXCEEDED', async () => {
            const harness = buildService(buildStubState())
            // 10 kg owned ORE; buying 130 L FUEL at 0.8 kg/L adds 104 kg → 114 > 100 max (fixture
            // constants aligned with the shipped generator values).
            queryProjectionSpy.mockImplementation(async (params) => {
                if (params.projectionCodename === 'walletBalance') {
                    return {
                        projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                        rows: [{ Amount: 5000 }],
                        limit: 100,
                        offset: 0
                    } as never
                }
                return {
                    projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                    rows: [{ NomenclatureCode: 'ORE', Quantity: 10 }],
                    limit: 100,
                    offset: 0
                } as never
            })
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'buy', { nomenclatureCode: 'FUEL', quantity: 130 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_CAPACITY_EXCEEDED' } })
        })

        it('rejects trades whose nomenclature has no market side for the requested kind', async () => {
            const harness = buildService(buildStubState())
            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'FUEL', quantity: 1 })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_MARKET_DISABLED' } })
        })
    })

    describe('trade execution', () => {
        it('ignores a client-supplied stationId and stamps the server-resolved station', async () => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 }
            })
            const harness = buildService(state)

            // FR-022 deviation: stationId is accepted by the schema for forward
            // compatibility but the authoritative station always comes from the
            // live flight room proximity resolution.
            await harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', {
                nomenclatureCode: 'ORE',
                quantity: 1,
                stationId: '019a0000-0000-7000-8000-0000000009f1'
            })

            const insertCall = harness.executor.query.mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes(`."operation"`)
            )
            expect(insertCall).toBeDefined()
            expect(insertCall?.[1] as unknown[]).toContain(STATION_ROW_ID)
        })

        it('scopes trade row writes to the active workspace when one is set', async () => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 }
            })
            const harness = buildService(state)
            const workspaceCtx: RuntimeSchemaContext = {
                ...harness.ctx,
                currentWorkspaceId: '019a0000-0000-7000-8000-000000000bc0',
                workspacesEnabled: true
            }

            const outcome = await harness.service.executeTrade(workspaceCtx, APPLICATION_ID, 'sell', {
                nomenclatureCode: 'ORE',
                quantity: 1
            })
            expect(outcome.kind).toBe('executed')

            const insertCall = harness.executor.query.mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes(`."operation"`)
            )
            expect(insertCall).toBeDefined()
            expect(String(insertCall?.[0])).toContain('workspace_id')
        })

        it('completes a sell through the shared posting core and returns the TZ §8.2 response shape', async () => {
            const postedRow = {
                id: CREATED_OPERATION_ID,
                _app_record_state: 'posted',
                _upl_locked: false,
                _upl_version: 1
            }
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: postedRow
            })
            const harness = buildService(state)

            dispatchLifecycleEventSpy.mockImplementation(async (params) =>
                params.payload.eventName === 'beforePost'
                    ? [
                          {
                              movements: [
                                  {
                                      ledgerCodename: 'WalletLedger',
                                      facts: [{ data: { WalletKey: USER_A, Currency: 'CR', Amount: 50 } }]
                                  }
                              ]
                          }
                      ]
                    : []
            )
            appendMovementsSpy.mockResolvedValue([
                { ledgerCodename: 'WalletLedger', facts: [{ id: '019a0000-0000-7000-8000-0000000000fa' }] }
            ])

            const outcome = await harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', {
                nomenclatureCode: 'ORE',
                quantity: 5
            })

            expect(outcome.kind).toBe('executed')
            if (outcome.kind !== 'executed') return
            expect(outcome.status).toBe(200)
            expect(outcome.body).toMatchObject({
                operationId: CREATED_OPERATION_ID,
                walletBalance: 1000,
                cargo: [{ nomenclatureCode: 'ORE', quantity: 10, unit: 'Kg', massKg: 10, nomenclatureName: 'Ore' }]
            })
            // Posting delegated to the shared core with the Operation collection and command 'post'.
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachmentId: OPERATION_OBJECT_ID,
                    entityCodename: 'Operation',
                    payload: expect.objectContaining({ eventName: 'beforePost' })
                })
            )
            expect(appendMovementsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    registrarKind: 'object',
                    behavior: expect.objectContaining({
                        posting: expect.objectContaining({ targetLedgers: ['WalletLedger', 'InventoryLedger'] })
                    }),
                    results: expect.arrayContaining([
                        expect.objectContaining({
                            movements: expect.arrayContaining([expect.objectContaining({ ledgerCodename: 'WalletLedger' })])
                        })
                    ])
                })
            )
            const postUpdateCall = harness.executor.query.mock.calls.find(
                ([sql]) => String(sql).includes('UPDATE') && String(sql).includes('_app_record_state')
            )
            expect(String(postUpdateCall?.[0])).toContain(`UPDATE ${SCHEMA_IDENT}."operation"`)
            expect(postUpdateCall?.[1]).toContain('posted')
        })

        it('posts the operation server-side with the market unit price (never client-supplied)', async () => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 }
            })
            const harness = buildService(state)

            await harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'buy', { nomenclatureCode: 'FUEL', quantity: 2 })

            const insertCall = harness.executor.query.mock.calls.find(([sql]) =>
                String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."operation"`)
            )
            expect(insertCall).toBeDefined()
            const insertParams = insertCall?.[1] as unknown[]
            expect(insertParams).toContain(BUY_TYPE_VALUE_ID)
            expect(insertParams).toContain(2)
            expect(insertParams).toContain(5) // FuelPricePerLiter — server-side price
        })

        it('fails closed with ECONOMY_POSTING_FAILED when the posting core throws a non-mapped error', async () => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 }
            })
            const harness = buildService(state)
            harness.executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
                if (String(sql).includes('FOR UPDATE')) throw new Error('relation does not exist: unexpected internals')
                return routeEconomyQueries(state)(sql, params)
            })

            await expect(
                harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', { nomenclatureCode: 'ORE', quantity: 1 })
            ).rejects.toMatchObject({
                statusCode: 500,
                body: { error: 'Economy posting failed', code: 'ECONOMY_POSTING_FAILED' }
            })
        })
    })

    describe('wallet ensure and StarterGrant bootstrap (D6/D11)', () => {
        it('creates the wallet and the once-only StarterGrant inside the same advisory-locked flow', async () => {
            const state = buildStubState({
                walletRows: [],
                grantRows: [],
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 }
            })
            const harness = buildService(state)

            const outcome = await harness.service.executeTrade(harness.ctx, APPLICATION_ID, 'sell', {
                nomenclatureCode: 'ORE',
                quantity: 3
            })

            expect(outcome.kind).toBe('executed')
            const walletInsert = harness.executor.query.mock.calls.find(([sql]) =>
                String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."wallet"`)
            )
            expect(walletInsert).toBeDefined()
            const walletParams = walletInsert?.[1] as unknown[]
            expect(walletParams).toContain(USER_A)
            expect(walletParams).toContain('CR')
            expect(walletParams).toContain(ACTIVE_STATUS_VALUE_ID)

            const operationInserts = harness.executor.query.mock.calls.filter(([sql]) =>
                String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."operation"`)
            )
            // Exactly two operations: the StarterGrant and the trade itself.
            expect(operationInserts).toHaveLength(2)
            const grantInsertParams = operationInserts[0]?.[1] as unknown[]
            expect(grantInsertParams).toContain(STARTER_TYPE_VALUE_ID)
            expect(grantInsertParams).toContain(10) // StartingOreKg
            expect(grantInsertParams).toContain(0) // UnitPrice 0 for the grant
        })

        it('does not create a second StarterGrant on the next summary call (once-only per user)', async () => {
            const grantRow = {
                id: EXISTING_GRANT_ID,
                _app_record_state: 'posted',
                _upl_locked: false,
                _upl_version: 1,
                owner_key: USER_A,
                wallet_id: EXISTING_WALLET_ID,
                operation_type_id: STARTER_TYPE_VALUE_ID,
                quantity: 10,
                unit_price: 0,
                _upl_created_at: new Date('2026-05-08T00:00:00.000Z')
            }
            const state = buildStubState({
                grantRows: [{ id: EXISTING_GRANT_ID }],
                postSourceRow: grantRow
            })
            const harness = buildService(state)

            const { summary } = await harness.service.getEconomySummary(harness.ctx, APPLICATION_ID)

            expect(summary.wallet).toEqual({ currency: 'CR', balance: 1000 })
            expect(summary.atStation).toBe(true)
            expect(summary.stationName).toBe('Hub station')
            expect(summary.market).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ nomenclatureCode: 'ORE', side: 'sell', price: 10, unit: 'Kg' }),
                    expect.objectContaining({ nomenclatureCode: 'FUEL', side: 'buy', price: 5, unit: 'Liter' })
                ])
            )
            // The grant probe found the existing StarterGrant: no INSERT for a grant ran,
            // and the summary-side bootstrap performed zero operations inserts.
            const operationInserts = harness.executor.query.mock.calls.filter(([sql]) =>
                String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."operation"`)
            )
            expect(operationInserts).toHaveLength(0)
            const grantProbe = harness.executor.query.mock.calls.find(
                ([sql]) =>
                    String(sql).includes(`FROM ${SCHEMA_IDENT}."operation"`) &&
                    String(sql).includes('operation_type_id') &&
                    String(sql).includes('LIMIT 1')
            )
            expect(grantProbe).toBeDefined()
        })

        it('resolves REF enumeration units to labels instead of raw value ids in summary projections', async () => {
            // Nomenclature.Unit as REF→enumeration: the summary must surface the
            // value label ('Kg'), never the raw enumeration value id (runtime UX rule).
            const originalNomenclatureAttrs = ATTRS_BY_OBJECT_ID[NOMENCLATURE_OBJECT_ID]
            ATTRS_BY_OBJECT_ID[NOMENCLATURE_OBJECT_ID] = [
                ...NOMENCLATURE_ATTRS.filter((column) => column.codename !== 'Unit'),
                attr({
                    id: '019a0000-0000-7000-8000-000000000115',
                    codename: 'Unit',
                    column_name: 'unit',
                    data_type: 'REF',
                    target_object_id: UNIT_ENUM_ID,
                    target_object_kind: 'enumeration'
                })
            ]
            try {
                const state = buildStubState({
                    nomenclatureRows: [
                        { ...ORE_NOMENCLATURE_ROW, unit_value: KG_UNIT_VALUE_ID },
                        { ...FUEL_NOMENCLATURE_ROW, unit_value: LITER_UNIT_VALUE_ID }
                    ]
                })
                queryProjectionSpy.mockImplementation(async (params) => {
                    if (params.projectionCodename === 'walletBalance') {
                        return {
                            projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                            rows: [{ Amount: 1000 }],
                            limit: 100,
                            offset: 0
                        } as never
                    }
                    return {
                        projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                        rows: [{ NomenclatureCode: 'ORE', Quantity: 10 }],
                        limit: 100,
                        offset: 0
                    } as never
                })
                const harness = buildService(state)

                const { summary } = await harness.service.getEconomySummary(harness.ctx, APPLICATION_ID)

                expect(summary.cargo).toEqual([
                    expect.objectContaining({ nomenclatureCode: 'ORE', quantity: 10, unit: 'Kg', nomenclatureName: 'Ore' })
                ])
                expect(summary.market).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ nomenclatureCode: 'ORE', side: 'sell', unit: 'Kg' }),
                        expect.objectContaining({ nomenclatureCode: 'FUEL', side: 'buy', unit: 'Liter' })
                    ])
                )
            } finally {
                ATTRS_BY_OBJECT_ID[NOMENCLATURE_OBJECT_ID] = originalNomenclatureAttrs
            }
        })

        it('scopes summary cargo to the owner projection and fails closed on unknown cargo nomenclature', async () => {
            const state = buildStubState({ cargoRows: [{ NomenclatureCode: 'GHOST', Quantity: 1 }] })
            queryProjectionSpy.mockImplementation(async (params) => {
                if (params.projectionCodename === 'stockBalance') {
                    return {
                        projection: { codename: 'stockBalance', kind: 'balance', dimensions: [], resources: [] },
                        rows: state.cargoRows,
                        limit: 100,
                        offset: 0
                    } as never
                }
                return {
                    projection: { codename: 'walletBalance', kind: 'balance', dimensions: [], resources: [] },
                    rows: [{ Amount: 1000 }],
                    limit: 100,
                    offset: 0
                } as never
            })
            const harness = buildService(state)

            await expect(harness.service.getEconomySummary(harness.ctx, APPLICATION_ID)).rejects.toMatchObject({
                statusCode: 404,
                body: { code: 'ECONOMY_UNKNOWN_NOMENCLATURE' }
            })
        })
    })

    describe('idempotency gate replay (D7)', () => {
        it('replays the stored response for a scoped key hit without re-executing the trade', async () => {
            const storedResponse = { operationId: EXISTING_GRANT_ID, walletBalance: 1000, cargo: [] }
            const state = buildStubState({
                idempotencyStored: [
                    {
                        bodyFingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 }),
                        response: storedResponse,
                        statusCode: 200,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    }
                ]
            })
            const harness = buildService(state)

            const outcome = await harness.service.executeTrade(
                harness.ctx,
                APPLICATION_ID,
                'sell',
                { nomenclatureCode: 'ORE', quantity: 5 },
                {
                    applicationId: APPLICATION_ID,
                    userId: USER_A,
                    workspaceId: null,
                    keyHash: hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000aa'),
                    fingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 })
                }
            )

            expect(outcome).toEqual({ kind: 'replayed', status: 200, body: storedResponse })
            // The advisory lock and scoped lookup ran, but no trade work happened.
            expect(harness.executor.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_xact_lock'))).toBe(true)
            expect(
                harness.executor.query.mock.calls.some(
                    ([sql]) => String(sql).includes('obj_economy_idempotency') && String(sql).includes('SELECT')
                )
            ).toBe(true)
            expect(harness.executor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('rejects a key reuse with a different payload via 409 ECONOMY_IDEMPOTENCY_CONFLICT', async () => {
            const state = buildStubState({
                idempotencyStored: [
                    {
                        bodyFingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 }),
                        response: { operationId: EXISTING_GRANT_ID, walletBalance: 1000, cargo: [] },
                        statusCode: 200,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    }
                ]
            })
            const harness = buildService(state)

            await expect(
                harness.service.executeTrade(
                    harness.ctx,
                    APPLICATION_ID,
                    'sell',
                    { nomenclatureCode: 'ORE', quantity: 6 },
                    {
                        applicationId: APPLICATION_ID,
                        userId: USER_A,
                        workspaceId: null,
                        keyHash: hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000aa'),
                        fingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 6 })
                    }
                )
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_IDEMPOTENCY_CONFLICT' } })
        })

        it('stores the response inside the same transaction after a successful trade', async () => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 }
            })
            const harness = buildService(state)

            const outcome = await harness.service.executeTrade(
                harness.ctx,
                APPLICATION_ID,
                'sell',
                { nomenclatureCode: 'ORE', quantity: 5 },
                {
                    applicationId: APPLICATION_ID,
                    userId: USER_A,
                    workspaceId: null,
                    keyHash: hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000ab'),
                    fingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 })
                }
            )

            expect(outcome.kind).toBe('executed')
            const saveCall = harness.executor.query.mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('obj_economy_idempotency')
            )
            expect(saveCall).toBeDefined()
            const saveParams = saveCall?.[1] as unknown[]
            expect(saveParams[0]).toBe(APPLICATION_ID)
            expect(saveParams[1]).toBe(USER_A)
            expect(saveParams[3]).toBe(hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000ab'))
            expect(saveParams[6]).toBe(200)
        })

        it('returns the race winner stored response when the scoped-unique insert loses the race', async () => {
            const storedResponse = { operationId: EXISTING_GRANT_ID, walletBalance: 1000, cargo: [] }
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_version: 1 },
                // The winner stores its row between the loser's gate lookup and
                // the loser's response INSERT: the gate sees nothing, the scoped-
                // unique INSERT stores nothing, and the post-save lookup hands
                // back the winner's response instead of double-executing.
                idempotencyInsertConflicts: true,
                idempotencyPostSaveStored: [
                    {
                        bodyFingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 }),
                        response: storedResponse,
                        statusCode: 200,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    }
                ]
            })
            const harness = buildService(state)

            const outcome = await harness.service.executeTrade(
                harness.ctx,
                APPLICATION_ID,
                'sell',
                { nomenclatureCode: 'ORE', quantity: 5 },
                {
                    applicationId: APPLICATION_ID,
                    userId: USER_A,
                    workspaceId: null,
                    keyHash: hashEconomyIdempotencyKey('019a0000-0000-7000-8000-0000000000ac'),
                    fingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 5 })
                }
            )

            expect(outcome).toEqual({ kind: 'replayed', status: 200, body: storedResponse })
            // The loser did run its own trade work before losing the store race.
            expect(
                harness.executor.query.mock.calls.some(
                    ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes(`."operation"`)
                )
            ).toBe(true)
        })
    })

    describe('ensureWalletForUser (B4 public surface)', () => {
        it('returns the existing wallet without creating a row', async () => {
            const harness = buildService(buildStubState())
            const result = await harness.service.ensureWalletForUser(harness.ctx, APPLICATION_ID, 'CR')
            expect(result).toMatchObject({ walletId: EXISTING_WALLET_ID, created: false })
            expect(harness.executor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."wallet"`))).toBe(
                false
            )
        })

        it('creates a missing wallet inside a savepoint transaction with the Active status', async () => {
            const state = buildStubState({ walletRows: [] })
            const harness = buildService(state)
            const result = await harness.service.ensureWalletForUser(harness.ctx, APPLICATION_ID, 'CR')
            expect(result).toMatchObject({ walletId: state.insertedWalletId, created: true })
            expect(result.afterCreateLifecycleRequest).toMatchObject({
                applicationId: APPLICATION_ID,
                payload: { eventName: 'afterCreate' }
            })
            const insert = harness.executor.query.mock.calls.find(([sql]) => String(sql).includes(`INSERT INTO ${SCHEMA_IDENT}."wallet"`))
            expect(insert?.[1] as unknown[]).toContain('CR')
        })
    })

    describe('mining belt flows (mining TZ DOC-2026-006)', () => {
        const MINE_IDEMPOTENCY_KEY = '019a0000-0000-7000-8000-0000000000ab'
        const postedMineRow = { id: CREATED_OPERATION_ID, _app_record_state: 'posted', _upl_locked: false, _upl_version: 1 }

        const buildFireService = (overrides: Partial<EconomyStubState> = {}) => {
            const state = buildStubState({
                postSourceRow: { id: CREATED_OPERATION_ID, _app_record_state: 'draft', _upl_locked: false, _upl_version: 1 },
                postUpdatedRow: postedMineRow,
                ...overrides
            })
            const harness = buildService(state)
            // The authored posting module (InventoryLedger-only Mine branch) is
            // represented by the lifecycle spy returning a single ledger group.
            dispatchLifecycleEventSpy.mockImplementation(async (params) =>
                params.payload.eventName === 'beforePost'
                    ? [
                          {
                              movements: [
                                  {
                                      ledgerCodename: 'InventoryLedger',
                                      facts: [
                                          {
                                              data: {
                                                  OwnerKey: USER_A,
                                                  StationCode: STATION_ROW_ID,
                                                  NomenclatureCode: 'ORE',
                                                  Quantity: 2.1,
                                                  Cost: 0
                                              }
                                          }
                                      ]
                                  }
                              ]
                          }
                      ]
                    : []
            )
            appendMovementsSpy.mockResolvedValue([
                { ledgerCodename: 'InventoryLedger', facts: [{ id: '019a0000-0000-7000-8000-0000000000fb' }] }
            ])
            return { state, harness }
        }

        beforeEach(() => {
            mockDescribeFlightContext.mockResolvedValue(MINING_FLIGHT_CONTEXT)
        })

        it('returns the belt snapshot with rounded remainders and constants', async () => {
            const { harness } = buildFireService({
                asteroidRows: [
                    buildAsteroidRow({ remaining_quantity: 117.90000000000001 }),
                    buildAsteroidRow({
                        id: ASTEROID_ROW_B_ID,
                        code_value: 'AST-02',
                        remaining_quantity: 0,
                        status_value: DEPLETED_STATUS_VALUE_ID,
                        visual_variant: 2
                    })
                ]
            })
            const state = await harness.service.getMiningState(harness.ctx)
            expect(state.asteroids).toHaveLength(2)
            expect(state.asteroids[0]).toMatchObject({
                code: 'AST-01',
                resourceCode: 'ORE',
                remainingQuantityKg: 117.9, // rounded to 0.1 kg (TZ §8.1)
                status: 'Active',
                visualVariant: 1
            })
            expect(state.asteroids[1]).toMatchObject({ code: 'AST-02', status: 'Depleted' })
            expect(state.constants).toMatchObject({
                miningRadiusMeters: 80,
                miningCooldownMs: 350,
                chunkVisualLifetimeMs: 900,
                statePollMs: 2000
            })
        })

        it('executes a fire: posts Mine with an InventoryLedger-only movement and updates the remainder', async () => {
            const { state, harness } = buildFireService()
            const outcome = await harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })

            expect(outcome.kind).toBe('executed')
            if (outcome.kind !== 'executed') return
            expect(outcome.status).toBe(200)
            expect(outcome.body.asteroid).toMatchObject({ code: 'AST-01', status: 'Active' })
            expect(outcome.body.chunks.length).toBeGreaterThanOrEqual(1)
            expect(outcome.body.chunks.length).toBeLessThanOrEqual(3)
            const chunkSum = Math.round(outcome.body.chunks.reduce((acc, chunk) => acc + chunk.massKg, 0) * 10) / 10
            expect(outcome.body.asteroid.remainingQuantityKg).toBeCloseTo(120 - chunkSum, 5)
            // The response re-reads the ledger projections; the unit harness's
            // static projection does not reflect the spy-mocked movement (the
            // movement→projection reflection is covered by the PG integration
            // suite), so the fresh read observes the pre-fire projection.
            expect(outcome.body.cargo.usedKg).toBe(10)
            expect(outcome.body.wallet).toEqual({ balance: 1000, currency: 'CR' }) // Mine never touches the wallet

            // Posting fired once with the InventoryLedger-only movement group.
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({ entityCodename: 'Operation', payload: expect.objectContaining({ eventName: 'beforePost' }) })
            )
            const movementCall = appendMovementsSpy.mock.calls.at(-1)?.[0]
            expect(movementCall).toMatchObject({ registrarKind: 'object' })

            // TZ §9.4 step 5: the remainder UPDATE ran with the chunk total and
            // the resolved Depleted REF value id.
            expect(state.lastAsteroidUpdate).toMatchObject({
                totalKg: chunkSum,
                depletedValueId: DEPLETED_STATUS_VALUE_ID,
                rowId: ASTEROID_ROW_A_ID
            })
            expect(state.asteroidRows[0].remaining_quantity).toBeCloseTo(120 - chunkSum, 5)
        })

        it('flips the asteroid to Depleted when the remainder is exhausted', async () => {
            // The remainder sits BELOW the minimum chunk (0.8 kg): the last-chunk
            // clamp then always consumes it exactly, so this assertion is
            // deterministic (a 1 kg remainder left 0.2 kg ~half the time when a
            // single small chunk < 1 was drawn — residual duration flake).
            const { state, harness } = buildFireService({
                asteroidRows: [buildAsteroidRow({ remaining_quantity: 0.5 })]
            })
            const outcome = await harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })
            expect(outcome.kind).toBe('executed')
            if (outcome.kind !== 'executed') return
            expect(outcome.body.asteroid.status).toBe('Depleted')
            expect(outcome.body.asteroid.remainingQuantityKg).toBe(0)
            expect(state.lastAsteroidUpdate?.depletedValueId).toBe(DEPLETED_STATUS_VALUE_ID)
        })

        it('rejects a second fire inside the cooldown window (per-user, TZ §9.5)', async () => {
            const { harness } = buildFireService({ miningCooldownRows: [{ ok: 1 }] })
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'MINING_COOLDOWN' }
            })
        })

        it('keeps cooldowns isolated per user: user B fires inside user A cooldown window (QA MEDIUM backlog)', async () => {
            // The probe filters by _upl_created_by = $1 — emulate that in the
            // stub so only user A's probe observes a Mine row inside the window.
            const { harness } = buildFireService({
                miningCooldownRows: (params) => (String(params?.[0]) === USER_A ? [{ ok: 1 }] : [])
            })

            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'MINING_COOLDOWN' }
            })

            const outcome = await harness.service.executeMiningFire({ ...harness.ctx, userId: USER_B }, APPLICATION_ID, {
                asteroidCode: 'AST-01'
            })
            expect(outcome.kind).toBe('executed')

            // The advisory lock key carries the firing user — user B never
            // serializes behind user A's cooldown lock.
            const lockKeys = harness.executor.query.mock.calls
                .filter(([sql]) => String(sql).includes('pg_advisory_xact_lock'))
                .map(([, params]) => String((params as unknown[] | undefined)?.[0]))
            expect(lockKeys).toContain(`mining:${APPLICATION_ID}:${USER_A}`)
            expect(lockKeys).toContain(`mining:${APPLICATION_ID}:${USER_B}`)
        })

        it('fails closed on semantically broken mining constants (QA MEDIUM backlog: sanity checks)', async () => {
            const violations: Array<[string, number, string]> = [
                ['MiningRadiusMeters', 0, 'MiningRadiusMeters must be > 0'],
                ['MiningCooldownMs', -1, 'MiningCooldownMs must be >= 0'],
                ['ChunksPerHitMin', 0, 'ChunksPerHitMin must be >= 1'],
                ['ChunksPerHitMax', 0, 'ChunksPerHitMax must be >= ChunksPerHitMin'],
                // TZ §7.4 caps a hit at 1-3 chunks and the response schema
                // enforces chunks.max(3) — a larger bound must fail closed
                // (CodeRabbit, PR #934).
                ['ChunksPerHitMax', 4, 'ChunksPerHitMax must be <= 3'],
                ['ChunkMassMinKg', 0, 'ChunkMassMinKg must be > 0'],
                ['ChunkMassMaxKg', 0.1, 'ChunkMassMaxKg must be >= ChunkMassMinKg'],
                ['ChunkMassSkew', 0, 'ChunkMassSkew must be > 0'],
                ['ChunkVisualLifetimeMs', 0, 'ChunkVisualLifetimeMs must be > 0'],
                ['MiningStatePollMs', 0, 'MiningStatePollMs must be > 0']
            ]
            for (const [codename, value, message] of violations) {
                const { harness } = buildFireService({
                    constantsRows: [
                        ...ECONOMY_CONSTANTS,
                        ...MINING_CONSTANTS.map((row) => (row.codename === codename ? { ...row, value_json: value } : row))
                    ]
                })
                await expect(
                    harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })
                ).rejects.toMatchObject({
                    statusCode: 500,
                    body: { code: 'MINING_POSTING_FAILED', error: expect.stringContaining(message) }
                })
            }
        })

        it('rejects an unknown asteroid code with 404 MINING_TARGET_NOT_FOUND', async () => {
            const { harness } = buildFireService({ asteroidRows: [] })
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-99' })).rejects.toMatchObject({
                statusCode: 404,
                body: { code: 'MINING_TARGET_NOT_FOUND' }
            })
        })

        it('rejects a depleted asteroid with 409 MINING_DEPLETED', async () => {
            const { harness } = buildFireService({
                asteroidRows: [buildAsteroidRow({ remaining_quantity: 0, status_value: DEPLETED_STATUS_VALUE_ID })]
            })
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'MINING_DEPLETED' }
            })
        })

        it('rejects an out-of-range asteroid with 409 MINING_OUT_OF_RANGE', async () => {
            mockDescribeFlightContext.mockResolvedValue({
                position: { x: 500, y: 500, z: 500 },
                stations: [{ id: STATION_ROW_ID, position: { x: 72, y: 0, z: -48 } }]
            })
            const { harness } = buildFireService()
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'MINING_OUT_OF_RANGE' }
            })
        })

        it('rejects a fire without a flight session with 409 MINING_NO_FLIGHT_SESSION', async () => {
            mockDescribeFlightContext.mockResolvedValue(null)
            const { harness } = buildFireService()
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'MINING_NO_FLIGHT_SESSION' }
            })
        })

        it('rejects a fire with a full cargo before any operation (ECONOMY_CAPACITY_EXCEEDED)', async () => {
            const { harness } = buildFireService({ cargoRows: [{ NomenclatureCode: 'ORE', Quantity: 100 }] })
            await expect(harness.service.executeMiningFire(harness.ctx, APPLICATION_ID, { asteroidCode: 'AST-01' })).rejects.toMatchObject({
                statusCode: 409,
                body: { code: 'ECONOMY_CAPACITY_EXCEEDED' }
            })
        })

        it('replays the stored mine response for a scoped key hit', async () => {
            const fingerprint = fingerprintEconomyTradeBody('mine', { asteroidCode: 'AST-01' })
            const { harness } = buildFireService({
                idempotencyStored: [
                    {
                        bodyFingerprint: fingerprint,
                        response: { operationId: CREATED_OPERATION_ID, replayed: true },
                        statusCode: 200,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    }
                ]
            })
            const outcome = await harness.service.executeMiningFire(
                harness.ctx,
                APPLICATION_ID,
                { asteroidCode: 'AST-01' },
                {
                    applicationId: APPLICATION_ID,
                    userId: USER_A,
                    workspaceId: null,
                    keyHash: hashEconomyIdempotencyKey(MINE_IDEMPOTENCY_KEY),
                    fingerprint
                }
            )
            expect(outcome).toEqual({ kind: 'replayed', status: 200, body: { operationId: CREATED_OPERATION_ID, replayed: true } })
            expect(appendMovementsSpy).not.toHaveBeenCalled()
        })

        it('conflicts on key reuse with a different asteroid', async () => {
            // The controller fingerprints the ACTUAL request body, so the scope
            // carries the AST-02 fingerprint while the stored row was saved for
            // AST-01 → the gate must conflict instead of replaying.
            const { harness } = buildFireService({
                idempotencyStored: [
                    {
                        bodyFingerprint: fingerprintEconomyTradeBody('mine', { asteroidCode: 'AST-01' }),
                        response: { operationId: CREATED_OPERATION_ID },
                        statusCode: 200,
                        expiresAt: new Date(Date.now() + 60_000).toISOString()
                    }
                ]
            })
            await expect(
                harness.service.executeMiningFire(
                    harness.ctx,
                    APPLICATION_ID,
                    { asteroidCode: 'AST-02' },
                    {
                        applicationId: APPLICATION_ID,
                        userId: USER_A,
                        workspaceId: null,
                        keyHash: hashEconomyIdempotencyKey(MINE_IDEMPOTENCY_KEY),
                        fingerprint: fingerprintEconomyTradeBody('mine', { asteroidCode: 'AST-02' })
                    }
                )
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_IDEMPOTENCY_CONFLICT' } })
        })
    })
})
