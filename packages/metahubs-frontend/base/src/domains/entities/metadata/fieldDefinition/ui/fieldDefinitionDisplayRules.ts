export const shouldForceFirstAttributeDefaults = (attributeCount: number, sharedEntityMode = false): boolean =>
    !sharedEntityMode && attributeCount <= 1

export const shouldLockDisplayAttributeToggle = ({
    attributeCount,
    sharedEntityMode = false,
    isCurrentDisplayAttribute = false
}: {
    attributeCount: number
    sharedEntityMode?: boolean
    isCurrentDisplayAttribute?: boolean
}): boolean => !sharedEntityMode && (attributeCount <= 1 || isCurrentDisplayAttribute)
