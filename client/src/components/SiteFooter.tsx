'use client';

import { useTranslation } from '@/lib/i18n/LanguageContext';

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} {t('footer_copyright')}</span>
        <span>{t('footer_ministry')}</span>
      </div>
    </footer>
  );
}
