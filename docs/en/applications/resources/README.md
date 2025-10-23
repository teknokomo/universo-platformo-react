# Resources Applications

Resources subsystem consists of a backend service (`resources-srv`) and a frontend app (`resources-frt`). It implements a three-tier model with strict isolation by clusters.

## Architecture

- **Clusters** – top-level organizational units; complete data isolation between clusters.
- **Domains** – logical groupings within clusters; mandatory association with a cluster.
- **Resources** – individual assets; mandatory association with a domain.
- **Junctions** – many‑to‑many tables for cluster–resource, domain–resource, and cluster–domain with CASCADE and UNIQUE constraints.

## API
Full endpoint list is in [packages/resources-srv/base/README.md](../../../../packages/resources-srv/base/README.md).

## Security
- Application‑level authorization guards protect every CRUD and linking route to prevent IDOR and cross‑cluster access.
- Database RLS policies exist as defense‑in‑depth; when using TypeORM connections they are not active unless request JWT context is propagated.
- Rate‑limits enabled on `/resources`, `/clusters`, and `/domains`. Helmet applies secure HTTP headers.

## Development
```bash
pnpm --filter @universo/resources-srv build
pnpm --filter @universo/resources-frt build
```
