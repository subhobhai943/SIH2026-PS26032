'use client';

import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Alert, Card, EmptyState, PageHeader, StatTile, StatusBadge } from '@/components/ui';
import { IconClock, IconMapPin, IconQueue } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { prefersReducedMotion } from '@/lib/animations';

type Center = { _id: string; name: string; district: string };
type BoardEntry = {
  token: number;
  status: string;
  position: number;
  estimatedWaitLabel: string;
  farmerName: string;
  village: string;
  slot: string;
};
type Board = {
  center: { name: string };
  date: string;
  nowServing: { token: number } | null;
  waiting: BoardEntry[];
  counts: { total: number; waiting: number; completed: number; cancelled: number };
};

export default function QueuePage() {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const servingBadgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (board && !prefersReducedMotion()) {
      if (servingBadgeRef.current) {
        gsap.fromTo(
          servingBadgeRef.current,
          { scale: 0.88, opacity: 0.8 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
        );
      }
      gsap.from('.queue-row', {
        opacity: 0,
        x: -10,
        stagger: 0.035,
        duration: 0.3,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      });
    }
  }, [board?.nowServing?.token, board?.waiting.length]);


  useEffect(() => {
    api.get<Center[]>('/centers').then(setCenters).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!centerId) return;
    api
      .get<Board>(`/queue/${centerId}?date=${date}`)
      .then(setBoard)
      .catch((e) => setError(e.message));

    const socket = getSocket();
    setConnected(socket.connected);
    socket.emit('queue:watch', { centerId, date });
    const onUpdate = (data: Board) => setBoard(data);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('queue:update', onUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.emit('queue:unwatch', { centerId, date });
      socket.off('queue:update', onUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [centerId, date]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow={t('queue_eyebrow')}
          title={t('queue_title')}
          subtitle={t('queue_subtitle')}
        />
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-400'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-brand-500 animate-pulse' : 'bg-neutral-300'}`} />
          {connected ? t('queue_liveConnected') : 'Connecting…'}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      <select
        value={centerId}
        onChange={(e) => setCenterId(e.target.value)}
        className="w-full max-w-md rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-sm"
      >
        <option value="">{t('queue_selectCenterPrompt')}</option>
        {centers.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name} — {c.district}
          </option>
        ))}
      </select>

      {!centerId && (
        <EmptyState icon={<IconQueue className="h-10 w-10" />} title={t('queue_selectCenterPrompt')} />
      )}

      {board && (
        <div ref={boardRef} className="space-y-5">
          <Card className="flex flex-col items-center gap-4 bg-gradient-to-br from-brand-600 to-brand-700 p-5 sm:p-8 text-center text-white sm:flex-row sm:justify-between sm:text-left shadow-lg">
            <div className="flex items-center gap-2 text-sm text-brand-50">
              <IconMapPin className="h-4 w-4" /> {board.center.name} · {board.date}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                {board.nowServing && <span className="absolute inset-0 rounded-full bg-white/40 animate-pulse-ring" />}
                <div
                  ref={servingBadgeRef}
                  className="relative rounded-full bg-white/15 px-6 py-3 ring-1 ring-inset ring-white/30 backdrop-blur-md"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-100">
                    {t('queue_nowServing')}
                  </div>
                  <div className="text-3xl font-extrabold">{board.nowServing ? `#${board.nowServing.token}` : '—'}</div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile label={t('queue_waiting')} value={String(board.counts.waiting)} />
            <StatTile label={t('queue_completed')} value={String(board.counts.completed)} />
            <StatTile label={t('queue_total')} value={String(board.counts.total)} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700">
              {t('queue_waiting')}
            </div>
            {board.waiting.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={<IconQueue className="h-8 w-8" />} title={t('queue_noOneWaiting')} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-5 py-2.5">{t('queue_token')}</th>
                      <th className="px-5 py-2.5">{t('queue_farmer')}</th>
                      <th className="px-5 py-2.5">Slot</th>
                      <th className="px-5 py-2.5">{t('queue_status')}</th>
                      <th className="px-5 py-2.5">Position</th>
                      <th className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="h-3.5 w-3.5" /> {t('queue_estWait')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.waiting.map((entry) => (
                      <tr key={entry.token} className="queue-row border-t border-neutral-100 hover:bg-neutral-50/50">
                        <td className="px-5 py-3 font-semibold text-neutral-900">#{entry.token}</td>
                        <td className="px-5 py-3">
                          {entry.farmerName} <span className="text-neutral-400">· {entry.village || '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-neutral-500">{entry.slot}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-5 py-3 text-neutral-500">{entry.position}</td>
                        <td className="px-5 py-3 font-medium text-neutral-700">{entry.estimatedWaitLabel}</td>
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
