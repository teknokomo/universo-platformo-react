import type { GridLocaleText } from '@mui/x-data-grid'
import { ruRU } from '@mui/x-data-grid/locales'

const ruLocaleText: Partial<GridLocaleText> = {
    ...ruRU.components.MuiDataGrid.defaultProps.localeText,
    // The ruRU locale from MUI X does not include paginationDisplayedRows,
    // so the "X-Y of Z" label stays English by default. Fix it here.
    paginationDisplayedRows: ({ from, to, count, estimated }) =>
        `${from}–${to} из ${count !== -1 ? count : estimated !== undefined ? `примерно ${estimated}` : `более ${to}`}`
}

/**
 * Return the MUI DataGrid localeText for a given i18n language code.
 *
 * Currently supported: 'ru' → ruRU.  All other codes fall back to the
 * built-in English default (returns `undefined`).
 */
export function getDataGridLocaleText(language: string): Partial<GridLocaleText> | undefined {
    const lang = language.slice(0, 2).toLowerCase()

    if (lang === 'ru') {
        return ruLocaleText
    }

    // English (default) — no override needed
    return undefined
}
