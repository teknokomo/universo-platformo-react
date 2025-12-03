# Spaces Backend (`@universo/spaces-backend`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Backend для управления Flow-холстами с сохранением в PostgreSQL.

## Модель данных

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

Canvas сохраняется как JSONB:
- Версионирование через metadata
- Индексация для быстрого поиска
- Поддержка UPDL узлов

## Связанная документация

- [Spaces Frontend](frontend.md)
- [Spaces Overview](README.md)
