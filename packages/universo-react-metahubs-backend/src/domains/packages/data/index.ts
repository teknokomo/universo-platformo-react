import seedPackages from './seed-packages.json'
import type { MetahubPackageRegistryItem } from '@universo-react/types'

export type BuiltinPackageSeed = Omit<MetahubPackageRegistryItem, 'id' | 'isActive' | 'authoringSurface'> &
    Partial<Pick<MetahubPackageRegistryItem, 'authoringSurface'>>

export const builtinPackageSeeds = seedPackages as BuiltinPackageSeed[]
