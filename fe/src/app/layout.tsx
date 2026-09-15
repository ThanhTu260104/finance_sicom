import type { Metadata } from 'next';
import { Manrope, Source_Serif_4 } from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
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
  title: 'Finance Project',
  description: 'Quản lý dự án và hợp đồng',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${manrope.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full font-sans antialiased text-slate-900">
        <AppShell>{children}</AppShell>
        <AppToaster />
      </body>
    </html>
  );
}
