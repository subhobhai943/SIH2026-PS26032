import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import qrcode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../sessions/whatsapp_auth');

let sock = null;
let isConnected = false;
let currentQrRaw = null;
let currentQrDataUrl = null;
let isInitializing = false;

/** Formats phone number to WhatsApp JID (e.g., 918167561808@s.whatsapp.net) */
export function toWhatsAppJid(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) return `91${clean}@s.whatsapp.net`;
  if (clean.length === 12 && clean.startsWith('91')) return `${clean}@s.whatsapp.net`;
  return `${clean}@s.whatsapp.net`;
}

export function isWhatsAppConnected() {
  return isConnected && sock !== null;
}

export function getWhatsAppStatus() {
  return {
    connected: isConnected,
    hasQr: Boolean(currentQrDataUrl),
    qrDataUrl: currentQrDataUrl,
    qrRaw: currentQrRaw,
  };
}

export async function getPairingCode(phone) {
  if (!sock) {
    await initWhatsApp();
  }
  const cleanPhone = String(phone).replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const code = await sock.requestPairingCode(fullPhone);
  console.log(`[whatsapp] Generated pairing code for ${fullPhone}: ${code}`);
  return code;
}

export async function initWhatsApp() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['e-Mandi Govt Portal', 'Chrome', '124.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrRaw = qr;
        try {
          currentQrDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 8 });
        } catch (_) {}

        console.log('\n======================================================');
        console.log('🌾 e-Mandi WhatsApp Bot Pairing QR Code:');
        console.log('Scan with WhatsApp (Settings -> Linked Devices -> Link a device)');
        console.log('======================================================\n');
        qrcodeTerminal.generate(qr, { small: true });
        console.log('\nTip: You can also view this QR in your browser at: /api/whatsapp/qr\n');
      }

      if (connection === 'open') {
        isConnected = true;
        currentQrRaw = null;
        currentQrDataUrl = null;
        console.log('✅ [whatsapp] WhatsApp Bot connected successfully!');
      }

      if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[whatsapp] Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.warn('[whatsapp] Logged out from WhatsApp. Resetting session...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (_) {}
          currentQrRaw = null;
          currentQrDataUrl = null;
        }

        if (shouldReconnect) {
          setTimeout(() => {
            isInitializing = false;
            initWhatsApp();
          }, 4000);
        } else {
          isInitializing = false;
        }
      }
    });

    // Auto-responder for incoming WhatsApp messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const m = messages[0];
      if (!m || m.key.fromMe || !m.message) return;

      const senderJid = m.key.remoteJid;
      if (!senderJid || senderJid.endsWith('@g.us')) return; // Ignore groups

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        '';

      const lower = text.trim().toLowerCase();
      console.log(`[whatsapp] Received message from ${senderJid}: "${text}"`);

      // Simple, professional e-Mandi auto-reply
      if (['hi', 'hello', 'namaste', 'status', 'help', 'start'].includes(lower)) {
        await sock.sendMessage(senderJid, {
          text:
            `🌾 *Government e-Mandi Procurement Portal*\n\n` +
            `Namaste!\n` +
            `This is the official procurement notification assistant.\n\n` +
            `• *Check Slot & DBT Receipts:* https://sih-32.vercel.app/status\n` +
            `• *Live Mandi Queue Status:* https://sih-32.vercel.app/queue\n` +
            `• *Farmer Helpline:* 1800-180-1551 (Toll Free)\n\n` +
            `_You will automatically receive your slot tokens and 20% DBT advance receipts here._`,
        });
      }
    });

    isInitializing = false;
  } catch (err) {
    console.error('[whatsapp] Initialization error:', err.message);
    isInitializing = false;
    setTimeout(() => initWhatsApp(), 5000);
  }
}

/**
 * Sends a WhatsApp message to any phone number.
 */
export async function sendWhatsAppMessage(phone, message) {
  if (!sock || !isConnected) {
    console.warn(`[whatsapp] Cannot send to ${phone}: WhatsApp bot not connected`);
    return { provider: 'whatsapp', ok: false, error: 'not_connected' };
  }

  const jid = toWhatsAppJid(phone);
  try {
    const res = await sock.sendMessage(jid, { text: message });
    console.log(`[whatsapp] -> ${jid} sent successfully (id: ${res.key?.id})`);
    return { provider: 'whatsapp', ok: true, id: res.key?.id };
  } catch (err) {
    console.error(`[whatsapp] Failed to send to ${jid}:`, err.message);
    return { provider: 'whatsapp', ok: false, error: err.message };
  }
}
