import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import './../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Farmer Procurement Queue',
  description: 'Slot booking and live queue management for government procurement centres — SIH 2026 PS26032',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  manifest: '/manifest.json',
  themeColor: '#15803d',
  openGraph: {
    title: 'Farmer Procurement Queue',
    description: 'Smart slot booking and live queue management for government procurement centres',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-neutral-50 font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} Farmer Procurement Queue Management Platform</span>
            <span>SIH 2026 · PS26032 · Ministry of Consumer Affairs, Food &amp; Public Distribution</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
