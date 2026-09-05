import twilio from 'twilio';
import { env } from '../config/env.js';
import Notification from '../models/Notification.js';
import Farmer from '../models/Farmer.js';
import { notifyFarmer } from './socketService.js';
import { sendWhatsAppMessage, isWhatsAppConnected } from './whatsappService.js';

const MSG91_ENDPOINT = 'https://api.msg91.com/api/v2/sendsms';

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = env.twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = env.twilio?.authToken || process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/** Formats an Indian mobile number to E.164 (+91XXXXXXXXXX) */
function toE164(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) return `+91${clean}`;
  if (clean.length === 12 && clean.startsWith('91')) return `+${clean}`;
  if (String(phone).startsWith('+')) return String(phone);
  return `+91${clean}`;
}

/**
 * Message templates. Kept short — SMS gateways bill per 160-character segment and
 * many farmers are on feature phones where long messages get split badly.
 */
export const templates = {
  otp: ({ code }) => `${code} is your OTP for the Procurement Queue portal. Valid for ${env.otpTtlMinutes} minutes. Do not share it.`,

  bookingConfirmed: ({ token, centerName, date, startTime }) =>
    `Slot booked. Token ${token} at ${centerName} on ${date}, ${startTime}. Reach 15 min early. Track live queue on the portal.`,

  bookingCancelled: ({ token, centerName, date }) =>
    `Your booking (token ${token}) at ${centerName} on ${date} has been cancelled.`,

  nearingTurn: ({ token, ahead, centerName }) =>
    `Token ${token}: ${ahead} farmer(s) ahead of you at ${centerName}. Please reach the centre now.`,

  yourTurn: ({ token, centerName }) => `Token ${token}: it is your turn at ${centerName}. Proceed to the weighing counter.`,

  procurementUpdate: ({ token, stage }) => `Token ${token}: procurement status updated to ${stage.toUpperCase()}.`,

  advancePaymentDone: ({ amount, advanceAmount, balanceAmount, paymentRef, token }) =>
    `Token ${token}: 20% safety advance of Rs ${advanceAmount} (Total: Rs ${amount}) credited to your account. Balance Rs ${balanceAmount}. Ref: ${paymentRef || 'see portal'}.`,

  paymentDone: ({ amount, paymentRef }) =>
    `Final payment of Rs ${amount} has been released. Reference: ${paymentRef || 'see portal'}. Thank you.`,

  paymentConfirmed: ({ token, amount, advanceAmount, balanceAmount, utrNumber }) =>
    `Token ${token}: DBT Payment of Rs ${amount} confirmed (Advance: Rs ${advanceAmount}, Final: Rs ${balanceAmount}). UTR: ${utrNumber}. Receipt available on portal.`,
};

/** Send SMS via Twilio API */
export async function sendViaTwilio(phone, message, templateKey = 'sms_order_confirmation') {
  const client = getTwilioClient();
  const to = toE164(phone);
  const from = env.twilio?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = env.twilio?.messagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!from && !messagingServiceSid) {
    throw new Error('Twilio sender (TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID) is not configured');
  }

  const payload = {
    to,
    body: message,
    ...(messagingServiceSid ? { messagingServiceSid } : { from }),
  };

  try {
    const response = await client.messages.create(payload);
    console.log(`[sms:twilio] -> ${to} | SID: ${response.sid} | Status: ${response.status}`);
    return { provider: 'twilio', sid: response.sid, status: response.status };
  } catch (err) {
    // If Twilio trial sandbox enforces predefined templates (error 572006)
    if (err.code === 572006 || String(err.message).includes('predefined SMS templates')) {
      console.warn(`[sms:twilio] Trial template restriction active. Retrying with predefined template '${templateKey}'...`);
      const fallbackResponse = await client.messages.create({
        to,
        body: templateKey,
        ...(messagingServiceSid ? { messagingServiceSid } : { from }),
      });
      console.log(`[sms:twilio:trial-template] -> ${to} | SID: ${fallbackResponse.sid} | Status: ${fallbackResponse.status}`);
      return { provider: 'twilio', sid: fallbackResponse.sid, status: fallbackResponse.status, trialTemplate: templateKey };
    }
    throw err;
  }
}

