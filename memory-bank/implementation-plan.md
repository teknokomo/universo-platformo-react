# Implementation Plan - JSX→TSX Migration & Role System (Post-QA)

**Date**: 2025-10-31  
**Status**: Ready for Implementation  
**QA Score**: 8/10 (Excellent after CSP removal)

---

## 📋 Executive Summary

**Scope**: Migrate 3 JSX components to TypeScript, create centralized role types, build RoleChip component.

**QA Decision**: ✅ Phases 1-3 approved | ❌ Phase 4 (CSP) removed

**Estimated Time**: 4-6 hours  
**Packages Modified**: 6 (universo-types, universo-template-mui, metaverses-frt, metaverses-srv, flowise-server)

---

## ✅ Phase 1: Centralized Role Types (CRITICAL)

**Priority**: 🔥 **CRITICAL** - Foundation for all other tasks  
**Time**: 45 minutes  
**Impact**: Eliminates role type duplication across 3 packages

### Task 1.1: Create universo-types/common/roles.ts

**File**: `packages/universo-types/base/src/common/roles.ts`

**Implementation**:
```typescript
/**
 * Universal role types and utilities for Universo Platformo
 * Provides consistent role definitions across all packages
 */

// Base role hierarchy (used by all entity types)
export const BASE_ROLES = ['owner', 'admin', 'editor', 'member'] as const
export type BaseRole = typeof BASE_ROLES[number]

// Role hierarchy levels (higher = more permissions)
export const ROLE_HIERARCHY: Record<BaseRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    member: 1
}

// Entity-specific role types
export type MetaverseRole = BaseRole
export type UnikRole = BaseRole
export type SectionRole = Exclude<BaseRole, 'owner'> // Sections don't have separate owners
export type EntityRole = 'viewer' | 'editor' // Entities have simpler roles

// Role permission interfaces
export interface BasePermissions {
    manageMembers: boolean
    manageEntity: boolean
    createContent: boolean
    editContent: boolean
    deleteContent: boolean
}

export interface RolePermissions extends Record<BaseRole, BasePermissions> {}

// Type guards
export function isValidRole(role: string): role is BaseRole {
    return BASE_ROLES.includes(role as BaseRole)
}

export function isValidMetaverseRole(role: string): role is MetaverseRole {
    return isValidRole(role)
}

export function isValidUnikRole(role: string): role is UnikRole {
    return isValidRole(role)
}

// Role comparison utilities
export function getRoleLevel(role: BaseRole): number {
    return ROLE_HIERARCHY[role]
}

export function hasRequiredRole(actual: BaseRole, allowed: BaseRole[] = []): boolean {
    if (!allowed.length) return true
    if (allowed.includes(actual)) return true
    const actualLevel = getRoleLevel(actual)
    return allowed.some(allowedRole => actualLevel > getRoleLevel(allowedRole))
}

export function canManageRole(managerRole: BaseRole, targetRole: BaseRole): boolean {
    return getRoleLevel(managerRole) > getRoleLevel(targetRole)
}
```

- [ ] Create file with implementation above
- [ ] Export from `packages/universo-types/base/src/index.ts`:
  ```typescript
  export * from './common/roles'
  ```
- [ ] Build: `pnpm --filter @universo/types build`

---

### Task 1.2: Update dependent packages

**Files Modified**: 4

**1. metaverses-frt/base/src/types.ts**:
```typescript
// OLD (DELETE):
// export type MetaverseRole = 'owner' | 'admin' | 'editor' | 'member'
// export type MetaverseAssignableRole = Exclude<MetaverseRole, 'owner'>

// NEW (ADD):
export type { MetaverseRole } from '@universo/types'
export type MetaverseAssignableRole = Exclude<MetaverseRole, 'owner'>

// Keep rest of the file unchanged (MetaversePermissions, MetaverseMember, etc.)
```

**2. metaverses-srv/base/src/routes/guards.ts**:
```typescript
// OLD (DELETE lines 9-11):
// export const ROLE_PERMISSIONS = { ... }
// export type MetaverseRole = keyof typeof ROLE_PERMISSIONS
// export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

// NEW (ADD at top):
import { MetaverseRole, ROLE_HIERARCHY, getRoleLevel } from '@universo/types'

export type RolePermission = keyof (typeof ROLE_PERMISSIONS)['owner']

export const ROLE_PERMISSIONS = {
    owner: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
} as const satisfies Record<MetaverseRole, Record<RolePermission, boolean>>

// Keep rest unchanged (assertPermission, getMetaverseMembership, etc.)
```

