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

- **Backend:** Node.js, Express, PostgreSQL, JWT, bcrypt, Multer, Socket.IO
- **Frontend:** React, TypeScript, Tailwind CSS
- **Containerization & Database:** Docker, Docker Compose (PostgreSQL 16)

---

## 🚀 Setup and Installation Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for zero-config database setup)

### 1. Start the Database with Docker
Make sure Docker Desktop is running, then run:
```bash
docker compose up -d
```
This spins up a pre-configured PostgreSQL 16 container at `localhost:5432` with database `swaply_db`.

### 2. Configure Environment Variables
Copy `.env.example` into `.env` inside the `server/` directory:
```bash
cd server
cp .env.example .env
```

### 3. Install Backend Dependencies
```bash
cd server
npm install
```

### 4. Run Database Migrations
Create all application tables, indexes, and constraints:
```bash
npm run db:migrate
```

To reset or wipe the database clean at any time:
```bash
npm run db:reset
```

### 5. Start the Backend Server
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

---

## 📡 API Endpoints (Core REST Specification)

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
| `PUT` | `/me/item` | Update active trade item |
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
# Reset database schema:
npm run db:reset

# Load fictitious test users (100+ profiles):
npm run db:seed
```
