# `packages/uniks-srv` — Uniks Backend — [Status: MVP]

Backend service for workspace management with TypeORM, RLS, and enhanced role model.

## Purpose

Provides API for CRUD operations on workspaces, member management, and role validation.

## Key Features

- **CRUD operations**: TypeORM repositories for all operations
- **Membership & role validation**: Centralized service
- **RLS data isolation**: Via `uniks` PostgreSQL schema
- **Passport.js sessions**: + Supabase JWT validation
- **Caching**: Membership resolution per request
- **Strict roles**: owner/admin/editor/member

## API Endpoints

### Workspace Management

```
GET    /uniks              # List user's workspaces
POST   /uniks              # Create new workspace
GET    /uniks/:id          # Get workspace details
PUT    /uniks/:id          # Update workspace
DELETE /uniks/:id          # Delete workspace
```

### Member Management

```
POST   /uniks/members           # Add member
DELETE /uniks/members/:userId   # Remove member
GET    /uniks/:id/members       # List members
```

## Database Architecture

### Unik Entity

```typescript
@Entity({ schema: 'uniks', name: 'uniks' })
export class Unik {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ type: 'text' }) name!: string
    @Column({ type: 'text', nullable: true }) description?: string
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
    @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date
    @OneToMany(() => UnikUser, (uu) => uu.unik) memberships!: UnikUser[]
}
```

### UnikUser Entity

```typescript
@Entity({ schema: 'uniks', name: 'uniks_users' })
export class UnikUser {
    @PrimaryGeneratedColumn('uuid') id!: string
    @Column({ name: 'user_id', type: 'uuid' }) userId!: string
    @Column({ name: 'unik_id', type: 'uuid' }) unikId!: string
    @Column({ type: 'text' }) role!: UnikRole
    @ManyToOne(() => Unik) @JoinColumn({ name: 'unik_id' }) unik!: Unik
    @CreateDateColumn({ name: 'created_at' }) createdAt!: Date
}
```

## Role Model

| Role | Purpose | Examples |
|------|---------|----------|
| owner | Full control | Delete workspace, promote roles |
| admin | Administrative management | Add/remove members |
| editor | Content contribution | Create/update resources |
| member | Basic participation | View and basic actions |

## Security

### Authentication & Authorization

- Passport.js sessions + Supabase JWT bridge
- Per-request user context
- Membership caching
- Role-based permission gates

### Data Protection

- RLS policies for membership-based visibility
- TypeORM parameterization against SQL injections
- Input validation
- Error message sanitization

## Development

```bash
pnpm build --filter @universo/uniks-srv
pnpm --filter @universo/uniks-srv dev
pnpm --filter @universo/uniks-srv test
```

## Technologies

- **Express.js**: Web framework
- **TypeORM**: Database ORM
- **PostgreSQL**: Primary database
- **Supabase**: Authentication
- **TypeScript**: Type safety

## See Also

- [Uniks Frontend](./frontend.md) - UI component
- [Uniks README](./README.md) - System overview
