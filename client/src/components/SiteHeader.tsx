'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import { api, getToken, clearToken } from '@/lib/api';
import { prefersReducedMotion, animateModalEnter, animateModalExit } from '@/lib/animations';
import { IconClose, IconGlobe, IconMenu, IconWheat, IconCheck, IconSun, IconMoon, IconBell } from './icons';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  phone?: string;
  type?: string;
  priority?: string;
  read?: boolean;
  createdAt: string;
  isPublic?: boolean;
  authorName?: string;
  state?: string;
  crop?: string;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'all' | 'sms' | 'dbt' | 'advisories'>('all');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [farmer, setFarmer] = useState<{
    name?: string;
    phone?: string;
    photoUrl?: string;
    aadhaarNumber?: string;
    aadhaarLast4?: string;
  } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [publicNotifs, setPublicNotifs] = useState<NotificationItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [closingDrawer, setClosingDrawer] = useState(false);

  const pathname = usePathname();
  const { language, setLanguage, openLanguageSelector, t } = useTranslation();
  const { resolvedTheme, toggleTheme, fontSize, setFontSize } = useTheme();

  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownMenuRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileBackdropRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read announcements from localStorage so read states persist locally
  const getReadAnnouncementIds = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('sih_read_announcements');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  // Fetch Public Mandi Announcements (available for everyone)
  const fetchPublicAnnouncements = () => {
    api
      .get<NotificationItem[]>('/farmers/public/announcements')
      .then((items) => {
        if (Array.isArray(items)) {
          const readIds = getReadAnnouncementIds();
          const enriched = items.map((a) => ({
            ...a,
            isPublic: true,
            read: readIds.includes(a._id),
          }));
          setPublicNotifs(enriched);
        }
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
        })
        .catch(() => {});
    } else {
      setFarmer(null);
      setNotifications([]);
    }
  };

  // Combined notifications pool: combines personal notifications + official announcements
  const allNotifications = useMemo(() => {
    const list = [...notifications];
    const existingIds = new Set(notifications.map((n) => n._id));
    for (const p of publicNotifs) {
      if (!existingIds.has(p._id)) {
        list.push(p);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, publicNotifs]);

  const totalUnreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.read).length;
  }, [allNotifications]);

  const filteredNotifications = useMemo(() => {
    if (notifTab === 'sms') {
      return allNotifications.filter(
        (n) => n.type === 'sms' || n.type === 'booking_confirmed' || n.title?.toLowerCase().includes('gate pass')
      );
    }
    if (notifTab === 'dbt') {
      return allNotifications.filter(
        (n) => n.type?.startsWith('payment_') || n.title?.toLowerCase().includes('dbt') || n.message?.includes('DBT')
      );
    }
    if (notifTab === 'advisories') {
      return allNotifications.filter(
        (n) => n.isPublic || n.type === 'msp' || n.type === 'weather' || n.type === 'emergency' || n.type === 'general'
      );
    }
    return allNotifications;
  }, [allNotifications, notifTab]);

  const passesCount = useMemo(() => {
    return allNotifications.filter(
      (n) => n.type === 'sms' || n.type === 'booking_confirmed' || n.title?.toLowerCase().includes('gate pass')
    ).length;
  }, [allNotifications]);

  const dbtCount = useMemo(() => {
    return allNotifications.filter(
      (n) => n.type?.startsWith('payment_') || n.title?.toLowerCase().includes('dbt') || n.message?.includes('DBT')
    ).length;
  }, [allNotifications]);

  const advisoriesCount = useMemo(() => {
    return allNotifications.filter(
      (n) => n.isPublic || n.type === 'msp' || n.type === 'weather' || n.type === 'emergency' || n.type === 'general'
    ).length;
  }, [allNotifications]);

  // Mark single notification as read
  const handleMarkOneRead = async (id: string, isPublic?: boolean) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setPublicNotifs((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));

    if (isPublic) {
      const current = getReadAnnouncementIds();
      if (!current.includes(id)) {
        try {
          window.localStorage.setItem('sih_read_announcements', JSON.stringify([...current, id]));
        } catch {}
      }
    } else if (isLoggedIn) {
      try {
        await api.patch(`/farmers/me/notifications/${id}/read`);
      } catch (err) {
        console.warn('Failed to mark notification read on backend:', err);
      }
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setPublicNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

    const allPublicIds = publicNotifs.map((n) => n._id);
    const current = getReadAnnouncementIds();
    const merged = Array.from(new Set([...current, ...allPublicIds]));
    try {
      window.localStorage.setItem('sih_read_announcements', JSON.stringify(merged));
    } catch {}

    if (isLoggedIn) {
      try {
        await api.patch('/farmers/me/notifications/read-all');
      } catch (err) {
        console.warn('Failed to mark all notifications read on backend:', err);
      }
    }
  };

  const openNotifications = () => {
    setNotifOpen(true);
    fetchFarmerAndNotifs();
  };

  const closeNotifications = () => {
    if (closingDrawer) return;
    if (prefersReducedMotion() || !mobileDrawerRef.current) {
      setNotifOpen(false);
      return;
    }
    setClosingDrawer(true);
    try {
      animateModalExit(mobileBackdropRef.current, mobileDrawerRef.current, true, () => {
        setNotifOpen(false);
        setClosingDrawer(false);
      });
    } catch {
      setNotifOpen(false);
      setClosingDrawer(false);
    }
  };

  const toggleNotifications = () => {
    if (notifOpen) {
      closeNotifications();
    } else {
      openNotifications();
    }
  };

  // Animate mobile drawer on enter
  useEffect(() => {
    if (notifOpen && mobileBackdropRef.current && mobileDrawerRef.current) {
      try {
        animateModalEnter(mobileBackdropRef.current, mobileDrawerRef.current, true);
      } catch (err) {
        console.warn('Drawer enter animation error:', err);
      }
    }
  }, [notifOpen]);

  // Lock body scroll when mobile notifications open
  useEffect(() => {
    if (notifOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [notifOpen]);

  // Robust Outside-Click and Escape-Key Handlers
  useEffect(() => {
    fetchFarmerAndNotifs();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }

      if (
        target?.closest?.('.mobile-notif-drawer') ||
        target?.closest?.('.desktop-notif-dropdown') ||
        target?.closest?.('.notif-toggle-btn')
      ) {
        return;
      }

      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeNotifications();
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

  // Navigation Animations
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
    if (n.type === 'booking_confirmed' || n.title?.toLowerCase().includes('gate pass')) return '🎫';
    if (n.type === 'queue_alert') return '⏱️';
    if (n.type === 'weather') return '🌧️';
    if (n.type === 'emergency') return '🚨';
    if (n.type === 'msp') return '🌾';
    return '📢';
  };

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-neutral-900 shadow-xs transition-colors">
      {/* Official Government of India Tricolor Ribbon */}
      <div className="h-[3.5px] w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

      {/* Official Government of India Top Banner */}
      <div className="bg-neutral-900 text-neutral-300 text-[10px] sm:text-[11px] font-medium border-b border-neutral-800 dark:bg-neutral-950 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1 sm:px-6">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] shrink-0">

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

      {/* Mandatory Aadhaar Verification Alert for Logged In Farmers Missing Aadhaar */}
      {isLoggedIn && farmer && (!farmer.aadhaarNumber && !farmer.aadhaarLast4) && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-3 py-2 text-xs shadow-md border-b border-amber-500/50">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">⚠️</span>
              <span className="font-bold text-amber-50 text-[11px] sm:text-xs">
                Mandatory Verification: All existing and new farmers must submit their 12-digit Aadhaar Card number for DBT MSP transfers & Mandi passes.
              </span>
            </div>
            <a
              href="/profile"
              className="inline-flex items-center justify-center rounded-lg bg-white hover:bg-amber-50 text-amber-900 font-extrabold px-3 py-1 text-xs shrink-0 shadow-xs transition"
            >
              Update Aadhaar (आधार दर्ज करें) →
            </a>
          </div>
        </div>
      )}

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
                {totalUnreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white animate-pulse shadow-xs">
                    {totalUnreadCount}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
                )}
              </button>

              {/* Desktop Notification Popover Card */}
              {notifOpen && (
                <div className="desktop-notif-dropdown absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 dark:border-neutral-700 dark:bg-neutral-900/95 z-50">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/90 dark:bg-neutral-800/90 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔔</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {t('nav_notifications')}
                          </h4>
                          {totalUnreadCount > 0 ? (
                            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                              {totalUnreadCount} new
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold">
                              ✓ Read
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {isLoggedIn ? 'Verified SMS & Official Mandi Notices' : 'Official Portal Procurement Advisories'}
                        </p>
                      </div>
                    </div>
                    {totalUnreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        {t('nav_markAllRead')}
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100/60 dark:bg-neutral-800/50 border-b border-neutral-200/70 dark:border-neutral-700/70 text-[11px] font-semibold overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setNotifTab('all')}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                        notifTab === 'all'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      All ({allNotifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('sms')}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                        notifTab === 'sms'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      🎫 Gate Passes ({passesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('dbt')}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                        notifTab === 'dbt'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      💰 DBT 20% ({dbtCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('advisories')}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                        notifTab === 'advisories'
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-bold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      📢 Advisories ({advisoriesCount})
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
                    {filteredNotifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-neutral-500">
                        <span className="text-3xl block mb-2">📭</span>
                        {t('nav_noNotifications')}
                      </div>
                    ) : (
                      filteredNotifications.map((n) => {
                        const isUnread = !n.read;
                        return (
                          <div
                            key={n._id}
                            onClick={() => {
                              if (isUnread) handleMarkOneRead(n._id, n.isPublic);
                            }}
                            className={`p-3.5 transition text-xs ${
                              isUnread
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/35 hover:bg-emerald-50'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 opacity-90'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 truncate">
                                <span>{getNotifIcon(n)}</span>
                                <span className="truncate">{n.title}</span>
                                {isUnread && (
                                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[8px] font-extrabold text-white">
                                    NEW
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-mono text-[11px] bg-neutral-100/90 dark:bg-neutral-800/90 p-2.5 rounded-lg border border-neutral-200/70 dark:border-neutral-700/70 break-words whitespace-pre-line">
                              {n.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 truncate">
                                ✓ {n.isPublic ? (n.authorName || 'Official Notice') : `SMS Sent to +91 ${n.phone || 'Portal'}`}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {isUnread ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkOneRead(n._id, n.isPublic);
                                    }}
                                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 px-2 py-0.5 rounded transition cursor-pointer"
                                  >
                                    ✓ Mark Read
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">✓ Read</span>
                                )}
                                <a
                                  href="/status"
                                  onClick={() => setNotifOpen(false)}
                                  className="font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                                >
                                  View Voucher ➔
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
              {totalUnreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white animate-pulse">
                  {totalUnreadCount}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
              )}
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

      {/* Mobile Notifications Bottom Sheet Modal (Portaled to document.body to fit perfectly outside header) */}
      {mounted && notifOpen && createPortal(
        <div
          ref={mobileBackdropRef}
          className="mobile-notif-backdrop fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm p-0 md:hidden animate-fade-in"
          onClick={closeNotifications}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            ref={mobileDrawerRef}
            className="mobile-notif-drawer w-full max-w-lg mx-auto h-[85dvh] max-h-[88dvh] rounded-t-[28px] border-t border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 flex flex-col overflow-hidden will-change-transform"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Top Drag Indicator */}
            <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-neutral-700 dark:text-brand-300 text-base shrink-0">
                  🔔
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                      {t('nav_notifications')}
                    </h4>
                    {totalUnreadCount > 0 ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {totalUnreadCount} {language === 'hi' ? 'नई' : 'new'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        ✓ {language === 'hi' ? 'सब पढ़ी' : 'Caught up'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {isLoggedIn ? 'Verified SMS Slips & Mandi Notices' : 'Official Portal Procurement Advisories'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {totalUnreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/70 dark:hover:bg-brand-900 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer shadow-2xs"
                    title={t('nav_markAllRead')}
                  >
                    <span>✓✓</span>
                    <span className="hidden sm:inline">{t('nav_markAllRead')}</span>
                    <span className="sm:hidden">{language === 'hi' ? 'सब पढ़ें' : 'Read all'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeNotifications}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
                  aria-label="Close"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab Filters */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100/70 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setNotifTab('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  notifTab === 'all'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-extrabold ring-1 ring-neutral-300/60 dark:ring-neutral-600'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                All ({allNotifications.length})
              </button>
              <button
                type="button"
                onClick={() => setNotifTab('sms')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  notifTab === 'sms'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-extrabold ring-1 ring-neutral-300/60 dark:ring-neutral-600'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                🎫 Gate Passes ({passesCount})
              </button>
              <button
                type="button"
                onClick={() => setNotifTab('dbt')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  notifTab === 'dbt'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-extrabold ring-1 ring-neutral-300/60 dark:ring-neutral-600'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                💰 DBT 20% ({dbtCount})
              </button>
              <button
                type="button"
                onClick={() => setNotifTab('advisories')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                  notifTab === 'advisories'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-extrabold ring-1 ring-neutral-300/60 dark:ring-neutral-600'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                📢 Advisories ({advisoriesCount})
              </button>
            </div>

            {/* Unauthenticated Login Prompt Banner */}
            {!isLoggedIn && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-brand-50 dark:from-emerald-950/50 dark:to-neutral-850 border-b border-emerald-200 dark:border-emerald-800 text-xs shrink-0">
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
                      onClick={closeNotifications}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-700 text-white px-3 py-1 text-xs font-bold shadow-xs hover:bg-emerald-800 transition"
                    >
                      <span>Sign In / Register</span>
                      <span>➔</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Notification Cards List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p className="font-medium text-neutral-600 dark:text-neutral-400 max-w-xs mx-auto">
                    {t('nav_noNotifications')}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const isUnread = !n.read;
                  return (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (isUnread) handleMarkOneRead(n._id, n.isPublic);
                      }}
                      className={`p-3.5 transition-all text-xs rounded-2xl border ${
                        isUnread
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-400/20 shadow-xs cursor-pointer'
                          : 'bg-neutral-50/80 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-750 opacity-90'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{getNotifIcon(n)}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm truncate">
                                {n.title}
                              </span>
                              {isUnread && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white animate-pulse">
                                  NEW
                                </span>
                              )}
                              {n.priority === 'urgent' && (
                                <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-1.5 py-0.5 text-[9px] font-extrabold">
                                  URGENT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 font-mono whitespace-nowrap">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Card Message Body */}
                      <div className="p-3 rounded-xl bg-white/95 dark:bg-neutral-900/90 border border-neutral-200/70 dark:border-neutral-700/70 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300 font-mono break-words whitespace-pre-line shadow-2xs">
                        {n.message}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-neutral-200/50 dark:border-neutral-700/50 text-[11px]">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 truncate">
                          ✓ {n.isPublic ? (n.authorName || 'Official Advisory') : `SMS to +91 ${n.phone || 'Portal'}`}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          {isUnread ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkOneRead(n._id, n.isPublic);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold shadow-2xs transition cursor-pointer"
                              title="Mark as read"
                            >
                              <span>✓</span>
                              <span>{language === 'hi' ? 'पढ़ लिया' : 'Mark Read'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                              ✓ {language === 'hi' ? 'पढ़ा हुआ' : 'Read'}
                            </span>
                          )}

                          <a
                            href="/status"
                            onClick={closeNotifications}
                            className="font-bold text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                          >
                            {n.type?.startsWith('payment_') ? 'Voucher ➔' : 'Dossier ➔'}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pinned Bottom Action */}
            <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-center shrink-0 pb-[max(14px,env(safe-area-inset-bottom))]">
              <a
                href="/status"
                onClick={closeNotifications}
                className="block w-full py-2.5 rounded-xl bg-brand-700 text-white text-xs font-bold hover:bg-brand-800 transition shadow-sm"
              >
                View Full DBT Payment & Queue Dossier ➔
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
