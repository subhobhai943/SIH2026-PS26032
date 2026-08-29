# Claude AI Assistance Notes

This file documents AI-assisted decisions, architecture suggestions, and implementation guidance used during development of the SIH 2026 PS26032 project.

---

## Project Overview

- **Problem Statement ID:** SIH26032
- **Title:** Farmer Procurement Queue Management Platform
- **Category:** Software | Theme: Smart Automation
- **Organization:** Ministry of Consumer Affairs, Food & Public Distribution

---

## AI-Assisted Architecture Decisions

### System Design
- Full-stack web application with optional mobile-friendly PWA layer
- Real-time queue updates via WebSockets (Socket.io)
- SMS notification integration for farmers without smartphones
- Slot booking system with time-window-based allocation logic

### Key Components Identified
1. Farmer Registration & Auth (OTP-based via phone number)
2. Slot Booking Engine (time-slot allocation with capacity limits)
3. Real-Time Queue Dashboard (live position tracking)
4. Admin Panel (procurement centre staff view)
5. SMS/Push Notification Service
6. Payment & Procurement Status Tracker

### Tech Stack Reasoning
- **MongoDB** chosen for flexible farmer/slot/queue document schemas
- **Socket.io** for real-time queue position broadcasting
- **MSG91** preferred over Twilio for Indian SMS delivery & pricing
- **Next.js** for SSR + PWA support (faster load on low-end rural devices)

---

## Notes

> Update this file as AI assistance is used throughout the project lifecycle.
