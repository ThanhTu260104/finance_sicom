import type { ContractType } from '@/lib/types';
import { CONTRACT_TYPES } from '@/lib/types';

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  MAINTENANCE: 'Bảo trì',
  OPERATION: 'Vận hành',
  REPAIR: 'Sửa chữa',
  PROJECT: 'Dự án',
};

const CONTRACT_TYPE_SET = new Set<string>(CONTRACT_TYPES);

/** Map mã + nhãn tiếng Việt (không dấu / có dấu) → ContractType */
const TYPE_ALIASES: Record<string, ContractType> = {
  MAINTENANCE: 'MAINTENANCE',
  OPERATION: 'OPERATION',
  REPAIR: 'REPAIR',
  PROJECT: 'PROJECT',
  'BAO TRI': 'MAINTENANCE',
  'BẢO TRÌ': 'MAINTENANCE',
  'BAOTRI': 'MAINTENANCE',
  'VAN HANH': 'OPERATION',
  'VẬN HÀNH': 'OPERATION',
  'VANHANH': 'OPERATION',
  'SUA CHUA': 'REPAIR',
  'SỬA CHỮA': 'REPAIR',
  'SUACHUA': 'REPAIR',
  'DU AN': 'PROJECT',
  'DỰ ÁN': 'PROJECT',
  'DUAN': 'PROJECT',
};

function normalizeToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function resolveContractTypeToken(raw: string): ContractType | null {
  const key = normalizeToken(raw);
  if (!key) return null;
  if (CONTRACT_TYPE_SET.has(key)) return key as ContractType;
  return TYPE_ALIASES[key] ?? null;
}

export function parseContractTypes(value: string): ContractType[] {
  return value
    .split(';')
    .map((s) => resolveContractTypeToken(s))
    .filter((t): t is ContractType => t != null);
}

export function normalizeContractTypesInput(raw: string): string | null {
  const parts = raw
    .split(';')
    .map((s) => resolveContractTypeToken(s))
    .filter((t): t is ContractType => t != null);
  if (parts.length === 0) return null;
  // Reject if any non-empty token failed to resolve
  const tokens = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.some((t) => resolveContractTypeToken(t) == null)) return null;
  return [...new Set(parts)].join(';');
}

export function formatContractTypesDisplay(value?: string | null): string {
  if (!value?.trim()) return '—';
  const types = parseContractTypes(value);
  if (types.length === 0) return value;
  return types.map((t) => CONTRACT_TYPE_LABEL[t]).join(', ');
}

export function validateContractTypesField(raw: string): string[] {
  const errors: string[] = [];
  if (!raw?.trim()) {
    errors.push('Thiếu loại HĐ');
    return errors;
  }
  if (normalizeContractTypesInput(raw) == null) {
    errors.push(
      `Loại HĐ: ${CONTRACT_TYPES.join(' | ')} hoặc tên TV (nhiều loại cách nhau bằng ";")`,
    );
  }
  return errors;
}

export function toggleContractType(
  current: string,
  type: ContractType,
  checked: boolean,
): string {
  const set = new Set(parseContractTypes(current));
  if (checked) set.add(type);
  else set.delete(type);
  return [...set].join(';');
}
