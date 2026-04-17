declare module '@ui/routes/AuthGuard' {
    import type { PropsWithChildren, ReactElement } from 'react'
    const AuthGuard: (props: PropsWithChildren) => ReactElement | null
    export default AuthGuard
}

declare module '@ui/ui-components/loading/Loadable' {
    import type { ComponentType, LazyExoticComponent } from 'react'
    export default function Loadable<T extends ComponentType<any> | LazyExoticComponent<ComponentType<any>>>(component: T): T
}

declare module '@universo/uniks-frontend/pages/UnikList' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@universo/profile-frontend/pages/Profile.jsx' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@universo/metaverses-frontend/pages/MetaverseList' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@universo/metaverses-frontend/pages/MetaverseBoard' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@universo/metaverses-frontend' {
    import type { ComponentType } from 'react'
    export const MetaverseList: ComponentType<any>
    export const MetaverseBoard: ComponentType<any>
    export const MetaverseDetail: ComponentType<any>
    export const SectionsList: ComponentType<any>
    export const SectionDetail: ComponentType<any>
    export const EntityDetail: ComponentType<any>
}

declare module '@universo/resources-frontend' {
    import type { ComponentType } from 'react'
    export const ClusterList: ComponentType<any>
}

declare module '@universo/metahubs-frontend' {
    import type { ComponentType } from 'react'
    export const MetahubList: ComponentType<any>
    export const MetahubBoard: ComponentType<any>
    export const MetahubMembers: ComponentType<any>
    export const PublicationList: ComponentType<any>
    export const PublicationVersionList: ComponentType<any>
    export const PublicationApplicationList: ComponentType<any>
    export const BranchList: ComponentType<any>
    export const EntitiesWorkspace: ComponentType<any>
    export const EntityInstanceList: ComponentType<any>
    export const BuiltinEntityCollectionPage: ComponentType<any>
    export const StandardEntityChildCollectionPage: ComponentType<any>
    export const SelectableOptionList: ComponentType<any>
    export const FieldDefinitionList: ComponentType<any>
    export const FixedValueList: ComponentType<any>
    export const RecordList: ComponentType<any>
    export const MetahubResources: ComponentType<any>
    export const MetahubLayouts: ComponentType<any>
    export const MetahubLayoutDetails: ComponentType<any>
    export const MetahubMigrations: ComponentType<any>
    export const MetahubMigrationGuard: ComponentType<any>
    export const MetahubSettings: ComponentType<any>
}
