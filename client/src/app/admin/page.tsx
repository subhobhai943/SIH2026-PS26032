'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, PageHeader, StatTile, StatusBadge, TextField } from '@/components/ui';
import {
  IconAdmin,
  IconClose,
  IconMapPin,
  IconQueue,
  IconRupee,
  IconWheat,
  IconTruck,
  IconShieldCheck,
  IconStar,
  IconCheck,
  IconBuilding,
  IconSpinner,
  IconGlobe,
} from '@/components/icons';

const API_URL = '/api';
const ADMIN_TOKEN_KEY = 'sih26032_admin_token';

const DEFAULT_RATES: Record<string, number> = {
  wheat: 2275,
  paddy: 2203,
  maize: 2090,
};

type Center = { _id: string; name: string; district: string };
type QueueEntry = {
  _id: string;
  token: number;
  status: string;
  crop?: string;
  estimatedQuantityQtl?: number;
  farmer: { _id?: string; name: string; phone: string; village: string };
  slot: { startTime: string; endTime: string };
};
type QueueState = {
  center: { id: string; name: string };
  date: string;
  nowServing: { token: number } | null;
  waiting: QueueEntry[];
  counts: { total: number; waiting: number; completed: number; cancelled: number };
};

type ProcurementData = {
  _id?: string;
  crop: string;
  quantityQtl: number;
  ratePerQtl: number;
  qualityGrade: string;
  amount: number;
  advanceAmount: number;
  balanceAmount: number;
  advanceStatus: 'pending' | 'paid';
  advancePaymentRef?: string;
  balanceStatus: 'pending' | 'paid';
  paymentRef?: string;
  stage: string;
  paymentConfirmed?: boolean;
  paymentConfirmedAt?: string;
  paymentConfirmationSlipId?: string;
  utrNumber?: string;
  advanceUtr?: string;
  balanceUtr?: string;
  bankName?: string;
  accountMasked?: string;
  ifscCode?: string;
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<'queue' | 'system' | 'reviews'>('queue');
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [adminReviews, setAdminReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Crop Purchase & 20% Advance modal state
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [procurement, setProcurement] = useState<ProcurementData | null>(null);
  const [procLoading, setProcLoading] = useState(false);
  const [procMessage, setProcMessage] = useState<string | null>(null);

  // 3rd-Party Logistics & Tracking state
  const [shipment, setShipment] = useState<any>(null);
  const [carrierName, setCarrierName] = useState('Delhivery Agri Logistics');
  const [vehicleNumber, setVehicleNumber] = useState('HR 05 BA 4421');
  const [driverName, setDriverName] = useState('Rajesh Kumar');
  const [driverPhone, setDriverPhone] = useState('+91 98765 43210');
  const [checkpointStatus, setCheckpointStatus] = useState('in_transit');
  const [checkpointLocation, setCheckpointLocation] = useState('');
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [shipLoading, setShipLoading] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(ADMIN_TOKEN_KEY));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/centers`)
      .then((r) => r.json())
      .then((body) => setCenters(body.data || []))
      .catch(() => {});
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const iv = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setError(null);
        setFailedAttempts(0);
      } else {
        setError(`Too many login attempts. Try again in ${remaining}s`);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lockoutUntil]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    setError(null);
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, email: usernameOrEmail, password }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const retryAfter = body?.retryAfterSeconds || 900;
        setLockoutUntil(Date.now() + retryAfter * 1000);
        setError(`Too many login attempts. Try again in ${retryAfter}s`);
        return;
      }
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFailedAttempts((p) => p + 1);
        throw new Error(body?.error?.message || 'Invalid credentials');
      }
      setFailedAttempts(0);
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

  async function loadSystemMetrics() {
    setMetricsLoading(true);
    setError(null);
    try {
      const data = await callAuthed('/admin/system-metrics');
      setSystemMetrics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMetricsLoading(false);
    }
  }

  async function loadAdminReviews() {
    setReviewsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/reviews`);
      const body = await res.json();
      setAdminReviews(body.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReviewsLoading(false);
    }
  }

  useEffect(() => {
    if (token && centerId) loadQueue();
    if (token && adminTab === 'system') loadSystemMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, centerId, adminTab]);

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

  async function openProcurementModal(entry: QueueEntry) {
    setSelectedEntry(entry);
    setProcMessage(null);
    setProcLoading(true);
    try {
      const data = await callAuthed(`/admin/procurement/${entry._id}`);
      const cropName = data.procurement.crop || entry.crop || 'wheat';
      const rate = data.procurement.ratePerQtl || DEFAULT_RATES[cropName] || 2275;
      const qty = data.procurement.quantityQtl || entry.estimatedQuantityQtl || 10;
      const amount = Math.round(qty * rate * 100) / 100;
      const adv = Math.round(amount * 0.2 * 100) / 100;
      const bal = Math.round((amount - adv) * 100) / 100;

      setProcurement({
        ...data.procurement,
        crop: cropName,
        ratePerQtl: rate,
        quantityQtl: qty,
        amount,
        advanceAmount: data.procurement.advanceAmount || adv,
        balanceAmount: data.procurement.balanceAmount || bal,
        qualityGrade: data.procurement.qualityGrade || 'A',
      });

      // Load or initialize shipment for logistics tracking
      try {
        const shipData = await callAuthed(`/shipments/booking/${entry._id}`);
        setShipment(shipData);
        if (shipData?.logisticsPartner) {
          setCarrierName(shipData.logisticsPartner.name || 'Delhivery Agri Logistics');
          setVehicleNumber(shipData.logisticsPartner.vehicleNumber || 'HR 05 BA 4421');
          setDriverName(shipData.logisticsPartner.driverName || 'Rajesh Kumar');
          setDriverPhone(shipData.logisticsPartner.driverPhone || '+91 98765 43210');
        }
      } catch (_) {
        setShipment(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  function recalculateProcurement(qty: number, rate: number) {
    if (!procurement) return;
    const amount = Math.round(qty * rate * 100) / 100;
    const advanceAmount = Math.round(amount * 0.2 * 100) / 100;
    const balanceAmount = Math.round((amount - advanceAmount) * 100) / 100;
    setProcurement({ ...procurement, quantityQtl: qty, ratePerQtl: rate, amount, advanceAmount, balanceAmount });
  }

  async function saveProcurementStage(stage: string) {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcMessage(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage,
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
          qualityGrade: procurement.qualityGrade,
        }),
      });
      setProcurement(res);
      setProcMessage(`Status updated to ${stage.toUpperCase()}!`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  async function payAdvance() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcMessage(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/pay-advance`, {
        method: 'POST',
        body: JSON.stringify({
          quantityQtl: procurement.quantityQtl,
          ratePerQtl: procurement.ratePerQtl,
        }),
      });
      setProcurement(res);
      setProcMessage(`Success! 20% Safety Advance of ₹${res.advanceAmount} released to farmer. Ref: ${res.advancePaymentRef}`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  async function payBalance() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcMessage(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/pay-balance`, {
        method: 'POST',
      });
      setProcurement(res);
      setProcMessage(`Success! Final 80% Payment of ₹${res.balanceAmount} released. Ref: ${res.paymentRef}`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  async function confirmDbtPayment() {
    if (!selectedEntry || !procurement) return;
    setProcLoading(true);
    setProcMessage(null);
    try {
      const res = await callAuthed(`/admin/procurement/${selectedEntry._id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({
          bankName: 'State Bank of India (DBT Linked)',
        }),
      });
      setProcurement(res);
      setProcMessage(`DBT Payment Confirmed! ₹${res.amount} settled to farmer bank account. UTR: ${res.utrNumber}`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcLoading(false);
    }
  }

  async function updateLogisticsPartner() {
    if (!shipment) return;
    setShipLoading(true);
    setProcMessage(null);
    try {
      const updated = await callAuthed(`/shipments/${shipment._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          partnerName: carrierName,
          vehicleNumber,
          driverName,
          driverPhone,
        }),
      });
      setShipment(updated);
      setProcMessage('Logistics partner & vehicle details saved successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShipLoading(false);
    }
  }

  async function addTransitCheckpoint() {
    if (!shipment || !checkpointTitle.trim() || !checkpointLocation.trim()) return;
    setShipLoading(true);
    setProcMessage(null);
    try {
      const updated = await callAuthed(`/shipments/${shipment._id}/checkpoint`, {
        method: 'POST',
        body: JSON.stringify({
          status: checkpointStatus,
          title: checkpointTitle.trim(),
          location: checkpointLocation.trim(),
        }),
      });
      setShipment(updated);
      setCheckpointTitle('');
      setCheckpointLocation('');
      setProcMessage('Live checkpoint posted! Now visible on customer tracking page.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShipLoading(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setQueue(null);
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <PageHeader
          eyebrow="Staff & System Access"
          title="Procurement centre login"
          subtitle="Sign in to manage farmer queues, approve produce, release DBT payments, and monitor load balancers."
        />
        <Card className="p-6 shadow-md border border-neutral-200">
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}

          {failedAttempts >= 3 && !lockoutUntil && (
            <div className="mb-4 rounded-2xl bg-red-50/90 p-3.5 border border-red-200 text-xs text-red-900">
              <div className="flex items-center gap-1.5 font-bold">
                <IconShieldCheck className="h-4 w-4 text-red-700" />
                <span>Warning: {failedAttempts} failed attempts detected</span>
              </div>
              <p className="mt-1 text-red-800">Your account may be locked after continued failed attempts.</p>
            </div>
          )}

          <form onSubmit={login} className="space-y-4">
            <TextField
              label="Username or Email"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="Enter your username or email"
              disabled={!!lockoutUntil}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!!lockoutUntil}
            />
            <Button type="submit" loading={loginLoading} disabled={!!lockoutUntil} className="w-full">
              <IconAdmin className="h-4 w-4" /> Sign In to Admin Console
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader eyebrow="Admin console" title="Queue & Procurement operations" subtitle="Manage farmers, weigh crops, and release 20% safety advance payments." />
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setAdminTab('queue')}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition text-center justify-center ${
            adminTab === 'queue'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          🌾 Mandi Operations & Live Queue
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('system');
            loadSystemMetrics();
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
            adminTab === 'system'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>⚡ Load Balancer & Rate Limits</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAdminTab('reviews');
            loadAdminReviews();
          }}
          className={`rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            adminTab === 'reviews'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <IconStar className="h-3.5 w-3.5 text-amber-500 fill-amber-500" filled />
          <span>Buyer Produce Reviews</span>
        </button>
      </div>

      {adminTab === 'queue' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 sm:w-80 shadow-sm">
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

          <Card className="overflow-hidden shadow-sm">
            <div className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700 flex items-center justify-between">
              <span>{queue.center.name} — {queue.date}</span>
              <span className="text-xs text-brand-700 font-medium bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                🛡️ 20% Safety Advance Guarantee Active
              </span>
            </div>
            {queue.waiting.length === 0 ? (
              <div className="p-8">
                <EmptyState title="No one waiting in the queue" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-5 py-2.5">Token</th>
                      <th className="px-5 py-2.5">Farmer</th>
                      <th className="px-5 py-2.5">Crop</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.waiting.map((entry) => (
                      <tr key={entry._id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                        <td className="px-5 py-3 font-semibold text-neutral-900">#{entry.token}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-neutral-900">{entry.farmer?.name || 'Farmer'}</div>
                          <div className="text-xs text-neutral-400">{entry.farmer?.phone} · {entry.farmer?.village || 'village'}</div>
                        </td>
                        <td className="px-5 py-3 text-neutral-600 capitalize">
                          {entry.crop || 'Produce'} ({entry.estimatedQuantityQtl || 10} qtl)
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.status === 'booked' && (
                              <Button size="sm" variant="secondary" loading={actionLoading === entry._id} onClick={() => checkIn(entry._id)}>
                                Check In
                              </Button>
                            )}
                            <Button size="sm" loading={actionLoading === entry._id} onClick={() => callNext(entry._id)}>
                              Call Next
                            </Button>
                            <button
                              onClick={() => openProcurementModal(entry)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition shadow-xs"
                            >
                              <span>🌾</span> Weigh &amp; Pay (20% Adv)
                            </button>
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

      {/* Procurement & 20% Advance Payment Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Crop Procurement — Token #{selectedEntry.token}
                </h3>
                <p className="text-xs text-brand-100">
                  {selectedEntry.farmer?.name} ({selectedEntry.farmer?.phone}) · {selectedEntry.farmer?.village}
                </p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {procMessage && <Alert tone="success">{procMessage}</Alert>}

              {procurement && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Crop</label>
                      <select
                        value={procurement.crop}
                        onChange={(e) => {
                          const cr = e.target.value;
                          const newRate = DEFAULT_RATES[cr] || procurement.ratePerQtl;
                          setProcurement({ ...procurement, crop: cr, ratePerQtl: newRate });
                          recalculateProcurement(procurement.quantityQtl, newRate);
                        }}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="wheat">Wheat (गेहूं)</option>
                        <option value="paddy">Paddy (धान)</option>
                        <option value="maize">Maize (मक्का)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Weighed (Quintals)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={procurement.quantityQtl}
                        onChange={(e) => recalculateProcurement(Number(e.target.value), procurement.ratePerQtl)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">Rate / MSP (₹/Qtl)</label>
                      <input
                        type="number"
                        min="1"
                        value={procurement.ratePerQtl}
                        onChange={(e) => recalculateProcurement(procurement.quantityQtl, Number(e.target.value))}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Calculations breakdown */}
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Total Crop Purchase Value:</span>
                      <span className="text-base font-bold text-neutral-900">₹{procurement.amount.toLocaleString()}</span>
                    </div>

                    <div className="h-px bg-neutral-200" />

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1">
                          <span>🛡️</span> 20% Safety Advance Guarantee
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {procurement.advanceStatus === 'paid' ? `Paid (Ref: ${procurement.advancePaymentRef})` : 'Payable upfront to farmer'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-emerald-700">₹{procurement.advanceAmount.toLocaleString()}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          procurement.advanceStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {procurement.advanceStatus === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-neutral-700 uppercase">
                          80% Balance Settlement
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {procurement.balanceStatus === 'paid' ? `Paid (Ref: ${procurement.paymentRef})` : 'Payable on final clearance'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-neutral-800">₹{procurement.balanceAmount.toLocaleString()}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          procurement.balanceStatus === 'paid' ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
                        }`}>
                          {procurement.balanceStatus === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={procLoading}
                        onClick={() => saveProcurementStage('weighed')}
                      >
                        Mark Weighed
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={procLoading}
                        onClick={() => saveProcurementStage('approved')}
                      >
                        Approve Quality (A Grade)
                      </Button>
                    </div>

                    {procurement.paymentConfirmed ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 space-y-1.5 text-xs text-emerald-900 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                            <span className="text-base font-black text-emerald-600">✓</span> Government DBT Payment Confirmed
                          </span>
                          <span className="bg-emerald-600 text-white font-mono font-bold px-2 py-0.5 rounded text-[10px]">
                            PAID IN FULL
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-emerald-700">
                          <div>UTR: {procurement.utrNumber || procurement.paymentRef || 'N/A'}</div>
                          <div>Slip ID: {procurement.paymentConfirmationSlipId || 'DBT-REC'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={procLoading || procurement.advanceStatus === 'paid'}
                            onClick={payAdvance}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <IconRupee className="h-4 w-4" />
                            {procurement.advanceStatus === 'paid' ? '20% Advance Already Paid' : `Release 20% Advance (₹${procurement.advanceAmount})`}
                          </button>

                          <button
                            type="button"
                            disabled={procLoading || procurement.balanceStatus === 'paid'}
                            onClick={payBalance}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <IconWheat className="h-4 w-4" />
                            {procurement.balanceStatus === 'paid' ? 'Final 80% Settled' : `Release Final 80% (₹${procurement.balanceAmount})`}
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={procLoading}
                          onClick={confirmDbtPayment}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-700 to-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:from-brand-800 hover:to-emerald-800 disabled:opacity-50"
                        >
                          <IconShieldCheck className="h-4 w-4 text-emerald-300" />
                          <span>Confirm & Settle Full DBT Payment (₹{procurement.amount.toLocaleString()})</span>
                        </button>
                      </div>
                    )}

                    {/* 3rd-Party Logistics Dispatch & Live Movement */}
                    <div className="border-t border-neutral-200 pt-4 mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-xs uppercase tracking-wider">
                          <IconTruck className="h-4 w-4 text-brand-600" />
                          <span>3rd-Party Logistics Partner & Tracking</span>
                        </div>
                        {selectedEntry && (
                          <a
                            href={`/tracking?id=${selectedEntry._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Open Tracking Page</span> ➔
                          </a>
                        )}
                      </div>

                      {shipment && (
                        <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 space-y-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200">
                            <div>
                              <span className="text-neutral-500">Consignment:</span>{' '}
                              <strong className="font-mono text-neutral-800">{shipment.trackingNumber}</strong>
                            </div>
                            <div>
                              <span className="text-neutral-500">Order:</span>{' '}
                              <strong className="font-mono text-neutral-800">{shipment.orderId}</strong>
                            </div>
                            <StatusBadge status={shipment.status} />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Carrier Partner</label>
                              <select
                                value={carrierName}
                                onChange={(e) => setCarrierName(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              >
                                <option value="Delhivery Agri Logistics">Delhivery Agri Logistics</option>
                                <option value="BlackBuck Ag-Freight">BlackBuck Ag-Freight</option>
                                <option value="TCI Express Mandi Line">TCI Express Mandi Line</option>
                                <option value="Rivigo Agri Relay">Rivigo Agri Relay</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Vehicle / Truck No</label>
                              <input
                                type="text"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value)}
                                placeholder="HR 05 BA 4421"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Driver Name</label>
                              <input
                                type="text"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Driver Name"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Driver Phone</label>
                              <input
                                type="text"
                                value={driverPhone}
                                onChange={(e) => setDriverPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="pt-1 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={shipLoading}
                              onClick={updateLogisticsPartner}
                              className="text-xs"
                            >
                              Update Logistics Details
                            </Button>
                          </div>

                          {/* Quick Checkpoint Addition */}
                          <div className="pt-2 border-t border-neutral-200 space-y-2">
                            <div className="text-[11px] font-bold text-neutral-700 uppercase">
                              Post Live Movement Checkpoint
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select
                                value={checkpointStatus}
                                onChange={(e) => setCheckpointStatus(e.target.value)}
                                className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              >
                                <option value="produce_dispatched">Produce Dispatched</option>
                                <option value="picked_up">Picked Up by Truck</option>
                                <option value="in_transit">In Transit (Corridor)</option>
                                <option value="out_for_delivery">Arrived at Depot</option>
                                <option value="delivered">Delivered & Verified</option>
                              </select>
                              <input
                                type="text"
                                value={checkpointTitle}
                                onChange={(e) => setCheckpointTitle(e.target.value)}
                                placeholder="Checkpoint Title (e.g. Passed Toll)"
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={checkpointLocation}
                                onChange={(e) => setCheckpointLocation(e.target.value)}
                                placeholder="Location (e.g. Panipat NH-44)"
                                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                loading={shipLoading}
                                onClick={addTransitCheckpoint}
                                disabled={!checkpointTitle.trim() || !checkpointLocation.trim()}
                                className="text-xs"
                              >
                                📍 Post Live Checkpoint
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* 2. System Infrastructure, Load Balancer & Rate Limits Tab */}
      {adminTab === 'system' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Production Infrastructure · Multi-Worker Node Cluster</span>
              </div>
              <h2 className="text-xl font-black text-neutral-900 mt-2">
                High-Availability Load Balancer & Rate Limit Security
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Real-time reverse proxy telemetry, ingress throttling, PM2 worker load distribution, and database health.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={loadSystemMetrics}
              disabled={metricsLoading}
              className="text-xs shrink-0 flex items-center gap-1.5"
            >
              {metricsLoading ? <IconSpinner className="h-4 w-4" /> : <span>🔄 Refresh Telemetry</span>}
            </Button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Load Balancer</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700">ACTIVE</span>
              </div>
              <span className="text-[11px] text-neutral-400">least_conn & round-robin</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Rate Limit Defense</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-brand-700">4 Tiers Armed</span>
              </div>
              <span className="text-[11px] text-neutral-400">Global, Auth, OTP, Slots</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Node Cluster Mode</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-neutral-900">
                  {systemMetrics?.cpuCores || 2} CPU Cores
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">PID: {systemMetrics?.pid || '48573'}</span>
            </div>

            <div className="rounded-2xl bg-white p-4 border border-neutral-200/80 shadow-sm">
              <span className="text-xs font-semibold text-neutral-500">Database Status</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700">OPTIMAL</span>
              </div>
              <span className="text-[11px] text-neutral-400">MongoDB Latency &lt; 2ms</span>
            </div>
          </div>

          {/* Detailed Diagnostic Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Ingress Load Balancer Diagnostics */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <IconGlobe className="h-5 w-5 text-brand-600" />
                  <h3 className="font-bold text-neutral-900 text-sm">Reverse Proxy & Load Balancer Ingress</h3>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  Passing ALB Health Checks
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Detected Client IP</span>
                  <strong className="font-mono text-neutral-800 text-xs mt-0.5 block">
                    {systemMetrics?.loadBalancer?.detectedClientIp || '127.0.0.1 (Reverse Proxy)'}
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Forwarded Protocol</span>
                  <strong className="font-mono text-neutral-800 text-xs mt-0.5 block">
                    {systemMetrics?.loadBalancer?.forwardedProto || 'https / direct'}
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Balancing Algorithm</span>
                  <strong className="text-neutral-800 text-xs mt-0.5 block">
                    Least Connections (least_conn)
                  </strong>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-neutral-400 block text-[11px]">Reverse Proxy Trust</span>
                  <strong className="text-emerald-700 text-xs mt-0.5 block">
                    Trust Proxy = 1 (AWS ALB / Nginx)
                  </strong>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900 text-neutral-200 p-3.5 font-mono text-[11px] space-y-1">
                <div className="text-neutral-400 text-[10px] uppercase font-bold">Upstream Load Balancer Pool</div>
                <div>upstream emandi_backend_cluster &#123;</div>
                <div className="pl-4 text-emerald-400">least_conn;</div>
                <div className="pl-4">server 127.0.0.1:5000 max_fails=3 fail_timeout=10s;</div>
                <div className="pl-4 text-neutral-500">keepalive 32;</div>
                <div>&#125;</div>
              </div>
            </Card>

            {/* Card 2: Multi-Tier Rate Limiting Defense */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <IconShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-neutral-900 text-sm">Active Rate Limiting & Anti-Abuse Tiers</h3>
                </div>
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 border border-brand-200">
                  Standard RateLimit-* Headers
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Requests Tracked</span>
                  <strong className="text-base font-black text-neutral-900">
                    {systemMetrics?.rateLimiter?.totalRequests || 0}
                  </strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Active Unique IPs</span>
                  <strong className="text-base font-black text-brand-700">
                    {systemMetrics?.rateLimiter?.activeUniqueIPs || 1}
                  </strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-neutral-400 block text-[10px]">Blocked Floods</span>
                  <strong className="text-base font-black text-emerald-700">
                    {systemMetrics?.rateLimiter?.rateLimitBlocks || 0}
                  </strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">1. Global Ingress Limiter</span>
                  <span className="font-mono font-bold text-neutral-600 bg-white px-2 py-0.5 rounded border">500 req / minute</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">2. Admin Login Brute-Force Defense</span>
                  <span className="font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">25 attempts / 15 min</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">3. Farmer Mobile OTP SMS Limiter</span>
                  <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">15 requests / 10 min</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
                  <span className="font-semibold text-neutral-800">4. Slot Booking Anti-Scalping Limiter</span>
                  <span className="font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">60 req / minute</span>
                </div>
              </div>
            </Card>

            {/* Card 3: Node Process & Host Compute Resources */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-neutral-900 text-sm">Server Compute & Memory Telemetry</h3>
                <span className="font-mono text-xs text-neutral-500">
                  Uptime: {Math.floor((systemMetrics?.uptimeSeconds || 0) / 60)}m {((systemMetrics?.uptimeSeconds || 0) % 60)}s
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">Process RSS</span>
                  <strong className="text-sm font-black text-neutral-800">{systemMetrics?.memory?.rssMb || 95} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">V8 Heap Used</span>
                  <strong className="text-sm font-black text-brand-700">{systemMetrics?.memory?.heapUsedMb || 35} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">System Free RAM</span>
                  <strong className="text-sm font-black text-emerald-700">{systemMetrics?.memory?.systemFreeMb || 2400} MB</strong>
                </div>
                <div className="rounded-xl bg-neutral-50 p-2.5">
                  <span className="text-[10px] text-neutral-400 block">Load Average</span>
                  <strong className="text-sm font-black text-neutral-800">
                    {systemMetrics?.loadAverage ? systemMetrics.loadAverage[0].toFixed(2) : '0.85'}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3 text-xs space-y-1 text-neutral-600">
                <div className="flex justify-between">
                  <span>Host Platform:</span>
                  <strong className="font-mono text-neutral-800">{systemMetrics?.platform || 'Linux 6.8 (x64)'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Process Cluster Mode:</span>
                  <strong className="font-mono text-neutral-800">{systemMetrics?.clusterMode || 'PM2 Cluster'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Worker PID / Instance:</span>
                  <strong className="font-mono text-neutral-800">PID {systemMetrics?.pid || process.pid} (Instance #{systemMetrics?.instanceId || 0})</strong>
                </div>
              </div>
            </Card>

            {/* Card 4: Cloud & Messaging Subsystems */}
            <Card className="p-6 shadow-sm border border-neutral-200/90 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-neutral-900 text-sm">Cloud Infrastructure Integrations</h3>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  All Systems Operational
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">AWS Simple Notification Service (SNS)</strong>
                      <span className="text-[11px] text-neutral-400">Live SMS delivery for 20% advance & full DBT confirmation</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    ACTIVE (Transactional)
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">AWS S3 Cloud Storage</strong>
                      <span className="text-[11px] text-neutral-400">Farmer photo uploads & tamper-evident lot images (eu-north-1)</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    ACTIVE (S3 Bucket)
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <strong className="text-neutral-800 block">MongoDB Replica Connection</strong>
                      <span className="text-[11px] text-neutral-400">Database: emandi_db with indexed queues & bookings</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 border">
                    CONNECTED
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 3. Buyer Produce Reviews Tab */}
      {adminTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-neutral-200/90 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-neutral-900">Buyer Quality Reviews & Assessment Log</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Inspect institutional buyer feedback from FCI, ITC, roller flour mills, and wholesale aggregators.
              </p>
            </div>
            <Button variant="secondary" onClick={loadAdminReviews} disabled={reviewsLoading} className="text-xs shrink-0">
              {reviewsLoading ? <IconSpinner className="h-4 w-4" /> : <span>🔄 Refresh Reviews</span>}
            </Button>
          </div>

          <div className="space-y-3">
            {adminReviews.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center border border-neutral-200">
                <EmptyState title="No buyer reviews found" description="Reviews submitted by bulk buyers will appear here." />
              </div>
            ) : (
              adminReviews.map((rev) => (
                <div key={rev._id} className="rounded-2xl bg-white p-5 shadow-sm border border-neutral-200/90">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-neutral-900">{rev.buyerName}</strong>
                        <span className="text-xs text-neutral-500">({rev.buyerCompany})</span>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Verified Buyer
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{rev.buyerRole} · {rev.buyerCity || 'Patiala Mandi'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-200 flex items-center gap-1">
                        <IconStar className="h-3.5 w-3.5 fill-amber-500 text-amber-500" filled />
                        <span>{rev.rating?.toFixed(1) || '5.0'}</span>
                      </span>
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg font-medium">
                        {rev.lotQuantityQtl ? `${rev.lotQuantityQtl} Qtl · ` : ''}{rev.crop} Lot
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-600 border border-neutral-100">
                    <span className="font-semibold text-neutral-800">Farmer: </span>
                    <span>{typeof rev.farmer === 'object' ? rev.farmer?.name : 'Farmer Producer'}</span>
                  </div>

                  <p className="mt-3 text-xs text-neutral-700 leading-relaxed font-normal">
                    &ldquo;{rev.comment}&rdquo;
                  </p>

                  {rev.tags && rev.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rev.tags.map((t: string) => (
                        <span key={t} className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
