# Project Working Document (PWD)

## SIH 2026 — PS26032: Farmer Procurement Queue Management Platform

---

## Current Status

- [x] Repository created
- [x] Documentation initialized
- [x] System architecture finalized
- [ ] UI wireframes created (built directly as working screens instead)
- [x] Backend API design
- [x] Database schema designed
- [x] Frontend scaffolding
- [x] Backend scaffolding
- [x] Real-time queue module
- [x] SMS notification integration (console-logging stub; MSG91 wired, needs a live auth key)
- [x] Admin dashboard
- [ ] Testing (no automated test suite yet; server passes syntax checks, client passes `next build`)
- [ ] Deployment (Dockerfiles + docker-compose ready, not yet deployed to Railway/Render)
- [ ] Final presentation (PPT)

### What's implemented
- **Server** (`server/`): Express + Mongoose API — OTP-based farmer auth, centre/slot
  browsing, atomic slot booking with queue token issuance, live queue state (Socket.io),
  staff/admin login, slot generation from centre hours, queue operations (check-in, call-next,
  no-show), and a procurement stage pipeline (arrived → weighed → approved → paid) with SMS
  notifications at each step.
- **Client** (`client/`): Next.js App Router — landing page, phone/OTP registration, slot
  booking screen, live queue dashboard (Socket.io), farmer status/timeline view, and a staff
  admin panel for running the queue.
- **Seed data**: `npm run seed` in `server/` creates two demo centres, an admin + operator
  login, and a week of open slots to demo against.

---

## Sprint Plan

### Sprint 1 — Planning & Design
- Finalize tech stack
- Create system architecture diagram
- Design database schema
- Wireframe all screens

### Sprint 2 — Core Backend
- Set up Node.js + Express project
- Farmer registration & OTP auth
- Slot booking API
- Queue management logic

### Sprint 3 — Frontend
- Set up Next.js project
- Farmer registration & login screens
- Slot booking UI
- Real-time queue dashboard

### Sprint 4 — Integrations
- Socket.io real-time queue updates
- SMS notification integration (MSG91)
- Admin panel for procurement staff
- Payment/procurement status tracker

### Sprint 5 — Polish & Deploy
- UI/UX improvements
- Bug fixes & testing
- Docker setup
- Deploy to cloud
- Prepare SIH presentation PPT

---

## Team Members

| Name | Role |
|---|---|
| TBD | TBD |

---

## Notes

> Use this file to track daily progress, blockers, and decisions.
