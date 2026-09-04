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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-extrabold text-neutral-900 shadow-xl transition-all duration-200 hover:bg-neutral-100 hover:text-black hover:shadow-2xl active:scale-[0.98] border border-white"
            >
              <span className="text-neutral-900 font-extrabold">{t('home_getStarted')}</span>
              <IconArrowRight className="h-4 w-4 text-neutral-900 stroke-[2.5]" />
            </a>
            <a
              href="/queue"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20 active:scale-[0.99]"
            >
              {t('home_viewLiveQueue')}
            </a>
            <a
              href="/tracking"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20 active:scale-[0.99]"
            >
              <IconTruck className="h-4 w-4" />
              {t('nav_trackOrder')}
            </a>
          </div>
        </div>
      </section>

      {/* Official Government Procurement Framework Banner */}
      <Card className="p-6 sm:p-8 bg-white border-neutral-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800 border border-brand-200">
                Government Procurement Mandate
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                Ministry of Consumer Affairs, Food & Public Distribution
              </span>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 tracking-tight">
              20% DBT Safety Advance Guarantee & Mandated Logistics Transport
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Under Problem Statement PS26032, this platform resolves long Mandi waiting hours, eliminates schedule uncertainty, and secures farmer income. Authorized 3rd-party logistics agencies transport procured grain directly to FCI and Central Warehousing Corporation (CWC) buffer depots.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 text-center">
              <div className="text-lg font-extrabold text-brand-700">20% DBT</div>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">Upfront Advance</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 text-center">
              <div className="text-lg font-extrabold text-neutral-800">100% Digital</div>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">Token Scheduling</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200 text-center col-span-2 sm:col-span-1">
              <div className="text-lg font-extrabold text-emerald-700">GPS Sealed</div>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">Buffer Transport</div>
            </div>
          </div>
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
