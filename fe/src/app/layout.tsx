import type { Metadata } from 'next';
import { APP_BRAND_NAME } from '@/lib/brand';
import { Manrope, Source_Serif_4 } from 'next/font/google';
import { AppLayoutClient } from '@/components/layout/app-layout-client';
import { AppToaster } from '@/components/providers/toaster';
import './globals.css';

const manrope = Manrope({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const sourceSerif = Source_Serif_4({
  variable: '--font-serif',
  subsets: ['latin', 'vietnamese'],
});

export const metadata: Metadata = {
  title: APP_BRAND_NAME,
  description: 'Quản lý dự án, hợp đồng và nghiệm thu',
  icons: {
    icon: [{ url: '/logo.jpg', type: 'image/jpeg' }],
    apple: [{ url: '/logo.jpg', type: 'image/jpeg' }],
    shortcut: '/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${manrope.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full font-sans antialiased text-slate-900">
        <AppLayoutClient>{children}</AppLayoutClient>
        <AppToaster />
      </body>
    </html>
  );
}
