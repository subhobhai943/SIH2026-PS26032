import type { ReactNode } from 'react';
import { IconAlert, IconSpinner } from './icons';

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{children}</p>;
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 space-y-1.5">
      {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{title}</h1>
      {subtitle && <p className="max-w-2xl text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  booked: 'bg-amber-50 text-amber-700 ring-amber-200',
  checked_in: 'bg-sky-50 text-sky-700 ring-sky-200',
  serving: 'bg-brand-50 text-brand-700 ring-brand-200',
  completed: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  no_show: 'bg-red-50 text-red-700 ring-red-200',
  arrived: 'bg-sky-50 text-sky-700 ring-sky-200',
  weighed: 'bg-violet-50 text-violet-700 ring-violet-200',
  approved: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  paid: 'bg-brand-50 text-brand-700 ring-brand-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  open: 'bg-brand-50 text-brand-700 ring-brand-200',
  order_confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  produce_dispatched: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  picked_up: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_transit: 'bg-purple-50 text-purple-700 ring-purple-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 ring-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ status }: { status: string }) {
  const style = badgeStyles[status] || 'bg-neutral-100 text-neutral-600 ring-neutral-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-white text-neutral-700 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 disabled:opacity-50',
    ghost: 'text-neutral-600 hover:bg-neutral-100 disabled:opacity-50',
    danger: 'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-50',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
  };
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <IconSpinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function TextField({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>}
      <input
        {...props}
        className={`w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
      />
    </label>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tones: Record<string, string> = {
    error: 'bg-red-50 text-red-700 ring-red-200',
    success: 'bg-brand-50 text-brand-700 ring-brand-200',
    info: 'bg-amber-50 text-amber-800 ring-amber-200',
  };
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm ring-1 ring-inset ${tones[tone]}`}>
      {tone === 'error' && <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-neutral-300">{icon}</div>}
      <p className="font-medium text-neutral-600">{title}</p>
      {description && <p className="max-w-sm text-sm text-neutral-400">{description}</p>}
    </div>
  );
}

export function Spinner({ className = 'h-6 w-6 text-brand-600' }: { className?: string }) {
  return <IconSpinner className={className} />;
}

export function StatTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'brand' }) {
  return (
    <Card className={`p-4 ${tone === 'brand' ? '!bg-brand-600 !border-brand-600 text-white' : ''}`}>
      <div className={`text-xs font-medium ${tone === 'brand' ? 'text-brand-50' : 'text-neutral-500'}`}>{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
