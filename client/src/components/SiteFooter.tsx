'use client';

import { useTranslation } from '@/lib/i18n/LanguageContext';

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 transition-colors">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-neutral-500 dark:text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span>© {new Date().getFullYear()} {t('footer_copyright')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <span>{t('footer_ministry')}</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">National e-Governance Division (NeGD)</span>
        </div>
      </div>
    </footer>
  );
}
