# SWAPLY
> **Tinder for Things.**  
> *Swipe it. Match it. Swap it.*

A full-stack recommendation and peer-to-peer item exchange web platform developed for the **Match-Me Web** project.

---

## 📖 Project Overview

SWAPLY matches users based on their biographical data, matching preferences, and active exchange items.
- Each user has **one active exchange item** at a time.
- Users browse other users' items in a card-swiping interface.
- A mutual swipe ("Like") creates a **Match** and establishes a connection.
- Connected users can communicate via **real-time chat** to coordinate the swap.

---

## 🛠️ Tech Stack

- **Backend:** Java 21, Spring Boot 3 (Spring Web, Spring Security with BCrypt, Spring JDBC, JJWT)
- **Frontend:** React 19, TypeScript, Vite, React Router, Tailwind CSS 4
- **Real-time:** Spring WebSocket (chat messages, unread badges, typing indicator, online status)
- **Containerization & Database:** Docker, Docker Compose (PostgreSQL 16)

---

## 🚀 Setup and Installation Instructions

### Prerequisites
- [Java 21](https://adoptium.net/) (JDK 21)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL database)

### 1. Start the Database with Docker
Make sure Docker Desktop is running, then run:
```bash
docker compose up -d
```
This spins up a pre-configured PostgreSQL 16 container at `localhost:5432` with database `swaply_db`.

### 2. Backend Configuration
The Spring Boot backend uses `src/main/resources/application.properties` pre-configured to connect to the PostgreSQL Docker container (`localhost:5432/swaply_db`).

### 3. Run the Backend Server
Use the included Maven wrapper (no separate Maven installation required):

**On Linux/macOS:**
```bash
cd server
./mvnw spring-boot:run
```

**On Windows (PowerShell / Command Prompt):**
```powershell
cd server
.\mvnw.cmd spring-boot:run
```
The server will start at `http://localhost:5000`.

### 4. Run the Frontend
Requires [Node.js 20+](https://nodejs.org/). In a second terminal:
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173`. The Vite dev server proxies `/api` (REST and WebSocket) and `/uploads` to the backend on port 5000, so no CORS setup is needed. If the backend runs somewhere else, start the frontend with `BACKEND_URL=http://host:port npm run dev`.

Production build: `npm run build`, then `npm run preview` (serves the build on `http://localhost:4173` with the same proxy).

---

## 🧭 Usage Guide

1. **Register** with name, email and password. You land on your profile.
2. **Complete your profile** (the checklist at the top shows what's missing): location (city or browser GPS), one item to swap, interests, item categories you want, accepted conditions, value range, max distance and how much each of these matters to you. Discover, requests, connections and chats stay locked until the profile is complete.
3. **Discover**: up to 10 recommended people at a time, best match first, shown as their item on a card. Drag the card right or press ♥ to request a swap, left or ✕ to pass. A passed person is never shown again. On desktop the ← and → keys work too.
4. **Requests**: people who want your item. Accept or decline. When two people like each other's items it's a match and they are connected.
5. **Connections**: everyone you're connected with, with online status. Open a chat or disconnect.
6. **Chats**: all chats, newest message first, with unread counts. Messages arrive instantly, the other person sees "typing…" while you write, and "seen" when they've read your message. Older messages load when you scroll up.
7. **Log out** is in the top bar on every page.

## ⚡ Real-time (WebSocket)

The browser opens one WebSocket to `/api/ws?token=<JWT>` after login (browsers can't send an `Authorization` header on a WebSocket, so the token goes in the query string and `JwtHandshakeInterceptor` checks it). Messages are sent with REST (`POST /api/chats/{id}/messages`), saved to PostgreSQL and then pushed to both users over the socket. No polling anywhere; lists reload only when an event says something changed. If the connection drops, the client reconnects with backoff and reloads what it may have missed. Details in [API.md](API.md#7-chat-ja-reaalajas-sündmused).

Backend code: `server/src/main/java/tech/kood/swaply/realtime/`. Frontend code: `client/src/context/RealtimeContext.tsx`, `client/src/pages/ChatPage.tsx`.

---

## 📡 API Endpoints (Core REST Specification)

> 📘 **Täielik API leping koos kõigi JSON päringu/vastuse näidetega tiimile asub failis [API.md](API.md).**

All user and profile endpoints require authentication via `Authorization: Bearer <token>`.
Endpoints are accessible both directly and under the `/api` prefix.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user (`email`, `password`, `name`) |
| `POST` | `/auth/login` | Authenticate with `email` and `password`, returns JWT |
| `POST` | `/auth/logout` | End session |
| `GET` | `/me` | Current authenticated user summary (`id`, `name`, `profile_picture`) |
| `GET` | `/me/profile` | Current user profile information (`about_me`, `city`, `is_completed`) |
| `PUT` | `/me/profile` | Update profile information |
| `GET` | `/me/bio` | Current user biographical points and weights |
| `PUT` | `/me/bio` | Update biographical data points |
| `POST` | `/me/avatar` | Upload profile avatar image (multipart form-data) |
| `DELETE` | `/me/avatar` | Remove profile picture (reverts to default placeholder `👤`) |
| `GET` | `/me/item` | Current user's active trade item |
| `POST` | `/me/item` | Add active trade item (multipart form-data with optional image) |
| `DELETE` | `/me/item` | Archive active trade item |
| `GET` | `/users/:id` | Returns `id`, `name`, and `profile_picture` (returns 404 if not allowed) |
| `GET` | `/users/:id/profile` | Returns `id`, `about_me`, and `city` (returns 404 if not allowed) |
| `GET` | `/users/:id/bio` | Returns `id` and biographical data (returns 404 if not allowed) |
| `GET` | `/users/:id/item` | Returns target user's active trade item (returns 404 if not allowed) |
| `GET` | `/recommendations` | Returns list of recommended user IDs only (max 10) |
| `GET` | `/connections` | Returns list of connected user IDs only |

> **Privacy Rule:** If a user is not in the requester's active recommendations, has no pending request, and is not connected, all `/users/:id*` requests return **HTTP 404 Not Found**. Email addresses are strictly private and never exposed.

---

## 🧪 Database Reset and Peer Review Testing

During peer review, you can reset the database and reload test data with:
```bash
# Reset database container:
docker compose down -v
docker compose up -d
```
Upon restart, Spring Boot automatically applies `schema.sql`.
