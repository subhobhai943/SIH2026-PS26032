'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { api } from '@/lib/api';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, TextField } from '@/components/ui';
import {
  IconCalendar,
  IconMapPin,
  IconWheat,
  IconCamera,
  IconCheck,
  IconShieldCheck,
  IconRupee,
} from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { compressImage } from '@/lib/imageUtils';
import { prefersReducedMotion } from '@/lib/animations';

type Center = { _id: string; name: string; code: string; district: string; state: string; crops: string[] };
type Slot = { id: string; startTime: string; endTime: string; available: number; capacity: number };

// Official Government MSP (Minimum Support Price) benchmarks per Quintal
const CROP_MSP_RATES: Record<string, { name: string; mspPerQtl: number; note: string }> = {
  wheat: { name: 'Wheat (गेहूं)', mspPerQtl: 2275, note: 'Rabi Season MSP Benchmark' },
  paddy: { name: 'Paddy (धान)', mspPerQtl: 2183, note: 'Kharif Common Grade Benchmark' },
  maize: { name: 'Maize (मक्का)', mspPerQtl: 2090, note: 'Coarse Grain MSP Benchmark' },
};

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
  const calcCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slots.length > 0 && !prefersReducedMotion()) {
      gsap.from('.slot-button', {
        scale: 0.9,
        opacity: 0,
        stagger: 0.035,
        duration: 0.35,
        ease: 'back.out(1.4)',
        clearProps: 'transform,opacity',
      });
    }
  }, [slots]);

  // Crop photo upload states
  const [cropPhotoPreview, setCropPhotoPreview] = useState<string | null>(null);
  const [cropPhotoUrl, setCropPhotoUrl] = useState<string>('');
  const [uploadingCropPhoto, setUploadingCropPhoto] = useState(false);
  const cropFileInputRef = useRef<HTMLInputElement>(null);


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

  // Financial calculations based on MSP & 20% advance policy
  const currentMsp = CROP_MSP_RATES[crop]?.mspPerQtl || 2200;
  const estimatedTotalValue = Math.round(quantity * currentMsp);
  const safetyAdvanceValue = Math.round(estimatedTotalValue * 0.2);
  const balanceValue = estimatedTotalValue - safetyAdvanceValue;

  async function handleCropPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingCropPhoto(true);
    try {
      // Compress on client side before upload (efficient for field photos)
      const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.85 });
      setCropPhotoPreview(compressed.dataUrl);

      // Upload through backend (supports S3 if configured, or local fallback)
      const res = await api.post<{ url: string }>('/upload', {
        image: compressed.dataUrl,
        category: 'crop_photo',
        filename: compressed.filename,
      });

      setCropPhotoUrl(res.url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload crop photograph');
    } finally {
      setUploadingCropPhoto(false);
    }
  }

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
        cropPhotoUrl: cropPhotoUrl || undefined,
      });
      setMessage(`${t('book_success')} #${data.token} (${data.center.name})`);
      setSlots((prev) => prev.map((s) => (s.id === selectedSlot.id ? { ...s, available: s.available - 1 } : s)));
      setSelectedSlot(null);
      setCropPhotoPreview(null);
      setCropPhotoUrl('');
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
          {/* 1. Centre Selection */}
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">1</span>
              {t('book_selectCenter')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {centers.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setCenterId(c._id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    centerId === c._id
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500'
                      : 'border-neutral-200 hover:border-brand-300'
                  }`}
                >
                  <div className="font-bold text-neutral-900">{c.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                    <IconMapPin className="h-3.5 w-3.5 shrink-0" /> {c.district}, {c.state}
                  </div>
                  {c.crops?.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {c.crops.map((cr) => (
                        <span key={cr} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-neutral-600 border border-neutral-200 shadow-2xs">
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

          {/* 2. Date & Time Slot Selection */}
          {centerId && (
            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">2</span>
                  {t('book_chooseDate')}
                </h2>
                <label className="flex items-center gap-2 text-sm bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200">
                  <IconCalendar className="h-4 w-4 text-brand-600" />
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-sm font-medium text-neutral-800 focus:outline-none"
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
                  icon={<IconCalendar className="h-8 w-8 text-neutral-400" />}
                  title={t('book_noSlots')}
                  description="All slots are currently booked for this date. Please choose another date."
                />
              )}

              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const full = slot.available <= 0;
                    const active = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        disabled={full}
                        onClick={() => setSelectedSlot(slot)}
                        className={`slot-button min-h-[58px] rounded-xl border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? 'border-brand-600 bg-brand-600 text-white shadow'
                            : full
                            ? 'border-neutral-200 bg-neutral-50 text-neutral-400'
                            : 'border-emerald-200 bg-emerald-50/40 text-emerald-950 hover:border-emerald-500'
                        }`}
                      >
                        <div className="font-bold text-sm">
                          {slot.startTime}–{slot.endTime}
                        </div>
                        <div className={`mt-0.5 text-xs font-semibold ${active ? 'text-brand-100' : full ? 'text-neutral-400' : 'text-emerald-700'}`}>
                          {full ? 'Slot Full' : `${slot.available} ${t('book_available')}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* 3. Crop Quality Photograph Verification */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">3</span>
                  {t('book_uploadCropPhoto')}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {t('book_uploadCropPhotoDesc')}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                Fast-Track Gate Pass
              </span>
            </div>

            <div className="rounded-xl border border-dashed border-neutral-300 p-4 bg-neutral-50/70">
              {cropPhotoPreview ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative h-28 w-36 overflow-hidden rounded-xl border-2 border-white shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropPhotoPreview} alt="Crop Sample" className="h-full w-full object-cover" />
                    <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-600 p-1 text-white shadow">
                      <IconCheck className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-semibold text-emerald-800 flex items-center justify-center sm:justify-start gap-1">
                      <IconShieldCheck className="h-4 w-4" />
                      {t('book_cropPhotoOptional')}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Pre-weighbridge visual inspection image attached to gate pass token.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => cropFileInputRef.current?.click()}
                      loading={uploadingCropPhoto}
                    >
                      <IconCamera className="h-4 w-4" />
                      {t('book_retakePhoto')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <IconCamera className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-800">Attach Grain Lot Photograph</p>
                      <p className="text-[11px] text-neutral-500">Take a photo using your phone camera directly</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => cropFileInputRef.current?.click()}
                    loading={uploadingCropPhoto}
                    className="shrink-0 text-xs py-2 px-3.5"
                  >
                    <IconCamera className="h-4 w-4 text-brand-600" />
                    {t('reg_takePhoto')}
                  </Button>
                </div>
              )}

              {/* Hidden file input with environment camera trigger */}
              <input
                ref={cropFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCropPhotoSelected}
              />
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Crop & Value Calculator */}
        <Card className="h-fit space-y-4 p-4 sm:p-5 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
            <IconWheat className="h-5 w-5 text-brand-600" />
            {t('book_produceDetails')}
          </h2>

          {/* Visual Crop Selection Cards */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">{t('book_crop')}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(CROP_MSP_RATES).map(([key, data]) => {
                const isSelected = crop === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCrop(key)}
                    className={`rounded-xl border p-2 text-center transition ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500 text-brand-900 font-bold'
                        : 'border-neutral-200 hover:border-brand-300 text-neutral-700'
                    }`}
                  >
                    <div className="text-xs capitalize font-bold">{key}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">₹{data.mspPerQtl}/q</div>
                  </button>
                );
              })}
            </div>
          </div>

          <TextField
            label={`${t('book_quantity')} (Quintals / क्विंटल)`}
            type="number"
            min={0.1}
            max={1000}
            step={0.1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0.1, Number(e.target.value)))}
          />

          {/* Transparent MSP & 20% DBT Advance Breakdown */}
          <div ref={calcCardRef} className="space-y-2 rounded-xl bg-neutral-50 p-3.5 text-xs border border-neutral-200">
            <div className="flex items-center justify-between text-neutral-600">
              <span>{t('book_cropMspRate')}:</span>
              <span className="font-bold text-neutral-900">₹{currentMsp} / Quintal</span>
            </div>
            <div className="flex items-center justify-between text-neutral-600">
              <span>{t('book_estimatedTotal')} ({quantity} q):</span>
              <span className="font-bold text-neutral-900">₹{estimatedTotalValue.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-px bg-neutral-200 my-1" />
            <div className="flex items-center justify-between text-emerald-800 font-bold">
              <span className="flex items-center gap-1">
                <IconShieldCheck className="h-4 w-4 text-emerald-600" />
                {t('book_safetyAdvanceAmount')}:
              </span>
              <span className="text-sm text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                ₹{safetyAdvanceValue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span>Final 80% Mandi Settlement:</span>
              <span>₹{balanceValue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-xs border border-neutral-100">
            <SummaryRow label="Centre" value={selectedCenter?.name || '—'} />
            <SummaryRow label="Date" value={date} />
            <SummaryRow label="Time" value={selectedSlot ? `${selectedSlot.startTime}–${selectedSlot.endTime}` : '—'} />
            <SummaryRow label="Crop Photo" value={cropPhotoUrl ? 'Attached ✓' : 'Optional'} />
          </div>

          <Button
            onClick={book}
            loading={loading}
            disabled={!selectedSlot}
            className="w-full py-3 text-base shadow-sm"
          >
            <IconWheat className="h-5 w-5" />
            {loading ? t('book_booking') : t('book_btn')}
          </Button>

          <p className="text-[11px] text-center text-neutral-400">
            Token and digital gate pass SMS will be dispatched immediately to your phone.
          </p>
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
