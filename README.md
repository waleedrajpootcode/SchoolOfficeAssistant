# School Office Assistant V2

> A full-stack, offline-first school management system for small and private schools running on Windows and local school networks.

School Office Assistant is a locally deployed school management platform designed around a practical constraint: **the school should be able to operate its core office workflows without depending on cloud infrastructure or a continuous internet connection.**

The system combines a React/TypeScript frontend, Fastify/Node.js backend, SQLite persistence, role-based authentication, financial workflows, attendance management, family relationships, database migrations, and a Windows installer into one deployable application.

---

## Project Overview

The application is designed for a school office where:

- The office computer acts as the local application server.
- School data is stored in a local SQLite database.
- Teachers can access the system through a browser over the school's Wi-Fi/LAN.
- Core operations continue to work without an internet connection.
- Administrative and teacher permissions are separated through RBAC.
- Fees, payments, fines, waivers, families, attendance, salaries, students and teachers are managed from one system.
- The application can be packaged and installed on Windows using a bundled Node.js runtime.

This project was built as a **complete V2 application**, rather than as a CRUD-only demonstration.

---

## Key Capabilities

### Authentication & Access Control

- Admin and Teacher roles
- Login/logout/session lifecycle
- Protected API routes
- Role-based authorization
- Inactive-user protection
- Session expiration and revocation
- HTTP-only authentication cookie support
- Password hashing using Node.js `scrypt`

### Student & Teacher Management

- Student records
- Student activation/deactivation
- Teacher profiles
- Teacher activation/deactivation
- Class management
- Teacher/class assignments
- Shared student identity across school workflows

### Attendance

- Admin attendance management
- Teacher attendance workflows
- Mobile-browser access over LAN
- QR-assisted attendance workflow
- Offline queue support for attendance operations
- Synchronization with the local server when connectivity is restored

### Fees & Financial Workflows

- Fee structures
- Monthly student fee assignments
- Automatic recurring fee materialization
- Due dates
- Rule-based fines
- Partial payments
- Full payments
- Payment receipts
- Fine waivers
- Payment history
- Previous-month fee history
- Fee status filtering
- Family-level payment workflows

### Family Management

Families are implemented as a **relationship/grouping layer**, not as duplicate student records.

This preserves a single student identity across:

- Students
- Classes
- Attendance
- Fees
- Payments

A student can be linked to a family without creating another student record.

The system also protects the relationship with database/application validation so that a student cannot accidentally be assigned to a different family.

### Salaries

- Salary management workflow
- Admin-only salary access
- Dedicated salary APIs and UI

### Settings & School Configuration

- School/application settings
- Fee rules
- Configurable financial behavior
- Centralized application configuration

### Parent Communication

- Parent alert workflow
- Family-level WhatsApp communication links
- Communication generated from existing family/student information

---

# Technology Stack

## Languages

| Technology | Usage |
|---|---|
| **TypeScript** | Primary application language across frontend, backend and shared code |
| **SQL** | SQLite schema, migrations and database queries |
| **JSX / TSX** | React user-interface composition |
| **CSS** | Application styling |

## Frontend

| Technology | Version / Role |
|---|---|
| React | 18.3.1 |
| TypeScript | 5.4.5 |
| Vite | 8.3.0 |
| JSX / TSX | React UI implementation |

## Backend

| Technology | Version / Role |
|---|---|
| Node.js | 22.5+ |
| Fastify | 5.12.5 |
| TypeScript | Backend implementation |
| `@fastify/cookie` | Cookie/session support |
| `@fastify/cors` | CORS configuration |
| `@fastify/static` | Static asset serving |

## Database

- SQLite
- Node.js built-in `node:sqlite`
- `DatabaseSync`
- WAL journal mode
- Foreign-key enforcement
- Ordered database migrations

## Tooling & Deployment

- npm workspaces
- TypeScript project builds
- Vite production builds
- Windows/Inno Setup installer
- Bundled Node.js runtime
- Local HTTP/LAN deployment

---

# Architecture

