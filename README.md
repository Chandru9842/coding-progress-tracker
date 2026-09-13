# ⚡ Coding Progress Tracker & LeetCode Analytics Engine

<div align="center">

[![Production Deployment](https://img.shields.io/badge/Vercel-Live%20Production-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://coding-progress-tracker-navy.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React%2018-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)](https://www.google.com/sheets/about/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Enterprise Higher-Education Faculty Analytics Dashboard, Continuous LeetCode Synchronization Engine & Zero-Click Google Sheets Automation Platform.</b>
</p>

[**🌐 Live Application**](https://coding-progress-tracker-navy.vercel.app) • [**📘 System Architecture**](#-system-architecture) • [**🤖 Smart Bulk Import**](#-smart-csv--excel-bulk-import-engine) • [**⏰ Auto-Sync Schedule**](#-automated-synchronization-schedule) • [**📊 Apps Script Setup**](#-google-apps-script-integration-guide) • [**🚀 Quickstart**](#-quickstart--local-development)

</div>

---

## 📑 Table of Contents
- [🌟 Executive Summary](#-executive-summary)
- [✨ Key Architectural Features](#-key-architectural-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🤖 Smart CSV / Excel Bulk Import Engine](#-smart-csv--excel-bulk-import-engine)
- [⏰ Automated Synchronization Schedule](#-automated-synchronization-schedule)
- [📊 Google Apps Script Integration Guide](#-google-apps-script-integration-guide)
- [👥 Allocation Batches & Sub-Batch Mentor Tracking](#-allocation-batches--sub-batch-mentor-tracking)
- [⚡ High-Performance Caching & Resilience](#-high-performance-caching--resilience)
- [🚀 Quickstart & Local Development](#-quickstart--local-development)
- [📁 Repository Directory Structure](#-repository-directory-structure)
- [📡 REST API Reference](#-rest-api-reference)
- [🔐 Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [🧪 Testing & Quality Gates](#-testing--quality-gates)
- [☁️ Production Deployment (Vercel)](#️-production-deployment-vercel)
- [🤝 Open-Source Contribution Guide](#-open-source-contribution-guide)
- [👨‍💻 Author & Engineering](#-author--engineering)
- [📄 License](#-license)

---

## 🌟 Executive Summary

**Coding Progress Tracker** is an enterprise-grade academic analytics platform engineered for higher-education institution faculty (Heads of Department, Professors, Placement Coordinators, and Student Mentors) to track, audit, and benchmark student algorithmic problem-solving activity on LeetCode across cohorts, departments, and academic batches.

### The Operational Challenge
1. **Manual Tracking Overhead**: Faculty previously spent dozens of hours weekly visiting individual student profiles and manually transcribing counts into spreadsheets.
2. **Missing Historical Deltas**: Public profiles only display cumulative lifetime numbers, making it impossible to audit weekly/daily student problem-solving progress.
3. **Data Quality & Formula Breakage**: Manually maintained spreadsheets suffered from column shifting, formula corruption, and absent audit trails.

### The Engineering Solution
- **Continuous 2-Hour Daytime Sync + 12:30 AM IST Daily Rollover**: Automated background synchronization fetches real-time problem counts (`Total`, `Easy`, `Medium`, `Hard`) via multi-fallback proxies and updates Google Sheets via Webhooks.
- **Universal Smart Bulk Import**: Ingests raw institutional CSV/Excel rosters, auto-removes duplicate entries, disambiguates same-name students with their Date of Birth, isolates non-mentor students for bulk assignment, and discards extraneous columns.
- **Configurable Starting Date Scopes**: Choose whether linked sheets track full historical progress, start clean from today, or begin from any arbitrary date with dynamic daily column expansion.
- **Sub-Batch & Allocation Batch Mentorship**: Group students within a section into distinct allocation batches (`Batch-1`, `Batch-2`) assigned to dedicated faculty mentors.

---

## ✨ Key Architectural Features

| Feature | Technical Implementation | Value Provided |
|---|---|---|
| **🤖 Universal AI Bulk Importer** | Dynamic regex token matching, auto-deduplication, same-name DOB disambiguation, strict schema parsing. | Eliminates manual data entry; accepts any institutional roster format. |
| **⏰ Continuous Auto-Sync** | GitHub Actions workflow every 2 hours (8 AM – 10 PM IST) + 12:30 AM IST nightly rollover. | Ensures faculty and students always have up-to-date metrics without human intervention. |
| **📜 Zero-Click Google Sheets Engine** | Google Apps Script webhook receiver with automated grid styling, freezing headers, and zebra striping. | Synchronizes PostgreSQL data directly into faculty Google Sheets. |
| **🗓️ Flexible Date Scopes** | `Full History`, `From Today`, `From Yesterday`, `Custom Date`. | Supports semester starts, bootcamps, and hackathon evaluation sprints. |
| **📈 Daily Snapshot Deltas** | Date-keyed immutable PostgreSQL snapshots calculating exact daily gains (`+E`, `+M`, `+H`, `+Total`). | Enables effort auditing and prevents last-minute cramming deception. |
| **👥 Allocation Batches** | Cascading `Section &rarr; AllocationBatch &rarr; Student &rarr; Mentor` data relationships. | Allows mentors to oversee distinct sub-groups within large sections. |
| **⚡ Instant Client Rehydration** | Client-side in-memory cache rehydration with Stale-While-Revalidate (SWR) patterns. | Eliminates tab switching delays and loading spinners completely. |
| **🛡️ Multi-Tier RBAC** | JWT authentication with cryptographic role guards (`ADMIN` vs. `STAFF`). | Protects student records and preserves departmental boundaries. |

---

## 🏗️ System Architecture

```mermaid
graph TD
    User["👨‍🏫 Faculty Member / Admin"] -->|"HTTPS / JWT Auth"| Client["⚛️ React 18 + TypeScript SPA (Vercel Edge CDN)"]
    Client -->|"Instant Cache Rehydration"| Cache["⚡ In-Memory SWR Client Cache"]
    Client -->|"REST API (/api/v1/*)"| Serverless["⚡ Express + Node.js API"]
    Serverless -->|"Prisma ORM (Single-Query Joins)"| Database[("🐘 PostgreSQL Database (Supabase)")]
    
    GHA["⏰ GitHub Actions Cron (Every 2h Daytime IST)"] -->|"POST /api/v1/cron/daily-sync"| Serverless
    NightlyCron["⏰ Nightly Rollover (12:30 AM IST)"] -->|"POST /api/v1/cron/daily-sync"| Serverless
    
    Serverless -->|"Multi-Proxy Resilient Fetch"| Proxies["🧩 LeetCode Public GraphQL & Fallback Proxies"]
    Proxies -->|"Real-Time Solved Stats"| Serverless
    Serverless -->|"Store Date-Keyed Snapshots"| Database
    Serverless -->|"POST JSON (text/plain)"| Webhook["📜 Google Apps Script Webhook"]
    Webhook -->|"Clear, Format & Append"| Sheet["📊 Linked Google Sheet"]
```

---

## 🤖 Smart CSV / Excel Bulk Import Engine

The platform features an intelligent, zero-friction **Universal Bulk Import Engine** designed to handle real-world higher-education roster files.

### 🧠 Core Automation Capabilities:

1. **🛡️ Automatic Duplicate Removal**:
   - Automatically detects duplicate register numbers within the uploaded spreadsheet.
   - Drops duplicate rows from the parsed import list so only unique student records are presented and imported.
   - Displays a clear summary badge: `✨ N Duplicate(s) Auto-Resolved`.

2. **🆔 Same Name & Same Initial — DOB Disambiguation**:
   - In institutional cohorts, students frequently share the exact same name and initial (e.g., two `SARAVANAKUMAR V`s or `PRAVEEN K`s).
   - The parser automatically extracts the Date of Birth (from parentheses `(07.12.2005)` or date cells).
   - When identical names are detected, each student's name is distinguished with their DOB:
     - `SARAVANAKUMAR V (DOB: 07.12.2005)`
     - `SARAVANAKUMAR V (DOB: 14.05.2006)`
   - Students with unique names remain clean without date clutter.

3. **⚠️ Dedicated Non-Mentor Students Review & Assignment**:
   - If students in the sheet lack mentor details, they are flagged as `Unassigned`.
   - A prominent filter pill **`⚠️ Non-Mentor Students (N)`** instantly isolates these students.
   - A quick bulk-assignment toolbar allows faculty to select unassigned students and assign them to any staff mentor in one click:
     `Assign Selected (N) to Mentor: [Choose Staff] [Assign Mentor]`.
   - Includes a dedicated "Non-Mentor Students" mapping card and per-row inline dropdowns.

4. **🔒 Strict Sample Intake Schema (Excludes Extra Information)**:
   - Institutional spreadsheets often contain extraneous columns (phone numbers, parent details, blood groups, addresses, personal emails, marks).
   - The engine strictly extracts **only** supported intake fields and discards all extra columns.
   - Downloadable sample template (`student_import_sample_template.csv`) matches the clean intake schema:
     `Register Number, Student Name, Department, Section, Study Year, Mentor Name, LeetCode Profile URL`.

---

## ⏰ Automated Synchronization Schedule

To balance real-time student tracking with LeetCode API rate-limit resilience, the platform implements an automated synchronization architecture:

### 1. Active Daytime Auto-Sync (Every 2 Hours IST)
Triggered automatically via GitHub Actions workflow ([`.github/workflows/daily-sync.yml`](.github/workflows/daily-sync.yml)):

| Execution Time (IST) | UTC Schedule (Cron) | Action Performed |
|---|---|---|
| **08:00 AM IST** | `02:30 UTC` | Morning baseline sync across all students & active Google Sheets |
| **10:00 AM IST** | `04:30 UTC` | Morning lab session sync & Google Sheet update |
| **12:00 PM IST** | `06:30 UTC` | Midday progress sync & Google Sheet update |
| **02:00 PM IST** | `08:30 UTC` | Afternoon session sync & Google Sheet update |
| **04:00 PM IST** | `10:30 UTC` | Evening lab/contest sync & Google Sheet update |
| **06:00 PM IST** | `12:30 UTC` | Post-class practice sync & Google Sheet update |
| **08:00 PM IST** | `14:30 UTC` | Prime study hours sync & Google Sheet update |
| **10:00 PM IST** | `16:30 UTC` | Late evening practice sync & Google Sheet update |

### 2. Nightly Rollover & Snapshot Reconciliation (12:30 AM IST)
- Runs daily at **12:30 AM IST (19:00 UTC)**.
- Finalizes immutable daily progress snapshots for the completed IST calendar date.
- Recalculates problem-solving deltas (`+Easy`, `+Medium`, `+Hard`, `+Total`).
- Appends new date columns to all linked Google Sheets.

---

## 📊 Google Apps Script Integration Guide

Connect any Google Sheet to receive automated background synchronization:

### Step 1: Open Apps Script in Your Sheet
1. Open your Google Sheet (`https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`).
2. Click **Extensions &rarr; Apps Script**.

### Step 2: Paste the Webhook Handler
Replace all content in `Code.gs` with this production script:

```javascript
/**
 * Coding Progress Tracker - Google Sheets Automation Webhook
 * Version: 2.2.0
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();

    // 1. Render & Style Header Row
    if (data.headers && data.headers.length > 0) {
      sheet.appendRow(data.headers);
      var headerRange = sheet.getRange(1, 1, 1, data.headers.length);
      headerRange.setBackground("#1E293B"); // Slate Navy Blue
      headerRange.setFontColor("#FFFFFF");  // Bold White Text
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Calibri");
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 30);
      sheet.setFrozenRows(1);
    }

    // 2. Render & Style Data Rows
    if (data.rows && data.rows.length > 0) {
      for (var i = 0; i < data.rows.length; i++) {
        sheet.appendRow(data.rows[i]);
      }

      var totalRows = data.rows.length;
      var totalCols = data.headers ? data.headers.length : sheet.getLastColumn();
      var dataRange = sheet.getRange(2, 1, totalRows, totalCols);
      dataRange.setFontFamily("Calibri");
      dataRange.setFontSize(10);
      dataRange.setVerticalAlignment("middle");

      // Format Register Number column (Column 7) as Plain Text
      sheet.getRange(2, 7, totalRows, 1).setNumberFormat("@");

      // Alternating Row Colors (Zebra Striping) & Grid Borders
      for (var r = 2; r <= totalRows + 1; r++) {
        var rowBg = (r % 2 === 0) ? "#F8FAFC" : "#FFFFFF";
        sheet.getRange(r, 1, 1, totalCols).setBackground(rowBg);
        sheet.setRowHeight(r, 22);
      }
      dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    }

    // 3. Auto-fit Column Widths with Minimum Padding
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      sheet.autoResizeColumns(1, lastCol);
      var minWidths = [60, 130, 120, 110, 140, 180, 160, 220, 180];
      for (var col = 1; col <= lastCol; col++) {
        var currWidth = sheet.getColumnWidth(col);
        var minW = (col <= minWidths.length) ? minWidths[col - 1] : 110;
        sheet.setColumnWidth(col, Math.max(currWidth + 20, minW));
      }
    }

    return ContentService.createTextOutput("SUCCESS");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}
```

### Step 3: Deploy as Web App
1. Click **Deploy &rarr; New deployment**.
2. Select type: **Web app**.
3. Set **Execute as**: `Me (your_email@gmail.com)`.
4. Set **Who has access**: `Anyone`.
5. Authorize access and copy the generated **Web App URL**.

### Step 4: Link in the Application
1. Navigate to **Linked Google Sheets &rarr; + Link New Sheet**.
2. Paste the **Spreadsheet URL** and the **Apps Script Webhook URL**.
3. Select your starting date scope (e.g. `⚡ From Today`) and click **Link & Populate Sheet**.

---

## 👥 Allocation Batches & Sub-Batch Mentor Tracking

Higher-education departments routinely divide large sections (e.g., 60+ students in `CSE-A`) into smaller **Allocation Batches** (`Batch-1`, `Batch-2`, `Batch-3`, `Batch-4`) assigned to specific faculty mentors:

- **Visual Badges**: Batch cards display the assigned mentor and student count (`Batch-1 (23 Students) • 👤 Mrs. K. Devi`).
- **Detail Modal**: Click any allocation batch to inspect intake, department, section, assigned mentor, and full student roster.
- **Cascade Inheritance**: Assigning a student to an allocation batch automatically inherits the mentor and scopes access accordingly.

---

## ⚡ High-Performance Caching & Resilience

- **Instant Client Cache Rehydration (`getCachedData`)**: Navigating between Student Directory, Snapshots, Reports, and Batch pages displays data in 0ms using client memory caching while background revalidation fetches updates.
- **Server Cache Wrap (`serverCache.wrap`)**: Costly aggregations (`getReportData`, `getStudentDailyProgress`, `getStudentSnapshots`) are cached in memory and selectively invalidated upon mutations.
- **Multi-Proxy Resilient LeetCode Engine**: Automatically cycles between official GraphQL, Alfa Proxy, and fallback proxy endpoints with exponential backoff on HTTP 429 rate limits.

---

## 🚀 Quickstart & Local Development

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL Database** (Local or Supabase / Neon connection string)

### 1. Clone the Repository
```bash
git clone https://github.com/Chandru9842/coding-progress-tracker.git
cd coding-progress-tracker
```

### 2. Configure Environment Variables
Create `.env` in the root directory:
```env
# PostgreSQL Database Connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/coding_tracker?schema=public"

# Authentication Secrets
JWT_SECRET="super_secret_jwt_encryption_key_change_me"

# Initial Admin Credentials (Auto-seeded on first run)
INITIAL_ADMIN_NAME="Dr. System Admin"
INITIAL_ADMIN_EMAIL="admin@college.edu"
INITIAL_ADMIN_PASSWORD="AdminPassword123!"

# Cron Security Secret
CRON_SECRET="coding_tracker_cron_secret"

# Server Port
PORT=5000
```

### 3. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Initialize Database
```bash
npm run prisma:generate
npm run prisma:push
```

### 5. Launch Development Server
```bash
# Concurrently launches Express API (Port 5000) and Vite SPA (Port 5173)
npm run dev
```

Visit **`http://localhost:5173`** in your browser and log in with your admin credentials.

---

## 📁 Repository Directory Structure

```text
coding-progress-tracker/
├── .github/
│   └── workflows/
│       └── daily-sync.yml        # GitHub Actions 2-hour auto-sync workflow
├── api/
│   └── index.ts                  # Vercel Serverless Function entrypoint
├── client/                       # React 18 + TypeScript Frontend SPA
│   ├── src/
│   │   ├── components/           # Navbar, Sidebar, Layout, ProtectedRoute, Modals
│   │   ├── context/              # AuthContext session state
│   │   ├── pages/                # DashboardPage, StudentsPage, StudentDetailPage, ReportsPage, BatchesPage
│   │   ├── services/             # Axios API client with in-memory caching
│   │   ├── utils/                # Smart CSV parser, DOB extraction, export utilities
│   │   └── types/                # TypeScript Interfaces & Data Models
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                       # Node.js + Express.js + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma         # Prisma Schema (PostgreSQL)
│   ├── src/
│   │   ├── controllers/          # Student, Staff, Batch, Sync, GoogleSheet, Report controllers
│   │   ├── db/                   # Prisma Client Singleton & In-Memory Store
│   │   ├── middleware/           # JWT auth verification, RBAC role guards, error handler
│   │   ├── routes/               # Express REST Routes (/api/v1/*)
│   │   ├── services/             # LeetCode GraphQL Engine, Google Sheets Service, Cron Service
│   │   ├── utils/                # Server CSV parser, DOB disambiguation, serverCache
│   │   └── tests/                # Automated regression test suites (16 suites)
│   ├── package.json
│   └── tsconfig.json
├── vercel.json                   # Vercel Single-Origin Routing & Cron Configuration
├── package.json                  # Monorepo Scripts & Build Commands
└── README.md                     # Technical Documentation
```

---

## 📡 REST API Reference

All API endpoints are prefixed with `/api/v1`:

### 🔑 Authentication & Profiles
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & receive JWT token |
| `GET` | `/api/v1/auth/me` | Authenticated | Get current authenticated user profile |
| `PUT` | `/api/v1/auth/profile` | Authenticated | Update user name, email, or password |

### 🎓 Students Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/students` | Staff / Admin | Get students scoped to user permissions |
| `GET` | `/api/v1/students/:studentId` | Staff / Admin | Get student details with historical snapshots |
| `POST` | `/api/v1/students` | Staff / Admin | Create single student record & sync LeetCode |
| `PUT` | `/api/v1/students/:studentId` | Staff / Admin | Update student details, mentor, or section |
| `DELETE` | `/api/v1/students/:studentId` | Staff / Admin | Delete student record |
| `POST` | `/api/v1/students/bulk-delete` | Staff / Admin | Bulk delete selected student records |
| `POST` | `/api/v1/students/bulk-import` | Staff / Admin | Ingest parsed CSV/Excel student roster with auto-mapping |

### 🏫 Batches, Sections & Allocation Batches
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/batches` | Staff / Admin | List all academic intake batches |
| `GET` | `/api/v1/batches/:batchId` | Staff / Admin | Get batch details with sections & allocation batches |
| `POST` | `/api/v1/batches` | Admin Only | Create new academic intake batch |
| `POST` | `/api/v1/batches/:batchId/sections` | Admin Only | Create section within a batch |
| `GET` | `/api/v1/sections/:sectionId/allocation-batches` | Staff / Admin | Get allocation batches for a section |
| `POST` | `/api/v1/sections/:sectionId/allocation-batches` | Admin Only | Create allocation batch |
| `PUT` | `/api/v1/allocation-batches/:id` | Admin Only | Update allocation batch name |
| `DELETE` | `/api/v1/allocation-batches/:id` | Admin Only | Delete allocation batch |

### 👥 Staff & Faculty Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/staff` | Admin Only | List all faculty staff members |
| `POST` | `/api/v1/staff` | Admin Only | Create new faculty account |
| `PUT` | `/api/v1/staff/:id` | Admin Only | Update faculty details |
| `DELETE` | `/api/v1/staff/:id` | Admin Only | Remove faculty account |
| `PUT` | `/api/v1/staff/:id/status` | Admin Only | Toggle active status |
| `POST` | `/api/v1/staff/:id/assign-scope` | Admin Only | Assign faculty to batches, sections, or sub-batches |
| `POST` | `/api/v1/staff/unassign-scope` | Admin Only | Remove faculty scope assignment |

### 📊 Reports & Excel Exports
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/reports/history` | Staff / Admin | Fetch synchronization audit history |
| `POST` | `/api/v1/reports/sync-and-export` | Staff / Admin | Trigger real-time sync & generate export |
| `GET` | `/api/v1/reports/export-excel` | Staff / Admin | Download formatted Excel (.xlsx) report |

### 📑 Google Sheets Integration
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/google-sheets/links` | Staff / Admin | List authorized linked Google Sheets |
| `POST` | `/api/v1/google-sheets/links` | Staff / Admin | Link new Google Sheet with custom start date |
| `PUT` | `/api/v1/google-sheets/links/:id` | Staff / Admin | Update title, webhook URL, start date, or active status |
| `POST` | `/api/v1/google-sheets/links/:id/sync` | Staff / Admin | Trigger manual sync for a specific sheet |
| `POST` | `/api/v1/google-sheets/links/sync-all` | Staff / Admin | Bulk sync all active linked Google Sheets |
| `DELETE` | `/api/v1/google-sheets/links/:id` | Staff / Admin | Unlink sheet (moves to Historical Archive) |
| `DELETE` | `/api/v1/google-sheets/links/:id?permanent=true` | Staff / Admin | Permanently delete sheet |

### ⏰ Automated Synchronization Crons
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET/POST` | `/api/v1/cron/daily-sync` | Cron Secret / Admin | Automated 2-hour & nightly reconciliation sync |

---

## 🔐 Role-Based Access Control (RBAC)

1. **`ADMIN` Role**:
   - Institution-wide access across all departments and cohorts.
   - Staff account provisioning, scope assignment, and password resets.
   - Master Google Sheets management and institution-wide sync scheduling.
   - Batch, section, and allocation batch creation.

2. **`STAFF` Role**:
   - Scoped strictly to assigned academic years, departments, sections, and allocation batches.
   - View student progress and snapshot history within assigned scope.
   - Create and manage scoped Google Sheets for assigned cohorts.
   - Import student spreadsheets into assigned sections.

---

## 🧪 Testing & Quality Gates

The repository enforces strict testing discipline across 16 automated suites with zero weakened assertions:

```bash
# Run all automated test suites
npm test

# Run CSV smart import unit tests
npx tsx server/src/tests/unit/csvStudentImport.test.ts

# Production build verification
npm run build
npm --prefix server run build
```

---

## ☁️ Production Deployment (Vercel)

The codebase is optimized for zero-configuration, single-origin deployment on Vercel:

```bash
# Build production bundles
npm run build

# Deploy to Vercel production
npx vercel --prod
```

### Production Environment Variables:
- `DATABASE_URL`: Production PostgreSQL / Supabase connection string.
- `JWT_SECRET`: High-entropy encryption key for session tokens.
- `INITIAL_ADMIN_EMAIL`: Default administrator email.
- `INITIAL_ADMIN_PASSWORD`: Default administrator password.
- `CRON_SECRET`: Authorization secret for Vercel and GitHub Actions cron triggers.

---

## 🤝 Open-Source Contribution Guide

Contributions, bug reports, and feature requests are welcome!

1. Fork the repository (`https://github.com/Chandru9842/coding-progress-tracker`).
2. Create your Feature Branch (`git checkout -b feature/NewCapability`).
3. Verify test suites pass (`npm test`).
4. Commit your changes (`git commit -m 'feat: Add NewCapability'`).
5. Push to the branch (`git push origin feature/NewCapability`).
6. Open a Pull Request with description and test logs.

---

## 👨‍💻 Author & Engineering

**Chandru M**  
*Full-Stack Software Engineer & Platform Architect*
- **GitHub**: [@Chandru9842](https://github.com/Chandru9842)
- **Repository**: [https://github.com/Chandru9842/coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)
- **Live Production Platform**: [https://coding-progress-tracker-navy.vercel.app](https://coding-progress-tracker-navy.vercel.app)

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
