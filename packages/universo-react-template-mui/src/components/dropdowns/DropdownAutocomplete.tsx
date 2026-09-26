import { cloneElement, forwardRef, isValidElement, type ComponentType, type ReactElement, type ReactNode, type RefAttributes } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import type { AutocompleteProps, AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import Paper from '@mui/material/Paper'
import { styled, useTheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import { useTranslation } from 'react-i18next'
import { DropdownActionButtons } from './DropdownActionButtons'
import type { DropdownAction } from './DropdownActionButtons'

export type DropdownAutocompleteProps<
    Value,
    Multiple extends boolean | undefined = false,
    DisableClearable extends boolean | undefined = false,
    FreeSolo extends boolean | undefined = false
> = Omit<AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>, 'renderInput'> & {
    renderInput: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>['renderInput']
    /** Optional localized buttons rendered beside the clear and open controls. */
    endActions?: readonly DropdownAction[]
}

const DropdownAutocompletePaper = styled(Paper, { name: 'UniversoDropdownAutocomplete', slot: 'Paper' })(({ theme }) => ({
    marginTop: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: `${theme.shape.borderRadius}px`,
    backgroundImage: 'none',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[8]
}))

const DropdownAutocompleteListbox = styled('ul', { name: 'UniversoDropdownAutocomplete', slot: 'Listbox' })(({ theme }) => ({
    padding: theme.spacing(0.5),
    '& .MuiAutocomplete-option': {
        minHeight: 36,
        borderRadius: `${theme.shape.borderRadius}px`,
        '&.Mui-focused': { backgroundColor: theme.palette.action.hover },
        '&[aria-selected="true"]': { backgroundColor: theme.palette.action.selected }
    }
}))

function mergeAutocompleteSx(sx: SxProps<Theme> | undefined, theme: Theme, endActionsCount: number): SxProps<Theme> {
    const adornmentGap = theme.spacing(0.5)
    const addedActionSpace =
        endActionsCount > 0
            ? `${32 * endActionsCount}px${Array.from({ length: endActionsCount + 1 }, () => ` + ${adornmentGap}`).join('')}`
            : undefined
    const getInputPadding = (basePadding: number) =>
        addedActionSpace ? `calc(${basePadding}px + ${addedActionSpace})` : `${basePadding}px`
    const sharedStyles = {
        '& .MuiAutocomplete-endAdornment': {
            display: 'flex',
            alignItems: 'center',
            gap: adornmentGap
        },
        '&.MuiAutocomplete-hasPopupIcon .MuiAutocomplete-inputRoot.MuiOutlinedInput-root, &.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiOutlinedInput-root, &.MuiAutocomplete-hasPopupIcon .MuiAutocomplete-inputRoot.MuiFilledInput-root, &.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiFilledInput-root':
            {
                paddingRight: getInputPadding(41)
            },
        '&.MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiOutlinedInput-root, &.MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiFilledInput-root':
            {
                paddingRight: getInputPadding(77)
            },
        '&.MuiAutocomplete-hasPopupIcon .MuiAutocomplete-inputRoot.MuiInput-root, &.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiInput-root':
            {
                paddingRight: getInputPadding(32)
            },
        '&.MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiAutocomplete-inputRoot.MuiInput-root': {
            paddingRight: getInputPadding(68)
        },
        '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
            width: 32,
            height: 32,
            padding: theme.spacing(0.5),
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: `${theme.shape.borderRadius}px`,
            color: theme.palette.text.secondary,
            backgroundColor: theme.palette.background.paper,
            '&:hover': {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover
            }
        },
        '& .MuiAutocomplete-clearIndicator': { marginRight: 0 },
        '& .MuiAutocomplete-popupIndicator': { marginLeft: 0 }
    }
    const customStyles = sx ? (Array.isArray(sx) ? sx : [sx]) : []
    return [sharedStyles, ...customStyles] as SxProps<Theme>
}

function prependEndActions(params: AutocompleteRenderInputParams, actions: readonly DropdownAction[]): AutocompleteRenderInputParams {
    const currentAdornment = params.slotProps.input.endAdornment
    const actionButtons = <DropdownActionButtons actions={actions} />
    const endAdornment = isValidElement<{ children?: ReactNode }>(currentAdornment) ? (
        cloneElement(currentAdornment, {
            children: (
                <>
                    {actionButtons}
                    {currentAdornment.props.children}
                </>
            )
        })
    ) : (
        <>
            {actionButtons}
            {currentAdornment}
        </>
    )

    return {
        ...params,
        slotProps: {
            ...params.slotProps,
            input: { ...params.slotProps.input, endAdornment }
        }
    }
}

/**
 * Searchable MUI dropdown using the shared outlined action buttons and option
 * menu styling. Search, async loading, custom options and MUI's clear behavior
 * remain controlled by the consumer through the standard Autocomplete props.
 */
type DropdownAutocompletePublicComponent = <
    Value,
    Multiple extends boolean | undefined = false,
    DisableClearable extends boolean | undefined = false,
    FreeSolo extends boolean | undefined = false
>(
    props: DropdownAutocompleteProps<Value, Multiple, DisableClearable, FreeSolo> & RefAttributes<HTMLDivElement>
) => ReactElement

type DropdownAutocompleteInternalProps = DropdownAutocompleteProps<unknown, boolean | undefined, boolean | undefined, boolean | undefined>

const AutocompleteWithRef = Autocomplete as unknown as ComponentType<
    AutocompleteProps<unknown, boolean | undefined, boolean | undefined, boolean | undefined> & RefAttributes<HTMLDivElement>
>

const DropdownAutocompleteWithRef = forwardRef<HTMLDivElement, DropdownAutocompleteInternalProps>(function DropdownAutocomplete(
    props,
    ref
) {
    const theme = useTheme()
    const { t } = useTranslation('common')
    const { endActions = [], renderInput, sx, slots, clearText, openText, closeText, popupIcon, ...autocompleteProps } = props
    const renderInputWithActions: AutocompleteProps<
        unknown,
        boolean | undefined,
        boolean | undefined,
        boolean | undefined
    >['renderInput'] = (params) => renderInput(endActions.length > 0 ? prependEndActions(params, endActions) : params)

    return (
        <AutocompleteWithRef
            {...autocompleteProps}
            clearText={clearText ?? t('clear', 'Clear')}
            openText={openText ?? t('expand', 'Expand')}
            closeText={closeText ?? t('close', 'Close')}
            popupIcon={popupIcon === undefined ? <UnfoldMoreRoundedIcon fontSize='small' /> : popupIcon}
            renderInput={renderInputWithActions}
            slots={{ paper: DropdownAutocompletePaper, listbox: DropdownAutocompleteListbox, ...slots }}
            sx={mergeAutocompleteSx(sx, theme, endActions.length)}
            ref={ref}
        />
    )
})

export const DropdownAutocomplete = DropdownAutocompleteWithRef as DropdownAutocompletePublicComponent
