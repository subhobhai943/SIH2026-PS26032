'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/i18n/languages';
import { api, getToken, clearToken } from '@/lib/api';
import { prefersReducedMotion } from '@/lib/animations';
import { IconClose, IconGlobe, IconMenu, IconWheat, IconCheck, IconSun, IconMoon, IconBell } from './icons';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [farmer, setFarmer] = useState<{ name?: string; phone?: string; photoUrl?: string } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { language, setLanguage, openLanguageSelector, t } = useTranslation();
  const { theme, resolvedTheme, toggleTheme, fontSize, setFontSize } = useTheme();
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownMenuRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const fetchFarmerAndNotifs = () => {
    const token = getToken();
    const authed = Boolean(token);
    setIsLoggedIn(authed);
    if (authed) {
      api
        .get<any>('/farmers/me')
        .then((f) => setFarmer(f))
        .catch(() => {
          clearToken();
          setIsLoggedIn(false);
          setFarmer(null);
        });
      api
        .get<{ notifications: any[]; unreadCount: number }>('/farmers/me/notifications')
        .then((res) => {
          setNotifications(res?.notifications || []);
          setUnreadCount(res?.unreadCount || 0);
        })
        .catch(() => {});
    } else {
      setFarmer(null);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchFarmerAndNotifs();

    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('auth:change', fetchFarmerAndNotifs);
    window.addEventListener('storage', fetchFarmerAndNotifs);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('auth:change', fetchFarmerAndNotifs);
      window.removeEventListener('storage', fetchFarmerAndNotifs);
    };
  }, [pathname]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/farmers/me/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  useEffect(() => {
    if (open && mobileMenuRef.current && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          mobileMenuRef.current,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
        );
        gsap.fromTo(
          '.mobile-nav-link',
          { x: -8, opacity: 0.7 },
          {
            x: 0,
            opacity: 1,
            stagger: 0.03,
            duration: 0.22,
            ease: 'power2.out',
            clearProps: 'all',
          }
        );
      } catch (err) {
        console.warn('SiteHeader menu animation skipped:', err);
      }
    }
  }, [open]);

  useEffect(() => {
    if (langMenuOpen && langDropdownMenuRef.current && !prefersReducedMotion()) {
      try {
        gsap.fromTo(
          langDropdownMenuRef.current,
          { opacity: 0, scale: 0.95, y: -6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'back.out(1.5)' }
        );
      } catch (err) {
        console.warn('SiteHeader lang dropdown animation skipped:', err);
      }
    }
  }, [langMenuOpen]);

  const navLinks = [
    { href: '/booking', label: t('nav_bookSlot') },
    { href: '/queue', label: t('nav_liveQueue') },
    { href: '/status', label: t('nav_myStatus') },
    { href: '/tracking', label: t('nav_trackOrder') },
    { href: '/reviews', label: t('nav_buyerReviews') },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-neutral-900 shadow-sm transition-colors">
      {/* Official Government of India Tricolor Ribbon */}
      <div className="h-[3.5px] w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

      {/* Official Government of India Top Banner */}
      <div className="bg-neutral-900 text-neutral-300 text-[10px] sm:text-[11px] font-medium border-b border-neutral-800 dark:bg-neutral-950 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1 sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="font-semibold text-neutral-100 truncate">भारत सरकार | Gov. of India</span>
            <span className="hidden md:inline text-neutral-500">·</span>
            <span className="hidden md:inline text-neutral-300">Ministry of Consumer Affairs, Food & Public Distribution</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] shrink-0">
            <span className="hidden lg:inline rounded bg-neutral-800 px-2 py-0.5 font-medium text-emerald-400 border border-neutral-700">
              राष्ट्रीय ई-उपार्जन पोर्टल · National e-Procurement Portal
            </span>

            {/* Accessibility Font Size Scaling Toolbar */}
            <div className="hidden sm:flex items-center rounded-md bg-neutral-800/80 border border-neutral-700 p-0.5" title="Font Size">
              <button
                type="button"
                onClick={() => setFontSize('normal')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                  fontSize === 'normal' ? 'bg-neutral-700 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
                aria-label="Default Font Size"
              >
                -A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('large')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                  fontSize === 'large' ? 'bg-neutral-700 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
                aria-label="Medium Font Size"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('larger')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                  fontSize === 'larger' ? 'bg-neutral-700 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
                }`}
                aria-label="Large Font Size"
              >
                +A
              </button>
            </div>

            {/* Dark / Light Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1 rounded-md bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-neutral-200 transition"
              title={resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle dark/light theme"
            >
              {resolvedTheme === 'dark' ? (
                <>
                  <IconSun className="h-3 w-3 text-amber-400" />
                  <span className="hidden sm:inline text-[10px] text-amber-300">Light</span>
                </>
              ) : (
                <>
                  <IconMoon className="h-3 w-3 text-cyan-300" />
                  <span className="hidden sm:inline text-[10px] text-cyan-200">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="border-b border-neutral-200/80 bg-white/95 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-6 sm:py-2.5">
          <a href="/" className="flex items-center gap-2 sm:gap-2.5 text-neutral-900 dark:text-neutral-100 min-w-0">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
              <IconWheat className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="text-xs sm:text-base font-bold leading-tight min-w-0">
              <span className="block truncate">{t('nav_appName')}</span>
              <span className="block text-[9px] sm:text-[10px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                Dept. of Food & Public Distribution
              </span>
            </span>
          </a>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === link.href
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 dark:border dark:border-brand-800/60'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              aria-label="Select Language"
            >
              <IconGlobe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span>{currentLang.flag}</span>
              <span>{currentLang.name}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">▾</span>
            </button>

            {langMenuOpen && (
              <div
                ref={langDropdownMenuRef}
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10"
              >
                <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
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
                            ? 'bg-brand-50 text-brand-700 font-bold dark:bg-brand-950/70 dark:text-brand-300'
                            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.name}</span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            ({lang.englishName})
                          </span>
                        </div>
                        {isSelected && <IconCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-800 pt-1">
                  <button
                    onClick={() => {
                      setLangMenuOpen(false);
                      openLanguageSelector();
                    }}
                    className="w-full rounded-lg px-3 py-1.5 text-center text-[11px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-neutral-800"
                  >
                    View All Languages (पूर्ण सूची)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Auth Status & Notifications */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={notifDropdownRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-brand-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 transition"
                  aria-label="Notifications"
                >
                  <IconBell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 z-50">
                    <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🔔</span>
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          SMS & DBT Receipts (एसएमएस व रसीदें)
                        </span>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-neutral-500">
                          No notifications yet. SMS receipts and payment updates will appear here.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            className={`p-3.5 transition text-xs ${
                              !n.read ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                {n.title}
                              </span>
                              <span className="text-[10px] text-neutral-400 shrink-0">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed font-mono text-[11px] bg-neutral-100/80 dark:bg-neutral-800/80 p-2 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                              {n.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                ✓ SMS Sent to +91 {n.phone}
                              </span>
                              <a
                                href="/status"
                                onClick={() => setNotifOpen(false)}
                                className="font-bold text-brand-700 dark:text-brand-400 hover:underline"
                              >
                                View Voucher ➔
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-center">
                      <a
                        href="/status"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline"
                      >
                        View Full DBT Payment & Queue Dossier ➔
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Farmer Profile Pill */}
              <a
                href="/status"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 transition"
                title="View Farmer Dossier"
              >
                <span className="text-sm">👤</span>
                <span className="max-w-[90px] truncate">{farmer?.name || farmer?.phone || 'Farmer'}</span>
              </a>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  setIsLoggedIn(false);
                  setFarmer(null);
                  window.location.href = '/';
                }}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-red-400 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <a
              href="/register"
              className="rounded-xl bg-brand-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500 transition"
            >
              {t('nav_loginRegister')}
            </a>
          )}
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1.5 md:hidden">
          {/* Mobile Notifications */}
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              aria-label="Notifications"
            >
              <IconBell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={openLanguageSelector}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            aria-label="Language"
          >
            <span>{currentLang.flag}</span>
            <span className="max-w-[60px] truncate">{currentLang.name}</span>
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            aria-label="Toggle navigation"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — full-width slide-down */}
      {open && (
        <nav ref={mobileMenuRef} className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 px-3 py-2 md:hidden safe-bottom">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`mobile-nav-link block rounded-lg px-3 py-3 text-sm font-medium ${
                pathname === link.href
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {link.label}
            </a>
          ))}
          <div className="my-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 space-y-1.5">
            <button
              onClick={() => {
                setOpen(false);
                openLanguageSelector();
              }}
              className="mobile-nav-link flex w-full items-center justify-between rounded-lg px-3 py-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <span className="flex items-center gap-2">
                <IconGlobe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
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
                className="mobile-nav-link w-full text-left rounded-lg px-3 py-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                Sign Out
              </button>
            ) : (
              <a
                href="/register"
                className="mobile-nav-link block w-full text-center rounded-xl bg-brand-700 px-3 py-3 text-xs font-bold text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {t('nav_loginRegister')}
              </a>
            )}
          </div>
        </nav>
      )}
    </header>

      {/* Official Government Procurement Notice Bulletin */}
      <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 px-3 py-1 text-xs text-amber-950 dark:text-amber-200">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-hidden text-[11px] sm:text-xs font-medium">
          <span className="rounded bg-amber-600 text-white px-2 py-0.5 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
            सूचना / Notice
          </span>
          <span className="truncate">
            🌾 Rabi Season 2026-27 e-Upajan active across 18 Mandis · 20% DBT safety advance guaranteed within 2 hours of arrival.
          </span>
        </div>
      </div>
    </div>
  );
}
