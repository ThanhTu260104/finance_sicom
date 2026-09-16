'use client';

import { useEffect, useState } from 'react';
import { acceptanceSchedulesApi } from '@/lib/api';
import type { AcceptanceSchedule, AcceptanceScheduleMethod } from '@/lib/types';
import { formatCurrencyVND, formatDate, formatPeriod } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDeleteButton } from '@/components/shared/confirm-delete-button';
import { toast } from 'sonner';

const METHOD_LABEL: Record<AcceptanceScheduleMethod, string> = {
  FIXED_AMOUNT: 'Giá trị cố định',
  PERCENT_OF_CONTRACT: '% giá trị HĐ',
  QUANTITY: 'Theo khối lượng',
};

export function AcceptanceSchedulesSection({ contractId }: { contractId: string }) {
  const [items, setItems] = useState<AcceptanceSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sequence: '', name: '', startPeriod: '', endPeriod: '', dueDate: '', method: 'FIXED_AMOUNT' as AcceptanceScheduleMethod, plannedAmount: '', percentOfContract: '', plannedQuantity: '', unit: '' });
  const load = async () => { try { setItems(await acceptanceSchedulesApi.list(contractId)); } catch (e) { toast.error(e instanceof Error ? e.message : 'Không tải được lịch nghiệm thu'); } };
  useEffect(() => { void load(); }, [contractId]);
  const save = async () => {
    if (!form.sequence || !form.name) return toast.error('Nhập số đợt và tên đợt nghiệm thu');
    setBusy(true);
    try {
      await acceptanceSchedulesApi.create(contractId, {
        sequence: Number(form.sequence), name: form.name, startPeriod: form.startPeriod || undefined, endPeriod: form.endPeriod || undefined, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined, method: form.method,
        plannedAmount: form.plannedAmount ? Number(form.plannedAmount) : undefined, percentOfContract: form.percentOfContract ? Number(form.percentOfContract) : undefined, plannedQuantity: form.plannedQuantity ? Number(form.plannedQuantity) : undefined, unit: form.unit || undefined,
      });
      toast.success('Đã tạo lịch đợt nghiệm thu'); setShowForm(false); setForm({ sequence: '', name: '', startPeriod: '', endPeriod: '', dueDate: '', method: 'FIXED_AMOUNT', plannedAmount: '', percentOfContract: '', plannedQuantity: '', unit: '' }); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Lưu thất bại'); } finally { setBusy(false); }
  };
  return <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Lịch đợt nghiệm thu</CardTitle><p className="mt-1 text-sm text-slate-500">Dùng cho HĐ 3/6/12 tháng, trọn gói hoặc theo khối lượng. Khác với kế hoạch thực hiện theo tháng.</p></div><Button size="sm" onClick={() => setShowForm(v => !v)}>{showForm ? 'Đóng' : 'Thêm đợt'}</Button></CardHeader><CardContent className="space-y-4">{showForm ? <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-3"><div><Label>Số đợt *</Label><Input value={form.sequence} onChange={e => setForm({...form, sequence:e.target.value})} /></div><div className="md:col-span-2"><Label>Tên/mốc nghiệm thu *</Label><Input placeholder="NT quý I / Nghiệm thu cuối HĐ" value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div><div><Label>Từ kỳ</Label><Input placeholder="2026-01" value={form.startPeriod} onChange={e => setForm({...form, startPeriod:e.target.value})} /></div><div><Label>Đến kỳ</Label><Input placeholder="2026-03" value={form.endPeriod} onChange={e => setForm({...form, endPeriod:e.target.value})} /></div><div><Label>Hạn nghiệm thu</Label><Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate:e.target.value})} /></div><div><Label>Cách tính *</Label><Select value={form.method} onChange={e => setForm({...form, method:e.target.value as AcceptanceScheduleMethod})}>{Object.entries(METHOD_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></div>{form.method === 'PERCENT_OF_CONTRACT' ? <div><Label>% giá trị HĐ</Label><Input type="number" value={form.percentOfContract} onChange={e => setForm({...form, percentOfContract:e.target.value})} /></div> : form.method === 'QUANTITY' ? <><div><Label>Khối lượng KH</Label><Input type="number" value={form.plannedQuantity} onChange={e => setForm({...form, plannedQuantity:e.target.value})} /></div><div><Label>Đơn vị</Label><Input placeholder="m², tấn..." value={form.unit} onChange={e => setForm({...form, unit:e.target.value})} /></div></> : <div><Label>Giá trị KH</Label><MoneyInput value={form.plannedAmount} onChange={value => setForm({...form, plannedAmount:value})} /></div>}<div className="flex items-end"><Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? 'Đang lưu...' : 'Lưu đợt'}</Button></div></div> : null}<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Đợt</TableHead><TableHead>Khoảng thực hiện</TableHead><TableHead>Hạn NT</TableHead><TableHead>Cách tính</TableHead><TableHead>KH</TableHead><TableHead>Đã gắn NT</TableHead><TableHead /></TableRow></TableHeader><TableBody>{items.map(item => <TableRow key={item.id}><TableCell className="font-medium">#{item.sequence} · {item.name}</TableCell><TableCell>{item.startPeriod ? `${formatPeriod(item.startPeriod)} → ${formatPeriod(item.endPeriod ?? item.startPeriod)}` : '—'}</TableCell><TableCell>{formatDate(item.dueDate)}</TableCell><TableCell>{METHOD_LABEL[item.method]}</TableCell><TableCell>{item.method === 'QUANTITY' ? `${item.plannedQuantity ?? 0} ${item.unit ?? ''}` : item.method === 'PERCENT_OF_CONTRACT' ? `${item.percentOfContract ?? 0}%` : formatCurrencyVND(item.plannedAmount)}</TableCell><TableCell>{item._count?.acceptances ?? 0}</TableCell><TableCell><ConfirmDeleteButton onConfirm={async () => { await acceptanceSchedulesApi.remove(item.id); await load(); }} title="Xóa lịch đợt?" description="Các nghiệm thu đã gắn vẫn được giữ, nhưng không còn thuộc đợt này." /></TableCell></TableRow>)}{items.length === 0 ? <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">Chưa có lịch đợt. HĐ nghiệm thu theo tháng có thể dùng kế hoạch tháng hiện có; HĐ theo quý/6 tháng/trọn gói nên tạo lịch tại đây.</TableCell></TableRow> : null}</TableBody></Table></div></CardContent></Card>;
}
