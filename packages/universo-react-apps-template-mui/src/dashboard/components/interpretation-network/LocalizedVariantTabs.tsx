import type { KeyboardEvent, MouseEvent } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

export interface LocalizedVariantTabItem {
    code: string
    label: string
}

export interface LocalizedVariantTabsLabels {
    tabList: string
    add: string
    actions: (language: string) => string
    primary: string
}

export interface LocalizedVariantTabsProps {
    items: LocalizedVariantTabItem[]
    value: string
    primaryValue: string
    labels: LocalizedVariantTabsLabels
    canEdit: boolean
    canAdd: boolean
    onChange: (value: string) => void
    onAdd: (event: MouseEvent<HTMLElement>) => void
    onOpenActions: (event: MouseEvent<HTMLElement>, value: string) => void
    onTabKeyDown?: (event: KeyboardEvent<HTMLElement>, value: string) => void
}

export function LocalizedVariantTabs({
    items,
    value,
    primaryValue,
    labels,
    canEdit,
    canAdd,
    onChange,
    onAdd,
    onOpenActions,
    onTabKeyDown
}: LocalizedVariantTabsProps) {
    return (
        <Stack direction='row' spacing={1} alignItems='flex-start' sx={{ flexWrap: 'wrap', minWidth: 0 }}>
            <Box
                role='tablist'
                aria-label={labels.tabList}
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    borderBottom: 1,
                    borderColor: 'divider',
                    minWidth: 0
                }}
            >
                {items.map((item) => {
                    const selected = value === item.code
                    const isPrimary = primaryValue === item.code

                    return (
                        <Stack
                            key={item.code}
                            direction='row'
                            spacing={0.25}
                            alignItems='flex-start'
                            sx={{
                                borderBottom: 2,
                                borderColor: selected ? 'text.primary' : 'transparent',
                                color: selected ? 'text.primary' : 'text.secondary',
                                transition: (theme) =>
                                    theme.transitions.create(['border-color', 'color'], {
                                        duration: theme.transitions.duration.shortest
                                    })
                            }}
                        >
                            <ButtonBase
                                role='tab'
                                aria-selected={selected}
                                tabIndex={selected ? 0 : -1}
                                data-content-locale-tab={item.code}
                                onClick={() => onChange(item.code)}
                                onKeyDown={(event) => onTabKeyDown?.(event, item.code)}
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    px: 1,
                                    py: '6px',
                                    mb: '8px',
                                    borderRadius: 1,
                                    color: 'inherit',
                                    fontFamily: (theme) => theme.typography.fontFamily,
                                    fontWeight: (theme) => theme.typography.fontWeightMedium,
                                    fontSize: '0.875rem',
                                    lineHeight: 1.25,
                                    textTransform: 'none',
                                    '&:hover': {
                                        color: 'text.primary',
                                        bgcolor: 'action.hover'
                                    },
                                    '&:focus-visible': {
                                        outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                                        outlineOffset: 2
                                    }
                                }}
                            >
                                {isPrimary ? (
                                    <StarRoundedIcon
                                        aria-label={labels.primary}
                                        titleAccess={labels.primary}
                                        sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, mx: -0.25 }}
                                    />
                                ) : null}
                                <Box component='span'>{item.label}</Box>
                            </ButtonBase>
                            <IconButton
                                size='small'
                                aria-label={labels.actions(item.label)}
                                disabled={!canEdit}
                                onClick={(event) => onOpenActions(event, item.code)}
                                sx={{ width: 28, height: 28, p: 0.5, mt: 0, mb: '8px', lineHeight: 0 }}
                            >
                                <MoreVertRoundedIcon fontSize='small' />
                            </IconButton>
                        </Stack>
                    )
                })}
            </Box>
            <IconButton
                size='small'
                aria-label={labels.add}
                disabled={!canAdd || !canEdit}
                onClick={onAdd}
                sx={{
                    width: 28,
                    height: 28,
                    p: 0.5,
                    mt: 0,
                    mb: '8px',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    lineHeight: 0
                }}
            >
                <AddRoundedIcon fontSize='small' />
            </IconButton>
        </Stack>
    )
}
