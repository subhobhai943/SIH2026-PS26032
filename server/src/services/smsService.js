import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env } from '../config/env.js';

const MSG91_ENDPOINT = 'https://api.msg91.com/api/v2/sendsms';

let snsClient = null;

function getSnsClient() {
  if (!snsClient) {
    if (!env.aws.accessKeyId || !env.aws.secretAccessKey) {
      throw new Error('AWS credentials (accessKeyId, secretAccessKey) are not configured');
    }
    snsClient = new SNSClient({
      region: env.aws.region || 'eu-north-1',
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey,
      },
    });
  }
  return snsClient;
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

/** Send SMS via AWS SNS */
async function sendViaAwsSns(phone, message) {
  const client = getSnsClient();
  const phoneNumber = toE164(phone);

  const command = new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'SIHPRC',
      },
    },
  });

  const response = await client.send(command);
  console.log(`[sms:aws-sns] -> ${phoneNumber} | MessageId: ${response.MessageId}`);
  return { provider: 'sns', messageId: response.MessageId };
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
    if (env.smsProvider === 'sns') {
      try {
        return await sendViaAwsSns(phone, message);
      } catch (snsErr) {
        console.error(`[sms:aws-sns] delivery to +91${phone} failed: ${snsErr.message}. Fallback to console.`);
        sendViaConsole(phone, message);
        return { provider: 'sns', error: snsErr.message, fallback: 'console' };
      }
    }
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
