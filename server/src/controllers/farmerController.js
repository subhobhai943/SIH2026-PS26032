import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env.js';
import Farmer from '../models/Farmer.js';
import Otp from '../models/Otp.js';
import { signToken } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { sendTemplate } from '../services/smsService.js';
import { verifyFirebaseToken } from '../config/firebase.js';

const MAX_OTP_ATTEMPTS = 5;

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const requestOtpSchema = z.object({ phone: phoneSchema });

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const profileSchema = z.object({
  name: z.string().min(2).max(80),
  village: z.string().min(2).max(80),
  district: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  photoUrl: z.string().optional(),
  aadhaarLast4: z.string().regex(/^\d{4}$/).optional(),
  crops: z.array(z.string().min(1)).max(10).optional(),
  landAreaAcres: z.number().min(0).max(10_000).optional(),
  preferredLanguage: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr']).optional(),
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

/** GET /api/farmers/me */
export const getProfile = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: req.farmer.toJSON() });
});

/** PUT /api/farmers/me */
export const updateProfile = asyncHandler(async (req, res) => {
  const payload = parse(profileSchema, req.body);
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
