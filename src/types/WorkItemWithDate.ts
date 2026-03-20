import type { WorkItemBase } from '@makeplane/plane-node-sdk';

export type WorkItemWithDateAndState = WorkItemBase & {
  target_date: string
  state: string
};

export function isWorkItemWithDate(workItem: WorkItemBase): workItem is WorkItemWithDateAndState {
  return !!workItem.target_date && !!workItem.state;
}
