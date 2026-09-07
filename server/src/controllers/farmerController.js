import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import Farmer from '../models/Farmer.js';
import Otp from '../models/Otp.js';
import Notification from '../models/Notification.js';
import { signToken } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { sendTemplate } from '../services/smsService.js';
import { verifyFirebaseToken, verifyFirebaseGoogleToken } from '../config/firebase.js';

const MAX_OTP_ATTEMPTS = 5;

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const requestOtpSchema = z.object({ phone: phoneSchema });

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  village: z.string().min(2).max(80).optional(),
  district: z.string().min(2).max(80).optional(),
  state: z.string().min(2).max(80).optional(),
  photoUrl: z.string().optional(),
  aadhaarLast4: z.string().regex(/^\d{4}$/).optional(),
  crops: z.array(z.string().min(1)).max(10).optional(),
  landAreaAcres: z.number().min(0).max(10_000).optional(),
  preferredLanguage: z.enum(['en', 'hi', 'pa', 'bn', 'ta', 'te', 'mr']).optional(),
});

/** POST /api/farmers/otp/request */
export const requestOtp = asyncHandler(async (req, res) => {
  const { phone } = parse(requestOtpSchema, req.body);

  const code = String(crypto.randomInt(100_000, 1_000_000));
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);

  // Only the newest OTP for a number is valid.
  await Otp.deleteMany({ phone, consumedAt: null });
  await Otp.create({ phone, codeHash, expiresAt });

  await sendTemplate(phone, 'otp', { code });

  res.status(201).json({
    ok: true,
    data: {
      phone,
      expiresAt,
      // Returned only in dev so the demo works without a live SMS gateway.
      ...(env.otpDevMode ? { devCode: code } : {}),
    },
  });
});

/** POST /api/farmers/otp/verify — creates the account on first successful login. */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, code } = parse(verifyOtpSchema, req.body);

  const otp = await Otp.findOne({ phone, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp) throw ApiError.badRequest('Request an OTP first');
  if (otp.expiresAt < new Date()) throw ApiError.badRequest('OTP has expired, request a new one');
  if (otp.attempts >= MAX_OTP_ATTEMPTS) throw ApiError.badRequest('Too many wrong attempts, request a new OTP');

  const matches = await bcrypt.compare(code, otp.codeHash);
  if (!matches) {
    otp.attempts += 1;
    await otp.save();
    throw ApiError.badRequest(`Incorrect OTP. ${MAX_OTP_ATTEMPTS - otp.attempts} attempt(s) left`);
  }

  otp.consumedAt = new Date();
  await otp.save();

  let farmer = await Farmer.findOne({ phone });
  let isNew = false;
  if (!farmer) {
    farmer = await Farmer.create({ phone });
    isNew = true;
  }

  const isProfileComplete = Boolean(farmer.name?.trim() && farmer.photoUrl?.trim());
  const hasPhoto = Boolean(farmer.photoUrl?.trim());

  res.json({
    ok: true,
    data: {
      token: signToken({ sub: String(farmer._id), kind: 'farmer', phone }),
      isNew: Boolean(isNew || !isProfileComplete),
      isProfileComplete,
      hasPhoto,
      farmer: farmer.toJSON(),
    },
  });
});

const firebaseVerifySchema = z.object({
  idToken: z.string().min(10, 'Firebase ID token is required'),
});

/** POST /api/farmers/firebase/verify — logs in or registers farmer using verified Firebase ID token */
export const verifyFirebase = asyncHandler(async (req, res) => {
  const { idToken } = parse(firebaseVerifySchema, req.body);
  const { phone } = await verifyFirebaseToken(idToken);

  let farmer = await Farmer.findOne({ phone });
  let isNew = false;
  if (!farmer) {
    farmer = await Farmer.create({ phone });
    isNew = true;
  }

  const isProfileComplete = Boolean(farmer.name?.trim() && farmer.photoUrl?.trim());
  const hasPhoto = Boolean(farmer.photoUrl?.trim());

  res.json({
    ok: true,
    data: {
      token: signToken({ sub: String(farmer._id), kind: 'farmer', phone }),
      isNew: Boolean(isNew || !isProfileComplete),
      isProfileComplete,
      hasPhoto,
      farmer: farmer.toJSON(),
    },
  });
});

const googleVerifySchema = z.object({
  idToken: z.string().min(10, 'Firebase ID token is required'),
  phone: phoneSchema.optional(),
});

