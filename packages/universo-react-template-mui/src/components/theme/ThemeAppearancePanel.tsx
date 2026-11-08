import { useMemo } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'

import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { themeContrastIssues, themeTokensSchema, type ThemeAppearance, type ThemeAppearanceDraft } from '@universo-react/types'
import { findFileThemePreset, mergeThemeTokens, resolveEffectiveThemeTokens, themeTokensToMuiInput } from '@universo-react/theme'

import { DropdownSelect as Select } from '../dropdowns/DropdownSelect'
import { HexColorPickerPopover } from '../forms/HexColorPickerPopover'

export interface AppearancePresetOption {
    /** Stable select value: `file:<codename>` or `<uuid>`. */
    key: string
    label: string
    source: 'file' | 'metahub' | 'application'
    version: number
    archived?: boolean
    usageCount?: number | null
}

export interface ThemeAppearancePanelProps {
    testIdPrefix: string
    presets: AppearancePresetOption[]
    appearance: ThemeAppearance | null
    draft: ThemeAppearanceDraft | null
    onDraftChange: (draft: ThemeAppearanceDraft | null) => void
    saving?: boolean
    disabled?: boolean
    showApplyLatest?: boolean
    sourceUnavailable?: boolean
    onSave: () => void
    onReset: () => void
    onApplyLatest: () => void
    onManagePresets: () => void
}

const FONT_OPTIONS = ['inter', 'system', 'serif', 'mono'] as const
const DENSITY_OPTIONS = ['compact', 'comfortable'] as const
const SHADOW_OPTIONS = ['none', 'soft', 'default', 'strong'] as const
const MODE_OPTIONS = ['system', 'light', 'dark'] as const

/**
 * TZ §11.4/§15.2: a layout without a persisted appearance still renders the
 * built-in `universo-default` snapshot, so the select mirrors that effective
 * default instead of an empty placeholder until something is changed.
 */
const DEFAULT_PRESET_ID = 'universo-default'
const DEFAULT_PRESET_KEY = `file:${DEFAULT_PRESET_ID}`

const COLOR_FIELDS: ReadonlyArray<{ path: [string, ...string[]]; key: string }> = [
    { path: ['modes', 'light', 'primary', 'main'], key: 'color.primary' },
    { path: ['modes', 'light', 'primary', 'contrastText'], key: 'color.primaryContrastText' },
    { path: ['modes', 'light', 'secondary', 'main'], key: 'color.secondary' },
    { path: ['modes', 'light', 'secondary', 'contrastText'], key: 'color.secondaryContrastText' },
    { path: ['modes', 'light', 'background', 'default'], key: 'color.backgroundDefault' },
    { path: ['modes', 'light', 'background', 'paper'], key: 'color.backgroundPaper' },
    { path: ['modes', 'light', 'text', 'primary'], key: 'color.textPrimary' },
    { path: ['modes', 'light', 'text', 'secondary'], key: 'color.textSecondary' },
    { path: ['modes', 'light', 'divider'], key: 'color.divider' },
    { path: ['modes', 'dark', 'primary', 'main'], key: 'color.primary' },
    { path: ['modes', 'dark', 'primary', 'contrastText'], key: 'color.primaryContrastText' },
    { path: ['modes', 'dark', 'secondary', 'main'], key: 'color.secondary' },
    { path: ['modes', 'dark', 'secondary', 'contrastText'], key: 'color.secondaryContrastText' },
    { path: ['modes', 'dark', 'background', 'default'], key: 'color.backgroundDefault' },
    { path: ['modes', 'dark', 'background', 'paper'], key: 'color.backgroundPaper' },
    { path: ['modes', 'dark', 'text', 'primary'], key: 'color.textPrimary' },
    { path: ['modes', 'dark', 'text', 'secondary'], key: 'color.textSecondary' },
    { path: ['modes', 'dark', 'divider'], key: 'color.divider' }
]

