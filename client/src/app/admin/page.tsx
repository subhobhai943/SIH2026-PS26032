'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, EmptyState, PageHeader, StatTile, StatusBadge, TextField } from '@/components/ui';
import { IconAdmin, IconClose, IconMapPin, IconQueue, IconRupee, IconWheat, IconTruck, IconShieldCheck } from '@/components/icons';

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
        <PageHeader eyebrow="Admin console" title="Queue & Procurement operations" subtitle="Manage farmers, weigh crops, and release 20% safety advance payments." />
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>

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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
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
  );
}
