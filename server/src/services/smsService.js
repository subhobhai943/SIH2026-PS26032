import { env } from '../config/env.js';

const MSG91_ENDPOINT = 'https://api.msg91.com/api/v2/sendsms';

/**
 * Message templates. Kept short — MSG91 bills per 160-character segment and
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
};

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

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';

async function sendViaFast2sms(phone, message) {
  if (!env.fast2sms.apiKey) throw new Error('FAST2SMS_API_KEY is not configured');

  // Use the 'q' (quick/transactional) route — works without DLT or website verification.
  const res = await fetch(FAST2SMS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: env.fast2sms.apiKey,
    },
    body: JSON.stringify({
      route: 'q',
      message,
      flash: 0,
      numbers: phone,
    }),
  });

  const body = await res.json();

  if (!res.ok || body.return === false) {
    throw new Error(`Fast2SMS responded ${res.status}: ${JSON.stringify(body)}`);
  }

  console.log(`[sms] Fast2SMS sent to +91${phone}`);
  return { provider: 'fast2sms', response: body };
}

function sendViaConsole(phone, message) {
  console.log(`[sms] -> +91${phone}: ${message}`);
  return { provider: 'console' };
}

/**
 * Sends an SMS. Delivery failures are logged and swallowed: a farmer must never
 * lose their slot because the SMS gateway was down.
 */
export async function sendSMS(phone, message) {
  try {
    if (env.smsProvider === 'fast2sms') return await sendViaFast2sms(phone, message);
    if (env.smsProvider === 'msg91') return await sendViaMsg91(phone, message);
    return sendViaConsole(phone, message);
  } catch (err) {
    console.error(`[sms] delivery to +91${phone} failed: ${err.message}`);
    return { provider: env.smsProvider, error: err.message };
  }
}

export function sendTemplate(phone, templateName, data) {
  const build = templates[templateName];
  if (!build) throw new Error(`Unknown SMS template '${templateName}'`);
  return sendSMS(phone, build(data));
}
