'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import { api, getToken, clearToken } from '@/lib/api';
import { prefersReducedMotion } from '@/lib/animations';
import { IconClose, IconGlobe, IconMenu, IconWheat, IconCheck, IconSun, IconMoon, IconBell } from './icons';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  phone?: string;
  type?: string;
  read?: boolean;
  createdAt: string;
  isPublic?: boolean;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'all' | 'sms' | 'dbt'>('all');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [farmer, setFarmer] = useState<{ name?: string; phone?: string; photoUrl?: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [publicNotifs, setPublicNotifs] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const pathname = usePathname();
  const { language, setLanguage, openLanguageSelector, t } = useTranslation();
  const { resolvedTheme, toggleTheme, fontSize, setFontSize } = useTheme();

  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownMenuRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  // Fetch Public Mandi Announcements (available for everyone)
  const fetchPublicAnnouncements = () => {
    api
      .get<NotificationItem[]>('/farmers/public/announcements')
      .then((items) => {
        if (Array.isArray(items)) setPublicNotifs(items);
      })
      .catch(() => {});
  };

  // Fetch Farmer Profile & Personal Notifications
  const fetchFarmerAndNotifs = () => {
    const token = getToken();
    const authed = Boolean(token);
    setIsLoggedIn(authed);

    fetchPublicAnnouncements();

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
        .get<{ notifications: NotificationItem[]; unreadCount: number }>('/farmers/me/notifications')
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

  const toggleNotifications = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      if (isLoggedIn) {
        api
          .get<{ notifications: NotificationItem[]; unreadCount: number }>('/farmers/me/notifications')
          .then((res) => {
            setNotifications(res?.notifications || []);
            setUnreadCount(res?.unreadCount || 0);
          })
          .catch(() => {});
      } else {
        fetchPublicAnnouncements();
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/farmers/me/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  // Robust Outside-Click and Escape-Key Handlers
  useEffect(() => {
    fetchFarmerAndNotifs();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      // Close language dropdown if clicked outside
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }

      // If click originated inside the mobile drawer, desktop popover, or toggle button: DO NOT CLOSE
      if (
        target?.closest?.('.mobile-notif-drawer') ||
        target?.closest?.('.desktop-notif-dropdown') ||
        target?.closest?.('.notif-toggle-btn')
      ) {
        return;
      }

      // Otherwise if clicking outside the desktop container, close
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotifOpen(false);
        setLangMenuOpen(false);
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('auth:change', fetchFarmerAndNotifs);
    window.addEventListener('storage', fetchFarmerAndNotifs);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('auth:change', fetchFarmerAndNotifs);
      window.removeEventListener('storage', fetchFarmerAndNotifs);
    };
  }, [pathname, isLoggedIn]);

  // Combined notifications to show
  const displayedNotifications = useMemo(() => {
    const pool = isLoggedIn && notifications.length > 0 ? notifications : publicNotifs;
    if (notifTab === 'sms') {
      return pool.filter((n) => n.type === 'sms' || n.type === 'booking_confirmed');
    }
    if (notifTab === 'dbt') {
      return pool.filter(
        (n) => n.type?.startsWith('payment_') || n.title?.toLowerCase().includes('dbt') || n.message?.includes('DBT')
      );
    }
    return pool;
  }, [isLoggedIn, notifications, publicNotifs, notifTab]);

  // Animations
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

  const getNotifIcon = (n: NotificationItem) => {
    if (n.type?.startsWith('payment_')) return '💰';
    if (n.type === 'booking_confirmed') return '🎫';
    if (n.type === 'queue_alert') return '⏱️';
    return '🌾';
  };

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-neutral-900 shadow-xs transition-colors">
      {/* Official Government of India Tricolor Ribbon */}
      <div className="h-[3.5px] w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

      {/* Official Government of India Top Banner */}
      <div className="bg-neutral-900 text-neutral-300 text-[10px] sm:text-[11px] font-medium border-b border-neutral-800 dark:bg-neutral-950 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1 sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="font-semibold text-neutral-100 truncate">भारत सरकार | Gov. of India</span>
            <span className="hidden md:inline text-neutral-500">·</span>
            <span className="hidden md:inline text-neutral-300 truncate">
              Ministry of Consumer Affairs, Food & Public Distribution
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] shrink-0">
            <span className="hidden lg:inline rounded bg-neutral-800 px-2 py-0.5 font-medium text-emerald-400 border border-neutral-700">
              राष्ट्रीय ई-उपार्जन पोर्टल · National e-Procurement Portal
            </span>

            {/* Accessibility Font Size Scaling Toolbar */}
            <div
              className="hidden sm:flex items-center rounded-md bg-neutral-800/80 border border-neutral-700 p-0.5"
              title="Font Size"
            >
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
              className="flex items-center gap-1 rounded-md bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-neutral-200 transition cursor-pointer"
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
      <header className="border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-6 sm:py-2.5">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 sm:gap-2.5 text-neutral-900 dark:text-neutral-100 min-w-0">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm ring-2 ring-brand-600/20">
              <IconWheat className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="text-xs sm:text-base font-bold leading-tight min-w-0">
              <span className="block truncate">{t('nav_appName')}</span>
              <span className="block text-[9px] sm:text-[10px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                Dept. of Food & Public Distribution
              </span>
            </span>
          </a>

          {/* Desktop Nav Items */}
          <div className="hidden items-center gap-2.5 md:flex">
            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    pathname === link.href
                      ? 'bg-brand-50 text-brand-700 font-bold dark:bg-brand-950/70 dark:text-brand-300 dark:border dark:border-brand-800/60'
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
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-brand-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
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
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10 z-50"
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
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
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
                      className="w-full rounded-lg px-3 py-1.5 text-center text-[11px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      View All Languages (पूर्ण सूची)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Always-Visible Desktop Notification Bell */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={toggleNotifications}
                className="notif-toggle-btn relative flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-brand-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer shadow-2xs"
                aria-label={t('nav_notifications')}
                title={t('nav_notifications')}
              >
                <IconBell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white animate-pulse shadow-xs">
                    {unreadCount}
                  </span>
                ) : !isLoggedIn ? (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
                ) : null}
              </button>

              {/* Desktop Notification Popover Card */}
              {notifOpen && (
                <div className="desktop-notif-dropdown absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 dark:border-neutral-700 dark:bg-neutral-900/95 z-50">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/90 dark:bg-neutral-800/90 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔔</span>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {t('nav_gatePassReceipts')}
                        </h4>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {isLoggedIn ? 'Verified SMS & Mandi Receipts' : 'Official Portal Procurement Advisories'}
                        </p>
                      </div>
                    </div>
                    {isLoggedIn && unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        {t('nav_markAllRead')}
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100/60 dark:bg-neutral-800/50 border-b border-neutral-200/70 dark:border-neutral-700/70 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setNotifTab('all')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        notifTab === 'all'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      All ({displayedNotifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('sms')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        notifTab === 'sms'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      🎫 Gate Passes
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('dbt')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        notifTab === 'dbt'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      💰 DBT 20%
                    </button>
                  </div>

                  {/* Unauthenticated Login Prompt Banner */}
                  {!isLoggedIn && (
                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-brand-50 dark:from-emerald-950/50 dark:to-neutral-850 border-b border-emerald-200 dark:border-emerald-800 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-base">🔒</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-emerald-950 dark:text-emerald-200 leading-snug">
                            Sign In for Personal SMS Gate Passes
                          </p>
                          <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                            Log in with Mobile OTP or Google to view your live Mandi delivery slips & PFMS DBT vouchers.
                          </p>
                          <a
                            href="/register"
                            onClick={() => setNotifOpen(false)}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition"
                          >
                            <span>Sign In / Register</span>
                            <span>➔</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notifications List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                    {displayedNotifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-neutral-500">
                        <span className="text-3xl block mb-2">📭</span>
                        {t('nav_noNotifications')}
                      </div>
                    ) : (
                      displayedNotifications.map((n) => (
                        <div
                          key={n._id}
                          className={`p-3.5 transition text-xs ${
                            !n.read && isLoggedIn
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 truncate">
                              <span>{getNotifIcon(n)}</span>
                              <span className="truncate">{n.title}</span>
                            </span>
                            <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-mono text-[11px] bg-neutral-100/90 dark:bg-neutral-800/90 p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-700/70">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              ✓ {n.isPublic ? 'Official Notice' : `SMS Sent to +91 ${n.phone || 'Portal'}`}
                            </span>
                            <a
                              href="/status"
                              onClick={() => setNotifOpen(false)}
                              className="font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                            >
                              View Voucher ➔
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Popover Footer */}
                  <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-800/80 text-center">
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

            {/* Desktop Farmer Profile Pill or Login Button */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <a
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200 transition shadow-2xs"
                  title={t('nav_myProfile')}
                >
                  {farmer?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={farmer.photoUrl}
                      alt={farmer.name || 'Farmer'}
                      className="h-5 w-5 rounded-full object-cover ring-1 ring-emerald-500/50 shrink-0"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-800 text-[10px]">
                      👤
                    </span>
                  )}
                  <span className="max-w-[100px] truncate">{farmer?.name || farmer?.phone || t('nav_myProfile')}</span>
                  <span className="rounded bg-emerald-200/80 dark:bg-emerald-800/80 px-1 py-0.2 text-[9px] font-extrabold uppercase">
                    PRO
                  </span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    clearToken();
                    setIsLoggedIn(false);
                    setFarmer(null);
                    window.location.href = '/';
                  }}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-red-400 transition cursor-pointer"
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

          {/* Mobile Top Controls (< 768px) */}
          <div className="flex items-center gap-1.5 md:hidden">
            {/* Always-Visible Mobile Notifications Bell */}
            <button
              type="button"
              onClick={toggleNotifications}
              className="notif-toggle-btn relative flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 cursor-pointer"
              aria-label={t('nav_notifications')}
            >
              <IconBell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white animate-pulse">
                  {unreadCount}
                </span>
              ) : !isLoggedIn ? (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
              ) : null}
            </button>

            {/* Direct 1-Tap Mobile Profile Avatar Pill (When Authenticated) */}
            {isLoggedIn && (
              <a
                href="/profile"
                className="flex items-center justify-center h-9 w-9 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                aria-label={t('nav_myProfile')}
                title={t('nav_myProfile')}
              >
                {farmer?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={farmer.photoUrl}
                    alt={farmer.name || 'Farmer'}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-emerald-500/40"
                  />
                ) : (
                  <span className="text-sm">👤</span>
                )}
              </a>
            )}

            {/* Language Selector Button */}
            <button
              type="button"
              onClick={openLanguageSelector}
              className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 h-9"
              aria-label="Language"
            >
              <span>{currentLang.flag}</span>
              <span className="max-w-[48px] truncate">{currentLang.name}</span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              aria-label="Toggle navigation"
            >
              {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Notifications Bottom Sheet Modal (UI/UX Pro Max) */}
        {notifOpen && (
          <div
            className="mobile-notif-backdrop fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm p-0 md:hidden animate-fade-in"
            onClick={() => setNotifOpen(false)}
          >
            <div
              ref={mobileDrawerRef}
              className="mobile-notif-drawer w-full max-h-[85vh] rounded-t-[28px] border-t border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Bottom Sheet Drag Indicator */}
              <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-2 shrink-0" />

              {/* Drawer Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {t('nav_gatePassReceipts')}
                    </h4>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {isLoggedIn ? 'Verified SMS & Mandi Receipts' : 'Official Portal Procurement Advisories'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLoggedIn && unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline px-2 py-1 rounded"
                    >
                      {t('nav_markAllRead')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    aria-label="Close"
                  >
                    <IconClose className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100/70 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setNotifTab('all')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${
                    notifTab === 'all'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  All ({displayedNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTab('sms')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${
                    notifTab === 'sms'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  🎫 Gate Passes
                </button>
                <button
                  type="button"
                  onClick={() => setNotifTab('dbt')}
                  className={`flex-1 py-1.5 rounded-lg text-center transition ${
                    notifTab === 'dbt'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  💰 DBT 20%
                </button>
              </div>

              {/* Unauthenticated Login Prompt on Mobile */}
              {!isLoggedIn && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-brand-50 dark:from-emerald-950/50 dark:to-neutral-850 border-b border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-base">🔒</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-emerald-950 dark:text-emerald-200 leading-snug">
                        Sign In for Personal SMS Gate Passes
                      </p>
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                        Log in with Mobile OTP or Google to view your personal Mandi delivery slips & PFMS DBT vouchers.
                      </p>
                      <a
                        href="/register"
                        onClick={() => setNotifOpen(false)}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs"
                      >
                        <span>Sign In / Register</span>
                        <span>➔</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Drawer Notification List */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 p-3 space-y-2">
                {displayedNotifications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    <span className="text-3xl block mb-2">📭</span>
                    {t('nav_noNotifications')}
                  </div>
                ) : (
                  displayedNotifications.map((n) => (
                    <div
                      key={n._id}
                      className={`p-3.5 transition text-xs rounded-xl border ${
                        !n.read && isLoggedIn
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/70'
                          : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/60 dark:border-neutral-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 truncate">
                          <span>{getNotifIcon(n)}</span>
                          <span className="truncate">{n.title}</span>
                        </span>
                        <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-mono text-[11px] bg-white/90 dark:bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        {n.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ {n.isPublic ? 'Official Notice' : `SMS Sent to +91 ${n.phone || 'Portal'}`}
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

              {/* Pinned Bottom Action */}
              <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-center shrink-0">
                <a
                  href="/status"
                  onClick={() => setNotifOpen(false)}
                  className="block w-full py-2.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 transition"
                >
                  View Full DBT Payment & Queue Dossier ➔
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer Menu (Hamburger) */}
        {open && (
          <nav
            ref={mobileMenuRef}
            className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 px-3 py-2 md:hidden safe-bottom"
          >
            {/* Authenticated Farmer Dossier Card in Mobile Menu */}
            {isLoggedIn ? (
              <div className="mb-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-brand-50/50 dark:from-emerald-950/50 dark:to-neutral-800/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {farmer?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={farmer.photoUrl}
                      alt={farmer?.name || 'Farmer'}
                      className="h-11 w-11 rounded-xl object-cover ring-2 ring-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold shrink-0 text-xl">
                      🌾
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                      {farmer?.name || 'Registered Farmer'}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 truncate">
                      {farmer?.phone ? `+91 ${farmer.phone}` : (farmer as any)?.email || 'Verified Account'}
                    </div>
                    <span className="inline-block text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ A-Grade Producer
                    </span>
                  </div>
                </div>
                <a
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs font-extrabold shadow-xs transition flex items-center gap-1"
                >
                  <span>{t('nav_myProfile')}</span>
                  <span>➔</span>
                </a>
              </div>
            ) : (
              <div className="mb-2.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    Farmer Portal Login
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Sign in to book slots & track 20% advance
                  </div>
                </div>
                <a
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-brand-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs"
                >
                  {t('nav_loginRegister')}
                </a>
              </div>
            )}

            {/* My Profile Link (When Authenticated) */}
            {isLoggedIn && (
              <a
                href="/profile"
                onClick={() => setOpen(false)}
                className={`mobile-nav-link block rounded-xl px-3 py-3 text-sm font-bold transition mb-1 ${
                  pathname === '/profile'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                👤 {t('nav_myProfile')} (मेरी प्रोफाइल)
              </a>
            )}

            {/* Nav Links */}
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`mobile-nav-link block rounded-xl px-3 py-3 text-sm font-medium ${
                  pathname === link.href
                    ? 'bg-brand-50 text-brand-700 font-bold dark:bg-brand-950/70 dark:text-brand-300'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                {link.label}
              </a>
            ))}

            {/* Bottom Actions */}
            <div className="my-2 border-t border-neutral-100 dark:border-neutral-800 pt-2 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openLanguageSelector();
                }}
                className="mobile-nav-link flex w-full items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
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
                  className="mobile-nav-link w-full text-left rounded-xl px-3 py-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                >
                  Sign Out (लॉग आउट)
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