/** Bounded numeric overrides rendered as Slider rows (defaults mirror the universo-default snapshot). */
const SLIDER_FIELDS: ReadonlyArray<{
    path: [string, ...string[]]
    key: string
    testId: string
    min: number
    max: number
    defaultValue: number
}> = [
    { path: ['shared', 'spacing', 'base'], key: 'spacing.base', testId: 'spacing-base', min: 4, max: 16, defaultValue: 8 },
    {
        path: ['shared', 'shape', 'borderRadius'],
        key: 'shape.borderRadius',
        testId: 'shape-border-radius',
        min: 0,
        max: 24,
        defaultValue: 8
    },
    { path: ['shared', 'shape', 'borderWidth'], key: 'shape.borderWidth', testId: 'shape-border-width', min: 0, max: 4, defaultValue: 1 }
]

/** Immutable deep update over the sparse overrides object. */
const setOverridePath = (draft: ThemeAppearanceDraft, path: readonly string[], value: string | number | null): ThemeAppearanceDraft => {
    // Overrides are strict-JSON schema data, so a JSON round-trip is an exact
    // deep clone (and avoids the jsdom missing-structuredClone gap in tests).
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(draft.overrides)) as Record<string, unknown>
    let cursor = clone as Record<string, unknown>
    for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index]
        const next = cursor[key]
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
            cursor[key] = {}
        }
        cursor = cursor[key] as Record<string, unknown>
    }
    const leaf = path[path.length - 1]
    if (value === null) delete cursor[leaf]
    else cursor[leaf] = value
    return { ...draft, overrides: clone as ThemeAppearanceDraft['overrides'] }
}

const getOverrideValue = (draft: ThemeAppearanceDraft, path: readonly string[]): string | number | null | undefined => {
    let cursor: unknown = draft.overrides
    for (const key of path) {
        if (!cursor || typeof cursor !== 'object') return undefined
        cursor = (cursor as Record<string, unknown>)[key]
    }
    return cursor === undefined ? undefined : (cursor as string | number | null)
}

