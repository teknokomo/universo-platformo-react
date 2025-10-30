# Rate Limiting System - Production Deployment Guide

Complete guide for deploying the rate limiting system with Redis to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Redis Configuration](#redis-configuration)
4. [Production Deployment](#production-deployment)
5. [Health Checks](#health-checks)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## Prerequisites

### System Requirements

- **Node.js**: 20.18.1 or higher
- **Redis**: 6.0+ (recommended: 7.0+)
- **pnpm**: 8.0+ (workspace manager)
- **Operating System**: Linux (recommended), macOS, Windows with WSL2

### Knowledge Requirements

- Basic understanding of Redis
- Familiarity with environment variables
- Docker/Kubernetes basics (for containerized deployments)

---

## Environment Variables

### Required for Production

```bash
# Redis URL (MANDATORY for production multi-instance deployments)
REDIS_URL=redis://[username:password@]host:port[/db]

# Node environment
NODE_ENV=production
```

### Examples by Environment

#### Development (Local)

```bash
# No Redis required - automatically falls back to MemoryStore
NODE_ENV=development
```

#### Staging

```bash
# Shared Redis for multi-instance testing
REDIS_URL=redis://staging-redis:6379
NODE_ENV=staging
```

#### Production

```bash
# Production Redis with authentication
REDIS_URL=redis://:strongpassword@prod-redis.example.com:6379

# Or with TLS encryption (highly recommended)
REDIS_URL=rediss://:strongpassword@prod-redis.example.com:6380

# AWS ElastiCache example
REDIS_URL=rediss://master.your-cluster.cache.amazonaws.com:6379

# Redis Cloud example
REDIS_URL=redis://:password@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345

NODE_ENV=production
```

---

## Redis Configuration

### Recommended Settings

```conf
# /etc/redis/redis.conf

# Memory management (adjust based on instance size)
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (if needed for rate limit history)
save 900 1
save 300 10

# Connection limits
maxclients 10000

# Performance tuning
tcp-backlog 511

# Security
requirepass your_strong_password_here
```

### Connection Pooling

The `RedisClientManager` uses a singleton pattern:

- **1 connection per Node.js process** (not per request)
- **Auto-retry strategy**: Exponential backoff with max 3 attempts
- **Reconnect on errors**: `READONLY`, `ECONNREFUSED`

```typescript
// Handled automatically by RedisClientManager
{
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
        if (times > 3) return null // Stop retrying
        return Math.min(times * 100, 3000) // Exponential backoff
    }
}
```

### Managed Services Configuration

#### AWS ElastiCache

**Recommended Instance Types:**
- **Dev/Staging**: `cache.t3.micro` (0.5GB RAM, ~$12/month)
- **Production**: `cache.m5.large` (6.38GB RAM, ~$125/month)

**Configuration:**
```bash
# Enable automatic backups
aws elasticache modify-replication-group \
  --replication-group-id your-cluster \
  --automatic-failover-enabled \
  --snapshotting-cluster-id your-cluster \
  --snapshot-retention-limit 7

# Enable in-transit encryption (TLS)
REDIS_URL=rediss://master.your-cluster.cache.amazonaws.com:6379
```

#### Redis Cloud

**Recommended Plans:**
- **Dev**: 30MB Free tier
- **Staging**: 100MB ($0.60/month)
- **Production**: 1GB+ with high availability

**Setup:**
```bash
# Enable TLS encryption
REDIS_URL=rediss://default:password@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345

# Configure connection pooling
# Max connections: 50 (handled by singleton)
```

---

## Production Deployment

### Step-by-Step Checklist

- [ ] **Step 1**: Set `REDIS_URL` environment variable
- [ ] **Step 2**: Verify rate limiting configuration
- [ ] **Step 3**: Deploy application
- [ ] **Step 4**: Monitor first 100 requests
- [ ] **Step 5**: Check Redis connections (should be 1 per instance)

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  flowise:
    image: your-app:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - redis
    deploy:
      replicas: 3  # Multi-instance requires Redis
      
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"

volumes:
  redis-data:
```

**Start:**
```bash
docker-compose up -d
docker-compose logs -f flowise  # Check logs
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowise
spec:
  replicas: 3  # Multi-instance requires Redis
  selector:
    matchLabels:
      app: flowise
  template:
    metadata:
      labels:
        app: flowise
    spec:
      containers:
      - name: flowise
        image: your-app:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"

---
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
type: Opaque
stringData:
  url: "redis://:password@redis-service:6379"
```

**Deploy:**
```bash
kubectl apply -f deployment.yaml
kubectl get pods  # Check status
kubectl logs -f deployment/flowise  # Check logs
```

### PM2 Deployment

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'flowise',
    script: './dist/index.js',
    instances: 4,  // Multi-instance requires Redis
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      REDIS_URL: 'redis://localhost:6379'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

**Start:**
```bash
pm2 start ecosystem.config.js --env production
pm2 logs flowise  # Check logs
pm2 monit  # Monitor resources
```

---

## Health Checks

### Redis Connection Check

```bash
# Manual test
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Check connection count
redis-cli -u $REDIS_URL CLIENT LIST | wc -l
# Expected: Number of application instances (e.g., 3 for 3 replicas)
```

### Rate Limit Verification

```bash
# Test read limit (default: 100 requests/15min)
for i in {1..110}; do
  curl http://localhost:3000/api/v1/metaverses
  sleep 0.1
done

# Expected: First 100 requests succeed (200 OK)
#           Next 10 requests fail (429 Too Many Requests)

# Test write limit (default: 60 requests/15min)
for i in {1..65}; do
  curl -X POST http://localhost:3000/api/v1/metaverses \
    -H "Content-Type: application/json" \
    -d '{"name":"test"}'
  sleep 0.1
done

# Expected: First 60 requests succeed (201 Created)
#           Next 5 requests fail (429 Too Many Requests)
```

### Log Patterns

**Successful Initialization:**
```
[Redis] Client connected successfully
[RateLimit:read] Using Redis store (distributed mode)
[RateLimit:write] Using Redis store (distributed mode)
```

**Graceful Shutdown:**
```
[Redis] Closing connection...
[Redis] Connection closed
```

---

## Monitoring

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Redis connections | 1 per instance | > instances × 2 |
| 429 error rate | < 1% | > 5% |
| Average latency | < 50ms | > 200ms |
| Redis memory usage | < 80% | > 90% |

### Log Monitoring

**Success Patterns:**
```bash
# Grep successful rate limit checks
grep "Using Redis store" logs/*.log

# Check for connection errors
grep "Connection error" logs/*.log

# Monitor timeout warnings
grep "connection timeout" logs/*.log
```

### Future Monitoring (v2.0 Backlog)

**Prometheus Metrics** (planned):
```
# Rate limit requests
rate_limit_requests_total{namespace="metaverses",type="read"}
rate_limit_requests_total{namespace="metaverses",type="write"}

# Rate limit rejections
rate_limit_rejections_total{namespace="metaverses",type="read"}
rate_limit_rejections_total{namespace="metaverses",type="write"}

# Redis connection pool
redis_connection_pool_size
redis_connection_pool_active
```

**Grafana Dashboards** (planned):
- Rate limit usage per endpoint
- Redis connection health
- 429 error rate over time
- Latency percentiles (p50, p95, p99)

---

## Troubleshooting

### Error: "Rate limiters not initialized"

**Symptom:**
```
Error: Rate limiters not initialized. Call initializeRateLimiters() first.
Error: command start not found
```

**Cause:** `createMetaversesServiceRoutes()` called before `initializeRateLimiters()`

**Solution:**

1. Verify initialization order in `flowise-server/src/index.ts`:
```typescript
async config() {
    // ... other initialization
    
    // ✅ CORRECT: Call before router creation
    await initializeRateLimiters()
    
    // ... router setup
}
```

2. Check lazy router mounting in `flowise-server/src/routes/index.ts`:
```typescript
// ✅ CORRECT: Lazy initialization pattern
let metaversesRouter: ExpressRouter | null = null

router.use((req, res, next) => {
    if (!metaversesRouter) {
        metaversesRouter = createMetaversesServiceRoutes(ensureAuthWithRls, () => getDataSource())
    }
    metaversesRouter(req, res, next)
})
```

3. Restart the server

---

### Error: "Redis connection timeout"

**Symptom:**
```
[Redis] Retrying connection in 100ms (attempt 1)
[Redis] Retrying connection in 200ms (attempt 2)
[Redis] Max retry attempts reached
Error: Redis connection timeout
```

**Cause:** `REDIS_URL` incorrect or Redis server unreachable

**Solution:**

1. Verify `REDIS_URL` format:
```bash
echo $REDIS_URL
# Should be: redis://[username:password@]host:port[/db]
# Examples:
# - redis://localhost:6379
# - redis://:password@host:6379
# - rediss://host:6380 (TLS)
```

2. Test Redis connection manually:
```bash
redis-cli -u $REDIS_URL ping
# Expected: PONG

# If timeout, check network:
ping redis-host
telnet redis-host 6379
```

3. Check Redis server status:
```bash
# Docker
docker ps | grep redis
docker logs redis-container

# Systemd
systemctl status redis
journalctl -u redis -f

# PM2
pm2 list | grep redis
```

4. Verify firewall rules:
```bash
# Check if port 6379 is open
sudo netstat -tuln | grep 6379
sudo ufw status | grep 6379
```

---

### High 429 Error Rate

**Symptom:** Many requests returning `429 Too Many Requests`

**Cause:** Rate limits too strict for your traffic patterns

**Solution:**

1. Review current limits in `metaverses-srv/routes/index.ts`:
```typescript
await createRateLimiters({
    keyPrefix: 'metaverses-srv',
    maxRead: 100,   // ← Adjust this
    maxWrite: 60,   // ← Adjust this
    windowMs: 15 * 60 * 1000  // 15 minutes
})
```

2. Analyze traffic patterns:
```bash
# Count 429 errors
grep "429" logs/*.log | wc -l

# Check request frequency
grep "GET /api/v1/metaverses" logs/*.log | wc -l
```

3. Adjust limits based on traffic:
```typescript
// Example: High-traffic API
maxRead: 500,   // 500 requests per 15min
maxWrite: 200,  // 200 requests per 15min
```

4. Or increase window duration:
```typescript
windowMs: 60 * 60 * 1000  // 60 minutes
```

---

### Memory Leak (Redis Connections Growing)

**Symptom:** Redis connections increasing over time

**Cause:** Not using singleton `RedisClientManager` pattern

**Solution:**

1. Check Redis connections:
```bash
redis-cli -u $REDIS_URL CLIENT LIST | wc -l
# Expected: Number of app instances (e.g., 3)
# Wrong: Growing continuously (10, 20, 50...)
```

2. Verify using centralized `@universo/utils/rate-limiting`:
```typescript
// ✅ CORRECT: Import from centralized package
import { createRateLimiter } from '@universo/utils/rate-limiting'

// ❌ WRONG: Local Redis client creation
const client = new Redis(url)  // Memory leak!
```

3. Check no direct Redis imports:
```bash
# Search for problematic patterns
grep -r "new Redis(" packages/*/src/
grep -r "createClient(" packages/*/src/ | grep -v "RedisClientManager"

# Expected: Only in RedisClientManager.ts
```

4. Monitor connections after fix:
```bash
# Should remain stable
watch -n 5 'redis-cli -u $REDIS_URL CLIENT LIST | wc -l'
```

---

## Security Best Practices

### 1. Redis Authentication

**Enable Password Authentication:**

```conf
# /etc/redis/redis.conf
requirepass your_strong_password_here
```

**Use in Connection String:**
```bash
REDIS_URL=redis://:your_strong_password_here@host:6379
```

**Generate Strong Password:**
```bash
# Random 32-character password
openssl rand -base64 32
```

---

### 2. TLS Encryption

**Enable TLS for Redis Connections** (highly recommended for production):

```bash
# Use rediss:// (with double 's')
REDIS_URL=rediss://host:6380

# AWS ElastiCache with in-transit encryption
REDIS_URL=rediss://master.your-cluster.cache.amazonaws.com:6379

# Redis Cloud (TLS enabled by default)
REDIS_URL=rediss://default:password@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
```

**Redis Server TLS Configuration:**
```conf
# /etc/redis/redis.conf
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt
```

---

### 3. Network Isolation

**VPC Configuration** (AWS example):

```bash
# Place Redis in private subnet
# Security Group: Allow 6379 only from application subnet

aws ec2 create-security-group \
  --group-name redis-sg \
  --description "Redis security group"

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 6379 \
  --source-group sg-yyyyy  # Application security group
```

**Firewall Rules:**

```bash
# Ubuntu/Debian
sudo ufw allow from 10.0.1.0/24 to any port 6379
sudo ufw deny 6379

# CentOS/RHEL
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.1.0/24" port port=6379 protocol=tcp accept'
sudo firewall-cmd --reload
```

---

### 4. Rate Limit Bypass Prevention

**Key Prefix Isolation:**
```typescript
// Each service uses unique prefix
await createRateLimiters({
    keyPrefix: 'metaverses-srv',  // Prevents key collision
    // ...
})
```

**IP-Based Limiting** (future enhancement):
```typescript
// Planned for v2.0
{
    keyGenerator: (req) => req.ip,  // Limit by IP
    skip: (req) => req.user?.isAdmin  // Skip for admins
}
```

---

### 5. Audit Logging

**Log Rate Limit Events** (future enhancement):

```typescript
// Planned for v2.0
onLimitReached: (req, res, options) => {
    logger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
        limit: options.max,
        timestamp: new Date().toISOString()
    })
}
```

**Current Logging:**
```
[RateLimit:read] Using Redis store (distributed mode)
[Redis] Client connected successfully
```

---

## Additional Resources

- **Redis Documentation**: https://redis.io/documentation
- **ioredis Documentation**: https://github.com/redis/ioredis
- **express-rate-limit Documentation**: https://express-rate-limit.mintlify.app/
- **rate-limit-redis Documentation**: https://github.com/wyattjoh/rate-limit-redis

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review application logs
3. Check Redis server logs
4. Open issue in project repository

---

**Last Updated:** 2025-10-30  
**Version:** 1.0.0
