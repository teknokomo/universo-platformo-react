export const LEDGER_MODES = ['facts', 'balance', 'accounting', 'calculation'] as const
export type LedgerMode = (typeof LEDGER_MODES)[number]
