'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { getToken } from '@/lib/api';
import { IconBell, IconCheck, IconClose } from './icons';

type ToastData = {
  id: string;
  title: string;
  message: string;
  type?: string;
  data?: any;
};

export function LiveNotificationToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
      setPermissionAsked(Notification.permission !== 'default');
    }

    const token = getToken();
    if (!token) return;

    const socket = getSocket();

    function handleNotification(payload: any) {
      const newToast: ToastData = {
        id: payload.id || String(Date.now()),
        title: payload.title || '💰 e-Mandi DBT Alert',
        message: payload.message || 'Procurement update received.',
        type: payload.type,
        data: payload.data,
      };

      setToast(newToast);

      // Trigger native OS notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(newToast.title, {
            body: newToast.message,
            icon: '/opengraph-image.jpg',
            badge: '/opengraph-image.jpg',
          });
        } catch (_) {}
      }

      // Vibrate mobile device
      if ('navigator' in window && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch (_) {}
      }

      // Broadcast auth/notification change to update header bell
      window.dispatchEvent(new Event('auth:change'));
    }

    function handlePaymentAdvance(payload: any) {
      handleNotification({
        id: String(Date.now()),
        title: '💰 20% DBT Safety Advance Credited!',
        message: `Token ${payload.token || '1'}: Rs ${payload.advanceAmount || '4,406'} credited to your account. Ref: ${payload.paymentRef || 'ADV-CONFIRMED'}.`,
        type: 'payment_advance',
        data: payload,
      });
    }

    socket.on('notification', handleNotification);
    socket.on('payment:advance', handlePaymentAdvance);

    return () => {
      socket.off('notification', handleNotification);
      socket.off('payment:advance', handlePaymentAdvance);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setHasPermission(perm === 'granted');
      setPermissionAsked(true);
      if (perm === 'granted') {
        new Notification('🌾 e-Mandi Alerts Activated', {
          body: 'You will receive instant SMS and 20% DBT payment receipts on this device.',
        });
      }
    } catch (_) {}
  };

  return (
    <>
      {/* Optional Permission Prompt Banner for Farmers */}
      {!permissionAsked && getToken() && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 z-40 max-w-sm rounded-2xl bg-neutral-950 text-white p-3.5 shadow-2xl border border-neutral-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-base">
              🔔
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate">Receive Instant DBT Receipts?</p>
              <p className="text-[10px] text-neutral-400 truncate">Get payment alerts on this device.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={requestNotificationPermission}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-neutral-950 transition"
            >
              Allow
            </button>
            <button
              onClick={() => setPermissionAsked(true)}
              className="p-1 text-neutral-400 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Real-time Floating Payment & SMS Toast */}
      {toast && (
        <div className="fixed top-20 right-3 sm:right-6 z-50 max-w-md w-full rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl border-2 border-emerald-500 p-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-xl text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20">
                💰
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-neutral-900 dark:text-neutral-100 truncate">
                    {toast.title}
                  </span>
                  <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                    LIVE
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-mono bg-neutral-100/80 dark:bg-neutral-800/80 p-2 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  {toast.message}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <a
                    href="/status"
                    onClick={() => setToast(null)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline"
                  >
                    <span>View DBT Voucher / Print Receipt</span>
                    <span>➔</span>
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              aria-label="Close"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
