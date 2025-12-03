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

declare module '@flowise/tools-frontend/pages/Tools' {
    import type { ComponentType } from 'react'
    const Component: ComponentType<any>
    export default Component
}