export function ThemeAppearancePanel({
    testIdPrefix,
    presets,
    appearance,
    draft,
    onDraftChange,
    saving = false,
    disabled = false,
    showApplyLatest = false,
    sourceUnavailable = false,
    onSave,
    onReset,
    onApplyLatest,
    onManagePresets
}: ThemeAppearancePanelProps) {
    const { t } = useTranslation('appearance')
    // safeParse: a persisted snapshot that predates a schema change must not
    // crash the panel — it degrades to no contrast feedback until re-saved.
    const resolvedTokens = appearance ? themeTokensSchema.safeParse(appearance.resolved.tokens) : null
    const resolvedIssues = resolvedTokens?.success ? themeContrastIssues(resolvedTokens.data) : { errors: [], warnings: [] }

    // The tokens this layout effectively renders: the applied snapshot when
    // one is persisted, otherwise the built-in universo-default snapshot the
    // runtime falls back to (TZ §11.4/§15.2). Display-only — saving always
    // re-resolves server-side (TZ Appendix A #7: the client never merges).
    const effectiveTokens = useMemo(() => resolveEffectiveThemeTokens(appearance?.resolved.tokens), [appearance])
    const previewMui = useMemo(() => (effectiveTokens ? themeTokensToMuiInput(effectiveTokens) : null), [effectiveTokens])

    // Draft-time contrast feedback (display-only, QA-M4): merge the draft
    // overrides over the best locally known base and re-check WCAG pairs
    // before saving. This is never persisted — the PATCH body stays
    // `{ mode, preset, overrides }` and the server re-resolves + re-gates.
    const draftIssues = useMemo(() => {
        if (!draft) return null
        let base = effectiveTokens
        if (draft.preset.source === 'file') {
            const fileTokens = findFileThemePreset(draft.preset.id)?.tokens
            const parsed = fileTokens ? themeTokensSchema.safeParse(fileTokens) : null
            if (parsed?.success) base = parsed.data
        } else if (appearance && draft.preset.id === appearance.preset.id && draft.preset.source === appearance.preset.source) {
            base = effectiveTokens
        }
        if (!base) return null
        try {
            const draftTokens = mergeThemeTokens(base, draft.overrides)
            const issues = themeContrastIssues(draftTokens)
            return { issues, previewMui: themeTokensToMuiInput(draftTokens) }
        } catch {
            return null
        }
    }, [draft, effectiveTokens, appearance])

    const activeIssues = draftIssues?.issues ?? resolvedIssues
    const activePreviewMui = draftIssues?.previewMui ?? previewMui

    // Without an explicit draft the panel displays the effective built-in
    // default (the same value the runtime falls back to), never an empty one.
    const selectedPresetKey = draft
        ? draft.preset.source === 'file'
            ? `file:${draft.preset.id}`
            : draft.preset.id
        : presets.some((preset) => preset.key === DEFAULT_PRESET_KEY)
        ? DEFAULT_PRESET_KEY
        : ''

    const handlePresetChange = (key: string) => {
        const option = presets.find((preset) => preset.key === key)
        if (!option) return
        const source = option.source
        const id = option.source === 'file' ? option.key.slice('file:'.length) : option.key
        onDraftChange({
            mode: draft?.mode ?? 'system',
            preset: { source, id, version: option.version },
            overrides: {}
        })
    }

    /** Seeds an explicit draft on the effective default theme (no-op when the default option is unavailable). */
    const buildDefaultDraft = (mode: ThemeAppearanceDraft['mode']): ThemeAppearanceDraft | null => {
        const option = presets.find((preset) => preset.key === DEFAULT_PRESET_KEY)
        if (!option) return null
        return { mode, preset: { source: 'file', id: DEFAULT_PRESET_ID, version: option.version }, overrides: {} }
    }

    const handleModeChange = (mode: (typeof MODE_OPTIONS)[number]) => {
        if (draft) {
            onDraftChange({ ...draft, mode })
            return
        }
        const seeded = buildDefaultDraft(mode)
        if (seeded) onDraftChange(seeded)
    }

    /** Override value, falling back to the effective theme's own token value. */
    const getDisplayValue = (path: readonly string[]): string | number | null | undefined => {
        const override = draft ? getOverrideValue(draft, path) : undefined
        if (override !== undefined && override !== null) return override
        let cursor: unknown = effectiveTokens
        for (const key of path) {
            if (!cursor || typeof cursor !== 'object') return undefined
            cursor = (cursor as Record<string, unknown>)[key]
        }
        return cursor === undefined ? undefined : (cursor as string | number | null)
    }

    /** Writes an override, bootstrapping an explicit draft on the default theme when none exists. */
    const setOverride = (path: readonly string[], value: string | number | null) => {
        const base = draft ?? buildDefaultDraft('system')
        if (!base) return
        onDraftChange(setOverridePath(base, path, value))
    }

    return (
        <Stack spacing={3} data-testid={`${testIdPrefix}-panel`}>
            {sourceUnavailable && (
                <Alert severity='warning' data-testid={`${testIdPrefix}-source-unavailable`}>
                    {t('sourceUnavailable.warning')}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                <FormControl size='small' fullWidth disabled={disabled}>
                    <InputLabel id={`${testIdPrefix}-preset-label`}>{t('preset.label')}</InputLabel>
                    <Select
                        labelId={`${testIdPrefix}-preset-label`}
                        label={t('preset.label')}
                        value={selectedPresetKey}
                        onChange={(event) => handlePresetChange(String(event.target.value))}
                        inputProps={{ 'data-testid': `${testIdPrefix}-preset-select` }}
                    >
                        {presets.map((preset) => (
                            <MenuItem key={preset.key} value={preset.key} disabled={preset.archived}>
                                {`${preset.label} · ${t(`preset.${preset.source}`)} · ${t('preset.version', { version: preset.version })}`}
                                {typeof preset.usageCount === 'number' ? ` · ${t('preset.usage', { count: preset.usageCount })}` : ''}
                            </MenuItem>
                        ))}
                    </Select>
                    {!draft && <FormHelperText>{t('preset.defaultHint')}</FormHelperText>}
                </FormControl>
                <Button
                    variant='outlined'
                    onClick={onManagePresets}
                    disabled={disabled}
                    data-testid={`${testIdPrefix}-manage-presets`}
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    {t('actions.managePresets')}
                </Button>
            </Stack>

            <FormControl size='small' fullWidth disabled={disabled}>
                <InputLabel id={`${testIdPrefix}-mode-label`}>{t('mode.label')}</InputLabel>
                <Select
                    labelId={`${testIdPrefix}-mode-label`}
                    label={t('mode.label')}
                    value={draft?.mode ?? 'system'}
                    onChange={(event) => handleModeChange(event.target.value as (typeof MODE_OPTIONS)[number])}
                    inputProps={{ 'data-testid': `${testIdPrefix}-mode-select` }}
                >
                    {MODE_OPTIONS.map((mode) => (
                        <MenuItem key={mode} value={mode}>
                            {t(`mode.${mode}`)}
                        </MenuItem>
                    ))}
                </Select>
                <FormHelperText>{t('mode.helper')}</FormHelperText>
            </FormControl>

            {activePreviewMui && (
                <Box>
                    <Typography variant='subtitle2' gutterBottom>
                        {t('title')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        {(['light', 'dark'] as const).map((modeKey) => {
                            const palette = activePreviewMui.palettePerScheme[modeKey]
                            return (
                                <Paper
                                    key={modeKey}
                                    data-testid={`${testIdPrefix}-preview-${modeKey}`}
                                    sx={{
                                        flex: 1,
                                        p: 2,
                                        bgcolor: palette.background.default,
                                        color: palette.text.primary,
                                        borderRadius: `${activePreviewMui.shape.borderRadius}px`,
                                        border: `${activePreviewMui.shape.borderWidth}px solid ${palette.divider}`
                                    }}
                                >
                                    <Typography variant='subtitle1'>{t('title')}</Typography>
                                    <Typography variant='body2' sx={{ color: palette.text.secondary }}>
                                        {t('subtitle')}
                                    </Typography>
                                    <Box
                                        component='span'
                                        data-testid={`${testIdPrefix}-preview-${modeKey}-button`}
                                        sx={{
                                            display: 'inline-block',
                                            mt: 1,
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: `${Math.round(activePreviewMui.shape.borderRadius * 0.5)}px`,
                                            bgcolor: palette.primary.main,
                                            color: palette.primary.contrastText
                                        }}
                                    >
                                        {t('actions.save')}
                                    </Box>
                                </Paper>
                            )
                        })}
                    </Stack>
                </Box>
            )}

            {effectiveTokens && (
                <Paper variant='outlined' sx={{ p: 2 }}>
                    <Typography variant='subtitle2' gutterBottom>
                        {t('overrides.title')}
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(220px, 1fr))' },
                            gap: 1.5
                        }}
                    >
                        {COLOR_FIELDS.map(({ path, key }) => {
                            const testId = path.join('-')
                            const value = getDisplayValue(path)
                            return (
                                <HexColorPickerPopover
                                    key={testId}
                                    id={`${testIdPrefix}-color-${testId}`}
                                    label={t(key)}
                                    pickerLabel={t(key)}
                                    value={typeof value === 'string' ? value : ''}
                                    disabled={disabled}
                                    testId={`${testIdPrefix}-color-${testId}`}
                                    onChange={(next) => setOverride(path, next || null)}
                                />
                            )
                        })}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={2}>
                        {SLIDER_FIELDS.map(({ path, key, testId, min, max, defaultValue }) => {
                            const value = getDisplayValue(path)
                            return (
                                <Stack
                                    key={testId}
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                    sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
                                >
                                    <Typography variant='body2' sx={{ minWidth: 140 }}>
                                        {t(key)}
                                    </Typography>
                                    <Slider
                                        data-testid={`${testIdPrefix}-${testId}`}
                                        min={min}
                                        max={max}
                                        step={1}
                                        marks
                                        value={typeof value === 'number' ? value : defaultValue}
                                        disabled={disabled}
                                        onChange={(_, next) => setOverride(path, next as number)}
                                        sx={{ flex: 1 }}
                                    />
                                </Stack>
                            )
                        })}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                select
                                size='small'
                                fullWidth
                                label={t('typography.fontFamily')}
                                data-testid={`${testIdPrefix}-font-family`}
                                value={(getDisplayValue(['shared', 'typography', 'fontFamily']) as string) ?? ''}
                                disabled={disabled}
                                onChange={(event) => setOverride(['shared', 'typography', 'fontFamily'], event.target.value || null)}
                            >
                                {FONT_OPTIONS.map((font) => (
                                    <MenuItem key={font} value={font}>
                                        {t(`font.${font}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size='small'
                                fullWidth
                                label={t('spacing.density')}
                                data-testid={`${testIdPrefix}-density`}
                                value={(getDisplayValue(['shared', 'spacing', 'density']) as string) ?? ''}
                                disabled={disabled}
                                onChange={(event) => setOverride(['shared', 'spacing', 'density'], event.target.value || null)}
                            >
                                {DENSITY_OPTIONS.map((density) => (
                                    <MenuItem key={density} value={density}>
                                        {t(`spacing.${density}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size='small'
                                fullWidth
                                label={t('shadows.scale')}
                                data-testid={`${testIdPrefix}-shadows`}
                                value={(getDisplayValue(['shared', 'shadows', 'scale']) as string) ?? ''}
                                disabled={disabled}
                                onChange={(event) => setOverride(['shared', 'shadows', 'scale'], event.target.value || null)}
                            >
                                {SHADOW_OPTIONS.map((option) => (
                                    <MenuItem key={option} value={option}>
                                        {t(`shadows.${option}`)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {activeIssues.errors.length > 0 && (
                <Alert severity='error' data-testid={`${testIdPrefix}-contrast-error`}>
                    {t('contrast.errors')}
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        {activeIssues.errors.map((issue) => (
                            <li key={issue.pair}>
                                {issue.pair} · {t('contrast.ratio', { ratio: issue.ratio.toFixed(2) })}
                            </li>
                        ))}
                    </ul>
                </Alert>
            )}
            {activeIssues.warnings.length > 0 && (
                <Alert severity='warning' data-testid={`${testIdPrefix}-contrast-warning`}>
                    {t('contrast.warnings')}
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        {activeIssues.warnings.map((issue) => (
                            <li key={issue.pair}>
                                {issue.pair} · {t('contrast.ratio', { ratio: issue.ratio.toFixed(2) })}
                            </li>
                        ))}
                    </ul>
                </Alert>
            )}
            <Stack direction='row' spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                {/* Persisted contrast errors block the save client-side; the
                    server enforces the same gate with a 422 rejection. */}
                <Button
                    variant='contained'
                    onClick={onSave}
                    disabled={disabled || saving || !draft || activeIssues.errors.length > 0}
                    data-testid={`${testIdPrefix}-save`}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    {t('actions.save')}
                </Button>
                <Button
                    variant='outlined'
                    onClick={onReset}
                    disabled={disabled || saving || (!draft && !appearance)}
                    data-testid={`${testIdPrefix}-reset`}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    {t('actions.reset')}
                </Button>
                {showApplyLatest && (
                    <Tooltip title={t('actions.applyLatest')}>
                        <Button
                            variant='outlined'
                            onClick={onApplyLatest}
                            disabled={disabled || saving}
                            data-testid={`${testIdPrefix}-apply-latest`}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('actions.applyLatest')}
                        </Button>
                    </Tooltip>
                )}
            </Stack>

            {disabled && (
                <Typography variant='caption' color='text.secondary' data-testid={`${testIdPrefix}-readonly-hint`}>
                    {t('readonly.hint')}
                </Typography>
            )}
        </Stack>
    )
}
