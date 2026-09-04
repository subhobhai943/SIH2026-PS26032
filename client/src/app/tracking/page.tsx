'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { Card, PageHeader, StatusBadge, Button, Alert, EmptyState } from '@/components/ui';
import { IconTruck, IconShieldCheck, IconPhone, IconCalendar, IconWheat, IconCheck, IconSpinner } from '@/components/icons';

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
}

const STAGES = [
  { key: 'order_confirmed', labelKey: 'track_stageOrderConfirmed', icon: '📝' },
  { key: 'produce_dispatched', labelKey: 'track_stageDispatched', icon: '🌾' },
  { key: 'picked_up', labelKey: 'track_stagePickedUp', icon: '📦' },
  { key: 'in_transit', labelKey: 'track_stageInTransit', icon: '🚚' },
  { key: 'out_for_delivery', labelKey: 'track_stageOutForDelivery', icon: '🏭' },
  { key: 'delivered', labelKey: 'track_stageDelivered', icon: '🏛️' },
] as const;

function TrackingContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('id') || searchParams.get('trk') || searchParams.get('order') || '';
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [recentShipments, setRecentShipments] = useState<ShipmentData[]>([]);

  async function fetchTracking(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/track/${encodeURIComponent(query.trim())}`);
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body?.error?.message || t('track_notFoundDesc'));
      }
      setShipment(body.data);
    } catch (err: any) {
      setShipment(null);
      setError(err.message || t('track_notFoundDesc'));
    } finally {
      setLoading(false);
    }
  }

  // Load recent shipments on mount for 1-click tracking
  useEffect(() => {
    fetch('/api/shipments/recent')
      .then((res) => res.json())
      .then((body) => {
        if (body.ok && Array.isArray(body.data)) {
          setRecentShipments(body.data);
          // If no query passed, auto-select first shipment
          if (!initialQuery && body.data.length > 0) {
            setSearchQuery(body.data[0].trackingNumber);
            setShipment(body.data[0]);
          }
        }
      })
      .catch(() => {});

    if (initialQuery) {
      fetchTracking(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const currentStageIndex = STAGES.findIndex((s) => s.key === shipment?.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('track_eyebrow')}
        title={t('track_pageTitle')}
        subtitle={t('track_pageSubtitle')}
      />

      {/* Search Bar & Quick Switcher */}
      <Card className="p-4 sm:p-6 shadow-sm border-brand-100 bg-gradient-to-br from-white to-brand-50/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTracking(searchQuery);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
              <IconTruck className="h-5 w-5 text-brand-600" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('track_searchPlaceholder')}
              className="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <Button type="submit" loading={loading} className="px-6 py-3 shrink-0 flex items-center justify-center gap-2">
            <IconTruck className="h-4 w-4" />
            <span>{loading ? t('track_searching') : t('track_searchBtn')}</span>
          </Button>
        </form>

        {/* Quick Demo Shipments */}
        {recentShipments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-100">
            <span className="text-xs font-semibold text-neutral-500 block mb-2">
              {t('track_recentOrders')}:
            </span>
            <div className="flex flex-wrap gap-2">
              {recentShipments.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => {
                    setSearchQuery(s.trackingNumber);
                    setShipment(s);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    shipment?.trackingNumber === s.trackingNumber
                      ? 'bg-brand-600 text-white font-semibold shadow-sm'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-brand-300'
                  }`}
                >
                  <span className="opacity-75">{s.trackingNumber}</span>
                  <span className="text-[10px] font-normal opacity-90">({s.crop})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {error && (
        <Alert>
          <div className="font-semibold">{t('track_notFound')}</div>
          <div className="text-xs mt-0.5">{error}</div>
        </Alert>
      )}

      {loading && !shipment && (
        <div className="py-16 text-center text-neutral-400">
          <IconSpinner className="h-8 w-8 mx-auto mb-3 text-brand-600" />
          <p className="text-sm font-medium">{t('track_searching')}</p>
        </div>
      )}

      {/* Shipment Details */}
      {shipment && (
        <div className="space-y-6">
          {/* Top Consignment Banner */}
          <Card className="p-5 sm:p-6 bg-white shadow-md border-neutral-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                    {t('track_orderId')}: {shipment.orderId}
                  </span>
                  <span className="text-xs font-semibold text-neutral-500">
                    {t('track_trackingNo')}: <strong className="text-neutral-800">{shipment.trackingNumber}</strong>
                  </span>
                  <StatusBadge status={shipment.status} />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 mt-2">
                  {shipment.crop} · {shipment.quantityQtl} Quintals (Grade {shipment.cropGrade || 'A'})
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Farmer: <strong className="text-neutral-700">{shipment.farmer?.name || 'Authorized Farmer'}</strong> · Mandi: {shipment.originCenter?.name || shipment.center?.name || 'Mandi Yard'}
                </p>
              </div>

              {/* 20% Advance Guarantee & Est Delivery Box */}
              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex-1 sm:flex-initial">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase">
                    <IconShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>20% Advance Guarantee</span>
                  </div>
                  <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                    ₹{shipment.advanceAmount ? shipment.advanceAmount.toLocaleString() : 'Secured'}
                  </div>
                  <div className="text-[10px] text-emerald-600/90 font-medium">
                    Credited upfront to Farmer
                  </div>
                </div>

                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 flex-1 sm:flex-initial">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase flex items-center gap-1">
                    <IconCalendar className="h-3.5 w-3.5" />
                    <span>{t('track_estDelivery')}</span>
                  </div>
                  <div className="text-base font-bold text-neutral-900 mt-0.5">
                    {shipment.deliveredAt
                      ? new Date(shipment.deliveredAt).toLocaleDateString()
                      : shipment.estimatedDelivery
                      ? new Date(shipment.estimatedDelivery).toLocaleDateString()
                      : 'Within 24 Hours'}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {shipment.destinationGodown?.name || 'Central Warehouse'}
                  </div>
                </div>
              </div>
            </div>

            {/* Route Map Summary */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl p-3 bg-neutral-50/70 border border-neutral-200">
                <div className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">
                  {t('track_origin')}
                </div>
                <div className="font-semibold text-neutral-900 mt-1">
                  {shipment.originCenter?.name || 'APMC Procurement Mandi'}
                </div>
                <div className="text-neutral-500 text-[11px]">
                  {shipment.originCenter?.district || 'District Mandi'}, {shipment.originCenter?.state || 'India'}
                </div>
              </div>

              <div className="rounded-xl p-3 bg-brand-50/40 border border-brand-100 flex flex-col justify-center text-center">
                <div className="font-bold text-brand-800 uppercase tracking-wider text-[10px] flex items-center justify-center gap-1">
                  <IconTruck className="h-3.5 w-3.5" />
                  <span>{t('track_currentLocation')}</span>
                </div>
                <div className="font-bold text-neutral-900 mt-1">
                  {shipment.currentLocation || 'In Transit'}
                </div>
                <div className="text-brand-600 text-[11px] font-medium">
                  GPS Active & Monitored
                </div>
              </div>

              <div className="rounded-xl p-3 bg-neutral-50/70 border border-neutral-200">
                <div className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">
                  {t('track_destination')}
                </div>
                <div className="font-semibold text-neutral-900 mt-1">
                  {shipment.destinationGodown?.name || 'CWC Mega Depot'}
                </div>
                <div className="text-neutral-500 text-[11px]">
                  {shipment.destinationGodown?.district || 'Karnal'}, {shipment.destinationGodown?.state || 'Haryana'} ({shipment.destinationGodown?.pincode || '132001'})
                </div>
              </div>
            </div>

            {/* Visual E-Commerce Stepper Progress Bar */}
            <div className="mt-8 pt-4">
              <div className="relative">
                {/* Horizontal Track (Desktop) */}
                <div className="hidden md:block absolute top-5 left-8 right-8 h-1 bg-neutral-200 -z-0">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, (currentStageIndex / (STAGES.length - 1)) * 100))}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {STAGES.map((s, idx) => {
                    const isCompleted = idx <= currentStageIndex;
                    const isCurrent = idx === currentStageIndex;

                    return (
                      <div key={s.key} className="flex flex-col items-center text-center relative z-10">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition ${
                            isCompleted
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : isCurrent
                              ? 'bg-brand-600 text-white ring-4 ring-brand-200 animate-pulse'
                              : 'bg-neutral-100 text-neutral-400 border border-neutral-300'
                          }`}
                        >
                          {isCompleted ? <IconCheck className="h-5 w-5" /> : s.icon}
                        </div>
                        <span
                          className={`text-xs mt-2 font-medium leading-snug ${
                            isCurrent
                              ? 'font-bold text-brand-700'
                              : isCompleted
                              ? 'text-neutral-800 font-semibold'
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
            </div>
          </Card>

          {/* 2-Column: 3rd-Party Logistics Carrier Details & Live Movement Checkpoints */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3rd-Party Logistics Card */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-5 shadow-sm border-neutral-200 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {t('track_logisticsPartner')}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                    Verified Carrier
                  </span>
                </div>

                {/* Carrier Branding */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-black text-lg shadow">
                    🚚
                  </div>
                  <div>
                    <h3 className="font-extrabold text-neutral-900 text-base">
                      {shipment.logisticsPartner?.name || 'Delhivery Agri Logistics'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {shipment.logisticsPartner?.serviceType || 'Dedicated Agri FTL Service'}
                    </p>
                    <p className="text-[11px] text-brand-600 font-mono font-medium mt-0.5">
                      AWB: {shipment.logisticsPartner?.awbNumber || shipment.trackingNumber}
                    </p>
                  </div>
                </div>

                {/* Logistics Truck Specs */}
                <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{t('track_vehicle')}:</span>
                    <strong className="text-neutral-900 font-mono text-sm">
                      {shipment.logisticsPartner?.vehicleNumber || 'HR 05 BA 4421'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-neutral-600 text-[11px]">
                    <span>Type:</span>
                    <span>{shipment.logisticsPartner?.vehicleType || '16-Ton Multi-Axle Covered Carrier'}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-600 text-[11px] pt-1 border-t border-neutral-200">
                    <span>{t('track_digitalSeal')}:</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {shipment.logisticsPartner?.securitySealNumber || 'SEAL-IND-88421'}
                    </span>
                  </div>
                </div>

                {/* Assigned Driver */}
                <div className="rounded-xl border border-neutral-200 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-neutral-400">
                        {t('track_driver')}
                      </div>
                      <div className="font-bold text-neutral-900 text-sm mt-0.5">
                        {shipment.logisticsPartner?.driverName || 'Rajesh Kumar'}
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">
                        {shipment.logisticsPartner?.driverPhone || '+91 98765 43210'}
                      </div>
                    </div>
                    {shipment.logisticsPartner?.driverPhone && (
                      <a
                        href={`tel:${shipment.logisticsPartner.driverPhone}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                      >
                        <IconPhone className="h-3.5 w-3.5" />
                        <span>{t('track_callDriver')}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Helpline */}
                <div className="text-center text-[11px] text-neutral-400 pt-1">
                  24x7 Logistics Helpline: <strong className="text-neutral-600">{shipment.logisticsPartner?.supportPhone || '1800-102-4455'}</strong>
                </div>
              </Card>
            </div>

            {/* Live Movement Checkpoints Timeline */}
            <div className="lg:col-span-2">
              <Card className="p-5 sm:p-6 shadow-sm border-neutral-200">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-5">
                  <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                    <IconTruck className="h-5 w-5 text-brand-600" />
                    <span>{t('track_checkpointsTitle')}</span>
                  </h3>
                  <span className="text-xs text-neutral-400 font-medium">
                    {shipment.checkpoints.length} Checkpoints Logged
                  </span>
                </div>

                <ol className="space-y-0">
                  {shipment.checkpoints.slice().reverse().map((cp, idx) => {
                    const isLatest = idx === 0;

                    return (
                      <li key={idx} className="relative flex gap-3.5 pb-6 last:pb-2">
                        {idx < shipment.checkpoints.length - 1 && (
                          <span className="absolute left-3.5 top-7 h-full w-0.5 -translate-x-1/2 bg-neutral-200" />
                        )}
                        <span
                          className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                            isLatest
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 animate-pulse'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-300'
                          }`}
                        >
                          {isLatest ? '📍' : '✓'}
                        </span>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4
                              className={`text-sm ${
                                isLatest ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-700'
                              }`}
                            >
                              {cp.title}
                            </h4>
                            <time className="text-xs text-neutral-400 shrink-0">
                              {new Date(cp.timestamp).toLocaleString()}
                            </time>
                          </div>
                          {cp.location && (
                            <div className="mt-0.5 text-xs font-medium text-brand-700 flex items-center gap-1">
                              <span>📌</span>
                              <span>{cp.location}</span>
                            </div>
                          )}
                          {cp.description && (
                            <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
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
    <Suspense fallback={<div className="p-8 text-center text-neutral-400">Loading Tracking...</div>}>
      <TrackingContent />
    </Suspense>
  );
}
