# FastestHR

[![FastestHR](https://img.shields.io/badge/HRMS-Enterprise--Grade-indigo?style=for-the-badge&logo=react)]()
[![Stack](https://img.shields.io/badge/Stack-React%2018%20%7C%20TS%20%7C%20Supabase-blue?style=for-the-badge)](https://supabase.com)

**FastestHR** is a premier, enterprise-grade Human Resource Management System (HRMS). Engineered for exceptional performance, scalability, and an intuitive user experience, FastestHR delivers a comprehensive suite of tools designed to streamline the entire employee lifecycle—from recruitment and onboarding to payroll and performance management.

---

## 📖 Table of Contents

- [🚀 Product Modules & Capabilities](#-product-modules--capabilities)
- [🛠 Tech Stack & Architecture](#-tech-stack--architecture)
- [🎨 Premium Design System](#-premium-design-system)
- [📁 Project Architecture](#-project-architecture)
- [⚡ Performance & Optimizations](#-performance--optimizations)
- [🏁 Getting Started](#-getting-started)
- [📜 Scripts Reference](#-scripts-reference)

---

## 🚀 Product Modules & Capabilities

FastestHR comes fully equipped with 15+ comprehensive, high-fidelity modules covering every dimension of modern HR operations:

### 1. Unified Dashboards
- **Role-Based Views**: Tailored dynamic dashboards for **Company Admins**, **HR Managers**, and **Employees**.
- **Real-Time Analytics**: Visual insights on headcount growth, attrition trends, recruitment pipeline stats, monthly payroll costs, and attendance rates using interactive charts.

### 2. Comprehensive Employee Self-Service (ESS) & Profile Dashboard
- **Completion Indicator**: Interactive UI tracking profile completion progress (e.g. "85% Complete") with actionable prompt steps.
- **Pending Actions & Quick Stats**: Instant view of leave balances (CL, SL, EL), training schedules, performance reviews, and company announcements.
- **Tabbed Profile Sections**: A massive 12-section modular form system including:
  - *Personal Info*: Full name, auto-calculated age from DOB, identity verification documents (Aadhaar, PAN, Passport, License uploads).
  - *Emergency Contacts*: Primary/secondary contacts, medical emergency details, blood group, allergies, and health insurance.
  - *Family & Dependents*: Spouses, children (with multi-entry subforms), parents details, and benefit nominee configurations.
  - *Education & Certifications*: High school to PhD records with transcript upload, professional certifications, and active licenses.
  - *Work Experience*: Employment history tracker with auto-calculated duration, reporting manager tracking, and experience letter uploads.
  - *Skills & Competencies*: Interactive list of technical skills (with self-rating and experience level) and language proficiencies.
  - *Financials & Taxes*: Bank accounts (primary/secondary verification), Tax Residency status, and tax declarations (previous employer income, TDS details).

### 3. Recruitment & Applicant Tracking (ATS)
- **Job Posting Board**: Form to create and manage active role postings.
- **Interactive Leads Board**: Kanban-style drag-and-drop recruitment pipeline stages (Applied, Screened, Interview, Offered, Hired).
- **Candidate Portal & Login**: Secured public career page, job application interface, resume parsing, and document upload fields.
- **Offer & Letter Management**: Automated custom offer letter generation, digital signing workflows, and review screens.

### 4. Attendance & Leave Tracker
- **Clock Operations**: Daily clock-in/clock-out mechanisms featuring remote-work tagging.
- **Leave Operations**: Leave request submission form, approval workflows, custom holiday calendars, and real-time leave balances.

### 5. Payroll Management
- **Salary Setup**: Comprehensive salary configuration, tax deductions, bonuses, and incentives.
- **Automatic Payslip Generation**: End-of-month calculations with PDF/CSV export support.

### 6. Performance & OKRs (`KPI.tsx`)
- **Goal Setting**: Clear OKR mapping.
- **360 Reviews**: Double-sided reviews (employee self-assessment + manager reviews) alongside performance rating gauges.

### 7. Internal Communications & Culture Hub
- **Announcements**: Global company broadcasts and policy update alerts.
- **Culture Hub**: A dedicated community portal displaying team celebrations, work anniversaries, birthdays, and digital employee appreciation cards.

### 8. HR Helpdesk & Ticketing
- **Ticket Pipeline**: Complete ticketing pipeline (Categories: Payroll, Leave, IT, Benefits, Settings) allowing users to file bugs/issues and HR agents to assign, update, and resolve them.

### 9. Platform Administration (SaaS Panel)
- **Domain & Tenant Settings**: Set up company domain limits and security parameters.
- **Subscription Management**: Multi-company active subscription dashboard and invoices.
- **Attrition Insights**: Analytical views on organization exit statistics.

---

## 🛠 Tech Stack & Architecture

- **Frontend**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (global store) + [TanStack Query v5](https://tanstack.com/query/v5) (cached server-state synchronization)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/) (modern component kit)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (fluid sidebar transitions and modal popups)
- **Charts**: [Recharts](https://recharts.org/) (beautiful analytical graphs)
- **Database Backend**: [Supabase](https://supabase.com/) (Postgres DB, GoTrue Auth, Real-time sync, Storage buckets)
- **Verification**: [Vitest](https://vitest.dev/) (unit testing) & [Playwright](https://playwright.dev/) (end-to-end integration tests)

---

## 🎨 Premium Design System

FastestHR places a tremendous focus on aesthetics and user delight:

- **Indigo Primary Aesthetic**: Indigo `#4F46E5` base accented by emerald success green `#10B981`, caution amber `#F59E0B`, and danger red `#EF4444`.
- **Seamless Dark Mode**: Full native support with a topbar theme selector, automatically adjusting standard and sub-component borders.
- **Micro-Animations**: Hover-triggered translations, smooth dashboard panel expansions, and status change fades.
- **Typography**: Crafted using the professional **Inter** typeface for readability and optimal visual weight balance.
- **Mobile-First Layout**: Fully custom mobile shell that renders a beautiful app-like view on smaller screens while maintaining standard layouts on desktop.

---

## 📁 Project Architecture

```text
/src
├── /components         # Custom UI elements (Buttons, Layouts, Tables, Modals)
├── /data               # Mock data & metadata configuration maps
├── /hooks              # Custom hooks (e.g. useDebounce, useAuth)
├── /integrations       # Supabase client initialize & APIs
├── /lib                # Utility libraries (Shadcn configuration, helper formatting)
├── /pages              # Full-fidelity feature pages
│   ├── /admin          # Platform control ( attrition, subscriptions, company domains)
│   ├── /auth           # Dedicated forms (Login, Register, Forgot, Reset)
│   ├── /candidate      # Candidate facing application views & portals
│   ├── /company        # Core company organizational structures
│   ├── /employees      # Directory profiles and listing views
│   ├── /leaves         # Leave application workspace
│   ├── /profile        # Modular Profile sections (Bank, Personal, Tax, Experience)
│   ├── /public         # Public career listings
│   ├── /recruitment    # ATS Kanban boards, interview forms, offer views
│   ├── /settings       # RBAC matrices and platform domain definitions
│   └── /solutions      # Tailored pages (Startup templates)
├── /store              # Zustand state modules
└── /utils              # Date, formatting, and mathematical utility functions
```

---

## ⚡ Performance & Optimizations

> [!TIP]
> **API Request Debouncing**  
> We protect your Supabase quotas! The main Employee Directory (`Employees.tsx`) and IT Helpdesk (`HelpDesk.tsx`) pages implement a custom `useDebounce` hook. This holds API requests for 300ms while a user types search parameters, preventing server congestion.

> [!NOTE]
> **Optimized Filter Matrices**  
> To ensure seamless performance across directories with thousands of users, the application filters role assignments client-side after pulling cached TanStack queries, maximizing speed and cutting down on database load.

---

## 🏁 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Supabase](https://supabase.com/) Account & Project Database

### Installation

1. **Obtain the source code**:
   Extract the FastestHR source code package to your desired directory and navigate into it:
   ```bash
   cd fastesthr
   ```

2. **Install dependencies**:
   ```bash
   pnpm install  # or npm install / bun install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-api-key
   ```

4. **Initialize Supabase DB Schema**:
   The baseline Postgres schema, tables, functions, and relational triggers can be initialized using the schema file located in the root directory:
   ```bash
   # Apply schema rules to your database or run via Supabase SQL Editor
   cat supabase-schema.sql
   ```

5. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` to explore your local copy of FastestHR!

---

## 📜 Scripts Reference

- `npm run dev`: Starts the local Vite development server with hot module reloading (HMR).
- `npm run build`: Compiles and bundles optimized production-ready assets to `/dist`.
- `npm run lint`: Analyzes workspace code style and potential bugs via ESLint.
- `npm run test`: Executes unit tests with Vitest.
- `npm run preview`: Spins up a local static server to preview the built application.

---

Built with ❤️ by the FastestHR Team.
