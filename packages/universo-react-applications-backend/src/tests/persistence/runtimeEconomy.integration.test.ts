import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    insertApplication,
    insertApplicationMember
} from './applicationBotBindings.integrationSupport'
import { convertPgBindings } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import { quoteIdentifier } from '../../shared/runtimeHelpers'
import { ROLE_PERMISSIONS } from '../../routes/guards'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import { RuntimePostingMovementService } from '../../services/runtimePostingMovements'
import { RuntimeLedgerService } from '../../services/runtimeLedgersService'
import type { DbExecutor } from '@universo-react/utils'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { createRecordStateCommandHandlers } from '../../controllers/runtimeRowCommandHandlers/posting'
import { createRuntimeEconomyService, fingerprintEconomyTradeBody, hashEconomyIdempotencyKey } from '../../services/runtimeEconomyService'
import { resolveEconomyObjectCollection } from '../../services/runtimeEconomySupport'
import { saveEconomyIdempotency } from '../../persistence/economyIdempotencyStore'

/**
 * PostgreSQL integration for the runtime economy service (plan B8, TZ §14.2).
 *
 * Pragmatic harness level (documented deviation): the application schema is
 * created with raw DDL mirroring the runtime generator (system tables +
 * per-component physical `cmp_` columns + ledger tables), and the authored
 * `MmoommEconomyPostingModule` is simulated at the lifecycle-dispatch boundary —
 * the spy returns the exact movements the authored module emits (TZ FR-015),
 * while everything downstream (posting core, movement normalization, real
 * `appendFacts` inserts with source ids, projections, reversals) runs real SQL.
 * Module-bundle compilation is covered by the fixture contract (F5) and the E2E
 * economy journey (G2).
 */
const mockDescribeFlightContext = jest.fn<Promise<unknown>, [string, string]>()

jest.mock('../../services/runtimeFlightRoomBridge', () => ({
    __esModule: true,
    describeFlightContext: (applicationId: string, userId: string, workspaceId: string | null) =>
        mockDescribeFlightContext(applicationId, userId, workspaceId)
}))

const SCHEMA_NAME = `app_${generateUuidV7().replaceAll('-', '')}`
const SCHEMA_IDENT = quoteIdentifier(SCHEMA_NAME)

/**
 * Savepoint-based DbExecutor over a pinned knex transaction, mirroring the
 * production RLS request executor (`createRlsExecutor`): every `transaction()`
 * call opens a `SAVEPOINT eco_sp_<depth>` on the SAME connection instead of a
 * knex nested transaction. The pool-level `createKnexExecutor` cannot be used
 * for the economy service here: knex serializes sibling nested transactions
 * (`outerTx._lastChild`), so the bootstrap savepoint calling the posting core
 * (which opens a second savepoint on `ctx.manager` while the first is open)
 * deadlocks. Production avoids this because the RLS executor's `transaction()`
 * is a stacked savepoint on the pinned connection — exactly what this helper
 * reproduces (test-side only; no implementation change).
 *
 * `isTransactionBase=false` (pool knex base) treats depth 0 as a real
 * `knex.transaction` (the double-spend race uses one executor per racer).
 */
