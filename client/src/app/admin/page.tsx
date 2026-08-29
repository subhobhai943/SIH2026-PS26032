'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, PageHeader, StatTile, StatusBadge, TextField } from '@/components/ui';
import { IconAdmin, IconMapPin, IconQueue } from '@/components/icons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const ADMIN_TOKEN_KEY = 'sih26032_admin_token';

type Center = { _id: string; name: string; district: string };
type QueueEntry = {
  _id: string;
  token: number;
  status: string;
  farmer: { name: string; phone: string; village: string };
  slot: { startTime: string; endTime: string };
};
type QueueState = {
  center: { id: string; name: string };
  date: string;
  nowServing: { token: number } | null;
  waiting: QueueEntry[];
  counts: { total: number; waiting: number; completed: number; cancelled: number };
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('admin@sih26032.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem(ADMIN_TOKEN_KEY));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/centers`)
      .then((r) => r.json())
      .then((body) => setCenters(body.data || []))
      .catch(() => {});
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body?.error?.message || 'Login failed');
      window.localStorage.setItem(ADMIN_TOKEN_KEY, body.data.token);
      setToken(body.data.token);
      if (body.data.staff.center) setCenterId(body.data.staff.center);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function callAuthed(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body?.error?.message || 'Request failed');
    return body.data;
  }

  async function loadQueue() {
    setError(null);
    try {
      const data = await callAuthed(`/admin/queue?centerId=${centerId}`);
      setQueue(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (token && centerId) loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, centerId]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    setActionLoading(id);
    setError(null);
    try {
      await action();
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const checkIn = (id: string) => runAction(id, () => callAuthed(`/admin/queue/${id}/check-in`, { method: 'POST' }));
  const callNext = (id: string) => runAction(id, () => callAuthed(`/admin/queue/${id}/call-next`, { method: 'POST' }));
  const markNoShow = (id: string) =>
    runAction(id, () => callAuthed(`/admin/queue/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'no_show' }) }));

  function signOut() {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setQueue(null);
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <PageHeader eyebrow="Staff access" title="Procurement centre login" subtitle="Sign in to run check-ins, call the next token, and update procurement status." />
        <Card className="p-6">
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}
          <form onSubmit={login} className="space-y-4">
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@centre.gov.in" />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <Button type="submit" loading={loginLoading} className="w-full">
              <IconAdmin className="h-4 w-4" /> Sign In
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader eyebrow="Admin console" title="Queue operations" subtitle="Check farmers in, call the next token, and manage no-shows." />
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 sm:w-80">
          <IconMapPin className="h-4 w-4 shrink-0 text-neutral-400" />
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none"
          >
            <option value="">Select a procurement centre</option>
            {centers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} — {c.district}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={loadQueue} disabled={!centerId}>
          Refresh
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!queue && centerId && (
        <div className="flex justify-center py-10">
          <EmptyState icon={<IconQueue className="h-9 w-9" />} title="Loading queue…" />
        </div>
      )}

      {!centerId && <EmptyState icon={<IconQueue className="h-9 w-9" />} title="Select a centre to manage its queue" />}

      {queue && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Now Serving" value={queue.nowServing ? `#${queue.nowServing.token}` : '—'} tone="brand" />
            <StatTile label="Waiting" value={String(queue.counts.waiting)} />
            <StatTile label="Completed" value={String(queue.counts.completed)} />
            <StatTile label="Total" value={String(queue.counts.total)} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700">
              {queue.center.name} — {queue.date}
            </div>
            {queue.waiting.length === 0 ? (
              <div className="p-8">
                <EmptyState title="No one waiting" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-5 py-2.5">Token</th>
                      <th className="px-5 py-2.5">Farmer</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.waiting.map((entry) => (
                      <tr key={entry._id} className="border-t border-neutral-100">
                        <td className="px-5 py-3 font-semibold text-neutral-900">#{entry.token}</td>
                        <td className="px-5 py-3">
                          {entry.farmer?.name || 'Farmer'} <span className="text-neutral-400">· {entry.farmer?.phone}</span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {entry.status === 'booked' && (
                              <Button size="sm" variant="secondary" loading={actionLoading === entry._id} onClick={() => checkIn(entry._id)}>
                                Check In
                              </Button>
                            )}
                            <Button size="sm" loading={actionLoading === entry._id} onClick={() => callNext(entry._id)}>
                              Call Next
                            </Button>
                            <Button size="sm" variant="danger" loading={actionLoading === entry._id} onClick={() => markNoShow(entry._id)}>
                              No-Show
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
