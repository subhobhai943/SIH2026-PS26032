'use client';

import React from 'react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { LanguageModal } from '@/components/LanguageModal';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        {/* Subtle Wheat Watermark Motif in bottom right corner (GPU-accelerated, S3 hosted) */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        >
          <div
            className="absolute right-0 bottom-0 w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] max-w-full max-h-full bg-contain bg-no-repeat bg-right-bottom opacity-[0.09] dark:opacity-[0.06] transition-opacity duration-500 filter contrast-125"
            style={{
              backgroundImage: `url('/api/media/backgrounds/bg_wheat_pattern.jpg')`,
            }}
          />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-3.5 py-5 sm:px-6 sm:py-8 overflow-guard">{children}</main>
          <SiteFooter />
        </div>
        <LanguageModal />
      </LanguageProvider>
    </ThemeProvider>
  );
}

