import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { readLocalizedTextValue, type DashboardLibraryTableWidgetConfig } from '@universo-react/types'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { resolveCreateActionAvailability, resolveCreateTargetAvailability } from './createTargetAvailability'

type CreateTarget = NonNullable<DashboardLibraryTableWidgetConfig['createTargets']>[number]

/** Opens semantic create targets through the host's canonical creation workflow. */
export default function DetailsTableCreateTargetMenu({
    createTargets
}: {
    createTargets?: DashboardLibraryTableWidgetConfig['createTargets']
}) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const disabledReasonId = useId()
    const createAccess = resolveCreateActionAvailability(details, t)
    useEffect(() => {
        if (createAccess.disabled) setAnchorEl(null)
    }, [createAccess.disabled])
    if (!createTargets?.length) return null

    const handleCloseMenu = () => setAnchorEl(null)
    const handleSelectTarget = (target: CreateTarget) => {
        if (!details || resolveCreateTargetAvailability(target, details, t).disabled) return
        details.onOpenCreateTarget?.(target)
        handleCloseMenu()
    }

    return (
        <>
            <Button
                type='button'
                data-testid='records-union-create-target-menu-button'
                variant='contained'
                size='small'
                startIcon={<AddRoundedIcon fontSize='small' />}
                endIcon={<KeyboardArrowDownRoundedIcon fontSize='small' />}
                aria-haspopup='menu'
                aria-expanded={anchorEl && !createAccess.disabled ? 'true' : undefined}
                aria-describedby={createAccess.disabled ? disabledReasonId : undefined}
                disabled={createAccess.disabled}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
            >
                {t('app.createRow', 'Create')}
            </Button>
            {createAccess.disabled && createAccess.disabledReason ? (
                <Typography id={disabledReasonId} role='status' variant='caption' sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {createAccess.disabledReason}
                </Typography>
            ) : null}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl) && !createAccess.disabled}
                onClose={handleCloseMenu}
                slotProps={{ list: { 'aria-label': t('app.createTargetMenu', 'Create content') } }}
            >
                {createTargets.map((target) => {
                    const availability = details
                        ? resolveCreateTargetAvailability(target, details, t)
                        : { disabled: true, disabledReason: createAccess.disabledReason }
                    return (
                        <MenuItem
                            key={target.id}
                            disabled={availability.disabled}
                            onClick={() => handleSelectTarget(target)}
                            sx={{ minWidth: 220, alignItems: 'flex-start' }}
                        >
                            <Stack spacing={0.25}>
                                <Typography variant='body2'>
                                    {readLocalizedTextValue(target.label, details?.locale ?? 'en') ||
                                        t('app.createTargetFallback', 'Record')}
                                </Typography>
                                {availability.disabled && availability.disabledReason ? (
                                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                        {availability.disabledReason}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}
