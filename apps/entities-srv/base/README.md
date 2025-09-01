# Entities Service

The Entities Service (`entities-srv`) manages hierarchical entities derived from templates with resource attachments.

## API Endpoints

- **Templates** `/templates`
  - `GET /templates` – list templates
  - `POST /templates` – create template
  - `GET /templates/:id` – get template
  - `PUT /templates/:id` – update template
  - `DELETE /templates/:id` – remove template
- **Entities** `/`
  - `GET /` – list entities
  - `POST /` – create entity
  - `GET /:id` – get entity
  - `PUT /:id` – update entity
  - `DELETE /:id` – remove entity
  - `GET /:id/children` – list child entities
  - `GET /:id/parents` – list parent chain
- **Owners** `/:entityId/owners`
  - `GET /:entityId/owners` – list owners
  - `POST /:entityId/owners` – add owner
  - `PUT /owners/:id` – update owner
  - `DELETE /owners/:id` – remove owner
- **Resources** `/:entityId/resources`
  - `GET /:entityId/resources` – list attached resources
  - `POST /:entityId/resources` – attach resource
  - `PUT /:entityId/resources/:id` – update resource link
  - `DELETE /:entityId/resources/:id` – detach resource

## Data Model

Core entities:
- **EntityStatus** – status codes
- **EntityTemplate** – reusable templates
- **Entity** – concrete instance with hierarchy
- **EntityOwner** – user ownerships
- **EntityResource** – resource assignments
- **EntityRelation** – arbitrary links between entities

## Development

```bash
pnpm --filter @universo/entities-srv build
```
