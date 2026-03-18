import type { calendar_v3 } from 'googleapis';

export type EventWithId = calendar_v3.Schema$Event & { id: string };

export function isEventWithId(event: calendar_v3.Schema$Event): event is EventWithId {
  return !!event.id;
}
