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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeLanguageModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-neutral-900/5 animate-in fade-in zoom-in-95 duration-150">
        {/* Decorative header bar */}
        <div className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <IconGlobe className="h-6 w-6 text-white" />
              </span>
              <div>
                <h2 className="text-lg font-bold leading-tight sm:text-xl">
                  {t('modal_welcome')}
                </h2>
                <p className="text-xs text-brand-100 sm:text-sm">
                  {t('modal_selectLanguage')}
                </p>
              </div>
            </div>
            <button
              onClick={closeLanguageModal}
              className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="mb-4 text-xs font-medium text-neutral-500">
            {t('modal_selectSubtitle')}
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`group relative flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/70 shadow-sm ring-2 ring-brand-600/20'
                      : 'border-neutral-200 bg-white hover:border-brand-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-neutral-900">
                          {lang.name}
                        </span>
                        <span className="text-xs text-neutral-400">
                          ({lang.englishName})
                        </span>
                      </div>
                      <span className="block text-[11px] text-neutral-500">
                        {lang.region}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99]"
            >
              {t('modal_continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
