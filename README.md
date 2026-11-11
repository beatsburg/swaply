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

Connection events are pushed the same way: when someone sends you a request, accepts yours, or disconnects, the server sends `connection_request`, `connection_accepted` or `disconnected` to your socket, so the badges and lists update without reloading.

---

## 🎯 Recommendation Algorithm

Every time a user opens Discover (`GET /recommendations`), the backend recalculates their recommendations from scratch. It works in four steps: **gates → scores → mix → top 10**.

Backend code: `server/src/main/java/tech/kood/swaply/service/RecommendationService.java` (loading, gates, saving) and `MatchingScorer.java` (the scoring maths).

### 1. Gates: who is never recommended

A candidate is removed completely if any of these is true. Most gates run inside the SQL query, so the database only returns allowed people.

| Gate | Reason |
|---|---|
| It's me | obvious |
| My profile or theirs is not complete | required by the task |
| They have no active item | nothing to swap |
| They have no location | distance can't be checked |
| I already swiped them (like or dismiss) | a dismissed user is never shown again; a liked one is waiting in requests |
| They dismissed me | they already said no |
| There is any connection row between us (pending, accepted, rejected or disconnected) | already handled |
| The distance is larger than **either** person's max radius | both people have to travel to swap |
| **Neither** of us wants the other's item category | a swap nobody wants is impossible |

### 2. Scores: five channels, each from 0 to 1

Each channel checks **both directions** (does it suit me, does it suit them), because a swap only works when both sides are happy.

| Channel | Rule | Score |
|---|---|---|
| **Category** | is their item in my wanted categories, and mine in theirs? | both = 1, one side = 0.5 |
| **Value** | is their item's value in my min–max range, and mine in theirs? | both = 1, one side = 0.5, none = 0 |
| **Condition** | is their item's condition one I accept, and mine one they accept? | both = 1, one side = 0.5, none = 0 |
| **Distance** | how close are we, compared to the smaller radius? | `1 − distance ÷ smaller radius` |
| **Interests** | how many hobbies do we share? | `shared ÷ size of the shorter list` |

An empty preference list (e.g. no accepted conditions chosen) means *"open to anything"* and always counts as a yes.

### 3. Mix: the user's own weights

Each user sets how much each channel matters to them (`weights` in the bio, default `category 3, value 2, distance 2, condition 2, interests 1`). The final score is a weighted average:

```
score = (category×w1 + value×w2 + distance×w3 + condition×w4 + interests×w5) ÷ (w1 + w2 + w3 + w4 + w5)
```

So two users can see different rankings of the same people, depending on what they care about.

### 4. Top 10

- Scores **below 0.4** are weak recommendations and are dropped
- The rest are sorted, best first, and the **top 10** are returned as ids
- The same 10 are saved in `active_recommendations`. That table is what allows the user to open those profiles (`/users/{id}` returns 404 for anyone not recommended, requested or connected)

### Worked example (seed demo users)

Jan (Tallinn, offers a gravel bike, wants technology or music) and Mari (3.2 km away, offers a PlayStation 5, wants sports or games):

| Channel | Why | Score | × Jan's weight |
|---|---|---|---|
| Category | Jan wants tech, Mari wants sports | 1.0 | × 3 = 3.0 |
| Value | PS5 (€400) fits Jan's €50–500, bike (€450) fits Mari's €30–500 | 1.0 | × 2 = 2.0 |
| Distance | 3.2 km of the smaller 20 km radius | 0.84 | × 2 = 1.68 |
| Condition | both "like new", both accept it | 1.0 | × 2 = 2.0 |
| Interests | "music" shared, shorter list has 2 | 0.5 | × 1 = 0.5 |
| **Total** | 9.18 ÷ 10 | | **0.92** |

Mari is Jan's #1 recommendation. Liis (Tartu, 160 km away) never appears for Jan: the distance gate removes her before scoring.

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
| `GET` | `/recommendations` | Returns list of recommended user IDs only (max 10, best first) |
| `GET` | `/connections` | Returns list of connected user IDs only |
| `POST` | `/swipes` | Like or dismiss a recommended user (`target_user_id`, `direction`: `like` / `dismiss`), returns `{ "matched": true/false }` |
| `GET` | `/connections/requests` | IDs of users who sent me a request that I haven't answered yet |
| `POST` | `/connections/:id/accept` | Accept the request from user `:id` (only the receiver can accept) |
| `POST` | `/connections/:id/reject` | Decline the request from user `:id` |
| `DELETE` | `/connections/:id` | Disconnect from user `:id` |
| `POST` | `/dev/reset` | Empty all tables (development and review only) |
| `POST` | `/dev/seed` | Load the test users (development and review only) |

> **Privacy Rule:** If a user is not in the requester's active recommendations, has no pending request, and is not connected, all `/users/:id*` requests return **HTTP 404 Not Found**. Email addresses are strictly private and never exposed.

---

## 🧪 Database Reset and Test Users (Peer Review)

With the backend running, emptying the database and loading test users are two **separate** steps, so the app can be shown with no users, a few, or many:

```bash
# 1. Empty all tables (0 users)
curl -X POST http://localhost:5000/dev/reset

# 2. Load 123 test users
curl -X POST http://localhost:5000/dev/seed
```

`/dev/seed` creates:
- **3 demo users** with fixed profiles, so the demo always tells the same story:

| Email | City | Offers | Why it's interesting |
|---|---|---|---|
| `jan@swaply.test` | Tallinn | Gravel bike | log in as Jan to see the algorithm at work |
| `mari@swaply.test` | Tallinn, 3 km from Jan | PlayStation 5 | Jan's #1 match (score 0.92) |
| `liis@swaply.test` | Tartu, 160 km away | Acoustic guitar | never shown to Jan (distance gate) |

- **120 random users** (about 70% Tallinn, 30% Tartu) with different interests, wanted categories, conditions, price ranges, radiuses and items. A fixed random seed makes the data the same every time.

All test users have the password **`password123`**. Running `/dev/seed` twice does nothing: run `/dev/reset` first.

To wipe everything including the tables themselves:
```bash
docker compose down -v
docker compose up -d
```
Upon restart, Spring Boot automatically applies `schema.sql`.