# Metaverses Service (metaverses-srv)

Backend service for managing metaverses, sections, and entities with complete data isolation and validation in the Universo Platformo ecosystem.

## Overview

The Metaverses Service implements a three-tier architecture (Metaverses → Sections → Entities) with strict data isolation, comprehensive validation, and secure relationship management. All operations ensure data integrity through TypeORM Repository pattern and PostgreSQL constraints.

## Architecture

### Entity Relationships
- **Metaverses**: Independent organizational units with complete data isolation
- **Sections**: Logical groupings within metaverses (mandatory metaverse association)
- **Entities**: Individual assets within sections (mandatory section association)
- **Junction Tables**: Many-to-many relationships with CASCADE delete and UNIQUE constraints

### Data Isolation & Security
- Complete metaverse isolation - no cross-metaverse data access
- Mandatory associations prevent orphaned entities
- Idempotent operations for relationship management
- Comprehensive input validation with clear error messages

## API Endpoints

### Metaverses
- `GET /metaverses` – List all metaverses
- `POST /metaverses` – Create a metaverse
- `GET /metaverses/:id` – Get metaverse details
- `PUT /metaverses/:id` – Update metaverse
- `DELETE /metaverses/:id` – Delete metaverse (CASCADE deletes sections/entities)
- `GET /metaverses/:id/sections` – Get sections in metaverse
- `POST /metaverses/:id/sections/:sectionId` – Link section to metaverse (idempotent)
- `GET /metaverses/:id/entities` – Get entities in metaverse
- `POST /metaverses/:id/entities/:entityId` – Link entity to metaverse (idempotent)

### Sections
- `GET /sections` – List all sections
- `POST /sections` – Create section (requires metaverseId)
- `GET /sections/:id` – Get section details
- `PUT /sections/:id` – Update section
- `DELETE /sections/:id` – Delete section (CASCADE deletes entities)
- `GET /sections/:id/entities` – Get entities in section
- `POST /sections/:id/entities/:entityId` – Link entity to section (idempotent)

### Entities
- `GET /entities` – List all entities
- `POST /entities` – Create entity (requires sectionId, optional metaverseId)
- `GET /entities/:id` – Get entity details
- `PUT /entities/:id` – Update entity
- `DELETE /entities/:id` – Delete entity

## Data Model

### Core Entities

```typescript
@Entity({ name: 'metaverses' })
export class Metaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@Entity({ name: 'sections' })
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

@Entity({ name: 'entities' })
export class Entity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

### Junction Tables (Many-to-Many Relationships)

```typescript
@Entity({ name: 'entities_metaverses' })
export class EntityMetaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metaverse_id' })
  metaverse: Metaverse

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (entity_id, metaverse_id)
}

@Entity({ name: 'entities_sections' })
export class EntitySection {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Entity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity: Entity

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (entity_id, section_id)
}

@Entity({ name: 'sections_metaverses' })
export class SectionMetaverse {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section

  @ManyToOne(() => Metaverse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metaverse_id' })
  metaverse: Metaverse

  @CreateDateColumn()
  createdAt: Date

  // UNIQUE constraint on (section_id, metaverse_id)
}
```

## Validation Rules

### Entity Creation
- `name` is required (non-empty string)
- `sectionId` is required and must reference existing section
- `metaverseId` is optional but if provided must reference existing metaverse
- Atomic creation of entity-section relationship
- Atomic creation of entity-metaverse relationship (if metaverseId provided)

### Section Creation
- `name` is required (non-empty string)
- `metaverseId` is required and must reference existing metaverse
- Atomic creation of section-metaverse relationship

### Metaverse Creation
- `name` is required (non-empty string)
- No additional constraints

## Database Structure

```sql
-- Core tables
CREATE TABLE metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction tables with CASCADE delete and UNIQUE constraints
CREATE TABLE entities_metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  metaverse_id UUID NOT NULL REFERENCES metaverses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_id, metaverse_id)
);

CREATE TABLE entities_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_id, section_id)
);

CREATE TABLE sections_metaverses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  metaverse_id UUID NOT NULL REFERENCES metaverses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, metaverse_id)
);
```

## Development

### Prerequisites
- Node.js 18+
- PNPM package manager
- PostgreSQL database

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build the service
pnpm --filter @universo/metaverses-srv build

# Run tests
pnpm --filter @universo/metaverses-srv test

# Lint code
pnpm --filter @universo/metaverses-srv lint
```

### Security Notes
- Application-level authorization is strictly enforced in all routes via metaverse/section/entity guards to prevent IDOR and cross-metaverse leaks.
- Database RLS policies are provisioned as defense-in-depth, but when connecting via TypeORM they are not active unless request JWT context is propagated; do not rely on RLS alone.
- Rate limiting is enabled on `/entities`, `/metaverses`, and `/sections` endpoints.
- HTTP security headers are applied with Helmet (CSP deferred for API-only usage).

### Database Setup
The service uses TypeORM with PostgreSQL. Migrations are automatically registered and can be run through the main application's migration system.

### Environment Variables
Configure database connection through the main application's environment configuration.

## Related Documentation
- [Metaverses Frontend Application](../../../packages/metaverses-frt/base/README.md)
- [Metaverses Application Docs](../../../docs/en/applications/metaverses/README.md)

---

**Universo Platformo | Metaverses Backend Service**
