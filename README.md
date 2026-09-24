# ⚡ CodeTrace Enterprise

<div align="center">

### *Modern Academic LeetCode Telemetry, Cohort Analytics & Zero-Click Google Sheets Automation Platform*

[![Production Deployment](https://img.shields.io/badge/Vercel-Live%20Production-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://coding-progress-tracker-navy.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React%2018-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)](https://www.google.com/sheets/about/)
[![Test Suite](https://img.shields.io/badge/Tests-18%20Passed%20%7C%200%20Failed-success?style=for-the-badge&logo=jest&logoColor=white)](#-testing--quality-assurance)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Built for Engineering Colleges, Universities, and Placement Cells to continuously monitor, analyze, and sync student competitive programming progress in real time.</b>
</p>

[**🌐 Live Application**](https://coding-progress-tracker-navy.vercel.app) • [**✨ Key Features**](#-key-features) • [**🏗️ Architecture**](#️-system-architecture) • [**🔍 Filter & Management**](#-student-management--multi-criteria-filtering) • [**🔄 Live Telemetry**](#-high-throughput-leetcode-telemetry-engine) • [**📊 Sheets Integration**](#-google-apps-script-integration-guide) • [**🚀 Quickstart**](#-quickstart--local-development)

</div>

---

## 📑 Table of Contents

- [🌟 Platform Overview](#-platform-overview)
- [✨ Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🔍 Student Management & Multi-Criteria Filtering](#-student-management--multi-criteria-filtering)
- [🔄 High-Throughput LeetCode Telemetry Engine](#-high-throughput-leetcode-telemetry-engine)
- [🤖 Smart Roster Import & Heuristic Mentor Attribution](#-smart-roster-import--heuristic-mentor-attribution)
- [🗑️ Guaranteed Idempotent Cascade Deletion](#️-guaranteed-idempotent-cascade-deletion)
- [📊 Google Apps Script Integration Guide](#-google-apps-script-integration-guide)
- [👥 Hierarchical Batches, Sections & Mentorship](#-hierarchical-batches-sections--mentorship)
- [📈 Daily Progress Snapshots & Temporal Deltas](#-daily-progress-snapshots--temporal-deltas)
- [📁 Repository Directory Structure](#-repository-directory-structure)
- [📡 REST API Reference](#-rest-api-reference)
- [🔐 Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [🚀 Quickstart & Local Development](#-quickstart--local-development)
- [☁️ Production Deployment (Vercel)](#️-production-deployment-vercel)
- [👨‍💻 Author & Engineering](#-author--engineering)
- [📄 License](#-license)

---

## 🌟 Platform Overview

**CodeTrace Enterprise** is an academic intelligence and telemetry platform engineered for Technical Institutions, Universities, Placement Cells, and Coding Clubs. It replaces manual spreadsheet tracking with an automated pipeline that continuously pulls live problem-solving statistics from **LeetCode**, captures immutable daily progress deltas, and synchronizes formatted data directly into departmental Google Sheets.

### The Problem It Solves
1. **Manual Faculty Burden**: Staff previously spent hours transcribing individual profile counts into departmental records.
2. **Lack of Temporal Tracking**: Public profiles show lifetime solve counts; faculty could not determine whether problems were solved this semester or years ago.
3. **Fragile Scraping & Rate Limits**: Burst-querying hundreds of student profiles triggers Cloudflare HTTP 429 rate limits, failing bulk syncs.
4. **Disorganized Academic Rosters**: Institutional spreadsheets often omit serial numbers, abbreviate faculty names, duplicate register numbers, or contain homonymous students.

### The CodeTrace Solution
- **Controlled Concurrency Telemetry**: Races official GraphQL and high-availability proxies with adaptive backoff, 6000ms timeouts, and sequential UI chunking, ensuring zero rate-limit drops.
- **Explicit Multi-Criteria Filtering**: Select Academic Year, Study Year, Department, Section, Sub-Batch, and Mentor before applying, with single-click reset and active filter badges.
- **Persistent Cascade Deletion**: Idempotent database transactions guarantee student records, historical snapshots, and mentor pairings are permanently removed without ghost reappearance on page refresh.
- **Zero-Click Google Sheets Automation**: Pushes live database records into departmental sheets with alternating zebra striping, freeze panes, and custom typography.
- **Fine-Grained Role-Based Access Control**: Ensures faculty members only access students assigned to their designated batches and sections.

---

## ✨ Key Features

| Capability | Technical Design | Institutional Value |
|---|---|---|
| **🔍 Multi-Criteria Filter** | Explicit `Filter` action + `Enter` key shortcut + active filter tags + instant `Reset`. | Review exactly the cohort needed without disruptive reloads on every dropdown change. |
| **⚡ Resilient Bulk Sync** | 5-worker server concurrency + 6000ms timeouts + sequential chunking + auto-retry on 429s. | 100% completion rate on bulk synchronization; zero rate-limiting failures. |
| **🗑️ Persistent Cascade Delete** | Idempotent Prisma `deleteMany` transaction + comprehensive cache purge (`serverCache.clear()`). | Deletion is guaranteed across DB, server cache, and client view; no ghost students on refresh. |
| **🔄 1.8s Background Auto-Sync** | Micro-batched client daemon ($N=1$, 1.8s interval, 25s cooldown) + `student-synced` event bus. | Continuous round-robin updates with in-place UI rehydration and zero visual flickering. |
| **🛡️ S.No Shielding Import** | Column-index agnostic parser evaluating records strictly by register number and name. | Zero dropped students; imports 100% of rows even when serial number columns are missing. |
| **🧠 Faculty Token Matcher** | Prefix-stripping fuzzy regex matcher (`Dr.`, `Mrs.`, `Prof.`) against registered staff accounts. | Preserves 100% mentor attribution fidelity regardless of spelling or title variations. |
| **⚠️ Unpaired Student Pool** | Quarantined review filter with one-click bulk mentor assignment toolbar. | Immediately isolates unassigned students and enables rapid allocation. |
| **🆔 DOB Disambiguation** | Automated Date-of-Birth extraction appended to duplicate names in the same cohort. | Seamlessly differentiates homonymous students (e.g., `SARAVANAKUMAR V (DOB: 07.12.2005)`). |
| **📊 Headless Google Sheets** | Outbound JSON webhook handler applying freeze panes, Calibri typography, and zebra rows. | Departmental spreadsheets stay synchronized with live database metrics without manual export. |
| **📈 Daily Snapshot Deltas** | Date-keyed immutable PostgreSQL snapshots recording daily deltas ($+\text{Easy}, +\text{Med}, +\text{Hard}$). | Audits steady semester-long effort versus last-minute placement review cramming. |
| **🔒 Enterprise RBAC** | Cryptographic JWT authentication with strict role guards (`ADMIN` vs. `STAFF`). | Complete departmental privacy; staff only view their assigned academic cohorts. |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React 18 + Vite SPA)"]
        User["👨‍🏫 Faculty / Administrator"] -->|"Interactive Filter & Sync"| UI["Students, Dashboard & Reports Views"]
        UI -->|"Explicit Filter Action"| FilterBar["Filter Bar (Batch, Section, Mentor, Dept)"]
        Daemon["🔄 AutoSyncManager Daemon<br/>(1.8s Heartbeat Loop)"] -->|"Custom Event ('student-synced')"| EventBus["📡 Browser Event Bus"]
        EventBus -->|"0ms In-Place DOM Rehydration"| UI
    end

    subgraph ServerGateway ["Backend API Gateway (Express + TypeScript)"]
        FilterBar -->|"GET /api/v1/students?batchId=..."| StudentCtrl["Student Controller"]
        UI -->|"POST /api/v1/sync/report-filtered"| SyncCtrl["Telemetry Controller"]
        AuthMiddleware["JWT Auth & Role Guard (ADMIN vs STAFF)"] --- StudentCtrl
        AuthMiddleware --- SyncCtrl
    end

    subgraph DataStorage ["Data & Storage Layer"]
        StudentCtrl -->|"Prisma ORM (Idempotent Cascade)"| DB[("🐘 PostgreSQL (Supabase / Neon)")]
        SyncCtrl -->|"Persist Daily Snapshots"| DB
        DB --> Snapshots["Daily Coding Snapshots (+E, +M, +H, +Total)"]
        DB --> Rosters["Batches, Sections, Allocation Batches & Mentors"]
    end

    subgraph TelemetryEngine ["Upstream Telemetry & Webhooks"]
        SyncCtrl -->|"5 Concurrent Workers + 6s Timeout"| Resolver["🧩 LeetCode Multi-Endpoint Resolver"]
        Resolver -->|"Official GraphQL API"| LeetOfficial["leetcode.com/graphql"]
        Resolver -->|"Fast Failover API Mirror"| LeetMirror["Faisal Shohag / Alfa Proxies"]
        
        SyncCtrl -->|"Headless POST Webhook"| AppsScript["📜 Google Apps Script Webhook"]
        AppsScript -->|"Render Zebra Grid & Freeze Panes"| Sheet["📊 Departmental Google Sheet"]
    end
```

---

## 🔍 Student Management & Multi-Criteria Filtering

The Students Management module allows faculty and administrators to filter, view, and organize student cohorts with precision:

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🔍 Search reg no, name...  │ Academic Year (All) ▼ │ Study Year (All) ▼ │ Dept (All) ▼ │ Section (All) ▼ │
│  Allocation Batch (All) ▼   │ Mentor (All) ▼        │ [⚡ Filter (3)]     │ [✕ Reset]                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Showing filtered results for: Batch: 2023-2027 • Section: Section CSE-A • Mentor: Mrs. K. Devi      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Features:
1. **Explicit "Filter" Button**: Dropdown selections do not trigger disruptive instant reloads. Configure all filter criteria (Academic Year, Study Year, Department, Section, Allocation Batch, Mentor, and Search), and click **Filter** (or press **Enter**) to view results.
2. **Active Filter Badge**: Displays the number of criteria selected (`Filter (3)`).
3. **One-Click Reset**: The **Reset** button (`✕ Reset`) immediately clears all dropdowns and restores the full student roster.
4. **Active Filter Chips**: A visible summary banner indicates which filters are currently applied with an instant **"Clear all"** link.
5. **Scoped Bulk Operations**: Selecting students operates strictly on the active filtered view, preventing unintended edits to hidden cohorts.

---

## 🔄 High-Throughput LeetCode Telemetry Engine

The synchronization engine ([`server/src/services/leetcodeService.ts`](server/src/services/leetcodeService.ts)) is engineered for high throughput and zero rate-limiting failures:

### 1. Controlled Concurrency (5 Workers)
- Prevents Cloudflare WAF burst throttles by processing up to **5 concurrent student fetches** on the backend.
- A batch of 25 students completes smoothly in **~2.5 to 3.5 seconds**.

### 2. Multi-Endpoint Racing & Resilient Timeouts
- **Primary Race**: Simultaneously races the official LeetCode GraphQL endpoint (`https://leetcode.com/graphql`) and high-availability proxy mirrors using `Promise.any`.
- **6000ms Timeout**: Increased from 2.2s to 6.0s (`AbortSignal.timeout(6000)`), preventing false timeouts during momentary network latency.
- **Automatic Retry with Backoff**: If an upstream request hits a temporary rate limit (HTTP 429) or socket delay, the service waits 400ms with jitter and retries automatically before reporting failure.
- **Account Verification**: Automatically detects invalid usernames that do not exist on LeetCode (e.g. accidental register number entries) and reports:  
  `⚠️ Notice: 1 account (@814723104037) does not exist on LeetCode.`

### 3. Sequential Client-Side Chunking
- In [`client/src/pages/StudentsPage.tsx`](client/src/pages/StudentsPage.tsx), bulk requests are chunked into batches of 10 and processed sequentially.
- The UI displays a live progress counter (`10/23 (43%)` &rarr; `20/23 (87%)` &rarr; `23/23 (100%)`) with an elapsed execution timer.
- Student table rows transition from `Pending sync` to live solve metrics in real time.

### 4. Background Auto-Sync Heartbeat
- Client-side daemon ([`client/src/services/autoSyncService.ts`](client/src/services/autoSyncService.ts)) continuously syncs students in the background:
  - **1 student per micro-batch** every **1.8 seconds**.
  - **25-second cooldown** per student to eliminate redundant queries.
  - Automatically pauses during manual syncs and resumes 3 seconds later.

---

## 🤖 Smart Roster Import & Heuristic Mentor Attribution

The universal importer ([`client/src/utils/studentImportUtils.ts`](client/src/utils/studentImportUtils.ts)) handles irregular institutional spreadsheets without requiring pre-formatting:

```text
Spreadsheet File (.xlsx / .csv)
             │
             ├──► 1. Strip Non-Academic Columns (Phone, Blood Group, Address)
             ├──► 2. S.No Shielding (Disregard missing or broken index columns)
             ├──► 3. DOB Extraction & Homonym Disambiguation
             ├──► 4. Deduplicate Register Numbers
             ├──► 5. Faculty Token-Overlap Matcher (Strip Dr., Mr., Prof.)
             │
             ▼
Preview Modal with Mentor Filter Pills
  [All Students (56)] [👤 Dr. K. Devi (14)] [👤 Prof. M. Prakash (18)] [⚠️ Unpaired (2)]
             │
             ├──► Choice A: "Import Filtered (X Students)" (100% Sheet Mentor Fidelity)
             └──► Choice B: "Import All (56 Students)"
```

- **S.No Shield**: Decouples record validity from index numbers; rows missing serial numbers are captured with zero loss.
- **Faculty Token Overlap**: Matches `"Mrs. K. Devi"` to `"Dr. Devi K"` by stripping honorifics and calculating token intersection against PostgreSQL staff accounts.
- **Unpaired Student Quarantine**: Isolates unassigned students into a dedicated review filter with one-click bulk mentor assignment.
- **DOB Disambiguation**: Differentiates duplicate names in the same cohort by extracting their Date of Birth (e.g. `SARAVANAKUMAR V (DOB: 07.12.2005)`).
- **Duplicate Prevention**: Detects repeated register numbers and retains only the first valid occurrence.

---

## 🗑️ Guaranteed Idempotent Cascade Deletion

Student deletion guarantees complete persistence across PostgreSQL and client views:

1. **Idempotent Cascade Transaction**:
   - Uses Prisma `deleteMany({ where: { id: studentId } })` to safely remove the student, daily coding snapshots, and mentor assignments without throwing `P2025` errors.
2. **Comprehensive Cache Purge**:
   - Automatically executes `serverCache.clear()`, wiping student rosters (`students_`), dashboard metrics (`stats_`), and reports (`reports_`).
3. **Confirmed Server State**:
   - The UI displays a loading spinner during deletion and removes rows from state **only after HTTP 200 OK** is returned by the server.
   - Dispatches `student-synced` and `sheets-synced` events to immediately update Dashboard statistics.
   - Inline error alerts replace blocked browser `alert()` dialogs if any operation fails.

---

## 📊 Google Apps Script Integration Guide

Connect any Google Sheet to receive automated real-time synchronization directly from CodeTrace:

### Step 1: Open Apps Script
1. Open your target Google Sheet (`https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`).
2. Click **Extensions &rarr; Apps Script**.

### Step 2: Paste the Webhook Script
Replace the contents of `Code.gs` with the following:

```javascript
/**
 * CodeTrace Enterprise - Automated Google Sheets Webhook
 * Version: 2.3.0
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
      headerRange.setBackground("#1E293B"); // Slate Navy
      headerRange.setFontColor("#FFFFFF");  // Bold White
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Calibri");
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 32);
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

      // Format Register Number (Column 7) as Plain Text
      sheet.getRange(2, 7, totalRows, 1).setNumberFormat("@");

      // Alternating Zebra Rows & Grid Borders
      for (var r = 2; r <= totalRows + 1; r++) {
        var rowBg = (r % 2 === 0) ? "#F8FAFC" : "#FFFFFF";
        sheet.getRange(r, 1, 1, totalCols).setBackground(rowBg);
        sheet.setRowHeight(r, 22);
      }
      dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    }

    // 3. Auto-Fit Column Widths
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
5. Click **Deploy**, authorize permissions, and copy the **Web App URL**.

### Step 4: Link in CodeTrace Enterprise
1. Navigate to **Google Sheets Integration &rarr; + Link New Sheet**.
2. Paste the **Spreadsheet URL** and the **Apps Script Web App URL**.
3. Select your date scope (`⚡ From Today`, `Full History`, or `Custom Date`).
4. Click **Link & Populate Sheet**.

---

## 👥 Hierarchical Batches, Sections & Mentorship

```text
Academic Intake Batch (e.g. 2023 - 2027)
       │
       └── Department & Section (e.g. CSE - Section A)
               │
               ├── Allocation Batch 1 (20 Students) ──► Assigned Mentor: Dr. K. Devi
               ├── Allocation Batch 2 (20 Students) ──► Assigned Mentor: Prof. M. Prakash
               └── Allocation Batch 3 (20 Students) ──► Assigned Mentor: Dr. S. Anitha
```

- **Allocation Batches**: Divide large sections into manageable lab cohorts assigned to specific mentors.
- **Inherited Scope**: Assigning a student to an allocation batch automatically configures their faculty mentor.
- **Visual Roster Cards**: Displays active student counts, mentor pairings, and solve ratios.

---

## 📈 Daily Progress Snapshots & Temporal Deltas

The platform records immutable daily snapshots in PostgreSQL:

$$\Delta_{\text{daily}} = \text{Solved}_{\text{today}} - \text{Solved}_{\text{yesterday}}$$

$$\Delta_{\text{Easy}} = \text{Easy}_{\text{today}} - \text{Easy}_{\text{yesterday}}, \quad \Delta_{\text{Med}} = \text{Med}_{\text{today}} - \text{Med}_{\text{yesterday}}, \quad \Delta_{\text{Hard}} = \text{Hard}_{\text{today}} - \text{Hard}_{\text{yesterday}}$$

- **Placement Readiness Audit**: Evaluates whether a student maintained steady practice over months or attempted last-minute cramming before placement evaluations.
- **Daily Reconciliation**: Automatically finalizes midnight IST snapshot records and prevents duplicate entries per date.

---

## 📁 Repository Directory Structure

```text
coding-progress-tracker/
├── .github/
│   └── workflows/
│       └── daily-sync.yml        # GitHub Actions 2-hour scheduled sync workflow
├── api/
│   └── index.ts                  # Vercel Serverless Function entrypoint
├── client/                       # React 18 + Vite TypeScript SPA
│   ├── src/
│   │   ├── api/                  # Reports, sync, and sheet API services
│   │   ├── components/           # AutoSyncDaemon, Navbar, Modals, Status Badges
│   │   ├── context/              # AuthContext session & RBAC provider
│   │   ├── pages/                # StudentsPage, DashboardPage, ReportsPage, BatchesPage
│   │   ├── services/             # autoSyncService, API client with SWR cache
│   │   └── utils/                # Smart CSV/Excel parser, S.No shield, DOB extraction
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                       # Node.js + Express.js + TypeScript API
│   ├── prisma/
│   │   └── schema.prisma         # Prisma ORM PostgreSQL models
│   ├── src/
│   │   ├── controllers/          # Student, Staff, Batch, Sync, GoogleSheet, Report
│   │   ├── middleware/           # JWT auth verification, RBAC role guards
│   │   ├── routes/               # Express REST Routes (/api/v1/*)
│   │   ├── services/             # LeetCode GraphQL Engine, Google Sheets, Cron
│   │   ├── utils/                # ServerCache, CSV parsers, DOB disambiguation
│   │   └── tests/                # Automated regression test runner (18 test suites)
│   ├── package.json
│   └── tsconfig.json
├── vercel.json                   # Vercel Single-Origin Routing & Cron Configuration
├── package.json                  # Root Monorepo Scripts & Workspaces
└── README.md                     # Platform Documentation
```

---

## 📡 REST API Reference

All endpoints are served with prefix `/api/v1` (or root routes via Express router):

### 🔑 Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & return JWT token |
| `GET` | `/api/v1/auth/me` | Authenticated | Fetch current user session profile |
| `PUT` | `/api/v1/auth/profile` | Authenticated | Update user name, email, or password |

### 🎓 Students Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/students` | Staff / Admin | List students filtered by batch, section, dept, year, mentor |
| `GET` | `/api/v1/students/:studentId` | Staff / Admin | Get student details with historical snapshot timeline |
| `POST` | `/api/v1/students` | Staff / Admin | Create student record & sync LeetCode profile |
| `PUT` | `/api/v1/students/:studentId` | Staff / Admin | Update student details, mentor, or section |
| `DELETE` | `/api/v1/students/:studentId` | Staff / Admin | Idempotent cascade delete of student record |
| `POST` | `/api/v1/students/bulk-delete` | Staff / Admin | Bulk cascade delete selected student IDs |
| `POST` | `/api/v1/students/bulk-import` | Staff / Admin | Ingest parsed CSV/Excel roster with smart attribution |

### 🔄 Telemetry & Synchronization
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/sync/report-filtered` | Staff / Admin | Live sync filtered cohort or specific student IDs |
| `GET` | `/api/v1/sync/unsynced-candidates` | Staff / Admin | Fetch candidates needing auto-sync |
| `POST` | `/api/v1/sync/student/:studentId` | Staff / Admin | Synchronize individual student LeetCode metrics |
| `POST` | `/api/v1/sync/batch/:batchId` | Staff / Admin | Synchronize entire batch |
| `POST` | `/api/v1/sync/section/:sectionId` | Staff / Admin | Synchronize entire section |

### 🏫 Batches & Sections
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/batches` | Staff / Admin | List all academic intake batches |
| `POST` | `/api/v1/batches` | Admin Only | Create new academic intake batch |
| `POST` | `/api/v1/batches/:batchId/sections` | Admin Only | Create section within an intake batch |
| `GET` | `/api/v1/sections/:sectionId/allocation-batches` | Staff / Admin | List allocation batches for section |
| `POST` | `/api/v1/sections/:sectionId/allocation-batches` | Admin Only | Create allocation sub-batch |

### 📊 Google Sheets Integration
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/google-sheets/links` | Staff / Admin | List linked Google Sheets |
| `POST` | `/api/v1/google-sheets/links` | Staff / Admin | Link new Google Sheet with custom date scope |
| `POST` | `/api/v1/google-sheets/links/:id/sync` | Staff / Admin | Sync live data to specific Google Sheet |
| `DELETE` | `/api/v1/google-sheets/links/:id` | Staff / Admin | Unlink Google Sheet |

---

## 🔐 Role-Based Access Control (RBAC)

1. **`ADMIN` Role**:
   - Complete institutional authority across all departments, batches, and cohorts.
   - Staff account provisioning, scope assignment, and credential management.
   - Global sync triggers and master Google Sheet integration.
2. **`STAFF` Role**:
   - Strictly scoped to assigned academic years, departments, sections, and allocation batches.
   - View, filter, and export student progress within assigned scope.
   - Link and manage scoped Google Sheets for assigned cohorts.
   - Prevented from accessing or modifying unassigned student records (HTTP 403 Forbidden).

---

## 🧪 Testing & Quality Assurance

CodeTrace enforces an automated regression test suite covering all critical workflows:

```bash
# Execute central regression test runner
npm --prefix server test
```

### Test Suites Included:
- **Student Deletion & Cascade Isolation**: Idempotent deletion, non-existent ID handling, bulk removal, and staff permission boundaries.
- **Smart CSV/Excel Parser**: S.No shielding, token matching, DOB extraction, and duplicate resolution.
- **LeetCode Telemetry Resolver**: Official GraphQL parsing, proxy fallback racing, and rate-limit recovery.
- **Role-Based Access Enforcement**: 403 Forbidden checks on unauthorized staff queries.
- **Multi-Batch & Section Inheritance**: Dynamic mentor assignment across complex sub-batches.
- **Midnight Snapshot Reconciliation**: Monotonic non-decreasing solve count continuity and IST date normalization.

**Result**: `Total: 18 | Passed: 18 | Failed: 0` (100% Quality Gate Pass).

---

## 🚀 Quickstart & Local Development

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL Database** (Local instance or cloud provider like Supabase / Neon)

### 1. Clone Repository
```bash
git clone https://github.com/Chandru9842/coding-progress-tracker.git
cd coding-progress-tracker
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
# PostgreSQL Connection String
DATABASE_URL="postgresql://postgres:password@localhost:5432/coding_tracker?schema=public"

# JWT Encryption Key
JWT_SECRET="super_secret_jwt_encryption_key_change_me"

# Seed Admin Credentials
INITIAL_ADMIN_NAME="Dr. System Admin"
INITIAL_ADMIN_EMAIL="admin@college.edu"
INITIAL_ADMIN_PASSWORD="AdminPassword123!"

# Scheduled Cron Security Secret
CRON_SECRET="coding_tracker_cron_secret"

# Express Port
PORT=5000
```

### 3. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Push Database Schema
```bash
npm --prefix server run build
npx prisma db push --schema server/prisma/schema.prisma
```

### 5. Launch Development Server
```bash
npm run dev
```

Visit **`http://localhost:5173`** in your browser and log in with your configured admin credentials.

---

## ☁️ Production Deployment (Vercel)

The repository is configured for single-origin serverless deployment on Vercel:

```bash
# Build client and server bundles
npm run build

# Deploy to Vercel production
npx vercel --prod
```

### Required Production Environment Variables:
- `DATABASE_URL`: Production PostgreSQL connection string.
- `JWT_SECRET`: High-entropy string for signing authentication tokens.
- `INITIAL_ADMIN_EMAIL`: Default administrator email.
- `INITIAL_ADMIN_PASSWORD`: Default administrator password.
- `CRON_SECRET`: Secret key for authorizing cron triggers.

---

## 👨‍💻 Author & Engineering

**Chandru M**  
*Full-Stack Software Engineer & Platform Architect*
- **GitHub**: [@Chandru9842](https://github.com/Chandru9842)
- **Repository**: [https://github.com/Chandru9842/coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)
- **Live Platform**: [https://coding-progress-tracker-navy.vercel.app](https://coding-progress-tracker-navy.vercel.app)

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.
