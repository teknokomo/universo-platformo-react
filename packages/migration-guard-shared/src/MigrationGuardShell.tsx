/**
 * Universo Platformo | Shared Migration Guard Shell
 *
 * A render-props shell component that encapsulates the common guard logic
 * shared between ApplicationMigrationGuard and MetahubMigrationGuard.
 *
 * The shell handles:
 *   - entityId null check → passthrough
 *   - isSkipRoute check → passthrough
 *   - Loading state → spinner with text
 *   - Error state → Alert with retry button
 *   - No migration required → passthrough
 *   - OPTIONAL severity → passthrough
 *   - "Dismissed" state management → passthrough
 *   - Dialog container (open, onClose for non-mandatory)
 *
 * The consumer supplies domain-specific rendering via render-props:
 *   - Pre-dialog interceptors (e.g., UnderDevelopmentPage, MaintenancePage)
 *   - Dialog title, body content (chips, descriptions)
 *   - Dialog action buttons
 */

import { type ReactNode, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material'
import { extractAxiosError } from '@universo/utils'
import { UpdateSeverity } from '@universo/types'
import type { UseQueryResult } from '@tanstack/react-query'
import type { StructuredBlocker } from '@universo/types'

/** Minimal status shape that the shell requires from the query result. */
export interface BaseMigrationStatus {
    migrationRequired: boolean
    severity: UpdateSeverity
    blockers?: StructuredBlocker[]
}

/** Context provided to render-prop callbacks. */
export interface GuardRenderContext<TStatus extends BaseMigrationStatus = BaseMigrationStatus> {
    status: TStatus
    isMandatory: boolean
    hasBlockers: boolean
    onDismiss: () => void
    onRetry: () => void
}

export interface MigrationGuardShellProps<TStatus extends BaseMigrationStatus = BaseMigrationStatus> {
    /** Content to render when the guard passes. */
    children: ReactNode

    /** Entity ID (applicationId / metahubId). Null → passthrough. */
    entityId: string | undefined

    /** Whether the current route should skip the guard entirely. */
    isSkipRoute: boolean

    /** React Query result for migration status. */
    statusQuery: UseQueryResult<TStatus, Error>

    /** Aria ID for the dialog description element. */
    dialogAriaId: string

    // ── i18n text strings ──────────────────────────────────────────────

    /** Text shown during loading. */
    loadingText: string

    /** Fallback error message. */
    errorText: string

    /** Label for the retry button. */
    retryText: string

    // ── Render-prop slots ──────────────────────────────────────────────

    /**
     * Optional interceptor rendered before the dialog.
     * If it returns a ReactNode, that node replaces the dialog entirely.
     * Use this for special pages (UnderDevelopmentPage, MaintenancePage, etc.).
     */
    renderPreDialog?: (status: TStatus) => ReactNode | null

    /** Render the dialog title. */
    renderDialogTitle: (ctx: GuardRenderContext<TStatus>) => ReactNode

    /** Render the dialog body content (description, chips, blockers, extra errors). */
    renderDialogContent: (ctx: GuardRenderContext<TStatus>) => ReactNode

    /** Render the dialog action buttons. */
    renderDialogActions: (ctx: GuardRenderContext<TStatus>) => ReactNode
}

export function MigrationGuardShell<TStatus extends BaseMigrationStatus = BaseMigrationStatus>({
    children,
    entityId,
    isSkipRoute,
    statusQuery,
    dialogAriaId,
    loadingText,
    errorText,
    retryText,
    renderPreDialog,
    renderDialogTitle,
    renderDialogContent,
    renderDialogActions
}: MigrationGuardShellProps<TStatus>) {
    const [dismissed, setDismissed] = useState(false)
    const status = statusQuery.data

    // No entity ID — nothing to guard
    if (!entityId) {
        return <>{children}</>
    }

    // Admin/migrations route — skip the guard
    if (isSkipRoute) {
        return <>{children}</>
    }

    // Loading state
    if (statusQuery.isLoading) {
        return (
            <Stack spacing={1.5} alignItems='center' justifyContent='center' sx={{ minHeight: 260 }}>
                <CircularProgress size={22} />
                <Typography variant='body2'>{loadingText}</Typography>
            </Stack>
        )
    }

    // Error state
    if (statusQuery.error) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert
                    severity='error'
                    action={
                        <Button color='inherit' size='small' onClick={() => statusQuery.refetch()}>
                            {retryText}
                        </Button>
                    }
                >
                    {extractAxiosError(statusQuery.error).message || errorText}
                </Alert>
            </Box>
        )
    }

    // No migration needed — passthrough
    if (!status?.migrationRequired) {
        return <>{children}</>
    }

    // OPTIONAL severity — passthrough silently
    if (status.severity === UpdateSeverity.OPTIONAL) {
        return <>{children}</>
    }

    // User dismissed RECOMMENDED severity — passthrough
    if (dismissed) {
        return <>{children}</>
    }

    // Pre-dialog interceptor (e.g. UnderDevelopmentPage, MaintenancePage)
    if (renderPreDialog) {
        const intercepted = renderPreDialog(status)
        if (intercepted) {
            return <>{intercepted}</>
        }
    }

    const isMandatory = status.severity === UpdateSeverity.MANDATORY
    const hasBlockers = Boolean(status.blockers?.length)

    const ctx: GuardRenderContext<TStatus> = {
        status,
        isMandatory,
        hasBlockers,
        onDismiss: () => setDismissed(true),
        onRetry: () => statusQuery.refetch()
    }

    return (
        <Dialog open fullWidth maxWidth='sm' aria-describedby={dialogAriaId} onClose={!isMandatory ? () => setDismissed(true) : undefined}>
            {renderDialogTitle(ctx)}
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    {renderDialogContent(ctx)}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>{renderDialogActions(ctx)}</DialogActions>
        </Dialog>
    )
}
