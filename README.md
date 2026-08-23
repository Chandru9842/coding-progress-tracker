# ⚡ Coding Progress Tracker & LeetCode Analytics Engine

> **Enterprise-Grade College Faculty Analytics Dashboard, LeetCode Progress Reconciliation Engine & Zero-Click Google Sheets Automation Platform.**

---

### 👨‍💻 Engineering & Live Production
- **Lead Software Engineer**: **[Chandru M](https://github.com/Chandru9842)**
- **GitHub Repository**: **[https://github.com/Chandru9842/coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)**
- **Live Vercel Production Web App**: **[https://coding-progress-tracker-navy.vercel.app](https://coding-progress-tracker-navy.vercel.app)**

---

## 🌟 Executive Summary

**Coding Progress Tracker** is an enterprise-level SaaS platform designed for higher-education institution faculty (Department Heads, Professors, and Student Mentors) to track, evaluate, and analyze student coding activity and LeetCode problem-solving performance across academic batches and sections.

### Key Capabilities
- **Zero-Click Google Sheets Auto-Sync**: Automatically pushes structured student performance matrix data directly into Google Sheets every night via Google Apps Script Webhooks.
- **LeetCode Progress & Snapshots Engine**: Fetches real-time problem-solving statistics (Easy, Medium, Hard, Total) via GraphQL and records daily historical snapshot deltas (`+Easy`, `+Medium`, `+Hard`, `+Total`).
- **Role-Based Access Control (RBAC)**: Enforces strict separation between **`ADMIN`** (system configuration, staff roster, batch/section management) and **`STAFF`** (assigned student rosters, section progress, linked batch sheets).
- **0ms Instant Client Caching**: High-performance client-side TTL memory store for instant page transitions without loading spinners.
- **Production Data Permanence Guarantee**: Built with idempotent data pipelines guaranteeing zero data loss, database truncations, or record duplication.

---

## 🏗️ System Architecture

```mermaid
graph TD
    User["👨‍🏫 Faculty Member / Admin"] -->|HTTPS| Frontend["⚛️ React 18 + Vite SPA (Vercel CDN)"]
    Frontend -->|JWT Auth / HTTP REST| Backend["⚡ Express + Node.js API (Vercel Serverless)"]
    Backend -->|Prisma ORM| Database["🐘 PostgreSQL (Supabase Database)"]
    
    Cron["⏰ Vercel Daily Cron / Internal Timer (4:30 AM IST)"] -->|Trigger| ReconcileEngine["🔄 LeetCode Reconciliation Engine"]
    ReconcileEngine -->|GraphQL Query| LeetCode["🧩 LeetCode Public GraphQL API"]
    ReconcileEngine -->|Store Daily Snapshots| Database
    ReconcileEngine -->|"POST JSON (text/plain)"| AppsScript["📜 Google Apps Script Web App"]
    AppsScript -->|Clear & Append Rows| GoogleSheet["📊 Linked Google Sheet"]
```


---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router v6, Lucide Icons, Glassmorphism CSS Design Tokens |
| **Backend** | Node.js, Express.js, TypeScript, Axios, Cors, Cookie-Parser |
| **Database & ORM** | PostgreSQL, Supabase, Prisma ORM v5 |
| **Authentication** | JWT (JSON Web Tokens), `bcryptjs` password hashing, Role-Based Route Guards |
| **Automation** | Google Apps Script Webhook POST Engine, Vercel Serverless Crons |
| **Deployment** | Vercel Serverless Functions (`/api`), Static CDN Asset Delivery |

---

## 📊 100% Automated Google Sheets Integration (Apps Script)

The system automatically syncs student coding matrix data (Rank, Academic Year, Department, Section, Allocation Batch, Mentor, Register No, Student Name, LeetCode ID, and Daily Progress Columns) into linked Google Sheets without requiring manual spreadsheet editing.

### 📜 Google Apps Script Deployment Code

To enable direct automated background sync for a linked sheet:
1. Open your target Google Sheet (e.g., `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`).
2. Navigate to **Extensions &rarr; Apps Script**.
3. Replace the contents of `Code.gs` with the following production script:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();

    if (data.headers) {
      sheet.appendRow(data.headers);
      var headerRange = sheet.getRange(1, 1, 1, data.headers.length);
      headerRange.setBackground("#1E293B"); // Dark Slate Navy Header
      headerRange.setFontColor("#FFFFFF");  // Bold White Text
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Calibri");
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 30);
      sheet.setFrozenRows(1);
    }

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

      // Format Register Number column (Col 7) as Text
      sheet.getRange(2, 7, totalRows, 1).setNumberFormat("@");

      // Alternate row colors & light borders
      for (var r = 2; r <= totalRows + 1; r++) {
        var rowBg = (r % 2 === 0) ? "#F8FAFC" : "#FFFFFF";
        sheet.getRange(r, 1, 1, totalCols).setBackground(rowBg);
        sheet.setRowHeight(r, 22);
      }
      dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    }

    // Auto-fit column widths with generous minimum padding
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      sheet.autoResizeColumns(1, lastCol);
      var minWidths = [60, 130, 120, 110, 140, 180, 160, 220, 180];
      for (var col = 1; col <= lastCol; col++) {
        var currWidth = sheet.getColumnWidth(col);
        var minW = (col <= minWidths.length) ? minWidths[col - 1] : 100;
        sheet.setColumnWidth(col, Math.max(currWidth + 20, minW));
      }
    }

    return ContentService.createTextOutput("SUCCESS");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}
