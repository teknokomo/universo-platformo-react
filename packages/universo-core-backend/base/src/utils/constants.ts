/**
 * Flowise-specific constants.
 *
 * Note: WHITELIST_URLS has been moved to @universo/utils as API_WHITELIST_URLS.
 * Import from '@universo/utils' instead.
 */

export const OMIT_QUEUE_JOB_DATA = ['componentNodes', 'appDataSource', 'sseStreamer', 'telemetry', 'cachePool']

export const INPUT_PARAMS_TYPE = [
    'asyncOptions',
    'asyncMultiOptions',
    'options',
    'multiOptions',
    'datagrid',
    'string',
    'number',
    'boolean',
    'password',
    'json',
    'code',
    'date',
    'file',
    'folder',
    'tabs'
]
