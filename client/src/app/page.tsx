import { Card } from '@/components/ui';
import { IconArrowRight, IconBell, IconCalendar, IconPhone, IconQueue, IconStatus } from '@/components/icons';

const steps = [
  { title: 'Register', desc: 'Verify your phone number with a one-time OTP — no app install needed.', href: '/register', icon: IconPhone },
  { title: 'Book a Slot', desc: 'Pick a nearby procurement centre and a convenient time window.', href: '/booking', icon: IconCalendar },
  { title: 'Track the Queue', desc: 'See your live position and estimated wait — no need to stand in line.', href: '/queue', icon: IconQueue },
  { title: 'Check Status', desc: 'Follow your produce from arrival to payment, stage by stage.', href: '/status', icon: IconStatus },
];

const highlights = [
  { label: 'Slot booking', desc: 'Book a time window at any procurement centre in seconds.' },
  { label: 'Live queue tracking', desc: 'Real-time position and wait-time estimates over Socket.io.' },
  { label: 'SMS notifications', desc: 'Booking confirmations, turn alerts, and payment updates by SMS.' },
  { label: 'Payment tracking', desc: 'Arrived → Weighed → Approved → Paid, visible to the farmer at every step.' },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-16 text-white sm:px-12 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            Smart India Hackathon 2026 · PS26032
          </span>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            No more waiting in the sun for your turn at the mandi.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-brand-50 sm:text-lg">
            Book your procurement slot, track your live queue position, and follow your payment status — all from
            your phone, in your own time.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
            >
              Get Started <IconArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/queue"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20"
            >
              View Live Queue
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">How it works</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">Four steps, start to finish</h2>
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

      <section className="grid gap-8 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Built for procurement centres</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Less congestion at the gate, more transparency for farmers.
          </h2>
          <p className="mt-3 text-sm text-neutral-500">
            A single platform that lets farmers plan their visit, keeps procurement staff on top of the queue, and
            gives everyone a clear record of what happened and when.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500">
            <IconBell className="h-4 w-4 text-brand-600" />
            Farmers get an SMS the moment their turn is close.
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {highlights.map((h) => (
            <div key={h.label} className="rounded-2xl bg-neutral-50 p-4">
              <dt className="text-sm font-semibold text-neutral-900">{h.label}</dt>
              <dd className="mt-1 text-xs text-neutral-500">{h.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
