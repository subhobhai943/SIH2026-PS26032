import dotenv from 'dotenv';

dotenv.config();

const bool = (value, fallback) =>
  value === undefined ? fallback : ['1', 'true', 'yes'].includes(String(value).toLowerCase());

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',

  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sih26032',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 5),
  otpDevMode: bool(process.env.OTP_DEV_MODE, true),

  smsProvider: process.env.SMS_PROVIDER || 'console',
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || '',
    senderId: process.env.MSG91_SENDER_ID || 'SIHPRC',
    route: process.env.MSG91_ROUTE || '4',
    dltTeId: process.env.MSG91_DLT_TE_ID || '',
  },

  defaultServiceMinutes: Number(process.env.DEFAULT_SERVICE_MINUTES || 12),
};

export const isProd = env.nodeEnv === 'production';
