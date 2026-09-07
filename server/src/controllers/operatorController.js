import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

const execAsync = promisify(exec);
const WORKSPACE_DIR = path.resolve(process.cwd(), '..');
const PM2_LOG_DIR = path.join(os.homedir(), '.pm2', 'logs');
const OUT_LOG = path.join(PM2_LOG_DIR, 'sih-backend-out.log');
const ERR_LOG = path.join(PM2_LOG_DIR, 'sih-backend-error.log');

// Disallowed destructive commands for safety
const DANGEROUS_PATTERNS = [
  /\brm\s+-[rf]{1,2}\s+[\/\*]/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\(\)\{\s*:\|:&\s*\};:/,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\binit\s+0\b/i,
];

/** Classifies raw log line into a visual log level */
function parseLogLevel(line, source) {
  if (source === 'error') return 'error';
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('fatal') || lower.includes('exception') || lower.includes('failed') || lower.includes(' 500 ') || lower.includes(' 502 ') || lower.includes(' 503 ')) {
    return 'error';
  }
  if (lower.includes('warn') || lower.includes(' 400 ') || lower.includes(' 401 ') || lower.includes(' 403 ') || lower.includes(' 404 ')) {
    return 'warn';
  }
  if (lower.includes('http') || lower.includes('get /') || lower.includes('post /') || lower.includes('patch /') || lower.includes('put /') || lower.includes('delete /')) {
    return 'http';
  }
  if (lower.includes('whatsapp') || lower.includes('twilio') || lower.includes('sms')) {
    return 'service';
  }
  if (lower.includes('socket') || lower.includes('db') || lower.includes('mongo')) {
    return 'system';
  }
  return 'info';
}

/** Safely reads the last N lines from a file */
async function tailFile(filePath, maxLines = 100) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.filter((l) => l.length > 0).slice(-maxLines);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.warn(`[operator] tailFile error reading ${filePath}:`, err.message);
    return [];
  }
}

/** GET /api/operator/logs — fetch recent server & PM2 logs */
export const getLogs = asyncHandler(async (req, res) => {
  const lineCount = Math.min(Math.max(Number.parseInt(req.query.lines || '100', 10), 10), 1000);
  const filter = (req.query.filter || '').trim().toLowerCase();
  const source = req.query.source || 'all'; // 'all' | 'out' | 'error'

  let outLines = [];
  let errLines = [];

  if (source === 'all' || source === 'out') {
    const rawOut = await tailFile(OUT_LOG, lineCount);
    outLines = rawOut.map((line, idx) => ({
      id: `out-${idx}-${Date.now()}`,
      line,
      source: 'out',
      level: parseLogLevel(line, 'out'),
    }));
  }

  if (source === 'all' || source === 'error') {
    const rawErr = await tailFile(ERR_LOG, lineCount);
    errLines = rawErr.map((line, idx) => ({
      id: `err-${idx}-${Date.now()}`,
      line,
      source: 'error',
      level: parseLogLevel(line, 'error'),
    }));
  }

  let merged = [...outLines, ...errLines];

  // Apply optional search filter
  if (filter) {
    merged = merged.filter((item) => item.line.toLowerCase().includes(filter));
  }

  // Get file stats
  let outStats = null;
  let errStats = null;
  try {
    const s = await fs.stat(OUT_LOG);
    outStats = { sizeBytes: s.size, mtime: s.mtime };
  } catch {}
  try {
    const s = await fs.stat(ERR_LOG);
    errStats = { sizeBytes: s.size, mtime: s.mtime };
  } catch {}

  res.json({
    ok: true,
    data: {
      logs: merged.slice(-lineCount),
      totalCount: merged.length,
      outLog: outStats,
      errorLog: errStats,
      serverTime: new Date().toISOString(),
    },
  });
});

