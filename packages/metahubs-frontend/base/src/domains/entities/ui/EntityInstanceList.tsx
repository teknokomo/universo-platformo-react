import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { isBuiltinEntityKind } from '@universo/types'

import { BuiltinEntityCollectionPage } from './BuiltinEntityCollectionPage'
import EntityInstanceListContent from './EntityInstanceListContent'
import { decodeKindKey } from './entityInstanceListHelpers'

const EntityInstanceList = () => {
    const { kindKey: routeKindKey } = useParams<{ metahubId: string; kindKey: string }>()
    const resolvedKindKey = useMemo(() => decodeKindKey(routeKindKey), [routeKindKey])

    if (isBuiltinEntityKind(resolvedKindKey)) {
        return <BuiltinEntityCollectionPage kindKey={resolvedKindKey} />
    }

    return <EntityInstanceListContent />
}

export default EntityInstanceList