**3. flowise-server/src/services/access-control/roles.ts**:
```typescript
// OLD (DELETE lines 8-19):
// export const UNIK_ROLES = ['owner', 'admin', 'editor', 'member'] as const
// export type UnikRole = typeof UNIK_ROLES[number]
// export const ROLE_HIERARCHY: Record<UnikRole, number> = { ... }

// NEW (ADD at top):
import { UnikRole, ROLE_HIERARCHY, getRoleLevel, hasRequiredRole as baseHasRequiredRole } from '@universo/types'

export const UNIK_ROLES = ['owner', 'admin', 'editor', 'member'] as const

// Keep functions, but use imported utilities:
export function hasRequiredRole(actual: UnikRole, allowed: UnikRole[] = []): boolean {
    return baseHasRequiredRole(actual, allowed)
}

export function isValidUnikRole(role: string): role is UnikRole {
    return UNIK_ROLES.includes(role as UnikRole)
}

export { getRoleLevel }
```

- [ ] Update all 3 files
- [ ] Build packages: `pnpm --filter @universo/metaverses-frt build`
- [ ] Build packages: `pnpm --filter @universo/metaverses-srv build`
- [ ] Build packages: `pnpm --filter flowise-server build`
- [ ] Verify no TypeScript errors

---

## ✅ Phase 2: RoleChip Component (HIGH)

**Priority**: 🔥 **HIGH** - Eliminates inline Chip duplication  
**Time**: 30 minutes  
**Impact**: Reusable component with i18n + color mapping

### Task 2.1: Create RoleChip component

**File**: `packages/universo-template-mui/base/src/components/chips/RoleChip.tsx`

```typescript
import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import type { BaseRole } from '@universo/types'

export interface RoleChipProps {
    role: BaseRole
    size?: 'small' | 'medium'
    variant?: 'filled' | 'outlined'
    className?: string
}

const ROLE_COLOR_MAP: Record<BaseRole, ChipProps['color']> = {
    owner: 'error',
    admin: 'warning',
    editor: 'info',
    member: 'default'
}

export const RoleChip: React.FC<RoleChipProps> = ({
    role,
    size = 'small',
    variant = 'filled',
    className
}) => {
    const { t } = useTranslation('roles', { i18n })

    return (
        <Chip
            label={t(role)}
            color={ROLE_COLOR_MAP[role]}
            size={size}
            variant={variant}
            className={className}
        />
    )
}
```

- [ ] Create file
- [ ] Export from `packages/universo-template-mui/base/src/components/chips/index.ts`:
  ```typescript
  export * from './RoleChip'
  ```
- [ ] Export from `packages/universo-template-mui/base/src/index.ts`:
  ```typescript
  export { RoleChip } from './components/chips'
  export type { RoleChipProps } from './components/chips'
  ```

### Task 2.2: Update MetaverseList to use RoleChip

**File**: `packages/metaverses-frt/base/src/pages/MetaverseList.tsx`

```typescript
// ADD import:
import { RoleChip } from '@universo/template-mui'

// REPLACE inline Chip (around line 180):
// OLD:
// <Chip
//     label={t(`roles:${row.role || 'member'}`)}
//     size="small"
//     color={
//         row.role === 'owner' ? 'error' :
//         row.role === 'admin' ? 'warning' :
//         row.role === 'editor' ? 'info' : 'default'
//     }
// />

// NEW:
<RoleChip role={row.role || 'member'} />
```

- [ ] Update import
- [ ] Replace inline Chip with RoleChip
- [ ] Build: `pnpm --filter @universo/template-mui build`
- [ ] Build: `pnpm --filter @universo/metaverses-frt build`

---

## ✅ Phase 3: JSX → TSX Migration (HIGH)

**Priority**: 🔥 **HIGH** - Modern TypeScript patterns  
**Time**: 2.5 hours  
**Impact**: Type safety + eliminates PropTypes

### Task 3.1: Migrate ItemCard.jsx → ItemCard.tsx

**File**: `packages/universo-template-mui/base/src/components/cards/ItemCard.tsx`

**Steps**:
1. [ ] Read current `ItemCard.jsx` (196 LOC)
2. [ ] Create new `ItemCard.tsx` with generic types:

