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
      gsap.from('.hero-badge', { y: -16, opacity: 0, duration: 0.6, ease: 'back.out(1.8)' });
      gsap.from('.hero-title', { y: 24, opacity: 0, duration: 0.7, delay: 0.1, ease: 'power3.out' });
      gsap.from('.hero-desc', { y: 18, opacity: 0, duration: 0.7, delay: 0.2, ease: 'power3.out' });
      gsap.from('.hero-btn', { scale: 0.92, opacity: 0, duration: 0.5, delay: 0.3, stagger: 0.08, ease: 'back.out(1.5)' });
      gsap.from('.procurement-banner', { y: 28, opacity: 0, duration: 0.7, delay: 0.45, ease: 'power3.out' });
      gsap.from('.step-card', { y: 24, opacity: 0, duration: 0.6, delay: 0.55, stagger: 0.09, ease: 'power2.out' });
      gsap.from('.review-card', { y: 24, opacity: 0, duration: 0.6, delay: 0.65, stagger: 0.09, ease: 'power2.out' });
      gsap.from('.highlight-item', { y: 20, opacity: 0, duration: 0.5, delay: 0.75, stagger: 0.08, ease: 'power2.out' });
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
          <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:flex sm:flex-row sm:justify-center gap-2.5 sm:gap-3 sm:flex-wrap">
            <a
              href="/register"
              className="hero-btn col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 sm:px-7 py-3 sm:py-3.5 text-sm sm:text-base font-extrabold text-neutral-900 shadow-xl transition-all duration-200 hover:bg-neutral-100 hover:-translate-y-0.5 active:scale-[0.98] border border-white"
            >
              <span className="text-neutral-900 font-extrabold">{t('home_getStarted')}</span>
              <IconArrowRight className="h-4 w-4 text-neutral-900 stroke-[2.5]" />
            </a>
            <a
              href="/queue"
              className="hero-btn inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20 hover:-translate-y-0.5 active:scale-[0.99]"
            >
              {t('home_viewLiveQueue')}
            </a>
            <a
              href="/tracking"
              className="hero-btn inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20 hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <IconTruck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {t('nav_trackOrder')}
            </a>
            <a
              href="/reviews"
              className="hero-btn col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400/20 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-amber-200 ring-1 ring-inset ring-amber-400/50 transition hover:bg-amber-400/30 hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <IconStar className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-amber-300" filled />
              <span>Buyer Reviews</span>
            </a>
          </div>
        </div>
      </section>

      {/* Official Government Procurement Framework Banner */}
      <Card className="procurement-banner p-4 sm:p-8 bg-white border-neutral-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2 max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-brand-50 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-brand-800 border border-brand-200">
                Government Procurement
              </span>
              <span className="hidden sm:inline text-xs text-neutral-500 font-medium">
                Ministry of Consumer Affairs, Food & Public Distribution
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-neutral-900 tracking-tight">
              20% DBT Safety Advance & Mandated Logistics
            </h3>
            <p className="text-[11px] sm:text-xs text-neutral-600 leading-relaxed">
              Under the National e-Procurement Mandate, this platform resolves long Mandi waiting hours, eliminates schedule uncertainty, and secures farmer income.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="rounded-xl bg-neutral-50 p-2.5 sm:p-3 border border-neutral-200 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-brand-700">20% DBT</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 mt-0.5">Advance</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-2.5 sm:p-3 border border-neutral-200 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-neutral-800">Digital</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 mt-0.5">Token</div>
            </div>
            <div className="rounded-xl bg-neutral-50 p-2.5 sm:p-3 border border-neutral-200 text-center">
              <div className="text-sm sm:text-lg font-extrabold text-emerald-700">GPS</div>
              <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 mt-0.5">Transport</div>
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
            <a key={step.title} href={step.href} className="step-card group block">
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

      {/* Verified Buyer Reviews & Producer Reputation Spotlight */}
      <section className="rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white p-4 sm:p-10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-100 px-2 sm:px-2.5 py-0.5 rounded-full mb-1.5">
              <IconStar className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-700" filled />
              <span>Grain Quality & Buyer Satisfaction</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900">
              Verified Buyer Reviews
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600">
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
          <div className="review-card rounded-2xl bg-white p-4 sm:p-5 border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">Vikramaditya Roy</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ★ 5.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">Quality Officer · FCI</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700">Lot: 40 Qtl Sharbati Wheat</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 leading-relaxed">
                &ldquo;Moisture at 10.4%, well below ceiling. Zero foreign matter. Prompt delivery.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ Low Moisture</span>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ Grade A</span>
            </div>
          </div>

          <div className="review-card rounded-2xl bg-white p-4 sm:p-5 border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">Rajesh Singhania</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ★ 5.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">VP · Shivalik Flour Mills</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700">Lot: 65 Qtl Wheat</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 leading-relaxed">
                &ldquo;High test weight (&gt;79 kg/hL) and uniform grain kernel. Ideal for chakki atta.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ High Test Weight</span>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ Uniform Kernel</span>
            </div>
          </div>

          <div className="review-card rounded-2xl bg-white p-4 sm:p-5 border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">Anil Kumar Agarwal</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  ★ 4.9
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">Director · Kuber Agro Rice Export</p>
              <div className="mt-2 text-[11px] sm:text-xs font-semibold text-brand-700">Lot: 35 Qtl Basmati Paddy</div>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-neutral-600 leading-relaxed">
                &ldquo;Moisture at 13.1%, broken grain below 2.5%. Well sun-dried and free from chaff.&rdquo;
              </p>
            </div>
            <div className="mt-2.5 sm:mt-3 pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ Export Quality</span>
              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">✓ Clean Lot</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:gap-8 rounded-2xl sm:rounded-3xl border border-neutral-200 bg-white p-4 sm:p-10 lg:grid-cols-2 shadow-sm">
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
            <div key={h.label} className="highlight-item rounded-2xl bg-neutral-50 p-4 border border-neutral-100">
              <dt className="text-sm font-semibold text-neutral-900">{h.label}</dt>
              <dd className="mt-1 text-xs text-neutral-500">{h.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
