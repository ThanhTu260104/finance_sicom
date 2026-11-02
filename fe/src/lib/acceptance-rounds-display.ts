/** Hiển thị gợi ý đợt NT — thống nhất từ ngữ «đã nghiệm thu». */
export function formatScheduleHintDisplay(hint: string): string {
  return hint
    .replace(/Đã nộp HS/g, 'Đã nghiệm thu')
    .replace(/đã nộp HS/g, 'đã nghiệm thu')
    .replace(/đợt đã nộp hồ sơ/gi, 'đợt đã nghiệm thu');
}

export function formatRoundsAcceptedLabel(submitted: number, total: number) {
  if (total <= 0) return '—';
  return `${submitted}/${total}`;
}