```typescript
import React from 'react'
import { Card, CardHeader, CardContent, Box, type SxProps, type Theme } from '@mui/material'
import { styled } from '@mui/material/styles'

export interface ItemCardData {
    id: string
    [key: string]: any
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    title?: React.ReactNode
    subtitle?: React.ReactNode
    headerAction?: React.ReactNode
    headerEndContent?: React.ReactNode
    children: React.ReactNode
    footerStartContent?: React.ReactNode
    footerEndContent?: React.ReactNode
    onClick?: (data: T) => void
    data?: T
    selected?: boolean
    sx?: SxProps<Theme>
    contentSx?: SxProps<Theme>
    border?: boolean
    borderColor?: string
    secondaryAction?: React.ReactNode
}

const CardWrapper = styled(Card, {
    shouldForwardProp: (prop) => prop !== 'border' && prop !== 'borderColor' && prop !== 'selected'
})<{ border?: boolean; borderColor?: string; selected?: boolean }>(
    ({ theme, border, borderColor, selected }) => ({
        cursor: 'pointer',
        overflow: 'visible',
        position: 'relative',
        border: border ? `1px solid ${borderColor || theme.palette.divider}` : undefined,
        backgroundColor: selected
            ? theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[50]
            : theme.palette.background.paper,
        '&:hover': {
            boxShadow: theme.shadows[4]
        }
    })
)

export function ItemCard<T extends ItemCardData = ItemCardData>({
    title,
    subtitle,
    headerAction,
    headerEndContent,
    children,
    footerStartContent,
    footerEndContent,
    onClick,
    data,
    selected = false,
    sx,
    contentSx,
    border = true,
    borderColor,
    secondaryAction
}: ItemCardProps<T>) {
    const handleClick = () => {
        if (onClick && data) {
            onClick(data)
        }
    }

    const showHeader = title || subtitle || headerAction || headerEndContent
    const showFooter = footerStartContent || footerEndContent

    return (
        <CardWrapper
            border={border}
            borderColor={borderColor}
            selected={selected}
            onClick={handleClick}
            sx={sx}
        >
            {showHeader && (
                <CardHeader
                    title={title}
                    subheader={subtitle}
                    action={
                        <>
                            {headerAction}
                            {headerEndContent}
                        </>
                    }
                    secondaryAction={secondaryAction}
                />
            )}
            <CardContent sx={contentSx}>
                {children}
            </CardContent>
            {showFooter && (
                <Box
                    sx={{
                        p: 2,
                        pt: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    {footerStartContent}
                    {footerEndContent}
                </Box>
            )}
        </CardWrapper>
    )
}
```

3. [ ] Delete `ItemCard.jsx`
4. [ ] Delete `ItemCard.d.ts` (obsolete)
5. [ ] Update exports in `packages/universo-template-mui/base/src/components/cards/index.ts`
6. [ ] Build: `pnpm --filter @universo/template-mui build`

---

### Task 3.2: Migrate MainCard.jsx → MainCard.tsx

**File**: `packages/universo-template-mui/base/src/components/cards/MainCard.tsx`

**Steps**:
1. [ ] Read current `MainCard.jsx` (92 LOC)
2. [ ] Create new `MainCard.tsx`:

```typescript
import React from 'react'
import { Card, CardHeader, CardContent, Divider, Typography, type SxProps, type Theme } from '@mui/material'

export interface MainCardProps {
    border?: boolean
    boxShadow?: boolean
    children?: React.ReactNode
    content?: boolean
    contentClass?: string
    contentSX?: SxProps<Theme>
    darkTitle?: boolean
    disableContentPadding?: boolean
    disableHeader?: boolean
    secondary?: React.ReactNode
    shadow?: string
    sx?: SxProps<Theme>
    title?: React.ReactNode
}

export const MainCard = React.forwardRef<HTMLDivElement, MainCardProps>(
    (
        {
            border = true,
            boxShadow = false,
            children,
            content = true,
            contentClass = '',
            contentSX = {},
            darkTitle = false,
            disableContentPadding = false,
            disableHeader = false,
            secondary,
            shadow,
            sx = {},
            title,
            ...others
        },
        ref
    ) => {
        const headerSX: SxProps<Theme> = {
            '& .MuiCardHeader-action': { mr: 0 }
        }

        return (
            <Card
                ref={ref}
                {...others}
                sx={{
                    boxShadow: shadow === false ? 'none' : undefined,
                    border: border === false ? 'none' : undefined,
                    ':hover': {
                        boxShadow: boxShadow ? shadow || '0 2px 14px 0 rgb(32 40 45 / 8%)' : 'inherit'
                    },
                    maxWidth: disableHeader ? '100%' : '1280px',
                    mx: disableHeader ? undefined : 'auto',
                    ...sx
                }}
            >
                {!disableHeader && !darkTitle && title && (
                    <CardHeader sx={headerSX} title={title} action={secondary} />
                )}
                {!disableHeader && darkTitle && title && (
                    <CardHeader
                        sx={headerSX}
                        title={<Typography variant="h3">{title}</Typography>}
                        action={secondary}
                    />
                )}

                {!disableHeader && title && <Divider />}

                {content && (
                    <CardContent
                        sx={disableContentPadding ? { px: 0, py: 0, ...contentSX } : contentSX}
                        className={contentClass}
                    >
                        {children}
                    </CardContent>
                )}
                {!content && children}
            </Card>
        )
    }
)

MainCard.displayName = 'MainCard'
```

