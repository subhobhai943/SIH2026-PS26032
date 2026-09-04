'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/i18n/languages';
import { IconCheck, IconClose, IconGlobe } from './icons';

export function LanguageModal() {
  const { language, setLanguage, showModal, closeLanguageModal, t } = useTranslation();

  if (!showModal) return null;

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
  };

  const handleConfirm = () => {
    closeLanguageModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeLanguageModal}
      />

      {/* Modal Dialog — bottom sheet on mobile, centered card on desktop */}
      <div className="relative w-full sm:max-w-xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/5 animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col">
        {/* Decorative header bar */}
        <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 px-4 py-4 sm:px-6 sm:py-5 text-white shrink-0">
          {/* Mobile drag handle indicator */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <IconGlobe className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-bold leading-tight truncate">
                  {t('modal_welcome')}
                </h2>
                <p className="text-[11px] sm:text-sm text-brand-100 truncate">
                  {t('modal_selectLanguage')}
                </p>
              </div>
            </div>
            <button
              onClick={closeLanguageModal}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white shrink-0"
              aria-label="Close"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          <p className="mb-3 sm:mb-4 text-xs font-medium text-neutral-500">
            {t('modal_selectSubtitle')}
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`group relative flex items-center justify-between rounded-xl sm:rounded-2xl border p-3 sm:p-3.5 text-left transition active:scale-[0.98] ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/70 shadow-sm ring-2 ring-brand-600/20'
                      : 'border-neutral-200 bg-white hover:border-brand-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span className="text-xl sm:text-2xl shrink-0">{lang.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-neutral-900">
                          {lang.name}
                        </span>
                        <span className="text-[10px] sm:text-xs text-neutral-400">
                          ({lang.englishName})
                        </span>
                      </div>
                      <span className="block text-[10px] sm:text-[11px] text-neutral-500 truncate">
                        {lang.region}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white ml-2">
                      <IconCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky confirm button */}
        <div className="shrink-0 border-t border-neutral-100 p-4 sm:p-6 sm:pt-4 bg-white safe-bottom">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3.5 sm:py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99]"
          >
            {t('modal_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
