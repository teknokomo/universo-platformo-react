import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { BuiltinEntityCollectionPage } from './BuiltinEntityCollectionPage'
import EntityInstanceListContent from './EntityInstanceListContent'
import { decodeKindKey, isStandardEntityMetadataKind } from './entityInstanceListHelpers'

const EntityInstanceList = () => {
    const { kindKey: routeKindKey } = useParams<{ metahubId: string; kindKey: string }>()
    const resolvedKindKey = useMemo(() => decodeKindKey(routeKindKey), [routeKindKey])

    if (isStandardEntityMetadataKind(resolvedKindKey)) {
        return <BuiltinEntityCollectionPage kindKey={resolvedKindKey} />
    }

    return <EntityInstanceListContent />
}

export default EntityInstanceList
