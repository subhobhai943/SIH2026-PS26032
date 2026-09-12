'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Alert, Card, EmptyState, PageHeader, StatTile, StatusBadge, Button } from '@/components/ui';
import {
  IconClock,
  IconMapPin,
  IconQueue,
  IconSearch,
  IconClose,
  IconBuilding,
  IconCheck,
} from '@/components/icons';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { prefersReducedMotion, animateModalEnter, animateModalExit } from '@/lib/animations';

type Center = {
  _id: string;
  name: string;
  district: string;
  state?: string;
  code?: string;
  crops?: string[];
  dailyCapacity?: number;
  openTime?: string;
  closeTime?: string;
};

type BoardEntry = {
  token: number;
  status: string;
  position: number;
  estimatedWaitLabel: string;
  farmerName: string;
  village: string;
  slot: string;
};

type Board = {
  center: { name: string };
  date: string;
  nowServing: { token: number } | null;
  waiting: BoardEntry[];
  counts: { total: number; waiting: number; completed: number; cancelled: number };
};

export default function QueuePage() {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const servingBadgeRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const modalBackdropRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Close auto-suggest dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (board && !prefersReducedMotion()) {
      try {
        if (servingBadgeRef.current) {
          gsap.fromTo(
            servingBadgeRef.current,
            { scale: 0.88, opacity: 0.8 },
            { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
          );
        }
        const rows = document.querySelectorAll('.queue-row');
        if (rows.length > 0) {
          gsap.fromTo(
            rows,
            { opacity: 0.7, x: -8 },
            {
              opacity: 1,
              x: 0,
              stagger: 0.025,
              duration: 0.25,
              ease: 'power2.out',
              clearProps: 'all',
            }
          );
        }
      } catch (err) {
        console.warn('Queue animation skipped:', err);
      }
    }
  }, [board?.nowServing?.token, board?.waiting?.length]);

  useEffect(() => {
    api.get<Center[]>('/centers').then(setCenters).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!centerId) return;
    api
      .get<Board>(`/queue/${centerId}?date=${date}`)
      .then(setBoard)
      .catch((e) => setError(e.message));

    const socket = getSocket();
    setConnected(socket.connected);
    socket.emit('queue:watch', { centerId, date });
    const onUpdate = (data: Board) => setBoard(data);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('queue:update', onUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.emit('queue:unwatch', { centerId, date });
      socket.off('queue:update', onUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [centerId, date]);

  useEffect(() => {
    if (modalOpen) {
      animateModalEnter(modalBackdropRef.current, modalContentRef.current);
    }
  }, [modalOpen]);

  function closeModal() {
    animateModalExit(modalBackdropRef.current, modalContentRef.current, false, () => {
      setModalOpen(false);
    });
  }

  const activeCenter = useMemo(() => {
    return centers.find((c) => c._id === centerId);
  }, [centers, centerId]);

  const states = useMemo(() => {
    const list = Array.from(new Set(centers.map((c) => c.state).filter(Boolean) as string[])).sort();
    return ['All', ...list];
  }, [centers]);

  const inlineMatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return centers.slice(0, 8);
    return centers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q) ||
      (c.state && c.state.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  }, [centers, searchQuery]);

  const modalMatches = useMemo(() => {
    return centers.filter((c) => {
      const matchState = selectedState === 'All' || c.state === selectedState;
      if (!matchState) return false;
      if (!modalSearchQuery.trim()) return true;
      const q = modalSearchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q))
      );
    });
  }, [centers, modalSearchQuery, selectedState]);

  function selectCenter(center: Center) {
    setCenterId(center._id);
    setSearchQuery(center.name);
    setDropdownOpen(false);
    if (modalOpen) closeModal();
  }

  function handleSearchButtonClick() {
    setModalSearchQuery(searchQuery);
    setModalOpen(true);
    setDropdownOpen(false);
  }

  function handleClearSearch() {
    setSearchQuery('');
    setDropdownOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow={t('queue_eyebrow')}
          title={t('queue_title')}
          subtitle={t('queue_subtitle')}
        />
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${connected ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-400'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-brand-500 animate-pulse' : 'bg-neutral-300'}`} />
          {connected ? t('queue_liveConnected') : 'Connecting…'}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      {/* SEARCH PROCUREMENT CENTERS CONTROLS */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input Bar with Auto-Suggestions */}
          <div ref={searchContainerRef} className="relative flex-1">
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                <IconSearch className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (inlineMatches.length > 0) {
                      selectCenter(inlineMatches[0]);
                    } else {
                      handleSearchButtonClick();
                    }
                  } else if (e.key === 'Escape') {
                    setDropdownOpen(false);
                  }
                }}
                placeholder="Search mandi by name, district, state or code (e.g. Khanna, Karnal, Sehore)..."
                className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-9 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-sm transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Instant Suggestions Dropdown */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl">
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                  <span>Matching Procurement Centres ({inlineMatches.length})</span>
                  <button
                    type="button"
                    onClick={handleSearchButtonClick}
                    className="text-brand-600 hover:underline font-bold"
                  >
                    Browse All ➔
                  </button>
                </div>

                {inlineMatches.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-500">
                    No procurement centre found matching &quot;{searchQuery}&quot;.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleSearchButtonClick}
                        className="rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                      >
                        Open Full Directory
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-50">
                    {inlineMatches.map((c) => {
                      const isSelected = c._id === centerId;
                      return (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => selectCenter(c)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-brand-50/80 text-brand-900 font-semibold'
                              : 'hover:bg-neutral-50 text-neutral-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-xs sm:text-sm text-neutral-900 truncate">
                                {c.name}
                              </span>
                              {c.code && (
                                <span className="rounded bg-neutral-100 px-1.5 py-0.2 font-mono text-[10px] text-neutral-600 font-bold shrink-0">
                                  {c.code}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                              <span>📍 {c.district}, {c.state}</span>
                              {c.crops && c.crops.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="truncate capitalize">{c.crops.slice(0, 3).join(', ')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {isSelected ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-100/80 px-2 py-0.5 rounded-full">
                                <IconCheck className="h-3 w-3" /> Active
                              </span>
                            ) : (
                              <span className="text-xs text-brand-600 font-bold">
                                Select ➔
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dedicated SEARCH BUTTON */}
          <button
            type="button"
            onClick={handleSearchButtonClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 shrink-0 active:scale-95"
          >
            <IconSearch className="h-4 w-4" />
            <span>Search Centres (केंद्र खोजें)</span>
          </button>

          {/* Browse All Centres Modal Trigger */}
          <button
            type="button"
            onClick={() => {
              setModalSearchQuery('');
              setSelectedState('All');
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 shrink-0"
          >
            <IconBuilding className="h-4 w-4 text-neutral-500" />
            <span>All Centres ({centers.length})</span>
          </button>
        </div>

        {/* Quick State Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-neutral-400 font-bold shrink-0 text-[11px] uppercase tracking-wider">
            Quick Filter:
          </span>
          {['Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Maharashtra', 'Gujarat'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSelectedState(st);
                setModalSearchQuery('');
                setModalOpen(true);
              }}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50/40 transition shadow-2xs shrink-0 text-xs"
            >
              {st}
            </button>
          ))}
        </div>

        {/* Active Selected Mandi Badge Card */}
        {activeCenter && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white font-bold">
                🏛️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-900">{activeCenter.name}</span>
                  {activeCenter.code && (
                    <span className="rounded bg-brand-200/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-brand-900">
                      {activeCenter.code}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ Live Queue Active
                  </span>
                </div>
                <div className="text-xs text-neutral-600">
                  District: <strong className="text-neutral-800">{activeCenter.district}</strong> · State: <strong className="text-neutral-800">{activeCenter.state}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearchButtonClick}
                className="inline-flex items-center gap-1 rounded-lg bg-white border border-brand-300 px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-50 transition shadow-2xs"
              >
                <IconSearch className="h-3.5 w-3.5" />
                <span>Change Mandi (मंडी बदलें)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCenterId('');
                  setBoard(null);
                  setSearchQuery('');
                }}
                className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                title="Clear selected mandi"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SEARCH & BROWSE PROCUREMENT CENTRES MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <div
            ref={modalBackdropRef}
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs"
            onClick={closeModal}
          />
          <div
            ref={modalContentRef}
            className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col border border-neutral-200"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-emerald-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <IconSearch className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">
                    Search Procurement Centres (खरीद केंद्र खोजें)
                  </h3>
                  <p className="text-xs text-brand-200">
                    Find and inspect live queue tokens across {centers.length} official APMC Mandis
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search & State Filter Controls */}
            <div className="p-4 border-b border-neutral-200 bg-neutral-50/80 space-y-3">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
                  <IconSearch className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  autoFocus
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Type centre name, district, state, or code (e.g. Nabha, Aligarh, Sehore, Kota)..."
                  className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-9 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 shadow-2xs"
                />
                {modalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setModalSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* State Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {states.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedState(st)}
                    className={`rounded-full px-3 py-1 font-semibold text-xs shrink-0 transition ${
                      selectedState === st
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-neutral-500 flex items-center justify-between font-medium">
                <span>Showing <strong>{modalMatches.length}</strong> of {centers.length} Mandis</span>
                {selectedState !== 'All' && (
                  <span className="text-brand-700 font-bold">Filtered by: {selectedState}</span>
                )}
              </div>
            </div>

            {/* Mandi Cards List */}
            <div className="overflow-y-auto p-4 space-y-3 flex-1 max-h-[55vh]">
              {modalMatches.length === 0 ? (
                <div className="p-10 text-center text-neutral-500 space-y-2">
                  <div className="text-3xl">🔍</div>
                  <div className="font-semibold text-sm">No procurement centres match your search</div>
                  <p className="text-xs text-neutral-400">Try searching with a broader name, district, or switch the state filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalSearchQuery('');
                      setSelectedState('All');
                    }}
                    className="mt-2 rounded-xl bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100"
                  >
                    Reset Search &amp; Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalMatches.map((c) => {
                    const isSelected = c._id === centerId;
                    return (
                      <div
                        key={c._id}
                        className={`rounded-xl p-3.5 border transition flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-sm text-neutral-900 leading-snug">
                              {c.name}
                            </div>
                            {c.code && (
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-neutral-700 shrink-0">
                                {c.code}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-neutral-500 flex items-center gap-1.5">
                            <span>📍 {c.district}, {c.state}</span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                            {c.crops?.map((crop) => (
                              <span
                                key={crop}
                                className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 capitalize text-[10px]"
                              >
                                {crop}
                              </span>
                            ))}
                            {c.dailyCapacity && (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 text-[10px] font-semibold">
                                {c.dailyCapacity} Qtl/day
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400">
                            {c.openTime || '08:00'} - {c.closeTime || '17:00'}
                          </span>
                          <button
                            type="button"
                            onClick={() => selectCenter(c)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <IconCheck className="h-3.5 w-3.5" />
                                <span>Currently Viewing</span>
                              </>
                            ) : (
                              <span>View Live Queue ➔</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
              <span>National Agriculture Market (e-NAM) Verified Network</span>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg bg-white border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no centre selected */}
      {!centerId && (
        <Card className="p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IconSearch className="h-7 w-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {t('queue_selectCenterPrompt')}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500">
              Search by Mandi name, District, or State to view real-time tokens, waiting farmers, and current serving counter.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSearchButtonClick}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-brand-700 transition"
            >
              <IconSearch className="h-4 w-4" />
              <span>Search Procurement Centres (खरीद केंद्र खोजें)</span>
            </button>
          </div>
        </Card>
      )}

      {board && (
        <div ref={boardRef} className="space-y-5">
          <Card className="flex flex-col items-center gap-4 bg-gradient-to-br from-brand-600 to-brand-700 p-5 sm:p-8 text-center text-white sm:flex-row sm:justify-between sm:text-left shadow-lg">
            <div className="flex items-center gap-2 text-sm text-brand-50">
              <IconMapPin className="h-4 w-4" /> {board.center?.name || activeCenter?.name || 'Procurement Centre'} · {board.date || date}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                {board.nowServing && <span className="absolute inset-0 rounded-full bg-white/40 animate-pulse-ring" />}
                <div
                  ref={servingBadgeRef}
                  className="relative rounded-full bg-white/15 px-6 py-3 ring-1 ring-inset ring-white/30 backdrop-blur-md"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-100">
                    {t('queue_nowServing')}
                  </div>
                  <div className="text-3xl font-extrabold">{board.nowServing ? `#${board.nowServing.token}` : '—'}</div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile label={t('queue_waiting')} value={String(board.counts?.waiting ?? 0)} />
            <StatTile label={t('queue_completed')} value={String(board.counts?.completed ?? 0)} />
            <StatTile label={t('queue_total')} value={String(board.counts?.total ?? 0)} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-700">
              {t('queue_waiting')}
            </div>
            {!Array.isArray(board.waiting) || board.waiting.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={<IconQueue className="h-8 w-8" />} title={t('queue_noOneWaiting')} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-5 py-2.5">{t('queue_token')}</th>
                      <th className="px-5 py-2.5">{t('queue_farmer')}</th>
                      <th className="px-5 py-2.5">Slot</th>
                      <th className="px-5 py-2.5">{t('queue_status')}</th>
                      <th className="px-5 py-2.5">Position</th>
                      <th className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="h-3.5 w-3.5" /> {t('queue_estWait')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.waiting.map((entry) => {
                      const slotDisplay =
                        typeof entry.slot === 'object' && entry.slot !== null
                          ? `${(entry.slot as any).startTime || ''}–${(entry.slot as any).endTime || ''}`
                          : typeof entry.slot === 'string' && entry.slot.trim()
                          ? entry.slot
                          : '—';
                      const farmerNameDisplay =
                        entry.farmerName ||
                        (typeof (entry as any).farmer === 'object' ? (entry as any).farmer?.name : '') ||
                        'Farmer';
                      const villageDisplay =
                        entry.village ||
                        (typeof (entry as any).farmer === 'object' ? (entry as any).farmer?.village : '') ||
                        '—';

                      return (
                        <tr key={entry.token} className="queue-row border-t border-neutral-100 hover:bg-neutral-50/50">
                          <td className="px-5 py-3 font-semibold text-neutral-900">#{entry.token}</td>
                          <td className="px-5 py-3">
                            {farmerNameDisplay} <span className="text-neutral-400">· {villageDisplay}</span>
                          </td>
                          <td className="px-5 py-3 text-neutral-500">{slotDisplay}</td>
                          <td className="px-5 py-3">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-5 py-3 text-neutral-500">{entry.position}</td>
                          <td className="px-5 py-3 font-medium text-neutral-700">{entry.estimatedWaitLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
