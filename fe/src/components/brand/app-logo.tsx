import Image from 'next/image';
import Link from 'next/link';
import { APP_BRAND_MARK, APP_BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

export const APP_LOGO_PATH = '/logo.jpg';

type AppLogoProps = {
  size?: number;
  /** Chỉ hiện ảnh, không chữ */
  iconOnly?: boolean;
  className?: string;
  imageClassName?: string;
  linked?: boolean;
};

export function AppLogo({
  size = 40,
  iconOnly = false,
  className,
  imageClassName,
  linked = false,
}: AppLogoProps) {
  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      <Image
        src={APP_LOGO_PATH}
        alt={APP_BRAND_NAME}
        width={size}
        height={size}
        className={cn('shrink-0 rounded-md object-contain', imageClassName)}
        priority
      />
      {!iconOnly ? (
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {APP_BRAND_MARK}
          </p>
          <p className="font-serif text-lg font-semibold leading-tight tracking-tight text-slate-900">
            Quản lý dự án
          </p>
        </div>
      ) : null}
    </div>
  );

  if (linked) {
    return (
      <Link
        href="/"
        className="block rounded-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {content}
      </Link>
    );
  }

  return content;
}