```

4. Click **Deploy &rarr; New deployment**.
5. Select type: **Web app**.
6. Set **Execute as**: *Me* (`your_email@gmail.com`).
7. Set **Who has access**: *Anyone*.
8. Click **Deploy** and copy the **Web app URL** (e.g. `https://script.google.com/macros/s/.../exec`).
9. Paste this Web app URL into the **Settings &rarr; Linked Google Sheets &rarr; Apps Script Webhook URL** in the Coding Progress Tracker portal!

---

## 📁 Repository Directory Structure

```text
coding-progress-tracker/
├── api/
│   └── index.ts                  # Vercel Serverless entrypoint wrapping Express app
├── client/                       # React 18 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/           # Sidebar, Topbar, Layout, ProtectedRoute, Modals
│   │   ├── context/              # AuthContext session provider
│   │   ├── pages/                # AdminDashboard, StaffDashboard, StudentDirectory, Settings
│   │   ├── services/             # Axios API Service client with 0ms Memory Caching
│   │   ├── types/                # TypeScript Interfaces & Data Models
│   │   ├── App.tsx               # Client Routes & Role Guard Middleware
│   │   └── index.css             # Glassmorphism Design System & Design Tokens
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                       # Node.js + Express + TypeScript Backend
│   ├── prisma/
│   │   └── schema.prisma         # Prisma Schema Definition (PostgreSQL / Supabase)
│   ├── src/
│   │   ├── controllers/          # Auth, Student, Staff, Batch, Sync & Report Controllers
│   │   ├── db/                   # Prisma Database Client Singleton & Fallback Memory Store
│   │   ├── middleware/           # Auth, Role Authorization (ADMIN / STAFF), Error Handlers
│   │   ├── routes/               # REST API Endpoints (/api/v1)
│   │   ├── services/             # LeetCode GraphQL Engine, Google Sheets Service, Cron Service
│   │   ├── app.ts                # Express Application Initializer
│   │   └── index.ts              # Local HTTP Server Runner
│   ├── package.json
│   └── tsconfig.json
├── vercel.json                   # Vercel Single-Origin Routing & Cron Configuration
├── package.json                  # Workspace Monorepo Scripts
└── README.md                     # Technical Documentation
```

---

## 🚀 Environment Setup & Local Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL Database** (or Supabase Connection String)

### 2. Environment Variables Configuration
Create a `.env` file in the root folder:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/coding_tracker?schema=public
JWT_SECRET=your_super_secret_jwt_key_here
INITIAL_ADMIN_NAME=Dr. System Admin
INITIAL_ADMIN_EMAIL=admin@college.edu
INITIAL_ADMIN_PASSWORD=AdminPass123!
```

### 3. Dependency Installation
```bash
# Install root monorepo dependencies
npm install

# Install backend and frontend dependencies
npm --prefix server install
npm --prefix client install
```

### 4. Database Setup (Prisma ORM)
```bash
# Generate Prisma Client
npm run prisma:generate

# Push Schema to PostgreSQL
npm run prisma:push
```

### 5. Local Server Execution
```bash
# Run client (Vite Port 3000) and backend server (Port 5000) concurrently
npm run dev
```

---

## ⚡ Production Deployment (Vercel)

The repository is configured for **Unified Single-Origin Vercel Serverless Deployment**:

```bash
# Compile TypeScript server and build Vite frontend assets
npm run build

# Deploy to Vercel Production
npx vercel --prod
```

- Serverless API handles requests at `/api/v1/*`
- Static Vite Frontend served via global Vercel Edge CDN
- Vercel Daily Cron triggers reconciliation automatically at `4:30 AM IST` (`0 23 * * *` UTC)

---

## 👤 Author & Lead Engineer

**Chandru M**  
*Senior Full-Stack Software Engineer*  
- **GitHub**: [@Chandru9842](https://github.com/Chandru9842)  
- **Project Repository**: [coding-progress-tracker](https://github.com/Chandru9842/coding-progress-tracker)

---

## 📄 License

This project is proprietary software developed for institution coding progress analytics and academic reporting. All rights reserved.
