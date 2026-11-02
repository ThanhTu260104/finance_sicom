import type { ProjectAssignment } from '@/lib/types';

export function assignmentQuantity(assignment: ProjectAssignment): number {
  const q = assignment.quantity;
  return Number.isFinite(q) && q >= 0 ? q : 0;
}

export function sumAssignmentQuantity(items: ProjectAssignment[]): number {
  return items.reduce((sum, item) => sum + assignmentQuantity(item), 0);
}
