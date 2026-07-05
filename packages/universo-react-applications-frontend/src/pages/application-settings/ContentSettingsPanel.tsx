import { Alert, Box, Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material'
import {
    COURSE_COMPLETION_CONDITIONS,
    COURSE_NAVIGATION_MODES,
    COURSE_STATUS_FORMATS,
    RESOURCE_TYPES,
    TRACK_ORDER_MODES
} from '@universo-react/types'
import type { ApplicationLearningContentSettings, ResourceType } from '@universo-react/types'
import type { TFunction } from 'i18next'
import { SaveSettingsButton, testIdInputProps } from './SettingsPanels'

const LEARNING_CONTENT_COLUMN_FIELDS = [
    'Title',
    'ResourceType',
    'PublicationStatus',
    'Instructor',
    'ProjectId',
    'UpdatedAt',
    'CreatedBy'
] as const

type Translate = TFunction<'applications'>
type SaveHandler = () => void

export const ContentSettingsPanel = ({
    t,
    settings,
    hasChanges,
    isSaving,
    onUpdateSettings,
    onUpdateResourceType,
    onSave
}: {
    t: Translate
    settings: ApplicationLearningContentSettings
    hasChanges: boolean
    isSaving: boolean
    onUpdateSettings: (updater: (current: ApplicationLearningContentSettings) => ApplicationLearningContentSettings) => void
    onUpdateResourceType: (
        resourceType: ResourceType,
        patch: Partial<ApplicationLearningContentSettings['supportedResourceTypes'][number]>
    ) => void
    onSave: SaveHandler
}) => (
    <Stack spacing={2}>
        <Alert severity='info'>
            {t(
                'settings.learningContentHint',
                'Configure default Learning Content behavior for published workspaces. Workspace authors can still tune individual records where permissions allow it.'
            )}
        </Alert>

        <Stack spacing={0} divider={<Divider />}>
            <Box
                data-testid='application-setting-learning-content-default-view'
                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.learningContent.defaultView', 'Default content view')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.learningContent.defaultViewDescription',
                            'Choose the first view mode for Learning Content project libraries.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small' sx={{ minWidth: 220 }}>
                    <InputLabel>{t('settings.learningContent.defaultView', 'Default content view')}</InputLabel>
                    <Select
                        value={settings.defaultView}
                        label={t('settings.learningContent.defaultView', 'Default content view')}
                        onChange={(event) =>
                            onUpdateSettings((current) => ({
                                ...current,
                                defaultView: event.target.value as ApplicationLearningContentSettings['defaultView']
                            }))
                        }
                    >
                        <MenuItem value='table'>{t('settings.learningContent.views.table', 'Table')}</MenuItem>
                        <MenuItem value='cards'>{t('settings.learningContent.views.cards', 'Cards')}</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-learning-content-resource-types' sx={{ py: 2 }}>
                <Typography variant='subtitle2'>{t('settings.learningContent.resourceTypes', 'Resource types')}</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    {t(
                        'settings.learningContent.resourceTypesDescription',
                        'Enable only resource types that have safe runtime behavior. Deferred types stay visible as unsupported placeholders.'
                    )}
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.5
                    }}
                >
                    {RESOURCE_TYPES.map((resourceType) => {
                        const item = settings.supportedResourceTypes.find((candidate) => candidate.resourceType === resourceType) ?? {
                            resourceType,
                            enabled: true,
                            deferred: resourceType === 'scorm' || resourceType === 'xapi' || resourceType === 'file'
                        }

                        return (
                            <Box
                                key={resourceType}
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    px: 1.5,
                                    py: 1,
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                                    alignItems: 'center',
                                    gap: 1
                                }}
                            >
                                <Typography variant='body2' sx={{ textTransform: 'capitalize' }}>
                                    {t(`settings.learningContent.resourceTypeLabels.${resourceType}`, resourceType)}
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size='small'
                                            checked={item.enabled}
                                            onChange={(event) =>
                                                onUpdateResourceType(resourceType, {
                                                    enabled: event.target.checked
                                                })
                                            }
                                            slotProps={{
                                                input: testIdInputProps(
                                                    `application-settings-learning-content-resource-${resourceType}-enabled`
                                                )
                                            }}
                                        />
                                    }
                                    label={t('settings.learningContent.enabled', 'Enabled')}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size='small'
                                            checked={item.deferred}
                                            onChange={(event) =>
                                                onUpdateResourceType(resourceType, {
                                                    deferred: event.target.checked
                                                })
                                            }
                                            slotProps={{
                                                input: testIdInputProps(
                                                    `application-settings-learning-content-resource-${resourceType}-deferred`
                                                )
                                            }}
                                        />
                                    }
                                    label={t('settings.learningContent.deferred', 'Deferred')}
                                />
                            </Box>
                        )
                    })}
                </Box>
            </Box>

            <Box
                data-testid='application-setting-learning-content-course-policy'
                sx={{
                    py: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) repeat(3, minmax(170px, 0.35fr))' },
                    gap: 2,
                    alignItems: 'center'
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.learningContent.coursePolicy', 'Course completion policy')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.learningContent.coursePolicyDescription',
                            'Defaults for course navigation, completion calculation, and status display.'
                        )}
                    </Typography>
                </Box>
                <FormControl size='small'>
                    <InputLabel>{t('settings.learningContent.navigationMode', 'Navigation')}</InputLabel>
                    <Select
                        value={settings.courseCompletionPolicy.navigationMode}
                        label={t('settings.learningContent.navigationMode', 'Navigation')}
                        onChange={(event) =>
                            onUpdateSettings((current) => ({
                                ...current,
                                courseCompletionPolicy: {
                                    ...current.courseCompletionPolicy,
                                    navigationMode: event.target
                                        .value as ApplicationLearningContentSettings['courseCompletionPolicy']['navigationMode']
                                }
                            }))
                        }
                    >
                        {COURSE_NAVIGATION_MODES.map((mode) => (
                            <MenuItem key={mode} value={mode}>
                                {t(`settings.learningContent.navigationModes.${mode}`, mode)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size='small'>
                    <InputLabel>{t('settings.learningContent.completionCondition', 'Completion')}</InputLabel>
                    <Select
                        value={settings.courseCompletionPolicy.completionCondition}
                        label={t('settings.learningContent.completionCondition', 'Completion')}
                        onChange={(event) =>
                            onUpdateSettings((current) => ({
                                ...current,
                                courseCompletionPolicy: {
                                    ...current.courseCompletionPolicy,
                                    completionCondition: event.target
                                        .value as ApplicationLearningContentSettings['courseCompletionPolicy']['completionCondition']
                                }
                            }))
                        }
                    >
                        {COURSE_COMPLETION_CONDITIONS.map((condition) => (
                            <MenuItem key={condition} value={condition}>
                                {t(`settings.learningContent.completionConditions.${condition}`, condition)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size='small'>
                    <InputLabel>{t('settings.learningContent.statusFormat', 'Status')}</InputLabel>
                    <Select
                        value={settings.courseCompletionPolicy.statusFormat}
                        label={t('settings.learningContent.statusFormat', 'Status')}
                        onChange={(event) =>
                            onUpdateSettings((current) => ({
                                ...current,
                                courseCompletionPolicy: {
                                    ...current.courseCompletionPolicy,
                                    statusFormat: event.target
                                        .value as ApplicationLearningContentSettings['courseCompletionPolicy']['statusFormat']
                                }
                            }))
                        }
                    >
                        {COURSE_STATUS_FORMATS.map((format) => (
                            <MenuItem key={format} value={format}>
                                {t(`settings.learningContent.statusFormats.${format}`, format)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            <Box
                data-testid='application-setting-learning-content-track-policy'
                sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.learningContent.trackPolicy', 'Learning track order')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.learningContent.trackPolicyDescription',
                            'Default order behavior used when a new learning track is created.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.trackOrderPolicy.restrictAfterDueDate}
                            onChange={(event) =>
                                onUpdateSettings((current) => ({
                                    ...current,
                                    trackOrderPolicy: {
                                        ...current.trackOrderPolicy,
                                        restrictAfterDueDate: event.target.checked
                                    }
                                }))
                            }
                            slotProps={{
                                input: testIdInputProps('application-settings-learning-content-track-restrict-after-due-date')
                            }}
                        />
                    }
                    label={t('settings.learningContent.restrictAfterDueDate', 'Restrict after due date')}
                />
                <FormControl size='small' sx={{ minWidth: 200 }}>
                    <InputLabel>{t('settings.learningContent.orderMode', 'Order')}</InputLabel>
                    <Select
                        value={settings.trackOrderPolicy.orderMode}
                        label={t('settings.learningContent.orderMode', 'Order')}
                        onChange={(event) =>
                            onUpdateSettings((current) => ({
                                ...current,
                                trackOrderPolicy: {
                                    ...current.trackOrderPolicy,
                                    orderMode: event.target.value as ApplicationLearningContentSettings['trackOrderPolicy']['orderMode']
                                }
                            }))
                        }
                    >
                        {TRACK_ORDER_MODES.map((mode) => (
                            <MenuItem key={mode} value={mode}>
                                {t(`settings.learningContent.orderModes.${mode}`, mode)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            <Box data-testid='application-setting-learning-content-player' sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>{t('settings.learningContent.player', 'Player preset')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'settings.learningContent.playerDescription',
                            'Controls the default learner player chrome for pages, links, courses, and tracks.'
                        )}
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.playerPreset?.showOutline !== false}
                            onChange={(event) =>
                                onUpdateSettings((current) => ({
                                    ...current,
                                    playerPreset: {
                                        ...current.playerPreset!,
                                        showOutline: event.target.checked
                                    }
                                }))
                            }
                        />
                    }
                    label={t('settings.learningContent.showOutline', 'Outline')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={settings.playerPreset?.showProgressHeader !== false}
                            onChange={(event) =>
                                onUpdateSettings((current) => ({
                                    ...current,
                                    playerPreset: {
                                        ...current.playerPreset!,
                                        showProgressHeader: event.target.checked
                                    }
                                }))
                            }
                        />
                    }
                    label={t('settings.learningContent.showProgressHeader', 'Progress')}
                />
            </Box>

            <Box data-testid='application-setting-learning-content-columns' sx={{ py: 2 }}>
                <Typography variant='subtitle2'>{t('settings.learningContent.columns', 'Default columns')}</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                    {t(
                        'settings.learningContent.columnsDescription',
                        'Choose the default visible columns for Learning Content library tables.'
                    )}
                </Typography>
                <Stack direction='row' flexWrap='wrap' gap={1}>
                    {LEARNING_CONTENT_COLUMN_FIELDS.map((field) => {
                        const column = settings.columnPreset?.columns.find((item) => item.field === field)
                        const visible = column?.visible !== false
                        return (
                            <FormControlLabel
                                key={field}
                                control={
                                    <Switch
                                        size='small'
                                        checked={visible}
                                        onChange={(event) =>
                                            onUpdateSettings((current) => {
                                                const existingColumns = current.columnPreset?.columns ?? []
                                                const columns = LEARNING_CONTENT_COLUMN_FIELDS.map((candidate) => {
                                                    const existing = existingColumns.find((item) => item.field === candidate)
                                                    return {
                                                        field: candidate,
                                                        visible: candidate === field ? event.target.checked : existing?.visible !== false,
                                                        ...(existing?.width ? { width: existing.width } : {}),
                                                        ...(existing?.flex ? { flex: existing.flex } : {})
                                                    }
                                                })
                                                return {
                                                    ...current,
                                                    columnPreset: {
                                                        ...(current.columnPreset ?? {
                                                            codename: 'learningContentDefault',
                                                            title: 'Learning Content default'
                                                        }),
                                                        columns
                                                    }
                                                }
                                            })
                                        }
                                        slotProps={{
                                            input: testIdInputProps(`application-settings-learning-content-column-${field}`)
                                        }}
                                    />
                                }
                                label={t(`settings.learningContent.columnLabels.${field}`, field)}
                            />
                        )
                    })}
                </Stack>
            </Box>
        </Stack>

        {hasChanges ? (
            <SaveSettingsButton testId='application-settings-learning-content-save' t={t} disabled={isSaving} onSave={onSave} />
        ) : null}
    </Stack>
)