const createSavepointExecutor = (base: Knex, isTransactionBase: boolean): DbExecutor => {
    let depth = 0
    const executor: DbExecutor = {
        query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
            const { sql: knexSql, bindings } = convertPgBindings(sql, params)
            const result = await base.raw(knexSql, bindings as Knex.RawBinding[])
            return (result.rows ?? result) as T[]
        },
        transaction: async <T>(work: (tx: DbExecutor) => Promise<T>): Promise<T> => {
            if (depth === 0 && !isTransactionBase) {
                return base.transaction(async (trx) => work(createSavepointExecutor(trx, true)))
            }
            depth += 1
            const savepoint = `eco_sp_${depth}`
            await base.raw(`SAVEPOINT ${savepoint}`)
            try {
                const result = await work(executor)
                await base.raw(`RELEASE SAVEPOINT ${savepoint}`)
                depth -= 1
                return result
            } catch (error) {
                await base.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`)
                depth -= 1
                throw error
            }
        },
        isReleased: () => false
    }
    return executor
}

const NOMENCLATURE_OBJECT_ID = generateUuidV7()
const WALLET_OBJECT_ID = generateUuidV7()
const OPERATION_OBJECT_ID = generateUuidV7()
const STATION_OBJECT_ID = generateUuidV7()
const OPERATION_TYPE_ENUM_ID = generateUuidV7()
const STATUS_ENUM_ID = generateUuidV7()
const SET_ID = generateUuidV7()
const STARTER_TYPE_ID = generateUuidV7()
const SELL_TYPE_ID = generateUuidV7()
const BUY_TYPE_ID = generateUuidV7()
const ACTIVE_STATUS_ID = generateUuidV7()
const ORE_ROW_ID = generateUuidV7()
const FUEL_ROW_ID = generateUuidV7()
const STATION_ROW_ID = generateUuidV7()
const WALLET_LEDGER_ID = generateUuidV7()
const INVENTORY_LEDGER_ID = generateUuidV7()

const STARTING_BALANCE = 1000
const STARTING_ORE_KG = 10
const ORE_PRICE = 10
const FUEL_PRICE = 5
const MAX_CARGO_KG = 1000
const MARKET_RADIUS_M = 100

const SYSTEM_COLUMNS = `
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_created_by UUID NULL,
    _upl_updated_at TIMESTAMPTZ NULL DEFAULT now(),
    _upl_updated_by UUID NULL,
    _upl_version INTEGER NOT NULL DEFAULT 1,
    _upl_locked BOOLEAN NOT NULL DEFAULT false,
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted_at TIMESTAMPTZ NULL,
    _app_deleted_by UUID NULL,
    workspace_id UUID NULL
`

const LEDGER_CAPABILITIES_CONFIG = {
    capabilities: { dataSchema: { enabled: true }, physicalTable: { enabled: true }, ledgerSchema: { enabled: true } }
}

const economyBehaviorConfig = {
    recordBehavior: {
        mode: 'transactional',
        numbering: { enabled: false, scope: 'workspace', periodicity: 'none' },
        effectiveDate: { enabled: true, defaultToNow: true },
        lifecycle: { enabled: true, states: [] },
        posting: { mode: 'manual', targetLedgers: ['WalletLedger', 'InventoryLedger'] },
        immutability: 'posted'
    },
    runtimeRecordAccess: { mode: 'ownerOnly', ownerColumnName: '_upl_created_by' }
}

/** Canonical localized-codename envelope: the ledger service's SQL matcher reads ONLY this shape. */
const codenameEnvelope = (text: string): string => JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: text } } })

const insertObjectRow = async (db: Knex, id: string, kind: string, codename: string, tableName: string | null, config: unknown) => {
    await db.raw(`INSERT INTO ${SCHEMA_IDENT}._app_objects (id, kind, codename, table_name, config) VALUES (?, ?, ?::jsonb, ?, ?::jsonb)`, [
        id,
        kind,
        codenameEnvelope(codename),
        tableName,
        JSON.stringify(config)
    ])
}

const insertComponentRow = async (
    db: Knex,
    objectId: string,
    fieldCodename: string,
    columnName: string,
    dataType: string,
    options: { isRequired?: boolean; targetObjectId?: string | null; targetObjectKind?: string | null } = {}
) => {
    await db.raw(
        `
        INSERT INTO ${SCHEMA_IDENT}._app_components
            (id, object_id, codename, column_name, data_type, is_required, validation_rules, target_object_id, target_object_kind, ui_config, sort_order)
        VALUES (?, ?, ?::jsonb, ?, ?, ?, '{}'::jsonb, ?, ?, '{}'::jsonb, 0)
        `,
        [
            generateUuidV7(),
            objectId,
            codenameEnvelope(fieldCodename),
            columnName,
            dataType,
            options.isRequired ?? false,
            options.targetObjectId ?? null,
            options.targetObjectKind ?? null
        ]
    )
}

const insertEnumValue = async (db: Knex, objectId: string, valueId: string, codename: string) => {
    await db.raw(`INSERT INTO ${SCHEMA_IDENT}._app_values (id, object_id, codename) VALUES (?, ?, ?::jsonb)`, [
        valueId,
        objectId,
        codenameEnvelope(codename)
    ])
}

const insertConstantRow = async (db: Knex, codename: string, value: unknown, dataType: string) => {
    await db.raw(
        `INSERT INTO ${SCHEMA_IDENT}._app_constants (id, group_id, codename, data_type, value_json, sort_order) VALUES (?, ?, ?::jsonb, ?, ?::jsonb, 0)`,
        [generateUuidV7(), SET_ID, codenameEnvelope(codename), dataType, JSON.stringify(value)]
    )
}

const insertSeedRow = async (db: Knex, tableName: string, columns: string[], values: unknown[]) => {
    const placeholders = values.map(() => '?').join(', ')
    await db.raw(
        `INSERT INTO ${SCHEMA_IDENT}.${quoteIdentifier(tableName)} (${columns
            .map((column) => quoteIdentifier(column))
            .join(', ')}) VALUES (${placeholders})`,
        values
    )
}

const createSchemaFixture = async (db: Knex) => {
    await db.raw(`CREATE SCHEMA ${SCHEMA_IDENT}`)

    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_objects (
            id UUID PRIMARY KEY,
            kind VARCHAR(40) NOT NULL,
            codename JSONB NOT NULL,
            table_name VARCHAR(255) NULL,
            presentation JSONB NOT NULL DEFAULT '{}'::jsonb,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_components (
            id UUID PRIMARY KEY,
            object_id UUID NOT NULL,
            parent_component_id UUID NULL,
            codename JSONB NOT NULL,
            column_name VARCHAR(255) NOT NULL,
            data_type VARCHAR(40) NOT NULL,
            is_required BOOLEAN NOT NULL DEFAULT false,
            validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
            target_object_id UUID NULL,
            target_object_kind VARCHAR(40) NULL,
            ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
            sort_order INTEGER NOT NULL DEFAULT 0,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_values (
            id UUID PRIMARY KEY,
            object_id UUID NOT NULL,
            codename JSONB NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_constants (
            id UUID PRIMARY KEY,
            group_id UUID NOT NULL,
            codename JSONB NOT NULL,
            data_type VARCHAR(40) NOT NULL,
            presentation JSONB NOT NULL DEFAULT '{}'::jsonb,
            validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
            ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
            value_json JSONB NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            ${SYSTEM_COLUMNS}
        )
    `)
    // Minimal layout/widget system tables mirroring the generator's runtime-read
    // columns: the interpretation-network write guard and effective-layout reads
    // probe them during generic creates; empty tables mean "feature not ready",
    // which does not restrict plain objects.
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_layouts (
            id UUID PRIMARY KEY,
            scope_entity_id UUID NULL,
            template_key VARCHAR(100) NOT NULL DEFAULT 'dashboard',
            name JSONB NOT NULL DEFAULT '{}'::jsonb,
            description JSONB NULL,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_default BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}._app_widgets (
            id UUID PRIMARY KEY,
            layout_id UUID NOT NULL,
            zone VARCHAR(40) NULL,
            widget_key VARCHAR(120) NOT NULL,
            instance_key VARCHAR(120) NULL,
            parent_widget_id UUID NULL,
            slot_key VARCHAR(40) NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            source_config JSONB NULL,
            source_state JSONB NULL,
            source_widget_id UUID NULL,
            source_base_widget_id UUID NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            ${SYSTEM_COLUMNS}
        )
    `)

    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.obj_nomenclature (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            code TEXT NOT NULL,
            name TEXT NULL,
            unit TEXT NULL,
            mass_per_unit NUMERIC NULL,
            volume_per_unit NUMERIC NULL,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.obj_wallet (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            owner_key TEXT NOT NULL,
            currency TEXT NOT NULL,
            status_id UUID NULL,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.obj_operation (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            operation_type_id UUID NOT NULL,
            wallet_id UUID NOT NULL,
            station_id UUID NULL,
            nomenclature_id UUID NULL,
            quantity NUMERIC NOT NULL,
            unit_price NUMERIC NULL,
            total_price NUMERIC NULL,
            occurred_at TIMESTAMPTZ NULL,
            _app_record_number VARCHAR(64) NULL,
            _app_record_date TIMESTAMPTZ NULL,
            _app_record_state VARCHAR(32) NOT NULL DEFAULT 'draft',
            _app_posted_at TIMESTAMPTZ NULL,
            _app_posted_by UUID NULL,
            _app_posting_batch_id UUID NULL,
            _app_posting_movements JSONB NULL,
            _app_voided_at TIMESTAMPTZ NULL,
            _app_voided_by UUID NULL,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.obj_flight_station (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            name TEXT NULL,
            market_enabled BOOLEAN NOT NULL DEFAULT true,
            market_fee_percent NUMERIC NOT NULL DEFAULT 0,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.led_wallet (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            wallet_key TEXT NOT NULL,
            currency TEXT NOT NULL,
            operation_type TEXT NULL,
            amount NUMERIC NOT NULL,
            occurred_at TIMESTAMPTZ NULL,
            source_object_id TEXT NULL,
            source_row_id TEXT NULL,
            source_line_id TEXT NULL,
            _app_reversal_of_fact_id UUID NULL,
            ${SYSTEM_COLUMNS}
        )
    `)
    await db.raw(`
        CREATE TABLE ${SCHEMA_IDENT}.led_inventory (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            owner_key TEXT NOT NULL,
            station_code TEXT NULL,
            nomenclature_code TEXT NOT NULL,
            quantity NUMERIC NOT NULL,
            cost NUMERIC NULL,
            occurred_at TIMESTAMPTZ NULL,
            source_object_id TEXT NULL,
            source_row_id TEXT NULL,
            source_line_id TEXT NULL,
            _app_reversal_of_fact_id UUID NULL,
            ${SYSTEM_COLUMNS}
        )
    `)
}

