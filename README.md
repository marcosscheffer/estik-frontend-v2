# Estik — Frontend

Web interface for **Estik**, an IT and maintenance management system: support tickets with real-time chat, computer inventory, stock per facility and department, and live notifications.

This repository contains only the frontend. It consumes the **estik-java-api** REST API (Spring Boot), which must be running for the app to work.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

> The user interface is in Brazilian Portuguese.

> [!NOTE]
> **AI transparency:** this frontend was generated with the help of AI (Claude, by Anthropic), based on the backend code and its Swagger/OpenAPI documentation, and then reviewed and tested by the author. The backend (**estik-java-api**) was written by hand, without AI-generated code.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Running in development](#running-in-development)
- [Environment variables](#environment-variables)
- [Running with Docker (production)](#running-with-docker-production)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Authentication](#authentication)
- [Roles and permissions](#roles-and-permissions)
- [AI transparency](#ai-transparency)

---

## Features

- **Tickets**: opening (the facility is taken automatically from the logged-in user), triage, forwarding to technicians, handling, resolving, reopening, cancelling and status history. Tabs by scope: my tickets, awaiting triage, forwarded to me, being handled by me, and more.
- **Ticket chat**: real-time conversation (SSE) between requester and assignee, with quoted replies and attachments (images and PDF) served through signed URLs.
- **Real-time notifications**: bell with a live unread counter, via Server-Sent Events.
- **Computers**: registration, configuration, moving between facilities and departments, and a history timeline.
- **Stock**: balances per department and movements (entry, exit, adjustment and transfer).
- **Catalog**: items and categories.
- **Administration**: facilities, departments and users (activation, role and facility).
- **Map**: tree view of Facility › Department › computers and items.
- **Dashboard**: counters and a tickets-per-month chart.
- Dark theme, responsive layout, and card or list views.

## Tech stack

| Library | Purpose |
|---|---|
| React 19 + TypeScript + Vite | project foundation |
| Tailwind CSS v4 | styling |
| axios | HTTP, with JWT interceptors and automatic token refresh |
| TanStack Query | request caching, loading states and revalidation |
| React Router 7 | routing and role-based route guards |
| react-hook-form + zod | forms and validation |
| fetch + ReadableStream (`src/lib/sse.ts`) | SSE with the JWT in the header and automatic reconnection |
| lucide-react, sonner, jwt-decode, clsx | icons, toasts, token decoding, conditional classes |
| Nginx (Docker) | serves the build and proxies `/api` to the backend |

## Prerequisites

- **Node.js 22+** and npm
- The **estik-java-api** backend running (by default at `http://localhost:8080`)
- Optional: **Docker** and **Docker Compose** for production

## Running in development

```bash
git clone <this-repository-url>
cd estik-frontend

npm install
cp .env.example .env   # optional: the defaults already work
npm run dev            # http://localhost:5173
```

> On Windows, if PowerShell blocks `npm`, use `npm.cmd install` and `npm.cmd run dev`.

In development, **no CORS configuration is needed** on the backend. The frontend calls `/api/...`, and the Vite proxy (`vite.config.ts`) forwards those requests to the backend. To the browser, everything comes from the same origin.

## Environment variables

Copy `.env.example` to `.env`. The `.env` file is **not committed** to Git.

| Variable | Used by | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | build (axios) | `/api` | API base URL. Keep `/api` to go through the Vite or Nginx proxy. |
| `VITE_BACKEND_URL` | dev (Vite proxy) | `http://localhost:8080` | Where the Vite proxy forwards requests. |
| `BACKEND_URL` | Docker (Nginx) | `http://host.docker.internal:8080` | Where Nginx forwards `/api/` requests. |

> `VITE_*` variables are baked into the JavaScript at build time. Never put secrets in them.

## Running with Docker (production)

The `Dockerfile` has two stages:

1. **build**: `node:22` runs `npm ci` and `npm run build`.
2. **runtime**: `nginx:1.28-alpine` serves only the `dist/` folder.

Nginx (`nginx/default.conf.template`) does three things:

- serves the app and falls back to `index.html` for unknown routes (SPA);
- proxies `/api/` to `${BACKEND_URL}`;
- turns off buffering so the notification and chat SSE streams work.

```bash
# backend running on the host machine, port 8080
docker compose up -d --build
# open http://localhost:3000
```

To point to a different backend:

```bash
BACKEND_URL=http://my-backend:8080 docker compose up -d --build
```

If the frontend is served from another domain without this proxy, the backend must allow CORS for that origin, and `VITE_API_URL` must be the full API URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build` | type-checks (`tsc -b`) and builds for production into `dist/` |
| `npm run preview` | serves `dist/` locally to check the build |
| `npm run typecheck` | type-check only |

## Project structure

```
src/
├── types/api.ts        types mirroring the API schemas (OpenAPI)
├── lib/                axios + refresh, tokens, roles, errors, labels, formatting, SSE
├── services/           one function per endpoint, grouped by module
├── contexts/           AuthContext (logged-in user: token claims + GET /users/{id})
├── hooks/              URL filters, select lookups, mutations with toasts
├── components/
│   ├── ui/             Button, Input, Select, Modal, Table, Pagination...
│   └── layout/         sidebar, top bar, notification bell, route guards
└── pages/              screens per module (tickets, computers, stock, admin, map...)
nginx/                  Nginx configuration template
Dockerfile              multi-stage build (Node → Nginx)
docker-compose.yml      runs the frontend on port 3000
```

## Authentication

1. `POST /auth/login` returns a short-lived `accessToken` and a `refreshToken`.
2. The access token carries `sub` (id), `username` and `role`. The user's facility (`facilityId`) comes from `GET /users/{id}`.
3. Before each request, if the access token is about to expire, axios calls `POST /auth/refresh` first.
4. If the API answers 401, or 403 with an expired token, axios refreshes and retries the request once. Concurrent requests wait for the same refresh.
5. If the refresh fails, the session ends and the user is sent back to the login page.

New accounts are created **inactive and without a facility**. An administrator assigns the facility and activates the account.

## Roles and permissions

Hierarchy: `USER < TECHNICIAN < ADMINISTRATOR`, defined in `src/lib/roles.ts`.

| Area | Minimum role |
|---|---|
| Tickets, chat, notifications, profile | USER |
| Computers, history, stock, catalog, taking tickets | TECHNICIAN |
| Facilities, departments, users, triage and forwarding | ADMINISTRATOR |

> These frontend rules only shape the interface. Security is enforced by the backend.

## AI transparency

This frontend was built with AI assistance (Claude, by Anthropic). The code was generated from the backend source and its OpenAPI specification, then reviewed, adjusted and tested against the running API by the author.

The backend, **estik-java-api**, is a separate project written by hand, where AI was used only for explanations and code review, not to generate code.