```text
                         School Office LAN
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
          Office Windows PC              Teacher Devices
                 │                             │
        ┌────────▼────────┐              Browser / Mobile
        │  School Office  │                    │
        │    Assistant    │◄───────────────────┘
        │    Server       │       HTTP / LAN
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Fastify + Node  │
        │   REST APIs     │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │     SQLite      │
        │ Local Database  │
        └─────────────────┘
```

The frontend communicates with the Fastify API rather than accessing SQLite directly.

This keeps database access centralized inside the backend and allows multiple browser clients to use the same local application server.

---

# Monorepo Architecture

```text
SchoolOfficeAssistant/
├── apps/
│   ├── web/
│   │   └── React + TypeScript frontend
│   │
│   └── server/
│       └── Node.js + Fastify backend
│
├── packages/
│   └── shared/
│       └── Shared TypeScript types/utilities
│
├── data/
│   └── Local SQLite data
│
├── installer/
│   ├── app/
│   ├── assets/
│   ├── node/
│   ├── scripts/
│   ├── web/
│   └── output/
│
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

Local database files are intentionally excluded from Git.

---

# Database Architecture

The backend uses Node.js's built-in SQLite support rather than an external database server.

This was a deliberate architectural choice for the target environment:

- No PostgreSQL server
- No MySQL server
- No cloud database
- No database service installation
- Simple local deployment
- Single-file database portability
- Suitable for an offline/LAN school environment

The database enables:

- Foreign-key enforcement
- WAL journaling
- Transactional migrations
- Local backups
- Deterministic schema evolution

---

# Database Migration System

The application contains an ordered migration system with **13 migrations**.

The migration history covers the evolution of the application from its core foundation through the financial and family-management architecture.

Major areas include:

1. Authentication
2. Classes, students and attendance
3. Fees
4. Settings
5. Fee due dates
6. Salaries
7. Teacher profiles
8. Fee fines
9. Fee rules
10. Student fee assignments
11. Fine waivers
12. Family payment batches
13. Family structure

Migrations are tracked in a dedicated migration table and applied in order.

Each migration is executed transactionally so schema changes can be committed or rolled back safely.

---

# Authentication & Security

Authentication was implemented as an application-level security layer rather than relying on frontend-only protection.

### Password Storage

Passwords are not stored as plaintext.

The server uses Node.js `scryptSync` with:

- Random salts
- Configured scrypt cost parameters
- Derived password hashes
- Timing-safe comparison

### Sessions

Authenticated sessions use cryptographically random tokens.

The database stores a hash of the session token rather than the raw token.

Sessions include:

- Expiration
- Revocation
- User status validation
- Role lookup
- Protected API access

### Authorization

The API separates administrative and teacher capabilities.

Protected routes validate the authenticated user and enforce role requirements where necessary.

### Security Positioning

The project demonstrates a security-conscious local application architecture, while still being intended for controlled school/LAN deployment rather than claiming to be a hardened internet-facing SaaS security platform.

---

# Fees & Family Architecture

One of the more complex areas of the system is the relationship between students, monthly fees, payments, fines and families.

The architecture deliberately avoids duplicating student records.

```text
Student
   │
   ├── Class
   ├── Attendance
   ├── Monthly Fee
   │      ├── Payments
   │      ├── Fine
   │      └── Fine Waiver
   │
   └── Family
          ├── Other Students
          └── Family Payment
```

This allows family-level financial workflows while preserving the student as the single source of identity.

Recurring monthly fees can be materialized from configured fee structures, while fines are calculated from configured rules rather than being manually entered as arbitrary values.

---

# Offline & LAN Design

The application is designed for environments where internet availability cannot be assumed.

The core architecture is:

```text
Windows PC
    │
    ├── Node.js
    ├── Fastify
    └── SQLite
          │
          └── School Wi-Fi / LAN
                    │
             ┌──────┴──────┐
             │             │
          Teacher       Teacher
          Browser       Browser