const insertMetadata = async (db: Knex) => {
    await insertObjectRow(db, NOMENCLATURE_OBJECT_ID, 'object', 'Nomenclature', 'obj_nomenclature', null)
    await insertObjectRow(db, WALLET_OBJECT_ID, 'object', 'Wallet', 'obj_wallet', null)
    await insertObjectRow(db, OPERATION_OBJECT_ID, 'object', 'Operation', 'obj_operation', economyBehaviorConfig)
    await insertObjectRow(db, STATION_OBJECT_ID, 'object', 'FlightStation', 'obj_flight_station', null)
    await insertObjectRow(db, OPERATION_TYPE_ENUM_ID, 'enumeration', 'OperationType', null, null)
    await insertObjectRow(db, STATUS_ENUM_ID, 'enumeration', 'Status', null, null)
    await insertObjectRow(db, SET_ID, 'set', 'EconomyConstants', null, null)
    await insertObjectRow(db, WALLET_LEDGER_ID, 'ledger', 'WalletLedger', 'led_wallet', {
        ...LEDGER_CAPABILITIES_CONFIG,
        ledger: {
            sourcePolicy: 'registrar',
            registrarKinds: ['object'],
            mutationPolicy: 'appendOnly',
            fieldRoles: [
                { fieldCodename: 'WalletKey', role: 'dimension' },
                { fieldCodename: 'Currency', role: 'dimension' },
                { fieldCodename: 'OperationType', role: 'dimension' },
                { fieldCodename: 'OccurredAt', role: 'dimension' },
                { fieldCodename: 'SourceObjectId', role: 'dimension' },
                { fieldCodename: 'SourceRowId', role: 'dimension' },
                { fieldCodename: 'SourceLineId', role: 'dimension' },
                { fieldCodename: 'Amount', role: 'resource', aggregate: 'sum', required: true }
            ],
            projections: [{ codename: 'walletBalance', kind: 'balance', dimensions: ['WalletKey', 'Currency'], resources: ['Amount'] }],
            idempotency: { keyFields: ['SourceObjectId', 'SourceRowId', 'SourceLineId'] }
        }
    })
    await insertObjectRow(db, INVENTORY_LEDGER_ID, 'ledger', 'InventoryLedger', 'led_inventory', {
        ...LEDGER_CAPABILITIES_CONFIG,
        ledger: {
            sourcePolicy: 'registrar',
            registrarKinds: ['object'],
            mutationPolicy: 'appendOnly',
            fieldRoles: [
                { fieldCodename: 'OwnerKey', role: 'dimension' },
                { fieldCodename: 'StationCode', role: 'dimension' },
                { fieldCodename: 'NomenclatureCode', role: 'dimension' },
                { fieldCodename: 'OccurredAt', role: 'dimension' },
                { fieldCodename: 'SourceObjectId', role: 'dimension' },
                { fieldCodename: 'SourceRowId', role: 'dimension' },
                { fieldCodename: 'SourceLineId', role: 'dimension' },
                { fieldCodename: 'Quantity', role: 'resource', aggregate: 'sum', required: true },
                { fieldCodename: 'Cost', role: 'resource', aggregate: 'sum' }
            ],
            projections: [
                { codename: 'stockBalance', kind: 'balance', dimensions: ['OwnerKey', 'NomenclatureCode'], resources: ['Quantity', 'Cost'] }
            ],
            idempotency: { keyFields: ['SourceObjectId', 'SourceRowId', 'SourceLineId'] }
        }
    })

    const entityFields: Array<[string, Array<[string, string, string, boolean]>]> = [
        [
            NOMENCLATURE_OBJECT_ID,
            [
                ['Code', 'code', 'STRING', true],
                ['Name', 'name', 'STRING', false],
                ['Unit', 'unit', 'STRING', false],
                ['MassPerUnit', 'mass_per_unit', 'NUMBER', false]
            ]
        ],
        [
            WALLET_OBJECT_ID,
            [
                ['OwnerKey', 'owner_key', 'STRING', true],
                ['Currency', 'currency', 'STRING', true],
                ['Status', 'status_id', 'REF', false]
            ]
        ],
        [
            OPERATION_OBJECT_ID,
            [
                ['OperationType', 'operation_type_id', 'REF', true],
                ['Wallet', 'wallet_id', 'REF', true],
                ['Station', 'station_id', 'REF', false],
                ['Nomenclature', 'nomenclature_id', 'REF', false],
                ['Quantity', 'quantity', 'NUMBER', true],
                ['UnitPrice', 'unit_price', 'NUMBER', false],
                ['TotalPrice', 'total_price', 'NUMBER', false],
                ['OccurredAt', 'occurred_at', 'DATE', false]
            ]
        ],
        [
            STATION_OBJECT_ID,
            [
                ['Name', 'name', 'STRING', false],
                ['MarketEnabled', 'market_enabled', 'BOOLEAN', false]
            ]
        ]
    ]
    for (const [objectId, fields] of entityFields) {
        for (const [fieldCodename, columnName, dataType, isRequired] of fields) {
            await insertComponentRow(db, objectId, fieldCodename, columnName, dataType, { isRequired })
        }
    }
    await db.raw(
        `UPDATE ${SCHEMA_IDENT}._app_components SET target_object_id = ?, target_object_kind = 'enumeration' WHERE object_id = ? AND column_name = 'operation_type_id'`,
        [OPERATION_TYPE_ENUM_ID, OPERATION_OBJECT_ID]
    )
    await db.raw(
        `UPDATE ${SCHEMA_IDENT}._app_components SET target_object_id = ?, target_object_kind = 'object' WHERE object_id = ? AND column_name = 'wallet_id'`,
        [WALLET_OBJECT_ID, OPERATION_OBJECT_ID]
    )
    await db.raw(
        `UPDATE ${SCHEMA_IDENT}._app_components SET target_object_id = ?, target_object_kind = 'object' WHERE object_id = ? AND column_name = 'station_id'`,
        [STATION_OBJECT_ID, OPERATION_OBJECT_ID]
    )
    await db.raw(
        `UPDATE ${SCHEMA_IDENT}._app_components SET target_object_id = ?, target_object_kind = 'object' WHERE object_id = ? AND column_name = 'nomenclature_id'`,
        [NOMENCLATURE_OBJECT_ID, OPERATION_OBJECT_ID]
    )
    await db.raw(
        `UPDATE ${SCHEMA_IDENT}._app_components SET target_object_id = ?, target_object_kind = 'enumeration' WHERE object_id = ? AND column_name = 'status_id'`,
        [STATUS_ENUM_ID, WALLET_OBJECT_ID]
    )

    const ledgerFields: Array<[string, Array<[string, string]>, Array<[string, string]>]> = [
        [
            WALLET_LEDGER_ID,
            [
                ['WalletKey', 'wallet_key'],
                ['Currency', 'currency'],
                ['OperationType', 'operation_type'],
                ['SourceObjectId', 'source_object_id'],
                ['SourceRowId', 'source_row_id'],
                ['SourceLineId', 'source_line_id']
            ],
            [['Amount', 'amount']]
        ],
        [
            INVENTORY_LEDGER_ID,
            [
                ['OwnerKey', 'owner_key'],
                ['StationCode', 'station_code'],
                ['NomenclatureCode', 'nomenclature_code'],
                ['SourceObjectId', 'source_object_id'],
                ['SourceRowId', 'source_row_id'],
                ['SourceLineId', 'source_line_id']
            ],
            [
                ['Quantity', 'quantity'],
                ['Cost', 'cost']
            ]
        ]
    ]
    for (const [objectId, stringFields, numberFields] of ledgerFields) {
        for (const [fieldCodename, columnName] of stringFields) {
            await insertComponentRow(db, objectId, fieldCodename, columnName, 'STRING')
        }
        // OccurredAt mirrors the generator: DATE component over a TIMESTAMPTZ
        // column (the reversal path normalizes read-back Date values).
        await insertComponentRow(db, objectId, 'OccurredAt', 'occurred_at', 'DATE')
        for (const [fieldCodename, columnName] of numberFields) {
            await insertComponentRow(db, objectId, fieldCodename, columnName, 'NUMBER', {
                isRequired: fieldCodename === 'Amount' || fieldCodename === 'Quantity'
            })
        }
    }

    await insertEnumValue(db, OPERATION_TYPE_ENUM_ID, STARTER_TYPE_ID, 'StarterGrant')
    await insertEnumValue(db, OPERATION_TYPE_ENUM_ID, SELL_TYPE_ID, 'Sell')
    await insertEnumValue(db, OPERATION_TYPE_ENUM_ID, BUY_TYPE_ID, 'Buy')
    await insertEnumValue(db, STATUS_ENUM_ID, ACTIVE_STATUS_ID, 'Active')

    await insertConstantRow(db, 'CurrencyCode', 'CR', 'string')
    await insertConstantRow(db, 'StartingBalance', STARTING_BALANCE, 'number')
    await insertConstantRow(db, 'StartingOreKg', STARTING_ORE_KG, 'number')
    await insertConstantRow(db, 'OrePricePerKg', ORE_PRICE, 'number')
    await insertConstantRow(db, 'FuelPricePerLiter', FUEL_PRICE, 'number')
    await insertConstantRow(db, 'MaxCargoMassKg', MAX_CARGO_KG, 'number')
    await insertConstantRow(db, 'MarketRadiusMeters', MARKET_RADIUS_M, 'number')

    await insertSeedRow(db, 'obj_nomenclature', ['id', 'code', 'name', 'unit', 'mass_per_unit'], [ORE_ROW_ID, 'ORE', 'Ore', 'Kg', 1])
    await insertSeedRow(
        db,
        'obj_nomenclature',
        ['id', 'code', 'name', 'unit', 'mass_per_unit'],
        [FUEL_ROW_ID, 'FUEL', 'Fuel', 'Liter', 0.8]
    )
    await insertSeedRow(db, 'obj_flight_station', ['id', 'name', 'market_enabled'], [STATION_ROW_ID, 'Hub station', true])
}

