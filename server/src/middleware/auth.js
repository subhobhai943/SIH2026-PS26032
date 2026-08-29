import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import Farmer from '../models/Farmer.js';
import Staff from '../models/Staff.js';

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** Requires a valid farmer token; attaches `req.farmer`. */
export const requireFarmer = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw ApiError.unauthorized();

  const payload = verifyToken(token);
  if (payload.kind !== 'farmer') throw ApiError.forbidden('Farmer account required');

  const farmer = await Farmer.findById(payload.sub);
  if (!farmer) throw ApiError.unauthorized('Account no longer exists');

  req.farmer = farmer;
  next();
});

/** Requires a valid staff token; attaches `req.staff`. Pass roles to restrict further. */
export function requireStaff(...roles) {
  return asyncHandler(async (req, _res, next) => {
    const token = bearerToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyToken(token);
    if (payload.kind !== 'staff') throw ApiError.forbidden('Staff account required');

    const staff = await Staff.findById(payload.sub);
    if (!staff || !staff.isActive) throw ApiError.unauthorized('Account is inactive');
    if (roles.length && !roles.includes(staff.role)) throw ApiError.forbidden('Insufficient role');

    req.staff = staff;
    next();
  });
}

/**
 * Operators are pinned to their own centre; admins may act on any centre.
 * Returns the centre id the request is allowed to operate on.
 */
export function resolveCenterScope(staff, requestedCenterId) {
  if (staff.role === 'admin') {
    if (!requestedCenterId) throw ApiError.badRequest('centerId is required for admin users');
    return String(requestedCenterId);
  }
  if (!staff.center) throw ApiError.forbidden('No centre assigned to this account');
  if (requestedCenterId && String(requestedCenterId) !== String(staff.center)) {
    throw ApiError.forbidden('You can only manage your own centre');
  }
  return String(staff.center);
}
