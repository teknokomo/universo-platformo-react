export const shouldForceFirstComponentDefaults = (componentCount: number, sharedEntityMode = false): boolean =>
    !sharedEntityMode && componentCount <= 1

export const shouldLockDisplayComponentToggle = ({
    componentCount,
    sharedEntityMode = false,
    isCurrentDisplayComponent = false
}: {
    componentCount: number
    sharedEntityMode?: boolean
    isCurrentDisplayComponent?: boolean
}): boolean => !sharedEntityMode && (componentCount <= 1 || isCurrentDisplayComponent)
