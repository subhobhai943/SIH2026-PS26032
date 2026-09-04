'use client';

import { Card } from '@/components/ui';
import { IconArrowRight, IconBell, IconCalendar, IconPhone, IconQueue, IconStatus, IconTruck, IconStar } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useGsapContext } from '@/lib/animations';
import gsap from 'gsap';

export default function HomePage() {
  const { t } = useTranslation();

  const containerRef = useGsapContext(() => {
    try {
      gsap.fromTo('.hero-badge', { y: -12, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.hero-title', { y: 16, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.hero-desc', { y: 12, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.hero-btn', { y: 10, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.procurement-banner', { y: 16, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.step-card', { y: 14, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.review-card', { y: 14, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'all' });
      gsap.fromTo('.highlight-item', { y: 12, opacity: 0.7 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'all' });
    } catch (err) {
      console.warn('HomePage GSAP animations skipped:', err);
    }
  }, []);

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
    <div ref={containerRef} className="space-y-8 sm:space-y-16">
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-10 sm:px-12 sm:py-20 text-white shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="hero-badge inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
            {t('home_tag')}
          </span>
          <h1 className="hero-title mt-4 sm:mt-5 text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            {t('home_heroTitle')}
          </h1>
          <p className="hero-desc mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-lg text-brand-50">
            {t('home_heroDesc')}
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:justify-center gap-3 sm:gap-3.5 flex-wrap items-center">
            {/* Primary Action: Get Started / Book Slot */}
            <a
              href="/register"
              className="hero-btn w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-white px-6 sm:px-8 py-3.5 sm:py-4 text-base font-extrabold text-neutral-900 shadow-xl transition-all duration-200 hover:bg-neutral-100 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] border-2 border-white ring-2 ring-white/30"
            >
              <span className="text-neutral-900 font-extrabold">{t('home_getStarted')}</span>
              <IconArrowRight className="h-5 w-5 text-neutral-900 stroke-[2.5]" />
            </a>

            {/* Secondary Action: Live Queue */}
            <a
              href="/queue"
              className="hero-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 sm:px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition-all duration-200 hover:bg-neutral-900 hover:-translate-y-0.5 active:scale-[0.98] border border-neutral-700"
            >
              <IconQueue className="h-4 w-4 text-emerald-400" />
              <span>{t('home_viewLiveQueue')}</span>
            </a>

            {/* Secondary Action: Track Produce & Logistics */}
            <a
              href="/tracking"
              className="hero-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 sm:px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition-all duration-200 hover:bg-emerald-950 hover:-translate-y-0.5 active:scale-[0.98] border border-emerald-600"
            >
              <IconTruck className="h-4 w-4 text-emerald-300" />
              <span>{t('nav_trackOrder')}</span>
            </a>

            {/* Tertiary Action: Verified Buyer Reviews */}
            <a
              href="/reviews"
              className="hero-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 sm:px-6 py-3.5 text-sm sm:text-base font-extrabold text-neutral-950 shadow-lg transition-all duration-200 hover:bg-amber-300 hover:-translate-y-0.5 active:scale-[0.98] border border-amber-300"
            >
              <IconStar className="h-4 w-4 fill-neutral-950" filled />
              <span>Buyer Reviews</span>
            </a>
          </div>
        </div>
      </section>

      {/* Official Government Procurement Framework Banner */}
      <Card className="procurement-banner p-4 sm:p-8 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2 max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-brand-50 dark:bg-brand-950/60 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-brand-800 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                Government Procurement
              </span>
              <span className="hidden sm:inline text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Ministry of Consumer Affairs, Food & Public Distribution
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              20% DBT Safety Advance & Mandated Logistics
            </h3>
            <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Under the National e-Procurement Mandate, this platform resolves long Mandi waiting hours, eliminates schedule uncertainty, and secures farmer income.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/80 p-2.5 sm:p-3 border border-neutral-200 dark:border-neutral-700 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-brand-700 dark:text-brand-400">20% DBT</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Advance</div>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/80 p-2.5 sm:p-3 border border-neutral-200 dark:border-neutral-700 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-neutral-800 dark:text-neutral-200">Digital</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Token</div>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/80 p-2.5 sm:p-3 border border-neutral-200 dark:border-neutral-700 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400">GPS</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Transport</div>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{t('home_howItWorks')}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{t('home_fourSteps')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <a key={step.title} href={step.href} className="step-card group block">
              <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-brand-300 dark:group-hover:border-brand-600 group-hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-neutral-300 dark:text-neutral-600">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{step.title}</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{step.desc}</p>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* Verified Buyer Reviews & Producer Reputation Spotlight */}
      <section className="rounded-2xl sm:rounded-3xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/40 to-white dark:from-neutral-900 dark:to-neutral-900 p-4 sm:p-10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 sm:px-2.5 py-0.5 rounded-full mb-1.5 border border-amber-200 dark:border-amber-800/60">
              <IconStar className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-700 dark:fill-amber-400" filled />
              <span>Grain Quality & Buyer Satisfaction</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Verified Buyer Reviews
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Institutional purchasers submit direct quality ratings.
            </p>
          </div>

          <a
            href="/reviews"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold shadow transition shrink-0 w-full sm:w-auto"
          >
            <span>Explore All Reviews</span>
            <IconArrowRight className="h-4 w-4 stroke-[2.5]" />
          </a>
        </div>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <div className="review-card rounded-2xl bg-white dark:bg-neutral-900 p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Vikramaditya Roy</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  ★ 5.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Quality Officer · FCI</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700 dark:text-brand-400">Lot: 40 Qtl Sharbati Wheat</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                &ldquo;Moisture at 10.4%, well below ceiling. Zero foreign matter. Prompt delivery.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ Low Moisture</span>
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ Grade A</span>
            </div>
          </div>

          <div className="review-card rounded-2xl bg-white dark:bg-neutral-900 p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Rajesh Singhania</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  ★ 5.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">VP · Shivalik Flour Mills</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700 dark:text-brand-400">Lot: 65 Qtl Wheat</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                &ldquo;High test weight (&gt;79 kg/hL) and uniform grain kernel. Ideal for chakki atta.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ High Test Weight</span>
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ Uniform Kernel</span>
            </div>
          </div>

          <div className="review-card rounded-2xl bg-white dark:bg-neutral-900 p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Anil Kumar Agarwal</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  ★ 4.9
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Director · Kuber Agro Rice Export</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700 dark:text-brand-400">Lot: 35 Qtl Basmati Paddy</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                &ldquo;Moisture at 13.1%, broken grain below 2.5%. Well sun-dried and free from chaff.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ Export Quality</span>
              <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">✓ Clean Lot</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:gap-8 rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-10 lg:grid-cols-2 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{t('home_builtForTag')}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('home_builtForHeading')}
          </h2>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            {t('home_builtForDesc')}
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <IconBell className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
            {t('home_smsAlertNote')}
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {highlights.map((h) => (
            <div key={h.label} className="highlight-item rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 p-4 border border-neutral-100 dark:border-neutral-800">
              <dt className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{h.label}</dt>
              <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{h.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
