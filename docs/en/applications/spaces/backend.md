# Spaces Backend (`@universo/spaces-srv`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Backend for managing Flow-canvases with  in PostgreSQL.

## Data Model

**Space Entity:**
```typescript
@Entity('spaces')
export class Space {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  canvasData: {
    nodes: any[];
    edges: any[];
    metadata: any;
  };

  @Column({ name: 'user_id' })
  userId: string;
}
```

## REST API

```
GET    /api/v1/spaces
POST   /api/v1/spaces
GET    /api/v1/spaces/:id
PATCH  /api/v1/spaces/:id
DELETE /api/v1/spaces/:id
```

## RLS Policies

```sql
CREATE POLICY "Users see their spaces"
ON spaces FOR SELECT
USING (user_id = auth.uid());
```

## Canvas Storage

Canvas   JSONB:
-  via metadata
-  for  search
-  UPDL nodes

## Related Documentation

- [Spaces Frontend](frontend.md)
- [Spaces Overview](README.md)
