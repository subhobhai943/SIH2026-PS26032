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
  procurement: { quantityQtl: number; amount: number; stage: string } | null;
  stages: StageInfo[];
};

const STAGE_KEY_MAP: Record<string, TranslationKey> = {
  booked: 'status_stageBooked',
  arrived: 'status_stageArrived',
  weighed: 'status_stageWeighed',
  approved: 'status_stageApproved',
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
              <Card className={`p-4 transition ${selectedId === b._id ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/20' : 'hover:border-brand-300'}`}>
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
          <Card className="h-fit p-6 shadow-md">
            <h2 className="mb-5 font-semibold text-neutral-900">
              {t('status_timeline')} — Token #{selected.booking.token}
            </h2>
            <ol className="space-y-0">
              {selected.stages.map((s, i) => {
                const stageKey = STAGE_KEY_MAP[s.stage];
                const stageLabel = stageKey ? t(stageKey) : s.stage;

                return (
                  <li key={s.stage} className="relative flex gap-3 pb-6 last:pb-0">
                    {i < selected.stages.length - 1 && (
                      <span className={`absolute left-3 top-6 h-full w-0.5 -translate-x-1/2 ${s.done ? 'bg-brand-300' : 'bg-neutral-200'}`} />
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

            {selected.procurement && (
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4 text-sm">
                <MetricBlock icon={<IconWheat className="h-4 w-4" />} label={t('status_quantity')} value={`${selected.procurement.quantityQtl} qtl`} />
                <MetricBlock icon={<IconRupee className="h-4 w-4" />} label={t('status_amount')} value={`₹${selected.procurement.amount}`} />
                <MetricBlock icon={<IconStatus className="h-4 w-4" />} label="Stage" value={selected.procurement.stage} capitalize />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricBlock({ icon, label, value, capitalize }: { icon: React.ReactNode; label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-100">
      <div className="flex items-center gap-1.5 text-neutral-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`mt-1 font-semibold text-neutral-900 ${capitalize ? 'capitalize' : ''}`}>{value}</div>
    </div>
  );
}
