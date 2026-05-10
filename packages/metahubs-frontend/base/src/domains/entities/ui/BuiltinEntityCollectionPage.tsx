import { useParams } from 'react-router-dom'
import { isBuiltinEntityKind, type BuiltinEntityKind } from '@universo/types'

import { LinkedCollectionListContent } from '../presets/ui/LinkedCollectionList'
import { OptionListContent } from '../presets/ui/OptionListList'
import { TreeEntityListContent } from '../presets/ui/TreeEntityList'
import { ValueGroupListContent } from '../presets/ui/ValueGroupList'
import EntityInstanceListContent from './EntityInstanceListContent'

const standardEntityCollectionViews: Record<BuiltinEntityKind, () => JSX.Element> = {
    catalog: LinkedCollectionListContent,
    hub: TreeEntityListContent,
    set: ValueGroupListContent,
    enumeration: OptionListContent,
    page: EntityInstanceListContent,
    ledger: EntityInstanceListContent
}

const renderStandardEntityCollection = (kindKey: BuiltinEntityKind | null) => {
    if (!kindKey) {
        return null
    }

    const View = standardEntityCollectionViews[kindKey]
    return <View />
}

export interface BuiltinEntityCollectionPageProps {
    kindKey?: string | null
}

export const BuiltinEntityCollectionPage = ({ kindKey }: BuiltinEntityCollectionPageProps = {}) => {
    const params = useParams<{ kindKey?: string }>()
    const resolvedKindKey = kindKey ?? params.kindKey ?? ''
    const standardKindKey = isBuiltinEntityKind(resolvedKindKey) ? resolvedKindKey : null

    return renderStandardEntityCollection(standardKindKey)
}

export interface StandardEntityChildCollectionPageProps {
    childKind?: BuiltinEntityKind
}

export const StandardEntityChildCollectionPage = ({ childKind }: StandardEntityChildCollectionPageProps) => {
    const params = useParams<{ kindKey?: string; treeEntityId?: string }>()
    const resolvedKindKey = childKind ?? (isBuiltinEntityKind(params.kindKey ?? '') ? params.kindKey : null)
    if (params.treeEntityId && resolvedKindKey !== 'hub') {
        return <EntityInstanceListContent />
    }

    return renderStandardEntityCollection(resolvedKindKey)
}

export default BuiltinEntityCollectionPage
