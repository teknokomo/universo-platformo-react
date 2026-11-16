import type { Response } from '@playwright/test'

const STABLE_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export const SPACE_SECTION_CODENAME = 'FlightWorld'
export const VISUAL_LINKUP_LAB_SECTION_CODENAME = 'VisualLinkupLab'
export const WELCOME_SECTION_CODENAME = 'WelcomePage'
export const APP_RUNTIME_TIMEOUT = 180_000

// ---------------------------------------------------------------------------
// MMOOMM economy MVP (Phase F): codenames + baked constant values.
//
// The posting module source embeds the SAME constant values as literals (the
// proven cruiseSpeed pattern): the module is authored data executed inside the
// published app, so it cannot read this module. Keep both sides in lockstep —
// the generator interpolates these constants into `economyPostingModuleSource`.
// ---------------------------------------------------------------------------

export const NOMENCLATURE_CODE = 'Nomenclature'
export const WALLET_CODE = 'Wallet'
export const OPERATION_CODE = 'Operation'
export const OPERATION_TYPE_ENUM = 'OperationType'
export const UNIT_ENUM = 'Unit'
export const ECONOMY_CONSTANTS_CODE = 'EconomyConstants'
export const WALLET_LEDGER_CODE = 'WalletLedger'
export const INVENTORY_LEDGER_CODE = 'InventoryLedger'
// Module codenames are kebab-case identifiers (MetahubModulesService validates
// `Module codename must be a valid kebab-case English identifier`).
export const ECONOMY_POSTING_MODULE_CODE = 'mmoomm-economy-posting-module'
export const ECONOMY_POSTING_MODULE_NAME = 'Mmoomm Economy Posting Module'

export const CURRENCY_CODE = 'CR'
export const STARTING_BALANCE = 1000
export const STARTING_ORE_KG = 10
export const ORE_PRICE_PER_KG = 10
export const FUEL_PRICE_PER_LITER = 5
export const MAX_CARGO_MASS_KG = 100
export const MARKET_RADIUS_METERS = 80

export const localizedText = (en: string, ru: string, primary: 'en' | 'ru' = 'en') => ({
    _schema: '1',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP },
        ru: { content: ru, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP }
    },
    _primary: primary
})

export const localizedInput = (en: string, ru: string) => ({ en, ru })

