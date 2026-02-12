import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { extractAxiosError } from '@universo/utils'
import * as migrationsApi from '../api'
import { metahubsQueryKeys } from '../../shared'
import type { TemplateCleanupMode } from '../api'

interface ApplyMetahubMigrationsParams {
    metahubId: string
    branchId?: string
    targetTemplateVersionId?: string
    dryRun?: boolean
    cleanupMode?: TemplateCleanupMode
}

export function useApplyMetahubMigrations() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, branchId, targetTemplateVersionId, dryRun, cleanupMode }: ApplyMetahubMigrationsParams) =>
            migrationsApi.applyMetahubMigrations(metahubId, { branchId, targetTemplateVersionId, dryRun, cleanupMode }),
        retry: false,
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.migrations(variables.metahubId) })
            const cleanupMode = variables.cleanupMode ?? 'keep'
            const previousPlan = queryClient.getQueryData(
                metahubsQueryKeys.migrationsPlan(variables.metahubId, variables.branchId, cleanupMode)
            )
            return { previousPlan }
        },
        onError: (error: Error, variables, context) => {
            const cleanupMode = variables.cleanupMode ?? 'keep'
            if (context?.previousPlan) {
                queryClient.setQueryData(
                    metahubsQueryKeys.migrationsPlan(variables.metahubId, variables.branchId, cleanupMode),
                    context.previousPlan
                )
            }
            enqueueSnackbar(extractAxiosError(error) || t('migrations.messages.applyError', 'Failed to apply migrations'), {
                variant: 'error'
            })
        },
        onSuccess: (data, variables) => {
            const cleanupMode = variables.cleanupMode ?? 'keep'
            const planKey = metahubsQueryKeys.migrationsPlan(variables.metahubId, variables.branchId, cleanupMode)
            const listKey = metahubsQueryKeys.migrations(variables.metahubId)
            const statusKey = metahubsQueryKeys.migrationsStatus(variables.metahubId, variables.branchId, cleanupMode)
            const invalidatePlan = () =>
                queryClient.invalidateQueries({
                    queryKey: planKey
                })

            if (data.status === 'dry_run') {
                invalidatePlan()
            } else {
                queryClient.invalidateQueries({ queryKey: listKey })
                invalidatePlan()
                queryClient.invalidateQueries({
                    queryKey: statusKey,
                    refetchType: 'none'
                })
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.detail(variables.metahubId),
                    refetchType: 'none'
                })
            }

            const message =
                data.status === 'dry_run'
                    ? t('migrations.messages.dryRunReady', 'Migration plan is ready')
                    : t('migrations.messages.applySuccess', 'Migrations applied successfully')
            enqueueSnackbar(message, { variant: 'success' })
        }
    })
}
