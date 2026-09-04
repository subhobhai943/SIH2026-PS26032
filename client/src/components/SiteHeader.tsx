'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/i18n/languages';
import { getToken, clearToken } from '@/lib/api';
import { IconClose, IconGlobe, IconMenu, IconWheat, IconCheck } from './icons';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const { language, setLanguage, openLanguageSelector, t } = useTranslation();
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    setIsLoggedIn(Boolean(getToken()));

    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { href: '/booking', label: t('nav_bookSlot') },
    { href: '/queue', label: t('nav_liveQueue') },
    { href: '/status', label: t('nav_myStatus') },
    { href: '/tracking', label: t('nav_trackOrder') },
    { href: '/reviews', label: t('nav_buyerReviews') },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white shadow-sm">
      {/* Official Government of India Top Banner */}
      <div className="bg-neutral-900 text-neutral-300 text-[11px] font-medium border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-neutral-100">भारत सरकार | Government of India</span>
            <span className="hidden md:inline text-neutral-500">·</span>
            <span className="hidden md:inline text-neutral-300">Ministry of Consumer Affairs, Food & Public Distribution</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-neutral-300">
              SIH2026 · PS26032
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="border-b border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <a href="/" className="flex items-center gap-2.5 text-neutral-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
              <IconWheat className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold leading-tight sm:text-base">
              {t('nav_appName')}
              <span className="block text-[10px] font-medium text-neutral-500">
                Department of Food & Public Distribution
              </span>
            </span>
          </a>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-3 sm:flex">
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === link.href
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Language Selector Dropdown */}
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              aria-label="Select Language"
            >
              <IconGlobe className="h-4 w-4 text-brand-600" />
              <span>{currentLang.flag}</span>
              <span>{currentLang.name}</span>
              <span className="text-[10px] text-neutral-400">▾</span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {t('nav_selectLanguage')}
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                          isSelected
                            ? 'bg-brand-50 text-brand-700 font-bold'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.name}</span>
                          <span className="text-[10px] text-neutral-400">
                            ({lang.englishName})
                          </span>
                        </div>
                        {isSelected && <IconCheck className="h-3.5 w-3.5 text-brand-600" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-neutral-100 pt-1">
                  <button
                    onClick={() => {
                      setLangMenuOpen(false);
                      openLanguageSelector();
                    }}
                    className="w-full rounded-lg px-3 py-1.5 text-center text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    View All Languages (पूर्ण सूची)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Auth Status */}
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => {
                clearToken();
                setIsLoggedIn(false);
                window.location.href = '/';
              }}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-red-600 transition"
            >
              Sign Out
            </button>
          ) : (
            <a
              href="/register"
              className="rounded-xl bg-brand-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-800 transition"
            >
              {t('nav_loginRegister')}
            </a>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={openLanguageSelector}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs font-semibold text-neutral-700"
            aria-label="Language"
          >
            <span>{currentLang.flag}</span>
            <span>{currentLang.name}</span>
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
            aria-label="Toggle navigation"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-neutral-200 bg-white px-4 py-2 sm:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                pathname === link.href
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {link.label}
            </a>
          ))}
          <div className="my-2 border-t border-neutral-100 pt-2 space-y-2">
            <button
              onClick={() => {
                setOpen(false);
                openLanguageSelector();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              <span className="flex items-center gap-2">
                <IconGlobe className="h-4 w-4 text-brand-600" />
                {t('nav_changeLanguage')}
              </span>
              <span>{currentLang.name} ➔</span>
            </button>

            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  setIsLoggedIn(false);
                  window.location.href = '/';
                }}
                className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Sign Out
              </button>
            ) : (
              <a
                href="/register"
                className="block w-full text-center rounded-xl bg-brand-700 px-3 py-2 text-xs font-bold text-white"
              >
                {t('nav_loginRegister')}
              </a>
            )}
          </div>
        </nav>
      )}
    </header>
  </div>
);
}
