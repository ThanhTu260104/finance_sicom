'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, type AppUser } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MIN_LENGTH = 6;

/**
 * Đổi mật khẩu.
 * - Không có `target`: người dùng tự đổi, phải nhập mật khẩu hiện tại.
 * - Có `target`: admin đặt lại mật khẩu cho tài khoản đó.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: Pick<AppUser, 'id' | 'displayName' | 'email'> | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* key: mở lại là form trống */}
        {open ? (
          <PasswordForm
            key={target?.id ?? 'self'}
            target={target}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PasswordForm({
  target,
  onDone,
}: {
  target?: Pick<AppUser, 'id' | 'displayName' | 'email'> | null;
  onDone: () => void;
}) {
  const isAdminReset = !!target;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdminReset && !current) {
      setError('Nhập mật khẩu hiện tại');
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Mật khẩu mới tối thiểu ${MIN_LENGTH} ký tự`);
      return;
    }
    if (next !== confirm) {
      setError('Nhập lại mật khẩu mới không khớp');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (isAdminReset) {
        await authApi.setUserPassword(target.id, next);
        toast.success(`Đã đổi mật khẩu cho ${target.displayName}`);
      } else {
        await authApi.changePassword(current, next);
        toast.success('Đã đổi mật khẩu');
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex min-h-0 flex-col"
    >
      <DialogHeader>
        <DialogTitle>
          {isAdminReset ? 'Đặt lại mật khẩu' : 'Đổi mật khẩu'}
        </DialogTitle>
        <DialogDescription>
          {isAdminReset
            ? `Tài khoản ${target.displayName} (${target.email}) — không cần mật khẩu cũ. Gửi mật khẩu mới cho người dùng.`
            : 'Nhập mật khẩu hiện tại rồi đặt mật khẩu mới.'}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        {!isAdminReset ? (
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Mật khẩu hiện tại</Label>
            <Input
              id="pw-current"
              type={type}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Mật khẩu mới</Label>
          <div className="relative">
            <Input
              id="pw-new"
              type={type}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={`Tối thiểu ${MIN_LENGTH} ký tự`}
              className="pr-10"
              autoFocus={isAdminReset}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Nhập lại mật khẩu mới</Label>
          <Input
            id="pw-confirm"
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </DialogFooter>
    </form>
  );
}
