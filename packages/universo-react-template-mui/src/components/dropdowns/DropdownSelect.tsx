import { forwardRef } from 'react'
import type { ComponentType, ReactElement, RefAttributes } from 'react'
import Select from '@mui/material/Select'
import type { SelectProps } from '@mui/material/Select'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import type { SvgIconProps } from '@mui/material/SvgIcon'

const DropdownSelectIcon = forwardRef<SVGSVGElement, SvgIconProps>(function DropdownSelectIcon(props, ref) {
    return <UnfoldMoreRoundedIcon fontSize='small' {...props} ref={ref} />
})

/**
 * Domain-neutral MUI Select entry point for non-published Platformo interfaces.
 *
 * It intentionally keeps MUI's native SelectProps contract so callers retain
 * MenuItem children, multiple selection, custom renderValue and MenuProps.
 * Shared field and menu presentation comes from the template MUI theme.
 */
type DropdownSelectInternalProps = SelectProps<unknown>
type WithDropdownSelectRef<Props> = Props extends unknown ? Omit<Props, 'ref'> & RefAttributes<HTMLDivElement> : never
type DropdownSelectPublicComponent = <Value = unknown>(props: WithDropdownSelectRef<SelectProps<Value>>) => ReactElement

const SelectWithRef = Select as unknown as ComponentType<DropdownSelectInternalProps & RefAttributes<HTMLDivElement>>

const DropdownSelectWithRef = forwardRef<HTMLDivElement, DropdownSelectInternalProps>(function DropdownSelect(props, ref) {
    return <SelectWithRef {...props} IconComponent={props.IconComponent ?? DropdownSelectIcon} ref={ref} />
})

export const DropdownSelect = DropdownSelectWithRef as DropdownSelectPublicComponent

export type DropdownSelectProps<Value = unknown> = WithDropdownSelectRef<SelectProps<Value>>
