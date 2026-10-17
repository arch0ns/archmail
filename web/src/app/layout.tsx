import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ANNE TMAIL — Secure Real-Time Temp Mail',
  description:
    'Email sementara yang aman, cepat, dan real-time. Tanpa registrasi, masa aktif 30 menit, dengan proteksi IDOR, XSS, dan lampiran via Signed URL.',
  applicationName: 'ANNE TMAIL',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}