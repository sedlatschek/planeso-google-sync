import type { WorkItemBase } from '@makeplane/plane-node-sdk';

export type WorkItemWithDates = WorkItemBase & {
  start_date: string
  target_date: string
};

export function isWorkItemWithDates(workItem: WorkItemBase): workItem is WorkItemWithDates {
  return !!workItem.start_date && !!workItem.target_date;
}
