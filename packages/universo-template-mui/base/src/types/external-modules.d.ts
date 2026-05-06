declare module '@ui/routes/AuthGuard' {
    import type { PropsWithChildren, ReactElement } from 'react'
    const AuthGuard: (props: PropsWithChildren) => ReactElement | null
    export default AuthGuard
}

declare module '@ui/ui-components/loading/Loadable' {
    import type { ComponentType, LazyExoticComponent } from 'react'
    type GenericComponent = ComponentType<Record<string, unknown>>
    export default function Loadable<T extends GenericComponent | LazyExoticComponent<GenericComponent>>(component: T): T
}

declare module '@universo/uniks-frontend/pages/UnikList' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<Record<string, unknown>>
    export default Component
}

declare module '@universo/profile-frontend/pages/Profile.jsx' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<Record<string, unknown>>
    export default Component
}

declare module '@universo/metaverses-frontend/pages/MetaverseList' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<Record<string, unknown>>
    export default Component
}

declare module '@universo/metaverses-frontend/pages/MetaverseBoard' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<Record<string, unknown>>
    export default Component
}

declare module '@universo/metaverses-frontend' {
    import type { ComponentType } from 'react'
    type GenericComponent = ComponentType<Record<string, unknown>>
    export const MetaverseList: GenericComponent
    export const MetaverseBoard: GenericComponent
    export const MetaverseDetail: GenericComponent
    export const SectionsList: GenericComponent
    export const SectionDetail: GenericComponent
    export const EntityDetail: GenericComponent
}

declare module '@universo/resources-frontend' {
    import type { ComponentType } from 'react'
    export const ClusterList: ComponentType<Record<string, unknown>>
}

declare module '@universo/metahubs-frontend' {
    import type { ComponentType } from 'react'
    type GenericComponent = ComponentType<Record<string, unknown>>
    export const MetahubList: GenericComponent
    export const MetahubBoard: GenericComponent
    export const MetahubMembers: GenericComponent
    export const PublicationList: GenericComponent
    export const PublicationVersionList: GenericComponent
    export const PublicationApplicationList: GenericComponent
    export const BranchList: GenericComponent
    export const EntitiesWorkspace: GenericComponent
    export const EntityInstanceList: GenericComponent
    export const BuiltinEntityCollectionPage: GenericComponent
    export const StandardEntityChildCollectionPage: GenericComponent
    export const SelectableOptionList: GenericComponent
    export const FieldDefinitionList: GenericComponent
    export const FixedValueList: GenericComponent
    export const RecordList: GenericComponent
    export const MetahubResources: GenericComponent
    export const MetahubLayouts: GenericComponent
    export const MetahubLayoutDetails: GenericComponent
    export const MetahubMigrations: GenericComponent
    export const MetahubMigrationGuard: GenericComponent
    export const MetahubSettings: GenericComponent
}
