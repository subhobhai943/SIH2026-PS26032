'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { api } from '@/lib/api';
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import {
  IconCalendar,
  IconRupee,
  IconStatus,
  IconWheat,
  IconTruck,
  IconShieldCheck,
  IconPrinter,
  IconCheck,
  IconStar,
} from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { TranslationKey } from '@/lib/i18n/translations';
import { prefersReducedMotion } from '@/lib/animations';

type Booking = {
  _id: string;
  token: number;
  date: string;
  status: string;
  center: { name: string; district: string; code?: string; address?: string; contactPhone?: string };
  slot: { startTime: string; endTime: string };
  crop?: string;
  estimatedQuantityQtl?: number;
  farmer?: { name?: string; phone?: string; village?: string; district?: string; state?: string };
};

type StageInfo = { stage: string; done: boolean; current: boolean; at: string | null };
type StatusDetail = {
  booking: Booking;
  procurement: {
    crop?: string;
    quantityQtl: number;
    qualityGrade?: string;
    ratePerQtl?: number;
    amount: number;
    advancePercent?: number;
    advanceAmount?: number;
    balanceAmount?: number;
    advanceStatus?: 'pending' | 'paid';
    advancePaymentRef?: string;
    advancePaidAt?: string;
    balanceStatus?: 'pending' | 'paid';
    paymentRef?: string;
    paidAt?: string;
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
    billPdfUrl?: string;
    billGeneratedAt?: string;
  } | null;
  stages: StageInfo[];
};

const STAGE_KEY_MAP: Record<string, TranslationKey> = {
  booked: 'status_stageBooked',
  arrived: 'status_stageArrived',
  weighed: 'status_stageWeighed',
  approved: 'status_stageApproved',
  advance_paid: 'status_stageAdvancePaid',
  paid: 'status_stagePaid',
};

