import { FC } from 'react'

interface ChildFixedValueListProps {
    metahubId: string
    treeEntityId?: string
    valueGroupId: string
    parentConstantId: string
    searchFilter?: string
    onRefresh?: () => Promise<void> | void
}

const ChildFixedValueList: FC<ChildFixedValueListProps> = () => {
    return null
}

export default ChildFixedValueList