/**
 * The authored MmoommEconomyPostingModule.beforePost behavior (TZ FR-015),
 * simulated at the lifecycle-dispatch boundary: StarterGrant +50 CR-equivalent
 * (StartingBalance) & +StartingOreKg ORE; Sell +Quantity×OrePrice & −Quantity;
 * Buy −Quantity×FuelPrice & +Quantity, each fact carrying operation source ids.
 */
const buildEconomyPostingMovements = (userId: string, previousRow: Record<string, unknown>): unknown[] => {
    // Mirrors the authored module's kind detection (unitPrice === 0 marks the
    // StarterGrant) instead of trusting the operation type REF directly.
    const quantity = Number(previousRow.quantity ?? 0)
    const type =
        Number(previousRow.unit_price ?? -1) === 0 ? 'StarterGrant' : previousRow.operation_type_id === SELL_TYPE_ID ? 'Sell' : 'Buy'
    const rowId = String(previousRow.id)
    const occurredAt =
        previousRow.occurred_at instanceof Date ? previousRow.occurred_at.toISOString() : String(previousRow.occurred_at ?? '')
    const sourceIds = {
        SourceObjectId: OPERATION_OBJECT_ID,
        SourceRowId: rowId
    }

    // Mirrors the authored posting module: amounts derive from the
    // server-stamped TotalPrice magnitude (positive), not baked price literals.
    const totalPrice = Number(
        previousRow.total_price ?? (type === 'StarterGrant' ? STARTING_BALANCE : quantity * Number(previousRow.unit_price ?? 0))
    )
    const walletAmount = type === 'Buy' ? -totalPrice : totalPrice
    const walletMovement = {
        ledgerCodename: 'WalletLedger',
        facts: [
            {
                data: {
                    WalletKey: userId,
                    Currency: 'CR',
                    OperationType: type,
                    Amount: walletAmount,
                    OccurredAt: occurredAt,
                    ...sourceIds,
                    SourceLineId: `${rowId}:wallet:1`
                }
            }
        ]
    }
    const inventoryMovement = {
        ledgerCodename: 'InventoryLedger',
        facts: [
            {
                data: {
                    OwnerKey: userId,
                    StationCode: 'STN-1',
                    NomenclatureCode: type === 'Buy' ? 'FUEL' : 'ORE',
                    Quantity: type === 'Sell' ? -quantity : quantity,
                    Cost: type === 'StarterGrant' ? 0 : totalPrice,
                    OccurredAt: occurredAt,
                    ...sourceIds,
                    SourceLineId: `${rowId}:inventory:1`
                }
            }
        ]
    }
    // The lifecycle-dispatch result shape: one entry per module result, each
    // carrying its `movements` (the shape `normalizeMovementResults` consumes,
    // identical to the route-contract suite's beforePost stubs).
    return [{ movements: [walletMovement, inventoryMovement] }]
}

let postingModuleOverride: ((previousRow: Record<string, unknown>) => unknown[] | null) | null = null
let postingActorUserId: string | null = null

type QueryExecutor = { query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]> }

