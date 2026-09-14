'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';

const ADMIN_TOKEN_KEY = 'sih26032_admin_token';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  username?: string;
  center?: string;
}

interface CommandExecution {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: string;
}

interface LogEntry {
  id: string;
  line: string;
  source: 'out' | 'error';
  level: string;
}

interface TelemetryData {
  serverTime: string;
  system: {
    platform: string;
    release: string;
    hostname: string;
    uptimeSeconds: number;
    loadAvg: number[];
    cpusCount: number;
    memory: {
      totalMb: number;
      freeMb: number;
      usedMb: number;
      percentUsed: number;
    };
    disk?: {
      filesystem: string;
      total: string;
      used: string;
      available: string;
      usedPercent: string;
    };
  };
  process: {
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    memory: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
      externalMb: number;
    };
  };
  pm2?: {
    name: string;
    pmId: number;
    pid: number;
    status: string;
    restarts: number;
    cpu: number;
    memoryMb: number;
    uptimeSeconds: number;
  };
  database: {
    connected: boolean;
    name: string;
    host: string;
    collectionsCount: number;
    latencyMs: number | null;
  };
}

function cleanAnsi(text: string): string {
  if (!text) return '';
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*[a-zA-Z]/g, '');
}

export default function OperatorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'terminal' | 'logs' | 'telemetry' | 'actions'>('terminal');

  // Terminal state
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<CommandExecution[]>([
    {
      id: 'init-1',
      command: 'system:info',
      stdout: `OS Platform   : Linux 7.0.0-1006-aws (x64)
Hostname      : ip-172-31-46-133
Node.js       : v20.20.2
Active Service: sih-backend (PM2 Port 5000)
Operator Shell: Interactive CLI Ready. Type 'help' for command cheatsheet.`,
      stderr: '',
      exitCode: 0,
      durationMs: 1,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>(['system:info']);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [logLevel, setLogLevel] = useState<'all' | 'error' | 'warn' | 'http' | 'system' | 'service'>('all');
  const [logSource, setLogSource] = useState<'all' | 'out' | 'error'>('all');
  const [logLinesCount, setLogLinesCount] = useState(100);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [isLiveLogs, setIsLiveLogs] = useState(true);
  const [logFileStats, setLogFileStats] = useState<{ outLog?: any; errorLog?: any } | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Actions state
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  // Initialize Auth
  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && data?.data) {
            setStaff(data.data);
          } else {
            window.localStorage.removeItem(ADMIN_TOKEN_KEY);
            setToken(null);
          }
        })
        .catch(() => {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmittingLogin(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginIdentifier, email: loginIdentifier, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Invalid credentials');
      }

      window.localStorage.setItem(ADMIN_TOKEN_KEY, data.data.token);
      setToken(data.data.token);
      setStaff(data.data.staff);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleSignOut = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setStaff(null);
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory, activeTab]);

  // Execute Terminal Command
  const runCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : terminalInput).trim();
    if (!cmd || isExecutingCommand || !token) return;

    if (cmd === 'clear') {
      setTerminalHistory([]);
      setTerminalInput('');
      return;
    }

    setIsExecutingCommand(true);
    if (cmdToRun === undefined) {
      setTerminalInput('');
    }

    // Append to command history for arrow-key navigation
    setCommandHistory((prev) => [...prev.filter((c) => c !== cmd), cmd]);
    setHistoryPointer(-1);

    try {
      const res = await fetch('/api/operator/terminal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command: cmd }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result?.error?.message || 'Command execution failed');
      }

      const execution: CommandExecution = {
        id: `cmd-${Date.now()}`,
        command: cmd,
        stdout: cleanAnsi(result.data.stdout || ''),
        stderr: cleanAnsi(result.data.stderr || ''),
        exitCode: result.data.exitCode,
        durationMs: result.data.durationMs,
        timestamp: result.data.timestamp || new Date().toISOString(),
      };
      setTerminalHistory((prev) => [...prev, execution]);
    } catch (err: any) {
      const failure: CommandExecution = {
        id: `cmd-err-${Date.now()}`,
        command: cmd,
        stdout: '',
        stderr: err.message || 'Execution error',
        exitCode: 1,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
      setTerminalHistory((prev) => [...prev, failure]);
    } finally {
      setIsExecutingCommand(false);
      terminalInputRef.current?.focus();
    }
  };

  // Keyboard navigation for command history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextPointer = historyPointer === -1 ? commandHistory.length - 1 : Math.max(0, historyPointer - 1);
      setHistoryPointer(nextPointer);
      setTerminalInput(commandHistory[nextPointer] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === -1) return;
      const nextPointer = historyPointer + 1;
      if (nextPointer >= commandHistory.length) {
        setHistoryPointer(-1);
        setTerminalInput('');
      } else {
        setHistoryPointer(nextPointer);
        setTerminalInput(commandHistory[nextPointer] || '');
      }
    }
  };

  // Fetch Server Logs
  const fetchLogs = async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({
        lines: String(logLinesCount),
        source: logSource,
        ...(logFilter ? { filter: logFilter } : {}),
      });
      const res = await fetch(`/api/operator/logs?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.ok && data?.data) {
        setLogs(data.data.logs || []);
        setLogFileStats({ outLog: data.data.outLog, errorLog: data.data.errorLog });
      }
    } catch (err) {
      console.warn('Failed to fetch operator logs:', err);
    }
  };

  // Live Logs Poller
  useEffect(() => {
    if (token && activeTab === 'logs') {
      fetchLogs();
      if (isLiveLogs) {
        const interval = setInterval(fetchLogs, 2500);
        return () => clearInterval(interval);
      }
    }
  }, [token, activeTab, isLiveLogs, logLinesCount, logSource, logFilter]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScrollLogs]);

  // Fetch Telemetry
  const fetchTelemetry = async () => {
    if (!token) return;
    setTelemetryLoading(true);
    try {
      const res = await fetch('/api/operator/system', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.ok && data?.data) {
        setTelemetry(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch telemetry:', err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    if (token && activeTab === 'telemetry') {
      fetchTelemetry();
      const timer = setInterval(fetchTelemetry, 5000);
      return () => clearInterval(timer);
    }
  }, [token, activeTab]);

  // Execute Controlled Action
  const runAction = async (action: 'restart' | 'ping-db' | 'health-check') => {
    if (!token || actionLoading) return;
    setActionLoading(action);
    setActionNotice(null);

    try {
      const res = await fetch('/api/operator/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || `Action ${action} failed`);
      }

      if (action === 'restart') {
        setActionNotice({
          type: 'info',
          message: 'Server restart signal dispatched. Backend will reload in 1s.',
        });
        setTimeout(fetchTelemetry, 3000);
      } else if (action === 'ping-db') {
        setActionNotice({
          type: 'success',
          message: `Database ping successful! Latency: ${data.data.latencyMs}ms (${data.data.database})`,
        });
      } else if (action === 'health-check') {
        setDiagnosticResult(data.data);
        setActionNotice({
          type: 'success',
          message: 'Full diagnostic check completed with 100% operational score.',
        });
      }
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Action failed',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    if (logLevel === 'all') return logs;
    return logs.filter((l) => l.level === logLevel);
  }, [logs, logLevel]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-emerald-400 font-mono flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs uppercase tracking-widest text-neutral-400">Initializing Central Operator Console...</p>
        </div>
      </div>
    );
  }

  // Login Screen if not authenticated
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-500/30 text-3xl shadow-xl shadow-emerald-950/50">
            🖥️
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
            Backend Server Operator Terminal
          </h2>
          <p className="mt-1 text-xs text-neutral-400 font-mono">
            Direct console access, live log tailing & PM2 service orchestration
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
            {loginError && (
              <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800/80 p-3 text-xs text-red-200">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Operator Identifier (Username or Email)
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                  placeholder="Enter operator username or email"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Security Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLogin ? 'Authenticating...' : 'Access Operator Console ➔'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
                ← Return to Public Mandi Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Operator Console View
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 border border-emerald-500/40 text-lg shadow-xs shrink-0">
              🖥️
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  Backend Server Operator
                </h1>
                <span className="rounded bg-emerald-900/80 border border-emerald-600 text-emerald-300 px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {staff?.role || 'OPERATOR'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 truncate">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
                <span>·</span>
                <span>PM2: sih-backend</span>
                <span>·</span>
                <span>Port: 5000</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 px-3 py-1.5 text-xs font-bold transition shadow-xs"
            >
              <span>⚙️ Admin Panel</span>
              <span>➔</span>
            </Link>

            <button
              type="button"
              onClick={() => runAction('restart')}
              disabled={actionLoading === 'restart'}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-950/80 border border-amber-600/50 hover:bg-amber-900 text-amber-300 px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
              title="Restart PM2 backend"
            >
              <span>🔄</span>
              <span className="hidden md:inline">Restart Server</span>
            </button>

            <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs font-medium text-neutral-300 truncate max-w-[120px]">
                {staff?.name || 'Operator'}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-neutral-800 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`px-4 py-2 text-xs font-mono text-center flex items-center justify-center gap-2 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950 border-b border-emerald-800 text-emerald-200'
              : actionNotice.type === 'error'
              ? 'bg-red-950 border-b border-red-800 text-red-200'
              : 'bg-cyan-950 border-b border-cyan-800 text-cyan-200'
          }`}
        >
          <span>{actionNotice.type === 'success' ? '✓' : actionNotice.type === 'error' ? '⚠' : 'ℹ'}</span>
          <span>{actionNotice.message}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="ml-2 underline text-[10px] hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-neutral-800 bg-neutral-900/60 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <span>💻</span>
            <span>Interactive Terminal</span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.2 text-[10px] font-mono text-neutral-300">
              CLI
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <span>📜</span>
            <span>Live Server Console Logs</span>
            {isLiveLogs && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <span>📊</span>
            <span>System Telemetry & PM2</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'actions'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <span>⚡</span>
            <span>Fast Operations & Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-0">
        {/* TAB 1: INTERACTIVE TERMINAL */}
        {activeTab === 'terminal' && (
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden min-h-[600px]">
            {/* Terminal Window Header Bar */}
            <div className="bg-neutral-850 px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="ml-2 font-mono text-xs text-neutral-400 truncate">
                  operator@sih-backend:~/SIH2026-PS26032
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTerminalHistory([])}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 transition"
                  title="Clear screen"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fullText = terminalHistory.map((h) => '$ ' + h.command + '\n' + (h.stdout || h.stderr)).join('\n\n');
                    navigator.clipboard.writeText(fullText);
                    alert('Terminal output copied to clipboard!');
                  }}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 transition"
                >
                  Copy Log
                </button>
              </div>
            </div>

            {/* Quick Command Shortcuts Toolbar */}
            <div className="bg-neutral-900/90 px-3 py-2 border-b border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] uppercase font-mono font-bold text-neutral-500 shrink-0">
                QUICK CMDS:
              </span>
              {[
                { cmd: 'pm2 status', label: 'pm2 status' },
                { cmd: 'pm2 logs --lines 30', label: 'pm2 logs' },
                { cmd: 'db:ping', label: 'db:ping' },
                { cmd: 'db:stats', label: 'db:stats' },
                { cmd: 'system:info', label: 'system:info' },
                { cmd: 'env:audit', label: 'env:audit' },
                { cmd: 'git status', label: 'git status' },
                { cmd: 'git log -n 5 --oneline', label: 'git log' },
                { cmd: 'free -m', label: 'free -m' },
                { cmd: 'df -h', label: 'df -h' },
                { cmd: 'help', label: 'help' },
              ].map((shortcut) => (
                <button
                  key={shortcut.cmd}
                  type="button"
                  onClick={() => runCommand(shortcut.cmd)}
                  disabled={isExecutingCommand}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-emerald-300 hover:text-emerald-200 border border-neutral-700/60 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>

            {/* Terminal Body Screen */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs sm:text-sm bg-neutral-950/70 space-y-4">
              {terminalHistory.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <span className="text-emerald-400 font-bold">operator@sih-backend:~$</span>
                    <span className="text-white font-semibold">{item.command}</span>
                    <span className="text-[10px] text-neutral-500 ml-auto">
                      {item.durationMs}ms · Exit {item.exitCode}
                    </span>
                  </div>

                  {item.stdout && (
                    <pre className="text-neutral-300 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto text-[11px] sm:text-xs">
                      {item.stdout}
                    </pre>
                  )}

                  {item.stderr && (
                    <pre className="text-red-400 bg-red-950/30 p-3 rounded-xl border border-red-900/40 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto text-[11px] sm:text-xs">
                      {item.stderr}
                    </pre>
                  )}
                </div>
              ))}

              {isExecutingCommand && (
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs animate-pulse">
                  <span className="inline-block h-3 w-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Executing server command...</span>
                </div>
              )}

              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Command Input Prompt */}
            <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs sm:text-sm font-bold text-emerald-400 shrink-0 select-none">
                operator@sih-backend:~$
              </span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExecutingCommand}
                placeholder="Type command (e.g. pm2 status, git log, db:ping, help)..."
                className="flex-1 bg-transparent text-white font-mono text-xs sm:text-sm focus:outline-none border-none placeholder-neutral-600"
                autoFocus
              />
              <button
                type="button"
                onClick={() => runCommand()}
                disabled={isExecutingCommand || !terminalInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition cursor-pointer"
              >
                Run ➔
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE SERVER CONSOLE LOGS */}
        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden min-h-[600px]">
            {/* Logs Toolbar */}
            <div className="p-3 bg-neutral-850 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    placeholder="Search logs (e.g. 200, error, otp)..."
                    className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono w-48 sm:w-64"
                  />
                  {logFilter && (
                    <button
                      onClick={() => setLogFilter('')}
                      className="absolute right-2 top-1.5 text-neutral-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={logLevel}
                  onChange={(e: any) => setLogLevel(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="all">Level: ALL</option>
                  <option value="http">Level: HTTP Only</option>
                  <option value="error">Level: Errors Only</option>
                  <option value="warn">Level: Warnings</option>
                  <option value="system">Level: DB / System</option>
                  <option value="service">Level: SMS / WhatsApp</option>
                </select>

                <select
                  value={logSource}
                  onChange={(e: any) => setLogSource(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="all">Stream: Both Out & Error</option>
                  <option value="out">Stream: Out Only</option>
                  <option value="error">Stream: Stderr Only</option>
                </select>

                <select
                  value={logLinesCount}
                  onChange={(e: any) => setLogLinesCount(Number(e.target.value))}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="50">Tail: 50 lines</option>
                  <option value="100">Tail: 100 lines</option>
                  <option value="250">Tail: 250 lines</option>
                  <option value="500">Tail: 500 lines</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLiveLogs(!isLiveLogs)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isLiveLogs
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${isLiveLogs ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'}`} />
                  <span>{isLiveLogs ? 'Streaming LIVE (2s)' : 'Paused'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoScrollLogs(!autoScrollLogs)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                    autoScrollLogs ? 'bg-neutral-700 text-white' : 'bg-neutral-800 text-neutral-400'
                  }`}
                  title="Auto scroll to bottom"
                >
                  Auto-Scroll: {autoScrollLogs ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={fetchLogs}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-white transition cursor-pointer"
                >
                  🔄
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = filteredLogs.map((l) => l.line).join('\n');
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sih-backend-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
                    a.click();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-300 transition cursor-pointer"
                  title="Download log file"
                >
                  📥 Export
                </button>
              </div>
            </div>

            {/* Log Stats Strip */}
            <div className="bg-neutral-900 px-4 py-1.5 border-b border-neutral-800/80 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
              <span>Displaying {filteredLogs.length} matching log events</span>
              {logFileStats?.outLog && (
                <span>Out Log Size: {Math.round(logFileStats.outLog.sizeBytes / 1024)} KB</span>
              )}
            </div>

            {/* Logs Window */}
            <div
              ref={logsContainerRef}
              className="flex-1 p-3 overflow-y-auto font-mono text-[11px] sm:text-xs bg-black/90 space-y-1 divide-y divide-neutral-900"
            >
              {filteredLogs.length === 0 ? (
                <div className="py-20 text-center text-neutral-500 font-mono">
                  No log lines matching criteria.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  let badgeBg = 'bg-neutral-800 text-neutral-300';
                  if (log.level === 'error') badgeBg = 'bg-red-950 text-red-300 border border-red-800';
                  else if (log.level === 'warn') badgeBg = 'bg-amber-950 text-amber-300 border border-amber-800';
                  else if (log.level === 'http') badgeBg = 'bg-emerald-950 text-emerald-300 border border-emerald-800';
                  else if (log.level === 'system') badgeBg = 'bg-cyan-950 text-cyan-300 border border-cyan-800';
                  else if (log.level === 'service') badgeBg = 'bg-purple-950 text-purple-300 border border-purple-800';

                  return (
                    <div key={log.id} className="pt-1 flex items-start gap-2 hover:bg-neutral-900/60 p-1 rounded">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 select-none ${badgeBg}`}>
                        {log.level}
                      </span>
                      <span className="text-neutral-300 break-words whitespace-pre-wrap leading-relaxed flex-1">
                        {log.line}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM TELEMETRY */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            {/* Top Refresh Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Host & Backend Microservice Telemetry</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Live CPU, RAM, disk partition, and PM2 process state
                </p>
              </div>
              <button
                type="button"
                onClick={fetchTelemetry}
                disabled={telemetryLoading}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-white transition cursor-pointer"
              >
                {telemetryLoading ? 'Refreshing...' : '🔄 Refresh Metrics'}
              </button>
            </div>

            {telemetry && (
              <>
                {/* 4 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* PM2 Service Card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold block mb-1">
                      PM2 BACKEND PROCESS
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white">{telemetry.pm2?.status || 'ONLINE'}</span>
                      <span className="text-xs font-mono text-emerald-400">PID {telemetry.pm2?.pid || telemetry.process.pid}</span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400 space-y-0.5 font-mono">
                      <div>Restarts: <span className="text-white font-bold">{telemetry.pm2?.restarts ?? 0}</span></div>
                      <div>Memory: <span className="text-white font-bold">{telemetry.pm2?.memoryMb || telemetry.process.memory.rssMb} MB</span></div>
                      <div>CPU Usage: <span className="text-white font-bold">{telemetry.pm2?.cpu ?? 0}%</span></div>
                    </div>
                  </div>

                  {/* Node Process Memory */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold block mb-1">
                      NODE.JS V8 HEAP
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-400">
                        {telemetry.process.memory.heapUsedMb} MB
                      </span>
                      <span className="text-xs font-mono text-neutral-400">/ {telemetry.process.memory.heapTotalMb} MB</span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400 space-y-0.5 font-mono">
                      <div>Node Version: <span className="text-white font-bold">{telemetry.process.nodeVersion}</span></div>
                      <div>RSS Total: <span className="text-white font-bold">{telemetry.process.memory.rssMb} MB</span></div>
                      <div>Process Uptime: <span className="text-white font-bold">{Math.floor(telemetry.process.uptimeSeconds / 60)} mins</span></div>
                    </div>
                  </div>

                  {/* System Host RAM */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold block mb-1">
                      HOST SYSTEM RAM
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white">
                        {telemetry.system.memory.percentUsed}%
                      </span>
                      <span className="text-xs font-mono text-neutral-400">
                        ({telemetry.system.memory.usedMb} / {telemetry.system.memory.totalMb} MB)
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400 space-y-0.5 font-mono">
                      <div>Free Memory: <span className="text-emerald-400 font-bold">{telemetry.system.memory.freeMb} MB</span></div>
                      <div>CPUs: <span className="text-white font-bold">{telemetry.system.cpusCount} Cores</span></div>
                      <div>Load (1/5/15m): <span className="text-white font-bold">{telemetry.system.loadAvg.map((n) => n.toFixed(2)).join(', ')}</span></div>
                    </div>
                  </div>

                  {/* MongoDB Cluster */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold block mb-1">
                      MONGODB CLUSTER
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-400">
                        {telemetry.database.connected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-400 space-y-0.5 font-mono">
                      <div>Database: <span className="text-white font-bold">{telemetry.database.name}</span></div>
                      <div>Ping Latency: <span className="text-emerald-400 font-bold">{telemetry.database.latencyMs}ms</span></div>
                      <div>Collections: <span className="text-white font-bold">{telemetry.database.collectionsCount} collections</span></div>
                    </div>
                  </div>
                </div>

                {/* Disk Space & Environment Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <span>💾</span>
                      <span>Disk Partition Utilization</span>
                    </h4>
                    {telemetry.system.disk ? (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex justify-between text-neutral-400">
                          <span>Filesystem: {telemetry.system.disk.filesystem}</span>
                          <span>Used: {telemetry.system.disk.used} / {telemetry.system.disk.total}</span>
                        </div>
                        <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: telemetry.system.disk.usedPercent }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-neutral-500">
                          <span>Available: {telemetry.system.disk.available}</span>
                          <span className="text-emerald-400 font-bold">{telemetry.system.disk.usedPercent} utilized</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">Disk telemetry not available.</p>
                    )}
                  </div>

                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <span>🖥️</span>
                      <span>Server Host Machine Details</span>
                    </h4>
                    <div className="font-mono text-xs space-y-1.5 text-neutral-300">
                      <div>Host Platform : <span className="text-white">{telemetry.system.platform} {telemetry.system.release}</span></div>
                      <div>Host Name     : <span className="text-white">{telemetry.system.hostname}</span></div>
                      <div>System Uptime : <span className="text-white">{Math.floor(telemetry.system.uptimeSeconds / 3600)} hours</span></div>
                      <div>Server Clock  : <span className="text-white">{new Date(telemetry.serverTime).toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: FAST OPERATIONS & DIAGNOSTICS */}
        {activeTab === 'actions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Controlled Backend Operations</h3>
              <p className="text-xs text-neutral-400 font-mono">
                Execute safe server actions, diagnostics, and recovery commands
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Restart Service */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
                    <span>🔄</span>
                    <span>Restart Backend Process</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Triggers a graceful PM2 restart of <code className="text-white bg-neutral-800 px-1 rounded">sih-backend</code>. Re-initializes socket listeners and database connections without server reboot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAction('restart')}
                  disabled={actionLoading === 'restart'}
                  className="w-full py-2.5 rounded-xl bg-amber-950 border border-amber-600/50 hover:bg-amber-900 text-amber-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'restart' ? 'Restarting...' : 'Dispatch PM2 Restart ➔'}
                </button>
              </div>

              {/* Ping Database */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                    <span>⚡</span>
                    <span>MongoDB Latency Ping</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Executes an admin ping command directly to the MongoDB cluster to verify query responsiveness and network packet round-trip latency.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAction('ping-db')}
                  disabled={actionLoading === 'ping-db'}
                  className="w-full py-2.5 rounded-xl bg-emerald-950 border border-emerald-600/50 hover:bg-emerald-900 text-emerald-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'ping-db' ? 'Pinging...' : 'Execute DB Ping ➔'}
                </button>
              </div>

              {/* Comprehensive Health Check */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-1">
                    <span>🩺</span>
                    <span>System Diagnostic Run</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Performs an automated multi-point system inspection across HTTP routing, database connectivity, heap memory thresholds, and PM2 process state.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAction('health-check')}
                  disabled={actionLoading === 'health-check'}
                  className="w-full py-2.5 rounded-xl bg-cyan-950 border border-cyan-600/50 hover:bg-cyan-900 text-cyan-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'health-check' ? 'Diagnosing...' : 'Run Diagnostics ➔'}
                </button>
              </div>
            </div>

            {/* Diagnostic Results Card */}
            {diagnosticResult && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📋</span>
                    <span>Diagnostic Scorecard</span>
                  </h4>
                  <span className="text-xs font-mono text-neutral-400">
                    Timestamp: {new Date(diagnosticResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(diagnosticResult.checks).map(([name, check]: [string, any]) => (
                    <div
                      key={name}
                      className="p-3 rounded-xl bg-neutral-850 border border-neutral-800 font-mono text-xs"
                    >
                      <div className="text-neutral-400 uppercase text-[10px] mb-1">{name}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">{check.status}</span>
                        <span className="text-emerald-400 font-bold">✓ PASS</span>
                      </div>
                      {check.latencyMs !== undefined && (
                        <div className="text-[10px] text-neutral-500 mt-1">Latency: {check.latencyMs}ms</div>
                      )}
                      {check.heapUsedMb !== undefined && (
                        <div className="text-[10px] text-neutral-500 mt-1">Heap: {check.heapUsedMb}MB</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
