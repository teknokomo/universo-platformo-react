# Tasks

> **Note**: Active and planned tasks. Completed work → progress.md, architectural patterns → systemPatterns.md.

---

## 🔥 ACTIVE TASKS

### Memory Bank Maintenance

- [ ] Review and update Memory Bank files monthly
- [ ] Archive old progress entries (>6 months) when files exceed limits
- [ ] Update version table in progress.md when new releases published

---

## 📋 PLANNED FEATURES (Backlog)

### Admin Module Enhancements

- [ ] Implement role cloning feature (duplicate existing role)
- [ ] Add role templates (predefined permission sets)
- [ ] Implement permission inheritance system
- [ ] Add audit log for role/permission changes
- [ ] Multi-instance support (remote instances management)

### RBAC System Improvements

- [ ] Implement ABAC conditions system (time-based, IP-based, resource-based)
- [ ] Add permission testing UI (simulate user permissions)
- [ ] Implement permission delegation (temporary access grants)
- [ ] Add custom permission subjects via UI

### Frontend UX

- [ ] Implement dark mode theme
- [ ] Add keyboard shortcuts system
- [ ] Improve mobile responsiveness
- [ ] Add tour/onboarding system for new users

### Performance Optimization

- [ ] Implement server-side caching strategy
- [ ] Add CDN integration for static assets
- [ ] Optimize bundle size (code splitting)
- [ ] Database query optimization audit

### Documentation

- [ ] Complete API documentation (OpenAPI specs)
- [ ] Add architecture decision records (ADR)
- [ ] Create video tutorials for key features
- [ ] Write migration guide for breaking changes

---

## 🧪 TECHNICAL DEBT

### Code Quality

- [ ] Refactor remaining useApi usages → useMutation pattern
- [ ] Standardize error handling across all packages
- [ ] Add unit tests for critical business logic
- [ ] Add E2E tests for key user flows

### Architecture Cleanup

- [ ] Resolve Template MUI CommonJS/ESM conflict (extract to @universo package)
- [ ] Audit and remove unused dependencies
- [ ] Consolidate duplicate utility functions
- [ ] Standardize TypeScript strict mode across all packages

### Database

- [ ] Add database connection pooling optimization
- [ ] Implement database backup automation
- [ ] Add migration rollback testing
- [ ] Optimize RLS policies performance

---

## 🔒 SECURITY TASKS

- [ ] Implement rate limiting for all API endpoints
- [ ] Add CSRF protection
- [ ] Implement API key rotation mechanism
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Conduct security audit
- [ ] Implement 2FA/MFA system

---

## ✅ RECENTLY COMPLETED (Last 30 Days)

**For detailed completion history, see progress.md**

### December 2025
- ✅ Legacy code cleanup (2025-12-10)
- ✅ Global roles access implementation (2025-12-09)
- ✅ CASL standard compliance refactoring (2025-12-08)
- ✅ RBAC architecture cleanup (2025-12-07)
- ✅ Roles UI unification (2025-12-07)
- ✅ Admin Instances module MVP (2025-12-06)
- ✅ Dynamic global roles system (2025-12-05)
- ✅ User settings system (2025-12-04)
- ✅ Admin packages creation (2025-12-03)

### November 2025
- ✅ Campaigns integration (2025-11-26)
- ✅ Storages management (2025-11-25)
- ✅ Organizations module (2025-11-22)
- ✅ Projects management system (2025-11-18)
- ✅ Uniks module expansion (2025-11-13)

---

## 📊 PROJECT STATISTICS

**Current Package Count**: 52 packages

**Build Performance**: ~4-6 minutes (full workspace)

**Test Coverage**: TBD (tests not yet comprehensive)

---

## 🎯 ROADMAP (Tentative)

### Q1 2025
- [x] Admin module with RBAC
- [x] Global roles system
- [ ] Role-based UI customization
- [ ] Multi-tenancy support

### Q2 2025
- [ ] ABAC conditions implementation
- [ ] Advanced permission testing
- [ ] Performance optimization sprint
- [ ] Security audit & hardening

### Q3 2025
- [ ] Mobile app development
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Plugin/extension system

### Q4 2025
- [ ] AI-powered features
- [ ] Advanced automation workflows
- [ ] Enterprise features (SSO, LDAP)
- [ ] Compliance certifications (SOC 2, ISO 27001)

---

**Last Updated**: 2025-12-10

**Note**: For implementation details → progress.md. For patterns → systemPatterns.md.
