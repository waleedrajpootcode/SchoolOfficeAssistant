# School Office Assistant

An **offline-first** school management system designed for small and private schools running on Windows.

---

## Purpose

Most school management software requires a cloud subscription and constant internet access — a barrier for small schools with unreliable connectivity. This system runs entirely on a local Windows PC and serves teachers over the school's own Wi-Fi/LAN network, with no internet dependency for core functionality.

---

## Architecture

```
┌─────────────────────────────────┐
│         Office PC (Windows)     │
│                                 │
│   Node.js + Fastify Server      │
│          ↕                      │
│       SQLite Database           │
│          ↑                      │
│     (local network / LAN)       │
└─────────────────┬───────────────┘
                  │ Wi-Fi / LAN
        ┌─────────┴─────────┐
        │                   │
  ┌─────▼──────┐    ┌───────▼──────┐
  │  Teacher   │    │  Teacher     │
  │  Mobile    │    │  Mobile      │
  │ (Browser / │    │ (Browser /   │
  │   PWA)     │    │   PWA)       │
  └────────────┘    └──────────────┘
```

### Monorepo Structure

```
SchoolOfficeAssistant/
├── apps/
│   ├── web/          # React + TypeScript + Vite (frontend)
│   └── server/       # Node.js + TypeScript + Fastify (backend)
├── packages/
│   └── shared/       # Shared TypeScript types & utilities
├── data/             # SQLite database files (auto-created, git-ignored)
├── package.json      # npm workspaces root
└── tsconfig.json     # Root TypeScript config
```

### Stack

| Layer     | Technology                     |
|-----------|-------------------------------|
| Frontend  | React 18, TypeScript, Vite 5  |
| Backend   | Node.js 18+, Fastify 4, TypeScript |
| Database  | SQLite via better-sqlite3     |
| Network   | Local LAN / School Wi-Fi      |
| Mobile    | PWA (planned) + IndexedDB     |

---

## Development Commands

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Install dependencies (run once from root)

```bash
npm install
```

### Start the backend server

```bash
npm run dev:server
# Runs at http://localhost:3001
# Health check: http://localhost:3001/api/health
```

### Start the frontend

```bash
npm run dev:web
# Runs at http://localhost:5173
# API requests are proxied to localhost:3001
```

### Build everything

```bash
npm run build
```

### Type-check all packages

```bash
npm run type-check
```

---

## Offline-First Goal

The system is designed so that:

1. The **Office PC** is the single source of truth — all data lives in a local SQLite file.
2. **Teachers** connect to the office PC over the school's existing Wi-Fi from any browser — no app install needed today, PWA packaging planned.
3. **No internet connection** is required for any core school operation (attendance, fees, reports).
4. In future releases, teachers' devices will cache data locally via IndexedDB and sync back to the server when reconnected.

---

## Current Project Status

> **Foundation only.** No features implemented yet.

- [x] Monorepo structure (npm workspaces)
- [x] React + Vite frontend scaffold
- [x] Fastify backend scaffold
- [x] Shared TypeScript types package
- [x] SQLite connection helper (no tables yet)
- [x] Health check endpoint (`GET /api/health`)
- [ ] Database schema & migrations
- [ ] Student management
- [ ] Attendance tracking
- [ ] Fee management
- [ ] Reports & dashboard
- [ ] PWA / Service Worker
- [ ] Windows installer

---

## Environment Variables

| Variable  | Default                      | Description                     |
|-----------|------------------------------|---------------------------------|
| `PORT`    | `3001`                       | Backend server port             |
| `HOST`    | `0.0.0.0`                    | Backend bind address            |
| `DB_PATH` | `data/school.sqlite`         | Path to SQLite database file    |

---

## First-Run Setup

On the first server start the migration runner creates the database schema automatically and seeds a default admin account.

**Default admin credentials**

| Field    | Value       |
|----------|-------------|
| Username | `admin`     |
| Password | `Admin@1234`|

> **Change this password immediately after first login.**
> The plaintext password above is used only at migration time to generate a
> secure scrypt hash. It is never stored in the database as plaintext.

**Environment variables** (all optional — sensible defaults apply)

| Variable      | Default                  | Description                          |
|---------------|--------------------------|--------------------------------------|
| `PORT`        | `3001`                   | Backend server port                  |
| `HOST`        | `0.0.0.0`                | Backend bind address                 |
| `DB_PATH`     | `data/school.sqlite`     | Path to the SQLite database file     |
| `CORS_ORIGIN` | `http://localhost:5173`  | Allowed origin for CORS (dev only)   |
