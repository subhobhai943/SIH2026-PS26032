'use client';

import { Card } from '@/components/ui';
import { IconArrowRight, IconBell, IconCalendar, IconPhone, IconQueue, IconStatus, IconTruck } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function HomePage() {
  const { t } = useTranslation();

  const steps = [
    { title: t('home_step1Title'), desc: t('home_step1Desc'), href: '/register', icon: IconPhone },
    { title: t('home_step2Title'), desc: t('home_step2Desc'), href: '/booking', icon: IconCalendar },
    { title: t('home_step3Title'), desc: t('home_step3Desc'), href: '/queue', icon: IconQueue },
    { title: t('home_step4Title'), desc: t('home_step4Desc'), href: '/status', icon: IconStatus },
  ];

  const highlights = [
    { label: t('home_feat1Label'), desc: t('home_feat1Desc') },
    { label: t('home_feat2Label'), desc: t('home_feat2Desc') },
    { label: t('home_feat3Label'), desc: t('home_feat3Desc') },
    { label: t('home_feat4Label'), desc: t('home_feat4Desc') },
  ];

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-16 text-white sm:px-12 sm:py-20 shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wide">
            {t('home_tag')}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t('home_heroTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-brand-50 sm:text-lg">
            {t('home_heroDesc')}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row flex-wrap">
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50 active:scale-[0.99]"
            >
              {t('home_getStarted')} <IconArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/queue"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20 active:scale-[0.99]"
            >
              {t('home_viewLiveQueue')}
            </a>
            <a
              href="/tracking"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-neutral-950 shadow-lg transition hover:bg-amber-300 active:scale-[0.99]"
            >
              <IconTruck className="h-4 w-4 text-neutral-950" />
              {t('nav_trackOrder')}
            </a>
          </div>
        </div>
      </section>

      {/* 3rd-Party Logistics & Tracking Callout Banner */}
      <Card className="p-5 sm:p-6 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white shadow-lg border-neutral-700">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
              <IconTruck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                  New Feature
                </span>
                <span className="text-xs text-neutral-400">Delhivery · BlackBuck · TCI · Rivigo</span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                {t('track_pageTitle')} & 20% Advance Guarantee
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5 max-w-xl">
                {t('track_pageSubtitle')}
              </p>
            </div>
          </div>
          <a
            href="/tracking"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-brand-500 shrink-0"
          >
            <span>{t('track_btnTrackNow')}</span>
            <IconArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>

      <section>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t('home_howItWorks')}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{t('home_fourSteps')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <a key={step.title} href={step.href} className="group block">
              <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-neutral-300">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{step.desc}</p>
              </Card>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-8 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 lg:grid-cols-2 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t('home_builtForTag')}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            {t('home_builtForHeading')}
          </h2>
          <p className="mt-3 text-sm text-neutral-500">
            {t('home_builtForDesc')}
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
            <IconBell className="h-4 w-4 text-brand-600 shrink-0" />
            {t('home_smsAlertNote')}
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {highlights.map((h) => (
            <div key={h.label} className="rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
              <dt className="text-sm font-semibold text-neutral-900">{h.label}</dt>
              <dd className="mt-1 text-xs text-neutral-500">{h.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