/** POST /api/farmers/google/verify — logs in or registers farmer using Google Sign-In via Firebase */
export const verifyGoogle = asyncHandler(async (req, res) => {
  const { idToken, phone: clientPhone } = parse(googleVerifySchema, req.body);
  const googleUser = await verifyFirebaseGoogleToken(idToken);

  const phone = clientPhone || googleUser.phone || null;

  // 1. Find by googleId
  let farmer = await Farmer.findOne({ googleId: googleUser.uid });

  // 2. If not found by googleId, try finding by email
  if (!farmer && googleUser.email) {
    farmer = await Farmer.findOne({ email: googleUser.email });
  }

  // 3. If not found and phone is available, check by phone to link accounts
  if (!farmer && phone) {
    farmer = await Farmer.findOne({ phone });
  }

  let isNew = false;
  if (farmer) {
    let modified = false;
    if (!farmer.googleId) {
      farmer.googleId = googleUser.uid;
      modified = true;
    }
    if (!farmer.email && googleUser.email) {
      farmer.email = googleUser.email;
      modified = true;
    }
    if (!farmer.name && googleUser.name) {
      farmer.name = googleUser.name;
      modified = true;
    }
    if (!farmer.photoUrl && googleUser.picture) {
      farmer.photoUrl = googleUser.picture;
      modified = true;
    }
    if (!farmer.phone && phone) {
      farmer.phone = phone;
      modified = true;
    }
    if (modified) await farmer.save();
  } else {
    farmer = await Farmer.create({
      googleId: googleUser.uid,
      email: googleUser.email,
      name: googleUser.name || '',
      photoUrl: googleUser.picture || '',
      phone: phone || undefined,
      authProvider: 'google',
    });
    isNew = true;
  }

  const isProfileComplete = Boolean(farmer.name?.trim() && farmer.village?.trim() && farmer.district?.trim() && farmer.phone);
  const hasPhoto = Boolean(farmer.photoUrl?.trim());
  const needsPhone = !farmer.phone;

  res.json({
    ok: true,
    data: {
      token: signToken({ sub: String(farmer._id), kind: 'farmer', phone: farmer.phone || '' }),
      isNew: Boolean(isNew || !isProfileComplete),
      isProfileComplete,
      hasPhoto,
      needsPhone,
      farmer: farmer.toJSON(),
    },
  });
});

/** GET /api/farmers/me */
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: req.farmer.toJSON() });
});

/** PUT /api/farmers/me */
export const updateProfile = asyncHandler(async (req, res) => {
  const payload = parse(profileSchema, req.body);

  if (payload.phone && payload.phone !== req.farmer.phone) {
    const existing = await Farmer.findOne({ phone: payload.phone });
    if (existing && String(existing._id) !== String(req.farmer._id)) {
      throw ApiError.badRequest('This mobile number is already registered to another farmer account');
    }
  }

  Object.assign(req.farmer, payload);
  await req.farmer.save();
  res.json({ ok: true, data: req.farmer.toJSON() });
});

/** PUT /api/farmers/me/push-token */
export const registerPushToken = asyncHandler(async (req, res) => {
  const { fcmToken } = parse(z.object({ fcmToken: z.string().min(10) }), req.body);
  req.farmer.fcmToken = fcmToken;
  await req.farmer.save();
  res.json({ ok: true, data: { registered: true } });
});

/** GET /api/farmers/public/announcements — public procurement notices & advisories */
export const getPublicAnnouncements = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: [
      {
        _id: 'notice-rabi-2026',
        title: '🌾 Rabi 2026-27 Procurement Open (रबी उपार्जन सक्रिय)',
        message: 'Official Government MSP procurement is live across all 18 Mandis. Wheat MSP: ₹2,425/Qtl, Mustard MSP: ₹5,950/Qtl. 20% instant DBT advance guaranteed within 2 hours of arrival.',
        type: 'general',
        phone: 'Portal',
        createdAt: new Date().toISOString(),
        read: false,
        isPublic: true,
      },
      {
        _id: 'notice-dbt-fastpay',
        title: '⚡ PFMS 2-Hour 20% DBT Advance (डीबीटी गारंटी)',
        message: 'Aadhaar-seeded bank accounts receive 20% produce value immediately upon digital weighment at Mandi weighbridge.',
        type: 'payment_advance',
        phone: 'PFMS-DBT',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        isPublic: true,
      },
      {
        _id: 'notice-slot-pass',
        title: '📱 Digital Gate Pass & SMS Token (डिजिटल गेट पास)',
        message: 'Book your time slot in advance to bypass highway tractor congestion. Show digital QR or SMS token at Mandi security entry.',
        type: 'booking_confirmed',
        phone: 'GatePass',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        read: false,
        isPublic: true,
      },
    ],
  });
});

/** GET /api/farmers/me/notifications */
export const getNotifications = asyncHandler(async (req, res) => {
  const farmerId = req.farmer._id;
  const phone = req.farmer.phone;
  const filter = phone ? { $or: [{ farmer: farmerId }, { phone }] } : { farmer: farmerId };

  let notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (notifications.length === 0) {
    try {
      const welcome = await Notification.create({
        farmer: farmerId,
        phone: phone || req.farmer.email || 'Portal',
        type: 'general',
        title: '🌾 Welcome to National e-Mandi Portal (ई-उपार्जन में स्वागत है)',
        message: `Namaste ${req.farmer.name || 'Kisan Bandhu'}! Your farmer portal dossier is verified for Rabi 2026-27. Book procurement slots across 18 Mandis and receive 20% instant DBT safety payouts directly to your Aadhaar-seeded bank account within 2 hours.`,
        data: { welcome: true },
        read: false,
      });
      notifications = [welcome.toObject()];
    } catch (err) {
      console.warn('Auto-seed notification warning:', err);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  res.json({
    ok: true,
    data: {
      notifications,
      unreadCount,
    },
  });
});

/** PATCH /api/farmers/me/notifications/read-all */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const farmerId = req.farmer._id;
  const phone = req.farmer.phone;
  const filter = phone ? { $or: [{ farmer: farmerId }, { phone }], read: false } : { farmer: farmerId, read: false };

  await Notification.updateMany(filter, { $set: { read: true } });

  res.json({ ok: true, data: { marked: true } });
});

/** PATCH /api/farmers/me/notifications/:id/read */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const farmerId = req.farmer._id;
  const phone = req.farmer.phone;
  const filter = phone
    ? { _id: req.params.id, $or: [{ farmer: farmerId }, { phone }] }
    : { _id: req.params.id, farmer: farmerId };

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ ok: true, data: notification });
});

