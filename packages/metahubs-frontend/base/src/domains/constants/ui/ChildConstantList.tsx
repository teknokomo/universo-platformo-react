import { FC } from 'react'

interface ChildConstantListProps {
    metahubId: string
    hubId?: string
    setId: string
    parentConstantId: string
    searchFilter?: string
    onRefresh?: () => Promise<void> | void
}

const ChildConstantList: FC<ChildConstantListProps> = () => {
    return null
}

export default ChildConstantList
