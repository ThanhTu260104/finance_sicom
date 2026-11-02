'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeDollarSign,
  CalendarRange,
  ClipboardCheck,
  FileText,
  Handshake,
  Lightbulb,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type RoleKey = 'accounting' | 'procurement';

const ROLES: {
  key: RoleKey;
  label: string;
  sub: string;
  icon: typeof Wallet;
}[] = [
  {
    key: 'accounting',
    label: 'Kế toán',
    sub: 'Đối tác · HĐ thầu phụ / NCC · nghiệm thu · thu chi · công nợ',
    icon: Wallet,
  },
  {
    key: 'procurement',
    label: 'Đấu thầu – Mua hàng',
    sub: 'Nhập hợp đồng ký với chủ đầu tư',
    icon: ShoppingCart,
  },
];

export default function GuidePage() {
  const [role, setRole] = useState<RoleKey>('accounting');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Breadcrumbs items={[{ label: 'Hướng dẫn sử dụng' }]} />
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          Hướng dẫn sử dụng
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Chọn bộ phận của bạn để xem các bước cần làm. Bấm vào chữ màu xanh để
          mở đúng trang trong phần mềm.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="tablist">
        {ROLES.map((r) => {
          const Icon = r.icon;
          const active = role === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRole(r.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span>
                <span className="block font-semibold">{r.label}</span>
                <span
                  className={cn(
                    'block text-xs',
                    active ? 'text-slate-300' : 'text-slate-500',
                  )}
                >
                  {r.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {role === 'accounting' ? <AccountingGuide /> : <ProcurementGuide />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Câu hỏi thường gặp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <Faq q="Không thấy nút Thêm / Sửa / Xóa?">
            Tài khoản của bạn đang ở chế độ <b>Chỉ xem</b> hoặc chỉ được cấp
            một số tính năng. Nhờ quản trị cấp thêm quyền ở trang Tài khoản.
          </Faq>
          <Faq q="Nhập sai thì sửa thế nào?">
            Mở lại đúng hợp đồng, tìm dòng bị sai, bấm <b>Sửa</b> (biểu tượng
            bút) rồi lưu lại. Bấm <b>Xóa</b> nếu dòng đó bị nhập thừa.
          </Faq>
          <Faq q="Không tìm thấy hợp đồng khi nhập nghiệm thu?">
            Hợp đồng chưa được tạo, hoặc được tạo dưới dự án khác. Tìm ở trang{' '}
            <GuideLink href="/contracts">Hợp đồng</GuideLink>. Nếu chưa có,
            báo bộ phận đấu thầu – mua hàng (HĐ chủ đầu tư) tạo trước. HĐ thầu phụ / NCC thì kế toán tự tạo.
          </Faq>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountingGuide() {
  return (
    <div className="space-y-4">
      <Section
        icon={Handshake}
        title="1. Thêm nhà cung cấp / thầu phụ"
        intro="Mỗi đối tác chỉ cần nhập một lần, sau đó chọn lại khi tạo hợp đồng."
      >
        <Steps>
          <li>
            Vào <b>Danh mục quản trị → Đối tác</b>, chọn tab{' '}
            <GuideLink href="/customers?type=SUPPLIER">Nhà cung cấp</GuideLink>{' '}
            hoặc{' '}
            <GuideLink href="/customers?type=SUBCONTRACTOR">Thầu phụ</GuideLink>.
          </li>
          <li>
            Gõ tên hoặc mã số thuế vào ô tìm kiếm trước để <b>tránh nhập trùng</b>.
          </li>
          <li>
            Chưa có thì bấm <b>Thêm</b> và điền mã, tên, mã số thuế, người liên
            hệ, số điện thoại, email, rồi <b>Lưu</b>.
          </li>
        </Steps>
        <Screenshot
          src="/guide/doi-tac.png"
          width={1184}
          height={460}
          caption="Đối tác → tab Nhà cung cấp → nút Thêm nhà cung cấp."
        />
      </Section>

      <Section
        icon={FileText}
        title="2. Nhập hợp đồng thầu phụ / nhà cung cấp"
        intro="Hợp đồng bên mình phải trả tiền. Tạo ngay sau khi ký để theo dõi nghiệm thu và thanh toán."
      >
        <Steps>
          <li>
            Bấm vào{' '}
            <GuideLink href="/contracts/new?kind=SUPPLIER">
              Thêm HĐ nhà cung cấp
            </GuideLink>{' '}
            hoặc{' '}
            <GuideLink href="/contracts/new?kind=SUBCONTRACTOR">
              Thêm HĐ thầu phụ
            </GuideLink>
            . Cách khác: <b>Hợp đồng</b> → chọn tab tương ứng → <b>Thêm</b>.
          </li>
          <li>
            Điền các ô theo bảng dưới, đính kèm file PDF hợp đồng rồi bấm{' '}
            <b>Lưu</b>.
          </li>
        </Steps>
        <FieldTable
          rows={[
            ['Dự án', 'Dự án dùng hàng / dịch vụ này.'],
            ['Công ty ký HĐ', 'Pháp nhân bên mình đứng tên ký.'],
            ['Nhà cung cấp / Thầu phụ', 'Chọn đối tác đã tạo ở bước 1.'],
            ['Số hợp đồng / Tên hợp đồng', 'Ghi đúng như trên bản giấy. Số hợp đồng không được trùng.'],
            ['Giá trị hợp đồng', 'Tổng giá trị theo hợp đồng.'],
            ['Chu kỳ nghiệm thu / Thời hạn / Ngày bắt đầu – kết thúc', 'Dùng để lập kế hoạch nghiệm thu từng đợt.'],
            ['Điều khoản thanh toán (ngày)', 'Số ngày phải trả sau khi nhận hóa đơn, ví dụ 30. Dùng để tính hạn phải trả.'],
            ['File hợp đồng (PDF)', 'File đầu tiên là Hợp đồng; file sau có thể đổi loại thành Phụ lục.'],
          ]}
        />
        <Tip>
          HĐ ký với <b>chủ đầu tư</b> do bộ phận đấu thầu – mua hàng nhập. Kế
          toán chỉ tạo HĐ thầu phụ và HĐ nhà cung cấp.
        </Tip>
        <Screenshot
          src="/guide/them-hd-ncc.png"
          width={1184}
          height={900}
          caption="Form thêm HĐ nhà cung cấp — ô có dấu * là bắt buộc."
        />
      </Section>

      <Section
        icon={CalendarRange}
        title="3. Lập kế hoạch nghiệm thu"
        intro="Các đợt dự kiến nghiệm thu / thanh toán của hợp đồng (cả HĐ chủ đầu tư lẫn thầu phụ / NCC). Khi nhập nghiệm thu sẽ chọn đợt ở đây."
      >
        <Steps>
          <li>
            Mở hợp đồng → tab <b>Kế hoạch nghiệm thu</b> (HĐ thầu phụ / NCC:{' '}
            <b>Kế hoạch nghiệm thu &amp; thanh toán</b>).
          </li>
          <li>
            Thêm từng đợt (kỳ, giá trị), hoặc để phần mềm tự chia theo chu kỳ
            và thời hạn hợp đồng.
          </li>
        </Steps>
        <Screenshot
          src="/guide/ke-hoach.png"
          width={1664}
          height={900}
          caption="Tab Kế hoạch nghiệm thu: Thêm kỳ, hoặc Sinh kế hoạch chia đều."
        />
      </Section>

      <Section
        icon={ClipboardCheck}
        title="4. Nhập nghiệm thu"
        intro="Mỗi lần nộp hồ sơ nghiệm thu cho chủ đầu tư (hoặc nhận hồ sơ của thầu phụ / NCC) thì nhập một dòng."
      >
        <Steps>
          <li>
            Vào <GuideLink href="/quick-entry">Nhập nhanh</GuideLink> trên
            menu.
          </li>
          <li>
            Ô <b>1. Dự án</b>: gõ mã hoặc tên dự án rồi chọn. Ô{' '}
            <b>2. Hợp đồng</b> sẽ tự mở danh sách hợp đồng của dự án đó. Dự án
            chỉ có 1 hợp đồng thì phần mềm chọn luôn.
          </li>
          <li>
            Bấm <b>Thêm nghiệm thu</b>, chọn <b>đợt</b> theo kế hoạch rồi điền
            các ô bên dưới.
          </li>
          <li>
            Bấm <b>Lưu</b>. Dòng mới hiện ngay trong bảng và tổng
            &quot;Đã nghiệm thu&quot; ở trên được cập nhật.
          </li>
        </Steps>
        <FieldTable
          rows={[
            ['Ngày NT', 'Ngày ký biên bản nghiệm thu.'],
            ['Giá trị', 'Số tiền nghiệm thu đợt này (gõ số, phần mềm tự thêm dấu chấm).'],
            ['Số hóa đơn / Ngày hóa đơn', 'Theo hóa đơn đã xuất. Ngày hóa đơn dùng để tính hạn thanh toán.'],
            ['Trạng thái hồ sơ', '"Chưa nộp" hoặc "Đã nộp - tiền chưa về".'],
            ['Thanh toán', '"Chờ CĐT thanh toán" khi đã nộp hồ sơ. Đổi thành "Đã thu tiền" khi tiền về.'],
            ['Ngày thu tiền', 'Ngày tiền thực tế chuyển vào tài khoản (xem bước 5).'],
          ]}
        />
        <Tip>
          Có thể nhập ngay trong trang hợp đồng: <b>Hợp đồng</b> → mở hợp đồng →
          tab <b>Nghiệm thu</b>. Hai nơi dùng chung dữ liệu.
        </Tip>
        <Screenshot
          src="/guide/qe-chon-du-an.png"
          width={1184}
          height={900}
          caption="Nhập nhanh: bấm ô Dự án là hiện danh sách để chọn."
        />
        <Screenshot
          src="/guide/qe-nghiem-thu.png"
          width={1184}
          height={900}
          caption="Chọn xong dự án & hợp đồng: bảng nghiệm thu hiện ngay bên dưới, bấm Thêm nghiệm thu."
        />
        <Screenshot
          src="/guide/them-nghiem-thu.png"
          width={1184}
          height={900}
          caption="Popup Thêm nghiệm thu: chọn đợt kế hoạch rồi điền ngày, giá trị, hóa đơn."
        />
      </Section>

      <Section
        icon={BadgeDollarSign}
        title="5. Ghi nhận thu tiền / chi trả"
        intro="Khi tiền về (hoặc khi công ty chuyển tiền cho thầu phụ / NCC), cập nhật lại đúng dòng nghiệm thu đó."
      >
        <Steps>
          <li>
            Mở hợp đồng như bước 4, tìm dòng nghiệm thu của đợt được thanh
            toán.
          </li>
          <li>
            Bấm <b>Sửa</b>, đổi <b>Thanh toán</b> thành{' '}
            <b>Đã thu tiền</b> (HĐ thầu phụ / NCC: <b>Đã chi trả</b>).
          </li>
          <li>
            Điền <b>Ngày thu tiền</b> (HĐ thầu phụ / NCC: <b>Ngày chi trả</b>)
            là ngày trên giấy báo có / ủy nhiệm chi, rồi bấm <b>Lưu</b>.
          </li>
        </Steps>
        <Tip>
          Phần mềm tự ghi nhận khoản thu / chi khi chọn &quot;Đã thu tiền&quot;
          / &quot;Đã chi trả&quot;, không cần nhập thêm ở chỗ khác.
        </Tip>
        <Screenshot
          src="/guide/bang-nghiem-thu.png"
          width={1664}
          height={900}
          caption="Bảng nghiệm thu: cột Thu tiền, Ngày thu tiền, Hạn TT, Tuổi nợ. Bấm Sửa ở dòng cần cập nhật."
        />
      </Section>

      <Section
        icon={Wallet}
        title="6. Theo dõi công nợ"
        intro="Phần mềm tự tính hạn thanh toán và số ngày quá hạn cho từng dòng nghiệm thu."
      >
        <FieldTable
          rows={[
            ['Hạn TT', 'Ngày hóa đơn + số ngày trong "Điều khoản thanh toán" của hợp đồng.'],
            ['Tuổi nợ', '"Còn X ngày" (màu vàng) → "Đến hạn" → "Quá hạn X ngày" (màu đỏ). Hiện "Đã thu" khi tiền đã về.'],
            ['Còn phải thu / phải trả', 'Đã nghiệm thu trừ đi đã thu (đã chi), xem ở đầu trang hợp đồng.'],
          ]}
        />
        <Steps>
          <li>
            Xem tổng toàn công ty ở <GuideLink href="/">Dashboard</GuideLink>.
          </li>
          <li>
            Xem từng hợp đồng: mở hợp đồng CĐT → <b>Theo dõi theo tháng</b> hoặc{' '}
            <b>Dashboard</b>.
          </li>
          <li>
            Xuất Excel toàn bộ nghiệm thu:{' '}
            <GuideLink href="/quick-entry?view=export">
              Nhập nhanh → Xuất nhanh
            </GuideLink>
            .
          </li>
        </Steps>
        <Tip>
          Nhớ nhập <b>Ngày hóa đơn</b>. Nếu để trống, phần mềm không tính được
          hạn thanh toán và tuổi nợ.
        </Tip>
        <Screenshot
          src="/guide/cong-no.png"
          width={1184}
          height={900}
          caption="Dashboard → Theo dõi công nợ: tổng còn phải thu, khoản quá hạn, sắp xếp theo tuổi nợ."
        />
      </Section>

      <Section
        icon={FileText}
        title="7. Import file kế toán (chỉ quản trị)"
        intro="Nhập hàng loạt nghiệm thu của nhiều hợp đồng cùng lúc từ bảng Excel của kế toán."
      >
        <Steps>
          <li>
            Vào <GuideLink href="/quick-entry">Nhập nhanh</GuideLink>, mở mục{' '}
            <b>Import file kế toán</b> ở trên cùng.
          </li>
          <li>Chọn file và kiểm tra bảng xem trước. Dòng lỗi được tô đỏ.</li>
          <li>
            Bấm Import. Dòng đã có (trùng số đợt) được cập nhật, dòng mới được
            thêm.
          </li>
        </Steps>
      </Section>
    </div>
  );
}

function ProcurementGuide() {
  return (
    <div className="space-y-4">
      <Section
        icon={FileText}
        title="1. Nhập hợp đồng ký với chủ đầu tư"
        intro="Bộ phận đấu thầu – mua hàng chỉ nhập hợp đồng ký với chủ đầu tư (bên mình được nhận tiền). Kế hoạch, nghiệm thu, thu tiền… do kế toán nhập."
      >
        <Steps>
          <li>
            Bấm vào{' '}
            <GuideLink href="/contracts/new">Thêm HĐ chủ đầu tư</GuideLink>.
            Cách khác: <b>Hợp đồng</b> → tab <b>HĐ Chủ đầu tư</b> →{' '}
            <b>Thêm</b>.
          </li>
          <li>
            Điền các ô theo bảng dưới, đính kèm file PDF hợp đồng rồi bấm{' '}
            <b>Lưu</b>.
          </li>
        </Steps>
        <FieldTable
          rows={[
            ['Dự án', 'Dự án của hợp đồng.'],
            ['Chủ đầu tư', 'Chọn trong danh sách. Chưa có thì thêm ở Đối tác → tab Chủ đầu tư.'],
            ['Công ty ký HĐ', 'Pháp nhân bên mình đứng tên ký.'],
            ['Số hợp đồng / Tên hợp đồng', 'Ghi đúng như trên bản giấy. Số hợp đồng không được trùng.'],
            ['Giá trị hợp đồng', 'Tổng giá trị theo hợp đồng.'],
            ['Ngày ký / Ngày bắt đầu – kết thúc / Thời hạn', 'Theo hợp đồng.'],
            ['Chu kỳ nghiệm thu', 'Bao lâu nghiệm thu một lần (tháng, quý…). Kế toán dùng để lập kế hoạch.'],
            ['Điều khoản thanh toán (ngày)', 'Số ngày CĐT phải trả sau khi nhận hóa đơn, ví dụ 30. Dùng để tính tuổi nợ.'],
            ['File hợp đồng (PDF)', 'File đầu tiên là Hợp đồng; file sau có thể đổi loại thành Phụ lục.'],
          ]}
        />
        <Tip>
          Chỉ nhập ở tab <b>HĐ Chủ đầu tư</b>. HĐ thầu phụ và HĐ nhà cung cấp do
          kế toán nhập.
        </Tip>
        <Screenshot
          src="/guide/them-hd-cdt.png"
          width={1184}
          height={900}
          caption="Thêm hợp đồng → tab HĐ Chủ đầu tư."
        />
      </Section>

      <Section
        icon={FileText}
        title="2. Phụ lục / thay đổi hợp đồng"
        intro="Khi ký phụ lục hoặc điều chỉnh giá trị với chủ đầu tư."
      >
        <Steps>
          <li>Mở hợp đồng → bấm <b>Sửa</b> để cập nhật giá trị, ngày kết thúc…</li>
          <li>Tải file phụ lục lên ở phần <b>Tệp đính kèm hợp đồng</b>.</li>
          <li>Báo kế toán nếu giá trị thay đổi để điều chỉnh kế hoạch nghiệm thu.</li>
        </Steps>
        <Screenshot
          src="/guide/trang-hd.png"
          width={1664}
          height={900}
          caption="Trang hợp đồng: nút Sửa ở góc phải, Tệp đính kèm hợp đồng để tải phụ lục."
        />
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-slate-500" />
          {title}
        </CardTitle>
        <p className="text-sm text-slate-600">{intro}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-800 marker:font-semibold marker:text-slate-500">
      {children}
    </ol>
  );
}

function FieldTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Ô cần nhập</th>
            <th className="px-3 py-2 font-medium">Ghi gì</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([field, desc]) => (
            <tr key={field} className="align-top">
              <td className="w-2/5 px-3 py-2 font-medium text-slate-900">
                {field}
              </td>
              <td className="px-3 py-2 text-slate-700">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-slate-900">{q}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

/** Ảnh chụp màn hình — bấm để mở cỡ thật ở tab mới */
function Screenshot({
  src,
  width,
  height,
  caption,
}: {
  src: string;
  width: number;
  height: number;
  caption: string;
}) {
  return (
    <figure className="space-y-1.5">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-lg border border-slate-200 shadow-sm transition-shadow hover:shadow-md"
      >
        <Image
          src={src}
          width={width}
          height={height}
          alt={caption}
          sizes="(min-width: 1024px) 960px, 100vw"
          className="h-auto w-full"
        />
      </a>
      <figcaption className="text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}

function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-blue-700 underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}