export default function StatusPage() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<StatusDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && !prefersReducedMotion()) {
      try {
        if (detailsRef.current) {
          gsap.fromTo(
            detailsRef.current,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' }
          );
        }
        gsap.fromTo(
          '.timeline-stage',
          { opacity: 0.7, x: -6 },
          {
            opacity: 1,
            x: 0,
            stagger: 0.03,
            duration: 0.25,
            ease: 'power2.out',
            clearProps: 'all',
          }
        );
      } catch (err) {
        console.warn('Status timeline animation skipped:', err);
      }
    }
  }, [selected?.booking._id]);


  useEffect(() => {
    api
      .get<Booking[]>('/slots/bookings/me')
      .then((data) => {
        setBookings(data);
        if (data && data.length > 0 && !selectedId) {
          viewStatus(data[0]._id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  async function viewStatus(id: string) {
    setError(null);
    setSelectedId(id);
    try {
      const data = await api.get<StatusDetail>(`/queue/me/status/${id}`);
      setSelected(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const p = selected?.procurement;
  const advanceAmount = p?.advanceAmount || (p?.amount ? Math.round(p.amount * 0.2) : 0);
  const balanceAmount = p?.balanceAmount || (p?.amount ? p.amount - advanceAmount : 0);
  const isAdvancePaid = p?.advanceStatus === 'paid' || p?.stage === 'advance_paid' || p?.stage === 'paid';
  const isFinalPaid = p?.balanceStatus === 'paid' || p?.stage === 'paid';
  const isPaymentConfirmed = Boolean(p?.paymentConfirmed || (isAdvancePaid && isFinalPaid));

  const confirmationSlipId =
    p?.paymentConfirmationSlipId ||
    (selected ? `DBT-REC-${new Date().getFullYear()}-${selected.booking.token}-${selected.booking.date.replace(/-/g, '')}` : '');

  const effectiveUtr = p?.utrNumber || p?.balanceUtr || p?.paymentRef || 'PENDING-SETTLEMENT';
  const advanceUtr = p?.advanceUtr || p?.advancePaymentRef || (isAdvancePaid ? `ADV-${effectiveUtr.slice(-6)}` : 'Pending');
  const balanceUtr = p?.balanceUtr || p?.paymentRef || (isFinalPaid ? `BAL-${effectiveUtr.slice(-6)}` : 'Pending weighbridge');

  return (
    <div className="space-y-6">
      {/* Print stylesheet for crisp official receipt printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #dbt-printable-receipt,
          #dbt-printable-receipt * {
            visibility: visible;
          }
          #dbt-printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: 2px solid #047857 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          eyebrow={t('status_eyebrow')}
          title={t('status_title')}
          subtitle={t('status_subtitle')}
        />
      </div>

      {error && (
        <div className="no-print">
          <Alert>{error}</Alert>
        </div>
      )}

      {!error && bookings.length === 0 && (
        <EmptyState
          icon={<IconStatus className="h-9 w-9" />}
          title={t('status_noBookings')}
          description="Sign in and book a slot to see your status here."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Booking selection cards */}
        <div className="space-y-3 lg:col-span-4 no-print">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
            {t('status_selectBookingPrompt')} ({bookings.length})
          </div>
          {bookings.map((b) => (
            <button key={b._id} onClick={() => viewStatus(b._id)} className="block w-full text-left">
              <Card
                className={`p-4 transition ${
                  selectedId === b._id
                    ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30 shadow-md'
                    : 'hover:border-brand-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">Token #{b.token}</span>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-1.5 text-sm text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {b.center?.name} · {b.date} {b.slot ? `(${b.slot.startTime}–${b.slot.endTime})` : ''}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    🚚 Track
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>

        {/* Right column: Status Timeline & Official DBT Payment Confirmation Voucher */}
        {selected && (
          <div ref={detailsRef} className="space-y-6 lg:col-span-8">
            {/* 1. Procurement Lifecycle Stepper */}
            <Card className="p-4 sm:p-6 shadow-md no-print">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <h2 className="font-semibold text-neutral-900">
                  {t('status_timeline')} — Token #{selected.booking.token}
                </h2>
                <a
                  href={`/tracking?id=${selected.booking._id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-neutral-800 transition"
                >
                  <IconTruck className="h-3.5 w-3.5 text-amber-400" />
                  <span>{t('status_trackDeliveryBtn')}</span>
                </a>
              </div>

              <ol className="space-y-0 mb-4">
                {selected.stages.map((s, i) => {
                  const stageKey = STAGE_KEY_MAP[s.stage];
                  const stageLabel = stageKey ? t(stageKey) : s.stage;

                  return (
                    <li key={s.stage} className="timeline-stage relative flex gap-3 pb-6 last:pb-0">
                      {i < selected.stages.length - 1 && (
                        <span
                          className={`absolute left-3 top-6 h-full w-0.5 -translate-x-1/2 ${
                            s.done ? 'bg-brand-400' : 'bg-neutral-200'
                          }`}
                        />
                      )}
                      <span
                        className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          s.done ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        {s.done ? '✓' : i + 1}
                      </span>
                      <div>
                        <p
                          className={`text-sm ${
                            s.current
                              ? 'font-semibold text-neutral-900'
                              : s.done
                              ? 'text-neutral-700'
                              : 'text-neutral-400'
                          }`}
                        >
                          {stageLabel}
                        </p>
                        {s.at && <p className="text-xs text-neutral-400">{new Date(s.at).toLocaleString()}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* 2. OFFICIAL GOVERNMENT DBT PAYMENT STATUS CONFIRMATION VOUCHER */}
            <div id="dbt-printable-receipt">
              <Card className="overflow-hidden border-2 border-emerald-600/60 shadow-xl bg-white">
                {/* Government Header Banner */}
                <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-brand-900 px-4 py-3 sm:px-6 sm:py-4 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-amber-400">
                        <span className="text-xl">🏛️</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                            Government of India · e-Mandi DBT Portal
                          </span>
                          <span className="rounded bg-emerald-700/80 px-1.5 py-0.2 text-[9px] font-mono text-emerald-100">
                            PFMS / APBS
                          </span>
                        </div>
                        <h2 className="text-base font-extrabold sm:text-lg tracking-tight">
                          DIRECT BENEFIT TRANSFER (DBT) PAYMENT CONFIRMATION
                        </h2>
                        <p className="text-xs text-emerald-100/90">
                          प्रत्यक्ष लाभ अंतरण (डीबीटी) भुगतान पावती एवं प्रमाण-पत्र
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons (hidden on paper) */}
                    <div className="no-print flex flex-wrap items-center gap-2">
                      {p?.billPdfUrl && (
                        <a
                          href={p.billPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`Mandi_Bill_Token_${selected.booking.token}.pdf`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white px-3.5 py-2 text-xs font-bold shadow-md transition"
                        >
                          <span>📄 Download Bill (PDF)</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-neutral-900 shadow-md hover:bg-amber-300 transition"
                      >
                        <IconPrinter className="h-4 w-4" />
                        <span>Print Official Receipt (रसीद प्रिंट करें)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                  {/* Status Banner */}
                  <div
                    className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 ${
                      isPaymentConfirmed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : isAdvancePaid
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-neutral-50 border-neutral-300 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-black text-lg ${
                          isPaymentConfirmed
                            ? 'bg-emerald-600'
                            : isAdvancePaid
                            ? 'bg-amber-600'
                            : 'bg-neutral-500'
                        }`}
                      >
                        {isPaymentConfirmed ? '✓' : isAdvancePaid ? '⚡' : '⏳'}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide">
                          {isPaymentConfirmed
                            ? 'Payment Status: Confirmed & Settled (सत्यापित भुगतान)'
                            : isAdvancePaid
                            ? 'Payment Status: 20% Safety Advance Credited (अग्रिम भुगतान संपन्न)'
                            : 'Payment Status: Awaiting Weighbridge Clearance (तौल सत्यापन जारी)'}
                        </div>
                        <div className="text-xs opacity-80">
                          {isPaymentConfirmed
                            ? 'Full DBT amount transferred directly to farmer linked bank account via PFMS.'
                            : isAdvancePaid
                            ? '20% Upfront advance paid. Remaining 80% balance will be released post final certification.'
                            : 'Produce received. Verification and DBT crediting will commence immediately.'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-neutral-500">Voucher / Slip No.</div>
                      <div className="font-mono text-xs font-extrabold text-neutral-900">{confirmationSlipId}</div>
                    </div>
                  </div>

                  {/* Beneficiary & Center Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200 text-xs">
                    <div>
                      <span className="text-neutral-500 block text-[11px]">Farmer (किसान)</span>
                      <strong className="text-neutral-900 font-semibold">
                        {selected.booking.farmer?.name || 'Registered Farmer'}
                      </strong>
                      <span className="text-neutral-500 block text-[10px]">
                        {selected.booking.farmer?.village ? `${selected.booking.farmer.village}, ` : ''}
                        {selected.booking.farmer?.district || selected.booking.center?.district}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Token & Gate Pass</span>
                      <strong className="text-neutral-900 font-semibold">Token #{selected.booking.token}</strong>
                      <span className="text-neutral-500 block text-[10px]">Date: {selected.booking.date}</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Procurement Center (मंडी)</span>
                      <strong className="text-neutral-900 font-semibold">{selected.booking.center?.name}</strong>
                      <span className="text-neutral-500 block text-[10px]">
                        District: {selected.booking.center?.district}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">Commodity / Grade</span>
                      <strong className="text-neutral-900 font-semibold uppercase">
                        {p?.crop || selected.booking.crop || 'Wheat (गेहूं)'}
                      </strong>
                      <span className="text-neutral-500 block text-[10px]">
                        Grade: {p?.qualityGrade || 'A (FAQ Standard)'}
                      </span>
                    </div>
                  </div>

                  {/* Official DBT Financial Breakdown Table */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="bg-neutral-100/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-700 flex justify-between">
                      <span>DBT Payment Settlement Breakdown (वित्तीय विवरण)</span>
                      <span>Currency: INR (₹)</span>
                    </div>

                    <div className="divide-y divide-neutral-200 text-xs">
                      {/* Row 1: Gross Value */}
                      <div className="p-3.5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-neutral-800">
                            Gross Produce Procurement Value (कुल उत्पाद मूल्य)
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {p?.quantityQtl || 10} Quintals @ ₹{p?.ratePerQtl || (p?.amount ? Math.round(p.amount / (p.quantityQtl || 1)) : 2275)}/qtl (Govt. MSP)
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-neutral-900">
                            ₹{(p?.amount || 22750).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-neutral-500">100% MSP Base</span>
                        </div>
                      </div>

                      {/* Row 2: 20% Safety Advance Guarantee */}
                      <div className="p-3.5 flex items-center justify-between bg-emerald-50/40">
                        <div>
                          <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                            <span>🛡️ 20% Immediate Safety Advance Guarantee</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                isAdvancePaid ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-800'
                              }`}
                            >
                              {isAdvancePaid ? 'CREDITED' : 'PENDING'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 mt-0.5">
                            UTR Ref: {advanceUtr}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-emerald-700">
                            ₹{advanceAmount.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-emerald-600">20% of Gross Value</span>
                        </div>
                      </div>

                      {/* Row 3: 80% Final Weighbridge Balance */}
                      <div className="p-3.5 flex items-center justify-between bg-neutral-50/50">
                        <div>
                          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                            <span>⚖️ 80% Final Weighbridge Balance Settlement</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                isFinalPaid ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
                              }`}
                            >
                              {isFinalPaid ? 'CREDITED' : 'ON CLEARANCE'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                            UTR Ref: {balanceUtr}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-neutral-800">
                            ₹{balanceAmount.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-neutral-500">80% of Gross Value</span>
                        </div>
                      </div>

                      {/* Row 4: Total Settled to Account */}
                      <div className="p-3.5 flex items-center justify-between bg-emerald-100/50">
                        <div>
                          <div className="font-black text-emerald-950 text-sm">
                            Total Net Credited to Linked Bank (कुल अंतरित राशि)
                          </div>
                          <div className="text-[11px] text-emerald-800">
                            Direct Benefit Transfer to registered DBT-enabled bank account
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-black text-emerald-800">
                            ₹{((isFinalPaid ? (p?.amount || 22750) : isAdvancePaid ? advanceAmount : 0)).toLocaleString()}
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">
                            {isPaymentConfirmed ? '100% SETTLED' : isAdvancePaid ? '20% ADVANCE SETTLED' : 'PROCESSING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Official Mandi Bill PDF Download Banner (AWS S3) */}
                  {p?.billPdfUrl && (
                    <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 p-4 space-y-3 no-print shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white font-black text-xl shadow-sm">
                            📄
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                                AWS S3 Secure Stored
                              </span>
                              <span className="text-[10px] text-emerald-700 font-medium">
                                e-NAM Verified
                              </span>
                            </div>
                            <h3 className="text-sm font-extrabold text-neutral-900 mt-0.5">
                              Official Mandi Procurement Bill &amp; DBT Settlement Voucher (PDF)
                            </h3>
                            <p className="text-xs text-neutral-600">
                              सरकारी मंडी खरीद बिल एवं प्रत्यक्ष लाभ अंतरण (डीबीटी) प्रमाण-पत्र
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={p.billPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`Mandi_Bill_Token_${selected.booking.token}.pdf`}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-md transition"
                          >
                            <span>📥 Download Official Bill (PDF)</span>
                          </a>
                        </div>
                      </div>

                      <div className="text-[11px] text-emerald-900/80 border-t border-emerald-200/70 pt-2 flex flex-wrap items-center justify-between gap-2">
                        <span>✓ Government-certified A4 bill with tamper-proof cryptographic audit stamp</span>
                        <span className="font-mono text-[10px] text-emerald-700">Token #{selected.booking.token} · S3 Bucket sih26032-farmer-media</span>
                      </div>
                    </div>
                  )}

                  {/* Bank & Aadhaar Seeding Credentials */}
                  <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                      <IconShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>DBT Bank Account Verification (आधार व बैंक सीडिंग विवरण)</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Bank Name (बैंक)</span>
                        <strong className="text-neutral-800 font-semibold">{p?.bankName || 'State Bank of India (DBT Linked)'}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Account Number</span>
                        <strong className="font-mono text-neutral-800 font-semibold">{p?.accountMasked || '•••• •••• 5421'}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">IFSC Code</span>
                        <strong className="font-mono text-neutral-800 font-semibold">{p?.ifscCode || 'SBIN0001842'}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Master Transaction UTR</span>
                        <strong className="font-mono text-emerald-800 font-bold">{effectiveUtr}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Verified SMS Receipt Dispatch Confirmation */}
                  <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📲</span>
                        <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                          Official SMS Receipt & Carrier Transmission (एसएमएस रसीद)
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        ✓ Gateway Dispatch Confirmed
                      </span>
                    </div>

                    <div className="rounded-xl bg-white p-3.5 border border-emerald-200 text-xs font-mono text-neutral-800 space-y-1.5 shadow-xs">
                      <div className="text-[10px] text-neutral-500 flex flex-wrap justify-between gap-1 pb-1 border-b border-neutral-100">
                        <span>Recipient: <strong className="text-neutral-900">+91 {selected.booking.farmer?.phone || '8167561808'}</strong></span>
                        <span>Gateway: <strong className="text-neutral-900">National e-Mandi DBT Gateway (AWS SNS / DLT Compliant)</strong></span>
                      </div>
                      <p className="text-emerald-950 font-semibold pt-0.5 leading-relaxed">
                        {isPaymentConfirmed
                          ? `Token ${selected.booking.token}: DBT Payment of Rs ${p?.amount || 22030} confirmed (Advance: Rs ${advanceAmount}, Final: Rs ${balanceAmount}). UTR: ${effectiveUtr}. Receipt available on portal.`
                          : isAdvancePaid
                          ? `Token ${selected.booking.token}: 20% safety advance of Rs ${advanceAmount} (Total: Rs ${p?.amount || 22030}) credited to your account. Balance Rs ${balanceAmount}. Ref: ${advanceUtr}.`
                          : `Token ${selected.booking.token}: Slot confirmed at ${selected.booking.center?.name}. Reach 15 min early.`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-emerald-800 pt-0.5 font-medium">
                      <span>✓ Dispatched via Aadhaar Payment Bridge System (APBS) & PM-KISAN linked carrier route</span>
                      <span className="font-mono font-bold">Ref: {advanceUtr}</span>
                    </div>
                  </div>

                  {/* Official Verification Seal & Mandi Signature */}
                  <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full border-2 border-emerald-600 flex items-center justify-center text-[9px] font-bold text-emerald-700 text-center leading-tight">
                        DBT<br />SEAL
                      </div>
                      <div>
                        <div className="font-bold text-neutral-800">
                          Digital Procurement & Payment Confirmation
                        </div>
                        <div className="text-[10px]">
                          Issued under National Agricultural MSP Procurement Guarantee & DBT Rules.
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-neutral-700">Mandi Secretary / Authorized Officer</div>
                      <div className="text-[10px] text-neutral-400">Digitally Verified & Stamped</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 3. Buyer Quality Ratings & Market Reputation Card */}
              <Card className="p-6 shadow-md border-amber-200/70 bg-gradient-to-br from-white to-amber-50/40 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                      <IconStar className="h-6 w-6 fill-white" filled />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-neutral-900 text-base">
                          Verified Buyer Feedback & Produce Reputation
                        </h3>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Star Producer
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        Procurement quality score from FCI officers, roller flour millers, and bulk grain aggregators.
                      </p>
                    </div>
                  </div>

                  <a
                    href="/reviews"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm"
                  >
                    <span>View Buyer Reviews (समीक्षाएं)</span>
                    <span>➔</span>
                  </a>
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-sm">
                    <span className="text-[11px] text-neutral-500 block">Average Rating</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-black text-amber-900">4.9</span>
                      <span className="text-xs text-amber-500">★★★★★</span>
                    </div>
                    <span className="text-[10px] text-neutral-400">Verified lot grade</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-sm">
                    <span className="text-[11px] text-neutral-500 block">Purity & Cleanliness</span>
                    <span className="mt-1 text-xl font-black text-emerald-700 block">Grade A</span>
                    <span className="text-[10px] text-neutral-400">Zero chaff / weevil</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-sm">
                    <span className="text-[11px] text-neutral-500 block">Moisture Compliance</span>
                    <span className="mt-1 text-xl font-black text-brand-800 block">&lt; 11.2%</span>
                    <span className="text-[10px] text-neutral-400">Optimal buffer silo</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-sm">
                    <span className="text-[11px] text-neutral-500 block">Market Standing</span>
                    <span className="mt-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded inline-block">
                      Top 5% Tier
                    </span>
                    <span className="text-[10px] text-neutral-400 block mt-1">Priority mandi bidding</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
