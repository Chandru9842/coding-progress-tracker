# Coding Progress Tracker (Phase 1)

A college faculty web application designed for tracking student coding activity, batch performance metrics, and progress logs.

---

## Project Purpose

**Coding Progress Tracker** empowers college faculty (Department Heads, Professors, and Mentors) to track, evaluate, and analyze student coding progress across platforms.

### Core Authentication & Access Rules
- **Faculty Only**: Only authenticated faculty members (`ADMIN` and `STAFF`) can log in.
- **No Student Login**: Students do NOT have accounts, passwords, or authentication credentials. Students exist strictly as database records.
- **Role-Based Permissions**:
  - `ADMIN`: Manages overall department statistics, faculty user accounts, batches, sections, and global system configuration.
  - `STAFF`: Manages assigned student batches, views section analytics, and generates progress reports.

---

## Technology Stack

- **Frontend**: React 18+, Vite, TypeScript, React Router v6, Lucide Icons, Custom Modern CSS System.
- **Backend**: Node.js, Express, TypeScript, Prisma ORM.
- **Database**: PostgreSQL.
- **Authentication**: JWT stored in HttpOnly cookies, `bcryptjs` password hashing, custom authorization middleware (`requireAuth`, `requireAdmin`, `requireStaff`).
- **Deployment Target**: Unified Vercel serverless function (`api/index.ts`) hosting both frontend SPA and Express API under a single origin.

---

## Folder Structure

```
coding-progress-tracker/
├── api/
│   └── index.ts                  # Vercel Serverless entrypoint wrapping Express app
├── client/                       # React + Vite + TypeScript Frontend
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/           # Sidebar, Topbar, Layout, ProtectedRoute
│   │   ├── context/              # AuthContext session provider
│   │   ├── pages/                # LoginPage, DashboardPage, SettingsPage
│   │   ├── services/             # Axios API service client
│   │   ├── types/                # TypeScript data interfaces
│   │   ├── App.tsx               # App routing and auth guards
│   │   ├── index.css             # Glassmorphism design tokens & styles
│   │   └── main.tsx              # React mounting root
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                       # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma         # PostgreSQL schema definition
│   ├── src/
│   │   ├── config/               # Environment configuration
│   │   ├── controllers/          # Auth, Health, & Stats controllers
│   │   ├── db/                   # Prisma database client singleton
│   │   ├── middleware/           # requireAuth, requireAdmin, requireStaff, errorHandler
│   │   ├── routes/               # API route definitions (/api/v1)
│   │   ├── services/             # Auth & User services (initial admin seeding)
│   │   ├── types/                # Express & Auth request extensions
│   │   ├── app.ts                # Express app configuration
│   │   └── index.ts              # Local development server runner
│   ├── package.json
│   └── tsconfig.json
├── .env.example                  # Environment variable template
├── package.json                  # Root monorepo workspace scripts
├── tsconfig.json                 # Root TypeScript configuration
├── vercel.json                   # Unified Vercel routing configuration
└── README.md                     # Documentation
```

---

## Environment Variables

Copy `.env.example` to create `.env` in the root directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/coding_tracker?schema=public
JWT_SECRET=your_secure_jwt_secret_key_here
INITIAL_ADMIN_NAME=System Administrator
INITIAL_ADMIN_EMAIL=admin@college.edu
INITIAL_ADMIN_PASSWORD=AdminPass123!
```

> [!IMPORTANT]
> Never commit actual secrets or credentials into source control.

---

## Database Schema Foundation (PostgreSQL / Prisma)

1. **`users`**: Faculty user accounts (`ADMIN` / `STAFF`) with email, bcrypt password hash, and active status.
2. **`batches`**: Dynamic student intake batches with start year, end year, and department.
3. **`staff_batch_assignments`**: Maps faculty staff to assigned batches.
4. **`sections`**: Dynamic sections under batches (e.g., Section A, Section B).
5. **`students`**: Student records with unique register numbers (NOT database primary key) and LeetCode usernames.
6. **`daily_coding_snapshots`**: Historical daily snapshots preserving problem-solving stats (`easy_solved`, `medium_solved`, `hard_solved`, `total_solved`) with a unique constraint on `(student_id, snapshot_date)`.
7. **`generated_reports`**: Audit record of exported reports.

---

## Local Development & Setup

### 1. Install Dependencies
Run from root:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Database Migration & Seed
Ensure your PostgreSQL database is running and `DATABASE_URL` is set:
```bash
npm run prisma:push
```

### 3. Start Development Servers
Run frontend (Vite port 3000) and backend (Express port 5000) concurrently:
```bash
npm run dev
```

---

## Build & Lint Commands

```bash
# Lint codebases
npm run lint

# Compile server and build Vite static client
npm run build
```

---

## Vercel Deployment Architecture

The project is structured for **ONE unified Vercel deployment**:
- `api/index.ts` exports the Express application as a Vercel Serverless Function.
- `client/` is compiled into static assets served via Vercel CDN.
- `vercel.json` rewrites `/api/(.*)` to `api/index.ts` and routes all non-API paths to `client/dist/index.html` for single-page client routing.

---

## Roadmap & Future Phases

- **Phase 2**: Staff Management CRUD & Batch / Section Allocation
- **Phase 3**: Student Directory & Dynamic Batch Setup
- **Phase 4**: LeetCode Sync Engine & Daily Snapshot Collector
- **Phase 5**: Google Sheets Sync & Automated Report Generator
