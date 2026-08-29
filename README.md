# SIH 2026 — Problem Statement 26032

## Farmer Procurement Queue Management Platform

> Smart India Hackathon 2026 | Software Category | Theme: Smart Automation

---

## Problem Statement

Farmers often face long waiting times, lack of information regarding procurement schedules, and uncertainty about procurement status at government procurement centres.

**Organization:** Ministry of Consumer Affairs, Food & Public Distribution  
**Department:** Department of Consumer Affairs (DoCA)  
**Category:** Software  
**Theme:** Smart Automation  
**PS ID:** SIH26032

---

## Expected Solution

A platform that:
- Enables farmer registration and slot booking
- Provides real-time queue management
- Sends SMS/app notifications
- Tracks procurement and payment status
- Reduces congestion and waiting time at procurement centres

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js / Next.js |
| Backend | Node.js + Express |
| Database | MongoDB |
| Real-time | WebSockets (Socket.io) |
| Notifications | SMS Gateway (MSG91 / Twilio) + Firebase Push |
| Deployment | Docker + Railway/Render |

---

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB running locally (or via Docker) at `mongodb://127.0.0.1:27017`

### 1. Backend

```bash
cd server
cp .env.example .env
npm install
npm run seed   # creates demo centres, an admin/operator login, and a week of slots
npm run dev    # http://localhost:5000
```

Demo admin login (from the seed script): `admin@sih26032.local` / `ChangeMe123!`
Demo operator login: `operator@sih26032.local` / `ChangeMe123!`

In development (`OTP_DEV_MODE=true`), the OTP is also returned in the API response and printed
to the server console, so the flow can be exercised without a real SMS gateway.

### 2. Frontend

```bash
cd client
cp .env.local.example .env.local
npm install
npm run dev    # http://localhost:3000
```

### 3. Everything via Docker Compose

```bash
docker compose up --build
```
This brings up MongoDB, the API server (`:5000`), and the Next.js client (`:3000`) together.

---

## Core API Endpoints

| Area | Endpoint | Description |
|---|---|---|
| Auth | `POST /api/farmers/otp/request` | Send an OTP to a farmer's phone |
| Auth | `POST /api/farmers/otp/verify` | Verify OTP, returns JWT (creates account on first login) |
| Profile | `PUT /api/farmers/me` | Complete/update farmer profile |
| Centres | `GET /api/centers` | List procurement centres |
| Slots | `GET /api/slots?centerId=&date=` | List open slots for a centre/date |
| Booking | `POST /api/slots/book` | Book a slot, receive a queue token |
| Booking | `GET /api/slots/bookings/me` | A farmer's booking history |
| Queue | `GET /api/queue/:centerId` | Public live queue board (also pushed over Socket.io as `queue:update`) |
| Queue | `GET /api/queue/me/position` | The logged-in farmer's own position/ETA |
| Status | `GET /api/queue/me/status/:bookingId` | Procurement stage timeline for a booking |
| Admin | `POST /api/admin/login` | Staff login |
| Admin | `POST /api/admin/slots/generate` | Auto-generate a day's slots from a centre's hours |
| Admin | `POST /api/admin/queue/:id/call-next` | Advance the queue, SMS the next farmers |
| Admin | `PATCH /api/admin/procurement/:queueEntryId` | Move a farmer through arrived → weighed → approved → paid |

---

## Team

> Add team member details here.

---

## License

This project is licensed under the MIT License — see [LICENSE](./LICENSE) for details.
