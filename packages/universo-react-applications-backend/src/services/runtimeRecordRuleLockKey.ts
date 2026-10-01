/** Build one stable lock key for an application table regardless of identifier quoting. */
export const buildRuntimeRecordRuleLockKey = (schemaName: string, tableNameOrIdent: string): string => {
    const normalize = (value: string): string => value.replace(/"/g, '')
    const lastSegment = tableNameOrIdent.slice(tableNameOrIdent.lastIndexOf('.') + 1)
    return `runtime-record-rules:${normalize(schemaName)}.${normalize(lastSegment)}`
}
