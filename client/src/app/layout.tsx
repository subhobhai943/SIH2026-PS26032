import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#15803d',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sih-32.vercel.app'),
  title: {
    default: 'Smart Mandi · Farmer Procurement & DBT Portal',
    template: '%s | Smart Mandi Portal',
  },
  description:
    'Smart slot booking, live digital queue management, and Direct Benefit Transfer (DBT) 20% advance guarantee for government procurement centres — SIH 2026 PS26032',
  applicationName: 'Smart Mandi Procurement Queue',
  authors: [{ name: 'Government of India - e-Mandi Department' }],
  keywords: [
    'Farmer Procurement',
    'Mandi Queue',
    'MSP Slot Booking',
    'Direct Benefit Transfer',
    'DBT',
    'Agri Logistics',
    'SIH 2026',
    'PS26032',
  ],
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Smart Mandi · Farmer Procurement & DBT Portal',
    description:
      'Instant slot booking, live gate pass token status, and guaranteed 20% safety advance via DBT for farmers.',
    url: 'https://sih-32.vercel.app',
    siteName: 'Smart Mandi Portal (e-Procurement)',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Smart Mandi: Efficient Farmer Procurement & DBT Portal Preview',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smart Mandi · Farmer Procurement & DBT Portal',
    description:
      'Instant slot booking, live digital queue tracking, and Direct Benefit Transfer (DBT) payment confirmation.',
    images: ['/og-image.jpg'],
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
