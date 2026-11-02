'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FileText, FileUp, X } from 'lucide-react';
import {
  companiesApi,
  contractAttachmentsApi,
  contractsApi,
  customersApi,
  projectsApi,
} from '@/lib/api';
import { toDateInputValue } from '@/lib/format';
import { fetchAllPaginated } from '@/lib/fetch-all-paginated';
import type {
  Company,
  Contract,
  ContractKind,
  ContractType,
  Customer,
  Project,
} from '@/lib/types';
import {
  contractFlowLabels,
  contractKindLabel,
  isExpenseContractKind,
  partnerTypeLabel,
} from '@/lib/contract-kind';
import {
  BILLING_CYCLES,
  CONTRACT_ATTACHMENT_KINDS,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  contractAttachmentKindLabel,
  type ContractAttachmentKind,
} from '@/lib/types';
import {
  normalizeContractTypesInput,
  parseContractTypes,
  toggleContractType,
} from '@/lib/contract-type';
import {
  billingCycleLabel,
  contractStatusLabel,
  contractTypeLabel,
} from '@/components/shared/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z
  .object({
    kind: z.enum(['INVESTOR', 'SUBCONTRACTOR', 'SUPPLIER']),
    companyId: z.string().optional(),
    counterpartyId: z.string().optional(),
    projectId: z.string().uuid('Chọn dự án'),
    contractNo: z.string().min(1, 'Bắt buộc'),
    name: z.string().min(1, 'Bắt buộc'),
    contractType: z
      .string()
      .min(1, 'Chọn ít nhất một loại')
      .refine((v) => normalizeContractTypesInput(v) != null, {
        message: 'Chọn ít nhất một loại hợp đồng',
      }),
    contractValue: z
      .string()
      .min(1, 'Bắt buộc')
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
        message: 'Giá trị ≥ 0',
      })
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
        message: 'Tối đa 2 chữ số thập phân',
      }),
    billingCycle: z.enum([
      'MONTHLY',
      'BIMONTHLY',
      'QUARTERLY',
      'SEMI_ANNUALLY',
      'ANNUALLY',
      'MILESTONE',
      'CUSTOM',
    ]),
    signedDate: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'CANCELLED']),
    note: z.string().optional(),
    paymentTermDays: z
      .string()
      .min(1, 'Bắt buộc')
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 0, {
        message: 'Số ngày ≥ 0',
      }),
    durationYears: z
      .string()
      .optional()
      .refine((v) => !v?.trim() || (/^\d+$/.test(v) && Number(v) >= 1), {
        message: 'Nhập số năm ≥ 1 (vd. 1, 2)',
      }),
  })
  .superRefine((values, ctx) => {
    if (!isExpenseContractKind(values.kind)) return;
    if (!values.companyId) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyId'],
        message: 'Chọn công ty ký HĐ',
      });
    }
    if (!values.counterpartyId) {
      ctx.addIssue({
        code: 'custom',
        path: ['counterpartyId'],
        message: `Chọn ${partnerTypeLabel[values.kind].toLowerCase()}`,
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function decimalToInput(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

export function ContractForm({
  contractId,
  initial,
  defaultProjectId,
  defaultKind = 'INVESTOR',
  variant = 'card',
  onSaved,
  onCancel,
}: {
  contractId?: string;
  initial?: Contract;
  defaultProjectId?: string;
  /** Loại HĐ khi tạo mới (theo tab). Sau khi tạo không đổi được. */
  defaultKind?: ContractKind;
  /** 'plain' = chỉ form (dùng trong popup) */
  variant?: 'card' | 'plain';
  /** Có callback → không chuyển trang sau khi lưu (popup) */
  onSaved?: (contract: Contract) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const kind: ContractKind = initial?.kind ?? defaultKind;
  const expense = isExpenseContractKind(kind);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<Customer[]>([]);
  // File PDF chọn khi tạo mới — tải lên ngay sau khi HĐ được tạo
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind,
      companyId: initial?.companyId ?? '',
      counterpartyId: initial?.counterpartyId ?? '',
      projectId: initial?.projectId ?? defaultProjectId ?? '',
      contractNo: initial?.contractNo ?? '',
      name: initial?.name ?? '',
      contractType: initial?.contractType ?? 'PROJECT',
      contractValue: decimalToInput(initial?.contractValue),
      billingCycle: initial?.billingCycle ?? 'MONTHLY',
      signedDate: toDateInputValue(initial?.signedDate),
      startDate: toDateInputValue(initial?.startDate),
      endDate: toDateInputValue(initial?.endDate),
      status: initial?.status ?? 'DRAFT',
      note: initial?.note ?? '',
      paymentTermDays: String(initial?.paymentTermDays ?? 60),
      durationYears:
        initial?.durationYears != null ? String(initial.durationYears) : '',
    },
  });

  useEffect(() => {
    projectsApi
      .list({ limit: 100, sortBy: 'code', sortOrder: 'asc' })
      .then((res) => setProjects(res.data))
      .catch(() => toast.error('Không tải được dự án'));
    companiesApi
      .list({ limit: 100 })
      .then((res) => setCompanies(res.data))
      .catch(() => toast.error('Không tải được công ty'));
  }, []);

  useEffect(() => {
    if (!expense) return;
    fetchAllPaginated((page, limit) =>
      customersApi.list({
        page,
        limit,
        partnerType: kind,
        sortBy: 'code',
        sortOrder: 'asc',
      }),
    )
      .then(setPartners)
      .catch(() =>
        toast.error(`Không tải được ${partnerTypeLabel[kind].toLowerCase()}`),
      );
  }, [expense, kind]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...(contractId ? {} : { kind }),
      companyId: values.companyId || null,
      ...(expense ? { counterpartyId: values.counterpartyId || null } : {}),
      projectId: values.projectId,
      contractNo: values.contractNo,
      name: values.name,
      contractType: normalizeContractTypesInput(values.contractType)!,
      contractValue: Number(values.contractValue),
      billingCycle: values.billingCycle,
      status: values.status,
      note: values.note || undefined,
      paymentTermDays: Number(values.paymentTermDays),
      durationYears: values.durationYears?.trim()
        ? Number(values.durationYears)
        : undefined,
      signedDate: values.signedDate
        ? new Date(values.signedDate).toISOString()
        : undefined,
      startDate: values.startDate
        ? new Date(values.startDate).toISOString()
        : undefined,
      endDate: values.endDate
        ? new Date(values.endDate).toISOString()
        : undefined,
    };

    try {
      const saved = contractId
        ? await contractsApi.update(contractId, payload)
        : await contractsApi.create(payload);
      toast.success(
        contractId ? 'Cập nhật hợp đồng thành công' : 'Tạo hợp đồng thành công',
      );
      if (!contractId && pendingFiles.length > 0) {
        await uploadPendingFiles(saved.id, pendingFiles);
        setPendingFiles([]);
      }
      if (onSaved) {
        onSaved(saved);
        return;
      }
      router.push(`/contracts/${saved.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
    }
  };

  const form = (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" {...register('kind')} />
          <div className="space-y-2">
            <Label>Dự án *</Label>
            <Select {...register('projectId')}>
              <option value="">— Chọn dự án —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
            {errors.projectId && (
              <p className="text-xs text-red-600">{errors.projectId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Công ty ký HĐ{expense ? ' *' : ''}</Label>
            <Select {...register('companyId')}>
              <option value="">— Chọn công ty —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
            {errors.companyId && (
              <p className="text-xs text-red-600">{errors.companyId.message}</p>
            )}
            {companies.length === 0 ? (
              <p className="text-xs text-amber-700">
                Chưa có công ty — thêm ở menu Công ty.
              </p>
            ) : null}
          </div>
          {expense ? (
            <div className="space-y-2 md:col-span-2">
              <Label>{partnerTypeLabel[kind]} *</Label>
              <Select {...register('counterpartyId')}>
                <option value="">
                  — Chọn {partnerTypeLabel[kind].toLowerCase()} —
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
              {errors.counterpartyId && (
                <p className="text-xs text-red-600">
                  {errors.counterpartyId.message}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Danh sách lấy từ Đối tác → tab {partnerTypeLabel[kind]}.
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Số hợp đồng *</Label>
            <Input {...register('contractNo')} />
            {errors.contractNo && (
              <p className="text-xs text-red-600">
                {errors.contractNo.message}
              </p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tên hợp đồng *</Label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Loại hợp đồng *</Label>
            <Controller
              name="contractType"
              control={control}
              render={({ field }) => {
                const selected = new Set(parseContractTypes(field.value ?? ''));
                return (
                  <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                    {CONTRACT_TYPES.map((type: ContractType) => (
                      <label
                        key={type}
                        className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          checked={selected.has(type)}
                          onChange={(e) =>
                            field.onChange(
                              toggleContractType(
                                field.value ?? '',
                                type,
                                e.target.checked,
                              ),
                            )
                          }
                        />
                        {contractTypeLabel[type]}
                      </label>
                    ))}
                  </div>
                );
              }}
            />
            {errors.contractType && (
              <p className="text-xs text-red-600">
                {errors.contractType.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Có thể chọn nhiều loại (vd. Bảo trì + Vận hành). Khi nhập Excel,
              ghi mã cách nhau bằng &quot;;&quot; — OPERATION;MAINTENANCE
            </p>
          </div>
          <div className="space-y-2">
            <Label>Giá trị hợp đồng *</Label>
            <Controller
              name="contractValue"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.contractValue && (
              <p className="text-xs text-red-600">
                {errors.contractValue.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Ngày ký</Label>
            <Input type="date" {...register('signedDate')} />
          </div>
          <div className="space-y-2">
            <Label>Chu kỳ nghiệm thu *</Label>
            <Select {...register('billingCycle')}>
              {BILLING_CYCLES.map((c) => (
                <option key={c} value={c}>
                  {billingCycleLabel[c]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">
              Dùng chung với thời hạn (năm) để tính số lần NT trên dashboard
            </p>
          </div>
          <div className="space-y-2">
            <Label>Thời hạn hợp đồng (năm)</Label>
            <Input
              {...register('durationYears')}
              inputMode="numeric"
              placeholder="1"
            />
            {errors.durationYears && (
              <p className="text-xs text-red-600">
                {errors.durationYears.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Vd. 1 năm + chu kỳ Quý → dashboard hiển thị 4 lần NT
            </p>
          </div>
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <Input type="date" {...register('startDate')} />
          </div>
          <div className="space-y-2">
            <Label>Ngày kết thúc</Label>
            <Input type="date" {...register('endDate')} />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select {...register('status')}>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {contractStatusLabel[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Điều khoản thanh toán (ngày) *</Label>
            <Input
              {...register('paymentTermDays')}
              inputMode="numeric"
              placeholder="60"
            />
            {errors.paymentTermDays && (
              <p className="text-xs text-red-600">
                {errors.paymentTermDays.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {contractFlowLabels(kind).paymentTermHint}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea {...register('note')} />
          </div>
          {contractId ? null : (
            <div className="space-y-2 md:col-span-2">
              <Label>File hợp đồng (PDF)</Label>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    const pdfs = picked.filter(isPdfFile);
                    if (pdfs.length < picked.length) {
                      toast.error('Chỉ nhận file PDF');
                    }
                    setPendingFiles((prev) => [
                      ...prev,
                      ...pdfs.map((file, i) => ({
                        file,
                        kind: (prev.length === 0 && i === 0
                          ? 'CONTRACT'
                          : 'APPENDIX') as ContractAttachmentKind,
                      })),
                    ]);
                    e.target.value = '';
                  }}
                />
                {pendingFiles.length > 0 ? (
                  <ul className="mb-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                    {pendingFiles.map((item, index) => (
                      <li
                        key={`${item.file.name}-${index}`}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-red-600" />
                        <span className="min-w-0 flex-1 truncate" title={item.file.name}>
                          {item.file.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatFileSize(item.file.size)}
                        </span>
                        <Select
                          className="h-8 w-32 text-xs"
                          value={item.kind}
                          onChange={(e) =>
                            setPendingFiles((prev) =>
                              prev.map((p, i) =>
                                i === index
                                  ? {
                                      ...p,
                                      kind: e.target
                                        .value as ContractAttachmentKind,
                                    }
                                  : p,
                              ),
                            )
                          }
                        >
                          {CONTRACT_ATTACHMENT_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {contractAttachmentKindLabel[k]}
                            </option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`Bỏ ${item.file.name}`}
                          onClick={() =>
                            setPendingFiles((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4" />
                    {pendingFiles.length > 0 ? 'Thêm file' : 'Chọn file PDF'}
                  </Button>
                  <p className="text-xs text-slate-500">
                    File được lưu vào mục Đính kèm của HĐ ngay khi bấm Lưu (tùy chọn).
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => (onCancel ? onCancel() : router.back())}
            >
              Hủy
            </Button>
          </div>
        </form>
  );

  if (variant === 'plain') return form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {contractId ? 'Sửa' : 'Thêm'} {contractKindLabel[kind]}
        </CardTitle>
        <p className="text-sm text-slate-500">{contractFormDescription(kind)}</p>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}

type PendingFile = { file: File; kind: ContractAttachmentKind };

function isPdfFile(file: File) {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Tải lần lượt file đính kèm của HĐ vừa tạo — lỗi file nào báo file đó, HĐ vẫn giữ */
async function uploadPendingFiles(contractId: string, files: PendingFile[]) {
  const failed: string[] = [];
  for (const { file, kind } of files) {
    try {
      await contractAttachmentsApi.upload(contractId, { file, kind });
    } catch {
      failed.push(file.name);
    }
  }
  const ok = files.length - failed.length;
  if (ok > 0) toast.success(`Đã đính kèm ${ok} file PDF`);
  if (failed.length > 0) {
    toast.error(
      `Không tải lên được: ${failed.join(', ')} — thêm lại ở mục Đính kèm của HĐ`,
    );
  }
}

export function contractFormDescription(kind: ContractKind) {
  return isExpenseContractKind(kind)
    ? 'HĐ chi — công ty trả tiền cho đối tác; khoản chi trả được tính vào chi phí dự án.'
    : 'HĐ thu — chủ đầu tư (khách hàng của dự án) trả tiền cho công ty.';
}
