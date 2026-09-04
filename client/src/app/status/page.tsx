'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { IconCalendar, IconRupee, IconStatus, IconWheat } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { TranslationKey } from '@/lib/i18n/translations';

type Booking = {
  _id: string;
  token: number;
  date: string;
  status: string;
  center: { name: string; district: string };
  slot: { startTime: string; endTime: string };
};

type StageInfo = { stage: string; done: boolean; current: boolean; at: string | null };
type StatusDetail = {
  booking: Booking;
  procurement: {
    crop?: string;
    quantityQtl: number;
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

  useEffect(() => {
    api
      .get<Booking[]>('/slots/bookings/me')
      .then(setBookings)
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('status_eyebrow')}
        title={t('status_title')}
        subtitle={t('status_subtitle')}
      />

      {error && <Alert>{error}</Alert>}

      {!error && bookings.length === 0 && (
        <EmptyState
          icon={<IconStatus className="h-9 w-9" />}
          title={t('status_noBookings')}
          description="Sign in and book a slot to see your status here."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {bookings.map((b) => (
            <button key={b._id} onClick={() => viewStatus(b._id)} className="block w-full text-left">
              <Card className={`p-4 transition ${selectedId === b._id ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/20 shadow-sm' : 'hover:border-brand-300'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">Token #{b.token}</span>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-500">
                  <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                  {b.center?.name} · {b.date} {b.slot ? `(${b.slot.startTime}–${b.slot.endTime})` : ''}
                </div>
              </Card>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-4">
            <Card className="h-fit p-6 shadow-md">
              <h2 className="mb-5 font-semibold text-neutral-900">
                {t('status_timeline')} — Token #{selected.booking.token}
              </h2>

              <ol className="space-y-0 mb-6">
                {selected.stages.map((s, i) => {
                  const stageKey = STAGE_KEY_MAP[s.stage];
                  const stageLabel = stageKey ? t(stageKey) : s.stage;

                  return (
                    <li key={s.stage} className="relative flex gap-3 pb-6 last:pb-0">
                      {i < selected.stages.length - 1 && (
                        <span className={`absolute left-3 top-6 h-full w-0.5 -translate-x-1/2 ${s.done ? 'bg-brand-400' : 'bg-neutral-200'}`} />
                      )}
                      <span
                        className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          s.done ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        {s.done ? '✓' : i + 1}
                      </span>
                      <div>
                        <p className={`text-sm ${s.current ? 'font-semibold text-neutral-900' : s.done ? 'text-neutral-700' : 'text-neutral-400'}`}>
                          {stageLabel}
                        </p>
                        {s.at && <p className="text-xs text-neutral-400">{new Date(s.at).toLocaleString()}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* 20% Advance Guarantee & Payment Breakdown */}
              {p && p.amount > 0 && (
                <div className="border-t border-neutral-100 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      {t('status_produceDetails')}
                    </span>
                    <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                      🛡️ 20% Safety Advance Guarantee
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Total Amount */}
                    <div className="rounded-2xl bg-neutral-50 p-3.5 border border-neutral-200">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase">
                        {t('status_amount')}
                      </div>
                      <div className="text-lg font-extrabold text-neutral-900 mt-0.5">
                        ₹{p.amount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1">
                        {p.quantityQtl} qtl ({p.crop || 'Produce'})
                      </div>
                    </div>

                    {/* 20% Advance */}
                    <div className={`rounded-2xl p-3.5 border transition ${
                      isAdvancePaid
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                        : 'bg-amber-50/50 border-amber-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-emerald-800">
                          {t('status_advanceAmount')}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isAdvancePaid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isAdvancePaid ? t('status_paid') : t('status_pending')}
                        </span>
                      </div>
                      <div className="text-lg font-extrabold text-emerald-700 mt-0.5">
                        ₹{advanceAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-emerald-600/80 mt-1 truncate">
                        {p.advancePaymentRef ? `Ref: ${p.advancePaymentRef}` : '20% Upfront Guarantee'}
                      </div>
                    </div>

                    {/* 80% Balance */}
                    <div className={`rounded-2xl p-3.5 border transition ${
                      isFinalPaid
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                        : 'bg-neutral-50 border-neutral-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-neutral-600">
                          {t('status_balanceAmount')}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isFinalPaid
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}>
                          {isFinalPaid ? t('status_paid') : t('status_pending')}
                        </span>
                      </div>
                      <div className="text-lg font-extrabold text-neutral-800 mt-0.5">
                        ₹{balanceAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-1 truncate">
                        {p.paymentRef ? `Ref: ${p.paymentRef}` : '80% on clearance'}
                      </div>
                    </div>
                  </div>

                  {/* Guarantee Info Banner */}
                  <div className="rounded-xl bg-brand-50/60 p-3 text-xs text-brand-800 border border-brand-100 flex items-start gap-2">
                    <span className="text-base leading-none">🛡️</span>
                    <span>{t('status_advanceNotice')}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
