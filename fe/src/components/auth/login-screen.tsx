'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { APP_LOGO_PATH } from '@/components/brand/app-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { APP_BRAND_MARK } from '@/lib/brand';
import { cn } from '@/lib/utils';

const BG_IMAGE =
  'https://images.unsplash.com/photo-1470071459604-3b6480298f88?q=80&w=1920&auto=format&fit=crop';

export function LoginScreen() {
  const { login, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Đăng nhập thành công');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Không đăng nhập được. Vui lòng thử lại.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={BG_IMAGE}
          alt=""
          fill
          priority
          className="object-cover scale-105 animate-login-ken-burns"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/88 via-emerald-900/75 to-slate-900/85" />
        <div className="login-orb login-orb-a absolute -left-24 top-[10%] h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="login-orb login-orb-b absolute bottom-[5%] right-[5%] h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="login-orb login-orb-c absolute right-[20%] top-[35%] h-56 w-56 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
      </div>

      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        <section className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center lg:items-start lg:px-14 lg:py-16 lg:text-left">
          <div className="login-logo-wrap mb-8 flex flex-col items-center lg:items-start">
            <div className="relative rounded-2xl bg-white/10 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-white/25 backdrop-blur-sm">
              <Image
                src={APP_LOGO_PATH}
                alt={APP_BRAND_MARK}
                width={128}
                height={128}
                className="h-28 w-28 rounded-xl object-contain sm:h-32 sm:w-32"
                priority
              />
            </div>
            <p className="mt-8 font-serif text-4xl font-semibold tracking-[0.12em] text-white sm:text-5xl">
              <span className="bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
                {APP_BRAND_MARK}
              </span>
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-100/90 sm:text-base">
              Nền tảng quản lý dự án, hợp đồng và nghiệm thu — hiện đại, minh
              bạch, bền vững.
            </p>
          </div>
          <ul className="mt-4 hidden max-w-sm space-y-2 text-left text-sm text-teal-100/80 lg:block">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Dashboard tài chính theo thời gian thực
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Nhập nhanh nghiệm thu &amp; thu tiền
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Kiểm soát kế hoạch theo từng hợp đồng
            </li>
          </ul>
        </section>

        <section className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 lg:px-10 lg:py-16">
          <div
            className={cn(
              'login-card-enter w-full max-w-md rounded-2xl border border-white/25',
              'bg-white/92 p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-xl',
              'sm:p-10',
            )}
          >
            <h1 className="font-serif text-2xl font-semibold text-slate-900">
              Đăng nhập
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Email và mật khẩu do quản trị cấp.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting || authLoading}
                  className="border-slate-200 bg-white/80 focus-visible:ring-teal-600/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  Mật khẩu
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting || authLoading}
                  className="border-slate-200 bg-white/80 focus-visible:ring-teal-600/30"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || authLoading}
                className="w-full bg-gradient-to-r from-teal-700 to-emerald-600 text-white shadow-md transition hover:from-teal-600 hover:to-emerald-500 hover:shadow-lg"
              >
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
