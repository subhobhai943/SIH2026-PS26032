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
        {/* Subtle Ambient Background Watermarks (Non-blocking, GPU-accelerated, hosted on S3) */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden select-none"
        >
          {/* Panoramic Agricultural Landscape Background */}
          <div
            className="absolute inset-0 bg-cover bg-top bg-no-repeat opacity-[0.035] dark:opacity-[0.055] transition-opacity duration-500 filter saturate-150 dark:invert-[0.1]"
            style={{
              backgroundImage: `url('https://sih26032-farmer-media.s3.eu-north-1.amazonaws.com/backgrounds/bg_crops_landscape.jpg')`,
            }}
          />
          {/* Subtle Golden Wheat Watermark Motif in bottom right corner */}
          <div
            className="absolute right-0 bottom-0 w-[550px] h-[550px] max-w-full max-h-full bg-contain bg-no-repeat bg-right-bottom opacity-[0.025] dark:opacity-[0.04] transition-opacity duration-500"
            style={{
              backgroundImage: `url('https://sih26032-farmer-media.s3.eu-north-1.amazonaws.com/backgrounds/bg_wheat_pattern.jpg')`,
            }}
          />
        </div>

        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3.5 py-5 sm:px-6 sm:py-8 overflow-guard">{children}</main>
        <SiteFooter />
        <LanguageModal />
      </LanguageProvider>
    </ThemeProvider>
  );
}

