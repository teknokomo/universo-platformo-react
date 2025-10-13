declare module '@ui/routes/AuthGuard' {
    import type { PropsWithChildren, ReactElement } from 'react'
    const AuthGuard: (props: PropsWithChildren) => ReactElement | null
    export default AuthGuard
}

declare module '@ui/ui-component/loading/Loadable' {
    import type { ComponentType, LazyExoticComponent } from 'react'
    export default function Loadable<T extends ComponentType<any> | LazyExoticComponent<ComponentType<any>>>(
        component: T
    ): T
}

declare module '@apps/uniks-frt/base/src/pages/UnikList' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@apps/profile-frt/base/src/pages/Profile.jsx' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}

declare module '@universo/metaverses-frt' {
    import type { ComponentType } from 'react'
    export const MetaverseList: ComponentType<any>
    export const MetaverseBoard: ComponentType<any>
    export const MetaverseAccess: ComponentType<any>
    export const SectionsList: ComponentType<any>
    export const SectionDetail: ComponentType<any>
    export const EntityList: ComponentType<any>
    export const EntityDetail: ComponentType<any>
}

declare module '@universo/resources-frt' {
    import type { ComponentType } from 'react'
    export const ClusterList: ComponentType<any>
}
