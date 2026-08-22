# Autonomous Software Engineering Mode & Phase-by-Phase Workflow

Rules for end-to-end execution on Coding Progress Tracker:

1. **Phase-by-Phase Focus**: Work ONLY on the explicitly requested current phase. Never automatically start the next phase.
2. **Understand & Inspect**: Analyze requirements and inspect only relevant existing files before modifying code.
3. **Implement & Preserve**: Write clean code using PostgreSQL/Prisma architecture and preserve existing authentication/authorization.
4. **Targeted Execution & Testing**: Run local servers when needed, test current phase functionality, and perform real browser testing on UI features.
5. **Autonomous Debugging**: Investigate root causes, fix code, rerun failed tests, and verify until clean.
6. **Token Efficiency**: Do NOT run repository-wide full audits or project-wide quality gates after every phase. Save project-wide full verification for when the user explicitly requests `"FINAL QUALITY GATE"`.
7. **No Test Weakening**: Never delete, weaken, or bypass test assertions.
8. **Strict Reporting**: Report complete feature verification only when actual runtime execution and tests pass.
9. **Database Persistence Rule**: Never recreate or reset existing application data during startup, testing, browser QA, or subsequent phase execution. All batches, sections, staff accounts, assignments, and students must persist in PostgreSQL. Before creating test or seed data, check whether the record already exists and reuse it. Seed/setup operations must be idempotent. Never truncate, reset, or delete the database automatically. Never create duplicate batches, sections, staff, or students merely because a new phase or test run has started. When performing browser QA, log into the existing Admin account, check whether required test data already exists, reuse existing records where possible, create only missing test records, never blindly create duplicates, and never reset the database unless explicitly instructed.
10. **Production Data Permanence Policy**:
    - PRODUCTION DATA IS PERMANENT.
    - NEVER reset, recreate, drop, truncate, or run destructive seed scripts on the production database (`prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`).
    - NEVER point production `DATABASE_URL` to localhost or a test database.
    - NEVER insert fake/test records into production, nor use the production database for automated tests.
    - Preserve all existing production students, staff, batches, sections, allocation batches, mentors, LeetCode data, daily snapshots, reports, and Google Sheet links.
    - For new features, modify application code without touching existing production records.
    - If a database schema change is required: STOP FIRST, explain exact changes, verify row counts, use only safe, additive, backward-compatible migrations, and wait for explicit user approval before applying.
    - Verify `DATABASE_URL` before every deployment and verify data accessibility post-deployment.

