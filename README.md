# Syncode

Syncode is a real-time collaborative code editor built for fast room-based pairing. Create a room, share the room code, and edit the same `main.js` document with live presence, ownership colors, host controls, and persisted document state.

**Live app:** https://syncode-sigma.vercel.app/

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Realtime Events](#realtime-events)
- [Deployment](#deployment)
- [Quality Notes](#quality-notes)

## Features

- **Room-based collaboration**: create or join rooms using short six-character room codes.
- **Realtime editing**: document deltas are sent over Socket.IO and applied through a server-side room queue.
- **Conflict handling**: stale base versions are transformed against recent deltas to reduce sync interruptions.
- **Line and character ownership**: editor metadata tracks who changed each line/character, with unique participant colors.
- **Presence**: active collaborators, join/leave activity, and typing state are broadcast live.
- **Host controls**: hosts can rename, lock, close, or manage room access.
- **Persistence**: MongoDB stores room/session state and document snapshots.
- **Low-latency cache path**: Redis is used when available for document cache, recent deltas, and Socket.IO scaling; the server falls back to in-memory mode locally.
- **Production-ready frontend shell**: Vite + React UI with a VS Code-inspired editor experience.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind CSS, Lucide React |
| Realtime | Socket.IO, Socket.IO Redis adapter |
| Backend | Node.js, Express, Zod |
| Database | MongoDB, Mongoose |
| Cache / PubSub | Redis with local in-memory fallback |
| Deployment | Vercel for frontend, Node-compatible backend host |

## Architecture

```text
Browser
  |
  | REST: room create/join/rejoin/host actions
  | WebSocket: editor deltas, presence, activity
  v
Express + Socket.IO server
  |
  | room state, participants, snapshots
  v
MongoDB
  |
  | low-latency document cache, recent deltas, adapter pub/sub
  v
Redis
```

The client keeps the editor responsive by applying local changes immediately and sending compact deltas to the server. The server serializes edits per room, validates each delta, resolves version drift when possible, stores ownership metadata, then broadcasts the accepted update to other participants.

## Project Structure

```text
Syncode/
  client/                  # Vite React application
    src/
      components/          # Editor, room, presence, and shared UI components
      hooks/               # Room session and document sync hooks
      pages/               # Home, room, and 404 pages
      services/            # REST API helpers
      socket/              # Socket.IO client instance
  server/                  # Express + Socket.IO backend
    src/
      config/              # Environment, CORS, MongoDB, Redis
      modules/
        documents/         # Delta validation, conflict handling, cache, persistence
        rooms/             # Room lifecycle and host operations
        presence/          # Participant presence state
      sockets/             # Socket event registration and handlers
      models/              # Mongoose models
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- MongoDB database URI
- Redis server for production-grade realtime scaling. Local development can run without Redis because the server falls back to in-memory cache/adapter mode.

### 1. Clone and install

```bash
git clone <repository-url>
cd Syncode

cd server
npm install

cd ../client
npm install
```

### 2. Configure environment files

Create `server/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/syncode
CLIENT_URL=http://localhost:5173
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
```

Create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Run locally

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173`, create a room, then open the same room URL in another browser profile/window to test collaboration.

## Environment Variables

### Server

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | HTTP and Socket.IO server port. |
| `NODE_ENV` | Yes | Runtime environment, usually `development` or `production`. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `CLIENT_URL` | Yes | Allowed frontend origin for CORS. Use `https://syncode-sigma.vercel.app` in production. |
| `REDIS_URL` | No | Full Redis connection URL. Takes priority over host/port/password values. |
| `REDIS_HOST` | No | Redis host when `REDIS_URL` is not used. |
| `REDIS_PORT` | No | Redis port. Defaults to `6379`. |
| `REDIS_PASSWORD` | No | Redis password, if required by the provider. |

### Client

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Backend REST API base URL, ending with `/api`. |
| `VITE_SOCKET_URL` | Yes | Backend Socket.IO origin. |

## Available Scripts

### Client

```bash
npm run dev       # Start Vite dev server
npm run build     # Build production frontend
npm run preview   # Preview production build locally
```

### Server

```bash
npm run dev       # Start backend with nodemon
npm start         # Start backend with node
```

## API Overview

Base path: `/api`

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | API readiness check. |
| `GET` | `/rooms/:roomCode` | Fetch room details. |
| `POST` | `/rooms/create` | Create a new room. |
| `POST` | `/rooms/join` | Join an existing room. |
| `POST` | `/rooms/rejoin` | Rehydrate an existing local session. |
| `PATCH` | `/rooms/:roomCode/rename` | Rename room as host. |
| `PATCH` | `/rooms/:roomCode/lock` | Lock or unlock room as host. |
| `PATCH` | `/rooms/:roomCode/close` | Close room as host. |
| `POST` | `/rooms/:roomCode/kick` | Remove a participant as host. |

Health check:

```text
GET /health
```

## Realtime Events

Socket.IO powers the collaborative editing loop and presence system.

Key event groups:

- `room:*` for join, rejoin, leave, and room lifecycle events.
- `editor:*` for document state requests, deltas, acknowledgements, and sync errors.
- `presence:*` for collaborator online/typing state.
- `host:*` for host-only room controls.
- `participants:updated` and `activity:updated` for UI refreshes.

## Deployment

### Frontend

The frontend is deployed at:

```text
https://syncode-sigma.vercel.app/
```

For Vercel:

- Set the project root to `client`.
- Build command: `npm run build`
- Output directory: `dist`
- Add production env vars:

```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
VITE_SOCKET_URL=https://your-backend-domain.com
```

### Backend

Deploy the `server` directory to a Node.js host that supports WebSockets.

Production env example:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=<production-mongodb-uri>
CLIENT_URL=https://syncode-sigma.vercel.app
REDIS_URL=<production-redis-url>
```

Use Redis in production when running multiple backend instances or when low-latency document recovery matters.

## Quality Notes

- Keep `CLIENT_URL`, `VITE_API_BASE_URL`, and `VITE_SOCKET_URL` aligned across deployments.
- Use MongoDB for durable room/document state.
- Use Redis for multi-instance Socket.IO scaling and low-latency document cache.
- Avoid committing `.env` files.
- Run `npm run build` in `client` before shipping frontend changes.
- Run `node --check src/server.js` or start the backend before shipping backend changes.

