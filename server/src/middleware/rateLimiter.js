import rateLimit from 'express-rate-limit';

// Telemetry counters
let totalRequests = 0;
let rateLimitBlocks = 0;
const monitoredIPs = new Set();

const rateLimitHandler = (message, code = 'RATE_LIMIT_EXCEEDED') => (req, res, _next, options) => {
  rateLimitBlocks += 1;
  const retryAfter = Math.ceil(options.windowMs / 1000);
  res.status(options.statusCode).json({
    ok: false,
    error: {
      message,
      code,
      retryAfterSeconds: retryAfter,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    },
  });
};

/** Global API Rate Limiter — 500 req/min */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many requests. Please slow down and try again shortly.'),
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});

/** Admin Login Brute-Force Limiter — 20 attempts / 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many login attempts from this IP address. Please wait 15 minutes before trying again.',
    'AUTH_RATE_LIMIT_EXCEEDED'
  ),
});

/** Farmer OTP Flood Limiter — 10 requests / 10 min */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many OTP requests. Please wait a few minutes before requesting another code.',
    'OTP_RATE_LIMIT_EXCEEDED'
  ),
});

/** Slot Booking Limiter — 60 req/min */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('Too many slot booking requests. Please wait a moment.'),
});

/** Middleware to track live traffic metrics for the Admin Dashboard */
export function trafficMonitorMiddleware(req, _res, next) {
  totalRequests += 1;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  if (ip) monitoredIPs.add(String(ip));
  next();
}

/** Returns live telemetry data for the admin system monitor */
export function getRateLimitMetrics() {
  return {
    totalRequests,
    rateLimitBlocks,
    activeUniqueIPs: monitoredIPs.size,
    limitsConfig: {
      global: '500 req/min',
      auth: '25 attempts / 15 min',
      otp: '15 requests / 10 min',
      booking: '60 req/min',
    },
  };
}
