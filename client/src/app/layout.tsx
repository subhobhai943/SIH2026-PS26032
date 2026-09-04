import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#15803d',
};

export const metadata: Metadata = {
  title: 'Farmer Procurement Queue',
  description: 'Slot booking and live queue management for government procurement centres — SIH 2026 PS26032',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Farmer Procurement Queue',
    description: 'Smart slot booking and live queue management for government procurement centres',
    type: 'website',
  },
};

import { ClientProviders } from '@/components/ClientProviders';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-neutral-50 font-sans antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