async function sendViaMsg91(phone, message) {
  if (!env.msg91.authKey) throw new Error('MSG91_AUTH_KEY is not configured');

  const res = await fetch(MSG91_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: env.msg91.authKey },
    body: JSON.stringify({
      sender: env.msg91.senderId,
      route: env.msg91.route,
      country: '91',
      ...(env.msg91.dltTeId ? { DLT_TE_ID: env.msg91.dltTeId } : {}),
      sms: [{ message, to: [phone] }],
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`MSG91 responded ${res.status}: ${body}`);
  return { provider: 'msg91', response: body };
}

/** Send real cellular SMS via self-hosted Android SMS Gateway (capcom6/android-sms-gateway) */
export async function sendViaAndroidGateway(phone, message) {
  const url = env.androidSms?.url || process.env.ANDROID_SMS_URL;
  const login = env.androidSms?.login || process.env.ANDROID_SMS_LOGIN;
  const password = env.androidSms?.password || process.env.ANDROID_SMS_PASSWORD;

  if (!url) {
    throw new Error('ANDROID_SMS_URL is not configured in server/.env');
  }

  const cleanPhone = toE164(phone);
  const auth = login && password ? 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64') : null;

  const payload = {
    message,
    phoneNumbers: [cleanPhone],
  };

  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Android SMS Gateway responded ${res.status}: ${bodyText}`);
  }

  console.log(`[sms:android-gateway] -> ${cleanPhone} | status: ${res.status}`);
  return { provider: 'android-gateway', ok: true, response: bodyText };
}

function sendViaConsole(phone, message) {
  console.log(`[sms:console] -> +91${phone}: ${message}`);
  return { provider: 'console' };
}

/**
 * Sends an SMS. Delivery failures are logged and swallowed: a farmer must never
 * lose their slot or payment because the SMS gateway was down.
 */
export async function sendSMS(phone, message) {
  try {
    if (env.smsProvider === 'android-gateway') {
      try {
        return await sendViaAndroidGateway(phone, message);
      } catch (gwErr) {
        console.error(`[sms:android-gateway] delivery to ${toE164(phone)} failed: ${gwErr.message}. Fallback to console.`);
        sendViaConsole(phone, message);
        return { provider: 'android-gateway', error: gwErr.message, fallback: 'console' };
      }
    }
    if (env.smsProvider === 'twilio') {
      try {
        return await sendViaTwilio(phone, message);
      } catch (twilioErr) {
        console.error(`[sms:twilio] delivery to ${toE164(phone)} failed: ${twilioErr.message}. Fallback to console.`);
        sendViaConsole(phone, message);
        return { provider: 'twilio', error: twilioErr.message, fallback: 'console' };
      }
    }
    if (env.smsProvider === 'msg91') return await sendViaMsg91(phone, message);
    return sendViaConsole(phone, message);
  } catch (err) {
    console.error(`[sms] delivery to ${phone} failed: ${err.message}`);
    return { provider: env.smsProvider, error: err.message };
  }
}

const TEMPLATE_METADATA = {
  otp: { title: '🔐 Verification Code (OTP)', type: 'sms' },
  bookingConfirmed: { title: '📅 Mandi Slot Booking Confirmed', type: 'booking_confirmed' },
  bookingCancelled: { title: '❌ Mandi Slot Cancelled', type: 'booking_cancelled' },
  nearingTurn: { title: '🔔 Turn Approaching Notice', type: 'queue_alert' },
  yourTurn: { title: '📢 Your Turn — Proceed to Counter', type: 'queue_alert' },
  procurementUpdate: { title: '📋 Procurement Status Update', type: 'general' },
  advancePaymentDone: { title: '💰 20% DBT Safety Advance Credited', type: 'payment_advance' },
  paymentDone: { title: '🌾 80% Final DBT Settlement Released', type: 'payment_balance' },
  paymentConfirmed: { title: '🏛️ DBT Payment Confirmation & UTR Slip', type: 'payment_confirmed' },
};

function buildWhatsAppMessage(templateName, meta, message, data = {}) {
  const base = `🌾 *e-Mandi Govt Procurement Portal*\n`;
  const portalUrl = 'https://sih-32.vercel.app/status';

  switch (templateName) {
    case 'bookingConfirmed':
      return (
        `${base}📅 *Mandi Slot Booking Confirmed!*\n\n` +
        `• *Token Number:* #${data.token || '1'}\n` +
        `• *Mandi Centre:* ${data.centerName || 'Central Agri Mandi'}\n` +
        `• *Date & Time:* ${data.date || 'Today'}, ${data.startTime || '09:00 AM'}\n\n` +
        `_Please arrive 15 minutes before your slot with your produce._\n\n` +
        `📍 *Track Live Queue:* https://sih-32.vercel.app/queue`
      );

    case 'advancePaymentDone':
      return (
        `${base}💰 *20% DBT Safety Advance Credited!*\n\n` +
        `• *Token Number:* #${data.token || '1'}\n` +
        `• *Advance Credited:* ₹${data.advanceAmount || '4,406'}\n` +
        `• *Total MSP Value:* ₹${data.amount || '22,030'}\n` +
        `• *Balance Remaining:* ₹${data.balanceAmount || '17,624'}\n` +
        `• *Transaction Ref / UTR:* ${data.paymentRef || 'ADV-CONFIRMED'}\n\n` +
        `📄 *View Official DBT Voucher:* ${portalUrl}`
      );

    case 'paymentDone':
    case 'paymentConfirmed':
      return (
        `${base}🌾 *Final DBT Settlement Released!*\n\n` +
        `• *Token Number:* #${data.token || '1'}\n` +
        `• *Settlement Amount:* ₹${data.amount || data.balanceAmount || '17,624'}\n` +
        `• *UTR Reference:* ${data.utrNumber || data.paymentRef || 'SETTLE-CONFIRMED'}\n\n` +
        `📄 *Download Full Mandi Receipt:* ${portalUrl}`
      );

    case 'procurementUpdate':
      return (
        `${base}📋 *Delivery & Procurement Stage Update*\n\n` +
        `• *Token Number:* #${data.token || '1'}\n` +
        `• *Current Stage:* *${String(data.stage || 'INSPECTION').toUpperCase()}*\n\n` +
        `Track live status: ${portalUrl}`
      );

    case 'yourTurn':
      return (
        `${base}📢 *Your Turn — Proceed to Counter*\n\n` +
        `Token #${data.token}: Please proceed to the weighing & quality testing counter at ${data.centerName || 'the mandi centre'}.`
      );

    case 'nearingTurn':
      return (
        `${base}🔔 *Turn Approaching Notice*\n\n` +
        `Token #${data.token}: Only ${data.ahead || 1} farmer(s) ahead of you at ${data.centerName || 'the mandi centre'}. Please be ready near the gate.`
      );

    default:
      return `${base}*${meta.title}*\n\n${message}\n\n📄 *Track Status:* ${portalUrl}`;
  }
}

