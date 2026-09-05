import { Router } from 'express';
import { getWhatsAppStatus, sendWhatsAppMessage, isWhatsAppConnected, getPairingCode } from '../services/whatsappService.js';

const router = Router();

// Pairing Code endpoint (Link with phone number directly without camera!)
router.get('/pair', async (req, res) => {
  const status = getWhatsAppStatus();
  if (status.connected) {
    return res.redirect('/api/whatsapp/qr');
  }

  const phone = req.query.phone || '8167561808';
  try {
    const code = await getPairingCode(phone);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pair WhatsApp via Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; padding: 32px; border-radius: 24px; max-width: 440px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 1px solid #334155; }
          h1 { color: #f8fafc; font-size: 22px; margin-top: 0; }
          .code-box { background: #0f172a; border: 2px solid #10b981; border-radius: 16px; padding: 18px; font-size: 28px; font-weight: 900; letter-spacing: 4px; color: #34d399; margin: 20px 0; user-select: all; font-family: monospace; }
          .steps { text-align: left; background: #0f172a; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
          ol { margin: 0; padding-left: 20px; }
          .btn-alt { display: inline-block; margin-top: 18px; color: #38bdf8; font-size: 13px; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🌾 WhatsApp Pairing Code</h1>
          <p style="color: #94a3b8; font-size: 13px;">Phone: <strong>+91 ${phone}</strong></p>
          <div class="code-box">${code}</div>
          <div class="steps">
            <ol>
              <li>Open <strong>WhatsApp</strong> on your phone</li>
              <li>Go to <strong>Settings ➔ Linked Devices</strong></li>
              <li>Tap <strong>Link a Device</strong></li>
              <li>Tap <strong>"Link with phone number instead"</strong> at the bottom</li>
              <li>Enter the 8-digit code shown above</li>
            </ol>
          </div>
          <a href="/api/whatsapp/qr" class="btn-alt">Or scan QR code instead ➔</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <body style="background:#0f172a;color:white;font-family:sans-serif;padding:40px;text-align:center;">
        <h3>Could not generate pairing code right now: ${err.message}</h3>
        <p><a href="/api/whatsapp/qr" style="color:#38bdf8;">Click here to scan QR code instead</a></p>
      </body>
    `);
  }
});

router.post('/pairing-code', async (req, res) => {
  const phone = req.body.phone || '8167561808';
  try {
    const code = await getPairingCode(phone);
    res.json({ ok: true, code, phone });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// HTML page displaying the QR code for instant phone camera scanning
router.get('/qr', (req, res) => {
  const status = getWhatsAppStatus();

  if (status.connected) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - Connected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; padding: 32px; border-radius: 24px; max-width: 440px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 2px solid #10b981; }
          h1 { color: #10b981; font-size: 24px; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 6px 14px; border-radius: 9999px; font-weight: bold; font-size: 12px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">ONLINE & PAIRED</div>
          <h1>✅ WhatsApp Bot Active</h1>
          <p>The e-Mandi WhatsApp service is paired and ready. All payment receipts, token slots, and notifications will be delivered instantly to farmers via WhatsApp.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (status.qrDataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Link e-Mandi WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="7">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; padding: 32px; border-radius: 24px; max-width: 420px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 1px solid #334155; }
          h1 { color: #f8fafc; font-size: 22px; margin-top: 0; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 20px; }
          .qr-box { background: white; padding: 16px; border-radius: 20px; display: inline-block; margin: 10px 0; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
          .qr-box img { display: block; width: 280px; height: 280px; }
          .steps { text-align: left; background: #0f172a; border-radius: 12px; padding: 14px 18px; margin-top: 20px; font-size: 12px; color: #cbd5e1; }
          .steps ol { margin: 0; padding-left: 20px; }
          .steps li { margin-bottom: 6px; }
          .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #eab308; margin-right: 6px; animation: blink 1.5s infinite; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🌾 Pair WhatsApp Bot</h1>
          <p><span class="pulse"></span>Scan the QR code below to connect the bot</p>
          <div class="qr-box">
            <img src="${status.qrDataUrl}" alt="WhatsApp Pairing QR Code" />
          </div>
          <div class="steps">
            <ol>
              <li>Open <strong>WhatsApp</strong> on your phone</li>
              <li>Tap <strong>Settings (or ⋮)</strong> ➔ <strong>Linked Devices</strong></li>
              <li>Tap <strong>Link a device</strong> and point camera at this screen</li>
            </ol>
          </div>
          <p style="font-size: 11px; color: #64748b; margin-top: 14px;">This QR refreshes automatically every few seconds.</p>
        </div>
      </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generating QR...</title>
      <meta http-equiv="refresh" content="3">
      <style>
        body { font-family: sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      </style>
    </head>
    <body>
      <p>⏳ Starting WhatsApp Bot service, please wait 3 seconds...</p>
    </body>
    </html>
  `);
});

// JSON Status endpoint
router.get('/status', (req, res) => {
  const status = getWhatsAppStatus();
  res.json({
    connected: status.connected,
    hasQr: status.hasQr,
  });
});

export default router;