3. [ ] Delete `MainCard.jsx`
4. [ ] Update exports
5. [ ] Build: `pnpm --filter @universo/template-mui build`

---

### Task 3.3: Migrate FlowListTable.jsx → FlowListTable.tsx

**File**: `packages/universo-template-mui/base/src/components/table/FlowListTable.tsx`

**Steps**:
1. [ ] Read current `FlowListTable.jsx` (~200 LOC)
2. [ ] Create new `FlowListTable.tsx`:

```typescript
import React from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    type SxProps,
    type Theme
} from '@mui/material'
import { MoreVert as MoreVertIcon } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'

export interface TableColumn<T> {
    id: string
    label: string | React.ReactNode
    width?: string | number
    align?: 'left' | 'center' | 'right'
    render?: (row: T) => React.ReactNode
}

export interface FlowListTableProps<T extends { id: string }> {
    data: T[]
    i18nNamespace: string
    customColumns?: TableColumn<T>[]
    renderActions?: (row: T) => React.ReactNode
    onRowClick?: (row: T) => void
    sx?: SxProps<Theme>
}

export function FlowListTable<T extends { id: string; name?: string; description?: string }>({
    data,
    i18nNamespace,
    customColumns = [],
    renderActions,
    onRowClick,
    sx
}: FlowListTableProps<T>) {
    const { t } = useTranslation(i18nNamespace, { i18n })

    const defaultColumns: TableColumn<T>[] = [
        {
            id: 'name',
            label: t('table.columns.name'),
            render: (row) => row.name || '-'
        },
        {
            id: 'description',
            label: t('table.columns.description'),
            render: (row) => row.description || '-'
        }
    ]

    const columns = customColumns.length > 0 ? customColumns : defaultColumns

    return (
        <TableContainer component={Paper} sx={sx}>
            <Table>
                <TableHead>
                    <TableRow>
                        {columns.map((col) => (
                            <TableCell
                                key={col.id}
                                align={col.align || 'left'}
                                sx={{ width: col.width }}
                            >
                                {col.label}
                            </TableCell>
                        ))}
                        {renderActions && (
                            <TableCell align="right" sx={{ width: 100 }}>
                                {t('table.columns.actions')}
                            </TableCell>
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((row) => (
                        <TableRow
                            key={row.id}
                            hover
                            onClick={() => onRowClick?.(row)}
                            sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                        >
                            {columns.map((col) => (
                                <TableCell key={col.id} align={col.align || 'left'}>
                                    {col.render ? col.render(row) : (row as any)[col.id]}
                                </TableCell>
                            ))}
                            {renderActions && (
                                <TableCell align="right">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                        }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                    {renderActions(row)}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
```

3. [ ] Delete `FlowListTable.jsx`
4. [ ] Update exports
5. [ ] Build: `pnpm --filter @universo/template-mui build`

---

## ✅ Phase 4: Synchronization & Documentation (CRITICAL)

**Priority**: 🔥 **CRITICAL** - Verify everything works  
**Time**: 1 hour

### Task 4.1: Full workspace build

- [ ] Run `pnpm build` from root
- [ ] Verify 30/30 packages build successfully
- [ ] Check for TypeScript errors
- [ ] Check for linting errors

### Task 4.2: Update package.json exports (if needed)

**File**: `packages/universo-template-mui/base/package.json`

Verify exports include:
```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    },
    "./components/chips/RoleChip": {
      "import": "./dist/esm/components/chips/RoleChip.js",
      "require": "./dist/cjs/components/chips/RoleChip.js"
    }
  }
}
```

- [ ] Update if tsdown doesn't auto-generate
- [ ] Rebuild: `pnpm --filter @universo/template-mui build`

