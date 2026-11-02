'use client';

import Image from 'next/image';
import { Toaster } from 'sonner';
import { APP_LOGO_PATH } from '@/components/brand/app-logo';
import { ProjectReportSubmissionForm } from '@/components/projects/project-report-submission-form';
import { APP_BRAND_MARK, APP_BRAND_NAME } from '@/lib/brand';

export default function PublicNopBaoCaoPage() {
  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-emerald-50/80 py-6 md:py-10">
        <div className="mx-auto max-w-[640px] space-y-3 px-4">
          <header className="overflow-hidden rounded-lg border border-teal-800/20 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 shadow-md">
            <div className="px-6 py-6 text-center sm:text-left">
              <div className="mb-5 flex justify-center sm:justify-start">
                <div className="rounded-xl bg-white/95 p-2.5 shadow-sm ring-1 ring-white/40">
                  <Image
                    src={APP_LOGO_PATH}
                    alt={APP_BRAND_MARK}
                    width={88}
                    height={88}
                    className="h-[5.5rem] w-[5.5rem] rounded-lg object-contain"
                    priority
                  />
                </div>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                Nộp báo cáo kế hoạch nghiệm thu — Dự án điền
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-teal-100/95">
                Chọn tên KST và kỳ báo cáo — hệ thống liệt kê mọi dự án thuộc
                KST. Nhập kế hoạch nghiệm thu và nộp một lần cho tất cả dự án.
              </p>
            </div>
          </header>

          <section className="rounded-lg border border-teal-200/80 bg-white px-5 py-4 shadow-sm md:px-6 md:py-5">
            <ProjectReportSubmissionForm publicForm />
          </section>

          <p className="text-center text-xs text-teal-800/70">
            {APP_BRAND_NAME} · Form nộp báo cáo
          </p>
        </div>
      </div>
    </>
  );
}
