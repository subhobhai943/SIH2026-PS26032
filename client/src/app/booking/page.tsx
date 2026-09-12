'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { api, getToken } from '@/lib/api';
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, TextField } from '@/components/ui';
import {
  IconCalendar,
  IconClock,
  IconMapPin,
  IconWheat,
  IconCamera,
  IconCheck,
  IconShieldCheck,
  IconRupee,
  IconArrowRight,
} from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { compressImage } from '@/lib/imageUtils';
import { prefersReducedMotion } from '@/lib/animations';

type Center = { _id: string; name: string; code: string; district: string; state: string; crops: string[] };
type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  available: number;
  capacity: number;
  isPast?: boolean;
  date?: string;
  crop?: string;
};

/** Formats an offset date in YYYY-MM-DD aligned to Indian Standard Time (IST) */
function getISTDateStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/** Formats current time in HH:MM in IST */
function getISTTimeStr(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** Checks in real time whether a slot time has passed in IST. */
function isSlotTimePast(slotDate?: string, startTime?: string): boolean {
  if (!startTime) return false;
  const istDateStr = getISTDateStr(0);
  const targetDate = slotDate || istDateStr;

  // Future dates are NEVER past
  if (targetDate > istDateStr) return false;
  // Past dates are ALWAYS past
  if (targetDate < istDateStr) return true;

  // Same day: compare IST time
  const currentIstTime = getISTTimeStr();
  return currentIstTime >= startTime;
}

// Official Government MSP (Minimum Support Price) benchmarks per Quintal
const CROP_MSP_RATES: Record<string, { name: string; hindiName: string; mspPerQtl: number; note: string }> = {
  wheat: { name: 'Wheat', hindiName: 'गेहूं', mspPerQtl: 2275, note: 'Rabi Season MSP Benchmark' },
  paddy: { name: 'Paddy', hindiName: 'धान', mspPerQtl: 2183, note: 'Kharif Common Grade Benchmark' },
  maize: { name: 'Maize', hindiName: 'मक्का', mspPerQtl: 2090, note: 'Coarse Grain MSP Benchmark' },
};

export default function BookingPage() {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [isCenterExpanded, setIsCenterExpanded] = useState(true);

  // Quick date calculations in IST
  const todayStr = getISTDateStr(0);
  const tomorrowStr = getISTDateStr(1);
  const dayAfterStr = getISTDateStr(2);

  const [date, setDate] = useState(() => todayStr);
  const [farmerAadhaarVerified, setFarmerAadhaarVerified] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [crop, setCrop] = useState('wheat');
  const [quantity, setQuantity] = useState(10);
  const [centerSearch, setCenterSearch] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const calcCardRef = useRef<HTMLDivElement>(null);

  const uniqueStates = ['All', ...Array.from(new Set(centers.map((c) => c.state))).filter(Boolean).sort()];

  const filteredCenters = centers.filter((c) => {
    const matchesState = selectedState === 'All' || c.state === selectedState;
    const q = centerSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.crops?.some((cr) => cr.toLowerCase().includes(q));
    return matchesState && matchesSearch;
  });

  useEffect(() => {
    if (slots.length > 0 && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          '.slot-button',
          { scale: 0.95, opacity: 0.7 },
          {
            scale: 1,
            opacity: 1,
            stagger: 0.02,
            duration: 0.25,
            ease: 'back.out(1.2)',
            clearProps: 'all',
          }
        );
      } catch (err) {
        console.warn('Booking slot animation skipped:', err);
      }
    }
  }, [slots]);

  // Crop photo upload states
  const [cropPhotoPreview, setCropPhotoPreview] = useState<string | null>(null);
  const [cropPhotoUrl, setCropPhotoUrl] = useState<string>('');
  const [uploadingCropPhoto, setUploadingCropPhoto] = useState(false);
  const cropFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Center[]>('/centers').then(setCenters).catch((e) => setError(e.message));

    const token = getToken();
    if (token) {
      api
        .get<any>('/farmers/me')
        .then((f) => {
          setFarmerAadhaarVerified(Boolean(f?.aadhaarNumber || f?.aadhaarLast4));
        })
        .catch(() => setFarmerAadhaarVerified(null));
    }
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
      const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.85 });
      setCropPhotoPreview(compressed.dataUrl);

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
    if (isSlotTimePast(selectedSlot.date || date, selectedSlot.startTime)) {
      setError('This time slot has already passed for today. Please select an upcoming time slot or choose another date.');
      setSelectedSlot(null);
      return;
    }
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
    <div className="space-y-4 sm:space-y-6 pb-28 lg:pb-8 max-w-full overflow-hidden">
      <PageHeader
        eyebrow={t('book_eyebrow')}
        title={t('book_title')}
        subtitle={t('book_subtitle')}
      />

      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {farmerAadhaarVerified === false && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/95 dark:bg-amber-950/70 p-3.5 sm:p-4 text-xs text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-extrabold text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                Action Required: Aadhaar Verification Pending (आधार सत्यापन अनिवार्य)
              </p>
              <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Under Government Direct Benefit Transfer (DBT) guidelines, all existing and newly registered farmers must link their 12-digit Aadhaar number to ensure instant 20% advance transfer and mandi entry pass.
              </p>
            </div>
          </div>
          <a
            href="/profile"
            className="inline-flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 text-xs shrink-0 transition active:scale-95 shadow-xs"
          >
            Update Aadhaar in Profile →
          </a>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left / Main Column */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          
          {/* STEP 1: Procurement Centre Selection */}
          <Card className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 text-xs font-black">
                  1
                </span>
                <span>{t('book_selectCenter')}</span>
              </h2>
              {selectedCenter && !isCenterExpanded && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <IconCheck className="h-3 w-3 stroke-[3]" />
                  <span>Selected</span>
                </span>
              )}
            </div>

            {/* Collapsed view on mobile when a centre is chosen */}
            {selectedCenter && !isCenterExpanded ? (
              <div className="rounded-2xl bg-brand-50/80 dark:bg-brand-950/40 border-2 border-brand-500/80 dark:border-brand-600 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-800 dark:text-brand-300">
                    <IconShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span>Mandi Yard Active</span>
                    {selectedCenter.code && (
                      <span className="font-mono bg-brand-200/80 dark:bg-brand-900 px-1.5 py-0.2 rounded text-[10px] text-brand-900 dark:text-brand-200">
                        {selectedCenter.code}
                      </span>
                    )}
                  </div>
                  <p className="font-black text-sm sm:text-base text-neutral-900 dark:text-neutral-50 truncate mt-0.5">
                    {selectedCenter.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                    <IconMapPin className="h-3 w-3 shrink-0 text-neutral-400" />
                    <span>{selectedCenter.district}, {selectedCenter.state}</span>
                  </p>
                  {selectedCenter.crops?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedCenter.crops.map((cr) => (
                        <span
                          key={cr}
                          className="rounded-full bg-white dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shadow-2xs"
                        >
                          {cr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCenterExpanded(true)}
                  className="self-start sm:self-center shrink-0 rounded-xl bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-brand-800 dark:text-brand-200 text-xs font-bold px-3.5 py-2 border border-brand-300 dark:border-brand-700 shadow-xs transition"
                >
                  Change Mandi (केंद्र बदलें)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search & State Filter Controls */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={centerSearch}
                      onChange={(e) => setCenterSearch(e.target.value)}
                      placeholder="Search Mandi name, district, state, or crop..."
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-800/60 pl-9 pr-8 py-2.5 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900"
                    />
                    <span className="absolute left-3 top-3 text-neutral-400">
                      <IconMapPin className="h-3.5 w-3.5" />
                    </span>
                    {centerSearch && (
                      <button
                        type="button"
                        onClick={() => setCenterSearch('')}
                        className="absolute right-3 top-2.5 text-xs font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* State Filter Pills with smooth horizontal swipe */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {uniqueStates.map((st) => {
                      const count = st === 'All' ? centers.length : centers.filter((c) => c.state === st).length;
                      const isActive = selectedState === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSelectedState(st)}
                          className={`whitespace-nowrap rounded-xl px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                            isActive
                              ? 'bg-brand-700 text-white shadow-xs'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {st} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mandi Cards List */}
                <div className="grid gap-2 sm:grid-cols-2 max-h-[300px] sm:max-h-[420px] overflow-y-auto pr-1">
                  {filteredCenters.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => {
                        setCenterId(c._id);
                        setIsCenterExpanded(false);
                      }}
                      className={`relative rounded-xl border p-3 sm:p-3.5 text-left transition active:scale-[0.98] ${
                        centerId === c._id
                          ? 'border-brand-600 bg-brand-50/90 dark:bg-brand-950/70 ring-2 ring-brand-500 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-brand-300 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm leading-snug">
                          {c.name}
                        </div>
                        {centerId === c._id ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                            <IconCheck className="h-3 w-3 stroke-[3]" />
                          </span>
                        ) : (
                          c.code && (
                            <span className="shrink-0 rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                              {c.code}
                            </span>
                          )
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                        <IconMapPin className="h-3 w-3 shrink-0 text-neutral-400" /> {c.district}, {c.state}
                      </div>

                      {c.crops?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.crops.map((cr) => (
                            <span
                              key={cr}
                              className="rounded-full bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                            >
                              {cr}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                  {filteredCenters.length === 0 && centers.length > 0 && (
                    <p className="col-span-2 py-6 text-center text-xs text-neutral-400">
                      No centres match &quot;{centerSearch}&quot;. Try clearing filters.
                    </p>
                  )}
                  {centers.length === 0 && !error && (
                    <p className="col-span-2 py-4 text-center text-sm text-neutral-400">Loading centres…</p>
                  )}
                </div>

                {selectedCenter && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsCenterExpanded(false)}
                      className="text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline"
                    >
                      Done selecting / Keep {selectedCenter.name}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* STEP 2: Produce & Quantity Details (Unified for instant mobile flow) */}
          <Card className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 text-xs font-black">
                  2
                </span>
                <span>{t('book_produceDetails')}</span>
              </h2>
              <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                MSP Guaranteed
              </span>
            </div>

            {/* Crop Selection */}
            <div className="space-y-1.5 mb-4">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {t('book_crop')} · फसल का चयन
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {Object.entries(CROP_MSP_RATES).map(([key, data]) => {
                  const isSelected = crop === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCrop(key)}
                      className={`rounded-xl border p-2 sm:p-2.5 text-center transition active:scale-95 ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/70 ring-2 ring-brand-500 text-brand-950 dark:text-brand-100 font-black shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300 text-neutral-700 dark:text-neutral-300 bg-neutral-50/50 dark:bg-neutral-800/40'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-extrabold capitalize">{data.name}</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{data.hindiName}</div>
                      <div className="text-[10px] sm:text-xs text-brand-700 dark:text-brand-400 font-extrabold mt-1">
                        ₹{data.mspPerQtl}/q
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Input + Quick Chips */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {t('book_quantity')} (Quintals / क्विंटल)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-400 font-medium">Quick add:</span>
                  {[10, 25, 50, 100].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                        quantity === q
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {q}q
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="number"
                min={0.1}
                max={1000}
                step={0.1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0.1, Number(e.target.value)))}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3.5 py-2.5 text-sm sm:text-base font-black text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900"
              />
            </div>

            {/* Real-time 20% DBT Advance Guarantee Card */}
            <div ref={calcCardRef} className="mt-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-3 sm:p-3.5 text-xs border border-neutral-200 dark:border-neutral-700 space-y-2">
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span>{t('book_cropMspRate')}:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">₹{currentMsp} / Quintal</span>
              </div>
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span>{t('book_estimatedTotal')} ({quantity} q):</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">₹{estimatedTotalValue.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-px bg-neutral-200 dark:bg-neutral-700 my-1" />
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-extrabold">
                <span className="flex items-center gap-1">
                  <IconShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t('book_safetyAdvanceAmount')}:</span>
                </span>
                <span className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 font-black">
                  ₹{safetyAdvanceValue.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Final 80% Mandi Settlement:</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">₹{balanceValue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </Card>

          {/* STEP 3: Date & Slot Selection */}
          {centerId ? (
            <Card className="p-3.5 sm:p-5">
              <div className="mb-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 text-xs font-black">
                      3
                    </span>
                    <span>{t('book_chooseDate')} & Time Slot</span>
                  </h2>
                  {selectedSlot && (
                    <span className="text-xs font-black text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                      {selectedSlot.startTime}–{selectedSlot.endTime}
                    </span>
                  )}
                </div>

                {/* Quick Date Pills for Mobile & Calendar Input */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDate(todayStr)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      date === todayStr
                        ? 'bg-brand-700 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    Today (आज)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(tomorrowStr)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      date === tomorrowStr
                        ? 'bg-brand-700 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    Tomorrow (कल)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(dayAfterStr)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      date === dayAfterStr
                        ? 'bg-brand-700 text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    Day After (परसों)
                  </button>

                  {/* Calendar Native Picker */}
                  <label className="ml-auto inline-flex items-center gap-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 cursor-pointer">
                    <IconCalendar className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <input
                      type="date"
                      value={date}
                      min={todayStr}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {slotsLoading && (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}

              {!slotsLoading && slots.length === 0 && (
                <div className="py-6 text-center space-y-2">
                  <EmptyState
                    icon={<IconCalendar className="h-8 w-8 text-neutral-400" />}
                    title={t('book_noSlots')}
                    description="No procurement slots are available for this date. Please select another date."
                  />
                  {date === todayStr ? (
                    <button
                      type="button"
                      onClick={() => setDate(tomorrowStr)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300 underline mt-2 cursor-pointer"
                    >
                      Check tomorrow ({tomorrowStr}) →
                    </button>
                  ) : date === tomorrowStr ? (
                    <button
                      type="button"
                      onClick={() => setDate(dayAfterStr)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300 underline mt-2 cursor-pointer"
                    >
                      Check day after ({dayAfterStr}) →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDate(todayStr)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300 underline mt-2 cursor-pointer"
                    >
                      Return to today ({todayStr}) →
                    </button>
                  )}
                </div>
              )}

              {/* Real-time Past Slots Banner ONLY when today's slots have concluded */}
              {!slotsLoading &&
                date === todayStr &&
                slots.length > 0 &&
                slots.every((s) => s.isPast || isSlotTimePast(s.date || date, s.startTime)) && (
                  <div className="mb-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/50 p-3 sm:p-3.5 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏰</span>
                      <div>
                        <p className="font-extrabold text-amber-950 dark:text-amber-100">
                          All slots for today have concluded (आज के सभी समय स्लॉट समाप्त हो चुके हैं)
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          Past time windows cannot be booked in real time. Please reserve a slot for tomorrow.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDate(tomorrowStr)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-3.5 py-2 font-bold shrink-0 text-xs shadow transition active:scale-95 cursor-pointer"
                    >
                      <span>Check Tomorrow ({tomorrowStr})</span>
                      <span>→</span>
                    </button>
                  </div>
                )}

              {/* Slot Cards Grid */}
              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                  {slots.map((slot) => {
                    const isPast = Boolean(slot.isPast || isSlotTimePast(slot.date || date, slot.startTime));
                    const full = slot.available <= 0 || isPast;
                    const active = selectedSlot?.id === slot.id && !isPast;
                    return (
                      <button
                        key={slot.id}
                        disabled={full}
                        onClick={() => setSelectedSlot(slot)}
                        className={`slot-button relative flex flex-col items-center justify-center min-h-[66px] rounded-xl border p-2 text-center transition-all transform active:scale-95 disabled:cursor-not-allowed ${
                          active
                            ? 'border-brand-600 bg-brand-600 text-white shadow-md ring-2 ring-brand-400'
                            : isPast
                            ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-800/40 text-neutral-400 opacity-60'
                            : full
                            ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 opacity-60'
                            : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 hover:border-emerald-500'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-black text-xs sm:text-sm tracking-tight">
                          <IconClock className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-75 shrink-0" />
                          <span className={isPast ? 'line-through opacity-75' : ''}>{slot.startTime}–{slot.endTime}</span>
                        </div>
                        <div
                          className={`mt-1 inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            active
                              ? 'bg-white/20 text-white'
                              : isPast
                              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                              : full
                              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                              : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {isPast ? 'Past (समय समाप्त)' : full ? 'Slot Full' : `${slot.available} ${t('book_available')}`}
                        </div>
                        {active && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-400 text-neutral-950 shadow font-bold text-[10px]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Please select a Mandi centre in Step 1 to view available dates and time slots.
            </div>
          )}

          {/* STEP 4: Crop Quality Photograph Verification (Optional) */}
          <Card className="p-3.5 sm:p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 text-xs font-black">
                    4
                  </span>
                  <span>{t('book_uploadCropPhoto')}</span>
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('book_uploadCropPhotoDesc')}
                </p>
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                Fast-Track Pass
              </span>
            </div>

            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-3 sm:p-4 bg-neutral-50/70 dark:bg-neutral-800/40">
              {cropPhotoPreview ? (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-neutral-700 shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cropPhotoPreview} alt="Crop Sample" className="h-full w-full object-cover" />
                    <div className="absolute top-1 right-1 rounded-full bg-emerald-600 p-0.5 text-white shadow">
                      <IconCheck className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center sm:justify-start gap-1">
                      <IconShieldCheck className="h-3.5 w-3.5" />
                      <span>{t('book_cropPhotoOptional')}</span>
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Inspection image attached to your digital mandi gate pass.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => cropFileInputRef.current?.click()}
                        loading={uploadingCropPhoto}
                        className="text-xs py-1 px-2.5"
                      >
                        <IconCamera className="h-3.5 w-3.5" />
                        <span>{t('book_retakePhoto')}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropPhotoPreview(null);
                          setCropPhotoUrl('');
                        }}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                      <IconCamera className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Attach Grain Lot Photograph (वैकल्पिक)</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Take a photo using your phone camera directly</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => cropFileInputRef.current?.click()}
                    loading={uploadingCropPhoto}
                    className="w-full sm:w-auto shrink-0 text-xs py-2 px-3.5"
                  >
                    <IconCamera className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <span>{t('reg_takePhoto')}</span>
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

        {/* Right Sidebar: Desktop Booking Summary & Value Breakdown (Desktop only) */}
        <div className="hidden lg:block lg:col-span-1">
          <Card className="sticky top-20 h-fit space-y-4 p-5">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              <IconWheat className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span>{t('book_produceDetails')}</span>
            </h2>

            <div className="space-y-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-3 text-xs border border-neutral-200 dark:border-neutral-700">
              <SummaryRow label="Centre" value={selectedCenter?.name || '—'} />
              <SummaryRow label="Crop" value={`${CROP_MSP_RATES[crop]?.name || crop} (${quantity} q)`} />
              <SummaryRow label="Date" value={date} />
              <SummaryRow label="Time" value={selectedSlot ? `${selectedSlot.startTime}–${selectedSlot.endTime}` : '—'} />
              <SummaryRow label="20% DBT Advance" value={`₹${safetyAdvanceValue.toLocaleString('en-IN')}`} />
              <SummaryRow label="Crop Photo" value={cropPhotoUrl ? 'Attached ✓' : 'Optional'} />
            </div>

            <Button
              onClick={book}
              loading={loading}
              disabled={!selectedSlot}
              className="w-full py-3 text-base shadow-sm"
            >
              <IconWheat className="h-5 w-5" />
              <span>{loading ? t('book_booking') : t('book_btn')}</span>
            </Button>

            <p className="text-[11px] text-center text-neutral-400">
              Token and digital gate pass SMS will be dispatched immediately to your phone.
            </p>
          </Card>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar (Mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 px-3.5 py-2.5 shadow-2xl safe-bottom">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="min-w-0 flex-1">
            {selectedSlot ? (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-900 dark:text-white">
                  <IconClock className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span className="truncate">{selectedSlot.startTime}–{selectedSlot.endTime}</span>
                  <span className="text-[10px] text-neutral-400 font-normal">({date.slice(5)})</span>
                </div>
                <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 truncate">
                  ₹{safetyAdvanceValue.toLocaleString('en-IN')} (20% DBT)
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {centerId ? 'Pick a time slot' : 'Select a Mandi centre'}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  {quantity}q {crop} · ₹{safetyAdvanceValue.toLocaleString('en-IN')} advance
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={book}
            disabled={!selectedSlot || loading}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 active:scale-95 text-white font-black text-xs sm:text-sm px-4 sm:px-5 py-3 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4 text-white" />
                <span>{t('book_booking')}</span>
              </>
            ) : (
              <>
                <IconWheat className="h-4 w-4 text-amber-300" />
                <span>{selectedSlot ? t('book_btn') : 'Select Slot'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="font-bold text-neutral-900 dark:text-neutral-100">{value}</span>
    </div>
  );
}
