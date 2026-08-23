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
| **🤖 Zero-Click Google Sheets Engine** | Automated daily webhook push that clears and repopulates formatted tables with freezing headers, alternating rows, borders, and column auto-resizing. |
| **🗓️ Configurable Starting Date Scopes** | Choose historical starting point (`Full History`, `From Today`, `From Yesterday`, `Custom Date Picker`). Columns expand automatically into the future indefinitely. |
| **🔄 Link, Unlink & Permanent Delete** | Active sheets can be unlinked to Historical archive; archived sheets can be reactivated with one click or permanently purged from system. |
| **📈 Daily Snapshot Deltas** | Records daily snapshots in PostgreSQL to calculate exact daily/weekly delta gains per student (`+E`, `+M`, `+H`, `+Total`). |
| **🛡️ Multi-Tier RBAC** | Strict separation between **`ADMIN`** (system configuration, staff management, batch rosters) and **`STAFF`** (assigned sections, student rosters, scoped linked sheets). |
| **⚡ 0ms Client Cache & Lazy Invalidation** | High-performance in-memory TTL caching layer ensures instantaneous tab navigation without loading spinners. |
| **📦 Excel & CSV Export Suite** | Download student matrices and historical snapshots as formatted CSV or copy data directly into Cell `A1` with 1 click. |

---

## 🏗️ System Architecture & Data Pipelines

```mermaid
graph TD
    User["👨‍🏫 Faculty Member / Admin"] -->|HTTPS / JWT Auth| Client["⚛️ React 18 + Vite SPA (Vercel CDN)"]
    Client -->|REST API Requests| Serverless["⚡ Express + Node.js (Vercel Serverless API)"]
    Serverless -->|Prisma ORM| Database["🐘 PostgreSQL Database (Supabase)"]
    
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
│   │   ├── pages/                # AdminDashboard, StaffDashboard, StudentDirectory, SettingsPage
│   │   ├── services/             # Axios API Service client with memory caching
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
│   │   ├── controllers/          # Auth, Student, Staff, Batch, Sync, GoogleSheet controllers
│   │   ├── db/                   # Prisma Client Singleton & Fallback Memory Store
│   │   ├── middleware/           # Auth verification, RBAC role guards, Error handler
│   │   ├── routes/               # Express REST Routes (/api/v1/*)
│   │   ├── services/             # LeetCode GraphQL Engine, Google Sheets Service, Cron Service
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

### Authentication & Profiles
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & return JWT token |
| `GET` | `/api/v1/auth/me` | Authenticated | Get current logged-in user profile |
| `PUT` | `/api/v1/auth/profile` | Authenticated | Update faculty name, email, or password |

### Google Sheets Integration
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

### Automated Synchronization & Crons
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET/POST` | `/api/v1/cron/daily-sync` | Cron Secret / Admin | Daily 12:30 AM IST automated reconciliation & sheet push |
| `GET/POST` | `/api/v1/cron/periodic-sync` | Cron Secret / Admin | 15-minute near-real-time LeetCode polling adapter |

---

## 🔐 Role-Based Access Control (RBAC)

The system implements strict Role-Based Access Control:

1. **`ADMIN` Role**:
   - Full institution-wide access.
   - Manage staff accounts and assign sections/batches to faculty.
   - Create, edit, and sync institution-wide master Google Sheets.
   - Configure global LeetCode sync schedules.

2. **`STAFF` Role**:
   - Access restricted strictly to assigned academic years, departments, and allocation batches.
   - View assigned student coding progress and historical snapshots.
   - Create and manage scoped Google Sheets for assigned sections.

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
*Senior Full-Stack Software Engineer & Platform Architect*
- **GitHub**: [@Chandru9842](https://github.com/Chandru9842)
- **Repository**: [https://github.com/Chandru9842/coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)
- **Live Platform**: [https://coding-progress-tracker-navy.vercel.app](https://coding-progress-tracker-navy.vercel.app)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
