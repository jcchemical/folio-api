import { WorkItemStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Readonly<
  Record<WorkItemStatus, readonly WorkItemStatus[]>
> = {
  IDENTIFIED: [WorkItemStatus.VALIDATED, WorkItemStatus.NEEDS_REVIEW],
  NEEDS_REVIEW: [WorkItemStatus.VALIDATED],
  VALIDATED: [],
};

export function canTransition(
  from: WorkItemStatus,
  to: WorkItemStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
