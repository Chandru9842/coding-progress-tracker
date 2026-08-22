# Automated Testing & Regression System Architecture

Documentation for the permanent automated testing, security validation, regression suite, and quality gate system for **Coding Progress Tracker**.

---

## 1. Testing Architecture & Principles

The testing framework enforces quality assurance for every development phase. No phase is complete simply because new code functions; every phase must automatically verify that **all previously completed functionality** remains 100% operational with **zero regressions**.

```
                           ┌─────────────────────────┐
                           │    npm run verify       │  Quality Gate Command
                           └────────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
   │   Type Checking  │       │  Prisma Client   │       │ Automated Test   │
   │  (npm run lint)  │       │   Generation     │       │     Runner       │
   └──────────────────┘       └──────────────────┘       └─────────┬────────┘
                                                                   │
                         ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
                         ▼                                         ▼                                         ▼
              ┌─────────────────────┐                   ┌─────────────────────┐                   ┌─────────────────────┐
              │     Unit Tests      │                   │  Integration Tests  │                   │  Regression Suites  │
              └─────────────────────┘                   └─────────────────────┘                   └─────────────────────┘
```

---

## 2. Test Environments & Database Isolation

- **Isolation Principle**: Automated tests never operate against production databases or delete live user records.
- **Environment Variables**: Tests run in an isolated test context configured via process environment variables.
- **Database Fallback Engine**: If a live PostgreSQL instance is unconfigured during dev test execution (`DATABASE_URL` not set), the test harness automatically validates security and student responsibility rules against the in-memory responsibility resolution engine.

---

## 3. Test Suites Overview

### Unit Tests (`server/src/tests/unit/`)
- `env.test.ts`: Validates environment configuration, secret loading, and password string rules.
- `authMiddleware.test.ts`: Verifies `requireAuth`, `requireAdmin`, and `requireStaff` RBAC middleware.
- `studentAuthService.test.ts`: Verifies student responsibility access resolution logic.

### Integration & Security Tests (`server/src/tests/integration/` & `security/`)
- `health.test.ts`: Verifies `GET /api/v1/health` returning `200 OK` and `{"status": "ok"}`.
- `auth.test.ts`: Tests faculty login, session validation (`GET /me`), and cookie clearing logout.
- `staffManagement.test.ts`: Tests Staff creation, status toggles (enable/disable), and password resets.
- `rbacSecurity.test.ts`: Verifies that ADMIN-only APIs strictly reject `STAFF` role with `403 Forbidden`.

### Regression Suites (`server/src/tests/regression/`)
- `phase1.regression.test.ts`: Complete Phase 1 regression verification.
- `phase2.regression.test.ts`: Complete Phase 2 regression verification.
- `responsibility60Student.regression.test.ts`: Permanently automated 60-student multi-staff responsibility scenario test:
  - 2023–2027 CSE-A (60 students).
  - Selected student responsibilities (20 / 20 / 20).
  - Unauthorized student access checks (returns 403 / false).
  - Section-wide responsibility toggle (`ALL` mode -> 60 students).
  - Section assignment removal -> 20 students.
  - Combined multi-batch assignment set (20 + 15 + 10 = 45 students).

---

## 4. Test Commands Reference

| Command | Action / Purpose |
| :--- | :--- |
| `npm test` | Executes the complete central automated test suite |
| `npm run test:unit` | Executes unit tests |
| `npm run test:integration` | Executes API integration tests |
| `npm run test:security` | Executes RBAC security & authorization tests |
| `npm run test:regression` | Executes Phase 1, Phase 2, and 60-student regression suites |
| `npm run verify` | Full Quality Gate: runs typechecking, Prisma generation, test suites, and production build |

---

## 5. Feature & Test Coverage Matrix

| Feature | Phase | Test Module | Type | Status |
| :--- | :---: | :--- | :--- | :---: |
| Health Check API (`GET /api/v1/health`) | 1 | `phase1.regression.test.ts` | Integration | **PASS** |
| Admin Authentication & Session | 1 | `auth.test.ts` | Integration | **PASS** |
| HttpOnly Cookie Session Management | 1 | `phase1.regression.test.ts` | Security | **PASS** |
| Password Hashing (No Plaintext Storage) | 1 | `env.test.ts` | Unit/Security | **PASS** |
| Unauthenticated Dashboard Redirection | 1 | `phase1.regression.test.ts` | E2E/Client | **PASS** |
| Staff Account Creation (Role Locking) | 2 | `staffManagement.test.ts` | Integration | **PASS** |
| Staff Enable / Disable Status Toggle | 2 | `phase2.regression.test.ts` | Integration | **PASS** |
| RBAC API Protection (403 for Staff) | 2 | `authMiddleware.test.ts` | Security | **PASS** |
| Batch & Section Management | 2 | `batchSection.test.ts` | Integration | **PASS** |
| Selected Student Assignments (20/20/20) | 2 | `responsibility60Student.regression.test.ts` | Regression | **PASS** |
| Section-wide Responsibility (`ALL` mode) | 2 | `responsibility60Student.regression.test.ts` | Regression | **PASS** |
| Multi-Batch Responsibility Sets (45 total) | 2 | `responsibility60Student.regression.test.ts` | Regression | **PASS** |
| Unique Constraint & Duplicate Prevention | 2 | `phase2.regression.test.ts` | Database | **PASS** |

---

## 6. Future Phase Completion Rules

For **EVERY** future development phase, the following sequence is strictly enforced:

1. **Implement**: Write new feature logic.
2. **Test New Features**: Add unit/integration tests for the new phase.
3. **Run Previous Regressions**: Run `npm run test:regression`.
4. **Run Typecheck**: Run `npm run lint`.
5. **Run Production Build**: Run `npm run build`.
6. **Debug & Fix**: If any failure occurs, inspect the root cause, fix the implementation, and rerun until all checks pass.
7. **Report Phase Completion**: Report phase completion **ONLY** when `npm run verify` exits cleanly with `0 errors`.
