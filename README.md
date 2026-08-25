# ⚡ Coding Progress Tracker & LeetCode Analytics Engine

<div align="center">

[![Production Deployment](https://img.shields.io/badge/Vercel-Live%20Production-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://coding-progress-tracker-navy.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React%2018-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)](https://www.google.com/sheets/about/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Enterprise-Grade College Faculty Analytics Dashboard, LeetCode Progress Reconciliation Engine & Zero-Click Google Sheets Automation Platform.</b>
</p>

[**🌐 Live Application**](https://coding-progress-tracker-navy.vercel.app) • [**📘 Documentation**](#-table-of-contents) • [**📊 Apps Script Setup**](#-google-apps-script-integration-guide) • [**🚀 Quickstart**](#-quickstart--local-development)

</div>

---

## 📑 Table of Contents
- [🌟 Executive Summary](#-executive-summary)
- [✨ Key Architectural Features](#-key-architectural-features)
- [🤖 Universal AI CSV / Excel Bulk Import Engine](#-universal-ai-csv--excel-bulk-import-engine)
- [👥 Allocation Batches & Sub-Batch Mentor Tracking](#-allocation-batches--sub-batch-mentor-tracking)
- [🎓 Dedicated Study Year Tracking](#-dedicated-study-year-tracking)
- [🏗️ System Architecture & Data Pipelines](#️-system-architecture--data-pipelines)
- [📊 Google Apps Script Integration Guide](#-google-apps-script-integration-guide)
- [🚀 Quickstart & Local Development](#-quickstart--local-development)
- [📁 Repository Directory Structure](#-repository-directory-structure)
- [📡 REST API Reference](#-rest-api-reference)
- [🔐 Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [☁️ Production Deployment (Vercel)](#️-production-deployment-vercel)
- [🤝 Open-Source Contribution Guide](#-open-source-contribution-guide)
- [👨‍💻 Author & Engineering](#-author--engineering)
- [📄 License](#-license)

---

## 🌟 Executive Summary

**Coding Progress Tracker** is an enterprise-level SaaS platform engineered for higher-education institution faculty (Department Heads, Professors, Academic Coordinators, and Student Mentors) to track, evaluate, and analyze student coding activity and LeetCode problem-solving performance across academic batches and sections.

### The Problem It Solves:
1. **Manual Tracking Overhead**: Faculty previously spent dozens of hours per week opening individual student LeetCode profiles and manually updating spreadsheets.
2. **Missing Historical Deltas**: Plain profiles only show total lifetime count, making it impossible to audit weekly or daily problem-solving effort.
3. **Data Loss & Disconnected Rosters**: Disorganized sheets caused formula breakage, column shifting, and lack of central audit logs.

### The Solution:
- **Continuous 12:30 AM IST Daily Automated Sync**: Fetches real-time problem-solving counts (`+Total`, `+Easy`, `+Medium`, `+Hard`) via GraphQL and pushes structured Excel-styled matrices directly into Google Sheets via Webhooks.
- **Configurable Starting Date Scopes**: Pick whether to track full historical records, start clean from today, start from yesterday, or choose any custom starting date (`YYYY-MM-DD`) with infinite daily column growth.
- **Complete Link Lifecycle Management**: Seamlessly Link, Unlink (move to archive), Relink (reactivate), or Permanently Delete sheets with one click.

---

## ✨ Key Architectural Features

| Feature | Description |
|---|---|
| **🤖 Universal AI Bulk Importer** | Dynamic header detection, mentor pattern parsing, auto-deduplication, parenthetical DOB stripping, and batch/section auto-mapping for any CSV/Excel sheet. |
| **🤖 Zero-Click Google Sheets Engine** | Automated daily webhook push that clears and repopulates formatted tables with freezing headers, alternating rows, borders, and column auto-resizing. |
| **🗓️ Configurable Starting Date Scopes** | Choose historical starting point (`Full History`, `From Today`, `From Yesterday`, `Custom Date Picker`). Columns expand automatically into the future indefinitely. |
| **🔄 Link, Unlink & Permanent Delete** | Active sheets can be unlinked to Historical archive; archived sheets can be reactivated with one click or permanently purged from system. |
| **📈 Daily Snapshot Deltas** | Records daily snapshots in PostgreSQL to calculate exact daily/weekly delta gains per student (`+E`, `+M`, `+H`, `+Total`). |
| **🛡️ Multi-Tier RBAC** | Strict separation between **`ADMIN`** (system configuration, staff management, batch rosters) and **`STAFF`** (assigned sections, student rosters, scoped linked sheets). |
| **⚡ 0ms Client Cache & Lazy Invalidation** | High-performance in-memory TTL caching layer ensures instantaneous tab navigation without loading spinners. |
| **📦 Excel & CSV Export Suite** | Download student matrices and historical snapshots as formatted CSV or copy data directly into Cell `A1` with 1 click. |

---

## 🤖 Universal AI CSV / Excel Bulk Import Engine

The platform features an intelligent, zero-friction **Universal AI Bulk Import Engine** designed to parse any institutional roster, class spreadsheet, or multi-mentor CSV file regardless of column order, extra headers, or formatting quirks.

### 🧠 Core Automation Capabilities:

1. **Dynamic Mentor Name Recognition (With or Without Salutations / Titles)**:
   - Works seamlessly with formal academic titles: `Dr. A. Muthuraj`, `Mrs. K. Devi`, `Mr. Shyam Sundar`, `Prof. S. Kumar`, `Er. R. Rajesh`, `Ms. Priyadharshini`.
   - Works equally well with informal / title-less names & initials: `Chandru M`, `chandru.m`, `chandru_m`, `saravanan.v`, `Saravanan V`, `shyam sundar`, `devi.k`.
   - Supports dedicated mentor block headers: `NAME OF THE MENTOR : Mrs. K. Devi`, `MENTOR NAME: Dr. A. Muthuraj`.
   - Performs fuzzy, case-insensitive, and punctuation-resilient matching to automatically assign students to their registered faculty mentors.

2. **Automatic Student Name & DOB Cleaning**:
   - Institutional rosters often append student birth dates or roll numbers in parentheses. The AI parser automatically sanitizes these into clean official names:
     - `JANANI S (7.12.2005)` &rarr; `JANANI S`
     - `KAVIN P (DOB: 12/04/2004)` &rarr; `KAVIN P`
     - `SURYA KUMAR R (2023CSE045)` &rarr; `SURYA KUMAR R`

3. **LeetCode Profile URL Auto-Extraction**:
   - Automatically parses full URLs, username handles, and mobile links to extract clean LeetCode profile handles:
     - `https://leetcode.com/u/chandru9842/` &rarr; `chandru9842`
     - `https://leetcode.com/muthuraj_a/` &rarr; `muthuraj_a`
     - `@devi_k` &rarr; `devi_k`
     - `saravanan_v` &rarr; `saravanan_v`

4. **🛡️ Intelligent Auto-Deduplication Engine**:
   - Automatically detects duplicate register numbers within the spreadsheet.
   - Flags duplicate entries with a `Duplicate` badge, auto-deselects them to avoid database unique constraint collisions, and displays a clean resolution summary banner (`✨ X Duplicate(s) Auto-Resolved`).

5. **🎯 Target Batch, Section & Sub-Batch Cascading**:
   - Auto-detects the Academic Intake (`2023-2027`) and Department (`CSE`) from spreadsheet text.
   - Automatically selects the Target Batch and Section dropdowns and populates all Allocation Batches (`Batch-1`, `Batch-2`, `Batch-3`, `Batch-4`).

---

### 📋 Spreadsheet Fields: Required vs. Optional

| Field Name | Status | Accepted Header Names | Examples / Formats |
|---|---|---|---|
| **Student Name** | **Required** | `Name`, `Student Name`, `Candidate Name`, `Student_Name` | `JANANI S`, `SARAVANAN V`, `CHANDRU M` |
| **Register Number** | **Required** | `Register Number`, `Reg No`, `Roll No`, `Reg_No`, `Registration_No` | `953623104015`, `23CSE001`, `953623104099` |
| **LeetCode Profile** | **Required** | `LeetCode URL`, `Leetcode Profile`, `Username`, `Leetcode`, `Leetcode_Username` | `https://leetcode.com/u/chandru9842/`, `chandru9842` |
| **Mentor Name** | *Optional (Auto-Detected)* | `Mentor`, `Staff`, `Faculty`, `Advisor`, `Mentor Name`, `NAME OF THE MENTOR : [Name]` | `Dr. A. Muthuraj`, `Mrs. K. Devi`, `Chandru M`, `chandru.m`, `saravanan.v` |
| **Academic Year / Batch** | *Optional (Auto-Detected)* | `Academic Year`, `Batch`, `Intake`, `Period` | `2023-2027`, `2024-2028` |
| **Section** | *Optional (Auto-Detected)* | `Section`, `Sec`, `Class` | `CSE-A`, `Section A`, `A` |
| **Study Year** | *Optional (Auto-Detected)* | `Year`, `Current Year`, `Study Year`, `Year of Study` | `1st Year`, `2nd Year`, `3rd Year`, `4th Year` |
| **Department** | *Optional (Auto-Detected)* | `Department`, `Dept`, `Branch` | `CSE`, `IT`, `AIDS`, `ECE` |
| **Allocation Batch** | *Optional (Auto-Detected)* | `Allocation Batch`, `Sub Batch`, `Allocation_Batch`, `Group` | `Batch-1`, `Batch-2`, `Batch-3`, `Batch-4` |

---

### 📊 Sample CSV Formats

#### Example 1: Multi-Mentor Institutional Roster (Supports Plain Names & Titles)
```csv
S.No,Register Number,Student Name,LeetCode Profile,Year,Section,Mentor Name
1,953623104001,AADHITHIYAN A,https://leetcode.com/u/aadhithiyan/,2nd Year,CSE-A,Dr. A. Muthuraj
2,953623104002,AARTHI M (14.05.2005),https://leetcode.com/u/aarthi_m/,2nd Year,CSE-A,Mrs. K. Devi
3,953623104003,CHANDRU M,https://leetcode.com/u/chandru9842/,2nd Year,CSE-A,Chandru M
4,953623104004,DEEPAK RAJ S,https://leetcode.com/u/deepak_raj/,2nd Year,CSE-A,chandru.m
5,953623104005,DINESH KUMAR K,https://leetcode.com/u/dinesh_k/,2nd Year,CSE-A,saravanan.v
6,953623104006,JANANI S (7.12.2005),https://leetcode.com/u/janani_s/,2nd Year,CSE-A,Mr. Shyam Sundar
```

#### Example 2: Dedicated Mentor Batch Sheet (Single Faculty Block)
```csv
DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
ACADEMIC YEAR: 2023-2027 | SECTION: CSE-A
NAME OF THE MENTOR : Mrs. K. Devi

S.No,Roll No,Name of the Student,LeetCode Username,Allocation Batch
1,953623104020,GOKUL S,gokul_s,Batch-1
2,953623104021,HARINI V (DOB: 02/11/2005),harini_v,Batch-1
3,953623104022,HEMAPRIYA R,hemapriya_r,Batch-1
4,953623104023,JEEVANANTHAM K,jeeva_k,Batch-1
```

---

## 👥 Allocation Batches & Sub-Batch Mentor Tracking

Higher-education institutions often divide large sections (e.g. 60+ students in Section `CSE-A`) into smaller **Allocation Batches** (e.g., `Batch-1`, `Batch-2`, `Batch-3`, `Batch-4`) assigned to individual faculty mentors:

- **🏷️ Visual Mentor Badges on Batch Cards**: Every sub-batch pill prominently shows the assigned mentor name (`Batch-1 (23 Students) • 👤 Mrs. K. Devi`, `Batch-3 (14 Students) • 👤 Dr. A. Muthuraj`).
- **🔍 Allocation Batch Detail Modal**: Clicking any allocation batch pill reveals a complete breakdown with Intake, Department, Section, Assigned Mentor card, and full student roster.
- **⚡ Cascade Inheritance**: Importing or moving students into an allocation batch automatically assigns their mentor and sets their scope without manual configuration.

---

## 🎓 Dedicated Study Year Tracking

Every student record now features a dedicated **Study Year** attribute:
- **Available Values**: `1st Year`, `2nd Year`, `3rd Year`, `4th Year`.
- **Display**: Shown as a sleek modern badge next to the student's name across all table views, modals, and export spreadsheets.
- **Filters**: Quickly filter the entire student directory by academic intake, department, section, allocation batch, or study year.

---

## 🏗️ System Architecture & Data Pipelines

```mermaid
graph TD
    User["👨‍🏫 Faculty Member / Admin"] -->|HTTPS / JWT Auth| Client["⚛️ React 18 + Vite SPA (Vercel CDN)"]
    Client -->|REST API Requests| Serverless["⚡ Express + Node.js (Vercel Serverless API)"]
    Serverless -->|Prisma ORM (Single-Query Index Joins)| Database["🐘 PostgreSQL Database (Supabase)"]
    
    Cron["⏰ Vercel Scheduled Cron (12:30 AM IST / 19:00 UTC)"] -->|POST /api/v1/cron/daily-sync| Serverless
    Serverless -->|GraphQL Query| LeetCode["🧩 LeetCode Public GraphQL API"]
    LeetCode -->|Real-Time Stats| Serverless
    Serverless -->|Store Daily Snapshots| Database
    Serverless -->|"POST JSON (text/plain)"| Webhook["📜 Google Apps Script Webhook"]
    Webhook -->|Auto Format & Append| Sheet["📊 Linked Google Sheet"]
```

---

## 📊 Google Apps Script Integration Guide

To enable 100% automated background synchronization directly into your Google Sheet without manual data entry:

### Step 1: Open Google Apps Script
1. Open your target Google Sheet (e.g. `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`).
2. In the top menu, click **Extensions &rarr; Apps Script**.

### Step 2: Paste the Automation Script
Replace all existing code in `Code.gs` with the following production script:

```javascript
/**
 * Coding Progress Tracker - Google Sheets Automation Webhook
 * Version: 2.1.0
 * Author: Chandru M (https://github.com/Chandru9842)
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
1. Click the blue **Deploy** button &rarr; **New deployment**.
2. Click the gear icon (**Select type**) &rarr; Select **Web app**.
3. Set **Description**: `Coding Tracker Sync Webhook`.
4. Set **Execute as**: `Me (your_email@gmail.com)`.
5. Set **Who has access**: `Anyone`. *(Required for cloud automation)*.
6. Click **Deploy**, authorize permissions, and copy the **Web App URL** (`https://script.google.com/macros/s/.../exec`).

### Step 4: Link in the Application
1. Go to **Settings & Profile &rarr; Linked Google Sheets**.
2. Click **+ Link New Sheet**.
3. Paste your **Spreadsheet Page URL** and the **Apps Script Webhook URL**.
4. Choose your starting date scope (e.g. `⚡ From Today`) and click **Link & Populate Sheet**!

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
Create `.env` in the root folder:
```env
# PostgreSQL Connection URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/coding_tracker?schema=public"

# Authentication Secrets
JWT_SECRET="super_secret_jwt_encryption_key_change_me"

# Initial Admin Credentials (Auto-seeded on startup)
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
# Install root, client, and server dependencies
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Database Setup
```bash
# Generate Prisma Client & Push Schema
npm run prisma:generate
npm run prisma:push
```

### 5. Launch Development Server
```bash
# Starts Express API (Port 5000) and Vite SPA (Port 5173 / 3000) concurrently
npm run dev
```

Visit **`http://localhost:5173`** in your browser and log in with your admin credentials.

---

## 📁 Repository Directory Structure

```text
coding-progress-tracker/
├── api/
│   └── index.ts                  # Vercel Serverless Function entrypoint wrapping Express API
├── client/                       # React 18 + TypeScript Frontend SPA
│   ├── src/
│   │   ├── components/           # Navbar, Sidebar, Layout, ProtectedRoute, Modal Dialogs
│   │   ├── context/              # AuthContext session provider
│   │   ├── pages/                # AdminDashboard, StaffDashboard, StudentDirectory, SettingsPage, BatchDetailPage
│   │   ├── services/             # Axios API Service client with memory caching
│   │   ├── utils/                # Universal AI CSV & Excel Parser, Math & Date helpers
│   │   ├── types/                # TypeScript Interfaces & Data Models
│   │   ├── App.tsx               # Client Routes & RBAC Route Guards
│   │   └── index.css             # Glassmorphism Design System & Modal Controls
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                       # Node.js + Express.js + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma         # Prisma Data Model (PostgreSQL / Supabase)
│   ├── src/
│   │   ├── config/               # Environment variable validation
│   │   ├── controllers/          # Auth, Student, Staff, Batch, Sync, GoogleSheet, Report controllers
│   │   ├── db/                   # Prisma Client Singleton & Fallback Memory Store
│   │   ├── middleware/           # Auth verification, RBAC role guards, Error handler
│   │   ├── routes/               # Express REST Routes (/api/v1/*)
│   │   ├── services/             # LeetCode GraphQL Engine, Google Sheets Service, Report Service, Cron Service
│   │   ├── utils/                # Universal AI Student Import Engine & Sanitization
│   │   ├── app.ts                # Express application setup & middleware
│   │   └── index.ts              # Local server runner & background polling adapter
│   ├── package.json
│   └── tsconfig.json
├── vercel.json                   # Vercel Single-Origin Routing & 12:30 AM IST Cron Config
├── package.json                  # Root Monorepo Scripts & Build Commands
└── README.md                     # Technical Documentation
```

---

## 📡 REST API Reference

All API routes are prefixed with `/api/v1`:

### 🔑 Authentication & Profiles
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & return JWT session token |
| `GET` | `/api/v1/auth/me` | Authenticated | Get current logged-in user profile & role |
| `PUT` | `/api/v1/auth/profile` | Authenticated | Update faculty name, email, or password |

### 🎓 Students Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/students` | Staff / Admin | Get students scoped to user permissions |
| `GET` | `/api/v1/students/:studentId` | Staff / Admin | Get detailed student profile with history snapshots |
| `POST` | `/api/v1/students` | Staff / Admin | Create single student record and trigger initial sync |
| `PUT` | `/api/v1/students/:studentId` | Staff / Admin | Update student details, mentor, or section |
| `DELETE` | `/api/v1/students/:studentId` | Staff / Admin | Delete student record |
| `POST` | `/api/v1/students/bulk-delete` | Staff / Admin | Bulk delete selected student records |
| `POST` | `/api/v1/students/bulk-import` | Staff / Admin | Import parsed CSV/Excel student roster with AI auto-mapping |

### 🏫 Batches, Sections & Allocation Batches
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/batches` | Staff / Admin | List all academic batches scoped to user |
| `GET` | `/api/v1/batches/:batchId` | Staff / Admin | Get batch details with sections, sub-batches & mentors |
| `POST` | `/api/v1/batches` | Admin Only | Create new academic intake batch |
| `POST` | `/api/v1/batches/:batchId/sections` | Admin Only | Create new section within batch |
| `GET` | `/api/v1/sections/:sectionId/allocation-batches` | Staff / Admin | Get allocation batches for a section |
| `POST` | `/api/v1/sections/:sectionId/allocation-batches` | Admin Only | Create sub-allocation batch |
| `PUT` | `/api/v1/allocation-batches/:id` | Admin Only | Update allocation batch name |
| `DELETE` | `/api/v1/allocation-batches/:id` | Admin Only | Delete allocation batch |

### 👥 Staff & Faculty Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/staff` | Admin Only | List all staff members with assigned batch stats |
| `POST` | `/api/v1/staff` | Admin Only | Create new faculty staff account |
| `PUT` | `/api/v1/staff/:id` | Admin Only | Update faculty account information |
| `DELETE` | `/api/v1/staff/:id` | Admin Only | Remove faculty account |
| `PUT` | `/api/v1/staff/:id/status` | Admin Only | Activate or deactivate faculty account |
| `POST` | `/api/v1/staff/:id/assign-scope` | Admin Only | Assign faculty to batches, sections, or sub-batches |
| `POST` | `/api/v1/staff/unassign-scope` | Admin Only | Remove assigned faculty scope |

### 📊 Reports & Excel Exports
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/reports/history` | Staff / Admin | Fetch synchronization audit history & logs |
| `POST` | `/api/v1/reports/sync-and-export` | Staff / Admin | Trigger real-time sync & generate export |
| `GET` | `/api/v1/reports/export-excel` | Staff / Admin | Download formatted Excel (.xlsx) report matrix |

### 📑 Google Sheets Integration
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/google-sheets/links` | Staff / Admin | List all authorized linked Google Sheets |
| `POST` | `/api/v1/google-sheets/links` | Staff / Admin | Link a new Google Sheet with custom start date |
| `PUT` | `/api/v1/google-sheets/links/:id` | Staff / Admin | Update title, webhook URL, start date, or active status |
| `POST` | `/api/v1/google-sheets/links/:id/sync` | Staff / Admin | Trigger manual sync for a specific sheet |
| `POST` | `/api/v1/google-sheets/links/sync-all` | Staff / Admin | Bulk sync all active linked Google Sheets |
| `DELETE` | `/api/v1/google-sheets/links/:id` | Staff / Admin | Unlink sheet (moves to Historical Archive) |
| `DELETE` | `/api/v1/google-sheets/links/:id?permanent=true` | Staff / Admin | Permanently delete sheet and audit logs |
| `GET` | `/api/v1/google-sheets/links/:id/logs` | Staff / Admin | Fetch synchronization audit logs |

### ⏰ Automated Synchronization & Crons
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET/POST` | `/api/v1/cron/daily-sync` | Cron Secret / Admin | Daily 12:30 AM IST automated reconciliation & sheet push |
| `GET/POST` | `/api/v1/cron/periodic-sync` | Cron Secret / Admin | 15-minute near-real-time LeetCode polling adapter |

---

## 🔐 Role-Based Access Control (RBAC)

The system implements strict Role-Based Access Control:

1. **`ADMIN` Role**:
   - Full institution-wide access across all departments.
   - Manage staff accounts, reset credentials, and assign sections/batches to faculty.
   - Create, edit, and sync institution-wide master Google Sheets.
   - Configure global LeetCode sync schedules and export full audit reports.

2. **`STAFF` Role**:
   - Access restricted strictly to assigned academic years, departments, sections, and allocation batches.
   - View and manage assigned student coding progress and historical snapshots.
   - Create and manage scoped Google Sheets for assigned sections and sub-batches.
   - Perform smart CSV/Excel imports for their assigned student cohorts.

---

## ☁️ Production Deployment (Vercel)

The project is structured for zero-configuration, single-origin Vercel deployment:

```bash
# Build production assets
npm run build

# Deploy to Vercel
npx vercel --prod
```

### Production Environment Variables in Vercel Dashboard:
- `DATABASE_URL`: Your production PostgreSQL / Supabase connection string.
- `JWT_SECRET`: Secure encryption secret for session tokens.
- `INITIAL_ADMIN_EMAIL`: Admin email.
- `INITIAL_ADMIN_PASSWORD`: Admin password.
- `CRON_SECRET`: Vercel Cron authorization secret.

---

## 🤝 Open-Source Contribution Guide

Contributions, issues, and feature requests are welcome!

1. Fork the Project (`https://github.com/Chandru9842/coding-progress-tracker`).
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Verify Code Quality (`npm run lint` &rarr; 0 TypeScript errors).
4. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`).
5. Push to the Branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

---

## 👨‍💻 Author & Engineering

**Chandru M**  
*Full-Stack Software Engineer & Platform Architect*
- **GitHub**: [@Chandru9842](https://github.com/Chandru9842)
- **Repository**: [https://github.com/Chandru9842/coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)
- **Live Platform**: [https://coding-progress-tracker-navy.vercel.app](https://coding-progress-tracker-navy.vercel.app)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
