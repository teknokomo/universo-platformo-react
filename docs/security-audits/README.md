# Security Audits

This directory contains documentation of security audits performed on the Universo Platformo React project.

## Active Security Issues

### 🔴 CRITICAL: Session Secret Vulnerability (2025-11-15)

**Status**: Identified - Awaiting Fix  
**Location**: `packages/flowise-server/src/index.ts:192`  
**Severity**: CRITICAL (CVSS 9.8/10)

Hardcoded fallback session secret enables session hijacking and authentication bypass.

📁 **Details**: [2025-11-15-session-secret-vulnerability/](./2025-11-15-session-secret-vulnerability/)

---

## Audit Schedule

Security audits should be conducted:
- After major feature releases
- Every 3-6 months (routine)
- When security vulnerabilities are reported
- Before production deployments

## Reporting Security Issues

Please follow the guidelines in [SECURITY.md](../../SECURITY.md) for responsible disclosure of security vulnerabilities.

## Audit History

| Date | Type | Critical | High | Medium | Low | Auditor |
|------|------|----------|------|--------|-----|---------|
| 2025-11-15 | Full | 1 | 0 | 0 | 0 | Security Audit Agent |

---

Last updated: 2025-11-15