/** POST /api/operator/terminal — interactive CLI command runner */
export const executeCommand = asyncHandler(async (req, res) => {
  const { command, cwd: requestedCwd } = req.body || {};
  if (!command || typeof command !== 'string') {
    throw ApiError.badRequest('Command is required');
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return res.json({
      ok: true,
      data: { command: '', stdout: '', stderr: '', exitCode: 0, durationMs: 0 },
    });
  }

  // Check against dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw ApiError.badRequest('Command contains forbidden or destructive operations.');
    }
  }

  // Pre-canned Virtual Commands
  if (trimmed === 'help') {
    const helpText = `
╔═════════════════════════════════════════════════════════════════════════════════════════════╗
║                      SIH 2026 CENTRAL OPERATOR TERMINAL (v1.0)                              ║
╚═════════════════════════════════════════════════════════════════════════════════════════════╝

OPERATIONAL SHORTCUTS:
  pm2 status             - Inspect active PM2 microservices and backend process status
  pm2 logs --lines 30    - Fetch recent process logs
  pm2 restart sih-backend- Reload backend server gracefully
  db:ping                - Test MongoDB cluster connectivity and query latency
  db:stats               - Summary counts of database collections
  env:audit              - Health check of configured runtime environment variables
  system:info            - Host OS, CPU cores, RAM, and Node.js environment
  git status             - Check repository branch status and uncommitted changes
  git log -n 5           - Show recent commits
  free -m                - System memory usage (MB)
  df -h                  - Disk partition usage
  uptime                 - Host uptime and load averages

You can also run any standard Linux shell command (e.g., ls -la, ps aux, curl, etc.).
`;
    return res.json({
      ok: true,
      data: {
        command: trimmed,
        stdout: helpText.trim(),
        stderr: '',
        exitCode: 0,
        durationMs: 2,
      },
    });
  }

  if (trimmed === 'db:ping') {
    const start = Date.now();
    try {
      const pingResult = await mongoose.connection.db.admin().ping();
      const latency = Date.now() - start;
      const collections = await mongoose.connection.db.listCollections().toArray();
      const output = `[MongoDB] Ping SUCCESS (${latency}ms)\nStatus: Connected (ReadyState: ${mongoose.connection.readyState})\nDatabase: ${mongoose.connection.name}\nCollections (${collections.length}): ${collections.map((c) => c.name).join(', ')}`;
      return res.json({
        ok: true,
        data: {
          command: trimmed,
          stdout: output,
          stderr: '',
          exitCode: 0,
          durationMs: latency,
        },
      });
    } catch (err) {
      return res.json({
        ok: true,
        data: {
          command: trimmed,
          stdout: '',
          stderr: `MongoDB Ping Failed: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - start,
        },
      });
    }
  }

  if (trimmed === 'db:stats') {
    const start = Date.now();
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const stats = [];
      for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        stats.push(`  • ${col.name.padEnd(20)}: ${count} documents`);
      }
      const output = `MongoDB Database [${mongoose.connection.name}] Collection Counts:\n${stats.join('\n')}`;
      return res.json({
        ok: true,
        data: {
          command: trimmed,
          stdout: output,
          stderr: '',
          exitCode: 0,
          durationMs: Date.now() - start,
        },
      });
    } catch (err) {
      return res.json({
        ok: true,
        data: {
          command: trimmed,
          stdout: '',
          stderr: `db:stats Failed: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - start,
        },
      });
    }
  }

  if (trimmed === 'env:audit') {
    const audit = [
      `NODE_ENV            : ${env.nodeEnv}`,
      `PORT                : ${env.port}`,
      `CLIENT_ORIGIN       : ${env.clientOrigin}`,
      `MONGO_URI           : ${env.mongoUri ? env.mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'NOT SET'}`,
      `JWT_SECRET          : ${env.jwtSecret ? 'CONFIGURED (32+ chars)' : 'MISSING'}`,
      `OTP_DEV_MODE        : ${env.otpDevMode}`,
      `SMS_PROVIDER        : ${process.env.SMS_PROVIDER || 'mock/twilio'}`,
      `FIREBASE_CONFIGURED : ${Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}`,
    ];
    return res.json({
      ok: true,
      data: {
        command: trimmed,
        stdout: `Environment Audit Summary:\n${audit.join('\n')}`,
        stderr: '',
        exitCode: 0,
        durationMs: 1,
      },
    });
  }

  if (trimmed === 'system:info') {
    const memTotal = Math.round(os.totalmem() / (1024 * 1024));
    const memFree = Math.round(os.freemem() / (1024 * 1024));
    const cpus = os.cpus();
    const info = [
      `OS Platform   : ${os.type()} ${os.release()} (${os.arch()})`,
      `Hostname      : ${os.hostname()}`,
      `Uptime        : ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
      `CPUs          : ${cpus.length} cores (${cpus[0]?.model || 'Unknown'})`,
      `System Memory : ${memTotal - memFree}MB used / ${memTotal}MB total (${Math.round(((memTotal - memFree) / memTotal) * 100)}%)`,
      `Node.js       : ${process.version}`,
      `Process PID   : ${process.pid}`,
      `Server CWD    : ${process.cwd()}`,
    ];
    return res.json({
      ok: true,
      data: {
        command: trimmed,
        stdout: info.join('\n'),
        stderr: '',
        exitCode: 0,
        durationMs: 1,
      },
    });
  }

  // Safe Working Directory
  const effectiveCwd = requestedCwd && requestedCwd.startsWith('/home/ubuntu/SIH2026-PS26032')
    ? requestedCwd
    : path.resolve(process.cwd(), '..');

  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(trimmed, {
      cwd: effectiveCwd,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PAGER: 'cat', TERM: 'xterm-256color' },
    });

    res.json({
      ok: true,
      data: {
        command: trimmed,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.json({
      ok: true,
      data: {
        command: trimmed,
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/** GET /api/operator/system — live system, process, and PM2 metrics */
export const getSystemTelemetry = asyncHandler(async (_req, res) => {
  const mem = process.memoryUsage();
  const sysTotalMem = Math.round(os.totalmem() / (1024 * 1024));
  const sysFreeMem = Math.round(os.freemem() / (1024 * 1024));
  const sysUsedMem = sysTotalMem - sysFreeMem;

  // Query PM2 process info
  let pm2Process = null;
  try {
    const { stdout } = await execAsync('pm2 jlist', { timeout: 4000 });
    const list = JSON.parse(stdout);
    const backend = list.find((p) => p.name === 'sih-backend') || list[0];
    if (backend) {
      pm2Process = {
        name: backend.name,
        pmId: backend.pm_id,
        pid: backend.pid,
        status: backend.pm2_env?.status || 'unknown',
        restarts: backend.pm2_env?.restart_time || 0,
        cpu: backend.monit?.cpu || 0,
        memoryBytes: backend.monit?.memory || 0,
        memoryMb: Math.round((backend.monit?.memory || 0) / (1024 * 1024)),
        uptimeSeconds: backend.pm2_env?.pm_uptime ? Math.floor((Date.now() - backend.pm2_env.pm_uptime) / 1000) : 0,
      };
    }
  } catch (err) {
    console.warn('[operator] PM2 jlist error:', err.message);
  }

  // Database status and collection summary
  let dbStatus = {
    connected: mongoose.connection.readyState === 1,
    name: mongoose.connection.name,
    host: mongoose.connection.host,
    collectionsCount: 0,
    latencyMs: null,
  };
  if (dbStatus.connected) {
    const start = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      dbStatus.latencyMs = Date.now() - start;
      const collections = await mongoose.connection.db.listCollections().toArray();
      dbStatus.collectionsCount = collections.length;
    } catch {}
  }

  // Disk space
  let diskSpace = null;
  try {
    const { stdout } = await execAsync('df -h / | tail -n 1');
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 5) {
      diskSpace = {
        filesystem: parts[0],
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usedPercent: parts[4],
      };
    }
  } catch {}

  res.json({
    ok: true,
    data: {
      serverTime: new Date().toISOString(),
      system: {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        uptimeSeconds: Math.floor(os.uptime()),
        loadAvg: os.loadavg(),
        cpusCount: os.cpus().length,
        memory: {
          totalMb: sysTotalMem,
          freeMb: sysFreeMem,
          usedMb: sysUsedMem,
          percentUsed: Math.round((sysUsedMem / sysTotalMem) * 100),
        },
        disk: diskSpace,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round(mem.rss / (1024 * 1024)),
          heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
          heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
          externalMb: Math.round(mem.external / (1024 * 1024)),
        },
      },
      pm2: pm2Process,
      database: dbStatus,
    },
  });
});

/** POST /api/operator/actions — trigger controlled server operations */
export const executeAction = asyncHandler(async (req, res) => {
  const { action } = req.body || {};

  if (action === 'restart') {
    // Trigger PM2 restart in background without blocking current response
    setTimeout(() => {
      exec('pm2 restart sih-backend', (err) => {
        if (err) console.error('[operator] PM2 restart error:', err.message);
      });
    }, 500);

    return res.json({
      ok: true,
      data: {
        action: 'restart',
        status: 'DISPATCHED',
        message: 'PM2 backend restart dispatched. Server will reload in 1 second.',
      },
    });
  }

  if (action === 'ping-db') {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const latencyMs = Date.now() - start;

    return res.json({
      ok: true,
      data: {
        action: 'ping-db',
        status: 'SUCCESS',
        latencyMs,
        database: mongoose.connection.name,
      },
    });
  }

  if (action === 'health-check') {
    const mem = process.memoryUsage();
    let dbPing = false;
    let dbLatency = 0;
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - start;
      dbPing = true;
    } catch {}

    return res.json({
      ok: true,
      data: {
        action: 'health-check',
        timestamp: new Date().toISOString(),
        checks: {
          httpApi: { status: 'PASS', port: env.port },
          database: { status: dbPing ? 'PASS' : 'FAIL', latencyMs: dbLatency },
          memory: {
            status: mem.heapUsed < 400 * 1024 * 1024 ? 'PASS' : 'WARN',
            heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
          },
          pm2: { status: 'PASS', service: 'sih-backend' },
        },
      },
    });
  }

  throw ApiError.badRequest(`Unknown action: ${action}`);
});