describeIntegration('Runtime economy service PostgreSQL integration', () => {
    let knex: Knex
    let dispatchSpy: jest.Spied<typeof RuntimeModulesService.prototype.dispatchLifecycleEvent>

    // The trade/bootstrap flows each run dozens of statements plus lock waits in
    // the double-spend race; the jest default of 5s is not enough (concurrency
    // suite precedent).
    jest.setTimeout(30_000)

    const buildCtx = (executor: DbExecutor, userId: string): RuntimeSchemaContext => ({
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

    const buildService = (executor: DbExecutor, userId: string) => {
        postingActorUserId = userId
        return createRuntimeEconomyService({
            getDbExecutor: () => executor,
            query: async (_req, sql, parameters) => executor.query(sql, parameters)
        })
    }

    const dockAtStation = () =>
        mockDescribeFlightContext.mockResolvedValue({
            position: { x: 0, y: 0, z: 0 },
            stations: [{ id: STATION_ROW_ID, position: { x: 1, y: 0, z: 0 } }]
        })

    const countRows = async (executor: QueryExecutor, sql: string, params?: unknown[]) => {
        const rows = await executor.query<{ count: number }>(sql, params)
        return Number(rows[0]?.count)
    }

    /** Per-test fixture: an application bound to the schema plus its member user. */
    const setupApplicationUser = async (trx: Knex) => {
        const applicationId = await insertApplication(trx)
        await trx.raw(`UPDATE applications.obj_applications SET schema_name = ? WHERE id = ?`, [SCHEMA_NAME, applicationId])
        const userId = generateUuidV7()
        await insertApplicationMember(trx, applicationId, userId)
        return { applicationId, userId }
    }

    const queryProjection = (
        executor: DbExecutor,
        ledgerId: string,
        projectionCodename: string,
        filters: Record<string, unknown>,
        readScope?: { userId: string | null; allowCrossUserRead?: boolean }
    ) =>
        new RuntimeLedgerService().queryProjection({
            executor,
            schemaName: SCHEMA_NAME,
            ledgerId,
            currentWorkspaceId: null,
            projectionCodename,
            readScope: readScope ?? { userId: null, allowCrossUserRead: true },
            filters
        })

    beforeAll(async () => {
        knex = await createIntegrationKnex()
        await createSchemaFixture(knex)
        await insertMetadata(knex)

        dispatchSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockImplementation(async (params) => {
            if (params.payload.eventName !== 'beforePost' || params.attachmentId !== OPERATION_OBJECT_ID) return []
            const previousRow = (params.payload as { previousRow?: Record<string, unknown> }).previousRow
            if (!previousRow?.id || !postingActorUserId) return []
            const overridden = postingModuleOverride?.(previousRow)
            if (overridden) return overridden
            return buildEconomyPostingMovements(postingActorUserId, previousRow)
        })
    })

    beforeEach(() => {
        postingModuleOverride = null
        postingActorUserId = null
        dockAtStation()
    })

    afterAll(async () => {
        dispatchSpy?.mockRestore()
        try {
            await knex?.raw(`DROP SCHEMA IF EXISTS ${SCHEMA_IDENT} CASCADE`)
        } finally {
            await knex?.destroy()
        }
    })

    it('posts a full sell trade: wallet, once-only grant, ledger facts with source ids and projections', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const service = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            // D11: the first summary bootstraps the wallet + once-only StarterGrant.
            const { summary: firstSummary } = await service.getEconomySummary(ctx, applicationId)
            expect(firstSummary.wallet).toEqual({ currency: 'CR', balance: STARTING_BALANCE })
            expect(firstSummary.cargo).toEqual([
                { nomenclatureCode: 'ORE', nomenclatureName: 'Ore', quantity: STARTING_ORE_KG, unit: 'Kg', massKg: STARTING_ORE_KG }
            ])
            expect(firstSummary.atStation).toBe(true)
            expect(firstSummary.stationName).toBe('Hub station')

            const grantRows = await executor.query<{ id: string; _app_record_state: string }>(
                `SELECT id, _app_record_state FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1`,
                [userId]
            )
            expect(grantRows).toHaveLength(1)
            expect(grantRows[0]).toMatchObject({ _app_record_state: 'posted' })

            const walletRows = await executor.query<{ id: string; owner_key: string; currency: string; _upl_created_by: string }>(
                `SELECT id, owner_key, currency, _upl_created_by FROM ${SCHEMA_IDENT}.obj_wallet WHERE owner_key = $1`,
                [userId]
            )
            expect(walletRows).toHaveLength(1)
            expect(walletRows[0]).toMatchObject({ owner_key: userId, currency: 'CR', _upl_created_by: userId })

            // Second summary: once-only — no additional Operation row.
            await service.getEconomySummary(ctx, applicationId)
            expect(
                await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1`, [
                    userId
                ])
            ).toBe(1)

            // Sell 5 ORE at 10 CR/kg → 1050 CR / 5 kg (TZ §6.1).
            const outcome = await service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 5 })
            expect(outcome.kind).toBe('executed')
            if (outcome.kind !== 'executed') return
            expect(outcome.body.walletBalance).toBe(STARTING_BALANCE + 5 * ORE_PRICE)
            expect(outcome.body.cargo).toEqual([{ nomenclatureCode: 'ORE', nomenclatureName: 'Ore', quantity: 5, unit: 'Kg', massKg: 5 }])

            const operationRow = (
                await executor.query<{ id: string; quantity: string; _app_posting_movements: unknown }>(
                    `SELECT id, quantity, _app_posting_movements FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1 AND _app_record_state = 'posted' AND unit_price = $2`,
                    [userId, ORE_PRICE]
                )
            )[0]
            expect(operationRow).toBeDefined()
            expect(Number(operationRow.quantity)).toBe(5)
            expect(operationRow._app_posting_movements).not.toBeNull()

            // Ledger facts exist in the register tables with the operation source ids.
            const walletFacts = await executor.query<{ amount: string; source_row_id: string }>(
                `SELECT amount, source_row_id FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 ORDER BY amount ASC`,
                [userId]
            )
            expect(walletFacts.map((row) => Number(row.amount))).toEqual([5 * ORE_PRICE, STARTING_BALANCE])
            expect(walletFacts.every((row) => typeof row.source_row_id === 'string' && row.source_row_id.length > 0)).toBe(true)

            const inventoryFacts = await executor.query<{ quantity: string }>(
                `SELECT quantity FROM ${SCHEMA_IDENT}.led_inventory WHERE owner_key = $1 ORDER BY quantity ASC`,
                [userId]
            )
            expect(inventoryFacts.map((row) => Number(row.quantity))).toEqual([-5, STARTING_ORE_KG])

            // Projections read the same facts through the generic ledger machinery.
            const walletProjection = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', {
                WalletKey: userId,
                Currency: 'CR'
            })
            expect(Number(walletProjection.rows[0]?.Amount)).toBe(STARTING_BALANCE + 5 * ORE_PRICE)
            const stockProjection = await queryProjection(executor, INVENTORY_LEDGER_ID, 'stockBalance', { OwnerKey: userId })
            expect(stockProjection.rows.map((row) => `${row.NomenclatureCode}:${Number(row.Quantity)}`)).toEqual(['ORE:5'])
        })
    })

    it('rolls back the entire trade when a ledger movement append fails between ledgers (FR-014)', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const service = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await service.getEconomySummary(ctx, applicationId)
            const walletFactsBefore = await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_wallet`)
            const inventoryFactsBefore = await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_inventory`)
            const operationsBefore = await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation`)

            // The second movement (InventoryLedger) carries an unknown field → the
            // append fails AFTER the WalletLedger movement was appended inside the tx.
            postingModuleOverride = (previousRow) => {
                const [walletResult] = buildEconomyPostingMovements(userId, previousRow) as Array<{ movements: unknown[] }>
                return [
                    { movements: [walletResult.movements[0]] },
                    {
                        movements: [
                            {
                                ledgerCodename: 'InventoryLedger',
                                facts: [{ data: { OwnerKey: userId, NomenclatureCode: 'ORE', Quantity: -1, BogusField: true } }]
                            }
                        ]
                    }
                ]
            }

            await expect(service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 1 })).rejects.toMatchObject({
                // The posting movement service maps ledger append validation
                // failures (unknown field) to the stable POSTING_MOVEMENT_INVALID code.
                body: { code: 'POSTING_MOVEMENT_INVALID' }
            })

            // Nothing persisted: the failed trade left no operation and no extra facts.
            expect(await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_wallet`)).toBe(walletFactsBefore)
            expect(await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_inventory`)).toBe(inventoryFactsBefore)
            expect(await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation`)).toBe(operationsBefore)
            expect(
                await countRows(
                    executor,
                    `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _app_record_state = 'posted' AND unit_price = $1`,
                    [ORE_PRICE]
                )
            ).toBe(0)
        })
    })

    it('unpost appends compensating facts, reverts projections and fails closed when repeated', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const economyService = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await economyService.getEconomySummary(ctx, applicationId)
            const trade = await economyService.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 5 })
            if (trade.kind !== 'executed') throw new Error('expected an executed trade')
            const operationRowId = trade.body.operationId

            const operationCollection = await resolveEconomyObjectCollection(executor, SCHEMA_IDENT, 'Operation')
            const { runRecordStateCommandCore } = createRecordStateCommandHandlers({
                getDbExecutor: () => executor,
                query: async (_req, sql, parameters) => executor.query(sql, parameters),
                recordCommandService: new RuntimeRecordCommandService(),
                postingMovementService: new RuntimePostingMovementService()
            })

            const unpost = await runRecordStateCommandCore({
                ctx,
                applicationId,
                objectCollection: operationCollection,
                attrs: operationCollection.attrs,
                rowId: operationRowId,
                command: 'unpost'
            })
            expect(unpost.responsePayload).toMatchObject({ id: operationRowId, status: 'unposted' })

            // Compensating facts: wallet carries grant + sale + reversal; inventory
            // carries grant + sale + reversal (the grant was posted separately).
            const walletFacts = await executor.query<{ amount: string }>(
                `SELECT amount FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 ORDER BY amount ASC`,
                [userId]
            )
            expect(walletFacts.map((row) => Number(row.amount))).toEqual([-5 * ORE_PRICE, 5 * ORE_PRICE, STARTING_BALANCE])
            const inventoryFacts = await executor.query<{ quantity: string }>(
                `SELECT quantity FROM ${SCHEMA_IDENT}.led_inventory WHERE owner_key = $1 ORDER BY quantity ASC`,
                [userId]
            )
            expect(inventoryFacts.map((row) => Number(row.quantity))).toEqual([-5, 5, STARTING_ORE_KG])

            // Projections revert exactly.
            const walletProjection = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', {
                WalletKey: userId,
                Currency: 'CR'
            })
            expect(Number(walletProjection.rows[0]?.Amount)).toBe(STARTING_BALANCE)
            const stockProjection = await queryProjection(executor, INVENTORY_LEDGER_ID, 'stockBalance', { OwnerKey: userId })
            expect(stockProjection.rows.map((row) => `${row.NomenclatureCode}:${Number(row.Quantity)}`)).toEqual([`ORE:${STARTING_ORE_KG}`])

            const unpostedRow = (
                await executor.query<{ _app_record_state: string }>(
                    `SELECT _app_record_state FROM ${SCHEMA_IDENT}.obj_operation WHERE id = $1`,
                    [operationRowId]
                )
            )[0]
            expect(unpostedRow._app_record_state).toBe('draft')

            // Repeated unpost fails closed (409 RECORD_NOT_POSTED).
            await expect(
                runRecordStateCommandCore({
                    ctx,
                    applicationId,
                    objectCollection: operationCollection,
                    attrs: operationCollection.attrs,
                    rowId: operationRowId,
                    command: 'unpost'
                })
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'RECORD_NOT_POSTED' } })
        })
    })

    it('re-post after unpost re-emits fresh facts with the posted net effect instead of deduping to zero', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const economyService = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await economyService.getEconomySummary(ctx, applicationId)
            const trade = await economyService.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 5 })
            if (trade.kind !== 'executed') throw new Error('expected an executed trade')
            const operationRowId = trade.body.operationId

            const operationCollection = await resolveEconomyObjectCollection(executor, SCHEMA_IDENT, 'Operation')
            const { runRecordStateCommandCore } = createRecordStateCommandHandlers({
                getDbExecutor: () => executor,
                query: async (_req, sql, parameters) => executor.query(sql, parameters),
                recordCommandService: new RuntimeRecordCommandService(),
                postingMovementService: new RuntimePostingMovementService()
            })

            const runCommand = (command: 'post' | 'unpost') =>
                runRecordStateCommandCore({
                    ctx,
                    applicationId,
                    objectCollection: operationCollection,
                    attrs: operationCollection.attrs,
                    rowId: operationRowId,
                    command
                })

            // The original sale fact carries the clean business key that the fresh
            // fact must re-emit after the unpost/re-post cycle.
            const saleFactsBefore = await executor.query<{ id: string; source_line_id: string | null; amount: string }>(
                `SELECT id, source_line_id, amount FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 AND amount = $2`,
                [userId, 5 * ORE_PRICE]
            )
            expect(saleFactsBefore).toHaveLength(1)
            const originalFact = saleFactsBefore[0]

            await runCommand('unpost')
            const repost = await runCommand('post')
            expect(repost.responsePayload).toMatchObject({ id: operationRowId, status: 'posted' })

            // Active wallet facts: grant + exactly ONE sale credit — the reversed
            // pair (original + compensating) was superseded, not replayed to zero.
            const activeWalletFacts = await executor.query<{ amount: string }>(
                `SELECT amount FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 AND _upl_deleted = false ORDER BY amount ASC`,
                [userId]
            )
            expect(activeWalletFacts.map((row) => Number(row.amount))).toEqual([5 * ORE_PRICE, STARTING_BALANCE])
            const totalWalletFacts = await countRows(
                executor,
                `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1`,
                [userId]
            )
            expect(totalWalletFacts).toBe(4)
            const deletedWalletFacts = await countRows(
                executor,
                `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 AND _upl_deleted = true`,
                [userId]
            )
            expect(deletedWalletFacts).toBe(2)

            // The fresh fact keeps the clean business key of the original posting.
            const freshFact = (
                await executor.query<{ id: string; source_line_id: string | null }>(
                    `SELECT id, source_line_id FROM ${SCHEMA_IDENT}.led_wallet
                     WHERE wallet_key = $1 AND amount = $2 AND _upl_deleted = false AND id <> $3`,
                    [userId, 5 * ORE_PRICE, originalFact.id]
                )
            )[0]
            expect(freshFact.source_line_id).toBe(originalFact.source_line_id)

            // Projections show the posted net effect once.
            const walletProjection = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', {
                WalletKey: userId,
                Currency: 'CR'
            })
            expect(Number(walletProjection.rows[0]?.Amount)).toBe(STARTING_BALANCE + 5 * ORE_PRICE)
            const stockProjection = await queryProjection(executor, INVENTORY_LEDGER_ID, 'stockBalance', { OwnerKey: userId })
            expect(stockProjection.rows.map((row) => `${row.NomenclatureCode}:${Number(row.Quantity)}`)).toEqual([
                `ORE:${STARTING_ORE_KG - 5}`
            ])

            // FR-016 stays intact at the state machine level: posting an already
            // posted row is rejected instead of duplicating facts.
            await expect(runCommand('post')).rejects.toMatchObject({ statusCode: 409, body: { code: 'RECORD_ALREADY_POSTED' } })
            const activeWalletFactsAfter = await countRows(
                executor,
                `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1 AND _upl_deleted = false`,
                [userId]
            )
            expect(activeWalletFactsAfter).toBe(2)
        })
    })

    it('never re-issues the starter grant when the grant Operation or Wallet row is soft-deleted', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const service = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await service.getEconomySummary(ctx, applicationId)
            const grantsBefore = await countRows(
                executor,
                `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1`,
                [userId]
            )
            expect(grantsBefore).toBe(1)

            // A deleteContent holder removes BOTH the grant Operation and the
            // Wallet row — the once-only check must still see the grant.
            await executor.query(
                `UPDATE ${SCHEMA_IDENT}.obj_operation SET _upl_deleted = true, _app_deleted = true WHERE _upl_created_by = $1`,
                [userId]
            )
            await executor.query(`UPDATE ${SCHEMA_IDENT}.obj_wallet SET _upl_deleted = true, _app_deleted = true WHERE owner_key = $1`, [
                userId
            ])

            await service.getEconomySummary(ctx, applicationId)

            const grantsAfter = await countRows(
                executor,
                `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1`,
                [userId]
            )
            expect(grantsAfter).toBe(1)
        })
    })

    it('rejects invalid trade payloads with stable error codes against the real schema', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const service = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await service.getEconomySummary(ctx, applicationId)
            const countStore = async () =>
                (
                    await executor.query<{ operations: number; wallet_facts: number; inventory_facts: number }>(
                        `SELECT (SELECT COUNT(*) FROM ${SCHEMA_IDENT}.obj_operation) AS operations,
                                (SELECT COUNT(*) FROM ${SCHEMA_IDENT}.led_wallet) AS wallet_facts,
                                (SELECT COUNT(*) FROM ${SCHEMA_IDENT}.led_inventory) AS inventory_facts`
                    )
                )[0]

            const stateBefore = await countStore()

            await expect(service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 0 })).rejects.toMatchObject({
                statusCode: 422,
                body: { code: 'ECONOMY_INVALID_QUANTITY' }
            })
            await expect(service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: -3 })).rejects.toMatchObject(
                { statusCode: 422, body: { code: 'ECONOMY_INVALID_QUANTITY' } }
            )
            await expect(service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'NOPE', quantity: 1 })).rejects.toMatchObject(
                { statusCode: 404, body: { code: 'ECONOMY_UNKNOWN_NOMENCLATURE' } }
            )
            // The market side mismatch (FUEL has no sell side) fails closed too.
            await expect(service.executeTrade(ctx, applicationId, 'sell', { nomenclatureCode: 'FUEL', quantity: 1 })).rejects.toMatchObject(
                { statusCode: 409, body: { code: 'ECONOMY_MARKET_DISABLED' } }
            )

            expect(await countStore()).toEqual(stateBefore)
        })
    })

    it('isolates users: ownerOnly reads and owner-scoped projections never cross users', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            await trx.raw(`UPDATE applications.obj_applications SET schema_name = ? WHERE id = ?`, [SCHEMA_NAME, applicationId])
            const userA = generateUuidV7()
            const userB = generateUuidV7()
            await insertApplicationMember(trx, applicationId, userA)
            await insertApplicationMember(trx, applicationId, userB)
            const executor = createSavepointExecutor(trx, true)

            const serviceA = buildService(executor, userA)
            const ctxA = buildCtx(executor, userA)
            await serviceA.getEconomySummary(ctxA, applicationId)
            await serviceA.executeTrade(ctxA, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 5 })

            const serviceB = buildService(executor, userB)
            const ctxB = buildCtx(executor, userB)
            const { summary } = await serviceB.getEconomySummary(ctxB, applicationId)

            // User B sees only their own grant: balance/cargo never leak from user A.
            expect(summary.wallet.balance).toBe(STARTING_BALANCE)
            expect(summary.cargo.map((entry) => `${entry.nomenclatureCode}:${entry.quantity}`)).toEqual([`ORE:${STARTING_ORE_KG}`])
            expect(summary.operations.every((operation) => operation.type !== 'Sell')).toBe(true)

            expect(
                await countRows(
                    executor,
                    `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1 AND unit_price = $2`,
                    [userA, ORE_PRICE]
                )
            ).toBe(1)
            expect(
                await countRows(
                    executor,
                    `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = $1 AND unit_price = $2`,
                    [userB, ORE_PRICE]
                )
            ).toBe(0)

            // Wallet ensure for B created a distinct wallet row.
            const wallets = await executor.query<{ owner_key: string }>(
                `SELECT owner_key FROM ${SCHEMA_IDENT}.obj_wallet ORDER BY owner_key ASC`
            )
            expect(wallets.map((row) => row.owner_key).sort()).toEqual([userA, userB].sort())
        })
    })

    it('scopes generic ledger reads to the requesting user (Phase H readScope)', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            await trx.raw(`UPDATE applications.obj_applications SET schema_name = ? WHERE id = ?`, [SCHEMA_NAME, applicationId])
            const userA = generateUuidV7()
            const userB = generateUuidV7()
            await insertApplicationMember(trx, applicationId, userA)
            await insertApplicationMember(trx, applicationId, userB)
            const executor = createSavepointExecutor(trx, true)

            const serviceA = buildService(executor, userA)
            const ctxA = buildCtx(executor, userA)
            await serviceA.getEconomySummary(ctxA, applicationId)
            await serviceA.executeTrade(ctxA, applicationId, 'sell', { nomenclatureCode: 'ORE', quantity: 5 })

            // Undeclared ledger: fail-closed creator-scoped fallback. User B sees
            // none of A's facts; A sees exactly their own balance.
            const bOwnView = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', { Currency: 'CR' }, { userId: userB })
            expect(bOwnView.rows).toEqual([])

            const aOwnView = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', { Currency: 'CR' }, { userId: userA })
            expect(Number(aOwnView.rows[0]?.Amount)).toBe(STARTING_BALANCE + 5 * ORE_PRICE)

            // readReports holders (application admins/owners) keep full visibility.
            const adminView = await queryProjection(
                executor,
                WALLET_LEDGER_ID,
                'walletBalance',
                {},
                { userId: userB, allowCrossUserRead: true }
            )
            expect(adminView.rows.length).toBeGreaterThan(0)

            // Declared ownerOnly record access: the owner column is forced
            // server-side and client filters may not reference it.
            await executor.query(
                `UPDATE ${SCHEMA_IDENT}._app_objects
                 SET config = jsonb_set(config, '{runtimeRecordAccess}', '{"mode":"ownerOnly","ownerFieldCodename":"WalletKey"}'::jsonb)
                 WHERE id = $1`,
                [WALLET_LEDGER_ID]
            )

            const bOwnerView = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', { Currency: 'CR' }, { userId: userB })
            expect(bOwnerView.rows).toEqual([])

            await expect(
                queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', { WalletKey: userA, Currency: 'CR' }, { userId: userB })
            ).rejects.toMatchObject({ statusCode: 400, body: { code: 'LEDGER_FILTER_OWNER_FIELD' } })

            const aOwnerView = await queryProjection(executor, WALLET_LEDGER_ID, 'walletBalance', { Currency: 'CR' }, { userId: userA })
            expect(Number(aOwnerView.rows[0]?.Amount)).toBe(STARTING_BALANCE + 5 * ORE_PRICE)
        })
    })

    it('rejects direct manual writes to the registrar-only economy ledgers', async () => {
        await withRollback(knex, async (trx) => {
            await insertApplication(trx)
            const executor = createSavepointExecutor(trx, true)
            await expect(
                new RuntimeLedgerService().appendFacts({
                    executor,
                    schemaName: SCHEMA_NAME,
                    ledgerCodename: 'WalletLedger',
                    currentWorkspaceId: null,
                    currentUserId: generateUuidV7(),
                    facts: [{ data: { WalletKey: generateUuidV7(), Currency: 'CR', Amount: 999 } }],
                    writeOrigin: 'manual'
                })
            ).rejects.toMatchObject({ body: { code: 'LEDGER_REGISTRAR_ONLY' } })
        })
    })

    it('replays stored trade responses and conflicts on fingerprint mismatch through the service gate', async () => {
        await withRollback(knex, async (trx) => {
            const { applicationId, userId } = await setupApplicationUser(trx)
            const executor = createSavepointExecutor(trx, true)
            const service = buildService(executor, userId)
            const ctx = buildCtx(executor, userId)

            await service.getEconomySummary(ctx, applicationId)

            const tradeBody = { nomenclatureCode: 'ORE', quantity: 2 }
            const keyHash = hashEconomyIdempotencyKey(generateUuidV7())
            await saveEconomyIdempotency(executor, {
                applicationId,
                userId,
                workspaceId: null,
                keyHash,
                bodyFingerprint: fingerprintEconomyTradeBody('sell', tradeBody),
                response: { operationId: generateUuidV7(), walletBalance: STARTING_BALANCE, cargo: [] },
                statusCode: 200,
                expiresAt: new Date(Date.now() + 60_000).toISOString()
            })

            const operationsBefore = await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation`)

            const replay = await service.executeTrade(ctx, applicationId, 'sell', tradeBody, {
                applicationId,
                userId,
                workspaceId: null,
                keyHash,
                fingerprint: fingerprintEconomyTradeBody('sell', tradeBody)
            })
            expect(replay.kind).toBe('replayed')
            expect(await countRows(executor, `SELECT COUNT(*)::int AS count FROM ${SCHEMA_IDENT}.obj_operation`)).toBe(operationsBefore)

            await expect(
                service.executeTrade(
                    ctx,
                    applicationId,
                    'sell',
                    { nomenclatureCode: 'ORE', quantity: 3 },
                    {
                        applicationId,
                        userId,
                        workspaceId: null,
                        keyHash,
                        fingerprint: fingerprintEconomyTradeBody('sell', { nomenclatureCode: 'ORE', quantity: 3 })
                    }
                )
            ).rejects.toMatchObject({ statusCode: 409, body: { code: 'ECONOMY_IDEMPOTENCY_CONFLICT' } })
        })
    })

    it('serializes concurrent same-user spends through the advisory lock; exactly one buy succeeds', async () => {
        // Concurrency cannot share the outer rollback transaction, so this test
        // commits its own fixture and cleans every row up in the finally block.
        const applicationId = await insertApplication(knex)
        const userId = generateUuidV7()
        try {
            await knex.raw(`UPDATE applications.obj_applications SET schema_name = ? WHERE id = ?`, [SCHEMA_NAME, applicationId])
            await insertApplicationMember(knex, applicationId, userId)

            const bootstrapExecutor = createSavepointExecutor(knex, false)
            const committed = await knex.transaction(async (trx) => {
                const service = buildService(createSavepointExecutor(trx, true), userId)
                return service.getEconomySummary(buildCtx(createSavepointExecutor(trx, true), userId), applicationId)
            })
            expect(committed.summary.wallet.balance).toBe(STARTING_BALANCE)

            // Two concurrent 200 L FUEL buys cost 1000 CR each — only one can succeed.
            // Each racer pins ONE real transaction and runs the trade on the
            // savepoint executor over it (mirroring the request-scoped executor):
            // the per-(user, currency) advisory lock serializes the balance reads.
            const runBuy = () =>
                knex.transaction(async (trx) => {
                    const executor = createSavepointExecutor(trx, true)
                    const raceService = createRuntimeEconomyService({
                        getDbExecutor: () => executor,
                        query: async (_req, sql, parameters) => executor.query(sql, parameters)
                    })
                    return raceService.executeTrade(buildCtx(executor, userId), applicationId, 'buy', {
                        nomenclatureCode: 'FUEL',
                        quantity: 200
                    })
                })
            const results = await Promise.allSettled([runBuy(), runBuy()])

            const outcomes = results.map((result) => (result.status === 'fulfilled' ? result.value : result.reason))
            const executed = outcomes.filter((outcome) => outcome?.kind === 'executed')
            const rejected = outcomes.filter((outcome) => outcome?.body?.code === 'ECONOMY_INSUFFICIENT_FUNDS')
            expect(executed).toHaveLength(1)
            expect(rejected).toHaveLength(1)
            expect((executed[0] as { body: { walletBalance: number } }).body.walletBalance).toBe(0)

            const balanceRows = await bootstrapExecutor.query<{ total: string }>(
                `SELECT COALESCE(SUM(amount), 0)::text AS total FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = $1`,
                [userId]
            )
            expect(Number(balanceRows[0]?.total)).toBe(0)
        } finally {
            postingActorUserId = null
            await knex.raw(`DELETE FROM ${SCHEMA_IDENT}.led_wallet WHERE wallet_key = ?`, [userId])
            await knex.raw(`DELETE FROM ${SCHEMA_IDENT}.led_inventory WHERE owner_key = ?`, [userId])
            await knex.raw(`DELETE FROM ${SCHEMA_IDENT}.obj_operation WHERE _upl_created_by = ?`, [userId])
            await knex.raw(`DELETE FROM ${SCHEMA_IDENT}.obj_wallet WHERE owner_key = ?`, [userId])
            await knex.raw(`DELETE FROM applications.obj_economy_idempotency WHERE user_id = ?`, [userId])
            await knex.raw(`DELETE FROM applications.rel_application_users WHERE user_id = ?`, [userId])
            await knex.raw(`DELETE FROM auth.users WHERE id = ?`, [userId])
            await knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])
        }
    })
})
