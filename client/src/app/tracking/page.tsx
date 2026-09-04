'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import gsap from 'gsap';
import { getToken, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { prefersReducedMotion } from '@/lib/animations';
import { Card, PageHeader, StatusBadge, Button, Alert, EmptyState } from '@/components/ui';
import {
  IconTruck,
  IconShieldCheck,
  IconPhone,
  IconCalendar,
  IconWheat,
  IconCheck,
  IconSpinner,
  IconStatus,
} from '@/components/icons';

interface Checkpoint {
  status: string;
  title: string;
  description?: string;
  location?: string;
  timestamp: string;
}

interface LogisticsPartner {
  name: string;
  serviceType?: string;
  awbNumber?: string;
  supportPhone?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  securitySealNumber?: string;
}

interface DestinationGodown {
  name: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

interface OriginCenter {
  name: string;
  district?: string;
  state?: string;
}

interface ShipmentData {
  _id: string;
  orderId: string;
  trackingNumber: string;
  crop: string;
  quantityQtl: number;
  cropGrade?: string;
  status: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  advanceSecured?: boolean;
  advanceAmount?: number;
  totalAmount?: number;
  originCenter?: OriginCenter;
  destinationGodown?: DestinationGodown;
  logisticsPartner?: LogisticsPartner;
  checkpoints: Checkpoint[];
  center?: { name: string; code: string; district: string };
  farmer?: { name: string; phone: string; village: string };
  queueEntry?: string;
}

const STAGES = [
  { key: 'order_confirmed', labelKey: 'track_stageOrderConfirmed' },
  { key: 'produce_dispatched', labelKey: 'track_stageDispatched' },
  { key: 'picked_up', labelKey: 'track_stagePickedUp' },
  { key: 'in_transit', labelKey: 'track_stageInTransit' },
  { key: 'out_for_delivery', labelKey: 'track_stageOutForDelivery' },
  { key: 'delivered', labelKey: 'track_stageDelivered' },
] as const;

function TrackingContent() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id') || searchParams.get('trk') || searchParams.get('order') || '';
  const { t } = useTranslation();
  const router = useRouter();

  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const trackingDetailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedShipment && trackingDetailsRef.current && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          trackingDetailsRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' }
        );
        gsap.fromTo(
          '.checkpoint-item',
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
        console.warn('Tracking animation skipped:', err);
      }
    }
  }, [selectedShipment?._id]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsAuth(false);
      setLoading(false);
      return;
    }

    setIsAuth(true);
    setLoading(true);
    setError(null);

    api.get<ShipmentData[]>('/shipments/my-shipments')
      .then((data) => {
        setShipments(data || []);
        if (data && data.length > 0) {
          if (requestedId) {
            const match = data.find(
              (s) =>
                s._id === requestedId ||
                s.queueEntry === requestedId ||
                s.trackingNumber.toLowerCase() === requestedId.toLowerCase() ||
                s.orderId.toLowerCase() === requestedId.toLowerCase()
            );
            setSelectedShipment(match || data[0]);
          } else {
            setSelectedShipment(data[0]);
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to retrieve consignment records');
      })
      .finally(() => setLoading(false));
  }, [requestedId]);

  // If farmer is not logged in: Show official secure authentication gate
  if (isAuth === false) {
    return (
      <div className="mx-auto max-w-xl py-6 sm:py-12 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-semibold text-brand-800 border border-brand-200">
            Government of India · Ministry of Consumer Affairs, Food & Public Distribution
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            {t('track_authRequired')}
          </h1>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            {t('track_authRequiredDesc')}
          </p>
        </div>

        <Card className="p-6 sm:p-8 bg-white shadow-md border-neutral-200 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-700 mx-auto flex items-center justify-center shadow-sm">
            <IconShieldCheck className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-neutral-900 text-base">
              Secure Procurement Dossier & Consignment Tracking
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
              Access your Mandi gate pass, weighed quintals, 20% DBT safety advance payment reference, and authorized logistics carrier movements.
            </p>
          </div>

          <div className="pt-2">
            <Button
              size="md"
              onClick={() => router.push('/register?redirect=/tracking')}
              className="w-full sm:w-auto px-8 py-3 font-bold flex items-center justify-center gap-2 mx-auto"
            >
              <IconPhone className="h-4 w-4" />
              <span>{t('track_signInBtn')}</span>
            </Button>
          </div>

          <div className="border-t border-neutral-100 pt-4 grid grid-cols-2 gap-3 text-left text-xs text-neutral-600">
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200">
              <span className="font-bold text-neutral-900 block mb-0.5">DBT Advance Guarantee</span>
              20% upfront payment verified through state treasury ledger.
            </div>
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200">
              <span className="font-bold text-neutral-900 block mb-0.5">Authorized Fleet Transport</span>
              Delhivery, BlackBuck, TCI & Rivigo carriers with GPS digital security seals.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const currentStageIndex = selectedShipment
    ? STAGES.findIndex((s) => s.key === selectedShipment.status)
    : -1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Department of Food & Public Distribution · National Procurement Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
            {t('track_pageTitle')}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Official consignment monitoring, contracted 3rd-party logistics transport, and 20% DBT advance guarantee records.
          </p>
        </div>

        <a
          href="/booking"
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-800 shadow-sm hover:bg-neutral-50 shrink-0 self-start sm:self-auto"
        >
          <IconCalendar className="h-4 w-4 text-brand-600" />
          <span>{t('nav_bookSlot')}</span>
        </a>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading && (
        <div className="py-20 text-center text-neutral-400">
          <IconSpinner className="h-8 w-8 mx-auto mb-3 text-brand-600" />
          <p className="text-sm font-medium">Loading your official procurement records...</p>
        </div>
      )}

      {!loading && shipments.length === 0 && (
        <EmptyState
          icon={<IconTruck className="h-10 w-10 text-neutral-400" />}
          title={t('track_noConsignments')}
          description={t('track_bookSlotPrompt')}
        />
      )}

      {/* Authenticated Consignments Layout */}
      {!loading && shipments.length > 0 && selectedShipment && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Farmer's Active Consignments */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Your Procurement Consignments ({shipments.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {shipments.map((s) => {
                const isSelected = s._id === selectedShipment._id;
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => setSelectedShipment(s)}
                    className="w-full text-left focus:outline-none"
                  >
                    <Card
                      className={`p-4 transition ${
                        isSelected
                          ? 'border-brand-600 ring-2 ring-brand-500/20 bg-brand-50/20 shadow-sm'
                          : 'hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-neutral-900 text-sm">
                          {s.crop} · {s.quantityQtl} Qtl
                        </span>
                        <StatusBadge status={s.status} />
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                        <span>{s.orderId}</span>
                        <span className="font-mono text-neutral-600">{s.trackingNumber}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>{s.originCenter?.name || 'Mandi Hub'}</span>
                        <span className="font-semibold text-emerald-700">
                          ₹{s.advanceAmount?.toLocaleString()} Advance DBT
                        </span>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Consignment Dossier & Live Checkpoints */}
          <div ref={trackingDetailsRef} className="lg:col-span-2 space-y-5">
            {/* Consignment Header Card */}
            <Card className="p-5 sm:p-6 bg-white shadow-sm border-neutral-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-200">
                      {selectedShipment.orderId}
                    </span>
                    <span className="text-xs font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-200">
                      AWB: {selectedShipment.trackingNumber}
                    </span>
                    <StatusBadge status={selectedShipment.status} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 mt-2">
                    {selectedShipment.crop} · {selectedShipment.quantityQtl} Quintals (Grade {selectedShipment.cropGrade || 'A'})
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Farmer: <strong className="text-neutral-800">{selectedShipment.farmer?.name}</strong> ({selectedShipment.farmer?.village || 'Verified Farmer'})
                  </p>
                </div>

                {/* 20% Direct Benefit Transfer (DBT) Advance Guarantee */}
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-right shrink-0">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-end gap-1">
                    <IconShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>20% DBT Advance Secured</span>
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 mt-0.5">
                    ₹{selectedShipment.advanceAmount?.toLocaleString() || 'Secured'}
                  </div>
                  <div className="text-[10px] text-emerald-700/80">
                    Credited to Bank Account
                  </div>
                </div>
              </div>

              {/* Transit Hubs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl p-3 bg-neutral-50 border border-neutral-200">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    {t('track_origin')}
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">
                    {selectedShipment.originCenter?.name || selectedShipment.center?.name || 'Mandi Centre'}
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">
                    {selectedShipment.originCenter?.district || 'APMC Mandi'}
                  </div>
                </div>

                <div className="rounded-xl p-3 bg-brand-50/40 border border-brand-200 text-center flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-brand-800 uppercase tracking-wider">
                    {t('track_currentLocation')}
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">
                    {selectedShipment.currentLocation || 'In Transit Corridor'}
                  </div>
                  <div className="text-brand-600 text-[11px] mt-0.5">
                    GPS Active Checkpoint
                  </div>
                </div>

                <div className="rounded-xl p-3 bg-neutral-50 border border-neutral-200">
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    {t('track_destination')}
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">
                    {selectedShipment.destinationGodown?.name || 'Central Silo Complex'}
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-0.5">
                    {selectedShipment.destinationGodown?.district || 'Karnal'}, {selectedShipment.destinationGodown?.state || 'Haryana'}
                  </div>
                </div>
              </div>

              {/* Formal Progress Stepper */}
              <div className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {STAGES.map((s, idx) => {
                    const isCompleted = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;

                    return (
                      <div key={s.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-brand-600 text-white ring-4 ring-brand-100 font-extrabold'
                              : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                          }`}
                        >
                          {isCompleted ? <IconCheck className="h-4 w-4" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[11px] mt-1.5 leading-snug ${
                            isCurrent
                              ? 'font-bold text-brand-800'
                              : isCompleted
                              ? 'font-semibold text-neutral-800'
                              : 'text-neutral-400'
                          }`}
                        >
                          {t(s.labelKey as any)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* 2-Column: Carrier Specifications & Live Movement Log */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 3rd-Party Transport Carrier Details */}
              <Card className="p-5 bg-white shadow-sm border-neutral-200 space-y-3.5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Mandated 3rd-Party Logistics Provider
                  </span>
                  <span className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                    Contracted Carrier
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-neutral-900 text-base">
                    {selectedShipment.logisticsPartner?.name || 'Delhivery Agri Logistics'}
                  </h4>
                  <p className="text-xs text-neutral-500">
                    {selectedShipment.logisticsPartner?.serviceType || 'Dedicated Full Truckload (FTL)'}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{t('track_vehicle')}:</span>
                    <strong className="font-mono text-neutral-900 text-sm">
                      {selectedShipment.logisticsPartner?.vehicleNumber || 'HR 05 BA 4421'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-neutral-600 text-[11px]">
                    <span>Carrier Type:</span>
                    <span>{selectedShipment.logisticsPartner?.vehicleType || '16-Ton Multi-Axle Covered Carrier'}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-600 text-[11px] pt-1 border-t border-neutral-200">
                    <span>{t('track_digitalSeal')}:</span>
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {selectedShipment.logisticsPartner?.securitySealNumber || 'SEAL-IND-88421'}
                    </span>
                  </div>
                </div>

                {/* Driver Contact */}
                <div className="rounded-xl border border-neutral-200 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-neutral-400">
                      {t('track_driver')}
                    </div>
                    <div className="font-bold text-neutral-900 text-sm">
                      {selectedShipment.logisticsPartner?.driverName || 'Authorized Driver'}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono">
                      {selectedShipment.logisticsPartner?.driverPhone || '+91 98765 43210'}
                    </div>
                  </div>
                  {selectedShipment.logisticsPartner?.driverPhone && (
                    <a
                      href={`tel:${selectedShipment.logisticsPartner.driverPhone}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-neutral-800 transition"
                    >
                      <IconPhone className="h-3.5 w-3.5" />
                      <span>{t('track_callDriver')}</span>
                    </a>
                  )}
                </div>
              </Card>

              {/* Movement Checkpoints */}
              <Card className="p-5 bg-white shadow-sm border-neutral-200">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5 mb-4">
                  <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                    {t('track_checkpointsTitle')}
                  </h4>
                  <span className="text-[11px] text-neutral-400">
                    {selectedShipment.checkpoints.length} Checkpoints Logged
                  </span>
                </div>

                <ol className="space-y-0">
                  {selectedShipment.checkpoints.slice().reverse().map((cp, idx) => {
                    const isLatest = idx === 0;

                    return (
                      <li key={idx} className="checkpoint-item relative flex gap-3 pb-5 last:pb-1">
                        {idx < selectedShipment.checkpoints.length - 1 && (
                          <span className="absolute left-3 top-6 h-full w-0.5 -translate-x-1/2 bg-neutral-200" />
                        )}
                        <span
                          className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isLatest
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-300'
                          }`}
                        >
                          {isLatest ? '✓' : idx + 1}
                        </span>
                        <div className="flex-1 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                            <span className={`font-bold ${isLatest ? 'text-neutral-900' : 'text-neutral-700'}`}>
                              {cp.title}
                            </span>
                            <time className="text-[10px] text-neutral-400 shrink-0">
                              {new Date(cp.timestamp).toLocaleString()}
                            </time>
                          </div>
                          {cp.location && (
                            <div className="mt-0.5 text-[11px] font-semibold text-brand-700">
                              Checkpoint: {cp.location}
                            </div>
                          )}
                          {cp.description && (
                            <p className="mt-0.5 text-neutral-600 leading-relaxed text-[11px]">
                              {cp.description}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading Tracking Dossier...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