### Task 4.3: Update systemPatterns.md

**File**: `memory-bank/systemPatterns.md`

Add new section:
```markdown
## Universal Role System Pattern (2025-10-31)

**Pattern**: Centralized role types in `@universo/types` with reusable RoleChip component.

**Structure**:
- `packages/universo-types/base/src/common/roles.ts` - Single source of truth
- `packages/universo-template-mui/base/src/components/chips/RoleChip.tsx` - UI component
- All packages import from `@universo/types`

**Usage**:
```typescript
import { MetaverseRole, hasRequiredRole, getRoleLevel } from '@universo/types'
import { RoleChip } from '@universo/template-mui'

// Type-safe role checking
const canManage = hasRequiredRole(userRole, ['admin', 'owner'])

// Display role chip
<RoleChip role={member.role} size="small" />
```

**Benefits**:
- ✅ Zero role type duplication
- ✅ Consistent color mapping (owner→error, admin→warning, etc.)
- ✅ i18n support out of the box
- ✅ Type-safe role comparisons

---

## JSX→TSX Migration Pattern (2025-10-31)

**Pattern**: Migrate legacy JSX + PropTypes to modern TypeScript with generics.

**Before** (Old Pattern):
```javascript
// ItemCard.jsx
ItemCard.propTypes = {
    title: PropTypes.node,
    data: PropTypes.object
}
```

**After** (New Pattern):
```typescript
// ItemCard.tsx
export interface ItemCardProps<T extends ItemCardData> {
    title?: React.ReactNode
    data?: T
}

export function ItemCard<T extends ItemCardData = ItemCardData>(
    props: ItemCardProps<T>
) { ... }
```

**Benefits**:
- ✅ Full IDE autocomplete
- ✅ Compile-time type checking
- ✅ Generic types for reusability
- ✅ No runtime PropTypes overhead
```

- [ ] Add sections to systemPatterns.md
- [ ] Update progress.md with completion summary

---

## ❌ REMOVED: Phase 4 (CSP in index.html)

**QA Analysis Result**: CSP via `<meta>` tag will break Vite dev server.

**Reason for Removal**:
1. **Vite incompatibility**: Inline scripts required for HMR
2. **MUI incompatibility**: Dynamic inline styles blocked by CSP
3. **Redundant**: Security already implemented:
   - ✅ CSRF tokens (`csurf` middleware)
   - ✅ XSS sanitization (`sanitizeMiddleware`)
   - ✅ HttpOnly cookies with SameSite
   - ✅ Rate limiting on auth endpoints
   - ✅ CORS configuration
4. **Test project**: CSP overhead not justified

**Decision**: Skip CSP implementation completely.

---

## 📊 Success Criteria

**Build Verification**:
- [ ] All 30 packages build successfully
- [ ] Zero TypeScript compilation errors
- [ ] Zero linting errors
- [ ] MetaverseList uses RoleChip (no inline Chip)
- [ ] ItemCard, MainCard, FlowListTable are TypeScript (.tsx)

**Type Safety**:
- [ ] No `any` types in new code
- [ ] Generic types work correctly in ItemCard
- [ ] Role types imported from @universo/types (not duplicated)

**Documentation**:
- [ ] systemPatterns.md updated with new patterns
- [ ] progress.md updated with completion summary
- [ ] No obsolete JSX files remain

**Browser Testing** (User Responsibility):
- [ ] MetaverseList displays role chips correctly
- [ ] Role chips show correct colors (owner=red, admin=orange, etc.)
- [ ] Role chips show translated text (EN/RU)
- [ ] No console errors
- [ ] All components render without visual regressions

---

## 🚀 Execution Order

1. **Phase 1, Task 1.1**: Create roles.ts (foundation)
2. **Phase 1, Task 1.2**: Update imports (eliminate duplication)
3. **Phase 2, Task 2.1**: Create RoleChip component
4. **Phase 2, Task 2.2**: Use RoleChip in MetaverseList
5. **Phase 3, Task 3.1**: Migrate ItemCard.jsx → .tsx
6. **Phase 3, Task 3.2**: Migrate MainCard.jsx → .tsx
7. **Phase 3, Task 3.3**: Migrate FlowListTable.jsx → .tsx
8. **Phase 4**: Build verification + documentation

**Total Estimated Time**: 4-6 hours

---

**Last Updated**: 2025-10-31  
**QA Approved**: Yes (8/10 score after CSP removal)