export async function sendTemplate(phone, templateName, data = {}) {
  const build = templates[templateName];
  if (!build) throw new Error(`Unknown SMS template '${templateName}'`);
  const message = build(data);

  // Clean 10-digit phone for database lookup
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const meta = TEMPLATE_METADATA[templateName] || { title: 'e-Procurement Alert', type: 'sms' };

  // 1. Always persist digital SMS receipt in DB and push real-time in-app alert
  try {
    const farmer = await Farmer.findOne({ phone: cleanPhone });
    const notification = await Notification.create({
      farmer: farmer?._id || null,
      phone: cleanPhone,
      type: meta.type,
      title: meta.title,
      message,
      data: { ...data, template: templateName },
      provider: env.smsProvider,
    });

    if (farmer) {
      notifyFarmer(String(farmer._id), 'notification', {
        id: String(notification._id),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
      });

      if (templateName === 'advancePaymentDone') {
        notifyFarmer(String(farmer._id), 'payment:advance', {
          token: data.token,
          advanceAmount: data.advanceAmount,
          amount: data.amount,
          balanceAmount: data.balanceAmount,
          paymentRef: data.paymentRef,
        });
      }
    }
  } catch (err) {
    console.warn('[sms] In-app notification persistence error:', err.message);
  }

  // 2. Dispatch via WhatsApp for Payment and Delivery Status (and booking)
  const isPaymentOrDelivery = [
    'advancePaymentDone',
    'paymentDone',
    'paymentConfirmed',
    'procurementUpdate',
    'yourTurn',
    'nearingTurn',
    'bookingConfirmed',
  ].includes(templateName);

  if (isPaymentOrDelivery && isWhatsAppConnected()) {
    const waText = buildWhatsAppMessage(templateName, meta, message, data);
    sendWhatsAppMessage(phone, waText).catch((err) => {
      console.warn('[whatsapp] dispatch error:', err.message);
    });
  }

  // 3. For Order/Slot Confirmation: Dispatch carrier SMS via Twilio using order confirmation template
  if (templateName === 'bookingConfirmed' || templateName === 'bookingCancelled') {
    return sendSMS(phone, message);
  }

  // If SMS provider is not Twilio (e.g. android-gateway or console), also send SMS for other templates
  if (env.smsProvider !== 'twilio') {
    return sendSMS(phone, message);
  }

  // For Twilio: Payment & delivery status are routed via WhatsApp (saving trial quota & avoiding template restriction)
  console.log(`[sms:route] '${templateName}' handled via WhatsApp & In-App notification`);
  return { provider: 'whatsapp', handled: true };
}