```

The office PC remains the local source of truth.

Teachers can access the application through a browser using the school's local network.

No cloud backend is required for normal core operation.

---

# Windows Installer

The project includes a Windows installer built around **Inno Setup**.

The installer architecture bundles:

- Application server
- Frontend assets
- Node.js runtime
- Startup scripts
- Application assets

The installed application stores its operational database under Windows `ProgramData` rather than relying on the source repository.

The local server runs on port `3001` and can be accessed locally or by authorized devices on the school LAN.

This allows the project to be deployed as an actual Windows application rather than requiring developers to manually configure a Node.js environment on every school computer.

---

# Engineering Decisions

### SQLite instead of a server database

The target environment is a small school operating primarily from one office machine.

SQLite removes the operational overhead of running and maintaining a separate database server.

### Backend-controlled database access

The browser never communicates directly with SQLite.

All persistence is handled through the backend API, giving the application a single point for:

- Validation
- Authorization
- Business rules
- Transactions
- Database access

### Migration-based schema evolution

Schema changes are versioned through migrations rather than manually editing production databases.

### Shared TypeScript package

Common types are maintained in:

```text
packages/shared
```

This reduces duplication between frontend and backend contracts.

### Local-first deployment

The architecture prioritizes reliability inside the school's own network instead of requiring a cloud service.

---

# Development

## Requirements

- Node.js `22.5+`
- npm `9+`
- Windows environment for the intended deployment/installer workflow

## Install Dependencies

```bash
npm install
```

## Start Backend

```bash
npm run dev:server
```

Backend:

```text
http://localhost:3001
```

## Start Frontend

```bash
npm run dev:web
```

Vite development server runs on its configured development port.

## Build Shared Package

```bash
npm run build:shared
```

## Build Frontend

```bash
npm run build:web
```

## Build Backend

```bash
npm run build:server
```

## Build Everything

```bash
npm run build
```

## Type-check

```bash
npm run type-check
```

---

# Verification

The project has been verified through the development/build workflow, including:

- Frontend TypeScript compilation
- Vite production build
- Backend TypeScript compilation
- Shared package compilation
- Database migration lifecycle
- Authentication/session workflows
- Student and teacher lifecycle workflows
- Attendance workflows
- Fee/payment workflows
- Family relationships
- Salary access controls
- Installer architecture

The repository is intentionally kept free of local school database files and development-only artifacts.

---

# Screenshots

Screenshots will be added here to provide visual proof of the completed application.

Recommended portfolio screenshots:

1. Dashboard
2. Students management
3. Attendance
4. Fees dashboard
5. Fee payment / receipt
6. Families
7. Teachers
8. Salaries
9. Settings
10. Mobile/LAN teacher workflow

Sensitive school/student information should be replaced with synthetic demo data before publication.

---

# Project Status

## V2 — Completed

School Office Assistant V2 is a completed full-stack application.

The current repository represents the completed V2 implementation rather than an unfinished scaffold.

The project is now being prepared for public portfolio presentation and documentation.

---

# What This Project Demonstrates

This project demonstrates practical experience with:

- Full-stack TypeScript development
- React application architecture
- REST API design
- Fastify backend development
- SQLite database architecture
- Database migrations
- Authentication
- Session management
- Role-based authorization
- Financial business rules
- Payment workflows
- Family relationship modeling
- Offline/LAN application design
- Mobile browser workflows
- Windows application packaging
- Local deployment
- Repository hygiene
- Production-oriented application thinking

---

# Future Improvements

Potential future improvements could include:

- Automated integration test coverage
- Automated CI validation
- More comprehensive audit logging
- Expanded reporting/export capabilities
- Additional deployment automation
- Broader automated end-to-end testing

These are intentionally listed as future engineering opportunities and are **not represented as completed functionality**.

---

## Project Philosophy

The goal of School Office Assistant is simple:

> **Build practical software around the environment in which it will actually be used.**

Instead of assuming reliable internet access, cloud infrastructure and technical staff, the system is designed around a school office's existing Windows computer and local network.

That constraint shaped the architecture, database choice, deployment model and operational workflow throughout the project.

---

## License

License information can be added when the project publication strategy is finalized.