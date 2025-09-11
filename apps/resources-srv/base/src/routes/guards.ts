import { DataSource } from 'typeorm'
import { ClusterUser } from '../database/entities/ClusterUser'
import { DomainCluster } from '../database/entities/DomainCluster'
import { ResourceDomain } from '../database/entities/ResourceDomain'
import { ResourceCluster } from '../database/entities/ResourceCluster'

// Comments in English only

/**
 * Ensures the user has membership to the given cluster.
 * Throws 403 error when access is denied.
 */
export async function ensureClusterAccess(ds: DataSource, userId: string, clusterId: string): Promise<void> {
  const clusterUserRepo = ds.getRepository(ClusterUser)
  const found = await clusterUserRepo.findOne({ where: { cluster_id: clusterId, user_id: userId } })
  if (!found) {
    const err: any = new Error('Access denied to this cluster')
    err.status = 403
    throw err
  }
}

/**
 * Ensures the user can access the given domain through its cluster membership.
 * Throws 404 when the domain link is missing, or 403 when membership is absent.
 */
export async function ensureDomainAccess(ds: DataSource, userId: string, domainId: string): Promise<void> {
  const domainClusterRepo = ds.getRepository(DomainCluster)
  const domainCluster = await domainClusterRepo.findOne({ where: { domain: { id: domainId } }, relations: ['cluster'] })
  if (!domainCluster) {
    const err: any = new Error('Domain not found')
    err.status = 404
    throw err
  }
  await ensureClusterAccess(ds, userId, domainCluster.cluster.id)
}

/**
 * Ensures the user can access the given resource through any of its domains or clusters.
 * Throws 404 when no links are found, or 403 when membership is absent.
 */
export async function ensureResourceAccess(ds: DataSource, userId: string, resourceId: string): Promise<void> {
  const rdRepo = ds.getRepository(ResourceDomain)
  const rcRepo = ds.getRepository(ResourceCluster)

  // Try via domain links first
  const domainLinks = await rdRepo.find({ where: { resource: { id: resourceId } }, relations: ['domain'] })
  if (domainLinks.length > 0) {
    const dcRepo = ds.getRepository(DomainCluster)
    const domainIds = domainLinks.map(l => l.domain.id)
    const domainClusterLinks = await dcRepo.find({ where: domainIds.map(id => ({ domain: { id } })), relations: ['cluster'] })
    const clusterIds = Array.from(new Set(domainClusterLinks.map(l => l.cluster.id)))
    if (clusterIds.length === 0) {
      const err: any = new Error('Access denied to this resource')
      err.status = 403
      throw err
    }
    const cuRepo = ds.getRepository(ClusterUser)
    const membership = await cuRepo.findOne({ where: clusterIds.map(cid => ({ cluster_id: cid, user_id: userId })) as any })
    if (!membership) {
      const err: any = new Error('Access denied to this resource')
      err.status = 403
      throw err
    }
    return
  }

  // Fallback: check explicit resource-cluster links
  const rc = await rcRepo.find({ where: { resource: { id: resourceId } }, relations: ['cluster'] })
  if (rc.length === 0) {
    const err: any = new Error('Resource not found')
    err.status = 404
    throw err
  }
  const clusterIds = rc.map(l => l.cluster.id)
  const cuRepo = ds.getRepository(ClusterUser)
  const membership = await cuRepo.findOne({ where: clusterIds.map(cid => ({ cluster_id: cid, user_id: userId })) as any })
  if (!membership) {
    const err: any = new Error('Access denied to this resource')
    err.status = 403
    throw err
  }
}

