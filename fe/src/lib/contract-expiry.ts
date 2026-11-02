import type { Contract, ContractStatus } from '@/lib/types';
import { calendarYmdInVn } from '@/lib/calendar-date-vn';

/** Còn ≤ số ngày này tới ngày kết thúc → "Sắp hết hạn" */
export const CONTRACT_EXPIRING_WARN_DAYS = 30;

/** HĐ đã đóng — không đưa vào danh sách hết hạn (HĐ hoàn thành hiện ở khối riêng) */
const CLOSED_STATUSES: ContractStatus[] = ['COMPLETED', 'TERMINATED', 'CANCELLED'];

export type ContractExpiryState = 'EXPIRED' | 'EXPIRING' | 'VALID' | 'NO_END_DATE';

export type ContractExpiry = {
  state: ContractExpiryState;
  /** Số ngày tới ngày kết thúc (âm = đã quá) */
  daysLeft: number | null;
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trạng thái thời hạn chỉ dựa vào ngày kết thúc (lịch VN), không dựa vào
 * trạng thái HĐ. Ngày kết thúc là ngày cuối còn hiệu lực.
 */
export function getContractExpiry(
  endDate: string | null | undefined,
  now = new Date(),
): ContractExpiry {
  if (!endDate) {
    return { state: 'NO_END_DATE', daysLeft: null, label: 'Chưa có ngày kết thúc' };
  }
  const [y, m, d] = endDate.slice(0, 10).split('-').map(Number);
  const today = calendarYmdInVn(now);
  const daysLeft = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month - 1, today.day)) /
      DAY_MS,
  );
  if (daysLeft < 0) {
    return {
      state: 'EXPIRED',
      daysLeft,
      label: `Đã hết hạn ${Math.abs(daysLeft)} ngày`,
    };
  }
  if (daysLeft <= CONTRACT_EXPIRING_WARN_DAYS) {
    return {
      state: 'EXPIRING',
      daysLeft,
      label: daysLeft === 0 ? 'Hết hạn hôm nay' : `Sắp hết hạn · còn ${daysLeft} ngày`,
    };
  }
  return { state: 'VALID', daysLeft, label: `Còn hiệu lực · ${daysLeft} ngày` };
}

export function isClosedContract(status: ContractStatus) {
  return CLOSED_STATUSES.includes(status);
}

/**
 * Tách HĐ thành 2 nhóm để không nhầm:
 * - expiring: HĐ chưa đóng, đã hết hạn hoặc sắp hết hạn theo ngày kết thúc
 * - completed: HĐ đã chuyển trạng thái Hoàn thành
 */
export function splitContractsForHighlight<
  T extends Pick<Contract, 'status' | 'endDate'>,
>(contracts: T[], now = new Date()) {
  const expiring = contracts
    .filter((c) => !isClosedContract(c.status))
    .map((contract) => ({ contract, expiry: getContractExpiry(contract.endDate, now) }))
    .filter(({ expiry }) => expiry.state === 'EXPIRED' || expiry.state === 'EXPIRING')
    .sort((a, b) => (a.expiry.daysLeft ?? 0) - (b.expiry.daysLeft ?? 0));
  const completed = contracts.filter((c) => c.status === 'COMPLETED');
  return { expiring, completed };
}