export const readRequestJson = (response: Response): Record<string, unknown> | null => {
    try {
        const postData = response.request().postDataJSON()
        return postData && typeof postData === 'object' && !Array.isArray(postData) ? (postData as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export const serverModuleSource = `
import { ExtensionModule, AtServer } from '@universo-react/extension-sdk'

export default class MmoommAuthoritativeFlightRuntime extends ExtensionModule {
    @AtServer()
    async createRealtimeRoomOptions(params) {
        const scene = params && typeof params === 'object' && params.scene ? params.scene : null
        const ship = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.controlledObjectId) : null
        const station = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.targetObjectId) : null
        const initialPosition = ship?.position ?? { x: 0, y: 0, z: 0 }
        const targetPosition = station?.position ?? { x: 72, y: 0, z: -48 }
        const shipScale = ship?.scale ?? { x: 12, y: 4, z: 4 }
        const stationScale = station?.scale ?? { x: 48, y: 16, z: 16 }
        return {
            initialPosition,
            targetObjects: { [scene?.targetObjectId ?? 'station']: targetPosition },
            controlledHalfExtents: { x: Math.abs(shipScale.x) / 2, y: Math.abs(shipScale.y) / 2, z: Math.abs(shipScale.z) / 2 },
            guardBoxes: [
                {
                    center: targetPosition,
                    halfExtents: { x: Math.abs(stationScale.x) / 2, y: Math.abs(stationScale.y) / 2, z: Math.abs(stationScale.z) / 2 }
                }
            ],
            cruiseSpeed: scene?.cruiseSpeed ?? 36,
            acceleration: 48,
            deceleration: 48,
            arrivalRadius: 0.5,
            spawnSafetyMargin: 8,
            spawnMaxAttempts: 64,
            spawnRingSpacing: 24
        }
    }
}
`.trim()

export const economyPostingModuleSource = `
import { ExtensionModule, OnEvent } from '@universo-react/extension-sdk'

// Economy constants are baked as DEFENSIVE FALLBACKS only. The authoritative
// amounts come from server-stamped Operation row fields — the economy service
// resolves them from the EconomyConstants set (_app_constants) at trade time
// (UnitPrice per unit, TotalPrice = positive monetary magnitude, Quantity) —
// so re-publishing the constants changes service prices AND ledger amounts in
// lockstep without touching this module source.
const CURRENCY_CODE = '${CURRENCY_CODE}'
const STARTING_BALANCE = ${STARTING_BALANCE}
const SELL_NOMENCLATURE_CODE = 'ORE'
const BUY_NOMENCLATURE_CODE = 'FUEL'
const WALLET_LEDGER_CODE = '${WALLET_LEDGER_CODE}'
const INVENTORY_LEDGER_CODE = '${INVENTORY_LEDGER_CODE}'

const toNumber = (value, fallback = 0) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const readText = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        const value = record[key]
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim()
        }
    }

    return null
}

// DATE columns reach the module as pg Date instances (or ISO strings), so the
// OccurredAt fact accepts both shapes and normalizes to an ISO string.
const readOccurredAt = (record, ...keys) => {
    if (!record || typeof record !== 'object') {
        return null
    }

    for (const key of keys) {
        const value = record[key]
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString()
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim()
        }
    }

    return null
}

export default class MmoommEconomyPostingModule extends ExtensionModule {
    // TZ FR-015: composes WalletLedger + InventoryLedger movements for the
    // StarterGrant / Sell / Buy operations of the MMOOMM economy MVP.
    @OnEvent('beforePost')
    async buildEconomyMovements(payload) {
        const row = payload && typeof payload === 'object' && payload.previousRow && typeof payload.previousRow === 'object' ? payload.previousRow : null
        const rowId = row && typeof row.id === 'string' ? row.id : ''
        const entityCodename = typeof payload?.entityCodename === 'string' && payload.entityCodename ? payload.entityCodename : 'Operation'

        // The raw previousRow is keyed by physical cmp_<fieldId> columns, which a
        // module cannot resolve safely: metadata.getByCodename('component', ...) is
        // schema-scoped and ambiguous when several entities share a codename
        // (Quantity/OccurredAt exist on Operation and on the ledger registers).
        // The Record API returns the same row keyed by component CODENAMES with
        // NUMBER coercion applied, so it is the authoritative field surface here.
        // Fail closed (Thermos P1): a Record API failure must never degrade into
        // movements composed from empty defaults — rethrowing rolls the whole
        // posting transaction back instead of committing financially incorrect
        // facts. The station read stays lenient (Station is optional on the
        // entity and only feeds a display dimension).
        let operation = {}
        try {
            operation = (await this.ctx.records.get(entityCodename, rowId)) ?? {}
        } catch (error) {
            throw error ?? new Error('Economy operation record could not be read')
        }

        const walletRefId = readText(operation, 'Wallet')
        const nomenclatureRefId = readText(operation, 'Nomenclature')
        const stationRefId = readText(operation, 'Station')
        const operationTypeRefId = readText(operation, 'OperationType')
        const quantity = toNumber(operation.Quantity, 0)
        const unitPrice = toNumber(operation.UnitPrice, 0)
        const occurredAt = readOccurredAt(operation, 'OccurredAt') ?? new Date().toISOString()

        let wallet = null
        if (walletRefId) {
            try {
                wallet = await this.ctx.records.get('Wallet', walletRefId)
            } catch (error) {
                throw error ?? new Error('Economy wallet record could not be read')
            }
        }
        let nomenclature = null
        if (nomenclatureRefId) {
            try {
                nomenclature = await this.ctx.records.get('Nomenclature', nomenclatureRefId)
            } catch (error) {
                throw error ?? new Error('Economy nomenclature record could not be read')
            }
        }
        let station = null
        if (stationRefId) {
            try {
                station = await this.ctx.records.get('FlightStation', stationRefId)
            } catch {
                station = null
            }
        }

        // D6: Wallet.OwnerKey = the operation creator, so _upl_created_by is a safe
        // fallback that always matches the projection WalletKey filter (ctx.userId).
        const ownerKey = readText(wallet, 'OwnerKey') ?? readText(row, '_upl_created_by') ?? ''
        const currency = readText(wallet, 'Currency') ?? CURRENCY_CODE
        const nomenclatureCode = readText(nomenclature, 'Code') ?? ''
        // FlightStation exposes no readable Code component, so the station
        // dimension records the resolved Code when present, otherwise the REF id
        // (the economy summary resolves station identity server-side).
        const stationCode = station ? (readText(station, 'Code') ?? stationRefId) : stationRefId

        // The OperationType enumeration value codename is not readable through the
        // Record API (enumeration values carry no components), so the semantic kind
        // is derived from server-authoritative row fields: UnitPrice === 0 marks the
        // once-only StarterGrant (posted at zero price by the economy service);
        // otherwise the market side mirrors runtimeEconomySupport MARKET_SIDE_CONFIGS
        // (ORE -> sell, FUEL -> buy). The ledger OperationType dimension carries the
        // enumeration value id passthrough for server-side label resolution.
        const kind = unitPrice === 0 ? 'starterGrant' : nomenclatureCode === SELL_NOMENCLATURE_CODE ? 'sell' : 'buy'

        // TotalPrice is stamped by the economy service from the EconomyConstants
        // set: the positive monetary magnitude of the operation (trades: quantity
        // x server-resolved unit price; StarterGrant: StartingBalance). The baked
        // constants only cover rows posted before the field existed.
        const totalPrice = toNumber(operation.TotalPrice, kind === 'starterGrant' ? STARTING_BALANCE : quantity * unitPrice)

        const walletAmount = kind === 'buy' ? -totalPrice : totalPrice
        const inventoryQuantity = kind === 'starterGrant' ? quantity : kind === 'sell' ? -quantity : quantity
        const inventoryCost = kind === 'starterGrant' ? 0 : totalPrice

        return {
            movements: [
                {
                    ledgerCodename: WALLET_LEDGER_CODE,
                    facts: [
                        {
                            data: {
                                WalletKey: ownerKey,
                                Currency: currency,
                                OperationType: operationTypeRefId,
                                Amount: walletAmount,
                                OccurredAt: occurredAt,
                                SourceObjectId: entityCodename,
                                SourceRowId: rowId,
                                SourceLineId: 'mmoomm-economy-wallet'
                            }
                        }
                    ]
                },
                {
                    ledgerCodename: INVENTORY_LEDGER_CODE,
                    facts: [
                        {
                            data: {
                                OwnerKey: ownerKey,
                                StationCode: stationCode ?? null,
                                NomenclatureCode: nomenclatureCode,
                                Quantity: inventoryQuantity,
                                Cost: inventoryCost,
                                OccurredAt: occurredAt,
                                SourceObjectId: entityCodename,
                                SourceRowId: rowId,
                                SourceLineId: 'mmoomm-economy-inventory'
                            }
                        }
                    ]
                }
            ]
        }
    }
}
`.trim()
