import type { WorkItemBase } from '@makeplane/plane-node-sdk';

export type WorkItemWithDate = WorkItemBase & { target_date: string };

export function isWorkItemWithDate(workItem: WorkItemBase): workItem is WorkItemWithDate {
  return !!workItem.target_date;
}
