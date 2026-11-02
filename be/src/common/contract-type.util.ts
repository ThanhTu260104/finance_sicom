import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const CONTRACT_TYPE_CODES = [
  'MAINTENANCE',
  'OPERATION',
  'REPAIR',
  'PROJECT',
] as const;

export type ContractTypeCode = (typeof CONTRACT_TYPE_CODES)[number];

const CONTRACT_TYPE_SET = new Set<string>(CONTRACT_TYPE_CODES);

export function isValidContractTypes(raw: string): boolean {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  const parts = raw
    .split(';')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => CONTRACT_TYPE_SET.has(p));
}

export function normalizeContractTypes(raw: string): string {
  if (!isValidContractTypes(raw)) {
    throw new BadRequestException(
      `contractType must be one or more of ${CONTRACT_TYPE_CODES.join(
        ', ',
      )} separated by ";"`,
    );
  }
  const parts = raw
    .split(';')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(parts)].join(';');
}

export function contractTypeFilterWhere(
  type: ContractTypeCode,
): Prisma.ContractWhereInput {
  return {
    OR: [
      { contractType: type },
      { contractType: { startsWith: `${type};` } },
      { contractType: { endsWith: `;${type}` } },
      { contractType: { contains: `;${type};` } },
    ],
  };
}
