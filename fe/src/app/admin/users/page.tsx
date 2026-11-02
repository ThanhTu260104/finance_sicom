'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { ChangePasswordDialog } from '@/components/auth/change-password-dialog';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  authApi,
  isSystemAdmin,
  type AppUser,
  type UserAccessPayload,
} from '@/lib/api';
import { ApiError } from '@/lib/api/client';
import { FEATURES } from '@/lib/features';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const DEFAULT_ACCESS: UserAccessPayload = { accessMode: 'FULL', permissions: [] };

/** Chọn chế độ quyền + tính năng (dùng khi tạo và khi sửa tài khoản) */
function AccessEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: UserAccessPayload;
  onChange: (next: UserAccessPayload) => void;
  idPrefix: string;
}) {
  const limited = value.accessMode === 'LIMITED';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['FULL', 'Toàn quyền', 'Dùng mọi tính năng (như trước đây)'],
            ['READONLY', 'Chỉ xem', 'Xem mọi trang, không thêm / sửa / xóa'],
            ['LIMITED', 'Giới hạn theo tính năng', 'Chỉ các tính năng được chọn'],
          ] as const
        ).map(([mode, label, hint]) => (
          <label
            key={mode}
            className={cn(
              'flex min-w-[14rem] flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm',
              value.accessMode === mode
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 hover:bg-slate-50',
            )}
          >
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              className="mt-0.5"
              checked={value.accessMode === mode}
              onChange={() =>
                onChange({
                  accessMode: mode,
                  permissions: mode === 'LIMITED' ? value.permissions : [],
                })
              }
            />
            <span>
              <span className="block font-medium text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      {limited ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Tính năng được dùng
          </p>
          {FEATURES.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-start gap-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={value.permissions.includes(f.key)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    permissions: e.target.checked
                      ? [...value.permissions, f.key]
                      : value.permissions.filter((p) => p !== f.key),
                  })
                }
              />
              <span>
                <span className="block font-medium">{f.label}</span>
                <span className="block text-xs text-slate-500">
                  {f.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function accessSummary(u: AppUser) {
  if (u.role === 'ADMIN') return 'Quản trị';
  if (u.accessMode === 'READONLY') return 'Chỉ xem';
  if (u.accessMode !== 'LIMITED') return 'Toàn quyền';
  const labels = FEATURES.filter((f) => u.permissions.includes(f.key)).map(
    (f) => f.label,
  );
  return `Giới hạn: ${labels.join(', ') || '—'}`;
}

function validAccess(access: UserAccessPayload) {
  return access.accessMode !== 'LIMITED' || access.permissions.length > 0;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [access, setAccess] = useState<UserAccessPayload>(DEFAULT_ACCESS);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccess, setEditAccess] = useState<UserAccessPayload>(DEFAULT_ACCESS);
  const [savingAccess, setSavingAccess] = useState(false);
  // Tài khoản đang được admin đặt lại mật khẩu
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);

  const canManage = isSystemAdmin(user);

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      setUsers(await authApi.listUsers());
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Không tải được danh sách',
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!user) return;
    if (!canManage) {
      router.replace('/');
      return;
    }
    void load();
  }, [user, canManage, load, router]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validAccess(access)) {
      toast.error('Tài khoản giới hạn cần chọn ít nhất một tính năng');
      return;
    }
    setSaving(true);
    try {
      await authApi.createUser({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        ...access,
      });
      toast.success('Đã tạo tài khoản');
      setDisplayName('');
      setEmail('');
      setPassword('');
      setAccess(DEFAULT_ACCESS);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Tạo tài khoản thất bại');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: AppUser) => {
    setEditingId(u.id);
    setEditAccess({ accessMode: u.accessMode, permissions: u.permissions });
  };

  const onSaveAccess = async (u: AppUser) => {
    if (!validAccess(editAccess)) {
      toast.error('Tài khoản giới hạn cần chọn ít nhất một tính năng');
      return;
    }
    setSavingAccess(true);
    try {
      await authApi.updateUserAccess(u.id, editAccess);
      toast.success(`Đã cập nhật quyền cho ${u.displayName}`);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Cập nhật quyền thất bại');
    } finally {
      setSavingAccess(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Quản lý tài khoản' },
        ]}
      />
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          Quản lý tài khoản
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Chỉ tài khoản quản trị hệ thống được tạo người dùng và phân quyền.
          Tài khoản <strong>giới hạn</strong> chỉ thấy và dùng được các tính năng
          được chọn; quyền đổi xong có hiệu lực ngay.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-slate-900">Tạo tài khoản</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="displayName">Tên chủ tài khoản</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">Email đăng nhập</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu</Label>
            <Input
              id="new-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Phân quyền</Label>
            <AccessEditor value={access} onChange={setAccess} idPrefix="new" />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Đang tạo…' : 'Tạo tài khoản'}
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          Danh sách tài khoản
        </h2>
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Đang tải…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="space-y-3 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{u.displayName}</p>
                    <p className="text-slate-600">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        u.role !== 'ADMIN' && u.accessMode === 'LIMITED'
                          ? 'bg-amber-100 text-amber-800'
                          : u.role !== 'ADMIN' && u.accessMode === 'READONLY'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {accessSummary(u)}
                    </span>
                    {u.role !== 'ADMIN' && editingId !== u.id ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(u)}
                      >
                        Phân quyền
                      </Button>
                    ) : null}
                    {u.id !== user?.id ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPasswordTarget(u)}
                        className="gap-1.5"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Đổi mật khẩu
                      </Button>
                    ) : null}
                  </div>
                </div>
                {editingId === u.id ? (
                  <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                    <AccessEditor
                      value={editAccess}
                      onChange={setEditAccess}
                      idPrefix={`edit-${u.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingAccess}
                        onClick={() => void onSaveAccess(u)}
                      >
                        {savingAccess ? 'Đang lưu…' : 'Lưu quyền'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ChangePasswordDialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) setPasswordTarget(null);
        }}
        target={passwordTarget}
      />
    </div>
  );
}
