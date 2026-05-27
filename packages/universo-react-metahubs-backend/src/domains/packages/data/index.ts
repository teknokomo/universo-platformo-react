import seedPackages from './seed-packages.json'
import type { MetahubPackageRegistryItem } from '@universo-react/types'

export type BuiltinPackageSeed = Omit<MetahubPackageRegistryItem, 'id' | 'isActive'>

export const builtinPackageSeeds = seedPackages as BuiltinPackageSeed[]
