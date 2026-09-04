'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, TextField } from '@/components/ui';
import { IconCalendar, IconMapPin, IconWheat } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';

type Center = { _id: string; name: string; code: string; district: string; state: string; crops: string[] };
type Slot = { id: string; startTime: string; endTime: string; available: number; capacity: number };

export default function BookingPage() {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [crop, setCrop] = useState('wheat');
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Center[]>('/centers').then(setCenters).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!centerId) return;
    setSlots([]);
    setSelectedSlot(null);
    setSlotsLoading(true);
    api
      .get<Slot[]>(`/slots?centerId=${centerId}&date=${date}`)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [centerId, date]);

  const selectedCenter = centers.find((c) => c._id === centerId) || null;

  async function book() {
    if (!selectedSlot) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const data = await api.post<{ token: number; center: { name: string } }>('/slots/book', {
        slotId: selectedSlot.id,
        crop,
        estimatedQuantityQtl: quantity,
      });
      setMessage(`${t('book_success')} #${data.token} (${data.center.name})`);
      setSlots((prev) => prev.map((s) => (s.id === selectedSlot.id ? { ...s, available: s.available - 1 } : s)));
      setSelectedSlot(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('book_eyebrow')}
        title={t('book_title')}
        subtitle={t('book_subtitle')}
      />

      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">
              {t('book_selectCenter')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {centers.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setCenterId(c._id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    centerId === c._id
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-neutral-200 hover:border-brand-300'
                  }`}
                >
                  <div className="font-semibold text-neutral-900">{c.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                    <IconMapPin className="h-3.5 w-3.5 shrink-0" /> {c.district}, {c.state}
                  </div>
                  {c.crops?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.crops.map((cr) => (
                        <span key={cr} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] capitalize text-neutral-600 font-medium">
                          {cr}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {centers.length === 0 && !error && (
                <p className="col-span-2 py-4 text-center text-sm text-neutral-400">Loading centres…</p>
              )}
            </div>
          </Card>

          {centerId && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-700">
                  {t('book_chooseDate')}
                </h2>
                <label className="flex items-center gap-2 text-sm">
                  <IconCalendar className="h-4 w-4 text-neutral-400" />
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </div>

              {slotsLoading && (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}

              {!slotsLoading && slots.length === 0 && (
                <EmptyState
                  icon={<IconCalendar className="h-8 w-8" />}
                  title={t('book_noSlots')}
                  description="Try another date or check back later."
                />
              )}

              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const full = slot.available <= 0;
                    const active = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        disabled={full}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl border px-3 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                            : 'border-neutral-200 hover:border-brand-400'
                        }`}
                      >
                        <div className="font-semibold">
                          {slot.startTime}–{slot.endTime}
                        </div>
                        <div className={`text-xs ${active ? 'text-brand-100' : 'text-neutral-400'}`}>
                          {full ? 'Full' : `${slot.available} ${t('book_available')}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold text-neutral-700">
            {t('book_produceDetails')}
          </h2>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-neutral-700">{t('book_crop')}</label>
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="wheat">{t('book_cropWheat')}</option>
              <option value="paddy">{t('book_cropPaddy')}</option>
              <option value="maize">{t('book_cropMaize')}</option>
            </select>
          </div>

          <TextField
            label={t('book_quantity')}
            type="number"
            min={0.1}
            step={0.1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />

          <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm border border-neutral-100">
            <SummaryRow label="Centre" value={selectedCenter?.name || '—'} />
            <SummaryRow label="Date" value={date} />
            <SummaryRow label="Time" value={selectedSlot ? `${selectedSlot.startTime}–${selectedSlot.endTime}` : '—'} />
          </div>

          <Button onClick={book} loading={loading} disabled={!selectedSlot} className="w-full">
            <IconWheat className="h-4 w-4" /> {loading ? t('book_booking') : t('book_btn')}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-800">{value}</span>
    </div>
  );
}
