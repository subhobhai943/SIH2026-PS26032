# Project Structure

## SIH 2026 — PS26032: Farmer Procurement Queue Management Platform

---

```
SIH2026-PS26032/
├── client/                      # Frontend (Next.js)
│   ├── public/
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── page.tsx         # Landing page
│   │   │   ├── register/        # Farmer registration
│   │   │   ├── booking/         # Slot booking
│   │   │   ├── queue/           # Live queue dashboard
│   │   │   ├── status/          # Procurement & payment status
│   │   │   └── admin/           # Admin panel
│   │   ├── components/          # Reusable UI components
│   │   ├── lib/                 # API helpers, socket client
│   │   └── styles/
│   ├── .env.local
│   └── package.json
│
├── server/                      # Backend (Node.js + Express)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── farmerController.js
│   │   │   ├── slotController.js
│   │   │   ├── queueController.js
│   │   │   └── notificationController.js
│   │   ├── models/
│   │   │   ├── Farmer.js
│   │   │   ├── Slot.js
│   │   │   ├── Queue.js
│   │   │   └── Procurement.js
│   │   ├── routes/
│   │   │   ├── farmerRoutes.js
│   │   │   ├── slotRoutes.js
│   │   │   ├── queueRoutes.js
│   │   │   └── adminRoutes.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── services/
│   │   │   ├── smsService.js    # MSG91 integration
│   │   │   └── socketService.js # Socket.io real-time
│   │   ├── config/
│   │   │   └── db.js            # MongoDB connection
│   │   └── index.js             # Entry point
│   ├── .env
│   └── package.json
│
├── docs/                        # Additional documentation
├── docker-compose.yml
├── README.md
├── claude.md
├── PWD.md
├── structure.md
└── LICENSE
```

---

## Key Modules

### Farmer Module
- OTP-based phone number registration & login
- Profile management (name, location, crop type, Aadhaar)

### Slot Booking Module
- View available time slots at nearby procurement centres
- Book, reschedule, or cancel slots
- Capacity-limited slot allocation logic

### Queue Management Module
- Real-time queue position tracking via Socket.io
- Admin controls to advance queue and mark completions
- Estimated wait time calculation

### Notification Module
- SMS alerts via MSG91 for slot confirmation, reminders, queue updates
- Optional Firebase push notifications for app users

### Admin Panel
- Procurement centre staff dashboard
- Manage slots, queue, and procurement records
- Update payment/procurement status per farmer

### Payment & Status Tracker
- Track procurement stage (Arrived → Weighed → Approved → Paid)
- Farmer-facing status view with timeline
